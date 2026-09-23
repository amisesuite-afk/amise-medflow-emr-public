// Patient+Enums.swift
// Clinical domain enumerations used throughout the Patient model and UI.

import SwiftUI
import SwiftData

// MARK: - Enums

enum Sex: String, Codable, CaseIterable {
    case male = "Male"
    case female = "Female"
    case unspecified = "Unspecified"

    // Supabase stores lowercase; "unspecified" is not in the CHECK constraint
    // so we map it to "unknown" (which IS allowed) and back.
    var supabaseValue: String {
        self == .unspecified ? "unknown" : rawValue.lowercased()
    }

    static func fromSupabase(_ value: String?) -> Sex {
        switch value?.lowercased() {
        case "male":             return .male
        case "female":           return .female
        case "unknown", "other": return .unspecified
        default:                 return .unspecified
        }
    }
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
    case trauma        = "Trauma / Burns"
    case surgeryElective  = "Elective Surgery"
    case surgeryEmergency = "Emergency Surgery"
    case bronchoscopy     = "Bronchoscopy"

    var icon: String {
        switch self {
        case .newConsult:       return "person.fill.questionmark"
        case .followUp:         return "arrow.clockwise"
        case .postOp:           return "bandage"
        case .dayOfSurgery:     return "scissors"
        case .ercp:             return "circle.dotted"
        case .ogd:              return "circle.dotted"
        case .colonoscopy:      return "circle.dotted"
        case .urgentReview:     return "exclamationmark.circle"
        case .telephone:        return "phone"
        case .trauma:           return "cross.case.fill"
        case .surgeryElective:  return "scissors"
        case .surgeryEmergency: return "bolt.heart.fill"
        case .bronchoscopy:     return "lungs"
        }
    }

    var shortLabel: String {
        switch self {
        case .newConsult:       return "1st Visit"
        case .followUp:         return "Follow-up"
        case .postOp:           return "Post-op"
        case .dayOfSurgery:     return "Day of Sx"
        case .ercp:             return "ERCP"
        case .ogd:              return "OGD"
        case .colonoscopy:      return "Scope"
        case .urgentReview:     return "Urgent"
        case .telephone:        return "Tel"
        case .trauma:           return "Trauma"
        case .surgeryElective:  return "Elective Sx"
        case .surgeryEmergency: return "Emerg Sx"
        case .bronchoscopy:     return "Bronch"
        }
    }

    var accentHex: String {
        switch self {
        case .newConsult:       return "#0D9488"
        case .followUp:         return "#2563EB"
        case .postOp:           return "#7C3AED"
        case .dayOfSurgery:     return "#7C3AED"
        case .ercp:             return "#0891B2"
        case .ogd:              return "#0891B2"
        case .colonoscopy:      return "#0891B2"
        case .urgentReview:     return "#F97316"
        case .telephone:        return "#6B7280"
        case .trauma:           return "#DC2626"
        case .surgeryElective:  return "#7C3AED"
        case .surgeryEmergency: return "#DC2626"
        case .bronchoscopy:     return "#0891B2"
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

enum EncounterStatus: String, Codable {
    case notCheckedIn = "not_checked_in"
    case waiting      = "waiting"
    case withDoctor   = "with_doctor"
    case complete     = "complete"

    var label: String {
        switch self {
        case .notCheckedIn: return "Not checked in"
        case .waiting:      return "Waiting"
        case .withDoctor:   return "With doctor"
        case .complete:     return "Complete"
        }
    }
}
