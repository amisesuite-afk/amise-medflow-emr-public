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
                loadEvents()
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
        loadEvents()
        return event
    }

    func availableCalendars() -> [EKCalendar] {
        store.calendars(for: .event).filter { $0.allowsContentModifications }
    }

    private func loadEvents() {
        // Fetch ±1 month in past, +3 months forward — anchored in ECT
        let start = Calendar.ect.date(byAdding: .month, value: -1, to: .now) ?? .now
        let end   = Calendar.ect.date(byAdding: .month, value: 3,  to: .now) ?? .now
        let pred  = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        events = store.events(matching: pred).filter { !$0.isAllDay || $0.startDate != nil }
            .sorted { ($0.startDate ?? .distantFuture) < ($1.startDate ?? .distantFuture) }
    }
}

// MARK: - Calendar errors

enum CalendarError: LocalizedError {
    case accessDenied
    var errorDescription: String? {
        "Calendar access denied — enable in Settings → Privacy & Security → Calendars."
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
