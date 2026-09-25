import XCTest
@testable import AmiseMedFlow

/// Report PDFs shared to MedFlow from another app (IncomingReportStaging): staged-file naming,
/// PDF type and size checks, and the 7-day clean-up decision. Pure helpers only; no files.
final class IncomingReportStagingTests: XCTestCase {

    private let pdfHeader = Data("%PDF-1.7\n%âãÏÓ\n1 0 obj".utf8)
    /// 21 Sep 2026 14:13:20 UTC.
    private let received = Date(timeIntervalSince1970: 1_790_000_000)
    private let id = UUID(uuidString: "6F9619FF-8B86-D011-B42D-00C04FC964FF")!

    // MARK: - Naming

    func testStagedFileNameCarriesTimeAndIdAndASafeName() throws {
        let name = IncomingReportStaging.stagedFileName(receivedAt: received, id: id,
                                                        originalName: "DOE JANE/CBC (final).pdf")
        XCTAssertEqual(name, "20260921T141320Z_6F9619FF-8B86-D011-B42D-00C04FC964FF_DOE_JANE_CBC_final.pdf")
        XCTAssertFalse(name.contains("/"))
        XCTAssertFalse(name.contains(" "))

        let parsed = try XCTUnwrap(IncomingReportStaging.parseStagedFileName(name))
        XCTAssertEqual(parsed.receivedAt, received)
        XCTAssertEqual(parsed.id, id)
        XCTAssertEqual(parsed.displayName, "DOE_JANE_CBC_final")
    }

    func testDisplayNameSanitising() {
        XCTAssertEqual(IncomingReportStaging.sanitisedDisplayName("../../etc/passwd.pdf"), "etc_passwd")
        XCTAssertEqual(IncomingReportStaging.sanitisedDisplayName("###.pdf"), "report")
        XCTAssertEqual(IncomingReportStaging.sanitisedDisplayName("R\u{00E9}sultat \u{00E9}t\u{00E9}.pdf"), "R_sultat_t")
        XCTAssertEqual(IncomingReportStaging.sanitisedDisplayName(String(repeating: "a", count: 200) + ".pdf").count, 60)
        XCTAssertEqual(IncomingReportStaging.sanitisedDisplayName("LS-24-018832_results.PDF"), "LS-24-018832_results")
    }

    func testForeignNamesAreNotStagedFiles() {
        XCTAssertNil(IncomingReportStaging.parseStagedFileName("report.pdf"))
        XCTAssertNil(IncomingReportStaging.parseStagedFileName("20260921T141320Z_not-a-uuid_x.pdf"))
        XCTAssertNil(IncomingReportStaging.parseStagedFileName("20260921T141320Z_6F9619FF-8B86-D011-B42D-00C04FC964FF_x.txt"))
        XCTAssertNil(IncomingReportStaging.parseStagedFileName(".DS_Store"))
    }

    // MARK: - Type and size

    func testOnlyRealPDFsWithinTheLimitAreAccepted() {
        XCTAssertNil(IncomingReportStaging.validate(fileName: "result.pdf", byteCount: 52_000, header: pdfHeader))
        XCTAssertNil(IncomingReportStaging.validate(fileName: "RESULT.PDF", byteCount: 52_000, header: pdfHeader))
        // Some writers put a few bytes before the marker (allowed within the first 1024 bytes).
        XCTAssertNil(IncomingReportStaging.validate(fileName: "result.pdf", byteCount: 52_000,
                                                    header: Data([0xEF, 0xBB, 0xBF]) + pdfHeader))

        XCTAssertEqual(IncomingReportStaging.validate(fileName: "result.pdf", byteCount: 52_000,
                                                      header: Data("<html><body>".utf8)), .notPDF)
        XCTAssertEqual(IncomingReportStaging.validate(fileName: "photo.jpg", byteCount: 52_000, header: pdfHeader), .notPDF)
        XCTAssertEqual(IncomingReportStaging.validate(fileName: "result.pdf", byteCount: 0, header: Data()), .empty)
        let tooBig = IncomingReportStaging.maxBytes + 1
        XCTAssertEqual(IncomingReportStaging.validate(fileName: "result.pdf", byteCount: tooBig, header: pdfHeader),
                       .tooLarge(bytes: tooBig))
        XCTAssertNil(IncomingReportStaging.validate(fileName: "result.pdf", byteCount: IncomingReportStaging.maxBytes,
                                                    header: pdfHeader))
        // Marker beyond the first 1024 bytes is not a PDF header.
        XCTAssertFalse(IncomingReportStaging.looksLikePDF(header: Data(repeating: 0x20, count: 1024) + pdfHeader))
    }

    // MARK: - Clean-up

    func testStaleFilesAreRemovedAfterSevenDays() {
        let day: TimeInterval = 86_400
        XCTAssertFalse(IncomingReportStaging.isStale(receivedAt: received, now: received.addingTimeInterval(7 * day)))
        XCTAssertTrue(IncomingReportStaging.isStale(receivedAt: received, now: received.addingTimeInterval(7 * day + 1)))

        let fresh = IncomingReportStaging.stagedFileName(receivedAt: received.addingTimeInterval(6 * day), id: UUID(),
                                                         originalName: "a.pdf")
        let old = IncomingReportStaging.stagedFileName(receivedAt: received, id: UUID(), originalName: "b.pdf")
        let now = received.addingTimeInterval(8 * day)
        let remove = IncomingReportStaging.filesToRemove(in: [fresh, old, "stray.tmp"], now: now)
        XCTAssertEqual(Set(remove), [old, "stray.tmp"])
    }

    func testOldInboxLeftoversAreRemoved() {
        let now = received.addingTimeInterval(30 * 86_400)
        let files: [(name: String, modified: Date?)] = [
            ("new.pdf", now.addingTimeInterval(-3600)),
            ("old.pdf", received),
            ("unknown.pdf", nil),
        ]
        XCTAssertEqual(Set(IncomingReportStaging.inboxFilesToRemove(files, now: now)), ["old.pdf", "unknown.pdf"])
    }
}
