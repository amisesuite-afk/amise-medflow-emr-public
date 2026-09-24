import XCTest
@testable import AmiseMedFlow

/// Risk-band boundaries and published reference weights for the scores most used in acute surgical
/// decisions. Complements ClinicalScoringEngineTests (which covers zero / maximum cases).
final class ScoringEngineReferenceTests: XCTestCase {

    // MARK: - Alvarado (Alvarado 1986: ≤4 unlikely, 5–6 possible, ≥7 probable)

    func testAlvaradoWeights() {
        var tender = AlvaradoInput(); tender.tendernessRIF = true
        XCTAssertEqual(ClinicalScoringEngine.alvarado(tender).score, 2)
        var wbc = AlvaradoInput(); wbc.wbcElevated = true
        XCTAssertEqual(ClinicalScoringEngine.alvarado(wbc).score, 2)
        var rebound = AlvaradoInput(); rebound.reboundTenderness = true
        XCTAssertEqual(ClinicalScoringEngine.alvarado(rebound).score, 1)
    }

    func testAlvaradoBandBoundaries() {
        // 4: tenderness (2) + WBC (2)
        var i = AlvaradoInput()
        i.tendernessRIF = true; i.wbcElevated = true
        XCTAssertEqual(ClinicalScoringEngine.alvarado(i).score, 4)
        XCTAssertEqual(ClinicalScoringEngine.alvarado(i).risk, .low)
        // 5: + anorexia
        i.anorexia = true
        XCTAssertEqual(ClinicalScoringEngine.alvarado(i).score, 5)
        XCTAssertEqual(ClinicalScoringEngine.alvarado(i).risk, .moderate)
        // 6: + nausea
        i.nauseaVomiting = true
        XCTAssertEqual(ClinicalScoringEngine.alvarado(i).score, 6)
        XCTAssertEqual(ClinicalScoringEngine.alvarado(i).risk, .moderate)
        // 7: + fever
        i.elevatedTemperature = true
        XCTAssertEqual(ClinicalScoringEngine.alvarado(i).score, 7)
        XCTAssertEqual(ClinicalScoringEngine.alvarado(i).risk, .high)
    }

    // MARK: - qSOFA (Sepsis-3)

    func testQSOFAOnePointIsModerate() {
        var i = QSOFAInput()
        i.alteredMentation = true
        i.suspectedInfection = true
        let r = ClinicalScoringEngine.qsofa(i)
        XCTAssertEqual(r.score, 1)
        XCTAssertEqual(r.risk, .moderate)
        XCTAssertTrue(r.redFlags.isEmpty)
    }

    func testQSOFATwoWithInfectionIsHighWithRedFlag() {
        var i = QSOFAInput()
        i.alteredMentation = true
        i.sbpUnder100 = true
        i.suspectedInfection = true
        let r = ClinicalScoringEngine.qsofa(i)
        XCTAssertEqual(r.score, 2)
        XCTAssertEqual(r.risk, .high)
        XCTAssertFalse(r.redFlags.isEmpty)
    }

    func testQSOFASuspectedInfectionIsNotAScoringCriterion() {
        var i = QSOFAInput()
        i.suspectedInfection = true
        XCTAssertEqual(ClinicalScoringEngine.qsofa(i).score, 0)
        XCTAssertEqual(ClinicalScoringEngine.qsofa(i).items.count, 3)
    }

    // MARK: - Wells DVT (≤0 low, 1–2 moderate, ≥3 high)

    func testWellsDVTBandBoundaries() {
        var i = WellsDVTInput()
        XCTAssertEqual(ClinicalScoringEngine.wellsDVT(i).risk, .low)
        i.activeCancer = true                           // 1
        XCTAssertEqual(ClinicalScoringEngine.wellsDVT(i).score, 1)
        XCTAssertEqual(ClinicalScoringEngine.wellsDVT(i).risk, .moderate)
        i.pittingOedema = true                          // 2
        XCTAssertEqual(ClinicalScoringEngine.wellsDVT(i).risk, .moderate)
        i.entireLegSwollen = true                       // 3
        XCTAssertEqual(ClinicalScoringEngine.wellsDVT(i).score, 3)
        XCTAssertEqual(ClinicalScoringEngine.wellsDVT(i).risk, .high)
    }

    func testWellsDVTAlternativeDiagnosisSubtractsTwo() {
        var i = WellsDVTInput()
        i.alternativeDiagnosisAsLikely = true
        XCTAssertEqual(ClinicalScoringEngine.wellsDVT(i).score, -2)
        XCTAssertEqual(ClinicalScoringEngine.wellsDVT(i).risk, .low)
    }

    // MARK: - Wells PE (NICE two-tier: ≤4 PE unlikely, >4 PE likely)

    func testWellsPETwoTierBoundary() {
        var i = WellsPEInput()
        i.clinicalSignsDVT = true   // 3
        i.haemoptysis = true        // 1 → 4
        XCTAssertEqual(ClinicalScoringEngine.wellsPE(i).score, 4)
        XCTAssertEqual(ClinicalScoringEngine.wellsPE(i).risk, .moderate)
        XCTAssertTrue(ClinicalScoringEngine.wellsPE(i).redFlags.isEmpty)

        var j = WellsPEInput()
        j.clinicalSignsDVT = true   // 3
        j.hrOver100 = true          // 1.5 → 4.5
        XCTAssertEqual(ClinicalScoringEngine.wellsPE(j).score, 4.5, accuracy: 0.001)
        XCTAssertEqual(ClinicalScoringEngine.wellsPE(j).risk, .high)
        XCTAssertFalse(ClinicalScoringEngine.wellsPE(j).redFlags.isEmpty)
    }

    func testWellsPESingleOnePointItemIsLow() {
        var i = WellsPEInput()
        i.malignancyActive = true
        XCTAssertEqual(ClinicalScoringEngine.wellsPE(i).score, 1)
        XCTAssertEqual(ClinicalScoringEngine.wellsPE(i).risk, .low)
    }

    // MARK: - Rockall (<2 low, 2–4 moderate, 5–7 high, ≥8 critical)

    func testRockallComponentWeights() {
        var i = RockallInput()
        i.ageGroup = .sixtyTo79
        XCTAssertEqual(ClinicalScoringEngine.rockall(i).score, 1)
        XCTAssertEqual(ClinicalScoringEngine.rockall(i).risk, .low)
        i.shock = .pulse100SBPOver100
        XCTAssertEqual(ClinicalScoringEngine.rockall(i).score, 2)
        XCTAssertEqual(ClinicalScoringEngine.rockall(i).risk, .moderate)
        i.comorbidity = .anyMajor                      // +2 → 4
        XCTAssertEqual(ClinicalScoringEngine.rockall(i).score, 4)
        XCTAssertEqual(ClinicalScoringEngine.rockall(i).risk, .moderate)
        i.diagnosis = .allOtherDiagnoses               // +1 → 5
        XCTAssertEqual(ClinicalScoringEngine.rockall(i).score, 5)
        XCTAssertEqual(ClinicalScoringEngine.rockall(i).risk, .high)
        i.majorStigmata = true                         // +2 → 7
        XCTAssertEqual(ClinicalScoringEngine.rockall(i).score, 7)
        XCTAssertEqual(ClinicalScoringEngine.rockall(i).risk, .high)
        i.ageGroup = .over80                           // +1 → 8
        XCTAssertEqual(ClinicalScoringEngine.rockall(i).score, 8)
        XCTAssertEqual(ClinicalScoringEngine.rockall(i).risk, .critical)
        XCTAssertFalse(ClinicalScoringEngine.rockall(i).redFlags.isEmpty)
    }

    // MARK: - Glasgow-Blatchford (Blatchford 2000)

    func testBlatchfordZeroIsLowRisk() {
        let r = ClinicalScoringEngine.blatchford(BlatchfordInput())
        XCTAssertEqual(r.score, 0)
        XCTAssertEqual(r.risk, .low)
        XCTAssertTrue(r.redFlags.isEmpty)
    }

    func testBlatchfordHaemoglobinWeightsDifferBySex() {
        var i = BlatchfordInput()
        i.haemoglobin = .male12to12_9
        XCTAssertEqual(ClinicalScoringEngine.blatchford(i).score, 1)
        i.haemoglobin = .male10to11_9
        XCTAssertEqual(ClinicalScoringEngine.blatchford(i).score, 3)
        i.haemoglobin = .maleSub10
        XCTAssertEqual(ClinicalScoringEngine.blatchford(i).score, 6)
        i.haemoglobin = .female12plus
        XCTAssertEqual(ClinicalScoringEngine.blatchford(i).score, 0)
        i.haemoglobin = .female10to11_9
        XCTAssertEqual(ClinicalScoringEngine.blatchford(i).score, 1)
        i.haemoglobin = .femaleSub10
        XCTAssertEqual(ClinicalScoringEngine.blatchford(i).score, 6)
    }

    func testBlatchfordUreaAndBPWeights() {
        var i = BlatchfordInput()
        i.bloodUreaNitrogen = .bun6_5to7_9
        XCTAssertEqual(ClinicalScoringEngine.blatchford(i).score, 2)
        i.bloodUreaNitrogen = .bunOver25
        XCTAssertEqual(ClinicalScoringEngine.blatchford(i).score, 6)
        i.bloodUreaNitrogen = .under6_5
        i.sbp = .sbp100to109
        XCTAssertEqual(ClinicalScoringEngine.blatchford(i).score, 1)
        i.sbp = .under90
        XCTAssertEqual(ClinicalScoringEngine.blatchford(i).score, 3)
    }

    func testBlatchfordRedFlagFromSix() {
        var five = BlatchfordInput()
        five.syncope = true          // 2
        five.hepaticDisease = true   // 2
        five.melaena = true          // 1
        let r5 = ClinicalScoringEngine.blatchford(five)
        XCTAssertEqual(r5.score, 5)
        XCTAssertEqual(r5.risk, .moderate)
        XCTAssertTrue(r5.redFlags.isEmpty)

        var six = five
        six.heartRateOver100 = true  // 1 → 6
        let r6 = ClinicalScoringEngine.blatchford(six)
        XCTAssertEqual(r6.score, 6)
        XCTAssertEqual(r6.risk, .high)
        XCTAssertFalse(r6.redFlags.isEmpty)
    }

    func testBlatchfordMaximumIsTwentyThree() {
        var i = BlatchfordInput()
        i.bloodUreaNitrogen = .bunOver25   // 6
        i.haemoglobin = .maleSub10         // 6
        i.sbp = .under90                   // 3
        i.heartRateOver100 = true          // 1
        i.melaena = true                   // 1
        i.syncope = true                   // 2
        i.hepaticDisease = true            // 2
        i.cardiacFailure = true            // 2
        let r = ClinicalScoringEngine.blatchford(i)
        XCTAssertEqual(r.score, 23)
        XCTAssertEqual(r.score, r.maxScore)
        XCTAssertEqual(r.risk, .high)
    }

    // MARK: - Glasgow-Imrie (modified Glasgow, Blamey 1984: 8 PANCREAS criteria, ≥3 = severe)

    func testGlasgowImrieBelowThreshold() {
        var i = ClinicalScoringEngine.GlasgowImrieInput()
        XCTAssertEqual(ClinicalScoringEngine.glasgowImrie(i).score, 0)
        i.ageAbove55 = true
        i.wbcAbove15 = true
        let r = ClinicalScoringEngine.glasgowImrie(i)
        XCTAssertEqual(r.score, 2)
        XCTAssertEqual(r.risk, .low)
        XCTAssertTrue(r.redFlags.isEmpty)
    }

    func testGlasgowImrieThreeIsSevereHigh() {
        var i = ClinicalScoringEngine.GlasgowImrieInput()
        i.ageAbove55 = true
        i.wbcAbove15 = true
        i.calciumBelow2 = true
        let r = ClinicalScoringEngine.glasgowImrie(i)
        XCTAssertEqual(r.score, 3)
        XCTAssertEqual(r.risk, .high, "≥3 = severe")
        XCTAssertFalse(r.redFlags.isEmpty)
        XCTAssertTrue(r.interpretation.contains("Severe"))
        i.glucoseAbove10 = true
        XCTAssertEqual(ClinicalScoringEngine.glasgowImrie(i).score, 4)
        XCTAssertEqual(ClinicalScoringEngine.glasgowImrie(i).risk, .high)
    }

    func testGlasgowImrieUreaIsACriterion() {
        var i = ClinicalScoringEngine.GlasgowImrieInput()
        i.ureaAbove16 = true
        XCTAssertEqual(ClinicalScoringEngine.glasgowImrie(i).score, 1)
        XCTAssertTrue(ClinicalScoringEngine.glasgowImrie(i).items.contains { $0.label.contains("urea") && $0.present })
    }

    func testGlasgowImrieLDHAndASTAreOneCriterion() {
        var i = ClinicalScoringEngine.GlasgowImrieInput()
        i.ldh180 = true
        XCTAssertEqual(ClinicalScoringEngine.glasgowImrie(i).score, 1, "LDH > 600")
        i.ldh180 = false
        i.ast100 = true
        XCTAssertEqual(ClinicalScoringEngine.glasgowImrie(i).score, 1, "AST > 200")
        i.ldh180 = true
        XCTAssertEqual(ClinicalScoringEngine.glasgowImrie(i).score, 1, "both together still score 1")
    }

    func testGlasgowImrieMaximumIsEightCriteria() {
        var i = ClinicalScoringEngine.GlasgowImrieInput()
        i.pao2Below59 = true; i.ageAbove55 = true; i.wbcAbove15 = true; i.calciumBelow2 = true
        i.ureaAbove16 = true; i.albuminBelow32 = true; i.ldh180 = true; i.ast100 = true
        i.glucoseAbove10 = true
        let r = ClinicalScoringEngine.glasgowImrie(i)
        XCTAssertEqual(r.score, 8)
        XCTAssertEqual(r.maxScore, 8)
        XCTAssertEqual(r.items.count, 8)
        XCTAssertEqual(r.risk, .critical)
    }

    /// The two Glasgow implementations give the same score and band for the same findings.
    func testGlasgowImplementationsAgree() {
        typealias Findings = (pao2: Bool, age: Bool, wcc: Bool, ca: Bool, urea: Bool, enzyme: Bool,
                              alb: Bool, glu: Bool)
        let cases: [Findings] = [
            (false, false, false, false, false, false, false, false),
            (true, true, false, false, false, false, false, false),
            (true, true, true, false, false, false, false, false),
            (false, false, false, true, true, true, true, false),
            (true, true, true, true, true, false, false, false),
            (true, true, true, true, true, true, true, true),
        ]
        for f in cases {
            var imrie = ClinicalScoringEngine.GlasgowImrieInput()
            imrie.pao2Below59 = f.pao2; imrie.ageAbove55 = f.age; imrie.wbcAbove15 = f.wcc
            imrie.calciumBelow2 = f.ca; imrie.ureaAbove16 = f.urea; imrie.ldh180 = f.enzyme
            imrie.albuminBelow32 = f.alb; imrie.glucoseAbove10 = f.glu

            var glasgow = GlasgowPancreatitisInput()
            glasgow.pao2Below60 = f.pao2; glasgow.ageOver55 = f.age; glasgow.wbcOver15k = f.wcc
            glasgow.calciumBelow2 = f.ca; glasgow.ureaOver16 = f.urea; glasgow.ldhOver600OrAstOver200 = f.enzyme
            glasgow.albuminBelow32 = f.alb; glasgow.glucoseOver10 = f.glu

            let a = ClinicalScoringEngine.glasgowImrie(imrie)
            let b = ClinicalScoringEngine.glasgowPancreatitis(glasgow)
            XCTAssertEqual(a.score, b.score, "\(f)")
            XCTAssertEqual(a.risk, b.risk, "\(f)")
            XCTAssertEqual(a.redFlags.isEmpty, b.redFlags.isEmpty, "\(f)")
        }
    }

    // MARK: - BISAP (Wu 2008)

    func testBISAPBands() {
        var i = ClinicalScoringEngine.BISAPInput()
        XCTAssertEqual(ClinicalScoringEngine.bisap(i).risk, .low)
        i.ageOver60 = true
        i.sirs = true
        XCTAssertEqual(ClinicalScoringEngine.bisap(i).score, 2)
        XCTAssertEqual(ClinicalScoringEngine.bisap(i).risk, .moderate)
        i.pleuralEffusion = true
        XCTAssertEqual(ClinicalScoringEngine.bisap(i).score, 3)
        XCTAssertEqual(ClinicalScoringEngine.bisap(i).risk, .high)
        i.bunOver9mmolL = true
        i.impairedMentalStatus = true
        let r = ClinicalScoringEngine.bisap(i)
        XCTAssertEqual(r.score, 5)
        XCTAssertEqual(r.maxScore, 5)
        XCTAssertEqual(r.risk, .critical)
    }

    // MARK: - CURB-65 (Lim 2003: 0–1 low, 2 moderate, ≥3 high)

    func testCURB65Bands() {
        var i = CURB65Input()
        i.ageOver65 = true
        XCTAssertEqual(ClinicalScoringEngine.curb65(i).risk, .low)
        i.ureaDOver7 = true
        XCTAssertEqual(ClinicalScoringEngine.curb65(i).score, 2)
        XCTAssertEqual(ClinicalScoringEngine.curb65(i).risk, .moderate)
        i.confusion = true
        XCTAssertEqual(ClinicalScoringEngine.curb65(i).score, 3)
        XCTAssertEqual(ClinicalScoringEngine.curb65(i).risk, .high)
    }

    // MARK: - NEWS2 (Scores-screen calculator)

    func testEngineNEWS2Bands() {
        XCTAssertEqual(ClinicalScoringEngine.news2(NEWS2Input()).score, 0)
        XCTAssertEqual(ClinicalScoringEngine.news2(NEWS2Input()).risk, .low)

        var single = NEWS2Input()
        single.respiratoryRate = 25          // single parameter scoring 3
        let rs = ClinicalScoringEngine.news2(single)
        XCTAssertEqual(rs.score, 3)
        XCTAssertGreaterThan(rs.risk, .low)
        XCTAssertFalse(rs.redFlags.isEmpty)
        // RCP: single parameter 3 = low-medium, urgent ward-based response. ScoreRisk has no
        // low-medium level, so it maps to .moderate with an explicit URGENT interpretation.
        XCTAssertEqual(rs.risk, .moderate)
        XCTAssertTrue(rs.interpretation.contains("Low-medium"))
        XCTAssertTrue(rs.interpretation.contains("URGENT"))

        var four = NEWS2Input()
        four.respiratoryRate = 22            // 2
        four.heartRate = 115                 // 2
        XCTAssertEqual(ClinicalScoringEngine.news2(four).score, 4)
        XCTAssertEqual(ClinicalScoringEngine.news2(four).risk, .low)

        var five = four
        five.temperatureCelsius = 38.5       // 1 → 5
        let r5 = ClinicalScoringEngine.news2(five)
        XCTAssertEqual(r5.score, 5)
        XCTAssertEqual(r5.risk, .moderate)
        XCTAssertTrue(r5.interpretation.contains("Medium"))

        var seven = NEWS2Input()
        seven.respiratoryRate = 22           // 2
        seven.heartRate = 115                // 2
        seven.systolicBP = 105               // 1
        seven.temperatureCelsius = 38.5      // 1
        seven.spo2 = 95                      // 1
        let r7 = ClinicalScoringEngine.news2(seven)
        XCTAssertEqual(r7.score, 7)
        XCTAssertEqual(r7.risk, .critical)
    }

    /// Supplemental oxygen alone keeps SpO₂ Scale 1; Scale 2 needs the explicit opt-in.
    func testEngineNEWS2OxygenDoesNotSwitchToScale2() {
        var i = NEWS2Input()
        i.onSupplementalO2 = true
        i.spo2 = 97
        XCTAssertEqual(ClinicalScoringEngine.news2(i).score, 2, "Scale 1: 97% = 0, +2 for oxygen")
        i.spo2 = 88
        XCTAssertEqual(ClinicalScoringEngine.news2(i).score, 5, "Scale 1: 88% = 3, +2 for oxygen")

        i.useSpO2Scale2 = true
        i.spo2 = 97
        XCTAssertEqual(ClinicalScoringEngine.news2(i).score, 5, "Scale 2 on O2: 97% = 3, +2")
        i.spo2 = 88
        XCTAssertEqual(ClinicalScoringEngine.news2(i).score, 2, "Scale 2: 88% = 0, +2")
        i.spo2 = 85
        XCTAssertEqual(ClinicalScoringEngine.news2(i).score, 4, "Scale 2: 84–85 = 2, +2")
        i.spo2 = 87
        XCTAssertEqual(ClinicalScoringEngine.news2(i).score, 3, "Scale 2: 86–87 = 1, +2")
    }

    // MARK: - ScoreRisk ordering (used by every "risk >= .high" check in the app)

    func testScoreRiskOrdering() {
        XCTAssertLessThan(ScoreRisk.low, ScoreRisk.moderate)
        XCTAssertLessThan(ScoreRisk.moderate, ScoreRisk.high)
        XCTAssertLessThan(ScoreRisk.high, ScoreRisk.critical)
        XCTAssertEqual(ScoreRisk.allCases.max(), ScoreRisk.critical)
    }
}
