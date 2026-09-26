// ApprovedContentTests.swift
// Approved-content channel (docs/APPROVED-CONTENT-CHANNEL.md): the Swift twin
// (Services/ApprovedContent.swift) against the shared vectors (Resources/ApprovedContentVectors.json,
// also run by scripts/src/approved-content.test.ts on the web) — canonical JSON + SHA-256, the JSON
// Schema subset checker and the release selection — plus the on-device store and loader
// (ApprovedContentStore.swift, SharedClinicalContent.swift) with the real bundled files.

import XCTest
@testable import AmiseMedFlow

private final class ApprovedContentVectorsToken {}

private struct ApprovedContentVectors: Decodable {
    struct CanonicalCase: Decodable {
        let name: String
        let json: String
        let canonical: String?
        let sha256: String?
        let error: Bool?
    }

    struct SchemaCase: Decodable {
        let name: String
        let schema: ApprovedContent.Value
        let data: ApprovedContent.Value
        let valid: Bool
    }

    struct ExpectedRejected: Decodable, Equatable {
        let version: String
        let reason: String
    }

    struct Expected: Decodable {
        let source: String
        let version: String
        let rejected: [ExpectedRejected]
    }

    struct SelectionCase: Decodable {
        let name: String
        let bundled: ApprovedContent.Value?
        let releases: [ApprovedContent.Release]
        let expected: Expected
    }

    struct Selection: Decodable {
        let contentId: String
        let mayChange: [String]
        let schema: ApprovedContent.Value
        let bundled: ApprovedContent.Value
        let cases: [SelectionCase]
    }

    let canonical: [CanonicalCase]
    let schema: [SchemaCase]
    let selection: Selection
}

final class ApprovedContentTests: XCTestCase {

    private static func loadVectors() throws -> ApprovedContentVectors {
        let bundle = Bundle(for: ApprovedContentVectorsToken.self)
        let url = bundle.url(forResource: "ApprovedContentVectors", withExtension: "json")
            ?? URL(fileURLWithPath: #filePath).deletingLastPathComponent()
                .appendingPathComponent("Resources").appendingPathComponent("ApprovedContentVectors.json")
        return try JSONDecoder().decode(ApprovedContentVectors.self, from: Data(contentsOf: url))
    }

    // MARK: - Shared vectors (same results as the web)

    func testCanonicalJSONVectors() throws {
        let v = try Self.loadVectors()
        XCTAssertGreaterThan(v.canonical.count, 6)
        for c in v.canonical {
            let value = try JSONDecoder().decode(ApprovedContent.Value.self, from: Data(c.json.utf8))
            if c.error == true {
                XCTAssertThrowsError(try ApprovedContent.canonicalJSON(value), c.name)
                continue
            }
            let text = try ApprovedContent.canonicalJSON(value)
            XCTAssertEqual(text, c.canonical, c.name)
            XCTAssertEqual(ApprovedContent.sha256Hex(text), c.sha256, c.name)
            // The canonical text is JSON and a fixed point.
            let again = try JSONDecoder().decode(ApprovedContent.Value.self, from: Data(text.utf8))
            XCTAssertEqual(try ApprovedContent.canonicalJSON(again), text, c.name)
        }
    }

    func testSchemaCheckVectors() throws {
        let v = try Self.loadVectors()
        XCTAssertGreaterThan(v.schema.count, 20)
        for c in v.schema {
            let problems = ApprovedContent.schemaProblems(schema: c.schema, data: c.data)
            XCTAssertEqual(problems.isEmpty, c.valid, "\(c.name): \(problems)")
        }
    }

    func testSelectionVectors() throws {
        let v = try Self.loadVectors()
        let s = v.selection
        XCTAssertGreaterThan(s.cases.count, 15)
        for c in s.cases {
            let result = ApprovedContent.select(contentId: s.contentId, bundled: c.bundled ?? s.bundled,
                                                schema: s.schema, mayChange: s.mayChange, releases: c.releases)
            XCTAssertEqual(result.source.rawValue, c.expected.source, c.name)
            XCTAssertEqual(result.version, c.expected.version, c.name)
            XCTAssertEqual(result.rejected.map { ApprovedContentVectors.ExpectedRejected(version: $0.version, reason: $0.reason.rawValue) },
                           c.expected.rejected, c.name)
        }
    }

    func testSemver() {
        XCTAssertEqual(ApprovedContent.parseSemver("1.10.0"), [1, 10, 0])
        for bad in ["1.0", "1.0.0-rc.1", "v1.0.0", "01.0.0", "1.0.0 ", "", "1.٣.0"] {
            XCTAssertNil(ApprovedContent.parseSemver(bad), bad)
        }
        XCTAssertGreaterThan(ApprovedContent.compareSemver([1, 10, 0], [1, 9, 9]), 0)
    }

    func testPlainDecimal() {
        XCTAssertEqual(ApprovedContent.plainDecimal("1e-07"), "0.0000001")
        XCTAssertEqual(ApprovedContent.plainDecimal("-1.5e-7"), "-0.00000015")
        XCTAssertEqual(ApprovedContent.plainDecimal("123.45"), "123.45")
        XCTAssertEqual(ApprovedContent.plainDecimal("1.5e+21"), "1500000000000000000000")
    }

    // MARK: - Real bundled files

    func testEveryBundledRuleFileValidatesAgainstItsBundledSchema() throws {
        for file in SharedClinicalContent.File.allCases {
            let url = try XCTUnwrap(SharedClinicalContent.url(for: file), "\(file.rawValue).json")
            let data = try Data(contentsOf: url)
            let value = try XCTUnwrap(ApprovedContent.parse(data), file.rawValue)
            let schema = try XCTUnwrap(ApprovedContentStore.bundledSchema(file.rawValue),
                                       "\(file.rawValue).schema.json is not in the bundle's schemas folder")
            XCTAssertEqual(ApprovedContent.schemaProblems(schema: schema, data: value), [], file.rawValue)
            XCTAssertNotNil(ApprovedContent.contentSha256(value), file.rawValue)
        }
    }

    /// Every policy key is the `id` of a bundled shared file, and only those files report the channel.
    func testTheChannelIsEnabledOnlyForSharedFiles() throws {
        var ids: [String: SharedClinicalContent.File] = [:]
        for file in SharedClinicalContent.File.allCases {
            let url = try XCTUnwrap(SharedClinicalContent.url(for: file))
            let id = try XCTUnwrap(ApprovedContent.parse(Data(contentsOf: url))?.objectValue?["id"]?.stringValue)
            ids[id] = file
            XCTAssertEqual(ApprovedContentStore.isEnabled(file), ApprovedContent.policy[id] != nil, file.rawValue)
        }
        for id in ApprovedContent.policy.keys {
            XCTAssertNotNil(ids[id], "\(id) is not the id of a bundled shared rule file")
        }
        XCTAssertEqual(ids["diagnostic-reasoning-zebras"], .zebraRules)
    }

    /// Store a verified patch release of the bundled zebra rules, check the loader uses it and
    /// Settings shows it, then check a revocation (apply with the revoked row) removes it.
    func testStoredReleaseIsUsedAndRevocationFallsBackToBundled() throws {
        let name = "diagnostic-reasoning-zebras"   // content id = the file's `id` (zebra-rules.json)
        let previous = ApprovedContentStore.storedRelease(name)
        defer { ApprovedContentStore.store(previous, for: name) }

        let url = try XCTUnwrap(SharedClinicalContent.url(for: .zebraRules))
        let data = try Data(contentsOf: url)
        guard case .object(var body)? = ApprovedContent.parse(data),
              let bundledVersion = body["version"]?.stringValue,
              let semver = ApprovedContent.parseSemver(bundledVersion) else {
            return XCTFail("bundled zebra-rules.json has no version")
        }
        let version = "\(semver[0]).\(semver[1]).\(semver[2] + 1)"
        body["version"] = .string(version)
        let value = ApprovedContent.Value.object(body)
        let sha = try XCTUnwrap(ApprovedContent.contentSha256(value))
        let release = ApprovedContent.Release(id: nil, content_id: name, version: version, sha256: sha, body: value,
                                              published_at: nil, signoff_ref: "test", revoked_at: nil)

        XCTAssertEqual(ApprovedContentStore.apply(fetched: [release]), previous?.sha256 == sha ? [] : [name])
        let status = SharedClinicalContent.status(of: .zebraRules)
        XCTAssertTrue(status.loaded)
        XCTAssertEqual(status.source, .release(version: version, sha256: sha))
        XCTAssertEqual(status.version, version)
        XCTAssertTrue(status.sourceText.hasPrefix("Approved release \(version)"), status.sourceText)
        XCTAssertNotNil(SharedClinicalContent.load(ZebraCheck.RuleFile.self, .zebraRules))

        // A tampered stored copy is ignored at load.
        let tampered = ApprovedContent.Release(id: nil, content_id: name, version: version, sha256: String(repeating: "0", count: 64),
                                               body: value, published_at: nil, signoff_ref: "test", revoked_at: nil)
        ApprovedContentStore.store(tampered, for: name)
        XCTAssertEqual(SharedClinicalContent.status(of: .zebraRules).source, .bundled)

        // Revoked: the next fetch removes it.
        ApprovedContentStore.store(release, for: name)
        let revoked = ApprovedContent.Release(id: nil, content_id: name, version: version, sha256: sha, body: value,
                                              published_at: nil, signoff_ref: "test", revoked_at: "2026-09-26T12:00:00Z")
        ApprovedContentStore.apply(fetched: [revoked])
        XCTAssertNil(ApprovedContentStore.storedRelease(name))
        let after = SharedClinicalContent.status(of: .zebraRules)
        XCTAssertEqual(after.source, .bundled)
        XCTAssertEqual(after.version, bundledVersion)
        XCTAssertEqual(after.sourceText, "Bundled \(bundledVersion)")
    }

    func testReleaseChangingThePatientParagraphIsRefused() throws {
        let url = try XCTUnwrap(SharedClinicalContent.url(for: .supplementCatalogue))
        let data = try Data(contentsOf: url)
        guard case .object(var body)? = ApprovedContent.parse(data),
              case .object(var text)? = body["text"] else { return XCTFail("supplement-catalogue.json not readable") }
        text["herbalPreOpPatientText"] = .string("Changed.")
        body["text"] = .object(text)
        body["version"] = .string("99.0.0")
        let value = ApprovedContent.Value.object(body)
        let release = ApprovedContent.Release(id: nil, content_id: "supplement-catalogue", version: "99.0.0",
                                              sha256: try XCTUnwrap(ApprovedContent.contentSha256(value)), body: value,
                                              published_at: nil, signoff_ref: "test", revoked_at: nil)
        let chosen = try XCTUnwrap(ApprovedContentStore.selection(for: .supplementCatalogue, bundledData: data, releases: [release]))
        XCTAssertEqual(chosen.source, .bundled)
        XCTAssertEqual(chosen.rejected.first?.reason, .pinnedFieldChanged)
        XCTAssertEqual(chosen.rejected.first?.detail, "/text")
    }
}
