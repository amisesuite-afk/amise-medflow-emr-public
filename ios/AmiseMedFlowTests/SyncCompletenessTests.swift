import XCTest
@testable import AmiseMedFlow

/// Sync completeness (pure helpers, no network, no store):
/// 1. Prescription route: local labels ("Oral", "PO/IV") are sent as the lowercase values the
///    server's CHECK constraint allows (PrescriptionRoute).
/// 2. An UPDATE that RLS filters out returns no row and no error: while the row still exists
///    and the user is signed in, that is a refusal (SyncZeroRowUpdate).
/// 3. The prescription, vitals and billing pulls update an existing clean local row when the
///    server's copy differs (and is newer, where the table has updated_at) (ChildPullMerge).
/// 4. Peer sync compares records by syncCode and stamp, max(updatedAt, syncedAt), so records
///    created or edited offline are sent, and an applied copy is not sent again (PeerVersion,
///    PeerFingerprint); manifests and payloads still interoperate with older builds.
final class SyncCompletenessTests: XCTestCase {

    // MARK: - Prescription route

    func testPickerRoutesMapToAllowedServerValues() {
        let expected: [String: String] = [
            "Oral": "oral", "IV": "iv", "IM": "im", "SC": "sc", "Topical": "topical",
            "Inhaled": "inhaled", "PR": "rectal", "SL": "sublingual",
        ]
        for (label, value) in expected {
            XCTAssertEqual(PrescriptionRoute.serverValue(label), value, label)
        }
    }

    func testEveryMappedValueIsAllowedByTheCheckConstraint() {
        for value in PrescriptionRoute.aliases.values {
            XCTAssertTrue(PrescriptionRoute.serverValues.contains(value), value)
        }
        for value in PrescriptionRoute.serverValues {
            XCTAssertNotNil(PrescriptionRoute.displayLabels[value], "label for \(value)")
            XCTAssertEqual(PrescriptionRoute.serverValue(value), value, "allowed values map to themselves")
        }
    }

    func testFormularyRoutesWithQualifiersMapToTheirRoute() {
        XCTAssertEqual(PrescriptionRoute.serverValue("PO"), "oral")
        XCTAssertEqual(PrescriptionRoute.serverValue("PO (with food, 30 min after meals)"), "oral")
        XCTAssertEqual(PrescriptionRoute.serverValue("IV infusion over 30 min"), "iv")
        XCTAssertEqual(PrescriptionRoute.serverValue("IM (deltoid)"), "im")
        XCTAssertEqual(PrescriptionRoute.serverValue("IM injection (gluteal)"), "im")
        XCTAssertEqual(PrescriptionRoute.serverValue("Deep IM only"), "im")
        XCTAssertEqual(PrescriptionRoute.serverValue("SC only"), "sc")
        XCTAssertEqual(PrescriptionRoute.serverValue("Ophthalmic (topical)"), "ophthalmic")
        XCTAssertEqual(PrescriptionRoute.serverValue("External"), "topical")
        XCTAssertEqual(PrescriptionRoute.serverValue("  oral  "), "oral", "trimmed, any case")
    }

    func testSeveralRoutesAreOneValueOnlyWhenTheyAgree() {
        XCTAssertEqual(PrescriptionRoute.serverValue("IV bolus / continuous infusion"), "iv")
        XCTAssertEqual(PrescriptionRoute.serverValue("Inhaled/nebulised"), "inhaled")
        XCTAssertEqual(PrescriptionRoute.serverValue("PO/IV"), "other")
        XCTAssertEqual(PrescriptionRoute.serverValue("IV/IM"), "other")
        XCTAssertEqual(PrescriptionRoute.serverValue("IM (injected) / PO (oral live)"), "other")
        XCTAssertEqual(PrescriptionRoute.serverValue("Local infiltration/spinal/epidural"), "other")
    }

    func testUnknownRouteIsSentAsOtherAndEmptyIsLeftOut() {
        XCTAssertEqual(PrescriptionRoute.serverValue("Intrathecal"), "other",
                       "never a value the CHECK rejects (23514 kept it pending for ever)")
        XCTAssertNil(PrescriptionRoute.serverValue(""), "left out: the column default applies")
        XCTAssertNil(PrescriptionRoute.serverValue("   "))
        XCTAssertNil(PrescriptionRoute.serverValue(nil))
    }

    func testServerValuesAreShownWithThePickerLabels() {
        XCTAssertEqual(PrescriptionRoute.display(fromServer: "oral"), "Oral")
        XCTAssertEqual(PrescriptionRoute.display(fromServer: "iv"), "IV")
        XCTAssertEqual(PrescriptionRoute.display(fromServer: "rectal"), "PR")
        XCTAssertEqual(PrescriptionRoute.display(fromServer: "per_rectum"), "PR")
        XCTAssertEqual(PrescriptionRoute.display(fromServer: "sublingual"), "SL")
        XCTAssertEqual(PrescriptionRoute.display(fromServer: "Oral"), "Oral", "older rows, any case")
        XCTAssertEqual(PrescriptionRoute.display(fromServer: "buccal"), "buccal", "unknown: as it is")
        XCTAssertNil(PrescriptionRoute.display(fromServer: nil))
    }

    func testLocalLabelMatchesItsServerValue() {
        XCTAssertTrue(PrescriptionRoute.sameRoute(local: "Oral", server: "oral"))
        XCTAssertTrue(PrescriptionRoute.sameRoute(local: "PO/IV", server: "other"),
                      "the local label is kept; the pull does not replace it with \"Other\"")
        XCTAssertTrue(PrescriptionRoute.sameRoute(local: "PR", server: "per_rectum"))
        XCTAssertFalse(PrescriptionRoute.sameRoute(local: "Oral", server: "iv"))
        XCTAssertFalse(PrescriptionRoute.sameRoute(local: "", server: "oral"))
    }

    // MARK: - UPDATE that returned no row

    func testRowReturnedMeansApplied() {
        for exists in [true, false] {
            for signedIn in [true, false] {
                XCTAssertEqual(SyncZeroRowUpdate.outcome(rowsReturned: 1, signedIn: signedIn,
                                                         rowStillExists: exists), .applied)
            }
        }
    }

    func testNoRowWhileTheRowExistsIsARefusal() {
        XCTAssertEqual(SyncZeroRowUpdate.outcome(rowsReturned: 0, signedIn: true, rowStillExists: true),
                       .refused,
                       "e.g. a nurse's prescription edit under doctors_update_prescriptions")
    }

    func testNoRowBecauseTheRowIsGoneIsNotARefusal() {
        XCTAssertEqual(SyncZeroRowUpdate.outcome(rowsReturned: 0, signedIn: true, rowStillExists: false),
                       .rowGone, "deleted on the server: no \"not permitted\" notice")
    }

    func testNoRowWhileSignedOutIsNeverARefusal() {
        for exists in [true, false] {
            XCTAssertEqual(SyncZeroRowUpdate.outcome(rowsReturned: 0, signedIn: false,
                                                     rowStillExists: exists),
                           .retryLater, "requests run as anon: not this user's role")
        }
    }

    // MARK: - Child pulls: merge decision

    private let early = Date(timeIntervalSince1970: 1_750_000_000)
    private var later: Date { early.addingTimeInterval(60) }

    func testRowNotHereIsInserted() {
        XCTAssertEqual(ChildPullMerge.action(hasLocal: false, localPending: false, fieldsDiffer: true,
                                             serverUpdatedAt: nil, localUpdatedAt: nil), .insert)
    }

    func testPendingLocalRowIsNeverOverwritten() {
        for server in [nil, later] as [Date?] {
            XCTAssertEqual(ChildPullMerge.action(hasLocal: true, localPending: true, fieldsDiffer: true,
                                                 serverUpdatedAt: server, localUpdatedAt: early),
                           .keepLocal, "pull protection: unsent local changes win")
        }
    }

    func testNewerServerRowUpdatesACleanLocalRow() {
        XCTAssertEqual(ChildPullMerge.action(hasLocal: true, localPending: false, fieldsDiffer: true,
                                             serverUpdatedAt: later, localUpdatedAt: early), .update,
                       "a prescription edited on the web reaches this device")
    }

    func testOlderOrSameServerRowIsNotApplied() {
        XCTAssertEqual(ChildPullMerge.action(hasLocal: true, localPending: false, fieldsDiffer: true,
                                             serverUpdatedAt: early, localUpdatedAt: later), .keepLocal)
        XCTAssertEqual(ChildPullMerge.action(hasLocal: true, localPending: false, fieldsDiffer: true,
                                             serverUpdatedAt: early, localUpdatedAt: early), .keepLocal)
    }

    func testTableWithoutUpdatedAtComparesTheValues() {
        XCTAssertEqual(ChildPullMerge.action(hasLocal: true, localPending: false, fieldsDiffer: true,
                                             serverUpdatedAt: nil, localUpdatedAt: later), .update,
                       "vitals and billing: a clean local row takes the server's values")
        XCTAssertEqual(ChildPullMerge.action(hasLocal: true, localPending: false, fieldsDiffer: false,
                                             serverUpdatedAt: nil, localUpdatedAt: early), .keepLocal,
                       "same values: nothing to write")
    }

    func testLocalRowFromBeforeUpdatedAtTakesADifferentServerRow() {
        XCTAssertEqual(ChildPullMerge.action(hasLocal: true, localPending: false, fieldsDiffer: true,
                                             serverUpdatedAt: early, localUpdatedAt: nil), .update)
    }

    func testSameValuesAreNeverRewrittenEvenWhenTheServerIsNewer() {
        XCTAssertEqual(ChildPullMerge.action(hasLocal: true, localPending: false, fieldsDiffer: false,
                                             serverUpdatedAt: later, localUpdatedAt: early), .keepLocal)
    }

    func testValueComparisons() {
        XCTAssertTrue(ChildPullMerge.sameInstant(early, early.addingTimeInterval(0.4)),
                      "sent without fractions, read back truncated")
        XCTAssertFalse(ChildPullMerge.sameInstant(early, early.addingTimeInterval(2)))
        XCTAssertTrue(ChildPullMerge.same(37.9, 37.9))
        XCTAssertTrue(ChildPullMerge.same(nil as Double?, nil))
        XCTAssertFalse(ChildPullMerge.same(37.9, nil))
        XCTAssertFalse(ChildPullMerge.same(37.9, 38.0))
        XCTAssertTrue(ChildPullMerge.same(nil as String?, ""), "nil and empty text are the same")
        XCTAssertFalse(ChildPullMerge.same("With food", nil))
    }

    func testServerTimestampsWithAndWithoutFractions() {
        XCTAssertEqual(SyncTimestamp.parse("2025-06-15T15:06:40+00:00"), early)
        XCTAssertEqual(SyncTimestamp.parse("2025-06-15T15:06:40Z"), early)
        let micro = SyncTimestamp.parse("2025-06-15T15:06:40.123456+00:00")
        XCTAssertNotNil(micro, "Postgres now() has microseconds")
        XCTAssertEqual(micro?.timeIntervalSince1970 ?? 0, early.timeIntervalSince1970, accuracy: 0.2)
        XCTAssertNil(SyncTimestamp.parse(nil))
        XCTAssertNil(SyncTimestamp.parse(""))
        XCTAssertNil(SyncTimestamp.parse("not a date"))
    }

    // MARK: - Peer manifest: stamps

    private var synced: Date { early }
    private var edited: Date { early.addingTimeInterval(600) }

    func testStampIsTheLaterOfEditAndCloudSync() {
        XCTAssertEqual(PeerVersion.stamp(updatedAt: edited, syncedAt: synced), edited.timeIntervalSince1970)
        XCTAssertEqual(PeerVersion.stamp(updatedAt: synced, syncedAt: edited), edited.timeIntervalSince1970)
        XCTAssertEqual(PeerVersion.stamp(updatedAt: edited, syncedAt: nil), edited.timeIntervalSince1970,
                       "never uploaded: its edit time, not year 1")
        XCTAssertEqual(PeerVersion.stamp(peerUpdatedAt: 20, peerSyncedAt: 10), 20)
        XCTAssertNil(PeerVersion.stamp(peerUpdatedAt: nil, peerSyncedAt: 10), "older build")
    }

    // MARK: - Peer manifest: what is sent

    private func sends(local: Double, synced: Double = 0, peer: Double?, peerSynced: Double? = nil,
                      stamps: Bool = true) -> Bool {
        PeerVersion.shouldSend(localStamp: local, localSynced: synced, peerStamp: peer,
                               peerSynced: peerSynced, peerSendsStamps: stamps)
    }

    func testRecordCreatedOfflineIsSent() {
        let stamp = PeerVersion.stamp(updatedAt: edited, syncedAt: nil)
        let neverSynced = PeerVersion.epoch(nil)
        XCTAssertTrue(sends(local: stamp, synced: neverSynced, peer: nil), "the peer does not have it")
        XCTAssertTrue(sends(local: stamp, synced: neverSynced, peer: nil, peerSynced: nil, stamps: false),
                      "an older build that does not have it gets it too")
    }

    func testEditSinceTheLastCloudSyncIsSent() {
        let peerCopy = PeerVersion.stamp(updatedAt: synced, syncedAt: synced)
        let mine = PeerVersion.stamp(updatedAt: edited, syncedAt: synced)
        XCTAssertTrue(sends(local: mine, synced: synced.timeIntervalSince1970, peer: peerCopy),
                      "syncedAt did not move, the edit time did")
        XCTAssertFalse(sends(local: peerCopy, peer: mine), "the peer's copy is the newer one")
    }

    func testUnchangedRecordIsNeverSent() {
        let stamp = edited.timeIntervalSince1970
        XCTAssertFalse(sends(local: stamp, peer: stamp))
        XCTAssertFalse(sends(local: stamp + PeerVersion.tolerance / 2, peer: stamp),
                       "Date round trip rounding is not a newer change")
    }

    func testOlderBuildsManifestUsesCloudSyncTimes() {
        XCTAssertTrue(sends(local: 0, synced: 20, peer: nil, peerSynced: 10, stamps: false))
        XCTAssertFalse(sends(local: 99, synced: 10, peer: nil, peerSynced: 10, stamps: false),
                       "previous rule for a record it has: newer cloud sync only")
    }

    func testPatientDeletedHereIsNeverSentBack() {
        XCTAssertFalse(sends(local: Date.now.timeIntervalSince1970, peer: PeerVersion.deletedHere))
        XCTAssertFalse(sends(local: 0, synced: Date.now.timeIntervalSince1970, peer: nil,
                            peerSynced: PeerVersion.deletedHere, stamps: false),
                       "older builds compare the syncedAt map, which holds the same stamp")
    }

    // MARK: - Peer apply: which copy wins

    func testUnsentLocalEditLosesOnlyToALaterEdit() {
        // The peer synced more recently but its copy does not hold this device's edit.
        XCTAssertFalse(PeerVersion.remoteIsNewer(localUpdated: edited, localSynced: synced, localPending: true,
                                                 peerUpdated: synced.timeIntervalSince1970,
                                                 peerSynced: edited.addingTimeInterval(60).timeIntervalSince1970))
        XCTAssertTrue(PeerVersion.remoteIsNewer(localUpdated: synced, localSynced: synced, localPending: true,
                                                peerUpdated: edited.timeIntervalSince1970,
                                                peerSynced: synced.timeIntervalSince1970))
    }

    func testCleanLocalCopyComparesStamps() {
        XCTAssertTrue(PeerVersion.remoteIsNewer(localUpdated: synced, localSynced: synced, localPending: false,
                                                peerUpdated: synced.timeIntervalSince1970,
                                                peerSynced: edited.timeIntervalSince1970),
                      "synced more recently: the fresher cloud copy")
        XCTAssertFalse(PeerVersion.remoteIsNewer(localUpdated: edited, localSynced: synced, localPending: false,
                                                 peerUpdated: edited.timeIntervalSince1970,
                                                 peerSynced: synced.timeIntervalSince1970),
                       "same stamp: this copy stays")
    }

    func testOlderBuildsPayloadIsMergedBySyncTime() {
        XCTAssertTrue(PeerVersion.remoteIsNewer(localUpdated: edited, localSynced: synced, localPending: true,
                                                peerUpdated: nil, peerSynced: edited.timeIntervalSince1970))
        XCTAssertFalse(PeerVersion.remoteIsNewer(localUpdated: synced, localSynced: edited, localPending: false,
                                                 peerUpdated: nil, peerSynced: synced.timeIntervalSince1970))
    }

    // MARK: - Peer apply: loop control

    func testAppliedCopyIsNotSentAgain() {
        // B sends its newer copy; A applies it and nothing is left to send either way.
        let bStamp = edited.timeIntervalSince1970
        let aSynced = PeerVersion.syncedAtAfterApply(localUpdated: synced, localSynced: synced,
                                                     peerStamp: bStamp, sendBack: false)
        let aStamp = PeerVersion.stamp(updatedAt: synced, syncedAt: aSynced)
        XCTAssertFalse(sends(local: bStamp, peer: aStamp), "B does not send it again")
        XCTAssertFalse(sends(local: aStamp, peer: bStamp), "A does not echo it back")
    }

    func testMergedCopyGoesBackAndThenSettles() {
        // A keeps its own newer edit (the peer's copy lost) and differs: it must go back to B.
        let bStamp = edited.timeIntervalSince1970
        XCTAssertTrue(PeerVersion.sendsBack(differsFromPeer: true, contentChanged: false, remoteIsNewer: false))
        let aSynced = PeerVersion.syncedAtAfterApply(localUpdated: synced, localSynced: synced,
                                                     peerStamp: bStamp, sendBack: true)
        let aStamp = PeerVersion.stamp(updatedAt: synced, syncedAt: aSynced)
        XCTAssertTrue(sends(local: aStamp, peer: bStamp), "A's copy goes back to B")

        // B takes it: its content changed, so updatedAt is bumped (in-flight push guard) and its
        // copy, now the same as A's, goes back to A once.
        XCTAssertFalse(PeerVersion.sendsBack(differsFromPeer: false, contentChanged: true, remoteIsNewer: true))
        let bNow = edited.addingTimeInterval(30)
        let bSynced = PeerVersion.syncedAtAfterApply(localUpdated: bNow, localSynced: synced,
                                                     peerStamp: aStamp, sendBack: false)
        let bStamp2 = PeerVersion.stamp(updatedAt: bNow, syncedAt: bSynced)
        XCTAssertTrue(sends(local: bStamp2, peer: aStamp))

        // A applies it: nothing changes, nothing differs; it adopts B's stamp. Settled.
        XCTAssertFalse(PeerVersion.sendsBack(differsFromPeer: false, contentChanged: false, remoteIsNewer: true))
        let aSynced2 = PeerVersion.syncedAtAfterApply(localUpdated: synced, localSynced: aSynced,
                                                      peerStamp: bStamp2, sendBack: false)
        let aStamp2 = PeerVersion.stamp(updatedAt: synced, syncedAt: aSynced2)
        XCTAssertFalse(sends(local: aStamp2, peer: bStamp2))
        XCTAssertFalse(sends(local: bStamp2, peer: aStamp2))
    }

    func testCopyThatLostAndDidNotChangeIsNotSentBack() {
        XCTAssertFalse(PeerVersion.sendsBack(differsFromPeer: true, contentChanged: false, remoteIsNewer: true),
                       "the peer's rules keep its values: sending it back would repeat for ever")
        XCTAssertFalse(PeerVersion.sendsBack(differsFromPeer: false, contentChanged: false, remoteIsNewer: false))
    }

    func testSyncedAtNeverMovesBack() {
        let later = edited.addingTimeInterval(3600)
        let result = PeerVersion.syncedAtAfterApply(localUpdated: synced, localSynced: later,
                                                    peerStamp: edited.timeIntervalSince1970, sendBack: false)
        XCTAssertEqual(result.timeIntervalSince1970, later.timeIntervalSince1970, accuracy: 0.000_1)
    }

    func testChangedCopyAlreadyAboveThePeerKeepsItsSyncTime() {
        let now = edited.addingTimeInterval(60)
        let result = PeerVersion.syncedAtAfterApply(localUpdated: now, localSynced: synced,
                                                    peerStamp: edited.timeIntervalSince1970, sendBack: true)
        XCTAssertEqual(result.timeIntervalSince1970, edited.timeIntervalSince1970, accuracy: 0.000_1,
                       "updatedAt (just bumped) already sends it back; syncedAt only adopts")
    }

    // MARK: - Peer payloads: fingerprints and older builds

    private func prescription(_ fields: [String: Any]) throws -> PeerPrescription {
        var object: [String: Any] = [
            "syncCode": "rx-1", "patientSyncCode": "pt-1", "drug": "Co-amoxiclav",
            "dose": "625 mg", "route": "Oral", "prescribedAt": 1_750_000_000.0, "syncedAt": 0.0,
        ]
        for (key, value) in fields { object[key] = value }
        return try JSONDecoder().decode(PeerPrescription.self,
                                        from: JSONSerialization.data(withJSONObject: object))
    }

    func testFingerprintIgnoresBookkeepingAndDateRounding() throws {
        let a = try prescription(["remoteId": "x", "pendingSync": true, "updatedAt": 5.0, "syncedAt": 1.0])
        let b = try prescription(["prescribedAt": 1_750_000_000.000_01, "patientSyncCode": "pt-2",
                                  "syncedAt": 9.0])
        XCTAssertFalse(PeerFingerprint.differ(PeerFingerprint.of(a), PeerFingerprint.of(b)))
        let c = try prescription(["dose": "1.2 g"])
        XCTAssertTrue(PeerFingerprint.differ(PeerFingerprint.of(a), PeerFingerprint.of(c)))
        XCTAssertTrue(PeerFingerprint.differ(nil, PeerFingerprint.of(a)), "unknown counts as different")
    }

    func testPayloadWithoutUpdatedAtDecodes() throws {
        let rx = try prescription([:])
        XCTAssertNil(rx.updatedAt, "older build: merged by syncedAt")
        XCTAssertNil(rx.pendingSync)
    }

    /// The fields an older build's PeerManifest has.
    private struct OlderManifest: Decodable {
        let emailHash: String
        let patients, notes, prescriptions, vitals, billingItems: [String: Double]
    }

    func testManifestInteroperatesWithOlderBuilds() throws {
        let manifest = PeerManifest(emailHash: "h", patients: ["p": 1], notes: [:], prescriptions: [:],
                                    vitals: [:], billingItems: [:],
                                    patientStamps: ["p": 2], noteStamps: [:], prescriptionStamps: [:],
                                    vitalsStamps: [:], billingStamps: [:])
        let data = try JSONEncoder().encode(manifest)
        let older = try JSONDecoder().decode(OlderManifest.self, from: data)
        XCTAssertEqual(older.patients["p"], 1, "an older build reads the syncedAt maps and ignores the rest")

        let fromOlder = try JSONSerialization.data(withJSONObject: [
            "emailHash": "h", "patients": ["p": 1.0], "notes": [String: Double](),
            "prescriptions": [String: Double](), "vitals": [String: Double](),
            "billingItems": [String: Double](),
        ] as [String: Any])
        let decoded = try JSONDecoder().decode(PeerManifest.self, from: fromOlder)
        XCTAssertNil(decoded.patientStamps, "no stamps: the older rule applies (shouldSend)")
        XCTAssertEqual(decoded.patients["p"], 1)
    }
}
