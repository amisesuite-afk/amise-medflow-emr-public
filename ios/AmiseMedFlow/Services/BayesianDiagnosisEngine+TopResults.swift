// BayesianDiagnosisEngine+Topresults.swift
// Log-gap normalisation → top 5 differential results.

import Foundation

extension BayesianDiagnosisEngine {

    // MARK: - Log-gap normalisation → top 5 results
    // Architecture: logGap (rank-1 minus rank-2 log-posterior) is the primary confidence
    // signal — it measures how much the evidence statistically separates rank-1 from the field.
    // Softmax probability is computed for display only and is NOT the architectural decision metric.

    /// Places at the end of the five shown that are held for "do not miss" diagnoses: ranks
    /// 1–3 are the most probable diagnoses, ranks 4–5 the most probable candidates with
    /// urgency ≥ dontMissMinUrgency (emergency / critical) that are not already shown. When
    /// there are fewer such candidates the places go to the next most probable ones.
    static let dontMissSlots = 2
    static let dontMissMinUrgency = 2
    /// Log-posterior given to a candidate excluded by the surgical history (organ removed).
    static let excludedLogPosterior = -9999

    static func topResults(from scored: [ScoredCandidate]) -> [DiagnosisResult] {
        guard !scored.isEmpty else { return [] }

        // Sort by log-posterior BEFORE softmax — this preserves the gap signal. Equal scores
        // keep their candidate order (Swift's sort is not guaranteed stable).
        let byLogP = scored.enumerated().sorted { a, b in
            a.element.logPosterior != b.element.logPosterior
                ? a.element.logPosterior > b.element.logPosterior
                : a.offset < b.offset
        }.map(\.element)

        // logGap: rank-1 minus rank-2 in log-posterior space (or rank-1's own score if only one)
        let logGap = byLogP.count >= 2
            ? byLogP[0].logPosterior - byLogP[1].logPosterior
            : max(byLogP[0].logPosterior, 0)

        // Softmax for display only. Log-posteriors are stored as round(ln × 5)
        // (DiagnosticDatabase.json "conversionFormula"), so they are divided by
        // logUnitsPerNat before exponentiating; reading them as natural logs overstated the
        // leading diagnosis (a 10-unit lead is e² ≈ 7×, not e¹⁰ ≈ 22 000×).
        let maxScore = byLogP[0].logPosterior
        let exps = byLogP.map { exp(Double($0.logPosterior - maxScore) / BayesianDiagnosisEngine.logUnitsPerNat) }
        let total = exps.reduce(0, +)

        let withProb = zip(byLogP, exps).map { (s, e) -> (ScoredCandidate, Int) in
            let prob = total > 0 ? Int((e / total) * 100.0) : 0
            return (s, prob)
        }

        // Ranks 1–3 by probability, then the reserved "do not miss" places.
        let headCount = 5 - dontMissSlots
        var shownIdx = Array(withProb.indices.prefix(headCount))
        let restIdx = withProb.indices.dropFirst(headCount).filter {
            withProb[$0].0.logPosterior > excludedLogPosterior
        }
        let dontMissIdx = restIdx.filter { withProb[$0].0.candidate.urgency >= dontMissMinUrgency }
            .prefix(dontMissSlots)
        let fillIdx = restIdx.filter { !dontMissIdx.contains($0) }.prefix(dontMissSlots - dontMissIdx.count)
        shownIdx += (Array(dontMissIdx) + Array(fillIdx)).sorted()
        let shown = shownIdx.map { withProb[$0] }

        // Every other scored candidate (most probable first), carried on the first result for the
        // diagnostic-reasoning layer: a confirmed working diagnosis the engine ranks lower is still
        // compared with the leaders (DiagnosticReasoningAdapter). Not shown in the differential.
        let shownSet = Set(shownIdx)
        let rankedBelow: [DiagnosisResult] = withProb.indices
            .filter { !shownSet.contains($0) && withProb[$0].0.logPosterior > excludedLogPosterior }
            .map { i in
                let (s, prob) = withProb[i]
                return DiagnosisResult(
                    name: s.candidate.name,
                    icdCode: s.candidate.icd,
                    probability: prob,
                    evidence: Array(s.evidence.prefix(6)),
                    evidenceSources: s.evidenceSources.mapValues { Array($0.prefix(4)) },
                    confidence: s.pathognomicFindings.isEmpty ? .low : .high,
                    rawLogPosterior: s.logPosterior,
                    logGap: 0,
                    pathognomicFindings: s.pathognomicFindings,
                    urgency: s.candidate.urgency,
                    firedFeatures: s.fired,
                    candidateFeatures: s.candidate.features
                )
            }

        return shown.enumerated().map { (idx, pair) in
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
                urgency: s.candidate.urgency,
                firedFeatures: s.fired,
                candidateFeatures: s.candidate.features,
                rankedBelow: idx == 0 ? rankedBelow : []
            )
        }
    }


}
