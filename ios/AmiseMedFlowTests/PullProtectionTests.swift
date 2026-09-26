import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Cloud pull protection for patients (PatientPullMerge.applyServerPatientRow, used by
/// SyncService.pullPatients). Only the merge code runs; no network.
///
/// The pull runs before the push. A patient with pendingSync holds local edits the server has
/// not seen, so the pull must not write the server row over them (it would revert, say, an acuity
/// raised to urgent offline before it is ever pushed). It still takes the server-owned link
/// fields: remoteId, an MRN the local copy lacks, and the NEWS2 Scale 2 flag (own tracking).
/// Once the push confirms (pendingSync cleared), the next pull applies server changes again.
@MainActor
final class PullProtectionTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!
    private let iso = ISO8601DateFormatter()

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
    }

    // MARK: - Helpers

    /// A server row decoded the same way the pull decodes it. Unlisted columns are absent (nil).
    private func serverRow(_ fields: [String: Any]) throws -> RemotePatientRow {
        var json: [String: Any] = [
            "id": "srv-1",
            "full_name": "Server Name",
            "created_at": "2026-09-01T08:00:00Z",
        ]
        for (key, value) in fields { json[key] = value }
        let data = try JSONSerialization.data(withJSONObject: json)
        return try JSONDecoder().decode(RemotePatientRow.self, from: data)
    }

    /// A row that disagrees with `localEditedPatient` on every admin field the old pull overwrote.
    private func conflictingRow() throws -> RemotePatientRow {
        try serverRow([
            "full_name": "Server Name",
            "sex": "male",
            "phone": "758-999-9999",
            "email": "server@example.com",
            "address": "Server address",
            "mrn": "AM-20269999",
            "nok_name": "Server NOK",
            "insurance_provider": "Server Insurer",
            "setting": "outpatient",
            "location": "rodney_bay",
            "acuity": "routine",
            "encounter_status": "waiting",
            "check_in_time": "2026-09-24T08:00:00Z",
            "chief_complaint": "Server complaint",
            "ward": "Server ward",
        ])
    }

    /// An existing, linked patient with an unpushed local edit (acuity raised to urgent etc.).
    private func localEditedPatient() -> Patient {
        let p = Patient(fullName: "Local Name", sex: .female, setting: .inpatient,
                        location: .tapion, acuity: .urgent)
        context.insert(p)
        p.remoteId = "srv-1"
        p.phone = "758-111-1111"
        p.email = "local@example.com"
        p.address = "Local address"
        p.mrn = "AM-20260001"
        p.nokName = "Local NOK"
        p.insuranceProvider = "Local Insurer"
        p.encounterStatus = .withDoctor
        p.checkInTime = iso.date(from: "2026-09-24T09:30:00Z")
        p.chiefComplaint = nil          // cleared locally on purpose
        p.ward = "Ward 3"
        p.updatedAt = .now
        p.pendingSync = true
        return p
    }

    // MARK: - Pending local edits are kept

    func testPendingPatientKeepsEveryLocalAdminField() throws {
        let p = localEditedPatient()
        let checkIn = p.checkInTime

        let outcome = PatientPullMerge.applyServerPatientRow(try conflictingRow(), to: p,
                                                             isNewRecord: false, iso: iso)

        XCTAssertEqual(outcome, .keptPendingLocalEdits)
        XCTAssertEqual(p.acuity, .urgent, "an unpushed acuity change must not be reverted")
        XCTAssertEqual(p.setting, .inpatient)
        XCTAssertEqual(p.location, .tapion)
        XCTAssertEqual(p.encounterStatus, .withDoctor)
        XCTAssertEqual(p.checkInTime, checkIn)
        XCTAssertEqual(p.fullName, "Local Name")
        XCTAssertEqual(p.sex, .female)
        XCTAssertEqual(p.phone, "758-111-1111")
        XCTAssertEqual(p.email, "local@example.com")
        XCTAssertEqual(p.address, "Local address")
        XCTAssertEqual(p.mrn, "AM-20260001", "a local MRN is kept")
        XCTAssertEqual(p.nokName, "Local NOK")
        XCTAssertEqual(p.insuranceProvider, "Local Insurer")
        XCTAssertEqual(p.ward, "Ward 3")
        XCTAssertTrue(p.pendingSync, "still pending, so the push that follows sends the local values")
    }

    func testPendingPatientKeepsAFieldClearedLocally() throws {
        let p = localEditedPatient()
        PatientPullMerge.applyServerPatientRow(try conflictingRow(), to: p, isNewRecord: false, iso: iso)
        XCTAssertNil(p.chiefComplaint, "a field emptied locally must not be refilled from the server")
    }

    func testPendingPatientKeepsDateOfBirth() throws {
        let p = localEditedPatient()
        let dob = iso.date(from: "1980-05-01T00:00:00Z")
        p.dateOfBirth = dob
        PatientPullMerge.applyServerPatientRow(
            try serverRow(["date_of_birth": "1970-01-01T00:00:00Z"]), to: p, isNewRecord: false, iso: iso)
        XCTAssertEqual(p.dateOfBirth, dob)
    }

    // MARK: - Server-owned fields still apply to a pending patient

    func testPendingUnlinkedPatientTakesRemoteIdAndServerAssignedMRN() throws {
        // e.g. matched by MRN adoption, or a patient the server gave an MRN on insert.
        let p = Patient(fullName: "Local Name", acuity: .urgent)
        context.insert(p)
        XCTAssertTrue(p.pendingSync)
        XCTAssertNil(p.mrn)

        let outcome = PatientPullMerge.applyServerPatientRow(
            try serverRow(["id": "srv-42", "mrn": "AM-20260042", "acuity": "routine"]),
            to: p, isNewRecord: false, iso: iso)

        XCTAssertEqual(outcome, .keptPendingLocalEdits)
        XCTAssertEqual(p.remoteId, "srv-42", "the link to the server row is server-owned")
        XCTAssertEqual(p.mrn, "AM-20260042", "an MRN the local copy lacks is taken from the server")
        XCTAssertEqual(p.acuity, .urgent)
        XCTAssertTrue(p.pendingSync)
    }

    func testPendingPatientStillTakesServerNEWS2Scale2() throws {
        // Scale 2 has its own last-confirmed value: an unrelated pending edit must not hold back
        // a change made on another device.
        let p = localEditedPatient()
        p.news2UseSpO2Scale2 = true
        p.news2Scale2SyncedValue = true
        PatientPullMerge.applyServerPatientRow(
            try serverRow(["news2_spo2_scale2": false]), to: p, isNewRecord: false, iso: iso)
        XCTAssertFalse(p.news2UseSpO2Scale2)
        XCTAssertEqual(p.news2Scale2SyncedValue, false)
        XCTAssertEqual(p.acuity, .urgent)
    }

    func testPendingPatientKeepsUnpushedNEWS2Scale2Change() throws {
        let p = localEditedPatient()
        p.news2UseSpO2Scale2 = true
        p.news2Scale2SyncedValue = false   // opted in here, not pushed yet
        PatientPullMerge.applyServerPatientRow(
            try serverRow(["news2_spo2_scale2": false]), to: p, isNewRecord: false, iso: iso)
        XCTAssertTrue(p.news2UseSpO2Scale2)
    }

    // MARK: - Clean and new patients take the server row

    func testCleanPatientTakesServerAdminFields() throws {
        let p = localEditedPatient()
        p.pendingSync = false
        p.chiefComplaint = "Local complaint"

        let outcome = PatientPullMerge.applyServerPatientRow(try conflictingRow(), to: p,
                                                             isNewRecord: false, iso: iso)

        XCTAssertEqual(outcome, .applied)
        XCTAssertEqual(p.acuity, .routine)
        XCTAssertEqual(p.setting, .outpatient)
        XCTAssertEqual(p.location, .rodney_bay)
        XCTAssertEqual(p.encounterStatus, .waiting)
        XCTAssertEqual(p.checkInTime, iso.date(from: "2026-09-24T08:00:00Z"))
        XCTAssertEqual(p.fullName, "Server Name")
        XCTAssertEqual(p.sex, .male)
        XCTAssertEqual(p.phone, "758-999-9999")
        XCTAssertEqual(p.mrn, "AM-20269999")
        // Clinical narrative is only filled when empty locally (unchanged rule).
        XCTAssertEqual(p.chiefComplaint, "Local complaint")
        XCTAssertEqual(p.ward, "Ward 3")
        XCTAssertFalse(p.pendingSync)
        XCTAssertNotNil(p.syncedAt)
    }

    func testNewRecordFromPullTakesEverythingAndIsClean() throws {
        let p = Patient(fullName: "Server Name")
        context.insert(p)
        XCTAssertTrue(p.pendingSync, "Patient.init defaults to pending")

        let outcome = PatientPullMerge.applyServerPatientRow(
            try serverRow(["acuity": "emergency", "setting": "inpatient", "location": "tapion",
                           "encounter_status": "with_doctor", "chief_complaint": "RUQ pain"]),
            to: p, isNewRecord: true, iso: iso)

        XCTAssertEqual(outcome, .applied)
        XCTAssertEqual(p.remoteId, "srv-1")
        XCTAssertEqual(p.acuity, .emergency)
        XCTAssertEqual(p.setting, .inpatient)
        XCTAssertEqual(p.location, .tapion)
        XCTAssertEqual(p.encounterStatus, .withDoctor)
        XCTAssertEqual(p.chiefComplaint, "RUQ pain")
        XCTAssertFalse(p.pendingSync, "a record created by the pull has nothing to push")
    }

    // MARK: - After a confirmed push, server updates flow again

    func testConfirmedPushLetsTheNextPullApplyServerChanges() throws {
        let p = localEditedPatient()

        // Pull before the push: local urgent kept.
        PatientPullMerge.applyServerPatientRow(try conflictingRow(), to: p, isNewRecord: false, iso: iso)
        XCTAssertEqual(p.acuity, .urgent)

        // pushPatientEdits confirmed the update (server returned the row): pending cleared.
        p.pendingSync = false

        // Another device later sets the patient to priority; the next pull takes it.
        let outcome = PatientPullMerge.applyServerPatientRow(
            try serverRow(["acuity": "priority", "encounter_status": "complete"]),
            to: p, isNewRecord: false, iso: iso)
        XCTAssertEqual(outcome, .applied)
        XCTAssertEqual(p.acuity, .priority)
        XCTAssertEqual(p.encounterStatus, .complete)
    }

    // MARK: - Value mapping (moved from SyncService, unchanged)

    func testAcuityAndLocationMapping() {
        XCTAssertEqual(PatientPullMerge.acuityFromString("emergency"), .emergency)
        XCTAssertEqual(PatientPullMerge.acuityFromString("urgent"), .urgent)
        XCTAssertEqual(PatientPullMerge.acuityFromString("priority"), .priority)
        XCTAssertEqual(PatientPullMerge.acuityFromString("anything else"), .routine)
        XCTAssertEqual(PatientPullMerge.locationDisplayName("rodney_bay"), "Rodney Bay")
        XCTAssertEqual(PatientPullMerge.locationDisplayName("tapion"), "Tapion")
        XCTAssertEqual(PatientPullMerge.locationDisplayName("okeu"), "OKEU")
        XCTAssertEqual(PatientPullMerge.locationDisplayName("victoria"), "Victoria")
        XCTAssertEqual(PatientPullMerge.locationDisplayName("unknown"), "Other")
    }
}
