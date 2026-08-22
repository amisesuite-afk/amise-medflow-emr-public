import SwiftUI
import SwiftData

// MARK: - Note types (maps to backend clinical_notes.note_type)

enum NoteType: String, Codable, CaseIterable {
    case soap           = "soap"
    case progress       = "progress"
    case operative      = "operative"
    case endoscopy      = "procedure"       // backend uses 'procedure'
    case discharge      = "discharge"
    case consultation   = "consultation"
    case referralLetter = "referral_letter"
    case other          = "other"

    var label: String {
        switch self {
        case .soap:           return "SOAP Note"
        case .progress:       return "Progress Note"
        case .operative:      return "Operative Note"
        case .endoscopy:      return "Endoscopy Report"
        case .discharge:      return "Discharge Summary"
        case .consultation:   return "Consultation"
        case .referralLetter: return "Referral Letter"
        case .other:          return "Note"
        }
    }

    var icon: String {
        switch self {
        case .soap:           return "stethoscope"
        case .progress:       return "arrow.clockwise.circle"
        case .operative:      return "scissors"
        case .endoscopy:      return "circle.dotted"
        case .discharge:      return "door.right.hand.open"
        case .consultation:   return "person.2"
        case .referralLetter: return "envelope"
        case .other:          return "note.text"
        }
    }

    var isStructured: Bool {
        self == .soap || self == .progress
    }
}

enum NoteStatus: String, Codable, CaseIterable {
    case draft  = "draft"
    case signed = "signed"
}

// MARK: - Model

@Model
final class ClinicalNote {
    var id: UUID
    var remoteId: String?
    var noteType: NoteType
    var status: NoteStatus
    var createdAt: Date
    var updatedAt: Date
    var syncedAt: Date?
    var pendingSync: Bool

    // SOAP / Progress fields
    var subjective: String?
    var objective: String?
    var assessment: String?
    var plan: String?

    // Free-text for operative / endoscopy / discharge / other
    var freeText: String?

    // Relationship back to patient (set by Patient.clinicalNotes)
    var patient: Patient?

    init(noteType: NoteType, patient: Patient) {
        self.id = UUID()
        self.noteType = noteType
        self.status = .draft
        self.createdAt = .now
        self.updatedAt = .now
        self.pendingSync = true
        self.patient = patient
    }

    // Combined content for syncing to backend
    var contentForSync: String {
        if noteType.isStructured {
            var parts: [String] = []
            if let s = subjective,  !s.isEmpty { parts.append("S:\n\(s)") }
            if let o = objective,   !o.isEmpty { parts.append("O:\n\(o)") }
            if let a = assessment,  !a.isEmpty { parts.append("A:\n\(a)") }
            if let p = plan,        !p.isEmpty { parts.append("P:\n\(p)") }
            return parts.joined(separator: "\n\n")
        }
        return freeText ?? ""
    }

    var isEmpty: Bool { contentForSync.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
}
