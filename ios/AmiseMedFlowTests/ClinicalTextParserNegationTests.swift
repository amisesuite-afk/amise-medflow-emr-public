import XCTest
@testable import AmiseMedFlow

/// ClinicalTextParser read documented negatives as findings: "No crepitus" completed the
/// necrotising fasciitis alarm, "No confusion" the sepsis alarm, "Murphy's sign negative" added the
/// Murphy's sign feature (clinical validation, 2026-09; docs/clinical-validation/ENGINE-MAP.md,
/// "Negation"). It now matches through NegationMatcher. Each case has a positive control.
final class ClinicalTextParserNegationTests: XCTestCase {

    private func parse(hpi: String? = nil, general: String? = nil, abdo: String? = nil,
                       other: String? = nil, notes: String? = nil) -> ClinicalTextParser.ParseResult {
        ClinicalTextParser.parse(hpi: hpi, examGeneral: general, examAbdo: abdo, examOther: other, notes: notes)
    }

    private func alarmTitles(_ r: ClinicalTextParser.ParseResult) -> [String] {
        r.clinicalAlarms.map(\.title)
    }

    private func chips(_ r: ClinicalTextParser.ParseResult, _ dim: String) -> Set<String> {
        r.featureAugments[dim] ?? []
    }

    // MARK: - Alarms

    func testNoCrepitusDoesNotRaiseTheNecrotisingFasciitisAlarm() {
        let r = parse(hpi: "Pain out of proportion in the left leg.",
                      general: "No crepitus, no spreading erythema.")
        XCTAssertFalse(alarmTitles(r).contains("Suspect Necrotising Fasciitis"))
        XCTAssertFalse(chips(r, "exam").contains("Crepitus"))
    }

    func testCrepitusStillRaisesTheNecrotisingFasciitisAlarm() {
        let r = parse(hpi: "Pain out of proportion in the left leg.",
                      general: "Crepitus on palpation of the thigh.")
        XCTAssertTrue(alarmTitles(r).contains("Suspect Necrotising Fasciitis"))
        XCTAssertTrue(chips(r, "exam").contains("Crepitus"))
    }

    func testNoConfusionDoesNotCompleteTheSepsisAlarm() {
        let r = parse(general: "Febrile 38.5. No confusion.")
        XCTAssertFalse(alarmTitles(r).contains("Possible Sepsis"))
    }

    func testConfusionStillCompletesTheSepsisAlarm() {
        let r = parse(general: "Febrile 38.5. Acute confusion.")
        XCTAssertTrue(alarmTitles(r).contains("Possible Sepsis"))
    }

    func testAfebrileIsNotAFeverForTheSepsisAlarm() {
        let r = parse(general: "Afebrile. Tachycardia 110.")
        XCTAssertFalse(alarmTitles(r).contains("Possible Sepsis"))
        XCTAssertFalse(chips(r, "associations").contains("Fever"))
    }

    func testObstructionWithoutPeritonismDoesNotRaiseTheStrangulationAlarm() {
        let r = parse(abdo: "Distended, tympanic. No peritonism, no guarding, no rebound.",
                      notes: "CT abdomen: small bowel obstruction")
        XCTAssertFalse(alarmTitles(r).contains("Bowel Obstruction + Peritonism"))
    }

    func testObstructionWithGuardingStillRaisesTheStrangulationAlarm() {
        let r = parse(abdo: "Distended with guarding.", notes: "CT abdomen: small bowel obstruction")
        XCTAssertTrue(alarmTitles(r).contains("Bowel Obstruction + Peritonism"))
    }

    func testNegatedFreeGasRaisesNoPerforationAlarm() {
        XCTAssertFalse(alarmTitles(parse(notes: "CT abdomen: no free gas")).contains("Pneumoperitoneum — Perforation"))
    }

    func testFreeGasOnOneReportIsNotHiddenByANegativeOnAnother() {
        // The old "no free air" guard suppressed the alarm whenever any report said so.
        let r = parse(notes: "CXR: no free air under the diaphragm. CT abdomen: pneumoperitoneum")
        XCTAssertTrue(alarmTitles(r).contains("Pneumoperitoneum — Perforation"))
    }

    // MARK: - Features

    func testMurphysSignNegativeIsNotAFeature() {
        XCTAssertFalse(chips(parse(abdo: "Soft. Murphy's sign negative."), "exam").contains("Murphy's sign"))
        XCTAssertTrue(chips(parse(abdo: "Tender RUQ, Murphy's sign positive."), "exam").contains("Murphy's sign"))
    }

    func testNotJaundicedIsNotJaundice() {
        let r = parse(general: "Not jaundiced.")
        XCTAssertFalse(chips(r, "associations").contains("Jaundice"))
        XCTAssertFalse(chips(r, "exam").contains("Jaundice"))
        XCTAssertTrue(chips(parse(general: "Jaundiced."), "associations").contains("Jaundice"))
    }

    func testNoGuardingNoReboundAreNotFeatures() {
        let r = parse(abdo: "Soft, no guarding, no rebound.")
        XCTAssertFalse(chips(r, "exam").contains("Guarding"))
        XCTAssertFalse(chips(r, "exam").contains("Rebound"))
    }

    func testANegationInOneFieldDoesNotReachTheNextField() {
        let r = parse(hpi: "No vomiting", abdo: "Guarding in RIF")
        XCTAssertTrue(chips(r, "exam").contains("Guarding"))
        XCTAssertFalse(chips(r, "associations").contains("Vomiting"))
    }

    func testTermsWrittenAsNegativesStillMatch() {
        XCTAssertTrue(chips(parse(abdo: "Distended, no bowel sounds."), "exam").contains("Absent bowel sounds"))
        XCTAssertTrue(chips(parse(hpi: "No appetite for three days."), "associations").contains("Anorexia"))
    }
}
