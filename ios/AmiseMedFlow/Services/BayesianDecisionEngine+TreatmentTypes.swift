// BayesianDecisionEngine+TreatmentTypes.swift
// Inputs and outputs of the treatment decision layer (Swift twin of
// lib/pane-engine/src/decision/types.ts). The engine is in BayesianDecisionEngine+Treatment.swift.
// Inputs are Decodable so the shared vectors (AmiseMedFlowTests/DecisionSupport/decision-vectors.json)
// decode straight into them.

import Foundation

extension TreatmentDecisions {

    // MARK: - Inputs

    struct DecisionPatient: Decodable {
        var ageYears: Double?
        /// "male" | "female" | "unknown"
        var sex: String
        /// Clinical Frailty Scale 1–9.
        var cfs: Double?
        /// ASA physical status 1–6.
        var asa: Double?
        /// eGFR / CrCl mL/min.
        var egfr: Double?
        var bmi: Double?
        var news2: Double?
        /// Latest systolic BP, mmHg.
        var sbp: Double?
        /// "vka" | "doac" | "none" | nil
        var anticoagulant: String?
        var antiplatelet: Bool
        var hasBled: Double?
        /// "pregnant" | "not-pregnant" | "possible" | "unknown"
        var pregnancy: String
        /// PlanSafetyFilter allergy class ids ("penicillin", "nsaid", …).
        var allergyClasses: [String]
        var diabetes: Bool
        var immunosuppressed: Bool
        /// Days since the last operation (nil = none recorded).
        var recentSurgeryDays: Double?
        var procedurePlanned: Bool
        var appendicolith: Bool
        var mechanicalValve: Bool
        var recentVte3m: Bool
    }

    static func emptyPatient() -> DecisionPatient {
        DecisionPatient(ageYears: nil, sex: "unknown", cfs: nil, asa: nil, egfr: nil, bmi: nil, news2: nil, sbp: nil,
                        anticoagulant: nil, antiplatelet: false, hasBled: nil, pregnancy: "unknown", allergyClasses: [],
                        diabetes: false, immunosuppressed: false, recentSurgeryDays: nil, procedurePlanned: false,
                        appendicolith: false, mechanicalValve: false, recentVte3m: false)
    }

    struct Diagnosis: Decodable {
        var name: String
        var id: String?
        var icd10: String?
        /// Posterior 0–1 (nil when unknown).
        var probability: Double?
        /// Confirmed by the clinician (the working diagnosis).
        var confirmed: Bool
    }

    struct Score: Decodable {
        var key: String
        var value: Double
        /// "calculator" | "record" | "autofill"
        var source: String
        /// NEWS2: a single parameter scored 3.
        var redParameter: Bool?
    }

    struct Input: Decodable {
        var patient: DecisionPatient
        var diagnoses: [Diagnosis]
        var scores: [Score]
        /// lipase, amylase (U/L), troponin (ng/L), lactate, potassium (mmol/L), haemoglobin (g/L).
        var labs: [String: Double]
        /// Local upper limits of normal (lipase, amylase, troponin).
        var uln: [String: Double]?
    }

    /// The platform's plan-safety line filter (PlanSafetyFilter.adaptLine).
    typealias LineFilter = (String) -> (text: String, withheld: Bool)

    // MARK: - Outputs

    enum Band: String {
        case observe
        case test
        case treat
        case notForPatient = "not-for-patient"
        case unknown

        var label: String {
            switch self {
            case .observe: return "Observe"
            case .test: return "Test further"
            case .treat: return "Treat"
            case .notForPatient: return "Not for this patient"
            case .unknown: return "Risk not known"
            }
        }
    }

    struct SourceRef {
        var id: String = ""
        var citation: String = ""
        var year: Int = 0
        var fromMemory: Bool = true
    }

    struct ScoreCard: Identifiable {
        var id: String = ""
        var score: String = ""
        var scoreLabel: String = ""
        var chip: String = ""
        var value: Double = 0
        var scoreSource: String = ""
        var band: String = ""
        var level: String = ""
        var action: String = ""
        var withheld: Bool = false
        var addAs: String = "plan"
        var evidence: String = ""
        var sources: [SourceRef] = []
    }

    struct ResultCard: Identifiable {
        var id: String = ""
        var analyte: String = ""
        var label: String = ""
        var chip: String = ""
        var value: Double = 0
        var unit: String = ""
        var thresholdText: String = ""
        var action: String = ""
        var withheld: Bool = false
        var addAs: String = "plan"
        var level: String = ""
        var diagnosisHint: String? = nil
        var sources: [SourceRef] = []
    }

    struct Factor {
        var modifierId: String = ""
        var factor: String = ""
        var label: String = ""
        /// "excluded" | "harm-up" | "harm-down" | "benefit-up" | "benefit-down"
        var effect: String = ""
        var reason: String = ""
        var thresholdShift: Double = 0
        var netShift: Double = 0
        var evidence: String = ""
        var sources: [SourceRef] = []
    }

    struct OptionResult: Identifiable {
        var id: String = ""
        var label: String = ""
        var kind: String = ""
        var band: Band = .unknown
        var bandRange: [Band] = []
        var borderline: Bool = false
        var treatThreshold: Triple = Triple(0, 0, 0)
        var testThreshold: Triple? = nil
        var benefit: Triple = Triple(0, 0, 0)
        var harm: Triple = Triple(0, 0, 0)
        var expectedBenefit: Triple = Triple(0, 0, 0)
        var expectedHarm: Triple = Triple(0, 0, 0)
        var net: Triple = Triple(0, 0, 0)
        var rank: Int? = nil
        var excludedReason: String? = nil
        var withheldText: String? = nil
        var factors: [Factor] = []
        var topFactors: [Factor] = []
        var factorSummary: String? = nil
        var planLine: String = ""
        var observeText: String = ""
        var suggestedLine: String? = nil
        var suggestedAddAs: String? = nil
        var evidence: String = ""
        var lowEvidence: Bool = false
        var fromMemory: Bool = true
        var sources: [SourceRef] = []
        var note: String? = nil
    }

    struct TestInfo {
        var label: String = ""
        var sensitivity: Double = 0
        var specificity: Double = 0
        var sources: [SourceRef] = []
    }

    struct DecisionResult: Identifiable {
        var id: String = ""
        var label: String = ""
        var type: String = ""
        var diagnosisName: String = ""
        var probability: Double? = nil
        /// "confirmed" | "score" | "engine" | "risk" | "none"
        var probabilitySource: String = "none"
        var probabilityLabel: String = ""
        var chip: String = ""
        var test: TestInfo? = nil
        var options: [OptionResult] = []
        var missing: [String] = []
    }

    struct Result {
        var contentVersion: String = ""
        var scoreActions: [ScoreCard] = []
        var resultActions: [ResultCard] = []
        var decisions: [DecisionResult] = []
        var activeFactors: [String] = []
    }

    /// Harness / summary line: "management" = suggested, "safety" = not for this patient, "info" = missing input.
    struct SummaryLine {
        let kind: String
        let text: String
    }
}
