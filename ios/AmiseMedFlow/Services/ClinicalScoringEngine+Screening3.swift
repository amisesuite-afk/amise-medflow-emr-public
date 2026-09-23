// ClinicalScoringEngine+Screening3.swift
// FINDRISC (T2DM risk), CKD-EPI eGFR (renal staging), CAGE (alcohol use disorder),
// Duke Criteria (infective endocarditis).
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {

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

    static func ckdStage(_ egfr: Double) -> (Int, String) {
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
