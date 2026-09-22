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
        do {
            let v = psv.vitals
            var extraAssoc = augmentedSocrates["associations"] ?? []
            if v.hasFever         { extraAssoc.insert("fever") }
            if v.hasTachycardia   { extraAssoc.insert("tachycardia") }
            if v.hasHypotension   { extraAssoc.insert("hypotension") }
            if v.hasTachypnoea    { extraAssoc.insert("tachypnoea") }
            if v.hasHypoxia       { extraAssoc.insert("hypoxia") }
            if !extraAssoc.isEmpty { augmentedSocrates["associations"] = extraAssoc }
        }
        do {
            let lab = psv.labs
            var extraAssoc = augmentedSocrates["associations"] ?? []
            if lab.wbcElevated        { extraAssoc.insert("raised wbc") }
            if lab.wbcLow             { extraAssoc.insert("leukopenia") }
            if lab.crpHigh            { extraAssoc.insert("markedly elevated crp") }
            else if lab.crpElevated   { extraAssoc.insert("elevated crp") }
            if lab.lactateElevated    { extraAssoc.insert("elevated lactate") }
            if lab.amylaseElevated    { extraAssoc.insert("elevated amylase") }
            if lab.lipaseElevated     { extraAssoc.insert("elevated lipase") }
            if lab.bilirubinElevated  {
                extraAssoc.insert("raised bilirubin")
                extraAssoc.insert("Jaundice")         // matches DB feature value exactly
            }
            if lab.dDimerElevated     { extraAssoc.insert("elevated d-dimer") }
            if lab.troponinElevated   { extraAssoc.insert("elevated troponin") }
            if lab.anaemia            {
                extraAssoc.insert("Anaemia symptoms") // matches DB feature value exactly
                extraAssoc.insert("Pallor")            // matches DB feature value exactly
            }
            if lab.akiMarker          {
                extraAssoc.insert("renal impairment")
                extraAssoc.insert("Oliguria")          // matches DB feature value (AKI pool)
            }
            if lab.inrElevated        { extraAssoc.insert("raised inr") }
            if lab.altElevated || lab.astElevated { extraAssoc.insert("elevated liver enzymes") }
            if lab.glucoseLow         { extraAssoc.insert("hypoglycaemia") }
            if lab.glucoseHigh        {
                extraAssoc.insert("hyperglycaemia")
                extraAssoc.insert("Polyuria")           // matches DB feature (diabetes pools)
                extraAssoc.insert("Polydipsia")         // matches DB feature (diabetes fatigue pool)
            }
            if lab.hypercalcaemia     { extraAssoc.insert("hypercalcaemia") }
            if lab.hypocalcaemia      { extraAssoc.insert("hypocalcaemia") }
            if lab.esrHigh            { extraAssoc.insert("elevated esr") }
            // Electrolyte disturbances → direct DB feature value matches
            if (lab.potassium?.value ?? 3.5) < 3.5 { extraAssoc.insert("Hypokalaemia") }
            if (lab.sodium?.value ?? 135) < 130     { extraAssoc.insert("Hyponatraemia") }
            if !extraAssoc.isEmpty { augmentedSocrates["associations"] = extraAssoc }
        }

        // Build a synthetic CC augment so investigation findings drive pool routing.
        // BDE combines chiefComplaint with invTerms for routing, but the pool conditions
        // are phrase-based; lab flags that don't match those phrases never reach the right pool.
        // Injecting these routing keywords here bridges that gap.
        var ccHints: [String] = []
        let lab = psv.labs
        if lab.troponinElevated              { ccHints.append("chest pain elevated troponin cardiac acs mi") }
        if lab.anaemia                        { ccHints.append("anaemia low haemoglobin pallor tiredness fatigue") }
        if lab.dDimerElevated                { ccHints.append("breathless chest pain leg swelling dvt pulmonary embolism") }
        if lab.amylaseElevated || lab.lipaseElevated { ccHints.append("epigastric back pain amylase pancreatitis") }
        if lab.lactateElevated && lab.wbcElevated    { ccHints.append("fever sepsis septic shock infection") }
        if lab.glucoseLow                    { ccHints.append("glucose low diabetes hypoglycaemia confusion sweating") }
        if lab.glucoseHigh                   { ccHints.append("glucose high hba1c diabetes hyperglycaemia polyuria") }
        if lab.bilirubinElevated             { ccHints.append("jaundice raised bilirubin yellow skin obstructive") }
        if lab.akiMarker                     { ccHints.append("renal impairment creatinine aki oliguria") }
        if lab.inrElevated                   { ccHints.append("coagulopathy inr bleeding bruising liver") }
        if lab.hypercalcaemia                { ccHints.append("hypercalcaemia calcium bones stones groans moans") }
        if lab.hypocalcaemia                 { ccHints.append("hypocalcaemia calcium tetany spasm muscle cramp") }
        if lab.esrHigh || lab.crpHigh        { ccHints.append("inflammation infection malignancy arthritis weight loss") }
        if lab.wbcLow                        { ccHints.append("leukopenia neutropenia immunocompromised infection risk") }
        if lab.altElevated || lab.astElevated { ccHints.append("liver hepatitis jaundice right upper quadrant hepatic") }
        let resultedInvs = patient.investigations.filter { $0.status == .resulted && !$0.result.isEmpty }
        for inv in resultedInvs {
            let n = inv.name.lowercased(), r = inv.result.lowercased()
            if n.contains("culture") && (r.contains("positive") || r.contains("growth")) {
                ccHints.append("fever infection bacteraemia positive culture")
            }
            if (n.contains("endoscopy") || n.contains("ogd") || n.contains("scope")) && !r.isEmpty {
                ccHints.append("endoscopy finding upper gi endoscopic finding")
            }
            if n.contains("colonoscopy") && !r.isEmpty {
                ccHints.append("colonoscopy finding lower gi endoscopic finding")
            }
            // Imaging findings → diagnostic routing
            let isImaging = n.contains("ct") || n.contains("ultrasound") || n.contains("mri") ||
                            n.contains("x-ray") || n.contains("xray") || n.contains("chest x") ||
                            n.contains("abdominal x") || n.contains("pet")
            if isImaging && !r.isEmpty {
                // Hepatobiliary
                if r.contains("gallstone") || r.contains("cholelithiasis") { ccHints.append("gallstone right upper quadrant biliary colic cholecystitis") }
                if r.contains("common bile duct") || r.contains("cbd dilation") || r.contains("biliary dilation") { ccHints.append("jaundice obstructive biliary cholangitis cholangiocarcinoma") }
                if r.contains("pancreatic") && (r.contains("mass") || r.contains("lesion")) { ccHints.append("epigastric weight loss pancreatic mass malignancy") }
                if r.contains("pancreatitis") || r.contains("pancreatic inflammation") { ccHints.append("epigastric back pain pancreatitis") }
                // Bowel / abdominal
                if r.contains("appendix") && (r.contains("inflam") || r.contains("thick") || r.contains("dilat")) { ccHints.append("right iliac fossa pain appendicitis") }
                if r.contains("diverticulit") { ccHints.append("left iliac fossa pain diverticulitis") }
                if r.contains("bowel obstruction") || r.contains("dilated bowel") || (r.contains("obstruction") && (n.contains("ct") || n.contains("x-ray"))) { ccHints.append("distension vomiting bowel obstruction") }
                if r.contains("free air") || r.contains("pneumoperitoneum") { ccHints.append("peritonitis perforation free air emergency") }
                if r.contains("hernia") { ccHints.append("groin swelling hernia inguinal femoral") }
                if r.contains("mass") || r.contains("lesion") || r.contains("tumour") || r.contains("tumor") { ccHints.append("weight loss mass malignancy neoplasm") }
                // Vascular
                if r.contains("aortic aneurysm") || r.contains("aaa") { ccHints.append("back pain pulsatile aortic aneurysm vascular") }
                if r.contains("dvt") || r.contains("deep vein thrombosis") || r.contains("thrombus") { ccHints.append("leg swelling dvt deep vein thrombosis") }
                if r.contains("pulmonary embol") || r.contains("pe ") { ccHints.append("breathless chest pain pulmonary embolism") }
                // Chest
                if r.contains("pneumonia") || r.contains("consolidation") || r.contains("infiltrate") { ccHints.append("fever cough breathless pneumonia consolidation") }
                if r.contains("pleural effusion") { ccHints.append("breathless pleuritic pleural effusion") }
                if r.contains("pneumothorax") { ccHints.append("breathless chest pain pneumothorax") }
                // Hepatic
                if r.contains("liver lesion") || r.contains("hepatic lesion") || r.contains("liver mass") { ccHints.append("right upper quadrant liver lesion hepatocellular hepatic metastasis") }
                if r.contains("cirrhosis") || r.contains("hepatic fibrosis") { ccHints.append("jaundice liver disease cirrhosis portal hypertension") }
                if r.contains("splenomegaly") { ccHints.append("anaemia splenomegaly portal hypertension haematological") }
            }
        }
        let augmentedCC: String? = {
            let base = patient.chiefComplaint ?? ""
            let hints = ccHints.joined(separator: " ")
            let combined = [base, hints].filter { !$0.isEmpty }.joined(separator: " ")
            return combined.isEmpty ? nil : combined
        }()

        let latestV = patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
        sequentialEngine.seed(
            chiefComplaint:    augmentedCC,
            socratesSelections: augmentedSocrates,
            pmhNotes:           patient.pmhNotes,
            surgicalHistory:    patient.surgicalHistory,
            examAbdo:           patient.examAbdo,
            examGeneral:        patient.examGeneral,
            investigations:     patient.investigations,
            ageYears:           patient.ageYears,
            sex:                patient.sex,
            medications:        patient.prescriptions.map { $0.displayLine },
            socialHistoryText:  patient.socialHistory,
            bmi:                patient.latestBMI(),
            alvaradoScore:               patient.alvaradoScore,
            glasgowPancreatitisScore:    patient.glasgowPancreatitisScore,
            ransonScore:                 patient.ransonScore,
            tokyoCholecystitisGrade:     patient.tokyoCholecystitisGrade,
            tokyoCholangitisGrade:       patient.tokyoCholangitisGrade,
            rockallScore:                patient.rockallScore,
            blatchfordScore:             patient.blatchfordScore,
            wellsDVTScore:               patient.wellsDVTScore,
            wellsPEScore:                patient.wellsPEScore,
            abcd2Score:                  patient.abcd2Score,
            lrinecScore:                 patient.lrinecScore,
            qsofaScore:                  patient.qsofaScore,
            psiScore:                    patient.psiScore,
            capriniScore:                patient.capriniScore,
            bisapScore:                  patient.bisapScore,
            aims65Score:                 patient.aims65Score,
            sofaScore:                   patient.sofaScore,
            fib4Score:                   patient.fib4Score,
            curb65Score:                 patient.curb65Score,
            paduaScore:                  patient.paduaScore,
            apacheIIScore:               patient.apacheIIScore,
            ppossumMortPct10:            patient.ppossumMortPct10,
            mpiScore:                    patient.mpiScore,
            ctsiScore:                   patient.ctsiScore,
            nrs2002Score:                patient.nrs2002Score,
            forrestGrade:                patient.forrestGrade,
            heartScore:                  patient.heartScore,
            mallampatiClass:             patient.mallampatiScore.map { min($0, 4) },
            cfsScore:                    patient.cfsScore,
            timiScore:                   patient.timiScore,
            waterlowScore:               patient.waterlowScore,
            latestHR:    latestV?.heartRate,
            latestSBP:   latestV?.bpSystolic,
            latestTemp:  latestV?.temperatureCelsius,
            latestSpO2:  latestV?.spo2,
            latestRR:    latestV?.respiratoryRate,
            news2Score:  latestV.flatMap { $0.hasAnyValue ? $0.news2Score : nil }
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
        // Build a lab-observation snapshot so DBN trajectory models can factor
        // in investigation results (lactate, WBC, CRP, imaging) alongside vitals.
        var labObs = DBNObservation(vitals: nil)
        let lab = psv.labs
        labObs.lactateElevated  = lab.lactateElevated
        labObs.wbcAbnormal      = lab.wbcElevated
        labObs.crpElevated      = lab.crpElevated || lab.crpHigh
        // Organ dysfunction: creatinine >200, bilirubin >50, INR >2.0, or platelets <100
        // aligns with SOFA score organ-failure thresholds for trajectory severity classification
        labObs.hasOrganDysfunction =
            (lab.creatinine?.value ?? 0) > 200 ||
            (lab.bilirubin?.value ?? 0) > 50 ||
            (lab.inr?.value ?? 1) > 2.0 ||
            (lab.platelets?.value ?? 200) < 100
        labObs.imagingWorstened = psv.investigationEntries.contains {
            $0.status == .resulted &&
            ($0.category == .imaging || $0.category == .endoscopy) &&
            !$0.result.isEmpty
        }
        let dbn = DynamicBayesianNetwork.trajectories(
            forHypotheses: seeded,
            vitals: patient.vitalsEntries,
            extraObservations: [labObs]
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
            vitalsAlerts:   cpAlerts,
            labs:           psv.labs
        )
        let dec = BayesianDecisionEngine.decide(hypotheses: seeded, context: context)
        psv.decisions = dec
        decisions = dec

        // ── Stage 6: Value of Information ─────────────────────────────────
        // Use rank(from: psv) so already-ordered investigations are properly
        // matched against catalogue keys (not raw name strings).
        psv.hypotheses = seeded
        let voiItems = ValueOfInformationEngine.rank(from: psv)
        informationItems = voiItems

        // ── Stage 7: AutoFunction ──────────────────────────────────────────
        let actions = AutoFunctionEngine.generate(from: psv)
        autoActions = actions

        stateVector = psv
    }
}

// MARK: - Pipeline summary helpers

extension ClinicalPipelineOrchestrator {

    /// Statistically enforced working diagnosis — non-nil when logGap ≥ 15 or a pathognomonic
    /// finding fired on rank-1. This is the Bayesian engine's gravitational signal: when present,
    /// the evidence has mathematically separated rank-1 from the field, and the UI should
    /// surface it with commensurate prominence.
    var enforcedWorkingDiagnosis: DiagnosisHypothesis? {
        guard let top = hypotheses.first else { return nil }
        return (top.logGap >= 15 || !top.pathognomicFindings.isEmpty) ? top : nil
    }

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
        changePointAlerts.contains { ($0.news2AtDetection ?? 0) >= 7 }
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
