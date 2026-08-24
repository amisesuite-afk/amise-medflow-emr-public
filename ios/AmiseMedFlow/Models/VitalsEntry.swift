import SwiftData
import Foundation

@Model
final class VitalsEntry {
    var id: UUID = UUID()
    var recordedAt: Date = .now
    var bpSystolic: Int?
    var bpDiastolic: Int?
    var heartRate: Int?
    var respiratoryRate: Int?
    var temperatureCelsius: Double?
    var spo2: Int?
    var weightKg: Double?
    var glucoseMmol: Double?
    var notes: String?

    var patient: Patient?

    init(patient: Patient, recordedAt: Date = .now) {
        self.id = UUID()
        self.recordedAt = recordedAt
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

    // NEWS2 score (simplified — excludes consciousness/supplemental O2 modifier)
    var news2Score: Int {
        var score = 0
        if let rr = respiratoryRate {
            if rr <= 8       { score += 3 }
            else if rr <= 11 { score += 1 }
            else if rr <= 20 { score += 0 }
            else if rr <= 24 { score += 2 }
            else              { score += 3 }
        }
        if let spo = spo2 {
            if spo >= 96     { score += 0 }
            else if spo >= 94 { score += 1 }
            else if spo >= 92 { score += 2 }
            else              { score += 3 }
        }
        if let sys = bpSystolic {
            if sys <= 90      { score += 3 }
            else if sys <= 100 { score += 2 }
            else if sys <= 110 { score += 1 }
            else if sys <= 219 { score += 0 }
            else               { score += 3 }
        }
        if let hr = heartRate {
            if hr <= 40       { score += 3 }
            else if hr <= 50  { score += 1 }
            else if hr <= 90  { score += 0 }
            else if hr <= 110 { score += 1 }
            else if hr <= 130 { score += 2 }
            else               { score += 3 }
        }
        if let temp = temperatureCelsius {
            if temp <= 35.0   { score += 3 }
            else if temp <= 36.0 { score += 1 }
            else if temp <= 38.0 { score += 0 }
            else if temp <= 39.0 { score += 1 }
            else                { score += 2 }
        }
        return score
    }

    var news2Risk: String {
        switch news2Score {
        case 0...4:  return "Low"
        case 5...6:  return "Medium"
        default:     return "High"
        }
    }

    var news2Color: String {
        switch news2Score {
        case 0...4:  return "#22C55E"
        case 5...6:  return "#F97316"
        default:     return "#DC2626"
        }
    }
}
