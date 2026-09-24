// SyncService+Refusals.swift
// Per-record error handling for the cloud push loops, and the "refused" list.
//
// One record the server will not take must not stop the rest of the sync:
//   • A permission refusal (PostgrestError 42501: RLS, or the Migration 89 patient column
//     guard) is marked "refused" for that record. The record keeps its local data and its
//     pendingSync (so the pull still will not overwrite it), is skipped by the push loops, and
//     is retried after the next sign-in or app launch, when the user or their role may have
//     changed. Same pattern as refused deletes (SyncTombstones.markRefused).
//   • Any other error for one record (a CHECK violation, a bad value) leaves it pending, and the
//     loop goes on to the next record. The loop reports the first such error when it ends.
//   • A transport error (offline, cancelled) stops the loop: every later record would fail too.
//
// The list holds local model UUIDs only (no patient data), in UserDefaults like the tombstones.
// Breadcrumbs name the record type and the error class, never the record.

import Foundation
import Supabase

enum SyncRefusals {
    /// Raw values are UserDefaults key suffixes: append, never rename.
    enum Kind: String, CaseIterable {
        case patient        = "patient"
        case clinicalNote   = "clinical_note"
        case prescription   = "prescription"
        case vitals         = "vitals"
        case operativePlan  = "operative_plan"
        case billingItem    = "billing_item"
        case pathwayData    = "pathway_data"
        case news2Scale2    = "news2_scale2"
    }

    /// The server refused the write for this user: 42501 is both "RLS policy violation" and the
    /// Migration 89 column guard. Retrying with the same user and data will not help.
    static func isPermissionRefusal(_ error: Error) -> Bool {
        guard let pgError = error as? PostgrestError else { return false }
        return pgError.code == "42501"
    }

    private static func key(_ kind: Kind) -> String { "amf.sync.refused.\(kind.rawValue)" }

    static func mark(_ id: UUID, as kind: Kind) {
        var ids = UserDefaults.standard.stringArray(forKey: key(kind)) ?? []
        let raw = id.uuidString
        guard !ids.contains(raw) else { return }
        ids.append(raw)
        if ids.count > 5000 { ids.removeFirst(ids.count - 5000) }
        UserDefaults.standard.set(ids, forKey: key(kind))
    }

    /// All refused ids of one kind — read once per loop, not per record.
    static func ids(_ kind: Kind) -> Set<String> {
        Set(UserDefaults.standard.stringArray(forKey: key(kind)) ?? [])
    }

    /// Retry everything once more: called at sign-in and app launch (session restore).
    static func clearAll() {
        for kind in Kind.allCases {
            UserDefaults.standard.removeObject(forKey: key(kind))
        }
    }

    /// Short, PHI-free status line, e.g. "1 change not permitted for your role".
    static func notice(count: Int) -> String? {
        guard count > 0 else { return nil }
        return count == 1
            ? "1 change not permitted for your role"
            : "\(count) changes not permitted for your role"
    }
}

extension SyncService {

    /// Handles an error from pushing ONE record. Returns true when the loop should go on to the
    /// next record, false when it should stop (transport error). Errors other than a refusal are
    /// kept in `firstError` so the loop can report one when it ends.
    func continueAfterPushFailure(_ error: Error, id: UUID, kind: SyncRefusals.Kind,
                                  firstError: inout Error?) -> Bool {
        if error is URLError || error is CancellationError {
            if firstError == nil { firstError = error }
            return false
        }
        if markIfRefused(error, id: id, kind: kind) { return true }
        CrashReporting.breadcrumb("Sync: \(kind.rawValue) push failed", category: "sync")
        if firstError == nil { firstError = error }
        return true
    }

    /// Marks the record refused when `error` is a permission refusal for the signed-in user, and
    /// returns true. Any other error returns false. Also used directly by the own-request pushes
    /// (pathway data, NEWS2 Scale 2), which stop on any other error and retry next sync.
    func markIfRefused(_ error: Error, id: UUID, kind: SyncRefusals.Kind) -> Bool {
        // Signed out, a request runs as `anon` and fails with 42501 too: not a role refusal.
        guard SyncRefusals.isPermissionRefusal(error), isSignedIn,
              SupabaseConfig.client.auth.currentUser != nil else { return false }
        SyncRefusals.mark(id, as: kind)
        CrashReporting.breadcrumb("Sync: \(kind.rawValue) change not permitted (42501)",
                                  category: "sync")
        return true
    }

    /// Runs one step of `sync()`. A failure is recorded (first error wins) and never stops the
    /// steps after it.
    func runSyncStep(_ name: String, _ body: () async throws -> Void) async {
        do {
            try await body()
        } catch {
            CrashReporting.breadcrumb("Sync step failed: \(name)", category: "sync")
            if syncError == nil { syncError = error.localizedDescription }
        }
    }
}
