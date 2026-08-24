import Foundation
import SwiftData

@Model
final class BillingLineItem {
    var id: UUID = UUID()
    var cptCode: String = ""
    var cptDescription: String = ""
    var cptCategory: String = ""
    var units: Int = 1
    var modifier: String = ""
    var note: String = ""
    var addedAt: Date = .now
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
