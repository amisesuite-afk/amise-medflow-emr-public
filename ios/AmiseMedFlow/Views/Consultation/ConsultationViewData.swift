// ConsultationViewData.swift
// Model types and layout helpers for ConsultationView.

import SwiftUI
import SwiftData

// ConsultationViewData.swift
// Model types and data constants for ConsultationView.
// Keeping data constants in a separate file improves compile-time
// incremental isolation and makes individual data tables easy to find.

import SwiftUI
import SwiftData

// MARK: - Allergy model (JSON-encoded in Patient.allergiesJson)

struct AllergyEntry: Codable, Identifiable {
    var id: UUID = UUID()
    var name: String
    var severity: String  // "Mild" | "Moderate" | "Severe"
    var reaction: String
}

struct PMHEntry: Codable, Identifiable {
    var id: UUID = UUID()
    var condition: String
    var yearText: String = ""   // e.g. "2018", "~2015", "" if unknown
}

struct PSHxEntry: Codable, Identifiable {
    var id: UUID = UUID()
    var procedure: String
    var yearText: String = ""       // e.g. "2019", "Mar 2020"
    var anaesthetic: String = ""    // "GA" | "Spinal" | "Epidural" | "Local" | "Sedation" | "Regional"
}

extension Patient {
    var allergies: [AllergyEntry] {
        get {
            guard let json = allergiesJson, let data = json.data(using: .utf8) else { return [] }
            return (try? JSONDecoder().decode([AllergyEntry].self, from: data)) ?? []
        }
        set {
            allergiesJson = (try? String(data: JSONEncoder().encode(newValue), encoding: .utf8)) ?? nil
        }
    }

    var consultationCompleteness: (filled: Int, total: Int) {
        let checks: [Bool] = [
            !(chiefComplaint ?? "").isEmpty,
            !(hpi ?? "").isEmpty,
            !(pmhNotes ?? "").isEmpty || !(surgicalHistory ?? "").isEmpty || !pmhEntries.isEmpty || !pshxEntries.isEmpty,
            !allergies.isEmpty,
            !prescriptions.isEmpty,
            !(examGeneral ?? "").isEmpty || !(examAbdo ?? "").isEmpty,
            workingDiagnosis != nil,
            !(managementPlan ?? "").isEmpty
        ]
        return (checks.filter { $0 }.count, checks.count)
    }

    // MARK: - Allergy helpers

    var hasCriticalAllergy: Bool {
        allergies.contains {
            $0.severity.lowercased().contains("anaphylaxis") ||
            $0.severity.lowercased().contains("severe")
        }
    }

    var criticalAllergies: [AllergyEntry] {
        allergies.filter {
            $0.severity.lowercased().contains("anaphylaxis") ||
            $0.severity.lowercased().contains("severe")
        }
    }

    var hasPenicillinAllergy: Bool {
        allergies.contains {
            let n = $0.name.lowercased()
            return n.contains("penicillin") || n.contains("amoxicillin") ||
                   n.contains("amoxil") || n.contains("co-amoxiclav") ||
                   n.contains("augmentin")
        }
    }

    // MARK: - Anticoagulation helpers

    var activeAnticoagulants: [Prescription] {
        prescriptions.filter {
            let n = $0.drug.lowercased()
            return n.contains("warfarin") || n.contains("rivaroxaban") ||
                   n.contains("apixaban") || n.contains("dabigatran") ||
                   n.contains("edoxaban") || n.contains("fondaparinux") ||
                   n.contains("heparin") || n.contains("enoxaparin") ||
                   n.contains("aspirin") || n.contains("clopidogrel") ||
                   n.contains("ticagrelor") || n.contains("prasugrel")
        }
    }

    var hasAnticoagulation: Bool { !activeAnticoagulants.isEmpty }

    // MARK: - Steroid therapy helpers

    var activeSteroids: [Prescription] {
        prescriptions.filter {
            let n = $0.drug.lowercased()
            return n.contains("prednisolone") || n.contains("prednisone") ||
                   n.contains("dexamethasone") || n.contains("hydrocortisone") ||
                   n.contains("methylprednisolone") || n.contains("fludrocortisone") ||
                   n.contains("betamethasone")
        }
    }

    var hasSteroidTherapy: Bool { !activeSteroids.isEmpty }

    // MARK: - PMH text helpers (keyword scan on persisted pmhNotes)

    var hasOSAinHistory: Bool {
        let text = (pmhNotes ?? "").lowercased()
        return text.contains(" osa") || text.contains("osa\n") ||
               text.contains("osa,") || text.contains("obstructive sleep") ||
               text.contains("sleep apnoea") || text.contains("sleep apnea")
    }

    var hasDiabetesInHistory: Bool {
        let text = (pmhNotes ?? "").lowercased()
        return text.contains("t2dm") || text.contains("t1dm") || text.contains("diabetes")
    }
}

// MARK: - Investigation model (JSON-encoded in Patient.investigationsJson)

struct InvestigationEntry: Codable, Identifiable {
    var id: UUID = UUID()
    var name: String
    var category: InvCategory
    var status: InvStatus
    var result: String = ""
    var orderedAt: Date = Date()
    var resultedAt: Date?
    var suggestedFor: String = ""

    enum InvCategory: String, Codable, CaseIterable {
        case blood     = "Blood"
        case imaging   = "Imaging"
        case endoscopy = "Endoscopy"
        case pathology = "Pathology"
        case other     = "Other"

        var icon: String {
            switch self {
            case .blood:      return "drop.fill"
            case .imaging:    return "photo"
            case .endoscopy:  return "circle.dotted"
            case .pathology:  return "eyedropper.halffull"
            case .other:      return "testtube.2"
            }
        }
    }

    enum InvStatus: String, Codable, CaseIterable {
        case suggested = "Suggested"
        case ordered   = "Ordered"
        case pending   = "Pending"
        case resulted  = "Resulted"
        case cancelled = "Cancelled"

        var next: InvStatus? {
            switch self {
            case .suggested: return .ordered
            case .ordered:   return .pending
            case .pending:   return .resulted
            case .resulted, .cancelled: return nil
            }
        }

        var nextLabel: String {
            switch self {
            case .suggested: return "Order"
            case .ordered:   return "Pending"
            case .pending:   return "Resulted"
            case .resulted, .cancelled: return ""
            }
        }
    }
}

extension Patient {
    var investigations: [InvestigationEntry] {
        get {
            guard let json = investigationsJson, let data = json.data(using: .utf8) else { return [] }
            return (try? JSONDecoder().decode([InvestigationEntry].self, from: data)) ?? []
        }
        set {
            investigationsJson = (try? String(data: JSONEncoder().encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}

extension Patient {
    var pmhEntries: [PMHEntry] {
        get {
            guard let json = pmhEntriesJson, let data = json.data(using: .utf8) else { return [] }
            return (try? JSONDecoder().decode([PMHEntry].self, from: data)) ?? []
        }
        set {
            pmhEntriesJson = (try? String(data: JSONEncoder().encode(newValue), encoding: .utf8)) ?? nil
        }
    }

    var pshxEntries: [PSHxEntry] {
        get {
            guard let json = pshxEntriesJson, let data = json.data(using: .utf8) else { return [] }
            return (try? JSONDecoder().decode([PSHxEntry].self, from: data)) ?? []
        }
        set {
            pshxEntriesJson = (try? String(data: JSONEncoder().encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}

// MARK: - Chip flow layout (wraps chips to next row automatically)

struct ChipFlow: Layout {
    var hSpacing: CGFloat = 8
    var vSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = layout(proposal: proposal, subviews: subviews)
        let h = rows.map(\.maxH).reduce(0, +) + CGFloat(max(0, rows.count - 1)) * vSpacing
        return CGSize(width: proposal.width ?? 0, height: max(h, 0))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in layout(proposal: proposal, subviews: subviews) {
            var x = bounds.minX
            for item in row.items {
                item.view.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
                x += item.w + hSpacing
            }
            y += row.maxH + vSpacing
        }
    }

    private struct Row {
        var items: [(view: LayoutSubviews.Element, w: CGFloat, h: CGFloat)] = []
        var maxH: CGFloat { items.map(\.h).max() ?? 0 }
    }

    private func layout(proposal: ProposedViewSize, subviews: Subviews) -> [Row] {
        let avail = proposal.width ?? 320
        var rows: [Row] = []
        var row = Row()
        var x: CGFloat = 0
        for view in subviews {
            let s = view.sizeThatFits(.unspecified)
            if !row.items.isEmpty && x + s.width > avail {
                rows.append(row); row = Row(); x = 0
            }
            row.items.append((view, s.width, s.height))
            x += s.width + hSpacing
        }
        if !row.items.isEmpty { rows.append(row) }
        return rows
    }
}

// MARK: - Consultation sub-tab

enum ConsultTab: String, CaseIterable {
    case cc        = "CC"
    case hpi       = "HPI"
    case pmh       = "PMH"
    case pshx      = "PSHx"
    case meds      = "Meds"
    case allergies = "Allergies"
    case social    = "Social"
    case exam           = "Exam"
    case investigations = "Ix"
    case diagnosis      = "Diagnosis"
    case plan      = "Plan"
    case history   = "History"
    // Pathway steps (see ConsultPathway)
    case risk      = "Risk"
    case ward      = "Ward"
    case trauma    = "ATLS"
    case burns     = "Burns"
    case screening = "Screening"
}
