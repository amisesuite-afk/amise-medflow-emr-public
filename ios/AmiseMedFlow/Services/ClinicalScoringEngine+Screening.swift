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

}
