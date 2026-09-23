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

    // MARK: - Waterlow Pressure Ulcer Risk

    static func waterlow(_ i: WaterlowInput) -> ClinicalScore {
        var total = i.buildWeight + i.skinType + i.sexAge + i.mobility + i.continence + i.appetite
        if i.tissuemalnutrition { total += 8 }
        if i.neurologicalDeficit { total += 5 }
        if i.majorSurgery { total += 5 }
        if i.onCytotoxics { total += 4 }

        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case 0...9:
            (.low, "Low risk — no pressure ulcer prevention beyond standard care",
             ["Routine skin inspection and repositioning per ward protocol",
              "Ensure adequate hydration and nutrition",
              "Document baseline skin assessment on admission"],
             [])
        case 10...14:
            (.moderate, "At risk — implement preventive measures",
             ["2-hourly repositioning or use of pressure-redistributing mattress",
              "Daily skin inspection; document any redness or skin changes",
              "Nutritional assessment; consider dietitian referral",
              "Heel protection device if bedbound",
              "Educate patient and carers about pressure ulcer prevention"],
             [])
        case 15...19:
            (.high, "High risk — active prevention protocol required",
             ["High-specification foam or dynamic (alternating pressure) mattress",
              "1–2 hourly repositioning or continuous pressure relief",
              "Heel offloading device; consider barrier cream",
              "Formal nutritional assessment; nutritional supplements if depleted",
              "Daily wound care nurse or tissue viability nurse review",
              "Document wound care plan in nursing records"],
             ["High pressure ulcer risk — tissue viability nurse review recommended"])
        default:
            (.critical, "Very high risk — tissue viability nurse involvement essential",
             ["Dynamic high-specification mattress or air-fluidised bed",
              "Maximum pressure redistribution; skin inspection with every repositioning",
              "Tissue viability nurse referral immediately",
              "Optimise nutrition (consider NG or parenteral if oral inadequate)",
              "Daily formal wound assessment; photograph any skin changes",
              "Consider specialist wound care products (foam, hydrocolloid, silicone)"],
             ["Very high pressure ulcer risk — TVN referral; specialist mattress required"])
        }

        let items: [ScoredItem] = [
            ScoredItem(label: "Build/Weight", points: Double(i.buildWeight), present: i.buildWeight > 0),
            ScoredItem(label: "Skin type", points: Double(i.skinType), present: i.skinType > 0),
            ScoredItem(label: "Sex/Age", points: Double(i.sexAge), present: i.sexAge > 0),
            ScoredItem(label: "Mobility", points: Double(i.mobility), present: i.mobility > 0),
            ScoredItem(label: "Continence", points: Double(i.continence), present: i.continence > 0),
            ScoredItem(label: "Appetite", points: Double(i.appetite), present: i.appetite > 0),
            ScoredItem(label: "Tissue malnutrition / cachexia", points: 8, present: i.tissuemalnutrition),
            ScoredItem(label: "Neurological deficit", points: 5, present: i.neurologicalDeficit),
            ScoredItem(label: "Major surgery / trauma", points: 5, present: i.majorSurgery),
            ScoredItem(label: "Cytotoxics / high-dose steroids", points: 4, present: i.onCytotoxics)
        ]

        return ClinicalScore(
            systemName: "Waterlow Pressure Ulcer Risk",
            abbreviation: "Waterlow",
            score: Double(total), maxScore: 64,
            risk: risk,
            interpretation: "Waterlow \(total) — \(interp)",
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Waterlow J. Nursing Times 1985;81:49–55. Waterlow J. Nursing Times 2005;101:62–66 (revised card)."
        )
    }

    // MARK: - Clinical Frailty Scale

    static func clinicalFrailty(_ i: ClinicalFrailtyInput) -> ClinicalScore {
        struct CFSData {
            let label: String; let risk: ScoreRisk
            let interp: String; let recs: [String]; let flags: [String]
        }
        let table: [Int: CFSData] = [
            1: CFSData(label: "1 — Very Fit", risk: .low,
                interp: "Robust, active, energetic, well-motivated; regular exercise; among the fittest for age",
                recs: ["Standard surgical risk; no frailty-related pre-operative optimisation required"],
                flags: []),
            2: CFSData(label: "2 — Fit", risk: .low,
                interp: "No active disease symptoms; less fit than CFS 1; exercises or is very active occasionally",
                recs: ["Standard surgical risk; encourage pre-operative exercise optimisation"],
                flags: []),
            3: CFSData(label: "3 — Managing Well", risk: .low,
                interp: "Medical problems well controlled but not regularly active beyond routine walking",
                recs: ["Low frailty surgical risk; encourage pre-operative physical activity",
                       "Ensure chronic conditions optimised before elective surgery"],
                flags: []),
            4: CFSData(label: "4 — Vulnerable", risk: .moderate,
                interp: "Not dependent on others for daily activities but symptoms limit activity; often complains of being slowed down or tired",
                recs: ["Frailty increases perioperative risk — consider comprehensive pre-operative assessment",
                       "Geriatric medicine input for elective surgery",
                       "Optimise nutrition, anaemia, and functional capacity before operation"],
                flags: []),
            5: CFSData(label: "5 — Mildly Frail", risk: .moderate,
                interp: "Evident slowing; depends on others for high-order IADLs (finances, transport, heavy housework, medications)",
                recs: ["Mildly frail — geriatric medicine review recommended",
                       "Shared decision-making discussion: risks vs benefits of surgery",
                       "Prehabilitation programme if time allows",
                       "Enhanced recovery pathway with early physio and dietitian input"],
                flags: ["Mild frailty — perioperative complication and mortality risk elevated"]),
            6: CFSData(label: "6 — Moderately Frail", risk: .high,
                interp: "Help needed with all outside activities and housekeeping; indoors assistance with bathing or dressing",
                recs: ["Moderately frail — senior surgical and geriatric medicine joint review required",
                       "Careful shared decision-making; consider non-operative management where feasible",
                       "If proceeding: enhanced perioperative care, delirium prevention bundle, early HDU",
                       "Involve family/carers in consent process and post-discharge planning",
                       "Nutritional support and prehabilitation"],
                flags: ["Moderate frailty — significantly increased perioperative mortality and morbidity",
                        "Discuss goals of care and ceiling of treatment before proceeding"]),
            7: CFSData(label: "7 — Severely Frail", risk: .critical,
                interp: "Completely dependent for personal care from whatever cause (physical or cognitive); stable, not at high risk of dying within 6 months",
                recs: ["Severely frail — surgery carries very high risk; consider conservative management",
                       "Multidisciplinary review including geriatrics, palliative care if appropriate",
                       "Goals-of-care discussion mandatory before any intervention",
                       "If surgery unavoidable: single-stage minimal-access approach preferred"],
                flags: ["Severe frailty — very high perioperative mortality risk",
                        "Goals-of-care and ceiling-of-treatment discussion mandatory"]),
            8: CFSData(label: "8 — Very Severely Frail", risk: .critical,
                interp: "Completely dependent, approaching end of life; could not recover even from a minor illness",
                recs: ["Surgery very unlikely to confer benefit; palliative/comfort care discussion",
                       "Palliative care team involvement recommended"],
                flags: ["Very severe frailty — surgery unlikely to be appropriate; palliative care review"]),
            9: CFSData(label: "9 — Terminally Ill", risk: .critical,
                interp: "Life expectancy <6 months; not otherwise evidently frail",
                recs: ["Palliative and end-of-life care; surgical intervention not appropriate except for symptom control"],
                flags: ["Terminal illness — surgical intervention not appropriate except for palliative symptom relief"])
        ]
        let data = table[i.level] ?? table[1]!
        let items: [ScoredItem] = [
            ScoredItem(label: data.label, points: Double(i.level), present: true)
        ]
        return ClinicalScore(
            systemName: "Clinical Frailty Scale",
            abbreviation: "CFS \(i.level)",
            score: Double(i.level), maxScore: 9,
            risk: data.risk,
            interpretation: "\(data.label) — \(data.interp)",
            recommendations: data.recs,
            items: items,
            redFlags: data.flags,
            evidenceNote: "Rockwood K et al. CMAJ 2005;173:489–495. Rockwood K & Theou O. Lancet 2019;394:1651–1652."
        )
    }

    // MARK: - Mallampati Classification (airway)

    static func mallampati(_ i: MallampatiInput) -> ClinicalScore {
        // Modified Mallampati class I–IV: higher class = greater predicted difficulty
        let classLabel: String
        let baseRisk: ScoreRisk
        switch i.mallampatiClass {
        case 1:
            classLabel = "Class I — Soft palate, uvula, tonsillar pillars visible"; baseRisk = .low
        case 2:
            classLabel = "Class II — Soft palate and uvula visible (pillars obscured)"; baseRisk = .low
        case 3:
            classLabel = "Class III — Only soft palate and base of uvula visible"; baseRisk = .moderate
        default:
            classLabel = "Class IV — Soft palate not visible (hard palate only)"; baseRisk = .high
        }

        // Each additional predictor elevates overall risk
        var additionalPredictors = 0
        if i.mouthOpening   { additionalPredictors += 1 }
        if i.neckMobility   { additionalPredictors += 1 }
        if i.thyromental    { additionalPredictors += 1 }
        if i.retrognathia   { additionalPredictors += 1 }
        if i.obesity        { additionalPredictors += 1 }
        if i.beardOrDentures { additionalPredictors += 1 }

        let finalRisk: ScoreRisk
        if baseRisk == .high || (baseRisk == .moderate && additionalPredictors >= 1) || additionalPredictors >= 3 {
            finalRisk = .high
        } else if baseRisk == .moderate || additionalPredictors >= 1 {
            finalRisk = .moderate
        } else {
            finalRisk = .low
        }

        let difficultyDesc: String
        switch finalRisk {
        case .high:     difficultyDesc = "anticipated difficult airway — senior anaesthetic input essential"
        case .moderate: difficultyDesc = "potentially difficult airway — plan for airway management alternatives"
        default:        difficultyDesc = "likely straightforward airway — standard precautions"
        }

        var recs: [String] = ["Document airway assessment formally in anaesthetic pre-assessment"]
        switch finalRisk {
        case .high:
            recs += ["Discuss with senior anaesthetist before induction",
                     "Consider awake fibreoptic intubation or video laryngoscopy as primary plan",
                     "Ensure difficult airway trolley immediately available",
                     "Mark airway as difficult in patient record and wristband if required",
                     "Surgical airway standby (front-of-neck access) for cannot-intubate-cannot-oxygenate scenario"]
        case .moderate:
            recs += ["Video laryngoscopy as first-line or standby",
                     "Second anaesthetist/assistant available at induction",
                     "Pre-oxygenate for ≥3 min; consider ramp positioning",
                     "Difficult airway trolley in room"]
        default:
            recs += ["Standard pre-oxygenation; direct laryngoscopy anticipated to be straightforward",
                     "Difficult airway trolley available in department per standard protocol"]
        }

        var flags: [String] = []
        if i.mallampatiClass >= 3 { flags.append("Mallampati class \(i.mallampatiClass) — senior anaesthetic input required") }
        if additionalPredictors >= 2 { flags.append("\(additionalPredictors) additional airway predictors — combined difficult airway risk significantly elevated") }

        let items: [ScoredItem] = [
            ScoredItem(label: classLabel, points: Double(i.mallampatiClass), present: true),
            ScoredItem(label: "Reduced mouth opening", points: 1, present: i.mouthOpening),
            ScoredItem(label: "Restricted neck mobility", points: 1, present: i.neckMobility),
            ScoredItem(label: "Short thyromental distance", points: 1, present: i.thyromental),
            ScoredItem(label: "Retrognathia / micrognathia", points: 1, present: i.retrognathia),
            ScoredItem(label: "Obesity / large neck", points: 1, present: i.obesity),
            ScoredItem(label: "Beard or poorly-fitting dentures", points: 1, present: i.beardOrDentures)
        ]

        return ClinicalScore(
            systemName: "Mallampati Airway Classification",
            abbreviation: "Class \(["I","II","III","IV"][max(0,i.mallampatiClass-1)])",
            score: Double(i.mallampatiClass + additionalPredictors), maxScore: 10,
            risk: finalRisk,
            interpretation: "\(classLabel); \(additionalPredictors) additional predictor(s) — \(difficultyDesc)",
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Mallampati SR et al. Can Anaesth Soc J 1985;32:429–434. Samsoon GL & Young JR. Anaesthesia 1987;42:487–490."
        )
    }

}
