import Foundation
import Supabase

// MARK: - Supabase configuration
// The anon key is a public read-only key already committed in deploy-dashboard.yml.

enum SupabaseConfig {
    static let supabaseURL = URL(string: "https://nornhfzfrlmfzaqmrzzp.supabase.co")!

    // swiftlint:disable:next line_length
    static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcm5oZnpmcmxtZnphcW1yenpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5OTU5NjcsImV4cCI6MjA5NDU3MTk2N30.IQqwEuwp4_CYRj5r6H-83vjXKeob-N8z5TBwLk-rXLc"

    // emitLocalSessionAsInitialSession opts in to the SDK's next-major behaviour and silences the
    // "Initial session emitted after attempting to refresh" console warning. The app does not
    // listen to authStateChanges, and SyncService reads `auth.session`, which refreshes an expired
    // token itself, so this changes nothing at runtime.
    static let client = SupabaseClient(
        supabaseURL: supabaseURL,
        supabaseKey: anonKey,
        options: SupabaseClientOptions(auth: .init(emitLocalSessionAsInitialSession: true))
    )
}
