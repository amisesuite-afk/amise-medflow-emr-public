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

    @State var data = DischargeSummaryData()
    @State var hasAdmissionDate = false
    @State var hasDischargeDate = false
    @State var hasDrainRemovalDate = false
    @State var pdfWrapper: PDFDataWrapper?

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

}
