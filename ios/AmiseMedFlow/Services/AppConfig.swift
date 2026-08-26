import Foundation

// MARK: - App-wide configuration
// Set ANTHROPIC_API_KEY in Xcode → Product → Scheme → Edit Scheme → Environment Variables
// or replace the placeholder string below.

enum AppConfig {
    static let anthropicAPIKey: String = {
        ProcessInfo.processInfo.environment["ANTHROPIC_API_KEY"]
            ?? "sk-ant-REPLACE_WITH_YOUR_KEY"
    }()

    static let anthropicModel = "claude-haiku-4-5-20251001"
    static let supabaseStorageBucket = "patient-documents"

    // API server base URL — set API_SERVER_URL in Xcode scheme env vars,
    // or replace the string below with your Render deployment URL.
    static let apiServerURL: String = {
        ProcessInfo.processInfo.environment["API_SERVER_URL"]
            ?? "https://amise-medflow-api.onrender.com"
    }()
}
