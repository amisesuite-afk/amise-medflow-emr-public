import Foundation
import Supabase

// MARK: - Supabase configuration
//
// To configure: Xcode → Project → Target → Info → Add keys:
//   SUPABASE_URL      – your Supabase project URL (e.g. https://xxxx.supabase.co)
//   SUPABASE_ANON_KEY – the JWT anon key (starts with eyJ…)
//
// These are read from Info.plist at runtime so the values never touch source code.

enum SupabaseConfig {
    static let supabaseURL: URL = {
        let raw = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? ""
        guard let url = URL(string: raw), !raw.isEmpty else {
            fatalError("SUPABASE_URL not set in Info.plist")
        }
        return url
    }()

    static let anonKey: String = {
        let key = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String ?? ""
        guard !key.isEmpty else {
            fatalError("SUPABASE_ANON_KEY not set in Info.plist")
        }
        return key
    }()

    static let client = SupabaseClient(supabaseURL: supabaseURL, supabaseKey: anonKey)
}
