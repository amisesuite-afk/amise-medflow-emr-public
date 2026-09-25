// SyncPendingReasons.swift
// Why a record is still pending after a sync. The Settings count ("6 records") said nothing about
// records the push loops skip without an error: a child whose patient has no server row yet, an
// empty note or vitals entry, an update whose server row is gone, a booking already linked to
// another local record. Settings → Sync → Pending now lists each pending record with its reason.
//
// Two sources:
//   • SyncSkipLog: reasons the push loops note while they run (server row gone, rejected by the
//     server, duplicate booking link). In memory only, reset at the start of each sync; local
//     model UUIDs and the error text, never patient data.
//   • SyncPendingClassifier: everything that can be read from the record itself. Pure; tested in
//     SyncPendingReasonTests.

import Foundation
import SwiftData

enum SyncPendingReason: String, CaseIterable {
    case refused           = "Not permitted for your role. Kept on this device; retried after the next sign-in."
    case serverRowMissing  = "Its server copy was not found (possibly deleted on another device). Kept on this device."
    case duplicateBooking  = "The booking is already linked to another record on this device. See the duplicate review."
    case sendFailed        = "The server rejected it at the last sync."
    case waitingForPatient = "Waiting for its patient to upload first."
    case patientIsBooking  = "Its patient is a booking not yet created on the server."
    case nothingToSend     = "Empty: nothing to send."
    case invalidId         = "Unrecognised record id: never sent."
    case waiting           = "Will be sent at the next sync."
}

/// Reasons noted by the push loops during the last sync, for records they left pending.
@MainActor
enum SyncSkipLog {
    private static var reasons: [UUID: SyncPendingReason] = [:]
    private static var details: [UUID: String] = [:]

    static func reset() {
        reasons = [:]
        details = [:]
    }

    static func note(_ id: UUID, _ reason: SyncPendingReason, detail: String? = nil) {
        reasons[id] = reason
        if let detail { details[id] = String(detail.prefix(200)) }
    }

    static func reason(for id: UUID) -> SyncPendingReason? { reasons[id] }
    static func detail(for id: UUID) -> String? { details[id] }
}

enum SyncPendingClassifier {
    /// - refused: in the SyncRefusals list for its kind.
    /// - logged: what the last sync noted for it (SyncSkipLog).
    /// - ownId: the record's own remote id.
    /// - patientRemoteId: the parent patient's remote id; nil for a patient record itself.
    /// - isChild: false for a patient record.
    /// - isEmpty: nothing the push would send (an empty note, a vitals entry with no values not
    ///   yet on the server). The push loops skip these.
    static func reason(refused: Bool,
                       logged: SyncPendingReason?,
                       ownId: SyncRemoteId.Kind,
                       isChild: Bool,
                       patientRemoteId: String?,
                       isEmpty: Bool) -> SyncPendingReason {
        if refused { return .refused }
        if let logged { return logged }
        if isChild {
            switch ownId {
            case .appointmentPlaceholder, .invalid: return .invalidId
            case .notInserted, .server: break
            }
            switch SyncRemoteId.kind(patientRemoteId) {
            case .server: break
            case .appointmentPlaceholder: return .patientIsBooking
            case .notInserted, .invalid: return .waitingForPatient
            }
        } else if case .invalid = ownId {
            return .invalidId
        }
        if isEmpty { return .nothingToSend }
        return .waiting
    }
}

struct PendingRecordSummary: Identifiable {
    let id: UUID
    let kind: String
    let patientName: String?
    let updatedAt: Date
    let reason: SyncPendingReason
    let detail: String?
}

extension SyncService {

    /// Every live pending record with the reason it is still pending, most recently edited first.
    func pendingSummaries(context: ModelContext) -> [PendingRecordSummary] {
        var out: [PendingRecordSummary] = []

        func add(_ id: UUID, kind: String, refusedKind: SyncRefusals.Kind, patient: Patient?,
                 isChild: Bool, ownRemoteId: String?, updatedAt: Date, isEmpty: Bool) {
            let livePatient = (patient?.isLive ?? false) ? patient : nil
            let reason = SyncPendingClassifier.reason(
                refused: SyncRefusals.ids(refusedKind).contains(id.uuidString),
                logged: SyncSkipLog.reason(for: id),
                ownId: SyncRemoteId.kind(ownRemoteId),
                isChild: isChild,
                patientRemoteId: livePatient?.remoteId,
                isEmpty: isEmpty)
            out.append(PendingRecordSummary(id: id, kind: kind, patientName: livePatient?.fullName,
                                            updatedAt: updatedAt, reason: reason,
                                            detail: SyncSkipLog.detail(for: id)))
        }

        for p in (try? context.fetch(FetchDescriptor<Patient>())) ?? [] where p.isLive && p.pendingSync {
            add(p.id, kind: "Patient", refusedKind: .patient, patient: p, isChild: false,
                ownRemoteId: p.remoteId, updatedAt: p.updatedAt, isEmpty: false)
        }
        for n in (try? context.fetch(FetchDescriptor<ClinicalNote>())) ?? [] where n.isLive && n.pendingSync {
            add(n.id, kind: "Note", refusedKind: .clinicalNote, patient: n.patient, isChild: true,
                ownRemoteId: n.remoteId, updatedAt: n.updatedAt, isEmpty: n.isEmpty)
        }
        for r in (try? context.fetch(FetchDescriptor<Prescription>())) ?? [] where r.isLive && r.pendingSync {
            add(r.id, kind: "Prescription", refusedKind: .prescription, patient: r.patient, isChild: true,
                ownRemoteId: r.remoteId, updatedAt: r.updatedAt ?? r.prescribedAt, isEmpty: false)
        }
        for v in (try? context.fetch(FetchDescriptor<VitalsEntry>())) ?? [] where v.isLive && v.pendingSync {
            let notInserted = SyncRemoteId.kind(v.remoteId) == .notInserted
            add(v.id, kind: "Vitals", refusedKind: .vitals, patient: v.patient, isChild: true,
                ownRemoteId: v.remoteId, updatedAt: v.updatedAt ?? v.recordedAt, isEmpty: notInserted && !v.hasAnyValue)
        }
        for o in (try? context.fetch(FetchDescriptor<OperativePlan>())) ?? [] where o.isLive && o.pendingSync {
            add(o.id, kind: "Operative plan", refusedKind: .operativePlan, patient: o.patient, isChild: true,
                ownRemoteId: o.remoteId, updatedAt: o.updatedAt, isEmpty: false)
        }
        for b in (try? context.fetch(FetchDescriptor<BillingLineItem>())) ?? [] where b.isLive && b.pendingSync {
            add(b.id, kind: "Billing item", refusedKind: .billingItem, patient: b.patient, isChild: true,
                ownRemoteId: b.remoteId, updatedAt: b.updatedAt ?? b.addedAt, isEmpty: false)
        }
        return out.sorted { $0.updatedAt > $1.updatedAt }
    }
}
