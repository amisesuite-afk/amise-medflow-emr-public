import Foundation

struct GoogleCalendarEvent: Identifiable, Decodable {
    let id: String
    let summary: String
    let start: String
    let end: String
    let type: String

    var startDate: Date? { ISO8601DateFormatter().date(from: start) }
    var endDate: Date?   { ISO8601DateFormatter().date(from: end) }

    var typeColor: String {
        switch type {
        case "theatre":   return "purple"
        case "endoscopy": return "cyan"
        case "clinic":    return "blue"
        case "break":     return "gray"
        default:          return "secondary"
        }
    }

    var typeLabel: String {
        switch type {
        case "theatre":   return "THTR"
        case "endoscopy": return "ENDO"
        case "clinic":    return "CLIN"
        case "break":     return "BRK"
        default:          return "EVT"
        }
    }
}

private struct UpcomingResponse: Decodable {
    let events: [GoogleCalendarEvent]
    let fetchedAt: String
}

@MainActor
final class CalendarService: ObservableObject {
    @Published var events: [GoogleCalendarEvent] = []
    @Published var isLoading = false
    @Published var isSyncing = false
    @Published var error: String?
    @Published var fetchedAt: Date?

    func fetch() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        await load()
    }

    func sync() async {
        isSyncing = true
        error = nil
        defer { isSyncing = false }
        do {
            let token = try await accessToken()
            guard let url = URL(string: "\(AppConfig.apiServerURL)/api/scheduling/sync") else { return }
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            _ = try await URLSession.shared.data(for: req)
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func load() async {
        do {
            let token = try await accessToken()
            guard let url = URL(string: "\(AppConfig.apiServerURL)/api/scheduling/upcoming?days=30") else { return }
            var req = URLRequest(url: url)
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            let (data, _) = try await URLSession.shared.data(for: req)
            let decoded = try JSONDecoder().decode(UpcomingResponse.self, from: data)
            events = decoded.events
            fetchedAt = ISO8601DateFormatter().date(from: decoded.fetchedAt)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func accessToken() async throws -> String {
        try await SupabaseConfig.client.auth.session.accessToken
    }
}
