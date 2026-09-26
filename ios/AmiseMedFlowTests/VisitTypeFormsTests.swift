import XCTest
@testable import AmiseMedFlow

/// Visit type on the front-desk scheduler (ApptType mapping, calendar label) and in the
/// consultation step bar (pathway suggestion).
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

    // MARK: - Consultation: pathway suggestion after a visit-type change

    private func rec(_ p: ConsultPathway) -> ConsultPathway.Recommendation {
        ConsultPathway.Recommendation(pathway: p, reasons: ["from the record"])
    }

    func testNoSuggestionWhileThePathwayFits() {
        XCTAssertNil(ConsultPathway.suggestion(afterChangingTo: .ercp, current: .procedure,
                                               recommended: rec(.procedure)))
        XCTAssertNil(ConsultPathway.suggestion(afterChangingTo: .postOp, current: .followUp,
                                               recommended: rec(.firstVisit)))
    }

    func testOffersTheRecommendedPathway() {
        let s = ConsultPathway.suggestion(afterChangingTo: .ogd, current: .firstVisit,
                                          recommended: rec(.procedure))
        XCTAssertEqual(s?.pathway, .procedure)
        XCTAssertEqual(s?.reasons, ["from the record"])
        // The record's recommendation comes first (e.g. an inpatient: ward review).
        XCTAssertEqual(ConsultPathway.suggestion(afterChangingTo: .ogd, current: .firstVisit,
                                                 recommended: rec(.wardReview))?.pathway, .wardReview)
    }

    func testFallsBackToTheVisitTypesPathway() {
        // The record still recommends the current pathway: offer the visit type's own one.
        let s = ConsultPathway.suggestion(afterChangingTo: .followUp, current: .firstVisit,
                                          recommended: rec(.firstVisit))
        XCTAssertEqual(s?.pathway, .followUp)
        XCTAssertEqual(s?.reasons, ["Visit type: Follow-up"])
    }

    /// Front desk may set the visit type (Migration 89 allow-list, mirrored on iOS).
    func testVisitTypeIsAFrontDeskColumn() {
        XCTAssertTrue(FrontDeskPatientColumns.allowed.contains("visit_type"))
    }
}
