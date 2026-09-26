// WhatsMissingRules.swift
// The "What's missing" rule content, decoded from Resources/WhatsMissingRules.json — a byte-identical
// copy of lib/pane-engine/src/whats-missing/whats-missing-rules.json (pinned by
// scripts/src/whats-missing-parity.test.ts, which also checks that this file names every key).
//
// Pure data: no Patient, no SwiftData.

import Foundation

/// Namespace for the "What's missing" strip (Swift twin of lib/pane-engine/src/whats-missing).
enum WhatsMissing {}

extension WhatsMissing {

    struct ActionRule: Decodable, Equatable {
        let kind: String
        let field: String?
        let test: String?
    }

    struct GroupRule: Decodable {
        let id: String
        let tier: String
        let safetyOrder: Double?
        let what: String
        let partsWhat: String?
        let action: ActionRule
        let alt: ActionRule?
    }

    struct ConceptRule: Decodable {
        let id: String
        let group: String
        let part: String
    }

    struct ScoreRule: Decodable {
        let id: String
        let label: String
    }

    /// A probe value: a number (CFS 7, eGFR 25 …) or a word ("pregnant").
    enum ProbeValue: Decodable {
        case number(Double)
        case word(String)

        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let d = try? c.decode(Double.self) { self = .number(d) } else { self = .word(try c.decode(String.self)) }
        }

        var number: Double? {
            if case .number(let d) = self { return d }
            return nil
        }
    }

    struct DecisionInputRule: Decodable {
        let key: String
        let group: String
        let concept: String?
        let concepts: [String]?
        let probe: ProbeValue
    }

    struct Thresholds: Decodable {
        let pregnancyAgeMin: Double
        let pregnancyAgeMax: Double
        let weightAgeBelow: Double
        let alvaradoFeverC: Double
        let alvaradoWbc: Double
        let alvaradoNeutrophilPct: Double
        let airFeverC: Double
        let airPmnPct: [Double]
        let airWbc: [Double]
        let airCrp: [Double]
        let gbsHrAbove: Double
        let curbUreaAbove: Double
        let curbRrAtLeast: Double
        let curbSbpBelow: Double
        let curbDbpAtMost: Double
        let curbAgeAtLeast: Double
        let wellsPeHrAbove: Double
        let capriniBmiAbove: Double
        let rcriCreatinineAbove: Double
        let bisapUreaAbove: Double
        let bisapAgeAbove: Double
        let sirsTempBelow: Double
        let sirsTempAbove: Double
        let sirsHrAbove: Double
        let sirsRrAbove: Double
        let sirsWbcBelow: Double
        let sirsWbcAbove: Double
        let neutrophilAbsoluteMax: Double
    }

    struct Terms: Decodable {
        let anticoagulants: [String]
        let renalDrugs: [String]
        let nsaids: [String]
        let ionisingImaging: [String]
        let contrast: [String]
        let insulinDrugs: [String]
        let lastDose: [String]
        let history: [String: [String]]
        let findings: [String: [String]]
        let pleuralEffusion: [String]
    }

    struct TextRules: Decodable {
        let weightWhy: String
        let allergyWhy: String
        let pregnancyWhy: String
        let pregnancyReasonImaging: String
        let pregnancyReasonProcedure: String
        let pregnancyReasonDrugs: String
        let renalWhyDrugs: String
        let renalWhyContrast: String
        let anticoagWhy: String
        let supplementsWhy: String
        let decisionFlipWhy: String
        let decisionRefineWhy: String
        let riskScoreWhy: String
        let ferritinWhy: String
        let discriminatorWhat: String
        let discriminatorWhy: String
        let news2PartialWhy: String
        let news2NoneWhy: String
        let scoreWhy: String
        let scoreWhat: String
        let bandLabels: [String: String]
    }

    struct Rules: Decodable {
        let version: String
        let status: String
        let topN: Int
        let tiers: [String]
        let groups: [GroupRule]
        let concepts: [ConceptRule]
        let scores: [ScoreRule]
        let decisionInputs: [DecisionInputRule]
        let thresholds: Thresholds
        let terms: Terms
        let text: TextRules
    }

    // MARK: - Loading

    /// The bundled rules (nil only if the resource is missing or does not decode — the strip then
    /// shows nothing, and WhatsMissingTests fails).
    static let rules: Rules? = loadRules(from: Bundle.main)

    static func loadRules(from bundle: Bundle) -> Rules? {
        guard let url = bundle.url(forResource: "WhatsMissingRules", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(Rules.self, from: data)
    }
}
