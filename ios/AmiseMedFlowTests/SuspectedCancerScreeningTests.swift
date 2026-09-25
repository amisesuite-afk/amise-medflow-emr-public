import XCTest
@testable import AmiseMedFlow

/// NICE NG12 suspected-cancer rules (cancer-screening 1.1.0).
///
/// DRIFT NOTE — these vectors mirror the web tests in
/// artifacts/api-server/src/test/cancer-screening-ng12.test.ts (engine twin:
/// lib/triage-engine/src/cancer-screening.ts ↔ ios/AmiseMedFlow/Services/SuspectedCancerScreening.swift;
/// prompt twin: artifacts/dashboard/src/lib/preventive-screening-prompts.ts ↔
/// SuspectedCancerScreening+Prompt.swift). Change the rules and both test files together.
final class SuspectedCancerScreeningTests: XCTestCase {

    private func input(age: Int = 45, sex: Sex = .male, symptoms: [String] = [], freeText: String = "",
                       labs: CancerScreenLabs = CancerScreenLabs()) -> CancerScreenInput {
        CancerScreenInput(age: age, sex: sex, symptoms: symptoms, freeText: freeText, labs: labs)
    }

    private func metIds(_ r: CancerScreenResult) -> [String] { r.metCriteria.map { $0.id ?? $0.rule } }

    func testVersionMatchesTheWebRuleSet() {
        XCTAssertEqual(SuspectedCancerScreening.rulesVersion, "1.1.0")
    }

    // MARK: readCancerScreenLabs

    func testReadsLabsByWholeWordName() {
        let labs = SuspectedCancerScreening.readLabs([
            (name: "Haemoglobin", result: "9.4 g/dL"), (name: "Ferritin", result: "5 µg/L"), (name: "MCV", result: "71 fL"),
            (name: "FIT (faecal immunochemical test)", result: "42 µg Hb/g faeces"),
            (name: "HbA1c", result: "58 mmol/mol"), (name: "Benefit review", result: "12"),
        ])
        XCTAssertEqual(labs, CancerScreenLabs(haemoglobinGdl: 9.4, ferritinUgL: 5, mcvFl: 71, fitUgHbG: 42))
    }

    func testConvertsHbInGramsPerLitreAndIgnoresHbA1c() {
        XCTAssertEqual(SuspectedCancerScreening.readLabs([(name: "Hb", result: "94 g/L")]).haemoglobinGdl ?? 0, 9.4, accuracy: 0.001)
        XCTAssertNil(SuspectedCancerScreening.readLabs([(name: "HbA1c", result: "8.4 %")]).haemoglobinGdl)
    }

    func testReadsFITAsTextAndBelowThreshold() {
        XCTAssertEqual(SuspectedCancerScreening.readLabs([(name: "FIT", result: "Positive")]).fitPositive, true)
        XCTAssertEqual(SuspectedCancerScreening.readLabs([(name: "FIT", result: "Negative")]).fitPositive, false)
        XCTAssertFalse(SuspectedCancerScreening.isFitPositive(SuspectedCancerScreening.readLabs([(name: "qFIT", result: "< 10 µg/g")])))
        XCTAssertTrue(SuspectedCancerScreening.isFitPositive(SuspectedCancerScreening.readLabs([(name: "qFIT", result: "10 µg/g")])))
    }

    func testLatestResultWinsFromThePatientRecord() {
        let p = Patient(fullName: "Lab Order")
        var old = InvestigationEntry(name: "Haemoglobin", category: .blood, status: .resulted, result: "13.5 g/dL")
        old.resultedAt = Date(timeIntervalSinceNow: -86_400 * 30)
        var new = InvestigationEntry(name: "Haemoglobin", category: .blood, status: .resulted, result: "9.1 g/dL")
        new.resultedAt = Date(timeIntervalSinceNow: -3_600)
        p.investigations = [old, new]
        XCTAssertEqual(SuspectedCancerScreening.readLabs(patient: p).haemoglobinGdl, 9.1)
    }

    // MARK: IDA thresholds (BSG 2021)

    func testAnaemiaThresholds() {
        XCTAssertTrue(SuspectedCancerScreening.isAnaemic(12.9, sex: .male))
        XCTAssertFalse(SuspectedCancerScreening.isAnaemic(12.9, sex: .female))
    }

    func testIDANeedsAnaemiaAndFerritinBelow45() {
        XCTAssertTrue(SuspectedCancerScreening.hasLabIronDeficiencyAnaemia(CancerScreenLabs(haemoglobinGdl: 11, ferritinUgL: 44), sex: .female))
        XCTAssertFalse(SuspectedCancerScreening.hasLabIronDeficiencyAnaemia(CancerScreenLabs(haemoglobinGdl: 11, ferritinUgL: 60), sex: .female))
        XCTAssertFalse(SuspectedCancerScreening.hasLabIronDeficiencyAnaemia(CancerScreenLabs(haemoglobinGdl: 11), sex: .female))
    }

    // MARK: NG12 rules added in 1.1.0

    func testRectalBleedingAtFiftyOrOver() {
        let r = SuspectedCancerScreening.screen(input(age: 52, symptoms: ["rectal bleeding"]))
        XCTAssertTrue(metIds(r).contains("ng12-rectal-bleeding-50"))
        XCTAssertEqual(r.referralUrgency, .twoWeekWait)
        XCTAssertEqual(r.cancerType, "colorectal")
        XCTAssertFalse(metIds(SuspectedCancerScreening.screen(input(age: 42, symptoms: ["rectal bleeding"]))).contains("ng12-rectal-bleeding-50"))
    }

    func testRectalBleedingFromFreeTextIsNegationAware() {
        XCTAssertTrue(metIds(SuspectedCancerScreening.screen(input(age: 60, freeText: "Two months of blood mixed with the stool.")))
            .contains("ng12-rectal-bleeding-50"))
        XCTAssertFalse(metIds(SuspectedCancerScreening.screen(input(age: 60, freeText: "No rectal bleeding, no weight loss.")))
            .contains("ng12-rectal-bleeding-50"))
    }

    func testWeightLossAndAbdominalPainAtFortyOrOver() {
        let r = SuspectedCancerScreening.screen(input(age: 44, symptoms: ["abdominal pain", "weight loss"]))
        XCTAssertTrue(metIds(r).contains("ng12-weight-loss-abdominal-pain-40"))
    }

    func testFITTenOrMoreAtAnyAge() {
        let pos = SuspectedCancerScreening.screen(input(age: 38, labs: CancerScreenLabs(fitUgHbG: 42)))
        XCTAssertTrue(metIds(pos).contains("fit-10"))
        XCTAssertTrue(pos.recommendedInvestigation.contains("Colonoscopy"))
        XCTAssertFalse(metIds(SuspectedCancerScreening.screen(input(age: 38, labs: CancerScreenLabs(fitUgHbG: 8)))).contains("fit-10"))
    }

    func testIDAAtSixtyOrOverIsTwoWeekWaitWithBidirectionalEndoscopy() {
        let r = SuspectedCancerScreening.screen(input(age: 72, labs: CancerScreenLabs(haemoglobinGdl: 9.1, ferritinUgL: 6)))
        XCTAssertTrue(metIds(r).contains("ng12-ida-60"))
        XCTAssertEqual(r.referralUrgency, .twoWeekWait)
        for inv in ["Colonoscopy", "OGD (bidirectional endoscopy with colonoscopy)", "Coeliac serology (tTG-IgA)", "Urinalysis"] {
            XCTAssertTrue(r.recommendedInvestigation.contains(inv), inv)
        }
    }

    func testIDAUnderSixtyIsUrgentForMenAndNothingForYoungerWomen() {
        let man = SuspectedCancerScreening.screen(input(age: 45, labs: CancerScreenLabs(haemoglobinGdl: 11, ferritinUgL: 8)))
        XCTAssertTrue(metIds(man).contains("bsg-ida"))
        XCTAssertEqual(man.referralUrgency, .urgent)
        let woman = SuspectedCancerScreening.screen(input(age: 35, sex: .female, labs: CancerScreenLabs(haemoglobinGdl: 10, ferritinUgL: 8)))
        XCTAssertFalse(woman.triggered)
    }

    func testNippleChangeAtFiftyOrOver() {
        let r = SuspectedCancerScreening.screen(input(age: 52, sex: .female, symptoms: ["nipple discharge"],
                                                      freeText: "Blood-stained discharge from the left nipple."))
        let c = r.criteria.first { $0.id == "ng12-nipple-50" }
        XCTAssertEqual(c?.met, true)
        for inv in ["Mammogram", "Breast ultrasound", "Microdochectomy / duct excision if imaging is normal"] {
            XCTAssertTrue(c?.investigations.contains(inv) ?? false, inv)
        }
        XCTAssertEqual(r.cancerType, "breast")
        XCTAssertFalse(metIds(SuspectedCancerScreening.screen(input(age: 52, sex: .female, freeText: "Bilateral milky nipple discharge.")))
            .contains("ng12-nipple-50"))
        XCTAssertFalse(metIds(SuspectedCancerScreening.screen(input(age: 45, sex: .female, symptoms: ["nipple discharge"])))
            .contains("ng12-nipple-50"))
    }

    func testVisibleHaematuriaAtFortyFiveOrOver() {
        let r = SuspectedCancerScreening.screen(input(age: 66, symptoms: ["haematuria"]))
        XCTAssertTrue(metIds(r).contains("ng12-haematuria-45"))
        XCTAssertEqual(r.cancerType, "urological")
        XCTAssertTrue(r.recommendedInvestigation.contains("Cystoscopy"))
        XCTAssertTrue(r.recommendedInvestigation.contains("CT urogram"))
        XCTAssertFalse(metIds(SuspectedCancerScreening.screen(input(age: 66, symptoms: ["haematuria", "loin pain"]))).contains("ng12-haematuria-45"))
        XCTAssertFalse(metIds(SuspectedCancerScreening.screen(input(age: 66, freeText: "Microscopic haematuria on dipstick.")))
            .contains("ng12-haematuria-45"))
        XCTAssertFalse(metIds(SuspectedCancerScreening.screen(input(age: 40, symptoms: ["haematuria"]))).contains("ng12-haematuria-45"))
    }

    // MARK: Negation-aware chip matching (existing rules)

    func testNegatedChipDoesNotCount() {
        XCTAssertFalse(SuspectedCancerScreening.screen(input(age: 60, symptoms: ["no dysphagia"])).triggered)
    }

    func testNegationDoesNotReachTheNextChip() {
        let r = SuspectedCancerScreening.screen(input(age: 60, symptoms: ["no appetite change", "dysphagia"]))
        XCTAssertEqual(r.cancerType, "oesophago-gastric")
    }

    // MARK: Consultation prompt (twin of suspectedCancerPrompts)

    func testPromptListsTheCriteriaAndInvestigations() {
        let p = SuspectedCancerScreening.prompt(input: input(age: 72, labs: CancerScreenLabs(haemoglobinGdl: 9.1, ferritinUgL: 6)),
                                                emergency: false, record: [])
        XCTAssertEqual(p?.kind, .suspectedCancer)
        XCTAssertEqual(p?.twoWeekWait, true)
        XCTAssertTrue(p?.finding.contains("Hb 9.1 g/dL") ?? false)
        XCTAssertTrue(p?.investigations.contains("Colonoscopy") ?? false)
        XCTAssertTrue(p?.planLines.contains { $0.hasPrefix("• Iron replacement") } ?? false)
    }

    func testPromptSuppressedForAKnownCancerButNotASuspectedOne() {
        let i = input(age: 66, labs: CancerScreenLabs(fitUgHbG: 120))
        XCTAssertNil(SuspectedCancerScreening.prompt(input: i, emergency: false, record: ["Obstructing sigmoid cancer"]))
        XCTAssertNotNil(SuspectedCancerScreening.prompt(input: i, emergency: false, record: ["Suspected colorectal cancer"]))
    }

    func testEmergencyPromptOffersNoInvestigations() {
        let p = SuspectedCancerScreening.prompt(input: input(age: 66, labs: CancerScreenLabs(fitUgHbG: 120)), emergency: true, record: [])
        XCTAssertEqual(p?.investigations, [])
        XCTAssertTrue(p?.planLines.first?.contains("Arrange once the acute episode is managed") ?? false)
    }

    func testMicrocyticAnaemiaWithoutFerritinAsksForFerritin() {
        let p = SuspectedCancerScreening.prompt(input: input(age: 40, labs: CancerScreenLabs(haemoglobinGdl: 11, mcvFl: 72)),
                                                emergency: false, record: [])
        XCTAssertEqual(p?.kind, .ferritinCheck)
        XCTAssertEqual(p?.investigations, ["Ferritin"])
    }

    func testOlderChipRulesDoNotRaiseThePrompt() {
        // Dysphagia (NG12 1.6.2) reaches the clinician through the triage level, as on the web.
        XCTAssertNil(SuspectedCancerScreening.prompt(input: input(age: 60, symptoms: ["dysphagia"]), emergency: false, record: []))
    }
}
