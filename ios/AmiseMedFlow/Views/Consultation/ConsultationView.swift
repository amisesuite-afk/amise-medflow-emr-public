import SwiftUI
import SwiftData
import UIKit

// MARK: - ConsultationView

struct ConsultationView: View {
    @Bindable var patient: Patient
    /// Step to open at. nil = the pathway's first step. The iPad record passes a step when the
    /// clinician jumps to one from the Overview; its single "Consultation" section passes nil.
    var startingTab: ConsultTab? = nil
    var embeddedInNav: Bool = false
    @Environment(\.modelContext) var context
    @StateObject var ai = AIService()
    @StateObject var pipeline = ClinicalPipelineOrchestrator()

    @State var activeTab: ConsultTab = .hpi
    @State var examMode: ExamMode = .short
    @State var showAddAllergy = false
    @State private var showAddMedication = false
    @State var newAllergyName = ""
    @State var newAllergySeverity = "Moderate"
    @State var newAllergyReaction = ""
    @State var triageResult: TriageResult?
    @State var ccBayesDiff: [BayesianDiagnosisEngine.DiagnosisResult] = []
    @State var selectedSpecialtyHint: String? = nil  // set when a CC chip is tapped
    @State var isAssessing = false
    @State private var pathwayTask: Task<Void, Never>?
    /// Debounced Bayesian refresh for typed text (see scheduleBayesianRefresh).
    @State private var bayesTask: Task<Void, Never>?
    @State var icdQuery = ""
    @State var icdSuggestions: [ICDCode] = []
    @State var showAIError = false
    @State var consultationPDFWrapper: PDFDataWrapper?
    @State var showLetterSheet = false
    @State var generatedLetterText = ""
    @State var socratesSelections: [String: Set<String>] = [:]
    @State var socratesExpandedDim: String? = "onset"
    @State var pmhChipSelections: Set<String> = []
    @State var pmhBypassConfirmed = false
    @State var pshxChipSelections: Set<String> = []
    @State var pshxBypassConfirmed = false
    @State var fhChipSelections: Set<String> = []
    @State var selectedSocialChips: Set<String> = []
    // PMH — medication history
    @State var medQuery = ""
    @State var medSuggestions: [SurgicalDrug] = []
    @State var expandedMed: SurgicalDrug? = nil
    @State var medDose = ""
    @State var medRoute = "Oral"
    @State var medFreq = "OD"
    @State var isSuggestingMeds = false
    @State var aiMedSuggestions: [String] = []
    @State var newInvName = ""
    @State var newInvCategory: InvestigationEntry.InvCategory = .blood
    @State var criticalLabAlert: String? = nil   // non-nil triggers alert
    @State var bayesianDx: [BayesianDiagnosisEngine.DiagnosisResult] = []
    @State var dismissedRadiation = false
    @State var showBowelPrep = false
    @State var clinicalAlarms: [ClinicalTextParser.ClinicalAlarm] = []
    @State var dismissedAlarmIds: Set<UUID> = []
    @State var surgicalRiskAlerts: [SurgicalRiskAlert] = []
    @State private var showCompleteSheet = false        // "Review and complete" (UX review M8)
    @State private var showSaveEncounterConfirm = false
    /// Scores / Vitals / Prescriptions opened over the current step (Tools menu).
    @State var activeTool: ConsultTool? = nil
    /// Template drafts inserted this session ("HPI", "Plan" → inserted text): the completion
    /// review flags a field that still holds exactly its draft.
    @State var templateDrafts: [String: String] = [:]
    @State private var encounterSavedFeedback = false
    @State var selectedEncounter: Encounter? = nil
    // Visit pathway ("first door") — orders the steps in the tab bar
    @State var pathway: ConsultPathway = .firstVisit
    @State var showPathwayPicker = false
    @State var lastVisitShown: Encounter? = nil   // follow-up "Last visit" card → Open
    @State private var keyboardVisible = false        // hide the step footer while typing
    // Dynamic Type: the step bar's number + label are one concatenated Text, so their sizes are
    // scaled metrics (same point sizes at the default text size).
    @Environment(\.dynamicTypeSize) var dynamicTypeSize
    @ScaledMetric(relativeTo: .caption2) var stepNumberFontSize: CGFloat = 10
    @ScaledMetric(relativeTo: .footnote) var stepLabelFontSize: CGFloat = 13

    enum ExamMode { case short, full }

    var interactions: [DrugInteractionAlert] {
        // Recorded herbs / supplements are screened like drugs (SupplementHistory.swift).
        DrugInteractionService.check(drugs: patient.prescriptions.map { $0.drug } + patient.supplementInteractionEntries)
    }

    // Recompute surgical risk alerts from current state. Call whenever PMH,
    // medications, social chips, or vitals change.
    func recomputeRisk() {
        var inputs = SurgicalRiskInputs(
            pmh: pmhChipSelections,
            medicationNames: patient.prescriptions.map { $0.drug },
            ageYears: patient.ageYears,
            bmiKgM2: patient.latestBMI(),
            socialChips: selectedSocialChips
        )
        inputs.labs = LabPanel.parse(from: patient.investigations)
        surgicalRiskAlerts = SurgicalRiskEngine.assess(inputs)
    }

    // Deterministic PMH → medication quick-picks.
    // Unions all selected PMH chips, de-dupes, excludes already-added drugs,
    // and excludes any drug the patient is allergic to (name match, case-insensitive).
    var pmhDerivedMedSuggestions: [String] {
        let addedNames = Set(patient.prescriptions.map { $0.drug.lowercased() })
        let allergies  = patient.allergies
        var seen = Set<String>()
        var result: [String] = []
        for chip in pmhChipSelections {
            for med in pmhToCommonMeds[chip] ?? [] {
                let lower = med.lowercased()
                guard !seen.contains(lower),
                      !addedNames.contains(lower),
                      !crossClassAllergyExcludes(lower, allergies: allergies)
                else { continue }
                seen.insert(lower)
                result.append(med)
            }
        }
        return result
    }

    // Deterministic PMH → Investigations quick-suggest.
    var pmhDerivedIxSuggestions: [(name: String, category: InvestigationEntry.InvCategory)] {
        let existing = Set(patient.investigations.map { $0.name })
        var seen = Set<String>()
        var result: [(name: String, category: InvestigationEntry.InvCategory)] = []
        for chip in pmhChipSelections {
            for inv in pmhInvestigations[chip] ?? [] {
                guard !seen.contains(inv.name), !existing.contains(inv.name) else { continue }
                seen.insert(inv.name)
                result.append(inv)
            }
        }
        return result
    }

    var body: some View {
        // Step completion once per render. Every keystroke re-renders this view, and the step bar,
        // the completeness bar, the Complete button and both dialog texts each re-ran tabFilled for
        // every step (decoding the PMH/PSHx/allergy/investigation/pathway JSON each time).
        let filled = filledTabs()
        let progress = pathwayProgress(filled)
        withToolbarAndDialogs(withSheetsAndAlerts(withChangeHandlers(baseContent(filled: filled, progress: progress))),
                              progress: progress)
    }

    // Split out of `body`: one ~30-modifier chain exceeded the type-checker time limit.
    private func baseContent(filled: Set<ConsultTab>, progress: PathwayProgress) -> some View {
        VStack(spacing: 0) {
            // Whose record this is — on every step (UX review M1). The iPad record view shows
            // the same identity in its own header above the embedded consultation.
            if !embeddedInNav { patientIdentityHeader }
            // Red alert only for real allergies; NKDA neutral; empty = not recorded (UX review M2).
            allergyStatusBanner
            // Clinical alarm banner — fires from free text parsing
            let activeAlarms = clinicalAlarms.filter { !dismissedAlarmIds.contains($0.id) }
            if !activeAlarms.isEmpty { clinicalAlarmBanner(activeAlarms) }
            if !embeddedInNav { completenessBar(progress) }
            tabBar(filled: filled)
            Divider()
            lastVisitCard
            tabContent
                .frame(maxHeight: .infinity)
            if !keyboardVisible {
                visitActionsExplanation
                stepFooter
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            keyboardVisible = true
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            keyboardVisible = false
        }
        .background(Color(.systemBackground))
        .onAppear { handleAppear() }
        .navigationTitle(patient.consultationTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarBackground(Color(.systemBackground), for: .navigationBar)
    }

    private func handleAppear() {
        CrashReporting.breadcrumb("Opened consultation")
        let encounterStarting = patient.encounterStatus == .waiting || patient.encounterStatus == .notCheckedIn
        // A returning patient's booked type is still "New Consult" from the first visit, so for a
        // clinic visit the record decides: follow-up of the last problem, or a new problem when the
        // complaint is different. Specific bookings (procedure, ward, trauma, burns, check-up) stand.
        let booked = ConsultPathway.from(patient.visitType)
        let recommendation = ConsultPathway.recommend(for: patient)
        let returning = encounterStarting && VisitContinuity.lastVisit(for: patient) != nil
            && (booked == nil || booked == .firstVisit || booked == .followUp)
        pathway = returning ? recommendation.pathway : (booked ?? recommendation.pathway)
        // An explicit starting step (iPad Overview jump) wins; otherwise the pathway's first step.
        activeTab = startingTab ?? (pathway.steps.first ?? .hpi)
        if returning {
            // Flagged automatically (no picker); the first step shows the choice and its reasons,
            // and the clinician can change it there.
            recordVisitType(for: pathway)
        } else if encounterStarting {
            // First door: ask what kind of visit this is when the encounter starts.
            showPathwayPicker = true
        }
        // Advance encounter status to withDoctor the moment the doctor opens the record
        if encounterStarting {
            patient.encounterStatus = .withDoctor
            patient.updatedAt = .now
            patient.pendingSync = true
            try? context.save()
        }
        // Pre-populate SOCRATES from questionnaire HPI if not yet filled
        if socratesSelections.isEmpty, let hpi = patient.hpi {
            socratesSelections = parseSocratesFromHPI(hpi)
        }
        // Pre-populate PMH chips from persisted pmhNotes (questionnaire write-back)
        if pmhChipSelections.isEmpty, let notes = patient.pmhNotes {
            pmhChipSelections = parsePMHChipsFromNotes(notes)
        }
        // P9: Pre-populate PSHx chips from persisted surgicalHistory
        if pshxChipSelections.isEmpty, let pshx = patient.surgicalHistory {
            pshxChipSelections = parsePSHxChipsFromSurgicalHistory(pshx)
        }
        // P8: Re-populate social chips so SurgicalRiskEngine sees correct state
        if selectedSocialChips.isEmpty, let social = patient.socialHistory {
            selectedSocialChips = parseSocialChipsFromHistory(social)
            recomputeRisk()
        }
        pipeline.runNow(for: patient, socratesSelections: socratesSelections)
        MRNGenerator.backfillIfNeeded(patient, in: context)
    }

    private func withChangeHandlers(_ content: some View) -> some View {
        content
        // The iPad record can ask the (already open) consultation for another step.
        .onChange(of: startingTab) { _, tab in
            if let tab { withAnimation(.easeInOut(duration: 0.15)) { activeTab = tab } }
        }
        .onChange(of: activeTab) { _, tab in
            if tab == .diagnosis {
                bayesTask?.cancel()
                refreshBayesian()
            }
        }
        .onChange(of: patient.workingDiagnosis) { _, _ in
            dismissedRadiation = false
            // The confirmed diagnosis is one of the triage-level inputs.
            runPathway()
        }
        .onChange(of: patient.chiefComplaint) { _, newCC in handleChiefComplaintChange(newCC) }
        .onChange(of: patient.hpi) { _, _ in
            scheduleBayesianRefresh()
            pipeline.schedule(for: patient, socratesSelections: socratesSelections)
        }
        .onChange(of: patient.examGeneral) { _, _ in
            scheduleBayesianRefresh()
            pipeline.schedule(for: patient, socratesSelections: socratesSelections)
        }
        .onChange(of: patient.examAbdo) { _, _ in
            scheduleBayesianRefresh()
            pipeline.schedule(for: patient, socratesSelections: socratesSelections)
        }
        .onChange(of: patient.investigationsJson) { _, _ in
            scheduleBayesianRefresh()
            pipeline.schedule(for: patient, socratesSelections: socratesSelections)
        }
        .onChange(of: socratesSelections) { _, _ in
            pipeline.schedule(for: patient, socratesSelections: socratesSelections)
        }
    }

    /// These fields change on every keystroke, and refreshBayesian runs the clinical text parser,
    /// decodes the investigations twice, sorts the vitals and runs the Bayesian engine (40 pools,
    /// ~190 candidates) synchronously on the main thread - once per character typed. It now runs
    /// once typing pauses (0.35 s), like the CC-driven refresh (0.8 s) and the pipeline (1.5 s).
    /// Opening the Diagnosis tab still refreshes immediately.
    private func scheduleBayesianRefresh() {
        bayesTask?.cancel()
        bayesTask = Task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                guard patient.isLive else { return }
                refreshBayesian()
                // HPI, examination and results feed the triage level too (ClinicalAcuityEngine).
                runPathway()
            }
        }
    }

    private func handleChiefComplaintChange(_ newCC: String?) {
        guard let cc = newCC, !cc.isEmpty else {
            triageResult = nil
            ccBayesDiff = []
            return
        }
        // Immediate early Bayesian differential using CC + PMH/PSHx only
        let pmhNotes  = patient.pmhEntries.map(\.condition).joined(separator: ", ")
        let pshxNotes = patient.pshxEntries.map(\.procedure).joined(separator: ", ")
        let earlyDiff = BayesianDiagnosisEngine.infer(
            chiefComplaint: cc,
            socratesSelections: [:],
            pmhNotes: pmhNotes,
            surgicalHistory: pshxNotes,
            examAbdo: nil,
            examGeneral: nil,
            investigations: [],
            ageYears: patient.ageYears,
            sex: patient.sex,
            specialtyHint: selectedSpecialtyHint
        )
        ccBayesDiff = Array(earlyDiff.prefix(4))
        // Debounced full pathway + Bayesian refresh
        pathwayTask?.cancel()
        pathwayTask = Task {
            try? await Task.sleep(nanoseconds: 800_000_000)
            guard !Task.isCancelled else { return }
            await MainActor.run { runPathway(); refreshBayesian() }
        }
    }

    /// Clinician chose a pathway: record the visit type and jump to its first step.
    func choosePathway(_ p: ConsultPathway) {
        CrashReporting.breadcrumb("Chose pathway: \(p.rawValue)")
        pathway = p
        recordVisitType(for: p)
        withAnimation(.easeInOut(duration: 0.15)) { activeTab = p.steps.first ?? .hpi }
    }

    /// Records the visit type for a pathway (keeping a more specific booked type).
    private func recordVisitType(for p: ConsultPathway) {
        let vt = p.visitType(keeping: patient.visitType)
        guard patient.visitType != vt else { return }
        AuditLog.record("update", "patient", patient: patient,
                        details: ["field": "visit_type", "to": vt.rawValue])
        patient.visitType = vt
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    private func withSheetsAndAlerts(_ content: some View) -> some View {
        content
        .sheet(item: $lastVisitShown) { enc in
            EncounterDetailSheet(encounter: enc)
        }
        .sheet(isPresented: $showPathwayPicker) {
            VisitPathwaySheet(patient: patient,
                              current: ConsultPathway.from(patient.visitType),
                              onSelect: { choosePathway($0) })
        }
        .sheet(isPresented: $showAddAllergy) { addAllergySheet }
        .sheet(isPresented: $showAddMedication) {
            AddMedicationSheet(patient: patient, context: context)
        }
        .alert("Critical Lab Value", isPresented: Binding(
            get: { criticalLabAlert != nil },
            set: { if !$0 { criticalLabAlert = nil } }
        )) {
            Button("Acknowledged", role: .cancel) { criticalLabAlert = nil }
        } message: {
            Text((criticalLabAlert ?? "") + "\n\nNotify the doctor immediately.")
        }
        .alert("Draft not available", isPresented: $showAIError) {
            Button("OK", role: .cancel) {}
        } message: { Text(ai.error ?? "Not enough is documented yet to draft from the template. Type or dictate instead.") }
        .sheet(item: $consultationPDFWrapper) { wrapper in
            ShareSheet(items: [wrapper.data as Any]).ignoresSafeArea()
        }
        .sheet(isPresented: $showLetterSheet) {
            ConsultationLetterSheet(letterText: generatedLetterText, patient: patient)
        }
        // Tools: over the current step, which is kept (no leaving the consultation).
        .sheet(item: $activeTool) { tool in
            ConsultationToolSheet(patient: patient, tool: tool)
        }
    }

    private func withToolbarAndDialogs(_ content: some View, progress: PathwayProgress) -> some View {
        content
        .toolbar {
            // Two actions, labelled for what they do (UX review M4/M8): "Save snapshot" copies the
            // visit into Visit History and leaves it open; "Complete" opens the review sheet, which
            // saves the snapshot too. The explanation is on screen on the last step and in both
            // the save dialog and the review sheet.
            ToolbarItem(placement: .navigationBarLeading) {
                Button {
                    showSaveEncounterConfirm = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: encounterSavedFeedback ? "archivebox.fill" : "archivebox")
                        Text(encounterSavedFeedback ? "Saved" : "Save snapshot")
                            .scaledFont(size: 13, weight: .semibold, relativeTo: .footnote)
                    }
                    .foregroundStyle(encounterSavedFeedback ? Color.green : AMColor.accent)
                }
                .accessibilityLabel("Save snapshot")
                .accessibilityHint("Copies the visit into Visit History. The visit stays open.")
                .accessibilityValue(encounterSavedFeedback ? "Saved" : "")
                .accessibilityIdentifier("consult.saveVisit")
            }
            // Scores / Vitals / Prescriptions over the current step (UX review: reachable from
            // inside the consultation on every pathway).
            ToolbarItem(placement: .navigationBarTrailing) {
                ConsultationToolsMenu { tool in activeTool = tool }
            }
            // The step footer hides while typing; keep "Next" one tap away (UX review M11).
            ToolbarItemGroup(placement: .keyboard) {
                if let next = nextPathwayStep {
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { activeTab = next }
                    } label: {
                        Label("Next: \(pathway.label(for: next))", systemImage: "chevron.right")
                            .labelStyle(.titleAndIcon)
                    }
                    .accessibilityIdentifier("consult.keyboard.next")
                }
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                if patient.encounterStatus != .complete {
                    let completeness = progress
                    Button {
                        showCompleteSheet = true
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: completeness.filled == completeness.total
                                ? "checkmark.circle.fill" : "checkmark.circle")
                            Text("Complete")
                                .scaledFont(size: 13, weight: .semibold, relativeTo: .footnote)
                        }
                        .foregroundStyle(completeness.total > 0 && Double(completeness.filled) / Double(completeness.total) >= 0.75
                                         ? Color.green : Color(.tertiaryLabel))
                    }
                    // The green / grey tint is the only on-screen sign of how much is documented.
                    .accessibilityLabel("Complete encounter")
                    .accessibilityHint("Opens the review: what is missing, then attest and complete")
                    .accessibilityValue("\(completeness.filled) of \(completeness.total) steps documented")
                    .accessibilityIdentifier("consult.complete")
                } else {
                    Label("Encounter complete", systemImage: "checkmark.seal.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.green)
                        .labelStyle(.iconOnly)
                }
            }
        }
        // Review and complete (UX review M8): missing steps, allergy status, unedited template or
        // questionnaire content, diagnosis and orders, then an attestation.
        .sheet(isPresented: $showCompleteSheet) {
            CompleteEncounterSheet(patient: patient,
                                   pathwayTitle: pathway.title,
                                   review: completionReview(progress),
                                   onComplete: { completeEncounter() })
        }
        .confirmationDialog(
            "Save a snapshot of this visit?",
            isPresented: $showSaveEncounterConfirm,
            titleVisibility: .visible
        ) {
            // Label kept: the UI walkthrough taps "Save Visit".
            Button("Save Visit") { saveEncounter() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Copies the current clinical data into Visit History. The visit stays open and editable. "
                 + "Use Complete when the visit is finished (that saves a snapshot too).")
        }
    }

    // MARK: - Save Encounter

    private func saveEncounter() {
        let encounter = Encounter(
            visitType: patient.visitType ?? .newConsult,
            acuity: patient.acuity,
            setting: patient.setting,
            location: patient.location
        )
        encounter.snapshot(
            from: patient,
            socratesSelections: socratesSelections,
            bayesianDx: bayesianDx
        )
        encounter.isComplete = true
        patient.encounters.append(encounter)
        context.insert(encounter)
        AuditLog.record("create", "encounter", patient: patient, resourceId: encounter.syncCode,
                        details: ["visit_type": encounter.visitType.rawValue])
        try? context.save()
        encounterSavedFeedback = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            encounterSavedFeedback = false
        }
    }

    // MARK: - Complete (after the review sheet's attestation)

    private func completeEncounter() {
        // Completing also saves the visit to history (once a day), so the next visit knows this
        // one happened and continues from it.
        if !patient.encounters.contains(where: { $0.isLive && $0.isComplete
                                                 && Calendar.current.isDateInToday($0.encounterDate) }) {
            saveEncounter()
        }
        AuditLog.record("state_transition", "encounter", patient: patient,
                        details: ["to": "complete", "attested": "true"])
        patient.encounterStatus = .complete
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    /// Opens the review sheet (toolbar Complete and the last step's footer button).
    func requestComplete() { showCompleteSheet = true }

    /// What the review sheet lists (pure builder: EncounterCompletionReview).
    func completionReview(_ c: PathwayProgress) -> EncounterCompletionReview {
        var drafts: [String] = []
        for key in templateDrafts.keys.sorted() {
            let current: String?
            switch key {
            case "HPI":  current = patient.hpi
            case "Plan": current = patient.managementPlan
            default:     current = nil
            }
            if let current, current == templateDrafts[key] { drafts.append(key) }
        }
        let exam: [(label: String, text: String?)] = [
            ("General", patient.examGeneral), ("CVS", patient.examCVS), ("Resp", patient.examResp),
            ("Abdomen", patient.examAbdo), ("Neuro", patient.examNeuro), ("MSK", patient.examMSK),
            ("Skin", patient.examSkin), ("Other", patient.examOther),
        ]
        let rx: [String] = patient.prescriptions.map { p in
            [p.drug, p.dose].filter { !$0.isEmpty }.joined(separator: " ")
        }
        return EncounterCompletionReview.build(
            missingSteps: c.missing,
            allergyState: patient.safetyAllergyState,
            allergyConflict: patient.allergyRecordConflicts,
            hpi: patient.hpi,
            examFields: exam,
            uneditedDrafts: drafts,
            diagnosis: patient.workingDiagnosis,
            icd: patient.workingDiagnosisICD,
            investigations: patient.investigations.map(\.name),
            prescriptions: rx)
    }
}
