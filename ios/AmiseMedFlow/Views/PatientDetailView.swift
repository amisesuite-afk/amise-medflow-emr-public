import SwiftUI
import SwiftData

// MARK: - Shared colour helper

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: Double
        switch hex.count {
        case 6:
            (r, g, b) = (Double((int >> 16) & 0xFF) / 255,
                         Double((int >> 8)  & 0xFF) / 255,
                         Double( int        & 0xFF) / 255)
        default:
            (r, g, b) = (1, 1, 1)
        }
        self.init(red: r, green: g, blue: b)
    }
}

// MARK: - Shared acuity indicator

struct AcuityPip: View {
    let acuity: Acuity
    var body: some View {
        Circle()
            .fill(Color(hex: acuity.color))
            .frame(width: 10, height: 10)
    }
}

// MARK: - Detail view (tabbed)

enum PatientTab { case overview, assessment, notes, prescriptions, vitals, demographics }

struct PatientDetailView: View {
    @Bindable var patient: Patient
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context

    @State private var selectedTab: PatientTab = .overview

    var body: some View {
        NavigationStack {
            TabView(selection: $selectedTab) {
                // MARK: Overview
                List {
                    overviewSection
                }
                .tag(PatientTab.overview)
                .tabItem { Label("Overview", systemImage: "person.text.rectangle") }

                // MARK: Assessment
                NavigationStack {
                    AssessmentView(patient: patient)
                }
                .tag(PatientTab.assessment)
                .tabItem { Label("Assess", systemImage: "stethoscope") }

                // MARK: Notes
                List {
                    NoteListView(patient: patient)
                }
                .tag(PatientTab.notes)
                .tabItem { Label("Notes", systemImage: "note.text") }

                // MARK: Prescriptions
                NavigationStack {
                    PrescriptionView(patient: patient)
                }
                .tag(PatientTab.prescriptions)
                .tabItem { Label("Rx", systemImage: "pills") }

                // MARK: Vitals
                List {
                    VitalsHistoryView(patient: patient)
                }
                .tag(PatientTab.vitals)
                .tabItem { Label("Vitals", systemImage: "waveform.path.ecg") }

                // MARK: Demographics
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
                .tag(PatientTab.demographics)
                .tabItem { Label("Details", systemImage: "square.and.pencil") }
            }
            .navigationTitle(patient.fullName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    NavigationLink {
                        DocumentsView(patient: patient)
                    } label: {
                        Label("Docs", systemImage: "doc.badge.plus")
                    }
                }
            }
        }
    }

    // MARK: - Overview section

    @ViewBuilder
    private var overviewSection: some View {
        Section {
            // Header card
            HStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(Color(hex: patient.setting.accentHex).opacity(0.15))
                        .frame(width: 60, height: 60)
                    Text(patient.initials)
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(Color(hex: patient.setting.accentHex))
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(patient.fullName).font(.title3.weight(.semibold))
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
            .padding(.vertical, 4)
        }

        if let cc = patient.chiefComplaint {
            Section("Chief Complaint") {
                Text(cc)
            }
        }

        if let dx = patient.workingDiagnosis {
            Section("Working Diagnosis") {
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

        if let days = patient.postOpDays {
            Section("Post-operative") {
                LabeledContent("Post-op day", value: "POD \(days)")
                if let op = patient.operationDate {
                    LabeledContent("Operation date") { Text(op, style: .date) }
                }
            }
        }

        if patient.setting == .inpatient || patient.setting == .emergency {
            Section("Admission") {
                if let ward = patient.ward { LabeledContent("Ward", value: ward) }
                if let bed = patient.bedNumber { LabeledContent("Bed", value: bed) }
                if let admitted = patient.admittedAt {
                    LabeledContent("Admitted") { Text(admitted, style: .date) }
                }
            }
        }

        // Latest vitals summary
        if let latest = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first {
            Section("Latest Vitals") {
                HStack {
                    Text(latest.recordedAt, style: .relative)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("NEWS2 \(latest.news2Score) — \(latest.news2Risk)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color(hex: latest.news2Color))
                }
                if let bp = latest.bpString {
                    LabeledContent("BP", value: "\(bp) mmHg")
                }
                if let hr = latest.heartRate {
                    LabeledContent("HR", value: "\(hr) bpm")
                }
                if let temp = latest.temperatureCelsius {
                    LabeledContent("Temp", value: String(format: "%.1f °C", temp))
                }
                if let spo = latest.spo2 {
                    LabeledContent("SpO₂", value: "\(spo)%")
                }
            }
        }

        // Latest note preview
        if let latestNote = patient.clinicalNotes.sorted(by: { $0.createdAt > $1.createdAt }).first {
            Section("Latest Note — \(latestNote.noteType.label)") {
                Text(latestNote.createdAt, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                let preview = latestNote.noteType.isStructured
                    ? [latestNote.assessment, latestNote.plan]
                        .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                        .first(where: { !$0.isEmpty })
                    : latestNote.freeText?.prefix(300).description
                if let p = preview {
                    Text(p).font(.callout).lineLimit(5)
                }
            }
        }
    }

    // MARK: - Demographics

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

    // MARK: - Clinical settings

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

    // MARK: - Admission

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

    // MARK: - Procedure

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

    // MARK: - Extended demographics

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

    // MARK: - Notes

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
