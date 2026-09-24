import SwiftUI
import SwiftData

// MARK: - ConsultationView

struct ConsultationView: View {
    @Bindable var patient: Patient
    var startingTab: ConsultTab = .hpi
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
    @State var clinicalAlarms: [ClinicalTextParser.ClinicalAlarm] = []
    @State var dismissedAlarmIds: Set<UUID> = []
    @State var surgicalRiskAlerts: [SurgicalRiskAlert] = []
    @State private var showCompleteEncounterConfirm = false
    @State private var showSaveEncounterConfirm = false
    @State private var encounterSavedFeedback = false
    @State var selectedEncounter: Encounter? = nil
    // Visit pathway ("first door") — orders the steps in the tab bar
    @State var pathway: ConsultPathway = .firstVisit
    @State var showPathwayPicker = false
    @State var lastVisitShown: Encounter? = nil   // follow-up "Last visit" card → Open

    enum ExamMode { case short, full }

    var interactions: [DrugInteractionAlert] {
        DrugInteractionService.check(drugs: patient.prescriptions.map { $0.drug })
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
        withToolbarAndDialogs(withSheetsAndAlerts(withChangeHandlers(baseContent)))
    }

    // Split out of `body`: one ~30-modifier chain exceeded the type-checker time limit.
    private var baseContent: some View {
        VStack(spacing: 0) {
            if !patient.allergies.isEmpty { allergyBanner }
            // Clinical alarm banner — fires from free text parsing
            let activeAlarms = clinicalAlarms.filter { !dismissedAlarmIds.contains($0.id) }
            if !activeAlarms.isEmpty { clinicalAlarmBanner(activeAlarms) }
            if !embeddedInNav { completenessBar }
            tabBar
            Divider()
            lastVisitCard
            tabContent
                .frame(maxHeight: .infinity)
            stepFooter
        }
        .background(Color(.systemBackground))
        .onAppear { handleAppear() }
        .navigationTitle("Consultation")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarBackground(Color(.systemBackground), for: .navigationBar)
    }

    private func handleAppear() {
        let encounterStarting = patient.encounterStatus == .waiting || patient.encounterStatus == .notCheckedIn
        pathway = ConsultPathway.from(patient.visitType) ?? ConsultPathway.recommend(for: patient).pathway
        // Explicit starting tab (iPad sidebar) wins; otherwise open at the pathway's first step.
        activeTab = (embeddedInNav || startingTab != .hpi) ? startingTab : (pathway.steps.first ?? .hpi)
        // First door: ask what kind of visit this is when the encounter starts.
        if encounterStarting { showPathwayPicker = true }
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
        .onChange(of: activeTab) { _, tab in
            if tab == .diagnosis { refreshBayesian() }
        }
        .onChange(of: patient.workingDiagnosis) { _, _ in
            dismissedRadiation = false
        }
        .onChange(of: patient.chiefComplaint) { _, newCC in handleChiefComplaintChange(newCC) }
        .onChange(of: patient.hpi) { _, _ in
            refreshBayesian()
            pipeline.schedule(for: patient, socratesSelections: socratesSelections)
        }
        .onChange(of: patient.examGeneral) { _, _ in
            refreshBayesian()
            pipeline.schedule(for: patient, socratesSelections: socratesSelections)
        }
        .onChange(of: patient.examAbdo) { _, _ in
            refreshBayesian()
            pipeline.schedule(for: patient, socratesSelections: socratesSelections)
        }
        .onChange(of: patient.investigationsJson) { _, _ in
            refreshBayesian()
            pipeline.schedule(for: patient, socratesSelections: socratesSelections)
        }
        .onChange(of: socratesSelections) { _, _ in
            pipeline.schedule(for: patient, socratesSelections: socratesSelections)
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
        pathway = p
        let vt = p.visitType(keeping: patient.visitType)
        if patient.visitType != vt {
            patient.visitType = vt
            patient.updatedAt = .now
            patient.pendingSync = true
            try? context.save()
        }
        withAnimation(.easeInOut(duration: 0.15)) { activeTab = p.steps.first ?? .hpi }
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
        .alert("AI Error", isPresented: $showAIError) {
            Button("OK", role: .cancel) {}
        } message: { Text(ai.error ?? "Unknown error") }
        .sheet(item: $consultationPDFWrapper) { wrapper in
            ShareSheet(items: [wrapper.data as Any]).ignoresSafeArea()
        }
        .sheet(isPresented: $showLetterSheet) {
            ConsultationLetterSheet(letterText: generatedLetterText, patient: patient)
        }
    }

    private func withToolbarAndDialogs(_ content: some View) -> some View {
        content
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button {
                    showSaveEncounterConfirm = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: encounterSavedFeedback ? "archivebox.fill" : "archivebox")
                        Text("Save Visit")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(encounterSavedFeedback ? Color.green : AMColor.accent)
                }
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                if patient.encounterStatus != .complete {
                    let completeness = pathwayProgress
                    Button {
                        showCompleteEncounterConfirm = true
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: completeness.filled == completeness.total
                                ? "checkmark.circle.fill" : "checkmark.circle")
                            Text("Complete")
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .foregroundStyle(completeness.total > 0 && Double(completeness.filled) / Double(completeness.total) >= 0.75
                                         ? Color.green : Color(.tertiaryLabel))
                    }
                } else {
                    Label("Encounter complete", systemImage: "checkmark.seal.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.green)
                        .labelStyle(.iconOnly)
                }
            }
        }
        .confirmationDialog(completeEncounterDialogTitle,
                            isPresented: $showCompleteEncounterConfirm,
                            titleVisibility: .visible) {
            Button("Mark as Complete") {
                patient.encounterStatus = .complete
                patient.updatedAt = .now
                patient.pendingSync = true
                try? context.save()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(completeEncounterDialogMessage)
        }
        .confirmationDialog(
            "Save this visit to encounter history?",
            isPresented: $showSaveEncounterConfirm,
            titleVisibility: .visible
        ) {
            Button("Save Visit") { saveEncounter() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("A snapshot of the current clinical data will be saved to the patient's encounter history. The working record stays editable.")
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
        try? context.save()
        encounterSavedFeedback = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            encounterSavedFeedback = false
        }
    }

    // P5: Complete encounter dialog helpers
    private var completeEncounterDialogTitle: String {
        let c = pathwayProgress
        if c.filled < c.total {
            return "Complete encounter (\(c.filled)/\(c.total) items filled)?"
        }
        return "Mark encounter as complete?"
    }

    private var completeEncounterDialogMessage: String {
        let c = pathwayProgress
        if c.filled < c.total {
            return "\(pathway.title) — not yet documented: \(c.missing.joined(separator: ", ")). You can still complete the encounter — record will remain editable."
        }
        return "The encounter will be marked complete. The record remains editable."
    }
}
