import XCTest
@testable import AmiseMedFlow

/// Sync completeness (pure helpers, no network, no store):
/// 1. Prescription route: local labels ("Oral", "PO/IV") are sent as the lowercase values the
///    server's CHECK constraint allows (PrescriptionRoute).
/// 2. An UPDATE that RLS filters out returns no row and no error: while the row still exists
///    and the user is signed in, that is a refusal (SyncZeroRowUpdate).
/// 3. The prescription, vitals and billing pulls update an existing clean local row when the
///    server's copy differs (and is newer, where the table has updated_at) (ChildPullMerge).
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
}
