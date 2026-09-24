import XCTest
@testable import AmiseMedFlow

/// Bowel-prep timing engine, safety suggestions, sign-off and patient sheet
/// (Services/BowelPrepProtocols.swift). Pure: no SwiftData, no clock, explicit time zone.
final class BowelPrepTests: XCTestCase {

    private let tz = TimeZone(identifier: "America/St_Lucia")!

    private var cal: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = tz
        return c
    }

    /// October 2026 date/time in Saint Lucia time. 5 Oct 2026 is a Monday.
    private func ect(_ day: Int, _ hour: Int, _ minute: Int = 0) -> Date {
        cal.date(from: DateComponents(year: 2026, month: 10, day: day, hour: hour, minute: minute))!
    }

    private func schedule(_ id: BowelPrepRegimenID, _ hour: Int, _ minute: Int = 0,
                          options: BowelPrepScheduleOptions = BowelPrepScheduleOptions(),
                          procedure: BowelPrepProcedure = .colonoscopy) -> BowelPrepSchedule {
        BowelPrepScheduler.schedule(regimen: BowelPrepRegimen.regimen(id), procedure: procedure,
                                    appointment: ect(5, hour, minute), options: options, timeZone: tz)
    }

    // MARK: - Schedules for 08:00, 10:30 and 14:00

    func testEightAMListSplitDose() {
        let s = schedule(.picosulfateMagnesium, 8)
        XCTAssertEqual(s.listType, .morning)
        XCTAssertEqual(s.mode, .split)
        XCTAssertEqual(s.clearFluidsFrom, ect(4, 13))
        XCTAssertEqual(s.doseStarts, [ect(4, 18), ect(5, 3)])
        XCTAssertEqual(s.lastIntakeBy, ect(5, 6))
        XCTAssertEqual(s.latestOralIntake, ect(5, 6))
        XCTAssertEqual(s.steps.first(where: { $0.kind == .stopIntake })?.start, ect(5, 6))
        XCTAssertEqual(s.steps.last?.kind, .procedure)
        XCTAssertEqual(s.steps.last?.start, ect(5, 8))
        XCTAssertTrue(s.warnings.isEmpty, "\(s.warnings)")
    }

    func testTenThirtyListSplitDose() {
        let s = schedule(.picosulfateMagnesium, 10, 30)
        XCTAssertEqual(s.listType, .morning)
        XCTAssertEqual(s.doseStarts, [ect(4, 18), ect(5, 5, 30)])
        XCTAssertEqual(s.lastIntakeBy, ect(5, 8, 30))

        let peg = schedule(.pegAscorbate2L, 10, 30)
        XCTAssertEqual(peg.doseStarts, [ect(4, 18), ect(5, 5, 30)])
        // Litre 2 (up to 2 h) + 500 mL clear fluid (30 min) ends 08:00, before the 08:30 stop time.
        XCTAssertEqual(peg.latestOralIntake, ect(5, 8, 30))   // clear fluids allowed up to the stop time
        let litre2Fluids = peg.steps.last { $0.kind == .fluids }
        XCTAssertEqual(litre2Fluids?.end, ect(5, 8))
    }

    func testTwoPMListSplitAndSameDay() {
        let split = schedule(.picosulfateMagnesium, 14)
        XCTAssertEqual(split.listType, .afternoon)
        XCTAssertEqual(split.mode, .split)
        XCTAssertEqual(split.doseStarts, [ect(4, 18), ect(5, 9)])
        XCTAssertEqual(split.lastIntakeBy, ect(5, 12))

        var sameDay = BowelPrepScheduleOptions()
        sameDay.afternoonSameDay = true
        let plenvu = schedule(.pegAscorbate1L, 14, options: sameDay)
        XCTAssertEqual(plenvu.mode, .sameDay)
        XCTAssertEqual(plenvu.doseStarts, [ect(5, 7), ect(5, 9)])

        // Same-day requested for a product whose labelling does not allow it: split is kept.
        let pico = schedule(.picosulfateMagnesium, 14, options: sameDay)
        XCTAssertEqual(pico.mode, .split)
        XCTAssertEqual(pico.doseStarts.first, ect(4, 18))
        XCTAssertFalse(pico.warnings.isEmpty)
    }

    // MARK: - Invariants

    func testAllIntakeEndsAtLeastTwoHoursBefore() {
        let times = [(6, 30), (8, 0), (10, 30), (12, 0), (14, 0), (16, 30)]
        for r in BowelPrepRegimen.all {
            for (h, m) in times {
                for lead in [240, 270, 300, 330, 360] {
                    for sameDay in [false, true] {
                        var o = BowelPrepScheduleOptions()
                        o.secondDoseLeadMinutes = lead
                        o.afternoonSameDay = sameDay
                        let appt = ect(5, h, m)
                        let s = BowelPrepScheduler.schedule(regimen: r, procedure: r.procedures[0],
                                                            appointment: appt, options: o, timeZone: tz)
                        let limit = appt.addingTimeInterval(-2 * 3600)
                        let label = "\(r.id.rawValue) \(h):\(m) lead \(lead) sameDay \(sameDay)"
                        XCTAssertEqual(s.lastIntakeBy, limit, label)
                        XCTAssertTrue(s.steps.contains { $0.kind == .stopIntake && $0.start == limit }, label)
                        for step in s.steps where step.isOralIntake {
                            XCTAssertLessThanOrEqual(step.end ?? step.start, limit, "\(label): \(step.title)")
                        }
                        if r.category != .enema, let last = s.doseStarts.last {
                            let minutesBefore = appt.timeIntervalSince(last) / 60
                            XCTAssertGreaterThanOrEqual(minutesBefore, 240, label)
                            XCTAssertLessThanOrEqual(minutesBefore, 360, label)
                        }
                    }
                }
            }
        }
    }

    func testFirstDoseIsEveningBeforeForMorningLists() {
        let dayBefore = ect(4, 12)
        for r in BowelPrepRegimen.all where r.category != .enema {
            for (h, m) in [(7, 0), (8, 0), (9, 30), (11, 45)] {
                let s = schedule(r.id, h, m)
                XCTAssertEqual(s.listType, .morning)
                XCTAssertEqual(s.mode, .split)
                guard let first = s.doseStarts.first else { return XCTFail("no doses for \(r.id)") }
                XCTAssertTrue(cal.isDate(first, inSameDayAs: dayBefore), "\(r.id) \(h):\(m)")
                let hour = cal.component(.hour, from: first)
                XCTAssertTrue((17..<20).contains(hour), "\(r.id) first dose at \(hour):00")
                XCTAssertEqual(s.doseStarts.count, 2)
            }
        }
    }

    func testClearFluidsNotNilByMouthFromMidnight() {
        let s = schedule(.picosulfateMagnesium, 8)
        let clear = s.steps.first { $0.kind == .clearFluidsOnly }
        XCTAssertEqual(clear?.end, ect(5, 6))
        XCTAssertTrue(clear?.isOralIntake ?? false)
    }

    func testEnemaOnlyForSigmoidoscopy() {
        let s = schedule(.enemaOnly, 9, procedure: .flexibleSigmoidoscopy)
        XCTAssertEqual(s.mode, .enemaOnly)
        XCTAssertEqual(s.doseStarts, [ect(5, 7)])   // Fleet enema at home 2 h before (surgeon's protocol)
        XCTAssertEqual(s.lastIntakeBy, ect(5, 7))
        XCTAssertNil(s.clearFluidsFrom)
    }

    // MARK: - Time zone

    func testTimesAreInPracticeTimeZone() {
        XCTAssertEqual(tz.secondsFromGMT(for: ect(5, 8)), -4 * 3600)    // AST, no DST
        XCTAssertEqual(tz.secondsFromGMT(for: cal.date(from: DateComponents(year: 2026, month: 1, day: 15, hour: 8))!),
                       -4 * 3600)

        let s = schedule(.picosulfateMagnesium, 8)
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        XCTAssertEqual(s.doseStarts[0], utc.date(from: DateComponents(year: 2026, month: 10, day: 4, hour: 22)))
        XCTAssertEqual(s.doseStarts[1], utc.date(from: DateComponents(year: 2026, month: 10, day: 5, hour: 7)))

        XCTAssertEqual(BowelPrepFormat.time(s.doseStarts[0], tz), "18:00")
        XCTAssertEqual(BowelPrepFormat.time(s.doseStarts[1], tz), "03:00")
        XCTAssertEqual(BowelPrepFormat.time(s.lastIntakeBy, tz), "06:00")
        XCTAssertEqual(BowelPrepFormat.day(s.appointment, tz), "Monday 5 October")

        // The engine uses the zone it is given, not the device's: the same instant in Tokyo is
        // 21:00, an afternoon list with its own local evening dose.
        let tokyo = TimeZone(identifier: "Asia/Tokyo")!
        let other = BowelPrepScheduler.schedule(regimen: BowelPrepRegimen.picosulfateMagnesium,
                                                appointment: ect(5, 8), timeZone: tokyo)
        XCTAssertEqual(other.listType, .afternoon)
        XCTAssertEqual(BowelPrepFormat.time(other.doseStarts[0], tokyo), "18:00")
        XCTAssertNotEqual(other.doseStarts[0], s.doseStarts[0])
    }

    // MARK: - Safety suggestions

    func testEGFR24SuggestsPEG() {
        let suggestions = BowelPrepSafety.suggestions(for: BowelPrepPatientFacts(ageYears: 60, egfr: 24))
        let renal = suggestions.first { $0.id == "renal_severe" }
        XCTAssertNotNil(renal)
        XCTAssertEqual(renal?.title, "Suggested: consider PEG-based prep (eGFR 24)")
        XCTAssertEqual(renal?.level, .avoid)
        XCTAssertTrue(renal?.reason.contains("eGFR 24") ?? false)
        XCTAssertTrue(renal?.affects.contains(.picosulfateMagnesium) ?? false)
        XCTAssertTrue(renal?.affects.contains(.magnesiumCitrate) ?? false)
        XCTAssertFalse(renal?.affects.contains(.pegAscorbate2L) ?? true)
        XCTAssertEqual(BowelPrepSafety.suggestedRegimen(for: .colonoscopy, suggestions: suggestions), .pegAscorbate2L)
    }

    func testHeartFailureSuggestsPEG() {
        let facts = BowelPrepPatientFacts(ageYears: 68, historyText: "Hypertension; congestive heart failure, EF 30%")
        let suggestions = BowelPrepSafety.suggestions(for: facts)
        let hf = suggestions.first { $0.id == "heart_failure" }
        XCTAssertEqual(hf?.title, "Suggested: consider PEG-based prep (heart failure)")
        XCTAssertTrue(hf?.suggestsPEG ?? false)
        XCTAssertTrue(hf?.reason.contains("heart failure") ?? false)
        XCTAssertEqual(BowelPrepSafety.suggestedRegimen(for: .colonoscopy, suggestions: suggestions), .pegAscorbate2L)

        let acronym = BowelPrepSafety.suggestions(for: BowelPrepPatientFacts(historyText: "CCF, AF on apixaban"))
        XCTAssertTrue(acronym.contains { $0.id == "heart_failure" })
    }

    func testNoConcernsKeepsMagnesiumDefault() {
        let suggestions = BowelPrepSafety.suggestions(for: BowelPrepPatientFacts(ageYears: 52, egfr: 95))
        XCTAssertTrue(suggestions.isEmpty)
        XCTAssertEqual(BowelPrepSafety.suggestedRegimen(for: .colonoscopy, suggestions: suggestions), .picosulfateMagnesium)
        XCTAssertEqual(BowelPrepSafety.suggestedRegimen(for: .flexibleSigmoidoscopy, suggestions: suggestions), .enemaOnly)
    }

    func testCautionsDoNotChangeDefault() {
        let facts = BowelPrepPatientFacts(ageYears: 82, egfr: 45, cfs: 6)
        let suggestions = BowelPrepSafety.suggestions(for: facts)
        XCTAssertTrue(suggestions.contains { $0.id == "renal_moderate" && $0.level == .caution })
        XCTAssertTrue(suggestions.contains { $0.id == "elderly_frail" && $0.title.contains("age 82") && $0.title.contains("CFS 6") })
        XCTAssertEqual(BowelPrepSafety.suggestedRegimen(for: .colonoscopy, suggestions: suggestions), .picosulfateMagnesium)
    }

    func testObstructionFlagsEveryOralPrepButNotSleepApnoea() {
        let osa = BowelPrepSafety.suggestions(for: BowelPrepPatientFacts(historyText: "Obstructive sleep apnoea on CPAP"))
        XCTAssertFalse(osa.contains { $0.id == "obstruction" })

        let lbo = BowelPrepSafety.suggestions(for: BowelPrepPatientFacts(presentationText: "Suspected large bowel obstruction"))
        let flag = lbo.first { $0.id == "obstruction" }
        XCTAssertNotNil(flag)
        XCTAssertTrue(flag?.title.hasPrefix("Suggested:") ?? false)
        for id in [BowelPrepRegimenID.picosulfateMagnesium, .magnesiumCitrate, .pegAscorbate2L, .pegAscorbate1L, .peg4L] {
            XCTAssertTrue(flag?.affects.contains(id) ?? false, id.rawValue)
        }
    }

    func testDiabetesIsAPlanningFlagWithoutDoses() {
        let s = BowelPrepSafety.suggestions(for: BowelPrepPatientFacts(onDiabetesMedicine: true))
        let dm = s.first { $0.id == "diabetes" }
        XCTAssertEqual(dm?.level, .plan)
        let reason = (dm?.reason ?? "").lowercased()
        XCTAssertFalse(reason.contains(" mg"))
        XCTAssertFalse(reason.contains("units"))
        XCTAssertFalse(dm?.suggestsPEG ?? true)
    }

    func testAscorbateContraindicationPointsTo4LPEG() {
        let facts = BowelPrepPatientFacts(egfr: 20, historyText: "G6PD deficiency")
        let s = BowelPrepSafety.suggestions(for: facts)
        XCTAssertTrue(s.contains { $0.id == "g6pd" })
        XCTAssertEqual(BowelPrepSafety.suggestedRegimen(for: .colonoscopy, suggestions: s), .peg4L)
    }

    func testMagnesiumUnits() {
        let high = BowelPrepSafety.suggestions(for: BowelPrepPatientFacts(magnesium: 1.3, magnesiumUnit: "mmol"))
        XCTAssertTrue(high.contains { $0.id == "hypermagnesaemia" && $0.suggestsPEG })
        let unclear = BowelPrepSafety.suggestions(for: BowelPrepPatientFacts(magnesium: 2.0))
        XCTAssertTrue(unclear.contains { $0.id == "magnesium_units" })
        let normal = BowelPrepSafety.suggestions(for: BowelPrepPatientFacts(magnesium: 2.0, magnesiumUnit: "mgdl"))
        XCTAssertTrue(normal.isEmpty)
    }

    // MARK: - Regimen data and sign-off

    func testEveryRegimenNeedsSurgeonReviewAndCitesSources() {
        XCTAssertEqual(BowelPrepRegimen.all.count, 6)
        XCTAssertEqual(Set(BowelPrepRegimen.all.map(\.id)), Set(BowelPrepRegimenID.allCases))
        for r in BowelPrepRegimen.all {
            XCTAssertTrue(r.requiresSurgeonReview, r.id.rawValue)
            XCTAssertFalse(r.productExamples.isEmpty, r.id.rawValue)
            XCTAssertFalse(r.additionalClearFluids.isEmpty, r.id.rawValue)
            XCTAssertEqual(r.doses.count, r.category == .enema ? 1 : 2, r.id.rawValue)
            XCTAssertTrue(r.sourceNote.contains(r.category == .enema ? "label" : "ESGE 2019"), r.id.rawValue)
        }
        XCTAssertEqual(BowelPrepRegimen.defaultID(for: .colonoscopy), .picosulfateMagnesium)
        XCTAssertEqual(BowelPrepRegimen.picosulfateMagnesium.category, .magnesiumBased)
        XCTAssertFalse(BowelPrepRegimen.available(for: .colonoscopy).contains { $0.id == .enemaOnly })
    }

    func testFingerprintIsStable() {
        XCTAssertEqual(BowelPrepSignOff.fnv1a64(""), "cbf29ce484222325")
        XCTAssertEqual(BowelPrepSignOff.fnv1a64("a"), "af63dc4c8601ec8c")
        XCTAssertEqual(BowelPrepRegimen.peg4L.wordingFingerprint, BowelPrepRegimen.peg4L.wordingFingerprint)
        XCTAssertNotEqual(BowelPrepRegimen.peg4L.wordingFingerprint, BowelPrepRegimen.pegAscorbate2L.wordingFingerprint)
    }

    func testSignOffPerRegimen() {
        let suite = "BowelPrepTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }

        let r = BowelPrepRegimen.picosulfateMagnesium
        XCTAssertFalse(r.hasPlaceholders)
        XCTAssertFalse(BowelPrepSignOff.isSignedOff(r, records: BowelPrepSignOff.load(from: defaults)))
        XCTAssertTrue(BowelPrepSignOff.approve(r, by: "Dr Test", defaults: defaults))
        var records = BowelPrepSignOff.load(from: defaults)
        XCTAssertTrue(BowelPrepSignOff.isSignedOff(r, records: records))
        XCTAssertFalse(BowelPrepSignOff.isSignedOff(BowelPrepRegimen.peg4L, records: records))

        // Wording changed since approval: the sign-off lapses.
        records[r.id.rawValue]?.fingerprint = "stale"
        XCTAssertFalse(BowelPrepSignOff.isSignedOff(r, records: records))

        // Patient wording with [confirm] placeholders cannot be signed off.
        // Magnesium citrate and enema wording is now complete: no regimen has a placeholder left.
        for regimen in BowelPrepRegimen.all {
            XCTAssertFalse(regimen.hasPlaceholders, regimen.id.rawValue)
        }

        BowelPrepSignOff.withdraw(r.id, defaults: defaults)
        XCTAssertFalse(BowelPrepSignOff.isSignedOff(r, records: BowelPrepSignOff.load(from: defaults)))
    }

    // MARK: - Patient sheet

    func testPatientSheetGivesNoMedicineInstructions() {
        for r in BowelPrepRegimen.all {
            let s = BowelPrepScheduler.schedule(regimen: r, procedure: r.procedures[0], appointment: ect(5, 8),
                                                timeZone: tz)
            let sheet = BowelPrepPatientSheet.build(patientName: "Test Patient", procedure: r.procedures[0],
                                                    regimen: r, schedule: s, practice: .amiseDefault,
                                                    signedOff: false)
            let text = sheet.plainText.lowercased()
            for banned in ["stop taking", "do not take", "don't take", "hold your", "withhold", "omit", "skip your",
                           "nil by mouth", "midnight"] {
                XCTAssertFalse(text.contains(banned), "\(r.id.rawValue): \"\(banned)\"")
            }
            XCTAssertTrue(sheet.isDraft)
            XCTAssertTrue(sheet.plainText.hasPrefix("DRAFT"))
            XCTAssertTrue(text.contains("08:00"))
            XCTAssertTrue(text.contains("06:00"), "\(r.id.rawValue): stop time")
        }
        let signed = BowelPrepPatientSheet.build(
            patientName: "Test Patient", procedure: .colonoscopy, regimen: BowelPrepRegimen.picosulfateMagnesium,
            schedule: schedule(.picosulfateMagnesium, 8), practice: .amiseDefault, signedOff: true)
        XCTAssertFalse(signed.isDraft)
        XCTAssertTrue(signed.plainText.contains("2 hours before your appointment"))
        XCTAssertTrue(signed.contact.contains(PracticeProfile.amiseDefault.practiceName))
    }

    // MARK: - Storage and detection

    func testPlanDecodesFromOldPathwayJSONAndRoundTrips() throws {
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
        let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601

        let old = try decoder.decode(PathwayData.self, from: Data(#"{"burns":{},"ward":{}}"#.utf8))
        XCTAssertNil(old.bowelPrep.regimen)
        XCTAssertEqual(old.bowelPrep.options, BowelPrepScheduleOptions())

        var data = PathwayData()
        data.bowelPrep.regimenID = BowelPrepRegimenID.pegAscorbate2L.rawValue
        data.bowelPrep.appointment = ect(5, 8)
        data.bowelPrep.options.secondDoseLeadMinutes = 270
        data.bowelPrep.dismissedSuggestions = ["elderly_frail"]
        let back = try decoder.decode(PathwayData.self, from: encoder.encode(data))
        XCTAssertEqual(back.bowelPrep, data.bowelPrep)
        XCTAssertEqual(back.bowelPrep.regimen, .pegAscorbate2L)
    }

    func testDetectProcedure() {
        XCTAssertEqual(BowelPrepProcedure.detect(visitType: .colonoscopy, appointmentType: nil), .colonoscopy)
        XCTAssertEqual(BowelPrepProcedure.detect(visitType: .newConsult, appointmentType: "Flexible sigmoidoscopy"),
                       .flexibleSigmoidoscopy)
        XCTAssertEqual(BowelPrepProcedure.detect(visitType: nil, appointmentType: "OGD + Colonoscopy"), .colonoscopy)
        XCTAssertNil(BowelPrepProcedure.detect(visitType: .ogd, appointmentType: "OGD / Gastroscopy"))
    }
}
