import Foundation

// MARK: - Negation-aware free-text matching
//
// Swift twin of `lib/triage-engine/src/negation.ts` (web). Same rule, same cue lists, same windows;
// the test vectors in `AmiseMedFlowTests/NegationMatcherTests.swift` mirror
// `artifacts/dashboard/src/lib/__tests__/negation.test.ts`. Change both together.
//
// Clinicians document pertinent negatives ("No guarding, no rebound", "Murphy's sign negative",
// "afebrile", "not jaundiced", "No crepitus"). A plain `contains` reads those as positive findings,
// which raised alarms and escalations for patients without the finding (clinical validation,
// 2026-09). Free-text finding detection goes through `NegationMatcher` instead.
//
// The rule (a small, deterministic NegEx-style check), applied to each occurrence of a term:
//
//  1. PRE-NEGATION. The occurrence is negated when a negation cue precedes it in the same clause,
//     with at most N words in between:
//       - N = 5: "no", "not", "nil", "denies"/"denied", "without", "never", "neither", "absence",
//         contractions such as "doesn't"/"didn't"/"isn't" (NOT "can't"/"cannot"/"unable": "can't
//         swallow" is a complaint), and the phrases "free of", "negative for".
//       - N = 1: "negative", "neg", "absent", "-ve" ("negative Murphy's sign").
//       - N = 0: "non" ("non-tender" negates "tender"; "non-bilious vomiting" does not negate
//         "vomiting").
//  2. POST-NEGATION. The occurrence is negated when, in the same clause, it is followed by
//     "negative", "neg", "-ve", "absent", "nil", "none", "excluded", "ruled out" or "not
//     present/seen/elicited/…", with at most one word in between (copulas such as "is"/"was" are
//     not counted, and a ":" or spaced dash may sit in between).
//  3. FUSED NEGATIVES. A term found inside one of a short list of negating words is negated:
//     "febrile" in "afebrile", "icteric" in "anicteric", "tender" in "nontender", "pain" in
//     "painless", "reducible" in "irreducible"; "pain-free"/"symptom-free" likewise.
//
// Scope ends at sentence punctuation (. ; : ! ? brackets, a new line, a spaced dash), at a comma
// (unless the comma is part of a "no A, B or C" list), and at words that start a new assertion:
// "but", "however", "and", "with", "has", "shows", "reports", … . "or", "nor" and "/" continue it.
//
// Pseudo-negations do not negate: "no change", "no improvement", "not improving", "not relieved",
// "no doubt", "not excluded", "cannot be excluded", "not ruled out", "nil by mouth", "without delay".
//
// SAFETY BIAS: when negation is uncertain the match is KEPT (over-triage is safer than missing an
// emergency). Hedges such as "?", "query", "possible", "cannot exclude", "to exclude" are never
// negations, and double negatives ("hasn't stopped bleeding") keep the finding.
//
// Matching is case-insensitive. A term keeps plain substring semantics by default ("append" still
// finds "appendicitis"); pass `wholeWord: true` to require word boundaries, or `wordStart: true`
// for a boundary before the term only.
//
// Offsets (`Match.index`, `isNegated(start:end:)`) count Unicode scalars of the lowercased text.

enum NegationMatcher {

    struct Match: Equatable {
        /// Offset of the match in the lowercased text (Unicode scalars).
        let index: Int
        /// The matched text (lowercased).
        let text: String
    }

    /// Lowercased, tokenised text. Build once and test many terms against it.
    struct Source {
        let lower: String
        fileprivate let s: [Unicode.Scalar]
        fileprivate let tokens: [Token]

        init(_ text: String) {
            let l = text.lowercased()
            let scalars = Array(l.unicodeScalars)
            lower = l
            s = scalars
            tokens = NegationMatcher.tokenize(scalars)
        }

        /// Every occurrence of `term`, affirmed or not.
        func occurrences(of term: String, wholeWord: Bool = false, wordStart: Bool = false) -> [Match] {
            let t = Array(term.lowercased().unicodeScalars)
            guard !t.isEmpty, t.count <= s.count else { return [] }
            let text = term.lowercased()
            var out: [Match] = []
            let last = s.count - t.count
            var i = 0
            while i <= last {
                if s[i] == t[0] {
                    var k = 1
                    while k < t.count && s[i + k] == t[k] { k += 1 }
                    if k == t.count {
                        let keep: Bool
                        if wholeWord {
                            keep = NegationMatcher.wholeWordOk(s, i, t)
                        } else if wordStart, NegationMatcher.isWordChar(t[0]), i > 0,
                                  NegationMatcher.isWordChar(s[i - 1]) {
                            keep = false
                        } else {
                            keep = true
                        }
                        if keep { out.append(Match(index: i, text: text)) }
                    }
                }
                i += 1
            }
            return out
        }

        /// Every occurrence of `term` that is not negated.
        func findAll(_ term: String, wholeWord: Bool = false, wordStart: Bool = false) -> [Match] {
            occurrences(of: term, wholeWord: wholeWord, wordStart: wordStart)
                .filter { !isNegated(start: $0.index, end: $0.index + $0.text.unicodeScalars.count) }
        }

        /// The first occurrence of `term` that is not negated, or nil.
        func find(_ term: String, wholeWord: Bool = false, wordStart: Bool = false) -> Match? {
            occurrences(of: term, wholeWord: wholeWord, wordStart: wordStart)
                .first { !isNegated(start: $0.index, end: $0.index + $0.text.unicodeScalars.count) }
        }

        /// True when `term` occurs at least once without being negated.
        func contains(_ term: String, wholeWord: Bool = false, wordStart: Bool = false) -> Bool {
            find(term, wholeWord: wholeWord, wordStart: wordStart) != nil
        }

        /// True when any of `terms` occurs without being negated.
        func containsAny(_ terms: [String], wholeWord: Bool = false, wordStart: Bool = false) -> Bool {
            terms.contains { self.contains($0, wholeWord: wholeWord, wordStart: wordStart) }
        }

        /// The first of `terms` (in list order) that occurs without being negated.
        func firstAffirmed(_ terms: [String], wholeWord: Bool = false, wordStart: Bool = false) -> String? {
            terms.first { self.contains($0, wholeWord: wholeWord, wordStart: wordStart) }
        }

        /// Negation-aware regular-expression test (case-insensitive).
        func matches(_ pattern: NSRegularExpression) -> Bool {
            let range = NSRange(location: 0, length: (lower as NSString).length)
            for r in pattern.matches(in: lower, options: [], range: range) where r.range.length > 0 {
                guard let found = Range(r.range, in: lower) else { continue }
                let scalars = lower.unicodeScalars
                let start = scalars.distance(from: scalars.startIndex, to: found.lowerBound)
                let end = start + scalars.distance(from: found.lowerBound, to: found.upperBound)
                if !isNegated(start: start, end: end) { return true }
            }
            return false
        }

        /// True when the text between `start` and `end` (scalar offsets into `lower`) is negated
        /// by its context.
        func isNegated(start: Int, end: Int) -> Bool {
            NegationMatcher.negatedAt(s, start, end, tokens)
        }
    }

    // MARK: - Convenience

    /// True when `term` occurs in `text` at least once without being negated.
    static func containsAffirmed(_ text: String, _ term: String,
                                 wholeWord: Bool = false, wordStart: Bool = false) -> Bool {
        guard !text.isEmpty else { return false }
        return Source(text).contains(term, wholeWord: wholeWord, wordStart: wordStart)
    }

    /// True when any of `terms` occurs in `text` without being negated.
    static func containsAnyAffirmed(_ text: String, _ terms: [String],
                                    wholeWord: Bool = false, wordStart: Bool = false) -> Bool {
        guard !text.isEmpty else { return false }
        return Source(text).containsAny(terms, wholeWord: wholeWord, wordStart: wordStart)
    }

    /// The first occurrence of `term` in `text` that is not negated, or nil.
    static func findAffirmed(_ text: String, _ term: String,
                             wholeWord: Bool = false, wordStart: Bool = false) -> Match? {
        guard !text.isEmpty else { return nil }
        return Source(text).find(term, wholeWord: wholeWord, wordStart: wordStart)
    }

    /// Negation-aware `pattern` test; `pattern` is compiled case-insensitive. An invalid pattern
    /// never matches.
    static func testAffirmed(_ pattern: String, _ text: String) -> Bool {
        guard !text.isEmpty,
              let re = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return false }
        return Source(text).matches(re)
    }

    /// True when the text between `start` and `end` (scalar offsets into the lowercased text) is
    /// negated by its context.
    static func isNegatedAt(_ text: String, start: Int, end: Int) -> Bool {
        Source(text).isNegated(start: start, end: end)
    }

    /// Join list items (exam fields, PMH entries) into one text for matching, with a sentence break
    /// between items so a negation in one item cannot reach into the next.
    static func joinClauses(_ items: [String?]) -> String {
        items.compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: ".\n")
    }

    // MARK: - Tokens

    fileprivate enum TokenKind { case word, comma, slash, hyphen, colon, hard }

    fileprivate struct Token {
        let kind: TokenKind
        let text: String
        let start: Int
        let end: Int
    }

    private static let hardBreaks: Set<Unicode.Scalar> = [
        ".", ";", "!", "?", "(", ")", "[", "]", "{", "}", "\n", "\r", "\u{2022}", "|",
    ]
    private static let rightQuote: Unicode.Scalar = "\u{2019}"

    fileprivate static func isLetter(_ c: Unicode.Scalar) -> Bool {
        switch c.properties.generalCategory {
        case .uppercaseLetter, .lowercaseLetter, .titlecaseLetter, .modifierLetter, .otherLetter: return true
        default: return false
        }
    }

    fileprivate static func isNumber(_ c: Unicode.Scalar) -> Bool {
        switch c.properties.generalCategory {
        case .decimalNumber, .letterNumber, .otherNumber: return true
        default: return false
        }
    }

    fileprivate static func isWordChar(_ c: Unicode.Scalar) -> Bool { isLetter(c) || isNumber(c) }

    private static func isASCIIDigit(_ c: Unicode.Scalar) -> Bool { c.value >= 48 && c.value <= 57 }

    private static func isApostrophe(_ c: Unicode.Scalar) -> Bool { c == "'" || c == rightQuote }

    /// "-", en dash, em dash (inside a spaced dash).
    private static func isSpacedDashChar(_ c: Unicode.Scalar) -> Bool {
        c == "-" || c == "\u{2013}" || c == "\u{2014}"
    }

    fileprivate static func string(_ s: [Unicode.Scalar], _ a: Int, _ b: Int) -> String {
        var v = String.UnicodeScalarView()
        if a < b { v.append(contentsOf: s[a..<b]) }
        return String(v)
    }

    /// Same tokens as the web TOKEN_RE: a number (with decimals and a unit: "36.8", "4mm"), or a word
    /// with internal apostrophes ("murphy's", "doesn't"); then the punctuation that matters for scope.
    fileprivate static func tokenize(_ s: [Unicode.Scalar]) -> [Token] {
        var tokens: [Token] = []
        let n = s.count
        func tokenText(_ a: Int, _ b: Int) -> String {
            var v = String.UnicodeScalarView()
            for k in a..<b { v.append(s[k] == rightQuote ? "'" : s[k]) }
            return String(v)
        }
        func push(_ kind: TokenKind, _ a: Int, _ b: Int) {
            tokens.append(Token(kind: kind, text: tokenText(a, b), start: a, end: b))
        }
        var i = 0
        while i < n {
            let c = s[i]
            if isASCIIDigit(c) {
                var j = i
                while j < n && isASCIIDigit(s[j]) { j += 1 }
                if j + 1 < n && s[j] == "." && isASCIIDigit(s[j + 1]) {
                    j += 1
                    while j < n && isASCIIDigit(s[j]) { j += 1 }
                }
                while j < n && isLetter(s[j]) { j += 1 }
                push(.word, i, j); i = j; continue
            }
            if isWordChar(c) {
                var j = i
                while j < n && isWordChar(s[j]) { j += 1 }
                while j + 1 < n && isApostrophe(s[j]) && isLetter(s[j + 1]) {
                    j += 1
                    while j < n && isLetter(s[j]) { j += 1 }
                }
                push(.word, i, j); i = j; continue
            }
            if c.properties.isWhitespace {
                var j = i + 1
                while j < n && isSpacedDashChar(s[j]) { j += 1 }
                if j > i + 1 && j < n && s[j].properties.isWhitespace {
                    push(.colon, i, j + 1); i = j + 1; continue   // spaced dash: same role as a colon
                }
            }
            if c == ":" { push(.colon, i, i + 1); i += 1; continue }
            if hardBreaks.contains(c) { push(.hard, i, i + 1); i += 1; continue }
            if c == "," { push(.comma, i, i + 1); i += 1; continue }
            if c == "/" { push(.slash, i, i + 1); i += 1; continue }
            if c == "-" || c == "\u{2013}" { push(.hyphen, i, i + 1); i += 1; continue }
            i += 1
        }
        return tokens
    }

    // MARK: - Cue lists (identical to negation.ts)

    /// Pre-negation cues → the number of words allowed between the cue and the term.
    private static let preCues: [String: Int] = [
        "no": 5, "not": 5, "nil": 5, "denies": 5, "denied": 5, "deny": 5, "denying": 5, "without": 5,
        "never": 5, "neither": 5, "absence": 5,
        "negative": 1, "neg": 1, "absent": 1,
        "non": 0,
    ]

    /// Contractions that negate (deliberately excludes can't / couldn't / won't: "can't swallow").
    private static let negatingContractions: Set<String> = [
        "doesn't", "don't", "didn't", "isn't", "wasn't", "aren't", "weren't", "hasn't", "haven't", "hadn't",
    ]

    /// Words that, directly after a cue, make it a pseudo-negation ("no change", "not improving").
    private static let pseudoAfter: [String: Set<String>] = [
        "no": ["change", "changes", "increase", "improvement", "better", "relief", "doubt", "significant"],
        "not": [
            "only", "improving", "improved", "improve", "relieved", "settling", "settled", "responding", "responded",
            "controlled", "certain", "sure", "clear", "excluded", "ruled", "necessarily",
        ],
        "without": ["improvement", "relief", "response", "delay"],
        "nil": ["by"],
    ]

    /// Words that end a negation scope: a new assertion starts.
    private static let scopeTerminators: Set<String> = [
        "but", "however", "although", "though", "except", "yet", "whereas", "while", "whilst", "apart", "other",
        "besides", "despite", "and", "with", "which", "who", "has", "have", "had", "shows", "showed", "showing",
        "reveals", "revealed", "demonstrates", "demonstrated", "plus", "then", "now", "still", "because", "due",
        "reports", "reported", "complains", "complained", "presents", "presented", "describes", "described",
    ]

    /// Words that continue a negation scope without counting towards the window.
    private static let scopeContinuers: Set<String> = ["or", "nor"]

    /// Post-negation cues.
    private static let postCues: Set<String> = ["negative", "neg", "absent", "nil", "none", "excluded"]

    /// "not X" after a term: "rebound not elicited".
    private static let notFollowers: Set<String> = [
        "present", "seen", "elicited", "demonstrated", "identified", "detected", "found", "palpable", "felt", "noted",
        "evident", "visualised", "visualized", "appreciated",
    ]

    /// Words skipped (not counted) between a term and a post-cue.
    private static let copulas: Set<String> = [
        "is", "was", "are", "were", "be", "been", "remains", "remained", "appears", "appeared",
    ]

    /// Whole words that negate a root found inside them.
    private static let fusedNegatives: Set<String> = [
        "afebrile", "apyrexial", "apyrexic", "anicteric", "asymptomatic", "atraumatic",
        "nontender", "nondistended", "nonpalpable", "impalpable", "irreducible", "painless",
    ]

    /// "pain-free", "symptom-free": the term's word followed by a hyphen and one of these.
    private static let hyphenFree: Set<String> = ["free"]

    /// After "not", "never" or a negating contraction: a double negative or a hedge ("hasn't stopped
    /// bleeding", "not settling", "don't know if it's bleeding") — the finding is present or uncertain.
    private static let pseudoAfterVerbNegation: Set<String> = [
        "stopped", "stopping", "stop", "gone", "going", "settled", "settling", "eased", "easing", "better", "improved",
        "improving", "resolved", "resolving", "subsided", "subsiding", "relieved", "controlled", "responding", "responded",
        "know", "think", "remember", "sure", "certain",
    ]

    /// Words between a verb negation and a double-negative verb ("has not yet settled").
    private static let verbNegationFillers: Set<String> = ["yet", "really", "fully", "completely", "been", "had"]

    private static let maxPreWindow = 6

    // MARK: - Rule

    /// Index of the first token that ends after `pos`, i.e. the token containing or following it.
    private static func firstTokenAtOrAfter(_ tokens: [Token], _ pos: Int) -> Int {
        var lo = 0
        var hi = tokens.count
        while lo < hi {
            let mid = (lo + hi) >> 1
            if tokens[mid].end <= pos { lo = mid + 1 } else { hi = mid }
        }
        return lo
    }

    private static func nextWordIndex(_ tokens: [Token], _ i: Int) -> Int {
        var j = i + 1
        while j < tokens.count {
            if tokens[j].kind == .hyphen { j += 1; continue }
            return tokens[j].kind == .word ? j : -1
        }
        return -1
    }

    private static func prevWordIndex(_ tokens: [Token], _ i: Int) -> Int {
        var j = i - 1
        while j >= 0 {
            if tokens[j].kind == .hyphen { j -= 1; continue }
            return tokens[j].kind == .word ? j : -1
        }
        return -1
    }

    /// A comma inside "no A, B or C": an "or"/"nor" follows before the clause ends.
    private static func commaContinuesList(_ tokens: [Token], _ commaIdx: Int) -> Bool {
        var seen = 0
        var j = commaIdx + 1
        while j < tokens.count && seen < 14 {
            let t = tokens[j]
            if t.kind == .hard || t.kind == .colon { return false }
            if t.kind == .word {
                seen += 1
                if scopeContinuers.contains(t.text) { return true }
                if scopeTerminators.contains(t.text) { return false }
            }
            j += 1
        }
        return false
    }

    /// The cue ending at token i, with its window, or nil.
    private static func cueAt(_ tokens: [Token], _ i: Int) -> Int? {
        let w = tokens[i].text
        if w == "ve" && i > 0 && tokens[i - 1].kind == .hyphen { return 1 }   // "-ve"
        if w == "of" {
            let p = prevWordIndex(tokens, i)
            return p >= 0 && tokens[p].text == "free" ? 5 : nil               // "free of"
        }
        if w == "for" {
            let p = prevWordIndex(tokens, i)
            return p >= 0 && (tokens[p].text == "negative" || tokens[p].text == "neg") ? 5 : nil   // "negative for"
        }
        if negatingContractions.contains(w) { return 5 }
        return preCues[w]
    }

    private static func isPseudoNegation(_ tokens: [Token], _ cueIdx: Int) -> Bool {
        let cue = tokens[cueIdx].text
        let n = nextWordIndex(tokens, cueIdx)
        if n < 0 { return false }
        let next = tokens[n].text
        if pseudoAfter[cue]?.contains(next) == true { return true }
        let verbNegation = cue == "not" || cue == "never" || negatingContractions.contains(cue)
        if verbNegation && pseudoAfterVerbNegation.contains(next) { return true }
        // "doesn't seem to have stopped", "has not yet settled": look one word further.
        let n2 = nextWordIndex(tokens, n)
        return (cue == "not" || negatingContractions.contains(cue)) && n2 >= 0
            && pseudoAfterVerbNegation.contains(tokens[n2].text)
            && verbNegationFillers.contains(next)
    }

    private static func preNegated(_ tokens: [Token], _ wordStart: Int) -> Bool {
        var start = firstTokenAtOrAfter(tokens, wordStart) - 1
        // Skip tokens that overlap the term's own word.
        while start >= 0 && tokens[start].end > wordStart { start -= 1 }
        var words = 0
        for i in stride(from: start, through: 0, by: -1) {
            let t = tokens[i]
            if t.kind == .hard || t.kind == .colon { return false }
            if t.kind == .hyphen || t.kind == .slash { continue }
            if t.kind == .comma {
                if !commaContinuesList(tokens, i) { return false }
                continue
            }
            if scopeContinuers.contains(t.text) { continue }
            if scopeTerminators.contains(t.text) {
                // "doesn't have a fever", "does not have", "has not had": part of the negation.
                let p = prevWordIndex(tokens, i)
                let pw = p >= 0 ? tokens[p].text : ""
                let negatedVerb = (t.text == "have" || t.text == "has" || t.text == "had")
                    && (pw == "not" || pw == "never" || negatingContractions.contains(pw))
                if !negatedVerb { return false }
                continue
            }
            // A two-word cue ("free of", "negative for") is found at its last word.
            if let window = cueAt(tokens, i) {
                if isPseudoNegation(tokens, i) { return false }
                return words <= window
            }
            words += 1
            if words > maxPreWindow { return false }
        }
        return false
    }

    private static func postNegated(_ tokens: [Token], _ wordEnd: Int) -> Bool {
        var j = firstTokenAtOrAfter(tokens, wordEnd)
        // Skip the rest of the term's own word (e.g. the "'s" of "murphy's").
        while j < tokens.count && tokens[j].start < wordEnd { j += 1 }
        var words = 0
        while j < tokens.count {
            let t = tokens[j]
            if t.kind == .hard || t.kind == .comma || t.kind == .slash { return false }
            if t.kind == .colon { j += 1; continue }   // "guarding: absent", "Murphy's – negative"
            if t.kind == .hyphen {
                if j + 1 < tokens.count && tokens[j + 1].kind == .word && tokens[j + 1].text == "ve" { return true }
                j += 1
                continue
            }
            let w = t.text
            if copulas.contains(w) { j += 1; continue }
            if postCues.contains(w) {
                // "cannot be excluded", "not excluded", "not been excluded": a hedge, not a negation.
                if w == "excluded" {
                    var k = j - 1
                    var seen = 0
                    while k >= 0 && seen < 3 {
                        if tokens[k].kind == .word {
                            seen += 1
                            let pw = tokens[k].text
                            if pw == "not" || pw == "cannot" || pw == "can't" || pw == "couldn't" || pw.hasSuffix("n't") {
                                return false
                            }
                        }
                        k -= 1
                    }
                }
                return true
            }
            if w == "ruled" {
                let n = nextWordIndex(tokens, j)
                if n >= 0 && tokens[n].text == "out" {
                    let p = prevWordIndex(tokens, j)
                    if p >= 0 && (tokens[p].text == "not" || tokens[p].text == "cannot" || tokens[p].text == "be") {
                        return false
                    }
                    return true
                }
            }
            if w == "not" {
                let n = nextWordIndex(tokens, j)
                return n >= 0 && notFollowers.contains(tokens[n].text)
            }
            words += 1
            if words > 1 { return false }
            j += 1
        }
        return false
    }

    fileprivate static func negatedAt(_ s: [Unicode.Scalar], _ start: Int, _ end: Int, _ tokens: [Token]) -> Bool {
        guard start >= 0, end <= s.count, start < end else { return false }
        // Word containing the match.
        var ws = start
        while ws > 0 && isWordChar(s[ws - 1]) { ws -= 1 }
        var we = end
        while we < s.count && isWordChar(s[we]) { we += 1 }
        let fused = start != ws || end != we
        if fused && fusedNegatives.contains(string(s, ws, we)) { return true }
        // "pain-free", "symptom-free"
        if we < s.count && s[we] == "-" {
            var e = we + 1
            while e < s.count && isLetter(s[e]) { e += 1 }
            if hyphenFree.contains(string(s, we + 1, e)) { return true }
        }
        if preNegated(tokens, ws) { return true }
        return postNegated(tokens, we)
    }

    /// Word boundaries around a term: before it when it starts with a letter or digit, and after it
    /// when it ends with a letter (a plural "s"/"es" is allowed after a final word of four or more
    /// letters, so "adhesion" still finds "adhesions"). A term ending in a digit may be followed by
    /// more digits ("k35.3" finds "K35.30").
    fileprivate static func wholeWordOk(_ s: [Unicode.Scalar], _ index: Int, _ t: [Unicode.Scalar]) -> Bool {
        guard let first = t.first, let last = t.last else { return false }
        if isWordChar(first) && index > 0 && isWordChar(s[index - 1]) { return false }
        if isLetter(last) {
            let after = index + t.count
            if after >= s.count || !isWordChar(s[after]) { return true }
            // Allow a plural after a final word of 4+ letters: "adhesion" → "adhesions".
            var k = t.count
            while k > 0 && isLetter(t[k - 1]) { k -= 1 }
            if t.count - k >= 4 {
                var e = after
                while e < s.count && isWordChar(s[e]) { e += 1 }
                let rest = string(s, after, e)
                return rest == "s" || rest == "es"
            }
            return false
        }
        return true
    }
}
