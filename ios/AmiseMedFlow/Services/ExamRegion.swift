// ExamRegion.swift
// The examination region of the Exam step, chosen from the complaint's history frame
// (evidence-exam). The history step already classifies the chief complaint into a symptom type and
// frame (HistoryFrameClassifier, twin of lib/triage-engine/src/history-frames); the Exam step reuses
// that classification instead of keyword checks of its own, so a cough gets the chest, a groin lump
// the hernia examination and an unrecognised complaint the general examination (never the abdomen
// by default). clinical-content/rules/exam-signs.json "frames" maps each frame to a region id; this
// file holds each region's label, one-tap chips (clinician-facing text; nothing is written until
// tapped) and the record field it belongs to: chest findings go in Respiratory / Cardiovascular,
// neurological ones in Neurological, a limb or the back in Musculoskeletal, skin, wounds and
// soft-tissue lumps in Skin / Wound, so they print under the right heading. Abdominal, groin,
// perineal, urological and neck / breast regions use the primary field (Patient.examAbdo) as before.

import Foundation

struct ExamRegion: Equatable {
    /// The examination field a region's findings are recorded in.
    enum Field: Equatable {
        case general, cvs, resp, abdo, neuro, msk, skin
    }

    /// Region id (exam-signs.json frames[].region).
    let id: String
    let label: String
    let field: Field
    let chips: [String]

    static let general = ExamRegion(id: "general", label: "General appearance", field: .general, chips: [
        "No lymphadenopathy.", "No hepatosplenomegaly.", "Hernial orifices intact.", "Calves soft, non-tender.",
        "No peripheral oedema.", "Wound healed.", "No rash.",
    ])

    static let abdomen = ExamRegion(id: "abdomen", label: "Abdomen", field: .abdo, chips: [
        "Soft, non-tender.", "Tender RUQ.", "Tender RLQ.", "Guarding.", "Rigidity.", "Murphy's +ve.",
        "Bowel sounds normal.", "No organomegaly.", "Hepatomegaly.", "Distended.",
    ])

    static let all: [ExamRegion] = [
        abdomen,
        ExamRegion(id: "chest-cardiac", label: "Cardiovascular / Chest", field: .cvs, chips: [
            "Regular rate and rhythm.", "Irregular (AF).", "Dual heart sounds.", "Systolic murmur.",
            "Ejection systolic murmur.", "S3 gallop.", "Elevated JVP.", "Pitting oedema ankles.",
            "Peripheral pulses present bilaterally.", "Absent left radial pulse.", "No chest wall tenderness.",
            "Reproducible on palpation.", "Apex beat non-displaced.",
        ]),
        ExamRegion(id: "chest-respiratory", label: "Respiratory / Chest", field: .resp, chips: [
            "Respiratory rate normal.", "Trachea central.", "Chest expansion equal.", "Reduced expansion.",
            "Dull to percussion.", "Bronchial breathing.", "Coarse crackles.", "Fine crackles.", "Expiratory wheeze.",
            "Clear to auscultation bilaterally.", "Finger clubbing.",
        ]),
        ExamRegion(id: "neck", label: "Neck Examination", field: .abdo, chips: [
            "Mobile, non-tender.", "Fixed to deep tissue.", "Moves on swallowing.", "Pulsatile; bruit present.",
            "Hard and irregular.", "Smooth and soft.", "Tender.", "Non-tender.", "Thyroid diffusely enlarged.",
            "Single nodule.", "Multiple nodes palpable.", "No palpable lymphadenopathy.",
        ]),
        ExamRegion(id: "breast", label: "Breast Examination", field: .abdo, chips: [
            "Mobile, non-tender.", "Fixed to overlying skin.", "Fixed to pectoral muscle.", "Irregular, hard.", "Smooth, soft.",
            "Nipple inversion.", "Skin dimpling / peau d'orange.", "Axillary nodes palpable.", "Axillary nodes not palpable.",
            "Nipple discharge.", "No skin changes.",
        ]),
        ExamRegion(id: "groin", label: "Groin / Hernia", field: .abdo, chips: [
            "Cough impulse present.", "Reducible.", "Irreducible.", "Above inguinal ligament.", "Below inguinal ligament.",
            "Extending into scrotum.", "Transilluminates.", "No transillumination.", "Tender on palpation.",
            "Soft, easily reducible.",
        ]),
        ExamRegion(id: "oropharynx", label: "Oropharynx / Neck", field: .abdo, chips: [
            "Oropharynx clear.", "No neck mass.", "Moves on swallowing.", "Cervical lymphadenopathy.", "Voice normal on exam.",
            "Hoarse voice.",
        ]),
        ExamRegion(id: "perianal", label: "Perianal / PR Examination", field: .abdo, chips: [
            "Perianal skin normal.", "External haemorrhoids visible.", "Perianal erythema.", "Fluctuant perianal mass.",
            "Skin tag.", "External fistula opening.", "Posterior midline fissure.", "Normal rectal tone on DRE.",
            "Tender on DRE.", "Blood on glove.", "Mucosa normal on PR.",
        ]),
        ExamRegion(id: "skin", label: "Skin Lesion", field: .skin, chips: [
            "Well-defined border.", "Ill-defined border.", "Pigmented lesion.", "Non-pigmented.", "Raised >2 mm.", "Flat.",
            "Ulcerated.", "Smooth surface.", "Regional nodes not palpable.", "Regional nodes enlarged.", "Satellite lesions.",
        ]),
        ExamRegion(id: "wound", label: "Wound / Soft Tissue", field: .skin, chips: [
            "Wound clean and dry.", "Erythema around wound.", "Spreading erythema.", "Purulent discharge.",
            "Fluctuant collection.", "Wound dehiscence.", "Crepitus.", "Necrotic tissue.", "Pain out of proportion.",
            "Lymphangitis.", "Regional nodes enlarged.",
        ]),
        ExamRegion(id: "lump", label: "Lump / Soft Tissue", field: .skin, chips: [
            "Well-defined, mobile.", "Fixed to deep tissue.", "Soft, fluctuant.", "Firm.", "Hard, irregular.", "Tender.",
            "Non-tender.", "Transilluminates.", "Punctum present.", "Overlying skin normal.", "Regional nodes not palpable.",
            "Regional nodes enlarged.",
        ]),
        ExamRegion(id: "scrotal", label: "Scrotal / Testicular", field: .abdo, chips: [
            "Tender testis.", "Non-tender.", "Transilluminates (hydrocele).", "No transillumination.", "Warm and erythematous.",
            "Normal cremasteric reflex.", "Absent cremasteric reflex.", "Epididymal cyst.", "Scrotal oedema.",
            "Mass separate from testis.",
        ]),
        ExamRegion(id: "urological", label: "Renal / Urological", field: .abdo, chips: [
            "No renal angle tenderness.", "Right renal angle tender.", "Left renal angle tender.", "Bladder palpable to umbilicus.",
            "Suprapubic tenderness.", "Prostate smooth, not enlarged (DRE).", "Prostate enlarged, benign (DRE).",
            "Prostate hard, irregular (DRE).",
        ]),
        ExamRegion(id: "neuro", label: "Neurological", field: .neuro, chips: [
            "GCS 15, orientated.", "Neck supple.", "Neck stiffness.", "Cranial nerves intact.", "Facial weakness.",
            "Pronator drift.", "Power 5/5 all limbs.", "Reduced power.", "Sensation intact.", "Reflexes symmetrical.",
            "Plantars downgoing.", "Gait normal.", "Past-pointing.",
        ]),
        ExamRegion(id: "limb", label: "Limb / Peripheral Vascular", field: .msk, chips: [
            "Calf swelling.", "Pitting oedema.", "Calf tenderness.", "Peripheral pulses present.", "Absent foot pulses.",
            "Cool, pale limb.", "Capillary refill < 2 s.", "Erythema / warmth.", "Joint effusion.", "Reduced range of movement.",
            "Bony tenderness.",
        ]),
        ExamRegion(id: "back", label: "Spine / Back", field: .msk, chips: [
            "Spinal tenderness.", "Paraspinal spasm.", "Straight-leg raise positive.", "Power normal lower limbs.",
            "Reduced power lower limbs.", "Saddle sensation intact.", "Saddle anaesthesia.", "Anal tone normal (DRE).",
            "Renal angle tenderness.", "Pulsatile abdominal mass.",
        ]),
        general,
    ]

    /// Salivary glands are examined as a variant of the neck region.
    static let salivary = ExamRegion(id: "neck", label: "Salivary Gland / Jaw", field: .abdo, chips: [
        "Soft, mobile.", "Firm, fixed.", "Tender.", "Non-tender.", "Facial nerve intact.", "Bimanual — stone palpable.",
        "No stone palpable.", "Erythema overlying skin.",
    ])

    static func region(id: String) -> ExamRegion {
        all.first { $0.id == id } ?? general
    }

    /// The region for a history frame (the primary frame of the complaint). A neck lump the
    /// complaint names as parotid or salivary gets the salivary-gland chips.
    static func forFrame(_ frameID: String, complaint: String) -> ExamRegion {
        let id = ExamEvidenceCatalogue.frame(frameID)?.region ?? fallbackRegionID(frameID)
        let chosen = ExamRegion.region(id: id)
        if chosen.id == "neck" {
            let lower = complaint.lowercased()
            if ExamEvidenceCatalogue.wordStart(lower, "parotid") || ExamEvidenceCatalogue.wordStart(lower, "salivary") {
                return salivary
            }
        }
        return chosen
    }

    /// Only when the shared rules file could not be read (Settings → Diagnostics says why): pain in
    /// the abdomen stays the abdomen, anything else the general examination.
    private static func fallbackRegionID(_ frameID: String) -> String {
        frameID == "pain.abdomen" ? "abdomen" : "general"
    }

    // MARK: - The examination fields

    /// Chips of a field when it is not the region's own field (the fields' usual chips).
    static let defaultChips: [Field: [String]] = [
        .general: ["Alert, no distress.", "Cachexic.", "Jaundiced.", "Pallor.", "Ankle oedema.", "Unwell."],
        .cvs: ["Regular rate and rhythm. No murmurs.", "Dual heart sounds.", "Systolic murmur.", "Pitting oedema ankles.",
               "Elevated JVP."],
        .resp: ["Clear to auscultation bilaterally.", "Reduced air entry.", "Fine crackles.", "Expiratory wheeze.",
                "Dull to percussion."],
        .abdo: abdomen.chips,
    ]

    static let defaultLabels: [Field: String] = [
        .general: "General appearance", .cvs: "Cardiovascular", .resp: "Respiratory", .abdo: "Abdomen",
        .neuro: "Neurological", .msk: "Musculoskeletal", .skin: "Skin / Wound",
    ]

    /// The label of a field: the region's own label on its field, else the field's usual label.
    func label(for field: Field) -> String {
        field == self.field ? label : (ExamRegion.defaultLabels[field] ?? "")
    }

    /// The chips of a field: the region's chips on its field (after the usual general-appearance
    /// chips for the general examination), else the field's usual chips.
    func chips(for field: Field) -> [String] {
        let usual = ExamRegion.defaultChips[field] ?? []
        guard field == self.field else { return usual }
        return field == .general ? usual + chips : chips
    }

    /// Neurological, musculoskeletal and skin fields are shown in the short examination too when
    /// they are the region's own field.
    func showsInShortExam(_ field: Field) -> Bool {
        switch field {
        case .general, .cvs, .resp, .abdo: return true
        case .neuro, .msk, .skin: return field == self.field
        }
    }
}
