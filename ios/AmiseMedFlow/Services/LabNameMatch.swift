// LabNameMatch.swift
// Whole-word matching of an investigation name against the lab keywords the readers use
// (`Patient.latestLab(named:)`, `LabPanel.parse(from:)`, `LabScoreKeywords`, the Bayesian lab chips).
// Pure and deterministic.
//
// Substring matching read hand-typed names as the wrong analyte, and the scores and critical-value
// checks then used that number: "HbA1c" and "HBsAg" contain "hb" (haemoglobin), "Fasting glucose"
// and "Gastrin" contain "ast", "Alpha fetoprotein" contains "alp", "Lactate dehydrogenase"
// contains "lactate", "Urine sodium" contains "sodium". Here a keyword matches only as whole words:
//   - the name is split into lowercase words at spaces and punctuation ("PT/INR" → pt, inr;
//     "CA 19-9" → ca, 19, 9); "+" stays in the word, so "Ca++" (ionised) is not "Ca";
//   - every word of the keyword must appear, in order and next to each other, in the name
//     ("white cell" matches "White cell count", not "Red cell count");
//   - a keyword word of four or more letters also matches its plural ("platelet" ~ "Platelets");
//   - a name that also has a word naming another specimen ("Urine glucose") or another test
//     ("Glycated haemoglobin", "Direct bilirubin", "Albumin/globulin ratio") does not match,
//     unless the keyword itself contains that word ("lactate dehydrogenase" still matches LDH).
// LabKeywordMatchingTests covers the collisions.

import Foundation

enum LabNameMatch {

    /// Lowercase words: runs of letters, digits and "+". Everything else separates.
    static func words(of text: String) -> [String] {
        var out: [String] = []
        var current = ""
        for ch in text.lowercased() {
            if ch.isLetter || ch.isNumber || ch == "+" {
                current.append(ch)
            } else if !current.isEmpty {
                out.append(current)
                current = ""
            }
        }
        if !current.isEmpty { out.append(current) }
        return out
    }

    /// Words that make a name a non-blood specimen. Every reader here reads blood values.
    static let otherSpecimenWords: Set<String> = [
        "urine", "urinary", "urinalysis", "csf", "fluid", "ascitic", "pleural", "peritoneal",
        "drain", "stool", "faecal", "fecal", "sputum", "synovial",
    ]

    private static let haemoglobinVariants: Set<String> = [
        "a1c", "glycated", "glycosylated", "mean", "corpuscular", "electrophoresis", "variant",
        "variants", "a2", "s", "f", "c", "e",
    ]

    /// Keyword word → words that make the name a different test.
    static let otherTestWords: [String: Set<String>] = [
        "haemoglobin": haemoglobinVariants,
        "hemoglobin": haemoglobinVariants,
        "hgb": haemoglobinVariants,
        "hb": haemoglobinVariants,
        "bilirubin": ["direct", "indirect", "conjugated", "unconjugated", "d"],
        "calcium": ["ionised", "ionized", "ionic", "channel", "score"],
        "lactate": ["dehydrogenase"],
        "lactic": ["dehydrogenase"],
        "glucose": ["dehydrogenase", "phosphate"],
        "leucocyte": ["esterase"],
        "leukocyte": ["esterase"],
        "albumin": ["globulin", "ratio", "creatinine", "acr"],
        "creatinine": ["ratio", "clearance", "albumin", "protein", "kinase", "acr", "pcr"],
        "urea": ["breath"],
        "sodium": ["valproate"],
        "platelet": ["mean", "volume", "mpv", "function", "aggregation"],
    ]

    /// Whether the name (already split with `words(of:)`) contains `keyword` as whole words and
    /// names no other specimen or test.
    static func matches(_ nameWords: [String], keyword: String) -> Bool {
        let kw = words(of: keyword)
        guard !kw.isEmpty, kw.count <= nameWords.count else { return false }
        let found = (0...(nameWords.count - kw.count)).contains { start in
            kw.indices.allSatisfy { sameWord(nameWords[start + $0], kw[$0]) }
        }
        guard found else { return false }
        return !namesOtherTest(nameWords, keywordWords: kw)
    }

    static func matchesAny(_ nameWords: [String], _ keywords: [String]) -> Bool {
        keywords.contains { matches(nameWords, keyword: $0) }
    }

    static func matches(name: String, keyword: String) -> Bool {
        matches(words(of: name), keyword: keyword)
    }

    static func matchesAny(name: String, keywords: [String]) -> Bool {
        matchesAny(words(of: name), keywords)
    }

    /// The whole name is this keyword, punctuation aside ("Na", "NA:"), for short keywords that
    /// are too ambiguous inside longer names.
    static func isExactly(_ nameWords: [String], _ keyword: String) -> Bool {
        nameWords == words(of: keyword)
    }

    private static func sameWord(_ word: String, _ keywordWord: String) -> Bool {
        word == keywordWord || (keywordWord.count >= 4 && word == keywordWord + "s")
    }

    private static func namesOtherTest(_ nameWords: [String], keywordWords: [String]) -> Bool {
        let own = Set(keywordWords)
        let otherTests = keywordWords.reduce(into: Set<String>()) { acc, k in
            acc.formUnion(otherTestWords[k] ?? [])
        }
        return nameWords.contains { w in
            !own.contains(w) && (otherSpecimenWords.contains(w) || otherTests.contains(w))
        }
    }
}
