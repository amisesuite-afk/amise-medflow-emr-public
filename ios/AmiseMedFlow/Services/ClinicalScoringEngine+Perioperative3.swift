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

    // MARK: - Braden Scale (Pressure Injury Risk)
    struct BradenInput: Equatable {
        var sensoryPerception: Int = 4  // 1=Complete, 2=Very, 3=Slightly, 4=No impairment
        var moisture: Int = 4           // 1=Constantly, 2=Very, 3=Occasionally, 4=Rarely moist
        var activity: Int = 4           // 1=Bedfast, 2=Chairfast, 3=Walks occasionally, 4=Walks frequently
        var mobility: Int = 4           // 1=Completely limited, 2=Very, 3=Slightly, 4=No limitation
        var nutrition: Int = 4          // 1=Very poor, 2=Probably inadequate, 3=Adequate, 4=Excellent
        var frictionShear: Int = 3      // 1=Problem, 2=Potential problem, 3=No apparent problem (max 3)
    }
    static func braden(_ i: BradenInput) -> ClinicalScore {
        let total = i.sensoryPerception + i.moisture + i.activity +
                    i.mobility + i.nutrition + i.frictionShear
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch total {
        case 19...23:
            interp = "No risk or low risk of pressure injury"
            risk   = .low
            recs   = ["Routine preventive care",
                      "Moisturise skin; reposition every 2–4 hours",
                      "Reassess if clinical condition deteriorates"]
        case 15...18:
            interp = "Low risk — pressure injury possible"
            risk   = .low
            recs   = ["Pressure-redistributing mattress (foam or alternating air)",
                      "Reposition every 2 hours; document position changes",
                      "Nutritional optimisation: dietitian review",
                      "Skin inspection twice daily"]
        case 13...14:
            interp = "Moderate risk — pressure injury likely without intervention"
            risk   = .moderate
            recs   = ["Active pressure-relieving mattress mandatory",
                      "Heel protectors; no dragging in bed",
                      "Physiotherapy for mobility promotion",
                      "Nutritional support (high-protein diet / supplement)",
                      "Formal wound care plan if any skin break detected"]
        case 10...12:
            interp = "High risk — pressure injury expected without intensive prevention"
            risk   = .high
            recs   = ["Dynamic (alternating pressure) mattress and cushion",
                      "Reposition every 2 hours; consider tilt-and-space seating",
                      "Dietitian — nutritional support or enteral feeds",
                      "Wound/tissue viability specialist review",
                      "Document skin assessment and interventions daily"]
        default:
            interp = "Very high risk — pressure injury imminent"
            risk   = .high
            recs   = ["Urgent tissue viability nurse assessment",
                      "High-specification low-air-loss or lateral rotation mattress",
                      "Maximum repositioning: every 1–2 hours or continuous lateral rotation",
                      "Skin barrier products; transparent film over bony prominences",
                      "Urgent nutritional support — IV if enteral not possible",
                      "Photograph and document all existing skin changes immediately"]
        }
        return ClinicalScore(
            name:          "Braden Scale",
            score:         Double(total),
            maxScore:      23,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Bergstrom N et al. Nurs Res 1987;36:205–210. 6-subscale scale (Sensory Perception, Moisture, Activity, Mobility, Nutrition, Friction/Shear); total 6–23 — lower score = higher risk. Threshold ≤18 = at risk in most guidelines. Endorsed by NICE (CG179) and AHRQ; widely used alongside Waterlow Scale."
        )
    }

    // MARK: - #95 LACE Index (30-Day Readmission Risk)

    struct LACEInput: Equatable {
        var lengthOfStayDays: Int    // L: 0–14+ days
        var acuteAdmission: Bool     // A: unplanned/acute vs elective
        var charlsonIndex: Int       // C: CCI score (clamped to 0–4)
        var edVisitsLast6Months: Int // E: number of ED visits (clamped to 0–4)
    }

    static func lace(_ i: LACEInput) -> ClinicalScore {
        // L — length of stay (0–7 scale)
        let los = i.lengthOfStayDays
        let lScore: Int
        switch los {
        case 0:      lScore = 0
        case 1:      lScore = 1
        case 2:      lScore = 2
        case 3:      lScore = 3
        case 4...6:  lScore = 4
        case 7...13: lScore = 5
        default:     lScore = 7
        }

        // A — admission type (0 or 3)
        let aScore = i.acuteAdmission ? 3 : 0

        // C — Charlson Comorbidity Index (capped at 4)
        let cScore = min(i.charlsonIndex, 4)

        // E — ED visits in last 6 months (capped at 4)
        let eScore = min(i.edVisitsLast6Months, 4)

        let total = lScore + aScore + cScore + eScore

        let risk: ScoreRisk
        let interp: String
        var recs: [String]

        if total >= 10 {
            risk  = .critical
            interp = "LACE \(total) — High 30-day readmission risk (≥10). Intensive post-discharge support required."
            recs  = [
                "Arrange 48–72 hour post-discharge telephone review",
                "Early GP/primary care follow-up within 7 days",
                "Medication reconciliation and patient education prior to discharge",
                "Community nurse or case manager referral",
                "Review and address all modifiable risk factors (polypharmacy, social support)",
                "Consider transitional care programme enrolment"
            ]
        } else if total >= 7 {
            risk  = .high
            interp = "LACE \(total) — Elevated 30-day readmission risk (7–9). Enhanced discharge planning recommended."
            recs  = [
                "Structured discharge planning: written care plan, medication list, clear follow-up",
                "Primary care follow-up within 14 days",
                "Patient/carer education on warning signs requiring re-presentation",
                "Ensure all investigations and outstanding results reviewed before discharge"
            ]
        } else if total >= 4 {
            risk  = .moderate
            interp = "LACE \(total) — Moderate 30-day readmission risk (4–6). Standard discharge planning with follow-up."
            recs  = [
                "Routine discharge planning with outpatient follow-up arranged",
                "Medication reconciliation",
                "Clear written discharge instructions"
            ]
        } else {
            risk  = .low
            interp = "LACE \(total) — Low 30-day readmission risk (<4). Standard discharge."
            recs  = ["Standard discharge with routine outpatient review"]
        }

        return ClinicalScore(
            name:          "LACE Index",
            score:         Double(total),
            maxScore:      19,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "van Walraven C et al. CMAJ 2010;182:551. Validated 30-day readmission risk score: L (length of stay, 0–7), A (acute admission, 0/3), C (Charlson min 0–4), E (ED visits 0–4). Total 0–19; score ≥10 = high risk (readmission rate ≈21%). Widely used for discharge planning and transitional care resource allocation."
        )
    }

    // MARK: - #97 Mirels Criteria (Pathological Fracture Risk)

    struct MirelsInput: Equatable {
        var site: Int        // 1=upper limb, 2=lower limb, 3=peritrochanteric
        var pain: Int        // 1=mild, 2=moderate, 3=functional
        var lesionType: Int  // 1=blastic, 2=mixed, 3=lytic
        var lesionSizeRatio: Int // 1=<1/3 cortex, 2=1/3–2/3, 3=>2/3
    }

    static func mirels(_ i: MirelsInput) -> ClinicalScore {
        let total = i.site + i.pain + i.lesionType + i.lesionSizeRatio
        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        if total >= 9 {
            risk  = .critical
            interp = "Mirels \(total)/12 — High fracture risk. Prophylactic fixation strongly recommended before radiotherapy."
            recs  = [
                "Urgent orthopaedic surgery / oncology review for prophylactic fixation",
                "Avoid weight-bearing on the affected limb until fixed",
                "Postoperative radiotherapy to the fixation site",
                "Multidisciplinary oncology bone meeting review",
                "Pain management: bisphosphonate or RANK-L inhibitor (denosumab)"
            ]
            flags = ["Mirels ≥9 — prophylactic fixation recommended; do not delay for radiotherapy alone"]
        } else if total == 8 {
            risk  = .high
            interp = "Mirels \(total)/12 — Indeterminate fracture risk. Consider prophylactic fixation (borderline threshold)."
            recs  = [
                "Multidisciplinary review: orthopaedic surgery, radiation oncology, medical oncology",
                "Individual clinical assessment — patient fitness, systemic disease burden, expected survival",
                "If not fixating, restrict weight-bearing; radiotherapy to lesion",
                "Repeat imaging in 4–6 weeks to assess progression"
            ]
        } else {
            risk  = .moderate
            interp = "Mirels \(total)/12 — Lower fracture risk. Radiotherapy and conservative management appropriate."
            recs  = [
                "Radiotherapy to the lesion",
                "Weight-bearing as tolerated if lower-limb lesion",
                "Regular reassessment — repeat imaging at 6–8 weeks",
                "Bone-modifying agent (bisphosphonate or denosumab)",
                "Reassess if pain escalates or lesion enlarges"
            ]
        }

        return ClinicalScore(
            name:          "Mirels Criteria",
            score:         Double(total),
            maxScore:      12,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Mirels H. Clin Orthop Relat Res 1989;249:256. Four-variable scoring system for pathological fracture risk in metastatic bone disease: site (1–3), pain (1–3), lesion type (1–3), radiological size ratio (1–3). Total 4–12. Score ≥9 = prophylactic fixation recommended (fracture risk >33%). Score 8 = borderline (15% fracture risk). Score ≤7 = radiotherapy alone acceptable (<4% fracture risk). Widely used in surgical oncology and orthopaedic oncology multidisciplinary practice."
        )
    }

}
