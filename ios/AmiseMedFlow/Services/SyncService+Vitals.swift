// SyncService+Vitals.swift
// Vitals entry sync: push (insert new, update edited) and pull.

import Foundation
import SwiftData
import Supabase

/// The body of the `patient_vitals` UPDATE for an edited entry: every measured value, without
/// patient_id (set once, at insert). Unlike the insert, a value that is now empty is sent as an
/// explicit null, so a corrected reading (e.g. a mistyped SpO₂ removed) is cleared on the server
/// too instead of lingering in other devices' NEWS2. Internal for SyncGapsTests.
struct VitalsUpdateRow: Encodable {
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

    init(_ v: VitalsEntry, iso: ISO8601DateFormatter = ISO8601DateFormatter()) {
        recorded_at = iso.string(from: v.recordedAt)
        bp_systolic = v.bpSystolic
        bp_diastolic = v.bpDiastolic
        heart_rate = v.heartRate
        respiratory_rate = v.respiratoryRate
        temperature_c = v.temperatureCelsius
        spo2 = v.spo2
        weight_kg = v.weightKg
        glucose_mmol = v.glucoseMmol
        avpu = v.avpu.rawValue
        on_supplemental_o2 = v.onSupplementalO2
        notes = v.notes
    }

    private enum CodingKeys: String, CodingKey {
        case recorded_at, bp_systolic, bp_diastolic, heart_rate, respiratory_rate, temperature_c,
             spo2, weight_kg, glucose_mmol, avpu, on_supplemental_o2, notes
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        func put<T: Encodable>(_ value: T?, _ key: CodingKeys) throws {
            if let value { try c.encode(value, forKey: key) } else { try c.encodeNil(forKey: key) }
        }
        try c.encode(recorded_at, forKey: .recorded_at)
        try put(bp_systolic, .bp_systolic)
        try put(bp_diastolic, .bp_diastolic)
        try put(heart_rate, .heart_rate)
        try put(respiratory_rate, .respiratory_rate)
        try put(temperature_c, .temperature_c)
        try put(spo2, .spo2)
        try put(weight_kg, .weight_kg)
        try put(glucose_mmol, .glucose_mmol)
        try c.encode(avpu, forKey: .avpu)
        try c.encode(on_supplemental_o2, forKey: .on_supplemental_o2)
        try put(notes, .notes)
    }
}

extension SyncService {

    // MARK: - Vitals sync

    func pushPendingVitals(context: ModelContext) async throws {
        let refused = SyncRefusals.ids(.vitals)
        // New entries (insert, once they hold a value) and edits to ones already in the cloud
        // (update).
        let pending = try context.fetch(FetchDescriptor<VitalsEntry>())
            .filter { $0.pendingSync && !refused.contains($0.id.uuidString) }
        guard !pending.isEmpty else { return }

        let iso = ISO8601DateFormatter()
        let tombstoned = SyncTombstones.ids(in: .vitals)
        var firstError: Error?

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
        struct VResponse: Decodable { let id: String }

        for v in pending {
            // The loop awaits the network; an entry deleted meanwhile must not be read.
            guard v.isLive else { continue }
            let localId = v.id
            // An edit made while the request below runs is not in it: the entry then stays
            // pending for the next sync.
            let editedAt = v.updatedAt

            // Per-record: one refused or rejected entry stays pending and does not hold back the
            // rest (SyncService+Refusals.swift).
            do {
                switch SyncRemoteId.kind(v.remoteId) {
                case .server(let remoteId):
                    // Deleted on this device (soft delete queued): never update it.
                    guard !tombstoned.contains(remoteId) else { continue }
                    let updated: [VResponse] = try await SupabaseConfig.client
                        .from("patient_vitals")
                        .update(VitalsUpdateRow(v, iso: iso))
                        .eq("id", value: remoteId)
                        .select("id")
                        .execute()
                        .value
                    // 0 rows back: not applied (RLS, or the row is gone). It stays pending, and is
                    // marked refused when the row is still there.
                    try await markRefusedIfUpdateNotApplied(rowsReturned: updated.count,
                                                            table: "patient_vitals", remoteId: remoteId,
                                                            id: localId, kind: .vitals)
                    guard v.isLive else { continue }
                    if SyncPushConfirmation.mayClearPending(rowsReturned: updated.count,
                                                            editedAtBeforeRequest: editedAt,
                                                            editedAtNow: v.updatedAt) {
                        v.pendingSync = false
                        v.syncedAt = .now
                    }

                case .notInserted:
                    guard v.hasAnyValue else { continue }
                    // UUID guard: never a booking placeholder or malformed id as patient_id.
                    guard let patientId = SyncRemoteId.serverId(v.patient?.remoteId) else { continue }
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
                    let response: [VResponse] = try await SupabaseConfig.client
                        .from("patient_vitals")
                        .insert(row)
                        .select("id")
                        .execute()
                        .value
                    guard v.isLive, let first = response.first else { continue }
                    v.remoteId = first.id   // always: a later edit is then sent as an update
                    if SyncPushConfirmation.mayClearPending(rowsReturned: response.count,
                                                            editedAtBeforeRequest: editedAt,
                                                            editedAtNow: v.updatedAt) {
                        v.pendingSync = false
                        v.syncedAt = .now
                    }
                    try? context.save()   // persist the id at once so a crash can't cause a re-insert

                case .appointmentPlaceholder, .invalid:
                    continue   // not a row id: never sent (SyncRemoteIds.swift)
                }
            } catch {
                guard continueAfterPushFailure(error, id: localId, kind: .vitals,
                                               firstError: &firstError) else { break }
            }
        }
        try context.save()
        if let firstError { throw firstError }
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
            let recordedAt = SyncTimestamp.parse(row.recorded_at)
            let avpu = AVPU(rawValue: row.avpu ?? "A") ?? .alert
            let onO2 = row.on_supplemental_o2 ?? false
            if let existing {
                // Corrected on another device or the web: take the server's readings unless this
                // device has unsent changes. patient_vitals has no updated_at, so the values
                // decide (ChildPullMerge).
                let sameCore: Bool = existing.bpSystolic == row.bp_systolic
                    && existing.bpDiastolic == row.bp_diastolic
                    && existing.heartRate == row.heart_rate
                    && existing.respiratoryRate == row.respiratory_rate
                    && existing.spo2 == row.spo2
                let sameOther: Bool = ChildPullMerge.same(existing.temperatureCelsius, row.temperature_c)
                    && ChildPullMerge.same(existing.weightKg, row.weight_kg)
                    && ChildPullMerge.same(existing.glucoseMmol, row.glucose_mmol)
                    && existing.avpu == avpu
                    && existing.onSupplementalO2 == onO2
                    && ChildPullMerge.same(existing.notes, row.notes)
                var sameTime = true
                if let recordedAt { sameTime = ChildPullMerge.sameInstant(recordedAt, existing.recordedAt) }
                if ChildPullMerge.action(hasLocal: true, localPending: existing.pendingSync,
                                         fieldsDiffer: !(sameCore && sameOther && sameTime),
                                         serverUpdatedAt: nil,
                                         localUpdatedAt: existing.updatedAt) == .update {
                    if let recordedAt { existing.recordedAt = recordedAt }
                    existing.bpSystolic         = row.bp_systolic
                    existing.bpDiastolic        = row.bp_diastolic
                    existing.heartRate          = row.heart_rate
                    existing.respiratoryRate    = row.respiratory_rate
                    existing.temperatureCelsius = row.temperature_c
                    existing.spo2               = row.spo2
                    existing.weightKg           = row.weight_kg
                    existing.glucoseMmol        = row.glucose_mmol
                    existing.avpu               = avpu
                    existing.onSupplementalO2   = onO2
                    existing.notes              = row.notes
                    existing.updatedAt          = .now
                    existing.syncedAt           = .now
                }
                continue
            }
            guard let patient = allPatients.first(where: { $0.isLive && $0.remoteId == row.patient_id }) else { continue }

            let entry = VitalsEntry(patient: patient, recordedAt: recordedAt ?? .now)
            entry.bpSystolic       = row.bp_systolic
            entry.bpDiastolic      = row.bp_diastolic
            entry.heartRate        = row.heart_rate
            entry.respiratoryRate  = row.respiratory_rate
            entry.temperatureCelsius = row.temperature_c
            entry.spo2             = row.spo2
            entry.weightKg         = row.weight_kg
            entry.glucoseMmol      = row.glucose_mmol
            entry.avpu             = avpu
            entry.onSupplementalO2 = onO2
            entry.notes            = row.notes
            entry.remoteId         = row.id
            entry.pendingSync      = false
            entry.syncedAt         = .now
            context.insert(entry)
        }
        try context.save()
    }


}
