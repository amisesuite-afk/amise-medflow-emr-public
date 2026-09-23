// SyncService+Prescriptions.swift
// Prescription sync: push and pull prescription records.

import Foundation
import SwiftData
import Supabase

extension SyncService {

    // MARK: - Prescription sync

    func pushPendingPrescriptions(context: ModelContext) async throws {
        let pending = try context.fetch(FetchDescriptor<Prescription>())
            .filter { $0.pendingSync && $0.remoteId == nil }
        guard !pending.isEmpty else { return }

        let iso = ISO8601DateFormatter()

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
            guard let patientId = rx.patient?.remoteId else { continue }
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
            // Per-record try/catch so one bad row doesn't abort the whole sync.
            do {
                let response: [RxResponse] = try await SupabaseConfig.client
                    .from("prescriptions")
                    .insert(row)
                    .select("id")
                    .execute()
                    .value
                if let first = response.first {
                    rx.remoteId = first.id
                    rx.pendingSync = false
                    rx.syncedAt = .now
                }
            } catch {
                // Leave pendingSync = true so it retries next cycle.
                continue
            }
        }
        try context.save()
    }

    private struct RemotePrescription: Decodable {
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
    }

    func pullPrescriptions(context: ModelContext) async throws {
        let rows: [RemotePrescription] = try await SupabaseConfig.client
            .from("prescriptions")
            .select("id, patient_id, drug_name, dose, route, frequency, duration, indication, instructions, prescribed_at")
            .order("prescribed_at", ascending: false)
            .limit(500)
            .execute()
            .value

        let allLocal = try context.fetch(FetchDescriptor<Prescription>())
        let allPatients = try context.fetch(FetchDescriptor<Patient>())
        let iso = ISO8601DateFormatter()

        for row in rows {
            guard allLocal.first(where: { $0.remoteId == row.id }) == nil else { continue }
            guard let patient = allPatients.first(where: { $0.remoteId == row.patient_id }) else { continue }

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
