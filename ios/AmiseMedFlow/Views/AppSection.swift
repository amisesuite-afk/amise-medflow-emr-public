// AppSection.swift
// App section enum for iPad/Mac sidebar navigation.

import SwiftUI

// MARK: - App section enum (iPad/Mac sidebar)

enum AppSection: String, CaseIterable, Hashable, Identifiable {
    case wardRounds  = "Ward Rounds"
    case theatre     = "Theatre"
    case endoscopy   = "Endoscopy"
    case outpatients = "Patients"
    case schedule    = "Schedule"

    var id: String { rawValue }

    var isPatientSection: Bool { self != .schedule }

    var icon: String {
        switch self {
        case .wardRounds:  "bed.double"
        case .theatre:     "scissors"
        case .endoscopy:   "circle.dotted"
        case .outpatients: "person.crop.circle"
        case .schedule:    "calendar"
        }
    }

    var defaultSetting: ClinicalSetting {
        switch self {
        case .wardRounds:  .inpatient
        case .theatre:     .theatre
        case .endoscopy:   .endoscopy
        case .outpatients: .outpatient
        case .schedule:    .outpatient
        }
    }

    var defaultVisitType: VisitType {
        switch self {
        case .wardRounds:  .urgentReview
        case .theatre:     .surgeryElective
        case .endoscopy:   .ogd
        case .outpatients: .newConsult
        case .schedule:    .newConsult
        }
    }

    var defaultLocation: ClinicalLocation {
        switch self {
        case .theatre, .endoscopy: return .tapion
        case .wardRounds:          return .okeu
        case .outpatients:         return .rodney_bay
        case .schedule:            return .rodney_bay
        }
    }

    // Visit types that make sense for this section
    var relevantVisitTypes: [VisitType] {
        switch self {
        case .theatre:
            return [.surgeryElective, .surgeryEmergency, .dayOfSurgery]
        case .endoscopy:
            return [.ogd, .colonoscopy, .ercp, .bronchoscopy]
        case .wardRounds:
            return [.wardReview, .urgentReview, .surgeryEmergency, .trauma, .burns, .postOp]
        case .outpatients:
            return [.newConsult, .followUp, .postOp, .urgentReview, .wellness, .burns, .telephone]
        case .schedule:
            return [.newConsult, .followUp, .postOp]
        }
    }

    var keyFieldLabel: String {
        switch self {
        case .theatre:     return "Procedure"
        case .endoscopy:   return "Scope type"
        case .wardRounds:  return "Ward"
        case .outpatients: return "Chief complaint"
        case .schedule:    return "Reason for visit"
        }
    }

    var keyFieldQuickPicks: [String] {
        switch self {
        case .theatre:
            return ["Laparoscopic cholecystectomy", "Laparoscopic appendicectomy",
                    "Inguinal hernia repair", "Umbilical hernia repair", "Incisional hernia repair",
                    "Haemorrhoidectomy", "Colectomy", "Thyroidectomy",
                    "Mastectomy", "Breast lumpectomy", "I&D abscess",
                    "Pilonidal sinus excision", "Laparotomy", "Anal fissure surgery"]
        case .endoscopy:
            return ["OGD / Gastroscopy", "Colonoscopy", "ERCP",
                    "Flexible sigmoidoscopy", "OGD + Colonoscopy", "Bronchoscopy"]
        case .wardRounds:
            return ["Surgical Ward A", "Surgical Ward B", "ICU", "HDU", "Private Room"]
        case .outpatients:
            return ["Abdominal pain", "RUQ pain", "RLQ pain", "Rectal bleeding",
                    "Dysphagia", "Hernia (inguinal)", "Hernia (umbilical)",
                    "Breast lump", "Neck lump", "Follow-up", "Post-op review", "Screening"]
        case .schedule:
            return ["Consultation", "Follow-up", "Procedure review"]
        }
    }

    var emptyTitle: String {
        switch self {
        case .wardRounds:  "No inpatients"
        case .theatre:     "No theatre cases"
        case .endoscopy:   "No endoscopy cases"
        case .outpatients: "No patients"
        case .schedule:    "No upcoming events"
        }
    }

    var emptyDescription: String {
        switch self {
        case .wardRounds:  "Add an inpatient or emergency patient to begin."
        case .theatre:     "Add a theatre case to build the list."
        case .endoscopy:   "Add an endoscopy case to build the list."
        case .outpatients: "Add an outpatient to get started."
        case .schedule:    "Sync to load calendar events."
        }
    }

    var shortLabel: String {
        switch self {
        case .wardRounds:  "Ward"
        case .theatre:     "Theatre"
        case .endoscopy:   "Scope"
        case .outpatients: "OPD"
        case .schedule:    "Schedule"
        }
    }
}
