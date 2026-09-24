// SyncService+OfflineQueue.swift
// Pending count and offline write queue (flushed on reconnect).

import Foundation
import SwiftData
import Supabase

extension SyncService {

    // MARK: - Pending count

    func recountPending(context: ModelContext) {
        let patients = (try? context.fetch(FetchDescriptor<Patient>()))?.filter(\.isLive) ?? []
        let notes    = (try? context.fetch(FetchDescriptor<ClinicalNote>()))?.filter { $0.isLive && $0.pendingSync } ?? []
        let rxs      = (try? context.fetch(FetchDescriptor<Prescription>()))?.filter { $0.isLive && $0.pendingSync } ?? []
        let vitals   = (try? context.fetch(FetchDescriptor<VitalsEntry>()))?.filter { $0.isLive && $0.pendingSync } ?? []
        let plans    = (try? context.fetch(FetchDescriptor<OperativePlan>()))?.filter { $0.isLive && $0.pendingSync } ?? []
        let bills    = (try? context.fetch(FetchDescriptor<BillingLineItem>()))?.filter { $0.isLive && $0.pendingSync } ?? []
        let pendingPatients = patients.filter(\.pendingSync)
        var total = pendingPatients.count
        total += notes.count
        total += rxs.count
        total += vitals.count
        total += plans.count
        total += bills.count
        pendingCount = total

        // Records the server refused for this role (SyncService+Refusals.swift) that still hold
        // unsent changes. Counted from the live records, so a refused record deleted since is
        // not counted.
        func refusedCount(_ ids: [UUID], _ kind: SyncRefusals.Kind) -> Int {
            let refused = SyncRefusals.ids(kind)
            guard !refused.isEmpty else { return 0 }
            return ids.filter { refused.contains($0.uuidString) }.count
        }
        let unsentPathway = patients.filter { $0.pathwayDataJson != nil && $0.pathwayDataJson != $0.pathwaySyncedJson }
        let unsentScale2 = patients.filter(\.news2Scale2NeedsPush)
        var refused = refusedCount(pendingPatients.map(\.id), .patient)
        refused += refusedCount(notes.map(\.id), .clinicalNote)
        refused += refusedCount(rxs.map(\.id), .prescription)
        refused += refusedCount(vitals.map(\.id), .vitals)
        refused += refusedCount(plans.map(\.id), .operativePlan)
        refused += refusedCount(bills.map(\.id), .billingItem)
        refused += refusedCount(unsentPathway.map(\.id), .pathwayData)
        refused += refusedCount(unsentScale2.map(\.id), .news2Scale2)
        syncNotice = SyncRefusals.notice(count: refused)
    }

    // MARK: - Offline write queue (persisted in UserDefaults, flushed on reconnect)

    private static let outboxKey = "com.amise.medflow.sync-outbox"

    private struct OutboxEntry: Codable {
        let entityType: String
        let entityId:   String
        let payload:    [String: String]   // values serialised to String for Codable compatibility
        let enqueuedAt: Date
    }

    func enqueue(entityType: String, entityId: String, payload: [String: Any]) {
        var entries = loadOutbox()
        // Serialise Any values to String to survive Codable round-trip
        let stringPayload = payload.reduce(into: [String: String]()) { dict, pair in
            dict[pair.key] = "\(pair.value)"
        }
        entries.append(OutboxEntry(entityType: entityType, entityId: entityId,
                                   payload: stringPayload, enqueuedAt: .now))
        saveOutbox(entries)
        pendingCount += 1
    }

    @MainActor
    func flushOutbox() async {
        let entries = loadOutbox()
        guard !entries.isEmpty else { return }

        var failed: [OutboxEntry] = []
        for entry in entries {
            do {
                // Re-drive the appropriate push by marking the local entity dirty again.
                // Entities are identified by entityType + entityId (local UUID string).
                guard let ctx = modelContext else { failed.append(entry); continue }
                switch entry.entityType {
                case "patient":
                    let all = try ctx.fetch(FetchDescriptor<Patient>())
                    if let p = all.first(where: { $0.id.uuidString == entry.entityId }) {
                        p.pendingSync = true
                    }
                case "clinical_note":
                    let all = try ctx.fetch(FetchDescriptor<ClinicalNote>())
                    if let n = all.first(where: { $0.id.uuidString == entry.entityId }) {
                        n.pendingSync = true
                    }
                case "prescription":
                    let all = try ctx.fetch(FetchDescriptor<Prescription>())
                    if let rx = all.first(where: { $0.id.uuidString == entry.entityId }) {
                        rx.pendingSync = true
                    }
                case "vitals":
                    let all = try ctx.fetch(FetchDescriptor<VitalsEntry>())
                    if let v = all.first(where: { $0.id.uuidString == entry.entityId }) {
                        v.pendingSync = true
                    }
                case "operative_plan":
                    let all = try ctx.fetch(FetchDescriptor<OperativePlan>())
                    if let op = all.first(where: { $0.id.uuidString == entry.entityId }) {
                        op.pendingSync = true
                    }
                case "billing_item":
                    let all = try ctx.fetch(FetchDescriptor<BillingLineItem>())
                    if let bil = all.first(where: { $0.id.uuidString == entry.entityId }) {
                        bil.pendingSync = true
                    }
                default:
                    break
                }
            } catch {
                failed.append(entry)
            }
        }
        saveOutbox(failed)
        pendingCount = max(0, pendingCount - (entries.count - failed.count))

        // Let the normal sync push handle re-marked entities
        if let ctx = modelContext {
            try? await pushPendingPatients(context: ctx)
            try? await pushPendingNotes(context: ctx)
            try? await pushPendingPrescriptions(context: ctx)
            try? await pushPendingVitals(context: ctx)
            try? await pushPendingOperativePlans(context: ctx)
            try? await pullOperativePlans(context: ctx)
            try? await pushPendingBillingItems(context: ctx)
            try? await pullBillingItems(context: ctx)
        }
    }

    private func loadOutbox() -> [OutboxEntry] {
        guard let data = UserDefaults.standard.data(forKey: Self.outboxKey),
              let entries = try? JSONDecoder().decode([OutboxEntry].self, from: data)
        else { return [] }
        return entries
    }

    private func saveOutbox(_ entries: [OutboxEntry]) {
        if let data = try? JSONEncoder().encode(entries) {
            UserDefaults.standard.set(data, forKey: Self.outboxKey)
        }
    }


}
