// BayesianDiagnosisEngine+Database.swift
// External DiagnosticDatabase.json loading and matrix candidate resolution.

import Foundation

extension BayesianDiagnosisEngine {

    // MARK: - External diagnostic database (DiagnosticDatabase.json)
    // JSON file in the app bundle; evidence-based LR values with citations.
    // Engine prefers loaded pools; falls back to hardcoded arrays if absent.

    struct CandidateSpec: Codable {
        let name: String
        let icd: String
        let logPrior: Int
        /// Clinical urgency tier (0=routine, 1=urgent, 2=emergency, 3=critical).
        /// Drives two behaviours:
        ///   a) Matrix overlay bypass: urgency ≥ 1 exempts from the logPrior > 45 noise filter.
        ///   b) "Don't miss" slots: urgency ≥ 2 candidates may fill the last two places of the
        ///      top five (topResults). Urgency no longer adds to the posterior.
        let urgency: Int?
        let features: [FeatureSpec]
        /// Sex / age / pregnancy restriction (optional; see BayesianDiagnosisEngine+Routing.swift).
        let applicability: Applicability?
        /// Curated candidates only: legacy near-duplicate names this candidate replaces when it is
        /// added by a presentation (optional).
        let supersedes: [String]?

        struct FeatureSpec: Codable {
            let key: String
            let value: String
            let logLR: Int
            let evidenceLabel: String
            let citation: String?
            /// Masking contexts (BayesianDiagnosisEngine.MaskingContext raw values) under which this
            /// negative feature does not count (DiagnosticDatabase.json 2.1.0; optional).
            let maskedBy: [String]?
        }

        func toCandidate() -> Candidate {
            Candidate(name: name, icd: icd, logPrior: logPrior,
                      urgency: urgency ?? 0,
                      features: features.map { f in
                          Candidate.Feature(key: f.key, value: f.value,
                                            logLR: f.logLR, evidenceLabel: f.evidenceLabel,
                                            maskedBy: f.maskedBy)
                      },
                      applicability: applicability)
        }
    }

    /// Wrapper matching the JSON pool object `{"candidates": [...]}`
    struct PoolSpec: Codable {
        let candidates: [CandidateSpec]
    }

    /// Top-level matrix section of DiagnosticDatabase.json.
    /// Encodes the ICD-11 / SNOMED CT polyhierarchy: each disease is tagged with
    /// all its body systems and clinical specialties, enabling cross-specialty query.
    struct MatrixSpec: Codable {
        let version: String
        let authority: String
        /// system name → [disease names]
        let systemIndex: [String: [String]]
        /// specialty name → [disease names]
        let specialtyIndex: [String: [String]]
        /// CC keyword → [system names]  (lowercase keys)
        let ccToSystems: [String: [String]]
        /// Z-axis: urgency tier → [disease names]
        /// Tiers: "critical" (life-threatening, urgency=3),
        ///        "emergency" (organ/limb threat, urgency=2),
        ///        "urgent" (function threat, urgency=1),
        ///        "routine" (non-urgent, urgency=0)
        let urgencyIndex: [String: [String]]
    }

    struct CandidateDatabase: Codable {
        let version: String
        let pools: [String: PoolSpec]
        let matrix: MatrixSpec?
    }

    // Lazy-loaded once at first access; nil if file absent or unparseable.
    static let externalDatabase: CandidateDatabase? = {
        guard let url = Bundle.main.url(forResource: "DiagnosticDatabase", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(CandidateDatabase.self, from: data)
    }()

    // Convenience: load a candidate pool from the external database, or return nil.
    static func externalPool(_ name: String) -> [Candidate]? {
        externalDatabase?.pools[name].map { $0.candidates.map { $0.toCandidate() } }
    }

    /// Cross-specialty matrix query implementing an X/Y/Z polyhierarchy model.
    ///
    /// **X axis** — `ccToSystems`: CC keywords → body systems
    /// **Y axis** — `systemIndex` / `specialtyIndex`: systems → disease names,
    ///   optionally narrowed to a specialty context via `specialtyHint`
    /// **Z axis** — `urgencyIndex`: urgency tier safety net
    ///   - `critical` (urgency=3, life-threatening) and `emergency` (urgency=2,
    ///     organ/limb threat) diseases that fall in the X-axis system set are always
    ///     included, bypassing the specialty intersection entirely — a clinician in
    ///     any specialty must never miss an immediately life- or organ-threatening
    ///     diagnosis that is system-relevant to the presenting CC.
    ///   - `urgent` / `routine` diseases are subject to the full X-Y filter.
    static func matrixCandidates(forCC cc: String, specialtyHint: String? = nil) -> [Candidate] {
        guard let db = externalDatabase, let mx = db.matrix else { return [] }
        // Keywords match negation-aware at a word start ("no rash" is not a rash; "tb" is not
        // found inside another word).
        let ccSource = NegationMatcher.Source(cc)

        // ── X axis: CC → body systems ────────────────────────────────────────
        var matchedSystems = Set<String>()
        for (keyword, systems) in mx.ccToSystems where ccSource.contains(keyword, wordStart: true) {
            systems.forEach { matchedSystems.insert($0) }
        }
        guard !matchedSystems.isEmpty else { return [] }

        // ── Y axis: systems → full disease name set ───────────────────────────
        var allSystemDiseases = Set<String>()
        for system in matchedSystems {
            mx.systemIndex[system]?.forEach { allSystemDiseases.insert($0) }
        }

        // ── Z axis: safety-net — critical + emergency diseases ────────────────
        // These bypass specialty filtering; their urgency score ensures they rank
        // high enough to be surfaced in the final differential.
        var safetyNetDiseases = Set<String>()
        for tier in ["critical", "emergency"] {
            mx.urgencyIndex[tier]?.forEach {
                if allSystemDiseases.contains($0) { safetyNetDiseases.insert($0) }
            }
        }

        // ── Y × specialty: narrow the non-safety-net diseases ────────────────
        // UI hint names (e.g. "General & GI Surgery") use human-readable labels;
        // specialtyIndex keys use camelCase (e.g. "generalSurgery"). The expansion
        // map handles compound names; bidirectional contains handles simple ones.
        var filteredDiseases = allSystemDiseases
        if let hint = specialtyHint, !hint.isEmpty {
            let hintL = hint.lowercased()
            let hintExpansion: [String: [String]] = [
                "general & gi surgery":  ["generalSurgery", "upperGISurgery", "colorectalSurgery", "gastroenterology"],
                "cardiovascular":        ["cardiology", "vascularSurgery", "cardiothoracicSurgery"],
                "endocrine & metabolic": ["endocrinology"],
                "urology & renal":       ["urology", "nephrology"],
                "musculoskeletal":       ["orthopaedics", "rheumatology"],
                "infectious & tropical": ["infectiousDisease"],
                "internal medicine":     ["internalMedicine"],
            ]
            var specialtyDiseases = Set<String>()
            if let keys = hintExpansion[hintL] {
                for key in keys {
                    mx.specialtyIndex[key]?.forEach { specialtyDiseases.insert($0) }
                }
            } else {
                for (key, diseases) in mx.specialtyIndex {
                    let kL = key.lowercased()
                    if kL.contains(hintL) || hintL.contains(kL) {
                        specialtyDiseases.formUnion(diseases)
                    }
                }
            }
            if !specialtyDiseases.isEmpty {
                filteredDiseases = filteredDiseases.intersection(specialtyDiseases)
            }
        }

        // Merge: specialty-filtered diseases ∪ Z-axis safety net
        let diseaseNames = filteredDiseases.union(safetyNetDiseases)
        guard !diseaseNames.isEmpty else { return [] }

        // ── Look up candidates from pools ─────────────────────────────────────
        // Threshold filter: logPrior > 45 = very common background diseases that
        // pollute cross-specialty results (back pain, gastroenteritis etc.).
        // Exemptions: urgency ≥ 1 bypasses logPrior cap; Z-axis safety-net
        // diseases bypass both the logPrior cap and specialty filter (above).
        // Pools are read in name order and ties broken by urgency then name, so the same
        // complaint always gives the same candidates (Dictionary order changes per launch).
        var seen = Set<String>()
        var result: [Candidate] = []
        for poolName in db.pools.keys.sorted() {
            guard let poolSpec = db.pools[poolName] else { continue }
            for spec in poolSpec.candidates where diseaseNames.contains(spec.name) && seen.insert(spec.name).inserted {
                let u = spec.urgency ?? 0
                guard spec.logPrior <= 45 || u >= 1 else { continue }
                result.append(spec.toCandidate())
            }
        }
        return result.sorted { a, b in
            if a.logPrior != b.logPrior { return a.logPrior > b.logPrior }
            if a.urgency != b.urgency { return a.urgency > b.urgency }
            return a.name < b.name
        }
    }


}
