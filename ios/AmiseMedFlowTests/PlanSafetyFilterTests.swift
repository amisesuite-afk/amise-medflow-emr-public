import XCTest
@testable import AmiseMedFlow

/// PlanSafetyFilter — the Swift twin of the web plan-safety filter.
///
/// DRIFT NOTE: these vectors are ported from `lib/pane-engine/src/__tests__/planSafety.test.ts`
/// (web) for `ios/AmiseMedFlow/Services/PlanSafetyFilter*.swift`, the twin of
/// `lib/pane-engine/src/management/planSafety.ts`. Change the rule and both test files together.
/// The web tests adapt a protocol object; iOS has none, so the same patient situations are run
/// through the line filter (`adaptLine`/`adaptText`) and the note builder (`evaluate`) with the
/// plan shape a radiation card gives.
final class PlanSafetyFilterTests: XCTestCase {

    private func ctx(age: Int? = 45, sex: Sex = .male, pregnancy: PregnancyContext = .none,
                     allergies: [AllergyEntry] = [], meds: [String] = [], pmh: String = "",
                     diagnosis: String = "", assessment: String = "", egfr: Double? = nil) -> RadiationContext {
        var c = RadiationContext(ageYears: age, pregnancy: pregnancy, allergies: allergies, medications: meds, pmhText: pmh)
        c.sex = sex
        c.diagnosis = diagnosis
        c.assessment = assessment
        c.egfr = egfr
        return c
    }

    private func notes(_ c: RadiationContext, operative: Bool = true, bleeding: Bool = false,
                       cancer: Bool = false, emergencyCard: Bool = false) -> [PlanSafetyFilter.Note] {
        var shape = PlanSafetyFilter.PlanShape()
        shape.operative = operative
        shape.bleedingCard = bleeding
        shape.cancer = cancer
        shape.emergencyCard = emergencyCard
        return PlanSafetyFilter.evaluate(PlanSafetyFilter.signals(c), shape: shape).notes
    }

    private func noteText(_ n: [PlanSafetyFilter.Note]) -> String { n.map(\.text).joined(separator: "\n") }

    private let anaphylaxis = AllergyEntry(name: "Penicillin", severity: "Severe", reaction: "Anaphylaxis")

    // MARK: - Allergy cross-check (class-aware)

    func testPenicillinAnaphylaxisWithholdsCoAmoxiclavWithAnAlternative() {
        let s = PlanSafetyFilter.signals(ctx(allergies: [anaphylaxis]))
        let v = PlanSafetyFilter.adaptLine("- IV co-amoxiclav 1.2 g TDS", s)
        XCTAssertTrue(v.text.contains("penicillin allergy recorded"), v.text)
        XCTAssertTrue(v.text.contains("Alternative:"), v.text)
        XCTAssertNotNil(v.withheld)
        // Immediate reaction: other beta-lactams withheld too (iOS, BNF).
        let ceph = PlanSafetyFilter.adaptLine("- Cefuroxime 1.5 g IV", s)
        XCTAssertTrue(ceph.text.contains("ALLERGY"), ceph.text)
    }

    func testNonImmediatePenicillinReactionKeepsCephalosporinsWithACaution() {
        let c = ctx(allergies: [AllergyEntry(name: "Amoxicillin", severity: "Mild", reaction: "rash")])
        let s = PlanSafetyFilter.signals(c)
        XCTAssertEqual(PlanSafetyFilter.adaptLine("- Cefuroxime 1.5 g IV", s).text, "- Cefuroxime 1.5 g IV")
        XCTAssertTrue(noteText(notes(c)).contains("check the reaction type"))
    }

    func testANegatedMentionIsNotWithheld() {
        let s = PlanSafetyFilter.signals(ctx(allergies: [AllergyEntry(name: "ibuprofen", severity: "Moderate", reaction: "")]))
        XCTAssertEqual(PlanSafetyFilter.adaptText("Paracetamol; avoid NSAIDs.", s), "Paracetamol; avoid NSAIDs.")
    }

    func testAllergyClassesAndNKDA() {
        XCTAssertTrue(PlanSafetyFilter.allergyProfile([AllergyEntry(name: "NKDA", severity: "", reaction: "")]).classes.isEmpty)
        XCTAssertTrue(PlanSafetyFilter.allergyProfile([AllergyEntry(name: "Augmentin", severity: "", reaction: "")]).classes.contains { $0.id == "penicillin" })
        XCTAssertTrue(PlanSafetyFilter.allergyProfile([AllergyEntry(name: "latex", severity: "", reaction: "")]).latex)
    }

    // MARK: - Pregnancy

    func testDVTInPregnancyWithholdsDOACsAndWarfarin() {
        let c = ctx(age: 30, sex: .female, pregnancy: PregnancyContext(status: .pregnant, gestationWeeks: 22))
        let s = PlanSafetyFilter.signals(c)
        let v = PlanSafetyFilter.adaptLine("- Rivaroxaban 15 mg BD for 21 days", s)
        XCTAssertTrue(v.text.contains("LMWH"), v.text)
        XCTAssertTrue(noteText(notes(c)).contains("obstetric"))
    }

    func testNoNSAIDsFrom20WeeksAnnotatedBefore() {
        let late = PlanSafetyFilter.signals(ctx(age: 30, sex: .female, pregnancy: PregnancyContext(status: .pregnant, gestationWeeks: 26)))
        XCTAssertTrue(PlanSafetyFilter.adaptLine("Ibuprofen 400 mg TDS", late).text.contains("withheld"))
        let early = PlanSafetyFilter.signals(ctx(age: 30, sex: .female, pregnancy: PregnancyContext(status: .pregnant, gestationWeeks: 12)))
        XCTAssertTrue(PlanSafetyFilter.adaptLine("Ibuprofen 400 mg TDS", early).text.contains("only if the benefit outweighs the risk"))
    }

    func testPregnancyNotDocumentedGivesBetaHCGResultRequiredNeverConfirmedNegative() {
        let c = ctx(age: 30, sex: .female, diagnosis: "Acute cholecystitis", assessment: "Laparoscopic cholecystectomy")
        let e = PlanSafetyFilter.evaluate(PlanSafetyFilter.signals(c), shape: {
            var sh = PlanSafetyFilter.PlanShape(); sh.operative = true; return sh }())
        let text = noteText(e.notes)
        XCTAssertTrue(text.contains("β-HCG: result required"), text)
        XCTAssertFalse(text.lowercased().contains("confirmed negative"))
        XCTAssertTrue(e.extraInvestigations.contains { $0.name.hasPrefix("Pregnancy test") })
    }

    func testTamoxifenIsWithheldInPregnancy() {
        let s = PlanSafetyFilter.signals(ctx(age: 34, sex: .female, pregnancy: PregnancyContext(status: .pregnant, gestationWeeks: 18)))
        XCTAssertTrue(PlanSafetyFilter.adaptLine("- Adjuvant: tamoxifen if ER+", s).text.contains("withheld"))
    }

    func testPregnancyHeaderDoesNotReadAsARecommendation() {
        let r = DiagnosisRadiationEngine.radiate(workingDiagnosis: "Severe pre-eclampsia with HELLP syndrome", ageYears: 30, sex: .female,
                                                 context: ctx(age: 30, sex: .female, pregnancy: PregnancyContext(status: .pregnant, gestationWeeks: 34)))
        let plan = (r?.planTemplate ?? "").lowercased()
        XCTAssertFalse(plan.contains("ace inhibitor"), plan)
    }

    // MARK: - Under 16

    func testUnder16AdultDosesReplacedPerBNFc() {
        let c = ctx(age: 7)
        let s = PlanSafetyFilter.signals(c)
        let v = PlanSafetyFilter.adaptLine("- Analgesia: paracetamol 1 g IV; Hartmann's 1 L over 2 h", s)
        XCTAssertTrue(v.text.contains("calculate per BNFc"), v.text)
        XCTAssertFalse(v.text.contains("1 g"), v.text)
        XCTAssertFalse(v.text.contains("1 L"), v.text)
        XCTAssertTrue(notes(c).contains { $0.kind == .paediatric })
    }

    func testInfantHerniaNoMeshNoTEPTAPPNoTruss() {
        let r = DiagnosisRadiationEngine.radiate(workingDiagnosis: "Right inguinal hernia in an infant (reducible)", ageYears: 0, sex: .male,
                                                 context: ctx(age: 0))
        let plan = r?.planTemplate ?? ""
        XCTAssertNil(plan.range(of: #"\b(mesh repair|lichtenstein|tep|tapp|truss)\b"#, options: [.regularExpression, .caseInsensitive]), plan)
        XCTAssertTrue(plan.contains("herniotomy"))
        XCTAssertTrue(plan.contains("Infant"))
    }

    func testNoAdultVTELineForChildren() {
        XCTAssertFalse(notes(ctx(age: 7), operative: true).contains { $0.kind == .vte })
    }

    // MARK: - Peri-operative lines

    func testOperativePlanGetsARenalAdjustedVTELine() {
        let n = notes(ctx(age: 70, egfr: 22), operative: true, cancer: true)
        let vte = n.first { $0.kind == .vte }?.text ?? ""
        XCTAssertTrue(vte.contains("NICE NG89"), vte)
        XCTAssertTrue(vte.contains("enoxaparin 20 mg"), vte)
        XCTAssertTrue(vte.contains("28 days"), vte)
    }

    func testBleedingOnWarfarinReversalNoHeparinSubstitution() {
        let text = noteText(notes(ctx(meds: ["Warfarin"]), operative: false, bleeding: true))
        XCTAssertTrue(text.contains("prothrombin complex concentrate"))
        XCTAssertTrue(text.contains("No heparin substitution"))
        XCTAssertFalse(text.lowercased().contains("bridg"))
    }

    func testWarfarinAndDiagnosticOGDContinueWarfarin() {
        let text = noteText(notes(ctx(meds: ["warfarin"], assessment: "Diagnostic OGD ± biopsy (low bleeding-risk)."), operative: false))
        XCTAssertTrue(text.contains("continue warfarin"), text)
    }

    func testApixabanAndElectiveSurgeryPAUSEWithoutBridging() {
        let text = noteText(notes(ctx(meds: ["apixaban 5 mg BD"], assessment: "Elective inguinal hernia repair")))
        XCTAssertNotNil(text.range(of: #"PAUSE 2019[\s\S]*No bridging"#, options: .regularExpression), text)
    }

    func testEmergencyLaparotomyOnApixabanReversalDiscussionAndNELA() {
        let text = noteText(notes(ctx(age: 84, meds: ["apixaban"],
                                      assessment: "Perforated diverticulitis, faecal peritonitis. Emergency laparotomy (Hartmann's).")))
        XCTAssertTrue(text.contains("Emergency surgery on apixaban"), text)
        XCTAssertTrue(text.contains("NELA"), text)
    }

    func testRecentCoronaryStentDefersElectiveSurgery() {
        let text = noteText(notes(ctx(meds: ["aspirin", "clopidogrel"], pmh: "Drug-eluting coronary stent 3 months ago (NSTEMI)",
                                      assessment: "Elective inguinal hernia repair")))
        XCTAssertTrue(text.contains("defer elective surgery until 12 months"), text)
    }

    func testSGLT2WithheldDayBeforeAndDayOf() {
        let text = noteText(notes(ctx(meds: ["empagliflozin"], assessment: "Laparoscopic cholecystectomy")))
        XCTAssertTrue(text.contains("withhold the day before and the day of the procedure (CPOC 2021"), text)
    }

    func testLongTermPrednisoloneSteroidCover() {
        XCTAssertTrue(notes(ctx(meds: ["prednisolone 10 mg"])).contains { $0.kind == .steroid && $0.text.contains("hydrocortisone 100 mg") })
    }

    func testType1DiabetesBasalInsulinAndKetones() {
        let c = ctx(meds: ["insulin glargine"], pmh: "Type 1 diabetes")
        var shape = PlanSafetyFilter.PlanShape(); shape.operative = true
        let e = PlanSafetyFilter.evaluate(PlanSafetyFilter.signals(c), shape: shape)
        XCTAssertTrue(noteText(e.notes).contains("continue basal (long-acting) insulin"))
        XCTAssertTrue(e.extraInvestigations.contains { $0.name.contains("ketones") })
    }

    func testAnaestheticHazards() {
        let text = noteText(notes(ctx(allergies: [AllergyEntry(name: "Latex", severity: "Severe", reaction: "Anaphylaxis")],
                                      pmh: "Suxamethonium apnoea (mother)")))
        XCTAssertTrue(text.contains("Suxamethonium apnoea"))
        XCTAssertTrue(text.contains("latex-free"))
    }

    // MARK: - Procedure detection

    func testProcedureDetection() {
        func proc(_ a: String, operative: Bool = false) -> PlanSafetyFilter.ProcedureKind {
            PlanSafetyFilter.procedure(PlanSafetyFilter.signals(ctx(assessment: a)), operative: operative)
        }
        XCTAssertEqual(proc("Diagnostic OGD (low bleeding-risk)"), .endoscopyLow)
        XCTAssertEqual(proc("Ileus day 4 after right hemicolectomy"), .none)
        XCTAssertEqual(proc("ERCP with sphincterotomy", operative: true), .endoscopyHigh)
        XCTAssertFalse(PlanSafetyFilter.activeBleeding(PlanSafetyFilter.signals(ctx(assessment: "Low bleeding-risk procedure"))))
    }

    // MARK: - Choke points

    func testPipelineDecisionLinesAreFilteredForChildren() {
        let d = ClinicalDecision(title: "Acute Appendicitis", rationale: "", priority: .urgent,
                                 actions: ["Anti-emetic: ondansetron 4 mg IV", "IV fluid: Hartmann's 1 L over 2–4 h"],
                                 investigations: [], disposition: .urgentAdmission, drivingDiagnosis: nil, drivingScore: nil,
                                 evidenceBasis: "")
        let out = PlanSafetyFilter.adaptDecision(d, PlanSafetyFilter.signals(ctx(age: 5)))
        XCTAssertFalse(out.actions.joined().contains("4 mg"), out.actions.joined())
        XCTAssertFalse(out.actions.joined().contains("1 L"), out.actions.joined())
    }

    func testSOAPDraftPlanCarriesThePatientSpecificLines() {
        let text = DiagnosisRadiationEngine.draftPlanSafety(
            "Routine follow-up as arranged.",
            context: ctx(age: 49, sex: .female, meds: ["Prednisolone 10 mg"],
                         diagnosis: "Pre-operative assessment — symptomatic gallstones on long-term prednisolone",
                         assessment: "Symptomatic cholelithiasis for laparoscopic cholecystectomy. Post-menopausal."))
        XCTAssertTrue(text.contains("hydrocortisone"), text)
    }

    // MARK: - Emergency redirect (never Victoria Hospital)

    func testNoCardNamesVictoriaHospital() {
        XCTAssertFalse(EmergencyRedirect.text.contains("Victoria"))
        for entry in DiagnosisRadiationEngine.lookupOrder {
            let r = entry.radiation
            let refs = (DiagnosisRadiationEngine.additionalReferralTable[r.conditionName] ?? [])
                .map { "\($0.specialty) \($0.reason) \($0.notes ?? "")" }
            let all = ([r.planTemplate, r.followUp, r.urgencyNote ?? ""] + r.redFlags + refs
                       + r.investigations.map { "\($0.name) \($0.rationale)" }).joined(separator: "\n")
            XCTAssertFalse(all.contains("Victoria"), r.conditionName)
        }
    }

    func testEveryRedirectCardNamesTheHospitalsAnd911() {
        for entry in DiagnosisRadiationEngine.lookupOrder where entry.radiation.planTemplate.contains("RECOGNISE AND REDIRECT") {
            let plan = entry.radiation.planTemplate
            XCTAssertTrue(plan.contains("911") && plan.contains("OKEU Hospital") && plan.contains("St Jude's Hospital")
                          && plan.contains("Tapion Hospital"), entry.radiation.conditionName)
        }
    }
}
