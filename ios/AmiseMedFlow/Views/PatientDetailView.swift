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

// MARK: - Detail view

struct PatientDetailView: View {
    @Bindable var patient: Patient
    @Environment(\.dismiss) private var dismiss

    private var showAdmission: Bool {
        patient.setting == .inpatient || patient.setting == .emergency
    }

    private var showProcedure: Bool {
        patient.setting == .theatre || patient.setting == .endoscopy
    }

    var body: some View {
        NavigationStack {
            Form {
                // MARK: Demographics
                Section("Demographics") {
                    TextField("Full name", text: $patient.fullName)
                    Picker("Sex", selection: $patient.sex) {
                        ForEach(Sex.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    if let dob = patient.dateOfBirth {
                        LabeledContent("Age") { Text("\(patient.ageYears) y") }
                            .foregroundStyle(.secondary)
                        _ = dob
                    }
                    TextField("Phone", text: Binding(
                        get: { patient.phone ?? "" },
                        set: { patient.phone = $0.isEmpty ? nil : $0 }
                    ))
                    .keyboardType(.phonePad)
                    TextField("Email", text: Binding(
                        get: { patient.email ?? "" },
                        set: { patient.email = $0.isEmpty ? nil : $0 }
                    ))
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
                }

                // MARK: Clinical
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
                        ForEach(Acuity.allCases, id: \.self) {
                            HStack {
                                AcuityPip(acuity: $0)
                                Text($0.rawValue == 0 ? "Emergency" :
                                     $0.rawValue == 1 ? "Urgent" :
                                     $0.rawValue == 2 ? "Priority" : "Routine")
                            }.tag($0)
                        }
                    }
                    TextField("Chief complaint", text: Binding(
                        get: { patient.chiefComplaint ?? "" },
                        set: { patient.chiefComplaint = $0.isEmpty ? nil : $0 }
                    ))
                }

                // MARK: Admission (inpatient / emergency)
                if showAdmission {
                    Section("Admission") {
                        TextField("Ward", text: Binding(
                            get: { patient.ward ?? "" },
                            set: { patient.ward = $0.isEmpty ? nil : $0 }
                        ))
                        TextField("Bed", text: Binding(
                            get: { patient.bedNumber ?? "" },
                            set: { patient.bedNumber = $0.isEmpty ? nil : $0 }
                        ))
                        if let admitted = patient.admittedAt {
                            LabeledContent("Admitted") {
                                Text(admitted, style: .date)
                            }
                        }
                    }
                }

                // MARK: Procedure (theatre / endoscopy)
                if showProcedure {
                    Section("Procedure") {
                        TextField("Appointment / procedure type", text: Binding(
                            get: { patient.appointmentType ?? "" },
                            set: { patient.appointmentType = $0.isEmpty ? nil : $0 }
                        ))
                        if let opDate = patient.operationDate {
                            LabeledContent("Operation date") {
                                Text(opDate, style: .date)
                            }
                            if let days = patient.postOpDays {
                                LabeledContent("Post-op day") { Text("POD \(days)") }
                            }
                        }
                    }
                }

                // MARK: Notes
                Section("Notes") {
                    TextEditor(text: Binding(
                        get: { patient.notes ?? "" },
                        set: { patient.notes = $0.isEmpty ? nil : $0 }
                    ))
                    .frame(minHeight: 80)
                }
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
