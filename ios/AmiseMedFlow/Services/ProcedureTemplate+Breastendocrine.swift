// ProcedureTemplate+Breastendocrine.swift
// Breast and endocrine procedures.

import Foundation

extension ProcedureTemplate {

    static let _breastEndocrine: [ProcedureTemplate] = [
        // ── BREAST & ENDOCRINE ───────────────────────────────────────────────

        ProcedureTemplate(
            name: "Total Thyroidectomy",
            category: .breast,
            shortName: "Total Thyroidectomy",
            anaesthesiaType: "General",
            position: "Supine",
            positioning: ["Shoulder roll", "Gel pads"],
            skinPrep: "Chlorhexidine/alcohol — neck to sternal notch",
            draping: "Head ring, neck exposed",
            incision: "Kocher incision — 4–6 cm transverse low cervical crease incision",
            techniqueDescription:
                "Patient supine with neck extended using shoulder roll. " +
                "Kocher incision deepened through platysma. Subplatysmal flaps raised. " +
                "Strap muscles separated in midline and retracted laterally. " +
                "Thyroid lobe elevated and rotated medially. " +
                "Recurrent laryngeal nerve identified and traced from thoracic inlet to laryngeal entry — bilateral. " +
                "Superior and inferior parathyroid glands identified and preserved with their vascular pedicles. " +
                "Berry's ligament divided and thyroid removed. " +
                "Haemostasis secured. Parathyroid viability confirmed — autotransplantation if compromised.",
            closure: "Strap muscles approximated 2-0 Vicryl. Platysma 3-0 Vicryl. Subcuticular 4-0 Monocryl. Steri-Strips.",
            drainUsually: true,
            drainType: "Suction drain size 10 — removed when <20 mL/24h",
            specimenUsually: true,
            postOpOrders:
                "Calcium monitoring 6h and 24h post-op. " +
                "Calcium + Vitamin D supplementation (CalciChew D3) from day 1. " +
                "Levothyroxine commenced day 1 post-op as per endocrine protocol. " +
                "Vocal cord check if concerns. Discharge day 2–3.",
            followUpWeeks: "2",
            patientDescription:
                "Surgical removal of the entire thyroid gland through a small incision in the lower neck. " +
                "The recurrent laryngeal nerves and parathyroid glands are identified and preserved.",
            specificRisks: [
                "Recurrent laryngeal nerve injury — hoarseness (temporary or permanent)",
                "Hypoparathyroidism — low calcium requiring supplementation",
                "Haematoma (airway-threatening)",
                "Wound infection",
                "Hypothyroidism (expected — treated with thyroxine)"
            ],
            alternatives: [
                "Hemithyroidectomy (lobectomy)",
                "Medical management (medications)",
                "Radioiodine ablation",
                "Conservative management / watchful waiting"
            ]
        ),

        ProcedureTemplate(
            name: "Hemithyroidectomy (Lobectomy)",
            category: .breast,
            shortName: "Hemithyroidectomy",
            anaesthesiaType: "General",
            position: "Supine",
            positioning: ["Shoulder roll", "Gel pads"],
            skinPrep: "Chlorhexidine/alcohol — neck to sternal notch",
            draping: "Head ring, neck exposed",
            incision: "Kocher incision — 4–5 cm transverse low cervical crease",
            techniqueDescription:
                "Kocher incision deepened through platysma. Subplatysmal flaps raised. " +
                "Strap muscles separated. Affected lobe identified. " +
                "Recurrent laryngeal nerve traced and protected throughout. " +
                "Ipsilateral parathyroid glands identified and preserved. " +
                "Isthmus divided. Lobe removed. " +
                "Haemostasis secured. Contralateral lobe and parathyroids confirmed intact.",
            closure: "Strap muscles approximated 2-0 Vicryl. Platysma 3-0 Vicryl. Subcuticular 4-0 Monocryl.",
            drainUsually: false,
            drainType: "",
            specimenUsually: true,
            postOpOrders:
                "Calcium monitoring 6h post-op. Vocal cord check if indicated. " +
                "Paracetamol + Ibuprofen. Discharge day 1–2. " +
                "Thyroid function tests at 6 weeks post-op.",
            followUpWeeks: "2",
            patientDescription:
                "Removal of one lobe of the thyroid gland (one half of the thyroid) through a small incision in the lower neck.",
            specificRisks: [
                "Recurrent laryngeal nerve injury — hoarseness",
                "Hypoparathyroidism (transient)",
                "Haematoma",
                "Hypothyroidism — may require thyroxine",
                "Wound infection"
            ],
            alternatives: [
                "Total thyroidectomy",
                "Conservative management / watchful waiting",
                "Radioiodine ablation"
            ]
        ),

        ProcedureTemplate(
            name: "Wide Local Excision + Sentinel Lymph Node Biopsy",
            category: .breast,
            shortName: "WLE + SLNB",
            anaesthesiaType: "General",
            position: "Supine",
            positioning: ["Arm board"],
            skinPrep: "Chlorhexidine/alcohol — entire breast and axilla",
            draping: "Arm draped into field for axillary access",
            incision: "Curvilinear incision over lesion / wire/RADS localisation site; separate axillary incision for SLNB",
            techniqueDescription:
                "Radioisotope (Tc-99m nanocolloid) injected peri-tumourally previous day. " +
                "Isosulfan blue / Methylene blue dye injected peri-areolar at start of case. " +
                "WLE: Wire/RADS/USS-guided localisation. Excision with ≥1 mm macroscopic margin, specimen oriented (long lateral, short superior, deep suture). Specimen X-ray confirming excision. " +
                "SLNB: Axillary incision. Gamma probe used to identify hot/blue node(s). All hot and blue nodes removed. Node counts documented.",
            closure: "Breast: deep tissues 2-0 Vicryl. Skin 3-0 Monocryl subcuticular. Axilla: 3-0 Monocryl.",
            drainUsually: false,
            drainType: "",
            specimenUsually: true,
            postOpOrders:
                "Arm exercises from day 1. Paracetamol + Ibuprofen. " +
                "Await pathology — multidisciplinary team meeting. Discharge same day or day 1. " +
                "Results appointment in 2 weeks.",
            followUpWeeks: "2",
            patientDescription:
                "Removal of the breast lump/cancer with a margin of healthy tissue (wide local excision) and removal of the first lymph node draining the breast (sentinel node biopsy) to check if cancer has spread.",
            specificRisks: [
                "Positive margins requiring further excision",
                "Seroma / haematoma",
                "Lymphoedema",
                "Altered sensation / numbness",
                "Cosmetic asymmetry",
                "Wound infection"
            ],
            alternatives: [
                "Mastectomy",
                "Axillary node clearance (if SLNB positive)",
                "Neoadjuvant chemotherapy first"
            ]
        ),

        ProcedureTemplate(
            name: "Simple Mastectomy",
            category: .breast,
            shortName: "Mastectomy",
            anaesthesiaType: "General",
            position: "Supine",
            positioning: ["Arm board"],
            skinPrep: "Chlorhexidine/alcohol — chest and axilla",
            draping: "Standard, arm accessible",
            incision: "Transverse / oblique elliptical incision encompassing nipple-areolar complex",
            techniqueDescription:
                "Elliptical incision including nipple-areolar complex (unless nipple-sparing). " +
                "Skin flaps raised with electrocautery at subcutaneous/breast interface, preserving ≥5 mm dermal thickness. " +
                "Breast tissue dissected off pectoralis major fascia (with fascia if indicated). " +
                "Axillary tail dissected. Specimen removed. " +
                "If immediate reconstruction: oncoplastic/implant/LD flap as per pre-op plan. " +
                "Haemostasis secured.",
            closure: "Deep 2-0 Vicryl. Skin 3-0 Monocryl subcuticular.",
            drainUsually: true,
            drainType: "Two suction drains — axilla and anterior chest wall",
            specimenUsually: true,
            postOpOrders:
                "Drain management: remove when <30 mL/24h. " +
                "Arm exercises day 1. Paracetamol + regular NSAID. " +
                "Breast care nurse referral. Prosthesis fitting at 6 weeks. " +
                "MDT meeting for adjuvant therapy planning. Discharge day 2–3.",
            followUpWeeks: "2",
            patientDescription:
                "Surgical removal of the entire breast including the nipple through a single incision. " +
                "Reconstruction can be discussed separately.",
            specificRisks: [
                "Seroma (very common, may need aspiration)",
                "Wound infection",
                "Skin flap necrosis",
                "Lymphoedema (if axillary surgery also performed)",
                "Altered sensation over chest wall",
                "Psychological impact / body image"
            ],
            alternatives: [
                "Wide local excision + radiotherapy",
                "Neoadjuvant chemotherapy first"
            ]
        ),

    ]

}
