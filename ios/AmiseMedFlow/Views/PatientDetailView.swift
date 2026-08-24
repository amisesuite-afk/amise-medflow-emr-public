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
    @State private var selectedSection: PatientDetailSection = .overview

    var body: some View {
        HStack(spacing: 0) {
            patientSectionSidebar
            Divider()
            patientSectionContent
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .navigationTitle(patient.fullName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 1) {
                    Text(patient.fullName).font(.headline)
                    Text("\(patient.sex.rawValue) · \(patient.ageYears)y · \(selectedSection.rawValue)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    // MARK: Section sidebar

    private var patientSectionSidebar: some View {
        List(selection: $selectedSection) {
            ForEach(PatientDetailSection.allCases) { section in
                Label(section.rawValue, systemImage: section.icon)
                    .tag(section)
            }
        }
        .listStyle(.sidebar)
        .frame(width: 220)
        .safeAreaInset(edge: .top, spacing: 0) {
            patientIdentityCard
        }
    }

    private var patientIdentityCard: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(Color(hex: patient.setting.accentHex).opacity(0.15))
                    .frame(width: 40, height: 40)
                Text(patient.initials)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color(hex: patient.setting.accentHex))
            }
            VStack(alignment: .leading, spacing: 2) {
                Label(patient.setting.rawValue, systemImage: patient.setting.icon)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color(hex: patient.setting.accentHex))
                HStack(spacing: 4) {
                    AcuityPip(acuity: patient.acuity)
                    Text(patient.location.rawValue)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: patient.setting.accentHex).opacity(0.05))
        .overlay(alignment: .bottom) { Divider() }
    }

    // MARK: Section content

    @ViewBuilder
    private var patientSectionContent: some View {
        switch selectedSection {
        case .overview:
            ScrollView {
                PatientOverviewContent(patient: patient)
                    .padding()
            }
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
            // Header card
            HStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(Color(hex: patient.setting.accentHex).opacity(0.15))
                        .frame(width: 64, height: 64)
                    Text(patient.initials)
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(Color(hex: patient.setting.accentHex))
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(patient.fullName).font(.title2.weight(.semibold))
                    HStack(spacing: 6) {
                        Text("\(patient.sex.rawValue), \(patient.ageYears)y")
                        Text("·")
                        Text(patient.location.rawValue)
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    HStack(spacing: 6) {
                        AcuityPip(acuity: patient.acuity)
                        Label(patient.setting.rawValue, systemImage: patient.setting.icon)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color(hex: patient.setting.accentHex))
                    }
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(hex: patient.setting.accentHex).opacity(0.06), in: RoundedRectangle(cornerRadius: 12))

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
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.5)
            VStack(alignment: .leading, spacing: 6) {
                content()
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 10))
        }
    }
}

// MARK: - Demographics form (shared between iPhone details tab and iPad panel)

struct PatientDemographicsForm: View {
    @Bindable var patient: Patient

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
    }

    // MARK: Identity

    @ViewBuilder
    private var demographicsSection: some View {
        Section("Identity") {
            TextField("Full name", text: $patient.fullName)
            Picker("Sex", selection: $patient.sex) {
                ForEach(Sex.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            if patient.dateOfBirth != nil {
                LabeledContent("Age") { Text("\(patient.ageYears) y") }
            }
            if let mrn = patient.mrn { LabeledContent("MRN", value: mrn) }
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
            Picker("Location", selection: $patient.location) {
                ForEach(ClinicalLocation.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
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
            TextField("Chief complaint", text: Binding(
                get: { patient.chiefComplaint ?? "" },
                set: { patient.chiefComplaint = $0.isEmpty ? nil : $0 }
            ))
        }
    }

    // MARK: Admission

    @ViewBuilder
    private var admissionSection: some View {
        Section("Admission") {
            TextField("Ward", text: Binding(
                get: { patient.ward ?? "" },
                set: { patient.ward = $0.isEmpty ? nil : $0 }
            ))
            TextField("Bed", text: Binding(
                get: { patient.bedNumber ?? "" },
                set: { patient.bedNumber = $0.isEmpty ? nil : $0 }
            ))
        }
    }

    // MARK: Procedure

    @ViewBuilder
    private var procedureSection: some View {
        Section("Procedure") {
            TextField("Appointment / procedure type", text: Binding(
                get: { patient.appointmentType ?? "" },
                set: { patient.appointmentType = $0.isEmpty ? nil : $0 }
            ))
            if let opDate = patient.operationDate {
                LabeledContent("Operation date") { Text(opDate, style: .date) }
                if let days = patient.postOpDays {
                    LabeledContent("Post-op day", value: "POD \(days)")
                }
            }
        }
    }

    // MARK: Extended

    @ViewBuilder
    private var extendedSection: some View {
        Section("Medical History") {
            TextField("Past medical history", text: Binding(
                get: { patient.pmhNotes ?? "" },
                set: { patient.pmhNotes = $0.isEmpty ? nil : $0 }
            ), axis: .vertical).lineLimit(3...)
            TextField("Family history", text: Binding(
                get: { patient.familyHistoryNotes ?? "" },
                set: { patient.familyHistoryNotes = $0.isEmpty ? nil : $0 }
            ), axis: .vertical).lineLimit(2...)
        }
        Section("Next of Kin") {
            TextField("Name", text: Binding(
                get: { patient.nokName ?? "" },
                set: { patient.nokName = $0.isEmpty ? nil : $0 }
            ))
            TextField("Relationship", text: Binding(
                get: { patient.nokRelation ?? "" },
                set: { patient.nokRelation = $0.isEmpty ? nil : $0 }
            ))
            TextField("Phone", text: Binding(
                get: { patient.nokPhone ?? "" },
                set: { patient.nokPhone = $0.isEmpty ? nil : $0 }
            )).keyboardType(.phonePad)
        }
        Section("Insurance") {
            TextField("Provider", text: Binding(
                get: { patient.insuranceProvider ?? "" },
                set: { patient.insuranceProvider = $0.isEmpty ? nil : $0 }
            ))
            TextField("Policy number", text: Binding(
                get: { patient.policyNumber ?? "" },
                set: { patient.policyNumber = $0.isEmpty ? nil : $0 }
            ))
        }
    }

    // MARK: Notes

    @ViewBuilder
    private var notesSection: some View {
        Section("Clinical Notes (free text)") {
            TextEditor(text: Binding(
                get: { patient.notes ?? "" },
                set: { patient.notes = $0.isEmpty ? nil : $0 }
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

    @State private var selectedTab: PatientTab = .overview

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
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
