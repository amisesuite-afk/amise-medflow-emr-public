import Foundation
import SwiftData

@Model
final class BillingLineItem {
    var id: UUID
    var remoteId: String?
    var pendingSync: Bool
    var syncCode: String = ""  // stable offline peer-sync ID, set in init()
    var syncedAt: Date?
    var cptCode: String
    var cptDescription: String
    var cptCategory: String
    var units: Int
    var amountXCD: Double   // fee per unit in XCD
    var modifier: String
    var note: String
    var addedAt: Date
    // Last local change. Optional so existing stores migrate without a default (nil = not edited
    // since this was added). The push clears pendingSync only if it did not change during the
    // request. Set with markEdited().
    var updatedAt: Date?
    var patient: Patient?

    init(code: String, description: String, category: String) {
        self.id = UUID()
        self.syncCode = UUID().uuidString
        self.pendingSync = true
        self.cptCode = code
        self.cptDescription = description
        self.cptCategory = category
        self.units = 1
        self.amountXCD = 0
        self.modifier = ""
        self.note = ""
        self.addedAt = .now
        self.updatedAt = .now
    }

    /// Call after every local edit: the next sync sends it (an update once the row exists).
    func markEdited() {
        updatedAt = .now
        pendingSync = true
    }
}
