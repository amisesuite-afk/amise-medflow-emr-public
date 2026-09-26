import Foundation
import EventKit
import SwiftUI

// Reads events directly from the iOS Calendar store, which syncs with Google
// Calendar when the user has added their Google account in iOS Settings →
// Mail → Accounts (or Settings → Calendar → Accounts).

@MainActor
final class CalendarService: ObservableObject {
    @Published var events: [EKEvent] = []
    @Published var isLoading = false
    @Published var isSyncing = false
    @Published var error: String?

    private let store = EKEventStore()

    func fetch() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
        await authoriseAndLoad()
    }

    func sync() async {
        isSyncing = true
        error = nil
        defer { isSyncing = false }
        await authoriseAndLoad()
    }

    private func authoriseAndLoad() async {
        #if DEBUG
        // Demo mode: no calendar permission prompt and no real calendar events.
        if UITestDemoMode.isActive { events = []; return }
        #endif
        do {
            let granted: Bool
            if #available(iOS 17.0, *) {
                granted = try await store.requestFullAccessToEvents()
            } else {
                granted = try await withCheckedThrowingContinuation { cont in
                    store.requestAccess(to: .event) { ok, err in
                        if let err { cont.resume(throwing: err) }
                        else { cont.resume(returning: ok) }
                    }
                }
            }
            if granted {
                await loadEvents()
            } else {
                error = "Calendar access denied — enable in Settings → Privacy & Security → Calendars."
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Create theatre / procedure booking

    @discardableResult
    func createTheatreBooking(
        procedure: String,
        patientName: String,
        date: Date,
        duration: TimeInterval,
        notes: String,
        calendar: EKCalendar? = nil
    ) async throws -> EKEvent {
        let granted: Bool
        if #available(iOS 17.0, *) {
            granted = try await store.requestFullAccessToEvents()
        } else {
            granted = try await withCheckedThrowingContinuation { cont in
                store.requestAccess(to: .event) { ok, err in
                    if let err { cont.resume(throwing: err) }
                    else { cont.resume(returning: ok) }
                }
            }
        }
        guard granted else { throw CalendarError.accessDenied }

        let event = EKEvent(eventStore: store)
        event.title = "\(patientName) — \(procedure)"
        event.startDate = date
        event.endDate = date.addingTimeInterval(duration)
        event.notes = notes.isEmpty ? nil : notes
        event.calendar = calendar ?? store.defaultCalendarForNewEvents
        try store.save(event, span: .thisEvent)
        await loadEvents()
        return event
    }

    // MARK: - Check-in event (front-desk → Apple Calendar)

    /// Creates a 30-minute "Checked In" block for the patient starting at checkInTime.
    @discardableResult
    func createCheckInEvent(patientName: String, checkInTime: Date, notes: String = "") async throws -> EKEvent {
        let granted: Bool
        if #available(iOS 17.0, *) {
            granted = try await store.requestFullAccessToEvents()
        } else {
            granted = try await withCheckedThrowingContinuation { cont in
                store.requestAccess(to: .event) { ok, err in
                    if let err { cont.resume(throwing: err) }
                    else { cont.resume(returning: ok) }
                }
            }
        }
        guard granted else { throw CalendarError.accessDenied }

        let event = EKEvent(eventStore: store)
        event.title = "Check-In — \(patientName)"
        event.startDate = checkInTime
        event.endDate = checkInTime.addingTimeInterval(1800) // 30 min slot
        if !notes.isEmpty { event.notes = notes }
        event.calendar = store.defaultCalendarForNewEvents
        try store.save(event, span: .thisEvent)
        await loadEvents()
        return event
    }

    // MARK: - Follow-up event

    /// Creates a follow-up appointment block on the given date.
    @discardableResult
    func createFollowUpEvent(patientName: String, date: Date, duration: TimeInterval = 1800, notes: String = "") async throws -> EKEvent {
        let granted: Bool
        if #available(iOS 17.0, *) {
            granted = try await store.requestFullAccessToEvents()
        } else {
            granted = try await withCheckedThrowingContinuation { cont in
                store.requestAccess(to: .event) { ok, err in
                    if let err { cont.resume(throwing: err) }
                    else { cont.resume(returning: ok) }
                }
            }
        }
        guard granted else { throw CalendarError.accessDenied }

        let event = EKEvent(eventStore: store)
        event.title = "Follow-Up — \(patientName)"
        event.startDate = date
        event.endDate = date.addingTimeInterval(duration)
        if !notes.isEmpty { event.notes = notes }
        event.calendar = store.defaultCalendarForNewEvents
        try store.save(event, span: .thisEvent)
        await loadEvents()
        return event
    }

    func availableCalendars() -> [EKCalendar] {
        store.calendars(for: .event).filter { $0.allowsContentModifications }
    }

    // MARK: - Loading events

    /// The load in flight, if any: one EventKit fetch at a time.
    private var loadTask: Task<Void, Never>?
    /// Set when a load is asked for while one is running: the running load does one more pass
    /// (the store may have changed since it started, e.g. a booking was just saved).
    private var reloadRequested = false

    /// Refreshes `events`. Returns once `events` reflects the store as of this call.
    private func loadEvents() async {
        if let running = loadTask {
            reloadRequested = true
            await running.value
            return
        }
        let task = Task { await self.runLoads() }
        loadTask = task
        await task.value
    }

    private func runLoads() async {
        repeat {
            reloadRequested = false
            // Fetched off the main thread; published here, on the main actor.
            events = await Self.fetchEvents(from: store)
        } while reloadRequested
        loadTask = nil
    }

    /// `events(matching:)` is synchronous and four months of events can take a while, so it runs
    /// on a background queue (Apple: run it on another thread). Same store, so the returned
    /// events stay usable with it.
    nonisolated private static func fetchEvents(from store: EKEventStore) async -> [EKEvent] {
        await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                continuation.resume(returning: Self.matchingEvents(in: store))
            }
        }
    }

    nonisolated private static func matchingEvents(in store: EKEventStore) -> [EKEvent] {
        // Fetch ±1 month in past, +3 months forward — anchored in ECT
        let start = Calendar.ect.date(byAdding: .month, value: -1, to: .now) ?? .now
        let end   = Calendar.ect.date(byAdding: .month, value: 3,  to: .now) ?? .now
        let pred  = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        return store.events(matching: pred).filter { event in
            // Only show events created by the current user (Dr Kabiye).
            // Shared theatre calendars from other doctors have organizer.isCurrentUser == false.
            if let org = event.organizer, !org.isCurrentUser { return false }
            return !event.isAllDay || event.startDate != nil
        }.sorted { ($0.startDate ?? .distantFuture) < ($1.startDate ?? .distantFuture) }
    }
}

// MARK: - Calendar errors

enum CalendarError: LocalizedError {
    case accessDenied
    var errorDescription: String? {
        "Calendar access denied — enable in Settings → Privacy & Security → Calendars."
    }
}

// MARK: - Stable list rows

/// A calendar event with a stable list id (`ListPerf.calendarEntryID`, as in ScheduleView).
/// `eventIdentifier` can be nil, and two such events used the same (nil) id in a ForEach.
struct CalendarEventRow: Identifiable {
    let id: String
    let event: EKEvent

    static func rows(_ events: [EKEvent]) -> [CalendarEventRow] {
        events.enumerated().map { ordinal, event in
            CalendarEventRow(
                id: ListPerf.calendarEntryID(eventIdentifier: event.eventIdentifier, title: event.title,
                                             start: event.startDate ?? .distantPast, ordinal: ordinal),
                event: event)
        }
    }
}

// MARK: - EKEvent helpers used by ScheduleView

extension EKEvent {
    var calEntryLabel: String {
        let t = (calendar?.title ?? "").lowercased()
        if t.contains("theatre") || t.contains("theater") || t.contains("surg") { return "THTR" }
        if t.contains("endoscopy") || t.contains("scope") || t.contains("ercp") { return "ENDO" }
        if t.contains("clinic") || t.contains("outpatient") || t.contains("opd") { return "CLIN" }
        if t.contains("break") || t.contains("lunch") || t.contains("admin") { return "BRK" }
        return "CAL"
    }

    var calEntryColor: Color {
        if let cgc = calendar?.cgColor { return Color(cgc) }
        switch calEntryLabel {
        case "THTR": return .purple
        case "ENDO": return .cyan
        case "CLIN": return .blue
        default:     return Color(.systemGray2)
        }
    }
}
