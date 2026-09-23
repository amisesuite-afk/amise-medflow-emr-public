// ClinicalScoringEngine+Perioperative3b.swift
// Braden Scale, LACE Index, and Mirels Score perioperative risk scoring.

import Foundation


extension ClinicalScoringEngine {

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
