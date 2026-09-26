// ClinicalScoringEngine+DecisionRules.swift
// Injury decision rules: Ottawa ankle and foot rules, Ottawa knee rule, Canadian CT head rule,
// NEXUS low-risk criteria and the Canadian C-spine rule (ios-outcomes-calculators, 2026-09-26).
//
// Each mirrors the web calculator of the same rule (artifacts/dashboard/src/lib/decision-rule-scores.ts,
// RULE_SPECS): the same items, the same points and the same recorded value, so the value falls in the
// same band of clinical-content/rules/decision-rules.json on both platforms. Shared vectors:
// ios/AmiseMedFlowTests/Resources/DecisionRuleCalculatorVectors.json (DecisionRuleCalculatorTests.swift
// and the dashboard's decision-rule-vectors.test.ts). The stored value feeds the Bayesian engine as
// the rule's band (DecisionRuleEvidence, `ios` entry in decision-rules.json).
//
// Criteria from the derivation / validation papers (cited per rule). The band likelihood ratios come
// from the shared decision-rules.json (fromMemory until signed off:
// docs/clinical-validation/changes/ios-outcomes-calculators.md). No AI, no network.

import Foundation

extension ClinicalScoringEngine {

    /// The band of a recorded value in the shared decision-rules.json, as one line:
    /// "Ottawa ankle and foot rules: No criterion: X-ray not needed — LR 0.08 (0.03–0.18) for Ankle
    /// or midfoot fracture (value not yet verified against the source)". Nil when the rule file did
    /// not load (the calculator still works; only the evidence line is missing).
    static func decisionRuleLine(_ ruleId: String, value: Double) -> String? {
        guard let rule = ExamEvidenceCatalogue.rule(ruleId),
              let band = DecisionRuleEvidence.band(of: rule, value: value) else { return nil }
        var parts = ["\(rule.name): \(band.label)"]
        if let lr = band.lr { parts.append("LR \(ExamEvidenceCatalogue.format(lr)) for \(rule.target.finding)") }
        if let risk = band.risk { parts.append(risk) }
        var line = parts.joined(separator: " — ")
        if rule.fromMemory { line += " (value not yet verified against the source)" }
        if rule.kind == "prognostic" { line += "; prognostic: it does not change the differential" }
        return line
    }

    static func withRuleLine(_ recs: [String], _ ruleId: String, _ value: Int) -> [String] {
        recs + (decisionRuleLine(ruleId, value: Double(value)).map { ["Decision-rule evidence — \($0)"] } ?? [])
    }

    // MARK: - Ottawa ankle and foot rules

    struct OttawaAnkleInput: Equatable {
        var lateralMalleolus: Bool = false     // bone tenderness, posterior edge or tip of the lateral malleolus (distal 6 cm)
        var medialMalleolus: Bool = false      // bone tenderness, posterior edge or tip of the medial malleolus (distal 6 cm)
        var fifthMetatarsalBase: Bool = false  // bone tenderness at the base of the fifth metatarsal
        var navicular: Bool = false            // bone tenderness at the navicular
        var unableToBearWeight: Bool = false   // unable to take 4 steps both immediately after the injury and in the department
    }

    /// Recorded value: the number of criteria present (0 = no X-ray needed). decision-rules.json
    /// `ottawa-ankle`: 0 negative, 1 or more positive.
    static func ottawaAnkle(_ i: OttawaAnkleInput) -> ClinicalScore {
        let items = [
            ScoredItem(label: "Lateral malleolus bone tenderness", points: 1, present: i.lateralMalleolus),
            ScoredItem(label: "Medial malleolus bone tenderness", points: 1, present: i.medialMalleolus),
            ScoredItem(label: "Base of fifth metatarsal tenderness", points: 1, present: i.fifthMetatarsalBase),
            ScoredItem(label: "Navicular tenderness", points: 1, present: i.navicular),
            ScoredItem(label: "Unable to bear weight (4 steps)", points: 1, present: i.unableToBearWeight),
        ]
        let total = items.filter(\.present).count
        let ankle = i.lateralMalleolus || i.medialMalleolus || i.unableToBearWeight
        let foot = i.fifthMetatarsalBase || i.navicular || i.unableToBearWeight
        let interp: String
        let risk: ScoreRisk
        let recs: [String]
        if total == 0 {
            risk = .low
            interp = "Ottawa ankle rules negative: no criterion present. Ankle and foot X-rays are not needed (sensitivity close to 100 %)."
            recs = ["No X-ray needed on the Ottawa rules; treat as a soft-tissue injury",
                    "Safety-net: review if unable to walk after 5–7 days or pain is not settling"]
        } else {
            risk = .moderate
            let series = [ankle ? "ankle series" : nil, foot ? "foot series" : nil].compactMap { $0 }.joined(separator: " and ")
            interp = "Ottawa ankle rules positive (\(total) criterion\(total == 1 ? "" : "a")): X-ray indicated (\(series)). A positive rule is non-specific: most patients who need an X-ray have no fracture."
            recs = ["X-ray: \(series)"]
        }
        return ClinicalScore(
            name: "Ottawa Ankle and Foot Rules",
            score: Double(total),
            maxScore: 5,
            risk: risk,
            interpretation: interp,
            recommendations: withRuleLine(recs, "ottawa-ankle", total),
            items: items,
            evidenceNote: "Stiell IG et al. JAMA 1993;269:1127-32 (derivation and validation); Bachmann LM et al. BMJ 2003;326:417 (systematic review: sensitivity about 98-100 %). Ankle X-ray if pain in the malleolar zone with tenderness at the posterior edge or tip of either malleolus (distal 6 cm) or inability to bear weight; foot X-ray if pain in the midfoot zone with tenderness at the base of the fifth metatarsal or the navicular or inability to bear weight. Adults (validated in children over 5); not for intoxication, head injury, multiple painful injuries or reduced sensation."
        )
    }

    // MARK: - Ottawa knee rule

    struct OttawaKneeInput: Equatable {
        var age55OrOver: Bool = false
        var isolatedPatellaTenderness: Bool = false
        var fibularHeadTenderness: Bool = false
        var unableToFlex90: Bool = false
        var unableToBearWeight: Bool = false   // 4 steps, both immediately and in the department
    }

    static func ottawaKnee(_ i: OttawaKneeInput) -> ClinicalScore {
        let items = [
            ScoredItem(label: "Age 55 or over", points: 1, present: i.age55OrOver),
            ScoredItem(label: "Isolated tenderness of the patella", points: 1, present: i.isolatedPatellaTenderness),
            ScoredItem(label: "Tenderness of the head of the fibula", points: 1, present: i.fibularHeadTenderness),
            ScoredItem(label: "Unable to flex to 90 degrees", points: 1, present: i.unableToFlex90),
            ScoredItem(label: "Unable to bear weight (4 steps)", points: 1, present: i.unableToBearWeight),
        ]
        let total = items.filter(\.present).count
        let risk: ScoreRisk = total == 0 ? .low : .moderate
        let interp = total == 0
            ? "Ottawa knee rule negative: no criterion present. A knee X-ray is not needed."
            : "Ottawa knee rule positive (\(total) criterion\(total == 1 ? "" : "a")): knee X-ray indicated. A positive rule is non-specific."
        let recs = total == 0
            ? ["No X-ray needed on the Ottawa knee rule; soft-tissue injury management and review if not improving"]
            : ["Knee X-ray (AP and lateral)"]
        return ClinicalScore(
            name: "Ottawa Knee Rule",
            score: Double(total),
            maxScore: 5,
            risk: risk,
            interpretation: interp,
            recommendations: withRuleLine(recs, "ottawa-knee", total),
            items: items,
            evidenceNote: "Stiell IG et al. JAMA 1996;275:611-5 (prospective validation); Bachmann LM et al. Ann Intern Med 2004;140:121-4 (systematic review: sensitivity about 99 %). X-ray after acute knee injury if any of: age 55 or over, isolated patellar tenderness, fibular head tenderness, inability to flex to 90 degrees, inability to bear weight for 4 steps both immediately and in the emergency department. Adults 18 or over."
        )
    }

    // MARK: - Canadian CT head rule

    struct CanadianCTHeadInput: Equatable {
        // High risk (neurosurgical intervention)
        var gcsBelow15At2h: Bool = false
        var suspectedOpenOrDepressedFracture: Bool = false
        var basalSkullFractureSign: Bool = false      // haemotympanum, raccoon eyes, CSF oto/rhinorrhoea, Battle's sign
        var vomitingTwiceOrMore: Bool = false
        var age65OrOver: Bool = false
        // Medium risk (brain injury on CT)
        var amnesiaBefore30min: Bool = false          // retrograde amnesia of 30 minutes or more
        var dangerousMechanism: Bool = false          // pedestrian struck, ejected, fall > 3 ft or 5 stairs
    }

    /// Recorded value (decision-rules.json `canadian-ct-head`): 0 no criterion, 1 medium-risk
    /// criterion only, 2 any high-risk criterion.
    static func canadianCTHeadLevel(_ i: CanadianCTHeadInput) -> Int {
        let high = i.gcsBelow15At2h || i.suspectedOpenOrDepressedFracture || i.basalSkullFractureSign
            || i.vomitingTwiceOrMore || i.age65OrOver
        if high { return 2 }
        return i.amnesiaBefore30min || i.dangerousMechanism ? 1 : 0
    }

    static func canadianCTHead(_ i: CanadianCTHeadInput) -> ClinicalScore {
        let level = canadianCTHeadLevel(i)
        let items = [
            ScoredItem(label: "GCS below 15 two hours after injury (high)", points: 2, present: i.gcsBelow15At2h),
            ScoredItem(label: "Suspected open or depressed skull fracture (high)", points: 2, present: i.suspectedOpenOrDepressedFracture),
            ScoredItem(label: "Any sign of basal skull fracture (high)", points: 2, present: i.basalSkullFractureSign),
            ScoredItem(label: "Vomiting twice or more (high)", points: 2, present: i.vomitingTwiceOrMore),
            ScoredItem(label: "Age 65 or over (high)", points: 2, present: i.age65OrOver),
            ScoredItem(label: "Amnesia 30 minutes or more before impact (medium)", points: 1, present: i.amnesiaBefore30min),
            ScoredItem(label: "Dangerous mechanism (medium)", points: 1, present: i.dangerousMechanism),
        ]
        let risk: ScoreRisk
        let interp: String
        let recs: [String]
        switch level {
        case 2:
            risk = .high
            interp = "Canadian CT head rule: high-risk criterion present (risk of needing neurosurgical intervention). CT head is indicated."
            recs = ["CT head (NICE NG232: within 1 hour for high-risk features)",
                    "Neurological observations; discuss with neurosurgery if CT shows an intracranial injury"]
        case 1:
            risk = .moderate
            interp = "Canadian CT head rule: medium-risk criterion only (risk of brain injury on CT). CT head is indicated."
            recs = ["CT head (NICE NG232: within 8 hours of injury for medium-risk features alone)",
                    "Neurological observations until the scan is reported"]
        default:
            risk = .low
            interp = "Canadian CT head rule: no criterion present. CT head is not required by the rule (applies only to minor head injury, GCS 13–15, with loss of consciousness, amnesia or disorientation)."
            recs = ["No CT on the rule; written head-injury advice with a responsible adult",
                    "The rule does not apply to anticoagulated patients, seizures after injury, age under 16 or GCS below 13: use NICE NG232"]
        }
        return ClinicalScore(
            name: "Canadian CT Head Rule",
            score: Double(level),
            maxScore: 2,
            risk: risk,
            interpretation: interp,
            recommendations: withRuleLine(recs, "canadian-ct-head", level),
            items: items,
            redFlags: level == 2 ? ["High-risk head injury: CT head indicated"] : [],
            evidenceNote: "Stiell IG et al. The Canadian CT Head Rule for patients with minor head injury. Lancet 2001;357:1391-6 (high-risk criteria 100 % sensitive for neurosurgical intervention; with the medium-risk criteria about 98 % for clinically important brain injury). Minor head injury: GCS 13-15 with witnessed loss of consciousness, definite amnesia or witnessed disorientation, age 16 or over, not on anticoagulants, no seizure. Recorded value: 0 none, 1 medium risk only, 2 high risk. NICE NG232 (2023) sets UK imaging criteria."
        )
    }

    // MARK: - NEXUS low-risk criteria (cervical spine)

    struct NEXUSInput: Equatable {
        var midlineTenderness: Bool = false      // posterior midline cervical tenderness
        var focalNeurologicalDeficit: Bool = false
        var alteredAlertness: Bool = false
        var intoxication: Bool = false
        var distractingInjury: Bool = false      // painful distracting injury
    }

    /// Recorded value: the number of low-risk criteria NOT met (0 = no imaging needed).
    static func nexus(_ i: NEXUSInput) -> ClinicalScore {
        let items = [
            ScoredItem(label: "Posterior midline cervical tenderness", points: 1, present: i.midlineTenderness),
            ScoredItem(label: "Focal neurological deficit", points: 1, present: i.focalNeurologicalDeficit),
            ScoredItem(label: "Altered alertness", points: 1, present: i.alteredAlertness),
            ScoredItem(label: "Intoxication", points: 1, present: i.intoxication),
            ScoredItem(label: "Painful distracting injury", points: 1, present: i.distractingInjury),
        ]
        let total = items.filter(\.present).count
        let risk: ScoreRisk = total == 0 ? .low : .moderate
        let interp = total == 0
            ? "NEXUS: all five low-risk criteria met. Cervical spine imaging is not required."
            : "NEXUS: \(total) low-risk criterion\(total == 1 ? "" : "a") not met. Cervical spine imaging is indicated; keep the spine immobilised until cleared."
        let recs = total == 0
            ? ["Clinical clearance of the cervical spine on NEXUS"]
            : ["Cervical spine imaging (CT in adults at high risk; NICE NG232)",
               "Maintain cervical spine immobilisation until imaging is reported"]
        return ClinicalScore(
            name: "NEXUS Cervical Spine Criteria",
            score: Double(total),
            maxScore: 5,
            risk: risk,
            interpretation: interp,
            recommendations: withRuleLine(recs, "nexus", total),
            items: items,
            evidenceNote: "Hoffman JR et al. Validity of a set of clinical criteria to rule out injury to the cervical spine in patients with blunt trauma (NEXUS). NEJM 2000;343:94-9 (34 069 patients; sensitivity 99.6 % for clinically significant injury). Imaging is not needed when there is no posterior midline tenderness, no focal neurological deficit, normal alertness, no intoxication and no painful distracting injury."
        )
    }

    // MARK: - Canadian C-spine rule

    struct CanadianCSpineInput: Equatable {
        // High-risk factors (any → image)
        var age65OrOver: Bool = false
        var dangerousMechanism: Bool = false     // fall ≥ 3 ft / 5 stairs, axial load, high-speed or rollover MVC, ejection, motorised recreational vehicle, bicycle collision
        var paraesthesiaInExtremities: Bool = false
        // Low-risk factor allowing range-of-motion assessment
        var lowRiskFactor: Bool = false          // simple rear-end MVC, sitting in ED, ambulatory at any time, delayed neck pain, no midline tenderness
        var ableToRotate45: Bool = false         // actively rotates 45 degrees left and right
    }

    /// Recorded value (decision-rules.json `canadian-c-spine`): 0 imaging not required (no high-risk
    /// factor, a low-risk factor present and able to rotate 45 degrees), 1 imaging indicated.
    static func canadianCSpineResult(_ i: CanadianCSpineInput) -> Int {
        let high = i.age65OrOver || i.dangerousMechanism || i.paraesthesiaInExtremities
        return high || !i.lowRiskFactor || !i.ableToRotate45 ? 1 : 0
    }

    static func canadianCSpine(_ i: CanadianCSpineInput) -> ClinicalScore {
        let result = canadianCSpineResult(i)
        let high = i.age65OrOver || i.dangerousMechanism || i.paraesthesiaInExtremities
        let items = [
            ScoredItem(label: "Age 65 or over (high risk)", points: 1, present: i.age65OrOver),
            ScoredItem(label: "Dangerous mechanism (high risk)", points: 1, present: i.dangerousMechanism),
            ScoredItem(label: "Paraesthesia in the extremities (high risk)", points: 1, present: i.paraesthesiaInExtremities),
            ScoredItem(label: "A low-risk factor allowing assessment of movement", points: 0, present: i.lowRiskFactor),
            ScoredItem(label: "Able to rotate the neck 45 degrees left and right", points: 0, present: i.ableToRotate45),
        ]
        let interp: String
        if result == 0 {
            interp = "Canadian C-spine rule: no high-risk factor, a low-risk factor present and able to rotate the neck 45 degrees. Imaging is not required."
        } else if high {
            interp = "Canadian C-spine rule: high-risk factor present. Cervical spine imaging is indicated."
        } else if !i.lowRiskFactor {
            interp = "Canadian C-spine rule: no low-risk factor to allow safe assessment of movement. Cervical spine imaging is indicated."
        } else {
            interp = "Canadian C-spine rule: unable to rotate the neck 45 degrees left and right. Cervical spine imaging is indicated."
        }
        let recs = result == 0
            ? ["Clinical clearance of the cervical spine on the Canadian C-spine rule"]
            : ["Cervical spine imaging (CT in adults; NICE NG232)", "Maintain immobilisation until imaging is reported"]
        return ClinicalScore(
            name: "Canadian C-Spine Rule",
            score: Double(result),
            maxScore: 1,
            risk: result == 0 ? .low : .moderate,
            interpretation: interp,
            recommendations: withRuleLine(recs, "canadian-c-spine", result),
            items: items,
            evidenceNote: "Stiell IG et al. The Canadian C-spine rule for radiography in alert and stable trauma patients. JAMA 2001;286:1841-8 (derivation); Stiell IG et al. NEJM 2003;349:2510-8 (validation; more sensitive and specific than NEXUS). Alert (GCS 15), stable adults after blunt trauma with neck pain or a dangerous mechanism. Recorded value: 0 imaging not required, 1 imaging indicated."
        )
    }
}
