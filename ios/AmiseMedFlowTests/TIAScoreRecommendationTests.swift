import XCTest
@testable import AmiseMedFlow

/// No ABCD² recommendation for TIA (NICE NG128), and "tia" read as a whole word.
/// docs/clinical-validation/changes/ios-screening-parity.md.
final class TIAScoreRecommendationTests: XCTestCase {

    private func recs(dx: String, cc: String? = nil) -> [ActiveScore] {
        let p = Patient(fullName: "Test Patient")
        p.workingDiagnosis = dx
        p.chiefComplaint = cc
        return DiagnosisScoreMapper.recommendations(for: p).map(\.score)
    }

    func testTIADoesNotRecommendABCD2() {
        let r = recs(dx: "Transient ischaemic attack")
        XCTAssertFalse(r.contains(.abcd2))
        XCTAssertTrue(r.contains(.nihss))
        XCTAssertFalse(recs(dx: "TIA — left carotid territory").contains(.abcd2))
        XCTAssertFalse(recs(dx: "Acute ischaemic stroke").contains(.abcd2))
    }

    func testDementiaIsNotReadAsTIA() {
        let r = recs(dx: "Caecal adenocarcinoma; frail with dementia")
        XCTAssertFalse(r.contains(.nihss), "\(r)")
        XCTAssertFalse(r.contains(.mrs), "\(r)")
        XCTAssertTrue(DiagnosisScoreMapper.mentionsTIA("suspected tia"))
        XCTAssertFalse(DiagnosisScoreMapper.mentionsTIA("initial review; dementia"))
        XCTAssertNil(DiagnosisScoreMapper.suggestedCategory(for: "Initial review"))
        XCTAssertEqual(DiagnosisScoreMapper.suggestedCategory(for: "Possible TIA yesterday"), .neuro)
    }

    func testABCD2CalculatorStillCarriesTheNG128Note() {
        let s = ClinicalScoringEngine.abcd2(ABCD2Input())
        XCTAssertTrue(s.evidenceNote?.contains("NG128") ?? false)
    }
}
