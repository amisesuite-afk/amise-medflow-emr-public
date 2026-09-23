// ClinicalScoringEngine+Perioperative3.swift
// Charlson Comorbidity Index, Modified Frailty Index-5, Braden Scale, LACE Index, Mirels Criteria
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {

    // MARK: - Charlson Comorbidity Index (#76)

    struct CCIInput: Equatable {
        // 1-point conditions
        var myocardialInfarction: Bool = false
        var congestiveHeartFailure: Bool = false
        var peripheralVascularDisease: Bool = false
        var cerebrovascularDisease: Bool = false
        var dementia: Bool = false
        var chronicPulmonaryDisease: Bool = false
        var connectiveTissueDisease: Bool = false
        var pepticulcer: Bool = false
        var mildLiverDisease: Bool = false
        var diabetesUncomplicated: Bool = false
        // 2-point conditions
        var diabetesWithEndOrganDamage: Bool = false
        var hemiplecia: Bool = false
        var moderateOrSevereCKD: Bool = false
        var solidTumour: Bool = false
        // 3-point conditions
        var leukaemia: Bool = false
        var lymphoma: Bool = false
        // 4-point conditions — 6 in original, but age-adjusted variant adjusts later
        var moderateOrSevereLiverDisease: Bool = false
        var metastaticSolidTumour: Bool = false
        var aids: Bool = false
        // Age for age-adjusted CCI
        var age: Int = 60
    }

    static func cci(_ i: CCIInput) -> ClinicalScore {
        var pts = 0
        if i.myocardialInfarction        { pts += 1 }
        if i.congestiveHeartFailure      { pts += 1 }
        if i.peripheralVascularDisease   { pts += 1 }
        if i.cerebrovascularDisease      { pts += 1 }
        if i.dementia                    { pts += 1 }
        if i.chronicPulmonaryDisease     { pts += 1 }
        if i.connectiveTissueDisease     { pts += 1 }
        if i.pepticulcer                 { pts += 1 }
        if i.mildLiverDisease            { pts += 1 }
        if i.diabetesUncomplicated       { pts += 1 }
        if i.diabetesWithEndOrganDamage  { pts += 2 }
        if i.hemiplecia                  { pts += 2 }
        if i.moderateOrSevereCKD         { pts += 2 }
        if i.solidTumour                 { pts += 2 }
        if i.leukaemia                   { pts += 2 }
        if i.lymphoma                    { pts += 2 }
        if i.moderateOrSevereLiverDisease { pts += 3 }
        if i.metastaticSolidTumour       { pts += 6 }
        if i.aids                        { pts += 6 }

        // Age adjustment (+1 per decade over 40)
        let agePoints: Int
        if i.age >= 80        { agePoints = 4 }
        else if i.age >= 70   { agePoints = 3 }
        else if i.age >= 60   { agePoints = 2 }
        else if i.age >= 50   { agePoints = 1 }
        else                  { agePoints = 0 }
        let totalPts = pts + agePoints

        // 10-year survival estimate (Charlson original)
        let survivalPct: String
        let risk: ScoreRisk
        let interp: String
        switch totalPts {
        case 0:
            survivalPct = "~98%"
            risk = .low
            interp = "CCI \(totalPts) — minimal comorbidity burden; excellent 10-year survival estimate (\(survivalPct))."
        case 1...2:
            survivalPct = "~90%"
            risk = .low
            interp = "CCI \(totalPts) — low comorbidity burden; 10-year survival estimate \(survivalPct). Standard perioperative risk."
        case 3...4:
            survivalPct = "~77%"
            risk = .moderate
            interp = "CCI \(totalPts) — moderate comorbidity burden; 10-year survival estimate \(survivalPct). Increased perioperative and long-term risk."
        case 5...6:
            survivalPct = "~53%"
            risk = .high
            interp = "CCI \(totalPts) — high comorbidity burden; 10-year survival estimate \(survivalPct). Significant impact on surgical outcomes and eligibility."
        default:
            survivalPct = "< 30%"
            risk = .critical
            interp = "CCI \(totalPts) — very high comorbidity burden; 10-year survival estimate \(survivalPct). Major clinical and ethical implications for operative planning."
        }

        let flags: [String] = totalPts >= 5 ? ["CCI ≥ 5: high comorbidity burden — consider geriatric review and MDT planning before major surgery"] : []
        let recs: [String]
        switch totalPts {
        case 0...2:
            recs = ["No additional comorbidity-directed workup required beyond standard assessment."]
        case 3...4:
            recs = [
                "Optimise major comorbidities pre-operatively.",
                "Discuss CCI score with anaesthesia team during pre-operative assessment.",
                "Document comorbidity status in consent discussion."
            ]
        default:
            recs = [
                "Consider multidisciplinary team review before major elective surgery.",
                "Ensure detailed informed consent documenting elevated comorbidity risk.",
                "Consider geriatric or specialist review for high-scoring individual conditions.",
                "CCI is a validated independent predictor of surgical mortality and post-operative complications."
            ]
        }

        return ClinicalScore(
            name: "Charlson Comorbidity Index",
            score: Double(totalPts),
            maxScore: 37,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Myocardial infarction (history)", points: 1, present: i.myocardialInfarction),
                ScoredItem(label: "Congestive heart failure", points: 1, present: i.congestiveHeartFailure),
                ScoredItem(label: "Peripheral vascular disease", points: 1, present: i.peripheralVascularDisease),
                ScoredItem(label: "Cerebrovascular disease / TIA", points: 1, present: i.cerebrovascularDisease),
                ScoredItem(label: "Dementia", points: 1, present: i.dementia),
                ScoredItem(label: "Chronic pulmonary disease (COPD / asthma)", points: 1, present: i.chronicPulmonaryDisease),
                ScoredItem(label: "Connective tissue disease / rheumatological disease", points: 1, present: i.connectiveTissueDisease),
                ScoredItem(label: "Peptic ulcer disease", points: 1, present: i.pepticulcer),
                ScoredItem(label: "Mild liver disease (cirrhosis without portal hypertension)", points: 1, present: i.mildLiverDisease),
                ScoredItem(label: "Diabetes mellitus (uncomplicated)", points: 1, present: i.diabetesUncomplicated),
                ScoredItem(label: "Diabetes with end-organ damage", points: 2, present: i.diabetesWithEndOrganDamage),
                ScoredItem(label: "Hemiplegia / paraplegia", points: 2, present: i.hemiplecia),
                ScoredItem(label: "Moderate/severe CKD (creatinine > 3 mg/dL or dialysis)", points: 2, present: i.moderateOrSevereCKD),
                ScoredItem(label: "Any solid tumour (within 5 years, without metastasis)", points: 2, present: i.solidTumour),
                ScoredItem(label: "Leukaemia (AML, CML, ALL, CLL)", points: 2, present: i.leukaemia),
                ScoredItem(label: "Lymphoma / multiple myeloma / Waldenström's", points: 2, present: i.lymphoma),
                ScoredItem(label: "Moderate/severe liver disease (portal hypertension, varices, ascites)", points: 3, present: i.moderateOrSevereLiverDisease),
                ScoredItem(label: "Metastatic solid tumour", points: 6, present: i.metastaticSolidTumour),
                ScoredItem(label: "AIDS (not just HIV+)", points: 6, present: i.aids),
                ScoredItem(label: "Age \(i.age) years — \(agePoints) age-adjustment point(s)", points: Double(agePoints), present: agePoints > 0)
            ],
            redFlags: flags,
            evidenceNote: "Charlson ME et al. J Chronic Dis 1987;40:373–383. Validated for 10-year mortality prediction. Age-adjusted CCI widely used in surgical outcomes research (NSQIP, ERAS protocols). CCI ≥ 3 independently predicts post-operative complications; CCI ≥ 5 is associated with 30-day surgical mortality in major abdominal surgery."
        )
    }

    // MARK: - Modified Frailty Index-5 (mFI-5) (#77)

    struct MFI5Input: Equatable {
        var diabetes: Bool = false          // DM requiring medication
        var functionalDependence: Bool = false  // partial or total dependence for ADL
        var COPD: Bool = false              // COPD or pneumonia hospitalisation in past year
        var congestiveHeartFailure: Bool = false
        var hypertension: Bool = false      // requiring medication
    }

    static func mfi5(_ i: MFI5Input) -> ClinicalScore {
        var pts = 0
        if i.diabetes               { pts += 1 }
        if i.functionalDependence   { pts += 1 }
        if i.COPD                   { pts += 1 }
        if i.congestiveHeartFailure { pts += 1 }
        if i.hypertension           { pts += 1 }

        let risk: ScoreRisk
        let interp: String
        switch pts {
        case 0:
            risk = .low
            interp = "mFI-5 = 0 — non-frail. No frailty-related risk factors. Standard perioperative pathway appropriate."
        case 1:
            risk = .low
            interp = "mFI-5 = 1 — mild frailty signal. Modest increase in post-operative complications. Standard pathway with attention to hydration and early mobilisation."
        case 2:
            risk = .moderate
            interp = "mFI-5 = 2 — moderate frailty. Significantly increased risk of post-operative complications, prolonged LOS, and 30-day mortality. Consider prehabilitation."
        default:
            risk = .high
            interp = "mFI-5 ≥ 3 — severe frailty. Markedly elevated surgical risk. MDT review, comprehensive geriatric assessment, and shared decision-making strongly recommended before major surgery."
        }

        let flags: [String] = pts >= 3 ? ["mFI-5 ≥ 3: severe frailty — consider comprehensive geriatric assessment and MDT before proceeding with major surgery"] : []
        let recs: [String]
        switch pts {
        case 0...1:
            recs = ["Frailty score does not indicate a need for additional pre-operative assessment."]
        case 2:
            recs = [
                "Consider prehabilitation (exercise, nutrition optimisation) before elective major surgery.",
                "Ensure anaesthetic pre-assessment documents functional status.",
                "Plan early post-operative mobilisation and nutrition support."
            ]
        default:
            recs = [
                "Refer for comprehensive geriatric assessment before major elective surgery.",
                "Discuss operative risk and goals of care with patient and family.",
                "Consider minimally invasive surgical approaches where oncologically and technically appropriate.",
                "Engage ERAS protocol with emphasis on early nutrition and physiotherapy."
            ]
        }

        return ClinicalScore(
            name: "Modified Frailty Index-5 (mFI-5)",
            score: Double(pts),
            maxScore: 5,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: [
                ScoredItem(label: "Diabetes mellitus (requiring medication)", points: 1, present: i.diabetes),
                ScoredItem(label: "Functional dependence (partial or total — ADL)", points: 1, present: i.functionalDependence),
                ScoredItem(label: "COPD or pneumonia requiring hospitalisation (past year)", points: 1, present: i.COPD),
                ScoredItem(label: "Congestive heart failure", points: 1, present: i.congestiveHeartFailure),
                ScoredItem(label: "Hypertension requiring medication", points: 1, present: i.hypertension)
            ],
            redFlags: flags,
            evidenceNote: "Subramaniam S et al. J Am Coll Surg 2018;226:173–181. mFI-5 derived from 11-item mFI. Validated in NSQIP database (n > 1.4 million). Each point increment independently predicts 30-day mortality, serious complications, and non-home discharge. Comparable predictive performance to full 11-item index in major abdominal and vascular surgery."
        )
    }

}
