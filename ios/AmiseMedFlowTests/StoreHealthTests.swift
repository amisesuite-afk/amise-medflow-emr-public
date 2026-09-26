// StoreHealthTests.swift
// The store-open decision logic and file helpers in Services/StoreHealth.swift:
// the store is never deleted, only retried, moved aside (with -wal/-shm) or left untouched,
// and the in-memory fallback is the last resort.

import XCTest
@testable import AmiseMedFlow

final class StoreHealthTests: XCTestCase {

    private struct Fail: Error {}
    private let openError = NSError(domain: "TestStoreDomain", code: 134110)
    private let epoch = Date(timeIntervalSince1970: 0)

    // MARK: - Names

    func testTimestampIsUTCAndSortable() {
        XCTAssertEqual(StoreRecovery.timestamp(epoch), "19700101-000000Z")
        XCTAssertEqual(StoreRecovery.timestamp(Date(timeIntervalSince1970: 1_790_000_000)), "20260921-141320Z")
        let earlier = StoreRecovery.timestamp(Date(timeIntervalSince1970: 1_000))
        let later = StoreRecovery.timestamp(Date(timeIntervalSince1970: 2_000_000))
        XCTAssertLessThan(earlier, later)
    }

    func testBackupFileNameKeepsExtensionAndAddsStamp() {
        XCTAssertEqual(StoreRecovery.backupFileName(forStoreFileName: "default.store", at: epoch),
                       "default-moved-aside-19700101-000000Z.store")
        XCTAssertEqual(StoreRecovery.backupFileName(forStoreFileName: "default.store", at: epoch, attempt: 2),
                       "default-moved-aside-19700101-000000Z-2.store")
        XCTAssertEqual(StoreRecovery.backupFileName(forStoreFileName: "medflow", at: epoch),
                       "medflow-moved-aside-19700101-000000Z")
    }

    func testUniqueBackupFileNameSkipsTakenNamesIncludingCompanions() {
        let first = "default-moved-aside-19700101-000000Z.store"
        let second = "default-moved-aside-19700101-000000Z-2.store"
        let third = "default-moved-aside-19700101-000000Z-3.store"

        XCTAssertEqual(StoreRecovery.uniqueBackupFileName(forStoreFileName: "default.store", at: epoch) { _ in false },
                       first)
        XCTAssertEqual(StoreRecovery.uniqueBackupFileName(forStoreFileName: "default.store", at: epoch) { $0 == first },
                       second)
        // A leftover -wal with the same name must not be overwritten either.
        XCTAssertEqual(StoreRecovery.uniqueBackupFileName(forStoreFileName: "default.store", at: epoch) {
            $0 == first + "-wal" || $0 == second + "-shm"
        }, third)
    }

    func testBackupFileNamesListsMovedAsideAndLegacyCopiesOnly() {
        let listing = [
            "default.store", "default.store-wal", "default.store-shm",
            "default-moved-aside-20260101-000000Z.store",
            "default-moved-aside-20260101-000000Z.store-wal",
            "default-moved-aside-20260101-000000Z.store-shm",
            "default-moved-aside-20260301-000000Z.store",
            "medflow-backup-1700000000.store",
            "audit-queue.json",
            "other-moved-aside-20260101-000000Z.store",
        ]
        XCTAssertEqual(StoreRecovery.backupFileNames(in: listing, storeFileName: "default.store"), [
            "medflow-backup-1700000000.store",
            "default-moved-aside-20260301-000000Z.store",
            "default-moved-aside-20260101-000000Z.store",
        ])
        XCTAssertEqual(StoreRecovery.backupFileNames(in: ["default.store"], storeFileName: "default.store"), [])
    }

    // MARK: - Decision logic

    func testOpensOnDiskFirstTime() {
        var moves = 0, memory = 0
        let outcome = StoreRecovery.open(
            openOnDisk: { () throws -> Int in 1 },
            storeFileState: { .readable },
            moveAside: { () throws -> String in moves += 1; return "x" },
            openInMemory: { () throws -> Int in memory += 1; return 2 })
        XCTAssertEqual(outcome.container, 1)
        XCTAssertEqual(outcome.status, .onDisk)
        XCTAssertTrue(outcome.failures.isEmpty)
        XCTAssertEqual(moves, 0)
        XCTAssertEqual(memory, 0)
    }

    func testRetriesTheUntouchedFileBeforeMovingIt() {
        var opens = 0, moves = 0
        let outcome = StoreRecovery.open(
            openOnDisk: { () throws -> Int in
                opens += 1
                if opens == 1 { throw self.openError }
                return 1
            },
            storeFileState: { .readable },
            moveAside: { () throws -> String in moves += 1; return "x" },
            openInMemory: { () throws -> Int in 2 })
        XCTAssertEqual(outcome.container, 1)
        XCTAssertEqual(outcome.status, .onDisk)
        XCTAssertEqual(opens, 2)
        XCTAssertEqual(moves, 0)
        XCTAssertEqual(outcome.failures, [StoreOpenFailure(stage: .open, domain: "TestStoreDomain", code: 134110)])
    }

    func testMovesAsideThenOpensFreshStoreOnce() {
        var opens = 0, memory = 0
        let outcome = StoreRecovery.open(
            openOnDisk: { () throws -> Int in
                opens += 1
                if opens <= 2 { throw self.openError }
                return 3
            },
            storeFileState: { .readable },
            moveAside: { () throws -> String in "default-moved-aside-19700101-000000Z.store" },
            openInMemory: { () throws -> Int in memory += 1; return 2 })
        XCTAssertEqual(outcome.container, 3)
        XCTAssertEqual(outcome.status, .onDiskAfterMoveAside(backupName: "default-moved-aside-19700101-000000Z.store"))
        XCTAssertEqual(outcome.failures.map(\.stage), [.open, .retry])
        XCTAssertEqual(opens, 3)
        XCTAssertEqual(memory, 0)
    }

    func testFallsBackToMemoryWhenFreshStoreAlsoFails() {
        var opens = 0
        let outcome = StoreRecovery.open(
            openOnDisk: { () throws -> Int in opens += 1; throw self.openError },
            storeFileState: { .readable },
            moveAside: { () throws -> String in "moved.store" },
            openInMemory: { () throws -> Int in 2 })
        XCTAssertEqual(outcome.container, 2)
        XCTAssertEqual(outcome.status, .inMemoryFallback)
        XCTAssertEqual(outcome.failures.map(\.stage), [.open, .retry, .openFresh])
        XCTAssertEqual(opens, 3, "one retry after the move, no more")
    }

    func testUnreadableOrMissingStoreIsNeverMoved() {
        for state in [StoreFileState.unreadable, .missing] {
            var moves = 0, opens = 0
            let outcome = StoreRecovery.open(
                openOnDisk: { () throws -> Int in opens += 1; throw self.openError },
                storeFileState: { state },
                moveAside: { () throws -> String in moves += 1; return "x" },
                openInMemory: { () throws -> Int in 2 })
            XCTAssertEqual(outcome.status, .inMemoryFallback, "\(state)")
            XCTAssertEqual(moves, 0, "\(state)")
            XCTAssertEqual(opens, 2, "\(state)")
            XCTAssertEqual(outcome.failures.map(\.stage), [.open, .retry], "\(state)")
        }
    }

    func testFailedMoveGoesStraightToMemoryWithoutOpeningAgain() {
        var opens = 0
        let outcome = StoreRecovery.open(
            openOnDisk: { () throws -> Int in opens += 1; throw self.openError },
            storeFileState: { .readable },
            moveAside: { () throws -> String in throw Fail() },
            openInMemory: { () throws -> Int in 2 })
        XCTAssertEqual(outcome.status, .inMemoryFallback)
        XCTAssertEqual(outcome.container, 2)
        XCTAssertEqual(opens, 2)
        XCTAssertEqual(outcome.failures.map(\.stage), [.open, .retry, .moveAside])
    }

    func testNoContainerWhenEvenMemoryFails() {
        let outcome = StoreRecovery.open(
            openOnDisk: { () throws -> Int in throw self.openError },
            storeFileState: { .missing },
            moveAside: { () throws -> String in "x" },
            openInMemory: { () throws -> Int in throw self.openError })
        XCTAssertNil(outcome.container)
        XCTAssertEqual(outcome.status, .inMemoryFallback)
        XCTAssertEqual(outcome.failures.map(\.stage), [.open, .retry, .openInMemory])
    }

    func testFailureKeepsOnlyDomainAndCode() {
        let error = NSError(domain: "SwiftData.SwiftDataError", code: 1,
                            userInfo: [NSFilePathErrorKey: "/private/var/mobile/…/default.store",
                                       NSLocalizedDescriptionKey: "some text"])
        let failure = StoreOpenFailure(stage: .open, error: error)
        XCTAssertEqual(failure, StoreOpenFailure(stage: .open, domain: "SwiftData.SwiftDataError", code: 1))
    }

    // MARK: - File operations (temporary directory)

    private var dir: URL!

    override func setUpWithError() throws {
        try super.setUpWithError()
        dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("StoreHealthTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
        dir = nil
        try super.tearDownWithError()
    }

    private func write(_ name: String, _ text: String) throws {
        try Data(text.utf8).write(to: dir.appendingPathComponent(name))
    }

    private func read(_ name: String) throws -> String {
        String(decoding: try Data(contentsOf: dir.appendingPathComponent(name)), as: UTF8.self)
    }

    func testFileState() throws {
        let store = dir.appendingPathComponent("default.store")
        XCTAssertEqual(StoreRecovery.fileState(at: store), .missing)
        try write("default.store", "SQLite format 3")
        XCTAssertEqual(StoreRecovery.fileState(at: store), .readable)
    }

    func testMoveStoreAsideMovesStoreWithCompanionsAndDeletesNothing() throws {
        try write("default.store", "main")
        try write("default.store-wal", "wal")
        try write("default.store-shm", "shm")
        let store = dir.appendingPathComponent("default.store")

        let name = try StoreRecovery.moveStoreAside(storeURL: store, at: epoch)

        XCTAssertEqual(name, "default-moved-aside-19700101-000000Z.store")
        XCTAssertEqual(try read(name), "main")
        XCTAssertEqual(try read(name + "-wal"), "wal")
        XCTAssertEqual(try read(name + "-shm"), "shm")
        let fm = FileManager.default
        XCTAssertFalse(fm.fileExists(atPath: store.path))
        XCTAssertFalse(fm.fileExists(atPath: store.path + "-wal"))
        XCTAssertFalse(fm.fileExists(atPath: store.path + "-shm"))

        // A second failure in the same second never overwrites the first copy.
        try write("default.store", "main 2")
        let second = try StoreRecovery.moveStoreAside(storeURL: store, at: epoch)
        XCTAssertEqual(second, "default-moved-aside-19700101-000000Z-2.store")
        XCTAssertEqual(try read(name), "main")
        XCTAssertEqual(try read(second), "main 2")

        let listing = try fm.contentsOfDirectory(atPath: dir.path)
        XCTAssertEqual(Set(StoreRecovery.backupFileNames(in: listing, storeFileName: "default.store")),
                       [second, name])
    }

    func testStoreFileSizeIncludesCompanions() throws {
        let store = dir.appendingPathComponent("default.store")
        XCTAssertNil(StoreRecovery.storeFileSize(storeURL: store))
        try write("default.store", "12345")
        try write("default.store-wal", "123")
        XCTAssertEqual(StoreRecovery.storeFileSize(storeURL: store), 8)
    }
}
