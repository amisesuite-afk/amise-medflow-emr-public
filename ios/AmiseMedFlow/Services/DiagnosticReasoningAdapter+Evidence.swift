// DiagnosticReasoningAdapter+Evidence.swift
// Examination-sign and decision-rule evidence in the "Diagnostic reasoning" card (evidence-exam
// 1.0.0): how far each recorded sign or rule moved a diagnosis. Web twin: the evidence moves in
// artifacts/dashboard/src/lib/diagnostic-reasoning.ts (leave-one-out replay through PANE).
//
// Removing one feature changes only its own candidate's log-posterior, so under the displayed
// softmax the probability without it is p·f / (p·f + 1 − p), f = exp(−logLR / 5).

import Foundation

extension DiagnosticReasoningAdapter {

    /// True for the finding ids of Exam-step signs and stored decision rules ("sign:…", "rule:…").
    static func isExamEvidence(_ finding: String) -> Bool {
        finding.hasPrefix("sign:") || finding.hasPrefix("rule:")
    }

    /// " · 22% → 41%" for a sign or rule finding that fired for `hypothesisLabel`; nil otherwise.
    static func evidenceMove(results: [Result], hypothesisLabel: String, finding: String) -> String? {
        guard isExamEvidence(finding),
              let r = results.first(where: { $0.name == hypothesisLabel }),
              let fired = r.firedFeatures.first(where: { findingId(key: $0.key, value: $0.value) == finding })
        else { return nil }
        let to = Double(r.probability) / 100
        let factor = exp(-Double(fired.logLR) / BayesianDiagnosisEngine.logUnitsPerNat)
        let denominator = to * factor + (1 - to)
        let from = denominator > 0 ? to * factor / denominator : to
        return " · \(DiagnosticReasoning.fmtPct(from)) → \(DiagnosticReasoning.fmtPct(to))"
    }
}
