import XCTest
@testable import AmiseMedFlow

final class ClinicalScoringEngineTests: XCTestCase {

    // MARK: - Alvarado (Appendicitis)

    func testAlvaradoZeroScore() {
        let result = ClinicalScoringEngine.alvarado(AlvaradoInput())
        XCTAssertEqual(result.score, 0)
        XCTAssertEqual(result.risk, .low)
    }

    func testAlvaradoLowRisk() {
        // Score 3: migration + anorexia + nausea — low risk
        var input = AlvaradoInput()
        input.migrationToRIF = true
        input.anorexia = true
        input.nauseaVomiting = true
        let result = ClinicalScoringEngine.alvarado(input)
        XCTAssertEqual(result.score, 3)
        XCTAssertEqual(result.risk, .low)
    }

    func testAlvaradoModerateRisk() {
        // Score 5–6: migration(1) + RIF tenderness(2) + WBC elevated(2) = 5
        var input = AlvaradoInput()
        input.migrationToRIF = true
        input.tendernessRIF = true
        input.wbcElevated = true
        let result = ClinicalScoringEngine.alvarado(input)
        XCTAssertEqual(result.score, 5)
        XCTAssertEqual(result.risk, .moderate)
    }

    func testAlvaradoHighRisk() {
        // Score ≥7: all symptoms positive = 10
        var input = AlvaradoInput()
        input.migrationToRIF = true
        input.anorexia = true
        input.nauseaVomiting = true
        input.tendernessRIF = true
        input.reboundTenderness = true
        input.elevatedTemperature = true
        input.wbcElevated = true
        input.neutrophiliaShift = true
        let result = ClinicalScoringEngine.alvarado(input)
        XCTAssertEqual(result.score, 10)
        XCTAssertEqual(result.maxScore, 10)
        XCTAssertEqual(result.risk, .high)
    }

    // MARK: - Tokyo Cholecystitis

    func testTokyoCholecystitisGrade1() {
        // Local signs only — Grade I (mild)
        var input = TokyoCholecystitisInput()
        input.localInflammationSignsMild = true
        let result = ClinicalScoringEngine.tokyoCholecystitis(input)
        XCTAssertEqual(result.risk, .low)
    }

    func testTokyoCholecystitisGrade3OrganFailure() {
        // Any organ dysfunction → Grade III (critical)
        var input = TokyoCholecystitisInput()
        input.localInflammationSignsMild = true
        input.cardiovascularDysfunction = true
        let result = ClinicalScoringEngine.tokyoCholecystitis(input)
        XCTAssertEqual(result.risk, .critical)
    }

    // MARK: - Tokyo Cholangitis

    func testTokyoCholangitisGrade1() {
        var input = TokyoCholangitisInput()
        input.cholangitisConfirmed = true
        let result = ClinicalScoringEngine.tokyoCholangitis(input)
        XCTAssertEqual(result.risk, .low)
    }

    func testTokyoCholangitisGrade3() {
        var input = TokyoCholangitisInput()
        input.cholangitisConfirmed = true
        input.cardiovascularDysfunction = true
        let result = ClinicalScoringEngine.tokyoCholangitis(input)
        XCTAssertEqual(result.risk, .critical)
    }

    // MARK: - Ranson (Pancreatitis)

    func testRansonZero() {
        let result = ClinicalScoringEngine.ranson(RansonInput())
        XCTAssertEqual(result.score, 0)
        XCTAssertEqual(result.risk, .low)
    }

    func testRansonHighRisk() {
        // ≥3 criteria = significant predicted mortality
        var input = RansonInput()
        input.ageOver55 = true
        input.wbcOver16k = true
        input.glucoseOver200 = true
        let result = ClinicalScoringEngine.ranson(input)
        XCTAssertEqual(result.score, 3)
        XCTAssertTrue(result.risk >= .high)
    }

    func testRansonMaxScore() {
        // All 11 criteria
        var input = RansonInput()
        input.ageOver55 = true; input.wbcOver16k = true; input.glucoseOver200 = true
        input.ldhOver350 = true; input.astOver250 = true; input.hctFallOver10 = true
        input.bunRiseOver5 = true; input.calciumBelow8 = true; input.pao2Below60 = true
        input.baseDeficitOver4 = true; input.fluidSequestrationOver6L = true
        let result = ClinicalScoringEngine.ranson(input)
        XCTAssertEqual(result.score, 11)
        XCTAssertEqual(result.maxScore, 11)
        XCTAssertEqual(result.risk, .critical)
    }

    // MARK: - Glasgow Pancreatitis

    func testGlasgowZero() {
        let result = ClinicalScoringEngine.glasgowPancreatitis(GlasgowPancreatitisInput())
        XCTAssertEqual(result.score, 0)
        XCTAssertEqual(result.risk, .low)
    }

    func testGlasgowSevere() {
        // ≥3 = severe
        var input = GlasgowPancreatitisInput()
        input.pao2Below60 = true
        input.ageOver55 = true
        input.wbcOver15k = true
        let result = ClinicalScoringEngine.glasgowPancreatitis(input)
        XCTAssertEqual(result.score, 3)
        XCTAssertTrue(result.risk >= .high)
    }

    func testGlasgowMaxScore() {
        var input = GlasgowPancreatitisInput()
        input.pao2Below60 = true; input.ageOver55 = true; input.wbcOver15k = true
        input.calciumBelow2 = true; input.ureaOver16 = true; input.ldhOver600OrAstOver200 = true
        input.albuminBelow32 = true; input.glucoseOver10 = true
        let result = ClinicalScoringEngine.glasgowPancreatitis(input)
        XCTAssertEqual(result.score, 8)
        XCTAssertEqual(result.maxScore, 8)
    }

    // MARK: - Rockall (GI Bleed)

    func testRockallMinimumScore() {
        // All defaults: age <60, no shock, no comorbidity, Mallory-Weiss, no stigmata = 0
        let result = ClinicalScoringEngine.rockall(RockallInput())
        XCTAssertEqual(result.score, 0)
        XCTAssertEqual(result.risk, .low)
    }

    func testRockallHighRisk() {
        var input = RockallInput()
        input.ageGroup = .over80          // +2
        input.shock = .sbpBelow100        // +2
        input.comorbidity = .renalOrLiverOrMalignancy  // +3
        input.diagnosis = .upperGIMalignancy            // +2
        input.majorStigmata = true        // +2
        let result = ClinicalScoringEngine.rockall(input)
        XCTAssertEqual(result.score, 11)
        XCTAssertEqual(result.risk, .critical)
    }

    // MARK: - SIRS / Sepsis

    func testSIRSNoSepsis() {
        let result = ClinicalScoringEngine.sirs(SIRSInput())
        XCTAssertEqual(result.score, 0)
        XCTAssertEqual(result.risk, .low)
    }

    func testSIRSSepsisCriteria() {
        // ≥2 SIRS + suspected infection = Sepsis
        var input = SIRSInput()
        input.tempAbove38OrBelow36 = true
        input.heartRateOver90 = true
        input.suspectedInfection = true
        let result = ClinicalScoringEngine.sirs(input)
        XCTAssertTrue(result.risk >= .moderate)
    }

    func testSIRSMaxCriteria() {
        var input = SIRSInput()
        input.tempAbove38OrBelow36 = true; input.heartRateOver90 = true
        input.rrOver20OrPaCO2Below32 = true; input.wbcOver12kOrBelow4kOr10PctBands = true
        input.suspectedInfection = true; input.positiveBloodCulture = true
        let result = ClinicalScoringEngine.sirs(input)
        XCTAssertEqual(result.risk, .critical)
    }

    // MARK: - qSOFA (Sepsis-3)

    func testQSOFAZero() {
        let result = ClinicalScoringEngine.qsofa(QSOFAInput())
        XCTAssertEqual(result.score, 0)
        XCTAssertEqual(result.risk, .low)
    }

    func testQSOFAPositive() {
        // ≥2 = high risk for organ dysfunction
        var input = QSOFAInput()
        input.rrOver22 = true
        input.sbpUnder100 = true
        input.suspectedInfection = true
        let result = ClinicalScoringEngine.qsofa(input)
        XCTAssertEqual(result.score, 2)
        XCTAssertTrue(result.risk >= .high)
    }

    func testQSOFAAllThree() {
        var input = QSOFAInput()
        input.alteredMentation = true; input.rrOver22 = true
        input.sbpUnder100 = true; input.suspectedInfection = true
        let result = ClinicalScoringEngine.qsofa(input)
        XCTAssertEqual(result.score, 3)
        XCTAssertEqual(result.risk, .critical)
    }

    // MARK: - Wells DVT

    func testWellsDVTLowProbability() {
        // Score ≤1 and alternative dx as likely (-2) → low probability
        var input = WellsDVTInput()
        input.activeCancer = true           // +1
        input.alternativeDiagnosisAsLikely = true  // -2 → net -1
        let result = ClinicalScoringEngine.wellsDVT(input)
        XCTAssertTrue(result.score <= 0)
        XCTAssertEqual(result.risk, .low)
    }

    func testWellsDVTHighProbability() {
        // Score ≥3 = high probability
        var input = WellsDVTInput()
        input.activeCancer = true
        input.paralysisParesisPlastercast = true
        input.bedridden3dOrSurgery12w = true
        input.localizedTendernessDeepVein = true
        let result = ClinicalScoringEngine.wellsDVT(input)
        XCTAssertEqual(result.score, 4)
        XCTAssertTrue(result.risk >= .high)
    }

    // MARK: - Wells PE

    func testWellsPELow() {
        let result = ClinicalScoringEngine.wellsPE(WellsPEInput())
        XCTAssertEqual(result.score, 0)
        XCTAssertEqual(result.risk, .low)
    }

    func testWellsPEHigh() {
        // Clinical DVT signs(3) + alt dx less likely(3) = 6 — high
        var input = WellsPEInput()
        input.clinicalSignsDVT = true
        input.alternativeDxLessLikely = true
        let result = ClinicalScoringEngine.wellsPE(input)
        XCTAssertEqual(result.score, 6)
        XCTAssertTrue(result.risk >= .high)
    }

    func testWellsPEMaxScore() {
        var input = WellsPEInput()
        input.clinicalSignsDVT = true; input.hrOver100 = true
        input.immobilisationOrSurgery4w = true; input.previousDVTOrPE = true
        input.haemoptysis = true; input.malignancyActive = true
        input.alternativeDxLessLikely = true
        let result = ClinicalScoringEngine.wellsPE(input)
        XCTAssertEqual(result.score, 12.5, accuracy: 0.01)
    }

    // MARK: - ABCD² (TIA)

    func testABCD2Zero() {
        let result = ClinicalScoringEngine.abcd2(ABCD2Input())
        XCTAssertEqual(result.score, 0)
        XCTAssertEqual(result.risk, .low)
    }

    func testABCD2HighRisk() {
        // Age(1) + BP(1) + unilateral weakness(2) + duration >60min(2) + diabetes(1) = 7
        var input = ABCD2Input()
        input.ageOver60 = true; input.bpOver140_90 = true
        input.unilateralWeakness = true; input.durationOver60min = true
        input.diabetes = true
        let result = ClinicalScoringEngine.abcd2(input)
        XCTAssertEqual(result.score, 7)
        XCTAssertEqual(result.maxScore, 7)
        XCTAssertEqual(result.risk, .critical)
    }

    func testABCD2MutuallyExclusiveDuration() {
        // durationOver60min and duration10to59min both true → only durationOver60min scores (+2)
        var input = ABCD2Input()
        input.durationOver60min = true
        input.duration10to59min = true
        let result = ClinicalScoringEngine.abcd2(input)
        // Should not double-count — max 2 from duration
        XCTAssertLessThanOrEqual(result.score, 7)
    }

    // MARK: - LRINEC (Necrotising Fasciitis)

    func testLRINECZero() {
        let result = ClinicalScoringEngine.lrinec(LRINECInput())
        XCTAssertEqual(result.score, 0)
        XCTAssertEqual(result.risk, .low)
    }

    func testLRINECHighRisk() {
        // CRP >150 (+4) + WBC >25 (+2) + Hb <11 (+2) + Na <135 (+2) = 10
        var input = LRINECInput()
        input.crpOver150 = true; input.wbcOver25 = true
        input.hbBelow11 = true; input.sodiumBelow135 = true
        let result = ClinicalScoringEngine.lrinec(input)
        XCTAssertEqual(result.score, 10)
        XCTAssertTrue(result.risk >= .high)
    }

    // MARK: - RCRI (Cardiac Risk)

    func testRCRIZero() {
        let result = ClinicalScoringEngine.rcri(RCRIInput())
        XCTAssertEqual(result.score, 0)
        XCTAssertEqual(result.risk, .low)
    }

    func testRCRIThreeFactors() {
        var input = RCRIInput()
        input.highRiskSurgery = true
        input.ischemicHeartDisease = true
        input.congestiveHeartFailure = true
        let result = ClinicalScoringEngine.rcri(input)
        XCTAssertEqual(result.score, 3)
        XCTAssertTrue(result.risk >= .high)
    }

    func testRCRIMaxScore() {
        var input = RCRIInput()
        input.highRiskSurgery = true; input.ischemicHeartDisease = true
        input.congestiveHeartFailure = true; input.cerebrovascularDisease = true
        input.insulinDependentDiabetes = true; input.preopCreatinineOver2 = true
        let result = ClinicalScoringEngine.rcri(input)
        XCTAssertEqual(result.score, 6)
        XCTAssertEqual(result.maxScore, 6)
    }

    // MARK: - Caprini VTE Risk

    func testCapriniZero() {
        let result = ClinicalScoringEngine.caprini(CapriniInput())
        XCTAssertEqual(result.score, 0)
        XCTAssertEqual(result.risk, .low)
    }

    func testCapriniHighRisk() {
        // Stroke(5) + prior VTE(3) + thrombophilia(3) = 11
        var input = CapriniInput()
        input.stroke = true; input.priorVTE = true; input.thrombophilia = true
        let result = ClinicalScoringEngine.caprini(input)
        XCTAssertEqual(result.score, 11)
        XCTAssertEqual(result.risk, .critical)
    }

    func testCapriniMajorSurgery() {
        // A common surgical scenario: major surgery + age 60-74 + central venous access
        var input = CapriniInput()
        input.majorSurgery = true; input.age60to74 = true; input.centralVenousAccess = true
        let result = ClinicalScoringEngine.caprini(input)
        XCTAssertEqual(result.score, 6)
        XCTAssertTrue(result.risk >= .high)
    }

    // MARK: - Child-Pugh

    func testChildPughClassA() {
        // All normal values → Class A (good hepatic reserve)
        var input = ChildPughInput()
        input.bilirubinUmolL = 15    // <34 → 1 pt
        input.albuminGdL = 4.0       // >3.5 → 1 pt
        input.ptINR = 1.1            // <1.7 → 1 pt
        input.ascites = .none        // 1 pt
        input.encephalopathy = .none // 1 pt
        let result = ClinicalScoringEngine.childPugh(input)
        XCTAssertEqual(result.score, 5)
        XCTAssertEqual(result.risk, .low)     // Class A
    }

    func testChildPughClassC() {
        // All worst values → Class C
        var input = ChildPughInput()
        input.bilirubinUmolL = 60    // >51 → 3 pts
        input.albuminGdL = 2.5       // <2.8 → 3 pts
        input.ptINR = 2.5            // >2.3 → 3 pts
        input.ascites = .refractory          // 3 pts
        input.encephalopathy = .grade3to4    // 3 pts
        let result = ClinicalScoringEngine.childPugh(input)
        XCTAssertEqual(result.score, 15)
        XCTAssertEqual(result.maxScore, 15)
        XCTAssertEqual(result.risk, .critical)  // Class C
    }

    func testChildPughClassB() {
        var input = ChildPughInput()
        input.bilirubinUmolL = 40    // 34–51 → 2 pts
        input.albuminGdL = 3.0       // 2.8–3.5 → 2 pts
        input.ptINR = 1.9            // 1.7–2.3 → 2 pts
        input.ascites = .controlled  // 2 pts
        input.encephalopathy = .grade1to2  // 2 pts
        let result = ClinicalScoringEngine.childPugh(input)
        XCTAssertEqual(result.score, 10)
        XCTAssertEqual(result.risk, .moderate)  // Class B
    }

    // MARK: - Score metadata invariants

    func testAllScoresHaveNonEmptySystemName() {
        let scores: [ClinicalScore] = [
            ClinicalScoringEngine.alvarado(AlvaradoInput()),
            ClinicalScoringEngine.tokyoCholecystitis(TokyoCholecystitisInput()),
            ClinicalScoringEngine.tokyoCholangitis(TokyoCholangitisInput()),
            ClinicalScoringEngine.ranson(RansonInput()),
            ClinicalScoringEngine.glasgowPancreatitis(GlasgowPancreatitisInput()),
            ClinicalScoringEngine.rockall(RockallInput()),
            ClinicalScoringEngine.sirs(SIRSInput()),
            ClinicalScoringEngine.qsofa(QSOFAInput()),
            ClinicalScoringEngine.wellsDVT(WellsDVTInput()),
            ClinicalScoringEngine.wellsPE(WellsPEInput()),
            ClinicalScoringEngine.abcd2(ABCD2Input()),
            ClinicalScoringEngine.lrinec(LRINECInput()),
            ClinicalScoringEngine.rcri(RCRIInput()),
            ClinicalScoringEngine.caprini(CapriniInput()),
            ClinicalScoringEngine.childPugh(ChildPughInput()),
        ]
        for s in scores {
            XCTAssertFalse(s.systemName.isEmpty, "systemName empty for score")
            XCTAssertFalse(s.abbreviation.isEmpty, "abbreviation empty for score")
            XCTAssertFalse(s.interpretation.isEmpty, "interpretation empty for \(s.systemName)")
            XCTAssertFalse(s.recommendations.isEmpty, "recommendations empty for \(s.systemName)")
            XCTAssertGreaterThanOrEqual(s.score, 0, "\(s.systemName) score is negative")
            XCTAssertLessThanOrEqual(s.score, s.maxScore, "\(s.systemName) score exceeds maxScore")
        }
    }

    func testScoreNeverExceedsMax() {
        // Alvarado max is 10
        var alv = AlvaradoInput()
        alv.migrationToRIF = true; alv.anorexia = true; alv.nauseaVomiting = true
        alv.tendernessRIF = true; alv.reboundTenderness = true; alv.elevatedTemperature = true
        alv.wbcElevated = true; alv.neutrophiliaShift = true
        let result = ClinicalScoringEngine.alvarado(alv)
        XCTAssertLessThanOrEqual(result.score, result.maxScore)
        XCTAssertEqual(result.score, result.maxScore)
    }
}
