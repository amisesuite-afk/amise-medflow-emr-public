import Foundation
import SwiftUI

// MARK: - Clinical Pipeline Orchestrator
//
// Runs the full 10-stage deterministic Bayesian pipeline for a patient
// and publishes consolidated results that ConsultationView observes.
//
// Pipeline stages (all deterministic, no network):
//   1. PatientStateVector assembly      — normalise all inputs
//   2. SequentialDiagnosisEngine seed   — Naive Bayes → log-posteriors
//   3. DynamicBayesianNetwork           — forward filter per top hypothesis
//   4. ClinicalChangePointDetector      — CUSUM over vitals time-series
//   5. BayesianDecisionEngine           — max rule + utility decisions
//   6. ValueOfInformationEngine         — EVPI-ranked next investigations
//   7. AutoFunctionEngine               — 8-function action list
//
// The orchestrator debounces rapid field edits (default 1.5 s) so the
// pipeline runs once per "pause", not on every keystroke.

@MainActor
final class ClinicalPipelineOrchestrator: ObservableObject {

    // MARK: - Published outputs (consumed by ConsultationView)

    @Published var hypotheses:       [DiagnosisHypothesis] = []
    @Published var trajectories:     [DiseaseTrajectory]   = []
    @Published var changePointAlerts:[ChangePointAlert]     = []
    @Published var decisions:        [ClinicalDecision]    = []
    @Published var informationItems: [InformationItem]     = []
    @Published var autoActions:      [AutoAction]          = []
    @Published var stateVector:      PatientStateVector?
    @Published var isRunning:        Bool = false

    // Error surface — nil when last run succeeded
    @Published var lastError: String?

    // MARK: - Private state

    private let sequentialEngine = SequentialDiagnosisEngine()
    private var debounceTask: Task<Void, Never>?

    // Debounce interval — long enough to avoid per-keystroke runs
    private static let debounceSeconds: TimeInterval = 1.5

    // MARK: - Public API

    /// Schedule a pipeline run for `patient`. Debounced — call freely on
    /// any field change; only fires after 1.5 s of silence.
    func schedule(for patient: Patient, socratesSelections: [String: Set<String>] = [:]) {
        debounceTask?.cancel()
        debounceTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(Self.debounceSeconds * 1_000_000_000))
            guard !Task.isCancelled else { return }
            await self?.run(patient: patient, socratesSelections: socratesSelections)
        }
    }

    /// Run immediately — use when the patient is first loaded (no debounce needed).
    func runNow(for patient: Patient, socratesSelections: [String: Set<String>] = [:]) {
        debounceTask?.cancel()
        Task { await run(patient: patient, socratesSelections: socratesSelections) }
    }

    // MARK: - Pipeline execution

    private func run(patient: Patient, socratesSelections: [String: Set<String>]) async {
        guard !isRunning else { return }
        isRunning = true
        lastError = nil
        defer { isRunning = false }

        // ── Stage 1: PatientStateVector ────────────────────────────────────
        var psv = PatientStateVector.from(patient: patient)

        // Merge in the UI's SOCRATES selections (not persisted on Patient)
        if !socratesSelections.isEmpty {
            psv.socratesSelections = socratesSelections
        }

        // ── Stage 2: Sequential Bayesian seeding ──────────────────────────
        // Augment SOCRATES selections with vitals-derived and lab-derived features
        // so Stage 2 benefits from objective findings, not just typed symptoms.
        var augmentedSocrates = psv.socratesSelections
        if let v = psv.vitals {
            var extraAssoc = augmentedSocrates["associations"] ?? []
            if v.hasFever         { extraAssoc.insert("fever") }
            if v.hasTachycardia   { extraAssoc.insert("tachycardia") }
            if v.hasHypotension   { extraAssoc.insert("hypotension") }
            if v.hasTachypnoea    { extraAssoc.insert("tachypnoea") }
            if v.hasHypoxia       { extraAssoc.insert("hypoxia") }
            if !extraAssoc.isEmpty { augmentedSocrates["associations"] = extraAssoc }
        }
        if let lab = psv.labs {
            var extraAssoc = augmentedSocrates["associations"] ?? []
            if lab.wbcElevated      { extraAssoc.insert("raised wbc") }
            if lab.crpHigh          { extraAssoc.insert("markedly elevated crp") }
            else if lab.crpElevated { extraAssoc.insert("elevated crp") }
            if lab.lactateElevated  { extraAssoc.insert("elevated lactate") }
            if lab.amylaseElevated  { extraAssoc.insert("elevated amylase") }
            if lab.bilirubinElevated{ extraAssoc.insert("raised bilirubin") }
            if lab.dDimerElevated   { extraAssoc.insert("elevated d-dimer") }
            if !extraAssoc.isEmpty { augmentedSocrates["associations"] = extraAssoc }
        }

        sequentialEngine.seed(
            chiefComplaint:    patient.chiefComplaint,
            socratesSelections: augmentedSocrates,
            pmhNotes:           patient.pmhNotes,
            surgicalHistory:    patient.surgicalHistory,
            examAbdo:           patient.examAbdo,
            examGeneral:        patient.examGeneral,
            investigations:     patient.investigations,
            ageYears:           patient.ageYears,
            sex:                patient.sex
        )

        let seeded = sequentialEngine.topDiagnoses(n: 10)
        psv.hypotheses = seeded
        hypotheses = seeded

        guard !seeded.isEmpty else {
            // No hypotheses yet — publish empty outputs and stop
            trajectories     = []
            changePointAlerts = []
            decisions        = []
            informationItems = []
            autoActions      = []
            stateVector      = psv
            return
        }

        // ── Stage 3: Dynamic Bayesian Network ─────────────────────────────
        let dbn = DynamicBayesianNetwork.trajectories(
            forHypotheses: seeded,
            vitals: patient.vitalsEntries
        )
        psv.trajectories = dbn
        trajectories = dbn

        // ── Stage 4: Change-point detection (CUSUM) ───────────────────────
        let cpAlerts = ClinicalChangePointDetector.detect(vitals: patient.vitalsEntries)
        psv.changePointAlerts = cpAlerts
        changePointAlerts = cpAlerts

        // ── Stage 5: Bayesian Decision Network ────────────────────────────
        let context = DecisionContext(
            ageYears:       patient.ageYears,
            sex:            patient.sex,
            asaClass:       patient.asaClass,
            acuity:         patient.acuity,
            clinicalScores: psv.clinicalScores,
            vitalsAlerts:   cpAlerts
        )
        let dec = BayesianDecisionEngine.decide(hypotheses: seeded, context: context)
        psv.decisions = dec
        decisions = dec

        // ── Stage 6: Value of Information ─────────────────────────────────
        let collected = Set(patient.investigations.map { $0.name.lowercased() })
        let voiItems = ValueOfInformationEngine.rank(
            hypotheses: seeded,
            alreadyCollected: collected
        )
        informationItems = voiItems

        // ── Stage 7: AutoFunction ──────────────────────────────────────────
        let actions = AutoFunctionEngine.generate(from: psv)
        autoActions = actions

        stateVector = psv
    }
}

// MARK: - Pipeline summary helpers

extension ClinicalPipelineOrchestrator {

    /// Highest-priority decision (emergency first)
    var topDecision: ClinicalDecision? {
        decisions.sorted { $0.priority < $1.priority }.first
    }

    /// Deterioration alerts from DBN trajectories (non-nil only)
    var deteriorationAlerts: [DeteriorationAlert] {
        trajectories.compactMap(\.deteriorationAlert)
    }

    /// Whether any emergency decision or deterioration alert exists
    var hasUrgentFlag: Bool {
        decisions.contains { $0.priority == .emergency } ||
        deteriorationAlerts.contains { $0.priority == .emergency } ||
        changePointAlerts.contains { $0.priority == .emergency }
    }

    /// Top-n AutoActions filtered by urgency
    func autoActions(urgency: AutoUrgency, limit: Int = 3) -> [AutoAction] {
        Array(autoActions.filter { $0.urgency == urgency }.prefix(limit))
    }

    /// Hypothesis probability formatted as percent string
    func probabilityString(for hypothesis: DiagnosisHypothesis) -> String {
        "\(Int((hypothesis.probability * 100).rounded()))%"
    }
}

// MARK: - Visit-type routing

extension ClinicalPipelineOrchestrator {

    // Determines which AutoFunctions are shown based on visit type.
    // Emergency surgery → all actions. Outpatient follow-up → no operative planning.
    func filteredAutoActions(for visitType: VisitType?) -> [AutoAction] {
        guard let vt = visitType else { return autoActions }

        switch vt {
        case .surgeryEmergency:
            return autoActions   // full set

        case .surgeryElective, .dayOfSurgery:
            // Suppress 'ask' prompts — history already taken. Focus on prepare/calculate.
            return autoActions.filter { $0.function != .ask }

        case .ercp, .ogd, .colonoscopy:
            // Endoscopy: only document, calculate, schedule, prepare
            return autoActions.filter {
                [AutoFunction.document, .calculate, .schedule, .prepare].contains($0.function)
            }

        case .newConsult, .urgentReview:
            return autoActions   // full diagnostic workup

        case .followUp, .postOp, .telephone:
            // Follow-up: suppress operative planning and emergency alerts if no urgent flags
            if hasUrgentFlag { return autoActions }
            return autoActions.filter {
                ![AutoFunction.prepare].contains($0.function)
            }

        case .trauma:
            // Trauma: prioritise alert, calculate, order; suppress documentation generation
            return autoActions.filter {
                [AutoFunction.alert, .calculate, .order, .compare].contains($0.function)
            }
        }
    }
}
