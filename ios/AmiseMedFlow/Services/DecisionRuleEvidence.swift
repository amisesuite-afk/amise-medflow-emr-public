// DecisionRuleEvidence.swift
// Decision-rule bands as Bayesian evidence on iOS (evidence-exam 1.0.0).
//
// A diagnostic rule whose result is stored on the patient (Alvarado, AIR, Wells PE, PERC,
// Wells DVT, HEART, Centor/McIsaac, LRINEC — the ones with an `ios` entry in
// clinical-content/rules/decision-rules.json) becomes a DiagnosticDatabase.json 2.2.0 "rule" feature,
// value "<rule id>:<band id>", with the band's likelihood ratio (logLR = round(5 × ln LR)).
// Policy (decision-rules.json evidencePolicy):
//   - a band below 1 counts only when the rule's absence is meaningful (LRINEC's low band never);
//   - AIR is used instead of Alvarado when both are stored; PERC only when Wells PE is 4 or less;
//   - while a rule's band fires for a diagnosis, the rule's component examination signs do not
//     also count for that diagnosis (`componentSigns`).
// With the 2.2.0 database these replace the older fixed score adjustments for the same rules in
// BayesianDiagnosisEngine.infer (`replacesLegacyAdjustments`); with an older database the old
// adjustments still run.

import Foundation

enum DecisionRuleEvidence {

    /// True when the catalogue loaded and the database carries the rule features (2.2.0 or later).
    static var replacesLegacyAdjustments: Bool {
        guard ExamEvidenceCatalogue.rulesFile != nil,
              let version = BayesianDiagnosisEngine.externalDatabase?.version else { return false }
        return version.compare("2.2.0", options: .numeric) != .orderedAscending
    }

    /// The band a stored value falls in (bounds inclusive).
    static func band(of rule: ExamEvidenceCatalogue.Rule, value: Double) -> ExamEvidenceCatalogue.Band? {
        rule.bands.first { b in
            if let lo = b.min, value < lo { return false }
            if let hi = b.max, value > hi { return false }
            return true
        }
    }

    /// "<rule id>:<band id>" for each stored diagnostic rule that iOS applies. `values`: rule id →
    /// stored result (e.g. "alvarado": 8, "wells-pe": 1.5, "perc": 0).
    static func observedBands(_ values: [String: Double]) -> Set<String> {
        var out = Set<String>()
        for (id, value) in values {
            guard let rule = ExamEvidenceCatalogue.rule(id), rule.kind == "diagnostic", rule.ios != nil else { continue }
            if rule.supersededBy.contains(where: { values[$0] != nil }) { continue }
            if let when = rule.appliesWhen, let other = values[when.rule], other > when.max { continue }
            guard let b = band(of: rule, value: value), let lr = b.lr else { continue }
            if lr.point < 1 && !rule.negativeMeaningful { continue }
            out.insert("\(id):\(b.id)")
        }
        return out
    }

    /// The examination signs the given rules contain (neutral for a diagnosis while its rule fires).
    static func componentSigns(ofRules ruleIDs: [String]) -> Set<String> {
        var out = Set<String>()
        for id in ruleIDs {
            if let rule = ExamEvidenceCatalogue.rule(id) { out.formUnion(rule.components.signs) }
        }
        return out
    }
}
