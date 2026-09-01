import SwiftUI
import SwiftData

// MARK: - iPad front-desk shell (role: front_desk)
// Tabs: Check-In · Questionnaire · Schedule
// Patients are visible for demographics only — no clinical data.

struct FrontDeskPadView: View {
    @EnvironmentObject private var sync: SyncService
    @State private var selectedTab: FDTab = .checkIn

    enum FDTab: String, CaseIterable {
        case checkIn       = "Check-In"
        case questionnaire = "Questionnaire"
        case schedule      = "Schedule"

        var icon: String {
            switch self {
            case .checkIn:       "person.badge.plus"
            case .questionnaire: "list.clipboard"
            case .schedule:      "calendar"
            }
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            // Left: icon sidebar (mirrors clinical app sidebar style)
            VStack(spacing: 0) {
                Spacer().frame(height: 24)

                Image("AppIconInline")
                    .resizable()
                    .frame(width: 32, height: 32)
                    .clipShape(RoundedRectangle(cornerRadius: 7))
                    .padding(.bottom, 20)

                ForEach(FDTab.allCases, id: \.self) { tab in
                    let sel = selectedTab == tab
                    Button { selectedTab = tab } label: {
                        VStack(spacing: 4) {
                            Image(systemName: tab.icon)
                                .font(.system(size: 20, weight: sel ? .semibold : .regular))
                            Text(tab.rawValue)
                                .font(.system(size: 8, weight: sel ? .bold : .semibold))
                                .lineLimit(1)
                        }
                        .foregroundStyle(sel ? AMColor.accent : AMColor.sidebarText)
                        .frame(width: 80, height: 60)
                        .background(sel ? AMColor.accent.opacity(0.12) : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                    .padding(.bottom, 4)
                }

                Spacer()

                VStack(spacing: 4) {
                    SyncStatusBar()
                    Button {
                        Task { try? await sync.signOut() }
                    } label: {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .font(.system(size: 18))
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .padding(.bottom, 16)
                }
            }
            .frame(width: 90)
            .background(AMColor.sidebarBg)

            Rectangle().fill(Color(.separator)).frame(width: 1)

            // Right: content area
            Group {
                switch selectedTab {
                case .checkIn:
                    FDCheckInView()
                case .questionnaire:
                    FDQuestionnaireView()
                case .schedule:
                    NavigationStack { ScheduleView() }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .ignoresSafeArea(edges: .bottom)
    }
}

// MARK: - Check-In tab

private struct FDCheckInView: View {
    @Query private var allPatients: [Patient]
    @Environment(\.modelContext) private var context

    @State private var searchQuery = ""
    @State private var selectedPatient: Patient?
    @State private var showAddPatient = false

    private var filteredPatients: [Patient] {
        let q = searchQuery.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return Array(allPatients.prefix(30)) }
        return allPatients.filter {
            $0.fullName.lowercased().contains(q) ||
            ($0.mrn?.lowercased().contains(q) ?? false) ||
            ($0.phone?.lowercased().contains(q) ?? false)
        }.prefix(30).map { $0 }
    }

    var body: some View {
        NavigationStack {
            HStack(spacing: 0) {
                // Patient list
                List(selection: $selectedPatient) {
                    if filteredPatients.isEmpty && !searchQuery.isEmpty {
                        VStack(spacing: 12) {
                            Text("No patient found for "\(searchQuery)"")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Button("Register New Patient") { showAddPatient = true }
                                .buttonStyle(.borderedProminent)
                                .tint(AMColor.accent)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                        .listRowBackground(Color.clear)
                    } else {
                        ForEach(filteredPatients) { patient in
                            FDPatientRow(patient: patient)
                                .tag(patient as Patient?)
                        }
                    }
                }
                .listStyle(.plain)
                .searchable(text: $searchQuery, prompt: "Search name, MRN, phone…")
                .navigationTitle("Check-In")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        Button { showAddPatient = true } label: {
                            Label("New Patient", systemImage: "person.badge.plus")
                        }
                        .tint(AMColor.accent)
                    }
                }
                .frame(width: 300)

                Rectangle().fill(Color(.separator)).frame(width: 1)

                // Demographics panel
                if let patient = selectedPatient {
                    NavigationStack {
                        PatientDemographicsForm(patient: patient)
                            .navigationTitle(patient.fullName)
                            .navigationBarTitleDisplayMode(.inline)
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    ContentUnavailableView(
                        "Select a Patient",
                        systemImage: "person.crop.circle",
                        description: Text("Search and tap a patient to view or edit their demographics.")
                    )
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .sheet(isPresented: $showAddPatient) {
            AddPatientView(initialSetting: .outpatient)
        }
    }
}

private struct FDPatientRow: View {
    let patient: Patient

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                AcuityPip(acuity: patient.acuity)
                Text(patient.fullName)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
            }
            HStack(spacing: 6) {
                if let mrn = patient.mrn, !mrn.isEmpty {
                    Text("MRN \(mrn)")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(AMColor.accent)
                }
                Text(patient.ageDisplay ?? "")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(patient.sex.rawValue)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            if let phone = patient.phone, !phone.isEmpty {
                Text(phone)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Questionnaire tab

private struct FDQuestionnaireView: View {
    @Query private var allPatients: [Patient]
    @State private var searchQuery = ""
    @State private var selectedPatient: Patient?
    @State private var showForm = false

    private var filteredPatients: [Patient] {
        let q = searchQuery.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return [] }
        return allPatients.filter {
            $0.fullName.lowercased().contains(q) ||
            ($0.mrn?.lowercased().contains(q) ?? false)
        }.prefix(20).map { $0 }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Find Patient") {
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Search name or MRN…", text: $searchQuery)
                            .textFieldStyle(.roundedBorder)
                            .autocorrectionDisabled()

                        if !filteredPatients.isEmpty {
                            ForEach(filteredPatients) { patient in
                                Button {
                                    selectedPatient = patient
                                    showForm = true
                                } label: {
                                    HStack {
                                        AcuityPip(acuity: patient.acuity)
                                        VStack(alignment: .leading, spacing: 1) {
                                            Text(patient.fullName)
                                                .font(.subheadline.weight(.semibold))
                                                .foregroundStyle(.primary)
                                            if let mrn = patient.mrn, !mrn.isEmpty {
                                                Text("MRN \(mrn)")
                                                    .font(.caption2)
                                                    .foregroundStyle(.secondary)
                                            }
                                        }
                                        Spacer()
                                        Image(systemName: "list.clipboard")
                                            .foregroundStyle(AMColor.accent)
                                    }
                                }
                                .buttonStyle(.plain)
                                .padding(.vertical, 4)
                            }
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
                }

                Section {
                    Button {
                        selectedPatient = nil
                        showForm = true
                    } label: {
                        Label("Walk-In Questionnaire (no patient selected)", systemImage: "person.fill.questionmark")
                            .foregroundStyle(AMColor.accent)
                    }
                } footer: {
                    Text("Use this when the patient hasn't been registered yet. You can attach the answers to their record later.")
                }
            }
            .navigationTitle("Questionnaire")
            .navigationBarTitleDisplayMode(.inline)
        }
        .sheet(isPresented: $showForm) {
            WalkInQuestionnaireSheet(patient: selectedPatient)
        }
    }
}

// MARK: - Walk-in questionnaire sheet

struct WalkInQuestionnaireSheet: View {
    var patient: Patient?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context

    // Chief complaint
    @State private var chiefComplaint = ""
    @State private var duration = ""
    @State private var severity = 5
    @State private var onset = OnsetType.gradual

    // Associated symptoms
    @State private var symptoms: Set<String> = []
    @State private var otherSymptom = ""

    // History
    @State private var pmhx: Set<String> = []
    @State private var currentMedications = ""
    @State private var knownAllergies = ""
    @State private var surgicalHistory = ""

    // Social
    @State private var smokingStatus = SmokingStatus.never
    @State private var alcoholUse = AlcoholUse.none

    // Additional
    @State private var lastMeal = Date()
    @State private var hasLastMeal = false
    @State private var additionalNotes = ""

    enum OnsetType: String, CaseIterable {
        case sudden = "Sudden"
        case gradual = "Gradual"
        case progressive = "Progressive"
    }

    enum SmokingStatus: String, CaseIterable {
        case never = "Never"
        case ex = "Ex-smoker"
        case current = "Current"
    }

    enum AlcoholUse: String, CaseIterable {
        case none = "None"
        case social = "Social"
        case regular = "Regular"
        case heavy = "Heavy"
    }

    private let symptomOptions = [
        "Nausea", "Vomiting", "Fever", "Weight loss", "Loss of appetite",
        "Diarrhoea", "Constipation", "Rectal bleeding", "Blood in vomit",
        "Jaundice", "Abdominal swelling", "Night sweats", "Fatigue",
        "Difficulty swallowing", "Heartburn / reflux", "Chest pain", "Shortness of breath"
    ]

    private let pmhxOptions = [
        "Hypertension", "Diabetes", "Heart disease", "Stroke", "Asthma / COPD",
        "Kidney disease", "Liver disease", "Cancer", "HIV / AIDS",
        "Thyroid disease", "Previous DVT / PE", "Sickle cell disease"
    ]

    private var summary: String {
        var parts: [String] = []
        if !chiefComplaint.isEmpty { parts.append("CC: \(chiefComplaint)") }
        if !duration.isEmpty { parts.append("Duration: \(duration)") }
        parts.append("Severity: \(severity)/10")
        parts.append("Onset: \(onset.rawValue)")
        if !symptoms.isEmpty { parts.append("Symptoms: \(symptoms.sorted().joined(separator: ", "))") }
        if !pmhx.isEmpty { parts.append("PMHx: \(pmhx.sorted().joined(separator: ", "))") }
        if !currentMedications.isEmpty { parts.append("Medications: \(currentMedications)") }
        if !knownAllergies.isEmpty { parts.append("Allergies: \(knownAllergies)") }
        if !surgicalHistory.isEmpty { parts.append("Surgical Hx: \(surgicalHistory)") }
        parts.append("Smoking: \(smokingStatus.rawValue) · Alcohol: \(alcoholUse.rawValue)")
        if !additionalNotes.isEmpty { parts.append("Notes: \(additionalNotes)") }
        return parts.joined(separator: "\n")
    }

    var body: some View {
        NavigationStack {
            Form {
                if let patient {
                    Section {
                        HStack(spacing: 8) {
                            AcuityPip(acuity: patient.acuity)
                            Text(patient.fullName).font(.subheadline.weight(.semibold))
                            if let mrn = patient.mrn, !mrn.isEmpty {
                                Text("MRN \(mrn)").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    } header: { Text("Patient") }
                }

                Section("Chief Complaint") {
                    TextField("Main reason for visit", text: $chiefComplaint, axis: .vertical)
                        .lineLimit(2...)
                    TextField("Duration (e.g. 3 days, 2 weeks)", text: $duration)

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Pain / Symptom severity: \(severity)/10")
                            .font(.subheadline)
                        Slider(value: Binding(
                            get: { Double(severity) },
                            set: { severity = Int($0) }
                        ), in: 1...10, step: 1)
                        .tint(severity >= 8 ? .red : severity >= 5 ? .orange : .green)
                    }

                    Picker("Onset", selection: $onset) {
                        ForEach(OnsetType.allCases, id: \.self) {
                            Text($0.rawValue).tag($0)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section("Associated Symptoms") {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                        ForEach(symptomOptions, id: \.self) { sym in
                            let sel = symptoms.contains(sym)
                            Button {
                                if sel { symptoms.remove(sym) } else { symptoms.insert(sym) }
                            } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: sel ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(sel ? AMColor.accent : .secondary)
                                        .font(.system(size: 14))
                                    Text(sym)
                                        .font(.caption)
                                        .foregroundStyle(.primary)
                                        .multilineTextAlignment(.leading)
                                    Spacer()
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)

                    TextField("Other symptoms…", text: $otherSymptom)
                }

                Section("Past Medical History") {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                        ForEach(pmhxOptions, id: \.self) { cond in
                            let sel = pmhx.contains(cond)
                            Button {
                                if sel { pmhx.remove(cond) } else { pmhx.insert(cond) }
                            } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: sel ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(sel ? AMColor.accent : .secondary)
                                        .font(.system(size: 14))
                                    Text(cond)
                                        .font(.caption)
                                        .foregroundStyle(.primary)
                                        .multilineTextAlignment(.leading)
                                    Spacer()
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)

                    TextField("Current medications", text: $currentMedications, axis: .vertical)
                        .lineLimit(2...)
                    TextField("Known allergies (drug, food, other)", text: $knownAllergies, axis: .vertical)
                        .lineLimit(2...)
                    TextField("Previous surgeries / procedures", text: $surgicalHistory, axis: .vertical)
                        .lineLimit(2...)
                }

                Section("Social History") {
                    Picker("Smoking", selection: $smokingStatus) {
                        ForEach(SmokingStatus.allCases, id: \.self) {
                            Text($0.rawValue).tag($0)
                        }
                    }
                    Picker("Alcohol use", selection: $alcoholUse) {
                        ForEach(AlcoholUse.allCases, id: \.self) {
                            Text($0.rawValue).tag($0)
                        }
                    }
                }

                Section("Last Meal") {
                    Toggle("Record last meal time", isOn: $hasLastMeal)
                    if hasLastMeal {
                        DatePicker("Last meal", selection: $lastMeal, displayedComponents: [.date, .hourAndMinute])
                    }
                }

                Section("Additional Notes") {
                    TextField("Any other relevant information…", text: $additionalNotes, axis: .vertical)
                        .lineLimit(3...)
                }
            }
            .navigationTitle(patient != nil ? "Questionnaire — \(patient!.fullName)" : "Walk-In Questionnaire")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    ShareLink(item: summary,
                              subject: Text("Pre-Visit Questionnaire")) {
                        Label("Export", systemImage: "square.and.arrow.up")
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Save to Notes") { saveToNotes() }
                        .disabled(chiefComplaint.trimmingCharacters(in: .whitespaces).isEmpty)
                        .tint(AMColor.accent)
                }
            }
        }
    }

    private func saveToNotes() {
        guard let patient else { dismiss(); return }
        let note = ClinicalNote(noteType: .other, patient: patient)
        note.freeText = "PRE-VISIT QUESTIONNAIRE\n\n" + summary
        context.insert(note)
        patient.updatedAt = .now
        patient.pendingSync = true
        dismiss()
    }
}
