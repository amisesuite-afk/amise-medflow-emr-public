// SharedClinicalContent.swift
// Clinical rule files shared with the web dashboard: one rule and content library for both
// platforms. The files are clinical-content/rules/<name>.json at the repository root, bundled
// into the app as the folder reference "rules" (ios/project.yml: `path: ../clinical-content/rules`,
// `type: folder`), so a new file needs no per-file registration. The web imports the same files.
// Change the JSON, not a platform copy.
//
// Each engine decodes its file once with its own Codable structs (for example
// `ZebraCheck.RuleFile`, `SupplementCatalogue.Content`, `LifestylePractices.Content`) through
// `load(_:_:)`. A missing file or a decode failure never crashes and never guesses: the engine
// gets nil and shows nothing (no zebra, no supplement prompt, no lifestyle prompt), the failure is
// written to the unified log, and Settings → Diagnostics lists every file with its version or
// the reason it could not be read (`statuses()`, ClinicalContentDiagnosticsRows.swift).
//
// `lint:shared-content` (scripts/src/shared-content.ts) validates every file against its JSON
// Schema (clinical-content/schemas/) and checks the Codable field names, optionality and types
// against it, that `File` lists every file, and that project.yml bundles the folder.
// Registry: clinical-content/registry.json. Design: docs/SHARED-CONTENT-PLAN.md.

import Foundation
import os

enum SharedClinicalContent {

    /// Name of the folder reference in the app bundle.
    static let bundleFolder = "rules"

    /// Every shared rule file this build reads (the raw value is the file name without ".json").
    /// lint:shared-content fails when a clinical-content/rules/*.json file has no case here.
    enum File: String, CaseIterable {
        case zebraRules = "zebra-rules"
        case supplementCatalogue = "supplement-catalogue"
        case lifestylePractices = "lifestyle-practices"

        /// Row title in Settings → Diagnostics.
        var title: String {
            switch self {
            case .zebraRules:          return "Zebra rules"
            case .supplementCatalogue: return "Supplement catalogue"
            case .lifestylePractices:  return "Lifestyle practices"
            }
        }
    }

    /// Why a file could not be used: error kind and key path only (never a value).
    struct LoadError: Error, Sendable {
        let text: String
    }

    /// Only the header keys every rule file has.
    struct Stamp: Decodable {
        let id: String?
        let version: String?
    }

    struct Status: Identifiable, Sendable {
        /// File name without ".json".
        let file: String
        let title: String
        /// The file is in the app bundle.
        let found: Bool
        /// The engine's Codable structs decode it, so the feature uses it.
        let loaded: Bool
        let version: String
        let error: String?

        var id: String { file }

        var valueText: String {
            guard found else { return "Not in this build" }
            return loaded ? version : "Not loaded"
        }
    }

    private static let log = Logger(subsystem: "AmiseMedFlow", category: "ClinicalContent")

    /// The bundled file, in the "rules" folder (or at the bundle root, if it was ever copied flat).
    static func url(for file: File, bundle: Bundle = .main) -> URL? {
        bundle.url(forResource: file.rawValue, withExtension: "json", subdirectory: bundleFolder)
            ?? bundle.url(forResource: file.rawValue, withExtension: "json")
    }

    /// Decodes a shared rule file with the engine's Codable type.
    static func decode<T: Decodable>(_ type: T.Type, _ file: File, bundle: Bundle = .main) -> Result<T, LoadError> {
        guard let fileURL = url(for: file, bundle: bundle), let data = try? Data(contentsOf: fileURL) else {
            return .failure(LoadError(text: "\(file.rawValue).json is not in the app bundle"))
        }
        do {
            return .success(try JSONDecoder().decode(type, from: data))
        } catch {
            return .failure(LoadError(text: DiagnosticDatabaseInfo.describe(error)))
        }
    }

    /// The decoded file, or nil when it is missing or does not decode (logged; Settings →
    /// Diagnostics shows why). Callers treat nil as "no content": they show nothing.
    static func load<T: Decodable>(_ type: T.Type, _ file: File, bundle: Bundle = .main) -> T? {
        switch decode(type, file, bundle: bundle) {
        case .success(let value):
            return value
        case .failure(let failure):
            let name = file.rawValue
            let reason = failure.text
            log.error("Shared clinical rules \(name, privacy: .public).json not used: \(reason, privacy: .public)")
            return nil
        }
    }

    /// Status of one file, decoded with the same type its engine uses.
    static func status(of file: File, bundle: Bundle = .main) -> Status {
        let failure: String?
        switch file {
        case .zebraRules:
            failure = errorText(decode(ZebraCheck.RuleFile.self, file, bundle: bundle))
        case .supplementCatalogue:
            failure = errorText(decode(SupplementCatalogue.Content.self, file, bundle: bundle))
        case .lifestylePractices:
            failure = errorText(decode(LifestylePractices.Content.self, file, bundle: bundle))
        }
        let fileURL = url(for: file, bundle: bundle)
        let stamp = fileURL
            .flatMap { try? Data(contentsOf: $0) }
            .flatMap { try? JSONDecoder().decode(Stamp.self, from: $0) }
        return Status(file: file.rawValue, title: file.title, found: fileURL != nil, loaded: failure == nil,
                      version: stamp?.version ?? "—", error: failure)
    }

    /// Every shared rule file (Settings → Diagnostics).
    static func statuses(bundle: Bundle = .main) -> [Status] {
        File.allCases.map { status(of: $0, bundle: bundle) }
    }

    private static func errorText<T>(_ result: Result<T, LoadError>) -> String? {
        if case .failure(let failure) = result { return failure.text }
        return nil
    }
}
