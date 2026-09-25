import XCTest
import SwiftData
@testable import AmiseMedFlow

/// iOS parity with the web-last-gaps clinical fixes (docs/clinical-validation/changes/
/// web-last-gaps.md → ios-parity-web-last-gaps.md).
///
/// DRIFT NOTE: these vectors are ported from `artifacts/dashboard/src/lib/__tests__/web-last-gaps.test.ts`
/// (web) for `ios/AmiseMedFlow/Services/PlanSafetyFilter+PromptParity.swift`,
/// `DiagnosisRadiationEngine+PromptParity.swift` and the card / calculator wording they touch — the
/// iOS twin of the web-last-gaps changes to `artifacts/dashboard/src/lib/clinical-inference.ts`.
/// The web tests read prompt actions; iOS has no prompt strip, so the same patient situations run
/// through the radiation card for the working diagnosis (`DiagnosisRadiationEngine.radiate`, which
/// applies the patient safety filter), the line filter (`PlanSafetyFilter.adaptLine`, also used for
/// the SOAP draft and the pipeline decisions) and the note builder (`PlanSafetyFilter.evaluate`).
/// Change the rule, the web test and this file together.
@MainActor
final class WebLastGapsParityTests: XCTestCase {

    // MARK: - Helpers

    private func ctx(age: Int? = 45, sex: Sex = .male, pregnancy: PregnancyContext = .none,
                     allergies: [AllergyEntry] = [], meds: [String] = [], pmh: String = "",
                     diagnosis: String = "", assessment: String = "", history: String = "", cc: String = "",
                     exam: String = "", imaging: String = "", egfr: Double? = nil,
                     sbp: Int? = nil, hr: Int? = nil, hb: Double? = nil, potassium: Double? = nil,
                     bilirubin: Double? = nil) -> RadiationContext {
        var c = RadiationContext(ageYears: age, pregnancy: pregnancy, allergies: allergies, medications: meds, pmhText: pmh)
        c.sex = sex
        c.diagnosis = diagnosis
        c.assessment = assessment
        c.freeText = history
        c.chiefComplaint = cc
        c.examText = exam
        c.imagingText = imaging
        c.egfr = egfr
        c.systolicBP = sbp
        c.heartRate = hr
        c.haemoglobinGdl = hb
        c.potassium = potassium
        c.bilirubin = bilirubin
        return c
    }

    /// The card for `c.diagnosis` with the patient safety filter applied.
    private func card(_ c: RadiationContext) -> DiagnosisRadiation? {
        DiagnosisRadiationEngine.radiate(workingDiagnosis: c.diagnosis, ageYears: c.ageYears ?? 0, sex: c.sex, context: c)
    }

    private func plan(_ c: RadiationContext) -> String { card(c)?.planTemplate ?? "" }

    private func line(_ text: String, _ c: RadiationContext) -> String {
        PlanSafetyFilter.adaptLine(text, PlanSafetyFilter.signals(c)).text
    }

    private func notes(_ c: RadiationContext, operative: Bool = true) -> String {
        var shape = PlanSafetyFilter.PlanShape()
        shape.operative = operative
        return PlanSafetyFilter.evaluate(PlanSafetyFilter.signals(c), shape: shape).notes.map(\.text).joined(separator: "\n")
    }

    private func matches(_ pattern: String, _ text: String) -> Bool {
        text.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }

    private let pregnant22 = PregnancyContext(status: .pregnant, gestationWeeks: 22)

    // MARK: - Forbidden wording (NCCN; RCOG GTG 37a/b)

    func testInflammatoryBreastCancerBCSAndSLNBAreNotRecommended() {
        let p = plan(ctx(age: 52, sex: .female, diagnosis: "Inflammatory breast cancer (T4d)"))
        XCTAssertTrue(p.contains("not recommended in inflammatory breast cancer"), p)
        XCTAssertFalse(p.lowercased().contains("no wide local excision"), p)
    }

    func testPregnancyStatesDOACsAndWarfarinAreContraindicated() {
        let p = plan(ctx(age: 30, sex: .female, pregnancy: pregnant22, diagnosis: "Deep vein thrombosis of the left leg"))
        XCTAssertTrue(p.contains("DOACs and warfarin are contraindicated in pregnancy"), p)
        let replaced = line("- Rivaroxaban 15 mg BD for 21 days", ctx(age: 30, sex: .female, pregnancy: pregnant22))
        XCTAssertTrue(replaced.contains("contraindicated in pregnancy (warfarin is teratogenic)"), replaced)
    }

    // MARK: - Malignant large-bowel obstruction (WSES 2018; ESGE 2020)

    private let lboExamPeritonism = "Massively distended; tender with guarding and rebound in the right iliac fossa. Bowel sounds absent."

    func testImpendingCaecalPerforationStentContraindicatedEmergencySurgery() {
        let c = ctx(age: 79, sex: .female,
                    diagnosis: "Large bowel obstruction from sigmoid carcinoma",
                    assessment: "Large bowel obstruction from sigmoid carcinoma with closed-loop caecal distension and caecal pneumatosis. Emergency laparotomy.",
                    exam: lboExamPeritonism,
                    imaging: "Large bowel obstruction from a stenosing sigmoid tumour (closed loop). Caecum 13.5 cm with pneumatosis of the caecal wall — impending perforation.")
        let a = PlanSafetyFilter.colonicStent(PlanSafetyFilter.signals(c))
        XCTAssertTrue(a.malignant)
        XCTAssertTrue(a.contraindications.contains("caecum 13.5 cm"), "\(a.contraindications)")
        let p = plan(c)
        XCTAssertTrue(p.contains("Colonic stenting is contraindicated"), p)
        XCTAssertFalse(matches(#"colonic stent as (a )?bridge"#, p), p)
    }

    func testRightSidedTumourRightHemicolectomyNoStentOrHartmanns() {
        let c = ctx(age: 79, sex: .female,
                    diagnosis: "Large bowel obstruction from an obstructing hepatic flexure carcinoma, no perforation",
                    exam: "Distended, mildly tender on the right, no peritonism.",
                    imaging: "Obstructing tumour at the hepatic flexure with dilated small bowel and ascending colon; no perforation.")
        let a = PlanSafetyFilter.colonicStent(PlanSafetyFilter.signals(c))
        XCTAssertTrue(a.rightSided)
        XCTAssertEqual(a.contraindications, [])
        let p = plan(c)
        XCTAssertTrue(p.contains("right (extended) hemicolectomy"), p)
        XCTAssertFalse(matches(#"Hartmann'?s? (procedure|operation)|colonic stent as"#, p), p)
    }

    func testLeftSidedWithoutContraindicationKeepsStentAsABridge() {
        let c = ctx(age: 79, sex: .female, diagnosis: "Large bowel obstruction from sigmoid carcinoma",
                    exam: "Distended, soft, mildly tender. No peritonism.",
                    imaging: "Large bowel obstruction from a sigmoid tumour; caecum 8 cm; no perforation.")
        XCTAssertEqual(PlanSafetyFilter.colonicStent(PlanSafetyFilter.signals(c)).contraindications, [])
        XCTAssertTrue(plan(c).contains("colonic stent as a bridge to elective resection"))
    }

    func testAdhesionalSmallBowelObstructionGetsNoColonicStentLine() {
        let c = ctx(age: 79, sex: .female, diagnosis: "Adhesional small bowel obstruction",
                    exam: "Distended, tympanic, soft.",
                    imaging: "Small bowel obstruction with a transition point in the right iliac fossa; adhesions.")
        XCTAssertFalse(plan(c).lowercased().contains("stent"))
        // The vademecum operative option is not rewritten either (no malignant LBO).
        let option = "Colonic stenting: acute malignant obstruction as bridge to elective surgery"
        XCTAssertEqual(line(option, c), option)
    }

    // MARK: - Operative templates (AAGBI/ESA; SIGN 104; WSES 2020; NICE NG148 / NG89; EHS/AHS 2020)

    func testLowRiskLapCholeFastingNoRoutineProphylaxis() {
        let p = plan(ctx(age: 38, sex: .female, diagnosis: "Biliary colic — symptomatic cholelithiasis", assessment: "Symptomatic cholelithiasis. ASA I."))
        XCTAssertTrue(p.contains("clear fluids up to 2 h"), p)
        XCTAssertFalse(matches(#"(nbm|nil by mouth|fast\w*)\s+from\s+midnight"#, p), p)
        XCTAssertTrue(p.contains("Antibiotic prophylaxis not indicated for low-risk elective laparoscopic cholecystectomy"), p)
        XCTAssertFalse(p.contains("Post-operative antibiotics"), p)
    }

    func testAcuteCholecystitisProphylaxisAtInductionNoPostOpAntibioticsForGradeIII() {
        let p = plan(ctx(age: 48, sex: .female, diagnosis: "Acute calculous cholecystitis, TG18 Grade I.", exam: "Positive Murphy's sign"))
        XCTAssertTrue(p.contains("single dose at induction"), p)
        XCTAssertTrue(p.contains("not needed after cholecystectomy for TG18 Grade I–II"), p)
    }

    func testDialysisAndAgeAvoidNSAIDsAndUnadjustedLMWH() {
        let dialysis = plan(ctx(age: 58, sex: .female, pmh: "End-stage renal failure on haemodialysis",
                                diagnosis: "Biliary colic — symptomatic cholelithiasis", assessment: "Symptomatic cholelithiasis. Laparoscopic cholecystectomy."))
        XCTAssertTrue(dialysis.contains("NSAIDs avoided (renal impairment"), dialysis)
        XCTAssertFalse(dialysis.contains("Ibuprofen 400mg"), dialysis)
        XCTAssertFalse(matches(#"enoxaparin\s*40\s*mg"#, dialysis), dialysis)
        let elderly = plan(ctx(age: 81, sex: .female, diagnosis: "Biliary colic — symptomatic cholelithiasis", assessment: "Symptomatic cholelithiasis."))
        XCTAssertTrue(elderly.contains("NSAIDs avoided (age ≥ 75"), elderly)
    }

    func testUncomplicatedAppendicitisNoPostOperativeAntibiotics() {
        let p = plan(ctx(age: 24, diagnosis: "Acute appendicitis", exam: "RIF tenderness with guarding and rebound"))
        XCTAssertTrue(p.contains("Uncomplicated appendicitis: no post-operative antibiotics"), p)
        XCTAssertFalse(matches(#"simple appendicitis[^\n]{0,120}5 days"#, p), p)
    }

    func testUmbilicalHerniaVentralRepairAndCirrhosisIsNotADayCase() {
        let p = plan(ctx(age: 44, diagnosis: "Reducible umbilical hernia, 2 cm defect", exam: "Reducible umbilical hernia, 2 cm defect"))
        XCTAssertTrue(p.contains("defect ≥ 1 cm: mesh repair"), p)
        XCTAssertFalse(p.contains("INGUINAL HERNIA REPAIR (TAPP)"), p)
        XCTAssertTrue(p.contains("single dose for high-risk patients"), p)
        let c = plan(ctx(age: 57, pmh: "Alcohol-related liver cirrhosis, Ascites",
                         diagnosis: "Umbilical hernia in decompensated cirrhosis with ascites"))
        XCTAssertTrue(c.contains("hepatology optimisation first"), c)
        XCTAssertFalse(matches(#"day[- ]case"#, c), c)
    }

    func testPenicillinAllergyWithholdsThePenicillinLine() {
        let allergy = AllergyEntry(name: "Penicillin", severity: "Severe", reaction: "Anaphylaxis")
        let p = plan(ctx(age: 34, allergies: [allergy], diagnosis: "Acute appendicitis — perforated"))
        XCTAssertTrue(p.contains("the penicillin-class antibiotic proposed here is withheld"), p)
        XCTAssertFalse(matches(#"co-amoxiclav|pip-tazo|piperacillin|amoxicillin|flucloxacillin"#, p), p)
    }

    // MARK: - Prompt corrections (BSG 2019; NICE NG45 / NG158 / NG232; UKKA 2023; ACOG CO 723)

    func testStableUpperGIBleedNoLargeBoreOrCrossMatchUnstableKeepsThem() {
        let stable = card(ctx(age: 28, diagnosis: "Upper GI bleed — small haematemesis", sbp: 118, hr: 72, hb: 13.4))
        let stablePlan = stable?.planTemplate ?? ""
        XCTAssertFalse(stablePlan.contains("large-bore"), stablePlan)
        XCTAssertTrue(stablePlan.contains("Glasgow-Blatchford score — 0–1"), stablePlan)
        XCTAssertFalse(stable?.investigations.contains { $0.name.contains("crossmatch") } ?? true)
        XCTAssertTrue(stable?.investigations.contains { $0.name.contains("group and save") } ?? false)
        let unstable = plan(ctx(age: 70, diagnosis: "Upper GI bleed — haematemesis and melaena", sbp: 84, hr: 118))
        XCTAssertTrue(unstable.contains("large-bore"), unstable)
        // No vital signs recorded: the card stays as written (iOS difference from the web).
        XCTAssertTrue(plan(ctx(age: 40, diagnosis: "Upper GI bleed")).contains("large-bore"))
    }

    func testHbA1cIsNotReadAsHaemoglobin() {
        let lab = LabPanel.parse(from: [InvestigationEntry(name: "Glycated haemoglobin (HbA1c)", category: .blood, status: .resulted,
                                                           result: "58 mmol/mol", resultedAt: Date())])
        XCTAssertNil(lab.haemoglobin)
    }

    func testNoRoutineClottingScreenBeforeElectiveSurgery() {
        func extras(_ c: RadiationContext) -> String {
            var shape = PlanSafetyFilter.PlanShape(); shape.operative = true
            return PlanSafetyFilter.evaluate(PlanSafetyFilter.signals(c), shape: shape).extraInvestigations.map(\.name).joined(separator: "\n")
        }
        let base = "Symptomatic cholelithiasis — elective laparoscopic cholecystectomy"
        XCTAssertFalse(extras(ctx(assessment: base)).contains("Clotting screen"))
        XCTAssertTrue(extras(ctx(meds: ["Warfarin"], assessment: base)).contains("INR"))
        XCTAssertTrue(extras(ctx(pmh: "Alcohol-related cirrhosis", assessment: base)).contains("Clotting screen"))
        XCTAssertFalse(extras(ctx(meds: ["Apixaban"], assessment: base)).contains("Clotting screen"))
        XCTAssertTrue(extras(ctx(assessment: base, bilirubin: 38)).contains("Clotting screen"))
    }

    func testSuspectedPEUsesTheTwoLevelWellsScore() {
        let p = plan(ctx(age: 35, diagnosis: "Suspected pulmonary embolism"))
        XCTAssertTrue(p.contains("Wells > 4 (PE likely) → CTPA directly"), p)
        XCTAssertFalse(p.contains("Wells score ≥ 2"), p)
        var likely = WellsPEInput(); likely.clinicalSignsDVT = true; likely.alternativeDxLessLikely = true
        XCTAssertTrue(ClinicalScoringEngine.wellsPE(likely).recommendations.joined().contains("CTPA directly"))
        XCTAssertTrue(ClinicalScoringEngine.wellsPE(WellsPEInput()).recommendations.joined().contains("D-dimer, and CTPA only if it is positive"))
    }

    func testMildHyperkalaemiaNoInsulinGlucoseModerateKeepsIt() {
        let dx = "Acute kidney injury with hyperkalaemia"
        let mild = plan(ctx(age: 74, diagnosis: dx, potassium: 5.8))
        XCTAssertFalse(matches(#"insulin[–-]glucose: 10 units"#, mild), mild)
        XCTAssertTrue(mild.contains("Mild hyperkalaemia (K⁺ 5.8 mmol/L; 5.5–5.9 — UKKA 2023)"), mild)
        let moderate = plan(ctx(age: 74, diagnosis: dx, potassium: 6.2))
        XCTAssertTrue(moderate.contains("Insulin–glucose: 10 units"), moderate)
        XCTAssertTrue(moderate.contains("nebulised salbutamol withheld"), moderate)
        let severe = plan(ctx(age: 74, diagnosis: dx, potassium: 6.8))
        XCTAssertTrue(severe.contains("Salbutamol 10–20 mg nebulised"), severe)
        // ECG changes: the card lines stay (UKKA 2023 treats ECG changes as an emergency).
        XCTAssertTrue(plan(ctx(age: 74, diagnosis: dx, assessment: "Peaked T waves on the ECG.", potassium: 5.9)).contains("Insulin–glucose: 10 units"))
    }

    func testInjuryOnAnAnticoagulantCTHeadAndReversalReadinessNoBridging() {
        let text = notes(ctx(age: 82, sex: .female, meds: ["Apixaban"], diagnosis: "Minor head injury on apixaban",
                             history: "Tripped at home and hit her forehead on the floor."), operative: false)
        XCTAssertTrue(text.contains("CT head within 8 hours"), text)
        XCTAssertTrue(text.contains("andexanet alfa or four-factor PCC"), text)
        XCTAssertFalse(text.lowercased().contains("bridg"), text)
    }

    func testPregnancyNoOccultMalignancyCTAndUltrasoundFirst() {
        let c = ctx(age: 27, sex: .female, pregnancy: PregnancyContext(status: .pregnant, gestationWeeks: 10))
        let t = line("- CT chest/abdomen/pelvis — occult malignancy screen (alarm symptoms).", c)
        XCTAssertFalse(t.contains("CT chest/abdomen/pelvis — occult malignancy"), t)
        XCTAssertTrue(t.contains("ultrasound first"), t)
    }

    func testChildCTAbdomenIsUltrasoundFirst() {
        let t = line("Investigations: FBC, β-hCG (females), Urinalysis / MSU, CT Abdomen/Pelvis with IV contrast, USS Abdomen.", ctx(age: 9))
        XCTAssertTrue(t.contains("Child: ultrasound first; CT only if ultrasound is inconclusive"), t)
        // Adults are unchanged; a qualified line is not annotated twice.
        let adult = "CT abdomen/pelvis with IV contrast"
        XCTAssertEqual(line(adult, ctx(age: 40)), adult)
        let qualified = "CT abdomen/pelvis if USS equivocal"
        XCTAssertEqual(line(qualified, ctx(age: 9)), qualified)
    }

    func testDDimerIsWithheldInPregnancy() {
        let t = line("D-dimer: high sensitivity (~96%), low specificity — use to rule out only", ctx(age: 31, sex: .female, pregnancy: pregnant22))
        XCTAssertTrue(t.contains("not recommended to diagnose VTE in pregnancy"), t)
        let inv = card(ctx(age: 31, sex: .female, pregnancy: pregnant22, diagnosis: "Deep vein thrombosis"))?.investigations
            .first { $0.name == "D-dimer" }
        XCTAssertTrue(inv?.rationale.contains("not recommended") ?? false, inv?.rationale ?? "")
    }

    // MARK: - NSAID exclusions in every plan line

    func testNSAIDLineWithheldForAgeRenalHeartFailureUlcerOrAnticoagulant() {
        let dose = "- Analgesia: diclofenac 75 mg IM or morphine 2.5 mg IV"
        XCTAssertTrue(line(dose, ctx(age: 81)).contains("avoid NSAIDs — age ≥ 75"))
        XCTAssertTrue(line(dose, ctx(age: 60, pmh: "Chronic kidney disease stage 3a")).contains("renal impairment"))
        XCTAssertTrue(line(dose, ctx(age: 60, pmh: "Heart failure")).contains("heart failure"))
        XCTAssertTrue(line(dose, ctx(age: 60, meds: ["Apixaban 5 mg BD"])).contains("anticoagulant"))
        XCTAssertEqual(line(dose, ctx(age: 45)), dose)
        // A relative's disease is not the patient's; a stop instruction is kept.
        XCTAssertEqual(line(dose, ctx(age: 60, pmh: "Family history: mother heart failure")), dose)
        let stop = "- Stop NSAIDs; dual antiplatelet therapy: cardiology input"
        XCTAssertEqual(line(stop, ctx(age: 81)), stop)
    }

    // MARK: - Family history is not the patient's comorbidity

    func testRelativeEntriesAreRemovedFromThePMHFlags() {
        let pmh = "CONDITIONS: Hypertension, Family history of colorectal cancer (father, 58), Mother type 2 diabetes"
        let flags = PMHFlags.parse(from: PlanSafetyFilter.removingRelativeEntries(pmh))
        XCTAssertTrue(flags.hypertension)
        XCTAssertFalse(flags.malignancy)
        XCTAssertFalse(flags.diabetes)
        XCTAssertTrue(PMHFlags.parse(from: PlanSafetyFilter.removingRelativeEntries("Breast cancer 2019, Hypertension")).malignancy)
    }

    // MARK: - TG18 (age ≥ 75; vasopressors)

    func testTG18CholangitisAgeCriterionIsAtLeast75() throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        let container = try ModelContainer(for: schema, configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        func patient(age: Int) -> Patient {
            let p = Patient(fullName: "Synthetic Patient", sex: .female)
            container.mainContext.insert(p)
            let cal = Calendar.current
            p.dateOfBirth = cal.date(byAdding: .day, value: -30, to: cal.date(byAdding: .year, value: -age, to: Date())!)
            return p
        }
        XCTAssertTrue(PatientScoreAutoPopulator.tokyoCholangitis(patient: patient(age: 75)).0.ageAbove75)
        XCTAssertFalse(PatientScoreAutoPopulator.tokyoCholangitis(patient: patient(age: 74)).0.ageAbove75)
        let p = patient(age: 71)
        p.examGeneral = "Hypotensive; metaraminol boluses given."
        XCTAssertTrue(PatientScoreAutoPopulator.tg18OrganDysfunction(patient: p).cardiovascular)
    }
}
