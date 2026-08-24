import SwiftUI
import SwiftData

// MARK: - Allergy model (JSON-encoded in Patient.allergiesJson)

struct AllergyEntry: Codable, Identifiable {
    var id: UUID = UUID()
    var name: String
    var severity: String  // "Mild" | "Moderate" | "Severe"
    var reaction: String
}

extension Patient {
    var allergies: [AllergyEntry] {
        get {
            guard let json = allergiesJson, let data = json.data(using: .utf8) else { return [] }
            return (try? JSONDecoder().decode([AllergyEntry].self, from: data)) ?? []
        }
        set {
            allergiesJson = (try? String(data: JSONEncoder().encode(newValue), encoding: .utf8)) ?? nil
        }
    }

    var consultationCompleteness: (filled: Int, total: Int) {
        let checks: [Bool] = [
            !(chiefComplaint ?? "").isEmpty,
            !(hpi ?? "").isEmpty,
            !(pmhNotes ?? "").isEmpty || !(surgicalHistory ?? "").isEmpty,
            !allergies.isEmpty,
            !prescriptions.isEmpty,
            !(examGeneral ?? "").isEmpty || !(examAbdo ?? "").isEmpty,
            workingDiagnosis != nil,
            !(managementPlan ?? "").isEmpty
        ]
        return (checks.filter { $0 }.count, checks.count)
    }
}

// MARK: - Consultation sub-tab

enum ConsultTab: String, CaseIterable {
    case cc        = "CC"
    case hpi       = "HPI"
    case pmh       = "PMH"
    case pshx      = "PSHx"
    case allergies = "Allergies"
    case social    = "Social"
    case exam      = "Exam"
    case diagnosis = "Diagnosis"
    case plan      = "Plan"
}

// MARK: - ConsultationView

struct ConsultationView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context
    @StateObject private var ai = AIService()

    @State private var activeTab: ConsultTab = .cc
    @State private var examMode: ExamMode = .short
    @State private var showAddAllergy = false
    @State private var showAddMedication = false
    @State private var newAllergyName = ""
    @State private var newAllergySeverity = "Moderate"
    @State private var newAllergyReaction = ""
    @State private var triageResult: TriageResult?
    @State private var isAssessing = false
    @State private var pathwayTask: Task<Void, Never>?
    @State private var icdQuery = ""
    @State private var icdSuggestions: [ICDCode] = []
    @State private var showAIError = false
    @State private var showSavedConfirmation = false

    enum ExamMode { case short, full }

    private var interactions: [DrugInteractionAlert] {
        DrugInteractionService.check(drugs: patient.prescriptions.map { $0.drug })
    }

    var body: some View {
        VStack(spacing: 0) {
            if !patient.allergies.isEmpty { allergyBanner }
            completenessBar
            tabBar
            Divider()
            tabContent
        }
        .navigationTitle("Consultation")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: patient.chiefComplaint) { _, newCC in
            guard let cc = newCC, !cc.isEmpty else { triageResult = nil; return }
            pathwayTask?.cancel()
            pathwayTask = Task {
                try? await Task.sleep(nanoseconds: 800_000_000)
                guard !Task.isCancelled else { return }
                await MainActor.run { runPathway() }
            }
        }
        .sheet(isPresented: $showAddAllergy) { addAllergySheet }
        .sheet(isPresented: $showAddMedication) {
            AddMedicationSheet(patient: patient, context: context)
        }
        .alert("AI Error", isPresented: $showAIError) {
            Button("OK", role: .cancel) {}
        } message: { Text(ai.error ?? "Unknown error") }
        .alert("SOAP Note Saved", isPresented: $showSavedConfirmation) {
            Button("OK", role: .cancel) {}
        } message: { Text("Consultation saved to Notes tab.") }
    }

    // MARK: - Allergy banner

    private var allergyBanner: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("ALLERGY ALERT", systemImage: "exclamationmark.triangle.fill")
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
            ForEach(patient.allergies) { a in
                HStack(spacing: 5) {
                    Circle().fill(.white.opacity(0.7)).frame(width: 5, height: 5)
                    Text("\(a.name)  [\(a.severity)]  — \(a.reaction)")
                        .font(.caption2).foregroundStyle(.white)
                }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.red.opacity(0.85))
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
        case .pmh:       return !(patient.pmhNotes ?? "").isEmpty
        case .pshx:      return !(patient.surgicalHistory ?? "").isEmpty
        case .allergies: return !patient.allergies.isEmpty
        case .social:    return !(patient.socialHistory ?? "").isEmpty
        case .exam:      return !(patient.examGeneral ?? "").isEmpty || !(patient.examAbdo ?? "").isEmpty
        case .diagnosis: return patient.workingDiagnosis != nil
        case .plan:      return !(patient.managementPlan ?? "").isEmpty
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
        case .allergies: allergiesTab
        case .social:    socialTab
        case .exam:      examTab
        case .diagnosis: diagnosisTab
        case .plan:      planTab
        }
    }

    // MARK: - CC tab

    private var ccTab: some View {
        List {
            Section {
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
                TextField("e.g. Right upper quadrant pain for 3 days",
                          text: Binding(get: { patient.chiefComplaint ?? "" },
                                        set: { patient.chiefComplaint = $0.isEmpty ? nil : $0; touch() }),
                          axis: .vertical)
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

            if let result = triageResult { pathwayResult(result) }
        }
    }

    // MARK: - HPI tab

    private var hpiTab: some View {
        List {
            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.hpi ?? "" },
                                            set: { patient.hpi = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 200)
                    if (patient.hpi ?? "").isEmpty {
                        Text("Site · Onset · Character · Radiation · Associations · Time course · Exacerbating / Relieving factors · Severity (SOCRATES)")
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
                sectionHeader("History of Presenting Illness", icon: "text.bubble",
                              filled: !(patient.hpi ?? "").isEmpty)
            }
        }
    }

    // MARK: - PMH tab

    private var pmhTab: some View {
        List {
            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.pmhNotes ?? "" },
                                            set: { patient.pmhNotes = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 140)
                    if (patient.pmhNotes ?? "").isEmpty {
                        Text("Hypertension, Diabetes, Heart disease, Respiratory conditions, etc.")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Past Medical History", icon: "clock.arrow.circlepath",
                              filled: !(patient.pmhNotes ?? "").isEmpty)
            }

            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.familyHistoryNotes ?? "" },
                                            set: { patient.familyHistoryNotes = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 80)
                    if (patient.familyHistoryNotes ?? "").isEmpty {
                        Text("Colorectal cancer, breast cancer, cardiovascular disease, etc.")
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
            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.surgicalHistory ?? "" },
                                            set: { patient.surgicalHistory = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 220)
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

    // MARK: - Allergies tab

    private var allergiesTab: some View {
        List {
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
            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.socialHistory ?? "" },
                                            set: { patient.socialHistory = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 220)
                    if (patient.socialHistory ?? "").isEmpty {
                        Text("Occupation · Smoking · Alcohol · Recreational drugs · Living situation · Exercise · Diet · Travel · Functional status")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Social History", icon: "person.2.circle",
                              filled: !(patient.socialHistory ?? "").isEmpty)
            }
        }
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

                examField("General appearance", text: Binding(
                    get: { patient.examGeneral ?? "" },
                    set: { patient.examGeneral = $0.isEmpty ? nil : $0; touch() }))
                examField("Cardiovascular", text: Binding(
                    get: { patient.examCVS ?? "" },
                    set: { patient.examCVS = $0.isEmpty ? nil : $0; touch() }))
                examField("Respiratory", text: Binding(
                    get: { patient.examResp ?? "" },
                    set: { patient.examResp = $0.isEmpty ? nil : $0; touch() }))
                examField("Abdomen", text: Binding(
                    get: { patient.examAbdo ?? "" },
                    set: { patient.examAbdo = $0.isEmpty ? nil : $0; touch() }))

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
    private func examField(_ label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            TextField("Findings…", text: text, axis: .vertical).lineLimit(2...).font(.callout)
        }
        .padding(.vertical, 2)
    }

    // MARK: - Diagnosis tab

    private var diagnosisTab: some View {
        List {
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

    private var planTab: some View {
        List {
            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.managementPlan ?? "" },
                                            set: { patient.managementPlan = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 160)
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
                    Task { await saveSoapNote() }
                } label: {
                    Label("Save as SOAP Note", systemImage: "square.and.arrow.down")
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
                Text(acuityLabel(result.suggestedAcuity)).font(.subheadline.weight(.semibold))
                Spacer()
                Text("Confidence \(result.confidencePercent)%").font(.caption).foregroundStyle(.secondary)
            }

            if !result.differentials.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Differentials").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    ForEach(Array(result.differentials.prefix(4).enumerated()), id: \.offset) { i, dx in
                        HStack {
                            Text(i == 0 ? "→" : "•").foregroundStyle(i == 0 ? AMColor.accent : .secondary)
                            Text(dx).font(.caption)
                                .foregroundStyle(i == 0 ? .primary : .secondary)
                            Spacer()
                            if i == 0 && patient.workingDiagnosis != dx {
                                Button("Use") {
                                    patient.workingDiagnosis = dx
                                    patient.workingDiagnosisICD = nil
                                    touch()
                                    activeTab = .diagnosis
                                }
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(AMColor.accent)
                            } else if i == 0 && patient.workingDiagnosis == dx {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(.green).font(.caption)
                            }
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

    // MARK: - Helpers

    private func touch() { patient.updatedAt = .now; patient.pendingSync = true }

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

    private func acuityLabel(_ a: Acuity) -> String {
        switch a {
        case .emergency: return "Emergency"
        case .urgent:    return "Urgent"
        case .priority:  return "Priority"
        case .routine:   return "Routine"
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
        let system = """
        You are a surgical registrar AI assistant to Dr Dawit Daniel Kabiye MD DM, consultant general and endoscopic surgeon, Amise Medical Services, Saint Lucia.
        Write concise professional clinical documentation. British spelling.
        Mark AI-generated content: [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        let user = """
        Write a concise HPI paragraph (3-5 sentences) for a surgical outpatient consultation note using the SOCRATES framework.
        Patient: \(patient.fullName), \(patient.sex.rawValue), \(patient.ageYears)y
        Chief Complaint: \(patient.chiefComplaint ?? "Not specified")
        PMH: \(patient.pmhNotes ?? "None documented")
        Surgical History: \(patient.surgicalHistory ?? "Nil")
        Mark as [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        do { let draft = try await ai.generate(systemPrompt: system, userMessage: user); patient.hpi = draft; touch() }
        catch { showAIError = true }
    }

    private func draftExam() async {
        let system = "You are a surgical registrar AI assistant. Write brief, realistic examination findings. British spelling."
        let user = """
        Write brief surgical examination findings. Return ONLY in this exact format, one per line:
        General: [finding]
        CVS: [finding]
        Resp: [finding]
        Abdomen: [finding]

        Patient: \(patient.fullName), \(patient.sex.rawValue), \(patient.ageYears)y
        Presentation: \(patient.chiefComplaint ?? patient.workingDiagnosis ?? "Not specified")
        Mark each as [AI DRAFT].
        """
        do {
            let draft = try await ai.generate(systemPrompt: system, userMessage: user)
            for line in draft.components(separatedBy: "\n") {
                let l = line.trimmingCharacters(in: .whitespaces)
                if l.lowercased().hasPrefix("general:")  { patient.examGeneral = l }
                else if l.lowercased().hasPrefix("cvs:") { patient.examCVS = l }
                else if l.lowercased().hasPrefix("resp:") { patient.examResp = l }
                else if l.lowercased().hasPrefix("abdo")  { patient.examAbdo = l }
            }
            touch()
        } catch { showAIError = true }
    }

    private func draftPlan() async {
        do {
            let soap = try await ai.generateSOAP(patient: patient, noteType: .soap)
            patient.managementPlan = "Assessment: \(soap.a)\n\nPlan: \(soap.p)"; touch()
        } catch { showAIError = true }
    }

    private func saveSoapNote() async {
        let parts: [String] = [
            patient.chiefComplaint.map { "CC: \($0)" },
            patient.hpi.map { "HPI:\n\($0)" },
            patient.pmhNotes.map { "PMH: \($0)" },
            patient.surgicalHistory.map { "Past Surgical Hx: \($0)" },
            allergySummary(),
            medicationSummary(),
            examSummary(),
            patient.workingDiagnosis.map { dx -> String in
                let icdSuffix = patient.workingDiagnosisICD.map { " (\($0))" } ?? ""
                return "Diagnosis: \(dx)\(icdSuffix)"
            },
            patient.managementPlan.map { "Plan:\n\($0)" },
        ].compactMap { $0 }

        let note = ClinicalNote(noteType: .soap, patient: patient)
        note.freeText = parts.joined(separator: "\n\n")
        context.insert(note); touch()
        showSavedConfirmation = true
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
