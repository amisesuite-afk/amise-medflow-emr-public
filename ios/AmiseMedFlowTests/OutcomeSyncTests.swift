// OutcomeSyncTests.swift
// Outcomes loop cloud sync (SyncService+Outcomes.swift): the Swift twin of the web sanitisers
// (OutcomeSanitiser.swift) against the shared vectors (Resources/OutcomeSanitiserVectors.json, also
// run by the dashboard test outcomes-sanitiser-vectors.test.ts), the server rows, and the pure sync
// rules (OutcomeSync.swift): nurse / doctor / admin only, quiet back-off while Migration 94 is
// missing, retract-before-confirm order, 0-row retraction outcomes and the pull merge that never
// touches a pending record.

import XCTest
import SwiftData
@testable import AmiseMedFlow

private final class OutcomeVectorsToken {}

private struct SnapshotVector: Decodable {
    let name: String
    let input: OutcomePredictionRecord
    let expected: OutcomeSanitisedSnapshot?
    let error: String?
}

private struct FinalVector: Decodable {
    let name: String
    let input: OutcomeFinalDiagnosisRecord
    let expected: OutcomeSanitisedFinalDiagnosis?
    let error: String?
}

private struct OutcomeVectors: Decodable {
    let snapshots: [SnapshotVector]
    let finalDiagnoses: [FinalVector]
}

@MainActor
final class OutcomeSyncTests: XCTestCase {

    private static func loadVectors() throws -> OutcomeVectors {
        let bundle = Bundle(for: OutcomeVectorsToken.self)
        let url = bundle.url(forResource: "OutcomeSanitiserVectors", withExtension: "json")
            ?? URL(fileURLWithPath: #filePath).deletingLastPathComponent()
                .appendingPathComponent("Resources").appendingPathComponent("OutcomeSanitiserVectors.json")
        return try JSONDecoder().decode(OutcomeVectors.self, from: Data(contentsOf: url))
    }

    // MARK: - Shared vectors (same results as the web sanitisers)

    func testSnapshotVectors() throws {
        let v = try Self.loadVectors()
        XCTAssertGreaterThan(v.snapshots.count, 10)
        for c in v.snapshots {
            switch OutcomeSanitiser.sanitizeSnapshot(c.input) {
            case .success(let value):
                XCTAssertNil(c.error, "\(c.name): expected a refusal")
                XCTAssertEqual(value, c.expected, c.name)
            case .failure(let error):
                XCTAssertEqual(error.message, c.error, c.name)
            }
        }
    }

    func testFinalDiagnosisVectors() throws {
        let v = try Self.loadVectors()
        XCTAssertGreaterThan(v.finalDiagnoses.count, 5)
        for c in v.finalDiagnoses {
            switch OutcomeSanitiser.sanitizeFinalDiagnosis(c.input) {
            case .success(let value):
                XCTAssertNil(c.error, "\(c.name): expected a refusal")
                XCTAssertEqual(value, c.expected, c.name)
            case .failure(let error):
                XCTAssertEqual(error.message, c.error, c.name)
            }
        }
    }

    func testICD10NormalisationMatchesTheWeb() {
        XCTAssertEqual(OutcomeCodes.normaliseICD10("K35.80  Acute appendicitis"), "K35.80")
        XCTAssertEqual(OutcomeCodes.normaliseICD10("N20.1, left"), "N20.1")
        XCTAssertEqual(OutcomeCodes.normaliseICD10("k 35 80"), "K35.80")
        XCTAssertEqual(OutcomeCodes.normaliseICD10("K35.80\t-\tappendicitis"), "K35.80")
        XCTAssertNil(OutcomeCodes.normaliseICD10("K35-80"))
        XCTAssertNil(OutcomeCodes.normaliseICD10("K35.80123"))
    }

    func testServerTimestampsWithMicrosecondsAreRead() {
        // Postgres returns timestamptz with microseconds; Date.parse keeps the milliseconds.
        XCTAssertEqual(OutcomeSanitiser.isoDate("2026-09-22T10:00:00.123456+00:00"), "2026-09-22T10:00:00.123Z")
        XCTAssertEqual(OutcomeSanitiser.isoDate("2026-09-22T10:00:00+00:00"), "2026-09-22T10:00:00.000Z")
        XCTAssertEqual(OutcomeSanitiser.isoDate("2026-09-22"), "2026-09-22T00:00:00.000Z")
        XCTAssertNil(OutcomeSanitiser.isoDate(""))
        XCTAssertNil(OutcomeSanitiser.normaliseSourceDate("2026-9-22"))
    }

    // MARK: - Rows

    private let patientRow = "0B3F6F7E-9A1D-4C55-8E2A-1A2B3C4D5E6F"
    private let userId = "7C9E6679-7425-40DE-944B-E07FC1F90AE7"

    private func sampleSnapshot() throws -> OutcomeSanitisedSnapshot {
        let v = try Self.loadVectors()
        return try XCTUnwrap(v.snapshots.first?.expected)
    }

    func testSnapshotRowNeedsAServerPatientId() throws {
        let s = try sampleSnapshot()
        XCTAssertNil(OutcomeSanitiser.snapshotRow(s, patientId: "appt:123", createdBy: userId))
        XCTAssertNil(OutcomeSanitiser.snapshotRow(s, patientId: "not-a-uuid", createdBy: userId))
        let row = try XCTUnwrap(OutcomeSanitiser.snapshotRow(s, patientId: patientRow, createdBy: "someone"))
        XCTAssertEqual(row.patient_id, patientRow)
        XCTAssertEqual(row.encounter_ref, s.encounterRef)
        XCTAssertEqual(row.platform, "ios")
        XCTAssertEqual(row.differential_engine, "ios-bayes")
        XCTAssertNil(row.created_by, "a created_by that is not a user id is not sent")
        XCTAssertEqual(OutcomeSanitiser.snapshotRow(s, patientId: patientRow, createdBy: userId)?.created_by, userId)
    }

    func testSnapshotRowUsesTheMigrationColumns() throws {
        let row = try XCTUnwrap(OutcomeSanitiser.snapshotRow(try sampleSnapshot(), patientId: patientRow, createdBy: userId))
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(row)) as? [String: Any])
        for key in ["patient_id", "encounter_ref", "platform", "completed_at", "snapshot_version", "differential_engine",
                    "differential_model_version", "model_versions", "top_differential", "scores", "decision_bands",
                    "features", "recorded_icd10", "expects_outcome", "outcome_triggers"] {
            XCTAssertNotNil(object[key], key)
        }
        XCTAssertNil(object["encounter_id"], "iOS encounters are local: encounter_id is left to its default (null)")
        XCTAssertNil(object["sync"])
    }

    private func final(status: String = "confirmed", retractedAt: String? = nil) -> OutcomeSanitisedFinalDiagnosis {
        OutcomeSanitisedFinalDiagnosis(encounterRef: "ios:ABC-1", finalIcd10: "K35.2", finalDiseaseId: nil,
                                       sourceType: "histology", sourceDate: "2026-09-10", actionsTaken: [],
                                       retrospectiveAcuity: "urgent", status: status,
                                       confirmedAt: "2026-09-10T10:00:00.000Z")
    }

    func testOutcomeRowConfirmedAndRetracted() throws {
        let confirmed = try XCTUnwrap(OutcomeSanitiser.outcomeRow(final(), patientId: patientRow, clientRef: "ios:X-1",
                                                                  userId: userId, retractedAt: nil))
        XCTAssertEqual(confirmed.status, "confirmed")
        XCTAssertNil(confirmed.retracted_at)
        XCTAssertNil(confirmed.retracted_by)
        XCTAssertEqual(confirmed.confirmed_by, userId)
        XCTAssertEqual(confirmed.client_ref, "ios:X-1")

        // Retracted before it was ever sent: inserted as retracted, with its time (CHECK constraint).
        XCTAssertNil(OutcomeSanitiser.outcomeRow(final(status: "retracted"), patientId: patientRow, clientRef: "ios:X-1",
                                                 userId: userId, retractedAt: nil))
        let retracted = try XCTUnwrap(OutcomeSanitiser.outcomeRow(final(status: "retracted"), patientId: patientRow,
                                                                  clientRef: "ios:X-1", userId: userId,
                                                                  retractedAt: "2026-09-11T09:00:00Z"))
        XCTAssertEqual(retracted.status, "retracted")
        XCTAssertEqual(retracted.retracted_at, "2026-09-11T09:00:00.000Z")
        XCTAssertEqual(retracted.retracted_by, userId)

        XCTAssertNil(OutcomeSanitiser.outcomeRow(final(), patientId: "appt:9", clientRef: nil, userId: nil, retractedAt: nil))
        XCTAssertNil(OutcomeSanitiser.outcomeRow(final(), patientId: patientRow, clientRef: "bad ref!", userId: nil,
                                                 retractedAt: nil)?.client_ref)
    }

    // MARK: - Who pushes

    func testOnlyAConfirmedNurseDoctorOrAdminSyncsOutcomes() {
        XCTAssertFalse(OutcomeSync.mayUse(role: .frontDesk, roleConfirmed: true))
        XCTAssertFalse(OutcomeSync.mayUse(role: .frontDesk, roleConfirmed: false))
        XCTAssertFalse(OutcomeSync.mayUse(role: .doctor, roleConfirmed: false), "an unconfirmed role sends nothing")
        XCTAssertTrue(OutcomeSync.mayUse(role: .nurse, roleConfirmed: true))
        XCTAssertTrue(OutcomeSync.mayUse(role: .doctor, roleConfirmed: true))
        XCTAssertTrue(OutcomeSync.mayUse(role: .admin, roleConfirmed: true))
    }

    // MARK: - Migration 94 absent

    func testMissingTableCodesAndQuietBackOff() {
        for code in ["42P01", "PGRST205", "PGRST204", "42703"] { XCTAssertTrue(OutcomeSync.isMissingTable(code: code), code) }
        XCTAssertFalse(OutcomeSync.isMissingTable(code: "42501"))
        XCTAssertFalse(OutcomeSync.isMissingTable(code: nil))

        let t0 = Date(timeIntervalSince1970: 1_790_000_000)
        XCTAssertTrue(OutcomeSync.shouldAttempt(now: t0, unavailableSince: nil))
        XCTAssertFalse(OutcomeSync.shouldAttempt(now: t0.addingTimeInterval(30), unavailableSince: t0),
                       "the 30-second sync does not ask again")
        XCTAssertFalse(OutcomeSync.shouldAttempt(now: t0.addingTimeInterval(5 * 3600), unavailableSince: t0))
        XCTAssertTrue(OutcomeSync.shouldAttempt(now: t0.addingTimeInterval(6 * 3600), unavailableSince: t0))
        XCTAssertTrue(OutcomeSync.shouldAttempt(now: t0.addingTimeInterval(-60), unavailableSince: t0),
                      "a clock set back does not block for ever")
        XCTAssertTrue(OutcomeSync.isUniqueViolation(code: "23505"))
        XCTAssertFalse(OutcomeSync.isUniqueViolation(code: "23514"))
    }

    // MARK: - Correction order and retraction outcomes

    private func record(_ ref: String, confirmed: Bool, pending: Bool, remoteId: String? = nil,
                        confirmedAt: String = "2026-09-10T10:00:00Z") -> OutcomeFinalDiagnosisRecord {
        OutcomeFinalDiagnosisRecord(encounterRef: "ios:ABC-1", finalIcd10: "K35.2", finalDiseaseId: nil,
                                    sourceType: "histology", sourceDate: "2026-09-10", actionsTaken: [],
                                    retrospectiveAcuity: nil, status: confirmed ? "confirmed" : "retracted",
                                    confirmedAt: confirmedAt, retractedAt: confirmed ? nil : "2026-09-11T10:00:00Z",
                                    sync: OutcomeSyncState(clientRef: ref, remoteId: remoteId, pendingSync: pending,
                                                           updatedAt: confirmedAt))
    }

    func testRetractionsArePushedBeforeTheNewConfirmedDiagnosis() {
        let list = [
            record("ios:A", confirmed: false, pending: false, remoteId: patientRow),
            record("ios:B", confirmed: false, pending: true, remoteId: userId),
            record("ios:C", confirmed: true, pending: true),
        ]
        XCTAssertEqual(OutcomeSync.pushOrder(list), [1, 2])
        let reversed = [list[2], list[1]]
        XCTAssertEqual(OutcomeSync.pushOrder(reversed), [1, 0], "the retraction goes first whatever the stored order")
        XCTAssertEqual(OutcomeSync.pushOrder([list[0]]), [])
    }

    func testZeroRowRetraction() {
        XCTAssertEqual(OutcomeSync.retractOutcome(rowsReturned: 1, signedIn: true, serverStatus: nil), .applied)
        XCTAssertEqual(OutcomeSync.retractOutcome(rowsReturned: 0, signedIn: false, serverStatus: "confirmed"), .retryLater)
        XCTAssertEqual(OutcomeSync.retractOutcome(rowsReturned: 0, signedIn: true, serverStatus: "confirmed"), .refused)
        XCTAssertEqual(OutcomeSync.retractOutcome(rowsReturned: 0, signedIn: true, serverStatus: "retracted"), .applied,
                       "a retry after a lost answer finds it already retracted")
        XCTAssertEqual(OutcomeSync.retractOutcome(rowsReturned: 0, signedIn: true, serverStatus: nil), .rowGone)
    }

    func testRefusalIdComesFromTheClientRef() {
        let encounterId = UUID()
        let uuid = UUID()
        XCTAssertEqual(OutcomeSync.refusalId(clientRef: "ios:\(uuid.uuidString)", encounterId: encounterId), uuid)
        XCTAssertEqual(OutcomeSync.refusalId(clientRef: "srv:whatever", encounterId: encounterId), encounterId)
    }

    // MARK: - Pull merge

    private func serverRow(id: String, clientRef: String?, status: String, confirmedAt: String = "2026-09-12T10:00:00Z",
                           icd: String = "K35.3") -> DiagnosisOutcomeServerRow {
        DiagnosisOutcomeServerRow(id: id, encounter_ref: "ios:ABC-1", client_ref: clientRef, final_icd10: icd,
                                  final_disease_id: nil, source_type: "histology", source_date: "2026-09-12",
                                  actions_taken: [], retrospective_acuity: nil, status: status,
                                  confirmed_at: confirmedAt,
                                  retracted_at: status == "retracted" ? "2026-09-13T10:00:00Z" : nil)
    }

    func testPullNeverTouchesAnEncounterWithUnsentChanges() {
        let local = [record("ios:A", confirmed: true, pending: true)]
        XCTAssertNil(OutcomeSync.merge(local: local, server: [serverRow(id: patientRow, clientRef: "ios:A", status: "retracted")]))
    }

    func testPullTakesARetractionMadeElsewhereAndAddsANewDiagnosis() throws {
        let local = [record("ios:A", confirmed: true, pending: false, remoteId: patientRow)]
        let newId = "A1B2C3D4-0000-4000-8000-00000000000A"
        let merged = try XCTUnwrap(OutcomeSync.merge(local: local, server: [
            serverRow(id: patientRow, clientRef: "ios:A", status: "retracted"),
            serverRow(id: newId, clientRef: "web-1234", status: "confirmed", confirmedAt: "2026-09-13T11:00:00Z"),
        ]))
        XCTAssertEqual(merged.count, 2)
        XCTAssertEqual(merged[0].status, "retracted")
        XCTAssertEqual(merged[0].retractedAt, "2026-09-13T10:00:00Z")
        XCTAssertFalse(merged[0].sync.pendingSync)
        XCTAssertEqual(merged[1].finalIcd10, "K35.3")
        XCTAssertEqual(merged[1].sync.remoteId, newId)
        XCTAssertFalse(merged[1].sync.pendingSync, "a pulled row is not sent back")
        XCTAssertTrue(merged[1].isConfirmed)
    }

    func testPullIsANoOpWhenNothingChangedAndIgnoresBadRows() {
        let local = [record("ios:A", confirmed: true, pending: false, remoteId: patientRow)]
        XCTAssertNil(OutcomeSync.merge(local: local, server: [serverRow(id: patientRow, clientRef: "ios:A", status: "confirmed")]))
        XCTAssertNil(OutcomeSync.merge(local: local, server: [serverRow(id: "not-a-uuid", clientRef: nil, status: "confirmed")]))
        XCTAssertNil(OutcomeSync.merge(local: local, server: [
            serverRow(id: userId, clientRef: nil, status: "confirmed", icd: "Appendicitis"),
        ]), "a row that is not a coded ICD-10 diagnosis is ignored")
    }

    func testPullNeverConfirmsARetractedRecordAgain() {
        let local = [record("ios:A", confirmed: false, pending: false, remoteId: patientRow)]
        XCTAssertNil(OutcomeSync.merge(local: local, server: [serverRow(id: patientRow, clientRef: "ios:A", status: "confirmed")]))
    }

    // MARK: - Encounter storage (sync bookkeeping only)

    func testSyncBookkeepingUpdatesKeepTheCodedValues() throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        let container = try ModelContainer(for: schema, configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        let e = Encounter()
        container.mainContext.insert(e)
        let first = OutcomeFinalDiagnosisRecord(encounterRef: "ios:\(e.syncCode)", finalIcd10: "K35.2",
                                                sourceType: .histology, sourceDate: "2026-09-10",
                                                retrospectiveAcuity: .urgent)
        e.confirmFinalDiagnosis(first)
        e.updateFinalDiagnosis(clientRef: first.sync.clientRef) { r in
            r.sync.remoteId = self.patientRow
            r.sync.pendingSync = false
        }
        let stored = try XCTUnwrap(e.outcomeFinalDiagnoses.first)
        XCTAssertEqual(stored.finalIcd10, "K35.2")
        XCTAssertEqual(stored.sync.remoteId, patientRow)
        XCTAssertFalse(stored.sync.pendingSync)

        // A correction retracts the sent record (pending again) and adds a new pending one.
        let second = OutcomeFinalDiagnosisRecord(encounterRef: "ios:\(e.syncCode)", finalIcd10: "K35.3",
                                                 sourceType: .histology, sourceDate: "2026-09-11",
                                                 retrospectiveAcuity: nil)
        e.confirmFinalDiagnosis(second)
        let all = e.outcomeFinalDiagnoses
        XCTAssertEqual(all.map(\.status), ["retracted", "confirmed"])
        XCTAssertEqual(all.map(\.sync.pendingSync), [true, true])
        XCTAssertEqual(OutcomeSync.pushOrder(all), [0, 1])
    }
}
