import SwiftUI
import SwiftData

struct AddPatientView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    var initialSetting: ClinicalSetting

    // Identity
    @State private var fullName = ""
    @State private var sex: Sex = .unspecified
    @State private var hasDOB = false
    @State private var dateOfBirth = Date()
    @State private var phone = ""
    @State private var email = ""
    @State private var mrn = ""

    // Clinical
    @State private var setting: ClinicalSetting
    @State private var location: ClinicalLocation = .rodney_bay
    @State private var acuity: Acuity = .routine
    @State private var chiefComplaint = ""
    @State private var appointmentType = ""

    // Admission
    @State private var ward = ""
    @State private var bedNumber = ""

    // Extended
    @State private var nokName = ""
    @State private var nokRelation = ""
    @State private var nokPhone = ""
    @State private var pmhNotes = ""

    init(initialSetting: ClinicalSetting = .outpatient) {
        self.initialSetting = initialSetting
        _setting = State(initialValue: initialSetting)
    }

    private var showAdmission: Bool { setting == .inpatient || setting == .emergency }
    private var showProcedure: Bool { setting == .theatre || setting == .endoscopy }
    private var nameValid: Bool { !fullName.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                patientSection
                clinicalSection
                if showAdmission { admissionSection }
                nokSection
                historySection
            }
            .navigationTitle("New Patient")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }.disabled(!nameValid)
                }
            }
        }
    }

    @ViewBuilder
    private var patientSection: some View {
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
            TextField("Phone", text: $phone).keyboardType(.phonePad)
            TextField("Email", text: $email)
                .keyboardType(.emailAddress)
                .autocapitalization(.none)
            TextField("MRN (optional)", text: $mrn)
        }
    }

    @ViewBuilder
    private var clinicalSection: some View {
        Section("Clinical") {
            Picker("Setting", selection: $setting) {
                ForEach(ClinicalSetting.allCases, id: \.self) { s in
                    Label(s.rawValue, systemImage: s.icon).tag(s)
                }
            }
            Picker("Location", selection: $location) {
                ForEach(ClinicalLocation.allCases, id: \.self) { loc in
                    Text(loc.rawValue).tag(loc)
                }
            }
            Picker("Acuity", selection: $acuity) {
                ForEach(Acuity.allCases, id: \.self) { a in
                    HStack {
                        AcuityPip(acuity: a)
                        Text(a.rawValue == 0 ? "Emergency" :
                             a.rawValue == 1 ? "Urgent" :
                             a.rawValue == 2 ? "Priority" : "Routine")
                    }.tag(a)
                }
            }
            TextField("Chief complaint", text: $chiefComplaint)
            if showProcedure {
                TextField("Procedure / appointment type", text: $appointmentType)
            }
        }
    }

    @ViewBuilder
    private var admissionSection: some View {
        Section("Admission") {
            TextField("Ward", text: $ward)
            TextField("Bed number", text: $bedNumber)
        }
    }

    @ViewBuilder
    private var nokSection: some View {
        Section("Next of Kin") {
            TextField("Name", text: $nokName)
            TextField("Relationship", text: $nokRelation)
            TextField("Phone", text: $nokPhone).keyboardType(.phonePad)
        }
    }

    @ViewBuilder
    private var historySection: some View {
        Section("Medical History") {
            TextEditor(text: $pmhNotes)
                .frame(minHeight: 60)
                .overlay(alignment: .topLeading) {
                    if pmhNotes.isEmpty {
                        Text("Past medical / surgical history")
                            .foregroundStyle(.tertiary)
                            .padding(.top, 8)
                            .padding(.leading, 4)
                            .allowsHitTesting(false)
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
        if hasDOB               { p.dateOfBirth = dateOfBirth }
        if !phone.isEmpty       { p.phone = phone }
        if !email.isEmpty       { p.email = email }
        if !mrn.isEmpty         { p.mrn = mrn }
        if !chiefComplaint.isEmpty   { p.chiefComplaint = chiefComplaint }
        if !appointmentType.isEmpty  { p.appointmentType = appointmentType }
        if !nokName.isEmpty     { p.nokName = nokName }
        if !nokRelation.isEmpty { p.nokRelation = nokRelation }
        if !nokPhone.isEmpty    { p.nokPhone = nokPhone }
        if !pmhNotes.isEmpty    { p.pmhNotes = pmhNotes }
        if showAdmission {
            if !ward.isEmpty      { p.ward = ward }
            if !bedNumber.isEmpty { p.bedNumber = bedNumber }
            p.admittedAt = .now
        }
        context.insert(p)
        dismiss()
    }
}
