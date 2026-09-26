// SyncService+Billing.swift
// Billing item sync: push (insert new, update edited) and pull.

import Foundation
import SwiftData
import Supabase

/// The body of the `patient_billing_items` UPDATE for an edited line (units, fee, modifier and
/// note are edited inline in BillingView): every column the insert sends except patient_id (set
/// once, at insert). All are NOT NULL on the server and non-optional here. Internal for
/// SyncGapsTests.
struct BillingItemUpdateRow: Encodable {
    let cpt_code: String
    let cpt_description: String
    let cpt_category: String
    let units: Int
    let amount_xcd: Double
    let modifier: String
    let note: String
    let added_at: String

    init(_ item: BillingLineItem, iso: ISO8601DateFormatter = ISO8601DateFormatter()) {
        cpt_code = item.cptCode
        cpt_description = item.cptDescription
        cpt_category = item.cptCategory
        units = item.units
        amount_xcd = item.amountXCD
        modifier = item.modifier
        note = item.note
        added_at = iso.string(from: item.addedAt)
    }
}

extension SyncService {

    // MARK: - Billing item sync

    func pushPendingBillingItems(context: ModelContext) async throws {
        let refused = SyncRefusals.ids(.billingItem)
        // New lines (insert) and edits to ones already in the cloud (update).
        let pending = try context.fetch(FetchDescriptor<BillingLineItem>())
            .filter { $0.pendingSync && !refused.contains($0.id.uuidString) }
        guard !pending.isEmpty else { return }

        let iso = ISO8601DateFormatter()
        let tombstoned = SyncTombstones.ids(in: .billingItems)
        var firstError: Error?

        struct BilRow: Encodable {
            let patient_id: String
            let cpt_code: String
            let cpt_description: String
            let cpt_category: String
            let units: Int
            let amount_xcd: Double
            let modifier: String
            let note: String
            let added_at: String
        }
        struct BilResponse: Decodable { let id: String }

        for item in pending {
            // The loop awaits the network; an item deleted meanwhile must not be read.
            guard item.isLive else { continue }
            let localId = item.id
            // An edit made while the request below runs is not in it: the line then stays
            // pending for the next sync.
            let editedAt = item.updatedAt

            // Per-record: one refused or rejected item stays pending and does not hold back the
            // rest (SyncService+Refusals.swift).
            do {
                switch SyncRemoteId.kind(item.remoteId) {
                case .server(let remoteId):
                    // Deleted on this device (soft delete queued): never update it.
                    guard !tombstoned.contains(remoteId) else { continue }
                    let updated: [BilResponse] = try await SupabaseConfig.client
                        .from("patient_billing_items")
                        .update(BillingItemUpdateRow(item, iso: iso))
                        .eq("id", value: remoteId)
                        .select("id")
                        .execute()
                        .value
                    // 0 rows back: not applied (RLS, or the row is gone). It stays pending, and is
                    // marked refused when the row is still there.
                    try await markRefusedIfUpdateNotApplied(rowsReturned: updated.count,
                                                            table: "patient_billing_items",
                                                            remoteId: remoteId,
                                                            id: localId, kind: .billingItem)
                    guard item.isLive else { continue }
                    if SyncPushConfirmation.mayClearPending(rowsReturned: updated.count,
                                                            editedAtBeforeRequest: editedAt,
                                                            editedAtNow: item.updatedAt) {
                        item.pendingSync = false
                        item.syncedAt = .now
                    }

                case .notInserted:
                    // UUID guard: never a booking placeholder or malformed id as patient_id.
                    guard let patientId = SyncRemoteId.serverId(item.patient?.remoteId) else { continue }
                    let row = BilRow(
                        patient_id: patientId,
                        cpt_code: item.cptCode,
                        cpt_description: item.cptDescription,
                        cpt_category: item.cptCategory,
                        units: item.units,
                        amount_xcd: item.amountXCD,
                        modifier: item.modifier,
                        note: item.note,
                        added_at: iso.string(from: item.addedAt)
                    )
                    let response: [BilResponse] = try await SupabaseConfig.client
                        .from("patient_billing_items")
                        .insert(row)
                        .select("id")
                        .execute()
                        .value
                    guard item.isLive, let first = response.first else { continue }
                    item.remoteId = first.id   // always: a later edit is then sent as an update
                    if SyncPushConfirmation.mayClearPending(rowsReturned: response.count,
                                                            editedAtBeforeRequest: editedAt,
                                                            editedAtNow: item.updatedAt) {
                        item.pendingSync = false
                        item.syncedAt = .now
                    }
                    try? context.save()   // persist the id at once so a crash can't cause a re-insert

                case .appointmentPlaceholder, .invalid:
                    continue   // not a row id: never sent (SyncRemoteIds.swift)
                }
            } catch {
                guard continueAfterPushFailure(error, id: localId, kind: .billingItem,
                                               firstError: &firstError) else { break }
            }
        }
        try context.save()
        if let firstError { throw firstError }
    }

    private struct RemoteBillingItem: Decodable, Sendable {
        let id: String
        let patient_id: String
        let cpt_code: String
        let cpt_description: String
        let cpt_category: String
        let units: Int
        let amount_xcd: Double
        let modifier: String
        let note: String
        let added_at: String
        let deleted_at: String?   // nil when live, or when the server predates Migration 87
    }

    func pullBillingItems(context: ModelContext) async throws {
        let rows: [RemoteBillingItem] = try await selectIncludingDeleted(
            from: "patient_billing_items",
            columns: "id, patient_id, cpt_code, cpt_description, cpt_category, units, amount_xcd, modifier, note, added_at",
            orderBy: "added_at", limit: 1000)

        let allLocal = try context.fetch(FetchDescriptor<BillingLineItem>())
        let allPatients = try context.fetch(FetchDescriptor<Patient>())

        let deleted = SyncTombstones.ids(in: .billingItems)
        for row in rows {
            guard !deleted.contains(row.id) else { continue }   // deleted on this device
            // isLive first: never read attributes of a model deleted earlier in this loop.
            let existing = allLocal.first(where: { $0.isLive && $0.remoteId == row.id })
            if row.deleted_at != nil {
                // Deleted on another device or the web: drop the local copy (unless it has
                // unsent changes) and never insert it.
                if let existing, !existing.pendingSync { context.delete(existing) }
                continue
            }
            let addedAt = SyncTimestamp.parse(row.added_at)
            if let existing {
                // Edited on another device or the web (units, fee, modifier, note): take the
                // server's values unless this device has unsent changes. patient_billing_items
                // has no updated_at, so the values decide (ChildPullMerge).
                let sameCode: Bool = existing.cptCode == row.cpt_code
                    && existing.cptDescription == row.cpt_description
                    && existing.cptCategory == row.cpt_category
                let sameCharge: Bool = existing.units == row.units
                    && ChildPullMerge.same(existing.amountXCD, row.amount_xcd)
                    && existing.modifier == row.modifier
                    && existing.note == row.note
                var sameTime = true
                if let addedAt { sameTime = ChildPullMerge.sameInstant(addedAt, existing.addedAt) }
                if ChildPullMerge.action(hasLocal: true, localPending: existing.pendingSync,
                                         fieldsDiffer: !(sameCode && sameCharge && sameTime),
                                         serverUpdatedAt: nil,
                                         localUpdatedAt: existing.updatedAt) == .update {
                    existing.cptCode        = row.cpt_code
                    existing.cptDescription = row.cpt_description
                    existing.cptCategory    = row.cpt_category
                    existing.units          = row.units
                    existing.amountXCD      = row.amount_xcd
                    existing.modifier       = row.modifier
                    existing.note           = row.note
                    if let addedAt { existing.addedAt = addedAt }
                    existing.updatedAt      = .now
                    existing.syncedAt       = .now
                }
                continue
            }
            guard let patient = allPatients.first(where: { $0.isLive && $0.remoteId == row.patient_id }) else { continue }

            let item = BillingLineItem(code: row.cpt_code,
                                      description: row.cpt_description,
                                      category: row.cpt_category)
            item.units      = row.units
            item.amountXCD  = row.amount_xcd
            item.modifier   = row.modifier
            item.note       = row.note
            item.addedAt    = addedAt ?? .now
            item.patient    = patient
            item.remoteId   = row.id
            item.pendingSync = false
            item.syncedAt   = .now
            context.insert(item)
        }
        try context.save()
    }


}
