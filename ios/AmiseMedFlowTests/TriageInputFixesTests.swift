import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Text-reading fixes behind the triage level (clinical validation 2026-09):
/// - ClinicalTextParser: "rest" no longer matches inside "arrest"; a recorded temperature is a
///   fever only at ≥38.0 °C;
/// - ClinicalPathwayEngine: a past perforation/peritonitis in the PMH no longer makes the current
///   visit an emergency;
/// - PatientScoreAutoPopulator: keyword criteria go through NegationMatcher ("no rebound");
/// - PregnancyContext: pregnancy read from the record text, negation-aware.
@MainActor
final class TriageInputFixesTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema, configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
    }

    private func parse(hpi: String? = nil, general: String? = nil) -> ClinicalTextParser.ParseResult {
        ClinicalTextParser.parse(hpi: hpi, examGeneral: general, examAbdo: nil, examOther: nil, notes: nil)
    }

    // MARK: - ClinicalTextParser

    func testRestDoesNotMatchInsideArrest() {
        XCTAssertFalse(parse(hpi: "Previous cardiac arrest in 2019.").featureAugments["relieving"]?.contains("Rest") ?? false)
        XCTAssertTrue(parse(hpi: "Pain eases with rest.").featureAugments["relieving"]?.contains("Rest") ?? false)
    }

    func testANormalRecordedTemperatureIsNotAFever() {
        let normal = parse(general: "Temperature 36.9°C, pulse 106, BP 96/58.")
        XCTAssertFalse(normal.featureAugments["associations"]?.contains("Fever") ?? false)
        let febrile = parse(general: "Temperature 38.6°C, pulse 112.")
        XCTAssertTrue(febrile.featureAugments["associations"]?.contains("Fever") ?? false)
        XCTAssertTrue(parse(hpi: "High temperature at home.").featureAugments["associations"]?.contains("Fever") ?? false)
    }

    func testRecordedTemperaturesAreReadInCelsiusOnly() {
        XCTAssertEqual(ClinicalTextParser.recordedTemperatures("t 38.2, temp: 39"), [38.2, 39])
        XCTAssertTrue(ClinicalTextParser.recordedTemperatures("hip flexion 45 degrees").isEmpty)
        XCTAssertTrue(ClinicalTextParser.recordedTemperatures("t12 vertebra").isEmpty)
    }

    func testSepsisAlarmNeedsAFeverNotTheWordTemperature() {
        XCTAssertFalse(parse(general: "Temperature 36.8. Tachycardia 118, confusion.").clinicalAlarms.contains { $0.title == "Possible Sepsis" })
        XCTAssertTrue(parse(general: "Temperature 38.9. Tachycardia 118.").clinicalAlarms.contains { $0.title == "Possible Sepsis" })
    }

    // MARK: - ClinicalPathwayEngine

    func testPastPerforationInThePMHIsNotACurrentEmergency() {
        let r = ClinicalPathwayEngine.assess(chiefComplaint: "Indigestion", pmh: "Perforated duodenal ulcer 2015, peritonitis")
        XCTAssertNotEqual(r.suggestedAcuity, .emergency)
        XCTAssertTrue(r.redFlags.isEmpty, "\(r.redFlags)")
        XCTAssertEqual(ClinicalPathwayEngine.assess(chiefComplaint: "Bowel ischaemia").suggestedAcuity, .emergency)
    }

    // MARK: - Score auto-fill negation

    func testNoReboundDoesNotTickThePASCoughPercussionCriterion() {
        let p = Patient(fullName: "Neg Test")
        context.insert(p)
        p.hpi = "RIF pain since yesterday. No vomiting. No rebound."
        let (input, _) = PatientScoreAutoPopulator.pas(patient: p)
        XCTAssertFalse(input.coughPercussionHop)
        XCTAssertFalse(input.nausea)

        p.hpi = "RIF pain with rebound tenderness and vomiting."
        let (positive, _) = PatientScoreAutoPopulator.pas(patient: p)
        XCTAssertTrue(positive.coughPercussionHop)
        XCTAssertTrue(positive.nausea)
    }

    func testScoreTextKeepsSubstringSemanticsButDropsNegatives() {
        let t = ScoreText(["Pain migrated to the RIF", "Denies haemoptysis"])
        XCTAssertTrue(t.contains("migrat"))
        XCTAssertFalse(t.contains("haemoptysis"))
    }

    // MARK: - PregnancyContext

    func testPregnancyIsReadFromTheRecordText() {
        let p = PregnancyContext.detect(texts: ["Right-sided abdominal pain, 32 weeks pregnant"], sex: .female, ageYears: 29)
        XCTAssertTrue(p.isPregnant)
        XCTAssertEqual(p.gestationWeeks, 32)
        XCTAssertTrue(p.atOrBeyond20Weeks)
        let g = PregnancyContext.detect(texts: ["G2P1 at 22 weeks"], sex: .female, ageYears: 30)
        XCTAssertTrue(g.isPregnant)
        XCTAssertEqual(g.gestationWeeks, 22)
    }

    func testNegatedOrPastPregnancyIsNotPregnancy() {
        XCTAssertFalse(PregnancyContext.detect(texts: ["Not pregnant. Urine hCG negative."], sex: .female, ageYears: 30).isPregnant)
        XCTAssertFalse(PregnancyContext.detect(texts: ["Gestational diabetes in her last pregnancy"], sex: .female, ageYears: 38).isPregnant)
        XCTAssertFalse(PregnancyContext.detect(texts: ["32 weeks pregnant"], sex: .male, ageYears: 30).isPregnant)
    }
}
