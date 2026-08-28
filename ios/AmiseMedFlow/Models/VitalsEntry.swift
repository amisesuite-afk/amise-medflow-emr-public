import SwiftData
import Foundation

// MARK: - AVPU consciousness scale (required for complete NEWS2)

enum AVPU: String, Codable, CaseIterable {
    case alert     = "A"
    case confused  = "C"   // new confusion — scores same as V/P/U in NEWS2
    case voice     = "V"
    case pain      = "P"
    case unresponsive = "U"

    var label: String {
        switch self {
        case .alert:        return "Alert"
        case .confused:     return "Confused (new)"
        case .voice:        return "Responds to voice"
        case .pain:         return "Responds to pain"
        case .unresponsive: return "Unresponsive"
        }
    }

    var news2Points: Int { self == .alert ? 0 : 3 }
}

@Model
final class VitalsEntry {
    var id: UUID
    var remoteId: String?
    var pendingSync: Bool
    var recordedAt: Date
    var bpSystolic: Int?
    var bpDiastolic: Int?
    var heartRate: Int?
    var respiratoryRate: Int?
    var temperatureCelsius: Double?
    var spo2: Int?
    var weightKg: Double?
    var glucoseMmol: Double?
    var avpu: AVPU
    var onSupplementalO2: Bool   // adds 2 pts to NEWS2; switches SpO₂ to Scale 2 for hypercapnic RF
    var notes: String?

    var patient: Patient?

    init(patient: Patient, recordedAt: Date = .now) {
        self.id = UUID()
        self.pendingSync = true
        self.recordedAt = recordedAt
        self.avpu = .alert
        self.onSupplementalO2 = false
        self.patient = patient
    }

    // MARK: - Helpers

    var bpString: String? {
        guard let s = bpSystolic, let d = bpDiastolic else { return nil }
        return "\(s)/\(d)"
    }

    var hasAnyValue: Bool {
        bpSystolic != nil || heartRate != nil || respiratoryRate != nil ||
        temperatureCelsius != nil || spo2 != nil || weightKg != nil
    }

    // MARK: - Full NEWS2 score (RCP 2017)
    // Includes: RR, SpO₂ (Scale 1 & 2), supplemental O₂, systolic BP, HR, temperature, AVPU

    var news2Score: Int {
        var score = 0

        // 1. Respiratory rate
        if let rr = respiratoryRate {
            score += rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3
        }

        // 2. SpO₂ — Scale 1 (default) or Scale 2 (supplemental O₂ / hypercapnic RF)
        if let spo = spo2 {
            if onSupplementalO2 {
                // Scale 2 (COPD / hypercapnic respiratory failure)
                score += spo >= 97 ? 3 : spo >= 95 ? 2 : spo >= 93 ? 1 : spo >= 88 ? 0 : 3
            } else {
                // Scale 1 (standard)
                score += spo >= 96 ? 0 : spo >= 94 ? 1 : spo >= 92 ? 2 : 3
            }
        }

        // 3. Supplemental O₂ (+2 if receiving any)
        if onSupplementalO2 { score += 2 }

        // 4. Systolic BP
        if let sys = bpSystolic {
            score += sys <= 90 ? 3 : sys <= 100 ? 2 : sys <= 110 ? 1 : sys <= 219 ? 0 : 3
        }

        // 5. Heart rate
        if let hr = heartRate {
            score += hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3
        }

        // 6. Temperature
        if let temp = temperatureCelsius {
            score += temp <= 35.0 ? 3 : temp <= 36.0 ? 1 : temp <= 38.0 ? 0 : temp <= 39.0 ? 1 : 2
        }

        // 7. AVPU consciousness
        score += avpu.news2Points

        return score
    }

    // Medium risk threshold: any single parameter ≥3 triggers medium even if total <5
    var news2HasRedFlag: Bool {
        guard let rr = respiratoryRate else { return false }
        if rr <= 8 || rr > 24 { return true }
        if let spo = spo2, spo < 92 { return true }
        if let sys = bpSystolic, sys <= 90 || sys > 219 { return true }
        if let hr  = heartRate,  hr <= 40 || hr > 130   { return true }
        if let t   = temperatureCelsius, t <= 35.0       { return true }
        if avpu != .alert                                 { return true }
        return false
    }

    var news2Risk: String {
        if news2Score >= 7 || news2HasRedFlag { return "High" }
        if news2Score >= 5                    { return "Medium" }
        return "Low"
    }

    var news2Color: String {
        switch news2Risk {
        case "High":   return "#DC2626"
        case "Medium": return "#F97316"
        default:       return "#22C55E"
        }
    }
}
