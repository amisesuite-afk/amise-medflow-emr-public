// VisitContinuityTests.swift
// Returning patient: follow-up of the same problem, or a new problem (VisitContinuity).
// The word rules are the shared file clinical-content/rules/visit-continuity.json. The shared
// vectors AmiseMedFlowTests/Resources/VisitContinuityVectors.json are run here and by
// artifacts/dashboard/src/lib/__tests__/visit-continuity.test.ts; the other vectors below are
// ported 1:1 to that web test (twin of lib/triage-engine/src/visit-continuity.ts). Change both
// platforms in the same PR.

import XCTest
@testable import AmiseMedFlow

private final class VisitContinuityVectorsToken {}

private struct VCWordVector: Decodable {
    let text: String
    let words: [String]
}

private struct VCSameVector: Decodable {
    let current: String?
    let complaint: String?
    let diagnosis: String?
    let same: Bool
}

private struct VCVectors: Decodable {
    let rulesVersion: String
    let words: [VCWordVector]
    let same: [VCSameVector]
}

final class VisitContinuityTests: XCTestCase {

    private static func loadVectors() throws -> VCVectors {
        let bundle = Bundle(for: VisitContinuityVectorsToken.self)
        let url = bundle.url(forResource: "VisitContinuityVectors", withExtension: "json")
            ?? URL(fileURLWithPath: #filePath).deletingLastPathComponent()
                .appendingPathComponent("Resources").appendingPathComponent("VisitContinuityVectors.json")
        return try JSONDecoder().decode(VCVectors.self, from: Data(contentsOf: url))
    }

    func testSharedWordRulesLoaded() throws {
        let rules = try XCTUnwrap(VisitContinuity.wordRules, "rules/visit-continuity.json missing or not decoding")
        XCTAssertTrue(VisitContinuity.isAvailable)
        XCTAssertEqual(try Self.loadVectors().rulesVersion, rules.version)
    }

    func testSharedVectors() throws {
        let vectors = try Self.loadVectors()
        XCTAssertGreaterThan(vectors.words.count, 30)
        XCTAssertGreaterThan(vectors.same.count, 10)
        for v in vectors.words {
            XCTAssertEqual(VisitContinuity.meaningfulWords(v.text).sorted(), v.words, "meaningfulWords(\(v.text))")
        }
        for v in vectors.same {
            let prev = VisitContinuity.PreviousVisit(date: .now, complaint: v.complaint, diagnosis: v.diagnosis,
                                                     diagnosisICD: nil, plan: nil)
            XCTAssertEqual(VisitContinuity.isSameProblem(current: v.current, previous: prev), v.same,
                           "isSameProblem(\(v.current ?? "nil") | \(v.complaint ?? "nil") / \(v.diagnosis ?? "nil"))")
        }
    }

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
