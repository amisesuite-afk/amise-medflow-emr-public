// BayesianDiagnosisEngine+Context.swift
// Patient context the curated features read (DiagnosticDatabase.json 2.1.0), worked out once per
// differential from the same text the "finding" features read:
//   - the post-operative day written in the record ("postOpDay" features), and
//   - the masking contexts ("maskedBy" on a negative feature): older age, immunosuppression
//     (steroids, chemotherapy, transplant drugs …), diabetes and female sex. Under a masking
//     context a cardinal feature that is missing or documented absent is not evidence against the
//     diagnosis, because it is often absent in that group (peritonism on steroids or in the
//     elderly; chest pain in acute coronary syndrome in women, older people and people with
//     diabetes: Canto JAMA 2000 and 2012).
// Deterministic and on-device. Used by both copies of the scoring extension
// (BayesianDiagnosisEngine+Scoring.swift and BayesianDecisionEngine+Scoring.swift), which call it
// through the BayesianDiagnosisEngine type name.

import Foundation

extension BayesianDiagnosisEngine {

    // MARK: - Post-operative day

    /// A word that names an operation or a procedure ("thyroidectomy", "anterior resection",
    /// "Hartmann's procedure", "laparotomy").
    static let operationWordPattern =
        #"\b[a-z]*(ectomy|otomy|ostomy|plasty|pexy|rrhaphy)\b|\b(resection|repair|anastomos[a-z]*|laparotomy|laparoscop[a-z]*|operation|operated|surgery|procedure|hartmann[a-z']*|whipple)\b"#

    /// A sentence about an earlier episode ("in 2012", "3 years ago", "as a child", "previous …"):
    /// its operation is history, not the current post-operative course.
    static let pastEpisodePattern =
        #"\b(19|20)\d\d\b|\b(years?|months?|weeks?) ago\b|\bas a (child|baby|teenager)\b|\bprevious(ly)?\b|\bhistory of\b|\bin the past\b|\baged \d"#

    /// Day patterns, in order: "post-operative day 3" / "POD 3"; "day 5 after …"; "(day 6)";
    /// "5 days after / since …".
    static let postOpDayNumberPatterns = [
        #"\b(?:post-?op(?:erative)?\s+day|pod)\s*(\d{1,2})\b"#,
        #"\bday\s+(\d{1,2})\s+(?:after|post|following|since)\b"#,
        #"\(\s*day\s+(\d{1,2})\s*\)"#,
        #"\b(\d{1,2})\s+days?\s+(?:after|since|post|following)\b"#,
    ]

    /// The day after the current operation that the record describes, or nil when none is
    /// written: "Day 5 after laparoscopic anterior resection" → 5, "Open Hartmann's procedure
    /// (day 6)" → 6, "POD 3" → 3, "Total thyroidectomy … this morning" / "(today)" / "hours ago" →
    /// 0, "… yesterday" → 1. A number counts only in a sentence that names an operation and is not
    /// about an earlier episode ("caesarean section in 2012", "appendicectomy as a child"); "day 3
    /// of admission" or "ICU day 9" without an operation in the sentence count for nothing. When
    /// several days are written the smallest (the latest operation) is used. The structured
    /// operation date (Patient.postOpDays) is not passed to the differential; the text is.
    static func postOperativeDay(_ texts: [String]) -> Int? {
        guard let operation = try? NSRegularExpression(pattern: operationWordPattern, options: [.caseInsensitive]),
              let past = try? NSRegularExpression(pattern: pastEpisodePattern, options: [.caseInsensitive]) else { return nil }
        let dayPatterns = postOpDayNumberPatterns.compactMap { try? NSRegularExpression(pattern: $0, options: [.caseInsensitive]) }
        let sameDay = try? NSRegularExpression(
            pattern: #"\b(today|this morning|this afternoon|this evening|earlier today|tonight|last night|hours? ago)\b"#,
            options: [.caseInsensitive])
        let dayBefore = try? NSRegularExpression(pattern: #"\byesterday\b"#, options: [.caseInsensitive])

        func has(_ re: NSRegularExpression?, _ s: String) -> Bool {
            guard let re else { return false }
            return re.firstMatch(in: s, range: NSRange(location: 0, length: (s as NSString).length)) != nil
        }

        var days: [Int] = []
        for text in texts where !text.isEmpty {
            for sentence in FeatureText.sentenceSplit(text) {
                let s = sentence.lowercased()
                guard has(operation, s), !has(past, s) else { continue }
                let ns = s as NSString
                for re in dayPatterns {
                    for m in re.matches(in: s, range: NSRange(location: 0, length: ns.length)) where m.numberOfRanges > 1 {
                        if let n = Int(ns.substring(with: m.range(at: 1))) { days.append(n) }
                    }
                }
                if has(sameDay, s) { days.append(0) }
                if has(dayBefore, s) { days.append(1) }
            }
        }
        return days.min()
    }

    /// Whether `day` lies in a "postOpDay" feature value "a-b" (inclusive; "7-999" = day 7 or later).
    static func postOpDayMatches(_ value: String, day: Int?) -> Bool {
        guard let day else { return false }
        let parts = value.split(separator: "-").map { Int($0.trimmingCharacters(in: .whitespaces)) }
        guard parts.count == 2, let lo = parts[0], let hi = parts[1] else { return false }
        return day >= lo && day <= hi
    }

    // MARK: - Masking contexts

    /// Context names a curated feature may list under "maskedBy".
    enum MaskingContext: String, CaseIterable {
        /// Age 65 or over.
        case elderly
        /// Steroids, other immunosuppressants, chemotherapy, transplant, HIV, neutropenia.
        case immunosuppressed
        /// Diabetes (or a diabetes medicine) in the record.
        case diabetes
        /// Female sex.
        case female

        static let immunosuppressionTerms = [
            "steroid", "prednisolone", "prednisone", "dexamethasone", "hydrocortisone", "methylprednisolone",
            "immunosuppress", "chemotherapy", "methotrexate", "azathioprine", "tacrolimus", "ciclosporin",
            "cyclosporin", "mycophenolate", "infliximab", "adalimumab", "rituximab", "transplant", "hiv",
            "neutropen",
        ]
        static let diabetesTerms = [
            "diabet", "t2dm", "t1dm", "insulin", "metformin", "gliclazide", "sulfonylurea", "gliflozin",
        ]

        /// The contexts that apply to this patient. `record` is the complaint, HPI, examination,
        /// PMH and PSHx text, read negation-aware at word starts ("no diabetes" is not diabetes).
        static func active(age: Int, sex: Sex, record: NegationMatcher.Source) -> Set<MaskingContext> {
            var out = Set<MaskingContext>()
            if age >= 65 { out.insert(.elderly) }
            if sex == .female { out.insert(.female) }
            if record.containsAny(immunosuppressionTerms, wordStart: true) { out.insert(.immunosuppressed) }
            if record.containsAny(diabetesTerms, wordStart: true) { out.insert(.diabetes) }
            return out
        }
    }

    /// True when a negative feature (logLR < 0) lists a masking context that applies: the
    /// missing or documented-absent finding is then not counted against the diagnosis.
    static func isMasked(_ maskedBy: [String]?, logLR: Int, active: Set<MaskingContext>) -> Bool {
        guard logLR < 0, let names = maskedBy, !names.isEmpty else { return false }
        return names.contains { name in MaskingContext(rawValue: name).map { active.contains($0) } ?? false }
    }

    // MARK: - Evidence from resulted reports

    /// A curated feature at least this strong (logLR 12 ≈ likelihood ratio 10) found in a resulted
    /// report or laboratory result puts its diagnosis on the list even when the complaint's route
    /// did not ("CT: acute necrotising pancreatitis" while the complaint is breathlessness).
    static let reportEvidenceMinLogLR = 12

    // MARK: - NEWS2 (shock / sepsis context)

    /// Candidates of at least this urgency (critical) take the whole NEWS2 adjustment in infer(),
    /// candidates one tier below (emergency) half of it, the rest none.
    static let news2FullShareUrgency = 3
}
