// DiagnosisRadiationEngine+DiseaseDictionary2.swift
// Full disease dictionary (medical specialties).
// Cardiovascular, Respiratory, Endocrine, Infectious, Musculoskeletal,
// Vascular, Urology, Neurology, Haematology.

import Foundation

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
    ]

}
