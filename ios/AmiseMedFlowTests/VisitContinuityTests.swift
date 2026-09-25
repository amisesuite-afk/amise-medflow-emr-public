// VisitContinuityTests.swift
// Returning patient: follow-up of the same problem, or a new problem (VisitContinuity).
// DRIFT NOTE: these vectors are ported 1:1 to the web in
// artifacts/dashboard/src/lib/__tests__/visit-continuity.test.ts (twin of
// lib/triage-engine/src/visit-continuity.ts). Change both platforms in the same PR.

import XCTest
@testable import AmiseMedFlow

final class VisitContinuityTests: XCTestCase {

    private func previous(complaint: String? = nil, diagnosis: String? = nil) -> VisitContinuity.PreviousVisit {
        .init(date: Date(timeIntervalSinceNow: -14 * 86_400), complaint: complaint,
              diagnosis: diagnosis, diagnosisICD: nil, plan: "Review with ultrasound")
    }

    func testNoNewComplaintIsTheSameProblem() {
        let last = previous(complaint: "Right upper quadrant pain", diagnosis: "Biliary colic")
        XCTAssertTrue(VisitContinuity.isSameProblem(current: nil, previous: last))
        XCTAssertTrue(VisitContinuity.isSameProblem(current: "  ", previous: last))
    }

    func testUnchangedOrRewordedComplaintIsTheSameProblem() {
        let last = previous(complaint: "RUQ pain after fatty food", diagnosis: "Biliary colic")
        XCTAssertTrue(VisitContinuity.isSameProblem(current: "RUQ pain after fatty food", previous: last))
        // Same region in different words.
        XCTAssertTrue(VisitContinuity.isSameProblem(current: "Abdominal pain again", previous: last))
        // Names the diagnosis.
        XCTAssertTrue(VisitContinuity.isSameProblem(current: "Biliary colic review", previous: last))
        // Plural and suffix forms.
        XCTAssertTrue(VisitContinuity.isSameProblem(current: "Gallstones",
                                                    previous: previous(complaint: "Gallstone")))
    }

    func testDifferentComplaintIsANewProblem() {
        let last = previous(complaint: "Right inguinal lump", diagnosis: "Inguinal hernia")
        XCTAssertFalse(VisitContinuity.isSameProblem(current: "Breast lump", previous: last))
        XCTAssertFalse(VisitContinuity.isSameProblem(current: "Rectal bleeding", previous: last))
        // Generic words alone ("pain", "left", "severe") do not make it the same problem.
        XCTAssertFalse(VisitContinuity.isSameProblem(current: "Severe left foot pain", previous: last))
    }

    func testNothingToCompareWithIsTheSameProblem() {
        XCTAssertTrue(VisitContinuity.isSameProblem(current: "Breast lump", previous: previous()))
    }

    func testPreviousProblemPrefersDiagnosis() {
        let last = VisitContinuity.PreviousVisit(date: .now, complaint: "RUQ pain", diagnosis: "Acute cholecystitis",
                                                 diagnosisICD: "K81.0", plan: nil)
        XCTAssertEqual(last.problem, "Acute cholecystitis [K81.0]")
        XCTAssertEqual(previous(complaint: "Neck swelling").problem, "Neck swelling")
    }

    func testFollowUpStepsIncludeTheStandingHistory() {
        let steps = ConsultPathway.followUp.steps
        for tab in [ConsultTab.history, .hpi, .pmh, .pshx, .meds, .allergies, .exam, .diagnosis, .plan] {
            XCTAssertTrue(steps.contains(tab), "follow-up is missing \(tab)")
        }
        XCTAssertEqual(ConsultPathway.followUp.label(for: .history), "Last visit")
        XCTAssertEqual(ConsultPathway.followUp.label(for: .hpi), "Interval Hx")
    }
}
