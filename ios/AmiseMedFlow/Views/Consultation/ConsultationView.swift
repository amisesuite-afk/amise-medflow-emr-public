import SwiftUI
import SwiftData

// MARK: - ConsultationView

struct ConsultationView: View {
    @Bindable var patient: Patient
    var startingTab: ConsultTab = .hpi
    var embeddedInNav: Bool = false
    @Environment(\.modelContext) private var context
    @StateObject private var ai = AIService()
    @StateObject private var pipeline = ClinicalPipelineOrchestrator()

    @State private var activeTab: ConsultTab = .hpi
    @State private var examMode: ExamMode = .short
    @State private var showAddAllergy = false
    @State private var showAddMedication = false
    @State private var newAllergyName = ""
    @State private var newAllergySeverity = "Moderate"
    @State private var newAllergyReaction = ""
    @State private var triageResult: TriageResult?
    @State private var ccBayesDiff: [BayesianDiagnosisEngine.DiagnosisResult] = []
    @State private var selectedSpecialtyHint: String? = nil  // set when a CC chip is tapped
    @State private var isAssessing = false
    @State private var pathwayTask: Task<Void, Never>?
    @State private var icdQuery = ""
    @State private var icdSuggestions: [ICDCode] = []
    @State private var showAIError = false
    @State private var consultationPDFWrapper: PDFDataWrapper?
    @State private var showLetterSheet = false
    @State private var generatedLetterText = ""
    @State private var socratesSelections: [String: Set<String>] = [:]
    @State private var socratesExpandedDim: String? = "onset"
    @State private var pmhChipSelections: Set<String> = []
    @State private var pmhBypassConfirmed = false
    @State private var pshxChipSelections: Set<String> = []
    @State private var pshxBypassConfirmed = false
    @State private var fhChipSelections: Set<String> = []
    @State private var selectedSocialChips: Set<String> = []
    // PMH — medication history
    @State private var medQuery = ""
    @State private var medSuggestions: [SurgicalDrug] = []
    @State private var expandedMed: SurgicalDrug? = nil
    @State private var medDose = ""
    @State private var medRoute = "Oral"
    @State private var medFreq = "OD"
    @State private var isSuggestingMeds = false
    @State private var aiMedSuggestions: [String] = []
    @State private var newInvName = ""
    @State private var newInvCategory: InvestigationEntry.InvCategory = .blood
    @State private var criticalLabAlert: String? = nil   // non-nil triggers alert
    @State private var bayesianDx: [BayesianDiagnosisEngine.DiagnosisResult] = []
    @State private var dismissedRadiation = false
    @State private var clinicalAlarms: [ClinicalTextParser.ClinicalAlarm] = []
    @State private var dismissedAlarmIds: Set<UUID> = []
    @State private var surgicalRiskAlerts: [SurgicalRiskAlert] = []
    @State private var showCompleteEncounterConfirm = false
    @State private var showSaveEncounterConfirm = false
    @State private var encounterSavedFeedback = false
    @State private var selectedEncounter: Encounter? = nil

    enum ExamMode { case short, full }

    private var interactions: [DrugInteractionAlert] {
        DrugInteractionService.check(drugs: patient.prescriptions.map { $0.drug })
    }

    // Recompute surgical risk alerts from current state. Call whenever PMH,
    // medications, social chips, or vitals change.
    private func recomputeRisk() {
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
    private var pmhDerivedMedSuggestions: [String] {
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
    private var pmhDerivedIxSuggestions: [(name: String, category: InvestigationEntry.InvCategory)] {
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
        VStack(spacing: 0) {
            if !patient.allergies.isEmpty { allergyBanner }
            // Clinical alarm banner — fires from free text parsing
            let activeAlarms = clinicalAlarms.filter { !dismissedAlarmIds.contains($0.id) }
            if !activeAlarms.isEmpty { clinicalAlarmBanner(activeAlarms) }
            if !embeddedInNav {
                completenessBar
                tabBar
                Divider()
            }
            tabContent
        }
        .background(Color(.systemBackground))
        .onAppear {
            activeTab = startingTab
            // Advance encounter status to withDoctor the moment the doctor opens the record
            if patient.encounterStatus == .waiting || patient.encounterStatus == .notCheckedIn {
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
            MRNGenerator.backfillIfNeeded(patient)
        }
        .navigationTitle("Consultation")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarBackground(Color(.systemBackground), for: .navigationBar)
        .onChange(of: activeTab) { _, tab in
            if tab == .diagnosis { refreshBayesian() }
        }
        .onChange(of: patient.workingDiagnosis) { _, _ in
            dismissedRadiation = false
        }
        .onChange(of: patient.chiefComplaint) { _, newCC in
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
                    let completeness = patient.consultationCompleteness
                    Button {
                        showCompleteEncounterConfirm = true
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: completeness.filled == completeness.total
                                ? "checkmark.circle.fill" : "checkmark.circle")
                            Text("Complete")
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .foregroundStyle(completeness.filled >= 6 ? Color.green : Color(.tertiaryLabel))
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
        let c = patient.consultationCompleteness
        if c.filled < c.total {
            return "Complete encounter (\(c.filled)/\(c.total) items filled)?"
        }
        return "Mark encounter as complete?"
    }

    private var completeEncounterDialogMessage: String {
        let c = patient.consultationCompleteness
        if c.filled < c.total {
            let missing = incompleteConsultationItems()
            return "Missing: \(missing.joined(separator: ", ")). You can still complete the encounter — record will remain editable."
        }
        return "The encounter will be marked complete. The record remains editable."
    }

    private func incompleteConsultationItems() -> [String] {
        var missing: [String] = []
        if (patient.chiefComplaint ?? "").isEmpty { missing.append("chief complaint") }
        if (patient.hpi ?? "").isEmpty            { missing.append("HPI") }
        let hasPMH = !(patient.pmhNotes ?? "").isEmpty || !(patient.surgicalHistory ?? "").isEmpty
            || !patient.pmhEntries.isEmpty || !patient.pshxEntries.isEmpty
        if !hasPMH                                { missing.append("PMH") }
        if patient.allergies.isEmpty              { missing.append("allergies") }
        if patient.prescriptions.isEmpty          { missing.append("medications") }
        let hasExam = !(patient.examGeneral ?? "").isEmpty || !(patient.examAbdo ?? "").isEmpty
        if !hasExam                               { missing.append("examination") }
        if patient.workingDiagnosis == nil        { missing.append("working diagnosis") }
        if (patient.managementPlan ?? "").isEmpty { missing.append("management plan") }
        return missing
    }

    // MARK: - Allergy banner

    // MARK: - Surgical risk profile section

    @ViewBuilder
    private func riskAlertRow(_ alert: SurgicalRiskAlert) -> some View {
        let bandColor: Color = {
            switch alert.band {
            case .advisory:  .teal
            case .moderate:  .orange
            case .high:      Color(red: 0.85, green: 0.2, blue: 0.1)
            case .critical:  .red
            }
        }()
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: alert.domain.icon)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(bandColor)
                    .frame(width: 16)
                Text(alert.title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.primary)
                Spacer()
                Text(alert.band.label.uppercased())
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(bandColor)
                    .padding(.horizontal, 5).padding(.vertical, 2)
                    .background(bandColor.opacity(0.12), in: Capsule())
            }
            Text(alert.detail)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            HStack(alignment: .top, spacing: 4) {
                Image(systemName: "arrow.right.circle")
                    .font(.system(size: 10))
                    .foregroundStyle(bandColor)
                Text(alert.action)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 6)
    }

    private var surgicalRiskSection: some View {
        Section {
            ForEach(surgicalRiskAlerts) { alert in
                riskAlertRow(alert)
            }
        } header: {
            HStack(spacing: 6) {
                Image(systemName: "shield.lefthalf.filled.trianglebadge.exclamationmark")
                    .font(.system(size: 11, weight: .semibold))
                Text("Surgical Risk Profile")
                    .font(.system(size: 11, weight: .semibold))
                    .textCase(nil)
                Spacer()
                let maxBand = surgicalRiskAlerts.map { $0.band }.max()
                if let top = maxBand {
                    let topColor: Color = {
                        switch top {
                        case .advisory:  .teal
                        case .moderate:  .orange
                        case .high:      Color(red: 0.85, green: 0.2, blue: 0.1)
                        case .critical:  .red
                        }
                    }()
                    Text("\(surgicalRiskAlerts.count) alert\(surgicalRiskAlerts.count == 1 ? "" : "s") · \(top.label)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(topColor)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(topColor.opacity(0.12), in: Capsule())
                }
            }
            .foregroundStyle(.secondary)
        }
    }

    // MARK: - Allergy banner

    private var allergyBanner: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("ALLERGY ALERT", systemImage: "exclamationmark.triangle.fill")
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
            ForEach(patient.allergies) { a in
                HStack(spacing: 5) {
                    Circle().fill(Color(white: 1, opacity: 0.7)).frame(width: 5, height: 5)
                    Text("\(a.name)  [\(a.severity)]  — \(a.reaction)")
                        .font(.caption2).foregroundStyle(.white)
                }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background { allergyBannerBg }
    }

    // MARK: - Clinical alarm banner

    private var allergyBannerBg: Color { Color.red.opacity(0.85) }

    private func alarmBannerColor(isEmergency: Bool) -> Color {
        isEmergency ? Color.red.opacity(0.92) : Color.orange.opacity(0.88)
    }

    @ViewBuilder
    private func alarmRow(_ alarm: ClinicalTextParser.ClinicalAlarm, isLast: Bool) -> some View {
        let isEmergency = alarm.severity == .emergency
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: alarm.systemImage)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 18)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(alarm.title)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                    Text(isEmergency ? "EMERGENCY" : "CRITICAL")
                        .font(.system(size: 9, weight: .black))
                        .foregroundStyle(isEmergency ? .red : .orange)
                        .padding(.horizontal, 4).padding(.vertical, 1)
                        .background(Color.white, in: Capsule())
                }
                Text(alarm.detail)
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.9))
                Text(alarm.action)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.white.opacity(0.75))
                    .padding(.top, 1)
            }
            Spacer()
            Button {
                withAnimation(.easeOut(duration: 0.15)) {
                    _ = dismissedAlarmIds.insert(alarm.id)
                }
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.7))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14).padding(.vertical, 9)
        .background { alarmBannerColor(isEmergency: isEmergency) }
        if !isLast { Divider().background { Color(white: 1, opacity: 0.3) } }
    }

    private func clinicalAlarmBanner(_ alarms: [ClinicalTextParser.ClinicalAlarm]) -> some View {
        VStack(spacing: 0) {
            ForEach(alarms) { alarm in
                alarmRow(alarm, isLast: alarm.id == alarms.last?.id)
            }
        }
        .transition(.move(edge: .top).combined(with: .opacity))
        .animation(.easeInOut(duration: 0.2), value: alarms.count)
    }

    // MARK: - Completeness bar

    private var completenessBar: some View {
        let (filled, total) = patient.consultationCompleteness
        return HStack(spacing: 10) {
            ProgressView(value: Double(filled), total: Double(total))
                .tint(filled == total ? .green : AMColor.accent)
            Text("\(filled)/\(total)")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(filled == total ? .green : .secondary)
                .monospacedDigit()
            if filled == total {
                Image(systemName: "checkmark.seal.fill").foregroundStyle(.green).font(.caption2)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 7)
        .background(AMColor.bg)
    }

    // MARK: - Horizontal tab bar

    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                ForEach(ConsultTab.allCases, id: \.self) { tab in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { activeTab = tab }
                    } label: {
                        VStack(spacing: 0) {
                            HStack(spacing: 4) {
                                if tabFilled(tab) {
                                    Circle()
                                        .fill(activeTab == tab ? AMColor.accent : Color.green)
                                        .frame(width: 5, height: 5)
                                }
                                Text(tab.rawValue)
                                    .font(.system(size: 13, weight: activeTab == tab ? .bold : .semibold))
                                    .foregroundStyle(activeTab == tab ? AMColor.accent : AMColor.sidebarText)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 10)
                            }
                            Rectangle()
                                .fill(activeTab == tab ? AMColor.accent : Color.clear)
                                .frame(height: 2)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 4)
        }
        .background(AMColor.sidebarBg)
        .frame(height: 44)
    }

    private func tabFilled(_ tab: ConsultTab) -> Bool {
        switch tab {
        case .cc:        return !(patient.chiefComplaint ?? "").isEmpty
        case .hpi:       return !(patient.hpi ?? "").isEmpty
        case .pmh:       return !(patient.pmhNotes ?? "").isEmpty || !patient.pmhEntries.isEmpty
        case .pshx:      return !(patient.surgicalHistory ?? "").isEmpty || !patient.pshxEntries.isEmpty
        case .meds:      return !patient.prescriptions.isEmpty
        case .allergies: return !patient.allergies.isEmpty
        case .social:    return !(patient.socialHistory ?? "").isEmpty
        case .exam:           return !(patient.examGeneral ?? "").isEmpty || !(patient.examAbdo ?? "").isEmpty
        case .investigations: return !patient.investigations.isEmpty
        case .diagnosis:      return patient.workingDiagnosis != nil
        case .plan:      return !(patient.managementPlan ?? "").isEmpty
        case .history:   return !patient.encounters.isEmpty
        }
    }

    // MARK: - Tab content dispatch

    @ViewBuilder
    private var tabContent: some View {
        switch activeTab {
        case .cc:        ccTab
        case .hpi:       hpiTab
        case .pmh:       pmhTab
        case .pshx:      pshxTab
        case .meds:      List { medicationsSection }
        case .allergies: allergiesTab
        case .social:    socialTab
        case .exam:           examTab
        case .investigations: investigationsTab
        case .diagnosis:      diagnosisTab
        case .plan:      planTab
        case .history:   encounterHistoryTab
        }
    }

    // MARK: - CC tab

    private var selectedChipLabel: String? {
        let cc = patient.chiefComplaint ?? ""
        return ccSpecialtyGroups.flatMap(\.chips).first(where: { $0.label == cc })?.label
    }

    private var ccTab: some View {
        List {
            // Patient identity + free-text input
            Section {
                HStack(spacing: 6) {
                    Image(systemName: "person.text.rectangle")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let mrn = patient.mrn, !mrn.isEmpty {
                        Text(mrn)
                            .font(.system(.caption, design: .monospaced).weight(.medium))
                            .foregroundStyle(.secondary)
                    } else {
                        Text("Assigning MRN…")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                    Spacer()
                    Text("\(patient.encounters.filter(\.isComplete).count) saved visit(s)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                if let vt = patient.visitType {
                    HStack(spacing: 6) {
                        Image(systemName: vt.icon).foregroundStyle(AMColor.accent)
                        Text(vt.rawValue)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AMColor.accent)
                        Spacer()
                        Text("Visit type").font(.caption2).foregroundStyle(.tertiary)
                    }
                }
                // Free-text override
                TextField("Type a complaint or select below…",
                          text: Binding(get: { patient.chiefComplaint ?? "" },
                                        set: { patient.chiefComplaint = $0.isEmpty ? nil : $0; selectedSpecialtyHint = nil; touch() }),
                          axis: .vertical)
                    .font(.callout)
                    .lineLimit(3...)
                if isAssessing {
                    HStack(spacing: 8) {
                        ProgressView().scaleEffect(0.8)
                        Text("Analysing pathway…").font(.caption).foregroundStyle(.secondary)
                    }
                }
            } header: {
                sectionHeader("Chief Complaint", icon: "person.fill.questionmark",
                              filled: !(patient.chiefComplaint ?? "").isEmpty)
            }

            // Inline Bayesian early differential
            if !ccBayesDiff.isEmpty {
                ccBayesDifferentialSection
            }

            // Pathway result
            if let result = triageResult { pathwayResult(result) }

            // Specialty-grouped complaint sections
            ForEach(ccSpecialtyGroups) { group in
                Section {
                    ForEach(group.chips) { chip in
                        let isSelected = selectedChipLabel == chip.label
                        Button {
                            patient.chiefComplaint = chip.label
                            selectedSpecialtyHint = group.name
                            touch()
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: chip.icon)
                                    .font(.system(size: 11))
                                    .foregroundStyle(isSelected ? AMColor.accent : .secondary)
                                    .frame(width: 16)
                                Text(chip.label)
                                    .font(.callout.weight(isSelected ? .semibold : .regular))
                                    .foregroundStyle(.primary)
                                Spacer()
                                if isSelected {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundStyle(AMColor.accent)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Label(group.name, systemImage: group.icon)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .textCase(nil)
                }
            }
        }
    }

    // MARK: - CC Bayesian differential (early, CC-only signal)

    @ViewBuilder private var ccBayesDifferentialSection: some View {
        Section {
            ForEach(ccBayesDiff.prefix(4), id: \.name) { dx in
                HStack(spacing: 8) {
                    // Urgency left stripe: amber=urgent, red=emergency, deep red=critical
                    if dx.urgency > 0 {
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(urgencyColor(dx.urgency))
                            .frame(width: 3)
                            .frame(minHeight: 36)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(dx.name)
                            .font(.subheadline.weight(.medium))
                        Text(dx.icdCode)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                        if dx.urgency > 0 {
                            Text(urgencyLabel(dx.urgency))
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(urgencyColor(dx.urgency))
                        }
                    }
                    Spacer()
                    // Probability bar + label
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.secondary.opacity(0.15))
                            .frame(width: 60, height: 6)
                        Capsule()
                            .fill(bayesColor(dx.confidence))
                            .frame(width: max(4, CGFloat(dx.probability) / 100 * 60), height: 6)
                    }
                    Text("\(dx.probability)%")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(bayesColor(dx.confidence))
                        .frame(width: 34, alignment: .trailing)
                }
            }
        } header: {
            Label("Early Differential — tap to confirm", systemImage: "wand.and.stars")
                .font(.caption.weight(.semibold))
                .foregroundStyle(AMColor.accent)
                .textCase(nil)
        } footer: {
            Text("Based on chief complaint + PMH only. Colour stripe = urgency tier. Refines as you add more evidence.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    private func bayesColor(_ c: BayesianDiagnosisEngine.DiagnosisResult.Confidence) -> Color {
        switch c {
        case .certain:  return .red
        case .high:     return .orange
        case .moderate: return AMColor.accent
        case .low:      return .secondary
        }
    }

    private func urgencyColor(_ level: Int) -> Color {
        switch level {
        case 3: return Color(red: 0.72, green: 0.0, blue: 0.0)
        case 2: return .red
        case 1: return .orange
        default: return .clear
        }
    }

    private func urgencyLabel(_ level: Int) -> String {
        switch level {
        case 3: return "⚠ CRITICAL"
        case 2: return "⚠ EMERGENCY"
        case 1: return "URGENT"
        default: return ""
        }
    }

    // MARK: - Specialty Early Form

    /// Renders targeted clinical flag chips above the SOCRATES builder when a focused
    /// specialty CC is selected. Chips pre-populate socratesSelections, feeding directly
    /// into the Bayesian scorer without requiring SOCRATES to be re-opened.
    @ViewBuilder
    private var specialtyEarlyFormSection: some View {
        let hint = selectedSpecialtyHint ?? ""
        let cc   = patient.chiefComplaint ?? ""
        let groups = specialtyEarlyFormGroups(hint: hint, cc: cc)
        if !groups.isEmpty {
            Section {
                ForEach(groups) { group in
                    VStack(alignment: .leading, spacing: 6) {
                        Label(group.question, systemImage: group.icon)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.secondary)
                        ChipFlow(hSpacing: 7, vSpacing: 7) {
                            ForEach(group.chips) { chip in
                                let isSelected = (socratesSelections[chip.dimId] ?? []).contains(chip.value)
                                Button {
                                    toggleSOCRATES(dimId: chip.dimId, chip: chip.value, multiSelect: chip.multiSelect)
                                } label: {
                                    Text(chip.label)
                                        .font(.system(size: 12, weight: isSelected ? .semibold : .regular))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 5)
                                        .background(isSelected ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                        .foregroundStyle(isSelected ? Color.white : AMColor.accent)
                                        .animation(.easeInOut(duration: 0.12), value: isSelected)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            } header: {
                Label("Quick Clinical Flags — \(hint)", systemImage: "staroflife.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AMColor.accent)
                    .textCase(nil)
            } footer: {
                Text("Chips feed the Bayesian scorer directly. Tap to select — findings also appear in SOCRATES.")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    // MARK: - HPI tab (SOCRATES chip builder)

    // Chip sets re-evaluated whenever the CC changes
    private var adaptedSocrateDimensions: [SOCRATESDimension] {
        socrateDimensions(for: patient.chiefComplaint ?? "")
    }

    // MARK: - Exam adaptive chips

    private var primaryExamLabel: String {
        let lc = (patient.chiefComplaint ?? "").lowercased()
        if lc.contains("neck") || lc.contains("thyroid") || lc.contains("goitre") || lc.contains("lymph") || lc.contains("goiter") { return "Neck Examination" }
        if lc.contains("breast") || lc.contains("nipple") || lc.contains("mastalgia") { return "Breast Examination" }
        if (lc.contains("chest") && lc.contains("pain")) || lc.contains("angina") || lc.contains("palpitation") { return "Chest / Cardiac" }
        if lc.contains("hernia") || lc.contains("inguinal") || lc.contains("femoral") || lc.contains("groin") { return "Groin / Hernia" }
        if lc.contains("dysphagia") || lc.contains("swallow") { return "Oropharynx / Neck" }
        if lc.contains("perianal") || lc.contains("anal") || lc.contains("haemorrhoid") || lc.contains("hemorrhoid") || lc.contains("rectal") || lc.contains("fissure") || lc.contains("fistula") { return "Perianal / PR Examination" }
        if lc.contains("skin") || lc.contains("mole") || lc.contains("melanoma") || lc.contains("lesion") || lc.contains("lipoma") { return "Skin Lesion" }
        if lc.contains("scrotum") || lc.contains("testicular") || lc.contains("testicle") || lc.contains("orchit") || lc.contains("hydrocele") || lc.contains("scrotal") { return "Scrotal / Testicular" }
        if lc.contains("haematuria") || lc.contains("urinary") || lc.contains("retention") || lc.contains("prostate") { return "Renal / Urological" }
        if lc.contains("parotid") || lc.contains("salivary") { return "Salivary Gland / Jaw" }
        return "Abdomen"
    }

    private var primaryExamChips: [String] {
        let lc = (patient.chiefComplaint ?? "").lowercased()
        if lc.contains("neck") || lc.contains("thyroid") || lc.contains("goitre") || lc.contains("lymph") || lc.contains("goiter") {
            return ["Mobile, non-tender.", "Fixed to deep tissue.", "Moves on swallowing.", "Pulsatile; bruit present.", "Hard and irregular.", "Smooth and soft.", "Tender.", "Non-tender.", "Thyroid diffusely enlarged.", "Single nodule.", "Multiple nodes palpable.", "No palpable lymphadenopathy."]
        }
        if lc.contains("breast") || lc.contains("nipple") || lc.contains("mastalgia") {
            return ["Mobile, non-tender.", "Fixed to overlying skin.", "Fixed to pectoral muscle.", "Irregular, hard.", "Smooth, soft.", "Nipple inversion.", "Skin dimpling / peau d'orange.", "Axillary nodes palpable.", "Axillary nodes not palpable.", "Nipple discharge.", "No skin changes."]
        }
        if (lc.contains("chest") && lc.contains("pain")) || lc.contains("angina") || lc.contains("palpitation") {
            return ["No chest wall tenderness.", "Reproducible on palpation.", "Apex beat non-displaced.", "Bilateral air entry.", "No peripheral oedema.", "Peripheral pulses present.", "JVP not elevated."]
        }
        if lc.contains("hernia") || lc.contains("inguinal") || lc.contains("femoral") || lc.contains("groin") {
            return ["Cough impulse present.", "Reducible.", "Irreducible.", "Above inguinal ligament.", "Below inguinal ligament.", "Extending into scrotum.", "Transilluminates.", "No transillumination.", "Tender on palpation.", "Soft, easily reducible."]
        }
        if lc.contains("dysphagia") || lc.contains("swallow") {
            return ["Oropharynx clear.", "No neck mass.", "Moves on swallowing.", "Cervical lymphadenopathy.", "Voice normal on exam.", "Hoarse voice."]
        }
        if lc.contains("perianal") || lc.contains("anal") || lc.contains("haemorrhoid") || lc.contains("hemorrhoid") || lc.contains("rectal") || lc.contains("fissure") || lc.contains("fistula") {
            return ["Perianal skin normal.", "External haemorrhoids visible.", "Perianal erythema.", "Fluctuant perianal mass.", "Skin tag.", "External fistula opening.", "Posterior midline fissure.", "Normal rectal tone on DRE.", "Tender on DRE.", "Blood on glove.", "Mucosa normal on PR."]
        }
        if lc.contains("skin") || lc.contains("mole") || lc.contains("melanoma") || lc.contains("lesion") || lc.contains("lipoma") {
            return ["Well-defined border.", "Ill-defined border.", "Pigmented lesion.", "Non-pigmented.", "Raised >2 mm.", "Flat.", "Ulcerated.", "Smooth surface.", "Regional nodes not palpable.", "Regional nodes enlarged.", "Satellite lesions."]
        }
        if lc.contains("scrotum") || lc.contains("testicular") || lc.contains("testicle") || lc.contains("orchit") || lc.contains("hydrocele") || lc.contains("scrotal") {
            return ["Tender testis.", "Non-tender.", "Transilluminates (hydrocele).", "No transillumination.", "Warm and erythematous.", "Normal cremasteric reflex.", "Absent cremasteric reflex.", "Epididymal cyst.", "Scrotal oedema.", "Mass separate from testis."]
        }
        if lc.contains("haematuria") || lc.contains("urinary") || lc.contains("retention") || lc.contains("prostate") {
            return ["No renal angle tenderness.", "Right renal angle tender.", "Left renal angle tender.", "Bladder palpable to umbilicus.", "Suprapubic tenderness.", "Prostate smooth, not enlarged (DRE).", "Prostate enlarged, benign (DRE).", "Prostate hard, irregular (DRE)."]
        }
        if lc.contains("parotid") || lc.contains("salivary") {
            return ["Soft, mobile.", "Firm, fixed.", "Tender.", "Non-tender.", "Facial nerve intact.", "Bimanual — stone palpable.", "No stone palpable.", "Erythema overlying skin."]
        }
        return ["Soft, non-tender.", "Tender RUQ.", "Tender RLQ.", "Guarding.", "Rigidity.", "Murphy's +ve.", "Bowel sounds normal.", "No organomegaly.", "Hepatomegaly.", "Distended."]
    }

    private var primaryCVSChips: [String] {
        let lc = (patient.chiefComplaint ?? "").lowercased()
        if (lc.contains("chest") && lc.contains("pain")) || lc.contains("angina") || lc.contains("palpitation") || lc.contains("cardiac") {
            return ["Regular rate and rhythm.", "Irregular (AF).", "Dual heart sounds.", "Systolic murmur.", "Ejection systolic murmur.", "S3 gallop.", "Elevated JVP.", "Pitting oedema ankles.", "Peripheral pulses present bilaterally.", "Absent left radial pulse."]
        }
        return ["Regular rate and rhythm. No murmurs.", "Dual heart sounds.", "Systolic murmur.", "Pitting oedema ankles.", "Elevated JVP."]
    }

    private var hpiTab: some View {
        List {
            // Specialty early form: targeted discriminating chips before full SOCRATES
            specialtyEarlyFormSection

            // SOCRATES builder accordion
            Section {
                ForEach(adaptedSocrateDimensions) { dim in
                    socratesDimRow(dim)
                }
            } header: {
                let filled = adaptedSocrateDimensions.filter { !(socratesSelections[$0.id] ?? []).isEmpty }.count
                HStack {
                    Label("SOCRATES Builder", systemImage: "square.grid.2x2")
                    Spacer()
                    Text("\(filled)/\(adaptedSocrateDimensions.count)")
                        .font(.caption.weight(.semibold).monospacedDigit())
                        .foregroundStyle(filled == adaptedSocrateDimensions.count ? .green : .secondary)
                }
            }

            // Live preview + apply
            if let preview = socratesPreview {
                Section {
                    Text(preview)
                        .font(.callout)
                        .foregroundStyle(.primary)
                        .padding(.vertical, 4)
                    Button {
                        patient.hpi = preview; touch()
                    } label: {
                        Label("Apply to HPI", systemImage: "checkmark.circle.fill")
                    }
                    .foregroundStyle(AMColor.accent)
                } header: {
                    Label("Preview", systemImage: "text.viewfinder")
                }
            }

            // Manual / AI fallback
            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.hpi ?? "" },
                                            set: { patient.hpi = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 140)
                        .medicalDictation(mode: .hpi, patient: patient,
                                          text: Binding(get: { patient.hpi ?? "" },
                                                        set: { patient.hpi = $0.isEmpty ? nil : $0; touch() }))
                    if (patient.hpi ?? "").isEmpty {
                        Text("Committed HPI will appear here — or type directly")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
                Button {
                    Task { await draftHPI() }
                } label: {
                    HStack {
                        Label("AI Draft HPI", systemImage: "sparkles")
                        Spacer()
                        if ai.isGenerating { ProgressView() }
                    }
                }
                .disabled(ai.isGenerating || (patient.chiefComplaint ?? "").isEmpty)
                .foregroundStyle(.purple)
            } header: {
                sectionHeader("HPI Text", icon: "text.bubble",
                              filled: !(patient.hpi ?? "").isEmpty)
            }
        }
    }

    // MARK: - SOCRATES dimension accordion row

    @ViewBuilder
    private func socratesDimRow(_ dim: SOCRATESDimension) -> some View {
        let selections = socratesSelections[dim.id] ?? []
        let isExpanded = socratesExpandedDim == dim.id

        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.18)) {
                    socratesExpandedDim = isExpanded ? nil : dim.id
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: dim.icon)
                        .foregroundStyle(selections.isEmpty ? .secondary : AMColor.accent)
                        .frame(width: 20, alignment: .center)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(dim.title)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.primary)
                        if !selections.isEmpty {
                            Text(selections.sorted().joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(AMColor.accent)
                                .lineLimit(1)
                        } else if !isExpanded {
                            Text(dim.question)
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    Spacer()
                    if !selections.isEmpty {
                        Text("\(selections.count)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 18, height: 18)
                            .background(AMColor.accent, in: Circle())
                    }
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                }
                .padding(.vertical, 6)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(dim.chips, id: \.self) { chip in
                        let isSelected = selections.contains(chip)
                        Button {
                            toggleSOCRATES(dimId: dim.id, chip: chip, multiSelect: dim.multiSelect)
                        } label: {
                            Text(chip)
                                .font(.system(size: 12, weight: isSelected ? .semibold : .regular))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(isSelected ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                .foregroundStyle(isSelected ? Color.white : AMColor.accent)
                                .animation(.easeInOut(duration: 0.12), value: isSelected)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.top, 10)
                .padding(.bottom, 4)
            }
        }
    }

    // MARK: - SOCRATES chip toggle + auto-advance

    private func toggleSOCRATES(dimId: String, chip: String, multiSelect: Bool) {
        var current = socratesSelections[dimId] ?? []
        if multiSelect {
            if current.contains(chip) { current.remove(chip) } else { current.insert(chip) }
        } else {
            current = current.contains(chip) ? [] : [chip]
        }
        socratesSelections[dimId] = current

        // Auto-advance to next dim on single-select
        if !multiSelect && !current.isEmpty {
            let ids = adaptedSocrateDimensions.map(\.id)
            if let idx = ids.firstIndex(of: dimId), idx + 1 < ids.count {
                withAnimation(.easeInOut(duration: 0.18)) { socratesExpandedDim = ids[idx + 1] }
            }
        }
    }

    // MARK: - HPI prose generation from SOCRATES chips

    private var socratesPreview: String? {
        guard adaptedSocrateDimensions.contains(where: { !(socratesSelections[$0.id] ?? []).isEmpty }) else { return nil }
        return buildHpiProse()
    }

    private func buildHpiProse() -> String {
        let cc   = patient.chiefComplaint ?? "presenting complaint"
        let onset = (socratesSelections["onset"] ?? []).first ?? ""
        let sites = (socratesSelections["site"] ?? []).sorted()
        let chars = (socratesSelections["character"] ?? []).sorted()
        let rad   = socratesSelections["radiation"]?.first
        let assoc = (socratesSelections["associations"] ?? []).sorted()
        let timing = (socratesSelections["timing"] ?? []).sorted()
        let exc   = (socratesSelections["exacerbating"] ?? []).sorted()
        let rel   = (socratesSelections["relieving"] ?? []).sorted()
        let sev   = socratesSelections["severity"]?.first

        var parts: [String] = []

        // Opening sentence
        var open = patient.fullName
        if patient.ageYears > 0 {
            open += ", a \(patient.ageYears)-year-old \(patient.sex.rawValue.lowercased()),"
        }
        open += " presents with \(cc)"
        if !onset.isEmpty { open += " of \(onset.lowercased()) duration" }
        open += "."
        parts.append(open)

        // Character + site
        if !chars.isEmpty || !sites.isEmpty {
            var s = "The \(cc)"
            if !chars.isEmpty { s += " is \(joinList(chars.map { $0.lowercased() })) in character" }
            if !sites.isEmpty { s += (chars.isEmpty ? " is" : ",") + " localised to the \(joinList(sites))" }
            parts.append(s + ".")
        }

        // Radiation
        if let r = rad, r != "No radiation" {
            parts.append("The pain radiates to the \(r.lowercased()).")
        }

        // Timing
        if !timing.isEmpty {
            parts.append("Symptoms are \(joinList(timing.map { $0.lowercased() })) in nature.")
        }

        // Associations
        if !assoc.isEmpty {
            parts.append("Associated symptoms include \(joinList(assoc.map { $0.lowercased() })).")
        }

        // Exacerbating
        if !exc.isEmpty {
            parts.append("Symptoms are exacerbated by \(joinList(exc.map { $0.lowercased() })).")
        }

        // Relieving
        let relFiltered = rel.filter { $0 != "Nothing" }
        if !relFiltered.isEmpty {
            parts.append("Relief is obtained with \(joinList(relFiltered.map { $0.lowercased() })).")
        }

        // Severity
        if let s = sev {
            parts.append("Severity is rated as \(s.lowercased()).")
        }

        return parts.joined(separator: " ")
    }

    private func joinList(_ items: [String]) -> String {
        switch items.count {
        case 0: return ""
        case 1: return items[0]
        case 2: return "\(items[0]) and \(items[1])"
        default: return items.dropLast().joined(separator: ", ") + ", and \(items.last!)"
        }
    }

    // MARK: - PMH tab

    // MARK: - PMH medications section

    private var medicationsSection: some View {
        Section {
            // PMH-derived quick-picks — deterministic, no AI
            let pmhMeds = pmhDerivedMedSuggestions
            if !pmhMeds.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Label("From your PMH — tap to add", systemImage: "cross.case")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(pmhMeds, id: \.self) { name in
                                Button {
                                    let match = ClinicalSearchService.searchDrugs(name).first
                                    if let drug = match {
                                        medQuery = drug.name
                                        expandedMed = drug
                                        medDose = drug.commonDoses
                                        medRoute = drug.route
                                        medFreq = "OD"
                                        medSuggestions = []
                                    } else {
                                        addMedicationEntry(name: name, dose: "", route: "Oral", freq: "OD")
                                    }
                                } label: {
                                    Text(name)
                                        .font(.caption.weight(.medium))
                                        .padding(.horizontal, 10).padding(.vertical, 5)
                                        .background(AMColor.accentLt, in: Capsule())
                                        .foregroundStyle(AMColor.accent)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.vertical, 2)
            }

            // Drug search field
            HStack(spacing: 8) {
                Image(systemName: "pills").foregroundStyle(.secondary)
                TextField("Search medication…", text: $medQuery)
                    .autocorrectionDisabled()
                    .onChange(of: medQuery) { _, q in
                        medSuggestions = q.count >= 2 ? ClinicalSearchService.searchDrugs(q) : []
                        if expandedMed != nil && expandedMed?.name.lowercased() != q.lowercased() {
                            expandedMed = nil
                        }
                    }
                if !medQuery.isEmpty {
                    Button { medQuery = ""; medSuggestions = []; expandedMed = nil } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                    }.buttonStyle(.plain)
                }
            }

            // Drug suggestion list
            ForEach(medSuggestions.prefix(6)) { drug in
                Button {
                    medQuery  = drug.name
                    expandedMed = drug
                    medDose   = drug.commonDoses
                    medRoute  = drug.route
                    medFreq   = "OD"
                    medSuggestions = []
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(drug.name).font(.subheadline).foregroundStyle(.primary)
                            Text(drug.category).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(drug.commonDoses).font(.caption2).foregroundStyle(.tertiary)
                    }
                }.buttonStyle(.plain)
            }

            // Inline dose/route/frequency submenu
            if let drug = expandedMed {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Label(drug.name, systemImage: "pill.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AMColor.accent)
                        Spacer()
                        Button { expandedMed = nil; medQuery = "" } label: {
                            Image(systemName: "xmark").font(.caption)
                        }.buttonStyle(.plain).foregroundStyle(.secondary)
                    }

                    // Dose
                    VStack(alignment: .leading, spacing: 4) {
                        Text("DOSE").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                        HStack(spacing: 6) {
                            TextField("e.g. 500 mg", text: $medDose)
                                .font(.callout)
                                .frame(maxWidth: .infinity)
                            if !drug.commonDoses.isEmpty && medDose != drug.commonDoses {
                                Button(drug.commonDoses) { medDose = drug.commonDoses }
                                    .font(.caption2).buttonStyle(.bordered).tint(.teal)
                            }
                        }
                    }

                    // Route chips
                    VStack(alignment: .leading, spacing: 4) {
                        Text("ROUTE").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(["Oral","IV","IM","SC","Topical","Inhaled","PR","SL"], id: \.self) { r in
                                    let sel = medRoute == r
                                    Button(r) { medRoute = r }
                                        .font(.caption2.weight(sel ? .semibold : .regular))
                                        .padding(.horizontal, 8).padding(.vertical, 3)
                                        .background(sel ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                        .foregroundStyle(sel ? .white : AMColor.accent)
                                        .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    // Frequency chips
                    VStack(alignment: .leading, spacing: 4) {
                        Text("FREQUENCY").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(["OD","BD","TDS","QDS","PRN","STAT","Nocte","Weekly"], id: \.self) { f in
                                    let sel = medFreq == f
                                    Button(f) { medFreq = f }
                                        .font(.caption2.weight(sel ? .semibold : .regular))
                                        .padding(.horizontal, 8).padding(.vertical, 3)
                                        .background(sel ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                        .foregroundStyle(sel ? .white : AMColor.accent)
                                        .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    if !drug.notes.isEmpty {
                        Text(drug.notes).font(.caption.italic()).foregroundStyle(.secondary)
                    }

                    Button {
                        addMedicationEntry(name: drug.name, dose: medDose, route: medRoute, freq: medFreq)
                        expandedMed = nil; medQuery = ""; medDose = ""; medRoute = "Oral"; medFreq = "OD"
                    } label: {
                        Label("Add to current medications", systemImage: "plus.circle.fill")
                            .font(.callout.weight(.semibold))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(AMColor.accent)
                }
                .padding(.vertical, 4)
            }

            // AI suggestions
            if !aiMedSuggestions.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Label("AI Suggestions — tap to add", systemImage: "brain")
                        .font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    ForEach(aiMedSuggestions, id: \.self) { name in
                        Button {
                            let match = ClinicalSearchService.searchDrugs(name).first
                            if let drug = match {
                                medQuery = drug.name; expandedMed = drug
                                medDose = drug.commonDoses; medRoute = drug.route; medFreq = "OD"
                            } else {
                                addMedicationEntry(name: name, dose: "", route: "Oral", freq: "OD")
                            }
                            aiMedSuggestions.removeAll { $0 == name }
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "plus.circle").foregroundStyle(AMColor.accent)
                                Text(name).font(.callout)
                                Spacer()
                            }
                        }.buttonStyle(.plain)
                    }
                }
            }

            // AI Suggest Medications — on hold (HIPAA compliance)
            // Button hidden; re-enable when clinical AI clearance is in place.

            // Current medication list
            if !patient.prescriptions.isEmpty {
                Divider()
                let sortedRx = patient.prescriptions.sorted { $0.prescribedAt > $1.prescribedAt }
                ForEach(sortedRx) { rx in
                    HStack(spacing: 10) {
                        Image(systemName: "pill")
                            .font(.system(size: 11))
                            .foregroundStyle(AMColor.accent)
                            .frame(width: 16)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(rx.drug).font(.callout.weight(.semibold))
                            Text(rx.displayLine)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(rx.prescribedAt.formatted(.dateTime.month(.abbreviated).year()))
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.tertiary)
                    }
                }
                .onDelete { idxSet in
                    for i in idxSet { context.delete(sortedRx[i]) }
                    touch()
                }
            }
        } header: {
            sectionHeader("Medications", icon: "pills",
                          filled: !patient.prescriptions.isEmpty)
        }
    }

    private var pmhTab: some View {
        List {
            // Structured entries — one row per condition
            if !patient.pmhEntries.isEmpty {
                Section {
                    ForEach(patient.pmhEntries.indices, id: \.self) { i in
                        pmhEntryRow(index: i)
                    }
                    .onDelete { idxSet in
                        var list = patient.pmhEntries
                        list.remove(atOffsets: idxSet)
                        patient.pmhEntries = list
                        touch()
                    }
                } header: {
                    sectionHeader("Medical History (\(patient.pmhEntries.count))",
                                  icon: "stethoscope", filled: true)
                }
            }

            Section {
                // Bypass card — PMH already on record
                if !(patient.pmhNotes ?? "").isEmpty && !pmhBypassConfirmed {
                    historyBypassCard(
                        title: "PMH already on record",
                        subtitle: "Still accurate for this encounter?",
                        onConfirm: { pmhBypassConfirmed = true }
                    )
                }

                // NKPMH quick-set
                Button {
                    patient.pmhNotes = "No known past medical history (NKPMH)"
                    pmhChipSelections = []
                    pmhBypassConfirmed = true
                    touch()
                } label: {
                    Label("No known PMH (NKPMH)", systemImage: "checkmark.shield")
                        .font(.subheadline)
                        .foregroundStyle(.green)
                }
                .buttonStyle(.plain)

                // Condition list
                ForEach(pmhChips, id: \.self) { chip in
                    let sel = pmhChipSelections.contains(chip)
                    Button {
                        pmhChipSelections.formSymmetricDifference([chip])
                        recomputeRisk()
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: sel ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 13))
                                .foregroundStyle(sel ? AMColor.accent : Color.secondary)
                            Text(chip)
                                .font(.callout.weight(sel ? .semibold : .regular))
                                .foregroundStyle(.primary)
                            Spacer()
                        }
                    }.buttonStyle(.plain)
                }

                // Apply button
                if !pmhChipSelections.isEmpty {
                    Button {
                        appendHistory(existing: patient.pmhNotes, chips: pmhChipSelections) {
                            patient.pmhNotes = $0
                        }
                        // Create structured entries for each new condition
                        var entries = patient.pmhEntries
                        for chip in pmhChipSelections.sorted() {
                            if !entries.contains(where: { $0.condition == chip }) {
                                entries.append(PMHEntry(condition: chip))
                            }
                        }
                        patient.pmhEntries = entries
                        pmhChipSelections = []
                        pmhBypassConfirmed = true
                        touch()
                    } label: {
                        Label("Append \(pmhChipSelections.count) condition\(pmhChipSelections.count == 1 ? "" : "s") to PMH Notes",
                              systemImage: "plus.circle.fill")
                    }
                    .foregroundStyle(AMColor.accent)
                }

                // Manual text editor
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.pmhNotes ?? "" },
                                            set: { patient.pmhNotes = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 100)
                    if (patient.pmhNotes ?? "").isEmpty {
                        Text("Free-text PMH — or tick conditions above")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Past Medical History", icon: "clock.arrow.circlepath",
                              filled: !(patient.pmhNotes ?? "").isEmpty)
            }

            // Surgical risk profile — reactive to PMH chips, medications, age, BMI, social
            if !surgicalRiskAlerts.isEmpty {
                surgicalRiskSection
            }

            Section {
                ForEach(familyHistoryChips, id: \.self) { chip in
                    let sel = fhChipSelections.contains(chip)
                    Button { fhChipSelections.formSymmetricDifference([chip]) } label: {
                        HStack(spacing: 10) {
                            Image(systemName: sel ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 13))
                                .foregroundStyle(sel ? AMColor.accent : Color.secondary)
                            Text(chip)
                                .font(.callout.weight(sel ? .semibold : .regular))
                                .foregroundStyle(.primary)
                            Spacer()
                        }
                    }.buttonStyle(.plain)
                }

                if !fhChipSelections.isEmpty {
                    Button {
                        appendHistory(existing: patient.familyHistoryNotes, chips: fhChipSelections) {
                            patient.familyHistoryNotes = $0
                        }
                        fhChipSelections = []
                        touch()
                    } label: {
                        Label("Append \(fhChipSelections.count) item\(fhChipSelections.count == 1 ? "" : "s") to Family History",
                              systemImage: "plus.circle.fill")
                    }
                    .foregroundStyle(AMColor.accent)
                }

                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.familyHistoryNotes ?? "" },
                                            set: { patient.familyHistoryNotes = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 80)
                    if (patient.familyHistoryNotes ?? "").isEmpty {
                        Text("Free-text — or tick conditions above")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Family History", icon: "person.2",
                              filled: !(patient.familyHistoryNotes ?? "").isEmpty)
            }
        }
    }

    // MARK: - PSHx tab

    private var pshxTab: some View {
        List {
            // Structured entries — one row per procedure
            if !patient.pshxEntries.isEmpty {
                Section {
                    ForEach(patient.pshxEntries.indices, id: \.self) { i in
                        pshxEntryRow(index: i)
                    }
                    .onDelete { idxSet in
                        var list = patient.pshxEntries
                        list.remove(atOffsets: idxSet)
                        patient.pshxEntries = list
                        touch()
                    }
                } header: {
                    sectionHeader("Surgical History (\(patient.pshxEntries.count))",
                                  icon: "scissors", filled: true)
                }
            }

            Section {
                // Bypass card
                if !(patient.surgicalHistory ?? "").isEmpty && !pshxBypassConfirmed {
                    historyBypassCard(
                        title: "Surgical history already on record",
                        subtitle: "Still accurate for this encounter?",
                        onConfirm: { pshxBypassConfirmed = true }
                    )
                }

                // No prior surgery quick-set
                Button {
                    patient.surgicalHistory = "No previous surgical history"
                    pshxChipSelections = []
                    pshxBypassConfirmed = true
                    touch()
                } label: {
                    Label("No previous surgical history", systemImage: "checkmark.shield")
                        .font(.subheadline)
                        .foregroundStyle(.green)
                }
                .buttonStyle(.plain)

                // Procedure list
                ForEach(pshxChips, id: \.self) { chip in
                    let sel = pshxChipSelections.contains(chip)
                    Button { pshxChipSelections.formSymmetricDifference([chip]) } label: {
                        HStack(spacing: 10) {
                            Image(systemName: sel ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 13))
                                .foregroundStyle(sel ? AMColor.accent : Color.secondary)
                            Text(chip)
                                .font(.callout.weight(sel ? .semibold : .regular))
                                .foregroundStyle(.primary)
                            Spacer()
                        }
                    }.buttonStyle(.plain)
                }

                // Apply button
                if !pshxChipSelections.isEmpty {
                    Button {
                        appendHistory(existing: patient.surgicalHistory, chips: pshxChipSelections) {
                            patient.surgicalHistory = $0
                        }
                        // Create structured entries for each new procedure
                        var entries = patient.pshxEntries
                        for chip in pshxChipSelections.sorted() {
                            if !entries.contains(where: { $0.procedure == chip }) {
                                entries.append(PSHxEntry(procedure: chip))
                            }
                        }
                        patient.pshxEntries = entries
                        pshxChipSelections = []
                        pshxBypassConfirmed = true
                        touch()
                    } label: {
                        Label("Append \(pshxChipSelections.count) procedure\(pshxChipSelections.count == 1 ? "" : "s") to Surgical History",
                              systemImage: "plus.circle.fill")
                    }
                    .foregroundStyle(AMColor.accent)
                }

                // Manual text editor
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.surgicalHistory ?? "" },
                                            set: { patient.surgicalHistory = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 120)
                    if (patient.surgicalHistory ?? "").isEmpty {
                        Text("Previous operations, procedures, anaesthetic history, complications…")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Past Surgical History", icon: "scissors",
                              filled: !(patient.surgicalHistory ?? "").isEmpty)
            }
        }
    }

    // MARK: - Structured history entry rows

    @ViewBuilder
    private func pmhEntryRow(index i: Int) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "stethoscope")
                .font(.system(size: 11))
                .foregroundStyle(AMColor.accent)
                .frame(width: 16)
            Text(i < patient.pmhEntries.count ? patient.pmhEntries[i].condition : "")
                .font(.callout)
                .foregroundStyle(.primary)
            Spacer()
            TextField("Year", text: Binding(
                get: { i < patient.pmhEntries.count ? patient.pmhEntries[i].yearText : "" },
                set: { v in
                    guard i < patient.pmhEntries.count else { return }
                    var list = patient.pmhEntries
                    list[i].yearText = v
                    patient.pmhEntries = list
                    touch()
                }
            ))
            .keyboardType(.numberPad)
            .font(.system(size: 12).monospacedDigit())
            .foregroundStyle(.secondary)
            .frame(width: 52)
            .multilineTextAlignment(.trailing)
        }
    }

    @ViewBuilder
    private func pshxEntryRow(index i: Int) -> some View {
        let entry = i < patient.pshxEntries.count ? patient.pshxEntries[i] : PSHxEntry(procedure: "")
        HStack(spacing: 8) {
            Image(systemName: "scissors")
                .font(.system(size: 11))
                .foregroundStyle(AMColor.accent)
                .frame(width: 16)
            Text(entry.procedure)
                .font(.callout)
                .foregroundStyle(.primary)
            Spacer()
            TextField("Year", text: Binding(
                get: { i < patient.pshxEntries.count ? patient.pshxEntries[i].yearText : "" },
                set: { v in
                    guard i < patient.pshxEntries.count else { return }
                    var list = patient.pshxEntries
                    list[i].yearText = v
                    patient.pshxEntries = list
                    touch()
                }
            ))
            .keyboardType(.numberPad)
            .font(.system(size: 12).monospacedDigit())
            .foregroundStyle(.secondary)
            .frame(width: 48)
            .multilineTextAlignment(.trailing)

            Menu {
                Button("Unknown / Not recorded") {
                    guard i < patient.pshxEntries.count else { return }
                    var list = patient.pshxEntries
                    list[i].anaesthetic = ""
                    patient.pshxEntries = list; touch()
                }
                ForEach(["GA", "Spinal", "Epidural", "Local", "Sedation", "Regional"], id: \.self) { type in
                    Button(type) {
                        guard i < patient.pshxEntries.count else { return }
                        var list = patient.pshxEntries
                        list[i].anaesthetic = type
                        patient.pshxEntries = list; touch()
                    }
                }
            } label: {
                Text(entry.anaesthetic.isEmpty ? "Anaesth." : entry.anaesthetic)
                    .font(.caption2.weight(.medium))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(
                        entry.anaesthetic.isEmpty ? Color(.systemGray5) : AMColor.accentLt,
                        in: Capsule()
                    )
                    .foregroundStyle(entry.anaesthetic.isEmpty ? .secondary : AMColor.accent)
            }
            .menuStyle(.button)
        }
    }

    // MARK: - Investigations tab

    private var investigationsTab: some View {
        List {
            // CC-matched suggestions
            if let cc = patient.chiefComplaint,
               let suggestions = ccInvestigations[cc], !suggestions.isEmpty {
                let existing = Set(patient.investigations.map { $0.name })
                let toShow = suggestions.filter { !existing.contains($0.name) }
                if !toShow.isEmpty {
                    Section {
                        ChipFlow(hSpacing: 8, vSpacing: 8) {
                            ForEach(toShow, id: \.name) { inv in
                                Button { addInvestigation(name: inv.name, category: inv.category) } label: {
                                    HStack(spacing: 4) {
                                        Image(systemName: inv.category.icon).font(.system(size: 10))
                                        Text(inv.name).font(.system(size: 12))
                                    }
                                    .padding(.horizontal, 10).padding(.vertical, 5)
                                    .background(AMColor.accentLt, in: Capsule())
                                    .foregroundStyle(AMColor.accent)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 4)
                    } header: {
                        Label("Suggested for \(cc)", systemImage: "sparkles")
                    }
                }
            }

            // PMH-matched suggestions
            let pmhIx = pmhDerivedIxSuggestions
            if !pmhIx.isEmpty {
                Section {
                    ChipFlow(hSpacing: 8, vSpacing: 8) {
                        ForEach(pmhIx, id: \.name) { inv in
                            Button { addInvestigation(name: inv.name, category: inv.category) } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: inv.category.icon).font(.system(size: 10))
                                    Text(inv.name).font(.system(size: 12))
                                }
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(AMColor.accentLt, in: Capsule())
                                .foregroundStyle(AMColor.accent)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Label("From your PMH", systemImage: "cross.case")
                }
            }

            // Common baseline fallback — shown when CC has no matched suggestion set
            let hasCCMatch = patient.chiefComplaint.flatMap { ccInvestigations[$0] } != nil
            let existingNames = Set(patient.investigations.map { $0.name })
            let baselineToShow = commonBaselineInvs.filter { !existingNames.contains($0.name) }
            if !hasCCMatch && !baselineToShow.isEmpty {
                Section {
                    ChipFlow(hSpacing: 8, vSpacing: 8) {
                        ForEach(baselineToShow, id: \.name) { inv in
                            Button { addInvestigation(name: inv.name, category: inv.category) } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: inv.category.icon).font(.system(size: 10))
                                    Text(inv.name).font(.system(size: 12))
                                }
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(AMColor.accentLt, in: Capsule())
                                .foregroundStyle(AMColor.accent)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Label("Common Baseline Tests", systemImage: "list.bullet.clipboard")
                }
            }

            // Ordered / pending / resulted list
            let active = patient.investigations.filter { $0.status != .cancelled }
            if !active.isEmpty {
                Section {
                    ForEach(active) { inv in invRow(inv) }
                    .onDelete { idxSet in
                        let toRemove = idxSet.map { active[$0].id }
                        var list = patient.investigations
                        list.removeAll { toRemove.contains($0.id) }
                        patient.investigations = list; touch()
                    }
                } header: {
                    sectionHeader("Ordered Investigations (\(active.count))", icon: "flask",
                                  filled: !active.isEmpty)
                }
            }

            // Manual add
            Section {
                HStack(spacing: 10) {
                    TextField("Investigation name", text: $newInvName)
                        .autocorrectionDisabled()
                    Picker("", selection: $newInvCategory) {
                        ForEach(InvestigationEntry.InvCategory.allCases, id: \.self) { cat in
                            Label(cat.rawValue, systemImage: cat.icon).tag(cat)
                        }
                    }
                    .labelsHidden()
                    .frame(width: 90)
                    Button {
                        let trimmed = newInvName.trimmingCharacters(in: .whitespaces)
                        guard !trimmed.isEmpty else { return }
                        addInvestigation(name: trimmed, category: newInvCategory)
                        newInvName = ""
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(newInvName.isEmpty ? .secondary : AMColor.accent)
                            .font(.title3)
                    }
                    .disabled(newInvName.trimmingCharacters(in: .whitespaces).isEmpty)
                    .buttonStyle(.plain)
                }
            } header: {
                Label("Add Manually", systemImage: "plus.circle")
            }
        }
    }

    @ViewBuilder
    private func invRow(_ inv: InvestigationEntry) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: inv.category.icon)
                    .foregroundStyle(invStatusColor(inv.status))
                    .frame(width: 20, alignment: .center)
                VStack(alignment: .leading, spacing: 1) {
                    Text(inv.name).font(.subheadline.weight(.medium))
                    Text(inv.category.rawValue).font(.caption2).foregroundStyle(.secondary)
                }
                Spacer()
                // Tappable status badge — tap to advance ordered → pending → resulted
                if inv.status.next != nil {
                    Button { advanceInvStatus(inv) } label: {
                        Text(inv.status.rawValue)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(invStatusColor(inv.status).opacity(0.15), in: Capsule())
                            .foregroundStyle(invStatusColor(inv.status))
                    }
                    .buttonStyle(.plain)
                } else {
                    Text(inv.status.rawValue)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(invStatusColor(inv.status).opacity(0.15), in: Capsule())
                        .foregroundStyle(invStatusColor(inv.status))
                }
            }
            if inv.status == .resulted || inv.status == .pending {
                TextField("Result / notes…",
                          text: Binding(
                            get: { inv.result },
                            set: { setInvResult(id: inv.id, result: $0) }
                          ),
                          axis: .vertical)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2...)
                    .padding(.leading, 28)
            }
            // Inline critical value badge and trend arrow
            if inv.status == .resulted && !inv.result.isEmpty {
                let singleLabs = LabPanel.parse(from: [inv])
                HStack(spacing: 6) {
                    if singleLabs.hasCriticalValues {
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 9, weight: .bold))
                            Text("CRITICAL VALUE")
                                .font(.system(size: 9, weight: .black))
                                .tracking(0.3)
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(Color.red, in: Capsule())
                    }
                    if let trend = labTrend(for: inv) {
                        HStack(spacing: 3) {
                            Text(trend.arrow)
                                .font(.system(size: 10, weight: .bold))
                            Text(trend.deltaText)
                                .font(.system(size: 10))
                        }
                        .foregroundStyle(trend.color)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(trend.color.opacity(0.12), in: Capsule())
                    }
                }
                .padding(.leading, 28)
            }
        }
        .padding(.vertical, 2)
    }

    private struct LabTrend {
        let arrow: String
        let deltaText: String
        let color: Color
    }

    private func parseFirstNumber(_ text: String) -> Double? {
        var numStr = ""
        var foundDigit = false
        for scalar in text.unicodeScalars {
            let c = Character(scalar)
            if c.isNumber { numStr.append(c); foundDigit = true }
            else if c == "." && foundDigit { numStr.append(c) }
            else if foundDigit { break }
        }
        return foundDigit ? Double(numStr) : nil
    }

    private func labTrend(for inv: InvestigationEntry) -> LabTrend? {
        guard inv.status == .resulted else { return nil }
        guard let cur = parseFirstNumber(inv.result) else { return nil }
        let prior = patient.investigations
            .filter {
                $0.status == .resulted &&
                $0.id != inv.id &&
                $0.name.lowercased() == inv.name.lowercased()
            }
            .sorted { ($0.resultedAt ?? $0.orderedAt) < ($1.resultedAt ?? $1.orderedAt) }
            .compactMap { parseFirstNumber($0.result) }
            .last
        guard let prev = prior else { return nil }
        let delta = cur - prev
        let pct = prev != 0 ? abs(delta / prev * 100) : 0
        let deltaText = String(format: "%.0f%%", pct)
        if abs(delta) < prev * 0.03 {
            return LabTrend(arrow: "→", deltaText: "stable", color: .secondary)
        } else if delta > 0 {
            return LabTrend(arrow: "↑", deltaText: "+\(deltaText)", color: .orange)
        } else {
            return LabTrend(arrow: "↓", deltaText: "-\(deltaText)", color: .blue)
        }
    }

    private func invStatusColor(_ status: InvestigationEntry.InvStatus) -> Color {
        switch status {
        case .suggested: return .secondary
        case .ordered:   return .blue
        case .pending:   return .orange
        case .resulted:  return .green
        case .cancelled: return .red
        }
    }

    private func addInvestigation(name: String, category: InvestigationEntry.InvCategory) {
        var list = patient.investigations
        list.append(InvestigationEntry(
            name: name, category: category, status: .ordered,
            suggestedFor: patient.chiefComplaint ?? ""
        ))
        patient.investigations = list; touch()
    }

    private func advanceInvStatus(_ inv: InvestigationEntry) {
        guard let next = inv.status.next else { return }
        var list = patient.investigations
        if let idx = list.firstIndex(where: { $0.id == inv.id }) {
            list[idx].status = next
            if next == .resulted { list[idx].resultedAt = Date() }
        }
        patient.investigations = list; touch()
        // Fire critical value alert when status just reached .resulted
        if next == .resulted {
            let labs = LabPanel.parse(from: list)
            if labs.hasCriticalValues {
                var parts: [String] = []
                if let hb = labs.haemoglobin, hb.value < 8   { parts.append("Hb \(String(format: "%.1f", hb.value)) g/dL") }
                if let pl = labs.platelets,  pl.value < 50   { parts.append("Plt \(Int(pl.value)) ×10⁹/L") }
                if let cr = labs.creatinine, cr.value > 300  { parts.append("Creatinine \(Int(cr.value)) µmol/L") }
                if let ir = labs.inr,        ir.value > 2.5  { parts.append("INR \(String(format: "%.1f", ir.value))") }
                if let na = labs.sodium, na.value < 120 || na.value > 155 { parts.append("Na \(Int(na.value)) mmol/L") }
                if let k  = labs.potassium,  k.value < 2.5 || k.value > 6.0  { parts.append("K \(String(format: "%.1f", k.value)) mmol/L") }
                if let la = labs.lactate,    la.value >= 4.0 { parts.append("Lactate \(String(format: "%.1f", la.value)) mmol/L") }
                if let tr = labs.troponin,   tr.value > 52   { parts.append("Troponin \(Int(tr.value)) ng/L") }
                if let ca = labs.calcium, ca.value < 1.75 || ca.value > 3.0 { parts.append("Ca \(String(format: "%.2f", ca.value)) mmol/L") }
                if let gl = labs.glucose,  gl.value < 3.0 || gl.value > 20.0 { parts.append("Glucose \(String(format: "%.1f", gl.value)) mmol/L") }
                criticalLabAlert = parts.isEmpty ? "Critical value detected — review results." : parts.joined(separator: "\n")
            }
        }
    }

    private func setInvResult(id: UUID, result: String) {
        var list = patient.investigations
        if let idx = list.firstIndex(where: { $0.id == id }) {
            list[idx].result = result
        }
        patient.investigations = list; touch()
    }

    // MARK: - History bypass card

    @ViewBuilder
    private func historyBypassCard(title: String, subtitle: String, onConfirm: @escaping () -> Void) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark.seal.fill")
                .foregroundStyle(.green).font(.title3)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Button("Confirm") { onConfirm() }
                .font(.caption.weight(.semibold))
                .foregroundStyle(AMColor.accent)
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(AMColor.accentLt, in: Capsule())
        }
        .padding(.vertical, 4)
    }

    // MARK: - Append chip list to a history field

    private func appendHistory(existing: String?, chips: Set<String>, write: (String) -> Void) {
        let lines = chips.sorted().map { "· \($0)" }.joined(separator: "\n")
        write((existing ?? "").isEmpty ? lines : (existing ?? "") + "\n" + lines)
    }

    // MARK: - Allergies tab

    private var allergiesTab: some View {
        List {
            // Quick-add common allergen chips
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(commonAllergenChips, id: \.name) { chip in
                        let added = patient.allergies.contains(where: { $0.name == chip.name })
                        Button {
                            guard !added else { return }
                            var list = patient.allergies
                            list.append(AllergyEntry(name: chip.name, severity: "Moderate",
                                                     reaction: chip.reaction))
                            patient.allergies = list; touch()
                        } label: {
                            HStack(spacing: 4) {
                                if added {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 9, weight: .bold))
                                }
                                Text(chip.name)
                                    .font(.system(size: 12, weight: added ? .semibold : .regular))
                            }
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(added ? Color.red.opacity(0.15) : Color.red.opacity(0.07),
                                        in: Capsule())
                            .foregroundStyle(added ? .red : .red.opacity(0.75))
                            .overlay(Capsule()
                                .stroke(added ? Color.red.opacity(0.35) : Color.clear, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .disabled(added)
                    }
                }
                .padding(.vertical, 4)

                Button {
                    let nkda = AllergyEntry(name: "NKDA", severity: "Mild", reaction: "None")
                    if !patient.allergies.contains(where: { $0.name == "NKDA" }) {
                        var list = patient.allergies; list.insert(nkda, at: 0)
                        patient.allergies = list; touch()
                    }
                } label: {
                    Label("Mark NKDA (No Known Drug Allergies)", systemImage: "checkmark.shield")
                        .font(.subheadline).foregroundStyle(.green)
                }
                .buttonStyle(.plain)
                .disabled(patient.allergies.contains(where: { $0.name == "NKDA" }))
            } header: {
                Label("Common Allergens", systemImage: "bolt.heart")
            }

            Section {
                if patient.allergies.isEmpty {
                    HStack {
                        Image(systemName: "checkmark.shield").foregroundStyle(.green)
                        Text("No known drug allergies (NKDA)").foregroundStyle(.secondary).font(.callout)
                    }
                } else {
                    ForEach(patient.allergies) { a in
                        HStack(spacing: 10) {
                            Circle().fill(severityColor(a.severity)).frame(width: 9, height: 9)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(a.name).font(.subheadline.weight(.semibold))
                                Text("\(a.severity) — \(a.reaction)").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    .onDelete { idx in
                        var list = patient.allergies; list.remove(atOffsets: idx)
                        patient.allergies = list; touch()
                    }
                }
                Button { showAddAllergy = true } label: {
                    Label("Add Allergy / Intolerance", systemImage: "plus.circle")
                }
                .foregroundStyle(.red)
            } header: {
                sectionHeader("Allergies & Intolerances", icon: "exclamationmark.shield",
                              filled: !patient.allergies.isEmpty, filledColor: .red)
            }

            if !interactions.isEmpty {
                Section {
                    ForEach(interactions) { alert in InteractionAlertRow(alert: alert) }
                } header: {
                    Label("Drug Interaction Alerts", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                }
            }
        }
    }

    // MARK: - Social tab

    private var socialTab: some View {
        List {
            // Smoking status — single choice
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(["Non-smoker", "Ex-smoker", "Light smoker (<10/day)",
                             "Moderate smoker (10–20/day)", "Heavy smoker (>20/day)"], id: \.self) { chip in
                        let key = "Smoking:\(chip)"
                        let done = selectedSocialChips.contains(key)
                        Button {
                            selectSingleSocialChip(prefix: "Smoking", value: chip, displayText: chip)
                        } label: {
                            socialChipLabel(chip, selected: done)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("Smoking", systemImage: "smoke")
            }

            // Alcohol — single choice
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(["Non-drinker", "Social drinker (<14 units/wk)",
                             "Moderate (14–21 units/wk)", "Heavy (>21 units/wk)"], id: \.self) { chip in
                        let key = "Alcohol:\(chip)"
                        let done = selectedSocialChips.contains(key)
                        Button {
                            selectSingleSocialChip(prefix: "Alcohol", value: chip, displayText: chip)
                        } label: {
                            socialChipLabel(chip, selected: done)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("Alcohol", systemImage: "wineglass")
            }

            // Living situation — single choice
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(["Lives alone", "Lives with partner", "Lives with family", "Care home resident"],
                            id: \.self) { chip in
                        let key = "Living:\(chip)"
                        let done = selectedSocialChips.contains(key)
                        Button {
                            selectSingleSocialChip(prefix: "Living", value: chip, displayText: chip)
                        } label: {
                            socialChipLabel(chip, selected: done)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("Living Situation", systemImage: "house")
            }

            // Occupation — single choice
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(["Retired", "Sedentary / desk work", "Manual labour", "Healthcare worker"],
                            id: \.self) { chip in
                        let key = "Occ:\(chip)"
                        let done = selectedSocialChips.contains(key)
                        Button {
                            selectSingleSocialChip(prefix: "Occ", value: chip, displayText: chip)
                        } label: {
                            socialChipLabel(chip, selected: done)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("Occupation", systemImage: "briefcase")
            }

            // Activity level — single choice
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(["Physically active (>150 min/wk)", "Sedentary lifestyle"], id: \.self) { chip in
                        let key = "Activity:\(chip)"
                        let done = selectedSocialChips.contains(key)
                        Button {
                            selectSingleSocialChip(prefix: "Activity", value: chip, displayText: chip)
                        } label: {
                            socialChipLabel(chip, selected: done)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("Activity Level", systemImage: "figure.walk")
            }

            // Free text notes
            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.socialHistory ?? "" },
                                            set: { patient.socialHistory = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 120)
                    if (patient.socialHistory ?? "").isEmpty {
                        Text("Additional notes — travel, diet, recreational drugs, functional status…")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Social History Notes", icon: "person.2.circle",
                              filled: !(patient.socialHistory ?? "").isEmpty)
            }
        }
    }

    // Shared chip label for the social tab (radio-select style)
    @ViewBuilder
    private func socialChipLabel(_ text: String, selected: Bool) -> some View {
        HStack(spacing: 4) {
            Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 11))
                .foregroundStyle(selected ? .green : .teal.opacity(0.5))
            Text(text)
                .font(.system(size: 12))
        }
        .padding(.horizontal, 10).padding(.vertical, 5)
        .background(selected ? Color.green.opacity(0.12) : AMColor.accentLt, in: Capsule())
        .foregroundStyle(selected ? .green : AMColor.accent)
    }

    // Selects one chip within a prefix group (radio behaviour).
    // Tapping the already-selected chip deselects it.
    private func selectSingleSocialChip(prefix: String, value: String, displayText: String) {
        let key = "\(prefix):\(value)"
        let isCurrentlySelected = selectedSocialChips.contains(key)

        // Remove all chips with this prefix from the in-memory set
        selectedSocialChips = selectedSocialChips.filter { !$0.hasPrefix("\(prefix):") }

        // Remove matching lines from stored social history
        var lines = (patient.socialHistory ?? "")
            .components(separatedBy: "\n")
            .filter { line in
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                    .trimmingCharacters(in: CharacterSet(charactersIn: "·").union(.whitespaces))
                return !trimmed.hasPrefix("\(prefix): ")
            }

        // If not deselecting, add the new selection
        if !isCurrentlySelected {
            selectedSocialChips.insert(key)
            lines.append("· \(prefix): \(displayText)")
        }

        let joined = lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        patient.socialHistory = joined.isEmpty ? nil : joined
        touch()
        recomputeRisk()
    }

    private func appendSocialChip(_ item: String) {
        let existing = (patient.socialHistory ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        patient.socialHistory = existing.isEmpty ? "· \(item)" : existing + "\n· \(item)"
        touch()
        recomputeRisk()
    }

    // MARK: - Exam tab

    private var examTab: some View {
        List {
            Section {
                HStack {
                    Picker("", selection: $examMode) {
                        Text("Short").tag(ExamMode.short)
                        Text("Full").tag(ExamMode.full)
                    }
                    .pickerStyle(.segmented)
                    Spacer(minLength: 12)
                    Button("All Normal") { markAllNormal() }
                        .font(.caption).foregroundStyle(AMColor.accent)
                }

                examField("General appearance",
                          text: Binding(get: { patient.examGeneral ?? "" },
                                        set: { patient.examGeneral = $0.isEmpty ? nil : $0; touch() }),
                          chips: ["Alert, no distress.", "Cachexic.", "Jaundiced.", "Pallor.", "Ankle oedema.", "Unwell."])
                examField("Cardiovascular",
                          text: Binding(get: { patient.examCVS ?? "" },
                                        set: { patient.examCVS = $0.isEmpty ? nil : $0; touch() }),
                          chips: primaryCVSChips)
                examField("Respiratory",
                          text: Binding(get: { patient.examResp ?? "" },
                                        set: { patient.examResp = $0.isEmpty ? nil : $0; touch() }),
                          chips: ["Clear to auscultation bilaterally.", "Reduced air entry.", "Fine crackles.", "Expiratory wheeze.", "Dull to percussion."])
                examField(primaryExamLabel,
                          text: Binding(get: { patient.examAbdo ?? "" },
                                        set: { patient.examAbdo = $0.isEmpty ? nil : $0; touch() }),
                          chips: primaryExamChips)

                if examMode == .full {
                    examField("Neurological", text: Binding(
                        get: { patient.examNeuro ?? "" },
                        set: { patient.examNeuro = $0.isEmpty ? nil : $0; touch() }))
                    examField("Musculoskeletal", text: Binding(
                        get: { patient.examMSK ?? "" },
                        set: { patient.examMSK = $0.isEmpty ? nil : $0; touch() }))
                    examField("Skin / Wound", text: Binding(
                        get: { patient.examSkin ?? "" },
                        set: { patient.examSkin = $0.isEmpty ? nil : $0; touch() }))
                }

                examField("Other / Additional findings", text: Binding(
                    get: { patient.examOther ?? "" },
                    set: { patient.examOther = $0.isEmpty ? nil : $0; touch() }))

                Button {
                    Task { await draftExam() }
                } label: {
                    HStack {
                        Label("AI Draft Examination", systemImage: "sparkles")
                        Spacer()
                        if ai.isGenerating { ProgressView() }
                    }
                }
                .disabled(ai.isGenerating)
                .foregroundStyle(.purple)
            } header: {
                sectionHeader("Physical Examination", icon: "stethoscope",
                              filled: !(patient.examGeneral ?? "").isEmpty || !(patient.examAbdo ?? "").isEmpty)
            }
        }
    }

    @ViewBuilder
    private func examField(_ label: String, text: Binding<String>, chips: [String] = []) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                TextField("Findings…", text: text, axis: .vertical).lineLimit(2...).font(.callout)
            }
            if !chips.isEmpty {
                ChipFlow(hSpacing: 6, vSpacing: 6) {
                    ForEach(chips, id: \.self) { chip in
                        Button {
                            let existing = text.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines)
                            text.wrappedValue = existing.isEmpty ? chip : existing + " " + chip
                        } label: {
                            Text(chip)
                                .font(.system(size: 11))
                                .padding(.horizontal, 8).padding(.vertical, 4)
                                .background(Color.secondary.opacity(0.1), in: Capsule())
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(.vertical, 2)
    }

    // MARK: - Pre-encounter questionnaire SOCRATES parser
    // Reads the structured KEY: value lines written by EncounterAnswers.hpiText
    // and converts them to the socratesSelections dictionary format so the
    // Bayesian engine and SOCRATES chips are pre-populated from front-desk data.
    // This is a one-time seed on .onAppear — the doctor can override chips freely.

    private func parseSocratesFromHPI(_ hpi: String) -> [String: Set<String>] {
        var result: [String: Set<String>] = [:]
        for line in hpi.components(separatedBy: "\n") {
            let parts = line.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            guard parts.count == 2 else { continue }
            let key = parts[0].lowercased()
            let val = parts[1]
            switch key {
            case "site":
                result["site"] = [val]
            case "onset":
                result["onset"] = [val]
            case "character":
                result["character"] = [val]
            case "radiation":
                if !val.lowercased().contains("none") { result["radiation"] = [val] }
            case "severity":
                result["severity"] = [val]
            case "timing":
                result["timing"] = [val]
            case "worse":
                result["exacerbating"] = Set(val.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) })
            case "better":
                result["relieving"] = Set(val.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) })
            case "associated":
                result["associations"] = Set(val.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) })
            default:
                break
            }
        }
        return result
    }

    // MARK: - PMH notes → chip pre-population
    // Maps structured CONDITIONS: line written by EncounterAnswers.pmhxText to the
    // pmhChips display labels so the PMH section is pre-selected on first open.
    // Handles label mismatches between PMHxCondition.rawValue and pmhChips (e.g.
    // "Diabetes mellitus" → both "T2DM" and "T1DM"; "Cancer (any)" → "Malignancy").

    private func parsePMHChipsFromNotes(_ notes: String) -> Set<String> {
        var matched = Set<String>()
        // Extract conditions from the structured "CONDITIONS: a, b, c" line
        let conditionLine: String? = notes.components(separatedBy: "\n").first(where: {
            $0.uppercased().hasPrefix("CONDITIONS:")
        }).map { String($0.dropFirst("CONDITIONS:".count)).trimmingCharacters(in: .whitespaces) }

        let conditions: [String]
        if let line = conditionLine {
            conditions = line.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        } else {
            // Fallback: scan all lines for any text that matches a known condition
            conditions = notes.components(separatedBy: "\n")
        }

        // Mapping rules: PMHxCondition.rawValue (or keywords) → pmhChips label
        let mapping: [(keywords: [String], chip: String)] = [
            (["Hypertension", "hypertension"],                     "Hypertension"),
            (["Diabetes mellitus", "T2DM", "Type 2"],              "T2DM"),
            (["Diabetes mellitus", "T1DM", "Type 1"],              "T1DM"),
            (["Heart disease", "IHD", "Ischaemic heart"],          "Ischaemic heart disease"),
            (["Atrial fibrillation", "AF", "atrial fibrillation"], "Atrial fibrillation"),
            (["Heart failure"],                                     "Heart failure"),
            (["Stroke", "TIA"],                                     "Stroke / TIA"),
            (["Chronic kidney disease", "CKD"],                    "CKD"),
            (["COPD", "Chronic obstructive"],                      "COPD"),
            (["Asthma"],                                           "Asthma"),
            (["Liver disease", "Cirrhosis"],                       "Liver disease / Cirrhosis"),
            (["Peptic ulcer"],                                     "Peptic ulcer disease"),
            (["GORD", "Reflux", "GERD"],                          "GORD / Reflux"),
            (["Inflammatory bowel", "IBD", "Crohn", "Colitis"],   "IBD (Crohn's / UC)"),
            (["Cancer", "Malignancy", "Tumour", "Tumor"],         "Malignancy"),
            (["Thyroid"],                                          "Thyroid disease"),
            (["OSA", "Sleep apn", "Obstructive sleep"],           "OSA"),
            (["DVT", "PE", "pulmonary embolism", "thrombosis"],   "DVT / PE"),
            (["Anaemia", "Anemia"],                               "Anaemia"),
            (["Epilepsy", "seizure"],                             "Epilepsy"),
            (["Depression", "Anxiety", "Mental health"],          "Depression / Anxiety"),
            (["Dementia", "Alzheimer"],                           "Dementia"),
            (["Osteoporosis"],                                    "Osteoporosis"),
            (["Rheumatoid arthritis", "Rheumatoid"],              "Rheumatoid arthritis"),
            (["Immunocompromised", "HIV", "AIDS"],                "Immunocompromised"),
        ]

        let lowerConditions = conditions.map { $0.lowercased() }
        for rule in mapping {
            if rule.keywords.contains(where: { kw in
                lowerConditions.contains(where: { $0.contains(kw.lowercased()) })
            }) {
                matched.insert(rule.chip)
            }
        }
        return matched
    }

    // MARK: - P9: surgicalHistory text → PSHx chip pre-population
    // Matches free-text surgical history (from questionnaire or typed notes) against
    // the pshxChips labels by keyword. Called on .onAppear — doctor can modify freely.

    private func parsePSHxChipsFromSurgicalHistory(_ text: String) -> Set<String> {
        let lower = text.lowercased()
        var matched = Set<String>()
        let mapping: [(keywords: [String], chip: String)] = [
            (["cholecystectomy", "gallbladder removal"],          "Cholecystectomy"),
            (["appendicectomy", "appendectomy"],                  "Appendicectomy"),
            (["inguinal hernia"],                                 "Inguinal hernia repair"),
            (["umbilical hernia"],                                 "Umbilical hernia repair"),
            (["bowel resection", "small bowel resection"],        "Bowel resection"),
            (["anterior resection", "low anterior"],              "Anterior resection"),
            (["apr", "abdominoperineal"],                         "APR"),
            (["hartmann"],                                        "Hartmann's procedure"),
            (["gastric bypass", "sleeve gastrectomy", "bariatric"], "Gastric bypass / sleeve"),
            (["fundoplication", "nissen"],                        "Fundoplication"),
            (["whipple", "pancreaticoduodenectomy"],              "Whipple's procedure"),
            (["liver resection", "hepatectomy"],                  "Liver resection"),
            (["splenectomy"],                                     "Splenectomy"),
            (["thyroidectomy"],                                   "Thyroidectomy"),
            (["parathyroidectomy"],                               "Parathyroidectomy"),
            (["mastectomy"],                                      "Mastectomy"),
            (["sentinel node", "sentinel lymph"],                 "Sentinel node biopsy"),
            (["laparotomy"],                                      "Laparotomy"),
            (["diagnostic laparoscopy"],                          "Diagnostic laparoscopy"),
            (["ercp"],                                            "ERCP"),
            (["ogd", "gastroscopy", "upper gi endoscopy"],       "OGD / Gastroscopy"),
            (["colonoscopy"],                                     "Colonoscopy"),
            (["haemorrhoidectomy", "hemorrhoidectomy"],           "Haemorrhoidectomy"),
            (["fistula", "fistulotomy", "perianal abscess"],      "Fistula / abscess repair"),
            (["caesarean", "cesarean", "c-section"],              "Caesarean section"),
            (["hysterectomy"],                                    "Hysterectomy"),
        ]
        for rule in mapping {
            if rule.keywords.contains(where: { lower.contains($0) }) {
                matched.insert(rule.chip)
            }
        }
        return matched
    }

    // MARK: - P8: socialHistory text → social chip pre-population
    // Rebuilds the selectedSocialChips set from the "· Key: Value" lines written by
    // appendSocialChip(). This restores the chip state so SurgicalRiskEngine receives
    // the correct smoking/alcohol/lifestyle signals on every ConsultationView open.

    private func parseSocialChipsFromHistory(_ text: String) -> Set<String> {
        var chips = Set<String>()
        let lines = text.components(separatedBy: "\n").map {
            $0.trimmingCharacters(in: .whitespaces).trimmingCharacters(in: CharacterSet(charactersIn: "·").union(.whitespaces))
        }
        let smokingOptions  = ["Non-smoker", "Ex-smoker", "Light smoker (<10/day)",
                               "Moderate smoker (10–20/day)", "Heavy smoker (>20/day)"]
        let alcoholOptions  = ["Non-drinker", "Social drinker (<14 units/wk)",
                               "Moderate (14–21 units/wk)", "Heavy (>21 units/wk)"]
        let livingOptions   = ["Lives alone", "Lives with partner", "Lives with family", "Care home resident"]
        let occOptions      = ["Retired", "Sedentary / desk work", "Manual labour", "Healthcare worker"]
        let activityOptions = ["Physically active (>150 min/wk)", "Sedentary lifestyle"]

        for line in lines where !line.isEmpty {
            if line.hasPrefix("Smoking: ") {
                let val = String(line.dropFirst("Smoking: ".count))
                if smokingOptions.contains(val) { chips.insert("Smoking:\(val)") }
            } else if line.hasPrefix("Alcohol: ") {
                let val = String(line.dropFirst("Alcohol: ".count))
                if alcoholOptions.contains(val) { chips.insert("Alcohol:\(val)") }
            } else if line.hasPrefix("Living: ") {
                let val = String(line.dropFirst("Living: ".count))
                if livingOptions.contains(val) { chips.insert("Living:\(val)") }
            } else if line.hasPrefix("Occ: ") {
                let val = String(line.dropFirst("Occ: ".count))
                if occOptions.contains(val) { chips.insert("Occ:\(val)") }
            } else if line.hasPrefix("Activity: ") {
                let val = String(line.dropFirst("Activity: ".count))
                if activityOptions.contains(val) { chips.insert("Activity:\(val)") }
            } else {
                // Free text or legacy unkeyed entries
                chips.insert(line)
            }
        }
        return chips
    }

    // MARK: - Bayesian engine refresh
    // Augments SOCRATES selections with clinical features extracted from free text
    // (HPI, exam findings, notes) so the engine fires from any typed data, not
    // only structured chip selections.

    private func refreshBayesian() {
        // Concatenate resulted investigation findings so the clinical text parser
        // can detect critical patterns in imaging/lab reports (e.g. "pneumoperitoneum",
        // "ruptured", "free gas") and raise appropriate clinical alarms.
        let invResultsText = patient.investigations
            .filter { $0.status == .resulted && !$0.result.isEmpty }
            .map { "\($0.name): \($0.result)" }
            .joined(separator: ". ")
        let examOtherText = [patient.examCVS, patient.examResp, patient.examNeuro,
                             patient.examMSK, patient.examSkin, patient.examOther]
            .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
        let parsed = ClinicalTextParser.parse(
            hpi: patient.hpi,
            examGeneral: patient.examGeneral,
            examAbdo: patient.examAbdo,
            examOther: examOtherText.isEmpty ? nil : examOtherText,
            notes: invResultsText.isEmpty ? nil : invResultsText
        )

        // Merge parser-extracted features into the chip-selection dict
        var augmented = socratesSelections
        for (dim, chips) in parsed.featureAugments {
            augmented[dim, default: []].formUnion(chips)
        }

        // Offer a CC hint only when no CC is set yet
        if (patient.chiefComplaint ?? "").isEmpty, let hint = parsed.ccHint {
            patient.chiefComplaint = hint
        }

        let latestVitals = patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
        bayesianDx = BayesianDiagnosisEngine.infer(
            chiefComplaint: patient.chiefComplaint,
            socratesSelections: augmented,
            pmhNotes: patient.pmhNotes,
            surgicalHistory: patient.surgicalHistory,
            examAbdo: patient.examAbdo,
            examGeneral: patient.examGeneral,
            examCVS: patient.examCVS,
            examResp: patient.examResp,
            examNeuro: patient.examNeuro,
            examMSK: patient.examMSK,
            examSkin: patient.examSkin,
            examOther: patient.examOther,
            investigations: patient.investigations,
            ageYears: patient.ageYears,
            sex: patient.sex,
            longitudinal: patient.longitudinalContext,
            latestHR: latestVitals?.heartRate,
            latestSBP: latestVitals?.bpSystolic,
            latestTemp: latestVitals?.temperatureCelsius,
            latestSpO2: latestVitals?.spo2,
            latestRR: latestVitals?.respiratoryRate,
            news2Score: latestVitals.flatMap { $0.hasAnyValue ? $0.news2Score : nil },
            specialtyHint: selectedSpecialtyHint
        )

        // Update alarm list (keep dismissed state across refreshes)
        clinicalAlarms = parsed.clinicalAlarms
    }

    // MARK: - Diagnosis tab

    private var diagnosisTab: some View {
        List {
            if !bayesianDx.isEmpty {
                Section {
                    ForEach(bayesianDx) { result in
                        BayesianDxRow(result: result) {
                            patient.workingDiagnosis = result.name
                            patient.workingDiagnosisICD = result.icdCode
                            touch()
                            icdQuery = "\(result.icdCode) \(result.name)"
                            icdSuggestions = []
                        }
                    }
                } header: {
                    HStack(spacing: 6) {
                        Image(systemName: "brain.head.profile").foregroundStyle(.purple)
                        Text("Suggested Differentials")
                            .font(.caption.weight(.semibold))
                        Spacer()
                        Button {
                            refreshBayesian()
                        } label: {
                            Image(systemName: "arrow.clockwise")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                } footer: {
                    Text("Based on CC · SOCRATES · PMH · Exam · Ix · Age/Sex. Apply to confirm.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            // ── AutoFunction Action Panel ──────────────────────────────────
            let visibleActions = pipeline.filteredAutoActions(for: patient.visitType)
            if !visibleActions.isEmpty {
                Section {
                    ForEach(visibleActions.prefix(6)) { action in
                        AutoActionRow(action: action)
                    }
                } header: {
                    HStack(spacing: 6) {
                        Image(systemName: "wand.and.sparkles").foregroundStyle(.indigo)
                        Text("Clinical Actions")
                            .font(.caption.weight(.semibold))
                        Spacer()
                        if pipeline.isRunning {
                            ProgressView().scaleEffect(0.7)
                        }
                    }
                } footer: {
                    Text("Deterministic pipeline — SOCRATES · Exam · Ix · Vitals trend · Decision network.")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }

            // ── DBN Trajectory Panel ───────────────────────────────────────
            if !pipeline.trajectories.isEmpty {
                Section {
                    ForEach(pipeline.trajectories) { traj in
                        TrajectoryRow(trajectory: traj)
                    }
                } header: {
                    HStack(spacing: 6) {
                        Image(systemName: "chart.line.uptrend.xyaxis").foregroundStyle(.orange)
                        Text("Disease Trajectories (12h projection)")
                            .font(.caption.weight(.semibold))
                    }
                }
            }

            // ── Value of Information Panel ─────────────────────────────────
            if !pipeline.informationItems.isEmpty {
                Section {
                    ForEach(Array(pipeline.informationItems.prefix(5))) { item in
                        VOIRow(item: item,
                               alreadyResulted: patient.investigations.contains {
                                   $0.status == .resulted &&
                                   $0.name.lowercased().contains(item.name.lowercased())
                               })
                    }
                } header: {
                    HStack(spacing: 6) {
                        Image(systemName: "lightbulb.min").foregroundStyle(.yellow)
                        Text("Highest-Value Next Investigations (EVPI)")
                            .font(.caption.weight(.semibold))
                    }
                } footer: {
                    Text("Expected value of perfect information — ranked by bits of diagnostic uncertainty resolved.")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }

            Section {
                HStack {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                    TextField("Search ICD-10 codes or diagnosis", text: $icdQuery)
                        .autocorrectionDisabled()
                        .onChange(of: icdQuery) { _, q in
                            icdSuggestions = q.count >= 2 ? ClinicalSearchService.searchICD(q) : []
                        }
                    if !icdQuery.isEmpty {
                        Button { icdQuery = ""; icdSuggestions = [] } label: {
                            Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                        }
                    }
                }

                ForEach(icdSuggestions.prefix(6)) { icd in
                    Button {
                        patient.workingDiagnosis = icd.description
                        patient.workingDiagnosisICD = icd.code
                        touch()
                        icdQuery = "\(icd.code) \(icd.description)"
                        icdSuggestions = []
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(icd.description).font(.subheadline).foregroundStyle(.primary)
                                Text(icd.code).font(.caption.monospaced()).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(icd.category).font(.caption2).foregroundStyle(.tertiary)
                        }
                    }
                }

                if let dx = patient.workingDiagnosis {
                    HStack {
                        Image(systemName: "stethoscope").foregroundStyle(AMColor.accent)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(dx).font(.subheadline.weight(.medium))
                            if let icd = patient.workingDiagnosisICD {
                                Text(icd).font(.caption.monospaced()).foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        Button("Clear") {
                            patient.workingDiagnosis = nil; patient.workingDiagnosisICD = nil
                            touch(); icdQuery = ""
                        }.font(.caption).foregroundStyle(.red)
                    }
                    Label("Radiates to: Notes · Prescriptions · Billing",
                          systemImage: "arrow.triangle.branch")
                        .font(.caption).foregroundStyle(AMColor.accent)
                }
            } header: {
                sectionHeader("Working Diagnosis", icon: "stethoscope",
                              filled: patient.workingDiagnosis != nil)
            }
        }
    }

    // MARK: - Plan tab

    private var radiationResult: DiagnosisRadiation? {
        DiagnosisRadiationEngine.radiate(
            workingDiagnosis: patient.workingDiagnosis,
            ageYears: patient.ageYears,
            sex: patient.sex
        )
    }

    private var planTab: some View {
        List {
            // Diagnosis radiation card — shown when a working Dx is set and dismissed flag is clear
            if let radiation = radiationResult, !dismissedRadiation {
                DiagnosisRadiationCard(
                    radiation: radiation,
                    onAddInvestigation: { inv in
                        let entry = InvestigationEntry(
                            name: inv.name, category: inv.category,
                            status: .suggested, suggestedFor: radiation.conditionName
                        )
                        patient.investigations.append(entry)
                        touch()
                    },
                    onUsePlan: { planText in
                        if (patient.managementPlan ?? "").isEmpty {
                            patient.managementPlan = planText; touch()
                        }
                        dismissedRadiation = true
                    },
                    onDismiss: { dismissedRadiation = true },
                    patientAge: computedAge(from: patient.dateOfBirth),
                    alreadyOrderedNames: Set(patient.investigations
                        .filter { $0.status != .cancelled }
                        .map { $0.name })
                )
            }

            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.managementPlan ?? "" },
                                            set: { patient.managementPlan = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 160)
                        .medicalDictation(mode: .plan, patient: patient,
                                          text: Binding(get: { patient.managementPlan ?? "" },
                                                        set: { patient.managementPlan = $0.isEmpty ? nil : $0; touch() }))
                    if (patient.managementPlan ?? "").isEmpty {
                        Text("Investigations · Referrals · Prescriptions · Follow-up plan · Red flag advice…")
                            .foregroundStyle(.tertiary).font(.callout)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Assessment & Management Plan", icon: "doc.text.magnifyingglass",
                              filled: !(patient.managementPlan ?? "").isEmpty)
            }

            Section {
                Button {
                    Task { await draftPlan() }
                } label: {
                    HStack {
                        Label("AI Draft Plan", systemImage: "sparkles")
                        Spacer()
                        if ai.isGenerating { ProgressView() }
                    }
                }
                .disabled(ai.isGenerating)
                .foregroundStyle(.purple)

                Button {
                    Task { await generateLetter() }
                } label: {
                    HStack {
                        Label("Generate Consultation Letter", systemImage: "envelope.badge.shield.half.filled")
                        Spacer()
                        if ai.isGenerating { ProgressView().scaleEffect(0.8) }
                    }
                }
                .disabled(ai.isGenerating)
                .foregroundStyle(.teal)

                Button {
                    consultationPDFWrapper = exportConsultationPDF()
                } label: {
                    Label("Export as PDF", systemImage: "square.and.arrow.up")
                }
                .foregroundStyle(.blue)
            }
        }
    }

    // MARK: - Pathway result (shown inline in CC tab)

    @ViewBuilder
    private func pathwayResult(_ result: TriageResult) -> some View {
        Section {
            HStack {
                AcuityPip(acuity: result.suggestedAcuity)
                Text(result.suggestedAcuity.label).font(.subheadline.weight(.semibold))
                Spacer()
                Text("Confidence \(result.confidencePercent)%").font(.caption).foregroundStyle(.secondary)
            }

            if !result.differentials.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Differentials").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    ForEach(Array(result.differentials.prefix(5).enumerated()), id: \.offset) { i, dx in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 6) {
                                Text(dx.name)
                                    .font(.caption.weight(i == 0 ? .semibold : .regular))
                                    .foregroundStyle(i == 0 ? .primary : .secondary)
                                Spacer()
                                Text("\(dx.probability)%")
                                    .font(.caption2.weight(.medium).monospacedDigit())
                                    .foregroundStyle(i == 0 ? AMColor.accent : .secondary)
                                if patient.workingDiagnosis != dx.name {
                                    Button("Use") {
                                        patient.workingDiagnosis = dx.name
                                        patient.workingDiagnosisICD = nil
                                        touch()
                                        activeTab = .diagnosis
                                    }
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(AMColor.accent)
                                } else {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.green).font(.caption2)
                                }
                            }
                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    Capsule()
                                        .fill(.secondary.opacity(0.12))
                                        .frame(height: 4)
                                    Capsule()
                                        .fill(i == 0 ? AMColor.accent : Color.secondary.opacity(0.35))
                                        .frame(width: geo.size.width * CGFloat(dx.probability) / 100,
                                               height: 4)
                                }
                            }
                            .frame(height: 4)
                        }
                    }
                }
            }

            if !result.redFlags.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Red Flags", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption.weight(.semibold)).foregroundStyle(.red)
                    ForEach(result.redFlags, id: \.self) { Text("• \($0)").font(.caption).foregroundStyle(.red) }
                }
            }
        } header: {
            Label("Pathway: \(result.pathway)", systemImage: "waveform.path.ecg.rectangle")
        }
    }

    // MARK: - Add Allergy sheet

    @ViewBuilder
    private var addAllergySheet: some View {
        NavigationStack {
            Form {
                Section("Allergen / Drug") {
                    TextField("e.g. Penicillin, Latex, Contrast, NSAIDs", text: $newAllergyName)
                        .autocorrectionDisabled()
                }
                Section("Severity") {
                    Picker("Severity", selection: $newAllergySeverity) {
                        ForEach(["Mild", "Moderate", "Severe"], id: \.self) { Text($0).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
                Section("Reaction / Symptom") {
                    TextField("e.g. Rash, Urticaria, Anaphylaxis, GI upset", text: $newAllergyReaction)
                }
            }
            .navigationTitle("Add Allergy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { resetAllergyForm(); showAddAllergy = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        var list = patient.allergies
                        list.append(AllergyEntry(
                            name: newAllergyName.trimmingCharacters(in: .whitespaces),
                            severity: newAllergySeverity,
                            reaction: newAllergyReaction.trimmingCharacters(in: .whitespaces)
                        ))
                        patient.allergies = list; touch()
                        resetAllergyForm(); showAddAllergy = false
                    }
                    .bold()
                    .disabled(newAllergyName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    // MARK: - Shared section header

    @ViewBuilder
    private func sectionHeader(
        _ title: String, icon: String, filled: Bool, filledColor: Color = .teal
    ) -> some View {
        HStack(spacing: 6) {
            Label(title, systemImage: icon)
            Spacer()
            if filled {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(filledColor).font(.caption)
            }
        }
    }

    // MARK: - Medication history helpers

    private func addMedicationEntry(name: String, dose: String, route: String, freq: String) {
        let rx = Prescription(drug: name, dose: dose, route: route, frequency: freq)
        rx.patient = patient
        context.insert(rx)
        touch()
        recomputeRisk()
    }

    @MainActor
    private func suggestMedicationsForDiagnosis() async {
        let dx = (patient.workingDiagnosis ?? patient.chiefComplaint ?? "").lowercased()
        guard !dx.isEmpty else { return }
        isSuggestingMeds = true
        defer { isSuggestingMeds = false }
        // Local evidence-based suggestion lookup keyed on diagnosis/complaint keywords
        if dx.contains("cholecystit") || dx.contains("biliary") {
            aiMedSuggestions = ["Morphine (analgesia)", "Cefuroxime", "Metronidazole", "Ketorolac", "Omeprazole"]
        } else if dx.contains("appendic") {
            aiMedSuggestions = ["Cefuroxime", "Metronidazole", "Morphine (analgesia)", "IV Fluids (1L N/S stat)"]
        } else if dx.contains("pancreatit") {
            aiMedSuggestions = ["IV Fluids (aggressive)", "Morphine (analgesia)", "Omeprazole", "Thiamine (if alcohol-related)"]
        } else if dx.contains("hernia") {
            aiMedSuggestions = ["Morphine / Paracetamol (post-op analgesia)", "NSAIDs", "Stool softener (lactulose)"]
        } else if dx.contains("haemorrhoid") || dx.contains("hemorrhoid") || dx.contains("rectal") {
            aiMedSuggestions = ["Lactulose / Movicol", "Sitz baths", "Hydrocortisone suppositories", "Topical anaesthetic"]
        } else if dx.contains("obstruction") {
            aiMedSuggestions = ["IV Fluids", "NGT decompression", "Broad-spectrum antibiotics", "Morphine (analgesia)"]
        } else if dx.contains("perforation") || dx.contains("peritonitis") {
            aiMedSuggestions = ["Cefuroxime + Metronidazole", "IV Fluids (resuscitation)", "Morphine (analgesia)", "NGT"]
        } else if dx.contains("reflux") || dx.contains("gord") || dx.contains("gerd") {
            aiMedSuggestions = ["Omeprazole 20mg OD", "Gaviscon (alginate)", "Dietary modifications"]
        } else {
            aiMedSuggestions = ["IV Fluids", "Analgesia (paracetamol / morphine)", "Antiemetic (ondansetron)", "Proton pump inhibitor"]
        }
    }

    // MARK: - Helpers

    private func touch() { patient.updatedAt = .now; patient.pendingSync = true }

    private func computedAge(from dob: Date?) -> Int? {
        guard let dob else { return nil }
        return Calendar.current.dateComponents([.year], from: dob, to: .now).year
    }

    private func resetAllergyForm() {
        newAllergyName = ""; newAllergySeverity = "Moderate"; newAllergyReaction = ""
    }

    private func severityColor(_ s: String) -> Color {
        switch s {
        case "Severe":   return .red
        case "Moderate": return .orange
        default:         return .yellow
        }
    }


    private func markAllNormal() {
        if (patient.examGeneral ?? "").isEmpty { patient.examGeneral = "Alert and oriented. No acute distress." }
        if (patient.examCVS ?? "").isEmpty    { patient.examCVS = "Regular rate and rhythm. No murmurs." }
        if (patient.examResp ?? "").isEmpty   { patient.examResp = "Clear to auscultation bilaterally." }
        if (patient.examAbdo ?? "").isEmpty   { patient.examAbdo = "Soft, non-tender, non-distended. No organomegaly." }
        touch()
    }

    private func runPathway() {
        isAssessing = true
        let result = ClinicalPathwayEngine.assess(
            chiefComplaint: patient.chiefComplaint ?? "",
            pmh: patient.pmhNotes ?? ""
        )
        triageResult = result
        if result.suggestedAcuity < patient.acuity { patient.acuity = result.suggestedAcuity; touch() }
        isAssessing = false
    }

    private func draftHPI() async {
        let draft = SOAPDraftEngine.draft(patient: patient)
        guard !draft.s.isEmpty else { showAIError = true; return }
        patient.hpi = draft.s
        touch()
    }

    private func draftExam() async {
        // Fill only blank fields with standard findings; preserve any existing documentation
        if (patient.examGeneral ?? "").isEmpty {
            patient.examGeneral = "Alert and oriented. No acute distress. Afebrile."
        }
        if (patient.examCVS ?? "").isEmpty {
            patient.examCVS = "Regular rate and rhythm. No murmurs. Peripheral pulses present and equal."
        }
        if (patient.examResp ?? "").isEmpty {
            patient.examResp = "Clear to auscultation bilaterally. No wheeze or crackles."
        }
        if (patient.examAbdo ?? "").isEmpty {
            patient.examAbdo = "Soft, non-distended. Bowel sounds present. No guarding or rigidity."
        }
        touch()
    }

    private func draftPlan() async {
        let soap = SOAPDraftEngine.draft(patient: patient)
        let hasContent = !soap.a.isEmpty || !soap.p.isEmpty
        guard hasContent else { showAIError = true; return }
        let parts = [soap.a.isEmpty ? nil : "Assessment: \(soap.a)",
                     soap.p.isEmpty ? nil : "Plan: \(soap.p)"]
            .compactMap { $0 }
        patient.managementPlan = parts.joined(separator: "\n\n")
        touch()
    }

    private func generateLetter() async {
        let df = DateFormatter()
        df.dateStyle = .long; df.timeStyle = .none
        df.timeZone = TimeZone(identifier: "America/St_Lucia")

        var lines: [String] = []
        lines.append("Amise Medical Services")
        lines.append("Dr Dawit Daniel Kabiye  MD · DM")
        lines.append("General & Endoscopic Surgery, Saint Lucia")
        lines.append("")
        lines.append(df.string(from: .now))
        lines.append("")
        if let ref = patient.referringDoctor, !ref.isEmpty {
            let lastName = ref.split(separator: " ").last.map(String.init) ?? ref
            lines.append("Dear Dr \(lastName),")
        } else {
            lines.append("Dear Colleague,")
        }
        lines.append("")
        lines.append("RE: \(patient.fullName)"
            + (patient.dateOfBirth.map { "  ·  DOB \(df.string(from: $0))" } ?? "")
            + (patient.mrn.map { "  ·  MRN \($0)" } ?? ""))
        lines.append("")
        lines.append("Thank you for referring the above patient, a \(patient.ageDisplay.map { "\($0) " } ?? "")\(patient.sex.rawValue.lowercased()), whom I had the pleasure of seeing in outpatient consultation today.")
        lines.append("")
        if let cc = patient.chiefComplaint, !cc.isEmpty {
            lines.append("PRESENTING COMPLAINT"); lines.append(cc); lines.append("")
        }
        if let hpi = patient.hpi, !hpi.isEmpty {
            lines.append("HISTORY"); lines.append(hpi); lines.append("")
        }
        var examParts: [String] = []
        if let g = patient.examGeneral, !g.isEmpty { examParts.append("General: \(g)") }
        if let a = patient.examAbdo,    !a.isEmpty { examParts.append("Abdomen: \(a)") }
        if let c = patient.examCVS,     !c.isEmpty { examParts.append("CVS: \(c)") }
        if !examParts.isEmpty {
            lines.append("EXAMINATION"); lines.append(examParts.joined(separator: "\n")); lines.append("")
        }
        if let dx = patient.workingDiagnosis, !dx.isEmpty {
            lines.append("IMPRESSION")
            lines.append(dx + (patient.workingDiagnosisICD.map { " [\($0)]" } ?? ""))
            lines.append("")
        }
        if let plan = patient.managementPlan, !plan.isEmpty {
            lines.append("MANAGEMENT PLAN"); lines.append(plan); lines.append("")
        }
        lines.append("I will continue to follow this patient and will keep you informed of their progress. Please do not hesitate to contact me should you require any further information.")
        lines.append("")
        lines.append("Yours sincerely,")
        lines.append("")
        lines.append("Dr Dawit Daniel Kabiye  MD · DM")
        lines.append("Consultant General & Endoscopic Surgeon")
        lines.append("Amise Medical Services, Saint Lucia")

        generatedLetterText = lines.joined(separator: "\n")
        showLetterSheet = true
    }

    private func exportConsultationPDF() -> PDFDataWrapper? {
        let pageW: CGFloat = 595.2
        let pageH: CGFloat = 841.8
        let margin: CGFloat = 48
        let bodyW = pageW - margin * 2

        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pageW, height: pageH))
        let data = renderer.pdfData { ctx in
            let para = NSMutableParagraphStyle(); para.lineSpacing = 2

            let titleAttrs:  [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 14, weight: .bold),    .paragraphStyle: para]
            let headingAttrs:[NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 11, weight: .semibold), .paragraphStyle: para]
            let bodyAttrs:   [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 10),                    .paragraphStyle: para]
            let mutedAttrs:  [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 8),  .foregroundColor: UIColor.secondaryLabel, .paragraphStyle: para]

            func draw(_ s: String, attrs: [NSAttributedString.Key: Any], x: CGFloat, y: inout CGFloat, width: CGFloat) {
                guard !s.isEmpty else { return }
                let ns = NSAttributedString(string: s, attributes: attrs)
                let rect = ns.boundingRect(with: CGSize(width: width, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin], context: nil)
                if y + rect.height > pageH - margin {
                    ctx.beginPage(); y = margin
                }
                ns.draw(in: CGRect(x: x, y: y, width: width, height: rect.height))
                y += rect.height + 3
            }

            func section(_ title: String, body: String, y: inout CGFloat) {
                guard !body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
                y += 6
                draw(title.uppercased(), attrs: headingAttrs, x: margin, y: &y, width: bodyW)
                UIColor.separator.setFill()
                UIRectFill(CGRect(x: margin, y: y, width: bodyW, height: 0.5))
                y += 4
                draw(body, attrs: bodyAttrs, x: margin, y: &y, width: bodyW)
            }

            ctx.beginPage()
            var y: CGFloat = margin

            // Header
            let dob = patient.dateOfBirth.map { DateFormatter.localizedString(from: $0, dateStyle: .medium, timeStyle: .none) } ?? "DOB unknown"
            let ageStr = computedAge(from: patient.dateOfBirth).map { ", \($0)y" } ?? ""
            draw("CONSULTATION REPORT — \(patient.fullName.uppercased())", attrs: titleAttrs, x: margin, y: &y, width: bodyW)
            draw("\(patient.sex.rawValue)  ·  \(dob)\(ageStr)  ·  \(DateFormatter.localizedString(from: .now, dateStyle: .long, timeStyle: .short))",
                 attrs: mutedAttrs, x: margin, y: &y, width: bodyW)
            y += 4
            UIColor.separator.setFill(); UIRectFill(CGRect(x: margin, y: y, width: bodyW, height: 1)); y += 10

            // Clinical sections
            if let cc = patient.chiefComplaint { section("Presenting Complaint", body: cc, y: &y) }
            if let hpi = patient.hpi { section("History of Presenting Illness", body: hpi, y: &y) }
            section("Allergies", body: allergySummary(), y: &y)

            let med = medicationSummary()
            if !med.isEmpty { section("Current Medications", body: med.replacingOccurrences(of: "Medications: ", with: ""), y: &y) }

            if let pmh = patient.pmhNotes { section("Past Medical History", body: pmh, y: &y) }
            if let psh = patient.surgicalHistory { section("Past Surgical History", body: psh, y: &y) }
            if let fh = patient.familyHistoryNotes { section("Family History", body: fh, y: &y) }
            if let sh = patient.socialHistory { section("Social History", body: sh, y: &y) }

            let exam = examSummary()
            if !exam.isEmpty { section("Examination Findings", body: exam, y: &y) }

            // Investigations
            let invs = patient.investigations.filter { $0.status != .suggested }
            if !invs.isEmpty {
                section("Investigations", body: invs.map { "• \($0.name): \($0.result.isEmpty ? "Pending" : $0.result)" }.joined(separator: "\n"), y: &y)
            }

            // Diagnosis
            if let dx = patient.workingDiagnosis {
                let icd = patient.workingDiagnosisICD.map { " (\($0))" } ?? ""
                section("Working Diagnosis", body: "\(dx)\(icd)", y: &y)
            }

            if let plan = patient.managementPlan { section("Management Plan", body: plan, y: &y) }

            // Footer on last page
            y = pageH - margin
            draw("AMISE MEDICAL SERVICES · SAINT LUCIA · Generated \(DateFormatter.localizedString(from: .now, dateStyle: .medium, timeStyle: .short))",
                 attrs: mutedAttrs, x: margin, y: &y, width: bodyW)
        }

        // Also archive a record in Notes
        let note = ClinicalNote(noteType: .soap, patient: patient)
        let parts: [String] = [
            patient.chiefComplaint.map { "CC: \($0)" },
            patient.hpi.map { "HPI:\n\($0)" },
            patient.workingDiagnosis.map { "Diagnosis: \($0)" },
            patient.managementPlan.map { "Plan:\n\($0)" },
        ].compactMap { $0 }
        note.freeText = parts.joined(separator: "\n\n")
        context.insert(note); touch()
        return PDFDataWrapper(data: data)
    }

    private func allergySummary() -> String {
        let list = patient.allergies
        guard !list.isEmpty else { return "Allergies: NKDA" }
        return "Allergies: " + list.map { "\($0.name) [\($0.severity)]" }.joined(separator: ", ")
    }

    private func medicationSummary() -> String {
        let rxs = patient.prescriptions
        guard !rxs.isEmpty else { return "" }
        return "Medications: " + rxs.map { $0.displayLine }.joined(separator: "; ")
    }

    private func examSummary() -> String {
        [patient.examGeneral, patient.examCVS, patient.examResp, patient.examAbdo,
         patient.examNeuro, patient.examMSK, patient.examSkin, patient.examOther]
            .compactMap { $0 }.joined(separator: "\n")
    }

    // MARK: - Encounter History Tab

    private var encounterHistoryTab: some View {
        let sorted = patient.encounters
            .filter(\.isComplete)
            .sorted { $0.encounterDate > $1.encounterDate }
        return Group {
            if sorted.isEmpty {
                ContentUnavailableView(
                    "No Saved Visits",
                    systemImage: "clock.badge.questionmark",
                    description: Text("Tap \"Save Visit\" to snapshot the current consultation into history.")
                )
            } else {
                List {
                    ForEach(sorted, id: \.id) { enc in
                        Button { selectedEncounter = enc } label: {
                            EncounterHistoryRow(encounter: enc)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .listStyle(.insetGrouped)
                .sheet(item: $selectedEncounter) { enc in
                    EncounterDetailSheet(encounter: enc)
                }
            }
        }
    }
}

// MARK: - Drug interaction row

private struct InteractionAlertRow: View {
    let alert: DrugInteractionAlert
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: alert.interaction.severity.icon)
                    .foregroundStyle(alert.interaction.severity.color)
                Text("\(alert.drugA) + \(alert.drugB)").font(.caption.weight(.semibold))
            }
            Text(alert.interaction.mechanism).font(.caption).foregroundStyle(.secondary)
            Text("→ \(alert.interaction.management)").font(.caption2).foregroundStyle(.orange)
        }
    }
}

// MARK: - Add Medication sheet

private struct AddMedicationSheet: View {
    @Bindable var patient: Patient
    let context: ModelContext
    @Environment(\.dismiss) private var dismiss

    @State private var drugQuery = ""
    @State private var suggestions: [SurgicalDrug] = []
    @State private var selectedDrug: SurgicalDrug?
    @State private var dose = ""
    @State private var route = "Oral"
    @State private var frequency = "Once daily"
    @State private var duration = "7 days"
    @State private var indication = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                        TextField("Drug name", text: $drugQuery)
                            .autocorrectionDisabled()
                            .onChange(of: drugQuery) { _, q in
                                suggestions = q.count >= 2 ? ClinicalSearchService.searchDrugs(q) : []
                            }
                        if !drugQuery.isEmpty {
                            Button { drugQuery = ""; suggestions = [] }
                                label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                        }
                    }
                    ForEach(suggestions.prefix(6)) { drug in
                        Button {
                            selectedDrug = drug; drugQuery = drug.name
                            dose = drug.commonDoses; indication = patient.workingDiagnosis ?? ""
                            suggestions = []
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(drug.name).foregroundStyle(.primary).font(.subheadline)
                                Text(drug.commonDoses).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                } header: { Label("Search Formulary", systemImage: "magnifyingglass") }

                if selectedDrug != nil {
                    Section("Dose & Route") {
                        TextField("Dose", text: $dose)
                        Picker("Route", selection: $route) {
                            ForEach(["Oral", "IV", "IM", "SC", "Topical", "Inhaled", "PR", "SL"],
                                    id: \.self) { Text($0).tag($0) }
                        }
                        TextField("Frequency", text: $frequency)
                        TextField("Duration", text: $duration)
                        TextField("Indication", text: $indication)
                    }
                }
            }
            .navigationTitle("Add Medication")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        guard let drug = selectedDrug else { return }
                        let rx = Prescription(drug: drug.name, dose: dose, route: route,
                                              frequency: frequency, duration: duration, indication: indication)
                        rx.patient = patient
                        context.insert(rx)
                        patient.updatedAt = .now; patient.pendingSync = true
                        dismiss()
                    }
                    .bold()
                    .disabled(selectedDrug == nil || dose.isEmpty)
                }
            }
        }
    }
}

// MARK: - Bayesian differential row

private struct BayesianDxRow: View {
    let result: BayesianDiagnosisEngine.DiagnosisResult
    let onApply: () -> Void

    private var barColor: Color {
        switch result.probability {
        case 55...: return .green
        case 30...: return .orange
        default:    return .secondary
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(result.name)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.primary)
                    Text(result.icdCode)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(result.probability)%")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(barColor)
                    Text(result.confidence.label)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Button("Apply") { onApply() }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .tint(barColor)
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.secondary.opacity(0.15))
                    RoundedRectangle(cornerRadius: 3)
                        .fill(barColor.opacity(0.75))
                        .frame(width: geo.size.width * CGFloat(result.probability) / 100)
                }
            }
            .frame(height: 5)

            if !result.evidence.isEmpty {
                Text(result.evidence.joined(separator: " · "))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Consultation Letter Sheet

private struct ConsultationLetterSheet: View {
    let letterText: String
    let patient: Patient
    @Environment(\.dismiss) private var dismiss
    @State private var showShare = false

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(letterText)
                    .font(.system(.body, design: .serif))
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .navigationTitle("Consultation Letter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showShare = true
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
            .sheet(isPresented: $showShare) {
                ShareSheet(items: [letterText]).ignoresSafeArea()
            }
        }
    }

}

// MARK: - EncounterHistoryRow

private struct EncounterHistoryRow: View {
    let encounter: Encounter

    private var dateText: String {
        encounter.encounterDate.formatted(date: .abbreviated, time: .omitted)
    }

    private var topDx: String? {
        if let dx = encounter.workingDiagnosis, !dx.isEmpty { return dx }
        let snap = encounter.decodedBayesianSnapshot
        return snap.first.map { "\($0.name) (\($0.probability)%)" }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: encounter.visitType.icon)
                    .font(.caption)
                    .foregroundStyle(AMColor.accent)
                Text(encounter.visitType.rawValue)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AMColor.accent)
                Spacer()
                Text(dateText)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            if let cc = encounter.chiefComplaint {
                Text(cc)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
            }
            if let dx = topDx {
                Text(dx)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            if let plan = encounter.managementPlan, !plan.isEmpty {
                Text(plan)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 4)
    }
}
