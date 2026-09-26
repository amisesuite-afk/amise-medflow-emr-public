// ClinicalScoringEngine+Hepatic2.swift
// ALBI Score, MELD 3.0, and Maddrey Discriminant Function hepatic scoring.

import Foundation


extension ClinicalScoringEngine {

    // MARK: - ALBI Score (Albumin-Bilirubin)
    struct ALBIInput: Equatable {
        var albuminGperL: Double = 40.0   // g/L  (normal 35–50)
        var bilirubinUmolL: Double = 17.0 // μmol/L (normal <21)
    }
    static func albi(_ i: ALBIInput) -> ClinicalScore {
        // ALBI = (log₁₀(bilirubin_μmol/L) × 0.66) + (albumin_g/L × −0.085)
        let bili = max(i.bilirubinUmolL, 0.1)
        let alb  = i.albuminGperL
        let score = (log10(bili) * 0.66) + (alb * -0.085)
        let rounded = (score * 100).rounded() / 100
        let (grade, risk, recs): (String, ScoreRisk, [String])
        switch score {
        case ..<(-2.60):
            grade = "Grade 1 — Well-preserved liver function"
            risk  = .low
            recs  = ["Major hepatic resection is generally safe",
                     "Child-Pugh A equivalent functional reserve",
                     "Proceed with planned surgical strategy"]
        case -2.60 ..< -1.39:
            grade = "Grade 2 — Moderate liver dysfunction"
            risk  = .moderate
            recs  = ["Limit resection to <50% hepatic volume",
                     "Consider portal vein embolisation if extended resection planned",
                     "Optimise nutrition and correct coagulopathy pre-operatively",
                     "Hepatology review recommended"]
        default:
            grade = "Grade 3 — Severe liver dysfunction"
            risk  = .high
            recs  = ["Major hepatic resection carries prohibitive risk — avoid",
                     "Prioritise liver function optimisation (lactulose, diuretics, albumin infusion)",
                     "Consider transplant evaluation if HCC / end-stage disease",
                     "Multidisciplinary hepatobiliary conference mandatory"]
        }
        return ClinicalScore(
            name:          "ALBI Score",
            score:         rounded,
            maxScore:      nil,
            risk:          risk,
            interpretation: grade,
            recommendations: recs,
            evidenceNote:  "Johnson PJ et al. J Clin Oncol 2015;33:550–558. Continuous hepatic reserve score using albumin and bilirubin. Validated in HCC, cholangiocarcinoma, and resectional hepatic surgery. Preferred over Child-Pugh for granular hepatic reserve stratification."
        )
    }

    // MARK: - MELD 3.0 (Model for End-stage Liver Disease — 2022 update)
    struct MELD3Input: Equatable {
        var isFemale: Bool = false
        var creatinineMmolL: Double = 70.0   // μmol/L
        var bilirubinMmolL: Double = 17.0    // μmol/L
        var inr: Double = 1.0
        var sodiumMmolL: Int = 138            // mmol/L
        var albuminGperL: Double = 40.0      // g/L
    }
    static func meld3(_ i: MELD3Input) -> ClinicalScore {
        // MELD 3.0 = 4.56 × ln(bilirubin_mg/dL) + 0.82×(137−sodium) − 0.24×(137−sodium)×ln(creatinine_mg/dL)
        //            + 9.09×ln(INR) + 11.14×ln(creatinine_mg/dL) + 1.85 + (female: +1.33) + (albumin: −(4.92×albumin/35))
        // Convert SI units to mg/dL equivalents used in the formula:
        let bilMgDL  = max(1.0, i.bilirubinMmolL / 17.1)
        let creatMgDL = min(4.0, max(1.0, i.creatinineMmolL / 88.4)) // capped at 4 per UNOS
        let na = Double(min(max(i.sodiumMmolL, 125), 137)) // clamp 125–137
        let alb = i.albuminGperL / 10.0  // g/L → g/dL
        var score = 4.56 * log(bilMgDL)
                  + 0.82 * (137 - na)
                  - 0.24 * (137 - na) * log(creatMgDL)
                  + 9.09 * log(i.inr)
                  + 11.14 * log(creatMgDL)
                  + 1.85
        if i.isFemale { score += 1.33 }
        score -= (4.92 * alb / 3.5)
        score = max(6, score)
        let rounded = (score * 10).rounded() / 10
        let (interp, risk, recs): (String, ScoreRisk, [String])
        switch Int(rounded) {
        case 6...9:
            interp = "Low severity — 90-day mortality ~2%"
            risk   = .low
            recs   = ["Optimise hepatic risk factors (abstinence, nutrition, infection control)",
                      "Semi-annual surveillance (LFTs, US abdomen, AFP if cirrhotic)",
                      "Reassess MELD 3.0 at each visit"]
        case 10...14:
            interp = "Moderate severity — 90-day mortality ~6%"
            risk   = .moderate
            recs   = ["Hepatology review — quarterly monitoring",
                      "Manage complications: diuretics for ascites, beta-blocker for varices",
                      "Nutritional optimisation; referral to dietitian",
                      "Discuss liver transplant evaluation if aetiology is reversible or stable"]
        case 15...19:
            interp = "Significant — 90-day mortality ~20%"
            risk   = .moderate
            recs   = ["Transplant list assessment — most centres list at MELD ≥15",
                      "Hospitalise for management of hepatic decompensation if present",
                      "TIPS assessment if recurrent variceal bleed or refractory ascites"]
        default:
            interp = "Severe — 90-day mortality >50%"
            risk   = .high
            recs   = ["Urgent transplant listing — MELD ≥25 = active waitlist priority at most centres",
                      "ICU-level monitoring for ACLF / multiorgan dysfunction",
                      "Discuss goals of care if transplant not feasible"]
        }
        return ClinicalScore(
            name:          "MELD 3.0",
            score:         rounded,
            maxScore:      nil,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            evidenceNote:  "Kim WR et al. Hepatology 2021;74:1913–1922. MELD 3.0 adds sex (+1.33 for female), albumin term, and recalibrates coefficients on 280 000+ UNOS patients. Reduces sex disparity in waitlist outcomes vs MELD-Na. Adopted by UNOS/OPTN 2022 for organ allocation. Score ≥15 = transplant listing threshold at most centres."
        )
    }

    // MARK: - #93 Maddrey Discriminant Function (Alcoholic Hepatitis)

    struct MaddreyInput: Equatable {
        var ptSeconds: Double          // patient PT in seconds
        var controlPTSeconds: Double   // control PT in seconds
        var bilirubinMgDL: Double      // serum bilirubin in mg/dL
    }

    static func maddrey(_ i: MaddreyInput) -> ClinicalScore {
        let mdf = 4.6 * (i.ptSeconds - i.controlPTSeconds) + i.bilirubinMgDL
        let risk: ScoreRisk
        let interp: String
        var recs: [String]
        var flags: [String] = []

        if mdf >= 32 {
            risk  = .critical
            interp = "Severe alcoholic hepatitis (mDF \(String(format: "%.1f", mdf))). 28-day mortality 35–45% without treatment."
            recs  = [
                "Consider prednisolone 40 mg/day × 28 days if no contraindications",
                "Reassess with Lille model at day 7 — Lille ≥0.45 indicates steroid non-response",
                "Hepatology / gastroenterology urgent review",
                "Pentoxifylline no longer preferred per recent evidence (STOPAH trial)",
                "N-acetylcysteine as adjunct if renal impairment present",
                "Abstinence counselling and addiction medicine referral",
                "Monitor for hepatorenal syndrome, SBP, hepatic encephalopathy"
            ]
            flags = ["mDF ≥ 32 — high 28-day mortality without corticosteroid therapy"]
        } else if mdf >= 20 {
            risk  = .high
            interp = "Moderately severe alcoholic hepatitis (mDF \(String(format: "%.1f", mdf))). Elevated mortality risk; close monitoring required."
            recs  = [
                "Hepatology review within 24–48 hours",
                "Intensive nutritional support — target 35–40 kcal/kg/day",
                "Strict alcohol cessation",
                "Monitor renal function and coagulation daily"
            ]
        } else {
            risk  = .moderate
            interp = "Mild–moderate alcoholic hepatitis (mDF \(String(format: "%.1f", mdf))). Lower short-term mortality; supportive management."
            recs  = [
                "Alcohol abstinence — cornerstone of management",
                "Nutritional optimisation",
                "Monitor LFTs, coagulation weekly",
                "Hepatology outpatient follow-up within 2 weeks"
            ]
        }

        return ClinicalScore(
            name:          "Maddrey Discriminant Function",
            score:         mdf,
            maxScore:      nil,
            risk:          risk,
            interpretation: interp,
            recommendations: recs,
            redFlags:      flags,
            evidenceNote:  "Maddrey WC et al. Gastroenterology 1978;75:193. Formula: 4.6 × (PT_patient − PT_control) + bilirubin(mg/dL). mDF ≥32 defines severe disease with ≥35% 28-day mortality; the steroid-treatment threshold. STOPAH (NEJM 2015) confirmed prednisolone reduces 28-day mortality for mDF ≥32 but not long-term survival. Lille score at day 7 guides continuation vs. cessation."
        )
    }

}
