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
    @State private var visitType: VisitType = .newConsult
    @State private var chiefComplaint = ""
    @State private var appointmentType = ""

    // Admission
    @State private var ward = ""
    @State private var bedNumber = ""
    @State private var hasExpectedDischarge = false
    @State private var expectedDischarge = Date(timeIntervalSinceNow: 3 * 86400)

    // Procedure (theatre / endoscopy)
    @State private var hasOperationDate = false
    @State private var operationDate = Date()

    // Extended
    @State private var nokName = ""
    @State private var nokRelation = ""
    @State private var nokPhone = ""
    @State private var pmhNotes = ""
    @State private var surgicalHistory = ""
    @State private var familyHistoryNotes = ""

    init(initialSetting: ClinicalSetting = .outpatient,
         initialName: String = "",
         initialProcedure: String = "",
         operationDate: Date? = nil) {
        self.initialSetting = initialSetting
        _setting = State(initialValue: initialSetting)
        _fullName = State(initialValue: initialName)
        _appointmentType = State(initialValue: initialProcedure)
        if let d = operationDate {
            _hasOperationDate = State(initialValue: true)
            _operationDate = State(initialValue: d)
        }
    }

    private var showAdmission: Bool { setting == .inpatient || setting == .emergency }
    private var showProcedure: Bool { setting == .theatre || setting == .endoscopy }
    private var nameValid: Bool { !fullName.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                patientSection
                clinicalSection
                if showAdmission  { admissionSection }
                if showProcedure  { procedureSection }
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
            HStack(spacing: 8) {
                TextField("MRN (optional)", text: $mrn)
                if mrn.isEmpty {
                    Button("Generate") {
                        let digits = (0..<6).map { _ in String(Int.random(in: 0...9)) }.joined()
                        mrn = "AMI-\(digits)"
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AMColor.accent)
                    .buttonStyle(.bordered)
                }
            }
        }
    }

    @ViewBuilder
    private var clinicalSection: some View {
        // MARK: Location — large tap targets
        Section {
            VStack(alignment: .leading, spacing: 8) {
                Text("Location")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    ForEach(ClinicalLocation.allCases, id: \.self) { loc in
                        let sel = location == loc
                        let color = locationAccent(loc)
                        Button { location = loc } label: {
                            VStack(spacing: 4) {
                                Image(systemName: locationIcon(loc))
                                    .font(.system(size: 18, weight: sel ? .semibold : .regular))
                                Text(loc.rawValue)
                                    .font(.system(size: 11, weight: .semibold))
                                    .multilineTextAlignment(.center)
                                    .lineLimit(2)
                            }
                            .foregroundStyle(sel ? .white : color)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(sel ? color : color.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(sel ? color : color.opacity(0.3), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .animation(.easeInOut(duration: 0.12), value: sel)
                    }
                }
            }
            .padding(.vertical, 4)
        } header: { EmptyView() }

        // MARK: Clinical setting
        Section("Clinical Setting") {
            Picker("Setting", selection: $setting) {
                ForEach(ClinicalSetting.allCases, id: \.self) { s in
                    Label(s.rawValue, systemImage: s.icon).tag(s)
                }
            }
            .pickerStyle(.segmented)

            Picker("Acuity", selection: $acuity) {
                ForEach(Acuity.allCases, id: \.self) { a in
                    HStack {
                        AcuityPip(acuity: a)
                        Text(a.label)
                    }.tag(a)
                }
            }
        }

        // MARK: Visit type — chip row
        Section("Visit Type") {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(VisitType.allCases, id: \.self) { vt in
                        let sel = visitType == vt
                        let color = Color(hex: vt.accentHex)
                        Button {
                            visitType = vt
                            // Auto-set setting from visit type
                            switch vt {
                            case .ogd, .colonoscopy, .ercp:
                                if setting != .endoscopy { setting = .endoscopy }
                            case .surgeryElective, .dayOfSurgery:
                                if setting != .theatre { setting = .theatre }
                            case .surgeryEmergency, .trauma:
                                if setting != .emergency { setting = .emergency }
                            default: break
                            }
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: vt.icon).font(.system(size: 10))
                                Text(vt.rawValue).font(.system(size: 11, weight: sel ? .semibold : .regular))
                            }
                            .foregroundStyle(sel ? .white : color)
                            .padding(.horizontal, 9).padding(.vertical, 5)
                            .background(sel ? color : color.opacity(0.1), in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .animation(.easeInOut(duration: 0.12), value: sel)
                    }
                }
                .padding(.vertical, 4)
            }
        }

        // MARK: Chief complaint — search field + quick chips
        Section("Chief Complaint") {
            TextField("Type complaint", text: $chiefComplaint)

            let quickComplaints: [String] = [
                "Abdominal pain", "RUQ pain", "RLQ pain", "Epigastric pain",
                "Rectal bleeding", "Change in bowel habit", "Dysphagia",
                "Jaundice", "Hernia (inguinal)", "Hernia (umbilical)", "Hernia (incisional)",
                "Breast lump", "Neck lump / thyroid", "Haematemesis",
                "Haemorrhoids / PR bleed", "Anal pain / fissure", "Pilonidal sinus",
                "Acute appendicitis", "Acute cholecystitis", "Pancreatitis",
                "Bowel obstruction", "Perforated viscus", "Trauma",
                "Follow-up", "Post-op wound review", "Screening",
            ]
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(quickComplaints, id: \.self) { cc in
                        let selected = chiefComplaint == cc
                        Button(cc) { chiefComplaint = selected ? "" : cc }
                            .font(.system(size: 11, weight: selected ? .semibold : .regular))
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(selected ? Color.teal : Color.teal.opacity(0.1), in: Capsule())
                            .foregroundStyle(selected ? Color.white : Color.teal)
                            .buttonStyle(.plain)
                            .animation(.easeInOut(duration: 0.12), value: selected)
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    private func locationAccent(_ loc: ClinicalLocation) -> Color {
        switch loc {
        case .tapion:     return Color(hex: "#0891B2")
        case .rodney_bay: return Color(hex: "#7C3AED")
        case .okeu:       return Color(hex: "#DC2626")
        case .victoria:   return Color(hex: "#2563EB")
        case .other:      return Color.gray
        }
    }

    private func locationIcon(_ loc: ClinicalLocation) -> String {
        switch loc {
        case .tapion:     return "cross.circle"
        case .rodney_bay: return "building.2"
        case .okeu:       return "staroflife"
        case .victoria:   return "building"
        case .other:      return "mappin.circle"
        }
    }

    @ViewBuilder
    private var admissionSection: some View {
        Section("Admission") {
            TextField("Ward", text: $ward)
            TextField("Bed number", text: $bedNumber)
            Toggle("Expected discharge date", isOn: $hasExpectedDischarge)
            if hasExpectedDischarge {
                DatePicker("", selection: $expectedDischarge, displayedComponents: .date)
                    .labelsHidden()
            }
        }
    }

    @ViewBuilder
    private var procedureSection: some View {
        Section(setting == .endoscopy ? "Endoscopy" : "Procedure") {
            TextField(
                setting == .endoscopy ? "Scope type (e.g. OGD, Colonoscopy, ERCP)" : "Procedure name",
                text: $appointmentType
            )

            let quickProcs: [String] = setting == .endoscopy
                ? ["OGD / Gastroscopy", "Colonoscopy", "ERCP", "Flexible sigmoidoscopy", "Bronchoscopy", "OGD + Colonoscopy"]
                : ["Laparoscopic cholecystectomy", "Laparoscopic appendicectomy", "Inguinal hernia repair",
                   "Umbilical hernia repair", "Incisional hernia repair", "Haemorrhoidectomy",
                   "Colectomy", "Laparotomy", "Thyroidectomy", "Mastectomy", "Breast lumpectomy",
                   "Pilonidal sinus excision", "Anal fissure surgery", "I&D abscess"]
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(quickProcs, id: \.self) { proc in
                        let selected = appointmentType == proc
                        Button(proc) { appointmentType = selected ? "" : proc }
                            .font(.system(size: 11, weight: selected ? .semibold : .regular))
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(selected ? Color.purple : Color.purple.opacity(0.1), in: Capsule())
                            .foregroundStyle(selected ? Color.white : Color.purple)
                            .buttonStyle(.plain)
                            .animation(.easeInOut(duration: 0.12), value: selected)
                    }
                }
                .padding(.vertical, 4)
            }

            Toggle("Set date/time", isOn: $hasOperationDate)
            if hasOperationDate {
                DatePicker(
                    "Date & time",
                    selection: $operationDate,
                    displayedComponents: [.date, .hourAndMinute]
                )
            }
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
                        Text("Past medical history")
                            .foregroundStyle(.tertiary)
                            .padding(.top, 8)
                            .padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            TextEditor(text: $surgicalHistory)
                .frame(minHeight: 40)
                .overlay(alignment: .topLeading) {
                    if surgicalHistory.isEmpty {
                        Text("Surgical history")
                            .foregroundStyle(.tertiary)
                            .padding(.top, 8)
                            .padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            TextEditor(text: $familyHistoryNotes)
                .frame(minHeight: 40)
                .overlay(alignment: .topLeading) {
                    if familyHistoryNotes.isEmpty {
                        Text("Family history")
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
        p.visitType = visitType
        if !chiefComplaint.isEmpty   { p.chiefComplaint = chiefComplaint }
        if !appointmentType.isEmpty  { p.appointmentType = appointmentType }
        if !nokName.isEmpty     { p.nokName = nokName }
        if !nokRelation.isEmpty { p.nokRelation = nokRelation }
        if !nokPhone.isEmpty    { p.nokPhone = nokPhone }
        if !pmhNotes.isEmpty    { p.pmhNotes = pmhNotes }
        if !surgicalHistory.isEmpty    { p.surgicalHistory = surgicalHistory }
        if !familyHistoryNotes.isEmpty { p.familyHistoryNotes = familyHistoryNotes }
        if showAdmission {
            if !ward.isEmpty      { p.ward = ward }
            if !bedNumber.isEmpty { p.bedNumber = bedNumber }
            p.admittedAt = .now
            if hasExpectedDischarge { p.expectedDischarge = expectedDischarge }
        }
        if showProcedure && hasOperationDate {
            p.operationDate = operationDate
        }
        context.insert(p)
        try? context.save()
        dismiss()
    }
}
