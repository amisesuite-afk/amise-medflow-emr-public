// NASBackupService+Documents.swift
// Patient documents and photos (PatientDocument.localData) in the NAS backup: upload one file
// at a time, verify by SHA-256, and restore missing ones additively. Format and pure decisions:
// NASDocumentBackup.swift.
//
// Safety: nothing on the NAS is deleted or replaced (each file goes to the new timestamped
// folder; unchanged files point at the earlier copy), and nothing on the device is deleted or
// replaced (restore only adds documents, or adds file data to a record that has none).

import Foundation
import SwiftData

enum NASDocumentsCheck {
    case verified, notInBackup, incomplete, damaged
}

extension NASBackupService {

    static let lastDocumentsManifestKey         = "amf.nas.lastDocumentsManifestPath"
    static let lastCompleteDocumentsManifestKey = "amf.nas.lastCompleteDocumentsManifestPath"

    // MARK: - WebDAV for document files

    /// PUT of one file with its own MIME type, on the long-timeout session.
    func putFile(path: String, data: Data, contentType: String) async throws {
        var req = URLRequest(url: try urlFor(path: path))
        req.httpMethod = "PUT"
        req.setValue(contentType.isEmpty ? "application/octet-stream" : contentType,
                     forHTTPHeaderField: "Content-Type")
        addAuth(&req)
        let (_, resp) = try await documentSession.upload(for: req, from: data)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200...299).contains(code) else { throw NASBackupError.httpError(code, "PUT \(path)") }
    }

    func getFile(path: String) async throws -> Data {
        var req = URLRequest(url: try urlFor(path: path))
        req.httpMethod = "GET"
        addAuth(&req)
        let (data, resp) = try await documentSession.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200...299).contains(code) else { throw NASBackupError.httpError(code, "GET \(path)") }
        return data
    }

    /// True when the file is on the NAS with the expected size. False when it is missing, has
    /// another size, or the server does not answer HEAD (the caller then uploads a fresh copy).
    /// Throws only on a transport error.
    func remoteFileMatches(path: String, size: Int) async throws -> Bool {
        var req = URLRequest(url: try urlFor(path: path))
        req.httpMethod = "HEAD"
        addAuth(&req)
        let (_, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse, (200...299).contains(http.statusCode) else { return false }
        let length = http.expectedContentLength
        return length < 0 || length == Int64(size)
    }

    func loadDocumentsManifest(atPath path: String) async throws -> DocumentsManifest {
        try NASDocumentBackup.decoder().decode(DocumentsManifest.self, from: try await getFile(path: path))
    }

    private func savedManifest(forKey key: String) async -> DocumentsManifest? {
        guard let path = UserDefaults.standard.string(forKey: key) else { return nil }
        return try? await loadDocumentsManifest(atPath: path)
    }

    // MARK: - Reading documents from SwiftData (bounded memory)

    /// Ids of live documents, oldest first. Read in a throwaway context that asks only for the id
    /// and date, so the file data is not loaded here.
    func liveDocumentIDs(container: ModelContainer) throws -> [UUID] {
        let listing = ModelContext(container)
        listing.autosaveEnabled = false
        var fd = FetchDescriptor<PatientDocument>(sortBy: [SortDescriptor(\.uploadedAt)])
        fd.propertiesToFetch = [\.id, \.uploadedAt]
        return try listing.fetch(fd).filter(\.isLive).map(\.id)
    }

    /// One document's metadata and file data, read in its own context so the data is released
    /// once the caller has uploaded it. nil when the document was deleted meanwhile.
    func documentSnapshot(id: UUID, container: ModelContainer) throws -> DocumentSnapshot? {
        let worker = ModelContext(container)
        worker.autosaveEnabled = false
        let target = id
        var fd = FetchDescriptor<PatientDocument>(predicate: #Predicate<PatientDocument> { $0.id == target })
        fd.fetchLimit = 1
        guard let doc = try worker.fetch(fd).first, doc.isLive else { return nil }
        let patient: Patient? = doc.patient.flatMap { $0.isLive ? $0 : nil }
        return DocumentSnapshot(
            code: doc.id.uuidString,
            patientCode: patient.map { NASDocumentBackup.patientCode(syncCode: $0.syncCode, id: $0.id) } ?? "",
            fileName: doc.fileName,
            mimeType: doc.mimeType,
            category: doc.category,
            uploadedAt: doc.uploadedAt,
            remoteId: doc.remoteId,
            storageUrl: doc.storageUrl,
            aiSummary: doc.aiSummary,
            extractedText: doc.extractedText,
            data: doc.localData)
    }

    // MARK: - Backup (called from backup())

    /// Uploads every document's file to `<dirPath>/documents/` one at a time, then writes
    /// `<dirPath>/documents.json`. Never throws: a WebDAV failure part-way stops the upload and
    /// the manifest (and the returned summary) are marked incomplete.
    func backupDocuments(context: ModelContext, dirPath: String) async -> NASDocumentsSummary {
        let started = Date()
        let folder = NASDocumentBackup.folderName(fromDirPath: dirPath)
        let manifestPath = "\(dirPath)/\(NASDocumentBackup.manifestName)"
        let previous = NASDocumentBackup.reusableIndex(await savedManifest(forKey: Self.lastDocumentsManifestKey))

        var entries: [DocumentBackupEntry] = []
        var expected = 0
        var uploadedCount = 0
        var uploadedBytes = 0
        var reusedCount = 0
        var failure: String?

        documentProgress = NASDocumentProgress(done: 0, total: 0, uploadedBytes: 0)
        defer { documentProgress = nil }

        do {
            // The per-document contexts read saved data only.
            if context.hasChanges { try? context.save() }
            let container = context.container
            let ids = try liveDocumentIDs(container: container)
            expected = ids.count
            documentProgress = NASDocumentProgress(done: 0, total: ids.count, uploadedBytes: 0)
            if !ids.isEmpty {
                try await ensureDirectory(path: "\(dirPath)/\(NASDocumentBackup.documentsFolder)")
            }
            for (i, docID) in ids.enumerated() {
                guard let snap = try documentSnapshot(id: docID, container: container) else {
                    expected -= 1   // deleted while the backup ran
                    continue
                }
                if let data = snap.data {
                    let sha = NASDocumentBackup.sha256Hex(data)
                    var path: String?
                    if let old = NASDocumentBackup.reusablePath(code: snap.code, sha256: sha,
                                                                size: data.count, previous: previous) {
                        // Unchanged: keep pointing at the earlier copy if it is still there.
                        if try await remoteFileMatches(path: NASDocumentBackup.serverPath(forEntryPath: old),
                                                       size: data.count) {
                            path = old
                            reusedCount += 1
                        }
                    }
                    if path == nil {
                        let newPath = NASDocumentBackup.entryPath(folder: folder, code: snap.code,
                                                                  fileName: snap.fileName, mimeType: snap.mimeType)
                        try await putFile(path: NASDocumentBackup.serverPath(forEntryPath: newPath),
                                          data: data, contentType: snap.mimeType)
                        path = newPath
                        uploadedCount += 1
                        uploadedBytes += data.count
                    }
                    entries.append(NASDocumentBackup.entry(for: snap, sha256: sha, path: path))
                } else {
                    entries.append(NASDocumentBackup.entry(for: snap, sha256: nil, path: nil))
                }
                documentProgress = NASDocumentProgress(done: i + 1, total: ids.count, uploadedBytes: uploadedBytes)
            }
        } catch {
            failure = error.localizedDescription
        }

        let manifest = NASDocumentBackup.manifest(entries: entries, expectedCount: expected,
                                                  createdAt: .now, failureMessage: failure)
        do {
            _ = try await put(path: manifestPath, data: try NASDocumentBackup.encoder().encode(manifest))
            UserDefaults.standard.set(manifestPath, forKey: Self.lastDocumentsManifestKey)
            if manifest.complete {
                UserDefaults.standard.set(manifestPath, forKey: Self.lastCompleteDocumentsManifestKey)
            }
        } catch {
            if failure == nil { failure = "document list not saved (\(error.localizedDescription))" }
        }

        let summary = NASDocumentsSummary(
            backupPath: dirPath,
            finishedAt: .now,
            complete: failure == nil && manifest.complete,
            expectedCount: expected,
            documentCount: entries.count,
            fileCount: manifest.fileCount,
            totalBytes: manifest.totalBytes,
            uploadedCount: uploadedCount,
            uploadedBytes: uploadedBytes,
            reusedCount: reusedCount,
            seconds: Date().timeIntervalSince(started),
            failureMessage: failure)
        summary.save()
        lastDocumentsSummary = summary
        AuditLog.record("export", "document", details: ["kind": "nas_backup_documents",
                                                        "documents": "\(entries.count)",
                                                        "files": "\(manifest.fileCount)",
                                                        "uploaded": "\(uploadedCount)",
                                                        "complete": summary.complete ? "yes" : "no"])
        return summary
    }

    // MARK: - Verify

    /// Reads documents.json of the backup, checks its counts and downloads all files (or a
    /// sample when the total is large), comparing size and SHA-256. Changes nothing.
    func verifyDocuments(dirPath: String) async -> (check: NASDocumentsCheck, message: String) {
        let manifest: DocumentsManifest
        do {
            manifest = try await loadDocumentsManifest(atPath: "\(dirPath)/\(NASDocumentBackup.manifestName)")
        } catch NASBackupError.httpError(let code, _) where code == 404 {
            return (.notInBackup, "Documents are not in this backup: the document upload did not finish, "
                    + "or the backup was made before documents were included. Tap Backup Now.")
        } catch {
            return (.damaged, "The document list (documents.json) could not be read: \(error.localizedDescription).")
        }

        let files = manifest.documents.filter(\.hasFile)
        var problems: [String] = []
        if !manifest.complete {
            problems.append("only \(manifest.documents.count) of \(manifest.expectedCount) documents were saved"
                            + (manifest.failureMessage.map { " (\($0))" } ?? ""))
        }
        if files.count != manifest.fileCount
            || (manifest.complete && manifest.documents.count != manifest.expectedCount) {
            problems.append("the document list does not add up (\(files.count) files listed, \(manifest.fileCount) expected)")
        }

        let sample = NASDocumentBackup.verificationSample(manifest.documents)
        var bad = 0
        var checked = 0
        var stopped: String?
        for e in sample {
            guard let path = e.path else { continue }
            do {
                let data = try await getFile(path: NASDocumentBackup.serverPath(forEntryPath: path))
                checked += 1
                if data.count != e.size || NASDocumentBackup.sha256Hex(data) != e.sha256 { bad += 1 }
            } catch let urlError as URLError {
                stopped = urlError.localizedDescription   // NAS unreachable: stop, don't time out 30 times
                break
            } catch {
                checked += 1
                bad += 1
            }
        }
        if bad > 0 {
            problems.append("\(bad) of \(checked) checked files are missing or do not match their SHA-256")
        }
        if let stopped {
            problems.append("the file check stopped after \(checked) files (\(stopped))")
        }

        let size = NASDocumentBackup.megabytes(manifest.totalBytes)
        let scope = checked == files.count ? "all \(checked) files checked" : "\(checked) of \(files.count) files checked"
        let noFile = manifest.documents.count - files.count
        let noFileNote = noFile > 0
            ? " \(noFile) document(s) had no file on this device (cloud copy only) and are listed without a file."
            : ""
        if problems.isEmpty {
            return (.verified, "\(files.count) documents, \(size), verified (\(scope)).\(noFileNote)")
        }
        let check: NASDocumentsCheck = manifest.complete ? .damaged : .incomplete
        return (check, "\(files.count) documents, \(size) — " + problems.joined(separator: "; ") + ".\(noFileNote)")
    }

    // MARK: - Restore (additive)

    /// Downloads the document file, returning nil when it is missing or its size or SHA-256
    /// differs from the manifest. Throws on transport errors.
    func downloadVerifiedFile(_ e: DocumentBackupEntry) async throws -> Data? {
        guard let path = e.path, let sha = e.sha256 else { return nil }
        let data: Data
        do {
            data = try await getFile(path: NASDocumentBackup.serverPath(forEntryPath: path))
        } catch NASBackupError.httpError(let code, _) where code == 404 {
            return nil
        }
        return (data.count == e.size && NASDocumentBackup.sha256Hex(data) == sha) ? data : nil
    }

    /// Documents on this device, for restore matching. SHA-256 is computed only for documents
    /// whose patient, name and size match a backup file (`hashKeys`).
    func localDocumentInfos(container: ModelContainer, hashKeys: Set<String>) throws -> [LocalDocumentInfo] {
        let listing = ModelContext(container)
        listing.autosaveEnabled = false
        return try listing.fetch(FetchDescriptor<PatientDocument>()).filter(\.isLive).map { (d: PatientDocument) -> LocalDocumentInfo in
            let patientCode = d.patient.map { NASDocumentBackup.patientCode(syncCode: $0.syncCode, id: $0.id) } ?? ""
            var sha: String?
            if let data = d.localData,
               hashKeys.contains(NASDocumentBackup.contentKey(patientCode: patientCode, fileName: d.fileName, size: data.count)) {
                sha = NASDocumentBackup.sha256Hex(data)
            }
            return LocalDocumentInfo(code: d.id.uuidString, remoteId: d.remoteId, patientCode: patientCode,
                                     fileName: d.fileName, size: d.localData?.count, sha256: sha)
        }
    }

    /// Adds documents from the backup that are missing here, linked to their patient by
    /// syncCode, and adds file data to records that have none. Never replaces or deletes a
    /// document on this device. Call after the patients have been restored and saved.
    func restoreMissingDocuments(context: ModelContext, dirPath: String) async -> (ok: Bool, message: String) {
        let latestPath = "\(dirPath)/\(NASDocumentBackup.manifestName)"
        let latest: DocumentsManifest?
        do {
            latest = try await loadDocumentsManifest(atPath: latestPath)
        } catch NASBackupError.httpError(let code, _) where code == 404 {
            latest = nil
        } catch {
            return (false, "Documents not restored: the document list could not be read (\(error.localizedDescription)).")
        }
        // An incomplete backup: also use the last complete one for documents it did not reach.
        var lastComplete: DocumentsManifest?
        if latest?.complete != true,
           let p = UserDefaults.standard.string(forKey: Self.lastCompleteDocumentsManifestKey), p != latestPath {
            lastComplete = try? await loadDocumentsManifest(atPath: p)
        }
        let entries = NASDocumentBackup.mergedForRestore(latest: latest, lastComplete: lastComplete)
        guard !entries.isEmpty else {
            return (true, latest == nil
                    ? "No documents in this backup (made before documents were included)."
                    : "Documents: none in the backup.")
        }

        var patientByCode: [String: Patient] = [:]
        for p in ((try? context.fetch(FetchDescriptor<Patient>())) ?? []).filter(\.isLive) {
            let code = NASDocumentBackup.patientCode(syncCode: p.syncCode, id: p.id)
            if patientByCode[code] == nil { patientByCode[code] = p }
        }
        let hashKeys = Set(entries.filter(\.hasFile).map {
            NASDocumentBackup.contentKey(patientCode: $0.patientSyncCode, fileName: $0.fileName, size: $0.size)
        })
        let local: [LocalDocumentInfo]
        do {
            local = try localDocumentInfos(container: context.container, hashKeys: hashKeys)
        } catch {
            return (false, "Documents not restored: \(error.localizedDescription).")
        }
        let actions = NASDocumentBackup.planRestore(entries: entries, local: local,
                                                    patientCodes: Set(patientByCode.keys),
                                                    deletedCodes: NASDocumentBackup.deletedDocumentCodes(),
                                                    deletedRemoteIds: SyncTombstones.ids(in: .documents))

        var added = 0, filled = 0, already = 0, deletedHere = 0, noPatient = 0, noFile = 0, badFiles = 0
        var stopped: String?
        restoreLoop: for action in actions {
            switch action {
            case .skipAlreadyHere: already += 1
            case .skipDeletedHere: deletedHere += 1
            case .skipNoPatient:   noPatient += 1
            case .skipNoFile:      noFile += 1
            case .insert(let e):
                do {
                    guard let data = try await downloadVerifiedFile(e) else { badFiles += 1; continue restoreLoop }
                    // isLive after the await: the patient may have been deleted meanwhile.
                    guard let patient = patientByCode[e.patientSyncCode], patient.isLive else {
                        noPatient += 1; continue restoreLoop
                    }
                    let doc = PatientDocument(fileName: e.fileName, mimeType: e.mimeType, category: e.category)
                    doc.id            = UUID(uuidString: e.syncCode) ?? UUID()
                    doc.uploadedAt    = e.uploadedAt
                    doc.remoteId      = e.remoteId
                    doc.storageUrl    = e.storageUrl
                    doc.aiSummary     = e.aiSummary
                    doc.extractedText = e.extractedText
                    doc.localData     = data
                    doc.patient       = patient
                    context.insert(doc)
                    added += 1
                    if (added + filled) % 10 == 0 { try context.save() }
                } catch {
                    stopped = error.localizedDescription
                    break restoreLoop
                }
            case .fillMissingData(let e, let localCode):
                do {
                    guard let data = try await downloadVerifiedFile(e) else { badFiles += 1; continue restoreLoop }
                    guard let target = UUID(uuidString: localCode) else { already += 1; continue restoreLoop }
                    var fd = FetchDescriptor<PatientDocument>(predicate: #Predicate<PatientDocument> { $0.id == target })
                    fd.fetchLimit = 1
                    // Only a record that still has no file data gets it; anything else is left alone.
                    guard let doc = try context.fetch(fd).first, doc.isLive, doc.localData == nil else {
                        already += 1; continue restoreLoop
                    }
                    doc.localData = data
                    filled += 1
                    if (added + filled) % 10 == 0 { try context.save() }
                } catch {
                    stopped = error.localizedDescription
                    break restoreLoop
                }
            }
        }
        do {
            try context.save()
        } catch {
            stopped = stopped ?? error.localizedDescription
        }
        AuditLog.record("create", "document", details: ["kind": "backup_restore_documents",
                                                        "added": "\(added)",
                                                        "filled": "\(filled)",
                                                        "failed_check": "\(badFiles)"])

        var parts = ["Documents: \(added) restored", "\(already) already here"]
        if filled > 0      { parts.insert("\(filled) missing file(s) added to existing records", at: 1) }
        if noPatient > 0   { parts.append("\(noPatient) skipped (patient not on this device)") }
        if deletedHere > 0 { parts.append("\(deletedHere) deleted on this device (not restored)") }
        if noFile > 0      { parts.append("\(noFile) had no file in the backup") }
        if badFiles > 0    { parts.append("\(badFiles) missing on the NAS or failed the SHA-256 check (not restored)") }
        if let stopped     { parts.append("restore stopped early: \(stopped)") }
        if latest == nil   { parts.append("this backup has no document list; used the last complete one") }
        else if latest?.complete == false { parts.append("this backup's documents are incomplete") }
        return (stopped == nil && badFiles == 0, parts.joined(separator: ", ") + ".")
    }
}
