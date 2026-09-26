// ClinicalScoringEngine+Perioperative.swift
// Perioperative / Surgical risk scoring
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {

    // MARK: ASA Physical Status

    static func asa(_ i: ASAInput) -> ClinicalScore {
        let (risk, description, mortality, recs) = asaDetails(i.asaClass)
        let items: [ScoredItem] = [
            .init(label: "ASA Class \(i.asaClass.rawValue): \(description)", points: Double(i.asaClass.rawValue), present: true)
        ]
        return ClinicalScore(
            systemName: "ASA Physical Status Classification",
            abbreviation: "ASA \(i.asaClass.rawValue)",
            score: Double(i.asaClass.rawValue), maxScore: 5,
            risk: risk,
            interpretation: "ASA Class \(i.asaClass.rawValue): \(description). Perioperative mortality ~\(mortality)",
            recommendations: recs, items: items, redFlags: [],
            evidenceNote: "ASA 1963, revised 2020. Widely used for pre-operative risk stratification."
        )
    }

    private static func asaDetails(_ c: ASAInput.ASAClass) -> (ScoreRisk, String, String, [String]) {
        switch c {
        case .i:
            return (.low, "Healthy patient, no systemic disease", "<0.1%",
                    ["Proceed with planned anaesthesia and surgery"])
        case .ii:
            return (.low, "Mild systemic disease — well-controlled DM/HTN, obesity BMI 30–40, mild lung disease, social smoker, pregnancy",
                    "0.2–0.4%",
                    ["Routine pre-op assessment", "Optimise comorbidities pre-operatively"])
        case .iii:
            return (.moderate, "Severe systemic disease — poorly controlled DM/HTN, COPD, morbid obesity, active hepatitis, ESRD on dialysis, Hx MI/CVA/TIA >3 months ago, EF 20–40%",
                    "1.8–4.3%",
                    ["Cardiology / specialist review if not recently seen", "Optimise before elective surgery", "Pre-op ECG, FBC, U&E, LFTs", "Discuss risk/benefit with patient"])
        case .iv:
            return (.high, "Severe systemic disease, constant threat to life — recent MI/CVA/TIA (<3 months), severe valve disease, EF <20%, sepsis, ongoing anticoagulation",
                    "7.8–23%",
                    ["Surgery only if life-saving or essential", "Multi-disciplinary pre-op meeting", "ICU post-op plan", "Detailed informed consent"])
        case .v:
            return (.critical, "Moribund, not expected to survive without surgery — ruptured AAA, massive PE, intracranial bleed with herniation, ischaemic bowel with MOSF",
                    ">50%",
                    ["Emergency surgery only", "Senior surgeon + anaesthetist", "ICU/HDU reserved", "Family/NOK informed of mortality risk"])
        }
    }

    // MARK: - P-POSSUM

    static func ppossum(_ i: PPOSSUMInput) -> ClinicalScore {
        let ps = i.agePhys + i.cardiacSigns + i.respiratoryHx + i.sbpPhys +
                 i.hrPhys + i.gcsPhys + i.haemoglobin + i.wbcPhys +
                 i.urea + i.sodiumPhys + i.potassiumPhys + i.ecg
        let os = i.operativeMagnitude + i.numProcedures + i.bloodLoss +
                 i.peritonealSoiling + i.malignancy + i.urgency

        // P-POSSUM logistic regression (Whiteley et al, Br J Surg 1996)
        let lnOddsMort = -9.065 + (0.1692 * Double(ps)) + (0.1550 * Double(os))
        let predictedMortality = exp(lnOddsMort) / (1.0 + exp(lnOddsMort))
        let mortPct = predictedMortality * 100.0

        // Morbidity estimate (original POSSUM equation)
        let lnOddsMorb = -5.91 + (0.16 * Double(ps)) + (0.19 * Double(os))
        let predictedMorbidity = exp(lnOddsMorb) / (1.0 + exp(lnOddsMorb))
        let morbPct = predictedMorbidity * 100.0

        func si(_ label: String, _ pts: Int) -> ScoredItem {
            ScoredItem(label: label, points: Double(pts), present: pts > 1)
        }
        let items: [ScoredItem] = [
            si("Age", i.agePhys),
            si("Cardiac signs", i.cardiacSigns),
            si("Respiratory history", i.respiratoryHx),
            si("Systolic BP", i.sbpPhys),
            si("Heart rate", i.hrPhys),
            si("GCS", i.gcsPhys),
            si("Haemoglobin", i.haemoglobin),
            si("WBC", i.wbcPhys),
            si("Urea", i.urea),
            si("Sodium", i.sodiumPhys),
            si("Potassium", i.potassiumPhys),
            si("ECG", i.ecg),
            si("Operative magnitude", i.operativeMagnitude),
            si("No. of procedures", i.numProcedures),
            si("Blood loss", i.bloodLoss),
            si("Peritoneal soiling", i.peritonealSoiling),
            si("Malignancy", i.malignancy),
            si("Urgency", i.urgency),
        ]
        let (risk, interpretation, recs, redFlags) = ppossumRisk(mortPct: mortPct, morbPct: morbPct, ps: ps, os: os)
        return ClinicalScore(
            systemName: "P-POSSUM",
            abbreviation: String(format: "Mort %.1f%%", mortPct),
            score: mortPct,
            maxScore: 100,
            risk: risk, interpretation: interpretation,
            recommendations: recs, items: items, redFlags: redFlags,
            evidenceNote: "Whiteley MS et al, Br J Surg 1996. P-POSSUM corrects original POSSUM over-prediction in low-risk patients. Physiological score \(ps), Operative score \(os). Predicted morbidity \(String(format: "%.1f", morbPct))%. Validated across general, vascular, and colorectal surgery."
        )
    }

    private static func ppossumRisk(mortPct: Double, morbPct: Double, ps: Int, os: Int) -> (ScoreRisk, String, [String], [String]) {
        let mortStr = String(format: "%.1f", mortPct)
        let morbStr = String(format: "%.1f", morbPct)
        switch mortPct {
        case ..<2:
            return (.low,
                    "P-POSSUM predicted mortality \(mortStr)% — low surgical risk (PS \(ps), OS \(os))",
                    ["Standard perioperative monitoring",
                     "Document score in operative plan for audit",
                     "Predicted morbidity: \(morbStr)%"],
                    [])
        case 2..<5:
            return (.low,
                    "P-POSSUM predicted mortality \(mortStr)% — low-moderate risk (PS \(ps), OS \(os))",
                    ["Ensure adequate preoperative optimisation",
                     "Discuss risk with patient during consent",
                     "Predicted morbidity: \(morbStr)%"],
                    [])
        case 5..<15:
            return (.moderate,
                    "P-POSSUM predicted mortality \(mortStr)% — moderate risk (PS \(ps), OS \(os))",
                    ["Senior surgeon and anaesthetist involvement",
                     "HDU/critical care bed should be arranged",
                     "Explicit discussion of risk in consent process",
                     "Predicted morbidity: \(morbStr)%"],
                    [])
        case 15..<30:
            return (.high,
                    "P-POSSUM predicted mortality \(mortStr)% — high risk (PS \(ps), OS \(os))",
                    ["Consultant-level surgeon required",
                     "ICU bed must be arranged preoperatively",
                     "Consider further optimisation before elective surgery",
                     "Detailed goals-of-care discussion with patient and family",
                     "Predicted morbidity: \(morbStr)%"],
                    ["P-POSSUM mortality ≥15% — high operative risk: ICU bed required"])
        default: // ≥30%
            return (.critical,
                    "P-POSSUM predicted mortality \(mortStr)% — very high risk (PS \(ps), OS \(os))",
                    ["Multi-disciplinary team review before proceeding",
                     "Weigh operative benefit against predicted mortality",
                     "Formal goals-of-care and advance directive discussion",
                     "ICU care essential",
                     "Consider non-operative management if appropriate",
                     "Predicted morbidity: \(morbStr)%"],
                    ["P-POSSUM mortality ≥30% — critical operative risk: MDT review required"])
        }
    }

    // MARK: - Barthel Index (ADL Functional Independence)

    static func barthel(_ i: BarthelInput) -> ClinicalScore {
        // Items and valid point values:
        // feeding: 0, 5, 10  bathing: 0, 5  grooming: 0, 5  dressing: 0, 5, 10
        // bowels: 0, 5, 10   bladder: 0, 5, 10  toiletUse: 0, 5, 10
        // transfers: 0, 5, 10, 15   mobility: 0, 5, 10, 15   stairs: 0, 5, 10
        let total = i.feeding + i.bathing + i.grooming + i.dressing +
                    i.bowels + i.bladder + i.toiletUse +
                    i.transfers + i.mobility + i.stairs

        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case 0...20:
            (.high, "Severe functional dependency — total score \(total)/100",
             ["Urgent occupational therapy and physiotherapy assessment",
              "High-dependency care: pressure area care, continence support, assisted feeding",
              "Consider inpatient rehabilitation or care facility placement",
              "Full nursing dependency plan; regular functional reassessment",
              "Screen for delirium, depression, and social support needs"],
             ["Barthel ≤20 — severe dependency; high nursing and care needs; inpatient or institutional care may be required"])
        case 21...60:
            (.moderate, "Moderate functional dependency — score \(total)/100",
             ["Physiotherapy and occupational therapy referral for rehabilitation programme",
              "Assistive device assessment (walking aids, grab rails, bath seat)",
              "Discharge planning: community care needs assessment",
              "Falls risk assessment; structured ADL rehabilitation",
              "Social work review if home support inadequate"],
             [])
        case 61...90:
            (.low, "Mild functional dependency — score \(total)/100",
             ["Occupational therapy home assessment before discharge",
              "Identify specific ADL deficits and target with rehabilitation",
              "Consider community physiotherapy or outpatient rehabilitation",
              "Review home safety and carer support needs"],
             [])
        default:
            (.low, "Functionally independent — score \(total)/100",
             ["Standard discharge planning; no specific ADL support required",
              "Reassess if functional decline develops post-operatively or during admission"],
             [])
        }

        let items: [ScoredItem] = [
            ScoredItem(label: "Feeding (\(["0 — unable","5 — needs help","10 — independent"][min(i.feeding/5, 2)]))", points: Double(i.feeding), present: i.feeding > 0),
            ScoredItem(label: "Bathing (\(i.bathing == 0 ? "0 — dependent" : "5 — independent"))", points: Double(i.bathing), present: i.bathing > 0),
            ScoredItem(label: "Grooming (\(i.grooming == 0 ? "0 — dependent" : "5 — independent"))", points: Double(i.grooming), present: i.grooming > 0),
            ScoredItem(label: "Dressing (\(["0 — dependent","5 — needs help","10 — independent"][min(i.dressing/5, 2)]))", points: Double(i.dressing), present: i.dressing > 0),
            ScoredItem(label: "Bowel control (\(["0 — incontinent","5 — occasional accident","10 — continent"][min(i.bowels/5, 2)]))", points: Double(i.bowels), present: i.bowels > 0),
            ScoredItem(label: "Bladder control (\(["0 — incontinent","5 — occasional accident","10 — continent"][min(i.bladder/5, 2)]))", points: Double(i.bladder), present: i.bladder > 0),
            ScoredItem(label: "Toilet use (\(["0 — dependent","5 — needs help","10 — independent"][min(i.toiletUse/5, 2)]))", points: Double(i.toiletUse), present: i.toiletUse > 0),
            ScoredItem(label: "Transfers bed-chair (\(["0 — unable","5 — major help","10 — minor help","15 — independent"][min(i.transfers/5, 3)]))", points: Double(i.transfers), present: i.transfers > 0),
            ScoredItem(label: "Mobility (\(["0 — immobile","5 — wheelchair","10 — walks with help","15 — independent"][min(i.mobility/5, 3)]))", points: Double(i.mobility), present: i.mobility > 0),
            ScoredItem(label: "Stairs (\(["0 — unable","5 — needs help","10 — independent"][min(i.stairs/5, 2)]))", points: Double(i.stairs), present: i.stairs > 0)
        ]

        return ClinicalScore(
            systemName: "Barthel Index",
            abbreviation: "BI",
            score: Double(total), maxScore: 100,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Mahoney FI, Barthel DW. Maryland State Med J 1965;14:61–65. Collin C et al. Disabil Rehabil 1988;10:63–67."
        )
    }

}
