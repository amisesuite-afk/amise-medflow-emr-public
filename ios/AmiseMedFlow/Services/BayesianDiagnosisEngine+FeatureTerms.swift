// BayesianDiagnosisEngine+FeatureTerms.swift
// How a DiagnosticDatabase.json term ("complaint", "finding", "findingAbsent", "notFinding"
// features: "a|b&c") is found in record text. Negation-aware through NegationMatcher.
//
//  - A term is matched at a word start ("append" finds "appendicitis", "haemorrhoid" finds
//    "haemorrhoids"), as before.
//  - SHORT TERMS: a term of four letters or digits or fewer is matched as a whole word (with a plural
//    "s"/"es"): "sti" no longer fires on "still" or "stiffness", "stab" on "stabbing", "burn" on
//    "burning", "lip" on "lipase", "gas" on "gastric", "rat" on "rate", "foot" on "football".
//    Terms written short on purpose as word stems (`stems`: "dizz" → dizziness, "smok" → smoker,
//    "numb" → numbness …) keep word-start matching. The database content is unchanged
//    (docs/clinical-validation/changes/followups-history.md).
//  - CLAUSES: an occurrence about a relative, a lay guess or a query ("?appendicitis") does not
//    count, and an item of a negated list ("no pain, jaundice or fever") is negated
//    (RecordClauses, twin of lib/triage-engine/src/record-clauses.ts).
//  - COUGH: a symptom term ("cough", "cough …") counts only a cough mention that records the
//    symptom, and "coughing" (the manoeuvre, as in "movement|twisting|lifting|strain|coughing") only
//    one that records an aggravating factor (CoughMention): "pain worse on coughing", a chip read as
//    "aggravating: Coughing" (ChipDimensions) and "cough impulse" are not a cough.
//
// lint:history-frames reads `stems` from this file (scripts/src/history-frames-audit.ts), so the
// chip audit matches terms the same way.

import Foundation

enum FeatureTerm {

    /// Short terms the database writes as word stems: matched at a word start, not as whole words.
    static let stems: Set<String> = [
        "anxi", "dizz", "obes", "ovar", "shak", "smok", "worr", "tars",
        "numb", "weak", "itch", "walk", "leak", "warm", "fall", "farm", "pain",
    ]

    /// Longest term (letters or digits only) matched as a whole word.
    static let shortTermMaxLength = 4

    /// True when `term` (lower case) is matched as a whole word.
    static func isShortWord(_ term: String) -> Bool {
        let scalars = term.unicodeScalars
        guard !scalars.isEmpty, scalars.count <= shortTermMaxLength, !stems.contains(term) else { return false }
        return scalars.allSatisfy { CharacterSet.alphanumerics.contains($0) }
    }

    /// The cough mention a term needs, or nil when the term is not about the cough symptom or the
    /// cough manoeuvre ("cough impulse", "cough tender" are examination signs, matched as written).
    static func coughKind(of term: String) -> CoughMention.Kind? {
        guard term.hasPrefix("cough") else { return nil }
        if term.contains("impulse") || term.contains("tender") { return nil }
        if term == "coughing" { return .aggravating }
        if term == "cough" || term == "coughs" || term == "coughed" || term.hasPrefix("cough ") { return .symptom }
        return nil
    }
}

extension BayesianDiagnosisEngine {

    /// Every occurrence of a database term in `source` the engine counts, affirmed or not.
    static func termOccurrences(_ term: String, in source: NegationMatcher.Source) -> [NegationMatcher.Match] {
        var found: [NegationMatcher.Match]
        if FeatureTerm.isShortWord(term) {
            found = source.occurrences(of: term, wholeWord: true)
            // NegationMatcher allows a plural after a final word of four or more letters only.
            if term.unicodeScalars.count <= 3, let last = term.unicodeScalars.last,
               CharacterSet.letters.contains(last) {
                found += source.occurrences(of: term + "s", wholeWord: true)
            }
        } else {
            found = source.occurrences(of: term, wordStart: true)
        }
        if let kind = FeatureTerm.coughKind(of: term), !found.isEmpty {
            found = found.filter { CoughMention.kind(inLowercased: source.lower, at: $0.index) == kind }
        }
        // Clause-aware reading (RecordClauses, twin of record-clauses.ts): a relative's condition
        // ("mother had breast cancer"), a lay or referrer's guess ("thought it was a hernia") and a
        // query ("referred as ?appendicitis") are not findings about the patient.
        if !found.isEmpty {
            let scalars = source.scalars
            found = found.filter { m in
                !RecordClauses.notAboutPatientAt(scalars: scalars, m.index, m.index + m.text.unicodeScalars.count)
            }
        }
        return found
    }

    /// True when a database term occurs in `source` at least once without being negated (by
    /// NegationMatcher, or as an item of a negated list: "never had pain, jaundice or fever",
    /// "Negative for blood, leucocytes and nitrites").
    static func termAffirmed(_ term: String, in source: NegationMatcher.Source) -> Bool {
        termOccurrences(term, in: source).contains { m in
            !source.isNegated(start: m.index, end: m.index + m.text.unicodeScalars.count)
                && !RecordClauses.listNegatedAt(scalars: source.scalars, m.index)
        }
    }
}
