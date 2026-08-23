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

    enum ExamMode { case short, full }

    var body: some View {
        List {
            chiefComplaintSection
            hpiSection
            pmhSection
            allergiesSection
            medicationsSection
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
    }

    // MARK: - Chief Complaint

    @ViewBuilder
    private var chiefComplaintSection: some View {
        Section {
            TextField("e.g. Right upper quadrant pain for 3 days", text: Binding(
                get: { patient.chiefComplaint ?? "" },
                set: {
                    patient.chiefComplaint = $0.isEmpty ? nil : $0
                    touch()
                }
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
            Label("Chief Complaint", systemImage: "person.fill.questionmark")
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
                .frame(minHeight: 100)
                if (patient.hpi ?? "").isEmpty {
                    Text("Onset, duration, character, severity, radiation, associated symptoms, relieving/aggravating factors…")
                        .foregroundStyle(.tertiary).font(.callout)
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
            Label("History of Presenting Illness", systemImage: "text.bubble")
        }
    }

    // MARK: - PMH / Surgical / Family

    @ViewBuilder
    private var pmhSection: some View {
        Section("Past Medical History") {
            TextEditor(text: Binding(
                get: { patient.pmhNotes ?? "" },
                set: { patient.pmhNotes = $0.isEmpty ? nil : $0; touch() }
            ))
            .frame(minHeight: 60)
        }

        Section("Past Surgical History") {
            TextEditor(text: Binding(
                get: { patient.surgicalHistory ?? "" },
                set: { patient.surgicalHistory = $0.isEmpty ? nil : $0; touch() }
            ))
            .frame(minHeight: 60)
        }

        Section("Family History") {
            TextEditor(text: Binding(
                get: { patient.familyHistoryNotes ?? "" },
                set: { patient.familyHistoryNotes = $0.isEmpty ? nil : $0; touch() }
            ))
            .frame(minHeight: 40)
        }
    }

    // MARK: - Allergies

    @ViewBuilder
    private var allergiesSection: some View {
        Section {
            if patient.allergies.isEmpty {
                Text("No known drug allergies (NKDA)")
                    .foregroundStyle(.secondary).font(.callout)
            } else {
                ForEach(patient.allergies) { allergy in
                    HStack(spacing: 10) {
                        Circle()
                            .fill(severityColor(allergy.severity))
                            .frame(width: 8, height: 8)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(allergy.name).font(.subheadline.weight(.medium))
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
            Label("Allergies & Intolerances", systemImage: "exclamationmark.shield")
                .foregroundStyle(.red)
        }
    }

    // MARK: - Current Medications

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
            Label("Current Medications", systemImage: "pills")
        }
    }

    // MARK: - Physical Examination

    @ViewBuilder
    private var examinationSection: some View {
        Section {
            Picker("Exam detail", selection: $examMode) {
                Text("Short").tag(ExamMode.short)
                Text("Full Systems Review").tag(ExamMode.full)
            }
            .pickerStyle(.segmented)

            examField("General appearance", keyPath: \.examGeneral)
            examField("Cardiovascular", keyPath: \.examCVS)
            examField("Respiratory", keyPath: \.examResp)
            examField("Abdomen", keyPath: \.examAbdo)

            if examMode == .full {
                examField("Neurological", keyPath: \.examNeuro)
                examField("Musculoskeletal", keyPath: \.examMSK)
                examField("Skin / Wound", keyPath: \.examSkin)
            }

            examField("Other / Additional findings", keyPath: \.examOther)

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
            Label("Physical Examination", systemImage: "stethoscope")
        }
    }

    @ViewBuilder
    private func examField(_ label: String, keyPath: ReferenceWritableKeyPath<Patient, String?>) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            TextField("Findings…", text: Binding(
                get: { patient[keyPath: keyPath] ?? "" },
                set: {
                    patient[keyPath: keyPath] = $0.isEmpty ? nil : $0
                    touch()
                }
            ), axis: .vertical)
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
                        touch()
                        icdQuery = ""
                    }.font(.caption).foregroundStyle(.red)
                }
                Label("Radiates to: Notes · Prescriptions · Billing", systemImage: "arrow.triangle.branch")
                    .font(.caption).foregroundStyle(.teal)
            }
        } header: {
            Label("Working Diagnosis", systemImage: "stethoscope")
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
                    Text("Investigations, referrals, prescriptions, follow-up plan…")
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
            Label("Assessment & Management Plan", systemImage: "doc.text.magnifyingglass")
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
                    .disabled(newAllergyName.trimmingCharacters(in: .whitespaces).isEmpty)
                    .bold()
                }
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
        Write concise, professional clinical documentation in British spelling.
        Mark AI-generated content: [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        let user = """
        Write a concise HPI paragraph for a surgical outpatient consultation note.
        Patient: \(patient.fullName), \(patient.sex.rawValue), \(patient.ageYears)y
        Chief Complaint: \(patient.chiefComplaint ?? "Not specified")
        PMH: \(patient.pmhNotes ?? "None documented")

        Cover: onset, duration, character, severity, location, radiation, associated symptoms,
        aggravating/relieving factors, prior episodes, prior treatment.
        One paragraph, 3-5 sentences. Mark as [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        do {
            let draft = try await ai.generate(systemPrompt: system, userMessage: user)
            patient.hpi = draft
            touch()
        } catch {
            showAIError = true
        }
    }

    private func draftExam() async {
        let system = """
        You are a surgical registrar AI assistant. Write brief, realistic examination findings.
        British spelling. Mark as [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        let user = """
        Write brief surgical examination findings for:
        Patient: \(patient.fullName), \(patient.sex.rawValue), \(patient.ageYears)y
        Presentation: \(patient.chiefComplaint ?? patient.workingDiagnosis ?? "Not specified")
        Diagnosis: \(patient.workingDiagnosis ?? "Under assessment")

        Return ONLY in this format, one line each, separated by newline:
        General: [finding]
        CVS: [finding]
        Resp: [finding]
        Abdomen: [finding]
        Mark each line as [AI DRAFT].
        """
        do {
            let draft = try await ai.generate(systemPrompt: system, userMessage: user)
            for line in draft.components(separatedBy: "\n") {
                let l = line.trimmingCharacters(in: .whitespaces)
                if l.lowercased().hasPrefix("general") { patient.examGeneral = l }
                else if l.lowercased().hasPrefix("cvs") || l.lowercased().hasPrefix("cardio") { patient.examCVS = l }
                else if l.lowercased().hasPrefix("resp") { patient.examResp = l }
                else if l.lowercased().hasPrefix("abdo") || l.lowercased().hasPrefix("abdom") { patient.examAbdo = l }
            }
            touch()
        } catch {
            showAIError = true
        }
    }

    private func draftPlan() async {
        do {
            let soap = try await ai.generateSOAP(patient: patient, noteType: .soap)
            patient.managementPlan = "Assessment: \(soap.a)\n\nPlan: \(soap.p)"
            touch()
        } catch {
            showAIError = true
        }
    }

    private func saveSoapNote() async {
        let parts: [String] = [
            patient.chiefComplaint.map { "CC: \($0)" },
            patient.hpi.map { "HPI:\n\($0)" },
            patient.pmhNotes.map { "PMH: \($0)" },
            patient.surgicalHistory.map { "Past Surgical Hx: \($0)" },
            allergySummary().isEmpty ? nil : allergySummary(),
            medicationSummary().isEmpty ? nil : medicationSummary(),
            examSummary().isEmpty ? nil : "Examination:\n\(examSummary())",
            patient.workingDiagnosis.map { dx in
                "Diagnosis: \(dx)\(patient.workingDiagnosisICD.map { " (\($0))" } ?? "")"
            },
            patient.managementPlan.map { "Plan:\n\($0)" },
        ].compactMap { $0 }

        let note = ClinicalNote(noteType: .soap, patient: patient)
        note.freeText = parts.joined(separator: "\n\n")
        context.insert(note)
        touch()
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
                    if !suggestions.isEmpty {
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
                    }
                } header: {
                    Label("Search Formulary", systemImage: "magnifyingglass")
                }

                if selectedDrug != nil {
                    Section("Dose & Route") {
                        TextField("Dose", text: $dose)
                        Picker("Route", selection: $route) {
                            ForEach(["Oral", "IV", "IM", "SC", "Topical", "Inhaled", "PR", "SL"], id: \.self) {
                                Text($0).tag($0)
                            }
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
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
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
