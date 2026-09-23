// PeerSyncService+MCDelegates.swift
// MultipeerConnectivity protocol conformances: Advertiser, Browser, Session delegates.

import Foundation
import MultipeerConnectivity

// MARK: - MCNearbyServiceAdvertiserDelegate

extension PeerSyncService: MCNearbyServiceAdvertiserDelegate {
    nonisolated func advertiser(_ advertiser: MCNearbyServiceAdvertiser,
                                 didReceiveInvitationFromPeer peer: MCPeerID,
                                 withContext context: Data?,
                                 invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        var peerHash: String? = nil
        if let ctx = context, let str = String(data: ctx, encoding: .utf8) {
            peerHash = str
        }
        Task { @MainActor in
            let accept = peerHash == nil || peerHash == self.emailHash
            invitationHandler(accept, self.session)
        }
    }

    nonisolated func advertiser(_ advertiser: MCNearbyServiceAdvertiser,
                                 didNotStartAdvertisingPeer error: Error) {
        Task { @MainActor in
            self.peerSyncStatus = "Proximity sync unavailable"
        }
    }
}

// MARK: - MCNearbyServiceBrowserDelegate

extension PeerSyncService: MCNearbyServiceBrowserDelegate {
    nonisolated func browser(_ browser: MCNearbyServiceBrowser,
                              foundPeer peer: MCPeerID,
                              withDiscoveryInfo info: [String: String]?) {
        let peerHash = info?["h"]
        Task { @MainActor in
            guard peerHash == nil || peerHash == self.emailHash else { return }
            guard let sess = self.session else { return }
            guard !sess.connectedPeers.contains(peer) else { return }
            self.foundPeers.insert(peer)
            self.nearbyCount = self.foundPeers.count
            let ctx = self.emailHash.data(using: .utf8)
            browser.invitePeer(peer, to: sess, withContext: ctx, timeout: 30)
            self.peerSyncStatus = "Connecting to \(peer.displayName)…"
        }
    }

    nonisolated func browser(_ browser: MCNearbyServiceBrowser,
                              lostPeer peer: MCPeerID) {
        Task { @MainActor in
            self.foundPeers.remove(peer)
            self.nearbyCount = self.foundPeers.count
            if self.connectedCount == 0 { self.peerSyncStatus = "Looking for nearby devices…" }
        }
    }

    nonisolated func browser(_ browser: MCNearbyServiceBrowser,
                              didNotStartBrowsingForPeers error: Error) {
        Task { @MainActor in self.peerSyncStatus = "Proximity sync unavailable" }
    }
}

// MARK: - MCSessionDelegate

extension PeerSyncService: MCSessionDelegate {
    nonisolated func session(_ session: MCSession,
                              peer peerID: MCPeerID,
                              didChange state: MCSessionState) {
        Task { @MainActor in
            self.connectedCount = session.connectedPeers.count
            switch state {
            case .connected:
                self.peerSyncStatus = "Syncing with \(peerID.displayName)…"
                self.sendManifest(to: peerID)
            case .notConnected:
                let rcvd = self.receivedCount.removeValue(forKey: peerID) ?? 0
                let sent  = self.sentCount.removeValue(forKey: peerID) ?? 0
                for (count, direction) in [(rcvd, PeerSyncEvent.Direction.received), (sent, .sent)] {
                    guard count > 0 else { continue }
                    let event = PeerSyncEvent(peerName: peerID.displayName,
                                              recordCount: count,
                                              direction: direction,
                                              at: .now)
                    self.syncHistory.insert(event, at: 0)
                    if self.syncHistory.count > 20 {
                        self.syncHistory = Array(self.syncHistory.prefix(20))
                    }
                }
                if session.connectedPeers.isEmpty { self.peerSyncStatus = "Looking for nearby devices…" }
            default: break
            }
        }
    }

    nonisolated func session(_ session: MCSession,
                              didReceive data: Data,
                              fromPeer peerID: MCPeerID) {
        Task { @MainActor in
            guard let ctx = self.modelContext else { return }
            guard let message = try? JSONDecoder().decode(PeerMessage.self, from: data) else { return }

            switch message {
            case .manifest(let m):
                self.handleManifest(m, from: peerID)

            case .patients(let recs):
                try? self.applyPatients(recs, context: ctx)
                self.receivedCount[peerID, default: 0] += recs.count
                self.lastPeerSyncAt = .now
                self.peerSyncStatus = "Synced \(recs.count) patient\(recs.count == 1 ? "" : "s") from \(peerID.displayName)"

            case .notes(let recs):
                try? self.applyNotes(recs, context: ctx)
                self.receivedCount[peerID, default: 0] += recs.count

            case .prescriptions(let recs):
                try? self.applyPrescriptions(recs, context: ctx)
                self.receivedCount[peerID, default: 0] += recs.count

            case .vitals(let recs):
                try? self.applyVitals(recs, context: ctx)
                self.receivedCount[peerID, default: 0] += recs.count

            case .billingItems(let recs):
                try? self.applyBillingItems(recs, context: ctx)
                self.receivedCount[peerID, default: 0] += recs.count
            }
        }
    }

    nonisolated func session(_ session: MCSession, didReceive stream: InputStream,
                              withName streamName: String, fromPeer peerID: MCPeerID) {}
    nonisolated func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String,
                              fromPeer peerID: MCPeerID, with progress: Progress) {}
    nonisolated func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String,
                              fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
}
