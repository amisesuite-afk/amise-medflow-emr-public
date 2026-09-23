// SyncService+Billing.swift
// Billing item sync.

import Foundation
import SwiftData
import Supabase

extension SyncService {

    // MARK: - Billing item sync

    func pushPendingBillingItems(context: ModelContext) async throws {
        let pending = try context.fetch(FetchDescriptor<BillingLineItem>())
            .filter { $0.pendingSync && $0.remoteId == nil }
        guard !pending.isEmpty else { return }

        let iso = ISO8601DateFormatter()

        for item in pending {
            guard let patientId = item.patient?.remoteId else { continue }

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
            let response: [BilResponse] = try await SupabaseConfig.client
                .from("patient_billing_items")
                .insert(row)
                .select("id")
                .execute()
                .value
            if let first = response.first {
                item.remoteId = first.id
                item.pendingSync = false
                item.syncedAt = .now
            }
        }
        try context.save()
    }

    private struct RemoteBillingItem: Decodable {
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
    }

    func pullBillingItems(context: ModelContext) async throws {
        let rows: [RemoteBillingItem] = try await SupabaseConfig.client
            .from("patient_billing_items")
            .select("id, patient_id, cpt_code, cpt_description, cpt_category, units, amount_xcd, modifier, note, added_at")
            .order("added_at", ascending: false)
            .limit(1000)
            .execute()
            .value

        let allLocal = try context.fetch(FetchDescriptor<BillingLineItem>())
        let allPatients = try context.fetch(FetchDescriptor<Patient>())
        let iso = ISO8601DateFormatter()

        for row in rows {
            guard allLocal.first(where: { $0.remoteId == row.id }) == nil else { continue }
            guard let patient = allPatients.first(where: { $0.remoteId == row.patient_id }) else { continue }

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
