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

    // MARK: - Peer apply: pending rule (pure)

    func testLocalPendingEditsAreNeverClearedByAPeer() {
        for changed in [true, false] {
            for serverRow in [true, false] {
                for peer in [true, false, nil] as [Bool?] {
                    XCTAssertTrue(PeerApplyPending.pendingAfterApply(
                        localPending: true, contentChanged: changed, hasServerRow: serverRow,
                        peerPending: peer))
                }
            }
        }
    }

    func testPeersUnsentChangeBecomesPendingHereWhenItHasAServerRow() {
        XCTAssertTrue(PeerApplyPending.pendingAfterApply(
            localPending: false, contentChanged: true, hasServerRow: true, peerPending: true),
            "uploaded by whichever device reaches the cloud first (an idempotent update)")
    }

    func testNoPendingWithoutAChangeAServerRowOrAnUnsentPeerChange() {
        XCTAssertFalse(PeerApplyPending.pendingAfterApply(
            localPending: false, contentChanged: false, hasServerRow: true, peerPending: true),
            "nothing changed here: no second upload, no ping-pong")
        XCTAssertFalse(PeerApplyPending.pendingAfterApply(
            localPending: false, contentChanged: true, hasServerRow: false, peerPending: true),
            "no server row: only the origin device inserts it (two inserts = two rows)")
        XCTAssertFalse(PeerApplyPending.pendingAfterApply(
            localPending: false, contentChanged: true, hasServerRow: true, peerPending: false),
            "the peer already uploaded it: the cloud has it")
        XCTAssertFalse(PeerApplyPending.pendingAfterApply(
            localPending: false, contentChanged: true, hasServerRow: true, peerPending: nil),
            "older build (unknown): previous behaviour")
    }

    func testChildRecordTakesThePeersServerIdOnlyWhenItHasNone() {
        let other = "a1b2c3d4-0000-4000-8000-000000000001"
        XCTAssertEqual(PeerSyncService.linkedChildRemoteId(local: nil, peer: lowerUUID, tombstoned: []),
                       lowerUUID)
        XCTAssertEqual(PeerSyncService.linkedChildRemoteId(local: "", peer: lowerUUID, tombstoned: []),
                       lowerUUID)
        XCTAssertEqual(PeerSyncService.linkedChildRemoteId(local: other, peer: lowerUUID, tombstoned: []),
                       other, "a server id is never replaced")
        XCTAssertNil(PeerSyncService.linkedChildRemoteId(local: nil, peer: nil, tombstoned: []))
        XCTAssertNil(PeerSyncService.linkedChildRemoteId(local: nil, peer: "appt:\(lowerUUID)", tombstoned: []))
        XCTAssertNil(PeerSyncService.linkedChildRemoteId(local: nil, peer: "garbage", tombstoned: []))
        XCTAssertNil(PeerSyncService.linkedChildRemoteId(local: nil, peer: lowerUUID, tombstoned: [lowerUUID]),
                     "deleted on this device")
    }
}

/// Peer apply end to end (no Multipeer session; only the apply code runs).
@MainActor
final class PeerApplyPendingTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!
    /// A second store standing in for the other device.
    private var remoteContainer: ModelContainer!
    private var remoteContext: ModelContext!
    private var service: PeerSyncService!

    private let linkedKey = "amf.appointments.linkedIds"
    private var savedLinked: Any?

    private let serverUUID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301"
    private let t0 = Date(timeIntervalSince1970: 1_750_000_000)
    private var t1: Date { t0.addingTimeInterval(3600) }

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
        remoteContainer = try ModelContainer(for: schema,
                                             configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        remoteContext = remoteContainer.mainContext
        service = PeerSyncService()
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

    /// A patient already in the cloud, with nothing unsent on this device.
    private func cloudPatient(remoteId: String?) -> Patient {
        let p = Patient(fullName: "Ann Cloud")
        context.insert(p)
        p.remoteId = remoteId
        p.phone = "758-111-1111"
        p.syncedAt = t0
        p.updatedAt = t0
        p.pendingSync = false
        return p
    }

    /// The other device's copy of `local` (same syncCode and remoteId).
    private func peerCopy(of local: Patient, pending: Bool,
                          _ configure: (Patient) -> Void = { _ in }) -> PeerPatient {
        let r = Patient(fullName: local.fullName)
        remoteContext.insert(r)
        r.syncCode = local.syncCode
        r.remoteId = local.remoteId
        r.phone = local.phone
        r.syncedAt = t1
        configure(r)
        r.pendingSync = pending
        return PeerPatient(r)
    }

    func testPeersUnsentChangeKeepsTheRecordPendingHere() throws {
        let local = cloudPatient(remoteId: serverUUID)
        let rec = peerCopy(of: local, pending: true) { $0.phone = "758-222-2222" }

        try service.applyPatients([rec], context: context)

        XCTAssertEqual(local.phone, "758-222-2222")
        XCTAssertTrue(local.pendingSync, "the next cloud pull must not overwrite it before it is uploaded")
        XCTAssertGreaterThan(local.updatedAt, t0, "an in-flight push must not clear pending over it")
    }

    func testPeersUploadedChangeIsNotPendingHere() throws {
        let local = cloudPatient(remoteId: serverUUID)
        let rec = peerCopy(of: local, pending: false) { $0.phone = "758-222-2222" }

        try service.applyPatients([rec], context: context)

        XCTAssertEqual(local.phone, "758-222-2222")
        XCTAssertFalse(local.pendingSync)
    }

    func testUnchangedRecordIsNotMadePendingAgain() throws {
        let local = cloudPatient(remoteId: serverUUID)
        let rec = peerCopy(of: local, pending: true)   // same content, peer not uploaded yet

        try service.applyPatients([rec], context: context)

        XCTAssertFalse(local.pendingSync, "no change here: no second upload, no ping-pong")
        XCTAssertEqual(local.updatedAt, t0)
    }

    func testLocalUnsentEditSurvivesAnUploadedPeerCopy() throws {
        let local = cloudPatient(remoteId: serverUUID)
        local.pendingSync = true
        let rec = peerCopy(of: local, pending: false) { $0.hpi = "Longer peer history" }

        try service.applyPatients([rec], context: context)

        XCTAssertTrue(local.pendingSync)
    }

    func testRecordWithoutServerRowIsLeftToItsOriginDevice() throws {
        let local = cloudPatient(remoteId: nil)
        let rec = peerCopy(of: local, pending: true) { $0.phone = "758-333-3333" }

        try service.applyPatients([rec], context: context)

        XCTAssertEqual(local.phone, "758-333-3333")
        XCTAssertFalse(local.pendingSync, "two devices inserting it would create two rows")
    }

    func testNewPatientFromPeerIsPendingOnlyWithAServerRowAndUnsentChange() throws {
        let unsent = Patient(fullName: "Peer Unsent")
        remoteContext.insert(unsent)
        unsent.remoteId = serverUUID
        unsent.syncedAt = t0
        unsent.pendingSync = true
        let neverUploaded = Patient(fullName: "Peer Offline")
        remoteContext.insert(neverUploaded)
        neverUploaded.pendingSync = true

        try service.applyPatients([PeerPatient(unsent), PeerPatient(neverUploaded)], context: context)

        let all = try context.fetch(FetchDescriptor<Patient>())
        XCTAssertEqual(all.count, 2, "linked by syncCode, not duplicated")
        XCTAssertEqual(all.first { $0.syncCode == unsent.syncCode }?.pendingSync, true)
        XCTAssertEqual(all.first { $0.syncCode == neverUploaded.syncCode }?.pendingSync, false)
    }

    func testPayloadFromOlderBuildDecodesAndKeepsPreviousBehaviour() throws {
        let local = cloudPatient(remoteId: serverUUID)
        let rec = peerCopy(of: local, pending: true) { $0.phone = "758-444-4444" }
        var object = try XCTUnwrap(try JSONSerialization.jsonObject(with: JSONEncoder().encode(rec))
                                   as? [String: Any])
        XCTAssertNotNil(object["pendingSync"])
        object.removeValue(forKey: "pendingSync")
        let decoded = try JSONDecoder().decode(PeerPatient.self,
                                               from: JSONSerialization.data(withJSONObject: object))
        XCTAssertNil(decoded.pendingSync)

        try service.applyPatients([decoded], context: context)

        XCTAssertEqual(local.phone, "758-444-4444")
        XCTAssertFalse(local.pendingSync)
    }

    func testBookingPlaceholderTakesThePeersServerId() throws {
        let local = cloudPatient(remoteId: SyncRemoteId.placeholder(forAppointment: "booking-9"))
        let rec = peerCopy(of: local, pending: false) { $0.remoteId = self.serverUUID }

        try service.applyPatients([rec], context: context)

        XCTAssertEqual(local.remoteId, serverUUID)
        XCTAssertTrue(AppointmentLinks.ids().contains("booking-9"))
    }

    func testServerIdIsNeverGivenToASecondLocalRecord() throws {
        let holder = cloudPatient(remoteId: serverUUID)
        let other = Patient(fullName: "Other Copy")
        context.insert(other)
        other.syncedAt = t0
        let r = Patient(fullName: "Other Copy")
        remoteContext.insert(r)
        r.syncCode = other.syncCode
        r.remoteId = serverUUID
        r.syncedAt = t1

        try service.applyPatients([PeerPatient(r)], context: context)

        XCTAssertEqual(holder.remoteId, serverUUID)
        XCTAssertNil(other.remoteId, "remoteId is unique on this device")
    }

    // MARK: - Child records

    private func patientPair() -> (local: Patient, remote: Patient) {
        let local = cloudPatient(remoteId: serverUUID)
        let remote = Patient(fullName: local.fullName)
        remoteContext.insert(remote)
        remote.syncCode = local.syncCode
        remote.remoteId = serverUUID
        return (local, remote)
    }

    func testNewChildFromPeerIsPendingOnlyWithAServerRowAndUnsentChange() throws {
        let (_, remotePatient) = patientPair()
        let withRow = VitalsEntry(patient: remotePatient)
        remoteContext.insert(withRow)
        withRow.heartRate = 120
        withRow.remoteId = "a1b2c3d4-0000-4000-8000-000000000002"
        withRow.pendingSync = true   // edited on the peer, not uploaded yet
        let noRow = VitalsEntry(patient: remotePatient)
        remoteContext.insert(noRow)
        noRow.heartRate = 80
        noRow.pendingSync = true     // never uploaded: the peer inserts it

        try service.applyVitals([PeerVitals(withRow), PeerVitals(noRow)], context: context)

        let all = try context.fetch(FetchDescriptor<VitalsEntry>())
        XCTAssertEqual(all.first { $0.syncCode == withRow.syncCode }?.pendingSync, true)
        XCTAssertEqual(all.first { $0.syncCode == noRow.syncCode }?.pendingSync, false)
    }

    func testExistingChildTakesThePeersServerIdInsteadOfBeingInsertedAgain() throws {
        let (localPatient, remotePatient) = patientPair()
        let local = VitalsEntry(patient: localPatient)
        context.insert(local)
        local.heartRate = 90                         // pending, never uploaded from here
        let remote = VitalsEntry(patient: remotePatient)
        remoteContext.insert(remote)
        remote.syncCode = local.syncCode
        remote.heartRate = 90
        remote.remoteId = "a1b2c3d4-0000-4000-8000-000000000003"

        try service.applyVitals([PeerVitals(remote)], context: context)

        XCTAssertEqual(try context.fetch(FetchDescriptor<VitalsEntry>()).count, 1)
        XCTAssertEqual(local.remoteId, "a1b2c3d4-0000-4000-8000-000000000003",
                       "its push is now an update, and the cloud pull matches it")
        XCTAssertTrue(local.pendingSync, "its own unsent state is unchanged")
    }
}
