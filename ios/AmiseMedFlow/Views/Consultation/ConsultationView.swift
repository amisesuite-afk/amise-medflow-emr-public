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

// MARK: - ConsultationView

struct ConsultationView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context
    @StateObject private var ai = AIService()

    @State private var examMode: ExamMode = .short
    @State private var showAddAllergy = false
    @State private var showAddMedication = false
    @State private var newAllergyName = ""
    @State private var newAllergySeverity = "Moderate"
    @State private var newAllergyReaction = ""
    @State private var triageResult: TriageResult?
    @State private var isAssessing = false
    @State private var icdQuery = ""
    @State private var icdSuggestions: [ICDCode] = []
    @State private var showAIError = false
    @State private var showSavedConfirmation = false

    enum ExamMode { case short, full }

    private var interactions: [DrugInteractionAlert] {
        DrugInteractionService.check(drugs: patient.prescriptions.map { $0.drug })
    }

    private var completeness: (filled: Int, total: Int) {
        patient.consultationCompleteness
    }

    private var historyFilled: Bool {
        !(patient.pmhNotes ?? "").isEmpty || !(patient.surgicalHistory ?? "").isEmpty
    }

    private var examFilled: Bool {
        !(patient.examGeneral ?? "").isEmpty || !(patient.examAbdo ?? "").isEmpty
    }

    private var completenessFilled: Int { completeness.filled }
    private var completenessTotal: Int { completeness.total }

    var body: some View {
        List {
            // Allergy alert — always first if any exist
            if !patient.allergies.isEmpty { allergyAlertBanner }

            completenessSection
            chiefComplaintSection
            hpiSection
            pmhSection
            allergiesSection
            medicationsSection
            if !interactions.isEmpty { interactionAlertsSection }
            examinationSection
            workingDiagnosisSection
            if let result = triageResult { pathwaySection(result) }
            managementSection
        }
        .navigationTitle("Consultation")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showAddAllergy) { addAllergySheet }
        .sheet(isPresented: $showAddMedication) {
            AddMedicationSheet(patient: patient, context: context)
        }
        .alert("AI Error", isPresented: $showAIError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(ai.error ?? "Unknown error")
        }
        .alert("SOAP Note Saved", isPresented: $showSavedConfirmation) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Consultation saved to Notes tab.")
        }
    }

    // MARK: - Allergy Alert Banner

    @ViewBuilder
    private var allergyAlertBanner: some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                Label("ALLERGY ALERT", systemImage: "exclamationmark.triangle.fill")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                ForEach(patient.allergies) { a in
                    HStack(spacing: 6) {
                        Circle().fill(.white.opacity(0.8)).frame(width: 6, height: 6)
                        Text("\(a.name)  [\(a.severity)]  — \(a.reaction)")
                            .font(.caption).foregroundStyle(.white)
                    }
                }
            }
            .padding(.vertical, 4)
            .listRowBackground(Color.red.opacity(0.85))
        }
    }

    // MARK: - Completeness

    @ViewBuilder
    private var completenessSection: some View {
        Section {
            VStack(spacing: 6) {
                ProgressView(value: Double(completenessFilled), total: Double(completenessTotal))
                    .tint(completenessFilled == completenessTotal ? .green : .teal)
                HStack {
                    Text("\(completenessFilled) of \(completenessTotal) sections complete")
                        .font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    if completenessFilled == completenessTotal {
                        Label("Ready to save", systemImage: "checkmark.seal.fill")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.green)
                    }
                }
            }
        }
        .listRowBackground(Color.clear)
    }

    // MARK: - Chief Complaint

    @ViewBuilder
    private var chiefComplaintSection: some View {
        Section {
            TextField("e.g. Right upper quadrant pain for 3 days", text: Binding(
                get: { patient.chiefComplaint ?? "" },
                set: { patient.chiefComplaint = $0.isEmpty ? nil : $0; touch() }
            ), axis: .vertical).lineLimit(2...)

            Button {
                runPathway()
            } label: {
                HStack {
                    Label("Run Pathway Assessment", systemImage: "waveform.path.ecg.rectangle")
                    Spacer()
                    if isAssessing { ProgressView() }
                }
            }
            .disabled(isAssessing || (patient.chiefComplaint ?? "").isEmpty)
            .foregroundStyle(.teal)
        } header: {
            sectionHeader("Chief Complaint", icon: "person.fill.questionmark",
                          filled: !(patient.chiefComplaint ?? "").isEmpty)
        }
    }

    // MARK: - HPI

    @ViewBuilder
    private var hpiSection: some View {
        Section {
            ZStack(alignment: .topLeading) {
                TextEditor(text: Binding(
                    get: { patient.hpi ?? "" },
                    set: { patient.hpi = $0.isEmpty ? nil : $0; touch() }
                ))
                .frame(minHeight: 110)
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

    // MARK: - PMH / Surgical / Family

    @ViewBuilder
    private var pmhSection: some View {
        Section {
            Group {
                Text("Past Medical History").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                TextEditor(text: Binding(
                    get: { patient.pmhNotes ?? "" },
                    set: { patient.pmhNotes = $0.isEmpty ? nil : $0; touch() }
                )).frame(minHeight: 56)
            }
            Group {
                Text("Past Surgical History").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                TextEditor(text: Binding(
                    get: { patient.surgicalHistory ?? "" },
                    set: { patient.surgicalHistory = $0.isEmpty ? nil : $0; touch() }
                )).frame(minHeight: 40)
            }
            Group {
                Text("Family History").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                TextEditor(text: Binding(
                    get: { patient.familyHistoryNotes ?? "" },
                    set: { patient.familyHistoryNotes = $0.isEmpty ? nil : $0; touch() }
                )).frame(minHeight: 36)
            }
        } header: {
            sectionHeader("Medical & Surgical History", icon: "clock.arrow.circlepath",
                          filled: historyFilled)
        }
    }

    // MARK: - Allergies

    @ViewBuilder
    private var allergiesSection: some View {
        Section {
            if patient.allergies.isEmpty {
                HStack {
                    Image(systemName: "checkmark.shield").foregroundStyle(.green)
                    Text("No known drug allergies (NKDA)")
                        .foregroundStyle(.secondary).font(.callout)
                }
            } else {
                ForEach(patient.allergies) { allergy in
                    HStack(spacing: 10) {
                        Circle()
                            .fill(severityColor(allergy.severity))
                            .frame(width: 9, height: 9)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(allergy.name).font(.subheadline.weight(.semibold))
                            Text("\(allergy.severity) — \(allergy.reaction)")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                .onDelete { idx in
                    var list = patient.allergies
                    list.remove(atOffsets: idx)
                    patient.allergies = list
                    touch()
                }
            }
            Button {
                showAddAllergy = true
            } label: {
                Label("Add Allergy / Intolerance", systemImage: "plus.circle")
            }
            .foregroundStyle(.red)
        } header: {
            sectionHeader("Allergies & Intolerances", icon: "exclamationmark.shield",
                          filled: !patient.allergies.isEmpty, filledColor: .red)
        }
    }

    // MARK: - Medications

    @ViewBuilder
    private var medicationsSection: some View {
        Section {
            if patient.prescriptions.isEmpty {
                Text("No current medications").foregroundStyle(.secondary).font(.callout)
            } else {
                ForEach(patient.prescriptions.sorted { $0.prescribedAt < $1.prescribedAt }) { rx in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(rx.drug).font(.subheadline.weight(.medium))
                        Text("\(rx.dose)  \(rx.route)  \(rx.frequency)")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            Button {
                showAddMedication = true
            } label: {
                Label("Add Medication", systemImage: "plus.circle")
            }
            .foregroundStyle(.teal)
        } header: {
            sectionHeader("Current Medications", icon: "pills",
                          filled: !patient.prescriptions.isEmpty)
        }
    }

    // MARK: - Drug interaction alerts

    @ViewBuilder
    private var interactionAlertsSection: some View {
        Section {
            ForEach(interactions) { alert in
                InteractionAlertRow(alert: alert)
            }
        } header: {
            Label("Drug Interaction Alerts", systemImage: "exclamationmark.triangle")
                .foregroundStyle(.orange)
        }
    }

    // MARK: - Physical Examination

    @ViewBuilder
    private var examinationSection: some View {
        Section {
            HStack {
                Picker("Exam detail", selection: $examMode) {
                    Text("Short").tag(ExamMode.short)
                    Text("Full Systems Review").tag(ExamMode.full)
                }
                .pickerStyle(.segmented)
                Spacer(minLength: 12)
                Button("All Normal") { markAllNormal() }
                    .font(.caption).foregroundStyle(.teal)
            }

            examField("General appearance", text: Binding(
                get: { patient.examGeneral ?? "" },
                set: { patient.examGeneral = $0.isEmpty ? nil : $0; touch() }
            ))
            examField("Cardiovascular", text: Binding(
                get: { patient.examCVS ?? "" },
                set: { patient.examCVS = $0.isEmpty ? nil : $0; touch() }
            ))
            examField("Respiratory", text: Binding(
                get: { patient.examResp ?? "" },
                set: { patient.examResp = $0.isEmpty ? nil : $0; touch() }
            ))
            examField("Abdomen", text: Binding(
                get: { patient.examAbdo ?? "" },
                set: { patient.examAbdo = $0.isEmpty ? nil : $0; touch() }
            ))

            if examMode == .full {
                examField("Neurological", text: Binding(
                    get: { patient.examNeuro ?? "" },
                    set: { patient.examNeuro = $0.isEmpty ? nil : $0; touch() }
                ))
                examField("Musculoskeletal", text: Binding(
                    get: { patient.examMSK ?? "" },
                    set: { patient.examMSK = $0.isEmpty ? nil : $0; touch() }
                ))
                examField("Skin / Wound", text: Binding(
                    get: { patient.examSkin ?? "" },
                    set: { patient.examSkin = $0.isEmpty ? nil : $0; touch() }
                ))
            }

            examField("Other / Additional findings", text: Binding(
                get: { patient.examOther ?? "" },
                set: { patient.examOther = $0.isEmpty ? nil : $0; touch() }
            ))

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
            sectionHeader("Physical Examination", icon: "stethoscope", filled: examFilled)
        }
    }

    @ViewBuilder
    private func examField(_ label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            TextField("Findings…", text: text, axis: .vertical)
                .lineLimit(2...)
                .font(.callout)
        }
        .padding(.vertical, 2)
    }

    // MARK: - Working Diagnosis

    @ViewBuilder
    private var workingDiagnosisSection: some View {
        Section {
            HStack {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Search ICD-10 codes or diagnosis", text: $icdQuery)
                    .autocorrectionDisabled()
                    .onChange(of: icdQuery) { _, q in
                        icdSuggestions = q.count >= 2 ? ClinicalSearchService.searchICD(q) : []
                    }
                if !icdQuery.isEmpty {
                    Button { icdQuery = ""; icdSuggestions = [] }
                        label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                }
            }

            if !icdSuggestions.isEmpty {
                ForEach(icdSuggestions.prefix(5)) { icd in
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
            }

            if let dx = patient.workingDiagnosis {
                HStack {
                    Image(systemName: "stethoscope").foregroundStyle(.teal)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(dx).font(.subheadline.weight(.medium))
                        if let icd = patient.workingDiagnosisICD {
                            Text(icd).font(.caption.monospaced()).foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    Button("Clear") {
                        patient.workingDiagnosis = nil
                        patient.workingDiagnosisICD = nil
                        touch(); icdQuery = ""
                    }.font(.caption).foregroundStyle(.red)
                }
                Label("Radiates to: Notes · Prescriptions · Billing", systemImage: "arrow.triangle.branch")
                    .font(.caption).foregroundStyle(.teal)
            }
        } header: {
            sectionHeader("Working Diagnosis", icon: "stethoscope",
                          filled: patient.workingDiagnosis != nil)
        }
    }

    // MARK: - Pathway result

    @ViewBuilder
    private func pathwaySection(_ result: TriageResult) -> some View {
        Section {
            HStack {
                AcuityPip(acuity: result.suggestedAcuity)
                Text(acuityLabel(result.suggestedAcuity))
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("Confidence \(result.confidencePercent)%")
                    .font(.caption).foregroundStyle(.secondary)
            }
            if !result.redFlags.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Red Flags", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption.weight(.semibold)).foregroundStyle(.red)
                    ForEach(result.redFlags, id: \.self) { f in
                        Text("• \(f)").font(.caption)
                    }
                }
            }
            if !result.differentials.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Differentials").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    ForEach(result.differentials, id: \.self) { d in
                        Text("• \(d)").font(.caption)
                    }
                }
            }
        } header: {
            Label("Pathway: \(result.pathway)", systemImage: "waveform.path.ecg.rectangle")
        }
    }

    // MARK: - Management Plan

    @ViewBuilder
    private var managementSection: some View {
        Section {
            ZStack(alignment: .topLeading) {
                TextEditor(text: Binding(
                    get: { patient.managementPlan ?? "" },
                    set: { patient.managementPlan = $0.isEmpty ? nil : $0; touch() }
                ))
                .frame(minHeight: 120)
                if (patient.managementPlan ?? "").isEmpty {
                    Text("Investigations · Referrals · Prescriptions · Follow-up plan · Red flag advice…")
                        .foregroundStyle(.tertiary).font(.callout)
                        .padding(.top, 8).padding(.leading, 4)
                        .allowsHitTesting(false)
                }
            }

            Button {
                Task { await draftPlan() }
            } label: {
                HStack {
                    Label("AI Draft Management Plan", systemImage: "sparkles")
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
        } header: {
            sectionHeader("Assessment & Management Plan", icon: "doc.text.magnifyingglass",
                          filled: !(patient.managementPlan ?? "").isEmpty)
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
                        patient.allergies = list
                        touch()
                        resetAllergyForm()
                        showAddAllergy = false
                    }
                    .bold()
                    .disabled(newAllergyName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    // MARK: - Shared section header builder

    @ViewBuilder
    private func sectionHeader(
        _ title: String,
        icon: String,
        filled: Bool,
        filledColor: Color = .teal
    ) -> some View {
        HStack(spacing: 6) {
            Label(title, systemImage: icon)
            Spacer()
            if filled {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(filledColor)
                    .font(.caption)
            }
        }
    }

    // MARK: - Helpers

    private func touch() {
        patient.updatedAt = .now
        patient.pendingSync = true
    }

    private func resetAllergyForm() {
        newAllergyName = ""
        newAllergySeverity = "Moderate"
        newAllergyReaction = ""
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
        if (patient.examCVS ?? "").isEmpty { patient.examCVS = "Regular rate and rhythm. No murmurs." }
        if (patient.examResp ?? "").isEmpty { patient.examResp = "Clear to auscultation bilaterally." }
        if (patient.examAbdo ?? "").isEmpty { patient.examAbdo = "Soft, non-tender, non-distended. No organomegaly." }
        touch()
    }

    private func runPathway() {
        isAssessing = true
        let result = ClinicalPathwayEngine.assess(
            chiefComplaint: patient.chiefComplaint ?? "",
            pmh: patient.pmhNotes ?? ""
        )
        triageResult = result
        if result.suggestedAcuity < patient.acuity {
            patient.acuity = result.suggestedAcuity
            touch()
        }
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
        do {
            let draft = try await ai.generate(systemPrompt: system, userMessage: user)
            patient.hpi = draft
            touch()
        } catch { showAIError = true }
    }

    private func draftExam() async {
        let system = """
        You are a surgical registrar AI assistant. Write brief, realistic examination findings. British spelling.
        """
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
                if l.lowercased().hasPrefix("general:")     { patient.examGeneral = l }
                else if l.lowercased().hasPrefix("cvs:")    { patient.examCVS = l }
                else if l.lowercased().hasPrefix("resp:")   { patient.examResp = l }
                else if l.lowercased().hasPrefix("abdo")    { patient.examAbdo = l }
            }
            touch()
        } catch { showAIError = true }
    }

    private func draftPlan() async {
        do {
            let soap = try await ai.generateSOAP(patient: patient, noteType: .soap)
            patient.managementPlan = "Assessment: \(soap.a)\n\nPlan: \(soap.p)"
            touch()
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
        context.insert(note)
        touch()
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
            .compactMap { $0 }
            .joined(separator: "\n")
    }
}

// MARK: - Drug interaction row (extracted to avoid type-checker timeout)

private struct InteractionAlertRow: View {
    let alert: DrugInteractionAlert

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: alert.interaction.severity.icon)
                    .foregroundStyle(alert.interaction.severity.color)
                Text("\(alert.drugA) + \(alert.drugB)")
                    .font(.caption.weight(.semibold))
            }
            Text(alert.interaction.mechanism)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text("→ \(alert.interaction.management)")
                .font(.caption2)
                .foregroundStyle(.orange)
        }
    }
}

// MARK: - Add Medication sheet (from Consultation)

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
                            selectedDrug = drug
                            drugQuery = drug.name
                            dose = drug.commonDoses
                            indication = patient.workingDiagnosis ?? ""
                            suggestions = []
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(drug.name).foregroundStyle(.primary).font(.subheadline)
                                Text(drug.commonDoses).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                } header: {
                    Label("Search Formulary", systemImage: "magnifyingglass")
                }

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
                        let rx = Prescription(
                            drug: drug.name, dose: dose, route: route,
                            frequency: frequency, duration: duration,
                            indication: indication
                        )
                        rx.patient = patient
                        context.insert(rx)
                        patient.updatedAt = .now
                        patient.pendingSync = true
                        dismiss()
                    }
                    .bold()
                    .disabled(selectedDrug == nil || dose.isEmpty)
                }
            }
        }
    }
}
