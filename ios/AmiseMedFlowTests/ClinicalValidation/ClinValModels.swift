// ClinValModels.swift
// Clinical validation harness — vignette input model (decoded from Vignettes/*.json) and the
// result record written as one `CLINVAL|{json}` line per vignette.
//
// Format: docs/clinical-validation/vignette.schema.json. The TypeScript twin is
// scripts/src/clinval/types.ts; keep the result record field names identical, because
// scripts/src/clinval/report.ts merges the iOS lines with the web results.

import Foundation

// MARK: - Loose JSON value (score forms)

enum ClinValJSON: Decodable, Equatable {
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([ClinValJSON])
    case object([String: ClinValJSON])
    case null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let n = try? c.decode(Double.self) { self = .number(n) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else if let a = try? c.decode([ClinValJSON].self) { self = .array(a) }
        else { self = .object(try c.decode([String: ClinValJSON].self)) }
    }
}

/// A clinician-completed score form: canonical field name → value (README "Score forms").
struct ClinValScoreForm: Decodable {
    let fields: [String: ClinValJSON]

    init(from decoder: Decoder) throws {
        fields = try decoder.singleValueContainer().decode([String: ClinValJSON].self)
    }

    func bool(_ key: String) -> Bool {
        if case .bool(let b)? = fields[key] { return b }
        return false
    }

    func int(_ key: String) -> Int {
        if case .number(let n)? = fields[key] { return Int(n) }
        return 0
    }

    func strings(_ key: String) -> [String] {
        guard case .array(let items)? = fields[key] else { return [] }
        return items.compactMap { if case .string(let s) = $0 { return s } else { return nil } }
    }
}

// MARK: - Platform flag (true | ["ios", "web"])

struct ClinValPlatformFlag: Decodable {
    let platforms: Set<String>

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let b = try? c.decode(Bool.self) {
            platforms = b ? ["ios", "web"] : []
        } else {
            platforms = Set(try c.decode([String].self))
        }
    }

    func includes(_ platform: String) -> Bool { platforms.contains(platform) }
}

// MARK: - Vignette

struct ClinValVignette: Decodable {
    let schemaVersion: Int
    let id: String
    let condition: String
    let category: String
    let permutationOf: String?
    let permutationLabel: String?
    let summary: String?
    let inputs: ClinValInputs
    let expected: ClinValExpected
    let guideline: [ClinValGuideline]
    let rationale: String
}

struct ClinValGuideline: Decodable {
    let id: String
    let name: String
    let year: Int
    let section: String
    let citation: String?
    let verified: Bool?
}

struct ClinValInputs: Decodable {
    struct PatientInfo: Decodable {
        struct Pregnancy: Decodable { let status: String; let gestationWeeks: Int? }
        let ageYears: Int
        let sex: String
        let pregnancy: Pregnancy?
        let heightCm: Double?
        let weightKg: Double?
    }
    struct EncounterInfo: Decodable {
        let setting: String
        let visitType: String?
        let acuity: String?
        let isPostOp: Bool?
        let postOpDays: Int?
    }
    struct Vitals: Decodable {
        let minutesAgo: Int?
        let heartRate: Int?
        let systolicBp: Int?
        let diastolicBp: Int?
        let respiratoryRate: Int?
        let temperatureC: Double?
        let spo2: Int?
        let avpu: String?
        let onSupplementalO2: Bool?
        let glucoseMmol: Double?
        let weightKg: Double?
    }
    struct Lab: Decodable {
        let analyte: String
        let name: String
        let value: Double?
        let unit: String?
        let resultText: String?
        let minutesAgo: Int?
    }
    struct Imaging: Decodable {
        let name: String
        let modality: String
        let region: String?
        let result: String
        let minutesAgo: Int?
    }
    struct Medication: Decodable {
        let drug: String
        let dose: String?
        let frequency: String?
        let indication: String?
    }
    struct Allergy: Decodable {
        let name: String
        let severity: String
        let reaction: String?
    }
    struct Exam: Decodable {
        let general: String?
        let abdomen: String?
        let cardiovascular: String?
        let respiratory: String?
        let neuro: String?
        let msk: String?
        let skin: String?
        let other: String?
    }
    struct ConfirmedDiagnosis: Decodable {
        let name: String
        let icd10: String?
        let paneDiseaseId: String?
        let assessmentText: String?
    }
    struct PlatformInputs: Decodable {
        struct IOS: Decodable {
            let socratesSelections: [String: [String]]?
            let specialtyHint: String?
        }
        let ios: IOS?
    }

    let patient: PatientInfo
    let encounter: EncounterInfo
    let chiefComplaint: String
    let hpi: String
    let socrates: [String: [String]]?
    let symptoms: [String]?
    let exam: Exam?
    let vitals: [Vitals]?
    let labs: [Lab]?
    let imaging: [Imaging]?
    let comorbidities: [String]?
    let surgicalHistory: [String]?
    let medications: [Medication]?
    let allergies: [Allergy]?
    let nkda: Bool?
    let socialHistory: String?
    let scoreForms: [String: ClinValScoreForm]?
    let confirmedDiagnosis: ConfirmedDiagnosis?
    let platform: PlatformInputs?
}

// MARK: - Expectations

/// One expectation of any kind; the fields a kind does not use are nil.
struct ClinValExpectation: Decodable {
    let id: String
    let severity: String
    let platforms: [String]?
    let knownGap: ClinValPlatformFlag?
    let knownGapNote: String?
    let unverified: ClinValPlatformFlag?
    let guidelineRefs: [String]?
    let note: String?
    let proposedFix: String?
    // Kind-specific
    let match: [String]?
    let unless: [String]?
    let k: Int?
    let source: String?
    let sources: [String]?
    let score: String?
    let mode: String?
    let equals: ClinValJSON?
    let min: Double?
    let max: Double?
    let atLeast: String?
    let atMost: String?

    var equalsNumber: Double? { if case .number(let n)? = equals { return n } else { return nil } }
    var equalsString: String? { if case .string(let s)? = equals { return s } else { return nil } }
}

struct ClinValExpected: Decodable {
    struct Differential: Decodable {
        let mustRankTopK: [ClinValExpectation]?
        let mustNotMiss: [ClinValExpectation]?
    }
    struct Safety: Decodable {
        let emergencyLevel: ClinValExpectation?
        let mustAlarm: [ClinValExpectation]?
        let mustNotAlarm: [ClinValExpectation]?
        let redFlags: [ClinValExpectation]?
    }
    struct Scores: Decodable {
        let recommended: [ClinValExpectation]?
        let values: [ClinValExpectation]?
    }
    struct IncludeExclude: Decodable {
        let mustInclude: [ClinValExpectation]?
        let mustExclude: [ClinValExpectation]?
    }

    let differential: Differential?
    let safety: Safety?
    let scores: Scores?
    let investigations: IncludeExclude?
    let management: IncludeExclude?
    let pathway: ClinValExpectation?
    let dxVariant: ClinValExpectation?
    /// Diagnostic reasoning lines (ios.reasoning.*), graded like the text expectations.
    let reasoning: IncludeExclude?

    /// Every expectation as (kind, expectation), in report order (same order as grade.ts).
    var all: [(String, ClinValExpectation)] {
        var out: [(String, ClinValExpectation)] = []
        for x in differential?.mustRankTopK ?? [] { out.append(("mustRankTopK", x)) }
        for x in differential?.mustNotMiss ?? [] { out.append(("mustNotMiss", x)) }
        if let x = safety?.emergencyLevel { out.append(("emergencyLevel", x)) }
        for x in safety?.mustAlarm ?? [] { out.append(("mustAlarm", x)) }
        for x in safety?.mustNotAlarm ?? [] { out.append(("mustNotAlarm", x)) }
        for x in safety?.redFlags ?? [] { out.append(("redFlags", x)) }
        for x in scores?.recommended ?? [] { out.append(("scoreRecommended", x)) }
        for x in scores?.values ?? [] { out.append(("scoreValue", x)) }
        for x in investigations?.mustInclude ?? [] { out.append(("investigationInclude", x)) }
        for x in investigations?.mustExclude ?? [] { out.append(("investigationExclude", x)) }
        for x in management?.mustInclude ?? [] { out.append(("managementInclude", x)) }
        for x in management?.mustExclude ?? [] { out.append(("managementExclude", x)) }
        if let x = pathway { out.append(("pathway", x)) }
        if let x = dxVariant { out.append(("dxVariant", x)) }
        for x in reasoning?.mustInclude ?? [] { out.append(("reasoningInclude", x)) }
        for x in reasoning?.mustExclude ?? [] { out.append(("reasoningExclude", x)) }
        return out
    }
}

// MARK: - Engine outputs (normalised) and result record

struct ClinValDxItem: Encodable {
    let rank: Int
    let name: String
    let id: String?
    let icd10: String?
    let score: Double?
}

struct ClinValSourcedText: Encodable {
    let source: String
    let text: String
}

struct ClinValAlarm: Encodable {
    let source: String
    let title: String
    let detail: String
    let severity: String
}

struct ClinValLevel: Encodable {
    let level: String?
    let raw: String
    let source: String
}

struct ClinValRecommendedScore: Encodable {
    let source: String
    let score: String
    let raw: String
}

struct ClinValScoreValue: Encodable {
    let score: String
    let mode: String
    let source: String
    let value: Double?
    let label: String?
    let pending: [String]?
}

struct ClinValPathway: Encodable {
    let value: String
    let reasons: [String]
}

struct ClinValOutputs: Encodable {
    var differentials: [String: [ClinValDxItem]] = [:]
    var alarms: [ClinValAlarm] = []
    var redFlags: [ClinValSourcedText] = []
    var emergencyLevel: ClinValLevel?
    var recommendedScores: [ClinValRecommendedScore] = []
    var scoreValues: [ClinValScoreValue] = []
    var investigations: [ClinValSourcedText] = []
    var management: [ClinValSourcedText] = []
    var pathway: ClinValPathway?
    /// Diagnostic reasoning lines, source "ios.reasoning.<part>" (nil = not produced → n/a).
    var reasoning: [ClinValSourcedText]? = nil
    var engineInfo: [String: String] = [:]
    var notes: [String] = []
}

struct ClinValExpectationResult: Encodable {
    let id: String
    let kind: String
    let severity: String
    let status: String          // pass | fail | na
    let detail: String
    let knownGap: Bool
    let unverified: Bool
    let blocking: Bool
    let gapResolved: Bool
    let guidelineRefs: [String]
    let note: String?
    let proposedFix: String?
}

struct ClinValSummary: Encodable {
    var total = 0, pass = 0, fail = 0, na = 0
    var criticalFail = 0, qualityFail = 0, blocking = 0
    var knownGapFail = 0, unverifiedFail = 0, gapResolved = 0

    static func of(_ results: [ClinValExpectationResult]) -> ClinValSummary {
        var s = ClinValSummary()
        for r in results {
            s.total += 1
            switch r.status {
            case "pass": s.pass += 1
            case "fail": s.fail += 1
            default: s.na += 1
            }
            if r.status == "fail" {
                if r.severity == "critical" { s.criticalFail += 1 } else { s.qualityFail += 1 }
                if r.knownGap { s.knownGapFail += 1 } else if r.unverified { s.unverifiedFail += 1 }
            }
            if r.blocking { s.blocking += 1 }
            if r.gapResolved { s.gapResolved += 1 }
        }
        return s
    }

    mutating func add(_ o: ClinValSummary) {
        total += o.total; pass += o.pass; fail += o.fail; na += o.na
        criticalFail += o.criticalFail; qualityFail += o.qualityFail; blocking += o.blocking
        knownGapFail += o.knownGapFail; unverifiedFail += o.unverifiedFail; gapResolved += o.gapResolved
    }
}

struct ClinValResult: Encodable {
    let type = "clinval-result"
    let schemaVersion = 1
    let platform = "ios"
    let vignetteId: String
    let condition: String
    let category: String
    let permutationOf: String?
    let permutationLabel: String?
    let generatedAt: String
    let outputs: ClinValOutputs
    let expectations: [ClinValExpectationResult]
    let summary: ClinValSummary
}
