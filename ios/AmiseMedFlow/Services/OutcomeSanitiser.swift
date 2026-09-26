// OutcomeSanitiser.swift
// Swift twin of the outcomes-loop sanitisers in lib/triage-engine/src/outcomes/codes.ts
// (sanitizeSnapshot, sanitizeFinalDiagnosis, snapshotToRow, outcomeToRow, rowToOutcome). Every value
// iOS sends to prediction_snapshots / diagnosis_outcomes (Migration 94) goes through these first, so
// a malformed or free-text value is dropped on the device exactly as the web and the API server drop
// it, and nothing the Migration 94 CHECK constraints refuse is ever sent.
//
// Shared vectors: ios/AmiseMedFlowTests/Resources/OutcomeSanitiserVectors.json. The iOS test
// (OutcomeSyncTests.swift) runs them through this file; the web test
// (artifacts/dashboard/src/lib/__tests__/outcomes-sanitiser-vectors.test.ts) runs the same file
// through the TypeScript sanitisers. Change both platforms together.
//
// Pure: no network, no SwiftData, no clock.

import Foundation

// MARK: - Sanitised values (the TypeScript PredictionSnapshot / FinalDiagnosis shapes)

struct OutcomeSanitisedSnapshot: Codable, Equatable {
    var snapshotVersion: Int
    var platform: String
    var encounterRef: String
    var completedAt: String
    var differentialEngine: String
    var differentialModelVersion: String
    var modelVersions: [String: String]
    var topDifferential: [OutcomeDifferentialEntry]
    var triageLevel: String?
    var triageScale: String?
    var scores: [OutcomeScore]
    var decisionBands: [OutcomeBand]
    var features: [String: Bool]
    var workingDiseaseId: String?
    var workingIcd10: String?
    var recordedIcd10: [String]
    var expectsOutcome: Bool
    var outcomeTriggers: [String]
}

struct OutcomeSanitisedFinalDiagnosis: Codable, Equatable {
    var encounterRef: String
    var finalIcd10: String
    var finalDiseaseId: String?
    var sourceType: String
    var sourceDate: String
    var actionsTaken: [OutcomeActionTaken]
    var retrospectiveAcuity: String?
    var status: String
    var confirmedAt: String?
}

struct OutcomeSanitiseError: Error, Equatable {
    let message: String
}

// MARK: - Server rows (Migration 94 column names)

/// The `prediction_snapshots` INSERT body. `encounter_id` is always null for iOS (the encounter is
/// local; `encounter_ref` = "ios:<Encounter.syncCode>" is the key).
struct PredictionSnapshotInsertRow: Encodable, Equatable {
    let patient_id: String
    let encounter_ref: String
    let platform: String
    let completed_at: String
    let snapshot_version: Int
    let differential_engine: String
    let differential_model_version: String
    let model_versions: [String: String]
    let top_differential: [OutcomeDifferentialEntry]
    let triage_level: String?
    let triage_scale: String?
    let scores: [OutcomeScore]
    let decision_bands: [OutcomeBand]
    let features: [String: Bool]
    let working_disease_id: String?
    let working_icd10: String?
    let recorded_icd10: [String]
    let expects_outcome: Bool
    let outcome_triggers: [String]
    let created_by: String?
}

/// The `diagnosis_outcomes` INSERT body. A record that was confirmed and then retracted on this
/// device before it ever reached the server is inserted as retracted (status + retracted_at), so
/// the server keeps what was recorded and when, as the retract-not-delete rule requires.
struct DiagnosisOutcomeInsertRow: Encodable, Equatable {
    let patient_id: String
    let encounter_ref: String
    let client_ref: String?
    let final_icd10: String
    let final_disease_id: String?
    let source_type: String
    let source_date: String
    let actions_taken: [OutcomeActionTaken]
    let retrospective_acuity: String?
    let status: String
    let confirmed_by: String?
    let confirmed_at: String?
    let retracted_by: String?
    let retracted_at: String?
}

/// A `diagnosis_outcomes` row as the pull reads it.
struct DiagnosisOutcomeServerRow: Decodable, Equatable {
    let id: String
    let encounter_ref: String
    let client_ref: String?
    let final_icd10: String
    let final_disease_id: String?
    let source_type: String
    let source_date: String
    let actions_taken: [OutcomeActionTaken]?
    let retrospective_acuity: String?
    let status: String
    let confirmed_at: String?
    let retracted_at: String?
}

// MARK: - Sanitisers

enum OutcomeSanitiser {

    static let sourceTypes = ["histology", "report_import", "operative_findings", "operative_note",
                              "discharge_summary", "follow_up", "other"]
    static let commonAcuities = ["emergency", "urgent", "soon", "routine"]
    static let webTriage: Set<String> = ["urgent", "priority", "review", "routine"]
    static let iosTriage: Set<String> = ["emergency", "urgent", "priority", "routine"]
    static let bandValues: Set<String> = ["observe", "test", "treat", "not-for-patient", "unknown"]
    static let scoreSources: Set<String> = ["calculator", "record", "autofill"]

    // MARK: Character-class checks (the codes.ts regular expressions, without regex anchors)

    private static let lowerDigits = Set("abcdefghijklmnopqrstuvwxyz0123456789")
    private static let upperLetters = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    private static let digits = Set("0123456789")
    private static let alnum = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789")

    private static func only(_ s: String, _ allowed: Set<Character>, min: Int, max: Int) -> Bool {
        s.count >= min && s.count <= max && s.allSatisfy { allowed.contains($0) }
    }

    /// DISEASE_ID_RE ^[a-z0-9_]{1,80}$
    static func isDiseaseId(_ s: String) -> Bool { only(s, lowerDigits.union(["_"]), min: 1, max: 80) }
    /// KEY_RE ^[A-Za-z0-9_.:-]{1,80}$
    static func isKey(_ s: String) -> Bool { only(s, alnum.union(["_", ".", ":", "-"]), min: 1, max: 80) }
    /// VERSION_RE ^[0-9A-Za-z.+_-]{1,32}$
    static func isVersion(_ s: String) -> Bool { only(s, alnum.union([".", "+", "_", "-"]), min: 1, max: 32) }
    /// CLIENT_REF_RE ^[A-Za-z0-9:-]{1,80}$
    static func isClientRef(_ s: String) -> Bool { only(s, alnum.union([":", "-"]), min: 1, max: 80) }
    /// ENCOUNTER_REF_RE ^(web|ios):[A-Za-z0-9-]{1,64}$
    static func isEncounterRef(_ s: String) -> Bool {
        for prefix in ["web:", "ios:"] where s.hasPrefix(prefix) {
            return only(String(s.dropFirst(prefix.count)), alnum.union(["-"]), min: 1, max: 64)
        }
        return false
    }

    static func normaliseDiseaseId(_ raw: String?) -> String? {
        guard let raw, isDiseaseId(raw) else { return nil }
        return raw
    }

    /// Math.round(min(1, max(0, v)) × 10000) / 10000; nil for a missing or non-finite value.
    static func probability(_ v: Double?) -> Double? {
        guard let v, v.isFinite else { return nil }
        return (min(1, max(0, v)) * 10000).rounded() / 10000
    }

    // MARK: Dates

    private static func isoFormatter(fractional: Bool) -> ISO8601DateFormatter {
        let f = ISO8601DateFormatter()
        f.formatOptions = fractional ? [.withInternetDateTime, .withFractionalSeconds] : [.withInternetDateTime]
        return f
    }

    /// Parses the ISO 8601 forms the apps write ("…Z", "…+00:00", with or without milliseconds,
    /// or a bare "YYYY-MM-DD" read as UTC midnight, as Date.parse does).
    static func parseISODate(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        if let d = isoFormatter(fractional: true).date(from: raw) { return d }
        if let d = isoFormatter(fractional: false).date(from: raw) { return d }
        if raw.count == 10, normaliseSourceDate(raw, minimum: "0000-01-01") != nil {
            return isoFormatter(fractional: false).date(from: raw + "T00:00:00Z")
        }
        return nil
    }

    /// `new Date(t).toISOString()`: UTC with milliseconds, e.g. "2026-09-21T14:13:20.000Z".
    static func isoDate(_ raw: String?) -> String? {
        guard let d = parseISODate(raw) else { return nil }
        return isoFormatter(fractional: true).string(from: d)
    }

    /// YYYY-MM-DD, a real calendar date, not before 2000 (normaliseSourceDate).
    static func normaliseSourceDate(_ raw: String?, minimum: String = "2000-01-01") -> String? {
        guard let raw, raw.count == 10 else { return nil }
        let c = Array(raw)
        guard c[4] == "-", c[7] == "-",
              [0, 1, 2, 3, 5, 6, 8, 9].allSatisfy({ digits.contains(c[$0]) }),
              let y = Int(String(c[0...3])), let m = Int(String(c[5...6])), let d = Int(String(c[8...9])) else { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? .current
        guard let date = cal.date(from: DateComponents(year: y, month: m, day: d)) else { return nil }
        let back = cal.dateComponents([.year, .month, .day], from: date)
        guard back.year == y, back.month == m, back.day == d else { return nil }
        return raw >= minimum ? raw : nil
    }

    // MARK: Snapshot

    static func sanitizeSnapshot(_ s: OutcomePredictionRecord) -> Result<OutcomeSanitisedSnapshot, OutcomeSanitiseError> {
        guard s.platform == "web" || s.platform == "ios" else {
            return .failure(.init(message: "platform must be web or ios"))
        }
        guard isEncounterRef(s.encounterRef), s.encounterRef.hasPrefix("\(s.platform):") else {
            return .failure(.init(message: "invalid encounterRef"))
        }
        guard let completedAt = isoDate(s.completedAt) else {
            return .failure(.init(message: "invalid completedAt"))
        }
        guard s.differentialEngine == "pane" || s.differentialEngine == "ios-bayes" else {
            return .failure(.init(message: "invalid differentialEngine"))
        }
        guard isVersion(s.differentialModelVersion) else {
            return .failure(.init(message: "invalid differentialModelVersion"))
        }

        var differential: [OutcomeDifferentialEntry] = []
        for raw in s.topDifferential {
            let diseaseId = normaliseDiseaseId(raw.diseaseId)
            let icd10 = OutcomeCodes.normaliseICD10(raw.icd10)
            if diseaseId == nil && icd10 == nil { continue }
            differential.append(OutcomeDifferentialEntry(rank: differential.count + 1, diseaseId: diseaseId,
                                                         icd10: icd10, probability: probability(raw.probability)))
            if differential.count == 10 { break }
        }

        var scores: [OutcomeScore] = []
        var seenScores = Set<String>()
        for raw in s.scores {
            guard isKey(raw.key), raw.value.isFinite, !seenScores.contains(raw.key) else { continue }
            seenScores.insert(raw.key)
            scores.append(OutcomeScore(key: raw.key, value: raw.value,
                                       source: scoreSources.contains(raw.source) ? raw.source : "record"))
            if scores.count == 60 { break }
        }

        var bands: [OutcomeBand] = []
        for raw in s.decisionBands {
            guard isKey(raw.decisionId), isKey(raw.optionId) else { continue }
            bands.append(OutcomeBand(decisionId: raw.decisionId, optionId: raw.optionId,
                                     kind: isKey(raw.kind) ? raw.kind : "unknown",
                                     band: bandValues.contains(raw.band) ? raw.band : "unknown",
                                     probability: probability(raw.probability)))
            if bands.count == 60 { break }
        }

        // Object key order is not defined in Swift dictionaries; the server stores jsonb (unordered),
        // so the 200-feature cap takes the keys in sorted order to stay deterministic.
        var features: [String: Bool] = [:]
        for key in s.features.keys.sorted() where isKey(key) {
            features[key] = s.features[key]
            if features.count == 200 { break }
        }

        var versions: [String: String] = [:]
        for (key, value) in s.modelVersions where isKey(key) && isVersion(value) { versions[key] = value }

        var triageLevel: String? = nil
        var triageScale: String? = nil
        if let level = s.triageLevel {
            if s.triageScale == "web-adaptive" && webTriage.contains(level) { triageLevel = level; triageScale = "web-adaptive" }
            if s.triageScale == "ios-acuity" && iosTriage.contains(level) { triageLevel = level; triageScale = "ios-acuity" }
        }

        var triggers: [String] = []
        for t in s.outcomeTriggers where (t == "operation" || t == "pathology") && !triggers.contains(t) {
            triggers.append(t)
        }

        var recorded: [String] = []
        for raw in s.recordedIcd10 {
            if let code = OutcomeCodes.normaliseICD10(raw), !recorded.contains(code) { recorded.append(code) }
        }
        if recorded.count > 20 { recorded = Array(recorded.prefix(20)) }

        return .success(OutcomeSanitisedSnapshot(
            snapshotVersion: 1,
            platform: s.platform,
            encounterRef: s.encounterRef,
            completedAt: completedAt,
            differentialEngine: s.differentialEngine,
            differentialModelVersion: s.differentialModelVersion,
            modelVersions: versions,
            topDifferential: differential,
            triageLevel: triageLevel,
            triageScale: triageScale,
            scores: scores,
            decisionBands: bands,
            features: features,
            workingDiseaseId: normaliseDiseaseId(s.workingDiseaseId),
            workingIcd10: OutcomeCodes.normaliseICD10(s.workingIcd10),
            recordedIcd10: recorded,
            expectsOutcome: !triggers.isEmpty,
            outcomeTriggers: triggers
        ))
    }

    // MARK: Final diagnosis

    static func sanitizeFinalDiagnosis(_ s: OutcomeFinalDiagnosisRecord) -> Result<OutcomeSanitisedFinalDiagnosis, OutcomeSanitiseError> {
        guard isEncounterRef(s.encounterRef) else { return .failure(.init(message: "invalid encounterRef")) }
        guard let finalIcd10 = OutcomeCodes.normaliseICD10(s.finalIcd10) else {
            return .failure(.init(message: "a valid ICD-10 code is required"))
        }
        guard sourceTypes.contains(s.sourceType) else { return .failure(.init(message: "invalid source type")) }
        guard let sourceDate = normaliseSourceDate(s.sourceDate) else { return .failure(.init(message: "invalid source date")) }
        let acuity = s.retrospectiveAcuity.flatMap { commonAcuities.contains($0) ? $0 : nil }
        var actions: [OutcomeActionTaken] = []
        var seen = Set<String>()
        for a in s.actionsTaken where isKey(a.optionId) && !seen.contains(a.optionId) {
            seen.insert(a.optionId)
            actions.append(a)
            if actions.count == 60 { break }
        }
        return .success(OutcomeSanitisedFinalDiagnosis(
            encounterRef: s.encounterRef, finalIcd10: finalIcd10, finalDiseaseId: normaliseDiseaseId(s.finalDiseaseId),
            sourceType: s.sourceType, sourceDate: sourceDate, actionsTaken: actions, retrospectiveAcuity: acuity,
            status: s.status == "retracted" ? "retracted" : "confirmed",
            confirmedAt: isoDate(s.confirmedAt)))
    }

    // MARK: Rows

    private static func uuidOrNil(_ raw: String?) -> String? {
        guard let raw, UUID(uuidString: raw) != nil else { return nil }
        return raw
    }

    /// snapshotToRow for an iOS snapshot (encounter_id null). The patient id must be a server
    /// row id (SyncRemoteId.serverId); nil when it is not.
    static func snapshotRow(_ s: OutcomeSanitisedSnapshot, patientId: String, createdBy: String?) -> PredictionSnapshotInsertRow? {
        guard let patientId = SyncRemoteId.serverId(patientId) else { return nil }
        return PredictionSnapshotInsertRow(
            patient_id: patientId, encounter_ref: s.encounterRef, platform: s.platform,
            completed_at: s.completedAt, snapshot_version: s.snapshotVersion,
            differential_engine: s.differentialEngine, differential_model_version: s.differentialModelVersion,
            model_versions: s.modelVersions, top_differential: s.topDifferential,
            triage_level: s.triageLevel, triage_scale: s.triageScale, scores: s.scores,
            decision_bands: s.decisionBands, features: s.features,
            working_disease_id: s.workingDiseaseId, working_icd10: s.workingIcd10,
            recorded_icd10: s.recordedIcd10, expects_outcome: s.expectsOutcome,
            outcome_triggers: s.outcomeTriggers, created_by: uuidOrNil(createdBy))
    }

    /// outcomeToRow, plus the retraction columns for a record retracted before it was sent.
    /// `retractedAt` must be a valid timestamp when the record is retracted (Migration 94
    /// diagnosis_outcomes_status_check); nil otherwise.
    static func outcomeRow(_ o: OutcomeSanitisedFinalDiagnosis, patientId: String, clientRef: String?,
                           userId: String?, retractedAt: String?) -> DiagnosisOutcomeInsertRow? {
        guard let patientId = SyncRemoteId.serverId(patientId) else { return nil }
        let retracted = o.status == "retracted"
        let retractedStamp = retracted ? isoDate(retractedAt) : nil
        if retracted && retractedStamp == nil { return nil }
        return DiagnosisOutcomeInsertRow(
            patient_id: patientId, encounter_ref: o.encounterRef,
            client_ref: clientRef.flatMap { isClientRef($0) ? $0 : nil },
            final_icd10: o.finalIcd10, final_disease_id: o.finalDiseaseId,
            source_type: o.sourceType, source_date: o.sourceDate, actions_taken: o.actionsTaken,
            retrospective_acuity: o.retrospectiveAcuity, status: retracted ? "retracted" : "confirmed",
            confirmed_by: uuidOrNil(userId), confirmed_at: o.confirmedAt,
            retracted_by: retracted ? uuidOrNil(userId) : nil, retracted_at: retractedStamp)
    }

    /// rowToOutcome: a pulled row back to a local record, through the same sanitiser (a bad row is
    /// ignored). The record is already on the server: not pending, remoteId = the row id.
    static func record(fromServerRow row: DiagnosisOutcomeServerRow) -> OutcomeFinalDiagnosisRecord? {
        guard let rowId = SyncRemoteId.serverId(row.id) else { return nil }
        let clientRef = row.client_ref.flatMap { isClientRef($0) ? $0 : nil } ?? "srv:\(rowId)"
        let draft = OutcomeFinalDiagnosisRecord(
            encounterRef: row.encounter_ref, finalIcd10: row.final_icd10, finalDiseaseId: row.final_disease_id,
            sourceType: row.source_type, sourceDate: row.source_date, actionsTaken: row.actions_taken ?? [],
            retrospectiveAcuity: row.retrospective_acuity, status: row.status,
            confirmedAt: row.confirmed_at ?? "", retractedAt: row.retracted_at,
            sync: OutcomeSyncState(clientRef: clientRef, remoteId: rowId, pendingSync: false,
                                   updatedAt: row.retracted_at ?? row.confirmed_at ?? ""))
        guard case .success(let clean) = sanitizeFinalDiagnosis(draft) else { return nil }
        var out = draft
        out.finalIcd10 = clean.finalIcd10
        out.finalDiseaseId = clean.finalDiseaseId
        out.sourceDate = clean.sourceDate
        out.actionsTaken = clean.actionsTaken
        out.retrospectiveAcuity = clean.retrospectiveAcuity
        out.status = clean.status
        out.confirmedAt = clean.confirmedAt ?? ""
        return out
    }
}
