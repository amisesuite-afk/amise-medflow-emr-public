// CrashReporting.swift
// Crash, freeze (app hang) and watchdog-termination reporting via Sentry.
//
// Patient data must never leave the device in a report:
//  • no screenshots, no view hierarchy (they show names, diagnoses, notes)
//  • no network breadcrumbs or failed-request capture (URLs carry MRNs / record ids)
//  • no automatic UI breadcrumbs (can include on-screen text); only the fixed, PHI-free
//    breadcrumbs this app adds itself through `CrashReporting.breadcrumb(_:)`
//  • no user, IP address or request data (sendDefaultPii off; stripped again in beforeSend)
// Stack traces, device model, OS and app version are what we need to fix crashes and freezes.
//
// Turned on only when SENTRY_DSN is set in Configuration.xcconfig (Info.plist → SENTRY_DSN).

import Foundation
import Sentry

enum CrashReporting {

    /// Raw value from Info.plist (after the build expands $(SENTRY_DSN)).
    private static var rawDSN: String {
        ((Bundle.main.object(forInfoDictionaryKey: "SENTRY_DSN") as? String) ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".,;:"))   // stray paste punctuation
    }

    /// The DSN, or nil when reporting is not configured or the value is not a valid DSN.
    static var dsn: String? {
        let dsn = rawDSN
        guard dsn.wholeMatch(of: #/https://[0-9a-f]+@[A-Za-z0-9.\-]+/[0-9]+/#) != nil else { return nil }
        return dsn
    }

    static var isEnabled: Bool { dsn != nil }

    /// Shown in Settings → Diagnostics.
    static var statusText: String {
        if isEnabled { return "On" }
        return rawDSN.isEmpty || rawDSN.contains("$(") ? "Off — not set" : "Off — key invalid"
    }

    static func start() {
        guard let dsn else { return }
        SentrySDK.start { options in
            options.dsn = dsn
            #if DEBUG
            options.environment = "debug"
            #else
            options.environment = "release"
            #endif

            // What we want: crashes, freezes, watchdog kills.
            options.enableCrashHandler = true
            options.enableAppHangTracking = true
            options.appHangTimeoutInterval = 2
            options.enableWatchdogTerminationTracking = true

            // What must never be sent (patient data).
            options.sendDefaultPii = false
            options.attachScreenshot = false
            options.attachViewHierarchy = false
            options.enableNetworkBreadcrumbs = false
            options.enableNetworkTracking = false
            options.enableCaptureFailedRequests = false
            options.enableAutoBreadcrumbTracking = false
            options.enableUserInteractionTracing = false
            options.tracesSampleRate = 0

            options.beforeBreadcrumb = { crumb in
                // Only our own fixed breadcrumbs; drop anything network-related defensively.
                crumb.category == "http" ? nil : crumb
            }
            options.beforeSend = { event in
                event.user = nil
                event.request = nil
                event.serverName = nil
                return event
            }
        }
    }

    /// A fixed, PHI-free marker of where the user was (e.g. "Opened Clinical Scores").
    /// Never pass patient names, MRNs, diagnoses or free text.
    static func breadcrumb(_ message: String, category: String = "navigation") {
        guard isEnabled else { return }
        let crumb = Breadcrumb(level: .info, category: category)
        crumb.message = message
        SentrySDK.addBreadcrumb(crumb)
    }

    /// Settings → "Send test report": confirms reports reach Sentry.
    static func sendTestEvent() {
        guard isEnabled else { return }
        SentrySDK.capture(message: "MedFlow test report (sent from Settings)")
    }
}
