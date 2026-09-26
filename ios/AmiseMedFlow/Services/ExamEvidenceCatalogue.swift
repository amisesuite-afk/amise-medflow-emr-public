// ExamEvidenceCatalogue.swift
// Evidence-based examination signs and clinical decision rules (evidence-exam 1.0.0).
//
// Resources/ExamSigns.json and Resources/DecisionRules.json are byte-identical copies of
// clinical-content/rules/exam-signs.json and decision-rules.json (the web engine reads the same
// files; scripts/src/exam-evidence-content.test.ts keeps the copies identical). The likelihood
// ratios reach the Bayesian engine as DiagnosticDatabase.json 2.2.0 "sign" and "rule" features
// (scripts/src/gen-exam-evidence-db.ts); this catalogue supplies the names, how to elicit each
// sign, the ranges, sources and the rule bands for the Exam step and the scorer.
//
// Every value is unverified ("fromMemory") until checked against its source and signed off:
// docs/clinical-validation/changes/evidence-exam.md. Registered as `exam-signs` and
// `decision-rules` in clinical-content/registry.json.

import Foundation

enum ExamEvidenceCatalogue {

    struct LR: Codable, Equatable {
        let point: Double
        let low: Double?
        let high: Double?
    }

    struct SignTarget: Codable {
        let group: String
        let paneFeature: String?
        let pretest: Double?
    }

    struct AgeRange: Codable {
        let ageMin: Double?
        let ageMax: Double?
    }

    struct Sign: Codable, Identifiable {
        let id: String
        let name: String
        let synonyms: [String]
        let system: String
        let region: String
        let elicit: String
        let presentations: [String]
        let target: SignTarget
        let lrPositive: LR?
        let lrNegative: LR?
        let negativeMeaningful: Bool
        /// "lr" (own likelihood ratios), "twin" (red-flag sign recorded as its text finding),
        /// "none" (documentation only).
        let engine: String
        let source: String
        let fromMemory: Bool
        let quality: String
        let note: String?
        let applicability: AgeRange?
    }

    struct Group: Codable {
        let label: String
        let ios: [String]
    }

    struct Presentation: Codable {
        let label: String
        let keywords: [String]
    }

    struct SignsFile: Codable {
        let version: String
        let presentations: [String: Presentation]
        let targetGroups: [String: Group]
        let signs: [Sign]
    }

    struct Band: Codable {
        let id: String
        let label: String
        let min: Double?
        let max: Double?
        let lr: LR?
        let risk: String?
    }

    struct RuleIOS: Codable {
        /// BayesianDiagnosisEngine.infer parameter / Patient field holding the stored result.
        let param: String
        /// ActiveScore case name of the calculator.
        let activeScore: String
    }

    struct RuleTarget: Codable {
        let finding: String
        let pretest: Double?
    }

    struct Components: Codable {
        let signs: [String]
        let paneFeatures: [String]
    }

    struct AppliesWhen: Codable {
        let rule: String
        let max: Double
    }

    struct Rule: Codable, Identifiable {
        let id: String
        let name: String
        let kind: String
        let recordKey: String
        let target: RuleTarget
        let ios: RuleIOS?
        let bands: [Band]
        let components: Components
        let supersededBy: [String]
        let appliesWhen: AppliesWhen?
        let negativeMeaningful: Bool
        let presentations: [String]
        let source: String
        let fromMemory: Bool
        let quality: String
        let note: String?
    }

    struct RulesFile: Codable {
        let version: String
        let rules: [Rule]
    }

    static let signsFile: SignsFile? = load("ExamSigns")
    static let rulesFile: RulesFile? = load("DecisionRules")

    private static func load<T: Decodable>(_ resource: String) -> T? {
        guard let url = Bundle.main.url(forResource: resource, withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    static var signs: [Sign] { signsFile?.signs ?? [] }
    static var rules: [Rule] { rulesFile?.rules ?? [] }

    static func sign(_ id: String) -> Sign? { signs.first { $0.id == id } }
    static func rule(_ id: String) -> Rule? { rules.first { $0.id == id } }
    static func group(_ id: String) -> Group? { signsFile?.targetGroups[id] }

    /// "2.8 (0.8–8.6)", or "not established".
    static func format(_ lr: LR?) -> String {
        guard let lr else { return "not established" }
        func f(_ x: Double) -> String {
            x >= 10 ? String(format: "%.0f", x) : x >= 1 ? String(format: "%.1f", x) : String(format: "%.2f", x)
        }
        if let lo = lr.low, let hi = lr.high { return "\(f(lr.point)) (\(f(lo))–\(f(hi)))" }
        return f(lr.point)
    }

    /// A sign applies in the age range it was studied in (unknown age: always).
    static func applies(_ sign: Sign, ageYears: Int?) -> Bool {
        guard let range = sign.applicability, let age = ageYears, age > 0 else { return true }
        if let lo = range.ageMin, Double(age) < lo { return false }
        if let hi = range.ageMax, Double(age) > hi { return false }
        return true
    }

    /// Presentation tags whose keywords occur at a word start in `text` (complaint and history).
    static func presentations(in text: String) -> Set<String> {
        let lower = text.lowercased()
        var out = Set<String>()
        for (tag, p) in signsFile?.presentations ?? [:] where p.keywords.contains(where: { wordStart(lower, $0) }) {
            out.insert(tag)
        }
        return out
    }

    static func wordStart(_ lower: String, _ keyword: String) -> Bool {
        var searchRange = lower.startIndex..<lower.endIndex
        while let r = lower.range(of: keyword, range: searchRange) {
            if r.lowerBound == lower.startIndex { return true }
            let before = lower[lower.index(before: r.lowerBound)]
            if !(before.isLetter || before.isNumber) { return true }
            searchRange = r.upperBound..<lower.endIndex
        }
        return false
    }

    /// Diagnostic value for ordering: the larger of |ln LR+| and, when absence is meaningful, |ln LR−|.
    static func diagnosticValue(_ sign: Sign) -> Double {
        guard sign.engine != "none", let pos = sign.lrPositive else { return 0 }
        let neg = sign.negativeMeaningful ? abs(log(sign.lrNegative?.point ?? 1)) : 0
        return max(abs(log(pos.point)), neg)
    }

    /// Signs for the complaint (presentations) or whose target is among the leading diagnoses,
    /// highest diagnostic value first (those for the leading diagnoses before the rest).
    static func relevantSigns(text: String, ageYears: Int?, leadingDiagnoses: [String]) -> [Sign] {
        let tags = presentations(in: text)
        let leading = leadingDiagnoses.map { $0.lowercased() }
        func inDifferential(_ s: Sign) -> Bool {
            let fragments = group(s.target.group)?.ios ?? []
            return leading.contains { name in fragments.contains { wordStart(name, $0.lowercased()) } }
        }
        let list = signs.filter { s in
            applies(s, ageYears: ageYears) && (s.presentations.contains(where: tags.contains) || inDifferential(s))
        }
        return list.sorted { a, b in
            let da = inDifferential(a), db = inDifferential(b)
            if da != db { return da }
            return diagnosticValue(a) > diagnosticValue(b)
        }
    }

    /// Rules for the complaint (diagnostic before prognostic).
    static func relevantRules(text: String) -> [Rule] {
        let tags = presentations(in: text)
        return rules.filter { $0.presentations.contains(where: tags.contains) }
            .sorted { ($0.kind == "diagnostic" ? 0 : 1) < ($1.kind == "diagnostic" ? 0 : 1) }
    }
}
