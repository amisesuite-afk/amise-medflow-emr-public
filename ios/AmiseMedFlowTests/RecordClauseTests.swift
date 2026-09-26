// RecordClauseTests.swift
// RecordClauses (twin of lib/triage-engine/src/record-clauses.ts) over the shared vectors
// AmiseMedFlowTests/Resources/RecordClauseVectors.json (also run by
// artifacts/dashboard/src/lib/__tests__/record-clauses.test.ts), plus the places iOS uses it: the
// Bayesian engine's database terms and the text parser's relieving factors.

import XCTest
@testable import AmiseMedFlow

private final class RecordClauseVectorsToken {}

private struct RCVector: Decodable {
    let text: String
    let term: String
    let occurrence: Int
    let negated: Bool
    let listNegated: Bool
    let family: Bool
    let attributed: Bool
    let query: Bool
    let notAboutPatient: Bool
    let reliefFailed: Bool
    let notCurrent: Bool
}

private struct RCVectors: Decodable {
    let vectors: [RCVector]
}

final class RecordClauseTests: XCTestCase {

    private static func loadVectors() throws -> [RCVector] {
        let bundle = Bundle(for: RecordClauseVectorsToken.self)
        let url = bundle.url(forResource: "RecordClauseVectors", withExtension: "json")
            ?? URL(fileURLWithPath: #filePath).deletingLastPathComponent()
                .appendingPathComponent("Resources").appendingPathComponent("RecordClauseVectors.json")
        return try JSONDecoder().decode(RCVectors.self, from: Data(contentsOf: url)).vectors
    }

    func testSharedVectors() throws {
        let vectors = try Self.loadVectors()
        XCTAssertGreaterThan(vectors.count, 30)
        for v in vectors {
            let source = NegationMatcher.Source(v.text)
            let all = source.occurrences(of: v.term)
            guard v.occurrence < all.count else { return XCTFail("\(v.term) #\(v.occurrence) not in \(v.text)") }
            let m = all[v.occurrence]
            let start = m.index
            let end = m.index + m.text.unicodeScalars.count
            let lower = source.lower
            let label = "\(v.text) [\(v.term)]"
            XCTAssertEqual(source.isNegated(start: start, end: end), v.negated, "\(label): negated")
            XCTAssertEqual(RecordClauses.listNegatedAt(lower, start), v.listNegated, "\(label): list")
            XCTAssertEqual(RecordClauses.familyHistoryAt(lower, start, end), v.family, "\(label): family")
            XCTAssertEqual(RecordClauses.attributedAt(lower, start), v.attributed, "\(label): attributed")
            XCTAssertEqual(RecordClauses.queryAt(lower, start), v.query, "\(label): query")
            XCTAssertEqual(RecordClauses.notAboutPatientAt(lower, start, end), v.notAboutPatient, "\(label): not about the patient")
            XCTAssertEqual(RecordClauses.reliefFailedAt(lower, start, end), v.reliefFailed, "\(label): relief failed")
            // notCurrent is the web PANE mapper's rule only (not ported: iOS database terms mix
            // current findings and history evidence).
        }
    }

    func testDatabaseTermsFollowTheClauses() {
        func affirmed(_ term: String, _ text: String) -> Bool {
            BayesianDiagnosisEngine.termAffirmed(term, in: NegationMatcher.Source(text))
        }
        XCTAssertFalse(affirmed("fever", "Has never had abdominal pain, indigestion after food, jaundice or fever."))
        XCTAssertFalse(affirmed("leucocyte", "Urine dipstick: negative for blood, leucocytes and nitrites."))
        XCTAssertFalse(affirmed("breast cancer", "Mother had breast cancer at 45."))
        XCTAssertFalse(affirmed("appendicitis", "Referred by the GP as ?appendicitis."))
        XCTAssertFalse(affirmed("hernia", "Mother thought it was a hernia."))
        XCTAssertTrue(affirmed("appendicitis", "CT: acute appendicitis with an appendicolith."))
        XCTAssertTrue(affirmed("fever", "No fever, jaundice or rigors. Fever now 38.5."))
        XCTAssertTrue(affirmed("jaundice", "No fever but has jaundice."))
        XCTAssertTrue(affirmed("chest pain", "Father died of a heart attack; she has chest pain on exertion."))
        // History evidence stays: iOS does not apply the web's "not current" rule.
        XCTAssertTrue(affirmed("aneurysm", "Open repair of an abdominal aortic aneurysm 6 years ago."))
    }

    func testTextParserReliefNeedsAClauseWhereItWorked() {
        func relieving(_ hpi: String) -> Set<String> {
            ClinicalTextParser.parse(hpi: hpi, examGeneral: nil, examAbdo: nil, examOther: nil, notes: nil)
                .featureAugments["relieving"] ?? []
        }
        func character(_ hpi: String) -> Set<String> {
            ClinicalTextParser.parse(hpi: hpi, examGeneral: nil, examAbdo: nil, examOther: nil, notes: nil)
                .featureAugments["character"] ?? []
        }
        let troponinCase = "Two hours of epigastric discomfort with nausea and sweating, started at rest. Took antacids with no relief."
        XCTAssertFalse(relieving(troponinCase).contains("Antacids"), "antacids with no relief")
        XCTAssertFalse(relieving(troponinCase).contains("Rest"), "started at rest is not relief by rest")
        XCTAssertTrue(relieving(troponinCase).contains("Nothing"))
        XCTAssertFalse(character(troponinCase).contains("Burning"), "antacids is not acid")
        XCTAssertTrue(relieving("Pain eases with antacids.").contains("Antacids"))
        XCTAssertTrue(relieving("Pain eases with rest.").contains("Rest"))
        XCTAssertFalse(relieving("Rest pain in the left foot at night.").contains("Rest"))
        XCTAssertFalse(relieving("Gaviscon did not help.").contains("Antacids"))
        XCTAssertTrue(character("Burning pain with acid reflux.").contains("Burning"))
    }
}
