// BayesianDiagnosisEngine+ChipDimensions.swift
// What a chip's question (its socratesSelections key) means to score(). Data: HistoryFrameData
// chipLabels / chipRecordFields, generated from lib/triage-engine/src/history-frames/
// engine-dimensions.ts (the rules are documented there).
//
//  - The "finding" features read each chip with its question: "aggravating: Coughing",
//    "associated: Fever", "radiation: Back". With FeatureTerm.coughKind, a Coughing chip chosen under
//    "What makes it worse?" is no longer a cough.
//  - Early-form chips under "exam", "pmh", "history", "pshx", "social" and "inv" are also read as
//    that part of the record, so the examination, history and result features written for them fire
//    (they were stored in socratesSelections and never reached those features).
//
// Stored answers are unchanged: the label is added when score() reads them.

import Foundation

enum ChipDimensions {

    /// A chip as the finding features read it: "<label>: <chip>" (unlisted keys: the chip).
    static func findingText(key: String, value: String) -> String {
        guard let label = HistoryFrameData.chipLabels[key] else { return value }
        return "\(label): \(value)"
    }

    /// Every chip as the finding features read it (sorted by key, then value).
    static func findingTexts(_ selections: [String: Set<String>]) -> [String] {
        selections.keys.sorted().flatMap { key in
            (selections[key] ?? []).sorted().map { findingText(key: key, value: $0) }
        }
    }

    /// Chip values read as `field` of the record ("exam", "pmh", "pshx", "social", "inv").
    static func recordValues(_ selections: [String: Set<String>], field: String) -> [String] {
        selections.keys.sorted().flatMap { key -> [String] in
            guard HistoryFrameData.chipRecordFields[key]?.contains(field) == true else { return [] }
            return (selections[key] ?? []).sorted()
        }
    }

    /// `text` with the chips read as `field` added, one clause each (NegationMatcher.joinClauses).
    static func merged(_ text: String, _ selections: [String: Set<String>], field: String) -> String {
        let extra = recordValues(selections, field: field)
        guard !extra.isEmpty else { return text }
        return NegationMatcher.joinClauses(([text] + extra).map { Optional($0) })
    }
}
