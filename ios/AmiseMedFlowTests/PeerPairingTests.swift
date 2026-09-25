import XCTest
import CryptoKit
@testable import AmiseMedFlow

/// Nearby-device pairing and peer authentication (PeerPairingCrypto.swift). Pure helpers only:
/// no Multipeer session, no Keychain.
final class PeerPairingTests: XCTestCase {

    private typealias Crypto = PeerPairingCrypto

    /// Device A shows the code (responder); device B types it (initiator).
    private let idA = String(repeating: "a", count: 32)
    private let idB = String(repeating: "b", count: 32)
    private let keyA = try! Curve25519.KeyAgreement.PrivateKey(rawRepresentation: Data(repeating: 0x11, count: 32))
    private let keyB = try! Curve25519.KeyAgreement.PrivateKey(rawRepresentation: Data(repeating: 0x22, count: 32))

    private func pair(codeOnA: String, codeTypedOnB: String) throws
        -> (initiator: PeerPairingCrypto.PairingSession, responder: PeerPairingCrypto.PairingSession) {
        let b = try Crypto.pairingSession(role: .initiator, ownId: idB, ownPrivateKey: keyB,
                                          peerId: idA, peerPublicKey: keyA.publicKey.rawRepresentation,
                                          code: codeTypedOnB)
        let a = try Crypto.pairingSession(role: .responder, ownId: idA, ownPrivateKey: keyA,
                                          peerId: idB, peerPublicKey: keyB.publicKey.rawRepresentation,
                                          code: codeOnA)
        return (b, a)
    }

    private func bytes(_ key: SymmetricKey) -> Data { Crypto.keyData(key) }

    // MARK: - Key derivation

    func testKeyDerivationIsDeterministic() throws {
        let first = try pair(codeOnA: "042917", codeTypedOnB: "042917")
        let again = try pair(codeOnA: "042917", codeTypedOnB: "042917")

        XCTAssertEqual(bytes(first.initiator.keys.pairSecret), bytes(again.initiator.keys.pairSecret),
                       "same inputs, same secret")
        XCTAssertEqual(bytes(first.initiator.keys.pairSecret), bytes(first.responder.keys.pairSecret),
                       "both devices derive the same long-term secret")
        XCTAssertEqual(first.initiator.transcript, first.responder.transcript)
        XCTAssertEqual(bytes(first.initiator.keys.pairSecret).count, Crypto.secretLength)
        XCTAssertNotEqual(bytes(first.initiator.keys.pairSecret), bytes(first.initiator.keys.confirmKey),
                          "confirmation key and stored secret are independent")

        // The plain HKDF step is deterministic too.
        let z = Data(repeating: 0x5a, count: 32)
        let t = Crypto.pairingTranscript(initiatorId: idB, initiatorKey: Data(repeating: 1, count: 32),
                                         responderId: idA, responderKey: Data(repeating: 2, count: 32))
        XCTAssertEqual(bytes(Crypto.pairingKeys(sharedSecret: z, code: "123456", transcript: t).pairSecret),
                       bytes(Crypto.pairingKeys(sharedSecret: z, code: "123456", transcript: t).pairSecret))
    }

    func testKeyDerivationDependsOnCodeIdsAndKeys() throws {
        let base = try pair(codeOnA: "042917", codeTypedOnB: "042917")
        let otherCode = try pair(codeOnA: "042918", codeTypedOnB: "042918")
        XCTAssertNotEqual(bytes(base.initiator.keys.pairSecret), bytes(otherCode.initiator.keys.pairSecret))

        let otherId = try Crypto.pairingSession(role: .initiator, ownId: String(repeating: "c", count: 32),
                                                ownPrivateKey: keyB, peerId: idA,
                                                peerPublicKey: keyA.publicKey.rawRepresentation, code: "042917")
        XCTAssertNotEqual(bytes(base.initiator.keys.pairSecret), bytes(otherId.keys.pairSecret),
                          "device ids are bound into the key (HKDF salt)")

        let freshEphemeral = try Crypto.pairingSession(role: .initiator, ownId: idB,
                                                       ownPrivateKey: Curve25519.KeyAgreement.PrivateKey(),
                                                       peerId: idA, peerPublicKey: keyA.publicKey.rawRepresentation,
                                                       code: "042917")
        XCTAssertNotEqual(bytes(base.initiator.keys.pairSecret), bytes(freshEphemeral.keys.pairSecret),
                          "a new ephemeral key gives a new secret: the code alone does not determine it")
    }

    func testMalformedPeerKeyIsRejected() {
        XCTAssertThrowsError(try Crypto.pairingSession(role: .initiator, ownId: idB, ownPrivateKey: keyB,
                                                       peerId: idA, peerPublicKey: Data(repeating: 1, count: 31),
                                                       code: "123456"))
        // All-zero public key: low-order point, the shared secret would be zero.
        XCTAssertThrowsError(try Crypto.pairingSession(role: .initiator, ownId: idB, ownPrivateKey: keyB,
                                                       peerId: idA, peerPublicKey: Data(count: 32),
                                                       code: "123456"))
    }

    // MARK: - Confirmation

    func testRightCodeConfirmsBothWays() throws {
        let s = try pair(codeOnA: "314159", codeTypedOnB: "314159")
        let fromB = Crypto.pairingConfirmation(role: .initiator, session: s.initiator)
        XCTAssertTrue(Crypto.verifyPairingConfirmation(fromB, role: .initiator, session: s.responder))
        let fromA = Crypto.pairingConfirmation(role: .responder, session: s.responder)
        XCTAssertTrue(Crypto.verifyPairingConfirmation(fromA, role: .responder, session: s.initiator))
    }

    func testWrongCodeFailsConfirmation() throws {
        let s = try pair(codeOnA: "314159", codeTypedOnB: "314158")
        let fromB = Crypto.pairingConfirmation(role: .initiator, session: s.initiator)
        XCTAssertFalse(Crypto.verifyPairingConfirmation(fromB, role: .initiator, session: s.responder),
                       "device A rejects a confirmation made with the wrong code")
        XCTAssertNotEqual(bytes(s.initiator.keys.pairSecret), bytes(s.responder.keys.pairSecret))
    }

    func testConfirmationRejectsReflectionAndSubstitutedKey() throws {
        let s = try pair(codeOnA: "314159", codeTypedOnB: "314159")
        // A's own confirmation sent back to it is not accepted as B's.
        let fromA = Crypto.pairingConfirmation(role: .responder, session: s.responder)
        XCTAssertFalse(Crypto.verifyPairingConfirmation(fromA, role: .initiator, session: s.responder))

        // Someone in the middle substitutes its own key towards A: even with the right code the
        // transcripts and shared secrets differ, so B's confirmation does not verify at A.
        let mallory = Curve25519.KeyAgreement.PrivateKey()
        let aSeesMallory = try Crypto.pairingSession(role: .responder, ownId: idA, ownPrivateKey: keyA,
                                                     peerId: idB, peerPublicKey: mallory.publicKey.rawRepresentation,
                                                     code: "314159")
        let fromB = Crypto.pairingConfirmation(role: .initiator, session: s.initiator)
        XCTAssertFalse(Crypto.verifyPairingConfirmation(fromB, role: .initiator, session: aSeesMallory))
    }

    // MARK: - Challenge-response

    func testChallengeResponseVerifiesAndRejectsTampering() {
        let secret = SymmetricKey(data: Data(repeating: 7, count: 32))
        let nA = Crypto.newNonce(), nB = Crypto.newNonce()
        XCTAssertEqual(nA.count, Crypto.nonceLength)
        XCTAssertNotEqual(nA, nB)

        let proof = Crypto.authProof(secret: secret, senderId: idA, receiverId: idB,
                                     senderNonce: nA, receiverNonce: nB)
        XCTAssertTrue(Crypto.verifyAuthProof(proof, secret: secret, senderId: idA, receiverId: idB,
                                             senderNonce: nA, receiverNonce: nB))

        var flipped = proof
        flipped[flipped.startIndex] ^= 0x01
        XCTAssertFalse(Crypto.verifyAuthProof(flipped, secret: secret, senderId: idA, receiverId: idB,
                                              senderNonce: nA, receiverNonce: nB), "tampered MAC")
        XCTAssertFalse(Crypto.verifyAuthProof(proof.prefix(16), secret: secret, senderId: idA, receiverId: idB,
                                              senderNonce: nA, receiverNonce: nB), "truncated MAC")
        XCTAssertFalse(Crypto.verifyAuthProof(proof, secret: SymmetricKey(data: Data(repeating: 8, count: 32)),
                                              senderId: idA, receiverId: idB,
                                              senderNonce: nA, receiverNonce: nB), "unpaired: wrong secret")
        XCTAssertFalse(Crypto.verifyAuthProof(proof, secret: secret, senderId: idA, receiverId: idB,
                                              senderNonce: nA, receiverNonce: Crypto.newNonce()),
                       "replay into a new session (fresh challenge)")
        XCTAssertFalse(Crypto.verifyAuthProof(proof, secret: secret, senderId: idB, receiverId: idA,
                                              senderNonce: nB, receiverNonce: nA),
                       "reflected back to its sender")
        XCTAssertFalse(Crypto.verifyAuthProof(proof, secret: secret, senderId: idA, receiverId: idB,
                                              senderNonce: nB, receiverNonce: nA), "swapped nonces")
    }

    func testAccountTagMatchesSameAccountOnly() {
        let secret = SymmetricKey(data: Data(repeating: 9, count: 32))
        let nA = Crypto.newNonce(), nB = Crypto.newNonce()
        let tag = Crypto.accountTag(secret: secret, senderId: idA, receiverId: idB,
                                    senderNonce: nA, receiverNonce: nB, email: "Dr.Surgeon@Example.com ")
        XCTAssertTrue(Crypto.verifyAccountTag(tag, secret: secret, senderId: idA, receiverId: idB,
                                              senderNonce: nA, receiverNonce: nB, email: "dr.surgeon@example.com"),
                      "case and surrounding spaces do not matter")
        XCTAssertFalse(Crypto.verifyAccountTag(tag, secret: secret, senderId: idA, receiverId: idB,
                                               senderNonce: nA, receiverNonce: nB, email: "nurse@example.com"),
                       "a different signed-in account is refused")
        XCTAssertFalse(Crypto.verifyAccountTag(tag, secret: secret, senderId: idA, receiverId: idB,
                                               senderNonce: nA, receiverNonce: Crypto.newNonce(),
                                               email: "dr.surgeon@example.com"),
                       "bound to this session's nonces")
    }

    // MARK: - Discovery info and wire messages

    private func djb2(_ s: String) -> String {
        var h: UInt64 = 5381
        for byte in s.utf8 { h = h &* 33 &+ UInt64(byte) }
        return String(h)
    }

    func testDiscoveryInfoContainsNoEmailOrHash() throws {
        let email = "dr.surgeon@example.com"
        let forbidden = [email, email.uppercased(), djb2(email), djb2(email.lowercased()),
                         Crypto.hex(Data(SHA256.hash(data: Data(email.utf8)))), "@"]
        let deviceId = Crypto.newDeviceId()

        for pairing in [false, true] {
            let info = Crypto.discoveryInfo(deviceId: deviceId, pairingMode: pairing)
            XCTAssertEqual(Set(info.keys), ["d", "p"], "only the device id and the pairing flag")
            XCTAssertNil(info["h"], "the email hash key is gone")
            for value in info.values {
                for bad in forbidden { XCTAssertFalse(value.contains(bad), "\(value) contains \(bad)") }
            }
            XCTAssertEqual(Crypto.parseDiscoveryInfo(info),
                           PeerPairingCrypto.Discovered(deviceId: deviceId, pairingMode: pairing))
        }

        // The invitation context and the handshake messages carry no email either.
        let invitation = try XCTUnwrap(PeerInvitation(deviceId: deviceId, mode: .auth).encoded)
        let handshake = try JSONEncoder().encode(PeerHandshakeMessage(
            hs: .authProof, mac: Data(repeating: 1, count: 32),
            accountTag: Crypto.accountTag(secret: SymmetricKey(size: .bits256), senderId: idA, receiverId: idB,
                                          senderNonce: Crypto.newNonce(), receiverNonce: Crypto.newNonce(),
                                          email: email)))
        for data in [invitation, handshake] {
            let text = String(decoding: data, as: UTF8.self)
            for bad in forbidden { XCTAssertFalse(text.contains(bad), "\(text) contains \(bad)") }
        }
    }

    func testDeviceIdsAreRandomAndWellFormed() {
        let a = Crypto.newDeviceId(), b = Crypto.newDeviceId()
        XCTAssertNotEqual(a, b)
        XCTAssertTrue(Crypto.isValidDeviceId(a))
        XCTAssertFalse(Crypto.isValidDeviceId("not-a-device-id"))
        XCTAssertFalse(Crypto.isValidDeviceId(String(repeating: "g", count: 32)))
    }

    func testOlderBuildIsRecognisedAndNotAdmitted() {
        let legacyInfo = ["h": "13657128341829430017"]
        XCTAssertNil(Crypto.parseDiscoveryInfo(legacyInfo), "no device id: never connected to")
        XCTAssertTrue(Crypto.isLegacyDiscoveryInfo(legacyInfo))
        XCTAssertFalse(Crypto.isLegacyDiscoveryInfo(Crypto.discoveryInfo(deviceId: idA, pairingMode: false)))
        XCTAssertNil(PeerInvitation.decode(Data("13657128341829430017".utf8)),
                     "an older build's invitation context (email hash) is declined")
        XCTAssertNil(PeerInvitation.decode(nil), "an invitation without context is declined")
        XCTAssertEqual(PeerInvitation.decode(PeerInvitation(deviceId: idA, mode: .pair).encoded)?.m, .pair)
    }

    func testHandshakeAndDataMessagesDoNotDecodeAsEachOther() throws {
        let hello = try JSONEncoder().encode(PeerHandshakeMessage(hs: .authHello, deviceId: idA,
                                                                 nonce: Crypto.newNonce()))
        XCTAssertThrowsError(try JSONDecoder().decode(PeerMessage.self, from: hello))
        XCTAssertEqual(try JSONDecoder().decode(PeerHandshakeMessage.self, from: hello).hs, .authHello)

        let data = try JSONEncoder().encode(PeerMessage.patients([]))
        XCTAssertThrowsError(try JSONDecoder().decode(PeerHandshakeMessage.self, from: data),
                             "a record message is never mistaken for a handshake message")
    }

    // MARK: - Codes

    func testCodesAreSixDigitsAndInputIsNormalised() {
        for _ in 0..<200 {
            let code = Crypto.generateCode()
            XCTAssertEqual(code.count, 6)
            XCTAssertNotNil(Crypto.normalizedCode(code))
        }
        XCTAssertEqual(Crypto.normalizedCode(" 004 217 "), "004217")
        XCTAssertNil(Crypto.normalizedCode("12345"))
        XCTAssertNil(Crypto.normalizedCode("1234567"))
        XCTAssertNil(Crypto.normalizedCode("12a456"))
        XCTAssertNil(Crypto.normalizedCode("１２３４５６"), "full-width digits are not accepted")
    }
}
