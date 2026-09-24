// ClinicalPipelineOrchestrator+Helpers.swift
// Pipeline summary helpers and visit-type routing for the clinical pipeline.

import Foundation
import SwiftUI


// MARK: - Pipeline summary helpers

extension ClinicalPipelineOrchestrator {

    /// Statistically enforced working diagnosis — non-nil when logGap ≥ 15 or a pathognomonic
    /// finding fired on rank-1. This is the Bayesian engine's gravitational signal: when present,
    /// the evidence has mathematically separated rank-1 from the field, and the UI should
    /// surface it with commensurate prominence.
    var enforcedWorkingDiagnosis: DiagnosisHypothesis? {
        guard let top = hypotheses.first else { return nil }
        return (top.logGap >= 15 || !top.pathognomicFindings.isEmpty) ? top : nil
    }

    /// Highest-priority decision (emergency first)
    var topDecision: ClinicalDecision? {
        decisions.sorted { $0.priority < $1.priority }.first
    }

    /// Deterioration alerts from DBN trajectories (non-nil only)
    var deteriorationAlerts: [DeteriorationAlert] {
        trajectories.compactMap(\.deteriorationAlert)
    }

    /// Whether any emergency decision or deterioration alert exists
    var hasUrgentFlag: Bool {
        decisions.contains { $0.priority == .emergency } ||
        deteriorationAlerts.contains { $0.priority == .emergency } ||
        changePointAlerts.contains { ($0.news2AtDetection ?? 0) >= 7 }
    }

    /// Top-n AutoActions filtered by urgency
    func autoActions(urgency: AutoUrgency, limit: Int = 3) -> [AutoAction] {
        Array(autoActions.filter { $0.urgency == urgency }.prefix(limit))
    }

    /// Hypothesis probability formatted as percent string
    func probabilityString(for hypothesis: DiagnosisHypothesis) -> String {
        "\(Int((hypothesis.probability * 100).rounded()))%"
    }
}

// MARK: - Visit-type routing

extension ClinicalPipelineOrchestrator {

    // Determines which AutoFunctions are shown based on visit type.
    // Emergency surgery → all actions. Outpatient follow-up → no operative planning.
    func filteredAutoActions(for visitType: VisitType?) -> [AutoAction] {
        guard let vt = visitType else { return autoActions }

        switch vt {
        case .surgeryEmergency:
            return autoActions   // full set

        case .surgeryElective, .dayOfSurgery:
            // Suppress 'ask' prompts — history already taken. Focus on prepare/calculate.
            return autoActions.filter { $0.function != .ask }

        case .ercp, .ogd, .colonoscopy:
            // Endoscopy: only document, calculate, schedule, prepare
            return autoActions.filter {
                [AutoFunction.document, .calculate, .schedule, .prepare].contains($0.function)
            }

        case .newConsult, .urgentReview:
            return autoActions   // full diagnostic workup

        case .followUp, .postOp, .telephone:
            // Follow-up: suppress operative planning and emergency alerts if no urgent flags
            if hasUrgentFlag { return autoActions }
            return autoActions.filter {
                ![AutoFunction.prepare].contains($0.function)
            }

        case .trauma:
            // Trauma: prioritise alert, calculate, order; suppress documentation generation
            return autoActions.filter {
                [AutoFunction.alert, .calculate, .order, .compare].contains($0.function)
            }

        case .bronchoscopy:
            // Bronchoscopy: document and calculate only; no operative planning or scheduling
            return autoActions.filter {
                [AutoFunction.document, .calculate].contains($0.function)
            }
        }
    }
}
