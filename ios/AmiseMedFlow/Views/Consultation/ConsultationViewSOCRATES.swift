// ConsultationViewSOCRATES.swift
// SOCRATES HPI dimension definitions and chip catalogue.

import SwiftUI
import SwiftData

// MARK: - SOCRATES HPI builder data

struct SOCRATESDimension: Identifiable {
    let id: String
    let title: String
    let question: String
    let icon: String
    let chips: [String]
    let multiSelect: Bool
}

// CC-adaptive chip sets — shared across SOCRATES dimensions
enum SOCRATESChips {
    // Stable across all complaint types
    static let onset    = ["Today", "Yesterday", "2–3 days ago", "4–7 days ago", "1–4 weeks ago", "1–6 months ago", "Over a year", "Sudden", "Gradual"]
    static let timing   = ["Constant", "Intermittent", "Progressive", "Post-prandial", "Nocturnal", "Episodic", "Worse over time"]
    static let severity = ["Mild (1–3/10)", "Moderate (4–6/10)", "Severe (7–9/10)", "Worst (10/10)"]

    // Site sets
    static let siteAbdominal  = ["RUQ", "LUQ", "RLQ", "LLQ", "Epigastric", "Periumbilical", "Suprapubic", "Diffuse", "Right side", "Left side", "Loin", "Groin", "Perineal", "Chest"]
    static let siteNeck       = ["Anterior triangle (right)", "Anterior triangle (left)", "Posterior triangle (right)", "Posterior triangle (left)", "Midline", "Submandibular", "Submental", "Parotid region", "Thyroid (right lobe)", "Thyroid (left lobe)", "Thyroid isthmus", "Supraclavicular", "Occipital", "Diffuse neck"]
    static let siteBreast     = ["Upper outer (right)", "Upper outer (left)", "Upper inner (right)", "Upper inner (left)", "Lower outer (right)", "Lower outer (left)", "Lower inner (right)", "Lower inner (left)", "Central / areola", "Axilla (right)", "Axilla (left)", "Bilateral"]
    static let siteChest      = ["Retrosternal", "Left chest", "Right chest", "Epigastric", "Left shoulder", "Right shoulder", "Jaw", "Left arm", "Interscapular"]
    static let siteGroin      = ["Right inguinal", "Left inguinal", "Right femoral", "Left femoral", "Umbilical", "Epigastric / linea alba", "Incisional", "Right scrotum", "Left scrotum", "Bilateral"]
    static let siteDysphagia  = ["Throat", "Upper neck", "Mid-neck", "Upper chest", "Mid-chest", "Lower chest / epigastric"]
    static let siteAnorectal  = ["Perianal", "Anal canal", "Rectum", "Left lateral", "Right lateral", "Posterior midline", "Anterior", "Perineal"]
    static let siteSkin       = ["Face", "Scalp", "Neck", "Shoulder", "Back", "Chest", "Abdomen", "Arm", "Forearm", "Hand", "Thigh", "Lower leg", "Foot"]
    static let siteUrology    = ["Right loin", "Left loin", "Right flank", "Left flank", "Suprapubic", "Perineal", "Diffuse"]

    // Character sets
    static let charPain  = ["Sharp", "Dull", "Colicky", "Burning", "Throbbing", "Cramping", "Aching", "Pressure", "Bloating", "Pulling", "Stabbing"]
    static let charLump  = ["Smooth", "Irregular", "Firm", "Hard", "Soft", "Cystic / fluctuant", "Pulsatile", "Mobile", "Fixed", "Tender", "Non-tender", "Matted"]
    static let charBreast = ["Smooth", "Irregular", "Firm", "Soft", "Cystic", "Mobile", "Fixed to skin", "Fixed to muscle", "Tender", "Non-tender"]
    static let charSkin  = ["Pigmented", "Non-pigmented", "Raised", "Flat", "Ulcerated", "Itchy", "Bleeding", "Crusted", "Smooth", "Irregular borders", "Multiple"]

    // Radiation sets
    static let radAbdominal = ["No radiation", "Right shoulder", "Left shoulder", "Back", "Groin", "Chest", "Jaw", "Arm"]
    static let radChest     = ["No radiation", "Left arm", "Right arm", "Jaw", "Neck", "Back", "Left shoulder", "Epigastric"]
    static let radNeck      = ["No radiation", "Ear (right)", "Ear (left)", "Chest", "Arm (right)", "Arm (left)", "Jaw"]
    static let radUrology   = ["No radiation", "Groin", "Perineum", "Inner thigh", "Testicle"]
    static let radNone      = ["No radiation", "Localised only", "Diffuse"]

    // Association sets
    static let assocAbdominal = ["Nausea", "Vomiting", "Fever", "Rigors", "Anorexia", "Weight loss", "Jaundice", "Rectal bleeding", "Melaena", "Change in bowel habit", "Dysphagia", "Heartburn", "Haematuria", "Dysuria"]
    static let assocNeck      = ["Dysphagia", "Hoarseness / voice change", "Weight loss", "Night sweats", "Fever", "Ear pain", "Fatigue", "Shortness of breath", "Haemoptysis", "Facial swelling", "Stridor"]
    static let assocBreast    = ["Nipple discharge", "Skin changes / dimpling", "Nipple inversion", "Axillary lump", "Mastalgia", "Cyclical changes", "Weight loss", "Fatigue", "Fever"]
    static let assocChest     = ["Shortness of breath", "Diaphoresis", "Nausea", "Vomiting", "Palpitations", "Dizziness / syncope", "Cough", "Haemoptysis", "Fever", "Pleuritic pain"]
    static let assocAnorectal = ["Rectal bleeding", "Pruritus ani", "Pain on defaecation", "Soiling", "Change in bowel habit", "Mucus discharge", "Tenesmus", "Weight loss"]
    static let assocDysphagia = ["Regurgitation", "Odynophagia", "Weight loss", "Aspiration", "Voice change", "Heartburn", "Nausea", "Vomiting", "Haematemesis", "Melaena"]
    static let assocUrology   = ["Haematuria", "Dysuria", "Frequency", "Urgency", "Nocturia", "Hesitancy", "Poor stream", "Weight loss", "Fever", "Loin pain"]
    static let assocSkin      = ["Itching", "Bleeding", "Ulceration", "Change in size", "Change in colour", "Regional lymphadenopathy", "Satellite lesions", "Systemic symptoms"]

    // Exacerbating sets
    static let excPain    = ["Movement", "Eating", "Fatty food", "Lying flat", "Deep breathing", "Coughing", "Straining", "Alcohol", "NSAIDs"]
    static let excLump    = ["Straining / Valsalva", "Standing", "Eating", "Stress / anxiety", "None"]
    static let excChest   = ["Exertion", "Lying flat", "Cold air", "Stress", "Eating", "Deep breathing", "Palpation"]
    static let excDysph   = ["Solids", "Liquids", "Both solids and liquids", "Eating quickly", "Stress", "None"]
    static let excAnoRect = ["Defaecation", "Sitting", "Straining", "Eating"]

    // Relieving sets
    static let relPain    = ["Rest", "Antacids", "Analgesics", "Vomiting", "Defaecation", "Sitting forward", "Eating", "Fasting", "Nothing"]
    static let relLump    = ["Lying down", "Manual reduction", "Rest", "Nothing"]
    static let relChest   = ["Rest", "GTN spray", "Antacids", "Sitting up", "Analgesics", "Nothing"]
    static let relDysph   = ["Small sips of water", "Liquids only", "Sitting upright", "Nothing"]
    static let relAnoRect = ["Lying down", "Warm bath / sitz bath", "Analgesics", "Nothing"]
}

// Returns SOCRATES chip sets adapted to the chief complaint keyword(s)
func socrateDimensions(for cc: String) -> [SOCRATESDimension] {
    let lc = cc.lowercased()

    let isNeck     = lc.contains("neck") || lc.contains("thyroid") || lc.contains("goitre") || lc.contains("goiter") || lc.contains("lymph") || lc.contains("cervical gland")
    let isBreast   = lc.contains("breast") || lc.contains("nipple") || lc.contains("mastalgia")
    let isChestPain = (lc.contains("chest") && lc.contains("pain")) || lc.contains("cardiac") || lc.contains("angina")
    let isGroin    = lc.contains("groin") || lc.contains("hernia") || lc.contains("inguinal") || lc.contains("femoral") || lc.contains("scrotal") || lc.contains("umbilical lump") || lc.contains("incisional")
    let isDysph    = lc.contains("dysphagia") || lc.contains("swallow")
    let isAnoRect  = lc.contains("rectal") || lc.contains("anorectal") || lc.contains("anal") || lc.contains("haemorrhoid") || lc.contains("hemorrhoid") || lc.contains("fissure") || lc.contains("fistula") || lc.contains("perianal")
    let isSkin     = lc.contains("skin") || lc.contains("mole") || lc.contains("melanoma") || lc.contains("sebaceous") || lc.contains("lipoma") || (lc.contains("lump") && (lc.contains("back") || lc.contains("arm") || lc.contains("leg") || lc.contains("scalp") || lc.contains("face")))
    let isUro      = lc.contains("haematuria") || lc.contains("hematuria") || lc.contains("urinary") || lc.contains("urological") || lc.contains("renal colic") || lc.contains("kidney stone") || lc.contains("bladder")
    let isLump     = lc.contains("lump") || lc.contains("mass") || lc.contains("swelling") || lc.contains("node")

    let site: [String], char: [String], rad: [String], assoc: [String], exc: [String], rel: [String]

    switch true {
    case isNeck:
        site = SOCRATESChips.siteNeck;   char = SOCRATESChips.charLump
        rad  = SOCRATESChips.radNeck;    assoc = SOCRATESChips.assocNeck
        exc  = SOCRATESChips.excLump;    rel   = SOCRATESChips.relLump
    case isBreast:
        site = SOCRATESChips.siteBreast; char = SOCRATESChips.charBreast
        rad  = SOCRATESChips.radNone;    assoc = SOCRATESChips.assocBreast
        exc  = SOCRATESChips.excLump;    rel   = SOCRATESChips.relLump
    case isChestPain:
        site = SOCRATESChips.siteChest;  char = SOCRATESChips.charPain
        rad  = SOCRATESChips.radChest;   assoc = SOCRATESChips.assocChest
        exc  = SOCRATESChips.excChest;   rel   = SOCRATESChips.relChest
    case isGroin:
        site = SOCRATESChips.siteGroin;  char = isLump ? SOCRATESChips.charLump : SOCRATESChips.charPain
        rad  = SOCRATESChips.radAbdominal; assoc = SOCRATESChips.assocAbdominal
        exc  = SOCRATESChips.excLump;    rel   = SOCRATESChips.relLump
    case isDysph:
        site = SOCRATESChips.siteDysphagia; char = SOCRATESChips.charPain
        rad  = SOCRATESChips.radNone;    assoc = SOCRATESChips.assocDysphagia
        exc  = SOCRATESChips.excDysph;   rel   = SOCRATESChips.relDysph
    case isAnoRect:
        site = SOCRATESChips.siteAnorectal; char = SOCRATESChips.charPain
        rad  = SOCRATESChips.radNone;    assoc = SOCRATESChips.assocAnorectal
        exc  = SOCRATESChips.excAnoRect; rel   = SOCRATESChips.relAnoRect
    case isSkin:
        site = SOCRATESChips.siteSkin;   char = SOCRATESChips.charSkin
        rad  = SOCRATESChips.radNone;    assoc = SOCRATESChips.assocSkin
        exc  = ["Sun exposure", "Trauma", "None"]
        rel  = ["None", "Reducing sun exposure"]
    case isUro:
        site = SOCRATESChips.siteUrology; char = SOCRATESChips.charPain
        rad  = SOCRATESChips.radUrology; assoc = SOCRATESChips.assocUrology
        exc  = SOCRATESChips.excPain;    rel   = SOCRATESChips.relPain
    default:
        // Default: abdominal / general surgical presentation
        site = SOCRATESChips.siteAbdominal; char = SOCRATESChips.charPain
        rad  = SOCRATESChips.radAbdominal;  assoc = SOCRATESChips.assocAbdominal
        exc  = SOCRATESChips.excPain;       rel   = SOCRATESChips.relPain
    }

    return [
        .init(id: "onset",        title: "Onset",        question: "When did it start?",         icon: "clock",
              chips: SOCRATESChips.onset,    multiSelect: false),
        .init(id: "site",         title: "Site",         question: "Where exactly?",              icon: "mappin",
              chips: site,                   multiSelect: true),
        .init(id: "character",    title: "Character",    question: "What is it like?",            icon: "waveform.path",
              chips: char,                   multiSelect: true),
        .init(id: "radiation",    title: "Radiation",    question: "Does it spread?",             icon: "arrow.up.right.and.arrow.down.left",
              chips: rad,                    multiSelect: false),
        .init(id: "associations", title: "Associations", question: "Associated symptoms?",        icon: "list.bullet",
              chips: assoc,                  multiSelect: true),
        .init(id: "timing",       title: "Timing",       question: "Pattern of symptoms?",        icon: "chart.line.uptrend.xyaxis",
              chips: SOCRATESChips.timing,   multiSelect: true),
        .init(id: "exacerbating", title: "Exacerbating", question: "What makes it worse?",        icon: "arrow.up.circle",
              chips: exc,                    multiSelect: true),
        .init(id: "relieving",    title: "Relieving",    question: "What makes it better?",       icon: "arrow.down.circle",
              chips: rel,                    multiSelect: true),
        .init(id: "severity",     title: "Severity",     question: "Severity rating?",            icon: "speedometer",
              chips: SOCRATESChips.severity, multiSelect: false),
    ]
}

