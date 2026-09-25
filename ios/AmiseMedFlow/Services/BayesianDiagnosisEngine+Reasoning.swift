// BayesianDiagnosisEngine+Reasoning.swift
// The evidence record the diagnostic-reasoning layer reads (DiagnosticReasoningAdapter.swift).
// Filled by score() for every feature that fires; it does not change any weight.

import Foundation

extension BayesianDiagnosisEngine {

    struct FiredFeature {
        let key: String
        let value: String
        /// Weight applied (after the feature-network discount), in stored units (round(ln LR × 5)).
        let logLR: Int
        /// Weight as stored in the candidate.
        let baseLogLR: Int
        let label: String
        /// Input source: symptoms | exam | history | investigation | demographics | other.
        let sourceKey: String
        let citation: String?
        /// A "notFinding" feature whose finding is written in the record only as negated ("no
        /// neck stiffness"), not merely missing.
        let documentedAbsent: Bool
    }
}
