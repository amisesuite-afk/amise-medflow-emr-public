// OutcomeSync.swift
// The pure rules of the outcomes-loop cloud sync (SyncService+Outcomes.swift): who may push, what
// "the tables are not there yet" looks like and how long to wait, the order a correction is sent in,
// what an INSERT conflict or a 0-row retraction means, and how pulled final diagnoses merge into the
// device's records. No network, no SwiftData. Tested in AmiseMedFlowTests/OutcomeSyncTests.swift.
//
// Server semantics (Migration 94, the web's lib/outcomes-db.ts and lib/prediction-snapshots.ts):
//   • prediction_snapshots: one row per encounter_ref, first completion wins; clients may only
//     SELECT and INSERT (no UPDATE, no DELETE).
//   • diagnosis_outcomes: rows are immutable; a correction retracts the confirmed row (UPDATE
//     status/retracted_at/retracted_by only, trigger-enforced) and confirms a new one; at most one
//     confirmed row per encounter_ref; client_ref is the idempotency key.
//   • RLS: nurse, doctor and admin only. Front desk and portal patients see and write nothing.

import Foundation

enum OutcomeSync {

    // MARK: - Who pushes

    /// Only a confirmed nurse, doctor or admin role pushes or pulls (Migration 94 RLS). The role
    /// falls back to front desk, unconfirmed, when the profile could not be read: nothing is sent
    /// then either.
    static func mayUse(role: UserRole, roleConfirmed: Bool) -> Bool {
        roleConfirmed && role.hasAccess(to: .nurse)
    }

    // MARK: - Migration 94 not applied yet

    /// 42P01 undefined_table, PGRST205 table not in the schema cache, PGRST204 / 42703 unknown
    /// column: the same list as the web's isMissingTable (lib/outcomes-db.ts).
    static func isMissingTable(code: String?) -> Bool {
        guard let code else { return false }
        return ["42P01", "PGRST205", "PGRST204", "42703"].contains(code)
    }

    /// After a "table missing" answer the outcomes sync is not tried again for this long (the main
    /// sync runs every 30 s): one quiet request every few hours, never an error loop. Cleared at
    /// sign-in and launch, like the refused lists.
    static let unavailableRetryInterval: TimeInterval = 6 * 3600

    static func shouldAttempt(now: Date, unavailableSince: Date?) -> Bool {
        guard let since = unavailableSince else { return true }
        return now.timeIntervalSince(since) >= unavailableRetryInterval || now < since
    }

    // MARK: - Unique violations

    /// 23505: the INSERT hit a unique index (encounter_ref for snapshots; client_ref or the
    /// one-confirmed-per-encounter index for final diagnoses).
    static func isUniqueViolation(code: String?) -> Bool { code == "23505" }

    // MARK: - Push order

    /// Indices of the final-diagnosis records to push, retractions first, so the server's
    /// "one confirmed row per encounter" index accepts the corrected diagnosis after the old one is
    /// retracted. Records already confirmed on the server (not pending) are left alone.
    static func pushOrder(_ finals: [OutcomeFinalDiagnosisRecord]) -> [Int] {
        let pending = finals.indices.filter { finals[$0].sync.pendingSync }
        return pending.filter { !finals[$0].isConfirmed } + pending.filter { finals[$0].isConfirmed }
    }

    // MARK: - Retraction of a row already on the server

    enum RetractOutcome: Equatable {
        /// The UPDATE returned the row, or the row is already retracted on the server (a retry
        /// after a lost response): pendingSync may clear.
        case applied
        /// Signed out: requests run as `anon`, which matches nothing. Not a refusal.
        case retryLater
        /// The row is there and still confirmed, but the UPDATE matched nothing: not permitted for
        /// this role. Marked refused, like a 42501.
        case refused
        /// No such row visible: kept pending, not refused.
        case rowGone
    }

    /// - serverStatus: `status` of the row read back by id after a 0-row UPDATE (nil: not found).
    static func retractOutcome(rowsReturned: Int, signedIn: Bool, serverStatus: String?) -> RetractOutcome {
        if rowsReturned > 0 { return .applied }
        guard signedIn else { return .retryLater }
        switch serverStatus {
        case "retracted": return .applied
        case nil:         return .rowGone
        default:          return .refused
        }
    }

    /// The id to list a refused final diagnosis under (SyncRefusals holds UUIDs): the UUID in its
    /// clientRef ("ios:<UUID>"), else the encounter's.
    static func refusalId(clientRef: String, encounterId: UUID) -> UUID {
        if clientRef.hasPrefix("ios:"), let id = UUID(uuidString: String(clientRef.dropFirst(4))) { return id }
        return encounterId
    }

    // MARK: - Pull merge

    /// Merges the server's rows for ONE encounter into the device's records. Returns nil when
    /// nothing changes. Never touches a pending record: when any record of the encounter still has
    /// unsent changes, the encounter is skipped this time (its push runs first and the next pull
    /// sees the result).
    ///   • A row this device sent (same remoteId or clientRef): takes the server's retraction; a
    ///     retracted row never becomes confirmed again (the trigger forbids it on the server too).
    ///   • A row the device has not seen (a final diagnosis recorded or corrected on the web for
    ///     this iOS encounter): added, not pending, in confirmed_at order.
    static func merge(local: [OutcomeFinalDiagnosisRecord],
                      server rows: [DiagnosisOutcomeServerRow]) -> [OutcomeFinalDiagnosisRecord]? {
        guard !local.contains(where: \.sync.pendingSync) else { return nil }
        var out = local
        var changed = false
        var added: [OutcomeFinalDiagnosisRecord] = []
        for row in rows {
            guard let pulled = OutcomeSanitiser.record(fromServerRow: row) else { continue }
            if let i = out.firstIndex(where: {
                $0.sync.remoteId == pulled.sync.remoteId || $0.sync.clientRef == pulled.sync.clientRef
            }) {
                if out[i].sync.remoteId != pulled.sync.remoteId {
                    out[i].sync.remoteId = pulled.sync.remoteId
                    changed = true
                }
                if out[i].isConfirmed && !pulled.isConfirmed {
                    out[i].status = "retracted"
                    out[i].retractedAt = pulled.retractedAt
                    out[i].sync.updatedAt = pulled.sync.updatedAt
                    changed = true
                }
            } else {
                added.append(pulled)
            }
        }
        if !added.isEmpty {
            out.append(contentsOf: added.sorted { $0.confirmedAt < $1.confirmedAt })
            changed = true
        }
        return changed ? out : nil
    }
}
