import XCTest
import SwiftData
@testable import AmiseMedFlow

/// ListPerf / News2Snapshot (Services/ListPerformanceHelpers.swift): the helpers that replaced
/// work the busiest screens repeated on every render. Each must give exactly what the code it
/// replaced gave.
@MainActor
final class PerformanceHelpersTests: XCTestCase {

    private struct Item: Equatable {
        let name: String
        let date: Date
    }

    private let t0 = Date(timeIntervalSince1970: 1_790_000_000)

    private func item(_ name: String, _ minutes: Double) -> Item {
        Item(name: name, date: t0.addingTimeInterval(minutes * 60))
    }

    // MARK: - newestFirst / newest

    func testNewestFirstMatchesDescendingSort() {
        let items = [item("a", 5), item("b", 1), item("c", 9), item("d", 3)]
        XCTAssertEqual(ListPerf.newestFirst(items, by: { $0.date }).map(\.name), ["c", "a", "d", "b"])
        XCTAssertEqual(ListPerf.newestFirst(items, by: { $0.date }),
                       items.sorted { $0.date > $1.date })
    }

    func testNewestFirstKeepsInputOrderForEqualDates() {
        let items = [item("first", 2), item("older", 1), item("second", 2), item("third", 2)]
        XCTAssertEqual(ListPerf.newestFirst(items, by: { $0.date }).map(\.name),
                       ["first", "second", "third", "older"])
    }

    func testNewestIsFirstOfNewestFirst() {
        let items = [item("a", 1), item("tie1", 7), item("b", 3), item("tie2", 7)]
        XCTAssertEqual(ListPerf.newest(items, by: { $0.date })?.name, "tie1")
        XCTAssertEqual(ListPerf.newest(items, by: { $0.date }),
                       ListPerf.newestFirst(items, by: { $0.date }).first)
    }

    func testNewestOfEmptyIsNil() {
        XCTAssertNil(ListPerf.newest([Item](), by: { $0.date }))
        XCTAssertEqual(ListPerf.newestFirst([Item](), by: { $0.date }), [])
    }

    // MARK: - namesSummary

    func testNamesSummary() {
        XCTAssertEqual(ListPerf.namesSummary([], shown: 2), "")
        XCTAssertEqual(ListPerf.namesSummary(["FBC"], shown: 2), "FBC")
        XCTAssertEqual(ListPerf.namesSummary(["FBC", "U&E"], shown: 2), "FBC, U&E")
        XCTAssertEqual(ListPerf.namesSummary(["FBC", "U&E", "LFT"], shown: 2), "FBC, U&E +1 more")
        XCTAssertEqual(ListPerf.namesSummary(["A", "B", "C", "D", "E"], shown: 3), "A, B, C +2 more")
    }

    // MARK: - NEWS2 trend

    func testNews2Trend() {
        XCTAssertNil(ListPerf.news2TrendDelta(newestFirstScores: []))
        XCTAssertNil(ListPerf.news2TrendDelta(newestFirstScores: [4]))
        XCTAssertEqual(ListPerf.news2TrendDelta(newestFirstScores: [5, 3, 9]), 2)
        XCTAssertEqual(ListPerf.news2TrendArrow(ListPerf.news2TrendDelta(newestFirstScores: [5, 3])), "↑")
        XCTAssertEqual(ListPerf.news2TrendArrow(ListPerf.news2TrendDelta(newestFirstScores: [1, 3])), "↓")
        XCTAssertEqual(ListPerf.news2TrendArrow(ListPerf.news2TrendDelta(newestFirstScores: [3, 3])), "→")
        XCTAssertEqual(ListPerf.news2TrendArrow(nil), "")
    }

    // MARK: - uniqued

    func testUniquedKeepsFirstOccurrenceInOrder() {
        let ids = [3, 1, 3, 2, 1, 4]
        XCTAssertEqual(ListPerf.uniqued(ids, id: { $0 }), [3, 1, 2, 4])
    }

    // MARK: - Calendar day helpers (practice time zone)

    private var ect: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "America/St_Lucia")!
        return c
    }

    private func utc(_ iso: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: iso)!
    }

    func testOnDaysMatchesPerDayComparison() {
        let cal = ect
        let days = [utc("2026-09-21T12:00:00Z"), utc("2026-09-22T12:00:00Z")]   // Mon, Tue AST
        let items = [
            Item(name: "mon-early", date: utc("2026-09-21T04:30:00Z")),   // 00:30 AST Mon
            Item(name: "sun-late", date: utc("2026-09-21T03:30:00Z")),    // 23:30 AST Sun
            Item(name: "tue", date: utc("2026-09-22T20:00:00Z")),
            Item(name: "wed-early", date: utc("2026-09-23T04:00:00Z")),   // 00:00 AST Wed
        ]
        let expected = items.filter { i in days.contains { cal.isDate(i.date, inSameDayAs: $0) } }
        XCTAssertEqual(ListPerf.onDays(items, days: days, date: { $0.date }, calendar: cal), expected)
        XCTAssertEqual(expected.map(\.name), ["mon-early", "tue"])
    }

    func testGroupedByDayMatchesPerCellFilter() {
        let cal = ect
        let items = [
            Item(name: "a", date: utc("2026-09-21T13:00:00Z")),
            Item(name: "b", date: utc("2026-09-22T03:59:00Z")),   // 23:59 AST on the 21st
            Item(name: "c", date: utc("2026-09-22T04:00:00Z")),   // 00:00 AST on the 22nd
            Item(name: "d", date: utc("2026-09-21T11:00:00Z")),
        ]
        let grouped = ListPerf.groupedByDay(items, date: { $0.date }, calendar: cal)
        for day in [utc("2026-09-21T16:00:00Z"), utc("2026-09-22T16:00:00Z"), utc("2026-09-23T16:00:00Z")] {
            let expected = items.filter { cal.isDate($0.date, inSameDayAs: day) }
            XCTAssertEqual(grouped[cal.startOfDay(for: day)] ?? [], expected)
        }
        XCTAssertEqual(grouped[cal.startOfDay(for: utc("2026-09-21T16:00:00Z"))]?.map(\.name), ["a", "b", "d"])
    }

    // MARK: - Calendar entry ids

    func testCalendarEntryIDIsStableAcrossRenders() {
        let start = utc("2026-09-25T13:00:00Z")
        XCTAssertEqual(ListPerf.calendarEntryID(eventIdentifier: "ABC", title: "Clinic", start: start, ordinal: 4), "KABC")
        let a = ListPerf.calendarEntryID(eventIdentifier: nil, title: "Clinic", start: start, ordinal: 4)
        let b = ListPerf.calendarEntryID(eventIdentifier: nil, title: "Clinic", start: start, ordinal: 4)
        XCTAssertEqual(a, b)
        XCTAssertNotEqual(a, ListPerf.calendarEntryID(eventIdentifier: nil, title: "Clinic", start: start, ordinal: 5))
        XCTAssertNotEqual(a, "KABC")
    }

    // MARK: - Pathway progress

    func testPathwayProgressSkipsUncountedSteps() {
        let steps = ["risk", "cc", "hpi", "exam", "history", "plan"]
        let p = ListPerf.pathwayProgress(steps: steps,
                                         uncounted: ["risk", "history"],
                                         filled: ["cc", "exam", "risk"],
                                         label: { $0.uppercased() })
        XCTAssertEqual(p.total, 4)
        XCTAssertEqual(p.filled, 2)
        XCTAssertEqual(p.missing, ["HPI", "PLAN"])
    }

    // MARK: - News2Snapshot

    func testNews2SnapshotMatchesVitalsEntry() throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        let container = try ModelContainer(for: schema,
                                           configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        let context = container.mainContext
        let patient = Patient(fullName: "Snapshot Test Patient")
        context.insert(patient)

        let partial = VitalsEntry(patient: patient)
        partial.respiratoryRate = 25
        partial.heartRate = 135
        context.insert(partial)

        let complete = VitalsEntry(patient: patient)
        complete.respiratoryRate = 16
        complete.spo2 = 98
        complete.bpSystolic = 120
        complete.bpDiastolic = 80
        complete.heartRate = 70
        complete.temperatureCelsius = 37.0
        context.insert(complete)

        for v in [partial, complete] {
            let s = News2Snapshot(v)
            XCTAssertEqual(s.score, v.news2Score)
            XCTAssertEqual(s.risk, v.news2Risk)
            XCTAssertEqual(s.colorHex, v.news2Color)
            XCTAssertEqual(s.isComplete, v.news2IsComplete)
            XCTAssertEqual(s.hasRedFlag, v.news2HasRedFlag)
            XCTAssertEqual(s.riskDisplay, v.news2RiskDisplay)
        }
        XCTAssertFalse(News2Snapshot(partial).isComplete)
        XCTAssertTrue(News2Snapshot(complete).isComplete)
    }
}
