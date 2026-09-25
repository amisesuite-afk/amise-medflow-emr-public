// IncomingReportStaging.swift
// PDFs shared to MedFlow from another app (the Laboratory Services Ltd app "SLUlabservices",
// Files, Safari) via "Open in MedFlow" / "Copy to MedFlow".
//
// Info.plist (project.yml) declares MedFlow a Viewer of com.adobe.pdf (rank Alternate) with
// LSSupportsOpeningDocumentsInPlace = false, so iOS copies the file into Documents/Inbox and
// calls .onOpenURL (AmiseMedFlowApp). The file is then:
//   1. checked (a real PDF by its header bytes, not empty, at most `maxBytes`);
//   2. copied into Application Support/IncomingReports with complete file protection and
//      excluded from backup; the Inbox copy is deleted (also when the file is refused);
//   3. kept ("staged") until staff file it to a patient or discard it. Nothing is shown while
//      the app is locked, signed out or in patient hand-over mode (IncomingReportHandling).
// Staged files older than 7 days are removed at launch. Nothing is parsed or sent anywhere here.

import Foundation
import SwiftUI

// MARK: - Pure rules (unit-tested in IncomingReportStagingTests)

enum IncomingReportStaging {

    static let maxBytes = 25 * 1024 * 1024
    static let maxAge: TimeInterval = 7 * 24 * 60 * 60
    static let directoryName = "IncomingReports"

    enum Rejection: Error, Equatable {
        case notPDF
        case empty
        case tooLarge(bytes: Int)

        var message: String {
            switch self {
            case .notPDF: return "Only PDF reports can be imported."
            case .empty: return "The file is empty."
            case .tooLarge(let bytes):
                let mb = Double(bytes) / 1_048_576
                return String(format: "The file is too large (%.0f MB; the limit is %d MB).", mb, IncomingReportStaging.maxBytes / 1_048_576)
            }
        }
    }

    /// A PDF starts with "%PDF-" within its first 1024 bytes.
    static func looksLikePDF(header: Data) -> Bool {
        let marker = Data("%PDF-".utf8)
        return header.prefix(1024).range(of: marker) != nil
    }

    /// nil when the file may be staged.
    static func validate(fileName: String, byteCount: Int, header: Data) -> Rejection? {
        if byteCount <= 0 { return .empty }
        if byteCount > maxBytes { return .tooLarge(bytes: byteCount) }
        let ext = (fileName as NSString).pathExtension.lowercased()
        guard ext == "pdf" || ext.isEmpty, looksLikePDF(header: header) else { return .notPDF }
        return nil
    }

    private static func stampFormatter() -> DateFormatter {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyyMMdd'T'HHmmss'Z'"
        return f
    }

    /// Letters, digits, "-" and "_" only, at most 60 characters, without the extension.
    static func sanitisedDisplayName(_ original: String) -> String {
        let base = (original as NSString).deletingPathExtension
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        var out = ""
        for scalar in base.unicodeScalars {
            if scalar.isASCII, allowed.contains(scalar) { out.unicodeScalars.append(scalar) }
            else if !out.hasSuffix("_") { out.append("_") }
        }
        out = out.trimmingCharacters(in: CharacterSet(charactersIn: "_"))
        if out.isEmpty { out = "report" }
        return String(out.prefix(60))
    }

    /// "<UTC stamp>_<uuid>_<sanitised original>.pdf" — sortable, unique, and carries the receipt
    /// time so the 7-day rule does not depend on file-system dates.
    static func stagedFileName(receivedAt: Date, id: UUID, originalName: String) -> String {
        "\(stampFormatter().string(from: receivedAt))_\(id.uuidString)_\(sanitisedDisplayName(originalName)).pdf"
    }

    struct StagedName: Equatable {
        let receivedAt: Date
        let id: UUID
        let displayName: String
    }

    static func parseStagedFileName(_ name: String) -> StagedName? {
        guard name.lowercased().hasSuffix(".pdf") else { return nil }
        let base = String(name.dropLast(4))
        let parts = base.split(separator: "_", maxSplits: 2, omittingEmptySubsequences: false).map(String.init)
        guard parts.count == 3,
              let date = stampFormatter().date(from: parts[0]),
              let id = UUID(uuidString: parts[1]) else { return nil }
        return StagedName(receivedAt: date, id: id, displayName: parts[2].isEmpty ? "report" : parts[2])
    }

    static func isStale(receivedAt: Date, now: Date) -> Bool {
        now.timeIntervalSince(receivedAt) > maxAge
    }

    /// Files in the staging folder to delete at launch: stale ones, and anything that is not a
    /// staged file name (only MedFlow writes there).
    static func filesToRemove(in names: [String], now: Date) -> [String] {
        names.filter { name in
            guard let parsed = parseStagedFileName(name) else { return true }
            return isStale(receivedAt: parsed.receivedAt, now: now)
        }
    }

    /// Documents/Inbox leftovers to delete: older than the same 7 days (by modification date).
    static func inboxFilesToRemove(_ files: [(name: String, modified: Date?)], now: Date) -> [String] {
        files.filter { f in f.modified.map { isStale(receivedAt: $0, now: now) } ?? true }.map(\.name)
    }
}

// MARK: - Staged file

struct StagedReport: Identifiable, Hashable {
    let id: UUID
    let url: URL
    let receivedAt: Date
    let displayName: String
}

// MARK: - Inbox (file operations)

@MainActor
final class IncomingReportInbox: ObservableObject {
    static let shared = IncomingReportInbox()

    @Published private(set) var staged: [StagedReport] = []
    /// Set when a file was just received; the root presents the import when it is safe to.
    @Published var pendingPresentation = false
    /// Last refusal, shown once.
    @Published var lastRejection: String?

    private let fm = FileManager.default

    private var directory: URL? {
        guard let base = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return nil }
        var dir = base.appendingPathComponent(IncomingReportStaging.directoryName, isDirectory: true)
        if !fm.fileExists(atPath: dir.path) {
            try? fm.createDirectory(at: dir, withIntermediateDirectories: true,
                                    attributes: [.protectionKey: FileProtectionType.complete])
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try? dir.setResourceValues(values)
        }
        return dir
    }

    private var inboxDirectory: URL? {
        fm.urls(for: .documentDirectory, in: .userDomainMask).first?
            .appendingPathComponent("Inbox", isDirectory: true)
    }

    /// Re-reads the staging folder.
    func reload() {
        guard let dir = directory,
              let names = try? fm.contentsOfDirectory(atPath: dir.path) else { staged = []; return }
        staged = names.compactMap { name -> StagedReport? in
            guard let p = IncomingReportStaging.parseStagedFileName(name) else { return nil }
            return StagedReport(id: p.id, url: dir.appendingPathComponent(name),
                                receivedAt: p.receivedAt, displayName: p.displayName)
        }
        .sorted { $0.receivedAt < $1.receivedAt }
    }

    /// Launch: remove stale staged files and old Inbox leftovers, then list what is left.
    func launchCleanup(now: Date = Date()) {
        if let dir = directory, let names = try? fm.contentsOfDirectory(atPath: dir.path) {
            for name in IncomingReportStaging.filesToRemove(in: names, now: now) {
                try? fm.removeItem(at: dir.appendingPathComponent(name))
            }
        }
        if let inbox = inboxDirectory, let names = try? fm.contentsOfDirectory(atPath: inbox.path) {
            let files = names.map { name -> (name: String, modified: Date?) in
                let attrs = try? fm.attributesOfItem(atPath: inbox.appendingPathComponent(name).path)
                return (name, attrs?[.modificationDate] as? Date)
            }
            for name in IncomingReportStaging.inboxFilesToRemove(files, now: now) {
                try? fm.removeItem(at: inbox.appendingPathComponent(name))
            }
        }
        reload()
    }

    /// Handles a URL from .onOpenURL. Returns true when it was a file (handled or refused).
    @discardableResult
    func receive(_ url: URL, now: Date = Date()) -> Bool {
        guard url.isFileURL else { return false }
        let scoped = url.startAccessingSecurityScopedResource()
        defer {
            if scoped { url.stopAccessingSecurityScopedResource() }
            removeInboxCopy(url)
        }
        let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        var header = Data()
        if let handle = try? FileHandle(forReadingFrom: url) {
            header = (try? handle.read(upToCount: 1024)) ?? Data()
            try? handle.close()
        }
        if let rejection = IncomingReportStaging.validate(fileName: url.lastPathComponent,
                                                          byteCount: size, header: header) {
            lastRejection = rejection.message
            CrashReporting.breadcrumb("Incoming file refused", category: "report_import")
            return true
        }
        guard let dir = directory, let data = try? Data(contentsOf: url) else {
            lastRejection = "The file could not be read."
            return true
        }
        // Re-check the bytes actually read (the size attribute can be missing).
        if let rejection = IncomingReportStaging.validate(fileName: url.lastPathComponent,
                                                          byteCount: data.count, header: data.prefix(1024)) {
            lastRejection = rejection.message
            return true
        }
        let name = IncomingReportStaging.stagedFileName(receivedAt: now, id: UUID(), originalName: url.lastPathComponent)
        do {
            try data.write(to: dir.appendingPathComponent(name), options: [.atomic, .completeFileProtection])
        } catch {
            lastRejection = "The file could not be saved on this device."
            return true
        }
        CrashReporting.breadcrumb("Incoming report staged", category: "report_import")
        reload()
        pendingPresentation = true
        return true
    }

    /// Deletes the iOS Inbox copy (only inside this app's Documents/Inbox).
    private func removeInboxCopy(_ url: URL) {
        guard let inbox = inboxDirectory?.standardizedFileURL.path else { return }
        let path = url.standardizedFileURL.path
        if path.hasPrefix(inbox + "/") { try? fm.removeItem(at: url) }
    }

    func data(for report: StagedReport) -> Data? {
        try? Data(contentsOf: report.url)
    }

    /// Removes a staged file (filed to a patient, or discarded).
    func remove(_ report: StagedReport) {
        try? fm.removeItem(at: report.url)
        reload()
    }
}
