import Foundation
import UserNotifications
import SwiftUI

// Schedules local push notifications for appointment reminders.
// No server dependency — fires entirely from the device.

@MainActor
final class NotificationService: ObservableObject {
    @Published var isAuthorized = false

    func requestPermission() async {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
            isAuthorized = granted
        } catch {
            isAuthorized = false
        }
    }

    func checkAuthorization() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        isAuthorized = settings.authorizationStatus == .authorized
    }

    // MARK: - Schedule reminders for an appointment

    /// Schedules two reminders: morning-of (08:00 ECT) and 1-hour-before.
    func scheduleReminders(id: String, patientName: String, date: Date, type: String) async {
        await scheduleOneHourBefore(id: id, patientName: patientName, date: date, type: type)
        await scheduleMorningOf(id: id, patientName: patientName, date: date, type: type)
    }

    func cancelReminders(id: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: [reminderID(id, suffix: "1h"), reminderID(id, suffix: "morning")]
        )
    }

    // MARK: - Private

    private func scheduleOneHourBefore(id: String, patientName: String, date: Date, type: String) async {
        let fireDate = date.addingTimeInterval(-3600)
        guard fireDate > .now else { return }

        let content = UNMutableNotificationContent()
        content.title = "Appointment in 1 hour"
        content.body = "\(patientName) — \(type)"
        content.sound = .default
        content.interruptionLevel = .timeSensitive

        let trigger = UNCalendarNotificationTrigger(
            dateMatching: Calendar.ect.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate),
            repeats: false
        )
        let request = UNNotificationRequest(
            identifier: reminderID(id, suffix: "1h"),
            content: content, trigger: trigger
        )
        try? await UNUserNotificationCenter.current().add(request)
    }

    private func scheduleMorningOf(id: String, patientName: String, date: Date, type: String) async {
        var comps = Calendar.ect.dateComponents([.year, .month, .day], from: date)
        comps.hour = 8; comps.minute = 0
        guard let fireDate = Calendar.ect.date(from: comps), fireDate > .now else { return }

        let content = UNMutableNotificationContent()
        content.title = "Appointment today"
        content.body = "\(patientName) — \(type) at \(DateFormatter.ectShort.string(from: date))"
        content.sound = .default

        let trigger = UNCalendarNotificationTrigger(
            dateMatching: Calendar.ect.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate),
            repeats: false
        )
        let request = UNNotificationRequest(
            identifier: reminderID(id, suffix: "morning"),
            content: content, trigger: trigger
        )
        try? await UNUserNotificationCenter.current().add(request)
    }

    private func reminderID(_ base: String, suffix: String) -> String { "appt-\(base)-\(suffix)" }
}
