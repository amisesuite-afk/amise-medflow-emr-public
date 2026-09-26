// ClinicalScoringEngine+DecisionRules2.swift
// The STONE score for an uncomplicated ureteric stone (Moore et al., BMJ 2014), the San Francisco
// syncope rule and the Canadian syncope risk score (ios-outcomes-calculators, 2026-09-26).
//
// Twins of the web calculators (artifacts/dashboard/src/lib/decision-rule-scores.ts, RULE_SPECS
// `stone`, `sfSyncope`, `canadianSyncope`): same items, points and recorded value; shared vectors in
// ios/AmiseMedFlowTests/Resources/DecisionRuleCalculatorVectors.json. Bands, likelihood ratios and
// risks come from clinical-content/rules/decision-rules.json (fromMemory until signed off). The two
// syncope rules are prognostic: their band is shown and stored, and never changes the differential.
//
// Not the older iOS "Stone CT features" calculator (ClinicalScoringEngine+Screening2.swift, 0–6),
// which is a different, local score.

import Foundation

extension ClinicalScoringEngine {

    // MARK: - STONE score (uncomplicated ureteric stone)

    struct STONEUretericInput: Equatable {
        var male: Bool = false               // Sex: male 2
        var timing: Int = 0                  // Duration of pain: 0 = more than 24 h (0), 1 = 6–24 h (1), 2 = less than 6 h (3)
        var nonBlack: Bool = false           // Origin: non-black 3 (as derived; not validated in Caribbean populations)
        var nausea: Int = 0                  // 0 = none (0), 1 = nausea alone (1), 2 = vomiting (2)
        var haematuria: Bool = false         // Erythrocytes: microscopic or dipstick haematuria 3
    }

    static func stoneUretericPoints(_ i: STONEUretericInput) -> Int {
        let timing = [0, 1, 3][max(0, min(2, i.timing))]
        let nausea = max(0, min(2, i.nausea))
        return (i.male ? 2 : 0) + timing + (i.nonBlack ? 3 : 0) + nausea + (i.haematuria ? 3 : 0)
    }

    static func stoneUreteric(_ i: STONEUretericInput) -> ClinicalScore {
        let total = stoneUretericPoints(i)
        let timingLabels = ["more than 24 h", "6–24 h", "less than 6 h"]
        let nauseaLabels = ["none", "nausea alone", "vomiting"]
        let items = [
            ScoredItem(label: "Male sex", points: 2, present: i.male),
            ScoredItem(label: "Pain \(timingLabels[max(0, min(2, i.timing))])", points: Double([0, 1, 3][max(0, min(2, i.timing))]), present: i.timing > 0),
            ScoredItem(label: "Non-black origin", points: 3, present: i.nonBlack),
            ScoredItem(label: "Nausea / vomiting: \(nauseaLabels[max(0, min(2, i.nausea))])", points: Double(max(0, min(2, i.nausea))), present: i.nausea > 0),
            ScoredItem(label: "Haematuria", points: 3, present: i.haematuria),
        ]
        let risk: ScoreRisk
        let interp: String
        let recs: [String]
        switch total {
        case 10...:
            risk = .high
            interp = "STONE score \(total) (high, 10–13): an uncomplicated ureteric stone is likely (about 89 % in the derivation study); an alternative acute diagnosis was uncommon."
            recs = ["Consider limiting imaging to ultrasound or low-dose CT KUB, as local practice allows",
                    "Look for infection, a solitary kidney or uncontrolled pain: these need urgent urology whatever the score"]
        case 6...9:
            risk = .moderate
            interp = "STONE score \(total) (moderate, 6–9): an uncomplicated ureteric stone is possible (about 51 %)."
            recs = ["CT KUB (unenhanced) to confirm a stone and look for an alternative diagnosis"]
        default:
            risk = .low
            interp = "STONE score \(total) (low, 0–5): a ureteric stone is unlikely (about 10 %); consider other causes of flank pain."
            recs = ["Consider other diagnoses (including aortic aneurysm in older patients, pyelonephritis, biliary or bowel causes)",
                    "Imaging guided by the leading alternative diagnosis"]
        }
        return ClinicalScore(
            name: "STONE Score (Moore 2014)",
            score: Double(total),
            maxScore: 13,
            risk: risk,
            interpretation: interp,
            recommendations: withRuleLine(recs, "stone", total),
            items: items,
            evidenceNote: "Moore CL et al. Derivation and validation of a clinical prediction rule for uncomplicated ureteral stone — the STONE score: retrospective and prospective observational cohort studies. BMJ 2014;348:g2191. Sex (male 2), Timing (pain < 6 h 3, 6-24 h 1, > 24 h 0), Origin (non-black 3), Nausea (nausea alone 1, vomiting 2), Erythrocytes (haematuria 3); 0-13. Low 0-5, moderate 6-9, high 10-13. Derived in the USA in adults with flank pain; the 'origin' item was not validated in Caribbean populations. Not the older local 'Stone CT features' score."
        )
    }

    // MARK: - San Francisco syncope rule (CHESS)

    struct SanFranciscoSyncopeInput: Equatable {
        var congestiveHeartFailure: Bool = false  // history of CHF
        var haematocritBelow30: Bool = false
        var abnormalECG: Bool = false             // non-sinus rhythm or new changes
        var shortnessOfBreath: Bool = false
        var systolicBelow90: Bool = false         // at triage
    }

    /// Recorded value: the number of CHESS criteria present (0 = low risk).
    static func sanFranciscoSyncope(_ i: SanFranciscoSyncopeInput) -> ClinicalScore {
        let items = [
            ScoredItem(label: "History of congestive heart failure", points: 1, present: i.congestiveHeartFailure),
            ScoredItem(label: "Haematocrit below 30 %", points: 1, present: i.haematocritBelow30),
            ScoredItem(label: "Abnormal ECG", points: 1, present: i.abnormalECG),
            ScoredItem(label: "Shortness of breath", points: 1, present: i.shortnessOfBreath),
            ScoredItem(label: "Systolic BP below 90 mmHg at triage", points: 1, present: i.systolicBelow90),
        ]
        let total = items.filter(\.present).count
        let interp = total == 0
            ? "San Francisco syncope rule: no CHESS criterion. Lower risk of a serious outcome within 7 days; the rule is less sensitive in external validation, so clinical judgement and the Canadian syncope risk score still apply."
            : "San Francisco syncope rule: \(total) CHESS criterion\(total == 1 ? "" : "a") present. Higher risk of a serious outcome within 7 days."
        let recs = total == 0
            ? ["ECG and orthostatic observations if not done; safety-net advice"]
            : ["ECG monitoring and senior review; consider admission or observation",
               "Investigate the positive criterion (ECG change, anaemia, heart failure, hypotension)"]
        return ClinicalScore(
            name: "San Francisco Syncope Rule",
            score: Double(total),
            maxScore: 5,
            risk: total == 0 ? .low : .high,
            interpretation: interp,
            recommendations: withRuleLine(recs, "sf-syncope", total),
            items: items,
            evidenceNote: "Quinn JV et al. Derivation of the San Francisco Rule to predict patients with short-term serious outcomes. Ann Emerg Med 2004;43:224-32; Saccone NS et al. Ann Emerg Med 2010 (meta-analysis: sensitivity about 87 %, specificity about 52 %). CHESS: congestive heart failure, haematocrit < 30 %, ECG abnormal, shortness of breath, systolic BP < 90 mmHg. Prognostic: does not change the differential."
        )
    }

    // MARK: - Canadian syncope risk score

    struct CanadianSyncopeInput: Equatable {
        // Clinical evaluation
        var vasovagalPredisposition: Bool = false  // warm crowded place, prolonged standing, fear, emotion, pain: -1
        var heartDisease: Bool = false             // history of heart disease: +1
        var abnormalSystolic: Bool = false         // any systolic BP < 90 or > 180 mmHg: +2
        // Investigations
        var troponinRaised: Bool = false           // > 99th centile: +2
        var abnormalQRSAxis: Bool = false          // < -30 or > 100 degrees: +1
        var qrsOver130: Bool = false               // +1
        var qtcOver480: Bool = false               // +2
        // Diagnosis in the emergency department: 0 neither (0), 1 vasovagal syncope (-2), 2 cardiac syncope (+2)
        var edDiagnosis: Int = 0
    }

    static func canadianSyncopePoints(_ i: CanadianSyncopeInput) -> Int {
        var total = 0
        if i.vasovagalPredisposition { total -= 1 }
        if i.heartDisease { total += 1 }
        if i.abnormalSystolic { total += 2 }
        if i.troponinRaised { total += 2 }
        if i.abnormalQRSAxis { total += 1 }
        if i.qrsOver130 { total += 1 }
        if i.qtcOver480 { total += 2 }
        switch i.edDiagnosis {
        case 1: total -= 2
        case 2: total += 2
        default: break
        }
        return total
    }

    static func canadianSyncope(_ i: CanadianSyncopeInput) -> ClinicalScore {
        let total = canadianSyncopePoints(i)
        let items = [
            ScoredItem(label: "Predisposition to vasovagal symptoms", points: -1, present: i.vasovagalPredisposition),
            ScoredItem(label: "History of heart disease", points: 1, present: i.heartDisease),
            ScoredItem(label: "Any systolic BP below 90 or above 180 mmHg", points: 2, present: i.abnormalSystolic),
            ScoredItem(label: "Troponin above the 99th centile", points: 2, present: i.troponinRaised),
            ScoredItem(label: "Abnormal QRS axis (below -30 or above 100 degrees)", points: 1, present: i.abnormalQRSAxis),
            ScoredItem(label: "QRS duration above 130 ms", points: 1, present: i.qrsOver130),
            ScoredItem(label: "Corrected QT above 480 ms", points: 2, present: i.qtcOver480),
            ScoredItem(label: "Emergency department diagnosis: vasovagal syncope", points: -2, present: i.edDiagnosis == 1),
            ScoredItem(label: "Emergency department diagnosis: cardiac syncope", points: 2, present: i.edDiagnosis == 2),
        ]
        let risk: ScoreRisk
        let category: String
        switch total {
        case ...(-2):
            risk = .low
            category = "very low risk (-3 to -2)"
        case -1...0:
            risk = .low
            category = "low risk (-1 to 0)"
        case 1...3:
            risk = .moderate
            category = "medium risk (1 to 3)"
        case 4...5:
            risk = .high
            category = "high risk (4 to 5)"
        default:
            risk = .critical
            category = "very high risk (6 or more)"
        }
        let recs: [String] = total <= 0
            ? ["Discharge may be considered with safety-net advice if no other concern"]
            : ["Senior review; consider cardiac monitoring and admission or a short-stay pathway",
               "Investigate the contributing findings (ECG intervals, troponin, blood pressure)"]
        return ClinicalScore(
            name: "Canadian Syncope Risk Score",
            score: Double(total),
            maxScore: 11,
            risk: risk,
            interpretation: "Canadian syncope risk score \(total): \(category) of a serious adverse event within 30 days.",
            recommendations: withRuleLine(recs, "canadian-syncope", total),
            items: items,
            evidenceNote: "Thiruganasambandamoorthy V et al. Development of the Canadian Syncope Risk Score to predict serious adverse events after emergency department assessment of syncope. CMAJ 2016;188:E289-98; external validation JAMA Intern Med 2020;180:737-44. Nine items, -3 to 11; categories very low (-3, -2), low (-1, 0), medium (1-3), high (4, 5), very high (6 or more). Adults after syncope, assessed in the emergency department. Prognostic: does not change the differential."
        )
    }
}
