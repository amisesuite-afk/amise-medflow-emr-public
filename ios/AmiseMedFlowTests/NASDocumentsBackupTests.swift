// NASDocumentsBackupTests.swift
// Pure parts of the NAS document backup (Services/NASDocumentBackup.swift): manifest building,
// SHA-256 and the "skip unchanged file" decision, the verification sample, and the additive
// restore plan (never replaces, never resurrects a deleted document, links by patient syncCode).

import XCTest
@testable import AmiseMedFlow

final class NASDocumentsBackupTests: XCTestCase {

    private let day = Date(timeIntervalSince1970: 1_790_000_000)   // whole seconds: survives ISO 8601

    private func snapshot(code: String = "DOC-1", patient: String = "PAT-1",
                          fileName: String = "Referral.pdf", mime: String = "application/pdf",
                          data: Data? = Data("pdf-bytes".utf8)) -> DocumentSnapshot {
        DocumentSnapshot(code: code, patientCode: patient, fileName: fileName, mimeType: mime,
                         category: "Referral", uploadedAt: day, remoteId: nil, storageUrl: nil,
                         aiSummary: nil, extractedText: nil, data: data)
    }

    private func entry(code: String, patient: String = "PAT-1", fileName: String = "Scan.jpg",
                       size: Int = 10, sha: String? = "aa", path: String? = "F/documents/x.jpg",
                       remoteId: String? = nil, uploadedAt: Date? = nil) -> DocumentBackupEntry {
        DocumentBackupEntry(syncCode: code, patientSyncCode: patient, fileName: fileName,
                            mimeType: "image/jpeg", category: nil, uploadedAt: uploadedAt ?? day,
                            remoteId: remoteId, storageUrl: nil, aiSummary: nil, extractedText: nil,
                            size: size, sha256: sha, path: path)
    }

    // MARK: - SHA-256 and naming

    func testSHA256KnownVectors() {
        XCTAssertEqual(NASDocumentBackup.sha256Hex(Data()),
                       "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
        XCTAssertEqual(NASDocumentBackup.sha256Hex(Data("abc".utf8)),
                       "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    }

    func testFileExtensionKeepsPlainExtensionElseUsesMimeType() {
        XCTAssertEqual(NASDocumentBackup.fileExtension(fileName: "Referral.PDF", mimeType: "application/pdf"), "pdf")
        XCTAssertEqual(NASDocumentBackup.fileExtension(fileName: "Photo_Sep 25, 2:30 PM.jpg", mimeType: "image/jpeg"), "jpg")
        XCTAssertEqual(NASDocumentBackup.fileExtension(fileName: "Scan", mimeType: "image/png"), "png")
        XCTAssertEqual(NASDocumentBackup.fileExtension(fileName: "Letter", mimeType: "application/pdf"), "pdf")
        XCTAssertEqual(NASDocumentBackup.fileExtension(fileName: "odd.weird-ext", mimeType: "image/jpeg"), "jpg")
        XCTAssertEqual(NASDocumentBackup.fileExtension(fileName: "blob", mimeType: "application/octet-stream"), "bin")
    }

    func testEntryPathUsesCodeNotOriginalName() {
        let path = NASDocumentBackup.entryPath(folder: "2026-09-25T101010Z", code: "ABC",
                                               fileName: "John Smith referral.pdf", mimeType: "application/pdf")
        XCTAssertEqual(path, "2026-09-25T101010Z/documents/ABC.pdf")
        XCTAssertFalse(path.contains("Smith"))
        XCTAssertEqual(NASDocumentBackup.serverPath(forEntryPath: path),
                       "medflow-backups/2026-09-25T101010Z/documents/ABC.pdf")
        XCTAssertEqual(NASDocumentBackup.folderName(fromDirPath: "medflow-backups/2026-09-25T101010Z"),
                       "2026-09-25T101010Z")
    }

    func testPatientCodeFallsBackToIdLikeFullRecordBackup() {
        let id = UUID()
        XCTAssertEqual(NASDocumentBackup.patientCode(syncCode: "", id: id), id.uuidString)
        XCTAssertEqual(NASDocumentBackup.patientCode(syncCode: "S", id: id), "S")
    }

    // MARK: - Manifest building

    func testEntryFromSnapshotWithAndWithoutFileData() {
        let s = snapshot()
        let e = NASDocumentBackup.entry(for: s, sha256: "hash", path: "F/documents/DOC-1.pdf")
        XCTAssertEqual(e.syncCode, "DOC-1")
        XCTAssertEqual(e.patientSyncCode, "PAT-1")
        XCTAssertEqual(e.fileName, "Referral.pdf")
        XCTAssertEqual(e.size, Data("pdf-bytes".utf8).count)
        XCTAssertEqual(e.sha256, "hash")
        XCTAssertTrue(e.hasFile)

        let metadataOnly = NASDocumentBackup.entry(for: snapshot(data: nil), sha256: "ignored", path: "ignored")
        XCTAssertEqual(metadataOnly.size, 0)
        XCTAssertNil(metadataOnly.sha256)
        XCTAssertNil(metadataOnly.path)
        XCTAssertFalse(metadataOnly.hasFile)
    }

    func testManifestCountsFilesAndBytesAndCompleteness() {
        let a = entry(code: "A", size: 100)
        let b = entry(code: "B", size: 50)
        let noFile = entry(code: "C", size: 0, sha: nil, path: nil)
        let m = NASDocumentBackup.manifest(entries: [a, b, noFile], expectedCount: 3, createdAt: day, failureMessage: nil)
        XCTAssertTrue(m.complete)
        XCTAssertEqual(m.fileCount, 2)
        XCTAssertEqual(m.totalBytes, 150)
        XCTAssertEqual(m.expectedCount, 3)

        // Failure part-way: incomplete even though the saved entries are consistent.
        let failed = NASDocumentBackup.manifest(entries: [a], expectedCount: 3, createdAt: day,
                                                failureMessage: "PUT returned HTTP 507")
        XCTAssertFalse(failed.complete)
        XCTAssertEqual(failed.failureMessage, "PUT returned HTTP 507")

        // Fewer entries than documents on the device is never "complete".
        XCTAssertFalse(NASDocumentBackup.manifest(entries: [a], expectedCount: 2, createdAt: day, failureMessage: nil).complete)
    }

    func testManifestRoundTripsThroughJSON() throws {
        let m = NASDocumentBackup.manifest(entries: [entry(code: "A", remoteId: "r1")], expectedCount: 1,
                                           createdAt: day, failureMessage: nil)
        let data = try NASDocumentBackup.encoder().encode(m)
        let back = try NASDocumentBackup.decoder().decode(DocumentsManifest.self, from: data)
        XCTAssertEqual(back, m)
    }

    func testSummaryRoundTripsWithoutPatientData() throws {
        let s = NASDocumentsSummary(backupPath: "medflow-backups/X", finishedAt: day, complete: false,
                                    expectedCount: 5, documentCount: 3, fileCount: 3, totalBytes: 1_000,
                                    uploadedCount: 1, uploadedBytes: 200, reusedCount: 2, seconds: 4.5,
                                    failureMessage: "timed out")
        let data = try NASDocumentBackup.encoder().encode(s)
        XCTAssertEqual(try NASDocumentBackup.decoder().decode(NASDocumentsSummary.self, from: data), s)
    }

    // MARK: - Skip unchanged files

    func testReusesPreviousCopyOnlyWhenHashAndSizeMatch() {
        let prev = NASDocumentBackup.manifest(
            entries: [entry(code: "A", size: 10, sha: "h1", path: "OLD/documents/A.jpg"),
                      entry(code: "M", size: 0, sha: nil, path: nil)],
            expectedCount: 2, createdAt: day, failureMessage: nil)
        let index = NASDocumentBackup.reusableIndex(prev)
        XCTAssertEqual(Set(index.keys), ["A"], "entries without a file are never reused")

        XCTAssertEqual(NASDocumentBackup.reusablePath(code: "A", sha256: "h1", size: 10, previous: index),
                       "OLD/documents/A.jpg")
        XCTAssertNil(NASDocumentBackup.reusablePath(code: "A", sha256: "h2", size: 10, previous: index),
                     "changed content (e.g. rotated photo) is uploaded again")
        XCTAssertNil(NASDocumentBackup.reusablePath(code: "A", sha256: "h1", size: 11, previous: index))
        XCTAssertNil(NASDocumentBackup.reusablePath(code: "B", sha256: "h1", size: 10, previous: index),
                     "a new document is uploaded")
        XCTAssertTrue(NASDocumentBackup.reusableIndex(nil).isEmpty, "no previous manifest → upload all")
    }

    func testIncompletePreviousManifestStillOffersItsSavedFiles() {
        let prev = NASDocumentBackup.manifest(entries: [entry(code: "A", sha: "h", path: "OLD/documents/A.jpg")],
                                              expectedCount: 4, createdAt: day, failureMessage: "offline")
        XCTAssertFalse(prev.complete)
        XCTAssertEqual(NASDocumentBackup.reusablePath(code: "A", sha256: "h", size: 10,
                                                      previous: NASDocumentBackup.reusableIndex(prev)),
                       "OLD/documents/A.jpg")
    }

    // MARK: - Verification sample

    func testVerifiesAllFilesWhenSmall() {
        let entries = (0..<40).map { entry(code: "D\($0)", size: 1_000) } + [entry(code: "N", sha: nil, path: nil)]
        let sample = NASDocumentBackup.verificationSample(entries)
        XCTAssertEqual(sample.count, 40, "all files, never the entry without a file")
    }

    func testSamplesNewestAndSpreadWhenLarge() {
        let entries = (0..<200).map {
            entry(code: "D\($0)", size: 5_000_000, uploadedAt: day.addingTimeInterval(Double($0)))
        }
        let sample = NASDocumentBackup.verificationSample(entries, allUpToBytes: 100_000_000, sampleSize: 30)
        XCTAssertEqual(sample.count, 30)
        XCTAssertEqual(Set(sample.map(\.syncCode)).count, 30, "no file checked twice")
        XCTAssertTrue(sample.contains { $0.syncCode == "D199" }, "newest file is always checked")
        let indices = sample.compactMap { Int($0.syncCode.dropFirst()) }
        XCTAssertTrue(indices.contains { $0 < 20 }, "the oldest files are covered too")
        XCTAssertEqual(indices.filter { $0 >= 185 }.count, 15, "half the sample is the newest files")
        XCTAssertEqual(sample.map(\.syncCode),
                       NASDocumentBackup.verificationSample(entries, allUpToBytes: 100_000_000, sampleSize: 30).map(\.syncCode),
                       "deterministic")
    }

    // MARK: - Restore plan

    private func plan(_ entries: [DocumentBackupEntry], local: [LocalDocumentInfo] = [],
                      patients: Set<String> = ["PAT-1"], deletedCodes: Set<String> = [],
                      deletedRemoteIds: Set<String> = []) -> [DocumentRestoreAction] {
        NASDocumentBackup.planRestore(entries: entries, local: local, patientCodes: patients,
                                      deletedCodes: deletedCodes, deletedRemoteIds: deletedRemoteIds)
    }

    func testMissingDocumentWithPatientIsInserted() {
        let e = entry(code: "A")
        XCTAssertEqual(plan([e]), [.insert(e)])
    }

    func testExistingDocumentIsNeverReplaced() {
        let e = entry(code: "A")
        let here = LocalDocumentInfo(code: "A", remoteId: nil, patientCode: "PAT-1", fileName: "Other.jpg",
                                     size: 99, sha256: nil)
        XCTAssertEqual(plan([e], local: [here]), [.skipAlreadyHere])
    }

    func testMatchesByServerIdToo() {
        let e = entry(code: "A", remoteId: "row-1")
        let here = LocalDocumentInfo(code: "LOCAL", remoteId: "row-1", patientCode: "PAT-1", fileName: "Scan.jpg",
                                     size: 10, sha256: nil)
        XCTAssertEqual(plan([e], local: [here]), [.skipAlreadyHere])
    }

    func testRecordWithoutFileDataGetsItFilledIn() {
        // Re-created from cloud metadata after a reinstall: same server row, no bytes on the device.
        let e = entry(code: "A", remoteId: "row-1")
        let here = LocalDocumentInfo(code: "CLOUD", remoteId: "row-1", patientCode: "PAT-1", fileName: "Scan.jpg",
                                     size: nil, sha256: nil)
        XCTAssertEqual(plan([e], local: [here]), [.fillMissingData(e, localCode: "CLOUD")])
        // Nothing to fill from a backup entry that has no file either.
        let metadataOnly = self.entry(code: "A", remoteId: "row-1", sha: nil, path: nil)
        XCTAssertEqual(plan([metadataOnly], local: [here]), [.skipAlreadyHere])
    }

    func testDeletedOnThisDeviceIsNotBroughtBack() {
        XCTAssertEqual(plan([entry(code: "A")], deletedCodes: ["A"]), [.skipDeletedHere])
        XCTAssertEqual(plan([entry(code: "B", remoteId: "row-9")], deletedRemoteIds: ["row-9"]), [.skipDeletedHere])
    }

    func testNeedsItsPatientByCode() {
        XCTAssertEqual(plan([entry(code: "A", patient: "PAT-2")]), [.skipNoPatient])
        XCTAssertEqual(plan([entry(code: "A", patient: "")]), [.skipNoPatient], "an unlinked document is not attached to anyone")
    }

    func testEntryWithoutFileIsSkipped() {
        XCTAssertEqual(plan([entry(code: "A", sha: nil, path: nil)]), [.skipNoFile])
    }

    func testSameContentUnderAnotherCodeIsNotAddedTwice() {
        let e = entry(code: "A", fileName: "Scan.jpg", size: 10, sha: "same")
        let dup = LocalDocumentInfo(code: "Z", remoteId: nil, patientCode: "PAT-1", fileName: "Scan.jpg",
                                    size: 10, sha256: "same")
        XCTAssertEqual(plan([e], local: [dup]), [.skipAlreadyHere])
        // Same name and size but different content is a different document.
        let other = LocalDocumentInfo(code: "Z", remoteId: nil, patientCode: "PAT-1", fileName: "Scan.jpg",
                                      size: 10, sha256: "different")
        XCTAssertEqual(plan([e], local: [other]), [.insert(e)])
        // Same content for another patient does not count.
        let otherPatient = LocalDocumentInfo(code: "Z", remoteId: nil, patientCode: "PAT-2", fileName: "Scan.jpg",
                                             size: 10, sha256: "same")
        XCTAssertEqual(plan([e], local: [otherPatient], patients: ["PAT-1", "PAT-2"]), [.insert(e)])
    }

    func testDuplicateCodesInBackupInsertOnce() {
        let e = entry(code: "A")
        XCTAssertEqual(plan([e, e]), [.insert(e), .skipAlreadyHere])
    }

    func testContentKeyNeedsPatientNameAndSize() {
        let k = NASDocumentBackup.contentKey(patientCode: "P", fileName: "a.jpg", size: 1)
        XCTAssertNotEqual(k, NASDocumentBackup.contentKey(patientCode: "P", fileName: "a.jpg", size: 2))
        XCTAssertNotEqual(k, NASDocumentBackup.contentKey(patientCode: "Q", fileName: "a.jpg", size: 1))
        XCTAssertNotEqual(k, NASDocumentBackup.contentKey(patientCode: "P", fileName: "b.jpg", size: 1))
    }

    // MARK: - Incomplete latest backup

    func testRestoreUsesLastCompleteManifestForDocumentsTheIncompleteOneMissed() {
        let a1 = entry(code: "A", sha: "new")
        let latest = NASDocumentBackup.manifest(entries: [a1], expectedCount: 3, createdAt: day, failureMessage: "offline")
        let a0 = entry(code: "A", sha: "old")
        let b0 = entry(code: "B")
        let complete = NASDocumentBackup.manifest(entries: [a0, b0], expectedCount: 2, createdAt: day, failureMessage: nil)
        let merged = NASDocumentBackup.mergedForRestore(latest: latest, lastComplete: complete)
        XCTAssertEqual(merged, [a1, b0], "latest wins; the complete backup fills the gap")

        let completeLatest = NASDocumentBackup.manifest(entries: [a1], expectedCount: 1, createdAt: day, failureMessage: nil)
        XCTAssertEqual(NASDocumentBackup.mergedForRestore(latest: completeLatest, lastComplete: complete), [a1])
        XCTAssertEqual(NASDocumentBackup.mergedForRestore(latest: nil, lastComplete: complete), [a0, b0])
        XCTAssertTrue(NASDocumentBackup.mergedForRestore(latest: nil, lastComplete: nil).isEmpty)
    }
}
