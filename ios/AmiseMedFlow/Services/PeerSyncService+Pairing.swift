// PeerSyncService+Pairing.swift
// Peer admission: discovery, invitations, one-time pairing and the per-session challenge-response.
// The wire protocol and every crypto step are documented in PeerPairingCrypto.swift.
//
// Rules:
// - Discovery info holds only this install's random device id and a pairing-mode flag.
// - A device is invited, or its invitation accepted, only if it is paired (Keychain secret for
//   its device id) or this device is in the matching pairing step.
// - Every session proves possession of the pair secret both ways (HMAC over fresh nonces), then
//   checks both devices are signed in to the same account. Until then nothing is sent and
//   nothing received is read (sendManifest / handleManifest / didReceive check
//   isAuthenticated). A failure disconnects that peer only (one MCSession per peer).
// - Pair, forget and failed authentication are audited (device id and a fixed reason only).

import Foundation
import CryptoKit
import MultipeerConnectivity
import UIKit

/// Handshake state for one peer (one MCSession).
struct PeerLink {
    enum Role: Equatable {
        case pairInitiator(code: String)   // this device typed the code and invited
        case pairResponder(code: String)   // this device showed the code and accepted
        case auth                          // an already-paired device
    }
    /// A failed peer is dropped (session disconnected, link removed), so there is no failed phase.
    enum Phase: Equatable { case connecting, pairing, authenticating, authenticated }

    var role: Role
    var phase: Phase = .connecting
    /// This device sent the invitation.
    let outgoing: Bool
    /// The device id the peer advertised or put in its invitation. The peer must use the same id
    /// in the session, and it selects the Keychain secret.
    let claimedDeviceId: String

    // Pairing
    var ephemeralKey: Curve25519.KeyAgreement.PrivateKey?
    var pairing: PeerPairingCrypto.PairingSession?
    var peerName: String?

    // Authentication
    var myNonce: Data?
    var peerNonce: Data?
    var proofSent = false

    var isPairing: Bool {
        if case .auth = role { return false }
        return true
    }
    var isPairingResponder: Bool {
        if case .pairResponder = role { return true }
        return false
    }
}

extension PeerSyncService {

    // MARK: - State

    var authenticatedPeers: [MCPeerID] {
        links.filter { $0.value.phase == .authenticated }.map { $0.key }
    }

    func isAuthenticated(_ peer: MCPeerID) -> Bool {
        links[peer]?.phase == .authenticated
    }

    func reloadPairedDevices() {
        pairedDevices = PeerPairingStore.pairedDevices()
        if !pairedDevices.isEmpty, pairingMigrationPending {
            PeerDeviceIdentity.clearMigrationPending()
            pairingMigrationPending = false
        }
    }

    func refreshCounts() {
        connectedCount = authenticatedPeers.count
        nearbyCount    = foundPeers.count
    }

    /// One-line prompt shown in the sync status while nearby sync needs a pairing; nil otherwise.
    var pairingPrompt: String? {
        guard isRunning, pairedDevices.isEmpty else { return nil }
        let other = UIDevice.current.userInterfaceIdiom == .pad ? "iPhone" : "iPad"
        if legacyDeviceNearby      { return "Update MedFlow on your \(other), then pair it to resume nearby sync" }
        if pairingMigrationPending { return "Pair your \(other) to resume nearby sync" }
        if unpairedDeviceNearby    { return "Pair your \(other) to sync nearby" }
        return nil
    }

    /// "Not now": hides the prompt until another unpaired device is seen.
    func dismissPairingPrompt() {
        PeerDeviceIdentity.clearMigrationPending()
        pairingMigrationPending = false
        unpairedDeviceNearby    = false
        legacyDeviceNearby      = false
    }

    // MARK: - Transport

    /// (Re)starts advertising with the current discovery info. The info is fixed per advertiser,
    /// so entering or leaving pairing mode needs a new one.
    func readvertise() {
        advertiser?.stopAdvertisingPeer()
        advertiser?.delegate = nil
        advertiser = nil
        guard isRunning else { return }
        let info = PeerPairingCrypto.discoveryInfo(deviceId: deviceId, pairingMode: pairingCode != nil)
        let adv = MCNearbyServiceAdvertiser(peer: myPeer, discoveryInfo: info,
                                            serviceType: Self.serviceType)
        adv.delegate = self
        adv.startAdvertisingPeer()
        advertiser = adv
    }

    func makeSession() -> MCSession {
        let sess = MCSession(peer: myPeer, securityIdentity: nil, encryptionPreference: .required)
        sess.delegate = self
        return sess
    }

    func invite(_ peer: MCPeerID, mode: PeerInvitation.Mode, claimedDeviceId: String, role: PeerLink.Role) {
        guard let browser else { return }
        if let old = sessions.removeValue(forKey: peer) { old.disconnect() }
        let sess = makeSession()
        sessions[peer] = sess
        links[peer] = PeerLink(role: role, outgoing: true, claimedDeviceId: claimedDeviceId)
        browser.invitePeer(peer, to: sess,
                           withContext: PeerInvitation(deviceId: deviceId, mode: mode).encoded,
                           timeout: 30)
    }

    /// Disconnects one peer and forgets its handshake state.
    func dropPeer(_ peer: MCPeerID) {
        recordHistory(for: peer)
        let sess = sessions.removeValue(forKey: peer)
        links[peer] = nil
        if pairingTarget == peer { pairingTarget = nil }
        sess?.disconnect()
        refreshCounts()
    }

    func recordHistory(for peer: MCPeerID) {
        let rcvd = receivedCount.removeValue(forKey: peer) ?? 0
        let sent = sentCount.removeValue(forKey: peer) ?? 0
        for (count, direction) in [(rcvd, PeerSyncEvent.Direction.received), (sent, .sent)] {
            guard count > 0 else { continue }
            syncHistory.insert(PeerSyncEvent(peerName: peer.displayName, recordCount: count,
                                             direction: direction, at: .now), at: 0)
            if syncHistory.count > 20 { syncHistory = Array(syncHistory.prefix(20)) }
        }
    }

    // MARK: - Discovery

    func peerFound(_ peer: MCPeerID, info: [String: String]?) {
        guard isRunning else { return }
        guard let found = PeerPairingCrypto.parseDiscoveryInfo(info) else {
            // An older build (email hash, no device id) is never connected to.
            if PeerPairingCrypto.isLegacyDiscoveryInfo(info) { legacyDeviceNearby = true }
            return
        }
        guard found.deviceId != deviceId else { return }
        discovered[peer] = found
        if found.pairingMode, enteredCode != nil { schedulePairAttempt() }

        if PeerPairingStore.hasSecret(for: found.deviceId) {
            foundPeers.insert(peer)
            connectAttempts[peer] = 0
            scheduleConnect(peer)
        } else {
            foundPeers.remove(peer)
            if !found.pairingMode { unpairedDeviceNearby = true }
        }
        refreshCounts()
    }

    func peerLost(_ peer: MCPeerID) {
        discovered[peer] = nil
        foundPeers.remove(peer)
        connectAttempts[peer] = nil
        refreshCounts()
        if connectedCount == 0, !pairedDevices.isEmpty { peerSyncStatus = "Looking for nearby devices…" }
    }

    /// Connects to a paired device in range. The lower device id invites; the other waits and
    /// invites only if no invitation arrived, so both sides do not invite at once.
    func scheduleConnect(_ peer: MCPeerID) {
        guard let found = discovered[peer], connectAttempts[peer, default: 0] < 4 else { return }
        let designated = deviceId < found.deviceId
        let delay: Double = designated ? (connectAttempts[peer, default: 0] == 0 ? 0.2 : 2) : 6
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard let self, self.isRunning, self.sessions[peer] == nil,
                  self.discovered[peer]?.deviceId == found.deviceId,
                  PeerPairingStore.hasSecret(for: found.deviceId) else { return }
            self.connectAttempts[peer, default: 0] += 1
            self.invite(peer, mode: .auth, claimedDeviceId: found.deviceId, role: .auth)
            self.peerSyncStatus = "Connecting to \(peer.displayName)…"
        }
    }

    // MARK: - Invitations

    /// The session to accept an invitation into, or nil to decline it.
    func sessionForInvitation(from peer: MCPeerID, invitation: PeerInvitation?) -> MCSession? {
        guard isRunning, let inv = invitation, inv.d != deviceId else { return nil }
        let role: PeerLink.Role
        switch inv.m {
        case .pair:
            // Only while this device shows an unexpired, unused code, one pairing at a time.
            guard let code = pairingCode, let expiry = pairingCodeExpiresAt, expiry > .now,
                  !pairingCodeAttemptUsed,
                  !links.values.contains(where: { $0.isPairingResponder }) else { return nil }
            role = .pairResponder(code: code)
        case .auth:
            guard PeerPairingStore.hasSecret(for: inv.d) else {
                unpairedDeviceNearby = true
                return nil
            }
            // Both sides invited at once: the lower device id's invitation wins.
            if let link = links[peer], link.outgoing, link.phase == .connecting, deviceId < inv.d {
                return nil
            }
            role = .auth
        }
        if let old = sessions.removeValue(forKey: peer) { old.disconnect() }
        let sess = makeSession()
        sessions[peer] = sess
        links[peer] = PeerLink(role: role, outgoing: false, claimedDeviceId: inv.d)
        return sess
    }

    // MARK: - Session state

    func sessionStateChanged(_ session: MCSession, peer: MCPeerID, state: MCSessionState) {
        guard sessions[peer] === session else { return }   // replaced or already dropped
        switch state {
        case .connected:
            beginHandshake(with: peer, session: session)
        case .notConnected:
            let wasPairing = links[peer]?.isPairing == true
            recordHistory(for: peer)
            sessions[peer] = nil
            links[peer] = nil
            if pairingTarget == peer {
                pairingTarget = nil
                if wasPairing {
                    enteredCode = nil
                    isPairingInProgress = false
                    pairingStatus = "Pairing did not complete. Check the code and try again."
                }
            }
            refreshCounts()
            if connectedCount == 0, !pairedDevices.isEmpty { peerSyncStatus = "Looking for nearby devices…" }
            scheduleConnect(peer)
        default:
            break
        }
    }

    private func beginHandshake(with peer: MCPeerID, session: MCSession) {
        guard var link = links[peer] else { dropPeer(peer); return }
        switch link.role {
        case .pairInitiator:
            let key = Curve25519.KeyAgreement.PrivateKey()
            link.ephemeralKey = key
            link.phase = .pairing
            links[peer] = link
            sendHandshake(PeerHandshakeMessage(hs: .pairHello, deviceId: deviceId,
                                               deviceName: myPeer.displayName,
                                               publicKey: key.publicKey.rawRepresentation), to: peer)
        case .pairResponder:
            // Waits for the initiator's pairHello (which may already have been handled).
            if link.phase == .connecting { link.phase = .pairing }
            links[peer] = link
        case .auth:
            startAuthentication(with: peer)
        }
        armHandshakeTimeout(peer, session: session)
    }

    /// A peer that has not authenticated 20 s after connecting is dropped.
    private func armHandshakeTimeout(_ peer: MCPeerID, session: MCSession) {
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(20))
            guard let self, self.sessions[peer] === session,
                  self.links[peer]?.phase != .authenticated else { return }
            if self.pairingTarget == peer { self.pairingStatus = "Pairing timed out. Try again." }
            self.failHandshake(peer, reason: "timeout")
        }
    }

    private func sendHandshake(_ message: PeerHandshakeMessage, to peer: MCPeerID) {
        guard let sess = sessions[peer], let data = try? JSONEncoder().encode(message) else { return }
        try? sess.send(data, toPeers: [peer], with: .reliable)
    }

    /// Drops the peer and audits the failure (device id and a fixed reason only; no PHI).
    func failHandshake(_ peer: MCPeerID, reason: String) {
        AuditLog.record("peer_auth_failed", "device", resourceId: links[peer]?.claimedDeviceId,
                        details: ["reason": reason])
        if pairingTarget == peer {
            enteredCode = nil
            isPairingInProgress = false
        }
        dropPeer(peer)
    }

    // MARK: - Handshake messages

    func handleHandshake(_ message: PeerHandshakeMessage, from peer: MCPeerID) {
        // Once authenticated, a peer cannot restart the handshake.
        guard let link = links[peer], link.phase != .authenticated else { return }
        switch message.hs {
        case .pairHello:   handlePairHello(message, from: peer, link: link)
        case .pairConfirm: handlePairConfirm(message, from: peer, link: link)
        case .authHello:   handleAuthHello(message, from: peer, link: link)
        case .authProof:   handleAuthProof(message, from: peer, link: link)
        }
    }

    private func handlePairHello(_ message: PeerHandshakeMessage, from peer: MCPeerID, link: PeerLink) {
        var link = link
        // The initiator's hello can be read before this side's own .connected callback.
        guard link.phase == .pairing || (link.isPairingResponder && link.phase == .connecting),
              link.pairing == nil,
              message.deviceId == link.claimedDeviceId,
              let peerKey = message.publicKey else {
            failHandshake(peer, reason: "pair_malformed")
            return
        }
        let name = Self.cleanDeviceName(message.deviceName) ?? peer.displayName
        do {
            switch link.role {
            case .pairResponder(let code):
                let key = Curve25519.KeyAgreement.PrivateKey()
                link.pairing = try PeerPairingCrypto.pairingSession(
                    role: .responder, ownId: deviceId, ownPrivateKey: key,
                    peerId: link.claimedDeviceId, peerPublicKey: peerKey, code: code)
                link.phase = .pairing
                link.ephemeralKey = key
                link.peerName = name
                links[peer] = link
                pairingStatus = "Pairing with \(name)…"
                sendHandshake(PeerHandshakeMessage(hs: .pairHello, deviceId: deviceId,
                                                   deviceName: myPeer.displayName,
                                                   publicKey: key.publicKey.rawRepresentation), to: peer)
            case .pairInitiator(let code):
                guard let key = link.ephemeralKey else {
                    failHandshake(peer, reason: "pair_malformed")
                    return
                }
                let pairing = try PeerPairingCrypto.pairingSession(
                    role: .initiator, ownId: deviceId, ownPrivateKey: key,
                    peerId: link.claimedDeviceId, peerPublicKey: peerKey, code: code)
                link.pairing = pairing
                link.peerName = name
                links[peer] = link
                // The device that typed the code proves it first (see the protocol notes).
                sendHandshake(PeerHandshakeMessage(
                    hs: .pairConfirm,
                    mac: PeerPairingCrypto.pairingConfirmation(role: .initiator, session: pairing)), to: peer)
            case .auth:
                failHandshake(peer, reason: "unexpected_pairing")
            }
        } catch {
            failHandshake(peer, reason: "pair_bad_key")
        }
    }

    private func handlePairConfirm(_ message: PeerHandshakeMessage, from peer: MCPeerID, link: PeerLink) {
        guard link.phase == .pairing, let pairing = link.pairing, let mac = message.mac else {
            failHandshake(peer, reason: "pair_malformed")
            return
        }
        let name = link.peerName ?? peer.displayName
        switch link.role {
        case .pairResponder:
            // One confirmation attempt per code, whatever the outcome.
            pairingCodeAttemptUsed = true
            guard PeerPairingCrypto.verifyPairingConfirmation(mac, role: .initiator, session: pairing) else {
                clearPairingCode()
                pairingStatus = "The code did not match. Show a new code and try again."
                failHandshake(peer, reason: "pair_code_mismatch")
                return
            }
            sendHandshake(PeerHandshakeMessage(
                hs: .pairConfirm,
                mac: PeerPairingCrypto.pairingConfirmation(role: .responder, session: pairing)), to: peer)
            clearPairingCode()
            completePairing(with: peer, link: link, secret: pairing.keys.pairSecret, name: name, role: .responder)
        case .pairInitiator:
            guard PeerPairingCrypto.verifyPairingConfirmation(mac, role: .responder, session: pairing) else {
                pairingStatus = "Pairing failed. Check the code on the other device and try again."
                failHandshake(peer, reason: "pair_code_mismatch")
                return
            }
            completePairing(with: peer, link: link, secret: pairing.keys.pairSecret, name: name, role: .initiator)
        case .auth:
            failHandshake(peer, reason: "unexpected_pairing")
        }
    }

    private func completePairing(with peer: MCPeerID, link: PeerLink, secret: SymmetricKey,
                                 name: String, role: PeerPairingCrypto.PairingRole) {
        if role == .initiator {
            enteredCode = nil
            isPairingInProgress = false
            pairingTarget = nil
        }
        guard PeerPairingStore.save(secret: secret, deviceId: link.claimedDeviceId, name: name) else {
            pairingStatus = "Could not save the pairing on this device. Try again."
            failHandshake(peer, reason: "keychain_error")
            return
        }
        AuditLog.record("peer_pair", "device", resourceId: link.claimedDeviceId,
                        details: ["role": role.rawValue])
        reloadPairedDevices()
        foundPeers.insert(peer)
        pairingStatus = "Paired with \(name)."

        var next = link
        next.ephemeralKey = nil
        next.pairing = nil
        links[peer] = next
        // Same session: straight on to the everyday challenge-response.
        startAuthentication(with: peer)
    }

    private func startAuthentication(with peer: MCPeerID) {
        guard var link = links[peer] else { return }
        let nonce = PeerPairingCrypto.newNonce()
        link.role = .auth
        link.phase = .authenticating
        link.myNonce = nonce
        links[peer] = link
        sendHandshake(PeerHandshakeMessage(hs: .authHello, deviceId: deviceId, nonce: nonce), to: peer)
        sendProofIfReady(to: peer)
    }

    private func handleAuthHello(_ message: PeerHandshakeMessage, from peer: MCPeerID, link: PeerLink) {
        var link = link
        // May arrive while this side is still finishing pairing: kept until authentication starts.
        guard link.peerNonce == nil,
              message.deviceId == link.claimedDeviceId,
              let nonce = message.nonce, nonce.count == PeerPairingCrypto.nonceLength else {
            failHandshake(peer, reason: "auth_malformed")
            return
        }
        link.peerNonce = nonce
        links[peer] = link
        sendProofIfReady(to: peer)
    }

    /// Sends this side's proof once both nonces are known.
    private func sendProofIfReady(to peer: MCPeerID) {
        guard var link = links[peer], link.phase == .authenticating, !link.proofSent,
              let mine = link.myNonce, let theirs = link.peerNonce else { return }
        guard let secret = PeerPairingStore.secret(for: link.claimedDeviceId) else {
            failHandshake(peer, reason: "not_paired")
            return
        }
        link.proofSent = true
        links[peer] = link
        let proof = PeerPairingCrypto.authProof(secret: secret, senderId: deviceId,
                                                receiverId: link.claimedDeviceId,
                                                senderNonce: mine, receiverNonce: theirs)
        let tag = PeerPairingCrypto.accountTag(secret: secret, senderId: deviceId,
                                               receiverId: link.claimedDeviceId,
                                               senderNonce: mine, receiverNonce: theirs,
                                               email: storedEmail)
        sendHandshake(PeerHandshakeMessage(hs: .authProof, mac: proof, accountTag: tag), to: peer)
    }

    private func handleAuthProof(_ message: PeerHandshakeMessage, from peer: MCPeerID, link: PeerLink) {
        guard link.phase == .authenticating, let mine = link.myNonce, let theirs = link.peerNonce,
              let mac = message.mac, let tag = message.accountTag else {
            failHandshake(peer, reason: "auth_malformed")
            return
        }
        guard let secret = PeerPairingStore.secret(for: link.claimedDeviceId) else {
            failHandshake(peer, reason: "not_paired")
            return
        }
        guard PeerPairingCrypto.verifyAuthProof(mac, secret: secret, senderId: link.claimedDeviceId,
                                                receiverId: deviceId,
                                                senderNonce: theirs, receiverNonce: mine) else {
            failHandshake(peer, reason: "bad_proof")
            peerSyncStatus = "\(peer.displayName) is not paired with this device. Pair it again to sync."
            return
        }
        // Same signed-in account: an additional requirement, compared only now, inside the
        // authenticated and encrypted session.
        guard !storedEmail.isEmpty,
              PeerPairingCrypto.verifyAccountTag(tag, secret: secret, senderId: link.claimedDeviceId,
                                                 receiverId: deviceId,
                                                 senderNonce: theirs, receiverNonce: mine,
                                                 email: storedEmail) else {
            failHandshake(peer, reason: "account_mismatch")
            peerSyncStatus = "\(peer.displayName) is signed in to a different account. Not synced."
            return
        }
        sendProofIfReady(to: peer)   // normally already sent
        guard var done = links[peer], done.proofSent else { return }
        done.phase = .authenticated
        links[peer] = done
        connectAttempts[peer] = 0
        foundPeers.insert(peer)
        refreshCounts()
        peerSyncStatus = "Syncing with \(peer.displayName)…"
        sendManifest(to: peer)
    }

    // MARK: - Pairing: this device shows the code (device A)

    func showPairingCode() {
        guard isRunning else {
            pairingStatus = "Sign in first to pair a device."
            return
        }
        cancelEnteredCode()
        let code = PeerPairingCrypto.generateCode()
        pairingCode = code
        pairingCodeAttemptUsed = false
        pairingCodeExpiresAt = Date.now.addingTimeInterval(PeerPairingCrypto.codeLifetime)
        pairingStatus = "Enter this code on your other device."
        readvertise()
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(PeerPairingCrypto.codeLifetime))
            guard let self, self.pairingCode == code else { return }
            self.clearPairingCode()
            self.pairingStatus = "The code expired. Show a new code to pair."
        }
    }

    /// Stops showing the code and advertising pairing mode.
    func clearPairingCode() {
        let wasShowing = pairingCode != nil
        pairingCode = nil
        pairingCodeExpiresAt = nil
        pairingCodeAttemptUsed = false
        if wasShowing { readvertise() }
    }

    /// The pairing screen closed. A pairing already under way is left to finish.
    func endPairingScreen() {
        clearPairingCode()
        if pairingTarget == nil { cancelEnteredCode() }
        pairingStatus = ""
    }

    // MARK: - Pairing: this device types the code (device B)

    @discardableResult
    func enterPairingCode(_ input: String) -> Bool {
        guard isRunning else {
            pairingStatus = "Sign in first to pair a device."
            return false
        }
        guard let code = PeerPairingCrypto.normalizedCode(input) else {
            pairingStatus = "Enter the 6-digit code shown on your other device."
            return false
        }
        guard pairingTarget == nil else { return false }
        clearPairingCode()   // this device types the code; it no longer shows one
        enteredCode = code
        isPairingInProgress = true
        pairingStatus = "Looking for the device showing the code…"
        schedulePairAttempt()
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(PeerPairingCrypto.codeLifetime))
            guard let self, self.enteredCode == code, self.pairingTarget == nil else { return }
            self.cancelEnteredCode()
            self.pairingStatus = "No device showing a code was found. Open Pair a device on the other device and try again."
        }
        return true
    }

    func cancelEnteredCode() {
        if let target = pairingTarget, links[target]?.isPairing == true { dropPeer(target) }
        pairingTarget = nil
        enteredCode = nil
        isPairingInProgress = false
    }

    /// Waits briefly so every device advertising pairing mode is seen, then pairs only if
    /// exactly one is (a second one could be an impostor).
    func schedulePairAttempt() {
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(1.5))
            self?.attemptPairing()
        }
    }

    private func attemptPairing() {
        guard isRunning, let code = enteredCode, pairingTarget == nil else { return }
        let holders = discovered.filter { $0.value.pairingMode }
        guard !holders.isEmpty else { return }   // not seen yet; peerFound schedules another try
        guard holders.count == 1, let holder = holders.first else {
            cancelEnteredCode()
            pairingStatus = "More than one nearby device is showing a pairing code. Close the others and try again."
            return
        }
        pairingTarget = holder.key
        invite(holder.key, mode: .pair, claimedDeviceId: holder.value.deviceId,
               role: .pairInitiator(code: code))
        pairingStatus = "Pairing with \(holder.key.displayName)…"
    }

    // MARK: - Management

    /// Forget a paired device: deletes its Keychain secret and disconnects it.
    func forgetDevice(_ device: PairedPeerDevice) {
        PeerPairingStore.delete(deviceId: device.deviceId)
        AuditLog.record("peer_forget", "device", resourceId: device.deviceId)
        for (peer, link) in links where link.claimedDeviceId == device.deviceId { dropPeer(peer) }
        for (peer, found) in discovered where found.deviceId == device.deviceId { foundPeers.remove(peer) }
        reloadPairedDevices()
        refreshCounts()
    }

    /// A peer-supplied device name, cleaned for display (no control characters, 40 characters).
    static func cleanDeviceName(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let scalars = raw.unicodeScalars.filter { !CharacterSet.controlCharacters.contains($0) }
        let cleaned = String(String.UnicodeScalarView(scalars)).trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? nil : String(cleaned.prefix(40))
    }
}
