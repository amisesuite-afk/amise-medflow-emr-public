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

    // MARK: - NRS-2002 (Nutritional Risk Screening 2002)

    static func nrs2002(_ i: NRS2002Input) -> ClinicalScore {
        let total = i.nutritionalStatus + i.diseaseSeverity + (i.ageOver70 ? 1 : 0)
        let (risk, interp, recs, flags) = nrs2002Risk(total)
        let nsLabels = ["0 — Normal nutritional status",
                        "1 — Mild: weight loss 5–10% in 3 months, or intake 50–75% of requirement",
                        "2 — Moderate: weight loss 5% in 2 months, or BMI 18.5–20.5 with impaired general condition, or intake 25–60%",
                        "3 — Severe: weight loss >5% in 1 month / >15% in 3 months, BMI <18.5, or intake <25%"]
        let dsLabels = ["0 — No disease",
                        "1 — Minor stress: hip fracture, chronic disease with complications, chemotherapy",
                        "2 — Moderate stress: major abdominal surgery, stroke, haematological malignancy, ICU APACHE <10",
                        "3 — Severe stress: head injury, bone marrow transplant, ICU APACHE ≥10"]
        var items: [ScoredItem] = []
        items.append(ScoredItem(
            label: i.nutritionalStatus < nsLabels.count ? nsLabels[i.nutritionalStatus] : "Nutritional status \(i.nutritionalStatus)",
            points: Double(i.nutritionalStatus), present: i.nutritionalStatus > 0))
        items.append(ScoredItem(
            label: i.diseaseSeverity < dsLabels.count ? dsLabels[i.diseaseSeverity] : "Disease severity \(i.diseaseSeverity)",
            points: Double(i.diseaseSeverity), present: i.diseaseSeverity > 0))
        items.append(ScoredItem(label: "Age ≥70 years", points: 1, present: i.ageOver70))
        return ClinicalScore(
            systemName: "NRS-2002",
            abbreviation: "NRS \(total)",
            score: Double(total), maxScore: 7,
            risk: risk,
            interpretation: interp,
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Kondrup J et al. Clin Nutr 2003; 22:415–421. Validated in 128 RCTs."
        )
    }

    private static func nrs2002Risk(_ s: Int) -> (ScoreRisk, String, [String], [String]) {
        if s < 3 {
            return (.low, "Not at nutritional risk (score \(s))",
                    ["Routine dietary intake; re-screen weekly if inpatient",
                     "Document baseline weight and BMI",
                     "Re-screen if clinical condition deteriorates"],
                    [])
        } else if s < 5 {
            return (.moderate, "Nutritional risk (score \(s)) — intervention indicated",
                    ["Refer to dietitian for formal nutritional assessment within 24–48 h",
                     "Set individualised nutritional goals (25–35 kcal/kg/day; 1.2–1.5 g protein/kg/day)",
                     "Oral nutritional supplements or enhanced catering as first-line",
                     "Consider enteral nutrition if oral intake insufficient",
                     "Monitor weight, biochemistry (electrolytes, albumin, pre-albumin) regularly"],
                    [])
        } else {
            return (.high, "High nutritional risk (score \(s)) — urgent intervention",
                    ["Immediate dietitian review",
                     "Initiate nutritional support within 24 h; enteral route preferred",
                     "Parenteral nutrition only if enteral route is not feasible",
                     "Monitor for refeeding syndrome: check and correct phosphate, potassium, magnesium",
                     "Weekly formal reassessment; optimise pre-operatively if elective surgery planned"],
                    ["NRS-2002 ≥5 — high risk of peri-operative complications; discuss with nutrition team before surgery"])
        }
    }

    private static func ctsiRisk(_ s: Int) -> (ScoreRisk, String, [String], [String]) {
        switch s {
        case ..<4:
            return (.low, "Mild — CTSI \(s): low complication risk",
                    ["Supportive management; CT surveillance not routinely required",
                     "Oral nutrition as tolerated",
                     "Monitor for clinical deterioration"],
                    [])
        case 4..<7:
            return (.moderate, "Moderate — CTSI \(s): ~30–50% complication rate",
                    ["HDU monitoring; NPO + IV fluids",
                     "Repeat CT at 48–72 h if not improving clinically",
                     "Surgical / HPB team review",
                     "Consider percutaneous drainage if fluid collection enlarges"],
                    [])
        default:
            return (.critical, "Severe — CTSI \(s): ~50–90% complication rate",
                    ["ICU-level care",
                     "Multi-disciplinary HPB / intensive-care team",
                     "Percutaneous or endoscopic drainage of necrotic collections",
                     "Delayed surgical debridement (step-up approach preferred)",
                     "Parenteral or jejunal nutrition support"],
                    ["CTSI ≥7 — predicted mortality 17%+ and complication rate >50%"])
        }
    }

    // MARK: - Clavien-Dindo Classification (Surgical Complication Grading)

    struct ClavienDindoInput: Equatable {
        // 0=None, 1=Grade I, 2=Grade II, 3=Grade IIIa, 4=Grade IIIb,
        // 5=Grade IVa, 6=Grade IVb, 7=Grade V
        var grade: Int = 0
    }

    static func clavienDindo(_ i: ClavienDindoInput) -> ClinicalScore {
        let gradeStrings = ["None", "I", "II", "IIIa", "IIIb", "IVa", "IVb", "V"]
        let gradeStr = i.grade < gradeStrings.count ? gradeStrings[i.grade] : "?"
        let risk: ScoreRisk
        let interpretation: String
        var recs: [String] = []
        var flags: [String] = []

        switch i.grade {
        case 0:
            risk = .low
            interpretation = "No complication — uneventful postoperative course"
        case 1:
            risk = .low
            interpretation = "Grade I — Minor deviation; bedside management only"
            recs = ["Antiemetics, antipyretics, analgesia, diuretics, or electrolytes as needed",
                    "Physiotherapy permitted",
                    "Wound drainage at bedside is included in this grade"]
        case 2:
            risk = .moderate
            interpretation = "Grade II — Pharmacological treatment beyond Grade I allowances"
            recs = ["Blood transfusion or total parenteral nutrition if indicated",
                    "Antimicrobials for organ-space infection",
                    "Document drug name, dose, and indication"]
            flags = ["Complication requiring drug therapy beyond simple analgesia/antiemetic"]
        case 3:
            risk = .high
            interpretation = "Grade IIIa — Surgical/endoscopic/radiological intervention; no general anaesthesia"
            recs = ["Proceed to indicated intervention under local/regional anaesthesia",
                    "Obtain informed consent; document indication and technique",
                    "Radiological drainage, bedside washout, or flexible endoscopy as appropriate"]
            flags = ["Procedural intervention required (no GA)"]
        case 4:
            risk = .high
            interpretation = "Grade IIIb — Surgical/endoscopic/radiological intervention; general anaesthesia"
            recs = ["Return to theatre or interventional suite under GA",
                    "Anaesthetic review and pre-operative optimisation",
                    "Inform next of kin; consent for return to theatre"]
            flags = ["Return to theatre required — GA", "Anaesthetic review needed"]
        case 5:
            risk = .critical
            interpretation = "Grade IVa — Life-threatening complication; single organ dysfunction"
            recs = ["Immediate ICU admission",
                    "Single organ support (e.g. renal replacement, mechanical ventilation)",
                    "Senior surgeon and intensivist co-management",
                    "Daily MDT review; family meeting within 24 h"]
            flags = ["Life-threatening — ICU required", "Single organ failure"]
        case 6:
            risk = .critical
            interpretation = "Grade IVb — Life-threatening complication; multiorgan dysfunction"
            recs = ["Immediate ICU admission with multiorgan support",
                    "Senior surgeon, intensivist, and relevant specialist co-management",
                    "Consider goals-of-care discussion with family",
                    "Daily MDT review; detailed documentation of trajectory"]
            flags = ["Life-threatening — ICU required", "Multiorgan failure", "Consider goals-of-care discussion"]
        default:
            risk = .critical
            interpretation = "Grade V — Death"
            recs = ["Complete incident documentation and mortality review",
                    "M&M case registration",
                    "Coroner notification per local jurisdiction if required"]
            flags = ["Fatal complication — mortality review mandatory"]
        }

        return ClinicalScore(
            systemName: "Clavien-Dindo Classification",
            abbreviation: "Clavien-Dindo \(gradeStr)",
            score: Double(i.grade), maxScore: 7,
            risk: risk,
            interpretation: interpretation,
            recommendations: recs,
            items: [ScoredItem(label: "Complication grade: \(gradeStr)", points: Double(i.grade), present: i.grade > 0)],
            redFlags: flags,
            evidenceNote: "Dindo D, Demartines N, Clavien PA. Ann Surg 2004;240:205–213. Dindo D et al. World J Surg 2010. Standard surgical complication classification used in ACS NSQIP and ESCP audits."
        )
    }

    // MARK: - Modified Aldrete Recovery Score (PACU Discharge Readiness)

    struct AldreteInput: Equatable {
        var activity: Int = 0       // 0=No movement; 1=Moves 2 limbs; 2=Moves all limbs
        var respiration: Int = 0    // 0=Apnoeic; 1=Dyspnoea/shallow; 2=Deep/coughs freely
        var circulation: Int = 0    // 0=BP >±50 mmHg pre-op; 1=±20–50 mmHg; 2=±20 mmHg
        var consciousness: Int = 0  // 0=Unresponsive; 1=Arousable on calling; 2=Fully awake
        var oxygenSat: Int = 0      // 0=<90% on O₂; 1=Needs O₂ to maintain ≥90%; 2=≥92% RA
    }

    static func aldrete(_ i: AldreteInput) -> ClinicalScore {
        let total = i.activity + i.respiration + i.circulation + i.consciousness + i.oxygenSat
        let risk: ScoreRisk
        let interpretation: String
        var recs: [String]
        var flags: [String] = []

        switch total {
        case 9...10:
            risk = .low
            interpretation = "Score \(total)/10 — Fit for discharge from PACU"
            recs = ["Transfer to ward when pain and nausea controlled",
                    "Confirm vital signs stable ≥15 min before transfer",
                    "Hand over written PACU summary to ward nurse"]
        case 7..<9:
            risk = .moderate
            interpretation = "Score \(total)/10 — Continued PACU observation; reassess in 30 min"
            recs = ["Identify and address limiting parameters",
                    "Oxygen supplementation if SpO₂ <92% on air",
                    "Anti-emetics and analgesia as required",
                    "Anaesthetist review if score not improving at 60 min"]
        default:
            risk = .high
            interpretation = "Score \(total)/10 — Not fit for transfer; active management required"
            recs = ["Ongoing PACU monitoring with anaesthetist review",
                    "Active management of circulatory, respiratory, or neurological deficiencies",
                    "Consider ICU/HDU referral if score ≤4 or not improving"]
            if i.circulation == 0 { flags.append("Haemodynamic instability — BP >50 mmHg from baseline") }
            if i.respiration == 0 { flags.append("Apnoea — airway management required") }
            if i.consciousness == 0 { flags.append("Unresponsive — anaesthetic review urgent") }
            if i.oxygenSat == 0    { flags.append("Hypoxaemia on supplemental O₂") }
        }

        return ClinicalScore(
            systemName: "Modified Aldrete Recovery Score",
            abbreviation: "Aldrete \(total)/10",
            score: Double(total), maxScore: 10,
            risk: risk,
            interpretation: interpretation,
            recommendations: recs,
            items: [
                ScoredItem(label: "Activity",          points: Double(i.activity),      present: i.activity > 0),
                ScoredItem(label: "Respiration",       points: Double(i.respiration),   present: i.respiration > 0),
                ScoredItem(label: "Circulation",       points: Double(i.circulation),   present: i.circulation > 0),
                ScoredItem(label: "Consciousness",     points: Double(i.consciousness), present: i.consciousness > 0),
                ScoredItem(label: "Oxygen saturation", points: Double(i.oxygenSat),     present: i.oxygenSat > 0)
            ],
            redFlags: flags,
            evidenceNote: "Aldrete JA, Kroulik D. Anesth Analg 1970;49:924–934. Aldrete JA. J Clin Anesth 1995;7:89–91 (modified). Score ≥9/10 = fit for PACU discharge."
        )
    }

    // MARK: - ECOG / WHO Performance Status
    struct ECOGInput: Equatable {
        var grade: Int = 0   // 0=fully active; 1=restricted; 2=ambulatory/self-care; 3=limited; 4=bedbound
    }

    static func ecog(_ i: ECOGInput) -> ClinicalScore {
        let g = min(max(i.grade, 0), 4)
        let (risk, desc): (ScoreRisk, String)
        switch g {
        case 0: (risk, desc) = (.low,      "ECOG 0 — Fully active. No restriction on pre-illness activities. Fit for all treatment modalities.")
        case 1: (risk, desc) = (.low,      "ECOG 1 — Restricted in strenuous activity; ambulatory and capable of light work. Fit for most therapies.")
        case 2: (risk, desc) = (.moderate, "ECOG 2 — Ambulatory; capable of all self-care but unable to work. Up >50% of waking hours. Reduced tolerance for aggressive therapy.")
        case 3: (risk, desc) = (.high,     "ECOG 3 — Limited self-care. Confined to bed or chair >50% of waking hours. Palliative intent typically favoured.")
        default:(risk, desc) = (.high,     "ECOG 4 — Completely disabled. No self-care. Entirely confined to bed or chair. Surgery extremely high-risk.")
        }
        let flags: [String] = g >= 3 ? ["ECOG ≥3: major elective surgery carries prohibitive risk — multidisciplinary team discussion essential"] :
                              g >= 2 ? ["ECOG 2: reduced surgical fitness — optimise before elective procedures"] : []
        return ClinicalScore(
            systemName: "ECOG Performance Status",
            abbreviation: "ECOG \(g)",
            score: Double(g),
            maxScore: 4,
            risk: risk,
            interpretation: desc,
            recommendations: g >= 3 ? [
                "Multidisciplinary team discussion before any elective surgery",
                "Palliative intent should be considered as primary management approach",
                "Nutritional support and rehabilitation assessment recommended"
            ] : g >= 2 ? [
                "Anaesthetic pre-assessment and cardiopulmonary exercise testing (CPET) if surgery planned",
                "Pre-operative optimisation: nutrition, physiotherapy, anaemia treatment",
                "Consider less invasive surgical approaches (laparoscopic, endoscopic)"
            ] : [
                "Standard pre-operative assessment",
                "Document baseline functional status in surgical consent documentation"
            ],
            items: [ScoredItem(label: "Performance grade \(g)", points: Double(g), present: true)],
            redFlags: flags,
            evidenceNote: "Oken MM et al. Am J Clin Oncol 1982;5:649–655. WHO/Eastern Cooperative Oncology Group. Standard metric for functional reserve in oncology and surgical fitness."
        )
    }

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
