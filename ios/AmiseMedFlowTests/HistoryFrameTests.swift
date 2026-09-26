// HistoryFrameTests.swift
// History frames (HistoryFrames.swift + generated HistoryFrameData.swift). The complaint → frame
// vectors are shared with the web (AmiseMedFlowTests/Resources/HistoryFrameVectors.json, run by
// scripts/src/history-frames.test.ts and lint:history-frames). The chip → engine-feature audit
// runs in lint:history-frames (it parses HistoryFrameData.swift and DiagnosticDatabase.json).

import XCTest
@testable import AmiseMedFlow

private final class HistoryFrameVectorsToken {}

private struct HFVector: Decodable {
    let complaint: String
    let system: String?
    let source: String
    let expectedFrame: String
    let secondary: [String]?
}

private struct HFVectors: Decodable {
    let vectors: [HFVector]
}

final class HistoryFrameTests: XCTestCase {

    private static func loadVectors() throws -> [HFVector] {
        let bundle = Bundle(for: HistoryFrameVectorsToken.self)
        let url = bundle.url(forResource: "HistoryFrameVectors", withExtension: "json")
            ?? URL(fileURLWithPath: #filePath).deletingLastPathComponent()
                .appendingPathComponent("Resources").appendingPathComponent("HistoryFrameVectors.json")
        return try JSONDecoder().decode(HFVectors.self, from: Data(contentsOf: url)).vectors
    }

    // MARK: - Shared vectors

    func testEveryComplaintVector() throws {
        let vectors = try Self.loadVectors()
        XCTAssertGreaterThan(vectors.count, 400)
        for v in vectors {
            let got = HistoryFrameClassifier.classify(v.complaint, system: v.system)
            XCTAssertEqual(got.frameId, v.expectedFrame, "\(v.source) \"\(v.complaint)\"")
            XCTAssertEqual(got.secondary, v.secondary ?? [], "\(v.source) \"\(v.complaint)\" secondary")
        }
    }

    func testEveryVectorFrameExists() throws {
        for v in try Self.loadVectors() {
            XCTAssertNotNil(HistoryFrames.frame(id: v.expectedFrame), v.expectedFrame)
        }
    }

    // MARK: - The owner's report: a cough is not an abdominal pain history

    func testCoughGetsTheCoughFrame() {
        let r = HistoryFrames.resolve(complaint: "Cough", system: "Respiratory", overrideFrameId: nil)
        XCTAssertEqual(r.frame.id, "cough")
        XCTAssertEqual(r.frame.title, "Cough history")
        let labels = Set(r.dimensions.flatMap { $0.spec.options.map(\.label) })
        for abdominal in ["RUQ", "LUQ", "RLQ", "LLQ", "Epigastric", "Periumbilical", "Suprapubic", "Loin", "Groin"] {
            XCTAssertFalse(labels.contains(abdominal), abdominal)
        }
        XCTAssertFalse(r.dimensions.contains { $0.id == "radiation" })
        XCTAssertTrue(labels.contains("Dry cough"))
        XCTAssertTrue(labels.contains("Haemoptysis — frank blood"))
    }

    func testSocratesLabelIsForPainOnly() {
        for f in HistoryFrameData.frames {
            if f.type == "pain" {
                XCTAssertEqual(f.title, "SOCRATES", f.id)
            } else {
                XCTAssertFalse(f.title.uppercased().contains("SOCRATES"), f.id)
                XCTAssertFalse(f.dimensions.contains { $0.id == "radiation" }, "\(f.id): radiation outside a pain history")
            }
        }
    }

    /// The walkthrough types "Right upper quadrant pain": pain SOCRATES with the abdominal sites, as before.
    func testAbdominalPainKeepsSocrates() {
        let r = HistoryFrames.resolve(complaint: "Right upper quadrant pain for 3 days", system: nil, overrideFrameId: nil)
        XCTAssertEqual(r.frame.id, "pain.abdomen")
        XCTAssertEqual(r.dimensions.first?.id, "onset")
        let site = r.frame.dimensions.first { $0.id == "site" }
        XCTAssertEqual(site?.options.first?.label, "RUQ")
        XCTAssertEqual(site?.key, "site")
        let rif = HistoryFrames.resolve(complaint: "Right iliac fossa pain", system: nil, overrideFrameId: nil)
        XCTAssertEqual(rif.frame.id, "pain.abdomen")
    }

    func testLumpHasNoRadiationAndHerniaAsksReducibility() {
        let r = HistoryFrames.resolve(complaint: "Inguinal / groin hernia", system: nil, overrideFrameId: nil)
        XCTAssertEqual(r.frame.id, "lump.hernia")
        XCTAssertFalse(r.dimensions.contains { $0.id == "radiation" })
        let reducibility = r.frame.dimensions.first { $0.id == "reducibility" }
        XCTAssertNotNil(reducibility?.options.first { $0.label == "Cough impulse" })
    }

    func testSecondarySymptomAddsItsKeyQuestions() {
        let r = HistoryFrames.resolve(complaint: "Cough with haemoptysis and weight loss", system: nil, overrideFrameId: nil)
        XCTAssertEqual(r.frame.id, "cough")
        XCTAssertTrue(r.dimensions.contains { $0.id == "weight_loss.amount" && $0.secondary })
        let painFirst = HistoryFrames.resolve(complaint: "Abdominal pain and vomiting", system: nil, overrideFrameId: nil)
        XCTAssertEqual(painFirst.frame.id, "pain.abdomen")
        XCTAssertTrue(painFirst.dimensions.contains { $0.id == "vomiting.content" })
        let painfulLump = HistoryFrameClassifier.classify("Painful lump in the groin")
        XCTAssertEqual(painfulLump.frameId, "lump.hernia")
    }

    func testOneTapOverride() {
        let r = HistoryFrames.resolve(complaint: "Cough", system: nil, overrideFrameId: "dyspnoea")
        XCTAssertEqual(r.frame.id, "dyspnoea")
        XCTAssertEqual(r.choice.frameId, "cough")
    }

    func testPainRegionFromSystem() {
        XCTAssertEqual(HistoryFrameClassifier.classify("Pain", system: "Musculoskeletal").frameId, "pain.joint")
        XCTAssertEqual(HistoryFrameClassifier.classify("Pain", system: nil).frameId, "pain.abdomen")
        XCTAssertEqual(HistoryFrameClassifier.classify("Painless jaundice").frameId, "jaundice")
    }

    // MARK: - Chips

    func testToggleSingleSelectAndExcludes() {
        guard let cough = HistoryFrames.frame(id: "cough"),
              let character = cough.dimensions.first(where: { $0.id == "character" }),
              let dry = character.options.first(where: { $0.label == "Dry cough" }),
              let productive = character.options.first(where: { $0.label == "Productive cough" }) else {
            return XCTFail("cough character chips missing")
        }
        var sel: [String: Set<String>] = [:]
        sel = HistoryFrames.toggled(dry, in: character, frame: cough, selections: sel)
        XCTAssertEqual(sel["character"], ["Dry cough"])
        sel = HistoryFrames.toggled(productive, in: character, frame: cough, selections: sel)
        XCTAssertEqual(sel["character"], ["Productive cough"], "single-select question keeps one chip")

        guard let pain = HistoryFrames.frame(id: "pain.abdomen"),
              let relieving = pain.dimensions.first(where: { $0.id == "relieving" }),
              let rest = relieving.options.first(where: { $0.label == "Rest" }),
              let nothing = relieving.options.first(where: { $0.label == "Nothing" }) else {
            return XCTFail("relieving chips missing")
        }
        var r: [String: Set<String>] = [:]
        r = HistoryFrames.toggled(rest, in: relieving, frame: pain, selections: r)
        r = HistoryFrames.toggled(nothing, in: relieving, frame: pain, selections: r)
        XCTAssertEqual(r["relieving"], ["Nothing"], "\"Nothing\" clears the other relieving chips")
    }

    func testChipStoresTheEngineValue() {
        guard let cough = HistoryFrames.frame(id: "cough"),
              let exposure = cough.dimensions.first(where: { $0.id == "exposure" }),
              let acei = exposure.options.first(where: { $0.label == "Started after an ACE inhibitor" }) else {
            return XCTFail("ACE inhibitor chip missing")
        }
        // DiagnosticDatabase cough pool: timing "After starting ACEi".
        XCTAssertEqual(acei.key, "timing")
        XCTAssertEqual(acei.value, "After starting ACEi")
        let sel = HistoryFrames.toggled(acei, in: exposure, frame: cough, selections: [:])
        XCTAssertEqual(sel["timing"], ["After starting ACEi"])
        XCTAssertEqual(HistoryFrames.displayLabel(key: "timing", value: "After starting ACEi"), "Started after an ACE inhibitor")
    }

    func testLegacyValuesStillRender() {
        guard let pain = HistoryFrames.frame(id: "pain.abdomen"),
              let site = pain.dimensions.first(where: { $0.id == "site" }),
              let flank = site.options.first(where: { $0.label == "Right flank" }) else {
            return XCTFail("site chips missing")
        }
        // An encounter saved with the old "Right side" chip shows it selected as "Right flank".
        XCTAssertTrue(HistoryFrames.isSelected(flank, in: pain, selections: ["site": ["Right side"]]))
        XCTAssertEqual(HistoryFrames.displayLabel(key: "site", value: "Right side"), "Right flank")
        XCTAssertEqual(HistoryFrames.displayLabel(key: "site", value: "Something typed"), "Something typed")
        XCTAssertEqual(HistoryFrames.keyTitle("associations"), "Associated")
    }

    func testPreConsultAssociatedChipsFollowTheComplaint() {
        let cough = HistoryFrames.associatedChips(forComplaint: "Cough")
        XCTAssertTrue(cough.contains("Breathlessness"))
        XCTAssertFalse(cough.contains("Jaundice"))
        XCTAssertFalse(HistoryFrames.associatedChips(forComplaint: "Fever").isEmpty)
    }

    func testNoDuplicateChipsInAQuestion() {
        for f in HistoryFrameData.frames {
            for d in f.dimensions {
                XCTAssertEqual(Set(d.options.map(\.label)).count, d.options.count, "\(f.id) › \(d.id)")
            }
        }
    }
}
