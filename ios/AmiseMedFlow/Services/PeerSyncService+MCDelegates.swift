// PeerSyncService+MCDelegates.swift
// MultipeerConnectivity protocol conformances: Advertiser, Browser, Session delegates.
// Admission decisions live in PeerSyncService+Pairing.swift.

import Foundation
import MultipeerConnectivity

// MARK: - MCNearbyServiceAdvertiserDelegate

extension PeerSyncService: MCNearbyServiceAdvertiserDelegate {
    nonisolated func advertiser(_ advertiser: MCNearbyServiceAdvertiser,
                                 didReceiveInvitationFromPeer peer: MCPeerID,
                                 withContext context: Data?,
                                 invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        // An invitation without a v1 context (including an older build's email hash) is declined.
        let invitation = PeerInvitation.decode(context)
        Task { @MainActor in
            if let sess = self.sessionForInvitation(from: peer, invitation: invitation) {
                invitationHandler(true, sess)
            } else {
                invitationHandler(false, nil)
            }
        }
    }

    nonisolated func advertiser(_ advertiser: MCNearbyServiceAdvertiser,
                                 didNotStartAdvertisingPeer error: Error) {
        Task { @MainActor in
            self.isRunning      = false
            self.peerSyncStatus = "Proximity sync unavailable"
        }
    }
}

// MARK: - MCNearbyServiceBrowserDelegate

extension PeerSyncService: MCNearbyServiceBrowserDelegate {
    nonisolated func browser(_ browser: MCNearbyServiceBrowser,
                              foundPeer peer: MCPeerID,
                              withDiscoveryInfo info: [String: String]?) {
        Task { @MainActor in
            self.peerFound(peer, info: info)
        }
    }

    nonisolated func browser(_ browser: MCNearbyServiceBrowser,
                              lostPeer peer: MCPeerID) {
        Task { @MainActor in
            self.peerLost(peer)
        }
    }

    nonisolated func browser(_ browser: MCNearbyServiceBrowser,
                              didNotStartBrowsingForPeers error: Error) {
        Task { @MainActor in
            self.isRunning      = false
            self.peerSyncStatus = "Proximity sync unavailable"
        }
    }
}

// MARK: - MCSessionDelegate

extension PeerSyncService: MCSessionDelegate {
    nonisolated func session(_ session: MCSession,
                              peer peerID: MCPeerID,
                              didChange state: MCSessionState) {
        Task { @MainActor in
            self.sessionStateChanged(session, peer: peerID, state: state)
        }
    }

    nonisolated func session(_ session: MCSession,
                              didReceive data: Data,
                              fromPeer peerID: MCPeerID) {
        Task { @MainActor in
            guard self.sessions[peerID] === session else { return }   // replaced or dropped

            // Pairing and authentication messages (separate envelope from PeerMessage).
            if let handshake = try? JSONDecoder().decode(PeerHandshakeMessage.self, from: data) {
                self.handleHandshake(handshake, from: peerID)
                return
            }
            // Nothing else from a peer is read until it has authenticated.
            guard self.isAuthenticated(peerID) else { return }

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
