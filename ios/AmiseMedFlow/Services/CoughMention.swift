// CoughMention.swift
// Cough: the symptom, or a manoeuvre that makes something else worse?
//
// Swift twin of lib/triage-engine/src/cough-mention.ts (the rules are documented there). Shared
// vectors: AmiseMedFlowTests/Resources/CoughMentionVectors.json (CoughMentionTests.swift here,
// artifacts/dashboard/src/lib/__tests__/cough-mention.test.ts on the web). Change both together.
//
// "Cough for three weeks", "productive cough", "coughing up blood" record a cough; "pain worse on
// coughing", "aggravated by coughing", a chip written "aggravating: coughing" record an
// aggravating factor; "cough impulse" is an examination sign. Negation is decided elsewhere
// (NegationMatcher): "no cough" is a symptom mention that the negation rule then drops.
//
// Offsets count Unicode scalars of the lower-cased text, like NegationMatcher.Match.index.

import Foundation

enum CoughMention {

    enum Kind: String, Equatable {
        case symptom, aggravating, sign
    }

    struct Mention: Equatable {
        /// Offset of the cough word in the lower-cased text (Unicode scalars).
        let index: Int
        /// The cough word as written (lower case).
        let word: String
        let kind: Kind
    }

    private struct Tok {
        let text: String
        let start: Int
        let end: Int
        let sentence: Int
    }

    private static let leadPrep: Set<String> = ["worse", "better", "eased", "relieved", "aggravated", "exacerbated",
                                                "precipitated", "provoked", "brought", "triggered", "made"]
    private static let painLead: Set<String> = ["pain", "pains", "painful", "hurts", "hurt", "hurting", "tender",
                                                "tenderness", "discomfort", "ache", "aches", "aching"]
    private static let prepAny: Set<String> = ["on", "with", "when", "by", "during", "while", "upon"]
    private static let prepPain: Set<String> = ["on", "when", "during", "while", "upon"]
    private static let directPrep: Set<String> = ["on", "when", "while", "during", "upon"]
    private static let labelLead: Set<String> = ["aggravating", "exacerbating", "relieving", "aggravates", "exacerbates"]
    private static let block: Set<String> = ["but", "however", "has", "have", "had", "is", "was", "are", "were",
                                             "also", "reports", "denies", "plus"]
    private static let afterVerb: Set<String> = ["worsens", "aggravates", "exacerbates", "triggers", "provokes", "brings"]
    private static let objects: Set<String> = ["the", "it", "his", "her", "their", "my", "this", "that", "pain",
                                               "discomfort", "on"]
    private static let maxGap = 3
    private static let sentenceBreaks: Set<Unicode.Scalar> = [
        ".", ";", "!", "?", "(", ")", "[", "]", "{", "}", "|", "\n", "\r", "\u{2022}",
    ]
    private static let coughWords: Set<String> = ["cough", "coughs", "coughing", "coughed"]

    private static func isWordChar(_ c: Unicode.Scalar) -> Bool {
        switch c.properties.generalCategory {
        case .uppercaseLetter, .lowercaseLetter, .titlecaseLetter, .modifierLetter, .otherLetter,
             .decimalNumber, .letterNumber, .otherNumber:
            return true
        default:
            return false
        }
    }

    private static func isDigit(_ c: Unicode.Scalar) -> Bool { c.value >= 48 && c.value <= 57 }

    /// Words of the lower-cased scalars with their sentence number (same tokens as the web twin).
    private static func tokenize(_ s: [Unicode.Scalar]) -> [Tok] {
        var out: [Tok] = []
        var sentence = 0
        var i = 0
        while i < s.count {
            let c = s[i]
            if isWordChar(c) {
                var j = i + 1
                while j < s.count {
                    let d = s[j]
                    if isWordChar(d) { j += 1; continue }
                    if (d == "'" || d == "\u{2019}"), j + 1 < s.count, isWordChar(s[j + 1]) { j += 1; continue }
                    if d == ".", isDigit(s[j - 1]), j + 1 < s.count, isDigit(s[j + 1]) { j += 1; continue }
                    break
                }
                var v = String.UnicodeScalarView()
                v.append(contentsOf: s[i..<j])
                out.append(Tok(text: String(v), start: i, end: j, sentence: sentence))
                i = j
                continue
            }
            if sentenceBreaks.contains(c) { sentence += 1 }
            i += 1
        }
        return out
    }

    private static func gapOK(_ words: [Tok], from: Int, to: Int) -> Bool {
        if to - from - 1 > maxGap { return false }
        var k = from + 1
        while k < to {
            if block.contains(words[k].text) { return false }
            k += 1
        }
        return true
    }

    private static func kind(_ words: [Tok], at w: Int) -> Kind {
        let s = words[w].sentence
        func at(_ k: Int) -> String? {
            guard k >= 0, k < words.count, words[k].sentence == s else { return nil }
            return words[k].text
        }
        let next = at(w + 1)
        let prev = at(w - 1)

        // 1. Examination sign.
        if next == "impulse" || (next?.hasPrefix("tender") ?? false) { return .sign }
        if (prev == "on" || prev == "with") && at(w - 2) == "impulse" { return .sign }
        // 2. "coughing up blood / sputum".
        if next == "up" { return .symptom }
        // 3a. The factor is named after the cough.
        if next == "hurts" { return .aggravating }
        if next == "makes" || next == "made" || next == "make" {
            for k in (w + 2)...(w + 5) where at(k) == "worse" { return .aggravating }
        }
        if let n = next, afterVerb.contains(n), let o = at(w + 2), objects.contains(o) { return .aggravating }
        // 3b. Directly after "on / when / while / during / upon".
        if let p = prev, directPrep.contains(p) { return .aggravating }
        // 3c. A lead-in before the cough.
        var k = w - 1
        while k >= 0 && k >= w - (maxGap + 3) && words[k].sentence == s {
            let t = words[k].text
            if labelLead.contains(t) {
                if gapOK(words, from: k, to: w) { return .aggravating }
                k -= 1
                continue
            }
            let preps: Set<String>? = leadPrep.contains(t) ? prepAny : (painLead.contains(t) ? prepPain : nil)
            if let preps {
                var p = k + 1
                while p <= k + 2 && p < w {
                    if preps.contains(words[p].text) && gapOK(words, from: p, to: w) { return .aggravating }
                    p += 1
                }
            }
            k -= 1
        }
        return .symptom
    }

    /// Every cough word in `text`, with what it records. Offsets index the lower-cased text.
    static func mentions(in text: String) -> [Mention] {
        let words = tokenize(Array(text.lowercased().unicodeScalars))
        var out: [Mention] = []
        for (w, t) in words.enumerated() where coughWords.contains(t.text) {
            out.append(Mention(index: t.start, word: t.text, kind: kind(words, at: w)))
        }
        return out
    }

    /// What the cough word starting at scalar offset `index` of `lower` (already lower-cased)
    /// records.
    static func kind(inLowercased lower: String, at index: Int) -> Kind {
        let words = tokenize(Array(lower.unicodeScalars))
        guard let w = words.firstIndex(where: { $0.start <= index && index < $0.end }) else { return .symptom }
        return kind(words, at: w)
    }

    /// True when `text` records a cough (an affirmed, non-negated symptom mention).
    static func recordsCough(_ text: String) -> Bool {
        let source = NegationMatcher.Source(text)
        return mentions(in: text).contains { m in
            m.kind == .symptom && !source.isNegated(start: m.index, end: m.index + m.word.unicodeScalars.count)
        }
    }

    /// True when `text` records coughing as an aggravating factor (affirmed).
    static func recordsCoughAsFactor(_ text: String) -> Bool {
        let source = NegationMatcher.Source(text)
        return mentions(in: text).contains { m in
            m.kind == .aggravating && !source.isNegated(start: m.index, end: m.index + m.word.unicodeScalars.count)
        }
    }
}
