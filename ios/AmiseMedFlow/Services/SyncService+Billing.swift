// SyncService+Billing.swift
// Billing item sync.

import Foundation
import SwiftData
import Supabase

extension SyncService {

    // MARK: - Billing item sync

    func pushPendingBillingItems(context: ModelContext) async throws {
        let refused = SyncRefusals.ids(.billingItem)
        let pending = try context.fetch(FetchDescriptor<BillingLineItem>())
            .filter { $0.pendingSync && $0.remoteId == nil && !refused.contains($0.id.uuidString) }
        guard !pending.isEmpty else { return }

        let iso = ISO8601DateFormatter()
        var firstError: Error?

        for item in pending {
            // The loop awaits the network; an item deleted meanwhile must not be read.
            guard item.isLive else { continue }
            guard let patientId = item.patient?.remoteId else { continue }
            let localId = item.id

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
            struct BilResponse: Decodable { let id: String }
            // Per-record: one refused or rejected item stays pending and does not hold back the
            // rest (SyncService+Refusals.swift).
            do {
                let response: [BilResponse] = try await SupabaseConfig.client
                    .from("patient_billing_items")
                    .insert(row)
                    .select("id")
                    .execute()
                    .value
                if let first = response.first, item.isLive {
                    item.remoteId = first.id
                    item.pendingSync = false
                    item.syncedAt = .now
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
        let iso = ISO8601DateFormatter()

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
            guard existing == nil else { continue }
            guard let patient = allPatients.first(where: { $0.isLive && $0.remoteId == row.patient_id }) else { continue }

            let item = BillingLineItem(code: row.cpt_code,
                                      description: row.cpt_description,
                                      category: row.cpt_category)
            item.units      = row.units
            item.amountXCD  = row.amount_xcd
            item.modifier   = row.modifier
            item.note       = row.note
            item.addedAt    = iso.date(from: row.added_at) ?? .now
            item.patient    = patient
            item.remoteId   = row.id
            item.pendingSync = false
            item.syncedAt   = .now
            context.insert(item)
        }
        try context.save()
    }


}
