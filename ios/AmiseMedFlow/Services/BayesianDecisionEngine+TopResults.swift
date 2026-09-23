// BayesianDecisionEngine+TopResults.swift
// Log-gap normalisation and softmax probability computation → top 5 DiagnosisResults.

import Foundation

extension BayesianDecisionEngine {

    // MARK: - Log-gap normalisation → top 5 results
    // Architecture: logGap (rank-1 minus rank-2 log-posterior) is the primary confidence
    // signal — it measures how much the evidence statistically separates rank-1 from the field.
    // Softmax probability is computed for display only and is NOT the architectural decision metric.

    static func topResults(from scored: [ScoredCandidate]) -> [DiagnosisResult] {
        guard !scored.isEmpty else { return [] }

        // Sort by log-posterior BEFORE softmax — this preserves the gap signal
        let byLogP = scored.sorted { $0.logPosterior > $1.logPosterior }

        // logGap: rank-1 minus rank-2 in log-posterior space (or rank-1's own score if only one)
        let logGap = byLogP.count >= 2
            ? byLogP[0].logPosterior - byLogP[1].logPosterior
            : max(byLogP[0].logPosterior, 0)

        // Softmax for display only
        let maxScore = byLogP[0].logPosterior
        let exps = byLogP.map { exp(Double($0.logPosterior - maxScore)) }
        let total = exps.reduce(0, +)

        let withProb = zip(byLogP, exps).map { (s, e) -> (ScoredCandidate, Int) in
            let prob = total > 0 ? Int((e / total) * 100.0) : 0
            return (s, prob)
        }

        return withProb.prefix(5).enumerated().map { (idx, pair) in
            let (s, prob) = pair
            // Only rank-1 carries the gap; lower ranks carry 0
            let gap = idx == 0 ? logGap : 0

            // Confidence driven by logGap (rank-1) or pathognomonic finding (any rank)
            let conf: DiagnosisResult.Confidence
            switch gap {
            case 25...: conf = .certain
            case 15...: conf = .high
            case 7...:  conf = .moderate
            default:
                conf = s.pathognomicFindings.isEmpty ? .low : .high
            }

            return DiagnosisResult(
                name: s.candidate.name,
                icdCode: s.candidate.icd,
                probability: prob,
                evidence: Array(s.evidence.prefix(6)),
                evidenceSources: s.evidenceSources.mapValues { Array($0.prefix(4)) },
                confidence: conf,
                rawLogPosterior: s.logPosterior,
                logGap: gap,
                pathognomicFindings: s.pathognomicFindings,
                urgency: s.candidate.urgency
            )
        }
    }


}
