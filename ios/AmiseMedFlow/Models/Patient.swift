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

    // MARK: - Clinical intelligence fields
    var workingDiagnosis: String?
    var workingDiagnosisICD: String?
    var assessmentText: String?

    // MARK: - Extended demographics (synced to Supabase)
    var mrn: String?
    var nokName: String?
    var nokRelation: String?
    var nokPhone: String?
    var pmhNotes: String?
    var familyHistoryNotes: String?
    var insuranceProvider: String?
    var policyNumber: String?

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

    var color: String {
        switch self {
        case .emergency: return "#DC2626"
        case .urgent:    return "#F97316"
        case .priority:  return "#EAB308"
        case .routine:   return "#22C55E"
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
