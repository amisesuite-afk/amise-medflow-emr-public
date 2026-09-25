// ClinValGraderTests.swift
// Pins the grading rules shared with the web harness. The same vectors are asserted in
// scripts/src/clinval/clinval.test.ts ("grading rules (mirrored in Swift)"); change both together.

import XCTest
@testable import AmiseMedFlow

final class ClinValGraderTests: XCTestCase {

    func testNormalisesCaseQuotesDashesAndWhitespace() {
        XCTAssertEqual(ClinValGrader.normalise("  Murphy’s   Sign – POSITIVE "), "murphy's sign - positive")
    }

    func testMatchesSubstringsRegexesAndICDPrefixes() {
        XCTAssertTrue(ClinValGrader.matchesAny("Laparoscopic Appendicectomy (preferred)", ["re:laparoscopic append(ic)?ectomy"]))
        XCTAssertTrue(ClinValGrader.matchesAny("CT Abdomen / Pelvis (with contrast)", ["re:\\bct\\b[^.;\\n]{0,40}(abdo|pelvi)"]))
        XCTAssertTrue(ClinValGrader.matchesAny("Acute Cholecystitis", ["icd:K81"], icd: "K81.0"))
        XCTAssertFalse(ClinValGrader.matchesAny("Acute Cholecystitis", ["icd:K80"], icd: "K81.0"))
        XCTAssertTrue(ClinValGrader.matchesAny("Early cholecystectomy (Grade I–II Tokyo)", ["grade i-ii"]))
    }

    func testAppliesUnlessAlternatives() {
        XCTAssertFalse(ClinValGrader.counts("Percutaneous cholecystostomy if high surgical risk",
                                            match: ["cholecystostomy"], unless: ["high surgical risk"]))
        XCTAssertTrue(ClinValGrader.counts("Percutaneous cholecystostomy",
                                           match: ["cholecystostomy"], unless: ["high surgical risk"]))
    }
}
