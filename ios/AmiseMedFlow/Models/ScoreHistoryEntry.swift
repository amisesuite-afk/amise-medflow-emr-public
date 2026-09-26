import SwiftData
import Foundation

// MARK: - Persisted clinical score save record

@Model
final class ScoreHistoryEntry {
    var id: UUID
    var scoreName: String       // ClinicalScore.systemName (display name, not ActiveScore.rawValue) —
                                // resolve with ActiveScore(storedScoreName:)
    var abbreviation: String    // e.g. "MEWS 4", "NEWS2 7"
    var scoreValue: Double
    var maxScore: Double
    var riskRaw: String         // ScoreRisk.rawValue
    var recordedAt: Date
    var patient: Patient?

    init(scoreName: String, abbreviation: String, scoreValue: Double,
         maxScore: Double, riskRaw: String) {
        self.id = UUID()
        self.scoreName = scoreName
        self.abbreviation = abbreviation
        self.scoreValue = scoreValue
        self.maxScore = maxScore
        self.riskRaw = riskRaw
        self.recordedAt = .now
    }
}
