// SyncService+ApprovedContent.swift
// Fetches the published releases of the channel-enabled shared rule files
// (public.clinical_content_releases, Migration 98; docs/APPROVED-CONTENT-CHANNEL.md) and hands them
// to ApprovedContentStore, which verifies them (ApprovedContent.swift) and keeps the one in force.
// Read-only: the app never writes the table.
//
// Own request, never throws, never sets syncError: nothing here can hold back the rest of the sync.
// At most once every six hours (and at sign-in / launch). Every staff role reads (RLS decides).
//   • Table missing (Migration 98 not applied: 42P01 / PGRST205 / PGRST204 / 42703) → no releases:
//     the stored release is removed and the bundled files stay in force.
//   • Any other failure (offline, timeout) → the stored release, verified when it was fetched and
//     again at every load, is kept until the next successful check.

import Foundation
import Supabase

extension SyncService {

    private static let approvedContentCheckedKey = "amf.sync.approvedContent.checkedAt"

    /// Check again at the next sync: called at sign-in and session restore.
    static func clearApprovedContentChecked() {
        UserDefaults.standard.removeObject(forKey: approvedContentCheckedKey)
    }

    func syncApprovedContent() async {
        guard isSignedIn else { return }
        let last = UserDefaults.standard.object(forKey: Self.approvedContentCheckedKey) as? Date
        guard OutcomeSync.shouldAttempt(now: .now, unavailableSince: last) else { return }
        let ids = ApprovedContent.policy.keys.sorted()
        guard !ids.isEmpty else { return }
        do {
            // Revoked rows are fetched too and refused by the selection (so the device drops a
            // release that was revoked since the last check).
            let rows: [ApprovedContent.Release] = try await SupabaseConfig.client
                .from("clinical_content_releases")
                .select("id, content_id, version, sha256, body, published_at, signoff_ref, revoked_at")
                .in("content_id", values: ids)
                .order("published_at", ascending: false)
                .limit(200)
                .execute()
                .value
            ApprovedContentStore.apply(fetched: rows)
            UserDefaults.standard.set(Date(), forKey: Self.approvedContentCheckedKey)
        } catch {
            if OutcomeSync.isMissingTable(code: (error as? PostgrestError)?.code) {
                ApprovedContentStore.apply(fetched: [])
                UserDefaults.standard.set(Date(), forKey: Self.approvedContentCheckedKey)
                CrashReporting.breadcrumb("Sync: approved-content table not available yet (Migration 98)", category: "sync")
            }
            // Other errors: keep the stored release; try again at the next sync.
        }
    }
}
