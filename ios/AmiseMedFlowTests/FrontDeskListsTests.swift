import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Front-desk Check-In privacy rule (FrontDeskTodayList): before any search, only patients booked
/// (operationDate) or checked in (checkInTime) TODAY in the practice time zone are listed, earliest
/// first, with the name and the time only. Saint Lucia is AST, UTC-4 all year (no DST), so the
/// practice day runs 04:00Z → 04:00Z the next day.
@MainActor
final class FrontDeskListsTests: XCTestCase {

    private struct Candidate: Equatable {
        let name: String
        let appointment: Date?
        let checkIn: Date?
        init(_ name: String, appointment: Date? = nil, checkIn: Date? = nil) {
            self.name = name
            self.appointment = appointment
            self.checkIn = checkIn
        }
    }

    private let stLucia = TimeZone(identifier: "America/St_Lucia")!
    private let utc = TimeZone(identifier: "UTC")!

    /// An instant written in UTC ("2026-09-25T03:30:00Z").
    private func utcDate(_ iso: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        guard let d = f.date(from: iso) else {
            XCTFail("bad ISO date \(iso)")
            return .distantPast
        }
        return d
    }

    private func today(_ candidates: [Candidate], now: Date, in tz: TimeZone? = nil) -> [String] {
        FrontDeskTodayList.todays(candidates,
                                  appointment: { $0.appointment },
                                  checkIn: { $0.checkIn },
                                  now: now,
                                  timeZone: tz ?? stLucia)
            .map(\.name)
    }

    // MARK: - The practice time zone decides "today"

    func testStLuciaIsUTCMinusFourAllYear() {
        XCTAssertEqual(stLucia.secondsFromGMT(for: utcDate("2026-01-15T12:00:00Z")), -4 * 3600)
        XCTAssertEqual(stLucia.secondsFromGMT(for: utcDate("2026-07-15T12:00:00Z")), -4 * 3600)
    }

    func testLateEveningAST_AfterUTCMidnight_StillToday() {
        // 23:30 AST on 24 Sep = 03:30Z on 25 Sep.
        let now = utcDate("2026-09-25T03:30:00Z")
        let morningClinic = utcDate("2026-09-24T13:00:00Z")      // 09:00 AST 24 Sep
        let tomorrowEarly = utcDate("2026-09-25T04:30:00Z")      // 00:30 AST 25 Sep

        XCTAssertTrue(FrontDeskTodayList.isSameDay(morningClinic, as: now, in: stLucia))
        XCTAssertFalse(FrontDeskTodayList.isSameDay(tomorrowEarly, as: now, in: stLucia),
                       "00:30 AST tomorrow is not today, although it is the same UTC date")

        // The same instants read in UTC give the opposite answers: the zone matters.
        XCTAssertFalse(FrontDeskTodayList.isSameDay(morningClinic, as: now, in: utc))
        XCTAssertTrue(FrontDeskTodayList.isSameDay(tomorrowEarly, as: now, in: utc))
    }

    func testJustAfterMidnightAST_YesterdayEveningIsNotToday() {
        // 00:05 AST on 25 Sep = 04:05Z on 25 Sep.
        let now = utcDate("2026-09-25T04:05:00Z")
        let lastSecondYesterday = utcDate("2026-09-25T03:59:59Z")  // 23:59:59 AST 24 Sep
        let midnight = utcDate("2026-09-25T04:00:00Z")             // 00:00:00 AST 25 Sep
        let lastSecondToday = utcDate("2026-09-26T03:59:59Z")      // 23:59:59 AST 25 Sep
        let midnightTomorrow = utcDate("2026-09-26T04:00:00Z")     // 00:00:00 AST 26 Sep

        XCTAssertFalse(FrontDeskTodayList.isSameDay(lastSecondYesterday, as: now, in: stLucia))
        XCTAssertTrue(FrontDeskTodayList.isSameDay(midnight, as: now, in: stLucia),
                      "midnight belongs to the new day")
        XCTAssertTrue(FrontDeskTodayList.isSameDay(lastSecondToday, as: now, in: stLucia))
        XCTAssertFalse(FrontDeskTodayList.isSameDay(midnightTomorrow, as: now, in: stLucia))
    }

    func testCheckInLateLastNightDropsOffAtMidnight() {
        let checkedIn = Candidate("Late Arrival", checkIn: utcDate("2026-09-25T03:50:00Z")) // 23:50 AST
        XCTAssertEqual(today([checkedIn], now: utcDate("2026-09-25T03:55:00Z")), ["Late Arrival"])
        XCTAssertEqual(today([checkedIn], now: utcDate("2026-09-25T04:00:00Z")), [],
                       "at 00:00 AST yesterday's check-in is no longer listed")
    }

    func testNilDatesAreNeverToday() {
        XCTAssertFalse(FrontDeskTodayList.isSameDay(nil, as: .now, in: stLucia))
        XCTAssertNil(FrontDeskTodayList.slot(appointment: nil, checkIn: nil, now: .now, timeZone: stLucia))
    }

    // MARK: - Who is on today's list

    func testOnlyBookedOrCheckedInTodayAreListed() {
        let now = utcDate("2026-09-25T15:00:00Z")   // 11:00 AST 25 Sep
        let roster = [
            Candidate("Booked Today", appointment: utcDate("2026-09-25T13:30:00Z")),
            Candidate("Booked Tomorrow", appointment: utcDate("2026-09-26T13:30:00Z")),
            Candidate("Booked Yesterday", appointment: utcDate("2026-09-24T13:30:00Z")),
            Candidate("Walk-In Today", checkIn: utcDate("2026-09-25T12:10:00Z")),
            Candidate("Checked In Yesterday", checkIn: utcDate("2026-09-24T20:00:00Z")),
            Candidate("Never Booked"),
        ]
        XCTAssertEqual(Set(today(roster, now: now)), ["Booked Today", "Walk-In Today"])
    }

    func testEmptyWhenNobodyIsBookedToday() {
        let now = utcDate("2026-09-25T15:00:00Z")
        let roster = [Candidate("Old Patient", appointment: utcDate("2025-01-01T13:00:00Z")),
                      Candidate("No Dates")]
        XCTAssertEqual(today(roster, now: now), [])
    }

    // MARK: - Which time is shown

    func testAppointmentTodayWinsOverCheckInToday() {
        let now = utcDate("2026-09-25T15:00:00Z")
        let appt = utcDate("2026-09-25T14:00:00Z")
        let slot = FrontDeskTodayList.slot(appointment: appt,
                                           checkIn: utcDate("2026-09-25T13:40:00Z"),
                                           now: now, timeZone: stLucia)
        XCTAssertEqual(slot, FrontDeskTodayList.Slot(time: appt, kind: .appointment))
    }

    func testCheckInTodayWithAppointmentOnAnotherDayShowsArrival() {
        let now = utcDate("2026-09-25T15:00:00Z")
        let arrived = utcDate("2026-09-25T13:40:00Z")
        let slot = FrontDeskTodayList.slot(appointment: utcDate("2026-10-02T13:00:00Z"),
                                           checkIn: arrived,
                                           now: now, timeZone: stLucia)
        XCTAssertEqual(slot, FrontDeskTodayList.Slot(time: arrived, kind: .arrival))
    }

    func testLabelsUsePracticeTimeNotUTC() {
        let appt = FrontDeskTodayList.Slot(time: utcDate("2026-09-25T13:00:00Z"), kind: .appointment)
        let arrival = FrontDeskTodayList.Slot(time: utcDate("2026-09-25T13:42:00Z"), kind: .arrival)
        XCTAssertEqual(FrontDeskTodayList.label(for: appt, timeZone: stLucia), "09:00")
        XCTAssertEqual(FrontDeskTodayList.label(for: arrival, timeZone: stLucia), "Arrived 09:42")
        XCTAssertEqual(FrontDeskTodayList.timeText(utcDate("2026-09-25T03:30:00Z"), timeZone: stLucia), "23:30")
    }

    // MARK: - Order

    func testSortedByShownTimeThenInputOrder() {
        let now = utcDate("2026-09-25T15:00:00Z")
        let roster = [
            Candidate("Eleven", appointment: utcDate("2026-09-25T15:00:00Z")),
            Candidate("Arrived Nine Thirty", checkIn: utcDate("2026-09-25T13:30:00Z")),
            Candidate("Nine A", appointment: utcDate("2026-09-25T13:00:00Z")),
            Candidate("Nine B", appointment: utcDate("2026-09-25T13:00:00Z")),
        ]
        XCTAssertEqual(today(roster, now: now), ["Nine A", "Nine B", "Arrived Nine Thirty", "Eleven"])
    }

    // MARK: - Patient overload (SwiftData)

    func testPatientOverloadListsOnlyTodaysLiveRecords() throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        let container = try ModelContainer(for: schema,
                                           configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        let context = container.mainContext
        let now = utcDate("2026-09-25T15:00:00Z")   // 11:00 AST

        let booked = Patient(fullName: "Front Desk Booked")
        booked.mrn = MRNGenerator.formatted(year: 2026, sequence: 801)
        booked.operationDate = utcDate("2026-09-25T17:00:00Z")    // 13:00 AST today
        let arrived = Patient(fullName: "Front Desk Arrived")
        arrived.mrn = MRNGenerator.formatted(year: 2026, sequence: 802)
        arrived.checkInTime = utcDate("2026-09-25T12:15:00Z")     // 08:15 AST today
        let other = Patient(fullName: "Front Desk Other")
        other.mrn = MRNGenerator.formatted(year: 2026, sequence: 803)
        other.operationDate = utcDate("2026-09-26T04:30:00Z")     // 00:30 AST tomorrow
        for p in [booked, arrived, other] { context.insert(p) }

        let list = FrontDeskTodayList.todaysPatients([booked, arrived, other], now: now, timeZone: stLucia)
        XCTAssertEqual(list.map(\.fullName), ["Front Desk Arrived", "Front Desk Booked"])
        XCTAssertEqual(FrontDeskTodayList.slot(for: arrived, now: now, timeZone: stLucia)?.kind, .arrival)
        XCTAssertNil(FrontDeskTodayList.slot(for: other, now: now, timeZone: stLucia))

        // A record that is not in a context (not live) is never listed.
        let detached = Patient(fullName: "Front Desk Detached")
        detached.operationDate = now
        XCTAssertEqual(FrontDeskTodayList.todaysPatients([detached], now: now, timeZone: stLucia).count, 0)
        XCTAssertNil(FrontDeskTodayList.slot(for: detached, now: now, timeZone: stLucia))
    }
}
