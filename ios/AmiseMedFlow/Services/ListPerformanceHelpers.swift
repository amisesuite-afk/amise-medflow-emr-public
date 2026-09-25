import Foundation

// ListPerformanceHelpers.swift
// Small helpers behind the list / dashboard performance work (Today, Patients, Ward Round,
// Schedule, patient overview, consultation, clinical dashboard). Each one replaces work that a
// screen used to repeat many times per render (re-sorting a relationship, re-running the NEWS2
// chart, re-filtering every calendar entry per day cell). Results are identical to the code they
// replace. Tests: AmiseMedFlowTests/PerformanceHelpersTests.swift.

enum ListPerf {

    /// Items newest first, like `sorted { date($0) > date($1) }`, with equal dates kept in input
    /// order. Reads each date once (a sort comparator reads two SwiftData attributes per comparison).
    static func newestFirst<T>(_ items: [T], by date: (T) -> Date) -> [T] {
        items.enumerated()
            .map { (date: date($0.element), index: $0.offset, item: $0.element) }
            .sorted { $0.date != $1.date ? $0.date > $1.date : $0.index < $1.index }
            .map(\.item)
    }

    /// The newest item in one pass: same as `newestFirst(items, by: date).first` (the first of
    /// equal newest dates, in input order), without sorting.
    static func newest<T>(_ items: [T], by date: (T) -> Date) -> T? {
        var best: T?
        var bestDate: Date?
        for item in items {
            let d = date(item)
            if let bd = bestDate, d <= bd { continue }
            best = item
            bestDate = d
        }
        return best
    }

    /// "A, B +3 more": the first `shown` names, then how many were left out.
    static func namesSummary(_ names: [String], shown: Int) -> String {
        names.prefix(shown).joined(separator: ", ")
            + (names.count > shown ? " +\(names.count - shown) more" : "")
    }

    /// NEWS2 change between the two most recent scored entries (newest first), or nil with fewer
    /// than two. Positive = rising.
    static func news2TrendDelta(newestFirstScores scores: [Int]) -> Int? {
        guard scores.count >= 2 else { return nil }
        return scores[0] - scores[1]
    }

    /// Arrow shown next to NEWS2 in patient rows for a trend delta ("" when there is no trend).
    static func news2TrendArrow(_ delta: Int?) -> String {
        guard let delta else { return "" }
        if delta > 0 { return "↑" }
        if delta < 0 { return "↓" }
        return "→"
    }

    /// First occurrence of each id, in input order.
    static func uniqued<T, ID: Hashable>(_ items: [T], id: (T) -> ID) -> [T] {
        var seen = Set<ID>()
        return items.filter { seen.insert(id($0)).inserted }
    }

    /// Items whose date falls on one of `days` in `calendar`. Same result as
    /// `items.filter { i in days.contains { calendar.isDate(date(i), inSameDayAs: $0) } }`,
    /// with one start-of-day per item instead of one calendar comparison per item per day.
    static func onDays<T>(_ items: [T], days: [Date], date: (T) -> Date, calendar: Calendar) -> [T] {
        let daySet = Set(days.map { calendar.startOfDay(for: $0) })
        return items.filter { daySet.contains(calendar.startOfDay(for: date($0))) }
    }

    /// Items grouped by start of day in `calendar`, input order kept within each day. Looking up
    /// `grouped[calendar.startOfDay(for: day)]` gives the same list as filtering all items with
    /// `calendar.isDate(_:inSameDayAs: day)`.
    static func groupedByDay<T>(_ items: [T], date: (T) -> Date, calendar: Calendar) -> [Date: [T]] {
        Dictionary(grouping: items) { calendar.startOfDay(for: date($0)) }
    }

    /// Stable list id for a calendar event. EventKit can return events without an identifier;
    /// those used to get a fresh UUID on every render, so SwiftUI rebuilt their blocks each time.
    static func calendarEntryID(eventIdentifier: String?, title: String?, start: Date, ordinal: Int) -> String {
        if let eventIdentifier { return "K\(eventIdentifier)" }
        return "K#\(ordinal)|\(start.timeIntervalSince1970)|\(title ?? "")"
    }

    /// Completion of a pathway's documentation steps: the steps not in `uncounted`, how many are
    /// in `filled`, and the labels of those that are not (in step order).
    static func pathwayProgress<Tab: Hashable>(steps: [Tab],
                                               uncounted: Set<Tab>,
                                               filled: Set<Tab>,
                                               label: (Tab) -> String) -> (filled: Int, total: Int, missing: [String]) {
        let counted = steps.filter { !uncounted.contains($0) }
        let missing = counted.filter { !filled.contains($0) }.map(label)
        return (counted.count - missing.count, counted.count, missing)
    }
}

// MARK: - NEWS2 snapshot

/// The NEWS2 values of one vitals entry, charted once. Every `VitalsEntry.news2*` property re-runs
/// `NEWS2Chart.evaluate` (reading all observations again), and rows used to call several of them.
struct News2Snapshot: Equatable {
    let score: Int
    let risk: String
    let colorHex: String
    let isComplete: Bool
    let hasRedFlag: Bool

    /// Same text as `VitalsEntry.news2RiskDisplay`.
    var riskDisplay: String { isComplete ? risk : "\(risk) · incomplete" }

    init(result: NEWS2Result) {
        score = result.total
        risk = result.band.label
        colorHex = result.band.colorHex
        isComplete = result.isComplete
        hasRedFlag = result.hasSingleParameterScore3
    }

    init(_ vitals: VitalsEntry) {
        self.init(result: vitals.news2Result)
    }
}
