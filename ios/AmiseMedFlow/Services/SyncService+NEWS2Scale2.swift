// SyncService+NEWS2Scale2.swift
// Cloud sync of the NEWS2 SpO₂ Scale 2 opt-in:
// Patient.news2UseSpO2Scale2 ⇄ patients.news2_spo2_scale2 (supabase-news2-scale2-migration.sql,
// Migration 88).
//
// Pull: pullPatients selects the column and applies it with applyServerNEWS2Scale2(_:). If the
// server does not have the column yet, pullPatients repeats the select without it, so the rest
// of the patient pull keeps working and the flag is left alone.
// Push: pushNEWS2Scale2 sends the flag in its own update, not in the whole-row patient push.
// Before the migration that update fails; the failure is ignored and the push is retried on the
// next sync. It also pushes a flag that arrived over peer sync, which the whole-row push would
// not (peer sync clears pendingSync).
//
// Conflict rule (same as pathway data): a local change not yet pushed wins; otherwise the device
// takes the server value. The flag has its own "last confirmed" value
// (Patient.news2Scale2SyncedValue), so an unrelated pending edit does not hold back a change
// made on another device.

import Foundation
import SwiftData
import Supabase

enum NEWS2Scale2Sync {
    static let column = "news2_spo2_scale2"

    /// A select failed because news2_spo2_scale2 does not exist yet (migration not applied).
    static func isMissingColumn(_ error: Error) -> Bool {
        guard let pgError = error as? PostgrestError else { return false }
        return pgError.code == "42703" || pgError.message.contains(column)
    }
}

extension Patient {

    /// True when the flag has a local change that the server has not confirmed.
    /// Never confirmed (nil): only an opt-in counts. A default `false` on a device that has
    /// never synced the column must not clear an opt-in another device already pushed.
    var news2Scale2NeedsPush: Bool {
        if let confirmed = news2Scale2SyncedValue { return news2UseSpO2Scale2 != confirmed }
        return news2UseSpO2Scale2
    }

    /// Applies the server's value from a pull. A local change not yet pushed is kept (it is
    /// pushed later in the same sync); otherwise the server value is taken.
    func applyServerNEWS2Scale2(_ serverValue: Bool) {
        if news2UseSpO2Scale2 == serverValue || !news2Scale2NeedsPush {
            news2UseSpO2Scale2 = serverValue
            news2Scale2SyncedValue = serverValue
        }
    }
}

extension SyncService {

    /// Pushes local Scale 2 changes. Own requests, never throws: offline, not permitted, or a
    /// server without the column stops the loop and it is retried on the next sync.
    func pushNEWS2Scale2(context: ModelContext) async {
        guard let all = try? context.fetch(FetchDescriptor<Patient>()) else { return }
        struct Row: Encodable { let news2_spo2_scale2: Bool }

        for p in all where p.isLive {
            guard let rid = p.remoteId, !rid.isEmpty, !rid.hasPrefix("appt:"),
                  p.news2Scale2NeedsPush else { continue }
            let value = p.news2UseSpO2Scale2
            do {
                try await SupabaseConfig.client
                    .from("patients")
                    .update(Row(news2_spo2_scale2: value))
                    .eq("id", value: rid)
                    .execute()
            } catch {
                break
            }
            // The await above may have outlived a delete. If the flag was changed again during
            // the request, the newer value still differs from `value` and is pushed next sync.
            if p.isLive { p.news2Scale2SyncedValue = value }
        }
        try? context.save()
    }
}
