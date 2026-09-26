// RecordClauses.swift
// Clause-aware record reading: is a mention a finding about THIS patient NOW?
//
// Swift twin of lib/triage-engine/src/record-clauses.ts (the rules are documented there). Shared
// vectors: AmiseMedFlowTests/Resources/RecordClauseVectors.json (RecordClauseTests.swift here,
// artifacts/dashboard/src/lib/__tests__/record-clauses.test.ts on the web);
// scripts/src/diagnostic-reasoning-parity.test.ts pins the patterns and word lists below to the
// TypeScript. Change both together.
//
// Each rule looks at one occurrence of a term that NegationMatcher has already let through and
// only ever removes a match (when unsure the match is kept):
//  - listNegatedAt: an item of a negated list ("never had pain, jaundice or fever"; "Negative for
//    blood, leucocytes and nitrites");
//  - familyHistoryAt: a relative's condition ("Mother had breast cancer", "FH: IHD");
//  - attributedAt: a lay person's or referrer's guess ("Mother thought it was a hernia");
//  - queryAt: a query or a referral label ("?appendicitis", "query appendicitis");
//  - reliefFailedAt: the clause says the remedy did not help ("Took antacids with no relief").
// The web PANE mapper also drops "not current" mentions (a sentence dated years back, a condition
// repaired or awaiting repair) for features that mean "now"; the iOS database terms do not say
// whether they mean "now" ("previous AAA repair", "gallstones" are history evidence), so iOS does
// not apply that rule.
//
// Offsets (`start`, `end`) count Unicode scalars of the lower-cased text, like
// NegationMatcher.Match.index.

import Foundation

enum RecordClauses {

    // MARK: - Word lists and patterns (record-clauses.ts)

    static let listCues = ["no", "not", "nil", "never", "without", "neither", "nor", "denies", "denied", "deny", "denying",
                           "free of", "negative for"]
    static let andListCues = ["never", "denies", "denied", "deny", "denying", "negative for", "free of"]
    static let listPseudoNext = [
        "change", "changes", "increase", "improvement", "better", "relief", "doubt", "significant", "only", "improving",
        "improved", "relieved", "settling", "settled", "responding", "responded", "controlled", "certain", "sure",
        "clear", "excluded", "ruled", "necessarily", "delay", "response", "by", "stopped", "resolved", "gone",
    ]
    static let listBreakers = [
        "but", "however", "although", "though", "except", "yet", "whereas", "while", "whilst", "apart", "other",
        "besides", "despite", "with", "which", "who", "shows", "showed", "showing", "reveals", "revealed",
        "demonstrates", "demonstrated", "plus", "then", "now", "still", "because", "due", "reports", "reported",
        "complains", "complained", "presents", "presented", "describes", "described", "is", "was", "are", "were",
        "has", "have", "had", "feels", "felt", "says", "said", "developed", "started", "noticed",
    ]
    static let listCueFillers = ["had", "has", "have", "any", "been", "experienced", "noticed", "reported", "complained", "of"]
    static let maxListItemWords = 5
    static let maxListItems = 8

    static let familyHistoryPattern = #"\b(?:family history|family hx|fhx?|fh of|runs in (?:the|his|her|their) family)\b|\b(?:mother|mum|mom|father|dad|sister|brother|son|daughter|aunt|uncle|grand(?:mother|father|parent)s?|cousin|parents?|siblings?|twin|relatives?|niece|nephew)\s+(?:also\s+|both\s+)?(?:(?:had|has|have)(?!\s+(?:noticed|seen|brought|reported|said|told|been|observed|found|given|taken|called|thought|heard|asked|mentioned|described))|died|passed away|was diagnosed|diagnosed|developed|suffered|suffers|with)\b"#
    static let familyContrastPattern = #"\b(?:but|however|whereas|although|though|while|whilst|himself|herself|patient|she has|he has|she had|he had|she is|he is)\b"#
    static let attributedPattern = #"\b(?:thought|thinks|think|worried|worries|wondered|wonders|feared|fears|believed|believes|suspected|suspects|concerned)\b[^.;]{0,15}?\b(?:it was|it is|it's|it might be|it may be|it could be|this was|that it)\b[^.;]*$"#
    static let queryBeforePattern = #"[\s'"‘“(/]\? ?['"‘“]?$|\bquery\s+$"#
    static let queryLookback = 12
    static let noHelpPattern = #"\b(not|no|didn'?t|did not|doesn'?t|does not|nothing|without|never)\b[^.]{0,15}\b(help|helps|helped|relie\w*|benefit|effect|work\w*)\b|\bno (help|relief|benefit|effect)\b|\bunhelpful\b"#

    private static func regex(_ pattern: String) -> NSRegularExpression? {
        try? NSRegularExpression(pattern: pattern)
    }

    private static let listCueRegex = regex("\\b(?:" + listCues.joined(separator: "|") + ")\\b")
    private static let firstWordRegex = regex("^\\s*([\\p{L}'’]+)")
    private static let wordRegex = regex("[\\p{L}\\p{N}]+(?:['’][\\p{L}]+)*")
    private static let sepOrRegex = regex(",|/|\\b(?:or|nor)\\b")
    private static let sepOrAndRegex = regex(",|/|\\b(?:or|nor|and)\\b")
    private static let conjOrRegex = regex("\\b(?:or|nor)\\b")
    private static let conjOrAndRegex = regex("\\b(?:or|nor|and)\\b")
    private static let restCutRegex = regex("[:()\\[\\]]")
    private static let commaSlashRegex = regex(",|/")
    private static let familyRegex = regex(familyHistoryPattern)
    private static let familyContrastRegex = regex(familyContrastPattern)
    private static let attributedRegex = regex(attributedPattern)
    private static let queryRegex = regex(queryBeforePattern)
    private static let noHelpRegex = regex(noHelpPattern)
    private static let contrastWordsRegex = regex("\\b(?:but|however|although|though|whereas|while|whilst)\\b")

    // MARK: - Text helpers (scalar offsets)

    private static func isAsciiDigit(_ c: Unicode.Scalar?) -> Bool {
        guard let c else { return false }
        return c.value >= 48 && c.value <= 57
    }

    private static func isSentenceBreak(_ s: [Unicode.Scalar], _ i: Int) -> Bool {
        let c = s[i]
        if c == ";" || c == "!" || c == "?" || c == "\n" || c == "\r" { return true }
        guard c == "." else { return false }
        let prev: Unicode.Scalar? = i > 0 ? s[i - 1] : nil
        let next: Unicode.Scalar? = i + 1 < s.count ? s[i + 1] : nil
        return !(isAsciiDigit(prev) && isAsciiDigit(next))
    }

    static func sentenceStart(_ s: [Unicode.Scalar], _ pos: Int) -> Int {
        var i = min(pos, s.count) - 1
        while i >= 0 {
            if isSentenceBreak(s, i) { return i + 1 }
            i -= 1
        }
        return 0
    }

    static func sentenceEnd(_ s: [Unicode.Scalar], _ pos: Int) -> Int {
        var i = max(pos, 0)
        while i < s.count {
            if isSentenceBreak(s, i) { return i }
            i += 1
        }
        return s.count
    }

    static func clauseStart(_ s: [Unicode.Scalar], _ pos: Int) -> Int {
        let start = sentenceStart(s, pos)
        var i = min(pos, s.count) - 1
        while i >= start {
            let c = s[i]
            if c == ":" || c == "(" || c == ")" || c == "[" || c == "]" { return i + 1 }
            i -= 1
        }
        return start
    }

    private static func text(_ s: [Unicode.Scalar], _ from: Int, _ to: Int) -> String {
        let a = max(0, min(from, s.count))
        let b = max(a, min(to, s.count))
        var view = String.UnicodeScalarView()
        view.append(contentsOf: s[a..<b])
        return String(view)
    }

    private static func fullRange(_ t: String) -> NSRange {
        NSRange(location: 0, length: (t as NSString).length)
    }

    private static func test(_ re: NSRegularExpression?, _ t: String) -> Bool {
        guard let re else { return false }
        return re.firstMatch(in: t, range: fullRange(t)) != nil
    }

    private static func splitText(_ t: String, by re: NSRegularExpression?) -> (items: [String], separators: [String]) {
        guard let re else { return ([t], []) }
        let ns = t as NSString
        var items: [String] = []
        var seps: [String] = []
        var from = 0
        for m in re.matches(in: t, range: fullRange(t)) {
            items.append(ns.substring(with: NSRange(location: from, length: m.range.location - from)))
            seps.append(ns.substring(with: m.range))
            from = m.range.location + m.range.length
        }
        items.append(ns.substring(from: from))
        return (items, seps)
    }

    private static func words(_ t: String) -> [String] {
        guard let re = wordRegex else { return [] }
        let ns = t as NSString
        return re.matches(in: t, range: fullRange(t)).map { ns.substring(with: $0.range) }
    }

    /// A list item: at most maxListItemWords words and no word that starts a new assertion.
    private static func isListItem(_ item: String) -> Bool {
        let ws = words(item)
        return ws.count <= maxListItemWords && !ws.contains { listBreakers.contains($0) }
    }

    // MARK: - 1. List negation

    /// True when the occurrence starting at `start` is an item of a negated list ("fever" in
    /// "never had abdominal pain, indigestion after food, jaundice or fever").
    static func listNegatedAt(_ lower: String, _ start: Int) -> Bool {
        listNegatedAt(scalars: Array(lower.unicodeScalars), start)
    }

    static func listNegatedAt(scalars s: [Unicode.Scalar], _ start: Int) -> Bool {
        guard start >= 0, start <= s.count else { return false }
        let before = text(s, clauseStart(s, start), start)
        guard let cueRegex = listCueRegex,
              let cue = cueRegex.matches(in: before, range: fullRange(before)).last else { return false }
        let nsBefore = before as NSString
        let cueWord = nsBefore.substring(with: cue.range)
        var between = nsBefore.substring(from: cue.range.location + cue.range.length)
        func leadingWord(_ t: String) -> (word: String, length: Int)? {
            guard let re = firstWordRegex, let m = re.firstMatch(in: t, range: fullRange(t)) else { return nil }
            return ((t as NSString).substring(with: m.range(at: 1)), m.range.length)
        }
        if let first = leadingWord(between), listPseudoNext.contains(first.word) { return false }
        // Skip "had", "any" … straight after the cue.
        while let w = leadingWord(between), listCueFillers.contains(w.word) {
            between = (between as NSString).substring(from: w.length)
        }
        let allowAnd = andListCues.contains(cueWord)
        let split = splitText(between, by: allowAnd ? sepOrAndRegex : sepOrRegex)
        let items = split.items
        if items.count < 2 || items.count > maxListItems { return false }
        if !items.allSatisfy(isListItem) { return false }
        let lastSep = split.separators.last?.trimmingCharacters(in: .whitespaces) ?? ""
        if lastSep == "or" || lastSep == "nor" || (allowAnd && lastSep == "and") { return true }
        let after = text(s, start, sentenceEnd(s, start)) as NSString
        var rest = after as String
        if let cut = restCutRegex?.firstMatch(in: rest, range: fullRange(rest)) {
            rest = after.substring(to: cut.range.location)
        }
        guard let conj = (allowAnd ? conjOrAndRegex : conjOrRegex)?.firstMatch(in: rest, range: fullRange(rest)) else { return false }
        let restItems = splitText((rest as NSString).substring(to: conj.range.location), by: commaSlashRegex).items
        if items.count + restItems.count - 1 > maxListItems { return false }
        return restItems.allSatisfy(isListItem)
    }

    // MARK: - 2. Family history

    /// True when the occurrence [start, end) sits in a family-history clause.
    static func familyHistoryAt(_ lower: String, _ start: Int, _ end: Int) -> Bool {
        familyHistoryAt(scalars: Array(lower.unicodeScalars), start, end)
    }

    static func familyHistoryAt(scalars s: [Unicode.Scalar], _ start: Int, _ end: Int) -> Bool {
        guard start >= 0, start <= s.count else { return false }
        let before = text(s, sentenceStart(s, start), max(start, min(end, start + 12)))
        guard let re = familyRegex, let last = re.matches(in: before, range: fullRange(before)).last else { return false }
        let tail = (before as NSString).substring(from: last.range.location + last.range.length)
        return !test(familyContrastRegex, tail)
    }

    // MARK: - 3. Attributed guess

    /// A lay person's or referrer's guess ("Mother thought it was a hernia").
    static func attributedAt(_ lower: String, _ start: Int) -> Bool {
        attributedAt(scalars: Array(lower.unicodeScalars), start)
    }

    static func attributedAt(scalars s: [Unicode.Scalar], _ start: Int) -> Bool {
        guard start >= 0, start <= s.count else { return false }
        return test(attributedRegex, text(s, clauseStart(s, start), start))
    }

    // MARK: - 4. Query

    /// A query or a referral label right before the term ("?appendicitis", "query appendicitis").
    static func queryAt(_ lower: String, _ start: Int) -> Bool {
        queryAt(scalars: Array(lower.unicodeScalars), start)
    }

    static func queryAt(scalars s: [Unicode.Scalar], _ start: Int) -> Bool {
        guard start >= 0, start <= s.count else { return false }
        let from = max(0, start - queryLookback)
        return test(queryRegex, (from == 0 ? " " : "") + text(s, from, start))
    }

    // MARK: - 5. Relief that failed

    /// The clause around [start, end): the sentence, cut at contrast words.
    static func clauseAround(_ lower: String, _ start: Int, _ end: Int) -> String {
        clauseAround(scalars: Array(lower.unicodeScalars), start, end)
    }

    static func clauseAround(scalars s: [Unicode.Scalar], _ start: Int, _ end: Int) -> String {
        let s0 = sentenceStart(s, start)
        let e0 = sentenceEnd(s, end)
        var cs = s0
        var ce = e0
        let seg = text(s, s0, e0)
        let nsSeg = seg as NSString
        if let re = contrastWordsRegex {
            for m in re.matches(in: seg, range: fullRange(seg)) {
                let at = s0 + nsSeg.substring(to: m.range.location).unicodeScalars.count
                let length = nsSeg.substring(with: m.range).unicodeScalars.count
                if at + length <= start {
                    cs = at + length
                } else if at >= end {
                    ce = at
                    break
                }
            }
        }
        return text(s, cs, ce)
    }

    /// True when the clause around the occurrence says the remedy did not help.
    static func reliefFailedAt(_ lower: String, _ start: Int, _ end: Int) -> Bool {
        reliefFailedAt(scalars: Array(lower.unicodeScalars), start, end)
    }

    static func reliefFailedAt(scalars s: [Unicode.Scalar], _ start: Int, _ end: Int) -> Bool {
        test(noHelpRegex, clauseAround(scalars: s, start, end))
    }

    /// Database terms: an occurrence about a relative, a lay guess or a query is not about the patient.
    static func notAboutPatientAt(_ lower: String, _ start: Int, _ end: Int) -> Bool {
        notAboutPatientAt(scalars: Array(lower.unicodeScalars), start, end)
    }

    static func notAboutPatientAt(scalars s: [Unicode.Scalar], _ start: Int, _ end: Int) -> Bool {
        familyHistoryAt(scalars: s, start, end) || attributedAt(scalars: s, start) || queryAt(scalars: s, start)
    }
}
