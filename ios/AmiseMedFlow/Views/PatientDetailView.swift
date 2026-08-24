import SwiftUI
import SwiftData

// MARK: - Patient detail section enum (iPad/Mac sidebar)

enum PatientDetailSection: String, CaseIterable, Identifiable, Hashable {
    case overview      = "Overview"
    case consultation  = "Consultation"
    case notes         = "Notes"
    case vitals        = "Vitals"
    case prescriptions = "Prescriptions"
    case billing       = "Billing"
    case operative     = "Operative Plan"
    case documents     = "Documents"
    case demographics  = "Demographics"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .overview:      "person.text.rectangle"
        case .consultation:  "stethoscope"
        case .notes:         "note.text"
        case .vitals:        "waveform.path.ecg"
        case .prescriptions: "pills"
        case .billing:       "dollarsign.circle"
        case .operative:     "scissors"
        case .documents:     "doc.badge.plus"
        case .demographics:  "square.and.pencil"
        }
    }
}

// MARK: - iPad/Mac: patient detail with sidebar

struct PatientDetailPadView: View {
    @Bindable var patient: Patient
    @State private var selectedSection: PatientDetailSection? = .overview

    var body: some View {
        HStack(spacing: 0) {
            patientSectionSidebar
            patientSectionContent
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(AMColor.bg)
        }
        .navigationTitle(patient.fullName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 1) {
                    Text(patient.fullName).font(.headline)
                    Text("\(patient.sex.rawValue) · \(patient.ageYears)y · \((selectedSection ?? .overview).rawValue)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    // MARK: Section sidebar — dark, mirrors web sidebar

    private var patientSectionSidebar: some View {
        List(selection: $selectedSection) {
            Section {
                ForEach(PatientDetailSection.allCases) { section in
                    PatientSectionRow(section: section,
                                      isSelected: selectedSection == section)
                        .tag(section)
                        .listRowBackground(sectionBackground(section))
                        .listRowInsets(EdgeInsets())
                }
            } header: {
                Text(patient.fullName)
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(AMColor.sidebarGroup)
                    .tracking(1)
                    .lineLimit(1)
            }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        .background(AMColor.sidebarBg)
        .frame(width: 200)
        .safeAreaInset(edge: .top, spacing: 0) {
            patientIdentityCard
        }
    }

    @ViewBuilder
    private func sectionBackground(_ section: PatientDetailSection) -> some View {
        if selectedSection == section {
            AMColor.accent.opacity(0.14)
                .overlay(alignment: .leading) {
                    Rectangle()
                        .fill(AMColor.accent)
                        .frame(width: 3)
                }
        } else {
            Color.clear
        }
    }

    private var patientIdentityCard: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(AMColor.accent.opacity(0.2))
                    .frame(width: 38, height: 38)
                Text(patient.initials)
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(AMColor.sidebarActive)
            }
            VStack(alignment: .leading, spacing: 2) {
                Label(patient.setting.rawValue, systemImage: patient.setting.icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(AMColor.sidebarActive)
                HStack(spacing: 4) {
                    AcuityPip(acuity: patient.acuity)
                    Text("\(patient.sex.rawValue) · \(patient.ageYears)y")
                        .font(.system(size: 10))
                        .foregroundStyle(AMColor.sidebarText)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AMColor.sidebarHd)
        .overlay(alignment: .bottom) {
            Divider().overlay(AMColor.sidebarGroup)
        }
    }

    // MARK: Section content

    @ViewBuilder
    private var patientSectionContent: some View {
        switch selectedSection ?? .overview {
        case .overview:
            ScrollView {
                PatientOverviewContent(patient: patient)
                    .padding(20)
            }
            .background(AMColor.bg)
        case .consultation:
            ConsultationView(patient: patient)
        case .notes:
            List { NoteListView(patient: patient) }
        case .vitals:
            List { VitalsHistoryView(patient: patient) }
        case .prescriptions:
            PrescriptionView(patient: patient)
        case .billing:
            BillingView(patient: patient)
        case .operative:
            OperativePlanView(patient: patient)
        case .documents:
            DocumentsView(patient: patient)
        case .demographics:
            PatientDemographicsForm(patient: patient)
        }
    }
}

// MARK: - Patient section row (dark sidebar)

private struct PatientSectionRow: View {
    let section: PatientDetailSection
    let isSelected: Bool

    var body: some View {
        Label {
            Text(section.rawValue)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(isSelected ? AMColor.sidebarActive : AMColor.sidebarText)
        } icon: {
            Image(systemName: section.icon)
                .foregroundStyle(isSelected ? AMColor.sidebarActive : AMColor.sidebarText)
        }
        .padding(.vertical, 9)
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Overview content (shared between iPhone overview tab and iPad panel)

struct PatientOverviewContent: View {
    @Bindable var patient: Patient

    private var latestVitals: VitalsEntry? {
        patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
    }

    private var latestNote: ClinicalNote? {
        patient.clinicalNotes.sorted { $0.createdAt > $1.createdAt }.first
    }

    private func notePreview(_ note: ClinicalNote) -> String? {
        if note.noteType.isStructured {
            return [note.assessment, note.plan]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .first(where: { !$0.isEmpty })
        }
        return note.freeText.map { String($0.prefix(300)) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Header card — web-style with accent teal
            HStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(AMColor.accent.opacity(0.15))
                        .frame(width: 64, height: 64)
                    Text(patient.initials)
                        .font(.system(size: 24, weight: .heavy))
                        .foregroundStyle(AMColor.accentDk)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(patient.fullName)
                        .font(.system(size: 20, weight: .heavy))
                        .foregroundStyle(AMColor.ink)
                    HStack(spacing: 6) {
                        Text("\(patient.sex.rawValue), \(patient.ageYears)y")
                        Text("·")
                        Text(patient.location.rawValue)
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(AMColor.muted)
                    HStack(spacing: 6) {
                        AcuityPip(acuity: patient.acuity)
                        Label(patient.setting.rawValue, systemImage: patient.setting.icon)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(AMColor.accent)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AMColor.accentLt.opacity(0.5), in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(AMColor.accent.opacity(0.3), lineWidth: 1)
            )

            // Chief complaint
            if let cc = patient.chiefComplaint {
                overviewCard(title: "Chief Complaint") {
                    Text(cc)
                }
            }

            // Working diagnosis
            if let dx = patient.workingDiagnosis {
                overviewCard(title: "Working Diagnosis") {
                    HStack(spacing: 8) {
                        Image(systemName: "stethoscope").foregroundStyle(.teal)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(dx).font(.subheadline.weight(.medium))
                            if let icd = patient.workingDiagnosisICD {
                                Text(icd).font(.caption.monospaced()).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }

            // Admission
            if patient.setting == .inpatient || patient.setting == .emergency {
                overviewCard(title: "Admission") {
                    if let ward = patient.ward {
                        LabeledContent("Ward", value: ward)
                    }
                    if let bed = patient.bedNumber {
                        LabeledContent("Bed", value: bed)
                    }
                    if let admitted = patient.admittedAt {
                        LabeledContent("Admitted") { Text(admitted, style: .date) }
                    }
                }
            }

            // Post-operative
            if let days = patient.postOpDays {
                overviewCard(title: "Post-operative") {
                    LabeledContent("Post-op day", value: "POD \(days)")
                    if let op = patient.operationDate {
                        LabeledContent("Operation date") { Text(op, style: .date) }
                    }
                }
            }

            // Latest vitals
            if let v = latestVitals {
                overviewCard(title: "Latest Vitals — \(v.recordedAt.formatted(.relative(presentation: .named)))") {
                    HStack {
                        Spacer()
                        Text("NEWS2 \(v.news2Score) — \(v.news2Risk)")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color(hex: v.news2Color))
                    }
                    if let bp = v.bpString {
                        LabeledContent("BP", value: "\(bp) mmHg")
                    }
                    if let hr = v.heartRate {
                        LabeledContent("HR", value: "\(hr) bpm")
                    }
                    if let temp = v.temperatureCelsius {
                        LabeledContent("Temp", value: String(format: "%.1f °C", temp))
                    }
                    if let spo = v.spo2 {
                        LabeledContent("SpO₂", value: "\(spo)%")
                    }
                }
            }

            // Latest note
            if let note = latestNote {
                overviewCard(title: "Latest Note — \(note.noteType.label)") {
                    Text(note.createdAt, style: .relative)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let preview = notePreview(note) {
                        Text(preview).font(.callout).lineLimit(6)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func overviewCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).amSectionLabel()
            VStack(alignment: .leading, spacing: 8) {
                content()
            }
            .amCard()
        }
    }
}

// MARK: - Demographics form (shared between iPhone details tab and iPad panel)

struct PatientDemographicsForm: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State private var hasDOB: Bool = false

    var body: some View {
        Form {
            demographicsSection
            clinicalSection
            if patient.setting == .inpatient || patient.setting == .emergency {
                admissionSection
            }
            if patient.setting == .theatre || patient.setting == .endoscopy {
                procedureSection
            }
            extendedSection
            notesSection
        }
        .onAppear { hasDOB = patient.dateOfBirth != nil }
    }

    private func touch() {
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    // MARK: Identity

    @ViewBuilder
    private var demographicsSection: some View {
        Section("Identity") {
            TextField("Full name", text: $patient.fullName)
                .onChange(of: patient.fullName) { _, _ in touch() }
            Picker("Sex", selection: $patient.sex) {
                ForEach(Sex.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .onChange(of: patient.sex) { _, _ in touch() }
            Toggle("Date of birth", isOn: $hasDOB)
                .onChange(of: hasDOB) { _, on in
                    if !on { patient.dateOfBirth = nil; touch() }
                    else if patient.dateOfBirth == nil {
                        patient.dateOfBirth = Calendar.current.date(byAdding: .year, value: -40, to: .now)
                        touch()
                    }
                }
            if hasDOB {
                DatePicker("", selection: Binding(
                    get: { patient.dateOfBirth ?? .now },
                    set: { patient.dateOfBirth = $0; touch() }
                ), displayedComponents: .date)
                .labelsHidden()
                LabeledContent("Age") { Text("\(patient.ageYears) y") }
            }
            TextField("MRN (optional)", text: Binding(
                get: { patient.mrn ?? "" },
                set: { patient.mrn = $0.isEmpty ? nil : $0; touch() }
            ))
        }
        Section("Contact") {
            TextField("Phone", text: Binding(
                get: { patient.phone ?? "" },
                set: { patient.phone = $0.isEmpty ? nil : $0 }
            )).keyboardType(.phonePad)
            TextField("Email", text: Binding(
                get: { patient.email ?? "" },
                set: { patient.email = $0.isEmpty ? nil : $0 }
            )).keyboardType(.emailAddress).autocapitalization(.none)
            TextField("Address", text: Binding(
                get: { patient.address ?? "" },
                set: { patient.address = $0.isEmpty ? nil : $0 }
            ))
        }
    }

    // MARK: Clinical

    @ViewBuilder
    private var clinicalSection: some View {
        Section("Clinical") {
            Picker("Setting", selection: $patient.setting) {
                ForEach(ClinicalSetting.allCases, id: \.self) {
                    Label($0.rawValue, systemImage: $0.icon).tag($0)
                }
            }
            .onChange(of: patient.setting) { _, _ in touch() }
            Picker("Location", selection: $patient.location) {
                ForEach(ClinicalLocation.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .onChange(of: patient.location) { _, _ in touch() }
            Picker("Acuity", selection: $patient.acuity) {
                ForEach(Acuity.allCases, id: \.self) { acuity in
                    HStack {
                        AcuityPip(acuity: acuity)
                        Text(acuity.rawValue == 0 ? "Emergency" :
                             acuity.rawValue == 1 ? "Urgent" :
                             acuity.rawValue == 2 ? "Priority" : "Routine")
                    }.tag(acuity)
                }
            }
            .onChange(of: patient.acuity) { _, _ in touch() }
            Picker("Visit Type", selection: Binding(
                get: { patient.visitType ?? .newConsult },
                set: { patient.visitType = $0; touch() }
            )) {
                ForEach(VisitType.allCases, id: \.self) { vt in
                    Label(vt.rawValue, systemImage: vt.icon).tag(vt)
                }
            }
            TextField("Chief complaint", text: Binding(
                get: { patient.chiefComplaint ?? "" },
                set: { patient.chiefComplaint = $0.isEmpty ? nil : $0; touch() }
            ))
        }
    }

    // MARK: Admission

    @ViewBuilder
    private var admissionSection: some View {
        Section("Admission") {
            TextField("Ward", text: Binding(
                get: { patient.ward ?? "" },
                set: { patient.ward = $0.isEmpty ? nil : $0; touch() }
            ))
            TextField("Bed", text: Binding(
                get: { patient.bedNumber ?? "" },
                set: { patient.bedNumber = $0.isEmpty ? nil : $0; touch() }
            ))
        }
    }

    // MARK: Procedure

    @ViewBuilder
    private var procedureSection: some View {
        Section("Procedure") {
            TextField("Appointment / procedure type", text: Binding(
                get: { patient.appointmentType ?? "" },
                set: { patient.appointmentType = $0.isEmpty ? nil : $0; touch() }
            ))
            DatePicker("Operation date",
                       selection: Binding(
                           get: { patient.operationDate ?? .now },
                           set: { patient.operationDate = $0; touch() }
                       ),
                       displayedComponents: .date)
            if let days = patient.postOpDays {
                LabeledContent("Post-op day", value: "POD \(days)")
            }
        }
    }

    // MARK: Extended

    @ViewBuilder
    private var extendedSection: some View {
        Section("Medical History") {
            TextField("Past medical history", text: Binding(
                get: { patient.pmhNotes ?? "" },
                set: { patient.pmhNotes = $0.isEmpty ? nil : $0; touch() }
            ), axis: .vertical).lineLimit(3...)
            TextField("Family history", text: Binding(
                get: { patient.familyHistoryNotes ?? "" },
                set: { patient.familyHistoryNotes = $0.isEmpty ? nil : $0; touch() }
            ), axis: .vertical).lineLimit(2...)
        }
        Section("Next of Kin") {
            TextField("Name", text: Binding(
                get: { patient.nokName ?? "" },
                set: { patient.nokName = $0.isEmpty ? nil : $0; touch() }
            ))
            TextField("Relationship", text: Binding(
                get: { patient.nokRelation ?? "" },
                set: { patient.nokRelation = $0.isEmpty ? nil : $0; touch() }
            ))
            TextField("Phone", text: Binding(
                get: { patient.nokPhone ?? "" },
                set: { patient.nokPhone = $0.isEmpty ? nil : $0; touch() }
            )).keyboardType(.phonePad)
        }
        Section("Insurance") {
            TextField("Provider", text: Binding(
                get: { patient.insuranceProvider ?? "" },
                set: { patient.insuranceProvider = $0.isEmpty ? nil : $0; touch() }
            ))
            TextField("Policy number", text: Binding(
                get: { patient.policyNumber ?? "" },
                set: { patient.policyNumber = $0.isEmpty ? nil : $0; touch() }
            ))
        }
    }

    // MARK: Notes

    @ViewBuilder
    private var notesSection: some View {
        Section("General Notes") {
            TextEditor(text: Binding(
                get: { patient.notes ?? "" },
                set: { patient.notes = $0.isEmpty ? nil : $0; touch() }
            ))
            .frame(minHeight: 80)
        }
    }
}

// MARK: - iPhone: 5-tab patient detail (sheet presentation)

enum PatientTab { case overview, clinical, notes, vitals, demographics }

struct PatientDetailView: View {
    @Bindable var patient: Patient
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context

    @State private var selectedTab: PatientTab = .overview
    @State private var showDeleteConfirm = false

    var body: some View {
        NavigationStack {
            TabView(selection: $selectedTab) {
                ScrollView {
                    PatientOverviewContent(patient: patient)
                        .padding()
                }
                .tag(PatientTab.overview)
                .tabItem { Label("Overview", systemImage: "person.text.rectangle") }

                NavigationStack { ClinicalHubView(patient: patient) }
                    .tag(PatientTab.clinical)
                    .tabItem { Label("Clinical", systemImage: "stethoscope") }

                List { NoteListView(patient: patient) }
                    .tag(PatientTab.notes)
                    .tabItem { Label("Notes", systemImage: "note.text") }

                List { VitalsHistoryView(patient: patient) }
                    .tag(PatientTab.vitals)
                    .tabItem { Label("Vitals", systemImage: "waveform.path.ecg") }

                PatientDemographicsForm(patient: patient)
                    .tag(PatientTab.demographics)
                    .tabItem { Label("Details", systemImage: "square.and.pencil") }
            }
            .navigationTitle(patient.fullName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .destructive) { showDeleteConfirm = true } label: {
                        Image(systemName: "trash")
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog("Delete \(patient.fullName)?",
                                isPresented: $showDeleteConfirm,
                                titleVisibility: .visible) {
                Button("Delete Patient", role: .destructive) {
                    context.delete(patient)
                    try? context.save()
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will permanently remove all clinical records for this patient.")
            }
        }
    }
}
