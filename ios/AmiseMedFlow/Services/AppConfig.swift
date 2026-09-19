import Foundation

// MARK: - App-wide configuration
//
// Recommended: set sensitive values in Xcode via a Configuration.xcconfig file
// rather than environment variables in the scheme. xcconfig values flow through
// Info.plist into Bundle.main.infoDictionary and are not visible in process listings.
//
// In Configuration.xcconfig:
//   ANTHROPIC_API_KEY = sk-ant-...
//   API_SERVER_URL    = https://your-render-url.onrender.com
//
// In Info.plist add string entries:
//   ANTHROPIC_API_KEY  → $(ANTHROPIC_API_KEY)
//   API_SERVER_URL     → $(API_SERVER_URL)

// MARK: - Practice timezone + shared formatters
//
// Saint Lucia — Eastern Caribbean Time, UTC-4, no DST.
// All clinical documents and display strings must use this timezone so
// that timestamps are correct regardless of the device's regional setting.

extension TimeZone {
    /// Eastern Caribbean Time — the practice's canonical timezone.
    static let ect = TimeZone(identifier: "America/St_Lucia")!
}

extension Calendar {
    /// Gregorian calendar fixed to ECT — use for all clinical date arithmetic.
    static let ect: Calendar = {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .ect
        cal.locale   = Locale(identifier: "en_LC")
        return cal
    }()
}

extension DateFormatter {
    /// Medium date, short time — "Sep 4, 2026 · 14:32" — in ECT.
    static let ectDateTime: DateFormatter = {
        let df = DateFormatter()
        df.locale     = Locale(identifier: "en_LC")
        df.timeZone   = .ect
        df.dateStyle  = .medium
        df.timeStyle  = .short
        return df
    }()

    /// Medium date only — "Sep 4, 2026" — in ECT.
    static let ectDate: DateFormatter = {
        let df = DateFormatter()
        df.locale     = Locale(identifier: "en_LC")
        df.timeZone   = .ect
        df.dateStyle  = .medium
        df.timeStyle  = .none
        return df
    }()

    /// Short date + short time — "9/4/26, 14:32" — in ECT. For compact UI labels.
    static let ectShort: DateFormatter = {
        let df = DateFormatter()
        df.locale     = Locale(identifier: "en_LC")
        df.timeZone   = .ect
        df.dateStyle  = .short
        df.timeStyle  = .short
        return df
    }()

    /// Long date + short time — "September 4, 2026 at 14:32" — in ECT. For document headers.
    static let ectLong: DateFormatter = {
        let df = DateFormatter()
        df.locale     = Locale(identifier: "en_LC")
        df.timeZone   = .ect
        df.dateStyle  = .long
        df.timeStyle  = .short
        return df
    }()
}

enum AppConfig {
    static let anthropicAPIKey: String = {
        // 1. xcconfig / Info.plist (preferred for production builds)
        if let key = Bundle.main.object(forInfoDictionaryKey: "ANTHROPIC_API_KEY") as? String,
           !key.isEmpty, !key.hasPrefix("$(") {
            return key
        }
        // 2. Xcode scheme environment variable (convenient for dev)
        if let key = ProcessInfo.processInfo.environment["ANTHROPIC_API_KEY"],
           !key.isEmpty {
            return key
        }
        return "sk-ant-REPLACE_WITH_YOUR_KEY"
    }()

    // Clinical AI model — use claude-sonnet-5 for best accuracy on complex clinical tasks;
    // fall back to haiku-4-5 via env var for cost-sensitive deployments.
    static let anthropicModel: String = {
        ProcessInfo.processInfo.environment["ANTHROPIC_MODEL"]
            ?? Bundle.main.object(forInfoDictionaryKey: "ANTHROPIC_MODEL") as? String
            ?? "claude-sonnet-5"
    }()

    static let supabaseStorageBucket = "patient-documents"

    static let apiServerURL: String = {
        if let url = Bundle.main.object(forInfoDictionaryKey: "API_SERVER_URL") as? String,
           !url.isEmpty, !url.hasPrefix("$(") {
            return url
        }
        return ProcessInfo.processInfo.environment["API_SERVER_URL"]
            ?? "https://amise-medflow-api.onrender.com"
    }()
}
