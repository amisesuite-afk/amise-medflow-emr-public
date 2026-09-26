import XCTest
@testable import AmiseMedFlow

/// Disease-centred vademecum, phase 1 (shadow): the shared files clinical-content/vademecum/*.json
/// are bundled in the "vademecum" folder reference and decode with VademecumContent's Codable
/// structs. Nothing on iOS uses the content yet (no engine switch); this confirms that the files a
/// later phase will read arrive intact on a device. lint:shared-content and lint:vademecum check
/// the same structs and references on the web CI.
final class VademecumContentTests: XCTestCase {

    func testFindingDictionaryDecodes() throws {
        let file = try XCTUnwrap(VademecumContent.findingsFile, "findings.json did not decode (Settings → Diagnostics shows why)")
        XCTAssertFalse(file.findings.isEmpty)
        XCTAssertEqual(file.policy.levels, ["history", "exam", "score", "investigation"])
        XCTAssertGreaterThan(file.policy.definitiveLR, 1)
        XCTAssertEqual(Set(file.findings.map(\.id)).count, file.findings.count, "finding ids must be unique")
        for finding in file.findings {
            XCTAssertTrue(["history", "exam", "score", "investigation"].contains(finding.level), finding.id)
            XCTAssertNotNil(file.dimensions[finding.dimension], "\(finding.id): dimension \(finding.dimension) has no question")
            XCTAssertTrue(finding.label != nil || finding.examSign != nil || finding.decisionRule != nil, "\(finding.id) has no label")
        }
    }

    func testBothPilotAreasDecode() throws {
        XCTAssertEqual(VademecumContent.areaFiles.count, SharedClinicalContent.File.vademecumAreas.count)
        let areas = Set(VademecumContent.areaFiles.map(\.area))
        XCTAssertTrue(areas.contains("abdominal-pain"))
        XCTAssertTrue(areas.contains("cough-breathlessness"))
        for area in VademecumContent.areaFiles {
            XCTAssertFalse(area.diseases.isEmpty, area.area)
            XCTAssertEqual(area.status, "shadow", area.area)
        }
    }

    func testEveryLinkNamesADictionaryFinding() throws {
        let dictionary = try XCTUnwrap(VademecumContent.findingsFile)
        for area in VademecumContent.areaFiles {
            XCTAssertEqual(VademecumContent.unknownFindingIds(in: area, dictionary: dictionary), [], area.area)
        }
    }

    func testDiseaseIdsAreUniqueAcrossAreas() {
        let ids = VademecumContent.areaFiles.flatMap { $0.diseases.map(\.id) }
        XCTAssertEqual(Set(ids).count, ids.count)
    }

    func testCriteriaAndPathognomonicDecode() {
        let diseases = VademecumContent.areaFiles.flatMap(\.diseases)
        XCTAssertTrue(diseases.contains { !$0.criteria.isEmpty }, "no disease carries diagnostic criteria")
        XCTAssertTrue(diseases.contains { !$0.pathognomonic.isEmpty }, "no disease carries a pathognomonic finding")
        XCTAssertTrue(diseases.contains { !$0.exclusions.isEmpty }, "no disease carries an exclusion")
        XCTAssertTrue(diseases.contains { $0.workupWhenIncidental != nil }, "no disease carries an incidental work-up")
        for disease in diseases {
            XCTAssertEqual(disease.signOff, "pending", "\(disease.id): phase 1 content is unreviewed")
        }
    }

    func testVademecumFilesAreInTheirFolder() {
        for file in [SharedClinicalContent.File.vademecumFindings] + SharedClinicalContent.File.vademecumAreas {
            XCTAssertEqual(file.folder, SharedClinicalContent.vademecumFolder)
            XCTAssertNotNil(Bundle.main.url(forResource: file.rawValue, withExtension: "json",
                                            subdirectory: SharedClinicalContent.vademecumFolder),
                            "\(file.rawValue).json is not in the bundle's vademecum folder (project.yml)")
        }
    }
}
