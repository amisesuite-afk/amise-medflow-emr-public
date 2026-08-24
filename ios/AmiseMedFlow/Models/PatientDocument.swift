import Foundation
import SwiftData

@Model
final class PatientDocument {
    var id: UUID
    var fileName: String
    var mimeType: String
    var storageUrl: String?
    var aiSummary: String?
    var extractedText: String?
    var uploadedAt: Date
    var remoteId: String?
    var patient: Patient?

    // Store image data locally (for photos taken in-app, pre-upload)
    var localData: Data?

    init(fileName: String, mimeType: String = "image/jpeg") {
        self.id = UUID()
        self.fileName = fileName
        self.mimeType = mimeType
        self.uploadedAt = .now
    }

    var fileIcon: String {
        if mimeType.contains("pdf") { return "doc.fill" }
        if mimeType.contains("image") { return "photo.fill" }
        return "doc.text.fill"
    }
}
