// ClinicalValidationTests.swift
// Clinical validation harness (phase 0): runs every guideline-referenced vignette in
// ClinicalValidation/Vignettes/ through the iOS consultation engines, grades the outputs and
// prints one machine-readable line per vignette:
//
//   CLINVAL|{json}           one ClinValResult per vignette (see ClinValModels.swift)
//   CLINVAL-SUMMARY|{json}   totals
//
// CI (ios-build-check.yml, unit-tests job) extracts the CLINVAL| lines into clinval-ios.jsonl and
// uploads it; scripts/src/clinval/report.ts merges it with the web results into
// docs/clinical-validation/REPORT.md.
//
// Test policy: an expectation with severity "critical" that fails fails this test, unless the
// vignette marks it `knownGap` or `unverified` for iOS. Quality failures are reported only.

import XCTest
import SwiftData
@testable import AmiseMedFlow

private final class ClinValBundleToken {}

enum ClinValLoader {

    /// The vignette files bundled with the test target (project.yml copies the Vignettes folder as a
    /// folder reference). Falls back to flattened bundle resources, then to the source folder next
    /// to this file when the tests run without the resource copy.
    static func vignetteURLs() -> [URL] {
        let fm = FileManager.default
        let bundle = Bundle(for: ClinValBundleToken.self)
        if let dir = bundle.url(forResource: "Vignettes", withExtension: nil),
           let files = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) {
            let json = files.filter { $0.pathExtension == "json" }
            if !json.isEmpty { return json.sorted { $0.lastPathComponent < $1.lastPathComponent } }
        }
        let flat = (bundle.urls(forResourcesWithExtension: "json", subdirectory: nil) ?? []).filter { url in
            guard let data = try? Data(contentsOf: url), let text = String(data: data, encoding: .utf8) else { return false }
            return text.contains("\"permutationOf\"") && text.contains("\"expected\"")
        }
        if !flat.isEmpty { return flat.sorted { $0.lastPathComponent < $1.lastPathComponent } }
        let source = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Vignettes")
        let files = (try? fm.contentsOfDirectory(at: source, includingPropertiesForKeys: nil)) ?? []
        return files.filter { $0.pathExtension == "json" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    static func load() throws -> [(url: URL, vignette: ClinValVignette)] {
        try vignetteURLs().map { url in
            (url: url, vignette: try JSONDecoder().decode(ClinValVignette.self, from: Data(contentsOf: url)))
        }
    }
}

@MainActor
final class ClinicalValidationTests: XCTestCase {

    private var container: ModelContainer!

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
    }

    /// Every vignette decodes, its id matches its file name and its expectation ids are unique.
    /// (The full structural check is scripts/src/clinval/load.ts, run by the web harness.)
    func testVignettesDecode() throws {
        let loaded = try ClinValLoader.load()
        XCTAssertFalse(loaded.isEmpty, "No vignettes found: check the Vignettes folder reference in project.yml")
        let ids = Set(loaded.map(\.vignette.id))
        for (url, v) in loaded {
            XCTAssertEqual(v.schemaVersion, 1, "\(v.id): schemaVersion")
            XCTAssertEqual(url.deletingPathExtension().lastPathComponent, v.id, "\(v.id): id must equal the file name")
            let expIds = v.expected.all.map { $0.1.id }
            XCTAssertEqual(Set(expIds).count, expIds.count, "\(v.id): duplicate expectation id")
            if let base = v.permutationOf { XCTAssertTrue(ids.contains(base), "\(v.id): unknown permutationOf \(base)") }
            for (_, e) in v.expected.all {
                XCTAssertTrue(e.severity == "critical" || e.severity == "quality", "\(v.id)/\(e.id): severity")
                for alt in (e.match ?? []) + (e.unless ?? []) where alt.hasPrefix("re:") {
                    XCTAssertNoThrow(try NSRegularExpression(pattern: String(alt.dropFirst(3)), options: [.caseInsensitive]),
                                     "\(v.id)/\(e.id): regex \(alt) does not compile on iOS")
                }
            }
        }
    }

    func testClinicalValidationVignettes() async throws {
        let loaded = try ClinValLoader.load()
        XCTAssertFalse(loaded.isEmpty, "No vignettes found: check the Vignettes folder reference in project.yml")

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        let stamp = ISO8601DateFormatter().string(from: Date())
        var total = ClinValSummary()
        var lines: [String] = []

        for (_, v) in loaded {
            let outputs = await ClinValIOSRunner.run(v, context: container.mainContext)
            let results = ClinValGrader.grade(v, outputs)
            let summary = ClinValSummary.of(results)
            total.add(summary)
            let record = ClinValResult(vignetteId: v.id, condition: v.condition, category: v.category,
                                       permutationOf: v.permutationOf, permutationLabel: v.permutationLabel,
                                       generatedAt: stamp, outputs: outputs, expectations: results,
                                       summary: summary)
            let json = String(decoding: try encoder.encode(record), as: UTF8.self)
            print("CLINVAL|" + json)
            lines.append(json)
            for r in results where r.blocking {
                XCTFail("[\(v.id)] \(r.id) — critical expectation failed: \(r.detail)")
            }
        }

        print("CLINVAL-SUMMARY|" + String(decoding: try encoder.encode(total), as: UTF8.self))
        writeDirectCopy(lines)
    }

    /// Also write the lines next to the iOS project (ios/clinval-ios-direct.jsonl, git-ignored), for
    /// local runs and as a CI fallback if the log lines are not captured. Best effort.
    private func writeDirectCopy(_ lines: [String]) {
        let ios = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()   // ClinicalValidation
            .deletingLastPathComponent()   // AmiseMedFlowTests
            .deletingLastPathComponent()   // ios
        let url = ios.appendingPathComponent("clinval-ios-direct.jsonl")
        try? (lines.joined(separator: "\n") + "\n").write(to: url, atomically: true, encoding: .utf8)
    }
}
