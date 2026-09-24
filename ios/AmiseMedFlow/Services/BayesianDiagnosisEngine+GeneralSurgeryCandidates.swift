// BayesianDiagnosisEngine+GeneralSurgeryCandidates.swift
// General Surgery / Multidisciplinary differential candidate tables

import Foundation

extension BayesianDiagnosisEngine {


    // ── Breast lump ───────────────────────────────────────────────────

    static let breastLump: [Candidate] = [
        .init(name: "Benign Breast Cyst", icd: "N60.09",
              logPrior: 35, features: [
            .init(key: "timing", value: "Episodic", logLR: 8, evidenceLabel: "Cyclical symptoms"),
            .init(key: "sex_female", value: "", logLR: 6, evidenceLabel: "Female sex"),
            .init(key: "age_under", value: "55", logLR: 6, evidenceLabel: "Pre/peri-menopausal"),
            .init(key: "exam", value: "smooth", logLR: 8, evidenceLabel: "Smooth, mobile"),
            .init(key: "exam", value: "tender", logLR: 6, evidenceLabel: "Tender on palpation"),
        ]),
        .init(name: "Fibroadenoma", icd: "N60.29",
              logPrior: 25, features: [
            .init(key: "age_under", value: "35", logLR: 10, evidenceLabel: "Younger woman"),
            .init(key: "sex_female", value: "", logLR: 6, evidenceLabel: "Female sex"),
            .init(key: "exam", value: "mobile", logLR: 10, evidenceLabel: "Mobile lump ('breast mouse')"),
            .init(key: "exam", value: "firm", logLR: 6, evidenceLabel: "Firm texture"),
        ]),
        .init(name: "Breast Carcinoma", icd: "C50.919",
              logPrior: 15, features: [
            .init(key: "age_over", value: "40", logLR: 12, evidenceLabel: "Age >40"),
            .init(key: "timing", value: "Progressive", logLR: 10, evidenceLabel: "Enlarging lump"),
            .init(key: "exam", value: "hard", logLR: 12, evidenceLabel: "Hard lump"),
            .init(key: "exam", value: "irregular", logLR: 12, evidenceLabel: "Irregular border"),
            .init(key: "exam", value: "skin change", logLR: 14, evidenceLabel: "Skin changes"),
            .init(key: "exam", value: "tethered", logLR: 12, evidenceLabel: "Tethered to skin/chest"),
            .init(key: "exam", value: "nipple", logLR: 10, evidenceLabel: "Nipple change/discharge"),
            .init(key: "associations", value: "Anorexia", logLR: 6, evidenceLabel: "Constitutional symptoms"),
            .init(key: "pmh", value: "breast", logLR: 8, evidenceLabel: "FH breast cancer"),
            .init(key: "sex_female", value: "", logLR: 4, evidenceLabel: "Female sex"),
        ]),
        .init(name: "Breast Abscess", icd: "N61.1",
              logPrior: 8, features: [
            .init(key: "associations", value: "Fever", logLR: 14, evidenceLabel: "Fever"),
            .init(key: "character", value: "Throbbing", logLR: 10, evidenceLabel: "Throbbing pain"),
            .init(key: "exam", value: "fluctuant", logLR: 14, evidenceLabel: "Fluctuant swelling"),
            .init(key: "exam", value: "erythema", logLR: 12, evidenceLabel: "Erythema"),
        ]),
        .init(name: "Fat Necrosis", icd: "N64.1",
              logPrior: 8, features: [
            .init(key: "pshx", value: "trauma", logLR: 14, evidenceLabel: "History of trauma"),
            .init(key: "pshx", value: "surgery", logLR: 10, evidenceLabel: "Previous breast surgery"),
            .init(key: "exam", value: "hard", logLR: 8, evidenceLabel: "Hard lump"),
            .init(key: "exam", value: "skin", logLR: 6, evidenceLabel: "Skin tethering"),
            .init(key: "timing", value: "Gradual", logLR: 6, evidenceLabel: "Develops weeks after injury"),
        ]),
        .init(name: "Phyllodes Tumour", icd: "D48.6",
              logPrior: 4, features: [
            .init(key: "timing", value: "Progressive", logLR: 12, evidenceLabel: "Rapidly enlarging"),
            .init(key: "exam", value: "large", logLR: 10, evidenceLabel: "Large lump"),
            .init(key: "exam", value: "lobulated", logLR: 8, evidenceLabel: "Lobulated surface"),
            .init(key: "exam", value: "mobile", logLR: 6, evidenceLabel: "Mobile"),
            .init(key: "age_over", value: "35", logLR: 6, evidenceLabel: "Middle age"),
            .init(key: "age_under", value: "55", logLR: 4, evidenceLabel: "Pre-menopausal / peri-menopausal"),
        ]),
    ]

    // MARK: - Joint pain / Musculoskeletal

    static let jointPain: [Candidate] = [
        .init(name: "Gout", icd: "M10.9",
              logPrior: 35, features: [
            .init(key: "onset", value: "Sudden", logLR: 12, evidenceLabel: "Sudden onset"),
            .init(key: "site", value: "First MTP / big toe", logLR: 16, evidenceLabel: "First MTP joint"),
            .init(key: "character", value: "Severe", logLR: 10, evidenceLabel: "Severe pain"),
            .init(key: "exam", value: "erythema", logLR: 10, evidenceLabel: "Erythema"),
            .init(key: "exam", value: "swelling", logLR: 8, evidenceLabel: "Swelling"),
            .init(key: "pmh", value: "gout", logLR: 14, evidenceLabel: "Previous gout"),
            .init(key: "pmh", value: "hyperuricaemia", logLR: 10, evidenceLabel: "Hyperuricaemia"),
            .init(key: "sex_male", value: "", logLR: 8, evidenceLabel: "Male sex"),
            .init(key: "age_over", value: "40", logLR: 6, evidenceLabel: "Age >40"),
            .init(key: "exacerbating", value: "Alcohol", logLR: 8, evidenceLabel: "Alcohol trigger"),
            .init(key: "inv", value: "uric acid", logLR: 12, evidenceLabel: "Elevated uric acid"),
        ]),
        .init(name: "Septic Arthritis", icd: "M00.9",
              logPrior: 10, features: [
            .init(key: "onset", value: "Sudden", logLR: 10, evidenceLabel: "Sudden onset"),
            .init(key: "associations", value: "Fever", logLR: 14, evidenceLabel: "Fever"),
            .init(key: "character", value: "Severe", logLR: 8, evidenceLabel: "Severe pain"),
            .init(key: "exam", value: "hot", logLR: 12, evidenceLabel: "Hot joint"),
            .init(key: "exam", value: "effusion", logLR: 10, evidenceLabel: "Effusion"),
            .init(key: "inv", value: "wbc", logLR: 10, evidenceLabel: "Elevated WBC"),
            .init(key: "inv", value: "synovial", logLR: 16, evidenceLabel: "Synovial fluid WBC elevated"),
        ]),
        .init(name: "Osteoarthritis", icd: "M19.90",
              logPrior: 25, features: [
            .init(key: "timing", value: "Progressive", logLR: 8, evidenceLabel: "Progressive"),
            .init(key: "timing", value: "Worse over time", logLR: 8, evidenceLabel: "Worsening"),
            .init(key: "exacerbating", value: "Movement", logLR: 8, evidenceLabel: "Worse with movement"),
            .init(key: "relieving", value: "Rest", logLR: 6, evidenceLabel: "Better with rest"),
            .init(key: "associations", value: "Stiffness", logLR: 6, evidenceLabel: "Morning stiffness <1h"),
            .init(key: "age_over", value: "50", logLR: 10, evidenceLabel: "Age >50"),
            .init(key: "inv", value: "x-ray", logLR: 8, evidenceLabel: "X-ray changes"),
        ]),
        .init(name: "Rheumatoid Arthritis", icd: "M06.9",
              logPrior: 12, features: [
            .init(key: "timing", value: "Progressive", logLR: 6, evidenceLabel: "Progressive"),
            .init(key: "timing", value: "Intermittent", logLR: 4, evidenceLabel: "Flares"),
            .init(key: "associations", value: "Symmetrical", logLR: 12, evidenceLabel: "Symmetrical joint involvement"),
            .init(key: "associations", value: "Morning stiffness", logLR: 12, evidenceLabel: "Morning stiffness >1h"),
            .init(key: "exam", value: "deformity", logLR: 10, evidenceLabel: "Joint deformity"),
            .init(key: "pmh", value: "rheumatoid", logLR: 16, evidenceLabel: "Known RA"),
            .init(key: "inv", value: "rf", logLR: 10, evidenceLabel: "Positive RF"),
            .init(key: "inv", value: "anti-ccp", logLR: 14, evidenceLabel: "Anti-CCP positive"),
            .init(key: "sex_female", value: "", logLR: 4, evidenceLabel: "Female sex"),
        ]),
        .init(name: "Sickle Cell Crisis", icd: "D57.219",
              logPrior: 10, features: [
            .init(key: "character", value: "Severe", logLR: 10, evidenceLabel: "Severe pain"),
            .init(key: "character", value: "Aching", logLR: 8, evidenceLabel: "Bone/joint aching"),
            .init(key: "onset", value: "Sudden", logLR: 6, evidenceLabel: "Sudden onset"),
            .init(key: "associations", value: "Fever", logLR: 6, evidenceLabel: "Fever (if infective trigger)"),
            .init(key: "pmh", value: "sickle", logLR: 20, evidenceLabel: "Sickle cell disease"),
            .init(key: "inv", value: "sickle", logLR: 20, evidenceLabel: "Sickle cell on film"),
        ]),
    ]

    // MARK: - Hypertension review

    static let hypertensionReview: [Candidate] = [
        .init(name: "Essential Hypertension", icd: "I10",
              logPrior: 65, features: [
            .init(key: "pmh", value: "hypertension", logLR: 16, evidenceLabel: "Known hypertension"),
            .init(key: "pmh", value: "diabetes", logLR: 5, evidenceLabel: "Diabetes (comorbidity)"),
            .init(key: "age_over", value: "40", logLR: 6, evidenceLabel: "Age >40"),
            .init(key: "associations", value: "Headache", logLR: 4, evidenceLabel: "Headache"),
            .init(key: "associations", value: "Dizziness", logLR: 3, evidenceLabel: "Dizziness"),
            .init(key: "inv", value: "ecg", logLR: 4, evidenceLabel: "ECG for LVH"),
            .init(key: "inv", value: "creatinine", logLR: 4, evidenceLabel: "Renal function"),
        ]),
        .init(name: "Secondary Hypertension", icd: "I15.9",
              logPrior: 8, features: [
            .init(key: "age_under", value: "35", logLR: 8, evidenceLabel: "Young age"),
            .init(key: "associations", value: "Headache", logLR: 6, evidenceLabel: "Headache"),
            .init(key: "associations", value: "Sweating", logLR: 8, evidenceLabel: "Episodic sweating (phaeochromocytoma)"),
            .init(key: "associations", value: "Hypokalaemia", logLR: 8, evidenceLabel: "Hypokalaemia (Conn's)"),
            .init(key: "pmh", value: "ckd", logLR: 10, evidenceLabel: "CKD (renal HTN)"),
            .init(key: "inv", value: "renin", logLR: 10, evidenceLabel: "Renin/aldosterone ratio"),
        ]),
        .init(name: "Hypertensive Urgency / Emergency", icd: "I16.9",
              logPrior: 5, features: [
            .init(key: "character", value: "Severe", logLR: 10, evidenceLabel: "Severe headache"),
            .init(key: "associations", value: "Visual change", logLR: 12, evidenceLabel: "Visual disturbance"),
            .init(key: "associations", value: "Chest pain", logLR: 10, evidenceLabel: "Chest pain"),
            .init(key: "associations", value: "Confusion", logLR: 12, evidenceLabel: "Confusion"),
            .init(key: "exam", value: "papilloedema", logLR: 16, evidenceLabel: "Papilloedema"),
        ]),
    ]

    // MARK: - Diabetes review

    static let diabetesReview: [Candidate] = [
        .init(name: "Type 2 Diabetes Mellitus", icd: "E11.9",
              logPrior: 55, features: [
            .init(key: "pmh", value: "diabetes", logLR: 16, evidenceLabel: "Known T2DM"),
            .init(key: "pmh", value: "t2dm", logLR: 16, evidenceLabel: "T2DM"),
            .init(key: "age_over", value: "40", logLR: 6, evidenceLabel: "Age >40"),
            .init(key: "associations", value: "Polyuria", logLR: 10, evidenceLabel: "Polyuria"),
            .init(key: "associations", value: "Polydipsia", logLR: 10, evidenceLabel: "Polydipsia"),
            .init(key: "associations", value: "Weight loss", logLR: 6, evidenceLabel: "Weight loss"),
            .init(key: "inv", value: "hba1c", logLR: 16, evidenceLabel: "HbA1c elevated"),
            .init(key: "inv", value: "glucose", logLR: 12, evidenceLabel: "Fasting glucose elevated"),
            .init(key: "pmh", value: "hypertension", logLR: 4, evidenceLabel: "Hypertension (comorbidity)"),
        ]),
        .init(name: "Type 1 Diabetes Mellitus", icd: "E10.9",
              logPrior: 10, features: [
            .init(key: "age_under", value: "35", logLR: 6, evidenceLabel: "Younger onset"),
            .init(key: "associations", value: "Weight loss", logLR: 8, evidenceLabel: "Weight loss at diagnosis"),
            .init(key: "pmh", value: "t1dm", logLR: 18, evidenceLabel: "Known T1DM"),
            .init(key: "inv", value: "c-peptide", logLR: 12, evidenceLabel: "Low C-peptide"),
        ]),
        .init(name: "Diabetic Complications", icd: "E11.69",
              logPrior: 15, features: [
            .init(key: "associations", value: "Neuropathy", logLR: 12, evidenceLabel: "Peripheral neuropathy"),
            .init(key: "associations", value: "Visual change", logLR: 10, evidenceLabel: "Retinopathy symptoms"),
            .init(key: "associations", value: "Foot pain", logLR: 10, evidenceLabel: "Diabetic foot"),
            .init(key: "pmh", value: "diabetes", logLR: 10, evidenceLabel: "Diabetes"),
            .init(key: "inv", value: "albumin", logLR: 10, evidenceLabel: "Microalbuminuria"),
            .init(key: "inv", value: "creatinine", logLR: 8, evidenceLabel: "Renal impairment"),
        ]),
    ]

    // MARK: - Anaemia

    static let anaemia: [Candidate] = [
        .init(name: "Iron Deficiency Anaemia", icd: "D50.9",
              logPrior: 40, features: [
            .init(key: "character", value: "Fatigue", logLR: 8, evidenceLabel: "Fatigue"),
            .init(key: "associations", value: "Breathlessness", logLR: 8, evidenceLabel: "Exertional dyspnoea"),
            .init(key: "associations", value: "Pallor", logLR: 10, evidenceLabel: "Pallor"),
            .init(key: "associations", value: "Palpitations", logLR: 6, evidenceLabel: "Palpitations"),
            .init(key: "pmh", value: "rectal bleed", logLR: 12, evidenceLabel: "Rectal bleeding"),
            .init(key: "pmh", value: "menorrhagia", logLR: 12, evidenceLabel: "Menorrhagia"),
            .init(key: "pmh", value: "gastrointestinal", logLR: 8, evidenceLabel: "GI pathology"),
            .init(key: "inv", value: "ferritin", logLR: 14, evidenceLabel: "Low ferritin"),
            .init(key: "inv", value: "microcytic", logLR: 12, evidenceLabel: "Microcytic anaemia"),
            .init(key: "sex_female", value: "", logLR: 6, evidenceLabel: "Female sex"),
        ]),
        .init(name: "Macrocytic Anaemia (B12 / Folate)", icd: "D51.9",
              logPrior: 20, features: [
            .init(key: "associations", value: "Neuropathy", logLR: 12, evidenceLabel: "Peripheral neuropathy"),
            .init(key: "associations", value: "Sore tongue", logLR: 10, evidenceLabel: "Glossitis"),
            .init(key: "pmh", value: "gastric", logLR: 10, evidenceLabel: "Gastric surgery / atrophic gastritis"),
            .init(key: "pmh", value: "crohn", logLR: 8, evidenceLabel: "Crohn's (terminal ileum)"),
            .init(key: "pmh", value: "alcohol", logLR: 8, evidenceLabel: "Alcohol use"),
            .init(key: "inv", value: "macrocytic", logLR: 14, evidenceLabel: "Macrocytic anaemia"),
            .init(key: "inv", value: "b12", logLR: 16, evidenceLabel: "Low B12"),
            .init(key: "inv", value: "folate", logLR: 14, evidenceLabel: "Low folate"),
        ]),
        .init(name: "Anaemia of Chronic Disease", icd: "D63.1",
              logPrior: 18, features: [
            .init(key: "pmh", value: "chronic", logLR: 8, evidenceLabel: "Chronic illness"),
            .init(key: "pmh", value: "rheumatoid", logLR: 10, evidenceLabel: "Rheumatoid arthritis"),
            .init(key: "pmh", value: "malignancy", logLR: 12, evidenceLabel: "Malignancy"),
            .init(key: "pmh", value: "ckd", logLR: 10, evidenceLabel: "CKD"),
            .init(key: "inv", value: "normocytic", logLR: 10, evidenceLabel: "Normocytic anaemia"),
            .init(key: "inv", value: "esr", logLR: 8, evidenceLabel: "Elevated ESR/CRP"),
        ]),
        .init(name: "Haemolytic Anaemia", icd: "D59.9",
              logPrior: 8, features: [
            .init(key: "associations", value: "Jaundice", logLR: 14, evidenceLabel: "Jaundice"),
            .init(key: "associations", value: "Dark urine", logLR: 12, evidenceLabel: "Dark urine (haemoglobinuria)"),
            .init(key: "pmh", value: "sickle", logLR: 14, evidenceLabel: "Sickle cell disease"),
            .init(key: "pmh", value: "autoimmune", logLR: 10, evidenceLabel: "Autoimmune disease"),
            .init(key: "inv", value: "reticulocyte", logLR: 12, evidenceLabel: "Raised reticulocyte count"),
            .init(key: "inv", value: "ldh", logLR: 10, evidenceLabel: "Elevated LDH"),
            .init(key: "inv", value: "direct coombs", logLR: 14, evidenceLabel: "Positive direct Coombs"),
        ]),
    ]

    // ── Skin lesion ───────────────────────────────────────────────────

    static let skinLesion: [Candidate] = [
        .init(name: "Melanoma", icd: "C43.9",
              logPrior: 12, features: [
            .init(key: "timing", value: "Progressive", logLR: 12, evidenceLabel: "Enlarging lesion"),
            .init(key: "character", value: "Irregular borders", logLR: 14, evidenceLabel: "Irregular borders (ABCDE)"),
            .init(key: "character", value: "Pigmented", logLR: 8, evidenceLabel: "Pigmented lesion"),
            .init(key: "exam", value: "ill-defined", logLR: 12, evidenceLabel: "Ill-defined border"),
            .init(key: "exam", value: "regional nodes", logLR: 16, evidenceLabel: "Regional lymphadenopathy"),
            .init(key: "exam", value: "satellite", logLR: 14, evidenceLabel: "Satellite lesions"),
            .init(key: "exam", value: "ulcerated", logLR: 10, evidenceLabel: "Ulcerated surface"),
            .init(key: "age_over", value: "40", logLR: 6, evidenceLabel: "Age >40"),
            .init(key: "pmh", value: "sun", logLR: 8, evidenceLabel: "Sun exposure history"),
        ]),
        .init(name: "Basal Cell Carcinoma", icd: "C44.91",
              logPrior: 20, features: [
            .init(key: "character", value: "Non-pigmented", logLR: 6, evidenceLabel: "Non-pigmented"),
            .init(key: "exam", value: "well-defined", logLR: 8, evidenceLabel: "Pearly / rolled border"),
            .init(key: "exam", value: "ulcerated", logLR: 10, evidenceLabel: "Central ulceration (rodent ulcer)"),
            .init(key: "timing", value: "Progressive", logLR: 8, evidenceLabel: "Slowly enlarging"),
            .init(key: "age_over", value: "50", logLR: 8, evidenceLabel: "Older patient"),
            .init(key: "site", value: "Face", logLR: 10, evidenceLabel: "Head / neck location"),
        ]),
        .init(name: "Squamous Cell Carcinoma", icd: "C44.92",
              logPrior: 15, features: [
            .init(key: "exam", value: "ulcerated", logLR: 12, evidenceLabel: "Ulcerated"),
            .init(key: "exam", value: "raised", logLR: 8, evidenceLabel: "Raised / indurated"),
            .init(key: "exam", value: "crusted", logLR: 10, evidenceLabel: "Crusting"),
            .init(key: "pmh", value: "radiation", logLR: 12, evidenceLabel: "Radiation history"),
            .init(key: "pmh", value: "immunosuppressed", logLR: 10, evidenceLabel: "Immunosuppression"),
            .init(key: "age_over", value: "50", logLR: 8, evidenceLabel: "Older patient"),
        ]),
        .init(name: "Lipoma", icd: "D17.9",
              logPrior: 30, features: [
            .init(key: "character", value: "Soft", logLR: 12, evidenceLabel: "Soft, compressible"),
            .init(key: "exam", value: "mobile", logLR: 8, evidenceLabel: "Mobile, subcutaneous"),
            .init(key: "exam", value: "non-tender", logLR: 6, evidenceLabel: "Non-tender"),
            .init(key: "exam", value: "well-defined", logLR: 8, evidenceLabel: "Well-defined border"),
            .init(key: "timing", value: "Progressive", logLR: 4, evidenceLabel: "Slow growth"),
        ]),
        .init(name: "Sebaceous Cyst (Epidermoid)", icd: "L72.0",
              logPrior: 25, features: [
            .init(key: "exam", value: "punctum", logLR: 16, evidenceLabel: "Punctum visible"),
            .init(key: "exam", value: "smooth", logLR: 6, evidenceLabel: "Smooth, dome-shaped"),
            .init(key: "exam", value: "mobile", logLR: 6, evidenceLabel: "Mobile over underlying tissue"),
            .init(key: "associations", value: "Discharge", logLR: 10, evidenceLabel: "Cheesy discharge"),
            .init(key: "associations", value: "Itching", logLR: 4, evidenceLabel: "Itching"),
        ]),
        .init(name: "Dermatofibroma", icd: "D23.9",
              logPrior: 15, features: [
            .init(key: "character", value: "Flat", logLR: 10, evidenceLabel: "Flat firm papule"),
            .init(key: "exam", value: "dimple sign", logLR: 14, evidenceLabel: "Dimple sign positive"),
            .init(key: "exam", value: "firm", logLR: 6, evidenceLabel: "Firm"),
            .init(key: "site", value: "Thigh", logLR: 8, evidenceLabel: "Lower extremity"),
            .init(key: "site", value: "Lower leg", logLR: 8, evidenceLabel: "Lower extremity"),
        ]),
    ]

    // MARK: – Post-operative Review
    static let postOpReview: [Candidate] = [
        .init(name: "Surgical Site Infection", icd: "T81.40",
              logPrior: 40, features: [
            .init(key: "onset",        value: "3–7 days post-op", logLR: 16, evidenceLabel: "Onset 3–7 days post-operatively"),
            .init(key: "associations", value: "Wound pain",     logLR: 14, evidenceLabel: "Increasing wound pain"),
            .init(key: "associations", value: "Fever",          logLR: 14, evidenceLabel: "Fever >38°C"),
            .init(key: "exam",         value: "erythema",       logLR: 16, evidenceLabel: "Wound erythema, warmth"),
            .init(key: "exam",         value: "discharge",      logLR: 18, evidenceLabel: "Purulent wound discharge — diagnostic"),
            .init(key: "exam",         value: "induration",     logLR: 12, evidenceLabel: "Periincisional induration"),
            .init(key: "inv",          value: "wcc",            logLR: 12, evidenceLabel: "WCC raised / neutrophilia"),
            .init(key: "inv",          value: "crp",            logLR: 12, evidenceLabel: "CRP elevated"),
        ]),
        .init(name: "Anastomotic Leak", icd: "K91.89",
              logPrior: 10, features: [
            .init(key: "onset",        value: "3–5 days post-op", logLR: 18, evidenceLabel: "Onset days 3–5 — peak anastomotic leak window"),
            .init(key: "associations", value: "Fever",          logLR: 16, evidenceLabel: "Fever — sentinel sign"),
            .init(key: "associations", value: "Peritonism",     logLR: 20, evidenceLabel: "Peritonism / sepsis — RED FLAG"),
            .init(key: "associations", value: "Tachycardia",    logLR: 16, evidenceLabel: "Tachycardia / clinical deterioration"),
            .init(key: "exam",         value: "peritonism",     logLR: 18, evidenceLabel: "Generalised peritonism"),
            .init(key: "inv",          value: "ct",             logLR: 20, evidenceLabel: "CT abdomen — leak / free fluid / gas"),
            .init(key: "inv",          value: "crp",            logLR: 16, evidenceLabel: "CRP >150 at day 3 — predictive"),
        ]),
        .init(name: "Post-operative Ileus", icd: "K56.0",
              logPrior: 35, features: [
            .init(key: "onset",        value: "0–5 days post-op", logLR: 14, evidenceLabel: "Expected in first 3–5 days post abdominal surgery"),
            .init(key: "associations", value: "Distension",     logLR: 14, evidenceLabel: "Abdominal distension"),
            .init(key: "associations", value: "No bowel sounds", logLR: 16, evidenceLabel: "Absent bowel sounds"),
            .init(key: "associations", value: "No flatus",      logLR: 14, evidenceLabel: "No flatus / no stool"),
            .init(key: "associations", value: "Nausea",         logLR: 12, evidenceLabel: "Nausea / vomiting"),
            .init(key: "pmh",          value: "opioid",         logLR: 12, evidenceLabel: "Opioid use"),
            .init(key: "inv",          value: "xray",           logLR: 12, evidenceLabel: "AXR — dilated loops, no transition point"),
        ]),
        .init(name: "Post-operative DVT / PE", icd: "I82.409",
              logPrior: 15, features: [
            .init(key: "associations", value: "Calf pain",      logLR: 14, evidenceLabel: "Calf pain / swelling (DVT)"),
            .init(key: "associations", value: "Breathlessness", logLR: 16, evidenceLabel: "Breathlessness — PE RED FLAG"),
            .init(key: "associations", value: "Chest pain",     logLR: 14, evidenceLabel: "Pleuritic chest pain — PE"),
            .init(key: "associations", value: "Tachycardia",    logLR: 14, evidenceLabel: "Tachycardia"),
            .init(key: "pmh",          value: "dvt",            logLR: 14, evidenceLabel: "Prior DVT / PE"),
            .init(key: "pmh",          value: "immobile",       logLR: 12, evidenceLabel: "Post-op immobility"),
            .init(key: "inv",          value: "doppler",        logLR: 18, evidenceLabel: "Duplex USS — DVT"),
            .init(key: "inv",          value: "ctpa",           logLR: 20, evidenceLabel: "CTPA — pulmonary emboli"),
            .init(key: "inv",          value: "d-dimer",        logLR: 12, evidenceLabel: "D-dimer elevated"),
        ]),
        .init(name: "Post-operative Haemorrhage", icd: "T81.0",
              logPrior: 10, features: [
            .init(key: "onset",        value: "0–24h",          logLR: 16, evidenceLabel: "Primary haemorrhage: first 24h"),
            .init(key: "associations", value: "Tachycardia",    logLR: 16, evidenceLabel: "Tachycardia / hypotension — RED FLAG"),
            .init(key: "associations", value: "Drain output",   logLR: 18, evidenceLabel: "Heavy drain output / haematoma expanding"),
            .init(key: "associations", value: "Pallor",         logLR: 12, evidenceLabel: "Pallor / anaemia"),
            .init(key: "exam",         value: "haematoma",      logLR: 16, evidenceLabel: "Expanding wound haematoma"),
            .init(key: "inv",          value: "hb",             logLR: 14, evidenceLabel: "Falling haemoglobin"),
        ]),
        .init(name: "Incisional Hernia", icd: "K43.2",
              logPrior: 15, features: [
            .init(key: "timing",       value: "Weeks-months post-op", logLR: 16, evidenceLabel: "Develops weeks to months after laparotomy"),
            .init(key: "exam",         value: "fascial defect",  logLR: 20, evidenceLabel: "Palpable fascial defect — diagnostic"),
            .init(key: "exam",         value: "bulge",          logLR: 16, evidenceLabel: "Visible/palpable wound bulge on straining"),
            .init(key: "associations", value: "Reducible",      logLR: 14, evidenceLabel: "Reducible on lying flat"),
            .init(key: "pmh",          value: "obesity",        logLR: 12, evidenceLabel: "Obesity / poor nutrition"),
            .init(key: "pmh",          value: "wound infection", logLR: 12, evidenceLabel: "Prior wound infection"),
            .init(key: "inv",          value: "ultrasound",     logLR: 14, evidenceLabel: "USS or CT — hernia sac contents"),
        ]),
    ]

}
