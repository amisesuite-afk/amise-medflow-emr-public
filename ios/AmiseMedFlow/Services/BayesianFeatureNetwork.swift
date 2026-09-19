import Foundation

// MARK: - Bayesian Feature Network (DAG)
// Models conditional dependencies between clinical features so that when
// feature A is observed, the marginal information from a dependent feature B
// is correctly discounted.
//
// Architecture:
//   Directed Acyclic Graph (DAG) of feature nodes.
//   Each directed edge A → B carries a conditional probability table (CPT):
//     P(B = present | A = present)  and  P(B = present | A = absent)
//
//   Effective log-LR for feature B given already-observed parent A:
//     effectiveLR(B | A observed) = log[ P(B=1|A=1) / P(B=0|A=1) ]
//                                 - log[ P(B=1|A=0) / P(B=0|A=0) ]
//     (the second term is the baseline LR for B independent of A)
//
//   When A is NOT yet observed, B contributes its full unconditional LR.
//   This replaces the flat ρ-dampening in SequentialDiagnosisEngine with
//   a principled CPT-based adjustment.
//
// All tables are hard-coded from published clinical data and expert elicitation.

// MARK: - Node and edge types

struct FeatureNode: Identifiable, Equatable {
    let id: String          // canonical key, matches BayesianDiagnosisEngine feature keys
    let displayName: String
    let baseProbability: Double   // P(feature present in general surgical population)
}

struct CPTEdge {
    let parentID: String
    let childID: String
    // P(child present | parent present)
    let pChildGivenParent: Double
    // P(child present | parent absent)
    let pChildGivenNoParent: Double

    // Unconditional log-LR for child feature in a given diagnostic context
    // (used when parent has not been observed yet)
    func unconditionalLogLR(childPresent: Bool, baseLR: Double) -> Double { baseLR }

    // Adjusted log-LR for child given parent IS observed and present
    // Returns the incremental log-likelihood beyond what the parent already contributed.
    func adjustedLogLR(childPresent: Bool) -> Double {
        if childPresent {
            let prior = max(1e-6, pChildGivenNoParent)
            let posterior = max(1e-6, pChildGivenParent)
            return log(posterior / prior)
        } else {
            let prior = max(1e-6, 1.0 - pChildGivenNoParent)
            let posterior = max(1e-6, 1.0 - pChildGivenParent)
            return log(posterior / prior)
        }
    }
}

// MARK: - Clinical feature DAG

// Nodes represent observable clinical features.
// Edges encode causal / diagnostic dependency between them.

private let featureNodes: [FeatureNode] = [
    // Inflammatory / Infectious
    FeatureNode(id: "fever",          displayName: "Fever (≥38°C)",             baseProbability: 0.30),
    FeatureNode(id: "tachycardia",    displayName: "Tachycardia (HR>100)",       baseProbability: 0.25),
    FeatureNode(id: "hypotension",    displayName: "Hypotension (SBP<100)",      baseProbability: 0.08),
    FeatureNode(id: "wbc_elevated",   displayName: "WBC Elevated (>11)",         baseProbability: 0.35),
    FeatureNode(id: "crp_elevated",   displayName: "CRP Elevated (>50)",         baseProbability: 0.40),
    FeatureNode(id: "lactate_raised", displayName: "Lactate ≥2 mmol/L",         baseProbability: 0.12),

    // Peritoneal / Abdominal
    FeatureNode(id: "guarding",       displayName: "Abdominal Guarding",         baseProbability: 0.18),
    FeatureNode(id: "rebound",        displayName: "Rebound Tenderness",         baseProbability: 0.15),
    FeatureNode(id: "rigidity",       displayName: "Board-like Rigidity",        baseProbability: 0.06),

    // Vascular / Ischaemic
    FeatureNode(id: "pallor",         displayName: "Limb Pallor",                baseProbability: 0.10),
    FeatureNode(id: "pulselessness",  displayName: "Absent Pulse",               baseProbability: 0.05),
    FeatureNode(id: "cold_limb",      displayName: "Cold Limb",                  baseProbability: 0.08),
    FeatureNode(id: "paresthesia",    displayName: "Paraesthesia / Numbness",    baseProbability: 0.12),

    // Respiratory
    FeatureNode(id: "dyspnoea",       displayName: "Dyspnoea",                   baseProbability: 0.20),
    FeatureNode(id: "pleuritic_pain", displayName: "Pleuritic Chest Pain",       baseProbability: 0.10),
    FeatureNode(id: "haemoptysis",    displayName: "Haemoptysis",                baseProbability: 0.04),

    // Jaundice / Biliary
    FeatureNode(id: "jaundice",       displayName: "Jaundice",                   baseProbability: 0.08),
    FeatureNode(id: "dark_urine",     displayName: "Dark Urine",                 baseProbability: 0.12),
    FeatureNode(id: "pale_stool",     displayName: "Pale Stool",                 baseProbability: 0.06),
    FeatureNode(id: "ruq_pain",       displayName: "RUQ Pain",                   baseProbability: 0.20),
    FeatureNode(id: "murphy_sign",    displayName: "Murphy's Sign",              baseProbability: 0.12)
]

// Edges encoding causal clinical dependencies
// Infection / SIRS cascade: fever → tachycardia → hypotension → lactate raised
// Peritonism hierarchy: guarding → rebound → rigidity
// Ischaemia 6Ps: pallor → pulselessness; cold_limb ↔ pallor
// PE triad: dyspnoea → pleuritic_pain; haemoptysis co-varies with pleuritic_pain
// Biliary: jaundice drives dark_urine and pale_stool; ruq_pain co-varies with murphy_sign

private let cptEdges: [CPTEdge] = [
    // Infection / SIRS cascade
    CPTEdge(parentID: "fever",        childID: "tachycardia",   pChildGivenParent: 0.65, pChildGivenNoParent: 0.15),
    CPTEdge(parentID: "fever",        childID: "wbc_elevated",  pChildGivenParent: 0.70, pChildGivenNoParent: 0.20),
    CPTEdge(parentID: "fever",        childID: "crp_elevated",  pChildGivenParent: 0.75, pChildGivenNoParent: 0.25),
    CPTEdge(parentID: "tachycardia",  childID: "hypotension",   pChildGivenParent: 0.30, pChildGivenNoParent: 0.05),
    CPTEdge(parentID: "hypotension",  childID: "lactate_raised",pChildGivenParent: 0.60, pChildGivenNoParent: 0.08),
    CPTEdge(parentID: "wbc_elevated", childID: "crp_elevated",  pChildGivenParent: 0.70, pChildGivenNoParent: 0.25),

    // Peritonism hierarchy
    CPTEdge(parentID: "guarding",     childID: "rebound",       pChildGivenParent: 0.70, pChildGivenNoParent: 0.05),
    CPTEdge(parentID: "rebound",      childID: "rigidity",      pChildGivenParent: 0.55, pChildGivenNoParent: 0.02),

    // Ischaemia 6Ps
    CPTEdge(parentID: "pallor",       childID: "cold_limb",     pChildGivenParent: 0.75, pChildGivenNoParent: 0.15),
    CPTEdge(parentID: "pallor",       childID: "pulselessness", pChildGivenParent: 0.55, pChildGivenNoParent: 0.05),
    CPTEdge(parentID: "cold_limb",    childID: "paresthesia",   pChildGivenParent: 0.50, pChildGivenNoParent: 0.10),
    CPTEdge(parentID: "pulselessness",childID: "paresthesia",   pChildGivenParent: 0.60, pChildGivenNoParent: 0.10),

    // PE triad
    CPTEdge(parentID: "dyspnoea",     childID: "pleuritic_pain",pChildGivenParent: 0.45, pChildGivenNoParent: 0.08),
    CPTEdge(parentID: "pleuritic_pain",childID: "haemoptysis",  pChildGivenParent: 0.25, pChildGivenNoParent: 0.03),

    // Biliary triad
    CPTEdge(parentID: "jaundice",     childID: "dark_urine",    pChildGivenParent: 0.80, pChildGivenNoParent: 0.10),
    CPTEdge(parentID: "jaundice",     childID: "pale_stool",    pChildGivenParent: 0.70, pChildGivenNoParent: 0.05),
    CPTEdge(parentID: "ruq_pain",     childID: "murphy_sign",   pChildGivenParent: 0.55, pChildGivenNoParent: 0.08)
]

// MARK: - Lookup helpers

private let edgeByChild: [String: [CPTEdge]] = Dictionary(
    grouping: cptEdges, by: \.childID
)
private let nodeByID: [String: FeatureNode] = Dictionary(
    uniqueKeysWithValues: featureNodes.map { ($0.id, $0) }
)

// MARK: - Engine

enum BayesianFeatureNetwork {

    // Returns the set of parent feature IDs for a given child feature ID
    static func parents(of featureID: String) -> [String] {
        edgeByChild[featureID]?.map(\.parentID) ?? []
    }

    // Returns CPT edges for a given child
    static func edges(for featureID: String) -> [CPTEdge] {
        edgeByChild[featureID] ?? []
    }

    // Compute the adjusted log-LR for a feature given the set of already-observed features.
    // If no parent of this feature has been observed, the full `baseLogLR` is returned.
    // If one or more parents have been observed, the CPT adjustment is applied.
    //
    // featureID       — canonical feature key being evaluated
    // featurePresent  — whether the feature is present (true) or absent (false)
    // observedIDs     — set of feature IDs already entered into evidence
    // baseLogLR       — unconditioned log-LR from the diagnosis engine's lookup table
    static func adjustedLogLR(
        featureID: String,
        featurePresent: Bool,
        observedIDs: Set<String>,
        baseLogLR: Double
    ) -> Double {
        let relevantEdges = edges(for: featureID).filter { observedIDs.contains($0.parentID) }
        guard !relevantEdges.isEmpty else { return baseLogLR }

        // When multiple parents are observed, use the most influential edge
        // (the one yielding the largest adjustment in absolute terms)
        let adjustments = relevantEdges.map { $0.adjustedLogLR(childPresent: featurePresent) }
        let maxAdj = adjustments.max(by: { abs($0) < abs($1) }) ?? baseLogLR

        // If the CPT adjustment is smaller than the base LR, cap it
        // to avoid artificially inflating evidence beyond the CPT
        return featurePresent
            ? min(baseLogLR, maxAdj)
            : max(baseLogLR, maxAdj)
    }

    // Whether a DAG edge exists from parentID → childID
    static func hasEdge(from parentID: String, to childID: String) -> Bool {
        cptEdges.contains { $0.parentID == parentID && $0.childID == childID }
    }

    // All nodes (for UI rendering of the feature graph)
    static var allNodes: [FeatureNode] { featureNodes }

    // Topological order of node IDs (Kahn's algorithm — no cycles by construction)
    static var topologicalOrder: [String] {
        var inDegree = Dictionary(uniqueKeysWithValues: featureNodes.map { ($0.id, 0) })
        for e in cptEdges { inDegree[e.childID, default: 0] += 1 }
        var queue = inDegree.filter { $0.value == 0 }.map(\.key).sorted()
        var result: [String] = []
        var degree = inDegree
        while !queue.isEmpty {
            let n = queue.removeFirst()
            result.append(n)
            for e in cptEdges where e.parentID == n {
                degree[e.childID, default: 0] -= 1
                if degree[e.childID] == 0 { queue.append(e.childID); queue.sort() }
            }
        }
        return result
    }
}
