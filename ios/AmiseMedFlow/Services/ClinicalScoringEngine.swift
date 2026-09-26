// ClinicalScoringEngine.swift
// Deterministic, evidence-based clinical scoring for surgical practice.
// No AI, no network calls — HIPAA-safe.
// Sources: NICE, ACS, EAST, WSES, Tokyo Guidelines 2018, Sepsis-3, BSG, SIGN.

import Foundation

// MARK: - Core output types

enum ScoreRisk: String, Comparable, CaseIterable {
    case low      = "Low Risk"
    case moderate = "Moderate Risk"
    case high     = "High Risk"
    case critical = "Critical"

    static func < (lhs: ScoreRisk, rhs: ScoreRisk) -> Bool {
        let order: [ScoreRisk] = [.low, .moderate, .high, .critical]
        return (order.firstIndex(of: lhs) ?? 0) < (order.firstIndex(of: rhs) ?? 0)
    }

    var colorHex: String {
        switch self {
        case .low:      return "#22C55E"
        case .moderate: return "#EAB308"
        case .high:     return "#F97316"
        case .critical: return "#DC2626"
        }
    }

    var icon: String {
        switch self {
        case .low:      return "checkmark.circle"
        case .moderate: return "exclamationmark.triangle"
        case .high:     return "exclamationmark.circle.fill"
        case .critical: return "xmark.octagon.fill"
        }
    }
}

struct ScoredItem: Identifiable {
    let id = UUID()
    let label: String
    let points: Double
    let present: Bool
}

struct ClinicalScore: Identifiable {
    let id = UUID()
    let systemName: String       // e.g. "Alvarado Score"
    let abbreviation: String     // e.g. "MANTRELS"
    let score: Double
    let maxScore: Double         // 0 = no fixed maximum (continuous / unbounded scores)
    let risk: ScoreRisk
    let interpretation: String   // concise clinical meaning of this score
    let recommendations: [String]
    let items: [ScoredItem]
    let redFlags: [String]
    let evidenceNote: String?    // guideline reference
}

extension ClinicalScore {
    // Convenience initialiser for scores that do not require abbreviation,
    // items, or redFlags, and where maxScore may be absent (continuous scales).
    init(
        name: String,
        score: Double,
        maxScore: Double? = nil,
        risk: ScoreRisk,
        interpretation: String,
        recommendations: [String] = [],
        items: [ScoredItem] = [],
        redFlags: [String] = [],
        evidenceNote: String? = nil
    ) {
        self.systemName     = name
        self.abbreviation   = ""
        self.score          = score
        self.maxScore       = maxScore ?? 0     // 0 signals "no fixed max" to display logic
        self.risk           = risk
        self.interpretation = interpretation
        self.recommendations = recommendations
        self.items          = items
        self.redFlags       = redFlags
        self.evidenceNote   = evidenceNote
    }
}

// MARK: - ClinicalScoringEngine

enum ClinicalScoringEngine {}
