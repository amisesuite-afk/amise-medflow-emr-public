import XCTest
@testable import AmiseMedFlow

/// Sync completeness (pure helpers, no network, no store):
/// 1. Prescription route: local labels ("Oral", "PO/IV") are sent as the lowercase values the
///    server's CHECK constraint allows (PrescriptionRoute).
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
}
