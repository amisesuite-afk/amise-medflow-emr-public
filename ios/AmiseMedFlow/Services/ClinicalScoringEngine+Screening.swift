// ClinicalScoringEngine+Screening.swift
// Screening / Multidisciplinary scoring
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {

    // MARK: - MUST (Malnutrition Universal Screening Tool)

    struct MUSTInput: Equatable {
        var bmiScore: Int = 0         // 0 = BMI >20; 1 = 18.5–20; 2 = <18.5
        var weightLossScore: Int = 0  // 0 = <5%; 1 = 5–10%; 2 = >10% in past 3–6 months
        var acuteDiseaseScore: Int = 0 // 0 = no effect; 2 = acutely ill and nil/negligible intake likely >5 days
    }

    static func must(_ i: MUSTInput) -> ClinicalScore {
        let total = max(0, i.bmiScore + i.weightLossScore + i.acuteDiseaseScore)

        let (risk, abbrev, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case 0:
            (.low, "Low Risk",
             ["Routine nutritional care; re-screen weekly (hospital) or monthly (community/care home)",
              "Encourage balanced diet and adequate fluid intake"],
             [])
        case 1:
            (.moderate, "Medium Risk",
             ["Document 3-day food intake; if adequate, re-screen weekly (hospital)",
              "If intake inadequate, refer to dietitian or implement local nutritional protocol",
              "Consider high-protein / high-energy oral nutritional supplements"],
             ["MUST 1 — medium malnutrition risk; dietetic review recommended"])
        default:
            (.high, "High Risk",
             ["Urgent dietitian referral",
              "Initiate nutritional support plan within 24 hours: oral supplements, enteral, or parenteral route based on clinical status",
              "Multi-disciplinary nutrition team involvement (dietitian, nurse, pharmacist)",
              "Optimise metabolic control before elective surgery; delay if correctable",
              "Re-screen weekly; document nutritional support goals and response"],
             ["MUST ≥2 — high malnutrition risk; associated with increased morbidity, prolonged LOS, and higher mortality",
              "Surgery risk: malnutrition doubles 30-day complication rate; address before elective procedures"])
        }

        let bmiLabels    = ["BMI >20 kg/m² (+0)", "BMI 18.5–20 kg/m² (+1)", "BMI <18.5 kg/m² (+2)"]
        let wlLabels     = ["Weight loss <5% (+0)", "Weight loss 5–10% (+1)", "Weight loss >10% (+2)"]
        let acuteLabel   = i.acuteDiseaseScore == 2 ? "Acute disease effect: Yes (+2)" : "Acute disease effect: No (+0)"

        let items = [
            ScoredItem(label: bmiLabels[min(2, i.bmiScore)],           points: Double(i.bmiScore),           present: i.bmiScore > 0),
            ScoredItem(label: wlLabels[min(2, i.weightLossScore)],     points: Double(i.weightLossScore),     present: i.weightLossScore > 0),
            ScoredItem(label: acuteLabel,                               points: Double(i.acuteDiseaseScore),  present: i.acuteDiseaseScore > 0)
        ]

        return ClinicalScore(
            systemName: "Malnutrition Universal Screening Tool",
            abbreviation: "MUST \(total)",
            score: Double(total), maxScore: 6,
            risk: risk,
            interpretation: "MUST \(total) — \(abbrev)",
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Stratton RJ et al. Clin Nutr 2004;23:1060–1066. BAPEN MUST toolkit. Validated across hospital, community, and care-home settings."
        )
    }

    // MARK: - AUDIT-C (Alcohol Use Disorders Identification Test — Consumption)
    struct AUDITCInput: Equatable {
        var frequency: Int = 0   // Q1: 0=never,1=monthly,2=2-4×/month,3=2-3×/week,4=4+/week
        var typicalDrinks: Int = 0 // Q2: 0=1-2,1=3-4,2=5-6,3=7-9,4=10+
        var bingeDrinks: Int = 0   // Q3: 0=never,1=<monthly,2=monthly,3=weekly,4=daily
        var isFemale: Bool = false
    }
    static func auditC(_ i: AUDITCInput) -> ClinicalScore {
        let total = i.frequency + i.typicalDrinks + i.bingeDrinks
        let threshold = i.isFemale ? 3 : 4
        let (interp, risk, recs): (String, ScoreRisk, [String])
        if total < threshold {
            interp = "Negative screen — low-risk alcohol use"
            risk   = .low
            recs   = ["No specific alcohol-related intervention indicated",
                      "Encourage continued low-risk drinking patterns"]
        } else if total <= 7 {
            interp = "Positive screen — hazardous or harmful drinking"
            risk   = .moderate
            recs   = ["Brief motivational intervention (5–15 min) recommended",
                      "Assess for alcohol dependence (CAGE/full AUDIT)",
                      "Counsel on safe drinking limits: ≤14 units/week, ≤3 units/occasion",
                      "Pre-operative alcohol cessation ≥4 weeks reduces surgical complications"]
        } else {
            interp = "High-risk — probable alcohol use disorder"
            risk   = .high
            recs   = ["Urgent addiction medicine / liaison psychiatry referral",
                      "Assess for alcohol dependence before elective surgery",
                      "Anticipate alcohol withdrawal — consider CIWA-Ar monitoring post-op",
                      "Pre-operative abstinence ≥4 weeks mandatory for elective cases",
                      "Supplement thiamine (100 mg TDS × 5 days) peri-operatively"]
        }
        return ClinicalScore(
            name:          "AUDIT-C",
            score:         Double(total),
            maxScore:      12,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Bush K et al. Arch Intern Med 1998;158:1789–1795. 3-item alcohol consumption sub-scale of the full AUDIT. Threshold ≥4 (men) / ≥3 (women). Validated for pre-operative alcohol risk screening; hazardous drinking independently increases surgical mortality and SSI rate."
        )
    }

    // MARK: - PHQ-9 (Patient Health Questionnaire — Depression)
    struct PHQ9Input: Equatable {
        var anhedonia: Int = 0       // Q1: 0–3
        var depressedMood: Int = 0   // Q2: 0–3
        var sleepProblem: Int = 0    // Q3: 0–3
        var fatigue: Int = 0         // Q4: 0–3
        var appetiteChange: Int = 0  // Q5: 0–3
        var selfWorth: Int = 0       // Q6: 0–3
        var concentration: Int = 0  // Q7: 0–3
        var psychomotor: Int = 0     // Q8: 0–3
        var suicidalThought: Int = 0 // Q9: 0–3
    }
    static func phq9(_ i: PHQ9Input) -> ClinicalScore {
        let total = i.anhedonia + i.depressedMood + i.sleepProblem + i.fatigue +
                    i.appetiteChange + i.selfWorth + i.concentration + i.psychomotor +
                    i.suicidalThought
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch total {
        case 0...4:
            interp = "Minimal or no depressive symptoms"
            risk   = .low
            recs   = ["Monitor at routine follow-up",
                      "Lifestyle counselling if sub-threshold symptoms present"]
        case 5...9:
            interp = "Mild depression"
            risk   = .low
            recs   = ["Active monitoring — reassess in 4–6 weeks",
                      "Consider watchful waiting with structured follow-up",
                      "Low-intensity psychological intervention (guided self-help) appropriate"]
        case 10...14:
            interp = "Moderate depression"
            risk   = .moderate
            recs   = ["Treatment indicated — offer antidepressant OR structured psychotherapy",
                      "Advise adequate sleep, physical activity, and social engagement",
                      "Pre-operatively: assess impact on surgical recovery and consent capacity",
                      "Psychiatric liaison review if elective major surgery planned"]
        case 15...19:
            interp = "Moderately severe depression"
            risk   = .high
            recs   = ["Active treatment required — combined antidepressant + CBT preferred",
                      "Psychiatric referral within 1–2 weeks",
                      "Consider delaying elective surgery until stabilised",
                      "Safety planning if passive suicidal ideation present (Q9 ≥1)"]
        default:
            interp = "Severe depression"
            risk   = .high
            recs   = ["Urgent psychiatric assessment required",
                      "If Q9 ≥2 (active suicidal ideation): same-day emergency psychiatry review",
                      "Withhold elective surgery until psychiatric clearance obtained",
                      "Inpatient psychiatric admission may be required"]
        }
        var finalRecs = recs
        if i.suicidalThought >= 2 {
            finalRecs.insert("⚠️ Active suicidal ideation (Q9 ≥2) — immediate risk assessment required", at: 0)
        }
        return ClinicalScore(
            name:          "PHQ-9",
            score:         Double(total),
            maxScore:      27,
            risk:          risk,
            interpretation: interp,
            recommendations: finalRecs,
            evidenceNote:  "Kroenke K, Spitzer RL, Williams JBW. J Gen Intern Med 2001;16:606–613. Validated 9-item depression scale. Each item scored 0 (not at all) to 3 (nearly every day), total 0–27. Pre-operative depression screening recommended by ANZCA and RCoA pre-assessment guidelines; undertreated depression independently predicts poor surgical outcomes and prolonged rehabilitation."
        )
    }

    // MARK: - STONE Score (Nephrolithiasis Risk)
    struct STONEInput: Equatable {
        var sizeMm: Int = 0          // Stone size on CT (mm): 1–5mm=2, 6–10mm=1, >10mm=0
        var toUreters: Int = 0       // Tightness at ureter/UVJ: yes=1, no=0
        var obstruction: Bool = false // Hydronephrosis/ureteric dilation: yes=1
        var nausea: Bool = false      // Nausea/vomiting: yes=1
        var erythrocytes: Bool = false // Haematuria: yes=1
    }
    static func stone(_ i: STONEInput) -> ClinicalScore {
        // Size: >10mm=0, 6–10mm=1, 1–5mm=2, <1mm=0
        let sizeScore: Int
        switch i.sizeMm {
        case 1...5:    sizeScore = 2
        case 6...10:   sizeScore = 1
        default:       sizeScore = 0
        }
        let total = sizeScore + i.toUreters + (i.obstruction ? 1 : 0) +
                    (i.nausea ? 1 : 0) + (i.erythrocytes ? 1 : 0)
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch total {
        case 0...1:
            interp = "Low probability of ureteric colic"
            risk   = .low
            recs   = ["Consider alternative diagnoses (MSK, GI)",
                      "CT KUB if clinical suspicion persists despite low score",
                      "Urine dipstick and urinalysis; analgesia"]
        case 2...3:
            interp = "Intermediate probability of ureteric colic"
            risk   = .moderate
            recs   = ["CT KUB (unenhanced) recommended to confirm stone and size",
                      "Urinalysis, FBC, U&E, CRP",
                      "Analgesia (NSAIDs first-line unless contraindicated)",
                      "Alpha-blocker (tamsulosin) for distal ureteric stones ≤10 mm",
                      "Urology review if stone ≥6 mm, obstruction, or infection"]
        default:
            interp = "High probability of ureteric colic"
            risk   = .high
            recs   = ["CT KUB urgent to characterise stone; check for infection or solitary kidney",
                      "If infected obstructed system: urgent urology — percutaneous nephrostomy or ureteric stent",
                      "Analgesia: diclofenac 75 mg IM or rectal + IV morphine if required",
                      "U&E, FBC, CRP, urine MC&S",
                      "Admit if: stone ≥10 mm, obstruction, infection, uncontrolled pain, solitary kidney"]
        }
        return ClinicalScore(
            name:          "STONE Score",
            score:         Double(total),
            maxScore:      5,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Moore CL et al. Ann Emerg Med 2014;64:239–247. 5-variable pre-imaging score: Size (<1/1–5/6–10/>10 mm = 0/2/1/0), Tightness (UVJ narrowing = +1), Obstruction (hydronephrosis = +1), Nausea (+1), Erythrocytes (+1). Score 0–5; ≥4 = high probability. Validated to triage CT KUB use in suspected ureteric colic."
        )
    }

    // MARK: - Centor / McIsaac Score (Group A Streptococcal Pharyngitis)
    struct CentorInput: Equatable {
        var tonsillarExudate: Bool = false  // Tonsillar swelling or exudate
        var tenderAnteriorCervical: Bool = false // Tender anterior cervical lymphadenopathy
        var feverHistory: Bool = false      // History of fever or temperature > 38°C
        var noCough: Bool = false           // Absence of cough (+1)
        var ageGroup: Int = 1              // 0=<15yr(+1), 1=15–44yr(0), 2=≥45yr(-1)
    }
    static func centor(_ i: CentorInput) -> ClinicalScore {
        var total = (i.tonsillarExudate ? 1 : 0) +
                    (i.tenderAnteriorCervical ? 1 : 0) +
                    (i.feverHistory ? 1 : 0) +
                    (i.noCough ? 1 : 0)
        switch i.ageGroup {
        case 0: total += 1   // <15 yr
        case 2: total -= 1   // ≥45 yr
        default: break
        }
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch total {
        case ..<1:
            interp = "Score ≤0 — Group A Strep very unlikely (<10%)"
            risk   = .low
            recs   = ["No antibiotic indicated",
                      "Symptomatic treatment: analgesia, throat lozenges, adequate hydration",
                      "Advise likely viral aetiology; reassure and safety-net"]
        case 1:
            interp = "Score 1 — GAS probability ~10%"
            risk   = .low
            recs   = ["No antibiotic indicated",
                      "Symptomatic management only",
                      "Rapid antigen test (RADT) only if clinical uncertainty persists"]
        case 2:
            interp = "Score 2 — GAS probability ~17%"
            risk   = .low
            recs   = ["Consider RADT before prescribing",
                      "If RADT positive or unavailable and symptoms severe: phenoxymethylpenicillin 500 mg TDS × 10 days",
                      "If RADT negative: no antibiotic"]
        case 3:
            interp = "Score 3 — GAS probability ~35%"
            risk   = .moderate
            recs   = ["RADT recommended; treat if positive",
                      "If RADT unavailable: empirical antibiotic appropriate",
                      "Phenoxymethylpenicillin 500 mg TDS × 10 days (or amoxicillin 500 mg BD × 10 days)",
                      "If penicillin allergy: clarithromycin 250 mg BD × 5 days"]
        default:
            interp = "Score ≥4 — GAS probability ~50–60%"
            risk   = .high
            recs   = ["Prescribe antibiotic without awaiting RADT",
                      "Phenoxymethylpenicillin 500 mg TDS × 10 days (first-line per SIGN/NICE)",
                      "Consider throat swab for culture in immunocompromised patients",
                      "If no improvement in 48–72 h: review and culture",
                      "Admit if peritonsillar abscess (quinsy) suspected: trismus, unilateral uvular deviation"]
        }
        return ClinicalScore(
            name:          "Centor / McIsaac",
            score:         Double(total),
            maxScore:      5,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Centor RM et al. Med Decis Making 1981;1:239–246; McIsaac WJ et al. CMAJ 1998;158:75–83. Modified Centor: 4 clinical criteria + age adjustment (−1 if ≥45; +1 if <15). Score ≥4 = 50–60% GAS probability. NICE NG84 and SIGN 160 recommend against routine antibiotic prescribing for scores ≤1 and RADT-guided therapy for scores 2–3."
        )
    }

    // MARK: - IPSS (International Prostate Symptom Score)
    struct IPSSInput: Equatable {
        // 7 items 0–5 each + QoL 0–6
        var incompleteEmptying: Int = 0  // Q1
        var frequency: Int = 0          // Q2
        var intermittency: Int = 0      // Q3
        var urgency: Int = 0            // Q4
        var weakStream: Int = 0         // Q5
        var straining: Int = 0          // Q6
        var nocturia: Int = 0           // Q7 (0–5)
        var qualityOfLife: Int = 0      // QoL 0=delighted, 6=terrible
    }
    static func ipss(_ i: IPSSInput) -> ClinicalScore {
        let symptomTotal = i.incompleteEmptying + i.frequency + i.intermittency + i.urgency +
                           i.weakStream + i.straining + i.nocturia
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch symptomTotal {
        case 0...7:
            interp = "Mild LUTS (Score 0–7)"
            risk   = .low
            recs   = ["Watchful waiting appropriate if QoL acceptable",
                      "Lifestyle advice: fluid management, reduce caffeine/alcohol, bladder training",
                      "Annual review with IPSS reassessment",
                      "PSA and DRE if not done within 12 months"]
        case 8...19:
            interp = "Moderate LUTS (Score 8–19)"
            risk   = .moderate
            recs   = ["Medical treatment indicated if QoL affected (QoL ≥3)",
                      "Alpha-blocker (tamsulosin 400 mcg daily) — first-line for voiding symptoms",
                      "5-alpha-reductase inhibitor (finasteride) if prostate >30 mL on USS",
                      "Combination therapy for large prostate with bothersome LUTS",
                      "Uroflowmetry and post-void residual assessment",
                      "Urology referral if trial of treatment ineffective at 3 months"]
        default:
            interp = "Severe LUTS (Score 20–35)"
            risk   = .high
            recs   = ["Urology referral for surgical evaluation",
                      "Consider TURP, HoLEP, or minimally invasive therapy",
                      "Rule out acute/chronic retention: US bladder for post-void residual",
                      "Urgent catheterisation if retention present",
                      "PSA + DRE mandatory; MRI prostate if PSA elevated",
                      "Assess for neurological cause if obstructive symptoms disproportionate"]
        }
        let qolLabel = ["Delighted","Pleased","Mostly satisfied","Mixed","Mostly dissatisfied","Unhappy","Terrible"][min(i.qualityOfLife, 6)]
        var finalRecs = recs
        if i.qualityOfLife >= 4 {
            finalRecs.insert("QoL '\(qolLabel)' (≥4) — symptoms significantly impacting life; escalate treatment", at: 0)
        }
        return ClinicalScore(
            name:          "IPSS",
            score:         Double(symptomTotal),
            maxScore:      35,
            risk:          risk,
            interpretation: "\(interp) | QoL: \(i.qualityOfLife)/6 (\(qolLabel))",
            recommendations: finalRecs,
            evidenceNote:  "Barry MJ et al. J Urol 1992;148:1549–1557. 7 symptom questions + 1 QoL question; each 0–5 = total 0–35. AUA/EAU endorsed. Mild 0–7, Moderate 8–19, Severe 20–35. QoL 0=Delighted, 6=Terrible; QoL ≥4 warrants treatment escalation regardless of symptom score."
        )
    }

    // MARK: - #96 FINDRISC (Finnish Type 2 Diabetes Risk Score)

    struct FINDRISCInput: Equatable {
        var ageGroup: Int          // 0=<45, 2=45–54, 3=55–64, 4=≥65
        var bmi: Double            // kg/m²
        var waistCircumferenceCm: Double
        var sex: String            // "male" or "female"
        var physicalActivityMinPerWeek: Int  // 0=<30 min, 2=≥30 min
        var vegetablesFruitDaily: Bool      // eats veg/fruit daily
        var hypertensionMeds: Bool          // on antihypertensive medication
        var highBloodGlucoseHistory: Bool   // ever found high blood glucose
        var familyHistoryDiabetes: Int      // 0=none, 3=second-degree, 5=first-degree
    }

    static func findrisc(_ i: FINDRISCInput) -> ClinicalScore {
        var score = 0

        // Age
        score += i.ageGroup

        // BMI
        if i.bmi >= 30 { score += 3 } else if i.bmi >= 25 { score += 1 }

        // Waist circumference (sex-specific thresholds)
        if i.sex.lowercased() == "male" {
            if i.waistCircumferenceCm >= 102 { score += 4 } else if i.waistCircumferenceCm >= 94 { score += 3 }
        } else {
            if i.waistCircumferenceCm >= 88 { score += 4 } else if i.waistCircumferenceCm >= 80 { score += 3 }
        }

        // Physical activity
        if i.physicalActivityMinPerWeek == 0 { score += 2 }

        // Diet
        if !i.vegetablesFruitDaily { score += 1 }

        // Hypertension medication
        if i.hypertensionMeds { score += 2 }

        // History of high blood glucose
        if i.highBloodGlucoseHistory { score += 5 }

        // Family history
        score += i.familyHistoryDiabetes

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        switch score {
        case 0...6:
            risk  = .low
            interp = "FINDRISC \(score) — Low risk. Estimated 1-in-100 chance of developing T2DM over 10 years."
            recs  = [
                "Maintain healthy weight (BMI 18.5–24.9)",
                "Minimum 150 min/week moderate physical activity",
                "Healthy diet: high fibre, low glycaemic index, limited processed food",
                "Reassess annually if risk factors change"
            ]
        case 7...11:
            risk  = .moderate
            interp = "FINDRISC \(score) — Slightly elevated risk. ~1-in-25 chance of T2DM over 10 years."
            recs  = [
                "Weight reduction if BMI >25 — even 5–7% weight loss significantly reduces progression",
                "Structured physical activity programme",
                "Dietary review with focus on carbohydrate quality",
                "Fasting plasma glucose or HbA1c to establish baseline"
            ]
        case 12...14:
            risk  = .high
            interp = "FINDRISC \(score) — Moderate risk. ~1-in-6 chance of T2DM over 10 years."
            recs  = [
                "Fasting plasma glucose AND HbA1c — exclude undiagnosed T2DM or prediabetes",
                "Intensive lifestyle intervention: structured dietary programme and 150–210 min/week activity",
                "Consider referral to structured diabetes prevention programme",
                "Reassess in 6–12 months"
            ]
            flags = ["FINDRISC ≥12 — screen for undiagnosed T2DM with FPG and HbA1c"]
        case 15...20:
            risk  = .high
            interp = "FINDRISC \(score) — High risk. ~1-in-3 chance of T2DM over 10 years."
            recs  = [
                "Urgent fasting plasma glucose and HbA1c — high probability of undiagnosed T2DM",
                "Refer to structured diabetes prevention or management programme",
                "Cardiovascular risk assessment (lipids, BP, smoking status)",
                "Intensive lifestyle intervention with dietitian and exercise physiologist"
            ]
            flags = ["FINDRISC ≥15 — 1-in-3 risk; immediate diabetes screening and prevention referral"]
        default:
            risk  = .critical
            interp = "FINDRISC \(score) — Very high risk. ~1-in-2 chance of T2DM over 10 years."
            recs  = [
                "Immediate fasting plasma glucose and HbA1c to confirm or exclude T2DM",
                "Cardiology risk stratification",
                "Referral to endocrinology or diabetes clinic if prediabetes confirmed",
                "Metformin consideration for high-risk prediabetes (ADA guidance)",
                "Intensive multidisciplinary lifestyle intervention"
            ]
            flags = ["FINDRISC ≥21 — very high risk; T2DM likely or already present; immediate workup"]
        }

        return ClinicalScore(
            name:          "FINDRISC",
            score:         Double(score),
            maxScore:      26,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Lindström J, Tuomilehto J. Diabetes Care 2003;26:725. 8-item self-administered T2DM risk questionnaire. Score 0–26; validated against OGTT in Finnish population cohorts. AUC 0.85 for predicting T2DM over 10 years. Recommended by IDF and many national guidelines as first-line screening tool. Score ≥12 triggers biochemical screening; ≥15 requires immediate clinical assessment."
        )
    }

    // MARK: - #98 CKD-EPI eGFR (Chronic Kidney Disease Staging)

    struct CKDEPIInput: Equatable {
        var serumCreatinineMgDL: Double  // serum creatinine in mg/dL
        var ageYears: Int
        var sex: String                  // "male" or "female"
        var raceAA: Bool                 // African American (2021 equation drops this; retained for legacy)
    }

    static func ckdEpi(_ i: CKDEPIInput) -> ClinicalScore {
        // CKD-EPI 2021 (race-free) Cr equation
        // eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^(-1.200) × 0.9938^Age [× 1.012 if female]
        // Guard: scr ≤ 0 → pow(0, negative alpha) = +infinity which crashes Int()
        guard i.serumCreatinineMgDL > 0 else {
            return ClinicalScore(
                systemName: "CKD-EPI (2021)", abbreviation: "CKD-EPI",
                score: 0, maxScore: 0, risk: .low,
                interpretation: "Enter serum creatinine > 0 mg/dL to calculate eGFR.",
                recommendations: [], items: [], redFlags: [],
                evidenceNote: "CKD-EPI 2021 (Inker et al, NEJM 2021). Race-free equation."
            )
        }
        let kappa: Double = i.sex.lowercased() == "female" ? 0.7 : 0.9
        let alpha: Double = i.sex.lowercased() == "female" ? -0.241 : -0.302
        let scr = i.serumCreatinineMgDL
        let ratio = scr / kappa
        let term1 = pow(min(ratio, 1.0), alpha)
        let term2 = pow(max(ratio, 1.0), -1.200)
        let term3 = pow(0.9938, Double(i.ageYears))
        let sexFactor: Double = i.sex.lowercased() == "female" ? 1.012 : 1.0
        let egfr = 142.0 * term1 * term2 * term3 * sexFactor

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        let egfrStr = String(format: "%.1f", egfr)
        let (stage, stageName) = ckdStage(egfr)

        switch stage {
        case 1:
            risk  = .low
            interp = "eGFR \(egfrStr) mL/min/1.73m² — CKD Stage G1 (\(stageName)). Normal/high GFR."
            recs  = [
                "Treat underlying cause (proteinuria, hypertension, diabetes)",
                "Annual ACR (albumin:creatinine ratio) to assess proteinuria",
                "Blood pressure target <130/80 mmHg (ACEi/ARB if proteinuria present)",
                "Nephrology referral if cause unclear or rapidly progressive"
            ]
        case 2:
            risk  = .low
            interp = "eGFR \(egfrStr) mL/min/1.73m² — CKD Stage G2 (\(stageName)). Mildly decreased."
            recs  = [
                "Identify and treat underlying cause",
                "Monitor annually: eGFR, ACR, BP, electrolytes",
                "Avoid nephrotoxins (NSAIDs, IV contrast without precautions)"
            ]
        case 3:
            risk  = .moderate
            interp = "eGFR \(egfrStr) mL/min/1.73m² — CKD Stage G3 (\(stageName)). Moderately decreased."
            recs  = [
                "Nephrology co-management if not yet involved",
                "6-monthly monitoring: eGFR, ACR, potassium, bicarbonate, phosphate, Hb",
                "Avoid all nephrotoxins; adjust medication doses to eGFR",
                "Anaemia work-up: iron studies, consider erythropoiesis-stimulating agents",
                "Calcium-phosphate management; vitamin D supplementation if deficient",
                "Dietary sodium restriction and protein optimisation"
            ]
        case 4:
            risk  = .high
            interp = "eGFR \(egfrStr) mL/min/1.73m² — CKD Stage G4 (\(stageName)). Severely decreased."
            recs  = [
                "Nephrology review — renal replacement therapy planning",
                "AV fistula creation referral if haemodialysis planned",
                "Peritoneal dialysis and transplant workup discussion",
                "3-monthly monitoring of all metabolic parameters",
                "Review all medications for dose adjustment"
            ]
            flags = ["eGFR <30 — prepare for renal replacement therapy; nephrology must be involved"]
        default:
            risk  = .critical
            interp = "eGFR \(egfrStr) mL/min/1.73m² — CKD Stage G5 (\(stageName)). Kidney failure."
            recs  = [
                "Urgent nephrology review — dialysis or transplant required if not already initiated",
                "Emergency haemodialysis if symptomatic uraemia, severe hyperkalaemia, or fluid overload",
                "Conservative pathway discussion if dialysis not appropriate",
                "Palliative care input for uraemic symptom management if appropriate"
            ]
            flags = ["eGFR <15 — kidney failure; renal replacement therapy or conservative pathway urgently"]
        }

        return ClinicalScore(
            name:          "CKD-EPI eGFR",
            score:         egfr,
            maxScore:      nil,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Inker LA et al. NEJM 2021;385:1737. CKD-EPI 2021 race-free creatinine equation. eGFR ≥90 = G1, 60–89 = G2, 45–59 = G3a, 30–44 = G3b, 15–29 = G4, <15 = G5. KDIGO 2022 guidelines recommend staging by both eGFR and albuminuria (ACR) categories. The 2021 update removed the race coefficient; prior versions using the AF-American race multiplier are no longer recommended by major nephrology societies."
        )
    }

    private static func ckdStage(_ egfr: Double) -> (Int, String) {
        if egfr >= 90      { return (1, "normal or high") }
        else if egfr >= 60 { return (2, "mildly decreased") }
        else if egfr >= 45 { return (3, "mildly–moderately decreased") }
        else if egfr >= 30 { return (3, "moderately–severely decreased") }
        else if egfr >= 15 { return (4, "severely decreased") }
        else               { return (5, "kidney failure") }
    }

    // MARK: - #102 CAGE Questionnaire (Alcohol Use Disorder Screen)

    struct CAGEInput: Equatable {
        var feltCutDown: Bool         // Ever felt you should Cut down drinking?
        var annoyedByCriticism: Bool  // People Annoyed you by criticising drinking?
        var feltGuilty: Bool          // Ever felt Guilty about drinking?
        var eyeOpener: Bool           // Ever had a drink first thing in morning (Eye-opener)?
    }

    static func cage(_ i: CAGEInput) -> ClinicalScore {
        let score = [i.feltCutDown, i.annoyedByCriticism, i.feltGuilty, i.eyeOpener].filter { $0 }.count

        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        switch score {
        case 0:
            risk  = .low
            interp = "CAGE \(score)/4 — Alcohol use disorder unlikely."
            recs  = ["Advise safe drinking limits: ≤14 units/week (spread over ≥3 days)"]
        case 1:
            risk  = .moderate
            interp = "CAGE \(score)/4 — Possible alcohol use disorder. Proceed to full AUDIT questionnaire."
            recs  = [
                "Complete AUDIT questionnaire for full assessment",
                "Brief motivational counselling regarding alcohol intake",
                "Recheck at next appointment"
            ]
        default:
            risk  = .high
            interp = "CAGE \(score)/4 — Probable alcohol use disorder (≥2 positive responses; sensitivity 71–84%, specificity 76–96%)."
            recs  = [
                "Formal alcohol use disorder assessment (AUDIT, DSM-5 criteria)",
                "Addiction medicine / alcohol liaison nurse referral",
                "Assess for alcohol dependence — withdrawal risk if admitted (use CIWA-Ar)",
                "Prescribe thiamine (vitamin B₁) before any glucose in dependent patients",
                "Consider naltrexone or acamprosate for pharmacological support",
                "Brief intervention and motivational interviewing"
            ]
            if score >= 3 {
                flags = ["CAGE ≥3 — high probability of dependence; assess withdrawal risk before any surgical admission"]
            }
        }

        return ClinicalScore(
            name:          "CAGE Questionnaire",
            score:         Double(score),
            maxScore:      4,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Ewing JA. JAMA 1984;252:1905. Four-item alcohol use disorder screening tool (Cut down, Annoyed, Guilty, Eye-opener). Score ≥2 = significant sensitivity for AUD (71–84%) and dependence (77–91%). Positive CAGE should prompt AUDIT questionnaire for full characterisation. In surgical patients, alcohol dependence markedly increases complications — thiamine, CIWA-Ar monitoring, and addiction referral before elective procedures."
        )
    }

    // MARK: - #103 Duke Criteria for Infective Endocarditis

    struct DukeInput: Equatable {
        // Major criteria
        var positiveBloodCultures: Int      // 0 = none, 1 = single typical organism, 2 = ≥2 cultures or persistent bacteraemia
        var endocardialInvolvement: Int     // 0 = none, 1 = vegetation/abscess on echo, 2 = new valve regurgitation
        // Minor criteria (each Boolean = 1 point)
        var predisposedHeartCondition: Bool // known valve disease, prosthetic valve, prior IE
        var ivDrugUse: Bool
        var feverGe38: Bool
        var vascularPhenomena: Bool         // emboli, Janeway lesions, mycotic aneurysm
        var immunologicPhenomena: Bool      // Osler nodes, Roth spots, RF positive, glomerulonephritis
        var positiveBloodCultureMinor: Bool // blood culture positive but not meeting major criteria
        var echoMinor: Bool                 // echo findings consistent with IE but not meeting major
    }

    static func dukeIE(_ i: DukeInput) -> ClinicalScore {
        let majorCount = (i.positiveBloodCultures >= 1 ? 1 : 0) + (i.endocardialInvolvement >= 1 ? 1 : 0)
        let minorCount = [i.predisposedHeartCondition, i.ivDrugUse, i.feverGe38,
                          i.vascularPhenomena, i.immunologicPhenomena,
                          i.positiveBloodCultureMinor, i.echoMinor].filter { $0 }.count

        let classification: String
        let risk: ScoreRisk
        var recs: [String]
        var flags: [String] = []

        // Duke classification rules
        if majorCount == 2 ||
           (majorCount == 1 && minorCount >= 3) ||
           minorCount >= 5 {
            classification = "DEFINITE IE"
            risk  = .critical
            recs  = [
                "Cardiology and infectious diseases urgent co-management",
                "Transoesophageal echocardiography (TOE) if TTE non-diagnostic",
                "Blood cultures × 3 sets before antibiotics if not yet collected",
                "Empirical antibiotics per local guidelines (typically vancomycin ± gentamicin)",
                "Target antibiotic therapy to blood culture organisms when available",
                "Assess for surgical indications: haemodynamic compromise, uncontrolled infection, prevention of embolism",
                "Dental focus treatment after initial antibiotic stabilisation"
            ]
            flags = ["Definite IE — urgent cardiology + ID review; assess surgical threshold"]
        } else if majorCount == 1 && minorCount == 1 {
            classification = "POSSIBLE IE"
            risk  = .high
            recs  = [
                "Repeat blood cultures × 3 sets (ideally before antibiotics if clinically stable)",
                "Transthoracic echocardiography urgently; TOE if TTE non-diagnostic",
                "Cardiology review",
                "Do not delay empirical antibiotics if patient haemodynamically unstable",
                "FDG-PET/CT or SPECT/CT if echocardiography inconclusive and prosthetic valve"
            ]
            flags = ["Possible IE — blood cultures and echo urgently required"]
        } else if majorCount == 0 && minorCount >= 1 {
            classification = "POSSIBLE IE"
            risk  = .moderate
            recs  = [
                "Blood cultures × 3 sets",
                "Transthoracic echocardiography",
                "Fever workup: urine, CXR, wound sites",
                "Cardiology review if clinical suspicion remains"
            ]
        } else {
            classification = "REJECTED (IE unlikely)"
            risk  = .low
            recs  = [
                "Seek alternative diagnosis for fever and symptoms",
                "If resolution within 4 days of antibiotics, rejection is supported",
                "Monitor clinical course — reconsider if new criteria develop"
            ]
        }

        let score = Double(majorCount * 2 + minorCount)
        return ClinicalScore(
            name:          "Duke Criteria for IE",
            score:         score,
            maxScore:      nil,
            risk:          risk,
            interpretation: "\(classification) — \(majorCount) major, \(minorCount) minor criteria met.",
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Durack DT et al. Am J Med 1994;96:200. Modified Duke Criteria (Li 2000): 2 major OR 1 major+3 minor OR 5 minor = definite IE; 1 major+1 minor OR 3 minor = possible. Major criteria: (1) typical organisms in ≥2 blood cultures / persistent bacteraemia, (2) endocardial involvement on echo / new valve regurgitation. Sensitivity ~80% for native-valve IE; lower for prosthetic or pacemaker infection — FDG-PET/CT and WBC-SPECT/CT added in 2015 ESC modification. Pathological criteria (operative/histological) provide definitive diagnosis."
        )
    }


}
