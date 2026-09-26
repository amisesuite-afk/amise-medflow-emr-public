// SharedClinicalContent.swift
// Clinical rule files shared with the web dashboard: one rule and content library for both
// platforms. The files are clinical-content/rules/<name>.json at the repository root, bundled
// into the app as the folder reference "rules" (ios/project.yml: `path: ../clinical-content/rules`,
// `type: folder`), so a new file needs no per-file registration. The web imports the same files.
// Change the JSON, not a platform copy. The disease-centred vademecum (phase 1, decoded only) is
// clinical-content/vademecum/<name>.json, bundled the same way as the folder "vademecum".
//
// Each engine decodes its file once with its own Codable structs (for example
// `ZebraCheck.RuleFile`, `SupplementCatalogue.Content`, `LifestylePractices.Content`,
// `ExamEvidenceCatalogue.SignsFile` / `.RulesFile`, `DiagnosticReasoningRules.RuleFile`,
// `TreatmentDecisions.Content`, `WhatsMissing.Rules`) through
// `load(_:_:)`. A missing file or a decode failure never crashes and never guesses: the engine
// gets nil and shows nothing (no zebra, no supplement prompt, no lifestyle prompt), the failure is
// written to the unified log, and Settings → Diagnostics lists every file with its version or
// the reason it could not be read (`statuses()`, ClinicalContentDiagnosticsRows.swift).
//
// `lint:shared-content` (scripts/src/shared-content.ts) validates every file against its JSON
// Schema (clinical-content/schemas/) and checks the Codable field names, optionality and types
// against it, that `File` lists every file, and that project.yml bundles the folder.
// Registry: clinical-content/registry.json. Design: docs/SHARED-CONTENT-PLAN.md.
//
// Approved-content channel (docs/APPROVED-CONTENT-CHANNEL.md): for the files the channel is enabled
// for (ApprovedContent.policy), a signed-off release published in Supabase and kept on the device by
// ApprovedContentStore replaces the bundled copy — only after it is verified again against this
// build's bundled file and schema, and only if the engine's own Codable structs decode it. Any
// failure falls back to the bundled file. Settings → Diagnostics shows which copy each file uses.

import Foundation
import os

enum SharedClinicalContent {

    /// Name of the folder reference in the app bundle (the rule files).
    static let bundleFolder = "rules"

    /// Name of the vademecum folder reference in the app bundle (clinical-content/vademecum).
    static let vademecumFolder = "vademecum"

    /// Every shared rule file this build reads (the raw value is the file name without ".json").
    /// lint:shared-content fails when a clinical-content/rules/*.json file has no case here.
    enum File: String, CaseIterable {
        case zebraRules = "zebra-rules"
        case supplementCatalogue = "supplement-catalogue"
        case lifestylePractices = "lifestyle-practices"
        case examSigns = "exam-signs"
        case decisionRules = "decision-rules"
        case diagnosticReasoningRules = "diagnostic-reasoning-rules"
        case vademecumFindings = "findings"
        case vademecumAbdominalPain = "abdominal-pain"
        case vademecumCoughBreathlessness = "cough-breathlessness"

        /// The bundle folder the file is in.
        var folder: String {
            switch self {
            case .vademecumFindings, .vademecumAbdominalPain, .vademecumCoughBreathlessness:
                return SharedClinicalContent.vademecumFolder
            default:
                return SharedClinicalContent.bundleFolder
            }
        }

        /// The vademecum area files (each decodes as `VademecumContent.AreaFile`).
        static let vademecumAreas: [File] = [.vademecumAbdominalPain, .vademecumCoughBreathlessness]
        case treatmentDecisions = "treatment-decisions"
        case whatsMissingRules = "whats-missing-rules"

        /// Row title in Settings → Diagnostics.
        var title: String {
            switch self {
            case .zebraRules:          return "Zebra rules"
            case .supplementCatalogue: return "Supplement catalogue"
            case .lifestylePractices:  return "Lifestyle practices"
            case .examSigns:           return "Examination signs"
            case .decisionRules:       return "Decision rules"
            case .diagnosticReasoningRules: return "Diagnostic reasoning rules"
            case .vademecumFindings:   return "Vademecum findings (shadow)"
            case .vademecumAbdominalPain: return "Vademecum: abdominal pain (shadow)"
            case .vademecumCoughBreathlessness: return "Vademecum: cough / breathlessness (shadow)"
            case .treatmentDecisions:  return "Treatment decisions"
            case .whatsMissingRules:   return "What's missing rules"
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
        /// Which copy is in use: bundled, or an approved release (Settings → Diagnostics).
        var source: ContentSource = .bundled
        /// Version of the bundled file (differs from `version` when a release is in use).
        var bundledVersion: String = "—"
        /// The approved-content channel is enabled for this file (ApprovedContent.policy).
        var channelEnabled: Bool = false

        var id: String { file }

        /// "Bundled 1.0.0", or "Approved release 1.0.1 · sha 1a2b3c4d (bundled 1.0.0)".
        var sourceText: String {
            switch source {
            case .bundled:
                return "Bundled \(bundledVersion)"
            case .release(let version, let sha256):
                return "Approved release \(version) · sha \(sha256.prefix(8)) (bundled \(bundledVersion))"
            }
        }

        var valueText: String {
            guard found else { return "Not in this build" }
            return loaded ? version : "Not loaded"
        }
    }

    private static let log = Logger(subsystem: "AmiseMedFlow", category: "ClinicalContent")

    /// The bundled file, in its folder ("rules" or "vademecum"; or at the bundle root, if it was
    /// ever copied flat).
    static func url(for file: File, bundle: Bundle = .main) -> URL? {
        bundle.url(forResource: file.rawValue, withExtension: "json", subdirectory: file.folder)
            ?? bundle.url(forResource: file.rawValue, withExtension: "json")
    }

    /// Decodes a shared rule file with the engine's Codable type: the verified approved release when
    /// there is one and it decodes (ApprovedContentStore), otherwise the bundled file.
    static func decode<T: Decodable>(_ type: T.Type, _ file: File, bundle: Bundle = .main) -> Result<T, LoadError> {
        decodeWithSource(type, file, bundle: bundle).result
    }

    /// Which copy a file uses: the bundled file, or an approved release (version and hash).
    enum ContentSource: Sendable, Equatable {
        case bundled
        case release(version: String, sha256: String)
    }

    /// decode, and which copy it used. A release that the engine's structs cannot decode is skipped
    /// (logged) and the bundled file is decoded instead.
    static func decodeWithSource<T: Decodable>(_ type: T.Type, _ file: File,
                                               bundle: Bundle = .main) -> (result: Result<T, LoadError>, source: ContentSource) {
        guard let fileURL = url(for: file, bundle: bundle), let data = try? Data(contentsOf: fileURL) else {
            return (.failure(LoadError(text: "\(file.rawValue).json is not in the app bundle")), .bundled)
        }
        if let active = ApprovedContentStore.activeRelease(for: file, bundledData: data, bundle: bundle) {
            do {
                let value = try JSONDecoder().decode(type, from: active.data)
                return (.success(value), .release(version: active.release.version, sha256: active.release.sha256))
            } catch {
                let name = file.rawValue
                let version = active.release.version
                let reason = DiagnosticDatabaseInfo.describe(error)
                log.error("Approved release \(version, privacy: .public) of \(name, privacy: .public) does not decode, bundled file used: \(reason, privacy: .public)")
            }
        }
        do {
            return (.success(try JSONDecoder().decode(type, from: data)), .bundled)
        } catch {
            return (.failure(LoadError(text: DiagnosticDatabaseInfo.describe(error))), .bundled)
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
        let checked: (failure: String?, source: ContentSource)
        switch file {
        case .zebraRules:
            checked = errorAndSource(decodeWithSource(ZebraCheck.RuleFile.self, file, bundle: bundle))
        case .supplementCatalogue:
            checked = errorAndSource(decodeWithSource(SupplementCatalogue.Content.self, file, bundle: bundle))
        case .lifestylePractices:
            checked = errorAndSource(decodeWithSource(LifestylePractices.Content.self, file, bundle: bundle))
        case .examSigns:
            checked = errorAndSource(decodeWithSource(ExamEvidenceCatalogue.SignsFile.self, file, bundle: bundle))
        case .decisionRules:
            checked = errorAndSource(decodeWithSource(ExamEvidenceCatalogue.RulesFile.self, file, bundle: bundle))
        case .diagnosticReasoningRules:
            checked = errorAndSource(decodeWithSource(DiagnosticReasoningRules.RuleFile.self, file, bundle: bundle))
        case .vademecumFindings:
            checked = errorAndSource(decodeWithSource(VademecumContent.FindingsFile.self, file, bundle: bundle))
        case .vademecumAbdominalPain, .vademecumCoughBreathlessness:
            checked = errorAndSource(decodeWithSource(VademecumContent.AreaFile.self, file, bundle: bundle))
        case .treatmentDecisions:
            checked = errorAndSource(decodeWithSource(TreatmentDecisions.Content.self, file, bundle: bundle))
            checked = errorAndSource(decodeWithSource(TreatmentDecisions.Content.self, file, bundle: bundle))
        case .whatsMissingRules:
            checked = errorAndSource(decodeWithSource(WhatsMissing.Rules.self, file, bundle: bundle))
        }
        let failure = checked.failure
        let source = checked.source
        let fileURL = url(for: file, bundle: bundle)
        let stamp = fileURL
            .flatMap { try? Data(contentsOf: $0) }
            .flatMap { try? JSONDecoder().decode(Stamp.self, from: $0) }
        let bundledVersion = stamp?.version ?? "—"
        var version = bundledVersion
        if case .release(let releaseVersion, _) = source { version = releaseVersion }
        return Status(file: file.rawValue, title: file.title, found: fileURL != nil, loaded: failure == nil,
                      version: version, error: failure, source: source, bundledVersion: bundledVersion,
                      channelEnabled: ApprovedContentStore.isEnabled(file, bundle: bundle))
    }

    /// Every shared rule file (Settings → Diagnostics).
    static func statuses(bundle: Bundle = .main) -> [Status] {
        File.allCases.map { status(of: $0, bundle: bundle) }
    }

    private static func errorText<T>(_ result: Result<T, LoadError>) -> String? {
        if case .failure(let failure) = result { return failure.text }
        return nil
    }

    private static func errorAndSource<T>(
        _ decoded: (result: Result<T, LoadError>, source: ContentSource)
    ) -> (failure: String?, source: ContentSource) {
        (errorText(decoded.result), decoded.source)
    }
}
