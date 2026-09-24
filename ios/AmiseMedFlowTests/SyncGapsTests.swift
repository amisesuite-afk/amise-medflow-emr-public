import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Sync gaps (no network):
/// 1. Booking placeholders ("appt:…") and malformed ids are never sent as a row id or patient_id
///    (SyncRemoteId, the UUID guard every push uses).
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
        XCTAssertEqual(SyncRemoteId.kind(nil), .none)
        XCTAssertEqual(SyncRemoteId.kind(""), .none)
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
}
