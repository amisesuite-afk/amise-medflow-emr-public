import Foundation
import Combine

// MARK: - Sequential Bayesian Updating Engine
// Posterior from one observation becomes the prior for the next.
// Seeds from BayesianDiagnosisEngine.infer() then updates live as evidence arrives.
// Feature correlation groups prevent double-counting correlated findings.

// MARK: - Output types

struct DiagnosisHypothesis: Identifiable {
    let id = UUID()
    var name: String
    var icdCode: String
    var logPosterior: Double          // log-odds units (natural log scale)
    var contributingEvidence: [(label: String, logLR: Double)]

    // Softmax probability computed across all hypotheses by the engine
    var probability: Double = 0.0

    // Convenience badge
    var confidence: BayesianDiagnosisEngine.DiagnosisResult.Confidence {
        let pct = Int(probability * 100)
        if pct >= 55 { return .high }
        if pct >= 30 { return .moderate }
        return .low
    }
}

// MARK: - Evidence model

enum EvidenceSource: String {
    case history       = "History"
    case examination   = "Examination"
    case investigation = "Investigation"
    case vital         = "Vital Sign"
    case score         = "Clinical Score"
}

struct ClinicalEvidence: Identifiable {
    let id = UUID()
    let key: String            // canonical feature key matching BayesianDiagnosisEngine
    let value: String          // e.g. "rlq", "fever", "elevated_wbc"
    let displayLabel: String   // human-readable text for UI
    let source: EvidenceSource
    var timestamp: Date = .now
}

// MARK: - Feature correlation groups
// Correlated features within a cluster get dampened log-LR to avoid double-counting.
// ρ (rho): 0 = independent, 1 = fully redundant.
// Effective logLR when a correlated feature is already observed = logLR × (1 - ρ).

struct FeatureCorrelationGroup {
    let name: String
    // Map feature key → correlation coefficient ρ with the "index" feature of this group
    let correlations: [String: Double]   // key → ρ (0–1)
}

// MARK: - Log-LR lookup table
// Replicate evidence weights from BayesianDiagnosisEngine in double precision.
// Keys mirror the private Feature.key / Feature.value convention.

private enum LogLRTable {

    // Scale: every 10 units ≈ 10× likelihood ratio (natural log units × ~4.34)
    // These match the integer values in BayesianDiagnosisEngine scaled to Double.

    // Returns the log-likelihood ratio for a (key, value, diagnosisName) triple.
    // Returns 0 if no match found (neutral evidence).
    static func logLR(key: String, value: String, forDiagnosis name: String) -> Double {
        let k = key.lowercased()
        let v = value.lowercased()
        let d = name.lowercased()

        // --- Acute Appendicitis ---
        if d.contains("appendicitis") && !d.contains("perf") {
            switch k {
            case "site"   where v.contains("rlq"): return 15
            case "associations" where v.contains("anorexia"): return 8
            case "associations" where v.contains("nausea"): return 6
            case "exam"   where v.contains("rebound"): return 12
            case "exam"   where v.contains("rovsing"): return 10
            case "inv"    where v.contains("wbc") && v.contains("elevat"): return 10
            case "inv"    where v.contains("crp") && v.contains("elevat"): return 8
            case "age_under" where v == "40": return 5
            default: return 0
            }
        }

        // --- Biliary Colic / Acute Cholecystitis ---
        if d.contains("cholecystitis") || d.contains("biliary colic") {
            switch k {
            case "site"   where v.contains("ruq") || v.contains("epigastric"): return 12
            case "radiation" where v.contains("shoulder") || v.contains("scapula"): return 14
            case "associations" where v.contains("fatty") || v.contains("food"): return 10
            case "exam"   where v.contains("murphy"): return 16
            case "inv"    where v.contains("stone") || v.contains("gallstone"): return 20
            case "sex_female": return 4
            case "age_over" where v == "40": return 3
            default: return 0
            }
        }

        // --- Acute Pancreatitis ---
        if d.contains("pancreatitis") {
            switch k {
            case "site"   where v.contains("epigastric") || v.contains("upper abdomen"): return 10
            case "radiation" where v.contains("back"): return 14
            case "character" where v.contains("band-like") || v.contains("boring"): return 12
            case "associations" where v.contains("nausea") || v.contains("vomiting"): return 8
            case "relieving" where v.contains("lean forward"): return 16
            case "inv"    where v.contains("amylase") || v.contains("lipase"): return 22
            default: return 0
            }
        }

        // --- Bowel Obstruction ---
        if d.contains("obstruction") && (d.contains("bowel") || d.contains("sbo")) {
            switch k {
            case "character" where v.contains("colicky"): return 14
            case "associations" where v.contains("vomiting"): return 12
            case "associations" where v.contains("distension"): return 14
            case "associations" where v.contains("constipation") || v.contains("obstipation"): return 16
            case "pshx"  where v.contains("abdomen") || v.contains("laparotomy"): return 18
            case "exam"  where v.contains("high-pitched") || v.contains("tinkling"): return 14
            default: return 0
            }
        }

        // --- Perforated Viscus ---
        if d.contains("perforation") || d.contains("perforated") {
            switch k {
            case "onset"  where v.contains("sudden") || v.contains("immediate"): return 16
            case "exam"   where v.contains("rigid") || v.contains("board"): return 20
            case "exam"   where v.contains("peritonism") || v.contains("guarding"): return 14
            case "inv"    where v.contains("free air") || v.contains("pneumoperitoneum"): return 30
            default: return 0
            }
        }

        // --- Sepsis (abdominal source) ---
        if d.contains("sepsis") || d.contains("septic shock") {
            switch k {
            case "associations" where v.contains("fever") || v.contains("rigors"): return 10
            case "associations" where v.contains("tachycardia"): return 8
            case "associations" where v.contains("hypotension"): return 14
            case "associations" where v.contains("confusion") || v.contains("altered"): return 12
            case "exam"   where v.contains("cold") && v.contains("peripheries"): return 12
            case "inv"    where v.contains("lactate") && v.contains("elevat"): return 20
            case "inv"    where v.contains("blood culture") && v.contains("positive"): return 22
            default: return 0
            }
        }

        // --- Pulmonary Embolism ---
        if d.contains("pulmonary embol") || d.contains(" pe") || d == "pe" {
            switch k {
            case "onset"  where v.contains("sudden"): return 10
            case "associations" where v.contains("pleuritic"): return 12
            case "associations" where v.contains("haemoptysis") || v.contains("hemoptysis"): return 14
            case "associations" where v.contains("leg swelling") || v.contains("dvt"): return 16
            case "pmh"   where v.contains("dvt") || v.contains("clot"): return 14
            case "inv"   where v.contains("d-dimer") && v.contains("elevat"): return 12
            case "inv"   where v.contains("ctpa") && v.contains("positive"): return 40
            default: return 0
            }
        }

        // --- DVT ---
        if d.contains("dvt") || d.contains("deep vein") {
            switch k {
            case "site"  where v.contains("calf") || v.contains("leg"): return 10
            case "character" where v.contains("swelling") || v.contains("tender"): return 12
            case "pmh"   where v.contains("dvt") || v.contains("thrombophilia"): return 16
            case "inv"   where v.contains("d-dimer") && v.contains("elevat"): return 10
            case "inv"   where v.contains("duplex") && v.contains("thrombus"): return 40
            default: return 0
            }
        }

        // --- Necrotising Fasciitis ---
        if d.contains("necrotis") || d.contains("fasciitis") {
            switch k {
            case "onset"  where v.contains("rapid") || v.contains("fast"): return 16
            case "character" where v.contains("severe") && v.contains("pain"): return 12
            case "exam"   where v.contains("crepitus"): return 30
            case "exam"   where v.contains("skin") && (v.contains("necrosis") || v.contains("bullae")): return 26
            case "associations" where v.contains("fever"): return 8
            case "inv"   where v.contains("crp") && v.contains(">150"): return 14
            case "inv"   where v.contains("wbc") && v.contains(">15"): return 12
            default: return 0
            }
        }

        // --- Acute Limb Ischaemia ---
        if d.contains("ischaemia") || d.contains("ischemia") || d.contains("embol") {
            switch k {
            case "onset"  where v.contains("sudden"): return 16
            case "character" where v.contains("pale") || v.contains("pulseless"): return 20
            case "associations" where v.contains("cold"): return 14
            case "associations" where v.contains("paresthesia") || v.contains("numbness"): return 14
            case "associations" where v.contains("paralysis") || v.contains("weakness"): return 20
            case "pmh"   where v.contains("af") || v.contains("atrial fibrillation"): return 16
            default: return 0
            }
        }

        return 0
    }
}

// MARK: - Correlation groups

private let correlationGroups: [FeatureCorrelationGroup] = [
    FeatureCorrelationGroup(
        name: "Inflammatory response",
        correlations: [
            "fever_tachycardia": 0.70,
            "fever_crp_elevated": 0.65,
            "fever_wbc_elevated": 0.65,
            "crp_wbc": 0.60
        ]
    ),
    FeatureCorrelationGroup(
        name: "Peritonism",
        correlations: [
            "guarding_rebound": 0.80,
            "guarding_rigidity": 0.75,
            "rebound_rigidity": 0.75
        ]
    ),
    FeatureCorrelationGroup(
        name: "Shock",
        correlations: [
            "tachycardia_hypotension": 0.75,
            "tachycardia_cold_peripheries": 0.70,
            "hypotension_cold_peripheries": 0.72
        ]
    ),
    FeatureCorrelationGroup(
        name: "Ischaemia signs (6 Ps)",
        correlations: [
            "pain_pallor": 0.60,
            "pain_pulselessness": 0.60,
            "pallor_pulselessness": 0.80,
            "pallor_perishing_cold": 0.70,
            "pulselessness_paresthesia": 0.65
        ]
    )
]

// Lookup ρ for a pair of feature keys already observed for the same hypothesis
private func correlationCoefficient(alreadyObserved obs: String, newKey: String) -> Double {
    for group in correlationGroups {
        let pair1 = "\(obs)_\(newKey)"
        let pair2 = "\(newKey)_\(obs)"
        if let rho = group.correlations[pair1] ?? group.correlations[pair2] {
            return rho
        }
    }
    return 0.0
}

// MARK: - Engine

@MainActor
final class SequentialDiagnosisEngine: ObservableObject {

    @Published private(set) var hypotheses: [DiagnosisHypothesis] = []
    @Published private(set) var evidenceLog: [ClinicalEvidence] = []
    @Published private(set) var isSeeded: Bool = false

    // Evidence keys already observed per hypothesis (for correlation dampening)
    private var observedKeys: [String: [String]] = [:]   // hypothesisName → [evidenceKey]

    // MARK: - Seed from Naive-Bayes snapshot

    func seed(
        chiefComplaint: String?,
        socratesSelections: [String: Set<String>],
        pmhNotes: String?,
        surgicalHistory: String?,
        examAbdo: String?,
        examGeneral: String?,
        investigations: [InvestigationEntry],
        ageYears: Int,
        sex: Sex
    ) {
        let results = BayesianDiagnosisEngine.infer(
            chiefComplaint: chiefComplaint,
            socratesSelections: socratesSelections,
            pmhNotes: pmhNotes,
            surgicalHistory: surgicalHistory,
            examAbdo: examAbdo,
            examGeneral: examGeneral,
            investigations: investigations,
            ageYears: ageYears,
            sex: sex
        )

        guard !results.isEmpty else {
            hypotheses = []
            isSeeded = false
            return
        }

        // Convert integer probability back to log-odds (log(p / (1 - p)))
        hypotheses = results.map { r in
            let p = max(0.01, min(0.99, Double(r.probability) / 100.0))
            let logOdds = log(p / (1.0 - p))
            var h = DiagnosisHypothesis(
                name: r.name,
                icdCode: r.icdCode,
                logPosterior: logOdds,
                contributingEvidence: r.evidence.map { ($0, 0.0) }
            )
            h.probability = p
            return h
        }

        observedKeys = Dictionary(uniqueKeysWithValues: hypotheses.map { ($0.name, []) })
        recomputeProbabilities()
        isSeeded = true
    }

    // MARK: - Incremental update

    func update(with evidence: ClinicalEvidence) {
        guard isSeeded else { return }

        evidenceLog.append(evidence)

        for i in hypotheses.indices {
            let name = hypotheses[i].name
            var rawLR = LogLRTable.logLR(key: evidence.key, value: evidence.value, forDiagnosis: name)

            // Correlation dampening
            if rawLR != 0 {
                let prevKeys = observedKeys[name] ?? []
                let maxRho = prevKeys.map { correlationCoefficient(alreadyObserved: $0, newKey: evidence.key) }.max() ?? 0.0
                rawLR *= (1.0 - maxRho)
            }

            hypotheses[i].logPosterior += rawLR
            if rawLR != 0 {
                hypotheses[i].contributingEvidence.append((evidence.displayLabel, rawLR))
            }
        }

        // Record key as observed for each hypothesis
        for name in hypotheses.map(\.name) {
            observedKeys[name, default: []].append(evidence.key)
        }

        recomputeProbabilities()
    }

    // MARK: - Retract evidence (full replay)

    func retract(_ evidence: ClinicalEvidence) {
        evidenceLog.removeAll { $0.id == evidence.id }
        resetToSeeded()
        for ev in evidenceLog { update(with: ev) }
    }

    // MARK: - Reset

    func reset() {
        hypotheses = []
        evidenceLog = []
        observedKeys = [:]
        isSeeded = false
    }

    // MARK: - Query

    func topDiagnoses(n: Int = 5) -> [DiagnosisHypothesis] {
        Array(hypotheses.sorted { $0.probability > $1.probability }.prefix(n))
    }

    func leadDiagnosis() -> DiagnosisHypothesis? {
        hypotheses.max(by: { $0.probability < $1.probability })
    }

    // MARK: - Private helpers

    private func resetToSeeded() {
        // Re-seed from current hypotheses keeping names/ICDs but zero-ing incremental evidence
        for i in hypotheses.indices {
            hypotheses[i].contributingEvidence = hypotheses[i].contributingEvidence.filter { $0.logLR == 0.0 }
        }
        observedKeys = Dictionary(uniqueKeysWithValues: hypotheses.map { ($0.name, []) })
    }

    private func recomputeProbabilities() {
        guard !hypotheses.isEmpty else { return }
        // Convert log-posteriors to probabilities via softmax
        let logPs = hypotheses.map(\.logPosterior)
        let maxLP = logPs.max() ?? 0
        let exps = logPs.map { exp($0 - maxLP) }
        let sumExp = exps.reduce(0, +)
        for i in hypotheses.indices {
            hypotheses[i].probability = sumExp > 0 ? exps[i] / sumExp : 1.0 / Double(hypotheses.count)
        }
    }
}
