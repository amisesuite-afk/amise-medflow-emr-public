import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Supabase merge rule for Patient.news2UseSpO2Scale2 (patients.news2_spo2_scale2, Migration 88).
/// Only the merge code runs; no network. A local change not yet pushed wins, otherwise the
/// server value is taken. A device that has never confirmed the flag with the server treats only
/// an opt-in as a local change, so its default `false` cannot clear another device's opt-in.
@MainActor
final class NEWS2Scale2CloudSyncTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!
    private var patient: Patient!

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
        patient = Patient(fullName: "Scale2 Cloud Patient")
        context.insert(patient)
    }

    func testNeverSyncedDefaultTakesServerOptIn() {
        XCTAssertNil(patient.news2Scale2SyncedValue)
        XCTAssertFalse(patient.news2Scale2NeedsPush)
        patient.applyServerNEWS2Scale2(true)
        XCTAssertTrue(patient.news2UseSpO2Scale2)
        XCTAssertEqual(patient.news2Scale2SyncedValue, true)
    }

    func testNeverSyncedLocalOptInIsKeptAndPushed() {
        patient.news2UseSpO2Scale2 = true
        XCTAssertTrue(patient.news2Scale2NeedsPush)
        patient.applyServerNEWS2Scale2(false)
        XCTAssertTrue(patient.news2UseSpO2Scale2, "unpushed opt-in must not be cleared by the server default")
        XCTAssertNil(patient.news2Scale2SyncedValue)
        XCTAssertTrue(patient.news2Scale2NeedsPush)
    }

    func testServerChangeAppliesWhenNoLocalChange() {
        patient.news2UseSpO2Scale2 = true
        patient.news2Scale2SyncedValue = true
        patient.applyServerNEWS2Scale2(false)   // cleared on another device
        XCTAssertFalse(patient.news2UseSpO2Scale2)
        XCTAssertEqual(patient.news2Scale2SyncedValue, false)
        XCTAssertFalse(patient.news2Scale2NeedsPush)
    }

    func testUnpushedLocalClearWins() {
        patient.news2UseSpO2Scale2 = false
        patient.news2Scale2SyncedValue = true   // cleared here, not pushed yet
        XCTAssertTrue(patient.news2Scale2NeedsPush)
        patient.applyServerNEWS2Scale2(true)
        XCTAssertFalse(patient.news2UseSpO2Scale2)
        XCTAssertTrue(patient.news2Scale2NeedsPush)
    }

    /// An unrelated pending edit (pendingSync) does not hold back the other device's flag change.
    func testUnrelatedPendingEditDoesNotBlockServerFlag() {
        patient.news2Scale2SyncedValue = false
        patient.ward = "Ward 3"
        patient.pendingSync = true
        patient.applyServerNEWS2Scale2(true)
        XCTAssertTrue(patient.news2UseSpO2Scale2)
    }

    func testMatchingServerValueConfirmsLocalChange() {
        patient.news2UseSpO2Scale2 = true
        patient.applyServerNEWS2Scale2(true)
        XCTAssertEqual(patient.news2Scale2SyncedValue, true)
        XCTAssertFalse(patient.news2Scale2NeedsPush)
    }
}
