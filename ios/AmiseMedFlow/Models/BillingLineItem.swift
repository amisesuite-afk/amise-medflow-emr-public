import Foundation
import SwiftData

@Model
final class BillingLineItem {
    var id: UUID
    var cptCode: String
    var cptDescription: String
    var cptCategory: String
    var units: Int
    var modifier: String
    var note: String
    var addedAt: Date
    var patient: Patient?

    init(code: String, description: String, category: String) {
        self.id = UUID()
        self.cptCode = code
        self.cptDescription = description
        self.cptCategory = category
        self.units = 1
        self.modifier = ""
        self.note = ""
        self.addedAt = .now
    }
}
