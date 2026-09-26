// SyncService+SoftDelete.swift
// Server-side soft delete (supabase-soft-delete-migration.sql, Migration 87).
//
// Push: deletes made on this device (SyncTombstones) are sent to the soft_delete() RPC, which
// sets deleted_at/deleted_by on the row and writes the audit_log entry server-side.
// Pull: the pulls select deleted_at; a row deleted elsewhere removes the local copy.
// Both halves cope with a server that does not have the migration yet.

import Foundation
import SwiftData
import Supabase

private struct SoftDeleteParams: Encodable, Sendable {
    let p_table: String
    let p_id: String
}

enum SoftDelete {
    /// The server refused for good: this user's role may not delete that record (42501), or the
    /// id/table is invalid (22P02, 22023). Retrying will not help.
    static func isRefusal(_ error: Error) -> Bool {
        guard let pgError = error as? PostgrestError, let code = pgError.code else { return false }
        return code == "42501" || code == "22P02" || code == "22023"
    }

    /// A select failed because the deleted_at column does not exist yet (migration not applied).
    static func isMissingColumn(_ error: Error) -> Bool {
        guard let pgError = error as? PostgrestError else { return false }
        return pgError.code == "42703" || pgError.message.contains("deleted_at")
    }
}

extension SyncService {

    // MARK: - Push: tombstones → soft_delete()

    /// Sends this device's deletes to the server. Never throws. A tombstone is removed only once
    /// the server confirms (deleted, already deleted, or the row no longer exists). Offline,
    /// signed out, or before the migration is applied, it stays and is retried next sync.
    func flushSoftDeletes() async {
        // Signed out, the call runs as `anon` and fails with 42501 too — that must not be taken
        // for a role refusal.
        guard isSignedIn else { return }
        for table in SyncTombstones.Table.allCases {
            let pending = SyncTombstones.ids(in: table)
                .subtracting(SyncTombstones.refusedIds(in: table))
            for remoteId in pending.sorted() {
                do {
                    try await SupabaseConfig.client
                        .rpc("soft_delete",
                             params: SoftDeleteParams(p_table: table.serverTable, p_id: remoteId))
                        .execute()
                    SyncTombstones.remove(remoteId, in: table)
                } catch {
                    if SoftDelete.isRefusal(error) {
                        // Stays deleted on this device only; not retried until next sign-in.
                        SyncTombstones.markRefused(remoteId, in: table)
                    } else {
                        // Network, auth or no soft_delete() on the server yet: try again next sync.
                        return
                    }
                }
            }
        }
    }

    // MARK: - Pull: select including deleted_at

    /// Selects `columns` plus `deleted_at`, newest first. A server without the column yet
    /// (before Migration 87) gets the old select, so the rest of the sync keeps working.
    func selectIncludingDeleted<T: Decodable & Sendable>(
        from table: String, columns: String, orderBy: String, limit: Int
    ) async throws -> T {
        do {
            return try await SupabaseConfig.client
                .from(table)
                .select(columns + ", deleted_at")
                .order(orderBy, ascending: false)
                .limit(limit)
                .execute()
                .value
        } catch {
            guard SoftDelete.isMissingColumn(error) else { throw error }
            return try await SupabaseConfig.client
                .from(table)
                .select(columns)
                .order(orderBy, ascending: false)
                .limit(limit)
                .execute()
                .value
        }
    }
}
