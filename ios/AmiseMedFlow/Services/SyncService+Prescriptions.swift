// SyncService+Prescriptions.swift
// Prescription sync: push (insert new, update edited) and pull prescription records.

import Foundation
import SwiftData
import Supabase

/// `prescriptions.route` on the server vs the route shown on this device.
///
/// The runner creates `prescriptions` from supabase-emr-enhancement-migration.sql (Migration 32):
/// `route text not null default 'oral' check (route in ('oral', 'iv', 'im', 'sc', 'topical',
/// 'rectal', 'sublingual', 'inhaled', 'ophthalmic', 'otic', 'nasal', 'per_rectum', 'other'))`.
/// The other definitions (Migration 68's CREATE TABLE IF NOT EXISTS, the flat-column ADD COLUMN IF
/// NOT EXISTS of Migrations 77/78, and the two unwired duplicates) never replace that column, so
/// the CHECK is what the server enforces. This app shows and stores "Oral", "IV", "PR", or a
/// formulary route such as "PO/IV", which the CHECK rejects (23514): the insert or update failed
/// and the prescription stayed pending for ever.
///
/// Push: `serverValue` maps the local route to an allowed value; a route with no single allowed
/// value (several routes, or one the CHECK does not list) is sent as "other" rather than rejected.
/// Pull: `display(fromServer:)` gives the label the pickers use. Local rows keep their own label:
/// `sameRoute` compares in server values, so "PO/IV" here and "other" on the server are the same.
/// Pure; tested in SyncCompletenessTests.
enum PrescriptionRoute {
    /// The values the server's CHECK constraint allows.
    static let serverValues: Set<String> = [
        "oral", "iv", "im", "sc", "topical", "rectal", "sublingual", "inhaled", "ophthalmic",
        "otic", "nasal", "per_rectum", "other",
    ]

    /// Label shown on this device for each server value (the pickers' spelling where they have one).
    static let displayLabels: [String: String] = [
        "oral": "Oral", "iv": "IV", "im": "IM", "sc": "SC", "topical": "Topical",
        "rectal": "PR", "per_rectum": "PR", "sublingual": "SL", "inhaled": "Inhaled",
        "ophthalmic": "Ophthalmic", "otic": "Otic", "nasal": "Nasal", "other": "Other",
    ]

    /// Local spellings (lowercased) of a single route → server value.
    static let aliases: [String: String] = [
        "oral": "oral", "po": "oral", "by mouth": "oral",
        "iv": "iv", "intravenous": "iv",
        "im": "im", "intramuscular": "im", "deep im only": "im",
        "sc": "sc", "sc only": "sc", "subcut": "sc", "subcutaneous": "sc",
        "topical": "topical", "external": "topical",
        "pr": "rectal", "rectal": "rectal", "per rectum": "per_rectum", "per_rectum": "per_rectum",
        "sl": "sublingual", "sublingual": "sublingual",
        "inhaled": "inhaled", "nebulised": "inhaled", "nebulized": "inhaled", "mdi": "inhaled",
        "ophthalmic": "ophthalmic", "otic": "otic",
        "nasal": "nasal", "intranasal": "nasal",
        "other": "other",
    ]

    /// The value to send for a local route: nil when empty (left out: the column default 'oral'
    /// applies on insert, and an update keeps the server's value), otherwise an allowed value.
    static func serverValue(_ route: String?) -> String? {
        let trimmed = (route ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        // Several routes ("PO/IV", "IV bolus / continuous infusion"): one value only when the
        // first part names a route and every other part that names one names the same.
        let parts = trimmed.split(separator: "/").map(String.init)
        if parts.count > 1 {
            let named = Set(parts.compactMap(single))
            if let first = single(parts[0]), named == [first] { return first }
            return "other"
        }
        return single(trimmed) ?? "other"
    }

    /// The label for a route read from the server; an unknown value is shown as it is.
    static func display(fromServer value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return displayLabels[value.lowercased()] ?? value
    }

    /// Whether a local route and a server route are the same once both are in server values
    /// ('rectal' and 'per_rectum' are both shown as "PR", so they count as the same).
    static func sameRoute(local: String?, server: String?) -> Bool {
        func canonical(_ value: String?) -> String? {
            let v = serverValue(value)
            return v == "per_rectum" ? "rectal" : v
        }
        return canonical(local) == canonical(server)
    }

    /// One route: an alias as written, without a trailing "(…)" qualifier, or its first word
    /// ("IV infusion over 30 min" → iv, "PO (with food)" → oral).
    private static func single(_ raw: String) -> String? {
        var s = raw.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        if let alias = aliases[s] { return alias }
        if let paren = s.firstIndex(of: "(") {
            s = String(s[..<paren]).trimmingCharacters(in: .whitespacesAndNewlines)
            if let alias = aliases[s] { return alias }
        }
        if let first = s.split(separator: " ").first, let alias = aliases[String(first)] {
            return alias
        }
        return nil
    }
}

/// The body of the `prescriptions` UPDATE for an edited prescription: the same values the insert
/// sends, without patient_id and prescriber_id (set once, at insert). An empty field is left out
/// of the JSON, as in the insert (the live schema, Migration 32, has NOT NULL dose, frequency and
/// route, so an explicit null would fail the whole update). The route is sent as its server value
/// (PrescriptionRoute). Internal for SyncGapsTests.
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
        route = PrescriptionRoute.serverValue(rx.route)
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
                    // applied — it stays pending locally rather than losing the edit, and is
                    // marked refused when the row is still there (a nurse's or front desk's edit).
                    let updated: [RxResponse] = try await SupabaseConfig.client
                        .from("prescriptions")
                        .update(PrescriptionUpdateRow(rx, iso: iso))
                        .eq("id", value: remoteId)
                        .select("id")
                        .execute()
                        .value
                    try await markRefusedIfUpdateNotApplied(rowsReturned: updated.count,
                                                            table: "prescriptions", remoteId: remoteId,
                                                            id: localId, kind: .prescription)
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
                        route: PrescriptionRoute.serverValue(rx.route),   // the CHECK's lowercase values
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
        let updated_at: String?   // kept current by the trg_updated_at trigger (Migration 32)
        let deleted_at: String?   // nil when live, or when the server predates Migration 87
    }

    func pullPrescriptions(context: ModelContext) async throws {
        let rows: [RemotePrescription] = try await selectIncludingDeleted(
            from: "prescriptions",
            columns: "id, patient_id, drug_name, dose, route, frequency, duration, indication, instructions, prescribed_at, updated_at",
            orderBy: "prescribed_at", limit: 500)

        let allLocal = try context.fetch(FetchDescriptor<Prescription>())
        let allPatients = try context.fetch(FetchDescriptor<Patient>())

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
            let prescribedAt = SyncTimestamp.parse(row.prescribed_at)
            if let existing {
                // Edited on another device or the web: take the server's values unless this
                // device has unsent changes (ChildPullMerge).
                let sameDosing: Bool = existing.drug == row.drug_name
                    && ChildPullMerge.same(existing.dose, row.dose)
                    && PrescriptionRoute.sameRoute(local: existing.route, server: row.route)
                    && ChildPullMerge.same(existing.frequency, row.frequency)
                let sameDetails: Bool = ChildPullMerge.same(existing.duration, row.duration)
                    && ChildPullMerge.same(existing.indication, row.indication)
                    && ChildPullMerge.same(existing.instructions, row.instructions)
                var sameTime = true
                if let prescribedAt { sameTime = ChildPullMerge.sameInstant(prescribedAt, existing.prescribedAt) }
                let differs = !(sameDosing && sameDetails && sameTime)
                let serverUpdatedAt = SyncTimestamp.parse(row.updated_at)
                if ChildPullMerge.action(hasLocal: true, localPending: existing.pendingSync,
                                         fieldsDiffer: differs, serverUpdatedAt: serverUpdatedAt,
                                         localUpdatedAt: existing.updatedAt) == .update {
                    existing.drug = row.drug_name
                    existing.dose = row.dose ?? ""
                    // The local label is kept while it is the same route ("PO/IV" is "other").
                    if !PrescriptionRoute.sameRoute(local: existing.route, server: row.route) {
                        existing.route = PrescriptionRoute.display(fromServer: row.route) ?? ""
                    }
                    existing.frequency = row.frequency ?? ""
                    existing.duration = row.duration ?? ""
                    existing.indication = row.indication ?? ""
                    existing.instructions = row.instructions
                    if let prescribedAt { existing.prescribedAt = prescribedAt }
                    existing.updatedAt = serverUpdatedAt ?? .now
                    existing.syncedAt = .now
                }
                continue
            }
            guard let patient = allPatients.first(where: { $0.isLive && $0.remoteId == row.patient_id }) else { continue }

            let rx = Prescription(drug: row.drug_name,
                                  dose: row.dose ?? "",
                                  route: PrescriptionRoute.display(fromServer: row.route) ?? "Oral",
                                  frequency: row.frequency ?? "",
                                  duration: row.duration ?? "",
                                  indication: row.indication ?? "")
            rx.instructions = row.instructions
            rx.prescribedAt = prescribedAt ?? .now
            rx.patient = patient
            rx.remoteId = row.id
            rx.pendingSync = false
            rx.syncedAt = .now
            context.insert(rx)
        }
        try context.save()
    }


}
