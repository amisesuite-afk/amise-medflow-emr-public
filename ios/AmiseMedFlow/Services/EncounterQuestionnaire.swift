import Foundation

// MARK: — Chief Complaint categories
// Each maps to a Bayesian routing pathway and determines which subsequent
// questions are shown. Adding a category here is all that's needed to extend
// the branching graph — associated symptoms, SOCRATES gating, and the
// canonical chief-complaint string are all derived from the case.

enum CCCategory: String, CaseIterable, Codable {
    case abdominalPain        = "Abdominal pain"
    case jaundice             = "Jaundice / yellowing"
    case rectalBleeding       = "Rectal bleeding"
    case bowelChange          = "Change in bowel habit"
    case dysphagia            = "Difficulty swallowing"
    case breastSymptom        = "Breast lump, pain or discharge" // female gate applied at display
    case neckLump             = "Neck lump or swelling"
    case hernia               = "Hernia / groin lump"
    case perianal             = "Perianal / haemorrhoid symptoms"
    case weightLoss           = "Unexplained weight loss"
    case chestPain            = "Chest pain or tightness"
    case shortnessOfBreath    = "Shortness of breath"
    case urinary              = "Urinary symptoms"
    case fever                = "Fever / infection"
    case wound                = "Wound / surgical site problem"
    case postop               = "Post-operative review"
    case screening            = "Screening / routine review"
    case other                = "Other"

    // Full SOCRATES is only clinically meaningful for pain presentations.
    // Non-pain CCs still capture onset, severity, associations — but skip
    // site / character / radiation / exacerbating / relieving.
    var isPainType: Bool {
        switch self {
        case .abdominalPain, .chestPain, .perianal, .hernia: return true
        default: return false
        }
    }

    // Associated symptoms that are clinically relevant for this CC.
    // These are the *only* options shown in Phase 3, preventing cognitive
    // overload and excluding clinically incoherent combinations.
    var associatedSymptoms: [String] {
        switch self {
        case .abdominalPain:
            return ["Nausea", "Vomiting", "Fever", "Loss of appetite",
                    "Diarrhoea", "Constipation", "Jaundice",
                    "Abdominal distension", "Rectal bleeding", "Blood in vomit"]
        case .jaundice:
            return ["Dark urine", "Pale stools", "Itching", "Fever",
                    "Abdominal pain", "Nausea", "Vomiting", "Weight loss"]
        case .rectalBleeding:
            return ["Anal pain", "Constipation", "Diarrhoea", "Weight loss",
                    "Mucus in stool", "Abdominal pain", "Tenesmus"]
        case .bowelChange:
            return ["Rectal bleeding", "Mucus in stool", "Weight loss",
                    "Abdominal pain", "Bloating", "Incomplete evacuation",
                    "Pencil-thin stools"]
        case .dysphagia:
            return ["Regurgitation", "Heartburn / reflux", "Weight loss",
                    "Pain on swallowing", "Cough on swallowing", "Drooling"]
        case .breastSymptom:
            return ["Nipple discharge", "Skin changes", "Nipple inversion",
                    "Axillary lump", "Pain", "Recent change in size"]
        case .neckLump:
            return ["Pain at site", "Rapid growth", "Difficulty swallowing",
                    "Hoarseness", "Breathing difficulty", "Weight loss", "Night sweats"]
        case .hernia:
            return ["Pain at site", "Unable to push back (irreducible)",
                    "Vomiting", "Constipation", "Abdominal distension", "Fever"]
        case .perianal:
            return ["Bright red rectal bleeding", "Anal pain", "Discharge",
                    "Itching", "Prolapse / tissue coming out", "Constipation",
                    "Skin tag"]
        case .weightLoss:
            return ["Loss of appetite", "Night sweats", "Fatigue", "Fever",
                    "Abdominal pain", "Change in bowel", "Difficulty swallowing"]
        case .chestPain:
            return ["Shortness of breath", "Palpitations", "Sweating",
                    "Radiation to arm or jaw", "Worse on deep breath", "Cough",
                    "Nausea"]
        case .shortnessOfBreath:
            return ["Chest pain", "Palpitations", "Ankle swelling",
                    "Worse lying flat", "Cough", "Wheeze", "Blood in sputum"]
        case .urinary:
            return ["Blood in urine", "Loin pain", "Urinary frequency",
                    "Burning on urination", "Inability to pass urine",
                    "Incontinence", "Difficulty starting stream"]
        case .fever:
            return ["Rigors / chills", "Night sweats", "Rash", "Joint pain",
                    "Cough", "Diarrhoea", "Vomiting", "Neck stiffness"]
        case .wound, .postop:
            return ["Redness", "Swelling", "Discharge / pus", "Fever",
                    "Wound opening", "Pain at site"]
        default:
            return ["Nausea", "Vomiting", "Fever", "Fatigue",
                    "Weight loss", "Night sweats", "Pain"]
        }
    }

    // Worsening factors relevant to this CC (for pain CCs only)
    var worsening: [String] {
        switch self {
        case .abdominalPain:
            return ["Eating / meals", "Movement", "Coughing / sneezing",
                    "Lying flat", "Deep breath", "Pressing the abdomen"]
        case .chestPain:
            return ["Exertion", "Deep breath", "Lying flat", "Eating",
                    "Stress", "Cold air"]
        case .hernia:
            return ["Standing", "Coughing", "Straining", "Lifting"]
        case .perianal:
            return ["Defaecation", "Sitting", "Prolonged standing", "Lifting"]
        default:
            return ["Movement", "Eating", "Lying down", "Coughing", "Exertion"]
        }
    }

    // Relieving factors relevant to this CC (for pain CCs only)
    var relieving: [String] {
        switch self {
        case .abdominalPain:
            return ["Lying still", "Passing wind / stool", "Antacids",
                    "Fasting", "Sitting forward", "Heat", "Analgesia"]
        case .chestPain:
            return ["Rest", "GTN spray", "Sitting upright", "Antacids",
                    "Analgesia"]
        case .hernia:
            return ["Lying down", "Pushing it back", "Reducing the hernia"]
        case .perianal:
            return ["Warm bath (sitz bath)", "Analgesia", "Laxatives"]
        default:
            return ["Rest", "Analgesia", "Heat", "Positional change"]
        }
    }
}

// MARK: — SOCRATES sub-types

enum PainCharacter: String, CaseIterable, Codable {
    case colicky     = "Colicky (waves)"
    case burning     = "Burning"
    case stabbing    = "Stabbing / sharp"
    case pressure    = "Pressure / tight"
    case dull        = "Dull / aching"
    case crampy      = "Crampy"
    case throbbing   = "Throbbing"
}

enum PainOnset: String, CaseIterable, Codable {
    case sudden      = "Sudden (seconds)"
    case rapid       = "Rapid (minutes)"
    case gradual     = "Gradual (hours)"
    case progressive = "Progressive (days / weeks)"
}

enum PainTiming: String, CaseIterable, Codable {
    case constant            = "Constant"
    case intermittent        = "Comes and goes"
    case worseningConstant   = "Constant and worsening"
}

// MARK: — PMHx conditions

enum PMHxCondition: String, CaseIterable, Codable {
    case hypertension      = "Hypertension"
    case diabetes          = "Diabetes mellitus"
    case heartDisease      = "Heart disease / IHD"
    case stroke            = "Stroke / TIA"
    case asthma            = "Asthma / COPD"
    case kidneyDisease     = "Chronic kidney disease"
    case liverDisease      = "Liver disease / cirrhosis"
    case cancer            = "Cancer (any)"
    case hiv               = "HIV / AIDS"
    case thyroidDisease    = "Thyroid disease"
    case dvtPe             = "Previous DVT / PE"
    case sicklCell         = "Sickle cell disease"
    case pepticUlcer       = "Peptic ulcer disease"
    case ibd               = "Inflammatory bowel disease"
    case obesity           = "Obesity"
    case mentalHealth      = "Mental health condition"
}

enum SmokingStatus: String, CaseIterable, Codable {
    case never   = "Never"
    case ex      = "Ex-smoker"
    case current = "Current"
}

enum AlcoholUse: String, CaseIterable, Codable {
    case none    = "None"
    case social  = "Social"
    case regular = "Regular"
    case heavy   = "Heavy (daily / harmful)"
}

// MARK: — Canonical encounter answer store
// One instance per encounter session. Every field has exactly one
// authoritative value — reading from two sources and merging is
// explicitly not supported (single-value-per-variable rule).

struct EncounterAnswers {

    // ── Phase 1: Chief Complaint ─────────────────────────────────────────────
    var ccCategory: CCCategory?
    var ccClarification: String = ""    // used when .other, or for extra detail

    // ── Phase 2: SOCRATES (pain pathways only) ───────────────────────────────
    var painSite: String = ""
    var painOnset: PainOnset?
    var painOnsetHoursAgo: Int?
    var painCharacter: PainCharacter?
    var painRadiates: Bool = false
    var painRadiationSite: String = ""
    var painSeverity: Int = 5           // 0–10 NRS; 5 = not yet answered
    var severityAnswered: Bool = false  // distinguishes "5" from "not answered"
    var painTiming: PainTiming?
    var painWorsenedBy: Set<String> = []
    var painRelievedBy: Set<String> = []

    // ── Phase 3: Associated symptoms (CC-gated) ──────────────────────────────
    var associatedSymptoms: Set<String> = []
    var associatedOther: String = ""

    // ── Phase 4: Red flags (demographic-gated) ───────────────────────────────
    var unexplainedWeightLoss: Bool = false
    var nightSweats: Bool = false
    var haemoptysis: Bool = false       // gate: age ≥ 18
    var haematuria: Bool = false        // gate: age ≥ 25
    var breastChange: Bool = false      // gate: sex == .female
    var changeInMole: Bool = false

    // ── Phase 5: Past Medical History ────────────────────────────────────────
    var pmhxConditions: Set<PMHxCondition> = []
    var medications: String = ""
    var allergies: String = ""
    var surgicalHistory: String = ""

    // ── Phase 6: Social history / Last meal ──────────────────────────────────
    var smokingStatus: SmokingStatus = .never
    var alcoholUse: AlcoholUse = .none
    var lastMealTime: Date? = nil
    var occupation: String = ""

    // MARK: - Derived canonical strings (written to Patient model)

    // Single authoritative chief complaint string for BayesianDiagnosisEngine
    var chiefComplaintText: String {
        guard let cc = ccCategory else { return ccClarification }
        if cc == .other {
            return ccClarification.isEmpty ? "Other complaint" : ccClarification
        }
        return ccClarification.isEmpty
            ? cc.rawValue
            : "\(cc.rawValue) — \(ccClarification)"
    }

    // SOCRATES-structured HPI for PatientStateVector parser
    // Format is intentionally machine-readable so the engine can extract fields
    var hpiText: String {
        var lines: [String] = []
        guard let cc = ccCategory else { return "" }

        if cc.isPainType {
            if !painSite.isEmpty {
                lines.append("SITE: \(painSite)")
            }
            if let o = painOnset {
                var t = "ONSET: \(o.rawValue)"
                if let h = painOnsetHoursAgo { t += " (\(h)h ago)" }
                lines.append(t)
            }
            if let c = painCharacter {
                lines.append("CHARACTER: \(c.rawValue)")
            }
            if painRadiates {
                let dest = painRadiationSite.isEmpty ? "present" : "to \(painRadiationSite)"
                lines.append("RADIATION: \(dest)")
            } else {
                lines.append("RADIATION: none")
            }
            if severityAnswered {
                lines.append("SEVERITY: \(painSeverity)/10")
            }
            if let t = painTiming {
                lines.append("TIMING: \(t.rawValue)")
            }
            if !painWorsenedBy.isEmpty {
                lines.append("WORSE: \(painWorsenedBy.sorted().joined(separator: ", "))")
            }
            if !painRelievedBy.isEmpty {
                lines.append("BETTER: \(painRelievedBy.sorted().joined(separator: ", "))")
            }
        } else if severityAnswered {
            lines.append("SEVERITY: \(painSeverity)/10")
        }

        if !associatedSymptoms.isEmpty {
            lines.append("ASSOCIATED: \(associatedSymptoms.sorted().joined(separator: ", "))")
        }
        if !associatedOther.isEmpty {
            lines.append("OTHER SYMPTOMS: \(associatedOther)")
        }

        var flags: [String] = []
        if unexplainedWeightLoss { flags.append("unexplained weight loss") }
        if nightSweats           { flags.append("night sweats") }
        if haemoptysis           { flags.append("haemoptysis") }
        if haematuria            { flags.append("haematuria") }
        if breastChange          { flags.append("breast change") }
        if changeInMole          { flags.append("changing mole") }
        if !flags.isEmpty {
            lines.append("RED FLAGS: \(flags.joined(separator: ", "))")
        }

        return lines.joined(separator: "\n")
    }

    // Structured PMHx text for PatientStateVector parser
    var pmhxText: String {
        var lines: [String] = []
        if !pmhxConditions.isEmpty {
            lines.append("CONDITIONS: \(pmhxConditions.map(\.rawValue).sorted().joined(separator: ", "))")
        }
        if !medications.isEmpty     { lines.append("MEDICATIONS: \(medications)") }
        if !allergies.isEmpty       { lines.append("ALLERGIES: \(allergies)") }
        if !surgicalHistory.isEmpty { lines.append("SURGICAL HISTORY: \(surgicalHistory)") }
        if !occupation.isEmpty      { lines.append("OCCUPATION: \(occupation)") }
        lines.append("SMOKING: \(smokingStatus.rawValue)")
        lines.append("ALCOHOL: \(alcoholUse.rawValue)")
        return lines.joined(separator: "\n")
    }

    // SOCRATES selections dictionary consumed directly by BayesianDiagnosisEngine.
    // Keys MUST be lowercase to match the engine's switch statement.
    var socratesSelections: [String: Set<String>] {
        var dict: [String: Set<String>] = [:]
        if !painSite.isEmpty          { dict["site"]         = [painSite] }
        if let c = painCharacter      { dict["character"]    = [c.rawValue] }
        if painRadiates {
            let dest = painRadiationSite.isEmpty ? "yes" : painRadiationSite
            dict["radiation"] = [dest]
        }
        if !associatedSymptoms.isEmpty { dict["associations"] = associatedSymptoms }
        if !painWorsenedBy.isEmpty     { dict["exacerbating"] = painWorsenedBy }
        if !painRelievedBy.isEmpty     { dict["relieving"]    = painRelievedBy }
        if severityAnswered            { dict["severity"]     = ["\(painSeverity)"] }
        return dict
    }
}
