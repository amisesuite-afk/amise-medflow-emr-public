// SyncPendingReasonTests.swift
// Why a record stays pending (SyncPendingClassifier, SyncPendingReasons.swift).

import XCTest
@testable import AmiseMedFlow

final class SyncPendingReasonTests: XCTestCase {

    private let serverId = "3f2504e0-4f89-11d3-9a0c-0305e82c3301"

    private func reason(refused: Bool = false, logged: SyncPendingReason? = nil,
                        ownId: String? = nil, isChild: Bool = true,
                        patientRemoteId: String? = "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
                        isEmpty: Bool = false) -> SyncPendingReason {
        SyncPendingClassifier.reason(refused: refused, logged: logged,
                                     ownId: SyncRemoteId.kind(ownId), isChild: isChild,
                                     patientRemoteId: patientRemoteId, isEmpty: isEmpty)
    }

    func testRefusalWinsOverEverything() {
        XCTAssertEqual(reason(refused: true, logged: .serverRowMissing, patientRemoteId: nil, isEmpty: true),
                       .refused)
    }

    func testLoggedReasonFromLastSync() {
        XCTAssertEqual(reason(logged: .serverRowMissing, ownId: serverId), .serverRowMissing)
        XCTAssertEqual(reason(logged: .sendFailed), .sendFailed)
    }

    func testChildWaitsForItsPatient() {
        XCTAssertEqual(reason(patientRemoteId: nil), .waitingForPatient)
        XCTAssertEqual(reason(patientRemoteId: "appt:abc"), .patientIsBooking)
        XCTAssertEqual(reason(patientRemoteId: "not-a-uuid"), .waitingForPatient)
    }

    func testPlaceholderOrMalformedOwnIdIsNeverSent() {
        XCTAssertEqual(reason(ownId: "appt:abc"), .invalidId)
        XCTAssertEqual(reason(ownId: "garbage"), .invalidId)
        XCTAssertEqual(reason(ownId: "garbage", isChild: false, patientRemoteId: nil), .invalidId)
    }

    func testEmptyRecordHasNothingToSend() {
        XCTAssertEqual(reason(isEmpty: true), .nothingToSend)
    }

    func testOtherwiseWaitsForNextSync() {
        XCTAssertEqual(reason(), .waiting)
        XCTAssertEqual(reason(ownId: serverId), .waiting)
        // A patient booking placeholder is sent by pushPendingPatients: it waits, it is not invalid.
        XCTAssertEqual(reason(ownId: "appt:abc", isChild: false, patientRemoteId: nil), .waiting)
    }
}
