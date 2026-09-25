// StoreHealth.swift
// Opening the on-device SwiftData store without ever losing data silently.
//
// Rules (compliance review, data-loss finding):
//  • The store file is never deleted or reset. If it cannot be opened it is first retried as is,
//    then moved aside (with its -wal / -shm files, so the copy stays a complete SQLite database)
//    to a timestamped name next to it, and a fresh store is opened once.
//  • If that fails too, the app runs on an in-memory store. `StoreHealth.isInMemoryFallback` is
//    then true: every main screen shows a red banner that cannot be dismissed, new patients and
//    note signing are blocked, and the failure is reported to CrashReporting (error domain and
//    code only, no patient data).
//  • Settings → Diagnostics shows the store status, the store file size and any moved-aside
//    copies (including the older `medflow-backup-<epoch>.store` copies made by earlier builds).
//
// `StoreRecovery.open` holds the decision logic with the container calls injected, so it can
// be unit-tested without SwiftData (AmiseMedFlowTests/StoreHealthTests.swift).

import Foundation

// MARK: - Outcome types

/// How the store was opened this launch.
enum StoreOpenStatus: Equatable {
    /// The normal on-disk store.
    case onDisk
    /// The on-disk store could not be opened and was moved aside (`backupName`); a new, empty
    /// on-disk store is in use. New work is kept; the old records are in the moved-aside file.
    case onDiskAfterMoveAside(backupName: String)
    /// Nothing could be opened on disk. Changes made this session are lost on quit.
    case inMemoryFallback
}

/// What the store file on disk looks like before we decide whether to move it.
enum StoreFileState: Equatable {
    case missing
    case readable
    /// Exists but cannot be read (e.g. data protection before first unlock, permissions).
    /// Moving it would not help, so it is left untouched.
    case unreadable
}

/// One failed step. Only the error domain and code are kept, so nothing else can leak into
/// a crash report.
struct StoreOpenFailure: Equatable {
    enum Stage: String {
        case open            = "open"
        case retry           = "retry"
        case moveAside       = "move_aside"
        case openFresh       = "open_fresh"
        case openInMemory    = "open_in_memory"
    }
    let stage: Stage
    let domain: String
    let code: Int

    init(stage: Stage, error: Error) {
        let ns = error as NSError
        self.stage = stage
        self.domain = ns.domain
        self.code = ns.code
    }

    init(stage: Stage, domain: String, code: Int) {
        self.stage = stage
        self.domain = domain
        self.code = code
    }
}

struct StoreOpenOutcome<Container> {
    /// nil only when even the in-memory store failed.
    var container: Container?
    var status: StoreOpenStatus
    var failures: [StoreOpenFailure]
}

// MARK: - Decision logic and file helpers

enum StoreRecovery {

    /// Opens the store. Order: on disk → the same file again, untouched → (only when the file
    /// exists and can be read) move it aside and open a fresh store once → in memory.
    /// Never deletes anything.
    static func open<Container>(
        openOnDisk: () throws -> Container,
        storeFileState: () -> StoreFileState,
        moveAside: () throws -> String,
        openInMemory: () throws -> Container
    ) -> StoreOpenOutcome<Container> {
        var failures: [StoreOpenFailure] = []

        do {
            return StoreOpenOutcome(container: try openOnDisk(), status: .onDisk, failures: failures)
        } catch {
            failures.append(StoreOpenFailure(stage: .open, error: error))
        }

        do {
            return StoreOpenOutcome(container: try openOnDisk(), status: .onDisk, failures: failures)
        } catch {
            failures.append(StoreOpenFailure(stage: .retry, error: error))
        }

        if storeFileState() == .readable {
            var backupName: String?
            do {
                backupName = try moveAside()
            } catch {
                failures.append(StoreOpenFailure(stage: .moveAside, error: error))
            }
            if let backupName {
                do {
                    return StoreOpenOutcome(container: try openOnDisk(),
                                            status: .onDiskAfterMoveAside(backupName: backupName),
                                            failures: failures)
                } catch {
                    failures.append(StoreOpenFailure(stage: .openFresh, error: error))
                }
            }
        }

        do {
            return StoreOpenOutcome(container: try openInMemory(), status: .inMemoryFallback, failures: failures)
        } catch {
            failures.append(StoreOpenFailure(stage: .openInMemory, error: error))
            return StoreOpenOutcome(container: nil, status: .inMemoryFallback, failures: failures)
        }
    }

    /// SQLite files that belong to the store and must move with it. Moving the main file
    /// without its -wal would drop every change not yet checkpointed.
    static let companionSuffixes = ["-wal", "-shm"]

    /// Marker in moved-aside file names.
    static let movedAsideMarker = "-moved-aside-"

    /// Name prefix of the copies made by builds before this change (copy + delete).
    static let legacyBackupPrefix = "medflow-backup-"

    /// UTC stamp for file names, e.g. "20260925-141502Z".
    static func timestamp(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyyMMdd-HHmmss'Z'"
        return f.string(from: date)
    }

    /// "default.store" at `date` → "default-moved-aside-20260925-141502Z.store".
    /// `attempt` > 1 adds "-2", "-3", … for a name that is already taken.
    static func backupFileName(forStoreFileName storeFileName: String, at date: Date, attempt: Int = 1) -> String {
        let url = URL(fileURLWithPath: storeFileName)
        let ext = url.pathExtension
        let stem = url.deletingPathExtension().lastPathComponent
        let suffix = attempt > 1 ? "-\(attempt)" : ""
        let base = "\(stem)\(movedAsideMarker)\(timestamp(date))\(suffix)"
        return ext.isEmpty ? base : "\(base).\(ext)"
    }

    /// First backup name (and its companions) that is not already taken.
    static func uniqueBackupFileName(forStoreFileName storeFileName: String, at date: Date,
                                     isTaken: (String) -> Bool) -> String {
        var attempt = 1
        while true {
            let name = backupFileName(forStoreFileName: storeFileName, at: date, attempt: attempt)
            let names = [name] + companionSuffixes.map { name + $0 }
            if !names.contains(where: isTaken) { return name }
            attempt += 1
        }
    }

    /// Moved-aside store files in a directory listing (main files only; -wal/-shm go with
    /// them), newest first. Includes the legacy `medflow-backup-<epoch>.store` copies.
    static func backupFileNames(in directoryListing: [String], storeFileName: String) -> [String] {
        let url = URL(fileURLWithPath: storeFileName)
        let ext = url.pathExtension
        let stem = url.deletingPathExtension().lastPathComponent
        let movedPrefix = stem + movedAsideMarker
        let suffixes = companionSuffixes
        let isCompanion: (String) -> Bool = { name in suffixes.contains { name.hasSuffix($0) } }
        return directoryListing.filter { name in
            guard !isCompanion(name) else { return false }
            if name.hasPrefix(movedPrefix) {
                return ext.isEmpty || name.hasSuffix(".\(ext)")
            }
            return name.hasPrefix(legacyBackupPrefix) && name.hasSuffix(".store")
        }
        .sorted(by: >)
    }

    // MARK: File-system operations

    static func fileState(at url: URL, fileManager: FileManager = .default) -> StoreFileState {
        guard fileManager.fileExists(atPath: url.path) else { return .missing }
        do {
            let handle = try FileHandle(forReadingFrom: url)
            defer { try? handle.close() }
            _ = try handle.read(upToCount: 16)
            return .readable
        } catch {
            return .unreadable
        }
    }

    /// Renames the store and its -wal/-shm files to a timestamped name in the same directory.
    /// All or nothing: if a companion cannot be moved, the files already moved are put back and
    /// the error is thrown. Returns the moved-aside main file name. Never deletes.
    @discardableResult
    static func moveStoreAside(storeURL: URL, at date: Date = Date(),
                               fileManager: FileManager = .default) throws -> String {
        let dir = storeURL.deletingLastPathComponent()
        let name = uniqueBackupFileName(forStoreFileName: storeURL.lastPathComponent, at: date) {
            fileManager.fileExists(atPath: dir.appendingPathComponent($0).path)
        }
        var moved: [(from: URL, to: URL)] = []
        for suffix in [""] + companionSuffixes {
            let from = URL(fileURLWithPath: storeURL.path + suffix)
            guard fileManager.fileExists(atPath: from.path) else { continue }
            let to = dir.appendingPathComponent(name + suffix)
            do {
                try fileManager.moveItem(at: from, to: to)
                moved.append((from: from, to: to))
            } catch {
                for m in moved.reversed() { try? fileManager.moveItem(at: m.to, to: m.from) }
                throw error
            }
        }
        return name
    }

    /// Size in bytes of the store and its -wal/-shm files; nil when the store file is missing.
    static func storeFileSize(storeURL: URL, fileManager: FileManager = .default) -> Int64? {
        guard fileManager.fileExists(atPath: storeURL.path) else { return nil }
        var total: Int64 = 0
        for suffix in [""] + companionSuffixes {
            let path = storeURL.path + suffix
            if let attrs = try? fileManager.attributesOfItem(atPath: path),
               let size = attrs[.size] as? NSNumber {
                total += size.int64Value
            }
        }
        return total
    }
}

// MARK: - Launch state (read by the banner, the write guards and Diagnostics)

/// Set once at launch by `AmiseMedFlowApp` before any view is shown; not changed afterwards.
enum StoreHealth {
    private(set) static var status: StoreOpenStatus = .onDisk
    private(set) static var storeURL: URL?

    static var isInMemoryFallback: Bool { status == .inMemoryFallback }

    /// New patients and note signing are refused while this is true.
    static var blocksNewClinicalData: Bool { isInMemoryFallback }

    static func record(status: StoreOpenStatus, storeURL: URL) {
        self.status = status
        self.storeURL = storeURL
    }

    static let inMemoryBannerText =
        "Storage error — changes on this device will NOT be kept. Do not enter patient data. Contact support."

    static func movedAsideBannerText(backupName: String) -> String {
        "The previous on-device database could not be opened and was set aside (\(backupName)). "
            + "Records not yet synced are not shown. New changes are being saved. Contact support."
    }

    static let blockedAlertTitle = "Storage error"
    static let blockedAlertMessage =
        "This device is not saving changes, so new patients and note signing are blocked to prevent "
        + "data loss. See Settings → Diagnostics (or tap the red banner) and contact support."

    static var statusText: String {
        switch status {
        case .onDisk:               return "On disk"
        case .onDiskAfterMoveAside: return "On disk (previous store moved aside)"
        case .inMemoryFallback:     return "IN-MEMORY FALLBACK"
        }
    }

    /// Store file size, formatted; "—" when there is no file.
    static var storeFileSizeText: String {
        guard let url = storeURL, let bytes = StoreRecovery.storeFileSize(storeURL: url) else { return "—" }
        return ByteCountFormatter.string(fromByteCount: bytes, countStyle: .file)
    }

    /// Moved-aside copies next to the store, newest first.
    static var backupFileNames: [String] {
        guard let url = storeURL else { return [] }
        let listing = (try? FileManager.default.contentsOfDirectory(
            atPath: url.deletingLastPathComponent().path)) ?? []
        return StoreRecovery.backupFileNames(in: listing, storeFileName: url.lastPathComponent)
    }
}
