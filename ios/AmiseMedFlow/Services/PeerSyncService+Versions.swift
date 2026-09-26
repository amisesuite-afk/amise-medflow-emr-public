// PeerSyncService+Versions.swift
// Which records peer sync sends, which copy of a record wins, and how a device records that it
// has seen a peer's copy (so nothing is sent again and again).
//
// The manifest used to hold each record's cloud sync time (syncedAt) only. A record never
// uploaded counted as year 1, so a record created offline was never sent; an edit made since the
// last upload does not move syncedAt, so it was not sent either. Both defeated offline
// iPhone ↔ iPad sync.
//
// Stamp: each record's manifest entry is now max(updatedAt, syncedAt), its last change on that
// device (a local edit, a peer's copy applied, or a cloud sync). A device sends a record when the
// peer does not have it, or when its own stamp is later than the peer's.
//
// Loop control (records are compared by syncCode and stamp):
//   • After applying a peer's copy, the receiver's stamp is raised to at least the peer's
//     (syncedAt adopts the peer's stamp), so the sender does not send the same copy again.
//   • When the receiver's merged copy still differs from the peer's and the receiver holds the
//     winning or a newer change (it changed here, or the peer's copy was not the newer one), its
//     stamp ends above the peer's instead, so the next exchange sends the merged copy back. The
//     merge rules keep the result the same on both sides after that, so it settles within a
//     round or two; an unchanged record is never sent again.
//   • A record applied with no change and no newer local content only adopts the stamp.
//   • Patients deleted on this device are in the manifest with a far-future stamp, so no peer
//     sends them again (the apply already refused to recreate them).
//
// Backward compatible: the manifest keeps its syncedAt maps and adds optional stamp maps; the
// record payloads add an optional updatedAt. An older build ignores both. A manifest from an
// older build (no stamps) gets the old syncedAt comparison, plus the records it does not have at
// all; a payload from an older build (no updatedAt) is merged by syncedAt, as before.

import Foundation

/// Pure; tested in SyncCompletenessTests.
enum PeerVersion {
    /// Timestamps travel as Double epoch seconds and go through Date and back; differences this
    /// small are rounding, not a newer change.
    static let tolerance: TimeInterval = 0.001
    /// Manifest stamp for a patient deleted on this device: no peer copy is ever newer.
    static let deletedHere: Double = 32_503_680_000   // 3000-01-01

    static func epoch(_ date: Date?) -> Double {
        (date ?? .distantPast).timeIntervalSince1970
    }

    /// A local record's stamp: its last change on this device, edit or sync.
    static func stamp(updatedAt: Date?, syncedAt: Date?) -> Double {
        max(epoch(updatedAt), epoch(syncedAt))
    }

    /// A received copy's stamp; nil from an older build (its payload has no updatedAt).
    static func stamp(peerUpdatedAt: Double?, peerSyncedAt: Double) -> Double? {
        peerUpdatedAt.map { max($0, peerSyncedAt) }
    }

    /// Whether to send a record to a peer whose manifest has `peerStamp` / `peerSynced` for it.
    /// - peerSendsStamps: the manifest has stamp maps (this build or later).
    static func shouldSend(localStamp: Double, localSynced: Double,
                           peerStamp: Double?, peerSynced: Double?, peerSendsStamps: Bool) -> Bool {
        if peerSendsStamps {
            guard let peerStamp else { return true }            // the peer does not have it
            return localStamp > peerStamp + tolerance
        }
        // Older build: its manifest holds cloud sync times only (the previous rule), but a record
        // it does not have at all is sent too (records created offline).
        guard let peerSynced else { return true }
        return localSynced > peerSynced
    }

    /// Whether the peer's copy is the newer one, for the fields where newer wins (administrative
    /// fields, doctor-assessed fields, child records).
    /// - An older build's payload (no updatedAt): cloud sync times, as before.
    /// - A local record with unsent edits: edit times. It loses only to a later edit, never to a
    ///   copy that is merely synced more recently (which does not hold that edit).
    /// - Otherwise the stamps: the copy changed or synced last is the newer one.
    static func remoteIsNewer(localUpdated: Date?, localSynced: Date?, localPending: Bool,
                              peerUpdated: Double?, peerSynced: Double) -> Bool {
        guard let peerUpdated else { return peerSynced > epoch(localSynced) }
        if localPending, let localUpdated {
            return peerUpdated > localUpdated.timeIntervalSince1970 + tolerance
        }
        return max(peerUpdated, peerSynced) > stamp(updatedAt: localUpdated, syncedAt: localSynced) + tolerance
    }

    /// Whether this device's copy must go back to the peer after the apply: it still differs from
    /// the peer's copy, and it holds something the peer should take (it changed here, i.e. it is
    /// a merge, or the peer's copy was not the newer one). A copy that lost to a newer peer copy
    /// and did not change is not sent back: the peer's own rules would keep its values anyway.
    static func sendsBack(differsFromPeer: Bool, contentChanged: Bool, remoteIsNewer: Bool) -> Bool {
        differsFromPeer && (contentChanged || !remoteIsNewer)
    }

    /// syncedAt after a peer's copy was applied. It adopts the peer's stamp (never moving back),
    /// so the peer does not send that copy again; when this copy goes back (`sendBack`) the stamp
    /// ends above the peer's, unless updatedAt already puts it there.
    /// - localUpdated: updatedAt after the apply.
    static func syncedAtAfterApply(localUpdated: Date?, localSynced: Date?, peerStamp: Double,
                                   sendBack: Bool) -> Date {
        let adopted = max(epoch(localSynced), peerStamp)
        guard sendBack, max(epoch(localUpdated), adopted) <= peerStamp + tolerance else {
            return Date(timeIntervalSince1970: adopted)
        }
        return Date(timeIntervalSince1970: peerStamp + 10 * tolerance)
    }
}

/// A record's synced content without sync bookkeeping, to tell whether an apply changed it and
/// whether it still differs from the peer's copy. Dates are compared to the millisecond (they go
/// through Date and back). nil if it cannot be encoded (then treated as changed/different).
enum PeerFingerprint {
    static let bookkeeping: Set<String> = [
        "syncCode", "patientSyncCode", "remoteId", "syncedAt", "pendingSync", "updatedAt",
    ]

    static func fingerprint<T: Encodable>(_ record: T, dateKeys: Set<String> = []) -> Data? {
        guard let data = try? JSONEncoder().encode(record),
              var object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        else { return nil }
        for key in bookkeeping { object.removeValue(forKey: key) }
        for key in dateKeys {
            if let seconds = object[key] as? Double { object[key] = (seconds * 1000).rounded() }
        }
        return try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    }

    static func of(_ p: PeerPatient) -> Data? { fingerprint(p) }
    static func of(_ n: PeerNote) -> Data? { fingerprint(n) }
    static func of(_ rx: PeerPrescription) -> Data? { fingerprint(rx, dateKeys: ["prescribedAt"]) }
    static func of(_ v: PeerVitals) -> Data? { fingerprint(v, dateKeys: ["recordedAt"]) }
    static func of(_ b: PeerBillingItem) -> Data? { fingerprint(b, dateKeys: ["addedAt"]) }

    /// Different, or unknown (either side could not be encoded).
    static func differ(_ a: Data?, _ b: Data?) -> Bool {
        guard let a, let b else { return true }
        return a != b
    }
}
