import XCTest
@testable import AmiseMedFlow

/// Radiation card corrections, the patient safety filter and calculator fixes (clinical
/// validation 2026-09; SURGEON-DECISIONS A, C2, C5, E6, G2).
final class RadiationSafetyAndScoresTests: XCTestCase {

    private func card(_ dx: String, age: Int? = 50, pregnancy: PregnancyContext = .none,
                      allergies: [AllergyEntry] = [], meds: [String] = [], pmh: String = "") -> DiagnosisRadiation? {
        DiagnosisRadiationEngine.radiate(workingDiagnosis: dx, ageYears: age ?? 0, sex: .female,
                                         context: RadiationContext(ageYears: age, pregnancy: pregnancy, allergies: allergies,
                                                                   medications: meds, pmhText: pmh))
    }

    private let pregnant30 = PregnancyContext(status: .pregnant, gestationWeeks: 30)

    // MARK: - Unsafe content corrected

    func testAKICardUsesThirtyMillilitresOfCalciumGluconate() {
        let plan = card("Acute kidney injury with hyperkalaemia")?.planTemplate ?? ""
        XCTAssertTrue(plan.contains("calcium gluconate 10% 30 mL"), plan)
        XCTAssertFalse(plan.contains("10 mL 10% calcium gluconate"))
    }

    func testSAHNimodipineIsOral() {
        let plan = card("Subarachnoid haemorrhage")?.planTemplate ?? ""
        XCTAssertTrue(plan.contains("Nimodipine 60 mg ORALLY"), plan)
        XCTAssertFalse(plan.contains("IV nimodipine 60 mg"))
    }

    func testStrokeCardHasNoABCD2Triage() {
        let r = card("Transient ischaemic attack")
        XCTAssertFalse(r?.planTemplate.contains("ABCD² score;") ?? true)
        XCTAssertFalse(r?.redFlags.contains { $0.contains("ABCD² ≥4") } ?? true)
        XCTAssertTrue(r?.planTemplate.contains("within 24 h") ?? false)
        XCTAssertFalse(r?.planTemplate.contains("LMWH bridge") ?? true)
    }

    func testPancreatitisFluidsAreModerateAndERCPWithin24Hours() {
        let plan = card("Acute gallstone pancreatitis")?.planTemplate ?? ""
        XCTAssertFalse(plan.contains("250–500 mL/h"))
        XCTAssertTrue(plan.contains("MODERATE goal-directed"))
        XCTAssertTrue(plan.contains("No prophylactic antibiotics"))
        XCTAssertTrue(plan.contains("within 24 h if concomitant cholangitis"))
    }

    // MARK: - E6 explicit mappings

    func testExplicitMappings() {
        XCTAssertEqual(card("Primary hyperparathyroidism with surgical indications (osteoporosis, nephrolithiasis, eGFR <60)")?.conditionName,
                       "Primary Hyperparathyroidism")
        XCTAssertEqual(card("Cellulitis of the left lower limb in a patient with type 2 diabetes")?.conditionName, "Cellulitis")
        XCTAssertEqual(card("Large bowel obstruction from a sigmoid carcinoma")?.conditionName, "Large Bowel Obstruction")
        XCTAssertEqual(card("Hypoglycaemia presenting as a stroke mimic")?.conditionName, "Hypoglycaemia")
    }

    func testNonSurgicalEmergencyCardsCarryTheRedirect() {
        for dx in ["Diabetic ketoacidosis", "Anaphylaxis (amoxicillin)", "Severe pre-eclampsia with HELLP syndrome",
                   "Suspected bacterial meningitis", "Cauda equina syndrome with urinary retention"] {
            let plan = card(dx)?.planTemplate ?? ""
            XCTAssertTrue(plan.contains("OKEU Hospital") && plan.contains("911"), dx)
            XCTAssertFalse(plan.contains("Victoria"), dx)
        }
    }

    func testHHSUsesTheLowInsulinRate() {
        let plan = card("Hyperosmolar hyperglycaemic state")?.planTemplate ?? ""
        XCTAssertTrue(plan.contains("0.05 units/kg/h"))
        XCTAssertFalse(plan.contains("0.1 units/kg"))
    }

    // MARK: - Safety filter

    func testUnderSixteensNeverSeeAdultDoses() {
        let plan = card("Acute appendicitis", age: 9)?.planTemplate ?? ""
        XCTAssertFalse(plan.contains("cefazolin 2 g"), plan)
        XCTAssertFalse(plan.contains("ondansetron 4 mg"), plan)
        XCTAssertTrue(plan.contains("calculate per BNFc"))
    }

    func testChildHerniaCardHasNoMeshOrTruss() {
        let plan = card("Right inguinal hernia in an infant (reducible)", age: 0)?.planTemplate.lowercased() ?? ""
        XCTAssertFalse(plan.contains("truss if patient unfit"), plan)
        XCTAssertFalse(plan.contains("(tep/tapp)"), plan)
        XCTAssertTrue(plan.contains("open herniotomy (no mesh)"), plan)
        // "truss" must not appear at all: the vignette check forbids any mention (A22).
        XCTAssertFalse(plan.contains("truss"), plan)
    }

    func testPregnancyReplacesDOACsWithLMWHAndRemovesNSAIDs() {
        let dvt = card("Deep vein thrombosis", age: 30, pregnancy: pregnant30)?.planTemplate ?? ""
        XCTAssertFalse(dvt.contains("Rivaroxaban: 15 mg"), dvt)
        XCTAssertTrue(dvt.contains("LMWH"))
        let colic = card("Biliary colic", age: 30, pregnancy: pregnant30)?.planTemplate ?? ""
        XCTAssertFalse(colic.contains("diclofenac suppository 100 mg"), colic)
        XCTAssertTrue(colic.contains("PREGNANT"))
    }

    func testPenicillinAllergyRemovesPenicillinsAndCephalosporinsAfterAnaphylaxis() {
        let allergy = AllergyEntry(name: "Penicillin", severity: "Severe", reaction: "Anaphylaxis")
        let pud = card("Duodenal ulcer, H. pylori positive", allergies: [allergy])?.planTemplate ?? ""
        XCTAssertFalse(pud.contains("amoxicillin 1 g"), pud)
        XCTAssertTrue(pud.contains("ALLERGY"))
        XCTAssertTrue(pud.contains("bismuth quadruple"))
        let appendix = card("Acute appendicitis", allergies: [allergy])?.planTemplate ?? ""
        XCTAssertFalse(appendix.contains("cefazolin 2 g"), appendix)
    }

    func testOperativeCardsCarryAVTELine() {
        XCTAssertTrue(card("Acute appendicitis")?.planTemplate.contains("VTE prophylaxis (NICE NG89)") ?? false)
        XCTAssertFalse(card("Essential hypertension")?.planTemplate.contains("VTE prophylaxis (NICE NG89)") ?? true)
    }

    func testAntithromboticPlanIsProcedureSpecificWithoutRoutineBridging() {
        let plan = card("Colonic polyp 25 mm — planned endoscopic mucosal resection", meds: ["Clopidogrel", "Apixaban"],
                        pmh: "Drug-eluting stent 2 months ago")?.planTemplate ?? ""
        XCTAssertTrue(plan.lowercased().contains("no bridging"), plan)
        XCTAssertTrue(plan.contains("ESC/ESAIC 2022"))
        XCTAssertTrue(plan.contains("BSG/ESGE 2021"))
    }

    // MARK: - Calculators

    func testLowLRINECDoesNotExcludeNecrotisingInfection() {
        let r = ClinicalScoringEngine.lrinec(LRINECInput())
        XCTAssertTrue(r.interpretation.contains("does NOT exclude"))
        XCTAssertFalse(r.interpretation.contains("consider cellulitis"))
        XCTAssertTrue(r.recommendations.contains { $0.contains("urgent surgical exploration") })
    }

    func testTG18CholangitisGradeIINeedsTwoCriteria() {
        var one = TokyoCholangitisInput()
        one.cholangitisConfirmed = true
        one.ageAbove75 = true
        XCTAssertEqual(ClinicalScoringEngine.tokyoCholangitis(one).score, 1)
        var two = one
        two.temperatureAbove39 = true
        XCTAssertEqual(ClinicalScoringEngine.tokyoCholangitis(two).score, 2)
    }

    func testTG18CholecystitisPalpableMassIsGradeII() {
        var i = TokyoCholecystitisInput()
        i.localInflammationSignsMild = true
        i.palpableTenderRUQMass = true
        XCTAssertEqual(ClinicalScoringEngine.tokyoCholecystitis(i).score, 2)
    }

    func testParklandRateAccountsForTimeSinceBurn() {
        // 80 kg, 27%: 8640 mL; half (4320) due in the first 8 h. Arriving at 2 h with nothing
        // given → 4320 / 6 = 720 mL/h (not 540 mL/h).
        var i = ClinicalScoringEngine.ParklandInput()
        i.weightKg = 80; i.tbsaPercent = 27; i.hoursSinceBurn = 2
        let r = ClinicalScoringEngine.parkland(i)
        XCTAssertTrue(r.recommendations.contains { $0.contains("720 mL/h") }, "\(r.recommendations)")
    }

    func testBurnThresholdIsConsistentForChildren() {
        var child = ClinicalScoringEngine.ParklandInput()
        child.weightKg = 15; child.tbsaPercent = 12; child.isChild = true
        XCTAssertTrue(ClinicalScoringEngine.parkland(child).interpretation.contains("formal IV resuscitation required"))
        var adult = ClinicalScoringEngine.ParklandInput()
        adult.tbsaPercent = 14
        XCTAssertTrue(ClinicalScoringEngine.parkland(adult).interpretation.contains("below the formal IV resuscitation threshold"))
    }

    func testElectricalInjuryGetsIVFluidsWhateverTheVisibleBurn() {
        var i = ClinicalScoringEngine.ParklandInput()
        i.tbsaPercent = 4; i.isElectrical = true
        let r = ClinicalScoringEngine.parkland(i)
        XCTAssertTrue(r.interpretation.contains("REGARDLESS of visible TBSA"))
        XCTAssertFalse(r.interpretation.contains("Oral fluids may be adequate"))
    }
}
