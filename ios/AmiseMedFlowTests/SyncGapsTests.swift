import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Sync gaps (no network):
/// 1. Booking placeholders ("appt:…") and malformed ids are never sent as a row id or patient_id
///    (SyncRemoteId, the UUID guard every push uses).
/// 2. Prescriptions, vitals and billing items edited after their first upload are sent as
///    updates (the UPDATE payload builders and the rule for clearing pendingSync).
@MainActor
final class SyncGapsTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!

    private let linkedKey = "amf.appointments.linkedIds"
    private var savedLinked: Any?

    private let serverUUID = "3F2504E0-4F89-11D3-9A0C-0305E82C3301"
    private let lowerUUID  = "3f2504e0-4f89-11d3-9a0c-0305e82c3301"

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
        savedLinked = UserDefaults.standard.object(forKey: linkedKey)
        UserDefaults.standard.removeObject(forKey: linkedKey)
    }

    override func tearDown() async throws {
        if let savedLinked {
            UserDefaults.standard.set(savedLinked, forKey: linkedKey)
        } else {
            UserDefaults.standard.removeObject(forKey: linkedKey)
        }
    }

    // MARK: - UUID guard

    func testServerIdAcceptsCanonicalUUIDsInEitherCase() {
        XCTAssertEqual(SyncRemoteId.serverId(serverUUID), serverUUID)
        XCTAssertEqual(SyncRemoteId.serverId(lowerUUID), lowerUUID, "sent exactly as stored")
        XCTAssertTrue(SyncRemoteId.isValidUUID(lowerUUID))
    }

    func testServerIdRejectsEverythingElse() {
        for bad in [nil, "", "appt:\(lowerUUID)", "appt:", "not-a-uuid", "12345",
                    "\(lowerUUID) ", "{\(lowerUUID)}", "3f2504e04f8911d39a0c0305e82c3301"] {
            XCTAssertNil(SyncRemoteId.serverId(bad), "must never be sent: \(bad ?? "nil")")
        }
    }

    // MARK: - Placeholder detection

    func testKindClassifiesRemoteIds() {
        XCTAssertEqual(SyncRemoteId.kind(nil), .notInserted)
        XCTAssertEqual(SyncRemoteId.kind(""), .notInserted)
        XCTAssertEqual(SyncRemoteId.kind(lowerUUID), .server(lowerUUID))
        XCTAssertEqual(SyncRemoteId.kind("appt:\(lowerUUID)"),
                       .appointmentPlaceholder(appointmentId: lowerUUID))
        XCTAssertEqual(SyncRemoteId.kind("garbage"), .invalid)
    }

    func testPlaceholderRoundTrip() {
        let placeholder = SyncRemoteId.placeholder(forAppointment: lowerUUID)
        XCTAssertEqual(placeholder, "appt:\(lowerUUID)", "same sentinel the appointment pull always wrote")
        XCTAssertTrue(SyncRemoteId.isAppointmentPlaceholder(placeholder))
        XCTAssertFalse(SyncRemoteId.isAppointmentPlaceholder(lowerUUID))
        XCTAssertFalse(SyncRemoteId.isAppointmentPlaceholder(nil))
    }

    /// pushPendingPatients creates (or links) a row for these; a malformed id is left alone so an
    /// insert cannot duplicate a row the app lost track of.
    func testNeedsServerRow() {
        XCTAssertTrue(SyncRemoteId.needsServerRow(nil))
        XCTAssertTrue(SyncRemoteId.needsServerRow(""))
        XCTAssertTrue(SyncRemoteId.needsServerRow("appt:\(lowerUUID)"))
        XCTAssertFalse(SyncRemoteId.needsServerRow(lowerUUID))
        XCTAssertFalse(SyncRemoteId.needsServerRow("garbage"))
    }

    func testAdoptingAServerIdRemembersTheBooking() {
        let p = Patient(fullName: "Booked Patient")
        context.insert(p)
        p.remoteId = SyncRemoteId.placeholder(forAppointment: "booking-1")

        p.adoptServerId(lowerUUID)

        XCTAssertEqual(p.remoteId, lowerUUID)
        XCTAssertTrue(AppointmentLinks.ids().contains("booking-1"),
                      "the appointment pull must not create this patient again")
    }

    func testAdoptingAServerIdWithoutPlaceholderRemembersNothing() {
        let p = Patient(fullName: "Local Patient")
        context.insert(p)
        p.adoptServerId(lowerUUID)
        XCTAssertEqual(p.remoteId, lowerUUID)
        XCTAssertTrue(AppointmentLinks.ids().isEmpty)
    }

    func testPlaceholderPatientWithPendingChildRecordNeedsARow() {
        let p = Patient(fullName: "Booked Patient")
        context.insert(p)
        p.remoteId = SyncRemoteId.placeholder(forAppointment: "booking-2")
        p.pendingSync = false
        XCTAssertFalse(p.hasPendingChildRecords, "an untouched booking stays local")

        let rx = Prescription(drug: "Paracetamol")   // new records start pending
        context.insert(rx)
        rx.patient = p
        XCTAssertTrue(p.hasPendingChildRecords)

        rx.pendingSync = false
        XCTAssertFalse(p.hasPendingChildRecords)
    }

    // MARK: - Child record edits: confirmation rule

    func testPendingClearedOnlyWhenRowReturnedAndNotEditedDuringRequest() {
        let t = Date(timeIntervalSince1970: 1_750_000_000)
        XCTAssertTrue(SyncPushConfirmation.mayClearPending(rowsReturned: 1, editedAtBeforeRequest: t,
                                                           editedAtNow: t))
        XCTAssertFalse(SyncPushConfirmation.mayClearPending(rowsReturned: 0, editedAtBeforeRequest: t,
                                                            editedAtNow: t),
                       "0 rows: RLS did not apply the update (or the row is gone)")
        XCTAssertFalse(SyncPushConfirmation.mayClearPending(rowsReturned: 1, editedAtBeforeRequest: t,
                                                            editedAtNow: t.addingTimeInterval(1)),
                       "edited while the request ran: that edit was not sent")
        XCTAssertTrue(SyncPushConfirmation.mayClearPending(rowsReturned: 1, editedAtBeforeRequest: nil,
                                                           editedAtNow: nil),
                      "a record from before updatedAt existed, not edited since")
    }

    func testMarkEditedSetsPendingAndBumpsUpdatedAt() {
        let old = Date(timeIntervalSince1970: 1_000)
        let p = Patient(fullName: "V")
        context.insert(p)
        let rx = Prescription(drug: "Metronidazole")
        context.insert(rx)
        let v = VitalsEntry(patient: p)
        context.insert(v)
        let item = BillingLineItem(code: "99213", description: "Visit", category: "E/M")
        context.insert(item)
        rx.pendingSync = false; rx.updatedAt = old
        v.pendingSync = false; v.updatedAt = old
        item.pendingSync = false; item.updatedAt = old

        rx.markEdited(); v.markEdited(); item.markEdited()

        XCTAssertTrue(rx.pendingSync); XCTAssertGreaterThan(rx.updatedAt ?? old, old)
        XCTAssertTrue(v.pendingSync); XCTAssertGreaterThan(v.updatedAt ?? old, old)
        XCTAssertTrue(item.pendingSync); XCTAssertGreaterThan(item.updatedAt ?? old, old)
    }

    // MARK: - Child record edits: UPDATE payloads

    private func json<T: Encodable>(_ value: T) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        return try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    func testPrescriptionUpdateSendsEditableColumnsOnly() throws {
        let rx = Prescription(drug: "Co-amoxiclav", dose: "625 mg", route: "Oral",
                              frequency: "TDS", duration: "", indication: "Cellulitis")
        context.insert(rx)
        rx.instructions = "With food"
        let object = try json(PrescriptionUpdateRow(rx))

        XCTAssertEqual(object["drug_name"] as? String, "Co-amoxiclav")
        XCTAssertEqual(object["dose"] as? String, "625 mg")
        XCTAssertEqual(object["route"] as? String, "Oral")
        XCTAssertEqual(object["frequency"] as? String, "TDS")
        XCTAssertEqual(object["indication"] as? String, "Cellulitis")
        XCTAssertEqual(object["instructions"] as? String, "With food")
        XCTAssertNotNil(object["prescribed_at"] as? String)
        XCTAssertNil(object["duration"], "empty: left out, as in the insert (never an explicit null)")
        XCTAssertNil(object["patient_id"], "set once at insert")
        XCTAssertNil(object["prescriber_id"], "set once at insert")
        XCTAssertNil(object["id"])
    }

    func testVitalsUpdateSendsClearedValuesAsNull() throws {
        let p = Patient(fullName: "V")
        context.insert(p)
        let v = VitalsEntry(patient: p, recordedAt: Date(timeIntervalSince1970: 1_750_000_000))
        context.insert(v)
        v.heartRate = 88
        v.temperatureCelsius = 37.9
        v.spo2 = nil           // a mistyped reading removed
        v.avpu = .voice
        v.onSupplementalO2 = true
        let object = try json(VitalsUpdateRow(v))

        XCTAssertEqual(object["heart_rate"] as? Int, 88)
        XCTAssertEqual(object["temperature_c"] as? Double, 37.9)
        XCTAssertEqual(object["avpu"] as? String, "V")
        XCTAssertEqual(object["on_supplemental_o2"] as? Bool, true)
        XCTAssertEqual(object["recorded_at"] as? String, "2025-06-15T15:06:40Z")
        for cleared in ["spo2", "bp_systolic", "bp_diastolic", "respiratory_rate", "weight_kg",
                        "glucose_mmol", "notes"] {
            XCTAssertTrue(object.keys.contains(cleared), "\(cleared) must be sent")
            XCTAssertTrue(object[cleared] is NSNull, "\(cleared) cleared on the server too")
        }
        XCTAssertNil(object["patient_id"], "set once at insert")
    }

    func testBillingUpdateSendsTheEditedLine() throws {
        let item = BillingLineItem(code: "99213", description: "Office visit", category: "E/M")
        context.insert(item)
        item.units = 2
        item.amountXCD = 150.5
        item.modifier = "25"
        item.note = "Separate procedure"
        let object = try json(BillingItemUpdateRow(item))

        XCTAssertEqual(object["cpt_code"] as? String, "99213")
        XCTAssertEqual(object["cpt_description"] as? String, "Office visit")
        XCTAssertEqual(object["cpt_category"] as? String, "E/M")
        XCTAssertEqual(object["units"] as? Int, 2)
        XCTAssertEqual(object["amount_xcd"] as? Double, 150.5)
        XCTAssertEqual(object["modifier"] as? String, "25")
        XCTAssertEqual(object["note"] as? String, "Separate procedure")
        XCTAssertNotNil(object["added_at"] as? String)
        XCTAssertNil(object["patient_id"], "set once at insert")
    }
}
