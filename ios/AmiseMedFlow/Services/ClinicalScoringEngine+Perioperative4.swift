// ClinicalScoringEngine+Perioperative4.swift
// Waterlow pressure ulcer risk, Clinical Frailty Scale, and Mallampati Classification.

import Foundation


extension ClinicalScoringEngine {

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
