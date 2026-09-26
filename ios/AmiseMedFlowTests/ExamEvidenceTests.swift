import XCTest
@testable import AmiseMedFlow

/// Evidence-based examination signs and decision rules (evidence-exam 1.0.0): the bundled
/// catalogues, the "[sign]" record lines, the rule-band policy and the scorer's "sign" features.
/// The JSON side (schemas, byte-identical copies, DiagnosticDatabase.json 2.2.0 features) is
/// checked without Xcode by scripts/src/exam-evidence-content.test.ts and exam-evidence-db.test.ts.
final class ExamEvidenceTests: XCTestCase {

    func testCataloguesLoadWithTheDatabase() {
        XCTAssertNotNil(ExamEvidenceCatalogue.signsFile)
        XCTAssertNotNil(ExamEvidenceCatalogue.rulesFile)
        XCTAssertNotNil(ExamEvidenceCatalogue.sign("murphy"))
        XCTAssertNotNil(ExamEvidenceCatalogue.rule("perc"))
        XCTAssertTrue(DecisionRuleEvidence.replacesLegacyAdjustments, "DiagnosticDatabase.json 2.2.0 carries the rule features")
    }

    func testRecordLinesUseTheWebWording() throws {
        let murphy = try XCTUnwrap(ExamEvidenceCatalogue.sign("murphy"))
        XCTAssertEqual(ExamSignRecord.chipText(murphy, state: "present"), "Murphy's sign: present")
        XCTAssertEqual(ExamSignRecord.chipText(murphy, state: "absent"), "No Murphy's sign (examined)")
        let rebound = try XCTUnwrap(ExamEvidenceCatalogue.sign("rebound"))
        XCTAssertEqual(ExamSignRecord.chipText(rebound, state: "absent"), "No rebound tenderness (examined)")
        XCTAssertEqual(ExamSignRecord.line(murphy, state: "present"), "[sign] Murphy's sign: present.")
    }

    func testSettingReadingAndClearingASign() {
        var text: String? = "Soft abdomen."
        text = ExamSignRecord.settingState("present", signID: "murphy", in: text)
        text = ExamSignRecord.settingState("absent", signID: "rovsing", in: text)
        XCTAssertEqual(ExamSignRecord.states(in: text), ["murphy": "present", "rovsing": "absent"])
        text = ExamSignRecord.settingState(nil, signID: "murphy", in: text)
        XCTAssertEqual(ExamSignRecord.states(in: text), ["rovsing": "absent"])
        XCTAssertTrue((text ?? "").hasPrefix("Soft abdomen."))
        XCTAssertNil(ExamSignRecord.settingState(nil, signID: "rovsing", in: ExamSignRecord.settingState("absent", signID: "rovsing", in: nil)))
    }

    func testEngineSignLinesAreStrippedAndRedFlagLinesStay() {
        let text = ExamSignRecord.merged(text: "Note.", states: ["murphy": "present", "neck_stiffness": "present"]) ?? ""
        let stripped = ExamSignRecord.strippingEngineSignLines(text)
        XCTAssertFalse(stripped.contains("Murphy"))
        XCTAssertTrue(stripped.contains("Neck stiffness"))
        XCTAssertTrue(stripped.contains("Note."))
    }

    func testRuleBandsFollowThePolicy() {
        XCTAssertEqual(DecisionRuleEvidence.observedBands(["alvarado": 8, "air": 10]), ["air:high"])
        XCTAssertEqual(DecisionRuleEvidence.observedBands(["perc": 0, "wells-pe": 6]), ["wells-pe:likely"])
        XCTAssertEqual(DecisionRuleEvidence.observedBands(["perc": 0, "wells-pe": 1.5]), ["perc:negative", "wells-pe:unlikely"])
        XCTAssertEqual(DecisionRuleEvidence.observedBands(["lrinec": 3]), [])
        XCTAssertEqual(DecisionRuleEvidence.componentSigns(ofRules: ["alvarado"]), ["mcburney", "rebound"])
    }

    /// The Exam step reads the complaint through the history step's classifier: a cough is examined
    /// at the chest, never the abdomen by default (ExamRegion, exam-signs.json "frames").
    func testExamRegionFollowsTheHistoryFrame() {
        func region(_ complaint: String) -> ExamRegion {
            ExamRegion.forFrame(HistoryFrameClassifier.classify(complaint).frameId, complaint: complaint)
        }
        XCTAssertEqual(region("Cough").id, "chest-respiratory")
        XCTAssertEqual(region("Shortness of breath").id, "chest-respiratory")
        XCTAssertEqual(region("Chest pain").id, "chest-cardiac")
        XCTAssertEqual(region("Groin lump").label, "Groin / Hernia")
        XCTAssertEqual(region("Lump on the back").id, "lump")
        XCTAssertEqual(region("Parotid swelling").label, "Salivary Gland / Jaw")
        XCTAssertEqual(region("Right iliac fossa pain").label, "Abdomen")
        XCTAssertEqual(region("Follow-up").id, "general")
        // A cough's chest chips go in the Respiratory field; the abdomen keeps its own label and chips.
        let cough = region("Cough")
        XCTAssertEqual(cough.field, .resp)
        XCTAssertTrue(cough.chips(for: .resp).contains("Bronchial breathing."))
        XCTAssertEqual(cough.label(for: .abdo), "Abdomen")
        XCTAssertEqual(cough.chips(for: .abdo), ExamRegion.abdomen.chips)
        // Neurological findings are shown in the short examination for a neurological complaint.
        XCTAssertTrue(region("Weakness of the left arm").showsInShortExam(.neuro))
        XCTAssertFalse(region("Right iliac fossa pain").showsInShortExam(.neuro))
    }

    func testCoughOffersChestSignsNotAbdominalOnes() {
        let ids = ExamEvidenceCatalogue.relevantSigns(frameIDs: ["cough"], text: "Cough", ageYears: 50,
                                                      leadingDiagnoses: []).map(\.id)
        XCTAssertTrue(ids.contains("dullness_percussion"))
        XCTAssertTrue(ids.contains("crackles"))
        XCTAssertFalse(ids.contains("murphy"))
        XCTAssertTrue(ExamEvidenceCatalogue.relevantRules(frameIDs: ["cough"], text: "Cough").contains { $0.id == "curb65" })
    }

    func testMurphyChipFiresOnlyWhenRecorded() throws {
        func infer(_ examOther: String?) -> [BayesianDiagnosisEngine.DiagnosisResult] {
            BayesianDiagnosisEngine.infer(
                chiefComplaint: "Right upper quadrant pain",
                socratesSelections: [:],
                pmhNotes: nil,
                surgicalHistory: nil,
                examAbdo: "Tender right upper quadrant.",
                examGeneral: nil,
                examOther: examOther,
                investigations: [],
                ageYears: 45,
                sex: .female,
                hpi: "Constant pain for a day after a fatty meal, vomiting, feverish."
            )
        }
        let fired = { (results: [BayesianDiagnosisEngine.DiagnosisResult]) -> Bool in
            results.contains { r in r.firedFeatures.contains { $0.key == "sign" && $0.value == "murphy:present" } }
        }
        XCTAssertTrue(fired(infer(ExamSignRecord.merged(text: nil, states: ["murphy": "present"]))))
        XCTAssertFalse(fired(infer(nil)), "an unrecorded sign is not examined")
        XCTAssertFalse(fired(infer(ExamSignRecord.merged(text: nil, states: ["murphy": "absent"]))))
    }
}
