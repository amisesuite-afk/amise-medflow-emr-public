// ZebraCheck.swift
// Zebra check — rare but real conditions that explain an unusual combination of findings.
//
// Rules: clinical-content/rules/zebra-rules.json, the single source the web reads too
// (lib/triage-engine/src/diagnostic-reasoning/zebra-rules.ts), bundled as the "rules" folder and
// loaded by SharedClinicalContent. Change the JSON, not a platform copy; lint:shared-content checks
// the Codable structs below against clinical-content/schemas/zebra-rules.schema.json. Matching mirrors
// zebras.ts: negation-aware at word starts (NegationMatcher). A rule matches when every `all`
// group has an affirmed term, at least `atLeast.count` of `atLeast.groups` do, and no `none` term
// is affirmed. Registered rule set `diagnostic-reasoning-zebras`; unreviewed, needs sign-off.

import Foundation

enum ZebraCheck {

    struct AtLeast: Codable {
        let count: Int
        let groups: [[String]]
    }

    struct Rule: Codable {
        let id: String
        let condition: String
        let icd10: String
        let paneId: String?
        let explains: String
        let all: [[String]]
        let atLeast: AtLeast?
        let none: [String]
        let link: String?
        let citation: String
    }

    struct RuleFile: Codable {
        let version: String
        let rules: [Rule]
    }

    struct Match: Identifiable {
        let id: String
        let condition: String
        let icd10: String
        let explains: String
        let citation: String
        let link: String?
        /// The first affirmed term of each satisfied group, in rule order.
        let matched: [String]
    }

    /// The shared rules (clinical-content/rules/zebra-rules.json, bundled folder "rules"); nil when
    /// the file is missing or does not decode — no zebra is shown then, and Settings → Diagnostics
    /// says why (SharedClinicalContent).
    static let ruleFile: RuleFile? = SharedClinicalContent.load(RuleFile.self, .zebraRules)

    static var rules: [Rule] { ruleFile?.rules ?? [] }
    static var version: String { ruleFile?.version ?? "unavailable" }

    static func match(_ recordText: String, rules: [Rule] = ZebraCheck.rules) -> [Match] {
        guard !recordText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return [] }
        let source = NegationMatcher.Source(recordText)
        var out: [Match] = []
        for rule in rules {
            if rule.none.contains(where: { source.contains($0, wordStart: true) }) { continue }
            var matched: [String] = []
            var ok = true
            for group in rule.all {
                guard let hit = source.firstAffirmed(group, wordStart: true) else { ok = false; break }
                matched.append(hit)
            }
            if !ok { continue }
            if let atLeast = rule.atLeast {
                var hits: [String] = []
                for group in atLeast.groups {
                    if let hit = source.firstAffirmed(group, wordStart: true) { hits.append(hit) }
                }
                if hits.count < atLeast.count { continue }
                matched.append(contentsOf: hits)
            }
            if matched.isEmpty { continue }
            out.append(Match(id: rule.id, condition: rule.condition, icd10: rule.icd10, explains: rule.explains,
                             citation: rule.citation, link: rule.link, matched: matched))
        }
        return out
    }

    struct LabValue: Codable {
        let name: String
        let value: Double
    }

    static let otherSpecimenTerms = ["urine", "urinary", "csf", "fluid", "drain", "vitamin*", "ratio", "faecal", "stool"]

    /// Words for abnormal numeric results (zebras.ts derivedLabTerms): same analytes, units and order.
    static func derivedLabTerms(_ labs: [LabValue]) -> [String] {
        var found = Set<String>()
        func named(_ name: String, _ terms: [String]) -> Bool {
            terms.contains { DiagnosticReasoning.hasTerm(name, $0) }
        }
        for lab in labs {
            let name = lab.name
            let value = lab.value
            guard value.isFinite else { continue }
            if named(name, otherSpecimenTerms) { continue }
            if named(name, ["haemoglobin", "hemoglobin", "hb", "hgb"]) {
                let gdl = value > 25 ? value / 10 : value
                if gdl < 11 { found.insert("anaemia") }
            }
            if named(name, ["calcium"]) {
                let mmol = value > 5 ? value / 4.008 : value
                if mmol > 2.6 { found.insert("hypercalcaemia") }
            }
            if named(name, ["potassium", "k"]) {
                if value < 3.5 { found.insert("hypokalaemia") }
                if value >= 6.0 { found.insert("hyperkalaemia") }
            }
            if named(name, ["sodium", "na"]) && value < 130 { found.insert("hyponatraemia") }
            if named(name, ["eosinophil*", "eos"]) {
                let e9 = value > 30 ? value / 1000 : value
                if e9 > 0.5 { found.insert("eosinophilia") }
            }
            if named(name, ["alt", "ast", "alanine aminotransferase", "aspartate aminotransferase", "transaminase*"]) && value > 40 {
                found.insert("raised transaminases")
            }
            if named(name, ["bilirubin"]) {
                let umol = value < 5 ? value * 17.1 : value
                if umol > 21 { found.insert("raised bilirubin") }
            }
            if named(name, ["triglyceride*", "tg"]) {
                let mmol = value > 50 ? value / 88.57 : value
                if mmol >= 11.3 { found.insert("hypertriglyceridaemia") }
            }
        }
        let order = ["anaemia", "hypercalcaemia", "hypokalaemia", "hyperkalaemia", "hyponatraemia", "eosinophilia",
                     "raised transaminases", "raised bilirubin", "hypertriglyceridaemia"]
        return order.filter { found.contains($0) }
    }
}
