import XCTest
import SwiftData
@testable import AmiseMedFlow

/// NEWS2 on VitalsEntry (the score shown on ward round, patient rows and SOAP drafts).
/// Boundaries follow the RCP NEWS2 chart (2017). Each parameter is tested on its own: fields left
/// nil contribute nothing, so a single-parameter entry scores exactly that parameter's points.
@MainActor
final class NEWS2Tests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!
    private var patient: Patient!

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
        patient = Patient(fullName: "NEWS2 Test Patient")
        context.insert(patient)
    }

    /// Empty entry: no observations, alert, on room air.
    private func entry() -> VitalsEntry {
        let v = VitalsEntry(patient: patient)
        context.insert(v)
        return v
    }

    /// A full set of observations that scores 0.
    private func normalEntry() -> VitalsEntry {
        let v = entry()
        v.respiratoryRate = 16
        v.spo2 = 98
        v.bpSystolic = 120
        v.bpDiastolic = 80
        v.heartRate = 70
        v.temperatureCelsius = 37.0
        return v
    }

    // MARK: - Single parameters (RCP chart boundaries)

    func testRespiratoryRateBoundaries() {
        let cases: [(Int, Int)] = [(8, 3), (9, 1), (11, 1), (12, 0), (20, 0), (21, 2), (24, 2), (25, 3)]
        let v = entry()
        for (rr, points) in cases {
            v.respiratoryRate = rr
            XCTAssertEqual(v.news2Score, points, "RR \(rr)")
        }
    }

    func testSpO2Scale1Boundaries() {
        let cases: [(Int, Int)] = [(91, 3), (92, 2), (93, 2), (94, 1), (95, 1), (96, 0), (100, 0)]
        let v = entry()
        for (spo2, points) in cases {
            v.spo2 = spo2
            XCTAssertEqual(v.news2Score, points, "SpO2 \(spo2) on air")
        }
    }

    func testSpO2Scale2OnOxygenIncludesTwoPointsForOxygen() {
        // Scale 2 values on the chart that are unambiguous: 88–92 = 0, 93–94 = 1, 95–96 = 2, ≥97 = 3,
        // ≤83 = 3. Every entry here is on oxygen, so +2 is added.
        let cases: [(Int, Int)] = [(83, 3), (88, 0), (92, 0), (93, 1), (94, 1), (95, 2), (96, 2), (97, 3)]
        let v = entry()
        v.onSupplementalO2 = true
        for (spo2, points) in cases {
            v.spo2 = spo2
            XCTAssertEqual(v.news2Score, points + 2, "SpO2 \(spo2) on O2")
        }
    }

    func testSupplementalOxygenAloneScoresTwo() {
        let v = entry()
        v.onSupplementalO2 = true
        XCTAssertEqual(v.news2Score, 2)
    }

    func testSystolicBPBoundaries() {
        let cases: [(Int, Int)] = [(90, 3), (91, 2), (100, 2), (101, 1), (110, 1), (111, 0), (219, 0), (220, 3)]
        let v = entry()
        for (sbp, points) in cases {
            v.bpSystolic = sbp
            XCTAssertEqual(v.news2Score, points, "SBP \(sbp)")
        }
    }

    func testHeartRateBoundaries() {
        let cases: [(Int, Int)] = [(40, 3), (41, 1), (50, 1), (51, 0), (90, 0), (91, 1),
                                   (110, 1), (111, 2), (130, 2), (131, 3)]
        let v = entry()
        for (hr, points) in cases {
            v.heartRate = hr
            XCTAssertEqual(v.news2Score, points, "HR \(hr)")
        }
    }

    func testTemperatureBoundaries() {
        let cases: [(Double, Int)] = [(35.0, 3), (35.1, 1), (36.0, 1), (36.1, 0), (38.0, 0),
                                      (38.1, 1), (39.0, 1), (39.1, 2)]
        let v = entry()
        for (temp, points) in cases {
            v.temperatureCelsius = temp
            XCTAssertEqual(v.news2Score, points, "Temp \(temp)")
        }
    }

    func testConsciousnessScoresThreeForAnythingButAlert() {
        let v = entry()
        XCTAssertEqual(v.news2Score, 0)
        for level in AVPU.allCases where level != .alert {
            v.avpu = level
            XCTAssertEqual(v.news2Score, 3, "AVPU \(level.rawValue)")
        }
    }

    // MARK: - Aggregate score and risk band

    func testNormalObservationsScoreZeroLowRisk() {
        let v = normalEntry()
        XCTAssertEqual(v.news2Score, 0)
        XCTAssertFalse(v.news2HasRedFlag)
        XCTAssertEqual(v.news2Risk, "Low")
    }

    func testAggregateFourWithoutRedFlagIsLow() {
        let v = normalEntry()
        v.respiratoryRate = 22   // 2
        v.heartRate = 115        // 2
        XCTAssertEqual(v.news2Score, 4)
        XCTAssertFalse(v.news2HasRedFlag)
        XCTAssertEqual(v.news2Risk, "Low")
    }

    func testAggregateFiveIsMedium() {
        let v = normalEntry()
        v.respiratoryRate = 22      // 2
        v.heartRate = 115           // 2
        v.temperatureCelsius = 38.5 // 1
        XCTAssertEqual(v.news2Score, 5)
        XCTAssertFalse(v.news2HasRedFlag)
        XCTAssertEqual(v.news2Risk, "Medium")
    }

    func testAggregateSevenIsHigh() {
        let v = normalEntry()
        v.respiratoryRate = 22      // 2
        v.heartRate = 115           // 2
        v.bpSystolic = 105          // 1
        v.temperatureCelsius = 38.5 // 1
        v.spo2 = 95                 // 1
        XCTAssertEqual(v.news2Score, 7)
        XCTAssertFalse(v.news2HasRedFlag)
        XCTAssertEqual(v.news2Risk, "High")
    }

    func testMaximumScore() {
        let v = entry()
        v.respiratoryRate = 30
        v.spo2 = 85
        v.bpSystolic = 80
        v.heartRate = 140
        v.temperatureCelsius = 34.0
        v.avpu = .unresponsive
        XCTAssertEqual(v.news2Score, 18)   // 3 × 6 parameters, on air
        XCTAssertEqual(v.news2Risk, "High")
    }

    // MARK: - Single-parameter red flag (a 3 in any one parameter)

    func testEachExtremeParameterRaisesRedFlag() {
        let setters: [(String, (VitalsEntry) -> Void)] = [
            ("RR 8",         { $0.respiratoryRate = 8 }),
            ("RR 25",        { $0.respiratoryRate = 25 }),
            ("SpO2 91",      { $0.spo2 = 91 }),
            ("SBP 90",       { $0.bpSystolic = 90 }),
            ("SBP 220",      { $0.bpSystolic = 220 }),
            ("HR 40",        { $0.heartRate = 40 }),
            ("HR 131",       { $0.heartRate = 131 }),
            ("Temp 35.0",    { $0.temperatureCelsius = 35.0 }),
            ("AVPU voice",   { $0.avpu = .voice }),
            ("AVPU confused", { $0.avpu = .confused }),
        ]
        for (label, apply) in setters {
            let v = normalEntry()
            apply(v)
            XCTAssertTrue(v.news2HasRedFlag, label)
            // A red-flag parameter must never be reported as low risk, whatever the total.
            XCTAssertNotEqual(v.news2Risk, "Low", label)
        }
    }

    func testValuesJustInsideTheRedFlagLimitsDoNotRaiseIt() {
        let setters: [(String, (VitalsEntry) -> Void)] = [
            ("RR 9",      { $0.respiratoryRate = 9 }),
            ("RR 24",     { $0.respiratoryRate = 24 }),
            ("SpO2 92",   { $0.spo2 = 92 }),
            ("SBP 91",    { $0.bpSystolic = 91 }),
            ("SBP 219",   { $0.bpSystolic = 219 }),
            ("HR 41",     { $0.heartRate = 41 }),
            ("HR 130",    { $0.heartRate = 130 }),
            ("Temp 35.1", { $0.temperatureCelsius = 35.1 }),
            ("Temp 39.5", { $0.temperatureCelsius = 39.5 }),   // 2 points, not 3
        ]
        for (label, apply) in setters {
            let v = normalEntry()
            apply(v)
            XCTAssertFalse(v.news2HasRedFlag, label)
        }
    }

    // MARK: - Agreement with the Scores-screen NEWS2 calculator

    /// ClinicalScoringEngine.news2 is a second NEWS2 implementation (Scores screen). For whole-number
    /// observations and one-decimal temperatures both must give the same total.
    func testVitalsEntryAgreesWithScoringEngine() {
        typealias Obs = (rr: Int, spo2: Int, o2: Bool, sbp: Int, hr: Int, temp: Double, avpu: AVPU)
        let profiles: [Obs] = [
            (16, 98, false, 120, 70, 37.0, .alert),
            (22, 95, false, 105, 115, 38.5, .alert),
            (8, 91, false, 90, 40, 35.0, .voice),
            (25, 90, true, 220, 131, 39.1, .unresponsive),
            (11, 93, true, 100, 50, 36.0, .alert),
            (21, 97, true, 111, 91, 38.1, .confused),
        ]
        for o in profiles {
            let v = entry()
            v.respiratoryRate = o.rr
            v.spo2 = o.spo2
            v.onSupplementalO2 = o.o2
            v.bpSystolic = o.sbp
            v.heartRate = o.hr
            v.temperatureCelsius = o.temp
            v.avpu = o.avpu

            var input = NEWS2Input()
            input.respiratoryRate = o.rr
            input.spo2 = o.spo2
            input.onSupplementalO2 = o.o2
            input.systolicBP = o.sbp
            input.heartRate = o.hr
            input.temperatureCelsius = o.temp
            input.avpu = o.avpu

            XCTAssertEqual(Double(v.news2Score), ClinicalScoringEngine.news2(input).score, "\(o)")
        }
    }

    // MARK: - Display helpers

    func testBPStringNeedsBothValues() {
        let v = entry()
        XCTAssertNil(v.bpString)
        v.bpSystolic = 120
        XCTAssertNil(v.bpString)
        v.bpDiastolic = 80
        XCTAssertEqual(v.bpString, "120/80")
    }

    func testHasAnyValue() {
        let v = entry()
        XCTAssertFalse(v.hasAnyValue)
        v.spo2 = 97
        XCTAssertTrue(v.hasAnyValue)
    }
}
