// TreatmentDecisionContent.swift
// Decision support content — score → action, result → action, treatment options with benefit /
// harm and patient modifiers — decoded from Resources/TreatmentDecisions.json.
//
// DRIFT NOTE: the JSON is a byte-identical copy of lib/pane-engine/src/decision/treatment-decisions.json
// (scripts/src/decision-content-parity.test.ts fails if they differ, and checks that every key the
// web engine reads is named here). These structs mirror lib/pane-engine/src/decision/types.ts.
// Every number awaits surgeon sign-off (docs/clinical-validation/changes/bayes-treatment.md).

import Foundation

enum TreatmentDecisions {

    // MARK: - Content

    /// [low, point, high].
    struct Triple: Decodable, Equatable {
        let low: Double
        let point: Double
        let high: Double

        init(_ low: Double, _ point: Double, _ high: Double) {
            self.low = low
            self.point = point
            self.high = high
        }

        init(from decoder: Decoder) throws {
            var c = try decoder.unkeyedContainer()
            let a = try c.decode(Double.self)
            let b = try c.decode(Double.self)
            let d = try c.decode(Double.self)
            if !c.isAtEnd {
                throw DecodingError.dataCorruptedError(in: c, debugDescription: "A range is exactly [low, point, high].")
            }
            self.init(a, b, d)
        }

        /// 0 = low, 1 = point, 2 = high.
        func at(_ i: Int) -> Double { i == 0 ? low : (i == 1 ? point : high) }
    }

    struct SourceInfo: Decodable {
        let citation: String
        let year: Int
        let fromMemory: Bool
    }

    struct ScoreBand: Decodable {
        let min: Double
        let max: Double
        let requires: String?
        let band: String
        let level: String
        let action: String
        let addAs: String
        let risk: Triple?
        let sources: [String]
        let evidence: String
    }

    struct ScoreActionSet: Decodable {
        let score: String
        let label: String
        let chip: String
        let riskLabel: String?
        let bands: [ScoreBand]
    }

    struct ResultRule: Decodable {
        let id: String
        let analyte: String
        let unit: String
        let ulnMultiple: Double?
        let strictLower: Bool?
        let lower: Double?
        let upperExclusive: Double?
        let label: String
        let thresholdText: String
        let action: String
        let addAs: String
        let level: String
        let diagnosisHint: String?
        let supersededBy: String?
        let sources: [String]
    }

    struct Modifier: Decodable {
        let id: String
        let factor: String
        let label: String
        let reason: String
        let sources: [String]
        let evidence: String
        let kinds: [String]?
        let options: [String]?
        let harmOR: Triple?
        let benefitX: Triple?
        let benefitAdd: Triple?
        let exclude: Bool?
        let requiresAllergyClass: String?
    }

    struct Option: Decodable {
        let id: String
        let label: String
        let kind: String
        let planLine: String
        let observeText: String
        let benefit: Triple
        let harm: Triple
        let sources: [String]
        let evidence: String
        let addAs: String
        let allergyClasses: [String]?
        let note: String?
        let harmInDiseased: Bool?
    }

    struct Test: Decodable {
        let label: String
        let sensitivity: Double
        let specificity: Double
        let harm: Double
        let sources: [String]
    }

    struct Match: Decodable {
        let diseaseIds: [String]
        let icd10: [String]
        let keywords: [String]
        let excludeKeywords: [String]
    }

    struct RiskFactor: Decodable {
        let factor: String
        let risk: Triple
        let label: String
    }

    struct Decision: Decodable {
        let id: String
        let label: String
        let type: String
        let match: Match
        let test: Test?
        let pretestScore: String?
        let riskScore: String?
        let triggerScore: String?
        let trigger: String?
        let baselineRisk: Triple?
        let riskFactors: [RiskFactor]?
        let riskLabel: String?
        let options: [Option]
        let modifiers: [Modifier]
    }

    struct ULN: Decodable {
        let lipase: Double
        let amylase: Double
        let troponin: Double

        func value(for analyte: String) -> Double? {
            switch analyte {
            case "lipase": return lipase
            case "amylase": return amylase
            case "troponin": return troponin
            default: return nil
            }
        }
    }

    struct Defaults: Decodable {
        let confirmedFloor: Double
        let minEngineProbability: Double
        let maxDecisions: Int
        let uln: ULN
        let ulnNote: String
    }

    struct MissingInput: Decodable {
        let label: String
        let effect: String
    }

    struct Content: Decodable {
        let version: String
        let status: String
        let defaults: Defaults
        let sources: [String: SourceInfo]
        let scoreActions: [ScoreActionSet]
        let resultActions: [ResultRule]
        let modifiers: [Modifier]
        let decisions: [Decision]
        let missingInputs: [String: MissingInput]
    }

    // MARK: - Loading

    /// The bundled content (nil only if the resource is missing or does not decode — the Plan step
    /// then shows no decision support, and TreatmentDecisionTests fails).
    static let content: Content? = load(from: Bundle.main)

    static func load(from bundle: Bundle) -> Content? {
        guard let url = bundle.url(forResource: "TreatmentDecisions", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? decode(data)
    }

    static func decode(_ data: Data) throws -> Content {
        try JSONDecoder().decode(Content.self, from: data)
    }
}
