// DiagnosisRadiationEngine+DiseaseDictionary2b.swift
// Medical disease dictionary — Respiratory, Endocrine, and remaining entries (part B).

import Foundation



extension DiagnosisRadiationEngine {

    static let _medicalEntriesB: [Entry] = [

        // ══════════════════════════════════════════════════════════════
        // RESPIRATORY
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["community-acquired pneumonia", "pneumonia", "cap"], radiation: .init(
            conditionName: "Community-Acquired Pneumonia",
            icd10Primary: "J18.9",
            investigations: [
                .init(name: "Chest X-ray (PA and lateral)", category: .imaging, rationale: "Infiltrate characterisation — lobar vs broncho"),
                .init(name: "FBC / CRP / Procalcitonin", category: .blood, rationale: "Severity and antibiotic guidance"),
                .init(name: "U&E / Creatinine / Urea", category: .blood, rationale: "CURB-65 scoring — urea >7 mmol/L = 1 point"),
                .init(name: "Blood cultures ×2", category: .blood, rationale: "Bacteraemia — before antibiotics"),
                .init(name: "Sputum MC&S + AFB", category: .other, rationale: "Microbiological diagnosis"),
                .init(name: "Urinary Legionella Antigen", category: .other, rationale: "Legionella — especially if severe / cluster"),
                .init(name: "Urinary Pneumococcal Antigen", category: .other, rationale: "Streptococcus pneumoniae"),
                .init(name: "ABG / O₂ sats", category: .other, rationale: "Severity — hypoxia"),
            ],
            planTemplate: """
- CURB-65 ≤1 → oral antibiotics + outpatient
- CURB-65 2 → consider admission; IV antibiotics
- CURB-65 ≥3 → admit; severe pneumonia; consider ICU
- MILD/MODERATE (outpatient / CURB-65 1–2):
  • Amoxicillin 500 mg TDS × 5 days PLUS azithromycin 500 mg OD × 5 days
- SEVERE (CURB-65 ≥3):
  • Co-amoxiclav 1.2 g IV 8h + azithromycin 500 mg IV OD
  • Or ceftriaxone 2 g IV OD + azithromycin
- Supplemental O₂: target SaO₂ 94–98% (88–92% if COPD / at risk of hypercapnic respiratory failure — BTS 2017; blood gas)
- Adequate hydration; VTE prophylaxis (enoxaparin) if admitted
- Smoking cessation counselling
- Pneumococcal and influenza vaccines
""",
            billingCodes: [
                .init(icd10: "J18.9", icdDescription: "Pneumonia, unspecified organism", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "CURB-65 ≥3 or SaO₂ <93%: admit urgently.",
            redFlags: ["SaO₂ <90% → O₂ + escalate", "Shock + respiratory failure → ICU + broad-spectrum antibiotics"],
            followUp: "Chest X-ray 6 weeks to confirm resolution. Pneumococcal vaccine if not vaccinated.",
            guidelineReference: "NICE NG138; BTS 2009; CURB-65"
        )),

        Entry(keywords: ["asthma", "acute asthma", "bronchospasm"], radiation: .init(
            conditionName: "Asthma",
            icd10Primary: "J45.50",
            investigations: [
                .init(name: "Peak Expiratory Flow (PEF) — pre and post bronchodilator", category: .other, rationale: "Severity and reversibility"),
                .init(name: "Spirometry with reversibility", category: .other, rationale: "Diagnosis confirmation — FEV1/FVC + bronchodilator response"),
                .init(name: "Chest X-ray", category: .imaging, rationale: "Exclude pneumothorax, consolidation, hyperinflation"),
                .init(name: "FBC / CRP", category: .blood, rationale: "Infective trigger — eosinophilia"),
                .init(name: "IgE / RAST / skin prick tests", category: .other, rationale: "Allergic component — if severe/brittle"),
                .init(name: "ABG", category: .other, rationale: "Severe/life-threatening — rising CO₂ = critical sign"),
            ],
            planTemplate: """
- ACUTE SEVERE (PEF 33–50% predicted):
  • Salbutamol 5 mg nebulised back-to-back × 3 in first hour
  • Ipratropium 0.5 mg nebulised 4-hourly
  • Prednisolone 40–50 mg PO stat (or hydrocortisone 200 mg IV if unable to swallow)
  • O₂: maintain SaO₂ 94–98% (88–92% if COPD / hypercapnic risk — BTS 2017)
  • Admit if no improvement at 1h
- LIFE-THREATENING (PEF <33%, silent chest, cyanosis, SpO₂ <92%):
  • IV magnesium sulphate 1.2–2 g over 20 min
  • ICU referral — may need intubation
- CHRONIC MANAGEMENT (stepwise):
  • Step 1: SABA PRN (salbutamol inhaler)
  • Step 2: Low-dose ICS (beclomethasone 200 mcg BD)
  • Step 3: ICS + LABA (salmeterol)
  • Step 4: Specialist review + add-on therapy
- Written Asthma Action Plan; inhaler technique check
""",
            billingCodes: [
                .init(icd10: "J45.50", icdDescription: "Moderate persistent asthma, uncomplicated", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "LIFE-THREATENING features: silent chest / SpO₂ <92% / PEF <33% → emergency.",
            redFlags: ["Silent chest + hypoxia + cyanosis → intubation", "Rising CO₂ → ICU immediately"],
            followUp: "Review 48h after acute attack. Spirometry when well. Asthma Action Plan.",
            guidelineReference: "BTS/SIGN 2023; NICE NG80; GINA 2024"
        )),

        Entry(keywords: ["pulmonary tuberculosis", "tuberculosis", "tb", "mycobacterium tuberculosis"], radiation: .init(
            conditionName: "Pulmonary Tuberculosis",
            icd10Primary: "A15.0",
            investigations: [
                .init(name: "Chest X-ray (PA)", category: .imaging, rationale: "Apical infiltrate, cavitation, lymphadenopathy"),
                .init(name: "Sputum AFB smear × 3 (early morning)", category: .other, rationale: "Acid-fast bacilli — sensitivity ~60%"),
                .init(name: "Sputum Culture (Mycobacterium) — LJ medium / BACTEC", category: .other, rationale: "Gold standard diagnosis + drug sensitivity"),
                .init(name: "GeneXpert MTB/RIF (Xpert)", category: .other, rationale: "Rapid diagnosis + rifampicin resistance in 2h"),
                .init(name: "HIV test (consent)", category: .blood, rationale: "TB-HIV co-infection — management implications"),
                .init(name: "FBC / LFTs / U&E", category: .blood, rationale: "Pre-treatment baseline — drug toxicity monitoring"),
                .init(name: "CT Chest", category: .imaging, rationale: "If CXR equivocal or disseminated disease suspected"),
            ],
            planTemplate: """
- NOTIFY TB to public health authority (mandatory)
- Contact tracing: household contacts → tuberculin skin test / IGRA
- STANDARD 6-MONTH REGIMEN (drug-sensitive TB):
  • Intensive phase (2 months): HRZE — Isoniazid + Rifampicin + Pyrazinamide + Ethambutol daily
  • Continuation phase (4 months): HR — Isoniazid + Rifampicin daily
- Pyridoxine (vitamin B6) 10–25 mg OD with isoniazid to prevent peripheral neuropathy
- DOT (Directly Observed Therapy) — especially if adherence concern
- Monitor: LFTs monthly; visual acuity monthly (ethambutol); uric acid (pyrazinamide)
- Infectivity precautions: respiratory isolation until AFB smear-negative × 3
- Refer MDR-TB to specialist if rifampicin resistance on Xpert
""",
            billingCodes: [
                .init(icd10: "A15.0", icdDescription: "Tuberculosis of lung, confirmed by sputum smear", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "Notify Public Health. Isolate patient until non-infectious.",
            redFlags: ["Haemoptysis → bronchoscopy", "Miliary / CNS TB → IV steroids + extended treatment", "MDR-TB → specialist centre"],
            followUp: "Monthly: LFTs, clinical review, sputum smear. CXR at 2 months and end of treatment.",
            guidelineReference: "WHO 2022; NICE NG33"
        )),

        // ══════════════════════════════════════════════════════════════
        // ENDOCRINE / METABOLIC
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["diabetes mellitus type 2", "diabetes type 2", "dm2", "type 2 diabetes", "t2dm"], radiation: .init(
            conditionName: "Diabetes Mellitus Type 2",
            icd10Primary: "E11.9",
            investigations: [
                .init(name: "HbA1c", category: .blood, rationale: "Glycaemic control — diagnosis and monitoring"),
                .init(name: "Fasting glucose / random glucose", category: .blood, rationale: "Diagnostic confirmation"),
                .init(name: "FBC / U&E / Creatinine / eGFR", category: .blood, rationale: "Renal function — nephropathy screen"),
                .init(name: "Urine albumin:creatinine ratio (ACR)", category: .other, rationale: "Diabetic nephropathy"),
                .init(name: "Fasting lipid profile", category: .blood, rationale: "Cardiovascular risk — statin indication"),
                .init(name: "LFTs", category: .blood, rationale: "NAFLD — very common in T2DM"),
                .init(name: "TSH", category: .blood, rationale: "Thyroid disease — common comorbidity"),
                .init(name: "ECG", category: .other, rationale: "Cardiac complications"),
                .init(name: "Urine dipstick + MC&S", category: .other, rationale: "UTI screening — common in T2DM"),
                .init(name: "Foot examination + Monofilament test", category: .other, rationale: "Peripheral neuropathy / diabetic foot"),
            ],
            planTemplate: """
- LIFESTYLE (cornerstone):
  • Caloric restriction: 500 kcal/day deficit; Mediterranean / low-carb diet
  • Exercise: 150 min/week aerobic; resistance training
  • Weight loss target: ≥5% body weight
- STEP 1 — Metformin 500 mg OD (with food) → uptitrate to 1 g BD over 4 weeks
  • If eGFR 30–45: reduce dose; <30: stop metformin
- STEP 2 (HbA1c not at target after 3 months):
  • Add SGLT2 inhibitor (if CVD/CKD: dapagliflozin 10 mg or empagliflozin 10 mg)
  • Or GLP-1 RA (if obesity: semaglutide 0.25–1 mg weekly SC)
  • Or DPP-4 inhibitor (sitagliptin 100 mg OD — if hypoglycaemia risk)
- STEP 3: Add sulphonylurea (glibenclamide 2.5 mg OD) or insulin if HbA1c >10%
- HbA1c target: <53 mmol/mol (7%) general; <48 (6.5%) if low hypoglycaemia risk
- Statin: atorvastatin 20–40 mg OD (all T2DM if >40y or CVD risk)
- ACE inhibitor if microalbuminuria or hypertension
- Eye referral (diabetic retinopathy screen annually)
- Foot care education
""",
            billingCodes: [
                .init(icd10: "E11.9", icdDescription: "Type 2 diabetes mellitus without complications", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: nil,
            redFlags: ["HbA1c >12% + symptoms → consider insulin", "DKA → emergency IV fluids + insulin protocol", "Hypoglycaemia <4 mmol/L → 15–20 g fast-acting glucose"],
            followUp: "HbA1c every 3 months until target, then 6-monthly. Annual: eyes, feet, ACR, eGFR, lipids.",
            guidelineReference: "NICE NG28; ADA 2024; EASD 2023"
        )),

        Entry(keywords: ["hyperthyroidism", "thyrotoxicosis", "graves disease", "graves'"], radiation: .init(
            conditionName: "Hyperthyroidism / Graves' Disease",
            icd10Primary: "E05.00",
            investigations: [
                .init(name: "TSH / Free T4 / Free T3", category: .blood, rationale: "Confirm and characterise hyperthyroidism"),
                .init(name: "TSH receptor antibodies (TRAb)", category: .blood, rationale: "Graves' disease confirmation"),
                .init(name: "Thyroid peroxidase antibodies (TPO-Ab)", category: .blood, rationale: "Autoimmune thyroid disease"),
                .init(name: "Thyroid Ultrasound ± radioiodine uptake scan", category: .imaging, rationale: "Distinguish Graves' from toxic nodule / toxic MNG"),
                .init(name: "FBC / LFTs", category: .blood, rationale: "Pre-treatment baseline — antithyroid drug monitoring"),
                .init(name: "ECG", category: .other, rationale: "Atrial fibrillation — very common with hyperthyroidism"),
                .init(name: "Bone density (DEXA)", category: .other, rationale: "Osteoporosis risk if prolonged hyperthyroidism"),
            ],
            planTemplate: """
- SYMPTOMATIC CONTROL (immediate):
  • Beta-blocker: propranolol 40 mg TDS or atenolol 50 mg OD (reduces HR + tremor)
- ANTITHYROID DRUG (ATD):
  • Carbimazole 20–40 mg OD (titration block-replace or titration regimen)
  • Alternatives: propylthiouracil 100–200 mg TDS (first trimester pregnancy / agranulocytosis with carbimazole)
  • Monitor: FBC at 6 weeks — agranulocytosis (WBC <3.0 → STOP immediately → ER)
  • TFTs at 4–6 weeks until euthyroid, then 3-monthly
- DEFINITIVE THERAPY (after 12–18 months ATD or early relapse):
  • Radioiodine (I-131): preferred if single nodule, MNG, relapse, older patients
  • Thyroidectomy (total or near-total): if large goitre, compressive symptoms, suspicious nodule
- Ophthalmology referral if Graves' orbitopathy (exophthalmos)
""",
            billingCodes: [
                .init(icd10: "E05.00", icdDescription: "Thyrotoxicosis with diffuse goitre", cpt: "60240", cptDescription: "Thyroidectomy, total"),
            ],
            consentCategory: "Total Thyroidectomy",
            urgencyNote: "Thyroid storm: ICU — propranolol IV + carbimazole high-dose + dexamethasone + Lugol's iodine.",
            redFlags: ["Agranulocytosis (fever + sore throat on ATD) → STOP drug → FBC stat → haematology", "Thyroid storm → emergency"],
            followUp: "TFTs 4–6 weeks. Annual DEXA. Lifelong thyroxine after thyroidectomy or radioiodine.",
            guidelineReference: "BTA Guidelines; ATA 2016; ETA 2018"
        )),

        Entry(keywords: ["hypothyroidism", "hypothyroid", "underactive thyroid"], radiation: .init(
            conditionName: "Hypothyroidism",
            icd10Primary: "E03.9",
            investigations: [
                .init(name: "TSH / Free T4", category: .blood, rationale: "Confirm and grade hypothyroidism"),
                .init(name: "TPO antibodies", category: .blood, rationale: "Hashimoto's thyroiditis — autoimmune cause"),
                .init(name: "FBC", category: .blood, rationale: "Macrocytic anaemia — associated"),
                .init(name: "Lipid profile", category: .blood, rationale: "Dyslipidaemia — reversible with treatment"),
                .init(name: "CK / Creatinine", category: .blood, rationale: "Myopathy — common in hypothyroidism"),
            ],
            planTemplate: """
- Levothyroxine (L-T4):
  • Start low: 25–50 mcg OD in elderly or cardiac disease; 50–75 mcg OD in younger healthy patients
  • Take on empty stomach, 30–60 min before breakfast
  • Uptitrate by 25 mcg every 4–6 weeks until TSH within normal range (0.5–2.5 mIU/L)
  • Typical maintenance dose: 75–125 mcg OD
- Avoid calcium, iron supplements, antacids within 4h of levothyroxine
- Monitor: TFTs 6 weeks after dose change; annual once stable
- Subclinical hypothyroidism (TSH 4–10, normal T4):
  • Treat if TSH >10, symptomatic, TPO+, or pregnant
""",
            billingCodes: [
                .init(icd10: "E03.9", icdDescription: "Hypothyroidism, unspecified", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: nil,
            redFlags: ["Myxoedema coma — confusion + hypothermia → IV T4 + steroids + ICU"],
            followUp: "TFTs 6 weeks after initiating / changing dose. Annual monitoring when stable.",
            guidelineReference: "BTA Guidelines; ATA 2014"
        )),

        // ══════════════════════════════════════════════════════════════

    ]

}
