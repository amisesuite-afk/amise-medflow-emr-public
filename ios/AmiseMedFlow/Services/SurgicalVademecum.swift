import Foundation

// MARK: - Enums

enum SurgicalSystem: String, CaseIterable, Identifiable {
    case upperGI       = "Upper GI"
    case hepatobiliary = "Hepatobiliary"
    case colorectal    = "Colorectal"
    case hernia        = "Hernia"
    case perianal      = "Perianal"
    case endocrine     = "Endocrine"
    case breast        = "Breast"
    case vascular      = "Vascular"
    case emergency     = "Emergency"
    case endoscopy     = "Endoscopy"
    var id: String { rawValue }

    var icon: String {
        switch self {
        case .upperGI:       return "fork.knife"
        case .hepatobiliary: return "drop.fill"
        case .colorectal:    return "arrow.triangle.2.circlepath"
        case .hernia:        return "circle.dotted"
        case .perianal:      return "figure.walk"
        case .endocrine:     return "waveform.path.ecg"
        case .breast:        return "heart.fill"
        case .vascular:      return "bolt.heart"
        case .emergency:     return "exclamationmark.triangle.fill"
        case .endoscopy:     return "camera.metering.center.weighted"
        }
    }
}

enum SurgicalUrgency: String, CaseIterable {
    case elective  = "Elective"
    case urgent    = "Urgent (24–72 h)"
    case emergency = "Emergency (<6 h)"
    case immediate = "Immediate"

    var color: String {
        switch self {
        case .elective:  return "green"
        case .urgent:    return "orange"
        case .emergency: return "red"
        case .immediate: return "purple"
        }
    }
}

enum OperativeApproach: String {
    case laparoscopic   = "Laparoscopic"
    case open           = "Open"
    case roboticAssist  = "Robotic-assisted"
    case endoscopic     = "Endoscopic"
    case percutaneous   = "Percutaneous"
    case hybrid         = "Hybrid"
}

// MARK: - Models

struct SurgicalInvestigation: Identifiable {
    let id = UUID()
    let name: String
    let rationale: String
    let urgency: String        // "Routine" / "Urgent" / "Stat"
    let keyFindings: [String]
}

struct Complication: Identifiable {
    let id = UUID()
    let name: String
    let incidence: String      // e.g. "2–5%"
    let management: String
}

struct OperativeOption: Identifiable {
    let id = UUID()
    let name: String
    let approach: OperativeApproach
    let indication: String
    let keySteps: [String]
    let complications: [Complication]
    let consentPoints: [String]
    let operativeTime: String  // e.g. "45–90 min"
    let los: String            // expected length of stay
}

struct SurgicalAlgorithm {
    let clinicalQuestion: String
    let urgencyAssessment: String
    let operativeIndications: [String]
    let nonOperativeIndications: [String]
    let operativeOptions: [OperativeOption]
    let nonOperativeManagement: [String]
    let pitfalls: [String]
    let keyScores: [String]    // e.g. "Alvarado score", "Ranson criteria"
}

struct PostOpProtocol {
    let icu: Bool
    let diet: String
    let mobilisation: String
    let analgesia: String
    let drains: String
    let antibiotics: String
    let thromboembolicProphylaxis: String
    let specialInstructions: [String]
}

struct FollowUpProtocol {
    let woundCheck: String     // e.g. "Day 7–10"
    let clinicReview: String   // e.g. "4–6 weeks"
    let surveillance: String   // e.g. "Annual colonoscopy"
    let pathologyReview: String
    let redFlagReturn: [String]
}

struct SurgicalCondition: Identifiable {
    let id: String             // e.g. "acute_appendicitis"
    let name: String
    let icd10: String
    let system: SurgicalSystem
    let urgency: SurgicalUrgency
    let summary: String
    let redFlags: [String]
    let investigations: [SurgicalInvestigation]
    let algorithm: SurgicalAlgorithm
    let postOp: PostOpProtocol?
    let followUp: FollowUpProtocol
    let searchAliases: [String]
    let pearls: [String]       // key clinical pearls / teaching points
}

// MARK: - Vademecum Database


// MARK: - Vademecum Database

enum SurgicalVademecum {

    // MARK: - Main Database

    static let allConditions: [SurgicalCondition] = [
        acuteAppendicitis,
        acuteCholecystitis,
        choledocholithiasis,
        inguinalHernia,
        colorectalCancer,
        haemorrhoids,
        acutePancreatitis,
        upperGIBleed,
        analFissure,
        perforatedViscus
    ]
}
