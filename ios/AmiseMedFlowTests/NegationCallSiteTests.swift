import XCTest
@testable import AmiseMedFlow

/// Free-text finding detection on the consultation path goes through NegationMatcher: a documented
/// negative is not the finding. One test per call site, each with a positive control.
final class NegationCallSiteTests: XCTestCase {

    // MARK: - ClinicalPathwayEngine (CC / PMH red flags and escalation)

    func testNegatedJaundiceInTheComplaintDoesNotEscalate() {
        XCTAssertEqual(ClinicalPathwayEngine.assess(chiefComplaint: "Epigastric pain, no jaundice").suggestedAcuity, .routine)
        XCTAssertEqual(ClinicalPathwayEngine.assess(chiefComplaint: "Epigastric pain with jaundice").suggestedAcuity, .urgent)
    }

    func testNegatedHistoryIsNotAnEmergencyRedFlag() {
        let r = ClinicalPathwayEngine.assess(chiefComplaint: "Abdominal pain",
                                             pmh: "No history of perforation or peritonitis")
        XCTAssertTrue(r.redFlags.isEmpty, "\(r.redFlags)")
        XCTAssertNotEqual(r.suggestedAcuity, .emergency)
        XCTAssertEqual(ClinicalPathwayEngine.assess(chiefComplaint: "Generalised peritonitis").suggestedAcuity, .emergency)
    }

    func testNoWeightLossIsNotAColorectalRedFlag() {
        let negative = ClinicalPathwayEngine.assess(chiefComplaint: "Change in bowel habit, no weight loss")
        XCTAssertEqual(negative.pathway, "Colorectal Screening Pathway")
        XCTAssertTrue(negative.redFlags.isEmpty, "\(negative.redFlags)")
        XCTAssertEqual(negative.suggestedAcuity, .routine)
        let positive = ClinicalPathwayEngine.assess(chiefComplaint: "Change in bowel habit and weight loss")
        XCTAssertEqual(positive.suggestedAcuity, .priority)
    }

    // MARK: - PatientStateVector PMH flags (pipeline questions)

    func testPMHFlagsIgnoreNegatedHistory() {
        let flags = PMHFlags.parse(from: "No history of DVT or PE. Hypertension.")
        XCTAssertFalse(flags.dvtOrPE)
        XCTAssertTrue(flags.hypertension)
        XCTAssertTrue(PMHFlags.parse(from: "Previous DVT 2019").dvtOrPE)
    }
}
