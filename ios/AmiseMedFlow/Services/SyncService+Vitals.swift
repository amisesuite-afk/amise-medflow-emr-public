// SyncService+Vitals.swift
// Vitals entry sync.

import Foundation
import SwiftData
import Supabase

extension SyncService {

    // MARK: - Vitals sync

    func pushPendingVitals(context: ModelContext) async throws {
        let pending = try context.fetch(FetchDescriptor<VitalsEntry>())
            .filter { $0.pendingSync && $0.remoteId == nil && $0.hasAnyValue }
        guard !pending.isEmpty else { return }

        let iso = ISO8601DateFormatter()

        for v in pending {
            guard let patientId = v.patient?.remoteId else { continue }

            struct VRow: Encodable {
                let patient_id: String
                let recorded_at: String
                let bp_systolic: Int?
                let bp_diastolic: Int?
                let heart_rate: Int?
                let respiratory_rate: Int?
                let temperature_c: Double?
                let spo2: Int?
                let weight_kg: Double?
                let glucose_mmol: Double?
                let avpu: String
                let on_supplemental_o2: Bool
                let notes: String?
            }
            let row = VRow(
                patient_id: patientId,
                recorded_at: iso.string(from: v.recordedAt),
                bp_systolic: v.bpSystolic,
                bp_diastolic: v.bpDiastolic,
                heart_rate: v.heartRate,
                respiratory_rate: v.respiratoryRate,
                temperature_c: v.temperatureCelsius,
                spo2: v.spo2,
                weight_kg: v.weightKg,
                glucose_mmol: v.glucoseMmol,
                avpu: v.avpu.rawValue,
                on_supplemental_o2: v.onSupplementalO2,
                notes: v.notes
            )
            struct VResponse: Decodable { let id: String }
            let response: [VResponse] = try await SupabaseConfig.client
                .from("patient_vitals")
                .insert(row)
                .select("id")
                .execute()
                .value
            if let first = response.first {
                v.remoteId = first.id
                v.pendingSync = false
                v.syncedAt = .now
            }
        }
        try context.save()
    }

    private struct RemoteVitals: Decodable, Sendable {
        let id: String
        let patient_id: String
        let recorded_at: String
        let bp_systolic: Int?
        let bp_diastolic: Int?
        let heart_rate: Int?
        let respiratory_rate: Int?
        let temperature_c: Double?
        let spo2: Int?
        let weight_kg: Double?
        let glucose_mmol: Double?
        let avpu: String?
        let on_supplemental_o2: Bool?
        let notes: String?
        let deleted_at: String?   // nil when live, or when the server predates Migration 87
    }

    func pullVitals(context: ModelContext) async throws {
        let rows: [RemoteVitals] = try await selectIncludingDeleted(
            from: "patient_vitals",
            columns: "id, patient_id, recorded_at, bp_systolic, bp_diastolic, heart_rate, respiratory_rate, temperature_c, spo2, weight_kg, glucose_mmol, avpu, on_supplemental_o2, notes",
            orderBy: "recorded_at", limit: 1000)

        let allLocal = try context.fetch(FetchDescriptor<VitalsEntry>())
        let allPatients = try context.fetch(FetchDescriptor<Patient>())
        let iso = ISO8601DateFormatter()

        let deletedVitals = SyncTombstones.ids(in: .vitals)
        for row in rows {
            guard !deletedVitals.contains(row.id) else { continue }   // deleted on this device
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

            let entry = VitalsEntry(patient: patient,
                                   recordedAt: iso.date(from: row.recorded_at) ?? .now)
            entry.bpSystolic       = row.bp_systolic
            entry.bpDiastolic      = row.bp_diastolic
            entry.heartRate        = row.heart_rate
            entry.respiratoryRate  = row.respiratory_rate
            entry.temperatureCelsius = row.temperature_c
            entry.spo2             = row.spo2
            entry.weightKg         = row.weight_kg
            entry.glucoseMmol      = row.glucose_mmol
            entry.avpu             = AVPU(rawValue: row.avpu ?? "A") ?? .alert
            entry.onSupplementalO2 = row.on_supplemental_o2 ?? false
            entry.notes            = row.notes
            entry.remoteId         = row.id
            entry.pendingSync      = false
            entry.syncedAt         = .now
            context.insert(entry)
        }
        try context.save()
    }


}
