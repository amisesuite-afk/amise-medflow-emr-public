import SwiftUI
import SwiftData

// MARK: - Patient model

@Model
final class Patient {
    var id: UUID
    var remoteId: String?
    var fullName: String
    var dateOfBirth: Date?
    var sex: Sex
    var phone: String?
    var email: String?
    var address: String?
    var setting: ClinicalSetting
    var location: ClinicalLocation
    var acuity: Acuity
    var chiefComplaint: String?
    var referralSource: ReferralSource?
    var referringDoctor: String?
    var referringPractice: String?
    var appointmentType: String?
    var notes: String?
    var ward: String?
    var bedNumber: String?
    var admittedAt: Date?
    var expectedDischarge: Date?
    var operationDate: Date?
    var createdAt: Date
    var updatedAt: Date
    var syncedAt: Date?
    var pendingSync: Bool

    // MARK: - Relationships
    @Relationship(deleteRule: .cascade, inverse: \ClinicalNote.patient)
    var clinicalNotes: [ClinicalNote] = []

    @Relationship(deleteRule: .cascade, inverse: \VitalsEntry.patient)
    var vitalsEntries: [VitalsEntry] = []

    @Relationship(deleteRule: .cascade, inverse: \Prescription.patient)
    var prescriptions: [Prescription] = []

    @Relationship(deleteRule: .cascade, inverse: \PatientDocument.patient)
    var documents: [PatientDocument] = []

    @Relationship(deleteRule: .cascade, inverse: \OperativePlan.patient)
    var operativePlans: [OperativePlan] = []

    @Relationship(deleteRule: .cascade, inverse: \BillingLineItem.patient)
    var billingItems: [BillingLineItem] = []

    // MARK: - Clinical intelligence fields
    var workingDiagnosis: String?
    var workingDiagnosisICD: String?
    var assessmentText: String?

    // MARK: - Visit type (structured)
    var visitType: VisitType?

    // MARK: - Consultation form fields
    var hpi: String?
    var surgicalHistory: String?
    var allergiesJson: String?      // JSON: [AllergyEntry]
    var examGeneral: String?
    var examCVS: String?
    var examResp: String?
    var examAbdo: String?
    var examNeuro: String?
    var examMSK: String?
    var examSkin: String?
    var examOther: String?
    var managementPlan: String?

    // MARK: - Extended demographics (synced to Supabase)
    var mrn: String?
    var nokName: String?
    var nokRelation: String?
    var nokPhone: String?
    var pmhNotes: String?
    var familyHistoryNotes: String?
    var socialHistory: String?
    var insuranceProvider: String?
    var policyNumber: String?
    var investigationsJson: String?  // JSON: [InvestigationEntry]
    var heightCm: Double?

    init(
        fullName: String,
        sex: Sex = .unspecified,
        setting: ClinicalSetting = .outpatient,
        location: ClinicalLocation = .rodney_bay,
        acuity: Acuity = .routine
    ) {
        self.id = UUID()
        self.fullName = fullName
        self.sex = sex
        self.setting = setting
        self.location = location
        self.acuity = acuity
        self.createdAt = .now
        self.updatedAt = .now
        self.pendingSync = true
    }

    var initials: String {
        let parts = fullName.split(separator: " ")
        let letters = parts.prefix(2).compactMap { $0.first }
        return letters.isEmpty ? "?" : String(letters).uppercased()
    }

    var ageYears: Int {
        guard let dob = dateOfBirth else { return 0 }
        return Calendar.current.dateComponents([.year], from: dob, to: .now).year ?? 0
    }

    var postOpDays: Int? {
        guard let op = operationDate, op < .now else { return nil }
        return Calendar.current.dateComponents([.day], from: op, to: .now).day
    }

    func latestBMI() -> Double? {
        guard let h = heightCm, h > 0,
              let w = vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt })
                                   .first(where: { $0.weightKg != nil })?.weightKg
        else { return nil }
        let hm = h / 100.0
        return w / (hm * hm)
    }

    var bmiCategory: String? {
        guard let bmi = latestBMI() else { return nil }
        switch bmi {
        case ..<18.5: return "Underweight"
        case 18.5..<25: return "Normal"
        case 25..<30: return "Overweight"
        default: return "Obese"
        }
    }
}

// MARK: - Enums

enum Sex: String, Codable, CaseIterable {
    case male = "Male"
    case female = "Female"
    case unspecified = "Unspecified"
}

enum ClinicalSetting: String, Codable, CaseIterable {
    case outpatient = "Outpatient"
    case inpatient  = "Inpatient"
    case theatre    = "Theatre"
    case endoscopy  = "Endoscopy"
    case emergency  = "Emergency"

    var icon: String {
        switch self {
        case .outpatient: return "person.crop.circle"
        case .inpatient:  return "bed.double"
        case .theatre:    return "scissors"
        case .endoscopy:  return "circle.dotted"
        case .emergency:  return "bolt.heart"
        }
    }

    var accentHex: String {
        switch self {
        case .outpatient: return "#0D9488"
        case .inpatient:  return "#2563EB"
        case .theatre:    return "#7C3AED"
        case .endoscopy:  return "#0891B2"
        case .emergency:  return "#DC2626"
        }
    }
}

enum ClinicalLocation: String, Codable, CaseIterable {
    case rodney_bay = "Rodney Bay"
    case tapion     = "Tapion"
    case okeu       = "OKEU"
    case victoria   = "Victoria"
    case other      = "Other"

    var shortName: String {
        switch self {
        case .rodney_bay: return "RB"
        case .tapion:     return "TAP"
        case .okeu:       return "OKEU"
        case .victoria:   return "VIC"
        case .other:      return "OTH"
        }
    }
}

enum Acuity: Int, Codable, CaseIterable, Comparable {
    case emergency = 0
    case urgent    = 1
    case priority  = 2
    case routine   = 3

    static func < (lhs: Acuity, rhs: Acuity) -> Bool { lhs.rawValue < rhs.rawValue }

    var label: String {
        switch self {
        case .emergency: return "Emergency"
        case .urgent:    return "Urgent"
        case .priority:  return "Priority"
        case .routine:   return "Routine"
        }
    }

    var color: String {
        switch self {
        case .emergency: return "#DC2626"
        case .urgent:    return "#F97316"
        case .priority:  return "#EAB308"
        case .routine:   return "#22C55E"
        }
    }
}

enum VisitType: String, Codable, CaseIterable {
    case newConsult    = "New Consult"
    case followUp      = "Follow-up"
    case postOp        = "Post-op Review"
    case dayOfSurgery  = "Day of Surgery"
    case ercp          = "ERCP"
    case ogd           = "OGD / Gastroscopy"
    case colonoscopy   = "Colonoscopy"
    case urgentReview  = "Urgent Review"
    case telephone     = "Telephone"

    var icon: String {
        switch self {
        case .newConsult:   return "person.fill.questionmark"
        case .followUp:     return "arrow.clockwise"
        case .postOp:       return "bandage"
        case .dayOfSurgery: return "scissors"
        case .ercp:         return "circle.dotted"
        case .ogd:          return "circle.dotted"
        case .colonoscopy:  return "circle.dotted"
        case .urgentReview: return "exclamationmark.circle"
        case .telephone:    return "phone"
        }
    }
}

enum ReferralSource: String, Codable, CaseIterable {
    case selfReferral = "Self"
    case gp           = "GP"
    case specialist   = "Specialist"
    case emergency    = "Emergency"
    case other        = "Other"
}

// MARK: - Clinical handover summary

extension Patient {
    var handoverText: String {
        let today = Date.now.formatted(date: .abbreviated, time: .shortened)
        var lines: [String] = []

        lines.append("CLINICAL HANDOVER — \(today)")
        lines.append("Generated by Amise MedFlow EMR · Dr Dawit Daniel Kabiye MD DM")
        lines.append(String(repeating: "─", count: 48))
        lines.append("")

        // Patient identity
        var idLine = "\(fullName) · \(sex.rawValue) · \(ageYears > 0 ? "\(ageYears)y" : "age unknown")"
        if let m = mrn { idLine += " · MRN: \(m)" }
        lines.append(idLine)

        var locationLine = "\(setting.rawValue) — \(location.rawValue)"
        if let w = ward { locationLine += " · Ward: \(w)" }
        if let b = bedNumber { locationLine += " · Bed: \(b)" }
        lines.append(locationLine)
        lines.append("Acuity: \(acuity.label.uppercased())")
        lines.append("")

        // Diagnosis / complaint
        if let dx = workingDiagnosis {
            let icd = workingDiagnosisICD.map { " [\($0)]" } ?? ""
            lines.append("DIAGNOSIS: \(dx)\(icd)")
        }
        if let cc = chiefComplaint {
            lines.append("Chief complaint: \(cc)")
        }
        if let hpi = hpi, !hpi.isEmpty {
            lines.append("HPI: \(hpi.prefix(200))\(hpi.count > 200 ? "…" : "")")
        }
        lines.append("")

        // Anthropometrics
        if let h = heightCm {
            var anthropLine = String(format: "Height: %.0f cm", h)
            if let bmi = latestBMI(), let cat = bmiCategory {
                anthropLine += String(format: "  BMI: %.1f (%@)", bmi, cat)
            }
            lines.append(anthropLine)
        }

        // Vitals
        if let v = vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first, v.hasAnyValue {
            lines.append("LATEST VITALS (\(v.recordedAt.formatted(date: .omitted, time: .shortened)))")
            var vParts = ["NEWS2 \(v.news2Score) (\(v.news2Risk))"]
            if let bp = v.bpString { vParts.append("BP \(bp) mmHg") }
            if let hr = v.heartRate { vParts.append("HR \(hr) bpm") }
            if let rr = v.respiratoryRate { vParts.append("RR \(rr)/min") }
            if let temp = v.temperatureCelsius { vParts.append(String(format: "Temp %.1f°C", temp)) }
            if let spo = v.spo2 { vParts.append("SpO₂ \(spo)%") }
            lines.append(vParts.joined(separator: " · "))
            lines.append("")
        }

        // Allergies
        let allergyList = allergies
        if allergyList.isEmpty {
            lines.append("ALLERGIES: NKDA")
        } else {
            lines.append("ALLERGIES: " + allergyList.map { "\($0.name) (\($0.reaction), \($0.severity))" }.joined(separator: "; "))
        }

        // Medications
        if !prescriptions.isEmpty {
            lines.append("")
            lines.append("MEDICATIONS:")
            prescriptions.forEach { lines.append("  • \($0.displayLine)") }
        }

        // Investigations
        let pending = investigations.filter { $0.status == .ordered || $0.status == .pending }
        let resulted = investigations.filter { $0.status == .resulted }
        if !pending.isEmpty || !resulted.isEmpty {
            lines.append("")
            lines.append("INVESTIGATIONS:")
            pending.forEach { lines.append("  ⏳ \($0.name) (awaiting)") }
            resulted.forEach { lines.append("  ✓ \($0.name)\($0.result.isEmpty ? "" : ": \($0.result)")") }
        }

        // Management plan
        if let plan = managementPlan, !plan.isEmpty {
            lines.append("")
            lines.append("MANAGEMENT PLAN:")
            lines.append(plan)
        }

        // Admission dates
        if let admitted = admittedAt {
            lines.append("")
            lines.append("Admitted: \(admitted.formatted(date: .abbreviated, time: .omitted))")
            if let exp = expectedDischarge {
                lines.append("Expected discharge: \(exp.formatted(date: .abbreviated, time: .omitted))")
            }
        }

        lines.append("")
        lines.append(String(repeating: "─", count: 48))
        lines.append("This handover is a summary. Verify all details in the full record.")
        return lines.joined(separator: "\n")
    }
}
