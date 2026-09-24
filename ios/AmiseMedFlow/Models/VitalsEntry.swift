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
    var syncCode: String = ""  // stable offline peer-sync ID, set in init()
    var syncedAt: Date?
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
    var onSupplementalO2: Bool   // adds 2 pts to NEWS2 (SpO₂ scale is chosen per patient, not by O₂)
    var notes: String?

    var patient: Patient?

    init(patient: Patient, recordedAt: Date = .now) {
        self.id = UUID()
        self.syncCode = UUID().uuidString
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

    // MARK: - NEWS2 (RCP 2017) — calculated by NEWS2Chart, shared with the Scores screen

    /// SpO₂ Scale 2 is used ONLY when a clinician has marked this patient as having confirmed
    /// hypercapnic respiratory failure (Patient.news2UseSpO2Scale2). Everyone else, including
    /// patients on supplemental oxygen, is scored on Scale 1; oxygen adds 2 points separately.
    var news2UsesSpO2Scale2: Bool { patient?.news2UseSpO2Scale2 ?? false }

    var news2Result: NEWS2Result {
        NEWS2Chart.evaluate(respiratoryRate: respiratoryRate,
                            spo2: spo2,
                            onOxygen: onSupplementalO2,
                            useSpO2Scale2: news2UsesSpO2Scale2,
                            systolicBP: bpSystolic,
                            heartRate: heartRate,
                            temperatureCelsius: temperatureCelsius,
                            avpu: avpu)
    }

    /// Aggregate NEWS2. Parameters that were not recorded count as 0 — check `news2IsComplete`.
    var news2Score: Int { news2Result.total }

    /// A score of 3 in any single parameter, whatever else is (or is not) recorded.
    var news2HasRedFlag: Bool { news2Result.hasSingleParameterScore3 }

    var news2Band: NEWS2Band { news2Result.band }

    /// "Low", "Low-medium" (single parameter 3: urgent ward-based response), "Medium" or "High".
    var news2Risk: String { news2Band.label }

    var news2Color: String { news2Band.colorHex }

    /// True when RR, SpO₂, systolic BP, HR and temperature were all recorded.
    var news2IsComplete: Bool { news2Result.isComplete }

    /// Unrecorded NEWS2 parameters, in chart order (e.g. ["RR", "SpO₂"]).
    var news2MissingParameters: [String] { news2Result.missingParameters }

    /// "incomplete: RR, SpO₂ not recorded", or nil when complete.
    var news2IncompleteNote: String? { news2Result.incompleteNote }

    /// Text for notes, handovers and PDFs: "NEWS2 5 (Medium)" or
    /// "NEWS2 2 (Low — incomplete: RR, SpO₂ not recorded)".
    var news2Summary: String { news2Result.summary }

    /// Short risk label for compact rows: "Low" or "Low · incomplete".
    var news2RiskDisplay: String { news2IsComplete ? news2Risk : "\(news2Risk) · incomplete" }
}
