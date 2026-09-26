import XCTest
import SwiftData
@testable import AmiseMedFlow

@MainActor
final class ConsultPathwayTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
    }

    private func patient(_ name: String = "Test Patient", cc: String? = nil,
                         setting: ClinicalSetting = .outpatient, visitType: VisitType? = nil) -> Patient {
        let p = Patient(fullName: name, setting: setting)
        p.chiefComplaint = cc
        p.visitType = visitType
        context.insert(p)
        return p
    }

    // MARK: - Recommendation

    func testNoHistoryRecommendsFirstVisit() {
        XCTAssertEqual(ConsultPathway.recommend(for: patient()).pathway, .firstVisit)
    }

    func testBurnComplaintRecommendsBurns() {
        XCTAssertEqual(ConsultPathway.recommend(for: patient(cc: "Scald to left forearm")).pathway, .burns)
    }

    func testTraumaComplaintRecommendsTrauma() {
        XCTAssertEqual(ConsultPathway.recommend(for: patient(cc: "RTA, chest pain")).pathway, .trauma)
    }

    func testInpatientRecommendsWardReview() {
        XCTAssertEqual(ConsultPathway.recommend(for: patient(setting: .inpatient)).pathway, .wardReview)
    }

    func testEndoscopyBookingRecommendsProcedure() {
        XCTAssertEqual(ConsultPathway.recommend(for: patient(visitType: .ercp)).pathway, .procedure)
    }

    func testCheckUpComplaintRecommendsWellness() {
        XCTAssertEqual(ConsultPathway.recommend(for: patient(cc: "Annual check-up")).pathway, .wellness)
    }

    // Keywords match whole words: "burn" used to fire inside "Heartburn" and "burning", "flame"
    // inside "inflamed", "stab" inside "stable", "rta" inside "portal", "crush" inside "crushing".
    func testSubstringsDoNotSuggestBurnsOrTrauma() {
        for cc in ["Heartburn for 3 months", "Burning epigastric pain", "Inflamed umbilical hernia",
                   "Crushing central chest pain", "Portal hypertension", "Stable angina, for hernia repair",
                   "Abdominal pain, no trauma"] {
            XCTAssertEqual(ConsultPathway.recommend(for: patient(cc: cc)).pathway, .firstVisit, cc)
        }
    }

    func testBurnAndTraumaWordsStillMatch() {
        for cc in ["Burns to both hands", "Burnt left hand with hot oil", "Flame burn to chest"] {
            XCTAssertEqual(ConsultPathway.recommend(for: patient(cc: cc)).pathway, .burns, cc)
        }
        for cc in ["Stab wound to abdomen", "Stabbed in the chest", "Crush injury left foot",
                   "Head injuries after a fall"] {
            XCTAssertEqual(ConsultPathway.recommend(for: patient(cc: cc)).pathway, .trauma, cc)
        }
    }

    // MARK: - Mapping

    func testVisitTypeMapping() {
        XCTAssertEqual(ConsultPathway.from(.postOp), .followUp)
        XCTAssertEqual(ConsultPathway.from(.colonoscopy), .procedure)
        XCTAssertEqual(ConsultPathway.from(.burns), .burns)
        XCTAssertNil(ConsultPathway.from(nil))
    }

    func testChoosingPathwayKeepsSpecificVisitType() {
        XCTAssertEqual(ConsultPathway.procedure.visitType(keeping: .ercp), .ercp)
        XCTAssertEqual(ConsultPathway.procedure.visitType(keeping: .followUp), .dayOfSurgery)
        XCTAssertEqual(ConsultPathway.wellness.visitType(keeping: nil), .wellness)
    }

    func testEveryPathwayHasSteps() {
        for p in ConsultPathway.allCases {
            XCTAssertFalse(p.steps.isEmpty, "\(p) has no steps")
            XCTAssertEqual(Set(p.steps).count, p.steps.count, "\(p) repeats a step")
        }
        XCTAssertEqual(ConsultPathway.burns.steps.first, .burns)
        XCTAssertEqual(ConsultPathway.wellness.steps.first, .screening)
        XCTAssertEqual(ConsultPathway.wardReview.steps.first, .ward)
        // Procedure pathway walks through the pre-op checklist and consent before the plan.
        let proc = ConsultPathway.procedure.steps
        XCTAssertLessThan(proc.firstIndex(of: .preop)!, proc.firstIndex(of: .consent)!)
        XCTAssertLessThan(proc.firstIndex(of: .consent)!, proc.firstIndex(of: .plan)!)
    }

    // MARK: - Risk snapshot

    func testSevereAllergyIsHighRisk() {
        let p = patient()
        p.allergies = [AllergyEntry(name: "Penicillin", severity: "Severe", reaction: "Anaphylaxis")]
        let flags = VisitRiskAssessment.assess(p, pathway: .firstVisit)
        XCTAssertEqual(VisitRiskAssessment.overall(flags), .high)
        XCTAssertTrue(flags.contains { $0.title.contains("Penicillin") })
    }

    func testStoredRiskScoresAreFlagged() {
        let p = patient()
        p.asaClass = 4
        p.stopBangScore = 3
        p.gcsScore = 7
        let flags = VisitRiskAssessment.assess(p, pathway: .procedure)
        XCTAssertTrue(flags.contains { $0.title == "ASA 4" && $0.level == .high })
        XCTAssertTrue(flags.contains { $0.title == "STOP-BANG 3" && $0.level == .moderate })
        XCTAssertTrue(flags.contains { $0.title == "GCS 7" && $0.level == .high })
        XCTAssertFalse(flags.contains { $0.title == "No ASA / RCRI recorded" })
    }

    func testProcedureWithoutASAPromptsForScores() {
        let flags = VisitRiskAssessment.assess(patient(), pathway: .procedure)
        XCTAssertTrue(flags.contains { $0.title == "No ASA / RCRI recorded" })
    }

    func testNegatedDiabetesAndSmokingAreNotRiskFlags() {
        let p = patient()
        p.pmhNotes = "No diabetes. Hypertension."
        p.socialHistory = "Does not smoke"
        let flags = VisitRiskAssessment.assess(p, pathway: .firstVisit)
        XCTAssertFalse(flags.contains { $0.title == "Diabetes" })
        XCTAssertFalse(flags.contains { $0.title == "Smoker" })

        let q = patient("Second Patient")
        q.pmhNotes = "Type 2 diabetes"
        q.socialHistory = "Smokes 20 a day"
        let qFlags = VisitRiskAssessment.assess(q, pathway: .firstVisit)
        XCTAssertTrue(qFlags.contains { $0.title == "Diabetes" })
        XCTAssertTrue(qFlags.contains { $0.title == "Smoker" })
    }

    func testScoreAutoFillIgnoresNegatedHistory() {
        let p = patient()
        p.pmhNotes = "No history of DVT or PE. No known malignancy."
        XCTAssertFalse(p.clinicalTextContains(["dvt", "deep vein thrombosis", "pulmonary embolism"]))
        XCTAssertFalse(p.clinicalTextContains(["cancer", "malignancy"]))
        p.pmhNotes = "Previous DVT 2019. Breast cancer 2015."
        XCTAssertTrue(p.clinicalTextContains(["dvt", "deep vein thrombosis", "pulmonary embolism"]))
        XCTAssertTrue(p.clinicalTextContains(["cancer", "malignancy"]))
    }

    func testMissingVitalsFlaggedForWardReview() {
        let flags = VisitRiskAssessment.assess(patient(setting: .inpatient), pathway: .wardReview)
        XCTAssertTrue(flags.contains { $0.title == "No vitals recorded" && $0.level == .moderate })
    }
}

final class BurnsAssessmentTests: XCTestCase {

    func testAdultAnteriorTrunkIsEighteenPercent() {
        var b = BurnsAssessment()
        b.regionFractions["Anterior trunk"] = 1
        XCTAssertEqual(b.tbsa(ageYears: 40), 18, accuracy: 0.01)
    }

    func testWholeBodyIsOneHundredPercentAtAnyAge() {
        var b = BurnsAssessment()
        for r in BurnsAssessment.regions { b.regionFractions[r] = 1 }
        XCTAssertEqual(b.tbsa(ageYears: 40), 100, accuracy: 0.01)
        XCTAssertEqual(b.tbsa(ageYears: 1), 100, accuracy: 0.01)
        XCTAssertEqual(b.tbsa(ageYears: nil), 100, accuracy: 0.01)
    }

    func testChildHeadIsLargerShare() {
        var b = BurnsAssessment()
        b.regionFractions["Head & neck"] = 1
        XCTAssertGreaterThan(b.tbsa(ageYears: 1), 17)
        XCTAssertEqual(b.tbsa(ageYears: 30), 9, accuracy: 0.01)
    }

    func testParklandEstimate() {
        var b = BurnsAssessment()
        b.weightKg = 70
        b.regionFractions["Anterior trunk"] = 1          // 18 %
        b.regionFractions["Right arm"] = 1                // +9 %
        XCTAssertEqual(b.parkland24h(ageYears: 40) ?? 0, 4 * 70 * 27, accuracy: 0.5)
        XCTAssertTrue(b.needsFluidResuscitation(ageYears: 40))
    }

    func testNoFluidEstimateWithoutWeight() {
        var b = BurnsAssessment()
        b.regionFractions["Left leg"] = 1
        XCTAssertNil(b.parkland24h(ageYears: 40))
    }

    func testResuscitationThresholdsAdultVersusChild() {
        var b = BurnsAssessment()
        b.regionFractions["Right leg"] = 0.65              // ≈ 11.7 % adult
        XCTAssertFalse(b.needsFluidResuscitation(ageYears: 40))
        XCTAssertTrue(b.needsFluidResuscitation(ageYears: 12))
    }

    func testReferralCriteria() {
        var b = BurnsAssessment()
        XCTAssertTrue(b.referralCriteria(ageYears: 40).isEmpty)
        b.mechanism = "Electrical (high voltage)"
        b.specialAreas = ["Hands"]
        let met = b.referralCriteria(ageYears: 40)
        XCTAssertTrue(met.contains("Electrical burn"))
        XCTAssertTrue(met.contains { $0.contains("Hands") })
    }

    func testDecodesOldOrPartialJSON() throws {
        let partial = #"{"burns":{"mechanism":"Scald"}}"#.data(using: .utf8)!
        let decoded = try JSONDecoder().decode(PathwayData.self, from: partial)
        XCTAssertEqual(decoded.burns.mechanism, "Scald")
        XCTAssertTrue(decoded.burns.regionFractions.isEmpty)
        XCTAssertNoThrow(try JSONDecoder().decode(PathwayData.self, from: Data("{}".utf8)))
    }
}

final class WardReviewTests: XCTestCase {

    func testDischargeNeedsChecklistAndRecentLowNEWS2() {
        var w = WardReview()
        XCTAssertFalse(w.dischargeOutstanding(latestNEWS2: 1, obsHoursOld: 2).isEmpty)
        for item in WardReview.dischargeItems { w.marks[item] = .ok }
        XCTAssertTrue(w.dischargeOutstanding(latestNEWS2: 1, obsHoursOld: 2).isEmpty)
        XCTAssertTrue(w.dischargeOutstanding(latestNEWS2: 4, obsHoursOld: 2).contains { $0.hasPrefix("NEWS2") })
        XCTAssertTrue(w.dischargeOutstanding(latestNEWS2: 1, obsHoursOld: 20).contains("Observations within 12 h"))
        w.marks["Drains / lines / catheter"] = .concern
        XCTAssertTrue(w.dischargeOutstanding(latestNEWS2: 1, obsHoursOld: 2).contains("Open concerns"))
    }
}

final class ScreeningEngineTests: XCTestCase {

    private func ids(age: Int?, sex: Sex, bmi: Double? = nil,
                     _ configure: (inout WellnessScreening) -> Void = { _ in }) -> Set<String> {
        var w = WellnessScreening()
        configure(&w)
        return Set(ScreeningEngine.items(age: age, sex: sex, bmi: bmi, w: w).map(\.id))
    }

    func testNoDOBAsksForDOB() {
        XCTAssertEqual(ids(age: nil, sex: .male), ["dob"])
    }

    func testFiftyYearOldMaleAverageRisk() {
        // USPSTF 2018: PSA shared decision from 55 (45 with higher risk).
        let s = ids(age: 50, sex: .male)
        XCTAssertTrue(s.isSuperset(of: ["crc", "dm", "lipids", "bp"]))
        XCTAssertFalse(s.contains("psa"))
        XCTAssertTrue(ids(age: 55, sex: .male).contains("psa"))
        XCTAssertFalse(s.contains("breast"))
        XCTAssertFalse(s.contains("aaa"))
    }

    func testFortyFiveYearOldFemale() {
        let s = ids(age: 45, sex: .female)
        XCTAssertTrue(s.isSuperset(of: ["breast", "cervix", "crc"]))
        XCTAssertFalse(s.contains("psa"))
    }

    func testPriorPolypsReplacesAverageRiskBowelScreen() {
        let s = ids(age: 55, sex: .male) { $0.priorPolyps = true }
        XCTAssertTrue(s.contains("crc-polyps"))
        XCTAssertFalse(s.contains("crc"))
    }

    func testFamilyHistoryBowelCancerFromForty() {
        XCTAssertTrue(ids(age: 41, sex: .female) { $0.familyHxColorectal = true }.contains("crc-fh"))
        XCTAssertFalse(ids(age: 41, sex: .female).contains("crc"))
    }

    func testLungScreenNeedsPackYears() {
        XCTAssertFalse(ids(age: 60, sex: .male) { $0.smoking = .current; $0.packYears = 10 }.contains("lung"))
        XCTAssertTrue(ids(age: 60, sex: .male) { $0.smoking = .current; $0.packYears = 25 }.contains("lung"))
        XCTAssertFalse(ids(age: 60, sex: .male) { $0.smoking = .former; $0.packYears = 25; $0.yearsSinceQuit = 20 }.contains("lung"))
    }

    func testEarlierPSAForHigherRisk() {
        XCTAssertFalse(ids(age: 46, sex: .male).contains("psa"))
        XCTAssertTrue(ids(age: 46, sex: .male) { $0.africanCaribbean = true }.contains("psa"))
    }

    func testWebParityRules() {
        XCTAssertTrue(ids(age: 30, sex: .female) { $0.lynchCarrier = true }.contains("crc-lynch"))
        XCTAssertTrue(ids(age: 80, sex: .male).contains("crc-76-85"))
        XCTAssertFalse(ids(age: 86, sex: .male).contains("crc-76-85"))
        XCTAssertTrue(ids(age: 33, sex: .female) { $0.brcaCarrier = true }.contains("breast-brca"))
        XCTAssertFalse(ids(age: 52, sex: .female) { $0.totalHysterectomy = true }.contains("cervix"))
        XCTAssertTrue(ids(age: 52, sex: .female) { $0.totalHysterectomy = true; $0.cervicalHighGradeHistory = true }.contains("cervix"))
        XCTAssertTrue(ids(age: 30, sex: .male).contains("hbv"))
        XCTAssertTrue(ids(age: 38, sex: .female) { $0.priorGestationalDiabetes = true }.contains("dm"))
        XCTAssertFalse(ids(age: 30, sex: .female, bmi: 27).contains("dm"))       // overweight alone
        XCTAssertTrue(ids(age: 30, sex: .female, bmi: 27) { $0.familyHxDiabetes = true }.contains("dm"))
    }

    // MARK: - Parity with lib/triage-engine/src/screening/preventive.ts (same rows and wording as
    // artifacts/dashboard/src/lib/__tests__/preventive-screening.test.ts)

    private func interval(_ configure: (inout WellnessScreening) -> Void) -> String {
        var w = WellnessScreening()
        w.priorPolyps = true
        configure(&w)
        return ScreeningEngine.polypSurveillanceInterval(w).interval
    }

    func testPolypIntervalsFollowUSMSTF2020() {
        XCTAssertEqual(interval { $0.polypHistology = .adenoma; $0.polypCount = 2; $0.largestPolypMm = 6 },
                       "Next colonoscopy in 7–10 years — no early surveillance colonoscopy needed")
        XCTAssertEqual(interval { $0.polypHistology = .adenoma; $0.polypCount = 3; $0.largestPolypMm = 6 }, "Next colonoscopy in 3–5 years")
        XCTAssertEqual(interval { $0.polypHistology = .adenoma; $0.polypCount = 6; $0.largestPolypMm = 6 }, "Next colonoscopy in 3 years")
        XCTAssertEqual(interval { $0.polypHistology = .adenoma; $0.polypCount = 12 },
                       "Colonoscopy in 1 year; refer for genetic assessment (> 10 adenomas)")
        XCTAssertEqual(interval { $0.polypHistology = .adenoma; $0.polypCount = 1; $0.largestPolypMm = 12 }, "Next colonoscopy in 3 years")
        XCTAssertEqual(interval { $0.polypAdvancedHistology = true }, "Next colonoscopy in 3 years")   // older records
        XCTAssertEqual(interval { $0.polypHistology = .sessileSerrated; $0.polypCount = 2; $0.largestPolypMm = 8 }, "Next colonoscopy in 5–10 years")
        XCTAssertEqual(interval { $0.polypHistology = .traditionalSerrated }, "Next colonoscopy in 3 years")
        XCTAssertEqual(interval { $0.polypHistology = .hyperplastic; $0.largestPolypMm = 5 },
                       "Return to routine screening: next colonoscopy in 10 years")
        XCTAssertEqual(interval { $0.piecemealEMR20mm = true },
                       "Site-check colonoscopy at 6 months, then 1 year after that, then 3 years later")
        XCTAssertTrue(interval { $0.polypCount = 2 }.hasPrefix("Surveillance interval per the colonoscopy and histology report"))
    }

    func testColorectalFamilyHistoryAges() {
        // Under 40: plan from 40 (no test offered yet). 76–85: individualised, not the family item.
        XCTAssertTrue(ids(age: 35, sex: .male) { $0.familyHxColorectal = true }.contains("crc-fh"))
        let old = ids(age: 80, sex: .male) { $0.familyHxColorectal = true }
        XCTAssertTrue(old.contains("crc-76-85"))
        XCTAssertFalse(old.contains("crc-fh"))
        XCTAssertFalse(ids(age: 86, sex: .male) { $0.familyHxColorectal = true }.contains("crc-76-85"))
        XCTAssertTrue(ids(age: 55, sex: .female) { $0.priorPolyps = true; $0.familyHxLynchFeatures = true }.contains("crc-lynch-fh"))
        XCTAssertFalse(ids(age: 17, sex: .female) { $0.lynchCarrier = true }.contains("crc-lynch"))
    }

    func testNormalColonoscopyWithinTenYearsIsUpToDate() {
        let items = ScreeningEngine.items(age: 55, sex: .male, bmi: nil, w: {
            var w = WellnessScreening(); w.lastNormalColonoscopyYearsAgo = 4; return w }())
        let crc = items.first { $0.id == "crc" }
        XCTAssertTrue(crc?.title.contains("up to date") ?? false)
        XCTAssertNil(crc?.ixName)
    }

    func testBreastFamilyHistoryFrom25AndBRCAFrom18() {
        XCTAssertTrue(ids(age: 26, sex: .female) { $0.familyHxBreastOvarian = true }.contains("breast-fh"))
        XCTAssertTrue(ids(age: 45, sex: .female) { $0.familyHxBreastOvarian = true }.isSuperset(of: ["breast-fh", "breast"]))
        let brca = ids(age: 45, sex: .female) { $0.brcaCarrier = true }
        XCTAssertTrue(brca.contains("breast-brca"))
        XCTAssertFalse(brca.contains("breast"))
        let young = ScreeningEngine.items(age: 22, sex: .female, bmi: nil, w: {
            var w = WellnessScreening(); w.brcaCarrier = true; return w }())
        XCTAssertNil(young.first { $0.id == "breast-brca" }?.ixName)   // MRI from 25
    }

    func testPSAHasNoAutomaticTestAndStartsAt45WithBRCA() {
        let psa = ScreeningEngine.items(age: 60, sex: .male, bmi: nil, w: WellnessScreening()).first { $0.id == "psa" }
        XCTAssertNotNil(psa)
        XCTAssertNil(psa?.ixName)
        XCTAssertTrue(ids(age: 46, sex: .male) { $0.brcaCarrier = true }.contains("psa"))
        XCTAssertFalse(ids(age: 70, sex: .male) { $0.familyHxProstate = true }.contains("psa"))
    }

    func testBPConfirmationOnlyBelowTheUrgencyRange() {
        func bp(_ s: Int, _ d: Int) -> ScreeningItem? {
            ScreeningEngine.items(age: 50, sex: .male, bmi: nil, w: WellnessScreening(), clinicBP: (s, d)).first { $0.id == "bp" }
        }
        XCTAssertTrue(bp(150, 95)?.detail.contains("ABPM") ?? false)
        XCTAssertFalse(bp(185, 95)?.detail.contains("ABPM") ?? true)   // ≥180: hypertensive-urgency alerts
        XCTAssertFalse(bp(128, 82)?.detail.contains("ABPM") ?? true)
    }

    func testNewFieldsRoundTripAndOldJSONStillDecodes() throws {
        var w = WellnessScreening()
        w.lynchCarrier = true; w.brcaCarrier = true; w.totalHysterectomy = true; w.familyHxGastricCancer = true
        w.lastNormalColonoscopyYearsAgo = 3; w.polypCount = 4; w.largestPolypMm = 8
        w.polypHistology = .sessileSerrated; w.statuses["crc"] = .declined
        var data = PathwayData()
        data.wellness = w
        let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
        let back = try decoder.decode(PathwayData.self, from: encoder.encode(data)).wellness
        XCTAssertTrue(back.lynchCarrier && back.brcaCarrier && back.totalHysterectomy && back.familyHxGastricCancer)
        XCTAssertEqual(back.lastNormalColonoscopyYearsAgo, 3)
        XCTAssertEqual(back.polypCount, 4)
        XCTAssertEqual(back.largestPolypMm, 8)
        XCTAssertEqual(back.polypHistology, .sessileSerrated)
        XCTAssertEqual(back.statuses["crc"], .declined)

        // JSON written before these fields existed (and an unknown histology value) decodes to defaults.
        let old = #"{"wellness":{"smoking":"Former","packYears":30,"priorPolyps":true,"polypHistology":"Villous?","statuses":{"crc":"Added"}}}"#
        let legacy = try decoder.decode(PathwayData.self, from: Data(old.utf8)).wellness
        XCTAssertEqual(legacy.smoking, .former)
        XCTAssertEqual(legacy.packYears, 30)
        XCTAssertTrue(legacy.priorPolyps)
        XCTAssertFalse(legacy.lynchCarrier)
        XCTAssertNil(legacy.lastNormalColonoscopyYearsAgo)
        XCTAssertEqual(legacy.polypHistology, .notRecorded)
        XCTAssertEqual(legacy.statuses["crc"], .suggested)
    }

    func testAAAOnlyForMenWhoEverSmoked() {
        XCTAssertFalse(ids(age: 68, sex: .male).contains("aaa"))
        XCTAssertTrue(ids(age: 68, sex: .male) { $0.smoking = .former }.contains("aaa"))
    }
}
