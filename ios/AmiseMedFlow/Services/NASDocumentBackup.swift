// NASDocumentBackup.swift
// Pure parts of the NAS document backup (no network, no SwiftData): the documents.json manifest,
// file naming, SHA-256, the "skip unchanged file" decision, the verification sample and the
// additive-restore plan. The network and SwiftData side is NASBackupService+Documents.swift.
//
// Backup layout (inside medflow-backups/<timestamp>/):
//   documents/<syncCode>.<ext>   one file per PatientDocument that has file data on the device
//   documents.json               DocumentsManifest (every document, with SHA-256 and size)
//
// A document unchanged since the previous backup (same SHA-256 and size) is not uploaded again:
// its manifest entry points at the copy already on the NAS in the earlier backup folder
// (`path` is relative to medflow-backups/). Nothing on the NAS is ever deleted or replaced.
//
// PatientDocument has no syncCode field; its `id` (UUID) is the document's code in backups, and
// a restored document gets that id back, so a second restore recognises it.

import Foundation
import CryptoKit

// MARK: - Manifest

/// One PatientDocument in a backup. `path == nil` means the device had no file data for it
/// (e.g. metadata pulled from the cloud whose file was never downloaded), so only the metadata
/// is recorded.
struct DocumentBackupEntry: Codable, Equatable {
    var syncCode: String          // PatientDocument.id.uuidString
    var patientSyncCode: String   // Patient.syncCode (id.uuidString when empty), "" when unlinked
    var fileName: String
    var mimeType: String
    var category: String?
    var uploadedAt: Date
    var remoteId: String?
    var storageUrl: String?
    var aiSummary: String?
    var extractedText: String?
    var size: Int                 // bytes of file data (0 when none)
    var sha256: String?           // lowercase hex; nil when no file data
    var path: String?             // relative to medflow-backups/, e.g. "<timestamp>/documents/<code>.pdf"

    var hasFile: Bool { path != nil && sha256 != nil }
}

struct DocumentsManifest: Codable, Equatable {
    var formatVersion: Int
    var createdAt: Date
    /// False when the upload stopped part-way (WebDAV failure): `documents` then lists only what
    /// was saved, and `failureMessage` says why.
    var complete: Bool
    /// Documents on the device when the backup ran.
    var expectedCount: Int
    var fileCount: Int            // entries with a file
    var totalBytes: Int           // bytes of all entries with a file
    var documents: [DocumentBackupEntry]
    var failureMessage: String?
}

/// What was on the device for one document at backup time (read from SwiftData, then released).
struct DocumentSnapshot {
    var code: String
    var patientCode: String
    var fileName: String
    var mimeType: String
    var category: String?
    var uploadedAt: Date
    var remoteId: String?
    var storageUrl: String?
    var aiSummary: String?
    var extractedText: String?
    var data: Data?
}

/// A document already on this device, for restore matching.
struct LocalDocumentInfo: Equatable {
    var code: String
    var remoteId: String?
    var patientCode: String
    var fileName: String
    var size: Int?                // nil when the device has no file data for it
    var sha256: String?           // computed only when needed for a content match
}

enum DocumentRestoreAction: Equatable {
    /// Missing on this device: add it (after the downloaded file passes its SHA-256 check).
    case insert(DocumentBackupEntry)
    /// Already here as a record without file data (e.g. re-created from cloud metadata): add the
    /// file data to it. Nothing that is already on the device is replaced.
    case fillMissingData(DocumentBackupEntry, localCode: String)
    case skipAlreadyHere
    case skipDeletedHere
    case skipNoPatient
    case skipNoFile
}

// MARK: - Progress and summary (published by NASBackupService)

struct NASDocumentProgress: Equatable {
    var done: Int
    var total: Int
    var uploadedBytes: Int
}

/// The documents part of the last backup run. Counts and sizes only, no patient data, so it can
/// live in UserDefaults.
struct NASDocumentsSummary: Codable, Equatable {
    var backupPath: String
    var finishedAt: Date
    var complete: Bool
    var expectedCount: Int
    var documentCount: Int        // entries saved in documents.json
    var fileCount: Int
    var totalBytes: Int
    var uploadedCount: Int
    var uploadedBytes: Int
    var reusedCount: Int          // unchanged since the previous backup, not uploaded again
    var seconds: Double
    var failureMessage: String?

    static let defaultsKey = "amf.nas.lastDocumentsSummary"

    static func loadSaved() -> NASDocumentsSummary? {
        guard let data = UserDefaults.standard.data(forKey: defaultsKey) else { return nil }
        return try? NASDocumentBackup.decoder().decode(NASDocumentsSummary.self, from: data)
    }

    func save() {
        guard let data = try? NASDocumentBackup.encoder().encode(self) else { return }
        UserDefaults.standard.set(data, forKey: Self.defaultsKey)
    }
}

// MARK: - Pure helpers

enum NASDocumentBackup {

    static let backupsBase = "medflow-backups"
    static let documentsFolder = "documents"
    static let manifestName = "documents.json"
    static let formatVersion = 1

    /// Verify downloads every file up to this total; above it, a sample.
    static let verifyAllUpToBytes = 150 * 1024 * 1024
    static let verifySampleSize = 30

    static func encoder() -> JSONEncoder {
        let e = JSONEncoder()
        e.outputFormatting = [.prettyPrinted, .sortedKeys]
        e.dateEncodingStrategy = .iso8601
        return e
    }

    static func decoder() -> JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }

    static func sha256Hex(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    /// Code used for a patient in backups (same rule as the full-record backup and verify).
    static func patientCode(syncCode: String, id: UUID) -> String {
        syncCode.isEmpty ? id.uuidString : syncCode
    }

    /// "medflow-backups/20260925T101010Z" → "20260925T101010Z".
    static func folderName(fromDirPath dirPath: String) -> String {
        let prefix = backupsBase + "/"
        return dirPath.hasPrefix(prefix) ? String(dirPath.dropFirst(prefix.count)) : dirPath
    }

    /// Full server path (relative to the WebDAV root) for a manifest `path`.
    static func serverPath(forEntryPath path: String) -> String {
        "\(backupsBase)/\(path)"
    }

    /// File extension for the NAS copy: the original one when it is short and plain, else from
    /// the MIME type. The NAS file name never contains the original name (it may hold PHI).
    static func fileExtension(fileName: String, mimeType: String) -> String {
        let ext = (fileName as NSString).pathExtension.lowercased()
        if (1...5).contains(ext.count),
           ext.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber) }) {
            return ext
        }
        switch mimeType.lowercased() {
        case "application/pdf":          return "pdf"
        case "image/jpeg", "image/jpg":  return "jpg"
        case "image/png":                return "png"
        case "image/heic":               return "heic"
        case "image/gif":                return "gif"
        case "image/tiff":               return "tiff"
        case "text/plain":               return "txt"
        default:                         return "bin"
        }
    }

    /// Manifest path (relative to medflow-backups/) for a newly uploaded file.
    static func entryPath(folder: String, code: String, fileName: String, mimeType: String) -> String {
        "\(folder)/\(documentsFolder)/\(code).\(fileExtension(fileName: fileName, mimeType: mimeType))"
    }

    /// Builds the manifest entry for one document. `path` is where its file is (new upload or
    /// reused copy); nil when the snapshot has no file data.
    static func entry(for s: DocumentSnapshot, sha256: String?, path: String?) -> DocumentBackupEntry {
        DocumentBackupEntry(
            syncCode: s.code, patientSyncCode: s.patientCode,
            fileName: s.fileName, mimeType: s.mimeType, category: s.category,
            uploadedAt: s.uploadedAt, remoteId: s.remoteId, storageUrl: s.storageUrl,
            aiSummary: s.aiSummary, extractedText: s.extractedText,
            size: s.data?.count ?? 0,
            sha256: s.data == nil ? nil : sha256,
            path: s.data == nil ? nil : path)
    }

    static func manifest(entries: [DocumentBackupEntry], expectedCount: Int, createdAt: Date,
                         failureMessage: String?) -> DocumentsManifest {
        let files = entries.filter(\.hasFile)
        return DocumentsManifest(
            formatVersion: formatVersion,
            createdAt: createdAt,
            complete: failureMessage == nil && entries.count == expectedCount,
            expectedCount: expectedCount,
            fileCount: files.count,
            totalBytes: files.reduce(0) { $0 + $1.size },
            documents: entries,
            failureMessage: failureMessage)
    }

    // MARK: Skip unchanged files

    /// Previous manifest entries that point at a file, by document code.
    static func reusableIndex(_ previous: DocumentsManifest?) -> [String: DocumentBackupEntry] {
        var index: [String: DocumentBackupEntry] = [:]
        for e in previous?.documents ?? [] where e.hasFile {
            index[e.syncCode] = e
        }
        return index
    }

    /// The NAS path of an identical copy from the previous backup, or nil when the file must be
    /// uploaded (new document, changed content, or no previous copy).
    static func reusablePath(code: String, sha256: String, size: Int,
                             previous: [String: DocumentBackupEntry]) -> String? {
        guard let p = previous[code], p.hasFile,
              p.sha256 == sha256, p.size == size else { return nil }
        return p.path
    }

    // MARK: Verify

    /// Entries whose files verify downloads: all when the total is small, else the newest half
    /// of the sample plus evenly spaced older ones. Deterministic.
    static func verificationSample(_ entries: [DocumentBackupEntry],
                                   allUpToBytes: Int = verifyAllUpToBytes,
                                   sampleSize: Int = verifySampleSize) -> [DocumentBackupEntry] {
        let files = entries.filter(\.hasFile)
        let total = files.reduce(0) { $0 + $1.size }
        if total <= allUpToBytes || files.count <= sampleSize { return files }
        let newestFirst = files.sorted { $0.uploadedAt > $1.uploadedAt }
        let newestCount = sampleSize / 2
        var sample = Array(newestFirst.prefix(newestCount))
        let rest = Array(newestFirst.dropFirst(newestCount))
        let wanted = sampleSize - newestCount
        if wanted > 0, !rest.isEmpty {
            let step = Double(rest.count) / Double(wanted)
            for i in 0..<wanted {
                let idx = min(rest.count - 1, Int(Double(i) * step))
                sample.append(rest[idx])
            }
        }
        // Evenly spaced indices never repeat while rest.count >= wanted; dedupe anyway.
        var seen = Set<String>()
        return sample.filter { seen.insert($0.syncCode).inserted }
    }

    // MARK: Restore

    /// Documents from `latest` plus, when it is incomplete, those only in the last complete
    /// manifest (the latest entry wins for a document in both).
    static func mergedForRestore(latest: DocumentsManifest?, lastComplete: DocumentsManifest?) -> [DocumentBackupEntry] {
        var result = latest?.documents ?? []
        guard latest?.complete != true, let fallback = lastComplete else { return result }
        let have = Set(result.map(\.syncCode))
        result += fallback.documents.filter { !have.contains($0.syncCode) }
        return result
    }

    /// Keys for which the caller must compute local SHA-256 (same patient, name and size as a
    /// backup file) so a content duplicate is not added twice.
    static func contentKey(patientCode: String, fileName: String, size: Int) -> String {
        "\(patientCode)\u{1F}\(fileName)\u{1F}\(size)"
    }

    /// Decides, per backup entry, what an additive restore does. Never replaces anything here:
    /// a document already on the device (same code, same server id, or same patient + name +
    /// content) is skipped, except that missing file data may be filled in.
    static func planRestore(entries: [DocumentBackupEntry],
                            local: [LocalDocumentInfo],
                            patientCodes: Set<String>,
                            deletedCodes: Set<String>,
                            deletedRemoteIds: Set<String>) -> [DocumentRestoreAction] {
        var byCode: [String: LocalDocumentInfo] = [:]
        var byRemoteId: [String: LocalDocumentInfo] = [:]
        var byContent: [String: [LocalDocumentInfo]] = [:]
        for l in local {
            byCode[l.code] = l
            if let r = l.remoteId, !r.isEmpty { byRemoteId[r] = l }
            if let size = l.size {
                byContent[contentKey(patientCode: l.patientCode, fileName: l.fileName, size: size), default: []].append(l)
            }
        }
        var planned = Set<String>()
        return entries.map { (e: DocumentBackupEntry) -> DocumentRestoreAction in
            guard planned.insert(e.syncCode).inserted else { return .skipAlreadyHere }
            let byServerId: LocalDocumentInfo? = e.remoteId.flatMap { $0.isEmpty ? nil : byRemoteId[$0] }
            let match = byCode[e.syncCode] ?? byServerId
            if let m = match {
                return (m.size == nil && e.hasFile) ? .fillMissingData(e, localCode: m.code) : .skipAlreadyHere
            }
            if deletedCodes.contains(e.syncCode) { return .skipDeletedHere }
            if let r = e.remoteId, deletedRemoteIds.contains(r) { return .skipDeletedHere }
            guard e.hasFile else { return .skipNoFile }
            guard !e.patientSyncCode.isEmpty, patientCodes.contains(e.patientSyncCode) else { return .skipNoPatient }
            let key = contentKey(patientCode: e.patientSyncCode, fileName: e.fileName, size: e.size)
            if (byContent[key] ?? []).contains(where: { $0.sha256 != nil && $0.sha256 == e.sha256 }) {
                return .skipAlreadyHere
            }
            return .insert(e)
        }
    }

    // MARK: Documents deleted on this device

    static let deletedCodesKey = "amf.nas.deletedDocumentCodes"

    /// Remembers a document the user deleted here so a restore never brings it back.
    static func recordDeletedDocument(code: String) {
        var codes = UserDefaults.standard.stringArray(forKey: deletedCodesKey) ?? []
        guard !codes.contains(code) else { return }
        codes.append(code)
        if codes.count > 20_000 { codes.removeFirst(codes.count - 20_000) }
        UserDefaults.standard.set(codes, forKey: deletedCodesKey)
    }

    static func deletedDocumentCodes() -> Set<String> {
        Set(UserDefaults.standard.stringArray(forKey: deletedCodesKey) ?? [])
    }

    static func megabytes(_ bytes: Int) -> String {
        ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)
    }
}
