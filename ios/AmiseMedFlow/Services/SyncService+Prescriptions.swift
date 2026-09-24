// SyncService+Prescriptions.swift
// Prescription sync: push (insert new, update edited) and pull prescription records.

import Foundation
import SwiftData
import Supabase

/// The body of the `prescriptions` UPDATE for an edited prescription: the same values the insert
/// sends, without patient_id and prescriber_id (set once, at insert). An empty field is left out
/// of the JSON, as in the insert (the live schema, Migration 31, has NOT NULL dose, frequency and
/// route, so an explicit null would fail the whole update). Internal for SyncGapsTests.
struct PrescriptionUpdateRow: Encodable {
    let drug_name: String
    let dose: String?
    let route: String?
    let frequency: String?
    let duration: String?
    let indication: String?
    let instructions: String?
    let prescribed_at: String

    init(_ rx: Prescription, iso: ISO8601DateFormatter = ISO8601DateFormatter()) {
        drug_name = rx.drug
        dose = rx.dose.isEmpty ? nil : rx.dose
        route = rx.route.isEmpty ? nil : rx.route
        frequency = rx.frequency.isEmpty ? nil : rx.frequency
        duration = rx.duration.isEmpty ? nil : rx.duration
        indication = rx.indication.isEmpty ? nil : rx.indication
        instructions = rx.instructions
        prescribed_at = iso.string(from: rx.prescribedAt)
    }
}

extension SyncService {

    // MARK: - Prescription sync

    func pushPendingPrescriptions(context: ModelContext) async throws {
        let refused = SyncRefusals.ids(.prescription)
        // New prescriptions (insert) and edits to ones already in the cloud (update).
        let pending = try context.fetch(FetchDescriptor<Prescription>())
            .filter { $0.pendingSync && !refused.contains($0.id.uuidString) }
        guard !pending.isEmpty else { return }

        let iso = ISO8601DateFormatter()
        let tombstoned = SyncTombstones.ids(in: .prescriptions)
        var firstError: Error?

        struct RxRow: Encodable {
            let patient_id: String
            let prescriber_id: String
            let drug_name: String
            let dose: String?
            let route: String?
            let frequency: String?
            let duration: String?
            let indication: String?
            let instructions: String?
            let prescribed_at: String
        }
        struct RxResponse: Decodable { let id: String }

        for rx in pending {
            // The loop awaits the network; a prescription deleted meanwhile must not be read.
            guard rx.isLive else { continue }
            let localId = rx.id
            // An edit made while the request below runs is not in it: the prescription then stays
            // pending for the next sync.
            let editedAt = rx.updatedAt

            // Per-record try/catch so one bad row doesn't abort the whole sync. A failed row keeps
            // pendingSync = true; a refused one (42501) is not retried until the next sign-in.
            do {
                switch SyncRemoteId.kind(rx.remoteId) {
                case .server(let remoteId):
                    // Deleted on this device (soft delete queued): never update it.
                    guard !tombstoned.contains(remoteId) else { continue }
                    // Edit to a prescription already in the cloud: update it in place. RLS
                    // (doctors_update_prescriptions) allows doctor/admin; 0 rows back means not
                    // applied — it stays pending locally rather than losing the edit.
                    let updated: [RxResponse] = try await SupabaseConfig.client
                        .from("prescriptions")
                        .update(PrescriptionUpdateRow(rx, iso: iso))
                        .eq("id", value: remoteId)
                        .select("id")
                        .execute()
                        .value
                    guard rx.isLive else { continue }
                    if SyncPushConfirmation.mayClearPending(rowsReturned: updated.count,
                                                            editedAtBeforeRequest: editedAt,
                                                            editedAtNow: rx.updatedAt) {
                        rx.pendingSync = false
                        rx.syncedAt = .now
                    }

                case .notInserted:
                    // UUID guard: never a booking placeholder or malformed id as patient_id.
                    guard let patientId = SyncRemoteId.serverId(rx.patient?.remoteId) else { continue }
                    guard let prescriberId = currentUserId else { continue }
                    let row = RxRow(
                        patient_id: patientId,
                        prescriber_id: prescriberId,
                        drug_name: rx.drug,
                        dose: rx.dose.isEmpty ? nil : rx.dose,
                        route: rx.route.isEmpty ? nil : rx.route,
                        frequency: rx.frequency.isEmpty ? nil : rx.frequency,
                        duration: rx.duration.isEmpty ? nil : rx.duration,
                        indication: rx.indication.isEmpty ? nil : rx.indication,
                        instructions: rx.instructions,
                        prescribed_at: iso.string(from: rx.prescribedAt)
                    )
                    let response: [RxResponse] = try await SupabaseConfig.client
                        .from("prescriptions")
                        .insert(row)
                        .select("id")
                        .execute()
                        .value
                    guard rx.isLive, let first = response.first else { continue }
                    rx.remoteId = first.id   // always: a later edit is then sent as an update
                    if SyncPushConfirmation.mayClearPending(rowsReturned: response.count,
                                                            editedAtBeforeRequest: editedAt,
                                                            editedAtNow: rx.updatedAt) {
                        rx.pendingSync = false
                        rx.syncedAt = .now
                    }
                    try? context.save()   // persist the id at once so a crash can't cause a re-insert

                case .appointmentPlaceholder, .invalid:
                    continue   // not a row id: never sent (SyncRemoteIds.swift)
                }
            } catch {
                guard continueAfterPushFailure(error, id: localId, kind: .prescription,
                                               firstError: &firstError) else { break }
            }
        }
        try context.save()
        if let firstError { throw firstError }
    }

    private struct RemotePrescription: Decodable, Sendable {
        let id: String
        let patient_id: String
        let drug_name: String   // Supabase column is drug_name
        let dose: String?
        let route: String?
        let frequency: String?
        let duration: String?
        let indication: String?
        let instructions: String?
        let prescribed_at: String
        let deleted_at: String?   // nil when live, or when the server predates Migration 87
    }

    func pullPrescriptions(context: ModelContext) async throws {
        let rows: [RemotePrescription] = try await selectIncludingDeleted(
            from: "prescriptions",
            columns: "id, patient_id, drug_name, dose, route, frequency, duration, indication, instructions, prescribed_at",
            orderBy: "prescribed_at", limit: 500)

        let allLocal = try context.fetch(FetchDescriptor<Prescription>())
        let allPatients = try context.fetch(FetchDescriptor<Patient>())
        let iso = ISO8601DateFormatter()

        let deleted = SyncTombstones.ids(in: .prescriptions)
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

            let rx = Prescription(drug: row.drug_name,
                                  dose: row.dose ?? "",
                                  route: row.route ?? "Oral",
                                  frequency: row.frequency ?? "",
                                  duration: row.duration ?? "",
                                  indication: row.indication ?? "")
            rx.instructions = row.instructions
            rx.prescribedAt = iso.date(from: row.prescribed_at) ?? .now
            rx.patient = patient
            rx.remoteId = row.id
            rx.pendingSync = false
            rx.syncedAt = .now
            context.insert(rx)
        }
        try context.save()
    }


}
