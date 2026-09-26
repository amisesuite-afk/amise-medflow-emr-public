// FeatureTermMatchingTests.swift
// DiagnosticDatabase.json terms in record text (BayesianDiagnosisEngine+FeatureTerms.swift): a term
// of four letters or fewer is a whole word ("sti" is not in "still"), stems keep word-start
// matching ("dizz" → dizziness). history-by-complaint finding 1.

import XCTest
@testable import AmiseMedFlow

final class FeatureTermMatchingTests: XCTestCase {

    private func affirmed(_ term: String, _ text: String) -> Bool {
        BayesianDiagnosisEngine.termAffirmed(term, in: NegationMatcher.Source(text))
    }

    func testShortTermsDoNotMatchInsideWords() {
        XCTAssertFalse(affirmed("sti", "Still in pain, some neck stiffness"))
        XCTAssertFalse(affirmed("stab", "Stable swelling"))
        XCTAssertFalse(affirmed("stab", "Stabbing pain"))
        XCTAssertFalse(affirmed("burn", "Burning epigastric pain"))
        XCTAssertFalse(affirmed("lip", "Lipase 1200"))
        XCTAssertFalse(affirmed("gas", "Gastric outlet"))
        XCTAssertFalse(affirmed("rat", "Heart rate 110"))
        XCTAssertFalse(affirmed("foot", "Injured playing football"))
        XCTAssertFalse(affirmed("anal", "Needs analgesia"))
    }

    func testShortTermsStillMatchTheWordAndItsPlural() {
        XCTAssertTrue(affirmed("sti", "Treated for an STI last year"))
        XCTAssertTrue(affirmed("sti", "Two STIs"))
        XCTAssertTrue(affirmed("stab", "Stab wound to the chest"))
        XCTAssertTrue(affirmed("burn", "Burns to both legs"))
        XCTAssertTrue(affirmed("lip", "Swollen lips"))
        XCTAssertTrue(affirmed("leg", "Both legs swollen"))
        XCTAssertTrue(affirmed("ruq", "RUQ tenderness"))
        XCTAssertFalse(affirmed("ruq", "No RUQ tenderness"))
    }

    func testStemsKeepWordStartMatching() {
        XCTAssertTrue(affirmed("dizz", "Dizziness on standing"))
        XCTAssertTrue(affirmed("smok", "Smoker, 20 pack-years"))
        XCTAssertTrue(affirmed("numb", "Numbness of the left hand"))
        XCTAssertTrue(affirmed("pain", "Painful swelling"))
    }

    func testLongerTermsAreUnchanged() {
        XCTAssertTrue(affirmed("append", "Appendicitis last year"))
        XCTAssertTrue(affirmed("haemoptysis", "Haemoptysis x2"))
    }

    func testFindingSpecUsesTheRule() {
        let text = BayesianDiagnosisEngine.FeatureText(["Still stiff after the fall"])
        XCTAssertFalse(BayesianDiagnosisEngine.anyAlternative("dysuria|urethral discharge|sti", in: text))
        XCTAssertTrue(BayesianDiagnosisEngine.anyAlternative("trauma|fall|assault", in: text))
    }
}
