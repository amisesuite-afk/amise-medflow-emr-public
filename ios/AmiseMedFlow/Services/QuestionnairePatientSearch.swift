// QuestionnairePatientSearch.swift
// Privacy rule for finding the patient before the iPad is handed over for the pre-consultation
// questionnaire (front-desk Questionnaire tab and the walk-in "attach answers" screen).
//
// The surgeon's requirement: the questionnaire screen must never show a browsable list of other
// patients. So the list stays empty until staff type a real search:
//   - a name search needs at least `minimumNameLength` characters (substring, case- and
//     accent-insensitive);
//   - an MRN matches only as the whole MRN (case-insensitive, e.g. "AMF-2025-000047") or as its
//     sequence number (digits only, e.g. "47" or "000047");
//   - never more than `maxResults` matches.
// Pure and model-free (the generic overload), so it is unit-tested in QuestionnairePrivacyTests.

import Foundation

enum QuestionnairePatientSearch {

    static let minimumNameLength = 3
    static let maxResults = 5

    /// The query with surrounding whitespace removed.
    static func normalized(_ query: String) -> String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// True when `query` is long enough to run a name search.
    static func isNameSearch(_ query: String) -> Bool {
        normalized(query).count >= minimumNameLength
    }

    /// True when `query` identifies `mrn`: the whole MRN, or its AMF sequence number.
    static func mrnMatches(query: String, mrn: String?) -> Bool {
        let q = normalized(query)
        guard !q.isEmpty,
              let mrn = mrn?.trimmingCharacters(in: .whitespacesAndNewlines),
              !mrn.isEmpty else { return false }
        if q.caseInsensitiveCompare(mrn) == .orderedSame { return true }
        if q.allSatisfy(\.isASCIIDigitCharacter), let wanted = Int(q),
           let sequence = MRNGenerator.sequence(of: mrn.uppercased()) {
            return sequence == wanted
        }
        return false
    }

    /// At most `maxResults` candidates matching `query`: MRN matches first, then name matches,
    /// each in input order. Empty for an empty query or a name query under `minimumNameLength`
    /// characters that is not an MRN.
    static func matches<Candidate>(query: String,
                                   in candidates: [Candidate],
                                   name: (Candidate) -> String,
                                   mrn: (Candidate) -> String?) -> [Candidate] {
        let q = normalized(query)
        guard !q.isEmpty else { return [] }

        var mrnHits: [Candidate] = []
        var nameHits: [Candidate] = []
        let searchNames = isNameSearch(q)
        for candidate in candidates {
            if mrnMatches(query: q, mrn: mrn(candidate)) {
                mrnHits.append(candidate)
            } else if searchNames,
                      name(candidate).range(of: q, options: [.caseInsensitive, .diacriticInsensitive]) != nil {
                nameHits.append(candidate)
            }
            if mrnHits.count >= maxResults { break }
        }
        return Array((mrnHits + nameHits).prefix(maxResults))
    }

    /// Patient overload. Deleted/detached records are dropped before any attribute is read.
    static func matches(query: String, in patients: [Patient]) -> [Patient] {
        matches(query: query,
                in: patients.filter(\.isLive),
                name: { $0.fullName },
                mrn: { $0.mrn })
    }
}

private extension Character {
    var isASCIIDigitCharacter: Bool { isASCII && isNumber }
}
