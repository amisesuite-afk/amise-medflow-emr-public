// HistoryFrames.swift
// History frames: the structure of the history of presenting complaint, chosen from the chief
// complaint. SOCRATES is a pain history; a cough, a lump or rectal bleeding has its own questions.
//
// Twin of lib/triage-engine/src/history-frames (TypeScript). The frame and rule data live in
// HistoryFrameData.swift, GENERATED from the TypeScript (pnpm --filter @workspace/scripts run
// gen:history-frames); this file holds the types and the classifier algorithm, which must stay
// identical to classify.ts. Both platforms run AmiseMedFlowTests/Resources/HistoryFrameVectors.json
// (HistoryFrameTests.swift; scripts/src/history-frames.test.ts). Change log:
// docs/clinical-validation/changes/history-by-complaint.md.
//
// A chip stores `value` in socratesSelections[key], which BayesianDiagnosisEngine reads. Nothing
// here changes an engine weight.

import Foundation

// MARK: - Data types (memberwise initialisers are used by HistoryFrameData.swift)

struct HistoryOptionSpec: Equatable {
    let label: String
    /// Stored in socratesSelections[key].
    let value: String
    let key: String
    /// Recorded in the history only: no DiagnosticDatabase feature reads it.
    let recordOnlyIOS: Bool
    /// Labels of the same question this chip cannot coexist with ("*": every other chip).
    let excludes: [String]
}

struct HistoryDimensionSpec: Equatable {
    let id: String
    let title: String
    let question: String
    let icon: String
    let multiSelect: Bool
    /// Default socratesSelections key of the question (a chip may override it).
    let key: String
    let options: [HistoryOptionSpec]
}

struct HistoryAliasSpec: Equatable {
    let key: String
    /// A value stored by an earlier version (kept as stored; never rewritten).
    let legacy: String
    /// The current chip label it corresponds to; empty when the value is retired.
    let current: String
}

struct HistoryFrameSpec: Equatable {
    let id: String
    let type: String
    let variant: String?
    let label: String
    /// "SOCRATES" for pain only.
    let title: String
    let dimensions: [HistoryDimensionSpec]
    /// Questions shown when this symptom is a secondary one in the complaint.
    let secondaryDims: [String]
    let aliases: [HistoryAliasSpec]
}

struct HistoryClassifierRuleSpec {
    let type: String
    let tier: Int
    let keywords: [String]
    let unless: [String]
}

struct HistoryVariantRuleSpec {
    let variant: String
    let keywords: [String]
}

struct HistoryVariantSetSpec {
    let type: String
    let fallback: String
    let rules: [HistoryVariantRuleSpec]
}

/// Generated data: see HistoryFrameData.swift.
enum HistoryFrameData {}

// MARK: - Classifier (twin of classify.ts)

struct HistoryFrameChoice: Equatable {
    let type: String
    let variant: String?
    let frameId: String
    /// Frames of the other symptoms named in the complaint, earliest first.
    let secondary: [String]
    /// True when no rule matched (the general frame).
    let fallback: Bool
}

enum HistoryFrameClassifier {

    /// Lower case, runs of whitespace as one space, trimmed.
    static func normalise(_ complaint: String) -> [Character] {
        let words = complaint.lowercased().split(whereSeparator: { $0.isWhitespace })
        return Array(words.joined(separator: " "))
    }

    /// ASCII letter or digit (the TypeScript tests /[a-z0-9]/ on lower-case text).
    static func isWordChar(_ c: Character) -> Bool {
        guard let a = c.asciiValue else { return false }
        return (a >= 97 && a <= 122) || (a >= 48 && a <= 57)
    }

    /// Position of the first word-start match of `keyword` ("abc*" = prefix, else whole word).
    static func keywordPosition(_ text: [Character], _ keyword: String) -> Int? {
        let isPrefix = keyword.hasSuffix("*")
        let k = Array(isPrefix ? String(keyword.dropLast()) : keyword)
        guard !k.isEmpty, k.count <= text.count else { return nil }
        var i = 0
        while i + k.count <= text.count {
            var same = true
            for j in 0..<k.count where text[i + j] != k[j] {
                same = false
                break
            }
            if same {
                let startOk = i == 0 || !isWordChar(text[i - 1])
                let end = i + k.count
                let endOk = isPrefix || end >= text.count || !isWordChar(text[end])
                if startOk && endOk { return i }
            }
            i += 1
        }
        return nil
    }

    /// Earliest position of any keyword.
    static func firstPosition(_ text: [Character], _ keywords: [String]) -> Int? {
        var best: Int?
        for k in keywords {
            if let p = keywordPosition(text, k), best == nil || p < (best ?? p) { best = p }
        }
        return best
    }

    static func frameId(_ type: String, _ variant: String?) -> String {
        guard let v = variant else { return type }
        return "\(type).\(v)"
    }

    static func variantFor(_ type: String, _ text: [Character], _ system: String?) -> String? {
        guard let set = HistoryFrameData.variantSets.first(where: { $0.type == type }) else { return nil }
        var bestVariant: String?
        var bestPos = Int.max
        for r in set.rules {
            if let p = firstPosition(text, r.keywords), p < bestPos {
                bestPos = p
                bestVariant = r.variant
            }
        }
        if let v = bestVariant { return v }
        if type == "pain", let s = system, let v = HistoryFrameData.painSystemDefaults[s] { return v }
        return set.fallback
    }

    /// A pain region keyword anywhere in the complaint.
    static func hasPainRegion(_ text: [Character]) -> Bool {
        guard let set = HistoryFrameData.variantSets.first(where: { $0.type == "pain" }) else { return false }
        return set.rules.contains { firstPosition(text, $0.keywords) != nil }
    }

    private struct RuleMatch {
        let rule: HistoryClassifierRuleSpec
        let pos: Int
        let order: Int
    }

    /// Chief complaint → frame. `system` is the specialty group of a tapped CC chip, if any.
    static func classify(_ complaint: String, system: String? = nil) -> HistoryFrameChoice {
        let text = normalise(complaint)
        var matches: [RuleMatch] = []
        for (order, rule) in HistoryFrameData.classifierRules.enumerated() {
            guard let pos = firstPosition(text, rule.keywords) else { continue }
            if !rule.unless.isEmpty, firstPosition(text, rule.unless) != nil { continue }
            matches.append(RuleMatch(rule: rule, pos: pos, order: order))
        }
        guard !matches.isEmpty else {
            return HistoryFrameChoice(type: "general", variant: nil, frameId: "general", secondary: [], fallback: true)
        }
        let ranked = matches.sorted { a, b in
            if a.rule.tier != b.rule.tier { return a.rule.tier < b.rule.tier }
            if a.pos != b.pos { return a.pos < b.pos }
            return a.order < b.order
        }
        let type = ranked[0].rule.type
        let variant = variantFor(type, text, system)
        var secondary: [String] = []
        var seen: Set<String> = [type]
        let byPosition = matches.sorted { a, b in a.pos != b.pos ? a.pos < b.pos : a.order < b.order }
        for m in byPosition where m.rule.tier != 3 && !seen.contains(m.rule.type) {
            // Pain is a secondary symptom only with a region of its own ("vomiting and abdominal
            // pain"); in "wound pain" the pain belongs to the primary symptom.
            if m.rule.type == "pain" && !hasPainRegion(text) { continue }
            seen.insert(m.rule.type)
            secondary.append(frameId(m.rule.type, variantFor(m.rule.type, text, system)))
        }
        return HistoryFrameChoice(type: type, variant: variant, frameId: frameId(type, variant),
                                  secondary: secondary, fallback: false)
    }
}

// MARK: - Resolved frame (primary questions + a secondary symptom's key questions)

struct ResolvedHistoryDimension: Identifiable, Equatable {
    /// Unique in the resolved frame: the question id, prefixed with the frame id for a secondary one.
    let id: String
    let spec: HistoryDimensionSpec
    let frameId: String
    let secondary: Bool
    let title: String
}

struct ResolvedHistoryFrame: Equatable {
    let choice: HistoryFrameChoice
    let frame: HistoryFrameSpec
    let dimensions: [ResolvedHistoryDimension]
}

enum HistoryFrames {

    static func frame(id: String) -> HistoryFrameSpec? {
        HistoryFrameData.frames.first { $0.id == id }
    }

    static var general: HistoryFrameSpec {
        frame(id: "general") ?? HistoryFrameData.frames[HistoryFrameData.frames.count - 1]
    }

    /// The frame for a complaint (or the clinician's one-tap choice), with the other symptoms'
    /// associated-symptom questions.
    static func resolve(complaint: String, system: String?, overrideFrameId: String?) -> ResolvedHistoryFrame {
        let choice = HistoryFrameClassifier.classify(complaint, system: system)
        let chosen = overrideFrameId.flatMap { frame(id: $0) } ?? frame(id: choice.frameId) ?? general
        var dims = chosen.dimensions.map {
            ResolvedHistoryDimension(id: $0.id, spec: $0, frameId: chosen.id, secondary: false, title: $0.title)
        }
        for secId in choice.secondary where secId != chosen.id {
            guard let sec = frame(id: secId), sec.type != chosen.type else { continue }
            for dimId in sec.secondaryDims {
                guard let d = sec.dimensions.first(where: { $0.id == dimId }) else { continue }
                dims.append(ResolvedHistoryDimension(id: "\(sec.id).\(d.id)", spec: d, frameId: sec.id,
                                                     secondary: true, title: "\(sec.label) — \(d.title)"))
            }
        }
        return ResolvedHistoryFrame(choice: choice, frame: chosen, dimensions: dims)
    }

    /// Is this chip selected? A legacy value that aliases to it counts too.
    static func isSelected(_ option: HistoryOptionSpec, in frame: HistoryFrameSpec,
                           selections: [String: Set<String>]) -> Bool {
        let stored = selections[option.key] ?? []
        if stored.contains(option.value) { return true }
        return frame.aliases.contains { $0.key == option.key && $0.current == option.label && stored.contains($0.legacy) }
    }

    /// Selections after tapping `option`: toggles its value; a single-select question keeps one
    /// chip; chips the option excludes (or that exclude it) are cleared, with their legacy aliases.
    static func toggled(_ option: HistoryOptionSpec, in dim: HistoryDimensionSpec, frame: HistoryFrameSpec,
                        selections: [String: Set<String>]) -> [String: Set<String>] {
        var sel = selections
        func remove(_ o: HistoryOptionSpec) {
            sel[o.key]?.remove(o.value)
            for a in frame.aliases where a.key == o.key && a.current == o.label { sel[o.key]?.remove(a.legacy) }
            if sel[o.key]?.isEmpty == true { sel[o.key] = nil }
        }
        if isSelected(option, in: frame, selections: sel) {
            remove(option)
            return sel
        }
        for other in dim.options where other != option {
            let clash = !dim.multiSelect
                || option.excludes.contains("*") || option.excludes.contains(other.label)
                || other.excludes.contains("*") || other.excludes.contains(option.label)
            if clash { remove(other) }
        }
        sel[option.key, default: []].insert(option.value)
        return sel
    }

    /// The chip label for a stored value (any frame; a legacy alias shows its current label).
    static func displayLabel(key: String, value: String) -> String {
        for f in HistoryFrameData.frames {
            for d in f.dimensions {
                if let o = d.options.first(where: { $0.key == key && $0.value == value }) { return o.label }
            }
        }
        for f in HistoryFrameData.frames {
            if let a = f.aliases.first(where: { $0.key == key && $0.legacy == value }), !a.current.isEmpty { return a.current }
        }
        return value
    }

    /// Associated-symptom chips for a complaint (PreConsultEntrySheet).
    static func associatedChips(forComplaint cc: String) -> [String] {
        let resolved = resolve(complaint: cc, system: nil, overrideFrameId: nil)
        let dim = resolved.frame.dimensions.first { $0.id == "associations" }
            ?? resolved.frame.dimensions.first { $0.id == "source" }
        return dim?.options.map(\.label) ?? []
    }

    /// Title of a stored socratesSelections key (encounter history view).
    static func keyTitle(_ key: String) -> String {
        switch key {
        case "onset": return "Onset"
        case "site": return "Site"
        case "character": return "Character"
        case "radiation": return "Radiation"
        case "associations": return "Associated"
        case "timing": return "Timing"
        case "exacerbating": return "Exacerbating"
        case "relieving": return "Relieving"
        case "severity": return "Severity"
        case "history": return "Risk factors and exposures"
        default: return key.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    /// Display order of stored keys: the SOCRATES keys first, then any other key alphabetically.
    static func orderedKeys(_ keys: [String]) -> [String] {
        let order = ["site", "onset", "character", "radiation", "associations", "timing", "exacerbating",
                     "relieving", "severity", "history"]
        let known = order.filter { keys.contains($0) }
        let rest = keys.filter { !order.contains($0) }.sorted()
        return known + rest
    }
}
