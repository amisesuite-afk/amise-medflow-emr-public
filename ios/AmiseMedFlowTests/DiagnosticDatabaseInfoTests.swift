import XCTest
@testable import AmiseMedFlow

/// The version stamp reader behind Settings → Diagnostics (DiagnosticDatabaseInfo.swift).
/// It must read only the metadata keys and describe a decoding failure without any value.
final class DiagnosticDatabaseInfoTests: XCTestCase {

    func testStampReadsMetadataAndIgnoresOtherKeys() throws {
        let json = """
        {
          "version": "1.0.0",
          "updated": "2026-09-21",
          "sources": ["Per-feature citations"],
          "lastUpdated": "2026-09-20",
          "note": "ignored",
          "pools": { "a": { "candidates": [] }, "b": { "candidates": [{ "logLR": 1.8 }] } },
          "matrix": { "anything": true }
        }
        """
        let stamp = try JSONDecoder().decode(DiagnosticDatabaseInfo.Stamp.self, from: Data(json.utf8))
        XCTAssertEqual(stamp.version, "1.0.0")
        XCTAssertEqual(stamp.updated, "2026-09-21")
        XCTAssertEqual(stamp.lastUpdated, "2026-09-20")
        XCTAssertEqual(stamp.sources ?? [], ["Per-feature citations"])
        XCTAssertEqual(stamp.pools?.count, 2)
    }

    func testStampToleratesMissingMetadata() throws {
        let stamp = try JSONDecoder().decode(DiagnosticDatabaseInfo.Stamp.self, from: Data("{}".utf8))
        XCTAssertNil(stamp.version)
        XCTAssertNil(stamp.pools)
    }

    func testDescribeGivesKeyPathWithoutValues() {
        // The real failure in the bundled file is a missing key (CI "DBLOAD|" report:
        // "Missing key 'evidenceLabel' at pools.abdominalPain.candidates[6].features[10]").
        // A number-type mismatch is reported without a coding path by newer Foundation, so it
        // is not used here.
        struct Feature: Decodable { let evidenceLabel: String; let logLR: Int }
        struct Root: Decodable { let pools: [String: [Feature]] }
        let json = #"{ "pools": { "earComplaint": [{ "evidenceLabel": "Otalgia", "logLR": 4 }, { "logLR": 7 }] } }"#
        do {
            _ = try JSONDecoder().decode(Root.self, from: Data(json.utf8))
            XCTFail("a feature without evidenceLabel must not decode")
        } catch {
            let text = DiagnosticDatabaseInfo.describe(error)
            XCTAssertTrue(text.contains("pools.earComplaint[1]"), text)
            XCTAssertTrue(text.contains("evidenceLabel"), text)
            XCTAssertFalse(text.contains("Otalgia"), text)
        }
    }

    func testBundledDatabaseHasAVersionStamp() {
        let status = DiagnosticDatabaseInfo.load()
        XCTAssertTrue(status.fileFound)
        XCTAssertTrue(status.stampReadable)
        XCTAssertFalse(status.version.isEmpty)
        XCTAssertNotEqual(status.version, "—")
        XCTAssertGreaterThan(status.poolCount, 0)
    }
}
