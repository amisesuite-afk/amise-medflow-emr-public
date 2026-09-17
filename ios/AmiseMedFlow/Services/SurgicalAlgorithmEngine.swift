import Foundation

// Deterministic lookup engine over SurgicalVademecum — no network, no AI.
final class SurgicalAlgorithmEngine {
    static let shared = SurgicalAlgorithmEngine()
    private init() {}

    private let conditions = SurgicalVademecum.allConditions

    // MARK: - Lookup

    func lookup(id: String) -> SurgicalCondition? {
        conditions.first { $0.id == id }
    }

    // Match a free-text diagnosis name (from BayesianDiagnosisEngine or manual entry)
    func lookup(diagnosisName: String?) -> SurgicalCondition? {
        guard let name = diagnosisName, !name.isEmpty else { return nil }
        let q = name.lowercased()
        // Exact name match
        if let exact = conditions.first(where: { $0.name.lowercased() == q }) { return exact }
        // Alias match
        if let alias = conditions.first(where: { $0.searchAliases.contains(where: { $0.lowercased() == q }) }) { return alias }
        // Fuzzy: all tokens of the query appear in the name or any alias
        return search(q).first
    }

    // MARK: - By System

    func conditions(for system: SurgicalSystem) -> [SurgicalCondition] {
        conditions.filter { $0.system == system }
            .sorted { $0.urgency.sortOrder < $1.urgency.sortOrder }
    }

    // MARK: - Search

    func search(_ query: String) -> [SurgicalCondition] {
        let terms = query.lowercased().split(separator: " ").map(String.init)
        guard !terms.isEmpty else { return conditions }
        return conditions.filter { condition in
            let haystack = ([condition.name, condition.icd10, condition.summary]
                + condition.searchAliases
                + condition.redFlags
                + condition.pearls).joined(separator: " ").lowercased()
            return terms.allSatisfy { haystack.contains($0) }
        }
    }

    // MARK: - Urgency Filter

    func conditions(urgency: SurgicalUrgency) -> [SurgicalCondition] {
        conditions.filter { $0.urgency == urgency }
    }

    // MARK: - All Systems (for grid)

    var systems: [SurgicalSystem] { SurgicalSystem.allCases }
}

extension SurgicalUrgency {
    var sortOrder: Int {
        switch self {
        case .immediate:  return 0
        case .emergency:  return 1
        case .urgent:     return 2
        case .elective:   return 3
        }
    }
}
