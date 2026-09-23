// DiagnosisRadiationEngine+DiseaseDictionary2.swift
// Full disease dictionary (medical specialties).
// Cardiovascular, Respiratory, Endocrine, Infectious, Musculoskeletal,
// Vascular, Urology, Neurology, Haematology.

extension DiagnosisRadiationEngine {

    static let _medicalEntries: [Entry] = [
        // ══════════════════════════════════════════════════════════════
        // CARDIOVASCULAR
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["hypertension", "essential hypertension", "raised blood pressure", "high blood pressure"], radiation: .init(
            conditionName: "Essential Hypertension",
            icd10Primary: "I10",
            investigations: [
                .init(name: "FBC / U&E / Creatinine", category: .blood, rationale: "End-organ damage — renal function"),
                .init(name: "Fasting glucose / HbA1c", category: .blood, rationale: "Metabolic syndrome / diabetes screen"),
                .init(name: "Fasting lipid profile", category: .blood, rationale: "Cardiovascular risk — total cholesterol, LDL, HDL, TG"),
                .init(name: "Urine — microalbumin / creatinine ratio", category: .other, rationale: "Renal end-organ damage"),
                .init(name: "ECG (12-lead)", category: .other, rationale: "LVH, arrhythmia, ischaemia"),
                .init(name: "Echocardiogram", category: .other, rationale: "If LVH on ECG or cardiac symptoms"),
                .init(name: "Renal USS", category: .imaging, rationale: "Secondary cause — RAS, renal parenchymal disease"),
                .init(name: "Aldosterone / Renin ratio", category: .blood, rationale: "If hypokalaemia or resistant HTN"),
            ],
            planTemplate: """
- LIFESTYLE (mandatory alongside medications):
  • DASH diet — reduce sodium <2.3 g/day, increase potassium (fruit, vegetables)
  • Exercise: 150 min/week moderate aerobic activity
  • Weight loss (target BMI <25), alcohol reduction, smoking cessation
- STEP 1 (Stage 1: 130–139/80–89 mmHg + CVD risk >10%):
  • ACE inhibitor (lisinopril 5–10 mg OD) OR ARB (losartan 50 mg OD)
  • If Afro-Caribbean: CCB preferred (amlodipine 5 mg OD) — NICE guidance
- STEP 2: ACE/ARB + CCB
- STEP 3: ACE/ARB + CCB + thiazide (indapamide 1.5 mg OD)
- STEP 4 (resistant): add spironolactone 25 mg OD
- Target: <130/80 mmHg (diabetics / CKD); <140/90 mmHg (general)
- Monitor: U&E 1 week after starting ACE/ARB; renal function 3–6 monthly
""",
            billingCodes: [
                .init(icd10: "I10", icdDescription: "Essential (primary) hypertension", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: nil,
            redFlags: ["BP >180/120 + end-organ damage → hypertensive emergency → ER", "Headache + visual changes → rule out hypertensive encephalopathy"],
            followUp: "Review 4 weeks (med start), then 3-monthly when stable. Annual: U&E, lipids, glucose, urine ACR.",
            guidelineReference: "NICE NG136; ACC/AHA 2017; ISH 2020"
        )),

        Entry(keywords: ["acute coronary syndrome", "acs", "nstemi", "stemi", "myocardial infarction", "mi"], radiation: .init(
            conditionName: "Acute Coronary Syndrome",
            icd10Primary: "I21.9",
            investigations: [
                .init(name: "ECG (12-lead) — stat + repeat at 1h and 3h", category: .other, rationale: "STEMI vs NSTEMI vs UA"),
                .init(name: "High-sensitivity Troponin I/T — 0h and 3h", category: .blood, rationale: "NSTEMI diagnosis — rise and fall pattern"),
                .init(name: "FBC / U&E / Creatinine", category: .blood, rationale: "Baseline and contrast risk"),
                .init(name: "Fasting lipid profile", category: .blood, rationale: "Cardiovascular risk"),
                .init(name: "BNP / NT-proBNP", category: .blood, rationale: "Cardiac failure component"),
                .init(name: "Chest X-ray", category: .imaging, rationale: "Pulmonary oedema, mediastinum"),
                .init(name: "Echo", category: .other, rationale: "LV function, wall motion abnormality"),
            ],
            planTemplate: """
- STEMI → IMMEDIATE referral for primary PCI (cath lab activation) or thrombolysis if PCI >120 min
- NSTEMI / UA:
  • Dual antiplatelet: aspirin 300 mg stat + ticagrelor 180 mg stat (or clopidogrel 300 mg)
  • Anticoagulation: fondaparinux 2.5 mg SC OD (preferred) or enoxaparin
  • Nitrates: GTN sublingual PRN; IV GTN if ongoing ischaemia
  • High-intensity statin: atorvastatin 80 mg OD
  • Beta-blocker: metoprolol 25 mg BD (if no contraindication)
  • ACE inhibitor: ramipril 2.5 mg OD
  • TIMI / GRACE score → risk stratify → early invasive vs conservative
  • Cardiac rehab referral
""",
            billingCodes: [
                .init(icd10: "I21.9", icdDescription: "Acute myocardial infarction, unspecified", cpt: nil, cptDescription: "Medical / interventional management"),
            ],
            consentCategory: nil,
            urgencyNote: "EMERGENCY — STEMI: activate cath lab immediately. NSTEMI: admit CCU.",
            redFlags: ["Cardiogenic shock → vasopressors + urgent PCI", "VF → defibrillation", "Complete heart block → temporary pacing"],
            followUp: "Cardiology follow-up 4–6 weeks. Cardiac rehab 6–8 weeks. Echo at 3 months.",
            guidelineReference: "ESC 2023; NICE NG185; ACC/AHA NSTE-ACS"
        )),

        Entry(keywords: ["heart failure", "cardiac failure", "congestive heart failure", "chf", "pulmonary oedema"], radiation: .init(
            conditionName: "Heart Failure",
            icd10Primary: "I50.9",
            investigations: [
                .init(name: "BNP / NT-proBNP", category: .blood, rationale: "Diagnostic confirmation — >400 pg/mL highly suggestive"),
                .init(name: "ECG", category: .other, rationale: "Cause — AF, LVH, ischaemia"),
                .init(name: "Echocardiogram", category: .other, rationale: "EF assessment — HFrEF vs HFpEF"),
                .init(name: "Chest X-ray", category: .imaging, rationale: "Cardiomegaly, pulmonary oedema, effusions"),
                .init(name: "FBC / U&E / Creatinine / LFTs", category: .blood, rationale: "Renal function — guide diuretic dose; hepatic congestion"),
                .init(name: "Thyroid function (TSH)", category: .blood, rationale: "Thyroid cause — hypo/hyperthyroidism"),
                .init(name: "Iron studies / Ferritin", category: .blood, rationale: "Iron deficiency — IV iron improves outcomes"),
            ],
            planTemplate: """
- Acute decompensation: IV furosemide 40–80 mg stat; O₂; sit upright
- GDMT (Guideline-Directed Medical Therapy) for HFrEF (EF <40%):
  • ACE inhibitor (ramipril) or ARNI (sacubitril-valsartan) — if BP allows
  • Beta-blocker: bisoprolol 1.25 mg OD → uptitrate
  • MRA: spironolactone 25 mg OD (if eGFR >30)
  • SGLT2i: dapagliflozin 10 mg OD or empagliflozin 10 mg OD
  • Diuretic: furosemide 40 mg OD — adjust to fluid balance
- Fluid restriction: 1.5–2 L/day; sodium <2 g/day
- Daily weights — attend if gain >2 kg in 2 days
- Cardiology referral + echo within 2 weeks of new diagnosis
""",
            billingCodes: [
                .init(icd10: "I50.9", icdDescription: "Heart failure, unspecified", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "Admit if acute decompensation. Cardiology referral for new diagnosis.",
            redFlags: ["SaO₂ <90% + respiratory distress → emergency CPAP / NIV", "Cardiogenic shock → inotropes"],
            followUp: "Cardiology review 2 weeks. Echo 3 months. BNP target-guided therapy.",
            guidelineReference: "ESC 2021; NICE NG106"
        )),

        Entry(keywords: ["deep vein thrombosis", "dvt", "leg vein thrombosis", "calf thrombosis"], radiation: .init(
            conditionName: "Deep Vein Thrombosis (DVT)",
            icd10Primary: "I80.20",
            investigations: [
                .init(name: "Doppler Ultrasound — Lower Limb Veins", category: .imaging, rationale: "Gold standard — confirm DVT, extent, compressibility"),
                .init(name: "D-dimer", category: .blood, rationale: "Rule out if Wells <2 + negative D-dimer (high sensitivity)"),
                .init(name: "FBC / PT / INR / APTT", category: .blood, rationale: "Baseline coagulation before anticoagulation"),
                .init(name: "Renal function (U&E / Creatinine)", category: .blood, rationale: "DOAC dosing — eGFR <15: avoid DOACs"),
                .init(name: "Thrombophilia screen (if unprovoked <50y)", category: .blood, rationale: "Factor V Leiden, Prothrombin G20210A, Protein C/S, Antithrombin — do BEFORE anticoagulation"),
                .init(name: "Anti-phospholipid antibodies", category: .blood, rationale: "APS — warfarin preferred over DOACs"),
                .init(name: "CT Chest / Abdomen / Pelvis (if unprovoked)", category: .imaging, rationale: "Occult malignancy screen in first unprovoked DVT"),
            ],
            planTemplate: """
- Wells' score ≥2: USS + anticoagulate while awaiting
- Wells' score <2: D-dimer first; if negative → no DVT
- ANTICOAGULATION (first-line DOACs):
  • Rivaroxaban: 15 mg BD × 21 days, then 20 mg OD (with food)
  • Apixaban: 10 mg BD × 7 days, then 5 mg BD
  • LMWH → warfarin: if APS, CrCl <15, pregnant, or haematology preference
- Duration: provoked (reversible risk factor) → 3 months; unprovoked → ≥6 months; recurrent/malignancy → long-term
- Compression stockings: grade II, worn 2 years (reduces PTS)
- Elevation + early mobilisation — do NOT enforce bed rest
- Malignancy-associated: LMWH (tinzaparin 175 IU/kg OD) or rivaroxaban/apixaban
""",
            billingCodes: [
                .init(icd10: "I80.20", icdDescription: "Phlebitis and thrombophlebitis of unspecified deep vessel of lower extremity", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "Anticoagulate while imaging is arranged if high clinical suspicion (Wells ≥2).",
            redFlags: ["Phlegmasia cerulea dolens → vascular surgery urgently", "Massive DVT + haemodynamic compromise → catheter-directed thrombolysis"],
            followUp: "Review 4 weeks. Assess for PTS. Duration decision at 3 months. Thrombophilia result follow-up.",
            guidelineReference: "NICE NG158; ISTH 2021; ESC 2019",
            scoringCriteria: .init(
                scoreName: "Wells' DVT Score",
                variables: [
                    .init(id: "dvt_cancer",     label: "Active cancer",                             unit: "", hint: "treatment or palliation within 6 months",  cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "dvt_paralysis",  label: "Paralysis / plaster immobilisation",        unit: "", hint: "recent lower limb",                        cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "dvt_bedrest",    label: "Bedridden >3 days or major Sx <12 wks",     unit: "", hint: "",                                         cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "dvt_tenderness", label: "Localised deep venous tenderness",          unit: "", hint: "along deep venous distribution",            cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "dvt_swollen",    label: "Entire leg swollen",                        unit: "", hint: "",                                         cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "dvt_calf",       label: "Calf swelling >3 cm vs contralateral",     unit: "cm diff", hint: "measure 10 cm below tibial tuberosity", cutoffValue: 3, cutoffIsAbove: true, points: 1, isBinary: false),
                    .init(id: "dvt_oedema",     label: "Pitting oedema (symptomatic leg greater)",  unit: "", hint: "",                                         cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "dvt_collateral", label: "Collateral superficial veins (non-varicose)", unit: "", hint: "",                                       cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "dvt_prev",       label: "Previously documented DVT",                 unit: "", hint: "",                                         cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "dvt_alt_dx",     label: "Alternative dx as / more likely than DVT",  unit: "", hint: "subtracts 2 pts from total",                cutoffValue: 0, cutoffIsAbove: true, points: -2, isBinary: true),
                ],
                severeThreshold: 2,
                maxScore: 9,
                timingNote: "≥2 = DVT likely → USS + anticoagulate; <2 = unlikely → D-dimer first",
                aboveThresholdLabel: "DVT LIKELY",
                belowThresholdLabel: "DVT UNLIKELY"
            )
        )),

        Entry(keywords: ["pulmonary embolism", "pulmonary thromboembolism", "pe", "deep vein thrombosis with pe", "dvt with pe"], radiation: .init(
            conditionName: "Pulmonary Embolism (PE)",
            icd10Primary: "I26.99",
            investigations: [
                .init(name: "D-dimer", category: .blood, rationale: "Sensitive rule-out if Wells ≤4 — negative excludes PE"),
                .init(name: "CTPA (CT Pulmonary Angiogram)", category: .imaging, rationale: "Gold standard — confirms PE, extent, RV strain"),
                .init(name: "ECG", category: .other, rationale: "S1Q3T3, sinus tachycardia, new RBBB — not diagnostic"),
                .init(name: "Troponin I/T", category: .blood, rationale: "RV strain / myocardial injury — guides escalation"),
                .init(name: "BNP / NT-proBNP", category: .blood, rationale: "RV dysfunction — severity and prognosis"),
                .init(name: "ABG / SpO₂", category: .other, rationale: "Hypoxaemia, hypocapnia — severity"),
                .init(name: "FBC / INR / APTT / Renal function", category: .blood, rationale: "Baseline before anticoagulation"),
                .init(name: "ECHO (if haemodynamically unstable)", category: .other, rationale: "RV strain, thrombus in transit"),
                .init(name: "Doppler USS Lower Limbs", category: .imaging, rationale: "DVT confirmation — source of PE"),
            ],
            planTemplate: """
- Wells' PE score: if ≤4 → D-dimer; if >4 → CTPA directly
- HAEMODYNAMICALLY STABLE (most patients):
  • DOACs (preferred): rivaroxaban 15 mg BD × 21d → 20 mg OD; or apixaban 10 mg BD × 7d → 5 mg BD
  • LMWH (enoxaparin 1.5 mg/kg SC OD or 1 mg/kg BD) as bridge if needed
- HAEMODYNAMICALLY UNSTABLE (massive PE — SBP <90):
  • ADMIT ICU — thrombolysis: alteplase 100 mg IV over 2h (contraindications: recent surgery/stroke)
  • If thrombolysis contraindicated: surgical embolectomy / catheter-directed therapy
- O₂ supplementation to maintain SpO₂ ≥94%
- Duration: provoked → 3 months; unprovoked → ≥6 months; cancer-associated → DOAC long-term
""",
            billingCodes: [
                .init(icd10: "I26.99", icdDescription: "Other pulmonary embolism without acute cor pulmonale", cpt: nil, cptDescription: "Medical management"),
                .init(icd10: "I26.09", icdDescription: "Saddle embolus with acute cor pulmonale", cpt: nil, cptDescription: "Emergency management / ICU"),
            ],
            consentCategory: nil,
            urgencyNote: "Haemodynamically unstable PE → ICU + thrombolysis ± surgical embolectomy. Do not delay anticoagulation.",
            redFlags: ["SBP <90 + HR >100 → massive PE → thrombolysis", "Cardiac arrest → CPR + thrombolysis in cardiac arrest protocol"],
            followUp: "Review 4–6 weeks. Duration decision at 3 months. ECHO if RV dysfunction at index admission.",
            guidelineReference: "ESC 2019; NICE NG158; ACCP 2021",
            scoringCriteria: .init(
                scoreName: "Wells' PE Score",
                variables: [
                    .init(id: "pe_dvt_signs",   label: "Clinical signs/symptoms of DVT",           unit: "", hint: "leg swelling, erythema, tenderness",           cutoffValue: 0, cutoffIsAbove: true, points: 3, isBinary: true),
                    .init(id: "pe_likely",       label: "PE is #1 diagnosis / equally likely",      unit: "", hint: "clinical judgement after alternatives considered", cutoffValue: 0, cutoffIsAbove: true, points: 3, isBinary: true),
                    .init(id: "pe_hr",           label: "Heart rate > 100 bpm",                     unit: "bpm", hint: "> 100 scores 1 pt",                         cutoffValue: 100, cutoffIsAbove: true, points: 1, isBinary: false),
                    .init(id: "pe_immob",        label: "Immobilisation ≥3 days or Sx <4 wks",      unit: "", hint: "bedridden or recent surgery",                   cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "pe_prev_dvt_pe",  label: "Previous DVT / PE",                        unit: "", hint: "documented history",                           cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "pe_haemoptysis",  label: "Haemoptysis",                              unit: "", hint: "any blood-stained sputum",                      cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "pe_malignancy",   label: "Malignancy",                               unit: "", hint: "on treatment or within 6 months or palliative", cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                ],
                severeThreshold: 5,
                maxScore: 11,
                timingNote: ">4 = PE likely → CTPA; ≤4 = PE unlikely → D-dimer first",
                aboveThresholdLabel: "PE LIKELY",
                belowThresholdLabel: "PE UNLIKELY"
            )
        )),

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
- Supplemental O₂: target SaO₂ 94–98%
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
  • O₂: maintain SaO₂ 94–98%
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
