// OutcomeSnapshotTests.swift
// Outcomes loop on iOS (OutcomeSnapshot.swift): coded values only, the snapshot shape the web and
// Supabase read (the web test outcomes-ios-contract.test.ts checks the same JSON keys), the
// "final diagnosis not yet recorded" rule and retract-not-delete corrections.

import XCTest
@testable import AmiseMedFlow

final class OutcomeSnapshotTests: XCTestCase {

    func testICD10NormalisationKeepsTheCodeOnly() {
        XCTAssertEqual(OutcomeCodes.normaliseICD10("K35.80 — Acute appendicitis"), "K35.80")
        XCTAssertEqual(OutcomeCodes.normaliseICD10("k3580"), "K35.80")
        XCTAssertEqual(OutcomeCodes.normaliseICD10("K36"), "K36")
        XCTAssertNil(OutcomeCodes.normaliseICD10("Appendicitis"))
        XCTAssertNil(OutcomeCodes.normaliseICD10(""))
        XCTAssertNil(OutcomeCodes.normaliseICD10(nil))
    }

    func testEncounterReferenceAndVersionTokens() {
        XCTAssertEqual(OutcomeCodes.encounterRef(syncCode: "ABC-123"), "ios:ABC-123")
        XCTAssertNil(OutcomeCodes.encounterRef(syncCode: "not ok"))
        XCTAssertEqual(OutcomeCodes.versionToken("2.1.0"), "2.1.0")
        XCTAssertEqual(OutcomeCodes.versionToken("Not in this build"), "Not-in-this-build")
    }

    private func input(differential: [OutcomeSnapshotBuilder.DifferentialItem] = [
        .init(icd: "K35.80", probability: 72), .init(icd: "Unreadable", probability: 10), .init(icd: "K81.0", probability: 11),
    ], operation: Bool = false, pathology: Bool = false, loaded: Bool = true) -> OutcomeSnapshotBuilder.Input {
        OutcomeSnapshotBuilder.Input(
            encounterSyncCode: "11111111-2222-4333-8444-555555555555",
            completedAt: Date(timeIntervalSince1970: 1_790_000_000),
            differential: differential, acuity: .urgent, workingICD: "K35.80 Acute appendicitis — typed",
            news2: 5, operation: operation, pathology: pathology,
            databaseVersion: "2.1.0", databaseLoaded: loaded)
    }

    func testSnapshotHoldsCodesProbabilitiesAndVersions() throws {
        let r = try XCTUnwrap(OutcomeSnapshotBuilder.build(input()))
        XCTAssertEqual(r.platform, "ios")
        XCTAssertEqual(r.encounterRef, "ios:11111111-2222-4333-8444-555555555555")
        XCTAssertEqual(r.differentialEngine, "ios-bayes")
        XCTAssertEqual(r.differentialModelVersion, "2.1.0")
        XCTAssertEqual(r.topDifferential.map(\.icd10), ["K35.80", "K81.0"])
        XCTAssertEqual(r.topDifferential.map(\.rank), [1, 2])
        XCTAssertEqual(r.topDifferential.first?.probability ?? 0, 0.72, accuracy: 1e-9)
        XCTAssertEqual(r.triageLevel, "urgent")
        XCTAssertEqual(r.triageScale, "ios-acuity")
        XCTAssertEqual(r.scores, [OutcomeScore(key: "news2", value: 5, source: "record")])
        XCTAssertNil(r.workingIcd10, "a code followed by free text without a separator is not a bare code")
        XCTAssertEqual(r.modelVersions["diagnosticDatabase"], "2.1.0")
        XCTAssertEqual(r.modelVersions["differentialSource"], "database")
        XCTAssertFalse(r.expectsOutcome)
        XCTAssertTrue(r.sync.pendingSync)
    }

    func testFallbackListsAreRecordedAsFallback() throws {
        let r = try XCTUnwrap(OutcomeSnapshotBuilder.build(input(loaded: false)))
        XCTAssertEqual(r.differentialModelVersion, "fallback")
        XCTAssertEqual(r.modelVersions["differentialSource"], "fallback")
    }

    func testJSONUsesTheWebKeys() throws {
        let r = try XCTUnwrap(OutcomeSnapshotBuilder.build(input(operation: true, pathology: true)))
        let data = try JSONEncoder().encode(r)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        for key in ["snapshotVersion", "platform", "encounterRef", "completedAt", "differentialEngine",
                    "differentialModelVersion", "modelVersions", "topDifferential", "triageLevel", "triageScale",
                    "scores", "decisionBands", "features", "recordedIcd10", "expectsOutcome", "outcomeTriggers"] {
            XCTAssertNotNil(object[key], key)
        }
        XCTAssertEqual(object["outcomeTriggers"] as? [String], ["operation", "pathology"])
        XCTAssertEqual(object["expectsOutcome"] as? Bool, true)
        let back = try JSONDecoder().decode(OutcomePredictionRecord.self, from: data)
        XCTAssertEqual(back, r)
    }

    func testOldOrPartialJSONStillDecodes() throws {
        let json = #"{"encounterRef":"ios:abc","completedAt":"2026-09-26T12:00:00Z"}"#
        let r = try JSONDecoder().decode(OutcomePredictionRecord.self, from: Data(json.utf8))
        XCTAssertEqual(r.topDifferential, [])
        XCTAssertFalse(r.expectsOutcome)
    }

    func testPathologyRequestFlag() {
        XCTAssertTrue(OutcomeSnapshotBuilder.isPathologyRequest(name: "Excision biopsy", category: .other))
        XCTAssertTrue(OutcomeSnapshotBuilder.isPathologyRequest(name: "Anything", category: .pathology))
        XCTAssertTrue(OutcomeSnapshotBuilder.isPathologyRequest(name: "US-guided FNA thyroid", category: .imaging))
        XCTAssertFalse(OutcomeSnapshotBuilder.isPathologyRequest(name: "FBC", category: .blood))
    }

    func testDueOnlyAfterAnOperationOrPathologyAndFourteenDaysWithoutAConfirmedDiagnosis() throws {
        let completed = Date(timeIntervalSince1970: 1_790_000_000)
        let expecting = try XCTUnwrap(OutcomeSnapshotBuilder.build(input(operation: true)))
        let notExpecting = try XCTUnwrap(OutcomeSnapshotBuilder.build(input()))
        let day15 = completed.addingTimeInterval(15 * 86_400)
        let day10 = completed.addingTimeInterval(10 * 86_400)
        XCTAssertTrue(OutcomeSnapshotBuilder.isDue(prediction: expecting, finals: [], completedAt: completed, now: day15))
        XCTAssertFalse(OutcomeSnapshotBuilder.isDue(prediction: expecting, finals: [], completedAt: completed, now: day10))
        XCTAssertFalse(OutcomeSnapshotBuilder.isDue(prediction: notExpecting, finals: [], completedAt: completed, now: day15))
        XCTAssertFalse(OutcomeSnapshotBuilder.isDue(prediction: nil, finals: [], completedAt: completed, now: day15))

        var confirmed = OutcomeFinalDiagnosisRecord(encounterRef: expecting.encounterRef, finalIcd10: "K35.2",
                                                    sourceType: .histology, sourceDate: "2026-09-10",
                                                    retrospectiveAcuity: .urgent)
        XCTAssertFalse(OutcomeSnapshotBuilder.isDue(prediction: expecting, finals: [confirmed], completedAt: completed, now: day15))
        confirmed.status = "retracted"
        XCTAssertTrue(OutcomeSnapshotBuilder.isDue(prediction: expecting, finals: [confirmed], completedAt: completed, now: day15))
    }

    func testFinalDiagnosisRecordUsesTheServerValues() throws {
        let r = OutcomeFinalDiagnosisRecord(encounterRef: "ios:abc", finalIcd10: "K35.2", sourceType: .operativeFindings,
                                            sourceDate: "2026-09-10", retrospectiveAcuity: .soon)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(r)) as? [String: Any])
        XCTAssertEqual(object["sourceType"] as? String, "operative_findings")
        XCTAssertEqual(object["retrospectiveAcuity"] as? String, "soon")
        XCTAssertEqual(object["status"] as? String, "confirmed")
        XCTAssertTrue(r.sync.clientRef.hasPrefix("ios:"))
    }
}
