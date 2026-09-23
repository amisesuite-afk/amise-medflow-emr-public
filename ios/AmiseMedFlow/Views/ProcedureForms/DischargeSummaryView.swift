import SwiftUI
import SwiftData

// MARK: - Data model

struct DischargeSummaryData: Codable {
    var admissionDate: Date?
    var dischargeDate: Date?
    var admissionDiagnosis: String = ""
    var dischargeDiagnosis: String = ""
    var icdCode: String = ""
    var surgeonName: String = "Dr Dawit Daniel Kabiye MD DM"
    var admittingDoctor: String = ""
    var anaesthetistName: String = ""
    var ward: String = ""
    var procedurePerformed: String = ""
    var inHospitalCourse: String = ""
    var complicationsInHospital: String = ""
    var bloodTransfusion: Bool = false
    var bloodUnits: String = ""
    var ituAdmission: Bool = false
    var ituDays: String = ""
    var pathologyResults: String = ""
    var imagingResults: String = ""
    var dischargeMedications: String = ""
    var woundCare: String = ""
    var drainInSitu: Bool = false
    var drainType: String = ""
    var drainRemovalDate: Date?
    var activityRestrictions: String = ""
    var dietaryAdvice: String = ""
    var returnPrecautions: [String] = []
    var returnPrecautionsOther: String = ""
    var followUpAppointment: String = ""
    var gpNotified: Bool = false
    var gpName: String = ""
    var dischargeDestination: String = "Home"
    var mobileStatus: String = "Ambulatory"
    var vteAssessment: String = "Low risk"
    var vteProphylaxisGiven: Bool = false
    var vteProphylaxisAgent: String = ""
    var vteProphylaxisDuration: String = ""
    var additionalNotes: String = ""
}

extension Patient {
    var dischargeSummaryData: DischargeSummaryData {
        get {
            guard let json = dischargeSummaryDataJson,
                  let raw = json.data(using: .utf8) else {
                // Pre-populate from patient model fields
                var d = DischargeSummaryData()
                d.admissionDate        = admittedAt
                d.dischargeDate        = expectedDischarge
                d.dischargeDiagnosis   = workingDiagnosis ?? ""
                d.ward                 = ward ?? ""
                return d
            }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            return (try? decoder.decode(DischargeSummaryData.self, from: raw)) ?? DischargeSummaryData()
        }
        set {
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            dischargeSummaryDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}

// MARK: - View

struct DischargeSummaryView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State private var data = DischargeSummaryData()
    @State private var hasAdmissionDate = false
    @State private var hasDischargeDate = false
    @State private var hasDrainRemovalDate = false
    @State private var pdfWrapper: PDFDataWrapper?

    private let returnPrecautionOptions = [
        "Fever > 38°C", "Worsening pain uncontrolled by analgesia",
        "Wound redness, swelling, or discharge", "Increasing abdominal distension",
        "Nausea / vomiting persisting > 24 h", "Difficulty swallowing",
        "Shortness of breath or chest pain", "Inability to pass urine",
        "Fainting or collapse", "Bleeding from wound or rectum"
    ]

    var body: some View {
        Form {
            admissionSection
            diagnosisSection
            procedureSection
            courseSection
            resultsSection
            dischargeStatusSection
            woundDrainSection
            restrictionsSection
            returnPrecautionsSection
            followUpSection
            gpSection
            if !data.additionalNotes.isEmpty || true { additionalSection }
        }
        .navigationTitle("Discharge Summary")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    let pdf = ProcedureFormPDF.dischargeSummary(patient: patient, data: data)
                    pdfWrapper = PDFDataWrapper(data: pdf)
                } label: {
                    Label("Export PDF", systemImage: "arrow.up.doc.fill")
                }
            }
        }
        .sheet(item: $pdfWrapper) { wrapper in
            ShareSheet(items: [wrapper.data])
        }
        .onAppear {
            data = patient.dischargeSummaryData
            hasAdmissionDate  = data.admissionDate != nil
            hasDischargeDate  = data.dischargeDate != nil
            hasDrainRemovalDate = data.drainRemovalDate != nil

            // Cross-populate from surgery note (only if the field is still blank)
            let sx = patient.surgeryData
            if data.procedurePerformed.isEmpty { data.procedurePerformed = sx.procedureName }
            if data.anaesthetistName.isEmpty   { data.anaesthetistName   = sx.anaesthetist }
            if data.admittingDoctor.isEmpty    {
                data.admittingDoctor = StaffRegistry.shared.names(for: .surgeon).first ?? ""
            }
            if data.followUpAppointment.isEmpty, !sx.followUpWeeks.isEmpty {
                data.followUpAppointment = "Review in \(sx.followUpWeeks) weeks"
            }
            if !data.drainInSitu && sx.drainInserted {
                data.drainInSitu = true
                if data.drainType.isEmpty { data.drainType = sx.drainType }
            }

            // Pre-fill admission diagnosis from chief complaint when blank
            if data.admissionDiagnosis.isEmpty, let cc = patient.chiefComplaint, !cc.isEmpty {
                data.admissionDiagnosis = cc
            }

            // Pre-fill ICD code from working diagnosis when blank
            if data.icdCode.isEmpty, let icd = patient.workingDiagnosisICD, !icd.isEmpty {
                data.icdCode = icd
            }

            // Build in-hospital course narrative from completed encounters
            if data.inHospitalCourse.isEmpty {
                let closedEncounters = patient.encounters
                    .filter { $0.isComplete }
                    .sorted { $0.encounterDate < $1.encounterDate }
                if !closedEncounters.isEmpty {
                    let df2 = DateFormatter(); df2.dateStyle = .medium; df2.timeStyle = .none
                    let courseLines = closedEncounters.compactMap { enc -> String? in
                        var parts: [String] = ["\(df2.string(from: enc.encounterDate)) — \(enc.visitType.rawValue)"]
                        if let dx = enc.workingDiagnosis, !dx.isEmpty { parts.append(dx) }
                        if let plan = enc.managementPlan, !plan.isEmpty { parts.append(plan) }
                        return parts.joined(separator: ": ")
                    }
                    if !courseLines.isEmpty {
                        data.inHospitalCourse = courseLines.joined(separator: "\n")
                    }
                }
            }

            // Pre-fill discharge medications from active prescriptions when blank
            if data.dischargeMedications.isEmpty {
                let rxLines = patient.prescriptions.map { $0.displayLine }
                if !rxLines.isEmpty {
                    data.dischargeMedications = rxLines.joined(separator: "\n")
                }
            }

            // Auto-populate results fields from resulted investigations
            let pathInvs = patient.investigations
                .filter { $0.status == .resulted && !$0.result.isEmpty &&
                          ($0.category == .pathology || $0.category == .endoscopy) }
                .sorted { ($0.resultedAt ?? $0.orderedAt) > ($1.resultedAt ?? $1.orderedAt) }
            let imagingInvs = patient.investigations
                .filter { $0.status == .resulted && !$0.result.isEmpty && $0.category == .imaging }
                .sorted { ($0.resultedAt ?? $0.orderedAt) > ($1.resultedAt ?? $1.orderedAt) }
            if data.pathologyResults.isEmpty && !pathInvs.isEmpty {
                data.pathologyResults = pathInvs.map { "\($0.name): \($0.result)" }.joined(separator: "\n")
            }
            if data.imagingResults.isEmpty && !imagingInvs.isEmpty {
                data.imagingResults = imagingInvs.map { "\($0.name): \($0.result)" }.joined(separator: "\n")
            }

            // Auto-select return precautions based on procedure type
            if data.returnPrecautions.isEmpty && !data.procedurePerformed.isEmpty {
                let proc = data.procedurePerformed.lowercased()
                var picks = Set<String>()
                picks.insert("Fever > 38°C")
                picks.insert("Worsening pain uncontrolled by analgesia")
                let abdominalKW = ["laparoscop","laparotom","hernia","appendicect","cholecyst","colectom",
                                   "sigmoid","rectal","bowel","gastric","oesophag","esophag","abdomin",
                                   "pancreat","splenect","liver","hepat","biliar","whipple"]
                if abdominalKW.contains(where: { proc.contains($0) }) {
                    picks.formUnion(["Wound redness, swelling, or discharge",
                                     "Increasing abdominal distension",
                                     "Nausea / vomiting persisting > 24 h",
                                     "Inability to pass urine"])
                }
                let endoscopicKW = ["gastroscop","ogd","endoscop","colonoscop","ercp","scope"]
                if endoscopicKW.contains(where: { proc.contains($0) }) {
                    picks.formUnion(["Nausea / vomiting persisting > 24 h",
                                     "Difficulty swallowing",
                                     "Bleeding from wound or rectum"])
                }
                if proc.contains("bronchoscop") || proc.contains("thorac") {
                    picks.formUnion(["Shortness of breath or chest pain",
                                     "Nausea / vomiting persisting > 24 h"])
                }
                data.returnPrecautions = returnPrecautionOptions.filter { picks.contains($0) }
            }

            let stored = patient.dischargeSummaryData
            if data.procedurePerformed    != stored.procedurePerformed    ||
               data.anaesthetistName      != stored.anaesthetistName      ||
               data.admittingDoctor       != stored.admittingDoctor       ||
               data.followUpAppointment   != stored.followUpAppointment   ||
               data.drainInSitu           != stored.drainInSitu           ||
               data.pathologyResults      != stored.pathologyResults      ||
               data.imagingResults        != stored.imagingResults        ||
               data.admissionDiagnosis    != stored.admissionDiagnosis    ||
               data.icdCode               != stored.icdCode               ||
               data.inHospitalCourse      != stored.inHospitalCourse      ||
               data.dischargeMedications  != stored.dischargeMedications  ||
               data.returnPrecautions     != stored.returnPrecautions {
                save()
            }
        }
    }

    // MARK: Sections

    private var admissionSection: some View {
        Section("Admission & Discharge") {
            TextField("Ward / unit", text: $data.ward)
                .onChange(of: data.ward) { _, _ in save() }
            TextField("Admitting doctor", text: $data.admittingDoctor)
                .onChange(of: data.admittingDoctor) { _, _ in save() }
            TextField("Surgeon", text: $data.surgeonName)
                .onChange(of: data.surgeonName) { _, _ in save() }
            TextField("Anaesthetist", text: $data.anaesthetistName)
                .onChange(of: data.anaesthetistName) { _, _ in save() }
            Toggle("Set admission date", isOn: $hasAdmissionDate)
                .onChange(of: hasAdmissionDate) { _, on in
                    data.admissionDate = on ? (data.admissionDate ?? .now) : nil; save()
                }
            if hasAdmissionDate {
                DatePicker("Admitted", selection: Binding(
                    get: { data.admissionDate ?? .now },
                    set: { data.admissionDate = $0; save() }
                ), displayedComponents: [.date])
            }
            Toggle("Set discharge date", isOn: $hasDischargeDate)
                .onChange(of: hasDischargeDate) { _, on in
                    data.dischargeDate = on ? (data.dischargeDate ?? .now) : nil; save()
                }
            if hasDischargeDate {
                DatePicker("Discharged", selection: Binding(
                    get: { data.dischargeDate ?? .now },
                    set: { data.dischargeDate = $0; save() }
                ), displayedComponents: [.date])
            }
        }
    }

    private var diagnosisSection: some View {
        Section("Diagnosis") {
            TextField("Admission diagnosis", text: $data.admissionDiagnosis, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.admissionDiagnosis) { _, _ in save() }
            TextField("Discharge diagnosis", text: $data.dischargeDiagnosis, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.dischargeDiagnosis) { _, _ in save() }
            TextField("ICD-10 code", text: $data.icdCode)
                .onChange(of: data.icdCode) { _, _ in save() }
        }
    }

    private var procedureSection: some View {
        Section("Procedure(s) Performed") {
            TextField("Procedure(s) performed (leave blank if none)", text: $data.procedurePerformed, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.procedurePerformed) { _, _ in save() }
        }
    }

    private var courseSection: some View {
        Section {
            TextField("Summary of in-hospital course", text: $data.inHospitalCourse, axis: .vertical)
                .lineLimit(4...)
                .onChange(of: data.inHospitalCourse) { _, _ in save() }
            TextField("Complications (none if blank)", text: $data.complicationsInHospital, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.complicationsInHospital) { _, _ in save() }
            Toggle("Blood transfusion given", isOn: $data.bloodTransfusion)
                .onChange(of: data.bloodTransfusion) { _, _ in save() }
            if data.bloodTransfusion {
                HStack {
                    Text("Units")
                    Spacer()
                    TextField("—", text: $data.bloodUnits)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 60)
                        .onChange(of: data.bloodUnits) { _, _ in save() }
                    Text("unit(s)").foregroundStyle(.secondary)
                }
            }
            Toggle("ITU / HDU admission", isOn: $data.ituAdmission)
                .onChange(of: data.ituAdmission) { _, _ in save() }
            if data.ituAdmission {
                HStack {
                    Text("Duration")
                    Spacer()
                    TextField("—", text: $data.ituDays)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 60)
                        .onChange(of: data.ituDays) { _, _ in save() }
                    Text("days").foregroundStyle(.secondary)
                }
            }
        } header: {
            HStack {
                Text("In-Hospital Course")
                Spacer()
                MedicalDictationButton(mode: .consultation, patient: patient) { polished in
                    data.inHospitalCourse += (data.inHospitalCourse.isEmpty ? "" : "\n\n") + polished
                    save()
                }
            }
        }
    }

    private var resultsSection: some View {
        Section("Results Pending / Received") {
            TextField("Pathology / histology results", text: $data.pathologyResults, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.pathologyResults) { _, _ in save() }
            TextField("Imaging results", text: $data.imagingResults, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.imagingResults) { _, _ in save() }
        }
    }

    private var dischargeStatusSection: some View {
        Section("Discharge Status") {
            Picker("Destination", selection: $data.dischargeDestination) {
                ForEach(["Home", "Home with district nurse", "Nursing home",
                         "Rehab facility", "Transfer to another hospital", "Deceased"], id: \.self) { Text($0) }
            }
            .onChange(of: data.dischargeDestination) { _, _ in save() }
            Picker("Mobility", selection: $data.mobileStatus) {
                ForEach(["Ambulatory", "Ambulatory with aid", "Wheelchair", "Bed-bound"], id: \.self) { Text($0) }
            }
            .onChange(of: data.mobileStatus) { _, _ in save() }
            TextField("Discharge medications", text: $data.dischargeMedications, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.dischargeMedications) { _, _ in save() }
            Picker("VTE risk assessment", selection: $data.vteAssessment) {
                ForEach(["Low risk", "Moderate risk", "High risk"], id: \.self) { Text($0) }
            }
            .onChange(of: data.vteAssessment) { _, _ in save() }
            Toggle("VTE prophylaxis prescribed", isOn: $data.vteProphylaxisGiven)
                .onChange(of: data.vteProphylaxisGiven) { _, _ in save() }
            if data.vteProphylaxisGiven {
                TextField("Agent (e.g. Enoxaparin 40 mg OD)", text: $data.vteProphylaxisAgent)
                    .onChange(of: data.vteProphylaxisAgent) { _, _ in save() }
                TextField("Duration (e.g. 28 days)", text: $data.vteProphylaxisDuration)
                    .onChange(of: data.vteProphylaxisDuration) { _, _ in save() }
            }
        }
    }

    private var woundDrainSection: some View {
        Section("Wound & Drain") {
            TextField("Wound care instructions", text: $data.woundCare, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.woundCare) { _, _ in save() }
            Toggle("Drain in situ at discharge", isOn: $data.drainInSitu)
                .onChange(of: data.drainInSitu) { _, _ in save() }
            if data.drainInSitu {
                TextField("Drain type", text: $data.drainType)
                    .onChange(of: data.drainType) { _, _ in save() }
                Toggle("Set removal date", isOn: $hasDrainRemovalDate)
                    .onChange(of: hasDrainRemovalDate) { _, on in
                        data.drainRemovalDate = on ? (data.drainRemovalDate ?? .now) : nil; save()
                    }
                if hasDrainRemovalDate {
                    DatePicker("Drain removal", selection: Binding(
                        get: { data.drainRemovalDate ?? .now },
                        set: { data.drainRemovalDate = $0; save() }
                    ), displayedComponents: [.date])
                }
            }
        }
    }

    private var restrictionsSection: some View {
        Section("Restrictions & Advice") {
            TextField("Activity restrictions", text: $data.activityRestrictions, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.activityRestrictions) { _, _ in save() }
            TextField("Dietary advice", text: $data.dietaryAdvice, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.dietaryAdvice) { _, _ in save() }
        }
    }

    private var returnPrecautionsSection: some View {
        Section("Return Precautions") {
            chipMultiSelect("", options: returnPrecautionOptions, selected: $data.returnPrecautions)
                .onChange(of: data.returnPrecautions) { _, _ in save() }
            TextField("Other precautions", text: $data.returnPrecautionsOther, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.returnPrecautionsOther) { _, _ in save() }
        }
    }

    private var followUpSection: some View {
        Section("Follow-up") {
            TextField("Follow-up appointment / instructions", text: $data.followUpAppointment, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.followUpAppointment) { _, _ in save() }
        }
    }

    private var gpSection: some View {
        Section("GP / Referrer Notification") {
            Toggle("GP / referring doctor notified", isOn: $data.gpNotified)
                .onChange(of: data.gpNotified) { _, _ in save() }
            if data.gpNotified {
                TextField("GP / referrer name", text: $data.gpName)
                    .onChange(of: data.gpName) { _, _ in save() }
            }
        }
    }

    private var additionalSection: some View {
        Section("Additional Notes") {
            TextField("Any other relevant information", text: $data.additionalNotes, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.additionalNotes) { _, _ in save() }
        }
    }

    // MARK: Helpers

    private func save() {
        patient.dischargeSummaryData = data
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    @ViewBuilder
    private func chipMultiSelect(_ label: String, options: [String], selected: Binding<[String]>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if !label.isEmpty {
                Text(label).font(.system(size: 12)).foregroundStyle(.secondary)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(options, id: \.self) { opt in
                        let on = selected.wrappedValue.contains(opt)
                        Button {
                            if on { selected.wrappedValue.removeAll { $0 == opt } }
                            else  { selected.wrappedValue.append(opt) }
                        } label: {
                            Text(opt)
                                .font(.system(size: 11, weight: on ? .semibold : .regular))
                                .foregroundStyle(on ? .white : .primary)
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(on ? AMColor.accent : Color.secondary.opacity(0.12), in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}
