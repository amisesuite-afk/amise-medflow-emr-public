import Foundation

// MARK: - Plan safety filter: clinical pipeline outputs
//
// The pipeline decisions (BayesianDecisionEngine → ManagementEngine plans) and the auto-actions
// carry the same generic adult drug lines as the radiation cards. ClinicalPipelineOrchestrator
// passes them through the same line filter (allergy, pregnancy, renal, under-16 doses) before
// publishing them, so the Diagnosis tab and every other reader get the filtered text.

extension PlanSafetyFilter {

    static func adaptDecision(_ d: ClinicalDecision, _ s: Signals) -> ClinicalDecision {
        ClinicalDecision(
            title: d.title,
            rationale: d.rationale,
            priority: d.priority,
            actions: dedupe(d.actions.map { adaptLine($0, s).text }),
            investigations: dedupe(d.investigations.map { adaptLine($0, s).text }),
            disposition: d.disposition,
            drivingDiagnosis: d.drivingDiagnosis,
            drivingScore: d.drivingScore,
            evidenceBasis: d.evidenceBasis)
    }

    static func adaptAction(_ a: AutoAction, _ s: Signals) -> AutoAction {
        let detail = adaptLine(a.detail, s).text
        guard detail != a.detail else { return a }
        return AutoAction(function: a.function, title: a.title, detail: detail, urgency: a.urgency,
                          targetSection: a.targetSection, payload: a.payload)
    }

    /// Two lines replaced by the same filter line are shown once.
    private static func dedupe(_ lines: [String]) -> [String] {
        var out: [String] = []
        for l in lines where !out.contains(l) { out.append(l) }
        return out
    }
}
