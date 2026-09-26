// ConsultationView+OutcomeSnapshot.swift
// Outcomes loop: on "Complete visit", the engines' outputs are frozen on today's completed visit
// as coded data only (OutcomeSnapshot.swift). Kept on this device, sync-ready; nothing is pushed
// yet and nothing in the record changes.

import SwiftUI
import SwiftData

extension ConsultationView {

    /// Freezes the prediction on today's completed visit (once: a second completion keeps the first).
    func recordOutcomeSnapshot(now: Date = .now) {
        guard let encounter = patient.encounters
            .filter({ $0.isLive && $0.isComplete && Calendar.ect.isDate($0.encounterDate, inSameDayAs: now) })
            .max(by: { $0.encounterDate < $1.encounterDate }),
              encounter.predictionSnapshotJson == nil else { return }

        let differential = encounter.decodedBayesianSnapshot.map {
            OutcomeSnapshotBuilder.DifferentialItem(icd: $0.icdCode, probability: $0.probability)
        }
        // NEWS2 only from a complete set of today's observations (an incomplete set under-scores).
        let todaysVitals = patient.vitalsEntries
            .filter { $0.isLive && $0.hasAnyValue && Calendar.ect.isDate($0.recordedAt, inSameDayAs: now) }
            .max(by: { $0.recordedAt < $1.recordedAt })
        let news2: Int? = (todaysVitals?.news2Result.isComplete ?? false) ? todaysVitals?.news2Score : nil

        var operation = OutcomeSnapshotBuilder.procedureVisitTypes.contains(encounter.visitType)
        if let opDate = patient.operationDate, abs(opDate.timeIntervalSince(now)) <= 30 * 86_400 {
            operation = true
        }
        let pathology = encounter.decodedInvestigations.contains {
            $0.status != .cancelled
                && OutcomeSnapshotBuilder.isPathologyRequest(name: $0.name, category: $0.category)
        }

        let database = DiagnosticDatabaseInfo.current
        let input = OutcomeSnapshotBuilder.Input(
            encounterSyncCode: encounter.syncCode,
            completedAt: now,
            differential: differential,
            acuity: encounter.acuity,
            workingICD: encounter.workingDiagnosisICD ?? patient.workingDiagnosisICD,
            news2: news2,
            operation: operation,
            pathology: pathology,
            databaseVersion: database.versionText,
            databaseLoaded: database.engineLoaded
        )
        guard let record = OutcomeSnapshotBuilder.build(input) else { return }
        encounter.storeOutcomePredictionIfMissing(record)
        AuditLog.record("create", "prediction_snapshot", patient: patient, resourceId: encounter.syncCode,
                        details: ["engine": record.differentialEngine,
                                  "model_version": record.differentialModelVersion,
                                  "expects_outcome": record.expectsOutcome ? "true" : "false"])
    }
}
