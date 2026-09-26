import XCTest
@testable import AmiseMedFlow

/// The clinical rule files shared with the web (clinical-content/rules/*.json) are bundled in the
/// "rules" folder reference (ios/project.yml) and decode with the engines' own Codable structs
/// (SharedClinicalContent.swift). A failure here means an engine would show nothing on a device
/// (Settings → Diagnostics would say "Not loaded"). lint:shared-content checks the same structs
/// against the JSON Schemas on the web CI; this confirms it on the real bundle.
final class SharedClinicalContentTests: XCTestCase {

    func testEverySharedRuleFileIsBundledAndDecodes() {
        let statuses = SharedClinicalContent.statuses()
        XCTAssertEqual(statuses.count, SharedClinicalContent.File.allCases.count)
        for status in statuses {
            XCTAssertTrue(status.found, "\(status.file).json is not in the app bundle (project.yml folder reference)")
            XCTAssertTrue(status.loaded, "\(status.file).json does not decode: \(status.error ?? "")")
            XCTAssertNil(status.error, status.file)
            XCTAssertNotEqual(status.version, "—", "\(status.file).json has no version")
        }
    }

    func testFilesAreInTheRulesFolder() {
        for file in SharedClinicalContent.File.allCases {
            XCTAssertNotNil(Bundle.main.url(forResource: file.rawValue, withExtension: "json",
                                            subdirectory: file.folder),
                            "\(file.rawValue).json is not in the bundle's \(file.folder) folder")
        }
    }

    func testEnginesLoadedTheirContent() {
        XCTAssertNotNil(ZebraCheck.ruleFile)
        XCTAssertFalse(ZebraCheck.rules.isEmpty)
        XCTAssertNotEqual(ZebraCheck.version, "unavailable")

        XCTAssertNotNil(SupplementCatalogue.content)
        XCTAssertFalse(SupplementCatalogue.items.isEmpty)
        XCTAssertFalse(SupplementCatalogue.prompts.isEmpty)
        XCTAssertFalse(SupplementCatalogue.triggerTerms.isEmpty)
        XCTAssertNotEqual(SupplementCatalogue.catalogueVersion, "unavailable")

        XCTAssertNotNil(LifestylePractices.content)
        XCTAssertNotEqual(LifestylePractices.version, "unavailable")

        XCTAssertNotNil(DiagnosticReasoningRules.ruleFile)
        XCTAssertEqual(DiagnosticReasoningRules.ruleFile?.version, DiagnosticReasoning.version)
        XCTAssertNotNil(DiagnosticReasoning.contradictionMaxLr)
    }

    /// The lifestyle labels are keyed by the stored values: every enum case has exactly one label.
    func testLifestyleLabelKeysAreTheStoredValues() throws {
        let labels = try XCTUnwrap(LifestylePractices.content?.labels)
        XCTAssertEqual(Set(labels.fasting.keys), Set(LifestyleHistory.Fasting.allCases.map(\.rawValue)))
        XCTAssertEqual(Set(labels.fastingStatus.keys), Set(LifestyleHistory.FastStatus.allCases.map(\.rawValue)))
        XCTAssertEqual(Set(labels.therapies.keys), Set(LifestyleHistory.Therapy.allCases.map(\.rawValue)))
        for f in LifestyleHistory.Fasting.allCases { XCTAssertNotEqual(f.label, f.rawValue, f.rawValue) }
        for s in LifestyleHistory.FastStatus.allCases { XCTAssertNotEqual(s.label, s.rawValue, s.rawValue) }
        for t in LifestyleHistory.Therapy.allCases { XCTAssertNotEqual(t.label, t.rawValue, t.rawValue) }
    }

    /// Every suggestion id the rules raise has a display name and grade in the file.
    func testLifestyleSuggestionTextsCoverEveryId() throws {
        let suggestions = try XCTUnwrap(LifestylePractices.content?.suggestions)
        for id in ["tai-chi", "yoga", "mbct", "slow-breathing", "acupuncture", "time-restricted-eating",
                   "counsel-cupping", "counsel-detox", "counsel-iv-drips"] {
            XCTAssertNotNil(suggestions[id], id)
        }
    }

    func testAMissingFileIsReportedNotGuessed() {
        // A bundle without the rules folder (the test bundle has none): nothing decodes, and the
        // status explains why instead of crashing or inventing content.
        let empty = Bundle(for: SharedClinicalContentTests.self)
        let status = SharedClinicalContent.status(of: .zebraRules, bundle: empty)
        XCTAssertFalse(status.found)
        XCTAssertFalse(status.loaded)
        XCTAssertEqual(status.valueText, "Not in this build")
        XCTAssertNotNil(status.error)
        XCTAssertNil(SharedClinicalContent.load(ZebraCheck.RuleFile.self, .zebraRules, bundle: empty))
    }
}
