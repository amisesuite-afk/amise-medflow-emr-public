import XCTest
@testable import AmiseMedFlow

/// A11yLabel (Services/AccessibilityLabels.swift): the spoken VoiceOver text for NEWS2, acuity and
/// patient rows. A badge must read its meaning ("NEWS2 7, high risk"), never a bare number.
final class AccessibilityLabelTests: XCTestCase {

    // MARK: NEWS2

    func testNews2ReadsScoreAndRiskBand() {
        XCTAssertEqual(A11yLabel.news2(score: 7, risk: "High"), "NEWS2 7, high risk")
        XCTAssertEqual(A11yLabel.news2(score: 0, risk: "Low"), "NEWS2 0, low risk")
        XCTAssertEqual(A11yLabel.news2(score: 3, risk: "Low-medium"), "NEWS2 3, low-medium risk")
    }

    func testNews2UsesTheChartBandLabels() {
        for band in NEWS2Band.allCases {
            let spoken = A11yLabel.news2(score: 5, risk: band.label)
            XCTAssertTrue(spoken.hasSuffix("\(band.label.lowercased()) risk"), spoken)
        }
    }

    func testNews2IncompleteSaysObservationsMissing() {
        XCTAssertEqual(A11yLabel.news2(score: 2, risk: "Low", incomplete: true),
                       "NEWS2 2, low risk, incomplete: some observations not recorded")
    }

    func testNews2Trend() {
        XCTAssertNil(A11yLabel.news2Trend(nil))
        XCTAssertEqual(A11yLabel.news2Trend(2), "rising by 2")
        XCTAssertEqual(A11yLabel.news2Trend(-1), "falling by 1")
        XCTAssertEqual(A11yLabel.news2Trend(0), "unchanged")
        XCTAssertEqual(A11yLabel.news2(score: 7, risk: "High", trendDelta: 3),
                       "NEWS2 7, high risk, rising by 3")
        XCTAssertEqual(A11yLabel.news2(score: 7, risk: "High", incomplete: true, trendDelta: -2),
                       "NEWS2 7, high risk, incomplete: some observations not recorded, falling by 2")
    }

    /// The trend words must agree with the arrow shown on screen.
    func testNews2TrendMatchesArrow() {
        for delta in [-3, -1, 0, 1, 4] {
            let arrow = ListPerf.news2TrendArrow(delta)
            let words = A11yLabel.news2Trend(delta) ?? ""
            switch arrow {
            case "↑": XCTAssertTrue(words.hasPrefix("rising"))
            case "↓": XCTAssertTrue(words.hasPrefix("falling"))
            default:  XCTAssertEqual(words, "unchanged")
            }
        }
    }

    // MARK: Acuity

    func testAcuityReadsLevel() {
        XCTAssertEqual(A11yLabel.acuity(Acuity.urgent.label), "Urgent acuity")
        for acuity in Acuity.allCases {
            XCTAssertEqual(A11yLabel.acuity(acuity.label), "\(acuity.label) acuity")
        }
    }

    // MARK: Demographics

    func testSexAndAge() {
        XCTAssertEqual(A11yLabel.sexAndAge(sex: "Female", ageYears: 54), "Female, 54 years")
        XCTAssertEqual(A11yLabel.sexAndAge(sex: "Male", ageYears: nil), "Male")
        XCTAssertEqual(A11yLabel.sexAndAge(sex: "Unspecified", ageYears: 1), "1 year")
        XCTAssertEqual(A11yLabel.sexAndAge(sex: Sex.unspecified.rawValue, ageYears: 0), "0 years")
        XCTAssertNil(A11yLabel.sexAndAge(sex: "Unspecified", ageYears: nil))
        XCTAssertNil(A11yLabel.sexAndAge(sex: nil, ageYears: nil))
    }

    // MARK: Composition

    func testJoinedSkipsEmptyParts() {
        XCTAssertEqual(A11yLabel.joined(["Jane Doe", nil, "", "  ", "Tapion", "NEWS2 7, high risk"]),
                       "Jane Doe, Tapion, NEWS2 7, high risk")
        XCTAssertEqual(A11yLabel.joined([]), "")
    }

    func testSmallFormatters() {
        XCTAssertEqual(A11yLabel.postOpDay(3), "Post-op day 3")
        XCTAssertEqual(A11yLabel.count(1, singular: "point", plural: "points"), "1 point")
        XCTAssertEqual(A11yLabel.count(0, singular: "point", plural: "points"), "0 points")
        XCTAssertEqual(A11yLabel.count(4, singular: "point", plural: "points"), "4 points")
    }
}
