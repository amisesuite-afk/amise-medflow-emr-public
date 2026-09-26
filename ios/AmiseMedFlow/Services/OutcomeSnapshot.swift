// OutcomeSnapshot.swift
// Real-outcomes loop on iOS (twin of @workspace/triage-engine/outcomes on the web; change the
// JSON shape on both platforms together).
//
// When a visit is completed ("Review and complete"), the engines' outputs are frozen on the
// Encounter as coded data only (OutcomePredictionRecord in Encounter.predictionSnapshotJson):
// the top differential (ICD-10 + probability), the acuity level, NEWS2, the model / rule
// versions, the working ICD-10, and whether a final diagnosis is expected (an operation or
// pathology). Later a nurse, doctor or admin confirms the final diagnosis
// (OutcomeFinalDiagnosisRecord in Encounter.finalDiagnosisJson; a correction retracts the old
// record and confirms a new one, nothing is deleted).
//
// LOCAL AND SYNC-READY, NOT PUSHED YET. Each record carries `sync` (clientRef, remoteId,
// pendingSync, updatedAt) and the same keys as the Supabase tables of Migration 94
// (prediction_snapshots / diagnosis_outcomes), so a push loop can be added following the sync
// hard rules (ios-arch skill). Until then these records stay on this device: Encounters are not
// peer-synced or in the NAS backup, and the web calibration report does not include them.
// Nothing here changes an engine, a weight or the record's clinical fields.

import Foundation

// MARK: - Coded values

enum OutcomeCodes {

    /// "K35.80 — Acute appendicitis" → "K35.80"; "k3580" → "K35.80"; anything that is not an
    /// ICD-10 code → nil. Only the code survives, never the label (same rule as the web
    /// normaliseIcd10 and the Migration 94 CHECK).
    static func normaliseICD10(_ raw: String?) -> String? {
        guard let raw else { return nil }
        var head = raw
        for sep in [" — ", " – ", " - ", "  ", ",", ";"] {
            if let r = head.range(of: sep) { head = String(head[..<r.lowerBound]) }
        }
        let compact = head.trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
            .replacingOccurrences(of: " ", with: "")
        guard !compact.isEmpty else { return nil }
        var chars = Array(compact)
        if !chars.contains(".") && chars.count >= 4 && chars.count <= 7 {
            chars.insert(".", at: 3)
        }
        let code = String(chars)
        return isICD10(code) ? code : nil
    }

    /// Letter, digit, letter-or-digit, then optionally "." and 1–4 letters or digits.
    static func isICD10(_ code: String) -> Bool {
        let c = Array(code)
        guard c.count == 3 || (c.count >= 5 && c.count <= 8) else { return false }
        guard isUpperLetter(c[0]), isDigit(c[1]), isUpperLetter(c[2]) || isDigit(c[2]) else { return false }
        if c.count == 3 { return true }
        guard c[3] == "." else { return false }
        return c[4...].allSatisfy { isUpperLetter($0) || isDigit($0) }
    }

    /// "ios:<syncCode>", or nil when the sync code is not a plain identifier.
    static func encounterRef(syncCode: String) -> String? {
        guard !syncCode.isEmpty, syncCode.count <= 64,
              syncCode.allSatisfy({ ($0.isASCII && ($0.isLetter || $0.isNumber)) || $0 == "-" }) else { return nil }
        return "ios:\(syncCode)"
    }

    /// A version stamp as the server accepts it ([0-9A-Za-z.+_-], at most 32 characters).
    static func versionToken(_ raw: String) -> String {
        let cleaned = String(raw.map { ch -> Character in
            (ch.isASCII && (ch.isLetter || ch.isNumber)) || ch == "." || ch == "+" || ch == "_" || ch == "-" ? ch : "-"
        }.prefix(32))
        return cleaned.isEmpty ? "unknown" : cleaned
    }

    private static func isUpperLetter(_ ch: Character) -> Bool { ch.isASCII && ch.isLetter && ch.isUppercase }
    private static func isDigit(_ ch: Character) -> Bool { ch.isASCII && ch.isNumber }

    /// ISO 8601 timestamp (UTC), the form the web and the server read.
    static func isoTimestamp(_ date: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.string(from: date)
    }

    /// YYYY-MM-DD in the practice's time zone (ECT).
    static func practiceDay(_ date: Date) -> String {
        let c = Calendar.ect.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04ld-%02ld-%02ld", c.year ?? 2000, c.month ?? 1, c.day ?? 1)
    }
}

// MARK: - Records (JSON keys match the web / Supabase camelCase snapshot shape)

struct OutcomeDifferentialEntry: Codable, Equatable {
    let rank: Int
    let diseaseId: String?
    let icd10: String?
    let probability: Double?
}

struct OutcomeScore: Codable, Equatable {
    let key: String
    let value: Double
    let source: String
}

struct OutcomeBand: Codable, Equatable {
    let decisionId: String
    let optionId: String
    let kind: String
    let band: String
    let probability: Double?
}

struct OutcomeActionTaken: Codable, Equatable {
    let optionId: String
    let done: Bool
}

/// Local sync bookkeeping (not part of the server row). `pendingSync` stays true until a push
/// (not built yet) gets the row back; `remoteId` is the server row id then.
struct OutcomeSyncState: Codable, Equatable {
    var clientRef: String
    var remoteId: String?
    var pendingSync: Bool
    var updatedAt: String

    static func new(now: Date = .now) -> OutcomeSyncState {
        OutcomeSyncState(clientRef: "ios:\(UUID().uuidString)", remoteId: nil, pendingSync: true,
                         updatedAt: OutcomeCodes.isoTimestamp(now))
    }
}

struct OutcomePredictionRecord: Codable, Equatable {
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
    var sync: OutcomeSyncState

    init(encounterRef: String, completedAt: String, differentialModelVersion: String,
         modelVersions: [String: String], topDifferential: [OutcomeDifferentialEntry],
         triageLevel: String?, scores: [OutcomeScore], workingIcd10: String?,
         outcomeTriggers: [String], sync: OutcomeSyncState) {
        self.snapshotVersion = 1
        self.platform = "ios"
        self.encounterRef = encounterRef
        self.completedAt = completedAt
        self.differentialEngine = "ios-bayes"
        self.differentialModelVersion = differentialModelVersion
        self.modelVersions = modelVersions
        self.topDifferential = topDifferential
        self.triageLevel = triageLevel
        self.triageScale = triageLevel == nil ? nil : "ios-acuity"
        self.scores = scores
        self.decisionBands = []
        self.features = [:]
        self.workingDiseaseId = nil
        self.workingIcd10 = workingIcd10
        self.recordedIcd10 = workingIcd10.map { [$0] } ?? []
        self.expectsOutcome = !outcomeTriggers.isEmpty
        self.outcomeTriggers = outcomeTriggers
        self.sync = sync
    }

    // Missing keys decode to defaults, so records written by this build still read after a
    // field is added (the PathwayData rule).
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        snapshotVersion = try c.decodeIfPresent(Int.self, forKey: .snapshotVersion) ?? 1
        platform = try c.decodeIfPresent(String.self, forKey: .platform) ?? "ios"
        encounterRef = try c.decode(String.self, forKey: .encounterRef)
        completedAt = try c.decode(String.self, forKey: .completedAt)
        differentialEngine = try c.decodeIfPresent(String.self, forKey: .differentialEngine) ?? "ios-bayes"
        differentialModelVersion = try c.decodeIfPresent(String.self, forKey: .differentialModelVersion) ?? "unknown"
        modelVersions = try c.decodeIfPresent([String: String].self, forKey: .modelVersions) ?? [:]
        topDifferential = try c.decodeIfPresent([OutcomeDifferentialEntry].self, forKey: .topDifferential) ?? []
        triageLevel = try c.decodeIfPresent(String.self, forKey: .triageLevel)
        triageScale = try c.decodeIfPresent(String.self, forKey: .triageScale)
        scores = try c.decodeIfPresent([OutcomeScore].self, forKey: .scores) ?? []
        decisionBands = try c.decodeIfPresent([OutcomeBand].self, forKey: .decisionBands) ?? []
        features = try c.decodeIfPresent([String: Bool].self, forKey: .features) ?? [:]
        workingDiseaseId = try c.decodeIfPresent(String.self, forKey: .workingDiseaseId)
        workingIcd10 = try c.decodeIfPresent(String.self, forKey: .workingIcd10)
        recordedIcd10 = try c.decodeIfPresent([String].self, forKey: .recordedIcd10) ?? []
        expectsOutcome = try c.decodeIfPresent(Bool.self, forKey: .expectsOutcome) ?? false
        outcomeTriggers = try c.decodeIfPresent([String].self, forKey: .outcomeTriggers) ?? []
        sync = try c.decodeIfPresent(OutcomeSyncState.self, forKey: .sync)
            ?? OutcomeSyncState(clientRef: encounterRef, remoteId: nil, pendingSync: true, updatedAt: completedAt)
    }
}

enum OutcomeSourceType: String, CaseIterable, Identifiable {
    case histology
    case reportImport = "report_import"
    case operativeFindings = "operative_findings"
    case operativeNote = "operative_note"
    case dischargeSummary = "discharge_summary"
    case followUp = "follow_up"
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .histology:         return "Histology"
        case .reportImport:      return "Imported report (lab / imaging)"
        case .operativeFindings: return "Operative findings"
        case .operativeNote:     return "Operative note"
        case .dischargeSummary:  return "Discharge summary"
        case .followUp:          return "Follow-up visit"
        case .other:             return "Other"
        }
    }
}

/// The urgency the case needed, judged afterwards (the triage reference standard).
enum OutcomeAcuity: String, CaseIterable, Identifiable {
    case emergency, urgent, soon, routine

    var id: String { rawValue }

    var label: String {
        switch self {
        case .emergency: return "Emergency (same hour)"
        case .urgent:    return "Urgent (same day)"
        case .soon:      return "Soon (24–48 h)"
        case .routine:   return "Routine"
        }
    }
}

struct OutcomeFinalDiagnosisRecord: Codable, Equatable, Identifiable {
    var encounterRef: String
    var finalIcd10: String
    var finalDiseaseId: String?
    var sourceType: String
    var sourceDate: String
    var actionsTaken: [OutcomeActionTaken]
    var retrospectiveAcuity: String?
    var status: String
    var confirmedAt: String
    var retractedAt: String?
    var sync: OutcomeSyncState

    var id: String { sync.clientRef }
    var isConfirmed: Bool { status == "confirmed" }

    var sourceLabel: String { OutcomeSourceType(rawValue: sourceType)?.label ?? sourceType }

    init(encounterRef: String, finalIcd10: String, sourceType: OutcomeSourceType, sourceDate: String,
         retrospectiveAcuity: OutcomeAcuity?, now: Date = .now) {
        self.encounterRef = encounterRef
        self.finalIcd10 = finalIcd10
        self.finalDiseaseId = nil
        self.sourceType = sourceType.rawValue
        self.sourceDate = sourceDate
        self.actionsTaken = []
        self.retrospectiveAcuity = retrospectiveAcuity?.rawValue
        self.status = "confirmed"
        self.confirmedAt = OutcomeCodes.isoTimestamp(now)
        self.retractedAt = nil
        self.sync = OutcomeSyncState.new(now: now)
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        encounterRef = try c.decode(String.self, forKey: .encounterRef)
        finalIcd10 = try c.decode(String.self, forKey: .finalIcd10)
        finalDiseaseId = try c.decodeIfPresent(String.self, forKey: .finalDiseaseId)
        sourceType = try c.decodeIfPresent(String.self, forKey: .sourceType) ?? OutcomeSourceType.other.rawValue
        sourceDate = try c.decodeIfPresent(String.self, forKey: .sourceDate) ?? ""
        actionsTaken = try c.decodeIfPresent([OutcomeActionTaken].self, forKey: .actionsTaken) ?? []
        retrospectiveAcuity = try c.decodeIfPresent(String.self, forKey: .retrospectiveAcuity)
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "confirmed"
        confirmedAt = try c.decodeIfPresent(String.self, forKey: .confirmedAt) ?? ""
        retractedAt = try c.decodeIfPresent(String.self, forKey: .retractedAt)
        sync = try c.decodeIfPresent(OutcomeSyncState.self, forKey: .sync)
            ?? OutcomeSyncState(clientRef: "ios:\(UUID().uuidString)", remoteId: nil, pendingSync: true, updatedAt: confirmedAt)
    }
}

// MARK: - Building the snapshot (pure)

enum OutcomeSnapshotBuilder {

    static let topN = 5
    /// Days after completion before "Final diagnosis not yet recorded" shows (SURGEON-DECISIONS I2).
    static let dueDays = 14

    struct DifferentialItem: Equatable {
        let icd: String
        /// 0–100 display percentage.
        let probability: Int
    }

    struct Input {
        let encounterSyncCode: String
        let completedAt: Date
        let differential: [DifferentialItem]
        let acuity: Acuity?
        let workingICD: String?
        let news2: Int?
        let operation: Bool
        let pathology: Bool
        let databaseVersion: String
        let databaseLoaded: Bool
    }

    static func triageLevel(_ acuity: Acuity?) -> String? {
        guard let acuity else { return nil }
        switch acuity {
        case .emergency: return "emergency"
        case .urgent:    return "urgent"
        case .priority:  return "priority"
        case .routine:   return "routine"
        }
    }

    static func modelVersions(databaseVersion: String, databaseLoaded: Bool) -> [String: String] {
        [
            "diagnosticDatabase": OutcomeCodes.versionToken(databaseVersion),
            "differentialSource": databaseLoaded ? "database" : "fallback",
            "acuity": ClinicalAcuityEngine.rulesVersion,
            "planSafety": PlanSafetyFilter.version,
            "radiation": DiagnosisRadiationEngine.contentVersion,
            "reasoning": DiagnosticReasoning.version,
        ]
    }

    /// The snapshot, or nil when the encounter cannot be referenced.
    static func build(_ input: Input) -> OutcomePredictionRecord? {
        guard let ref = OutcomeCodes.encounterRef(syncCode: input.encounterSyncCode) else { return nil }
        var entries: [OutcomeDifferentialEntry] = []
        for item in input.differential {
            guard let code = OutcomeCodes.normaliseICD10(item.icd) else { continue }
            let p = Double(min(100, max(0, item.probability))) / 100
            entries.append(OutcomeDifferentialEntry(rank: entries.count + 1, diseaseId: nil, icd10: code, probability: p))
            if entries.count == topN { break }
        }
        var triggers: [String] = []
        if input.operation { triggers.append("operation") }
        if input.pathology { triggers.append("pathology") }
        let scores = input.news2.map { [OutcomeScore(key: "news2", value: Double($0), source: "record")] } ?? []
        // The engine version is the database version when the database is in use; the built-in
        // lists are versioned with the app, so they are recorded as "fallback".
        let modelVersion = input.databaseLoaded ? OutcomeCodes.versionToken(input.databaseVersion) : "fallback"
        return OutcomePredictionRecord(
            encounterRef: ref,
            completedAt: OutcomeCodes.isoTimestamp(input.completedAt),
            differentialModelVersion: modelVersion,
            modelVersions: modelVersions(databaseVersion: input.databaseVersion, databaseLoaded: input.databaseLoaded),
            topDifferential: entries,
            triageLevel: triageLevel(input.acuity),
            scores: scores,
            workingIcd10: OutcomeCodes.normaliseICD10(input.workingICD),
            outcomeTriggers: triggers,
            sync: OutcomeSyncState.new(now: input.completedAt)
        )
    }

    /// Visit types that are themselves an operation or procedure (tissue or findings expected).
    static let procedureVisitTypes: Set<VisitType> = [
        .dayOfSurgery, .ercp, .ogd, .colonoscopy, .surgeryElective, .surgeryEmergency, .bronchoscopy,
    ]

    /// Investigation names that mean tissue was sent (flag only; the text is not stored).
    static func isPathologyRequest(name: String, category: InvestigationEntry.InvCategory) -> Bool {
        if category == .pathology { return true }
        let n = name.lowercased()
        return ["biops", "histolog", "histopath", "cytolog", "fine needle", "fine-needle", "frozen section", "core needle"]
            .contains { n.contains($0) } || n.split(whereSeparator: { !$0.isLetter }).contains("fna")
    }

    /// "Final diagnosis not yet recorded": an operation or pathology was expected, the visit was
    /// completed at least `dueDays` days ago, and no confirmed final diagnosis exists.
    static func isDue(prediction: OutcomePredictionRecord?, finals: [OutcomeFinalDiagnosisRecord],
                      completedAt: Date, now: Date = .now,
                      dueDays: Int = OutcomeSnapshotBuilder.dueDays) -> Bool {
        guard let prediction, prediction.expectsOutcome else { return false }
        guard !finals.contains(where: \.isConfirmed) else { return false }
        return now.timeIntervalSince(completedAt) >= Double(dueDays) * 86_400
    }
}

// MARK: - Encounter storage

extension Encounter {

    var outcomePrediction: OutcomePredictionRecord? {
        guard let json = predictionSnapshotJson, let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(OutcomePredictionRecord.self, from: data)
    }

    var outcomeFinalDiagnoses: [OutcomeFinalDiagnosisRecord] {
        guard let json = finalDiagnosisJson, let data = json.data(using: .utf8) else { return [] }
        return (try? JSONDecoder().decode([OutcomeFinalDiagnosisRecord].self, from: data)) ?? []
    }

    var confirmedFinalDiagnosis: OutcomeFinalDiagnosisRecord? {
        outcomeFinalDiagnoses.last(where: \.isConfirmed)
    }

    var finalDiagnosisDue: Bool {
        OutcomeSnapshotBuilder.isDue(prediction: outcomePrediction, finals: outcomeFinalDiagnoses,
                                     completedAt: encounterDate)
    }

    /// Freezes the prediction once: a later completion of the same encounter keeps the first.
    func storeOutcomePredictionIfMissing(_ record: OutcomePredictionRecord) {
        guard predictionSnapshotJson == nil,
              let data = try? JSONEncoder().encode(record),
              let json = String(data: data, encoding: .utf8) else { return }
        predictionSnapshotJson = json
    }

    /// Confirms a final diagnosis; any earlier confirmed one is retracted (kept, not deleted).
    func confirmFinalDiagnosis(_ record: OutcomeFinalDiagnosisRecord, now: Date = .now) {
        var all = outcomeFinalDiagnoses
        let stamp = OutcomeCodes.isoTimestamp(now)
        for i in all.indices where all[i].isConfirmed {
            all[i].status = "retracted"
            all[i].retractedAt = stamp
            all[i].sync.pendingSync = true
            all[i].sync.updatedAt = stamp
        }
        all.append(record)
        guard let data = try? JSONEncoder().encode(all), let json = String(data: data, encoding: .utf8) else { return }
        finalDiagnosisJson = json
    }

    /// Retracts the confirmed final diagnosis (kept for the record).
    func retractFinalDiagnosis(now: Date = .now) {
        var all = outcomeFinalDiagnoses
        let stamp = OutcomeCodes.isoTimestamp(now)
        var changed = false
        for i in all.indices where all[i].isConfirmed {
            all[i].status = "retracted"
            all[i].retractedAt = stamp
            all[i].sync.pendingSync = true
            all[i].sync.updatedAt = stamp
            changed = true
        }
        guard changed, let data = try? JSONEncoder().encode(all), let json = String(data: data, encoding: .utf8) else { return }
        finalDiagnosisJson = json
    }
}
