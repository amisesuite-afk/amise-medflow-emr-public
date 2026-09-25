// LifestylePracticesTests.swift
// Lifestyle history, fasting / sleep safety prompts and evidence-graded non-drug suggestions.
// DRIFT NOTE: these vectors are the first describe block of
// artifacts/dashboard/src/lib/__tests__/lifestyle-practices.test.ts, one for one (same names,
// inputs and expected strings). Twin modules: Services/LifestylePractices.swift and
// lib/triage-engine/src/lifestyle-practices.ts. Change both platforms in the same PR.

import XCTest
@testable import AmiseMedFlow

final class LifestylePracticesTests: XCTestCase {

    private typealias LP = LifestylePractices

    private func history(_ build: (inout LifestyleHistory) -> Void = { _ in }) -> LifestyleHistory {
        var h = LifestyleHistory()
        build(&h)
        return h
    }

    private func ctx(lifestyle: LifestyleHistory = LifestyleHistory(), ageYears: Int? = 45,
                     diagnosisText: String = "", problemText: String = "", complaintText: String = "",
                     medicationText: String = "", bmi: Double? = nil, procedureBooked: Bool = false) -> LP.Context {
        LP.Context(lifestyle: lifestyle, ageYears: ageYears, diagnosisText: diagnosisText,
                   problemText: problemText, complaintText: complaintText, medicationText: medicationText,
                   bmi: bmi, procedureBooked: procedureBooked)
    }

    private func decode(_ json: String) throws -> LifestyleHistory {
        try JSONDecoder().decode(LifestyleHistory.self, from: Data(json.utf8))
    }

    private func ids(_ xs: [LP.Prompt]) -> [String] { xs.map(\.id) }
    private func ids(_ xs: [LP.Suggestion]) -> [String] { xs.map(\.id) }

    func testEmptyRecordIsNotRecorded() {
        let h = LifestyleHistory()
        XCTAssertFalse(h.isRecorded)
        XCTAssertNil(h.summary)
    }

    func testDecodeToleratesUnknownAndMissingValues() throws {
        let h = try decode(#"{"fasting":["ramadan","bogus"],"sleepHours":30,"nightShift":"yes","extra":1}"#)
        XCTAssertEqual(h.fasting, [.ramadan])
        XCTAssertNil(h.sleepHours)
        XCTAssertNil(h.nightShift)
        XCTAssertNil(h.fastingStatus)
        XCTAssertEqual(try decode(#"{"fasting":["none","ramadan"]}"#).fasting, [.ramadan])
        XCTAssertEqual(try decode(#"{"sleepHours":5.5,"fastingStatus":"planned"}"#).sleepHours, 5.5)
        XCTAssertNil(try decode(#"{"fastingStatus":"sometimes"}"#).fastingStatus)
        // PathwayData written before this field existed still decodes, with nothing recorded.
        let pd = try JSONDecoder().decode(PathwayData.self, from: Data(#"{"burns":{}}"#.utf8))
        XCTAssertFalse(pd.lifestyle.isRecorded)
    }

    func testSummaryWording() {
        XCTAssertEqual(history {
            $0.fasting = [.ramadan]; $0.fastingStatus = .current; $0.therapies = [.acupuncture, .yoga]
            $0.nightShift = true; $0.sleepHours = 5
        }.summary, "Fasting: Ramadan (currently fasting). Complementary therapies: Acupuncture, Yoga. Night-shift work; usual sleep 5 h a night.")
        XCTAssertEqual(history { $0.fasting = [.notFasting]; $0.nightShift = false }.summary,
                       "No religious or ritual fasting. No night-shift work.")
        XCTAssertEqual(history {
            $0.fasting = [.other]; $0.fastingOther = "Ethiopian Orthodox fasts"; $0.fastingStatus = .planned
            $0.fastingWhen = "Hudadi, March"
        }.summary, "Fasting: Ethiopian Orthodox fasts (next planned: Hudadi, March).")
        XCTAssertEqual(history { $0.fasting = [.danielFast, .timeRestricted]; $0.fastingStatus = .notCurrently }.summary,
                       "Fasting: Daniel Fast, Time-restricted eating / intermittent fasting (not currently fasting).")
        XCTAssertEqual(history { $0.sleepHours = 5.5 }.summary, "Usual sleep 5.5 h a night.")
        XCTAssertEqual(history { $0.therapies = [.other] }.summary, "Complementary therapies: Other.")
        XCTAssertEqual(history { $0.therapies = [.detoxCleanse, .ivVitaminDrips] }.summary,
                       "Complementary therapies: Detox or cleanse programmes, IV vitamin drips.")
    }

    func testNoneIsExclusive() {
        var h = LifestyleHistory()
        h.toggleFasting(.ramadan)
        XCTAssertEqual(h.fasting, [.ramadan])
        h.fastingStatus = .current
        h.toggleFasting(.notFasting)
        XCTAssertEqual(h.fasting, [.notFasting])
        XCTAssertNil(h.fastingStatus)
        h.toggleFasting(.danielFast)
        XCTAssertEqual(h.fasting, [.danielFast])
        var t = LifestyleHistory()
        t.toggleTherapy(.yoga); t.toggleTherapy(.yoga)
        XCTAssertEqual(t.therapies, [])
    }

    func testHelpersForOtherModules() {
        XCTAssertTrue(history { $0.therapies = [.detoxCleanse] }.usesDetoxOrCleanse)
        XCTAssertFalse(history { $0.therapies = [.yoga] }.usesDetoxOrCleanse)
        XCTAssertTrue(history { $0.therapies = [.ivVitaminDrips] }.usesIvVitaminDrips)
        XCTAssertFalse(LifestyleHistory().usesIvVitaminDrips)
    }

    func testFastingWithInsulinOrSulfonylureaWarns() {
        let ramadan = history { $0.fasting = [.ramadan]; $0.fastingStatus = .current }
        let su = LP.safetyPrompts(ctx(lifestyle: ramadan, problemText: "Type 2 diabetes", medicationText: "Gliclazide 80 mg BD"))
        XCTAssertEqual(ids(su), ["fasting-diabetes-insulin-su"])
        XCTAssertEqual(su.first?.grade, .warning)
        XCTAssertEqual(su.first?.text, LP.PromptText.fastingInsulin)
        XCTAssertEqual(su.first?.text, "Fasting with insulin/sulfonylurea: risk of hypoglycaemia and dehydration — pre-fast risk stratification and medication review recommended (IDF-DAR 2021).")
        let insulin = LP.safetyPrompts(ctx(lifestyle: ramadan, problemText: "Diabetic", medicationText: "Lantus 20 units nocte"))
        XCTAssertEqual(ids(insulin), ["fasting-diabetes-insulin-su"])
        // Insulin written in the problem list counts too.
        let inPmh = LP.safetyPrompts(ctx(lifestyle: ramadan, problemText: "Type 1 diabetes on insulin pump"))
        XCTAssertEqual(ids(inPmh), ["fasting-diabetes-insulin-su"])
    }

    func testFastingWithDiabetesOnOtherAgentsIsLowerGrade() {
        let lent = history { $0.fasting = [.orthodoxLent]; $0.fastingStatus = .planned; $0.fastingWhen = "Lent" }
        let p = LP.safetyPrompts(ctx(lifestyle: lent, problemText: "T2DM", medicationText: "Metformin 500 mg BD"))
        XCTAssertEqual(ids(p), ["fasting-diabetes"])
        XCTAssertEqual(p.first?.grade, .caution)
        XCTAssertEqual(p.first?.text, "Fasting with diabetes: risk of hypoglycaemia and dehydration — pre-fast risk stratification recommended (IDF-DAR 2021).")
        // "Non-insulin-dependent" is not insulin.
        let niddm = LP.safetyPrompts(ctx(lifestyle: lent, problemText: "Non-insulin-dependent diabetes"))
        XCTAssertEqual(ids(niddm), ["fasting-diabetes"])
    }

    func testFastingPromptsNeedDiabetesAndAnActiveFast() {
        let ramadan = history { $0.fasting = [.ramadan] }   // status not recorded: still counts
        XCTAssertEqual(ids(LP.safetyPrompts(ctx(lifestyle: ramadan, problemText: "Diabetes mellitus", medicationText: "Insulin glargine"))),
                       ["fasting-diabetes-insulin-su"])
        let notNow = history { $0.fasting = [.ramadan]; $0.fastingStatus = .notCurrently }
        XCTAssertEqual(LP.safetyPrompts(ctx(lifestyle: notNow, problemText: "Diabetes mellitus", medicationText: "Insulin glargine")), [])
        let none = history { $0.fasting = [.notFasting] }
        XCTAssertEqual(LP.safetyPrompts(ctx(lifestyle: none, problemText: "Diabetes mellitus", medicationText: "Insulin glargine")), [])
        XCTAssertEqual(LP.safetyPrompts(ctx(lifestyle: ramadan, problemText: "No diabetes", medicationText: "Insulin glargine")), [])
        XCTAssertEqual(LP.safetyPrompts(ctx(lifestyle: ramadan, problemText: "Pre-diabetes")), [])
        XCTAssertEqual(LP.safetyPrompts(ctx(lifestyle: ramadan, problemText: "Diabetes insipidus")), [])
        XCTAssertEqual(LP.safetyPrompts(ctx(lifestyle: ramadan, problemText: "Insulin resistance")), [])
        // Time-restricted eating with insulin also warns (fasting windows).
        let tre = history { $0.fasting = [.timeRestricted]; $0.fastingStatus = .current }
        XCTAssertEqual(ids(LP.safetyPrompts(ctx(lifestyle: tre, problemText: "Type 2 diabetes", medicationText: "Humalog"))),
                       ["fasting-diabetes-insulin-su"])
    }

    func testReligiousFastWithABookedProcedure() {
        let ramadan = history { $0.fasting = [.ramadan]; $0.fastingStatus = .current }
        let p = LP.safetyPrompts(ctx(lifestyle: ramadan, procedureBooked: true))
        XCTAssertEqual(ids(p), ["fasting-perioperative"])
        XCTAssertEqual(p.first?.text, "Religious fast overlaps the pre-operative fast — check hydration and glucose plan.")
        // Both prompts, most serious first.
        let both = LP.safetyPrompts(ctx(lifestyle: ramadan, problemText: "Type 2 diabetes", medicationText: "Glimepiride", procedureBooked: true))
        XCTAssertEqual(ids(both), ["fasting-diabetes-insulin-su", "fasting-perioperative"])
        // Time-restricted eating is not a religious fast; no procedure, no prompt.
        let tre = history { $0.fasting = [.timeRestricted]; $0.fastingStatus = .current }
        XCTAssertEqual(LP.safetyPrompts(ctx(lifestyle: tre, procedureBooked: true)), [])
        XCTAssertEqual(LP.safetyPrompts(ctx(lifestyle: ramadan, procedureBooked: false)), [])
    }

    func testNightShiftAndShortSleepInCardiometabolicContext() {
        let shift = history { $0.nightShift = true }
        let p = LP.safetyPrompts(ctx(lifestyle: shift, problemText: "Hypertension"))
        XCTAssertEqual(ids(p), ["night-shift-short-sleep"])
        XCTAssertEqual(p.first?.grade, .info)
        XCTAssertEqual(p.first?.text, "Night-shift work / short sleep is associated with metabolic, cardiovascular and mood disorders.")
        XCTAssertEqual(LP.safetyPrompts(ctx(lifestyle: shift, problemText: "Inguinal hernia")), [])
        XCTAssertEqual(ids(LP.safetyPrompts(ctx(lifestyle: history { $0.sleepHours = 5 }, bmi: 32))), ["night-shift-short-sleep"])
        XCTAssertEqual(LP.safetyPrompts(ctx(lifestyle: history { $0.sleepHours = 6 }, bmi: 32)), [])
        XCTAssertEqual(ids(LP.safetyPrompts(ctx(lifestyle: history { $0.sleepHours = 5.5 }, problemText: "Hypercholesterolaemia"))),
                       ["night-shift-short-sleep"])
        XCTAssertEqual(LP.safetyPrompts(ctx(lifestyle: history { $0.nightShift = false; $0.sleepHours = 7 }, problemText: "Hypertension")), [])
    }

    func testTaiChiForOlderAdultsAndFalls() {
        let s65 = LP.planSuggestions(ctx(ageYears: 65))
        XCTAssertEqual(ids(s65), ["tai-chi"])
        XCTAssertEqual(s65.first?.evidence, .works)
        XCTAssertEqual(s65.first?.reason, "Age 65 (≥ 65)")
        XCTAssertEqual(s65.first?.planLine, "Non-drug: tai chi programme for balance and falls prevention (evidence: works — 24 RCTs, falls RR 0.76; Huang ZG et al. 2023).")
        XCTAssertEqual(LP.planSuggestions(ctx(ageYears: 64)), [])
        XCTAssertEqual(LP.planSuggestions(ctx(ageYears: nil)), [])
        let falls = LP.planSuggestions(ctx(ageYears: 58, problemText: "Recurrent falls"))
        XCTAssertEqual(falls.first?.reason, "falls or frailty recorded")
        let postOp = LP.planSuggestions(ctx(ageYears: 70, problemText: "Frail", procedureBooked: true))
        XCTAssertEqual(postOp.first?.reason, "Age 70 (≥ 65); falls or frailty recorded; post-operative rehabilitation")
    }

    func testBackPainSuggestsYogaAndAcupuncture() {
        let s = LP.planSuggestions(ctx(complaintText: "Chronic low back pain"))
        XCTAssertEqual(ids(s), ["yoga", "acupuncture"])
        XCTAssertEqual(s.first?.evidence, .works)
        XCTAssertEqual(s.first?.planLine, LP.PlanLines.yoga)
        XCTAssertEqual(s.last?.evidence, .modest)
        XCTAssertEqual(LP.planSuggestions(ctx(complaintText: "Abdominal pain. No back pain")), [])
        XCTAssertEqual(ids(LP.planSuggestions(ctx(problemText: "Osteoarthritis of the knee"))), ["acupuncture"])
        XCTAssertEqual(ids(LP.planSuggestions(ctx(problemText: "Migraine"))), ["acupuncture"])
        let already = LP.planSuggestions(ctx(lifestyle: history { $0.therapies = [.yoga] }, complaintText: "Back pain"))
        XCTAssertEqual(already.first?.alreadyUsed, true)
        XCTAssertEqual(already.last?.alreadyUsed, false)
    }

    func testDepressionSuggestsMbctReferral() {
        let s = LP.planSuggestions(ctx(problemText: "Recurrent depression"))
        XCTAssertEqual(ids(s), ["mbct"])
        XCTAssertEqual(s.first?.planLine, "Referral option: mindfulness-based cognitive therapy (MBCT) for relapse prevention in recurrent depression (evidence: works — HR 0.69; Kuyken W et al., JAMA Psychiatry 2016).")
        XCTAssertEqual(LP.planSuggestions(ctx(problemText: "ST depression on ECG")), [])
        XCTAssertEqual(LP.planSuggestions(ctx(problemText: "No depression")), [])
    }

    func testAnxietySuggestsSlowBreathing() {
        let s = LP.planSuggestions(ctx(problemText: "Anxiety", procedureBooked: true))
        XCTAssertEqual(ids(s), ["slow-breathing"])
        XCTAssertEqual(s.first?.evidence, .modest)
        XCTAssertEqual(s.first?.reason, "Anxiety recorded; procedure booked")
        XCTAssertTrue(s.first?.planLine.contains("not a treatment for high blood pressure") ?? false)
        XCTAssertEqual(LP.planSuggestions(ctx(problemText: "Anxious about the procedure")).first?.reason, "Anxiety recorded")
    }

    func testTimeRestrictedEatingNeedsObesity() {
        let s = LP.planSuggestions(ctx(bmi: 32))
        XCTAssertEqual(ids(s), ["time-restricted-eating"])
        XCTAssertEqual(s.first?.reason, "BMI 32 (≥ 30)")
        XCTAssertEqual(s.first?.planLine, LP.PlanLines.timeRestricted)
        XCTAssertEqual(LP.planSuggestions(ctx(bmi: 31.26)).first?.reason, "BMI 31.3 (≥ 30)")
        XCTAssertEqual(LP.planSuggestions(ctx(bmi: 29.9)), [])
        XCTAssertEqual(LP.planSuggestions(ctx(problemText: "Obesity")).first?.reason, "Obesity recorded")
        // Diabetes on insulin / a sulfonylurea: only with the fasting safety note.
        let dm = LP.planSuggestions(ctx(problemText: "Type 2 diabetes", medicationText: "Insulin glargine", bmi: 33))
        XCTAssertEqual(dm.first?.planLine, "\(LP.PlanLines.timeRestricted) \(LP.PlanLines.timeRestrictedDiabetesNote)")
        let metformin = LP.planSuggestions(ctx(problemText: "Type 2 diabetes", medicationText: "Metformin", bmi: 33))
        XCTAssertEqual(metformin.first?.planLine, LP.PlanLines.timeRestricted)
    }

    func testNoBenefitInformationOnlyWhenRecorded() {
        XCTAssertEqual(LP.planSuggestions(ctx()), [])
        let s = LP.planSuggestions(ctx(lifestyle: history { $0.therapies = [.cupping, .detoxCleanse, .ivVitaminDrips] }))
        XCTAssertEqual(ids(s), ["counsel-cupping", "counsel-detox", "counsel-iv-drips"])
        XCTAssertEqual(s.map(\.evidence), [.noBenefit, .noBenefit, .mixed])
        XCTAssertTrue(s.allSatisfy { $0.kind == .counsel })
        XCTAssertEqual(s[1].planLine, "Discussed detox teas / colon cleanses: no reliable evidence of benefit; risks of dehydration, electrolyte disturbance and laxative dependence.")
        let other = LP.planSuggestions(ctx(lifestyle: history { $0.therapies = [.other]; $0.therapiesOther = "Colon cleanse" }))
        XCTAssertEqual(ids(other), ["counsel-detox"])
    }

    func testAppendPlanLine() {
        XCTAssertEqual(LP.appendPlanLine("", "Line"), "Line")
        XCTAssertEqual(LP.appendPlanLine("Plan\n", "Line"), "Plan\nLine")
        XCTAssertEqual(LP.appendPlanLine("Plan\nLine", "Line"), "Plan\nLine")
    }
}
