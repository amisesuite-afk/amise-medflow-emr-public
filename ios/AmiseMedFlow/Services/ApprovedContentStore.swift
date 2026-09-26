// ApprovedContentStore.swift
// On-device copy of the approved release of each channel-enabled shared rule file
// (docs/APPROVED-CONTENT-CHANNEL.md). The sync step (SyncService+ApprovedContent.swift) fetches the
// releases, picks the one in force with ApprovedContent.selectForChannel and keeps it here, in
// Application Support/ApprovedContent/<content-id>.release.json; a result of "bundled" deletes the
// file. SharedClinicalContent reads it when an engine first loads its file, so a new release is used
// from the next launch.
//
// The content id of a file is its bundled `id` (the registry id: zebra-rules.json is
// "diagnostic-reasoning-zebras"); its schema is the bundled schemas/<file>.schema.json.
//
// Every read re-verifies the stored release against the bundled file of THIS build (hash, id,
// version strictly above the bundled one, schema, pinned fields): an app update that ships a newer
// bundled file wins automatically, and a damaged or edited file is ignored. Any failure → bundled.
// Clinical content, not patient data: nothing here is PHI.

import Foundation
import os

enum ApprovedContentStore {

    /// Folder of the bundled JSON Schemas (ios/project.yml: `../clinical-content/schemas`, type folder).
    static let schemaFolder = "schemas"

    private static let log = Logger(subsystem: "AmiseMedFlow", category: "ClinicalContent")

    private static var directory: URL? {
        guard let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            return nil
        }
        let dir = base.appendingPathComponent("ApprovedContent", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private static func fileURL(_ contentId: String) -> URL? {
        directory?.appendingPathComponent("\(contentId).release.json")
    }

    /// The release kept for a content id (not yet re-verified), or nil.
    static func storedRelease(_ contentId: String) -> ApprovedContent.Release? {
        guard let url = fileURL(contentId), let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(ApprovedContent.Release.self, from: data)
    }

    /// Keeps (or, with nil, removes) the release for a content id.
    static func store(_ release: ApprovedContent.Release?, for contentId: String) {
        guard let url = fileURL(contentId) else { return }
        guard let release else {
            try? FileManager.default.removeItem(at: url)
            return
        }
        guard let data = try? JSONEncoder().encode(release) else { return }
        try? data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    /// The bundled JSON Schema of a shared rule file (by file name).
    static func bundledSchema(_ fileName: String, bundle: Bundle = .main) -> ApprovedContent.Value? {
        let url = bundle.url(forResource: "\(fileName).schema", withExtension: "json", subdirectory: schemaFolder)
            ?? bundle.url(forResource: "\(fileName).schema", withExtension: "json")
        guard let url, let data = try? Data(contentsOf: url) else { return nil }
        return ApprovedContent.parse(data)
    }

    /// The content id (the bundled file's `id`) when the channel is enabled for it, else nil.
    static func contentId(bundledData: Data) -> String? {
        // Header keys only (cheap): every shared file is read here, most are not channel-enabled.
        guard let id = (try? JSONDecoder().decode(SharedClinicalContent.Stamp.self, from: bundledData))?.id,
              ApprovedContent.policy[id] != nil else { return nil }
        return id
    }

    /// Whether the channel is enabled for a bundled file (Settings → Diagnostics).
    static func isEnabled(_ file: SharedClinicalContent.File, bundle: Bundle = .main) -> Bool {
        guard let url = SharedClinicalContent.url(for: file, bundle: bundle),
              let data = try? Data(contentsOf: url) else { return false }
        return contentId(bundledData: data) != nil
    }

    /// The selection for one file from a list of releases, against this build's bundled file and
    /// schema. Nil when the channel is not enabled for the file or the bundled file / schema cannot be
    /// read (then nothing can be verified, so nothing overrides the bundled file).
    static func selection(for file: SharedClinicalContent.File, bundledData: Data,
                          releases: [ApprovedContent.Release], bundle: Bundle = .main) -> ApprovedContent.Selection? {
        guard let bundled = ApprovedContent.parse(bundledData),
              let id = bundled.objectValue?["id"]?.stringValue, ApprovedContent.policy[id] != nil,
              let schema = bundledSchema(file.schemaName, bundle: bundle) else { return nil }
        return ApprovedContent.selectForChannel(contentId: id, bundled: bundled, schema: schema, releases: releases)
    }

    /// The verified stored release of a file as JSON data for the engine's decoder, or nil (use the
    /// bundled file).
    static func activeRelease(for file: SharedClinicalContent.File, bundledData: Data,
                              bundle: Bundle = .main) -> (release: ApprovedContent.Release, data: Data)? {
        guard let id = contentId(bundledData: bundledData), let stored = storedRelease(id),
              let chosen = selection(for: file, bundledData: bundledData, releases: [stored], bundle: bundle),
              chosen.source == .release, let release = chosen.release,
              let text = try? ApprovedContent.canonicalJSON(release.body) else { return nil }
        return (release, Data(text.utf8))
    }

    /// After a fetch: keep the release in force for each channel-enabled file, or remove the stored
    /// one when the bundled file is in force (revoked, nothing newer, table absent). Returns the
    /// content ids whose stored release changed.
    @discardableResult
    static func apply(fetched releases: [ApprovedContent.Release], bundle: Bundle = .main) -> [String] {
        var changed: [String] = []
        for file in SharedClinicalContent.File.allCases {
            guard let url = SharedClinicalContent.url(for: file, bundle: bundle),
                  let data = try? Data(contentsOf: url),
                  let id = contentId(bundledData: data) else { continue }
            let mine = releases.filter { $0.content_id == id }
            let chosen = selection(for: file, bundledData: data, releases: mine, bundle: bundle)
            let keep = chosen?.source == .release ? chosen?.release : nil
            let before = storedRelease(id)
            if before?.sha256 != keep?.sha256 || before?.version != keep?.version {
                store(keep, for: id)
                changed.append(id)
                let version = keep?.version ?? "bundled"
                log.notice("Approved content \(id, privacy: .public): now \(version, privacy: .public) (from next launch)")
            }
            for r in chosen?.rejected ?? [] where r.reason != .notNewer && r.reason != .revoked {
                let reason = r.reason.rawValue
                let v = r.version
                log.error("Approved content \(id, privacy: .public) \(v, privacy: .public) not used: \(reason, privacy: .public)")
            }
        }
        return changed
    }
}
