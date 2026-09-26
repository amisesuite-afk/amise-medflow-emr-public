import XCTest
@testable import AmiseMedFlow

/// Visit type on the front-desk scheduler (ApptType mapping, calendar label).
final class VisitTypeFormsTests: XCTestCase {

    // MARK: - Scheduler

    func testVisitTypeSuggestsBookingType() {
        // The switch is exhaustive; endoscopy / procedure decide the scope and theatre lists.
        XCTAssertEqual(ApptType.suggested(for: .ogd), .endoscopy)
        XCTAssertEqual(ApptType.suggested(for: .colonoscopy), .endoscopy)
        XCTAssertEqual(ApptType.suggested(for: .ercp), .endoscopy)
        XCTAssertEqual(ApptType.suggested(for: .bronchoscopy), .endoscopy)
        XCTAssertEqual(ApptType.suggested(for: .surgeryElective), .procedure)
        XCTAssertEqual(ApptType.suggested(for: .dayOfSurgery), .procedure)
        XCTAssertEqual(ApptType.suggested(for: .followUp), .followUp)
        XCTAssertEqual(ApptType.suggested(for: .postOp), .followUp)
        XCTAssertEqual(ApptType.suggested(for: .newConsult), .newConsult)
        XCTAssertEqual(ApptType.suggested(for: .urgentReview), .emergency)
        XCTAssertNil(ApptType.suggested(for: .telephone))
    }

    func testEventLabelSaysTheSameTypeOnce() {
        XCTAssertEqual(ApptType.eventLabel(.newConsult, visitType: .newConsult), "New Consultation")
        XCTAssertEqual(ApptType.eventLabel(.followUp, visitType: .followUp), "Follow-Up")
    }

    func testEventLabelAddsTheVisitType() {
        XCTAssertEqual(ApptType.eventLabel(.endoscopy, visitType: .colonoscopy), "Endoscopy / ERCP · Colonoscopy")
        XCTAssertEqual(ApptType.eventLabel(.followUp, visitType: .postOp), "Follow-Up · Post-op Review")
    }

    /// Front desk may set the visit type (Migration 89 allow-list, mirrored on iOS).
    func testVisitTypeIsAFrontDeskColumn() {
        XCTAssertTrue(FrontDeskPatientColumns.allowed.contains("visit_type"))
    }
}
