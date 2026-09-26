// VademecumContent.swift
// Disease-centred vademecum, phase 1 (shadow): Codable structs for the shared content files
// clinical-content/vademecum/findings.json (finding dictionary and loop policy) and
// clinical-content/vademecum/<area>.json (the diseases of one presentation area, with their
// findings by level, likelihood ratios, diagnostic criteria, pathognomonic findings, exclusions
// and incidental work-up). The web reads the same files (lib/pane-engine/src/vademecum-loop).
//
// The files are bundled as the "vademecum" folder reference (ios/project.yml) and decoded through
// SharedClinicalContent (Settings → Diagnostics lists them). Phase 1 only decodes them: nothing on
// iOS uses this content yet, and the Bayesian engine still reads DiagnosticDatabase.json. A
// missing or undecodable file gives nil, never a crash. lint:shared-content checks these structs
// against clinical-content/schemas/vademecum-findings.schema.json and vademecum-area.schema.json
// (field names, optionality, types): keep them plain `let` properties, no CodingKeys.
//
// Every value is unreviewed and mostly unverified (fromMemory): see
// docs/clinical-validation/changes/vademecum-phase1.md (Needs sign-off). Plan: docs/VADEMECUM-PLAN.md.

import Foundation

enum VademecumContent {

    // MARK: - findings.json

    struct LR: Codable, Equatable {
        let point: Double
        let low: Double?
        let high: Double?
    }

    struct PriorTiers: Codable {
        let common: Double
        let frequent: Double
        let uncommon: Double
        let rare: Double
        let veryRare: Double
    }

    struct Thresholds: Codable {
        let test: Double
        let treat: Double
    }

    struct CriteriaFloors: Codable {
        let definite: Double
        let suspected: Double
        let referral: Double
    }

    struct Policy: Codable {
        /// "history", "exam", "score", "investigation" (the loop's order).
        let levels: [String]
        let priorTiers: PriorTiers
        let pregnancyPossibleMultiplier: Double
        let defaultThresholds: Thresholds
        let cantMissThresholds: Thresholds
        let criteriaFloors: CriteriaFloors
        let criteriaMinPosterior: Double
        let definitiveLR: Double
        let minLr: Double
        let maxLr: Double
        let conflictLowPosterior: Double
        let conflictHighPosterior: Double
        let criteriaBonus: Double
        let minInformationGain: Double
        let maxQuestions: Int
        let displaySlots: Int
        let cantMissSlots: Int
        let note: String
    }

    struct DimensionInfo: Codable {
        let question: String
        let order: Int
    }

    struct LabSpec: Codable {
        /// Catalogue saved name (LabAnalyteCatalog), e.g. "ALP".
        let analyte: String
        /// "high" or "low".
        let direction: String
        let multipleOfUln: Double?
        let above: Double?
        let below: Double?
    }

    struct DemographicSpec: Codable {
        let ageMin: Double?
        let ageMax: Double?
        let sex: String?
    }

    struct RuleBandRef: Codable {
        let rule: String
        let band: String
    }

    struct Finding: Codable, Identifiable {
        let id: String
        let label: String?
        let chip: String?
        let synonyms: [String]
        /// "history", "exam", "score" or "investigation".
        let level: String
        /// SOCRATES dimension or kind ("site", "onset", "associated", "lab", "imaging", …).
        let dimension: String
        let question: String?
        let baseRate: Double
        let group: String?
        let pane: String?
        let examSign: String?
        let decisionRule: RuleBandRef?
        let lab: LabSpec?
        let demographic: DemographicSpec?
        /// "symptom", "sign", "lab", "imaging", "pathology", "score", or nil (cannot start a case).
        let entryPoint: String?
        let note: String?
    }

    struct FindingsFile: Codable {
        let version: String
        let status: String
        let policy: Policy
        let dimensions: [String: DimensionInfo]
        let findings: [Finding]
    }

    // MARK: - <area>.json

    struct Link: Codable {
        let finding: String
        let lrPositive: LR?
        let lrNegative: LR?
        let negativeMeaningful: Bool
        /// "pane", "ios", "pane+ios", "exam-signs", "decision-rules" or "new".
        let seed: String
        let seedDetail: String
        let source: String
        let fromMemory: Bool
    }

    struct FindingsByLevel: Codable {
        let history: [Link]
        let exam: [Link]
        let score: [Link]
        let investigation: [Link]
    }

    /// Criteria logic (op: all / any / atLeast / points / finding / rule / external / age / sex).
    /// Recursive through arrays only (a struct cannot hold an optional of itself).
    struct CriteriaNode: Codable {
        let op: String
        let items: [CriteriaNode]?
        let k: Int?
        let min: Double?
        let max: Double?
        let weight: Double?
        let finding: String?
        let state: String?
        let rule: String?
        let bands: [String]?
        let evaluator: String?
        let fallback: [CriteriaNode]?
        let sex: String?
        let label: String?
    }

    struct CriteriaLevel: Codable {
        let id: String
        let label: String
        /// "definite", "suspected", "referral" or "classification".
        let grade: String
        let when: CriteriaNode
        let action: String?
    }

    struct Criteria: Codable, Identifiable {
        let id: String
        let name: String
        let kind: String
        let source: String
        let fromMemory: Bool
        let levels: [CriteriaLevel]
        let note: String?
    }

    struct Pathognomonic: Codable {
        let finding: String
        let lrPositive: LR?
        let definitive: Bool
        let requires: [String]?
        let label: String
        let source: String
        let fromMemory: Bool
        let note: String?
    }

    struct Exclusion: Codable, Identifiable {
        let id: String
        let finding: String?
        let state: String?
        let sex: String?
        let reason: String
        let note: String?
        let source: String
        let fromMemory: Bool
    }

    struct WorkupStep: Codable, Identifiable {
        let id: String
        let label: String
        let when: CriteriaNode?
        let source: String
        let fromMemory: Bool
    }

    struct IncidentalWorkup: Codable {
        let trigger: [String]
        let classification: String?
        let steps: [WorkupStep]
        let source: String
        let fromMemory: Bool
        let note: String?
    }

    struct Applicability: Codable {
        let sex: String?
        let ageMin: Double?
        let ageMax: Double?
        let pregnancy: String?
    }

    struct Disease: Codable, Identifiable {
        let id: String
        let label: String
        let icd10: String
        let pane: String?
        let ios: String?
        let prevalenceTier: String
        let cantMiss: Bool
        let urgency: String
        let course: String
        let applicability: Applicability?
        let seedFromComplaint: Bool
        let decision: String?
        let findings: FindingsByLevel
        let criteria: [Criteria]
        let pathognomonic: [Pathognomonic]
        let exclusions: [Exclusion]
        let workupWhenIncidental: IncidentalWorkup?
        let source: String
        let signOff: String
        let note: String?
    }

    struct Complaints: Codable {
        let frames: [String]
        let keywords: [String]
    }

    struct AreaFile: Codable {
        let version: String
        let status: String
        let area: String
        let setting: String
        let complaints: Complaints
        let related: [String]
        let diseases: [Disease]
    }

    // MARK: - Loading (phase 1: decode only)

    /// The finding dictionary, or nil when it is missing or does not decode (Settings → Diagnostics says why).
    static let findingsFile: FindingsFile? = SharedClinicalContent.load(FindingsFile.self, .vademecumFindings)

    /// The pilot areas that decoded (an area that does not decode is left out and reported).
    static let areaFiles: [AreaFile] = SharedClinicalContent.File.vademecumAreas
        .compactMap { SharedClinicalContent.load(AreaFile.self, $0) }

    /// Finding ids a disease of `area` uses that the dictionary does not define (should be empty;
    /// lint:vademecum checks the same on the web CI).
    static func unknownFindingIds(in area: AreaFile, dictionary: FindingsFile) -> [String] {
        let known = Set(dictionary.findings.map(\.id))
        var missing: [String] = []
        for disease in area.diseases {
            let links = disease.findings.history + disease.findings.exam + disease.findings.score + disease.findings.investigation
            for link in links where !known.contains(link.finding) {
                missing.append("\(disease.id): \(link.finding)")
            }
        }
        return missing
    }
}
