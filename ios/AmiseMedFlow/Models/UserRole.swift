import Foundation

enum UserRole: String, Codable {
    case frontDesk = "front_desk"
    case nurse     = "nurse"
    case doctor    = "doctor"
    case admin     = "admin"

    var rank: Int {
        switch self {
        case .frontDesk: 0
        case .nurse:     1
        case .doctor:    2
        case .admin:     3
        }
    }

    func hasAccess(to minimumRole: UserRole) -> Bool {
        rank >= minimumRole.rank
    }

    var displayName: String {
        switch self {
        case .frontDesk: "Front Desk"
        case .nurse:     "Nurse"
        case .doctor:    "Doctor"
        case .admin:     "Admin"
        }
    }

    // Sections visible when this role opens a patient record
    var visiblePatientSections: Set<PatientDetailSection> {
        switch self {
        case .frontDesk:
            return [.demographics]
        case .nurse:
            return [
                .overview, .demographics,
                .cc, .hpi, .pmh, .pshx, .allergies, .social,
                .exam, .investigations,
                .notes, .vitals, .documents
            ]
        case .doctor, .admin:
            return Set(PatientDetailSection.allCases)
        }
    }
}

private struct _UserProfileRow: Decodable {
    let role: String?
}
