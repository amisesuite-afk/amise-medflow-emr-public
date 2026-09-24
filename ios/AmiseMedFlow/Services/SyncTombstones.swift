// SyncTombstones.swift
// Remembers cloud records deleted on this device (notes, prescriptions, vitals, billing items,
// documents) until the server has recorded the delete.
//
// A tombstone does two jobs:
//   1. Outbox: SyncService.flushSoftDeletes() sends each one to the server's soft_delete() RPC
//      (supabase-soft-delete-migration.sql, Migration 87), which sets deleted_at so every other
//      device and the web app drop the record too. The tombstone is removed only after the
//      server confirms; offline, or before the migration is applied, it stays and is retried.
//   2. Fallback: while it exists, the pull skips that row, so the record never comes back on
//      this device even if the server delete has not happened (yet, or ever).
//
// If the server refuses (the user's role may not delete that kind of record), the id is marked
// "refused": it stays a local-only delete (job 2) and is not retried until the next sign-in or
// app launch, so a front-desk delete does not hit the server every 30 seconds.

import Foundation

enum SyncTombstones {
    /// Raw values are the UserDefaults key suffixes used since the tombstones were introduced —
    /// do not change them or existing tombstones are lost. The Supabase table is `serverTable`.
    enum Table: String, CaseIterable {
        case clinicalNotes = "clinical_notes"
        case prescriptions = "prescriptions"
        case vitals = "vitals"
        case billingItems = "patient_billing_items"
        case documents = "documents"

        /// The table the iOS sync reads and writes (and the name soft_delete() expects).
        var serverTable: String {
            switch self {
            case .clinicalNotes: "clinical_notes"
            case .prescriptions: "prescriptions"
            case .vitals:        "patient_vitals"
            case .billingItems:  "patient_billing_items"
            case .documents:     "patient_documents"
            }
        }
    }

    private static func key(_ table: Table) -> String { "amf.tombstones.\(table.rawValue)" }
    private static func refusedKey(_ table: Table) -> String { "amf.tombstones.refused.\(table.rawValue)" }

    static func add(_ remoteId: String?, in table: Table) {
        guard let remoteId, !remoteId.isEmpty else { return }
        var ids = UserDefaults.standard.stringArray(forKey: key(table)) ?? []
        guard !ids.contains(remoteId) else { return }
        ids.append(remoteId)
        if ids.count > 5000 { ids.removeFirst(ids.count - 5000) }
        UserDefaults.standard.set(ids, forKey: key(table))
    }

    /// All tombstoned ids for a table — read once per pull, not per row.
    static func ids(in table: Table) -> Set<String> {
        Set(UserDefaults.standard.stringArray(forKey: key(table)) ?? [])
    }

    /// Called only after the server has confirmed the soft delete.
    static func remove(_ remoteId: String, in table: Table) {
        var ids = UserDefaults.standard.stringArray(forKey: key(table)) ?? []
        ids.removeAll { $0 == remoteId }
        UserDefaults.standard.set(ids, forKey: key(table))
        var refused = UserDefaults.standard.stringArray(forKey: refusedKey(table)) ?? []
        if refused.contains(remoteId) {
            refused.removeAll { $0 == remoteId }
            UserDefaults.standard.set(refused, forKey: refusedKey(table))
        }
    }

    // MARK: - Refused by the server (kept as local-only deletes, not retried)

    static func markRefused(_ remoteId: String, in table: Table) {
        var ids = UserDefaults.standard.stringArray(forKey: refusedKey(table)) ?? []
        guard !ids.contains(remoteId) else { return }
        ids.append(remoteId)
        if ids.count > 5000 { ids.removeFirst(ids.count - 5000) }
        UserDefaults.standard.set(ids, forKey: refusedKey(table))
    }

    static func refusedIds(in table: Table) -> Set<String> {
        Set(UserDefaults.standard.stringArray(forKey: refusedKey(table)) ?? [])
    }

    /// Retry refused deletes once more — called at sign-in and app launch, when the user or
    /// their role may have changed.
    static func clearRefused() {
        for table in Table.allCases {
            UserDefaults.standard.removeObject(forKey: refusedKey(table))
        }
    }
}
