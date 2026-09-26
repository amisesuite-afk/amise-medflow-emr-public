// SyncService+Outcomes.swift
// Cloud sync of the outcomes loop (Migration 94): the prediction snapshot frozen at completion
// (Encounter.predictionSnapshotJson → prediction_snapshots) and the final diagnoses confirmed later
// (Encounter.finalDiagnosisJson → diagnosis_outcomes), with a pull of final diagnoses recorded or
// retracted elsewhere (the web's Final diagnosis card lists iOS encounters once their snapshot is
// on the server). Rules: OutcomeSync.swift; sanitisers: OutcomeSanitiser.swift (twin of the web's).
//
// Follows the sync hard rules (ios-arch skill, "Three sync tiers"):
//   • pendingSync clears only when the server returns the written row and the record's updatedAt
//     did not change during the request (SyncPushConfirmation);
//   • a 0-row UPDATE (retraction) is read back by id: still confirmed → refused, already
//     retracted → applied, gone → left pending (OutcomeSync.retractOutcome);
//   • a 42501 marks the record refused (SyncRefusals .predictionSnapshot / .diagnosisOutcome) and
//     the loop carries on; a transport error stops it;
//   • patient ids go through SyncRemoteId.serverId (never a booking placeholder);
//   • the pull never changes a record with pendingSync (OutcomeSync.merge skips the encounter).
// Nurse, doctor and admin only (confirmed role): front desk never sends or reads these.
//
// Migration 94 is not applied on production yet. A "table missing" answer (42P01 / PGRST205 /
// PGRST204 / 42703) stops this step quietly, records the time, and the step is not tried again for
// six hours (or until the next sign-in / launch): no syncError, no error loop, records stay pending
// on the device. Own requests, never throws: nothing here can hold back the rest of the sync.

import Foundation
import SwiftData
import Supabase

extension SyncService {

    private static let outcomesUnavailableKey = "amf.sync.outcomes.unavailableSince"

    /// Forget a "tables missing" answer: called at sign-in and session restore, with the refused lists.
    static func clearOutcomesUnavailable() {
        UserDefaults.standard.removeObject(forKey: outcomesUnavailableKey)
    }

    private func outcomesUnavailableSince() -> Date? {
        UserDefaults.standard.object(forKey: Self.outcomesUnavailableKey) as? Date
    }

    private func pgCode(_ error: Error) -> String? {
        (error as? PostgrestError)?.code
    }

    /// True (and the time noted) when the error says the Migration 94 tables are not there.
    private func noteIfOutcomesUnavailable(_ error: Error) -> Bool {
        guard OutcomeSync.isMissingTable(code: pgCode(error)) else { return false }
        UserDefaults.standard.set(Date(), forKey: Self.outcomesUnavailableKey)
        CrashReporting.breadcrumb("Sync: outcomes tables not available yet (Migration 94)", category: "sync")
        return true
    }

    private enum OutcomeStep { case carryOn, stop }

    // MARK: - Entry point (own requests, never throws)

    func syncOutcomes(context: ModelContext) async {
        guard OutcomeSync.mayUse(role: currentUserRole, roleConfirmed: isRoleConfirmed),
              OutcomeSync.shouldAttempt(now: .now, unavailableSince: outcomesUnavailableSince()),
              let encounters = try? context.fetch(FetchDescriptor<Encounter>()) else { return }
        let withOutcomes = encounters.filter {
            $0.isLive && ($0.predictionSnapshotJson != nil || $0.finalDiagnosisJson != nil)
        }
        guard !withOutcomes.isEmpty else { return }

        if await pushPredictionSnapshots(withOutcomes, context: context) == .stop { try? context.save(); return }
        if await pushFinalDiagnoses(withOutcomes, context: context) == .stop { try? context.save(); return }
        await pullFinalDiagnoses(withOutcomes)
        try? context.save()
    }

    // MARK: - Prediction snapshots (insert once; first completion wins)

    private func pushPredictionSnapshots(_ encounters: [Encounter], context: ModelContext) async -> OutcomeStep {
        let refused = SyncRefusals.ids(.predictionSnapshot)
        struct IdRow: Decodable { let id: String }

        for e in encounters {
            guard e.isLive, let record = e.outcomePrediction, record.sync.pendingSync,
                  !refused.contains(e.id.uuidString) else { continue }
            let localId = e.id
            let editedAt = OutcomeSanitiser.parseISODate(record.sync.updatedAt)
            // Patient not on the server yet: wait for it (pushPendingPatients runs first).
            guard let patientId = SyncRemoteId.serverId(e.patient?.remoteId) else {
                SyncSkipLog.note(localId, .waitingForPatient)
                continue
            }
            do {
                let rows: [IdRow]
                if let remoteId = SyncRemoteId.serverId(record.sync.remoteId) {
                    // Already inserted (the confirmation was lost or the record changed meanwhile):
                    // read the row back instead of inserting again.
                    rows = try await SupabaseConfig.client
                        .from("prediction_snapshots").select("id").eq("id", value: remoteId).limit(1)
                        .execute().value
                } else {
                    guard case .success(let clean) = OutcomeSanitiser.sanitizeSnapshot(record),
                          let row = OutcomeSanitiser.snapshotRow(clean, patientId: patientId, createdBy: currentUserId) else {
                        // Not a valid snapshot (e.g. an encounter reference the server refuses):
                        // it can never be sent, so it is not retried every sync.
                        SyncSkipLog.note(localId, .sendFailed, detail: "Prediction snapshot not valid for the server")
                        continue
                    }
                    do {
                        rows = try await SupabaseConfig.client
                            .from("prediction_snapshots").insert(row).select("id")
                            .execute().value
                    } catch let error where OutcomeSync.isUniqueViolation(code: pgCode(error)) {
                        // First completion wins: the server already holds this encounter's snapshot
                        // (an earlier insert whose answer was lost). Adopt that row.
                        rows = try await SupabaseConfig.client
                            .from("prediction_snapshots").select("id").eq("encounter_ref", value: record.encounterRef)
                            .limit(1).execute().value
                    }
                }
                guard e.isLive, let first = rows.first else {
                    if rows.isEmpty { SyncSkipLog.note(localId, .serverRowMissing) }
                    continue
                }
                let mayClear = SyncPushConfirmation.mayClearPending(
                    rowsReturned: rows.count, editedAtBeforeRequest: editedAt,
                    editedAtNow: OutcomeSanitiser.parseISODate(e.outcomePrediction?.sync.updatedAt))
                e.updateOutcomePrediction { r in
                    r.sync.remoteId = first.id
                    if mayClear { r.sync.pendingSync = false }
                }
                try? context.save()   // keep the row id at once, so a crash cannot cause a second insert
            } catch {
                if noteIfOutcomesUnavailable(error) { return .stop }
                if error is URLError || error is CancellationError { return .stop }
                if markIfRefused(error, id: localId, kind: .predictionSnapshot) { continue }
                SyncSkipLog.note(localId, .sendFailed, detail: error.localizedDescription)
                CrashReporting.breadcrumb("Sync: prediction_snapshot push failed", category: "sync")
            }
        }
        return .carryOn
    }

    // MARK: - Final diagnoses (retract, then confirm)

    private func pushFinalDiagnoses(_ encounters: [Encounter], context: ModelContext) async -> OutcomeStep {
        let refused = SyncRefusals.ids(.diagnosisOutcome)
        struct IdRow: Decodable { let id: String }
        struct StatusRow: Decodable { let id: String; let status: String }
        struct RetractRow: Encodable { let status: String; let retracted_at: String; let retracted_by: String? }

        for e in encounters {
            guard e.isLive else { continue }
            let finals = e.outcomeFinalDiagnoses
            let order = OutcomeSync.pushOrder(finals)
            guard !order.isEmpty else { continue }
            guard let patientId = SyncRemoteId.serverId(e.patient?.remoteId) else {
                for i in order {
                    SyncSkipLog.note(OutcomeSync.refusalId(clientRef: finals[i].sync.clientRef, encounterId: e.id),
                                     .waitingForPatient)
                }
                continue
            }
            // A retraction that did not go through holds back the new confirmed diagnosis of the same
            // encounter (the server allows one confirmed row per encounter).
            var retractionPending = false

            for i in order {
                guard e.isLive else { break }
                let record = finals[i]
                let refusalId = OutcomeSync.refusalId(clientRef: record.sync.clientRef, encounterId: e.id)
                if refused.contains(refusalId.uuidString) {
                    if !record.isConfirmed { retractionPending = true }
                    continue
                }
                if record.isConfirmed && retractionPending { continue }
                let editedAt = OutcomeSanitiser.parseISODate(record.sync.updatedAt)
                do {
                    var confirmedRowId: String?
                    var applied = false
                    switch SyncRemoteId.kind(record.sync.remoteId) {
                    case .server(let remoteId) where !record.isConfirmed:
                        // On the server as confirmed: retract it (status, retracted_at, retracted_by only).
                        let stamp = OutcomeSanitiser.isoDate(record.retractedAt) ?? OutcomeSanitiser.isoDate(record.sync.updatedAt)
                            ?? OutcomeCodes.isoTimestamp(.now)
                        let updated: [IdRow] = try await SupabaseConfig.client
                            .from("diagnosis_outcomes")
                            .update(RetractRow(status: "retracted", retracted_at: stamp,
                                               retracted_by: currentUserId.flatMap { UUID(uuidString: $0) != nil ? $0 : nil }))
                            .eq("id", value: remoteId)
                            .eq("status", value: "confirmed")
                            .select("id")
                            .execute().value
                        var serverStatus: String?
                        if updated.isEmpty {
                            let found: [StatusRow] = try await SupabaseConfig.client
                                .from("diagnosis_outcomes").select("id, status").eq("id", value: remoteId).limit(1)
                                .execute().value
                            serverStatus = found.first?.status
                        }
                        let signedIn = isSignedIn && SupabaseConfig.client.auth.currentUser != nil
                        switch OutcomeSync.retractOutcome(rowsReturned: updated.count, signedIn: signedIn,
                                                          serverStatus: serverStatus) {
                        case .applied:
                            applied = true
                            confirmedRowId = remoteId
                        case .refused:
                            SyncRefusals.mark(refusalId, as: .diagnosisOutcome)
                            CrashReporting.breadcrumb("Sync: diagnosis_outcome retraction not permitted (0 rows)", category: "sync")
                        case .rowGone:
                            SyncSkipLog.note(refusalId, .serverRowMissing)
                        case .retryLater:
                            break
                        }

                    case .server(let remoteId):
                        // Confirmed and already sent: read it back to confirm.
                        let found: [IdRow] = try await SupabaseConfig.client
                            .from("diagnosis_outcomes").select("id").eq("id", value: remoteId).limit(1)
                            .execute().value
                        applied = !found.isEmpty
                        confirmedRowId = found.first?.id
                        if found.isEmpty { SyncSkipLog.note(refusalId, .serverRowMissing) }

                    case .notInserted:
                        guard case .success(let clean) = OutcomeSanitiser.sanitizeFinalDiagnosis(record),
                              let row = OutcomeSanitiser.outcomeRow(clean, patientId: patientId,
                                                                    clientRef: record.sync.clientRef,
                                                                    userId: currentUserId,
                                                                    retractedAt: record.retractedAt ?? record.sync.updatedAt) else {
                            SyncSkipLog.note(refusalId, .sendFailed, detail: "Final diagnosis not valid for the server")
                            if !record.isConfirmed { retractionPending = true }
                            continue
                        }
                        let inserted: [IdRow]
                        do {
                            inserted = try await SupabaseConfig.client
                                .from("diagnosis_outcomes").insert(row).select("id")
                                .execute().value
                        } catch let error where OutcomeSync.isUniqueViolation(code: pgCode(error)) {
                            // Idempotent retry (client_ref already there): adopt that row. Otherwise
                            // another confirmed diagnosis exists for this encounter on the server
                            // (recorded elsewhere): left pending; retract one of them to resolve it.
                            inserted = try await SupabaseConfig.client
                                .from("diagnosis_outcomes").select("id").eq("client_ref", value: record.sync.clientRef)
                                .limit(1).execute().value
                            if inserted.isEmpty {
                                SyncSkipLog.note(refusalId, .sendFailed,
                                                 detail: "Another final diagnosis is already confirmed for this visit")
                            }
                        }
                        applied = !inserted.isEmpty
                        confirmedRowId = inserted.first?.id

                    case .appointmentPlaceholder, .invalid:
                        SyncSkipLog.note(refusalId, .invalidId)
                    }

                    guard e.isLive else { break }
                    if let rowId = confirmedRowId {
                        let now = e.outcomeFinalDiagnoses.first { $0.sync.clientRef == record.sync.clientRef }
                        let mayClear = applied && SyncPushConfirmation.mayClearPending(
                            rowsReturned: 1, editedAtBeforeRequest: editedAt,
                            editedAtNow: OutcomeSanitiser.parseISODate(now?.sync.updatedAt))
                        e.updateFinalDiagnosis(clientRef: record.sync.clientRef) { r in
                            r.sync.remoteId = rowId
                            if mayClear { r.sync.pendingSync = false }
                        }
                        try? context.save()
                    }
                    if !record.isConfirmed && !applied { retractionPending = true }
                } catch {
                    if noteIfOutcomesUnavailable(error) { return .stop }
                    if error is URLError || error is CancellationError { return .stop }
                    if !record.isConfirmed { retractionPending = true }
                    if markIfRefused(error, id: refusalId, kind: .diagnosisOutcome) { continue }
                    SyncSkipLog.note(refusalId, .sendFailed, detail: error.localizedDescription)
                    CrashReporting.breadcrumb("Sync: diagnosis_outcome push failed", category: "sync")
                }
            }
        }
        return .carryOn
    }

    // MARK: - Pull (final diagnoses of this device's encounters)

    private func pullFinalDiagnoses(_ encounters: [Encounter]) async {
        // Only encounters the server knows: a snapshot or a final diagnosis this device sent.
        var byRef: [String: Encounter] = [:]
        for e in encounters where e.isLive {
            let sent = e.outcomePrediction?.sync.remoteId != nil
                || e.outcomeFinalDiagnoses.contains { $0.sync.remoteId != nil }
            guard sent, let ref = OutcomeCodes.encounterRef(syncCode: e.syncCode) else { continue }
            byRef[ref] = e
        }
        guard !byRef.isEmpty else { return }
        let refs = byRef.keys.sorted()
        let columns = "id, encounter_ref, client_ref, final_icd10, final_disease_id, source_type, source_date, "
            + "actions_taken, retrospective_acuity, status, confirmed_at, retracted_at"
        var rows: [DiagnosisOutcomeServerRow] = []
        var start = 0
        while start < refs.count {
            let chunk = Array(refs[start..<min(start + 100, refs.count)])
            start += 100
            do {
                let page: [DiagnosisOutcomeServerRow] = try await SupabaseConfig.client
                    .from("diagnosis_outcomes").select(columns).in("encounter_ref", values: chunk)
                    .order("confirmed_at", ascending: true)
                    .execute().value
                rows.append(contentsOf: page)
            } catch {
                _ = noteIfOutcomesUnavailable(error)
                return   // offline or not available: nothing merged, retried next sync
            }
        }
        let grouped = Dictionary(grouping: rows, by: \.encounter_ref)
        for (ref, serverRows) in grouped {
            guard let e = byRef[ref], e.isLive,
                  let merged = OutcomeSync.merge(local: e.outcomeFinalDiagnoses, server: serverRows) else { continue }
            e.replaceFinalDiagnoses(merged)
        }
    }
}
