// BayesianDiagnosisEngine+UrologyCandidates.swift
// Urology differential candidate tables

extension BayesianDiagnosisEngine {


    // MARK: - Urinary symptoms

    static let urinarySymptoms: [Candidate] = [
        .init(name: "Urinary Tract Infection", icd: "N39.0",
              logPrior: 45, features: [
            .init(key: "associations", value: "Dysuria", logLR: 14, evidenceLabel: "Dysuria"),
            .init(key: "associations", value: "Frequency", logLR: 10, evidenceLabel: "Frequency"),
            .init(key: "associations", value: "Haematuria", logLR: 8, evidenceLabel: "Haematuria"),
            .init(key: "site", value: "Suprapubic", logLR: 8, evidenceLabel: "Suprapubic pain"),
            .init(key: "associations", value: "Fever", logLR: 8, evidenceLabel: "Fever (pyelonephritis)"),
            .init(key: "site", value: "Loin", logLR: 8, evidenceLabel: "Loin pain (upper tract)"),
            .init(key: "inv", value: "leucocyte", logLR: 12, evidenceLabel: "Leucocytes on dipstick"),
            .init(key: "inv", value: "nitrite", logLR: 10, evidenceLabel: "Nitrites on dipstick"),
            .init(key: "sex_female", value: "", logLR: 8, evidenceLabel: "Female sex"),
        ]),
        .init(name: "Renal / Ureteric Colic", icd: "N20.10",
              logPrior: 20, features: [
            .init(key: "character", value: "Colicky", logLR: 12, evidenceLabel: "Colicky pain"),
            .init(key: "site", value: "Loin", logLR: 12, evidenceLabel: "Loin to groin"),
            .init(key: "site", value: "Groin", logLR: 10, evidenceLabel: "Radiation to groin"),
            .init(key: "associations", value: "Haematuria", logLR: 14, evidenceLabel: "Haematuria"),
            .init(key: "pmh", value: "renal stone", logLR: 14, evidenceLabel: "Previous stones"),
            .init(key: "inv", value: "ct kub", logLR: 16, evidenceLabel: "CT KUB stone"),
        ]),
        .init(name: "Benign Prostatic Hypertrophy", icd: "N40.0",
              logPrior: 15, features: [
            .init(key: "associations", value: "Poor stream", logLR: 12, evidenceLabel: "Poor stream"),
            .init(key: "associations", value: "Frequency", logLR: 8, evidenceLabel: "Frequency"),
            .init(key: "associations", value: "Nocturia", logLR: 10, evidenceLabel: "Nocturia"),
            .init(key: "associations", value: "Incomplete emptying", logLR: 10, evidenceLabel: "Incomplete emptying"),
            .init(key: "age_over", value: "55", logLR: 12, evidenceLabel: "Age >55"),
            .init(key: "sex_male", value: "", logLR: 20, evidenceLabel: "Male sex"),
            .init(key: "inv", value: "psa", logLR: 8, evidenceLabel: "PSA checked"),
        ]),
        .init(name: "Carcinoma of Prostate", icd: "C61",
              logPrior: 8, features: [
            .init(key: "timing", value: "Progressive", logLR: 10, evidenceLabel: "Progressive symptoms"),
            .init(key: "associations", value: "Haematuria", logLR: 8, evidenceLabel: "Haematuria"),
            .init(key: "associations", value: "Bone pain", logLR: 10, evidenceLabel: "Bone pain (metastatic)"),
            .init(key: "age_over", value: "60", logLR: 12, evidenceLabel: "Age >60"),
            .init(key: "sex_male", value: "", logLR: 20, evidenceLabel: "Male sex"),
            .init(key: "inv", value: "psa", logLR: 14, evidenceLabel: "Elevated PSA"),
            .init(key: "exam", value: "hard", logLR: 12, evidenceLabel: "Hard nodule on PR"),
        ]),
    ]

    // MARK: - Renal colic

    static let renalColic: [Candidate] = [
        .init(name: "Renal Colic / Ureteric Calculus", icd: "N20.1",
              logPrior: 35, features: [
            .init(key: "onset", value: "Sudden", logLR: 12, evidenceLabel: "Sudden onset"),
            .init(key: "character", value: "Colicky", logLR: 16, evidenceLabel: "Colicky pain"),
            .init(key: "radiation", value: "Loin to groin", logLR: 20, evidenceLabel: "Loin-to-groin radiation"),
            .init(key: "radiation", value: "Groin", logLR: 14, evidenceLabel: "Groin radiation"),
            .init(key: "associations", value: "Haematuria", logLR: 16, evidenceLabel: "Haematuria"),
            .init(key: "associations", value: "Nausea", logLR: 6, evidenceLabel: "Nausea/vomiting"),
            .init(key: "associations", value: "Restless", logLR: 10, evidenceLabel: "Patient writhing/restless"),
            .init(key: "pmh", value: "kidney stone", logLR: 16, evidenceLabel: "Previous kidney stones"),
            .init(key: "inv", value: "haematuria", logLR: 14, evidenceLabel: "Haematuria on urine dipstick"),
        ]),
        .init(name: "Pyelonephritis", icd: "N10",
              logPrior: 20, features: [
            .init(key: "site", value: "Loin", logLR: 12, evidenceLabel: "Loin pain"),
            .init(key: "associations", value: "Fever", logLR: 12, evidenceLabel: "Fever"),
            .init(key: "associations", value: "Dysuria", logLR: 10, evidenceLabel: "Dysuria"),
            .init(key: "associations", value: "Frequency", logLR: 8, evidenceLabel: "Urinary frequency"),
            .init(key: "exam", value: "renal angle", logLR: 14, evidenceLabel: "Renal angle tenderness"),
            .init(key: "sex_female", value: "", logLR: 6, evidenceLabel: "Female sex"),
        ]),
        .init(name: "Renal Cell Carcinoma", icd: "C64.9",
              logPrior: 8, features: [
            .init(key: "associations", value: "Haematuria", logLR: 14, evidenceLabel: "Painless haematuria"),
            .init(key: "associations", value: "Weight loss", logLR: 10, evidenceLabel: "Weight loss"),
            .init(key: "exam", value: "mass", logLR: 14, evidenceLabel: "Flank mass"),
            .init(key: "timing", value: "Progressive", logLR: 8, evidenceLabel: "Progressive"),
            .init(key: "age_over", value: "50", logLR: 6, evidenceLabel: "Age >50"),
            .init(key: "pmh", value: "smoking", logLR: 8, evidenceLabel: "Smoking"),
        ]),
    ]

    // ── Scrotal / testicular ──────────────────────────────────────────

    static let scrotalTesticular: [Candidate] = [
        .init(name: "Testicular Torsion", icd: "N44.00",
              logPrior: 20, features: [
            .init(key: "onset", value: "Sudden", logLR: 16, evidenceLabel: "Sudden onset"),
            .init(key: "character", value: "Severe", logLR: 12, evidenceLabel: "Severe pain"),
            .init(key: "associations", value: "Nausea", logLR: 10, evidenceLabel: "Nausea / vomiting"),
            .init(key: "exam", value: "absent cremasteric reflex", logLR: 18, evidenceLabel: "Absent cremasteric reflex"),
            .init(key: "exam", value: "tender testis", logLR: 12, evidenceLabel: "Tender, high-riding testis"),
            .init(key: "exam", value: "warm", logLR: 6, evidenceLabel: "Warm scrotum"),
            .init(key: "age_under", value: "25", logLR: 12, evidenceLabel: "Peak incidence < 25 yr"),
        ]),
        .init(name: "Epididymo-Orchitis", icd: "N45.3",
              logPrior: 25, features: [
            .init(key: "associations", value: "Fever", logLR: 12, evidenceLabel: "Fever"),
            .init(key: "associations", value: "Dysuria", logLR: 10, evidenceLabel: "Dysuria"),
            .init(key: "exam", value: "tender", logLR: 10, evidenceLabel: "Tender epididymis / testis"),
            .init(key: "exam", value: "warm and erythematous", logLR: 12, evidenceLabel: "Erythema"),
            .init(key: "exam", value: "normal cremasteric reflex", logLR: 8, evidenceLabel: "Cremasteric reflex present"),
            .init(key: "age_over", value: "30", logLR: 6, evidenceLabel: "Adult — STI or UTI source"),
            .init(key: "inv", value: "wbc", logLR: 8, evidenceLabel: "Leukocytosis"),
        ]),
        .init(name: "Hydrocele", icd: "N43.3",
              logPrior: 25, features: [
            .init(key: "exam", value: "transilluminates", logLR: 16, evidenceLabel: "Transillumination positive"),
            .init(key: "exam", value: "scrotal oedema", logLR: 6, evidenceLabel: "Diffuse scrotal swelling"),
            .init(key: "exam", value: "non-tender", logLR: 6, evidenceLabel: "Non-tender"),
            .init(key: "character", value: "Smooth", logLR: 8, evidenceLabel: "Smooth swelling surrounding testis"),
            .init(key: "timing", value: "Progressive", logLR: 6, evidenceLabel: "Slowly enlarging"),
        ]),
        .init(name: "Varicocele", icd: "I86.1",
              logPrior: 15, features: [
            .init(key: "character", value: "Dull", logLR: 8, evidenceLabel: "Dull aching dragging pain"),
            .init(key: "exacerbating", value: "Standing", logLR: 12, evidenceLabel: "Worse on standing / Valsalva"),
            .init(key: "relieving", value: "Lying down", logLR: 10, evidenceLabel: "Relieved by lying"),
            .init(key: "exam", value: "bag of worms", logLR: 16, evidenceLabel: "'Bag of worms' on palpation"),
            .init(key: "site", value: "Left", logLR: 8, evidenceLabel: "Left-sided (most common)"),
        ]),
        .init(name: "Testicular Tumour", icd: "C62.90",
              logPrior: 10, features: [
            .init(key: "timing", value: "Progressive", logLR: 12, evidenceLabel: "Enlarging, painless mass"),
            .init(key: "exam", value: "non-tender", logLR: 8, evidenceLabel: "Non-tender hard mass"),
            .init(key: "exam", value: "no transillumination", logLR: 10, evidenceLabel: "No transillumination"),
            .init(key: "exam", value: "mass separate", logLR: 8, evidenceLabel: "Epididymis separate from mass"),
            .init(key: "age_over", value: "15", logLR: 6, evidenceLabel: "Peak 15–35 yr"),
            .init(key: "age_under", value: "40", logLR: 6, evidenceLabel: "Young male"),
            .init(key: "inv", value: "afp", logLR: 14, evidenceLabel: "Elevated AFP / β-hCG"),
            .init(key: "inv", value: "ldh", logLR: 8, evidenceLabel: "Elevated LDH"),
        ]),
    ]

    // ── Urinary retention / LUTS ──────────────────────────────────────

    static let urinaryRetention: [Candidate] = [
        .init(name: "Benign Prostatic Hyperplasia", icd: "N40.1",
              logPrior: 35, features: [
            .init(key: "timing", value: "Progressive", logLR: 10, evidenceLabel: "Progressive LUTS"),
            .init(key: "associations", value: "Hesitancy", logLR: 10, evidenceLabel: "Hesitancy"),
            .init(key: "associations", value: "Poor stream", logLR: 10, evidenceLabel: "Poor stream"),
            .init(key: "associations", value: "Nocturia", logLR: 8, evidenceLabel: "Nocturia"),
            .init(key: "age_over", value: "50", logLR: 12, evidenceLabel: "Age >50"),
            .init(key: "sex_male", value: "", logLR: 8, evidenceLabel: "Male sex"),
            .init(key: "exam", value: "enlarged, benign", logLR: 14, evidenceLabel: "Smooth, enlarged prostate on DRE"),
            .init(key: "inv", value: "psa", logLR: 8, evidenceLabel: "PSA measured"),
            .init(key: "inv", value: "ultrasound", logLR: 6, evidenceLabel: "Bladder/prostate USS"),
        ]),
        .init(name: "Prostate Carcinoma", icd: "C61",
              logPrior: 12, features: [
            .init(key: "exam", value: "hard, irregular", logLR: 16, evidenceLabel: "Hard, irregular prostate on DRE"),
            .init(key: "age_over", value: "60", logLR: 10, evidenceLabel: "Age >60"),
            .init(key: "sex_male", value: "", logLR: 8, evidenceLabel: "Male sex"),
            .init(key: "associations", value: "Weight loss", logLR: 10, evidenceLabel: "Weight loss / constitutional symptoms"),
            .init(key: "associations", value: "Haematuria", logLR: 8, evidenceLabel: "Haematuria"),
            .init(key: "pmh", value: "prostate", logLR: 10, evidenceLabel: "Family history"),
            .init(key: "inv", value: "psa", logLR: 14, evidenceLabel: "Elevated PSA"),
        ]),
        .init(name: "Urethral Stricture", icd: "N35.9",
              logPrior: 10, features: [
            .init(key: "associations", value: "Poor stream", logLR: 14, evidenceLabel: "Poor or spraying stream"),
            .init(key: "associations", value: "Hesitancy", logLR: 8, evidenceLabel: "Hesitancy"),
            .init(key: "pmh", value: "sti", logLR: 12, evidenceLabel: "STI (gonococcal) history"),
            .init(key: "pshx", value: "urethral", logLR: 12, evidenceLabel: "Urethral instrumentation / catheterisation"),
            .init(key: "pshx", value: "trauma", logLR: 10, evidenceLabel: "Pelvic trauma"),
            .init(key: "sex_male", value: "", logLR: 8, evidenceLabel: "Male sex"),
        ]),
        .init(name: "Neurogenic Bladder", icd: "N31.9",
              logPrior: 8, features: [
            .init(key: "pmh", value: "spinal", logLR: 14, evidenceLabel: "Spinal cord injury / disease"),
            .init(key: "pmh", value: "diabetes", logLR: 8, evidenceLabel: "Diabetic neuropathy"),
            .init(key: "pmh", value: "multiple sclerosis", logLR: 12, evidenceLabel: "Multiple sclerosis"),
            .init(key: "exam", value: "bladder palpable", logLR: 12, evidenceLabel: "Palpable bladder"),
            .init(key: "inv", value: "urodynamics", logLR: 12, evidenceLabel: "Urodynamic studies"),
        ]),
    ]

}
