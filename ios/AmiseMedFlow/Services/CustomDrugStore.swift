import Foundation

// Persists user-added drug names that aren't in the built-in formulary.
// Saved to UserDefaults; included in SurgicalDrug.search() results.

final class CustomDrugStore {
    static let shared = CustomDrugStore()
    private let key = "customDrugs.names"
    private init() {}

    var names: [String] {
        (UserDefaults.standard.stringArray(forKey: key) ?? []).sorted()
    }

    func add(_ name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 2 else { return }
        var existing = UserDefaults.standard.stringArray(forKey: key) ?? []
        guard !existing.contains(trimmed) else { return }
        existing.append(trimmed)
        UserDefaults.standard.set(existing, forKey: key)
    }

    var asDrugs: [SurgicalDrug] {
        names.map { SurgicalDrug(name: $0, category: "Custom", commonDoses: "", route: "", notes: "User-added") }
    }
}
