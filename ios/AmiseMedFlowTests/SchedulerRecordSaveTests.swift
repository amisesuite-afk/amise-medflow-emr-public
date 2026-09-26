import XCTest
import SwiftData
@testable import AmiseMedFlow

/// The iPad front-desk scheduler saves the booking to the patient's record before the calendar
/// write (ApptType.applyBooking), so a calendar failure (access denied) no longer loses the visit
/// type; and appointment_type is a front-desk column (Migration 89 allow-list, Migration 97 column,
/// SyncService+AppointmentType).
@MainActor
final class SchedulerRecordSaveTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
    }

    private func patient() -> Patient {
        let p = Patient(fullName: "Scheduler Test")
        context.insert(p)
        p.pendingSync = false
        return p
    }

    func testFollowUpBookingSavesVisitTypeAndBookingType() {
        let p = patient()
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        let change = ApptType.applyBooking(.followUp, visitType: .followUp, date: date, to: p)
        XCTAssertTrue(change.edited)
        XCTAssertTrue(change.visitTypeChanged)
        XCTAssertEqual(p.visitType, .followUp)
        XCTAssertEqual(p.appointmentType, "Follow-Up")
        XCTAssertNil(p.operationDate, "a consultation booking is not an operation date")
        XCTAssertTrue(p.pendingSync)
    }

    func testProcedureBookingSetsTheListAndDate() {
        let p = patient()
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        ApptType.applyBooking(.endoscopy, visitType: .colonoscopy, date: date, to: p)
        XCTAssertEqual(p.setting, .endoscopy)
        XCTAssertEqual(p.operationDate, date)
        XCTAssertEqual(p.appointmentType, "Endoscopy / ERCP")
    }

    func testASpecificLabelFromElsewhereIsKept() {
        let p = patient()
        p.appointmentType = "Colonoscopy"   // calendar import
        let change = ApptType.applyBooking(.endoscopy, visitType: .colonoscopy, date: .now, to: p)
        XCTAssertEqual(p.appointmentType, "Colonoscopy")
        XCTAssertFalse(change.appointmentTypeChanged)
    }

    func testRebookingReplacesTheSchedulersOwnLabel() {
        let p = patient()
        ApptType.applyBooking(.followUp, visitType: .followUp, date: .now, to: p)
        ApptType.applyBooking(.procedure, visitType: .surgeryElective, date: .now, to: p)
        XCTAssertEqual(p.appointmentType, "Procedure")
    }

    func testNothingChangedLeavesTheRecordAlone() {
        let p = patient()
        ApptType.applyBooking(.followUp, visitType: .followUp, date: .now, to: p)
        p.pendingSync = false
        let change = ApptType.applyBooking(.followUp, visitType: .followUp, date: .now, to: p)
        XCTAssertFalse(change.edited)
        XCTAssertFalse(p.pendingSync)
    }

    func testAppointmentTypeIsAFrontDeskColumn() {
        XCTAssertTrue(FrontDeskPatientColumns.allowed.contains("appointment_type"))
    }

    func testAppointmentTypeSyncBookkeeping() {
        let p = patient()
        XCTAssertFalse(p.appointmentTypeNeedsPush)
        p.appointmentType = "Follow-Up"
        XCTAssertTrue(p.appointmentTypeNeedsPush)
        p.appointmentTypeSyncedValue = "Follow-Up"
        XCTAssertFalse(p.appointmentTypeNeedsPush)
        // A server value replaces a confirmed one …
        p.applyServerAppointmentType("Procedure")
        XCTAssertEqual(p.appointmentType, "Procedure")
        // … but not a local change still to push.
        p.appointmentType = "New Consultation"
        p.applyServerAppointmentType("Follow-Up")
        XCTAssertEqual(p.appointmentType, "New Consultation")
    }
}
