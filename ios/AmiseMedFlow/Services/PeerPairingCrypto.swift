// PeerPairingCrypto.swift
// Pure crypto and wire helpers for nearby-device pairing and peer authentication.
// No I/O, no Keychain, no MultipeerConnectivity: everything here is unit-tested in
// AmiseMedFlowTests/PeerPairingTests.swift.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// PROTOCOL (v1)
// ─────────────────────────────────────────────────────────────────────────────────────────────
// Transport: MultipeerConnectivity, one MCSession per peer, encryptionPreference .required.
// MPC encrypts but does not authenticate (no securityIdentity), so admission is done here.
//
// Discovery info (broadcast in clear over Bonjour) holds only:
//   "d": a random per-install device id (16 random bytes, hex), and
//   "p": "1" while this device is showing a pairing code, else "0".
// No email, no hash of the email, no account data.
//
// Invitation context (PeerInvitation): {"v":1,"d":<inviter device id>,"m":"pair"|"auth"}.
// It only filters invitations; nothing in it is trusted.
//
// 1. PAIRING (once per pair of devices)
//    Device A (Settings → Nearby devices → Pair a device) shows a 6-digit code, valid 2 minutes,
//    and advertises "p":"1". Device B's user types the code. B invites the one device that
//    advertises "p":"1" (B refuses if more than one does). Inside the encrypted session:
//
//      B → A  pairHello  { idB, ePK_B }          ePK = fresh Curve25519.KeyAgreement key
//      A → B  pairHello  { idA, ePK_A }
//      both   Z   = X25519(own ephemeral private key, peer ePK)
//             T   = fields("amise-medflow/pair/v1", idB, ePK_B, idA, ePK_A)   (initiator first)
//             IKM = Z ‖ code
//             Kc  = HKDF-SHA256(IKM, salt: SHA256(T), info: ".../pair/v1/confirm")
//             S   = HKDF-SHA256(IKM, salt: SHA256(T), info: ".../pair/v1/secret")
//      B → A  pairConfirm { HMAC(Kc, fields(".../confirm/initiator", T)) }
//      A      verifies (constant time). One confirmation attempt per code: on a mismatch the
//             code is burned and A must show a new one.
//      A → B  pairConfirm { HMAC(Kc, fields(".../confirm/responder", T)) }   (only after B's
//             confirmation verified, so a device that does not know the code learns nothing
//             from A)
//      B      verifies.
//    Both store S (32 bytes) in the Keychain under the peer's device id
//    (kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly), then run step 2 on the same session.
//
//    Why this shape: the ephemeral X25519 exchange means a passive listener (even one that
//    decrypted the MPC layer) never learns Z, so it cannot test code guesses offline against
//    the confirmation MACs or derive S from the 6-digit code. The transcript binds both device
//    ids and both ephemeral keys, so a relayed or substituted key fails confirmation.
//    Known limit (documented, accepted): this is not a full PAKE. An ACTIVE attacker that is
//    within radio range during the 2-minute window, advertises pairing mode and is chosen by B
//    instead of A would receive B's confirmation and could brute-force the 6-digit code offline.
//    Mitigations: B refuses when more than one device advertises pairing mode; A accepts one
//    pairing session at a time and one confirmation attempt per code; codes expire after
//    2 minutes; every pairing and failure is audited; paired devices are listed in Settings
//    with "Forget". CryptoKit exposes no group operations, so SPAKE2/CPace is not available
//    without a third-party dependency.
//
// 2. AUTHENTICATION (every session, before any manifest or patient data)
//      X → Y  authHello { idX, nX }                  nX = 32 random bytes, fresh per session
//      Y → X  authHello { idY, nY }
//      each side, once it holds both nonces, sends
//      X → Y  authProof { HMAC(S, fields(".../auth/v1/proof",   idX, idY, nX, nY)),
//                         HMAC(S, fields(".../auth/v1/account", idX, idY, nX, nY, SHA256(email))) }
//      Y verifies the proof (constant time) with the S it stored for idX, THEN compares the
//      account tag with its own signed-in email (same-account rule, compared only inside the
//      authenticated, encrypted session; never broadcast). Sender-first field order stops a
//      reflected proof from verifying; fresh nonces stop replay.
//    Only after the peer's proof and account tag verify is the manifest sent, and only then are
//    manifest or record messages from that peer read. A failure disconnects the peer.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import Foundation
import CryptoKit

enum PeerPairingCrypto {

    // MARK: - Constants

    static let codeLength = 6
    /// A pairing code is valid for 2 minutes.
    static let codeLifetime: TimeInterval = 120
    static let nonceLength = 32
    static let secretLength = 32
    static let deviceIdByteCount = 16

    private static let pairLabel     = "amise-medflow/pair/v1"
    private static let confirmInfo   = "amise-medflow/pair/v1/confirm"
    private static let secretInfo    = "amise-medflow/pair/v1/secret"
    private static let proofLabel    = "amise-medflow/auth/v1/proof"
    private static let accountLabel  = "amise-medflow/auth/v1/account"

    enum PairingError: Error { case invalidPublicKey, weakSharedSecret }

    // MARK: - Randomness

    /// Cryptographically secure random bytes (SystemRandomNumberGenerator is backed by the
    /// system CSPRNG on Apple platforms).
    static func randomBytes(_ count: Int) -> Data {
        var rng = SystemRandomNumberGenerator()
        return Data((0..<count).map { _ in UInt8.random(in: UInt8.min...UInt8.max, using: &rng) })
    }

    static func hex(_ data: Data) -> String {
        data.map { String(format: "%02x", $0) }.joined()
    }

    // MARK: - Device id

    /// A new random per-install device id: 16 random bytes as 32 lowercase hex characters.
    static func newDeviceId() -> String { hex(randomBytes(deviceIdByteCount)) }

    static func isValidDeviceId(_ id: String) -> Bool {
        id.count == deviceIdByteCount * 2 && id.allSatisfy { $0.isASCII && $0.isHexDigit }
    }

    // MARK: - Discovery info (broadcast in clear)

    enum DiscoveryKey {
        static let deviceId = "d"
        static let pairing  = "p"
        /// Older builds advertised a hash of the signed-in email under this key.
        static let legacyEmailHash = "h"
    }

    struct Discovered: Equatable {
        let deviceId: String
        let pairingMode: Bool
    }

    /// The only data this device broadcasts: its random id and whether it is showing a code.
    static func discoveryInfo(deviceId: String, pairingMode: Bool) -> [String: String] {
        [DiscoveryKey.deviceId: deviceId, DiscoveryKey.pairing: pairingMode ? "1" : "0"]
    }

    static func parseDiscoveryInfo(_ info: [String: String]?) -> Discovered? {
        guard let id = info?[DiscoveryKey.deviceId], isValidDeviceId(id) else { return nil }
        return Discovered(deviceId: id, pairingMode: info?[DiscoveryKey.pairing] == "1")
    }

    /// A device on a build from before pairing (it advertises the email hash and no device id).
    static func isLegacyDiscoveryInfo(_ info: [String: String]?) -> Bool {
        info?[DiscoveryKey.legacyEmailHash] != nil && info?[DiscoveryKey.deviceId] == nil
    }

    // MARK: - Pairing code

    /// A uniformly random 6-digit code, zero-padded ("004217").
    static func generateCode() -> String {
        var rng = SystemRandomNumberGenerator()
        return String(format: "%06d", Int.random(in: 0...999_999, using: &rng))
    }

    /// The typed code without spaces, or nil unless it is exactly 6 ASCII digits.
    static func normalizedCode(_ input: String) -> String? {
        let compact = input.filter { !$0.isWhitespace }
        guard compact.count == codeLength, compact.allSatisfy({ $0.isASCII && $0.isNumber }) else { return nil }
        return compact
    }

    // MARK: - Encoding

    /// Unambiguous encoding of a label and fields: each part is a 4-byte big-endian length
    /// followed by its bytes.
    static func fields(_ label: String, _ parts: [Data]) -> Data {
        var out = Data()
        for part in [Data(label.utf8)] + parts {
            withUnsafeBytes(of: UInt32(part.count).bigEndian) { out.append(contentsOf: $0) }
            out.append(part)
        }
        return out
    }

    static func keyData(_ key: SymmetricKey) -> Data { key.withUnsafeBytes { Data($0) } }

    // MARK: - Pairing (ephemeral X25519 authenticated by the code)

    enum PairingRole: String { case initiator, responder }

    struct PairingKeys {
        let confirmKey: SymmetricKey
        /// The long-term per-peer secret stored in the Keychain.
        let pairSecret: SymmetricKey
    }

    struct PairingSession {
        let transcript: Data
        let keys: PairingKeys
    }

    /// T: both device ids and both ephemeral public keys, initiator (the device that typed the
    /// code) first.
    static func pairingTranscript(initiatorId: String, initiatorKey: Data,
                                  responderId: String, responderKey: Data) -> Data {
        fields(pairLabel, [Data(initiatorId.utf8), initiatorKey, Data(responderId.utf8), responderKey])
    }

    /// X25519 shared secret with the peer's raw public key. Rejects a malformed key and an
    /// all-zero result (low-order point).
    static func sharedSecret(privateKey: Curve25519.KeyAgreement.PrivateKey,
                             peerPublicKey: Data) throws -> Data {
        guard peerPublicKey.count == 32,
              let peer = try? Curve25519.KeyAgreement.PublicKey(rawRepresentation: peerPublicKey)
        else { throw PairingError.invalidPublicKey }
        let secret = try privateKey.sharedSecretFromKeyAgreement(with: peer)
        let bytes = secret.withUnsafeBytes { Data($0) }
        guard bytes.contains(where: { $0 != 0 }) else { throw PairingError.weakSharedSecret }
        return bytes
    }

    /// HKDF-SHA256 over Z ‖ code, salted with SHA256(T): the confirmation key and the
    /// long-term pair secret (different info labels, so independent).
    static func pairingKeys(sharedSecret: Data, code: String, transcript: Data) -> PairingKeys {
        let ikm  = SymmetricKey(data: sharedSecret + Data(code.utf8))
        let salt = Data(SHA256.hash(data: transcript))
        let confirm = HKDF<SHA256>.deriveKey(inputKeyMaterial: ikm, salt: salt,
                                             info: Data(confirmInfo.utf8), outputByteCount: 32)
        let secret  = HKDF<SHA256>.deriveKey(inputKeyMaterial: ikm, salt: salt,
                                             info: Data(secretInfo.utf8), outputByteCount: secretLength)
        return PairingKeys(confirmKey: confirm, pairSecret: secret)
    }

    /// Everything one side needs once both pairHello messages are known.
    static func pairingSession(role: PairingRole,
                               ownId: String, ownPrivateKey: Curve25519.KeyAgreement.PrivateKey,
                               peerId: String, peerPublicKey: Data,
                               code: String) throws -> PairingSession {
        let ownKey = ownPrivateKey.publicKey.rawRepresentation
        let transcript = role == .initiator
            ? pairingTranscript(initiatorId: ownId, initiatorKey: ownKey, responderId: peerId, responderKey: peerPublicKey)
            : pairingTranscript(initiatorId: peerId, initiatorKey: peerPublicKey, responderId: ownId, responderKey: ownKey)
        let z = try sharedSecret(privateKey: ownPrivateKey, peerPublicKey: peerPublicKey)
        return PairingSession(transcript: transcript,
                              keys: pairingKeys(sharedSecret: z, code: code, transcript: transcript))
    }

    /// The confirmation MAC sent by `role`.
    static func pairingConfirmation(role: PairingRole, session: PairingSession) -> Data {
        let message = fields("\(confirmInfo)/\(role.rawValue)", [session.transcript])
        return Data(HMAC<SHA256>.authenticationCode(for: message, using: session.keys.confirmKey))
    }

    /// Constant-time check of the confirmation MAC the peer (`role`) sent.
    static func verifyPairingConfirmation(_ mac: Data, role: PairingRole, session: PairingSession) -> Bool {
        let message = fields("\(confirmInfo)/\(role.rawValue)", [session.transcript])
        return HMAC<SHA256>.isValidAuthenticationCode(mac, authenticating: message,
                                                     using: session.keys.confirmKey)
    }

    // MARK: - Authentication (every session)

    static func newNonce() -> Data { randomBytes(nonceLength) }

    static func normalizedEmail(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private static func proofMessage(senderId: String, receiverId: String,
                                     senderNonce: Data, receiverNonce: Data) -> Data {
        fields(proofLabel, [Data(senderId.utf8), Data(receiverId.utf8), senderNonce, receiverNonce])
    }

    private static func accountMessage(senderId: String, receiverId: String,
                                       senderNonce: Data, receiverNonce: Data, email: String) -> Data {
        let account = Data(SHA256.hash(data: Data(normalizedEmail(email).utf8)))
        return fields(accountLabel, [Data(senderId.utf8), Data(receiverId.utf8),
                                     senderNonce, receiverNonce, account])
    }

    /// HMAC-SHA256 proof that the sender holds the pair secret, over both ids and both nonces.
    static func authProof(secret: SymmetricKey, senderId: String, receiverId: String,
                          senderNonce: Data, receiverNonce: Data) -> Data {
        Data(HMAC<SHA256>.authenticationCode(
            for: proofMessage(senderId: senderId, receiverId: receiverId,
                              senderNonce: senderNonce, receiverNonce: receiverNonce),
            using: secret))
    }

    static func verifyAuthProof(_ mac: Data, secret: SymmetricKey, senderId: String, receiverId: String,
                                senderNonce: Data, receiverNonce: Data) -> Bool {
        HMAC<SHA256>.isValidAuthenticationCode(
            mac,
            authenticating: proofMessage(senderId: senderId, receiverId: receiverId,
                                         senderNonce: senderNonce, receiverNonce: receiverNonce),
            using: secret)
    }

    /// The same-account check: keyed by the pair secret and bound to this session's nonces, so it
    /// is useless to anyone without the secret and cannot be replayed or used as an identifier.
    static func accountTag(secret: SymmetricKey, senderId: String, receiverId: String,
                           senderNonce: Data, receiverNonce: Data, email: String) -> Data {
        Data(HMAC<SHA256>.authenticationCode(
            for: accountMessage(senderId: senderId, receiverId: receiverId,
                                senderNonce: senderNonce, receiverNonce: receiverNonce, email: email),
            using: secret))
    }

    static func verifyAccountTag(_ tag: Data, secret: SymmetricKey, senderId: String, receiverId: String,
                                 senderNonce: Data, receiverNonce: Data, email: String) -> Bool {
        HMAC<SHA256>.isValidAuthenticationCode(
            tag,
            authenticating: accountMessage(senderId: senderId, receiverId: receiverId,
                                           senderNonce: senderNonce, receiverNonce: receiverNonce,
                                           email: email),
            using: secret)
    }
}

// MARK: - Wire types

/// Invitation context. Filters which invitations are worth accepting; never trusted.
struct PeerInvitation: Codable, Equatable {
    enum Mode: String, Codable { case pair, auth }
    let v: Int
    let d: String
    let m: Mode

    init(deviceId: String, mode: Mode) { v = 1; d = deviceId; m = mode }

    var encoded: Data? { try? JSONEncoder().encode(self) }

    /// nil for anything that is not a v1 invitation with a valid device id (including an older
    /// build's context, which was the email hash as plain text).
    static func decode(_ data: Data?) -> PeerInvitation? {
        guard let data, let inv = try? JSONDecoder().decode(PeerInvitation.self, from: data),
              inv.v == 1, PeerPairingCrypto.isValidDeviceId(inv.d) else { return nil }
        return inv
    }
}

/// Pairing and authentication messages. A separate envelope (key "hs") from PeerMessage, so the
/// data protocol is unchanged and neither decodes as the other.
struct PeerHandshakeMessage: Codable, Equatable {
    enum Kind: String, Codable { case pairHello, pairConfirm, authHello, authProof }
    let hs: Kind
    var deviceId: String? = nil
    var deviceName: String? = nil
    var publicKey: Data? = nil
    var nonce: Data? = nil
    var mac: Data? = nil
    var accountTag: Data? = nil
}
