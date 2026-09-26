// DecisionRuleCalculatorTests.swift
// The decision-rule calculators added with ios-outcomes-calculators (ClinicalScoringEngine+
// DecisionRules*.swift): the shared vectors (Resources/DecisionRuleCalculatorVectors.json, also run by
// the dashboard's decision-rule-vectors.test.ts against the web calculators), published example cases,
// the link to clinical-content/rules/decision-rules.json (the band that feeds the engine), the
// "from record" pre-fill and the relabelled local "Stone CT features" score.

import XCTest
import SwiftData
@testable import AmiseMedFlow

private final class RuleVectorsToken {}

private enum RuleValue: Decodable {
    case flag(Bool)
    case choice(String)

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let b = try? c.decode(Bool.self) { self = .flag(b) } else { self = .choice(try c.decode(String.self)) }
    }
}

private struct RuleVector: Decodable {
    let name: String
    let rule: String
    let ruleId: String
    let values: [String: RuleValue]
    let total: Int
    let band: String
}

private struct RuleVectors: Decodable { let cases: [RuleVector] }

@MainActor
final class DecisionRuleCalculatorTests: XCTestCase {

    typealias E = ClinicalScoringEngine

    private static func loadVectors() throws -> [RuleVector] {
        let bundle = Bundle(for: RuleVectorsToken.self)
        let url = bundle.url(forResource: "DecisionRuleCalculatorVectors", withExtension: "json")
            ?? URL(fileURLWithPath: #filePath).deletingLastPathComponent()
                .appendingPathComponent("Resources").appendingPathComponent("DecisionRuleCalculatorVectors.json")
        return try JSONDecoder().decode(RuleVectors.self, from: Data(contentsOf: url)).cases
    }

    // MARK: - Web form values → the iOS input structs (the same items, named as on the web)

    private func flag(_ v: [String: RuleValue], _ key: String) -> Bool {
        if case .flag(let b)? = v[key] { return b }
        return false
    }

    private func choice(_ v: [String: RuleValue], _ key: String) -> String? {
        if case .choice(let s)? = v[key] { return s }
        return nil
    }

    /// The iOS calculator's result for a vector, or nil for an unknown rule key.
    private func score(_ c: RuleVector) -> ClinicalScore? {
        let v = c.values
        switch c.rule {
        case "ottawaAnkle":
            var i = E.OttawaAnkleInput()
            i.lateralMalleolus = flag(v, "lateral")
            i.medialMalleolus = flag(v, "medial")
            i.fifthMetatarsalBase = flag(v, "fifthMt")
            i.navicular = flag(v, "navicular")
            i.unableToBearWeight = flag(v, "weightBearing")
            return E.ottawaAnkle(i)
        case "ottawaKnee":
            var i = E.OttawaKneeInput()
            i.age55OrOver = flag(v, "age55")
            i.isolatedPatellaTenderness = flag(v, "patella")
            i.fibularHeadTenderness = flag(v, "fibula")
            i.unableToFlex90 = flag(v, "flex90")
            i.unableToBearWeight = flag(v, "weightBearing")
            return E.ottawaKnee(i)
        case "canadianCtHead":
            var i = E.CanadianCTHeadInput()
            i.gcsBelow15At2h = flag(v, "gcs2h")
            i.suspectedOpenOrDepressedFracture = flag(v, "openFracture")
            i.basalSkullFractureSign = flag(v, "basal")
            i.vomitingTwiceOrMore = flag(v, "vomiting2")
            i.age65OrOver = flag(v, "age65")
            i.amnesiaBefore30min = flag(v, "amnesia30")
            i.dangerousMechanism = flag(v, "dangerous")
            return E.canadianCTHead(i)
        case "nexus":
            var i = E.NEXUSInput()
            i.midlineTenderness = flag(v, "midline")
            i.focalNeurologicalDeficit = flag(v, "focal")
            i.alteredAlertness = flag(v, "alertness")
            i.intoxication = flag(v, "intoxication")
            i.distractingInjury = flag(v, "distracting")
            return E.nexus(i)
        case "canadianCSpine":
            var i = E.CanadianCSpineInput()
            i.age65OrOver = flag(v, "age65")
            i.dangerousMechanism = flag(v, "dangerous")
            i.paraesthesiaInExtremities = flag(v, "paraesthesia")
            i.lowRiskFactor = flag(v, "lowRisk")
            i.ableToRotate45 = flag(v, "rotate")
            return E.canadianCSpine(i)
        case "stone":
            var i = E.STONEUretericInput()
            i.male = flag(v, "male")
            i.nonBlack = flag(v, "nonBlack")
            i.haematuria = flag(v, "haematuria")
            i.timing = ["gt24": 0, "6to24": 1, "lt6": 2][choice(v, "timing") ?? "gt24"] ?? 0
            i.nausea = ["none": 0, "nausea": 1, "vomiting": 2][choice(v, "nausea") ?? "none"] ?? 0
            return E.stoneUreteric(i)
        case "sfSyncope":
            var i = E.SanFranciscoSyncopeInput()
            i.congestiveHeartFailure = flag(v, "chf")
            i.haematocritBelow30 = flag(v, "hct")
            i.abnormalECG = flag(v, "ecg")
            i.shortnessOfBreath = flag(v, "sob")
            i.systolicBelow90 = flag(v, "sbp90")
            return E.sanFranciscoSyncope(i)
        case "canadianSyncope":
            var i = E.CanadianSyncopeInput()
            i.vasovagalPredisposition = flag(v, "vasovagalPredisposition")
            i.heartDisease = flag(v, "heartDisease")
            i.abnormalSystolic = flag(v, "sbp")
            i.troponinRaised = flag(v, "troponin")
            i.abnormalQRSAxis = flag(v, "axis")
            i.qrsOver130 = flag(v, "qrs")
            i.qtcOver480 = flag(v, "qtc")
            i.edDiagnosis = ["neither": 0, "vasovagal": 1, "cardiac": 2][choice(v, "edDiagnosis") ?? "neither"] ?? 0
            return E.canadianSyncope(i)
        default:
            return nil
        }
    }

    // MARK: - Shared vectors (same totals and bands as the web)

    func testSharedVectorsGiveTheWebTotalsAndBands() throws {
        let cases = try Self.loadVectors()
        XCTAssertGreaterThan(cases.count, 30)
        for c in cases {
            let s = try XCTUnwrap(score(c), c.name)
            XCTAssertEqual(Int(s.score), c.total, c.name)
            let rule = try XCTUnwrap(ExamEvidenceCatalogue.rule(c.ruleId), "\(c.ruleId) in decision-rules.json")
            XCTAssertEqual(DecisionRuleEvidence.band(of: rule, value: s.score)?.id, c.band, c.name)
        }
    }

    // MARK: - Linked to decision-rules.json (ios.param / ios.activeScore)

    func testEveryNewRuleIsLinkedToItsCalculator() throws {
        let links: [(String, ActiveScore)] = [
            ("stone", .stoneUreteric), ("ottawa-ankle", .ottawaAnkle), ("ottawa-knee", .ottawaKnee),
            ("canadian-ct-head", .canadianCTHead), ("nexus", .nexus), ("canadian-c-spine", .canadianCSpine),
            ("sf-syncope", .sfSyncope), ("canadian-syncope", .canadianSyncope),
        ]
        for (id, score) in links {
            let rule = try XCTUnwrap(ExamEvidenceCatalogue.rule(id), id)
            XCTAssertEqual(rule.ios?.activeScore, String(describing: score), id)
        }
        XCTAssertFalse(ExamEvidenceCatalogue.rules.contains { $0.ios?.activeScore == String(describing: ActiveScore.stone) },
                       "the local Stone CT features score is not mapped to a decision rule")
    }

    func testStoredDiagnosticBandsReachTheEngineAndPrognosticOnesDoNot() {
        let bands = DecisionRuleEvidence.observedBands([
            "stone": 13, "ottawa-ankle": 0, "canadian-ct-head": 2, "nexus": 0, "canadian-c-spine": 0,
            "sf-syncope": 3, "canadian-syncope": 6,
        ])
        XCTAssertTrue(bands.contains("stone:high"))
        XCTAssertTrue(bands.contains("ottawa-ankle:negative"))
        XCTAssertTrue(bands.contains("canadian-ct-head:high"))
        XCTAssertTrue(bands.contains("nexus:negative"))
        XCTAssertTrue(bands.contains("canadian-c-spine:negative"))
        XCTAssertFalse(bands.contains { $0.hasPrefix("sf-syncope") }, "prognostic: display only")
        XCTAssertFalse(bands.contains { $0.hasPrefix("canadian-syncope") }, "prognostic: display only")
    }

    func testTheResultShowsItsDecisionRuleBand() {
        var i = E.OttawaAnkleInput()
        let negative = E.ottawaAnkle(i)
        XCTAssertTrue(negative.recommendations.contains { $0.contains("Decision-rule evidence") && $0.contains("LR") },
                      "the band's likelihood ratio from decision-rules.json is shown")
        i.navicular = true
        XCTAssertEqual(E.ottawaAnkle(i).risk, .moderate)
        let syncope = E.canadianSyncope(E.CanadianSyncopeInput())
        XCTAssertTrue(syncope.recommendations.contains { $0.contains("prognostic") })
    }

    // MARK: - Published examples

    func testSTONEPublishedExamples() {
        // Moore 2014: a non-black man, pain under 6 h, vomiting and haematuria scores the maximum 13.
        var i = E.STONEUretericInput(male: true, timing: 2, nonBlack: true, nausea: 2, haematuria: true)
        XCTAssertEqual(E.stoneUreteric(i).score, 13)
        XCTAssertEqual(E.stoneUreteric(i).risk, .high)
        XCTAssertEqual(E.stoneUreteric(i).maxScore, 13)
        // Boundaries: 5 low, 6 moderate, 9 moderate, 10 high.
        i = E.STONEUretericInput(male: true, timing: 2, nonBlack: false, nausea: 0, haematuria: false)
        XCTAssertEqual(E.stoneUreteric(i).score, 5)
        XCTAssertEqual(E.stoneUreteric(i).risk, .low)
        i.timing = 1; i.nonBlack = true   // 2 + 1 + 3
        XCTAssertEqual(E.stoneUreteric(i).score, 6)
        XCTAssertEqual(E.stoneUreteric(i).risk, .moderate)
        i = E.STONEUretericInput(male: false, timing: 2, nonBlack: true, nausea: 0, haematuria: true)
        XCTAssertEqual(E.stoneUreteric(i).score, 9)
        XCTAssertEqual(E.stoneUreteric(i).risk, .moderate)
        i.nausea = 1
        XCTAssertEqual(E.stoneUreteric(i).score, 10)
        XCTAssertEqual(E.stoneUreteric(i).risk, .high)
    }

    func testCanadianRulesPublishedLogic() {
        // CT head: medium-risk criteria alone → 1; any high-risk → 2 whatever else.
        XCTAssertEqual(E.canadianCTHeadLevel(E.CanadianCTHeadInput(dangerousMechanism: true)), 1)
        XCTAssertEqual(E.canadianCTHeadLevel(E.CanadianCTHeadInput(age65OrOver: true, amnesiaBefore30min: true)), 2)
        XCTAssertEqual(E.canadianCTHeadLevel(E.CanadianCTHeadInput()), 0)
        // C-spine: imaging unless no high-risk factor, a low-risk factor, and active rotation 45 degrees.
        XCTAssertEqual(E.canadianCSpineResult(E.CanadianCSpineInput(lowRiskFactor: true, ableToRotate45: true)), 0)
        XCTAssertEqual(E.canadianCSpineResult(E.CanadianCSpineInput(dangerousMechanism: true, lowRiskFactor: true,
                                                                    ableToRotate45: true)), 1)
        XCTAssertEqual(E.canadianCSpineResult(E.CanadianCSpineInput(lowRiskFactor: false, ableToRotate45: true)), 1)
        // Syncope risk score range: -3 to 11.
        XCTAssertEqual(E.canadianSyncopePoints(E.CanadianSyncopeInput(vasovagalPredisposition: true, edDiagnosis: 1)), -3)
        XCTAssertEqual(E.canadianSyncopePoints(E.CanadianSyncopeInput(
            heartDisease: true, abnormalSystolic: true, troponinRaised: true, abnormalQRSAxis: true,
            qrsOver130: true, qtcOver480: true, edDiagnosis: 2)), 11)
        XCTAssertEqual(E.canadianSyncope(E.CanadianSyncopeInput(troponinRaised: true, qtcOver480: true)).risk, .high)
        XCTAssertEqual(E.sanFranciscoSyncope(E.SanFranciscoSyncopeInput()).risk, .low)
        XCTAssertEqual(E.sanFranciscoSyncope(E.SanFranciscoSyncopeInput(abnormalECG: true)).risk, .high)
    }

    func testEveryNewCalculatorCitesItsSource() {
        let scores: [(ActiveScore, ClinicalScore)] = [
            (.stoneUreteric, E.stoneUreteric(.init())), (.ottawaAnkle, E.ottawaAnkle(.init())),
            (.ottawaKnee, E.ottawaKnee(.init())), (.canadianCTHead, E.canadianCTHead(.init())),
            (.nexus, E.nexus(.init())), (.canadianCSpine, E.canadianCSpine(.init())),
            (.sfSyncope, E.sanFranciscoSyncope(.init())), (.canadianSyncope, E.canadianSyncope(.init())),
        ]
        for (score, s) in scores {
            XCTAssertNotNil(s.evidenceNote?.range(of: #"(19|20)\d\d"#, options: .regularExpression), s.systemName)
            XCTAssertEqual(ActiveScore(storedScoreName: s.systemName), score, "\(s.systemName) resolves to its score")
        }
    }

    // MARK: - The relabelled local score

    func testStoneCTFeaturesIsRelabelledNotChanged() {
        let i = ClinicalScoringEngine.STONEInput(sizeMm: 4, toUreters: 1, obstruction: true, nausea: true, erythrocytes: true)
        let s = ClinicalScoringEngine.stone(i)
        XCTAssertEqual(s.score, 6, "formula unchanged: 2 + 1 + 1 + 1 + 1")
        XCTAssertEqual(s.maxScore, 6)
        XCTAssertEqual(s.systemName, "Stone CT Features Score (not STONE)")
        XCTAssertTrue(s.evidenceNote?.contains("NOT the STONE score") ?? false)
        XCTAssertEqual(ActiveScore(storedScoreName: "STONE Score"), .stone, "entries saved before the relabel")
        XCTAssertEqual(ActiveScore(storedScoreName: s.systemName), .stone)
        XCTAssertEqual(ActiveScore(storedScoreName: "STONE Score (Moore 2014)"), .stoneUreteric)
        XCTAssertNotEqual(ActiveScore.stone.rawValue, ActiveScore.stoneUreteric.rawValue)
    }

    // MARK: - Pre-fill from the record ("from record")

    private func patient() throws -> (Patient, ModelContainer) {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        let container = try ModelContainer(for: schema, configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        let p = Patient(fullName: "Rule Test", sex: .male, setting: .emergency, location: .rodney_bay, acuity: .urgent)
        container.mainContext.insert(p)
        return (p, container)
    }

    func testPrefillTicksOnlyWhatTheRecordShowsAndMarksIt() throws {
        let (p, container) = try patient()
        _ = container
        p.dateOfBirth = Calendar.current.date(byAdding: .year, value: -70, to: .now)
        p.hpi = "Fell down the stairs. Vomited twice since. No tingling. Unable to bear weight on the right ankle."
        p.examMSK = "Tender over the lateral malleolus. No midline cervical tenderness."

        let (ankle, ankleFill) = PatientScoreAutoPopulator.ottawaAnkle(patient: p)
        XCTAssertTrue(ankle.lateralMalleolus)
        XCTAssertTrue(ankle.unableToBearWeight)
        XCTAssertFalse(ankle.medialMalleolus, "not recorded: not ticked")
        XCTAssertTrue(ankleFill.isAuto("lateralMalleolus"))
        XCTAssertFalse(ankleFill.isAuto("medialMalleolus"))

        let (head, headFill) = PatientScoreAutoPopulator.canadianCTHead(patient: p)
        XCTAssertTrue(head.age65OrOver)
        XCTAssertTrue(head.vomitingTwiceOrMore)
        XCTAssertTrue(headFill.isAuto("age65OrOver"))

        let (neck, _) = PatientScoreAutoPopulator.nexus(patient: p)
        XCTAssertFalse(neck.midlineTenderness, "a documented negative does not tick the item")
        let (cspine, _) = PatientScoreAutoPopulator.canadianCSpine(patient: p)
        XCTAssertFalse(cspine.paraesthesiaInExtremities, "'No tingling' is negated")
        XCTAssertTrue(cspine.age65OrOver)

        let (stone, stoneFill) = PatientScoreAutoPopulator.stoneUreteric(patient: p)
        XCTAssertTrue(stone.male)
        XCTAssertEqual(stone.nausea, 2)
        XCTAssertFalse(stone.nonBlack, "origin is never pre-filled")
        XCTAssertTrue(stoneFill.isAuto("male"))
    }

    func testAnEmptyRecordPrefillsNothing() throws {
        let (p, container) = try patient()
        _ = container
        p.sex = .female
        XCTAssertEqual(PatientScoreAutoPopulator.ottawaAnkle(patient: p).0, E.OttawaAnkleInput())
        XCTAssertEqual(PatientScoreAutoPopulator.ottawaKnee(patient: p).0, E.OttawaKneeInput(), "no date of birth: no age item")
        XCTAssertEqual(PatientScoreAutoPopulator.canadianCTHead(patient: p).0, E.CanadianCTHeadInput())
        XCTAssertEqual(PatientScoreAutoPopulator.nexus(patient: p).0, E.NEXUSInput())
        XCTAssertEqual(PatientScoreAutoPopulator.canadianCSpine(patient: p).0, E.CanadianCSpineInput())
        XCTAssertEqual(PatientScoreAutoPopulator.stoneUreteric(patient: p).0, E.STONEUretericInput())
        XCTAssertEqual(PatientScoreAutoPopulator.sfSyncope(patient: p).0, E.SanFranciscoSyncopeInput())
        XCTAssertEqual(PatientScoreAutoPopulator.canadianSyncope(patient: p).0, E.CanadianSyncopeInput())
    }

    // MARK: - Saved results are where the engine reads them

    func testSavingStoresTheValueOnThePatient() throws {
        let (p, container) = try patient()
        _ = container
        ScorePersistence.store(.stoneUreteric, E.stoneUreteric(E.STONEUretericInput(male: true, timing: 2, nonBlack: true,
                                                                                    nausea: 2, haematuria: true)), on: p)
        ScorePersistence.store(.canadianSyncope, E.canadianSyncope(E.CanadianSyncopeInput(vasovagalPredisposition: true,
                                                                                          edDiagnosis: 1)), on: p)
        ScorePersistence.store(.canadianCTHead, E.canadianCTHead(E.CanadianCTHeadInput(amnesiaBefore30min: true)), on: p)
        XCTAssertEqual(p.stoneUretericScore, 13)
        XCTAssertEqual(p.canadianSyncopeScore, -3)
        XCTAssertEqual(p.canadianCTHeadScore, 1)
        XCTAssertNil(p.stoneScore, "the local Stone CT features field is separate")
    }
}
