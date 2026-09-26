import Foundation
import SwiftData

@Model
final class Prescription {
    var id: UUID
    var drug: String
    var dose: String
    var route: String
    var frequency: String
    var duration: String
    var indication: String
    var instructions: String?
    var prescribedAt: Date
    var pendingSync: Bool
    var remoteId: String?
    var syncCode: String = ""  // stable offline peer-sync ID, set in init()
    var syncedAt: Date?
    // Last local change. Optional so existing stores migrate without a default (nil = not edited
    // since this was added). The push clears pendingSync only if it did not change during the
    // request. Set with markEdited().
    var updatedAt: Date?
    var patient: Patient?

    init(
        drug: String,
        dose: String = "",
        route: String = "Oral",
        frequency: String = "",
        duration: String = "",
        indication: String = ""
    ) {
        self.id = UUID()
        self.syncCode = UUID().uuidString
        self.drug = drug
        self.dose = dose
        self.route = route
        self.frequency = frequency
        self.duration = duration
        self.indication = indication
        self.prescribedAt = .now
        self.pendingSync = true
        self.updatedAt = .now
    }

    /// Call after every local edit: the next sync sends it (an update once the row exists).
    func markEdited() {
        updatedAt = .now
        pendingSync = true
    }

    var displayLine: String {
        var parts = [drug]
        if !dose.isEmpty { parts.append(dose) }
        if !route.isEmpty { parts.append(route) }
        if !frequency.isEmpty { parts.append(frequency) }
        return parts.joined(separator: " · ")
    }
}
