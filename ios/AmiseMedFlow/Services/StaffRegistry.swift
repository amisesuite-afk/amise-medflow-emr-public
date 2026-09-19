import Foundation

// Persists staff names per role in UserDefaults so they appear as autocomplete
// suggestions in surgical note and endoscopy report forms.

final class StaffRegistry {
    static let shared = StaffRegistry()

    enum Role: String, CaseIterable {
        case surgeon, anaesthetist, nurse, assistant
        fileprivate var key: String { "staffReg.\(rawValue)s" }
    }

    private init() {}

    func names(for role: Role) -> [String] {
        (UserDefaults.standard.stringArray(forKey: role.key) ?? []).sorted()
    }

    func add(_ name: String, to role: Role) {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 2 else { return }
        var existing = UserDefaults.standard.stringArray(forKey: role.key) ?? []
        guard !existing.contains(trimmed) else { return }
        existing.append(trimmed)
        UserDefaults.standard.set(existing, forKey: role.key)
    }
}
