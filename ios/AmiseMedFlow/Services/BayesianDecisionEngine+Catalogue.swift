// BayesianDecisionEngine+Catalogue.swift
// Full diagnostic catalogue: browse and search all known conditions.

import Foundation

extension BayesianDecisionEngine {

    // MARK: - Diagnostic catalogue (search + browse)

    /// A lightweight descriptor used for browsing and search — no scoring weights.
    struct CatalogueEntry: Identifiable {
        let id = UUID()
        let name: String
        let icd: String
        let pool: String        // pool key (e.g. "headache", "abdominalPain")
        let logPrior: Int       // base prevalence — higher = more common

        /// Clinical priority tier derived from logPrior:
        ///   A (≥40) — very common; B (25–39) — common;
        ///   C (10–24) — less common; D (<10) — rare / contextual
        var tier: String {
            switch logPrior {
            case 40...: return "A"
            case 25..<40: return "B"
            case 10..<25: return "C"
            default: return "D"
            }
        }
    }

    /// All candidates from the external database across all pools, deduplicated by name.
    static var allCatalogueEntries: [CatalogueEntry] {
        guard let db = externalDatabase else { return [] }
        var seen = Set<String>()
        var result: [CatalogueEntry] = []
        for (poolKey, poolSpec) in db.pools.sorted(by: { $0.key < $1.key }) {
            for spec in poolSpec.candidates {
                guard seen.insert(spec.name).inserted else { continue }
                result.append(CatalogueEntry(name: spec.name, icd: spec.icd,
                                              pool: poolKey, logPrior: spec.logPrior))
            }
        }
        return result.sorted { $0.logPrior > $1.logPrior }
    }

    /// Search catalogue by diagnosis name, ICD code, or pool (symptom domain).
    /// Returns up to 20 matches, sorted by prevalence descending.
    static func searchCatalogue(_ query: String) -> [CatalogueEntry] {
        guard query.count >= 2 else { return [] }
        let q = query.lowercased()
        return allCatalogueEntries.filter {
            $0.name.lowercased().contains(q) ||
            $0.icd.lowercased().hasPrefix(q) ||
            $0.pool.lowercased().contains(q)
        }.prefix(20).map { $0 }
    }


}
