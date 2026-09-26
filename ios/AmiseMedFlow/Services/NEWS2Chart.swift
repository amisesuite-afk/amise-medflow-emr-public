// NEWS2Chart.swift
// Single source of truth for NEWS2 — Royal College of Physicians, National Early Warning
// Score (NEWS) 2, December 2017. Used by VitalsEntry (ward round, patient rows, SOAP drafts),
// the Scores-screen calculator (ClinicalScoringEngine.news2) and the live preview in
// VitalsEntryView, so all three always give the same number and the same risk band.
// Pure, deterministic, no network.

import Foundation

// MARK: - Clinical risk band (RCP NEWS2 chart 3/4)

/// RCP NEWS2 clinical risk:
/// - aggregate 0–4 → low
/// - a score of 3 in any single parameter (aggregate below 5) → low-medium: urgent ward-based response
/// - aggregate 5–6 → medium: key threshold for urgent response
/// - aggregate 7 or more → high: emergency response
enum NEWS2Band: Int, Comparable, CaseIterable {
    case low = 0
    case lowMedium = 1
    case medium = 2
    case high = 3

    static func < (lhs: NEWS2Band, rhs: NEWS2Band) -> Bool { lhs.rawValue < rhs.rawValue }

    /// Short label shown next to the score ("NEWS2 3 (Low-medium)").
    var label: String {
        switch self {
        case .low:       return "Low"
        case .lowMedium: return "Low-medium"
        case .medium:    return "Medium"
        case .high:      return "High"
        }
    }

    /// RCP clinical response for the band.
    var clinicalResponse: String {
        switch self {
        case .low:       return "Ward-based response"
        case .lowMedium: return "Urgent ward-based response"
        case .medium:    return "Key threshold for urgent response"
        case .high:      return "Urgent or emergency response"
        }
    }

    /// One-line escalation prompt for banners.
    var prompt: String {
        switch self {
        case .low:       return "NEWS2 low — ward-based response."
        case .lowMedium: return "Single parameter scoring 3 (low-medium) — urgent ward-based response."
        case .medium:    return "NEWS2 5–6 (medium) — key threshold for urgent response."
        case .high:      return "NEWS2 ≥7 (high) — urgent or emergency response."
        }
    }

    /// Mapping onto the four-level ScoreRisk used by the Scores screen. ScoreRisk has no
    /// low-medium level; low-medium maps to `.moderate`, the lowest level that carries an
    /// URGENT prompt (its interpretation and recommendations say "urgent" explicitly), and
    /// shares it with medium. High maps to `.critical` (emergency response).
    var scoreRisk: ScoreRisk {
        switch self {
        case .low:               return .low
        case .lowMedium, .medium: return .moderate
        case .high:              return .critical
        }
    }

    /// Hex colour used by list rows and badges.
    var colorHex: String {
        switch self {
        case .low:       return "#22C55E"
        case .lowMedium: return "#F59E0B"
        case .medium:    return "#F97316"
        case .high:      return "#DC2626"
        }
    }
}

// MARK: - Result

struct NEWS2Result: Equatable {
    /// Aggregate score. Parameters that were not recorded contribute 0.
    let total: Int
    /// True when any single parameter scores 3 (RCP "red score").
    let hasSingleParameterScore3: Bool
    /// Parameters that were not recorded, in chart order (e.g. ["RR", "SpO₂"]).
    let missingParameters: [String]
    let band: NEWS2Band

    // Individual parameter points (0 when the parameter was not recorded).
    let respirationPoints: Int
    let spo2Points: Int
    let oxygenPoints: Int
    let systolicBPPoints: Int
    let heartRatePoints: Int
    let temperaturePoints: Int
    let consciousnessPoints: Int

    var isComplete: Bool { missingParameters.isEmpty }

    /// "incomplete: RR, SpO₂ not recorded", or nil when every parameter was recorded.
    var incompleteNote: String? {
        guard !missingParameters.isEmpty else { return nil }
        return "incomplete: \(missingParameters.joined(separator: ", ")) not recorded"
    }

    /// "NEWS2 5 (Medium)" or "NEWS2 2 (Low — incomplete: RR, SpO₂ not recorded)".
    var summary: String {
        if let note = incompleteNote { return "NEWS2 \(total) (\(band.label) — \(note))" }
        return "NEWS2 \(total) (\(band.label))"
    }
}

// MARK: - Chart

enum NEWS2Chart {

    /// Labels used in `missingParameters`, in chart order.
    static let respirationLabel  = "RR"
    static let spo2Label         = "SpO₂"
    static let systolicBPLabel   = "BP"
    static let heartRateLabel    = "HR"
    static let temperatureLabel  = "Temp"

    /// Respiration rate (per minute): ≤8 → 3, 9–11 → 1, 12–20 → 0, 21–24 → 2, ≥25 → 3.
    static func respirationPoints(_ rr: Int) -> Int {
        switch rr {
        case ..<9:    return 3
        case 9...11:  return 1
        case 12...20: return 0
        case 21...24: return 2
        default:      return 3
        }
    }

    /// SpO₂ (%).
    /// Scale 1 (default, everyone unless a clinician has opted the patient into Scale 2):
    ///   ≤91 → 3, 92–93 → 2, 94–95 → 1, ≥96 → 0.
    /// Scale 2 (ONLY confirmed hypercapnic respiratory failure, on a clinician's decision):
    ///   ≤83 → 3, 84–85 → 2, 86–87 → 1, 88–92 → 0, ≥93 on air → 0,
    ///   93–94 on oxygen → 1, 95–96 on oxygen → 2, ≥97 on oxygen → 3.
    static func spo2Points(_ spo2: Int, useScale2: Bool, onOxygen: Bool) -> Int {
        if !useScale2 {
            switch spo2 {
            case ..<92:   return 3
            case 92...93: return 2
            case 94...95: return 1
            default:      return 0
            }
        }
        switch spo2 {
        case ..<84:   return 3
        case 84...85: return 2
        case 86...87: return 1
        case 88...92: return 0
        default:
            // 93 and above scores only when the patient is on oxygen.
            guard onOxygen else { return 0 }
            switch spo2 {
            case 93...94: return 1
            case 95...96: return 2
            default:      return 3
            }
        }
    }

    /// Air or oxygen: any supplemental oxygen → 2. Applies on both SpO₂ scales.
    static func oxygenPoints(onOxygen: Bool) -> Int { onOxygen ? 2 : 0 }

    /// Systolic BP (mmHg): ≤90 → 3, 91–100 → 2, 101–110 → 1, 111–219 → 0, ≥220 → 3.
    static func systolicBPPoints(_ sbp: Int) -> Int {
        switch sbp {
        case ..<91:     return 3
        case 91...100:  return 2
        case 101...110: return 1
        case 111...219: return 0
        default:        return 3
        }
    }

    /// Pulse (per minute): ≤40 → 3, 41–50 → 1, 51–90 → 0, 91–110 → 1, 111–130 → 2, ≥131 → 3.
    static func heartRatePoints(_ hr: Int) -> Int {
        switch hr {
        case ..<41:     return 3
        case 41...50:   return 1
        case 51...90:   return 0
        case 91...110:  return 1
        case 111...130: return 2
        default:        return 3
        }
    }

    /// Temperature (°C, charted to one decimal place):
    /// ≤35.0 → 3, 35.1–36.0 → 1, 36.1–38.0 → 0, 38.1–39.0 → 1, ≥39.1 → 2.
    static func temperaturePoints(_ celsius: Double) -> Int {
        let t = (celsius * 10).rounded() / 10
        if t <= 35.0 { return 3 }
        if t <= 36.0 { return 1 }
        if t <= 38.0 { return 0 }
        if t <= 39.0 { return 1 }
        return 2
    }

    /// Aggregate → band. A single parameter scoring 3 lifts a low aggregate to low-medium;
    /// it never lowers a medium or high aggregate.
    static func band(total: Int, hasSingleParameterScore3: Bool) -> NEWS2Band {
        if total >= 7 { return .high }
        if total >= 5 { return .medium }
        if hasSingleParameterScore3 { return .lowMedium }
        return .low
    }

    /// Full NEWS2. Unrecorded parameters (nil) score 0 and are listed in `missingParameters`.
    /// Consciousness (ACVPU) and air/oxygen always have a value in this app and are never
    /// reported as missing.
    static func evaluate(respiratoryRate: Int?,
                         spo2: Int?,
                         onOxygen: Bool,
                         useSpO2Scale2: Bool,
                         systolicBP: Int?,
                         heartRate: Int?,
                         temperatureCelsius: Double?,
                         avpu: AVPU) -> NEWS2Result {
        var missing: [String] = []

        let rr: Int
        if let v = respiratoryRate { rr = respirationPoints(v) } else { rr = 0; missing.append(respirationLabel) }

        let sp: Int
        if let v = spo2 {
            sp = spo2Points(v, useScale2: useSpO2Scale2, onOxygen: onOxygen)
        } else {
            sp = 0; missing.append(spo2Label)
        }

        let o2 = oxygenPoints(onOxygen: onOxygen)

        let bp: Int
        if let v = systolicBP { bp = systolicBPPoints(v) } else { bp = 0; missing.append(systolicBPLabel) }

        let hr: Int
        if let v = heartRate { hr = heartRatePoints(v) } else { hr = 0; missing.append(heartRateLabel) }

        let temp: Int
        if let v = temperatureCelsius { temp = temperaturePoints(v) } else { temp = 0; missing.append(temperatureLabel) }

        let cons = avpu.news2Points

        let total = rr + sp + o2 + bp + hr + temp + cons
        // Supplemental oxygen scores at most 2, so it can never be a single-parameter 3.
        let single3 = [rr, sp, bp, hr, temp, cons].contains { $0 >= 3 }

        return NEWS2Result(total: total,
                           hasSingleParameterScore3: single3,
                           missingParameters: missing,
                           band: band(total: total, hasSingleParameterScore3: single3),
                           respirationPoints: rr,
                           spo2Points: sp,
                           oxygenPoints: o2,
                           systolicBPPoints: bp,
                           heartRatePoints: hr,
                           temperaturePoints: temp,
                           consciousnessPoints: cons)
    }
}
