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
        let s = ids(age: 50, sex: .male)
        XCTAssertTrue(s.isSuperset(of: ["crc", "psa", "dm", "lipids", "bp"]))
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

    func testAAAOnlyForMenWhoEverSmoked() {
        XCTAssertFalse(ids(age: 68, sex: .male).contains("aaa"))
        XCTAssertTrue(ids(age: 68, sex: .male) { $0.smoking = .former }.contains("aaa"))
    }
}
