// ChipDimensionsTests.swift
// score() reads a chip with its question (ChipDimensions, HistoryFrameData.chipLabels /
// chipRecordFields generated from lib/triage-engine/src/history-frames/engine-dimensions.ts).
// history-by-complaint findings 2 (a Coughing chip under Aggravating reached cough findings) and 3
// (early-form exam / pmh / social / inv chips never reached their features).

import XCTest
@testable import AmiseMedFlow

final class ChipDimensionsTests: XCTestCase {

    private let candidate = BayesianDiagnosisEngine.Candidate(
        name: "Test candidate", icd: "X00", logPrior: 0,
        features: [
            .init(key: "finding", value: "cough|sputum|phlegm|haemoptysis", logLR: 20, evidenceLabel: "Cough"),
            .init(key: "finding", value: "movement|twisting|lifting|strain|coughing", logLR: 20, evidenceLabel: "Worse on movement"),
            .init(key: "exam", value: "splenomegaly", logLR: 20, evidenceLabel: "Splenomegaly"),
            .init(key: "pmh", value: "cirrhosis", logLR: 20, evidenceLabel: "Cirrhosis"),
            .init(key: "social", value: "smok", logLR: 20, evidenceLabel: "Smoker"),
            .init(key: "inv", value: "tsh suppressed", logLR: 20, evidenceLabel: "TSH suppressed"),
            .init(key: "finding", value: "radiat&back|through to the back", logLR: 20, evidenceLabel: "Radiates to the back"),
        ])

    private func fired(_ socrates: [String: Set<String>]) -> [String] {
        BayesianDiagnosisEngine.score(candidates: [candidate], socrates: socrates, pmh: "", pshx: "",
                                      examAbdo: "", examGeneral: "", investigations: [],
                                      age: 50, sex: .male).first?.pathognomicFindings ?? []
    }

    func testChipsCarryTheirQuestion() {
        XCTAssertEqual(ChipDimensions.findingText(key: "exacerbating", value: "Coughing"), "aggravating: Coughing")
        XCTAssertEqual(ChipDimensions.findingText(key: "associations", value: "Fever"), "associated: Fever")
        XCTAssertEqual(ChipDimensions.findingText(key: "lucid_interval", value: "present"), "present")
    }

    func testCoughingAsAnAggravatingFactorIsNotACough() {
        let f = fired(["exacerbating": ["Coughing"]])
        XCTAssertFalse(f.contains("Cough"))
        XCTAssertTrue(f.contains("Worse on movement"))
    }

    func testCoughAsAnAssociatedSymptomIsACough() {
        let f = fired(["associations": ["Cough"]])
        XCTAssertTrue(f.contains("Cough"))
        XCTAssertFalse(f.contains("Worse on movement"))
    }

    func testRadiationChipReachesTheRadiationFinding() {
        XCTAssertTrue(fired(["radiation": ["Back"]]).contains("Radiates to the back"))
        XCTAssertFalse(fired(["site": ["Back"]]).contains("Radiates to the back"))
    }

    func testEarlyFormChipsReachTheirRecordFeatures() {
        let f = fired(["exam": ["splenomegaly"], "pmh": ["cirrhosis"], "social": ["smok"], "inv": ["tsh suppressed"]])
        XCTAssertTrue(f.contains("Splenomegaly"))
        XCTAssertTrue(f.contains("Cirrhosis"))
        XCTAssertTrue(f.contains("Smoker"))
        XCTAssertTrue(f.contains("TSH suppressed"))
    }

    func testHistoryFrameRiskChipsReadAsHistory() {
        XCTAssertTrue(fired(["history": ["Current or ex-smoker"]]).contains("Smoker"))
    }
}
