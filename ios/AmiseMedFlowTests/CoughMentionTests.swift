// CoughMentionTests.swift
// CoughMention (twin of lib/triage-engine/src/cough-mention.ts) and ClinicalTextParser, over the
// shared vectors AmiseMedFlowTests/Resources/CoughMentionVectors.json (also run by
// artifacts/dashboard/src/lib/__tests__/cough-mention.test.ts). ClinicalTextParser used to turn a
// typed "cough" into the aggravating factor "Coughing" (history-by-complaint finding 4).

import XCTest
@testable import AmiseMedFlow

private final class CoughMentionVectorsToken {}

private struct CMVector: Decodable {
    let text: String
    let kinds: [String]
    let cough: Bool
    let factor: Bool
}

private struct CMVectors: Decodable {
    let vectors: [CMVector]
}

final class CoughMentionTests: XCTestCase {

    private static func loadVectors() throws -> [CMVector] {
        let bundle = Bundle(for: CoughMentionVectorsToken.self)
        let url = bundle.url(forResource: "CoughMentionVectors", withExtension: "json")
            ?? URL(fileURLWithPath: #filePath).deletingLastPathComponent()
                .appendingPathComponent("Resources").appendingPathComponent("CoughMentionVectors.json")
        return try JSONDecoder().decode(CMVectors.self, from: Data(contentsOf: url)).vectors
    }

    func testSharedVectors() throws {
        let vectors = try Self.loadVectors()
        XCTAssertGreaterThan(vectors.count, 25)
        for v in vectors {
            XCTAssertEqual(CoughMention.mentions(in: v.text).map(\.kind.rawValue), v.kinds, v.text)
            XCTAssertEqual(CoughMention.recordsCough(v.text), v.cough, "\(v.text): cough")
            XCTAssertEqual(CoughMention.recordsCoughAsFactor(v.text), v.factor, "\(v.text): factor")
        }
    }

    func testParserFollowsTheVectors() throws {
        for v in try Self.loadVectors() {
            let r = ClinicalTextParser.parse(hpi: v.text, examGeneral: nil, examAbdo: nil, examOther: nil, notes: nil)
            XCTAssertEqual(r.featureAugments["associations"]?.contains("Cough") ?? false, v.cough, "\(v.text): Cough")
            XCTAssertEqual(r.featureAugments["exacerbating"]?.contains("Coughing") ?? false, v.factor, "\(v.text): Coughing")
        }
    }

    func testTypedCoughIsTheSymptomNotTheAggravatingFactor() {
        let r = ClinicalTextParser.parse(hpi: "Cough for three weeks, now productive.", examGeneral: nil,
                                         examAbdo: nil, examOther: nil, notes: nil)
        XCTAssertEqual(r.featureAugments["associations"], ["Cough"])
        XCTAssertNil(r.featureAugments["exacerbating"])
    }

    func testOffsetsMatchNegationMatcher() {
        let text = "No fever. Pain worse on coughing"
        let m = CoughMention.mentions(in: text)
        XCTAssertEqual(m.count, 1)
        let occ = NegationMatcher.Source(text).occurrences(of: "coughing")
        XCTAssertEqual(occ.first?.index, m.first?.index)
    }
}
