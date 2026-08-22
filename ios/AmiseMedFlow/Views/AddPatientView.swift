import SwiftUI
import SwiftData

struct AddPatientView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    var initialSetting: ClinicalSetting

    @State private var fullName = ""
    @State private var sex: Sex = .unspecified
    @State private var hasDOB = false
    @State private var dateOfBirth = Date()
    @State private var phone = ""
    @State private var setting: ClinicalSetting
    @State private var location: ClinicalLocation = .rodney_bay
    @State private var acuity: Acuity = .routine
    @State private var chiefComplaint = ""
    @State private var appointmentType = ""
    @State private var ward = ""
    @State private var bedNumber = ""

    init(initialSetting: ClinicalSetting = .outpatient) {
        self.initialSetting = initialSetting
        _setting = State(initialValue: initialSetting)
    }

    private var showAdmission: Bool {
        setting == .inpatient || setting == .emergency
    }

    private var showProcedure: Bool {
        setting == .theatre || setting == .endoscopy
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Patient") {
                    TextField("Full name *", text: $fullName)
                    Picker("Sex", selection: $sex) {
                        ForEach(Sex.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    Toggle("Date of birth", isOn: $hasDOB)
                    if hasDOB {
                        DatePicker("", selection: $dateOfBirth, displayedComponents: .date)
                            .labelsHidden()
                    }
                    TextField("Phone", text: $phone)
                        .keyboardType(.phonePad)
                }

                Section("Clinical") {
                    Picker("Setting", selection: $setting) {
                        ForEach(ClinicalSetting.allCases, id: \.self) {
                            Label($0.rawValue, systemImage: $0.icon).tag($0)
                        }
                    }
                    Picker("Location", selection: $location) {
                        ForEach(ClinicalLocation.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    Picker("Acuity", selection: $acuity) {
                        ForEach(Acuity.allCases, id: \.self) {
                            HStack {
                                AcuityPip(acuity: $0)
                                Text($0.rawValue == 0 ? "Emergency" :
                                     $0.rawValue == 1 ? "Urgent" :
                                     $0.rawValue == 2 ? "Priority" : "Routine")
                            }.tag($0)
                        }
                    }
                    TextField("Chief complaint", text: $chiefComplaint)
                }

                if showAdmission {
                    Section("Admission") {
                        TextField("Ward", text: $ward)
                        TextField("Bed number", text: $bedNumber)
                    }
                }

                if showProcedure {
                    Section("Procedure") {
                        TextField("Appointment / procedure type", text: $appointmentType)
                    }
                }
            }
            .navigationTitle("New Patient")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }
                        .disabled(fullName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func save() {
        let p = Patient(
            fullName: fullName.trimmingCharacters(in: .whitespaces),
            sex: sex,
            setting: setting,
            location: location,
            acuity: acuity
        )
        if hasDOB { p.dateOfBirth = dateOfBirth }
        if !phone.isEmpty { p.phone = phone }
        if !chiefComplaint.isEmpty { p.chiefComplaint = chiefComplaint }
        if !appointmentType.isEmpty { p.appointmentType = appointmentType }
        if showAdmission {
            if !ward.isEmpty { p.ward = ward }
            if !bedNumber.isEmpty { p.bedNumber = bedNumber }
            p.admittedAt = .now
        }
        context.insert(p)
        dismiss()
    }
}
