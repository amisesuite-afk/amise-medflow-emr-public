// ProbabilityText.swift
// Probability text that never claims certainty. Medicine is probabilistic: an engine posterior is
// shown as "<1%" rather than "0%" and ">99%" rather than "100%" (surgeon, 2026-09-26: "Medicine is
// probabilistic, no 100 percent"; docs/clinical-validation/SURGEON-DECISIONS.md I3). Same rule as
// DiagnosticReasoning.fmtPct; web twin artifacts/dashboard/src/lib/probability-text.ts (the same cases
// in both tests). Display only: bar widths and thresholds keep the raw number.

import Foundation

enum ProbabilityText {
    /// From a fraction (0–1), e.g. a hypothesis probability.
    static func fraction(_ p: Double?) -> String {
        guard let p, p.isFinite else { return "—" }
        if p >= 0.995 { return ">99%" }
        if p < 0.005 { return "<1%" }
        return "\(Int((p * 100).rounded()))%"
    }

    /// From a whole percent (0–100), as DiagnosisResult.probability and stored snapshots hold it.
    static func percent(_ value: Int) -> String {
        fraction(Double(value) / 100)
    }
}
