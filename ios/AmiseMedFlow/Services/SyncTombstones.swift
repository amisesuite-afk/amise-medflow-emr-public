// SyncTombstones.swift
// Remembers cloud records deleted on this device (notes, prescriptions, vitals, billing items,
// documents) so the next sync pull does not re-create them.
//
// Staff accounts cannot DELETE these rows on the server (admin-only in RLS), so a delete is
// local to this device: the other device keeps its copy until an admin removes the row or a
// server-side soft-delete is added. This store only stops the deleting device from getting the
// record back.

import Foundation

enum SyncTombstones {
    enum Table: String {
        case clinicalNotes = "clinical_notes"
        case prescriptions = "prescriptions"
        case vitals = "vitals"
        case billingItems = "patient_billing_items"
        case documents = "documents"
    }

    private static func key(_ table: Table) -> String { "amf.tombstones.\(table.rawValue)" }

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
}
