// DiagnosticReasoningRules.swift
// Diagnostic-reasoning rules shared with the web: diagnosis families, working-diagnosis label
// matching and the premature-closure filters the adapters apply to the core's alerts.
//
// Twin of lib/triage-engine/src/diagnostic-reasoning/families.ts and adapter-rules.ts. Rules:
// clinical-content/rules/diagnostic-reasoning-rules.json (bundled folder "rules", loaded by
// SharedClinicalContent), the same file the web reads; `thresholds` in it are compiled into
// DiagnosticReasoningCore.swift and pinned by scripts/src/diagnostic-reasoning-parity.test.ts.
// Shared vectors: AmiseMedFlowTests/Resources/DiagnosticReasoningVectors.json (`families`,
// `labelMatch`, `resolveWorking`, `competes`, `adapterClosure`), run by DiagnosticReasoningTests.swift
// and the dashboard's diagnostic-reasoning-core.test.ts. lint:shared-content checks the Codable
// structs below against clinical-content/schemas/diagnostic-reasoning-rules.schema.json.
//
// When the file is missing or does not decode (Settings → Diagnostics says why), the adapter falls
// back to the core rules alone: no families, no label matching, the core's contradiction threshold.
// Registered rule set `diagnostic-reasoning-rules`; unreviewed, needs sign-off.

import Foundation

enum DiagnosticReasoningRules {

    struct ClosureRules: Codable {
        let contradictionMaxLr: Double
        let contradictionSource: String
    }

    struct WorkingDiagnosisRules: Codable {
        let labelMatchMin: Int
        let labelMatchMinAlone: Int
        let labelMatchMargin: Int
        let neutralWords: [String]
        let opposites: [String: String]
    }

    struct FamilyRules: Codable {
        let complicationModifiers: [String]
        let genericTailWords: [String]
        let synonyms: [String: String]
        let injuryChapter: String
    }

    struct CoexistingRules: Codable {
        let nameTerms: [String]
    }

    struct RuleFile: Codable {
        let version: String
        let closure: ClosureRules
        let workingDiagnosis: WorkingDiagnosisRules
        let families: FamilyRules
        let coexisting: CoexistingRules
    }

    /// The shared rules; nil when the file is missing or does not decode.
    static let ruleFile: RuleFile? = SharedClinicalContent.load(RuleFile.self, .diagnosticReasoningRules)
}

// MARK: - Diagnosis families and label matching (families.ts)

enum DiagnosisFamilies {

    /// A diagnosis as the reasoning layer sees it (an iOS database candidate).
    struct Node {
        let id: String
        let label: String
        let icd10: String
    }

    /// A candidate for the working diagnosis: label, ICD-10 code and engine probability.
    struct WorkingCandidate {
        let label: String
        let icd10: String
        let probability: Double
    }

    struct LabelParts {
        let mainAlternatives: [[String]]
        let mainHeads: Set<String>
        let parenHeads: Set<String>
        let modifier: Bool
    }

    private static let wordRegex = try? NSRegularExpression(pattern: "[\\p{L}\\p{N}]+(?:['’][\\p{L}]+)?")
    private static let alternativeSeparators = try? NSRegularExpression(
        pattern: "\\s*/\\s*|\\s+[—–-]\\s+|,|\\bor\\b|\\bincl\\.?\\b|;")
    private static let parenRegex = try? NSRegularExpression(pattern: "\\(([^)]*)\\)")
    private static let possessiveRegex = try? NSRegularExpression(pattern: "['’]s$")

    private static var families: DiagnosticReasoningRules.FamilyRules? { DiagnosticReasoningRules.ruleFile?.families }
    private static var working: DiagnosticReasoningRules.WorkingDiagnosisRules? { DiagnosticReasoningRules.ruleFile?.workingDiagnosis }

    /// Every match of `regex` in `text`, as strings (capture `group`, 0 = whole match).
    private static func regexMatches(_ regex: NSRegularExpression?, in text: String, group: Int = 0) -> [String] {
        guard let regex else { return [] }
        let ns = text as NSString
        return regex.matches(in: text, range: NSRange(location: 0, length: ns.length)).compactMap { (m: NSTextCheckingResult) -> String? in
            let r = m.range(at: group)
            return r.location == NSNotFound ? nil : ns.substring(with: r)
        }
    }

    /// `text` split at every match of `regex` (empty pieces kept, like String.prototype.split).
    private static func splitText(_ text: String, by regex: NSRegularExpression?) -> [String] {
        guard let regex else { return [text] }
        let ns = text as NSString
        var out: [String] = []
        var from = 0
        for m in regex.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            out.append(ns.substring(with: NSRange(location: from, length: m.range.location - from)))
            from = m.range.location + m.range.length
        }
        out.append(ns.substring(from: from))
        return out
    }

    /// Lower case, possessive "'s" removed, synonyms normalised.
    static func normaliseLabelWord(_ word: String) -> String {
        var w = word.lowercased()
        if let re = possessiveRegex {
            let ns = w as NSString
            w = re.stringByReplacingMatches(in: w, range: NSRange(location: 0, length: ns.length), withTemplate: "")
        }
        return families?.synonyms[w] ?? w
    }

    /// The words of a label or diagnosis text, normalised.
    static func labelWords(_ text: String) -> [String] {
        regexMatches(wordRegex, in: text.lowercased()).map(normaliseLabelWord)
    }

    /// "Inguinal / Femoral Hernia" → [["inguinal", "hernia"], ["femoral", "hernia"]] (a one-word
    /// alternative borrows the next alternative's last word).
    static func labelAlternatives(_ phrase: String) -> [[String]] {
        var parts = splitText(phrase, by: alternativeSeparators).map(labelWords).filter { !$0.isEmpty }
        var i = parts.count - 2
        while i >= 0 {
            if parts[i].count == 1 && parts[i + 1].count > 1, let last = parts[i + 1].last {
                parts[i] = [parts[i][0], last]
            }
            i -= 1
        }
        return parts
    }

    private static func headOf(_ ws: [String]) -> String? {
        let tail = Set(families?.genericTailWords ?? [])
        var w = ws
        while w.count > 1, let last = w.last, tail.contains(last) { w.removeLast() }
        return w.last
    }

    static func labelParts(_ label: String) -> LabelParts {
        let ns = label as NSString
        let parens = regexMatches(parenRegex, in: label, group: 1)
        let main = parenRegex.map {
            $0.stringByReplacingMatches(in: label, range: NSRange(location: 0, length: ns.length), withTemplate: " ")
        } ?? label
        let mainAlternatives = labelAlternatives(main)
        let modifiers = Set(families?.complicationModifiers ?? [])
        return LabelParts(
            mainAlternatives: mainAlternatives,
            mainHeads: Set(mainAlternatives.compactMap(headOf)),
            parenHeads: Set(parens.flatMap { labelAlternatives($0).compactMap(headOf) }),
            modifier: mainAlternatives.contains { alt in alt.contains { modifiers.contains($0) } })
    }

    /// ICD-10 code without dots or spaces, upper case.
    static func normaliseIcd(_ code: String) -> String {
        code.replacingOccurrences(of: ".", with: "").components(separatedBy: .whitespacesAndNewlines).joined().uppercased()
    }

    private static func childOf(_ child: Node, _ parent: Node) -> Bool {
        let c = labelParts(child.label)
        guard c.modifier else { return false }
        let p = labelParts(parent.label)
        if !c.parenHeads.isDisjoint(with: p.mainHeads) { return true }
        return !c.mainHeads.isDisjoint(with: p.mainHeads)
            && normaliseIcd(child.icd10).prefix(1) == normaliseIcd(parent.icd10).prefix(1)
    }

    /// True when `a` and `b` are the same condition at different granularity (families.ts header).
    static func sameFamily(_ a: Node, _ b: Node) -> Bool {
        if a.id == b.id { return true }
        guard let rules = families else { return false }
        if a.id == "_other_" || b.id == "_other_" { return false }
        let ca = normaliseIcd(a.icd10)
        let cb = normaliseIcd(b.icd10)
        if ca.prefix(3) == cb.prefix(3) && !labelParts(a.label).mainHeads.isDisjoint(with: labelParts(b.label).mainHeads) {
            return true
        }
        if ca.hasPrefix(rules.injuryChapter) && cb.hasPrefix(rules.injuryChapter) && ca.prefix(2) == cb.prefix(2) { return true }
        return childOf(a, b) || childOf(b, a)
    }

    /// Ids of the diagnoses in `nodes` that are one family with `node` (not including it).
    static func familyOf(_ node: Node, in nodes: [Node]) -> Set<String> {
        Set(nodes.filter { $0.id != node.id && sameFamily(node, $0) }.map(\.id))
    }

    /// Words found − words missing over the label's alternatives (neutral words ignored); −∞ when
    /// no alternative has a word. "Diabetic Ketoacidosis" for "Euglycaemic diabetic ketoacidosis": 2.
    static func labelMatchScore(_ label: String, _ workingText: String) -> Double {
        guard let rules = working else { return -Double.infinity }
        let have = Set(labelWords(workingText))
        let neutral = Set(rules.neutralWords)
        var best = -Double.infinity
        for alt in labelParts(label).mainAlternatives {
            let ws = alt.filter { !neutral.contains($0) }
            let clash = alt.filter { w in rules.opposites[w].map { have.contains($0) } ?? false }.count
            if ws.isEmpty && clash == 0 { continue }
            let found = ws.filter { have.contains($0) }.count
            best = max(best, Double(found - (ws.count - found) - clash))
        }
        return best
    }

    /// True when every non-neutral word of one of the label's alternatives is in the working text.
    static func labelFullyNamed(_ label: String, _ workingText: String) -> Bool {
        guard let rules = working else { return false }
        let have = Set(labelWords(workingText))
        let neutral = Set(rules.neutralWords)
        return labelParts(label).mainAlternatives.contains { alt in
            let ws = alt.filter { !neutral.contains($0) }
            return !ws.isEmpty && ws.allSatisfy { have.contains($0) }
        }
    }

    /// Index of the node the confirmed working diagnosis names (families.ts resolveWorkingIndex): a
    /// label match that beats the ICD-10 match by the margin, else the ICD-10 code (exact, then the
    /// same category, most probable first), else the exact label; nil when nothing matches.
    static func resolveWorkingIndex(_ nodes: [WorkingCandidate], label: String, icdCode: String?) -> Int? {
        let text = label.trimmingCharacters(in: .whitespacesAndNewlines)
        let code = icdCode.map(normaliseIcd) ?? ""
        var byIcd: Int? = nil
        if !code.isEmpty {
            byIcd = nodes.firstIndex { normaliseIcd($0.icd10) == code }
            if byIcd == nil {
                let head = String(code.prefix(3))
                for (i, n) in nodes.enumerated() where String(normaliseIcd(n.icd10).prefix(3)) == head {
                    if let b = byIcd, nodes[b].probability >= n.probability { continue }
                    byIcd = i
                }
            }
        }
        if !text.isEmpty, let rules = working {
            func icdRank(_ n: WorkingCandidate) -> Int {
                if code.isEmpty { return 0 }
                let c = normaliseIcd(n.icd10)
                if c == code { return 2 }
                return c.prefix(3) == code.prefix(3) ? 1 : 0
            }
            var best: Int? = nil
            var bestScore = -Double.infinity
            for (i, n) in nodes.enumerated() {
                let sc = labelMatchScore(n.label, text)
                let better: Bool
                if let b = best {
                    better = sc > bestScore || (sc == bestScore && (icdRank(n) > icdRank(nodes[b])
                        || (icdRank(n) == icdRank(nodes[b]) && n.probability > nodes[b].probability)))
                } else {
                    better = true
                }
                if better { best = i; bestScore = sc }
            }
            let icdScore = byIcd.map { labelMatchScore(nodes[$0].label, text) } ?? -Double.infinity
            let minimum = Double(byIcd != nil ? rules.labelMatchMin : rules.labelMatchMinAlone)
            if let b = best, bestScore >= minimum, bestScore >= icdScore + Double(rules.labelMatchMargin) { return b }
        }
        if let b = byIcd { return b }
        let lower = text.lowercased()
        if !lower.isEmpty, let i = nodes.firstIndex(where: { $0.label.lowercased() == lower }) { return i }
        return nil
    }
}

// MARK: - Premature-closure filters (adapter-rules.ts)

extension DiagnosticReasoning {

    /// A single contradicting finding alerts only at LR ≤ this (rules file `closure.contradictionMaxLr`);
    /// nil when the rules file is unavailable (the core's own threshold then applies).
    static var contradictionMaxLr: Double? { DiagnosticReasoningRules.ruleFile?.closure.contradictionMaxLr }

    /// True when the leader and the working diagnosis compete for the same evidence: the working
    /// diagnosis has no support of its own (no present finding with LR ≥ favourLr), or a present
    /// finding of one evidence group supports both (LR ≥ supportLr in each). `evidenceGroup` maps a
    /// finding id to its group (default: the finding itself).
    static func competesForEvidence(_ input: Input, leaderId: String, workingId: String,
                                    evidenceGroup: (String) -> String = { $0 }) -> Bool {
        let present = input.findings.filter { $0.status == .present }
        func lr(_ h: String, _ f: String) -> Double { input.weights[h]?[f]?.lrPresent ?? 1 }
        if !present.contains(where: { lr(workingId, $0.id) >= Thresholds.favourLr }) { return true }
        let workingGroups = Set(present.filter { lr(workingId, $0.id) >= Thresholds.supportLr }.map { evidenceGroup($0.id) })
        return present.contains { lr(leaderId, $0.id) >= Thresholds.supportLr && workingGroups.contains(evidenceGroup($0.id)) }
    }

    /// True when the working-diagnosis text already names `label` ("… — suspected placental abruption").
    static func namedInDiagnosis(_ label: String, workingText: String) -> Bool {
        DiagnosisFamilies.labelFullyNamed(label, workingText)
    }

    /// "Doesn't fit the working diagnosis" with the shared adapter rules: family members are
    /// compatible (never the leader, and a finding favouring one does not alert); a single
    /// contradicting finding alerts only at LR ≤ contradictionMaxLr; no "the record favours X" when
    /// the working-diagnosis text names X or X shares no evidence with a supported working
    /// diagnosis. The NEWS2 alert is unchanged.
    static func adapterClosureAlerts(_ input: Input, workingId: String?, workingText: String, familyIds: Set<String>,
                                     news2Series: [Int], evidenceGroup: (String) -> String = { $0 }) -> [ClosureAlert] {
        guard let maxLr = contradictionMaxLr else {
            // Rules file unavailable: the core rules alone.
            return prematureClosureAlerts(input, workingId: workingId, workingLabel: workingText, news2Series: news2Series)
        }
        let familyLabels = Set(input.hypotheses.filter { familyIds.contains($0.id) }.map(\.label))
        let closureInput = Input(
            hypotheses: input.hypotheses.map { h in
                Hypothesis(id: h.id, label: h.label, probability: h.probability, cantMiss: h.cantMiss,
                           coexists: familyIds.contains(h.id) ? true : h.coexists)
            },
            findings: input.findings, weights: input.weights)
        let working = workingId.flatMap { wid in input.hypotheses.first { $0.id == wid } }
        let label = working?.label ?? workingText
        let findingAlerts = prematureClosureAlerts(closureInput, workingId: workingId, workingLabel: label, news2Series: [])
            .filter { a in
                switch a.kind {
                case .contradictingFinding:
                    guard let lr = a.lr, lr <= maxLr else { return false }
                    if let fav = a.favours, familyLabels.contains(fav) { return false }
                    return true
                case .lessLikely:
                    guard let wid = workingId else { return true }
                    let leaderId = String(a.key.dropFirst("less-likely:".count))
                    if let leader = input.hypotheses.first(where: { $0.id == leaderId }),
                       namedInDiagnosis(leader.label, workingText: workingText) {
                        return false
                    }
                    return competesForEvidence(input, leaderId: leaderId, workingId: wid, evidenceGroup: evidenceGroup)
                case .news2Rising:
                    return true
                }
            }
        let news2Alerts = prematureClosureAlerts(input, workingId: workingId, workingLabel: label, news2Series: news2Series)
            .filter { $0.kind == .news2Rising }
        return Array((findingAlerts + news2Alerts).prefix(Thresholds.maxClosureAlerts))
    }
}
