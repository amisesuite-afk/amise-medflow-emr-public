// DiagnosticDatabaseInfo.swift
// Version stamp of the bundled clinical content file DiagnosticDatabase.json, and whether the
// differential engine could load it. Shown in Settings → Diagnostics and written to the
// unified log once per launch (when first read).
//
// Read-only and additive: it reads only the metadata keys (version, updated, lastUpdated,
// sources and the pool names) with its own small Decodable, and reports whether
// `BayesianDiagnosisEngine.externalDatabase` decoded. It never changes the database, the
// engine or any result. When the engine could not decode the file (for example a value whose
// JSON type does not match `CandidateSpec`), the engine uses its built-in candidate lists;
// this surfaces that silently-handled case so it can be seen and reported.
//
// Registry entry: ios-bayesian-diagnostic-database in clinical-content/registry.json.
// Design: docs/CLINICAL-CONTENT-UPGRADES.md.

import Foundation
import os

enum DiagnosticDatabaseInfo {

    /// Only the metadata keys. Every other key in the file is ignored by the decoder.
    struct Stamp: Decodable {
        let version: String?
        let updated: String?
        let lastUpdated: String?
        let sources: [String]?
        let pools: [String: Opaque]?

        /// Decodes any JSON object without reading its contents.
        struct Opaque: Decodable {}
    }

    struct Status: Sendable {
        /// The file is in the app bundle.
        let fileFound: Bool
        /// The metadata keys could be read.
        let stampReadable: Bool
        let version: String
        let updated: String
        let sources: [String]
        let poolCount: Int
        /// `BayesianDiagnosisEngine.externalDatabase` decoded, so the differential uses this file.
        let engineLoaded: Bool
        /// Why the engine could not decode the file: error kind and key path only (no values).
        let engineError: String?

        var versionText: String {
            guard fileFound else { return "Not in this build" }
            guard stampReadable else { return "Unreadable" }
            return version
        }

        var engineText: String {
            engineLoaded ? "Using the database (\(poolCount) pools)" : "Built-in fallback lists"
        }
    }

    private static let log = Logger(subsystem: "AmiseMedFlow", category: "ClinicalContent")

    /// Computed once, on first use (Settings → Diagnostics), then logged.
    static let current: Status = {
        let status = load()
        let version = status.versionText
        let updated = status.updated
        let loaded = status.engineLoaded ? "yes" : "no"
        log.notice("DiagnosticDatabase version \(version, privacy: .public), updated \(updated, privacy: .public), engine loaded: \(loaded, privacy: .public)")
        if let error = status.engineError {
            log.error("DiagnosticDatabase not used by the differential engine: \(error, privacy: .public)")
        }
        return status
    }()

    static func load(bundle: Bundle = .main) -> Status {
        guard let url = bundle.url(forResource: "DiagnosticDatabase", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            return Status(fileFound: false, stampReadable: false, version: "—", updated: "—",
                          sources: [], poolCount: 0, engineLoaded: false,
                          engineError: "DiagnosticDatabase.json is not in the app bundle")
        }

        let stamp = try? JSONDecoder().decode(Stamp.self, from: data)
        let engineLoaded = BayesianDiagnosisEngine.externalDatabase != nil

        var engineError: String?
        if !engineLoaded {
            // Same decode the engine performs, repeated only to explain why it failed.
            do {
                _ = try JSONDecoder().decode(BayesianDiagnosisEngine.CandidateDatabase.self, from: data)
            } catch {
                engineError = describe(error)
            }
        }

        return Status(
            fileFound: true,
            stampReadable: stamp != nil,
            version: stamp?.version ?? "—",
            updated: stamp?.updated ?? stamp?.lastUpdated ?? "—",
            sources: stamp?.sources ?? [],
            poolCount: stamp?.pools?.count ?? 0,
            engineLoaded: engineLoaded,
            engineError: engineError
        )
    }

    /// Error kind and coding path only, e.g. "Missing key 'evidenceLabel' at
    /// pools.abdominalPain.candidates[3].features[2]". Never includes a value.
    static func describe(_ error: Error) -> String {
        guard let decodingError = error as? DecodingError else { return "Unreadable file" }

        func path(_ keys: [CodingKey]) -> String {
            var out = ""
            for key in keys {
                if let index = key.intValue {
                    out += "[\(index)]"
                } else {
                    out += out.isEmpty ? key.stringValue : "." + key.stringValue
                }
            }
            return out.isEmpty ? "top level" : out
        }

        switch decodingError {
        case .typeMismatch(let type, let context):
            return "Wrong type (expected \(type)) at \(path(context.codingPath))"
        case .valueNotFound(let type, let context):
            return "Missing value (\(type)) at \(path(context.codingPath))"
        case .keyNotFound(let key, let context):
            return "Missing key '\(key.stringValue)' at \(path(context.codingPath))"
        case .dataCorrupted(let context):
            return "Unreadable value at \(path(context.codingPath))"
        @unknown default:
            return "Unreadable file"
        }
    }
}
