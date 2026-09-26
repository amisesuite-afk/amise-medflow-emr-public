// SyncService+AppointmentType.swift
// Cloud sync of the booking type the front-desk scheduler records on the patient:
// Patient.appointmentType ⇄ patients.appointment_type (supabase-patients-appointment-type-migration.sql,
// Migration 97). The column never existed before, so the booking type stayed on the device.
//
// Own requests after the main sync that never throw, like pathway data and the NEWS2 Scale 2 flag:
// until Migration 97 runs the push and the pull fail and are retried on the next sync, and the
// whole-row patient push and pull are unaffected. appointment_type is on Migration 89's front-desk
// allow-list (FrontDeskPatientColumns); a push the server still refuses (42501) is marked in
// SyncRefusals and skipped until the next sign-in.
//
// Conflict rule (same as pathway data): a local change not yet pushed wins; otherwise the device
// takes the server value. appointmentTypeSyncedValue is this field's own "last confirmed" value, so
// an unrelated pending edit does not hold it back.

import Foundation
import SwiftData
import Supabase

extension Patient {

    /// True when the booking type has a local change the server has not confirmed. Never confirmed
    /// (nil) and nothing recorded: nothing to push.
    var appointmentTypeNeedsPush: Bool {
        guard let value = appointmentType, !value.isEmpty else { return false }
        return value != appointmentTypeSyncedValue
    }

    /// Applies the server's value from a pull: a local change not yet pushed is kept (it is pushed
    /// in the same sync); otherwise the server value is taken.
    func applyServerAppointmentType(_ serverValue: String) {
        if appointmentType == serverValue || !appointmentTypeNeedsPush {
            appointmentType = serverValue
            appointmentTypeSyncedValue = serverValue
        }
    }
}

extension SyncService {

    func syncAppointmentType(context: ModelContext) async {
        guard let all = try? context.fetch(FetchDescriptor<Patient>()) else { return }

        // Push local changes.
        struct Row: Encodable { let appointment_type: String }
        let refused = SyncRefusals.ids(.appointmentType)
        for p in all where p.isLive {
            guard let rid = SyncRemoteId.serverId(p.remoteId),   // never a placeholder or malformed id
                  !refused.contains(p.id.uuidString),
                  p.appointmentTypeNeedsPush,
                  let value = p.appointmentType else { continue }
            let localId = p.id
            do {
                try await SupabaseConfig.client
                    .from("patients")
                    .update(Row(appointment_type: value))
                    .eq("id", value: rid)
                    .execute()
            } catch {
                if markIfRefused(error, id: localId, kind: .appointmentType) { continue }
                break   // column missing (Migration 97 not applied) or offline — retry next sync
            }
            // The await above may have outlived a delete. A value changed during the request
            // still differs from `value` and is pushed next sync.
            if p.isLive { p.appointmentTypeSyncedValue = value }
        }

        // Pull server values.
        struct Remote: Decodable { let id: String; let appointment_type: String? }
        let rows: [Remote]
        do {
            rows = try await SupabaseConfig.client
                .from("patients")
                .select("id, appointment_type")
                .order("created_at", ascending: false)
                .limit(500)
                .execute()
                .value
        } catch {
            try? context.save()
            return
        }
        let byRemoteId = Dictionary(
            all.filter(\.isLive).compactMap { p in p.remoteId.map { ($0, p) } },
            uniquingKeysWith: { first, _ in first })
        for row in rows {
            guard let value = row.appointment_type, !value.isEmpty,
                  let p = byRemoteId[row.id], p.isLive else { continue }
            p.applyServerAppointmentType(value)
        }
        try? context.save()
    }
}
