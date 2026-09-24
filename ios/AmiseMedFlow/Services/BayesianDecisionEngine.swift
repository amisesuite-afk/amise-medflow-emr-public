// BayesianDecisionEngine.swift
// Max-utility Bayesian decision network: maps ranked hypotheses → clinical decisions.
// All logic is deterministic; no network calls.

import Foundation

// MARK: - Decision priority

enum DecisionPriority: String, Comparable, CaseIterable {
    case emergency  = "Emergency"
    case urgent     = "Urgent"
    case semiUrgent = "Semi-urgent"
    case elective   = "Elective"

    static func < (lhs: DecisionPriority, rhs: DecisionPriority) -> Bool {
        let order: [DecisionPriority] = [.emergency, .urgent, .semiUrgent, .elective]
        return (order.firstIndex(of: lhs) ?? 3) < (order.firstIndex(of: rhs) ?? 3)
    }

    var label: String { rawValue }
}

// MARK: - Clinical disposition

enum ClinicalDisposition: String {
    case operatingTheatre  = "Operating Theatre"
    case wardAdmission     = "Ward Admission"
    case hduAdmission      = "HDU/ICU Admission"
    case outpatientReview  = "Outpatient Review"
    case primaryCare       = "Primary Care"
    case discharge         = "Discharge"
}

// MARK: - Clinical decision

struct ClinicalDecision: Identifiable {
    let id = UUID()
    let title: String
    let priority: DecisionPriority
    let disposition: ClinicalDisposition
    let drivingDiagnosis: String?
    let rationale: String
    let immediateActions: [String]
}

// MARK: - Decision context

struct DecisionContext {
    let ageYears: Int
    let sex: Sex
    let asaClass: Int?
    let acuity: Acuity
    let clinicalScores: [ClinicalScore]
    let vitalsAlerts: [ChangePointAlert]
    let labs: LabPanel
}

// MARK: - Engine

enum BayesianDecisionEngine {

    // Convenience aliases so extensions can reference these types unqualified.
    typealias Candidate    = BayesianDiagnosisEngine.Candidate
    typealias DiagnosisResult = BayesianDiagnosisEngine.DiagnosisResult

    // MARK: - Core decision function

    /// Maps ranked hypotheses → clinical decisions using a max-utility rules engine.
    /// Returns one `ClinicalDecision` per actionable hypothesis (max 3), sorted by priority.
    static func decide(hypotheses: [DiagnosisHypothesis], context: DecisionContext) -> [ClinicalDecision] {
        guard !hypotheses.isEmpty else { return [] }

        var decisions: [ClinicalDecision] = []

        for hypothesis in hypotheses.prefix(3) {
            let priority = decisionPriority(for: hypothesis, context: context)
            let disposition = clinicalDisposition(for: hypothesis, priority: priority)
            let actions = immediateActions(for: hypothesis, priority: priority)

            decisions.append(ClinicalDecision(
                title: hypothesis.name,
                priority: priority,
                disposition: disposition,
                drivingDiagnosis: hypothesis.name,
                rationale: rationale(for: hypothesis, priority: priority),
                immediateActions: actions
            ))
        }

        return decisions.sorted { $0.priority < $1.priority }
    }

    // MARK: - Priority derivation

    private static func decisionPriority(for h: DiagnosisHypothesis, context: DecisionContext) -> DecisionPriority {
        // Emergency acuity always floors at emergency
        if context.acuity == .emergency { return .emergency }

        // Logically escalate by confidence and any NEWS2 alert
        let hasEmergencyAlert = context.vitalsAlerts.contains { ($0.news2AtDetection ?? 0) >= 7 }
        if hasEmergencyAlert { return .emergency }

        switch h.confidence {
        case .certain, .high:
            // Pathognomonic findings or high-gap diagnosis + urgent flag
            let hasUrgentVital = context.vitalsAlerts.contains { ($0.news2AtDetection ?? 0) >= 5 }
            if !h.pathognomicFindings.isEmpty || hasUrgentVital { return .urgent }
            return context.acuity == .urgent ? .urgent : .semiUrgent
        case .moderate:
            return context.acuity == .urgent ? .urgent : .semiUrgent
        case .low:
            return .elective
        }
    }

    private static func clinicalDisposition(for h: DiagnosisHypothesis,
                                             priority: DecisionPriority) -> ClinicalDisposition {
        let name = h.name.lowercased()
        let isSurgical = name.contains("perforation") || name.contains("peritonitis") ||
                         name.contains("obstruction") || name.contains("strangulat") ||
                         name.contains("ischaemia") || name.contains("ischemia") ||
                         name.contains("torsion") || name.contains("empyema") ||
                         name.contains("haemorrhage") || name.contains("hemorrhage") ||
                         name.contains("aneurysm") || name.contains("embolism")

        switch priority {
        case .emergency:
            return isSurgical ? .operatingTheatre : .hduAdmission
        case .urgent:
            return isSurgical ? .wardAdmission : .wardAdmission
        case .semiUrgent:
            return .outpatientReview
        case .elective:
            return .outpatientReview
        }
    }

    private static func rationale(for h: DiagnosisHypothesis, priority: DecisionPriority) -> String {
        let pct = h.probability > 0 ? " (\(Int(h.probability * 100))%)" : ""
        return "\(h.name)\(pct) — log gap \(h.logGap). Priority: \(priority.rawValue)."
    }

    private static func immediateActions(for h: DiagnosisHypothesis,
                                          priority: DecisionPriority) -> [String] {
        switch priority {
        case .emergency:
            return ["Urgent senior review", "IV access + bloods", "Continuous monitoring",
                    "Nil by mouth", "Surgical or specialist consult"]
        case .urgent:
            return ["Bloods: FBC, CRP, LFT, amylase, coagulation", "IV access",
                    "Imaging as indicated", "Senior review within 1–4 hours"]
        case .semiUrgent:
            return ["Targeted investigation", "Clinic review within 1–2 weeks"]
        case .elective:
            return ["Routine outpatient workup"]
        }
    }
}
