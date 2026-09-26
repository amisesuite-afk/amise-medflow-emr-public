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
        case appointmentType = "appointment_type"
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

/// When a push may clear `pendingSync`: only when the server returned the written row (an update
/// that RLS does not apply returns no rows and no error) and the record was not edited while the
/// request ran (`updatedAt` unchanged since the payload was built). Otherwise the record stays
/// pending, the pull does not overwrite it, and the next sync sends it again. Pure; tested in
/// SyncGapsTests.
enum SyncPushConfirmation {
    static func mayClearPending(rowsReturned: Int, editedAtBeforeRequest: Date?,
                                editedAtNow: Date?) -> Bool {
        rowsReturned > 0 && editedAtBeforeRequest == editedAtNow
    }
}

/// What an UPDATE that returned no row means. RLS filters an UPDATE's rows silently: a policy
/// whose USING clause excludes this user (e.g. `doctors_update_prescriptions`, doctor or admin
/// only) matches 0 rows, with no error. Without this the record stayed pending and was sent again
/// every sync, for ever, and the user was never told. Pure; tested in SyncCompletenessTests.
enum SyncZeroRowUpdate {
    enum Outcome: Equatable {
        /// A row came back: the update was applied.
        case applied
        /// Signed out: requests run as `anon`, which matches nothing. Not a role refusal.
        case retryLater
        /// The row is still there (a select by id finds it) but the update matched nothing: not
        /// permitted for this user's role. Marked refused like a 42501.
        case refused
        /// No such row (deleted on the server, or not visible to this user). Not a refusal: the
        /// record keeps its local changes and stays pending.
        case rowGone
    }

    /// - rowStillExists: whether a select by id found the row (only asked when it matters).
    static func outcome(rowsReturned: Int, signedIn: Bool, rowStillExists: Bool) -> Outcome {
        if rowsReturned > 0 { return .applied }
        guard signedIn else { return .retryLater }
        return rowStillExists ? .refused : .rowGone
    }
}

extension SyncService {

    /// Call after every UPDATE of a record that has a server row (patients, notes, prescriptions,
    /// vitals, billing items, operative plans). When it returned no row and the user is signed in,
    /// a select by id tells a refusal (row there: marked refused, so it is skipped until the next
    /// sign-in and "not permitted for your role" shows) from a row that is gone (left pending).
    /// Throws only what the select throws (the caller's per-record catch handles it).
    func markRefusedIfUpdateNotApplied(rowsReturned: Int, table: String, remoteId: String,
                                       id: UUID, kind: SyncRefusals.Kind) async throws {
        guard rowsReturned == 0 else { return }
        // Same guard as markIfRefused: signed out, a request runs as `anon`.
        let signedIn = isSignedIn && SupabaseConfig.client.auth.currentUser != nil
        guard signedIn else { return }
        struct IdRow: Decodable { let id: String }
        let found: [IdRow] = try await SupabaseConfig.client
            .from(table)
            .select("id")
            .eq("id", value: remoteId)
            .limit(1)
            .execute()
            .value
        switch SyncZeroRowUpdate.outcome(rowsReturned: 0, signedIn: true, rowStillExists: !found.isEmpty) {
        case .refused:
            SyncRefusals.mark(id, as: kind)
            CrashReporting.breadcrumb("Sync: \(kind.rawValue) change not permitted (0 rows)",
                                      category: "sync")
        case .rowGone:
            SyncSkipLog.note(id, .serverRowMissing)
            CrashReporting.breadcrumb("Sync: \(kind.rawValue) update matched no row", category: "sync")
        case .applied, .retryLater:
            break
        }
    }

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
        SyncSkipLog.note(id, .sendFailed, detail: error.localizedDescription)
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
