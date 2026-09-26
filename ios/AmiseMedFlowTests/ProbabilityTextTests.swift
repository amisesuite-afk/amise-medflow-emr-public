import XCTest
@testable import AmiseMedFlow

/// Same cases as artifacts/dashboard/src/lib/__tests__/probability-text.test.ts.
final class ProbabilityTextTests: XCTestCase {
    func testFractions() {
        XCTAssertEqual(ProbabilityText.fraction(1), ">99%")
        XCTAssertEqual(ProbabilityText.fraction(0.996), ">99%")
        XCTAssertEqual(ProbabilityText.fraction(0.994), "99%")
        XCTAssertEqual(ProbabilityText.fraction(0.42), "42%")
        XCTAssertEqual(ProbabilityText.fraction(0.005), "1%")
        XCTAssertEqual(ProbabilityText.fraction(0.004), "<1%")
        XCTAssertEqual(ProbabilityText.fraction(0), "<1%")
        XCTAssertEqual(ProbabilityText.fraction(nil), "—")
        XCTAssertEqual(ProbabilityText.fraction(.nan), "—")
    }

    func testWholePercents() {
        XCTAssertEqual(ProbabilityText.percent(100), ">99%")
        XCTAssertEqual(ProbabilityText.percent(99), "99%")
        XCTAssertEqual(ProbabilityText.percent(37), "37%")
        XCTAssertEqual(ProbabilityText.percent(1), "1%")
        XCTAssertEqual(ProbabilityText.percent(0), "<1%")
    }

    func testTheHighestConfidenceIsNotCalledCertain() {
        XCTAssertEqual(BayesianDiagnosisEngine.DiagnosisResult.Confidence.certain.label, "Very high")
    }
}
