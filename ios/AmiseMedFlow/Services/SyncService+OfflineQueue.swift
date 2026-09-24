// SyncService+OfflineQueue.swift
// Pending count and offline write queue (flushed on reconnect).

import Foundation
import SwiftData
import Supabase

extension SyncService {

    // MARK: - Pending count

    func recountPending(context: ModelContext) {
        let pCount = (try? context.fetch(FetchDescriptor<Patient>()))?.filter { $0.pendingSync }.count ?? 0
        let nCount = (try? context.fetch(FetchDescriptor<ClinicalNote>()))?.filter { $0.pendingSync }.count ?? 0
        let rxCount = (try? context.fetch(FetchDescriptor<Prescription>()))?.filter { $0.pendingSync }.count ?? 0
        let vCount  = (try? context.fetch(FetchDescriptor<VitalsEntry>()))?.filter { $0.pendingSync }.count ?? 0
        let opCount  = (try? context.fetch(FetchDescriptor<OperativePlan>()))?.filter { $0.pendingSync }.count ?? 0
        let bilCount = (try? context.fetch(FetchDescriptor<BillingLineItem>()))?.filter { $0.pendingSync }.count ?? 0
        pendingCount = pCount + nCount + rxCount + vCount + opCount + bilCount
    }

    // MARK: - Offline write queue (persisted in UserDefaults, flushed on reconnect)

    private static let outboxKey = "com.amise.medflow.sync-outbox"

    struct OutboxEntry: Codable {
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

    func loadOutbox() -> [OutboxEntry] {
        guard let data = UserDefaults.standard.data(forKey: Self.outboxKey),
              let entries = try? JSONDecoder().decode([OutboxEntry].self, from: data)
        else { return [] }
        return entries
    }

    func saveOutbox(_ entries: [OutboxEntry]) {
        if let data = try? JSONEncoder().encode(entries) {
            UserDefaults.standard.set(data, forKey: Self.outboxKey)
        }
    }


}
