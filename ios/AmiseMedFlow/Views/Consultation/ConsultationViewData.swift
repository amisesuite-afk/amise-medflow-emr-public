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

// MARK: - CC surgical chip data

struct CCSurgicalChip: Identifiable {
    let id = UUID()
    let label: String
    let icon: String
}

struct CCSpecialtyGroup: Identifiable {
    let id = UUID()
    let name: String
    let icon: String
    let chips: [CCSurgicalChip]
}

let ccSpecialtyGroups: [CCSpecialtyGroup] = [
    CCSpecialtyGroup(name: "General & GI Surgery", icon: "scissors", chips: [
        CCSurgicalChip(label: "Abdominal pain",           icon: "waveform.path.ecg"),
        CCSurgicalChip(label: "Nausea / Vomiting",        icon: "arrow.up.circle"),
        CCSurgicalChip(label: "Hernia",                   icon: "arrow.up.left.and.arrow.down.right"),
        CCSurgicalChip(label: "Reflux / Heartburn",       icon: "flame"),
        CCSurgicalChip(label: "Change in bowel habit",    icon: "arrow.left.arrow.right"),
        CCSurgicalChip(label: "Rectal bleeding",          icon: "drop.fill"),
        CCSurgicalChip(label: "Anal pain",                icon: "figure.walk"),
        CCSurgicalChip(label: "Dysphagia",                icon: "mouth"),
        CCSurgicalChip(label: "Bloating",                 icon: "bubble.left"),
        CCSurgicalChip(label: "Jaundice",                 icon: "sun.max"),
        CCSurgicalChip(label: "Upper GI bleed",           icon: "drop.triangle.fill"),
        CCSurgicalChip(label: "Bowel obstruction",        icon: "stop.circle"),
        CCSurgicalChip(label: "Weight loss",              icon: "arrow.down.circle"),
        CCSurgicalChip(label: "Neck lump",                icon: "person.bust"),
        CCSurgicalChip(label: "Breast lump",              icon: "circle.circle"),
        CCSurgicalChip(label: "Skin lesion",              icon: "oval.lefthalf.filled"),
        CCSurgicalChip(label: "Wound / Post-op",          icon: "bandage"),
        CCSurgicalChip(label: "ERCP / Biliary",           icon: "circle.dotted"),
    ]),
    CCSpecialtyGroup(name: "Cardiovascular", icon: "heart.fill", chips: [
        CCSurgicalChip(label: "Chest pain",               icon: "heart.fill"),
        CCSurgicalChip(label: "Palpitations",             icon: "waveform"),
        CCSurgicalChip(label: "Hypertension review",      icon: "waveform.path.ecg.rectangle"),
        CCSurgicalChip(label: "Shortness of breath",      icon: "lungs.fill"),
        CCSurgicalChip(label: "Leg swelling / Oedema",    icon: "arrow.down.to.line"),
        CCSurgicalChip(label: "Syncope / Presyncope",     icon: "bolt.slash"),
        CCSurgicalChip(label: "Stroke / TIA",             icon: "brain.head.profile"),
        CCSurgicalChip(label: "Peripheral arterial disease", icon: "arrow.left.arrow.right.circle"),
    ]),
    CCSpecialtyGroup(name: "Respiratory", icon: "lungs.fill", chips: [
        CCSurgicalChip(label: "Cough",                    icon: "waveform.path"),
        CCSurgicalChip(label: "Wheeze / Asthma",          icon: "wind"),
        CCSurgicalChip(label: "Haemoptysis",              icon: "drop.fill"),
        CCSurgicalChip(label: "Pleuritic chest pain",     icon: "lungs"),
    ]),
    CCSpecialtyGroup(name: "Endocrine & Metabolic", icon: "staroflife", chips: [
        CCSurgicalChip(label: "Diabetes review",          icon: "cross.case"),
        CCSurgicalChip(label: "Thyroid symptoms",         icon: "staroflife"),
        CCSurgicalChip(label: "Adrenal symptoms",         icon: "bolt.circle"),
        CCSurgicalChip(label: "Obesity / Weight management", icon: "scalemass"),
        CCSurgicalChip(label: "Hyperlipidaemia review",   icon: "chart.line.uptrend.xyaxis"),
    ]),
    CCSpecialtyGroup(name: "Urology & Renal", icon: "drop", chips: [
        CCSurgicalChip(label: "Urinary symptoms",         icon: "drop"),
        CCSurgicalChip(label: "Renal colic",              icon: "bolt.fill"),
        CCSurgicalChip(label: "Haematuria",               icon: "drop.triangle"),
        CCSurgicalChip(label: "Urinary retention",        icon: "nosign"),
        CCSurgicalChip(label: "Scrotal / Testicular",     icon: "circle.grid.2x1"),
    ]),
    CCSpecialtyGroup(name: "Musculoskeletal", icon: "figure.walk.motion", chips: [
        CCSurgicalChip(label: "Joint pain",               icon: "figure.walk.motion"),
        CCSurgicalChip(label: "Back pain / Sciatica",     icon: "figure.stand"),
        CCSurgicalChip(label: "Limb swelling",            icon: "arrow.up.and.line.horizontal.and.arrow.down"),
        CCSurgicalChip(label: "Muscle weakness",          icon: "bolt.horizontal"),
    ]),
    CCSpecialtyGroup(name: "Neurology", icon: "brain.head.profile", chips: [
        CCSurgicalChip(label: "Headache",                 icon: "bolt.fill"),
        CCSurgicalChip(label: "Dizziness / Vertigo",      icon: "rotate.3d"),
        CCSurgicalChip(label: "Seizure",                  icon: "waveform.path.ecg"),
        CCSurgicalChip(label: "Memory / Cognitive",       icon: "brain"),
        CCSurgicalChip(label: "Numbness / Tingling",      icon: "hand.point.up"),
    ]),
    CCSpecialtyGroup(name: "Infectious & Tropical", icon: "thermometer.medium", chips: [
        CCSurgicalChip(label: "Fever / Infection",        icon: "thermometer.medium"),
        CCSurgicalChip(label: "Dengue fever",             icon: "thermometer.sun"),
        CCSurgicalChip(label: "Leptospirosis",            icon: "drop.degreesign"),
        CCSurgicalChip(label: "Sepsis",                   icon: "exclamationmark.triangle.fill"),
        CCSurgicalChip(label: "HIV / Immunodeficiency",   icon: "shield.slash"),
        CCSurgicalChip(label: "Skin / Soft tissue infection", icon: "bandage.fill"),
        CCSurgicalChip(label: "STI / Genital symptoms",   icon: "cross.circle"),
    ]),
    CCSpecialtyGroup(name: "Haematology & Oncology", icon: "drop.circle", chips: [
        CCSurgicalChip(label: "Anaemia / Fatigue",        icon: "battery.25"),
        CCSurgicalChip(label: "Lymphadenopathy",          icon: "circle.grid.3x3"),
        CCSurgicalChip(label: "Bruising / Bleeding",      icon: "bandage"),
        CCSurgicalChip(label: "Cancer follow-up",         icon: "arrow.clockwise.circle"),
    ]),
    CCSpecialtyGroup(name: "Gynaecology & Obstetrics", icon: "figure.and.child.holdinghands", chips: [
        CCSurgicalChip(label: "Pelvic pain",              icon: "waveform.path.ecg"),
        CCSurgicalChip(label: "Vaginal bleeding",         icon: "drop.fill"),
        CCSurgicalChip(label: "Amenorrhoea / Irregular periods", icon: "calendar.badge.exclamationmark"),
        CCSurgicalChip(label: "Dysmenorrhoea",            icon: "bolt.fill"),
        CCSurgicalChip(label: "Ovarian cyst symptoms",   icon: "circle.dotted"),
        CCSurgicalChip(label: "Fibroid symptoms",         icon: "circle.hexagongrid"),
        CCSurgicalChip(label: "Vaginal discharge",        icon: "drop"),
        CCSurgicalChip(label: "Menopausal symptoms",      icon: "thermometer.sun"),
        CCSurgicalChip(label: "PCOS review",              icon: "chart.bar"),
        CCSurgicalChip(label: "Pregnancy symptoms / Antenatal", icon: "heart.circle"),
        CCSurgicalChip(label: "Postpartum review",        icon: "person.2.circle"),
        CCSurgicalChip(label: "Fertility concerns",       icon: "leaf.circle"),
        CCSurgicalChip(label: "Dyspareunia",              icon: "exclamationmark.bubble"),
        CCSurgicalChip(label: "Vulval symptoms",          icon: "person.fill.questionmark"),
    ]),
    CCSpecialtyGroup(name: "Paediatrics", icon: "figure.child", chips: [
        CCSurgicalChip(label: "Fever in child",           icon: "thermometer.medium"),
        CCSurgicalChip(label: "Child with rash",          icon: "oval.portrait"),
        CCSurgicalChip(label: "Respiratory distress — child", icon: "lungs"),
        CCSurgicalChip(label: "Paediatric abdominal pain", icon: "waveform.path.ecg"),
        CCSurgicalChip(label: "Ear / Throat pain — child", icon: "ear"),
        CCSurgicalChip(label: "Failure to thrive",        icon: "arrow.down.forward"),
        CCSurgicalChip(label: "Developmental concern",    icon: "brain"),
        CCSurgicalChip(label: "Recurrent infections — child", icon: "shield.slash"),
        CCSurgicalChip(label: "Growth concern",           icon: "ruler"),
        CCSurgicalChip(label: "Neonatal review",          icon: "figure.child.circle"),
        CCSurgicalChip(label: "Immunisation review",      icon: "syringe"),
    ]),
    CCSpecialtyGroup(name: "Neurosurgery", icon: "brain.head.profile", chips: [
        CCSurgicalChip(label: "Head injury / Trauma",     icon: "bolt.trianglebadge.exclamationmark"),
        CCSurgicalChip(label: "Severe headache",          icon: "bolt.fill"),
        CCSurgicalChip(label: "Weakness / Paralysis",     icon: "figure.stand"),
        CCSurgicalChip(label: "Spinal cord symptoms",     icon: "arrow.up.and.down.and.sparkles"),
        CCSurgicalChip(label: "Brain tumour symptoms",    icon: "circle.dashed"),
        CCSurgicalChip(label: "Hydrocephalus symptoms",   icon: "drop.circle"),
        CCSurgicalChip(label: "Post-neurosurgical review", icon: "arrow.clockwise"),
        CCSurgicalChip(label: "Vision changes / Diplopia", icon: "eye"),
        CCSurgicalChip(label: "Raised intracranial pressure", icon: "exclamationmark.triangle.fill"),
    ]),
    CCSpecialtyGroup(name: "Cardiology", icon: "waveform.path.ecg.rectangle", chips: [
        CCSurgicalChip(label: "Heart failure",            icon: "heart.slash"),
        CCSurgicalChip(label: "Atrial fibrillation",      icon: "waveform"),
        CCSurgicalChip(label: "Arrhythmia / Palpitations", icon: "waveform.path"),
        CCSurgicalChip(label: "Valvular heart disease",   icon: "heart.circle"),
        CCSurgicalChip(label: "Cardiomyopathy",           icon: "heart.fill"),
        CCSurgicalChip(label: "Cardiac risk assessment",  icon: "chart.bar.xaxis"),
        CCSurgicalChip(label: "Pre-operative cardiac",    icon: "checkmark.shield"),
        CCSurgicalChip(label: "Lipid management",         icon: "chart.line.uptrend.xyaxis"),
    ]),
    CCSpecialtyGroup(name: "Dermatology", icon: "hand.raised", chips: [
        CCSurgicalChip(label: "Skin rash / Eczema",       icon: "oval.portrait.fill"),
        CCSurgicalChip(label: "Psoriasis",                icon: "square.grid.3x3.fill"),
        CCSurgicalChip(label: "Urticaria / Hives",        icon: "bubbles.and.sparkles"),
        CCSurgicalChip(label: "Skin infection / Cellulitis", icon: "bandage.fill"),
        CCSurgicalChip(label: "Acne",                     icon: "circle.grid.2x1.fill"),
        CCSurgicalChip(label: "Hair loss / Alopecia",     icon: "person.crop.circle.badge.minus"),
        CCSurgicalChip(label: "Nail disorder",            icon: "rectangle.fill"),
        CCSurgicalChip(label: "Pigmentation change",      icon: "circle.lefthalf.filled"),
        CCSurgicalChip(label: "Pruritus (generalised itch)", icon: "hand.raised.fill"),
        CCSurgicalChip(label: "Blistering skin disease",  icon: "circle.dotted.and.circle"),
    ]),
    CCSpecialtyGroup(name: "Internal Medicine", icon: "stethoscope", chips: [
        CCSurgicalChip(label: "CKD / Renal disease",      icon: "drop.triangle"),
        CCSurgicalChip(label: "Liver disease / Cirrhosis", icon: "leaf.fill"),
        CCSurgicalChip(label: "Autoimmune disease",        icon: "shield.lefthalf.filled"),
        CCSurgicalChip(label: "TB / Chronic infection",   icon: "lungs.fill"),
        CCSurgicalChip(label: "HIV management",           icon: "cross.circle"),
        CCSurgicalChip(label: "Chronic respiratory disease", icon: "wind"),
        CCSurgicalChip(label: "Electrolyte disturbance",  icon: "bolt.circle"),
        CCSurgicalChip(label: "Polymyalgia / Vasculitis", icon: "figure.walk.motion"),
        CCSurgicalChip(label: "Anaemia workup",           icon: "drop.circle.fill"),
    ]),
    CCSpecialtyGroup(name: "Psychiatry / Mental Health", icon: "brain", chips: [
        CCSurgicalChip(label: "Depression",               icon: "cloud.rain"),
        CCSurgicalChip(label: "Anxiety disorder",         icon: "waveform"),
        CCSurgicalChip(label: "Psychosis",                icon: "brain.head.profile"),
        CCSurgicalChip(label: "Substance misuse",         icon: "pills.circle"),
        CCSurgicalChip(label: "Insomnia",                 icon: "moon.zzz"),
        CCSurgicalChip(label: "Eating disorder",          icon: "scalemass"),
        CCSurgicalChip(label: "PTSD / Trauma",            icon: "bolt.shield"),
        CCSurgicalChip(label: "Mental health review",     icon: "arrow.clockwise.circle"),
    ]),
    CCSpecialtyGroup(name: "Administrative", icon: "calendar", chips: [
        CCSurgicalChip(label: "Follow-up",                icon: "arrow.clockwise"),
        CCSurgicalChip(label: "Screening",                icon: "magnifyingglass"),
        CCSurgicalChip(label: "Pre-operative assessment", icon: "checklist"),
        CCSurgicalChip(label: "Other",                    icon: "ellipsis.circle"),
    ]),
]

// Flat list derived from groups — used wherever a single array is needed
let ccSurgicalChips: [CCSurgicalChip] = ccSpecialtyGroups.flatMap(\.chips)

// MARK: - PMH & PSHx chip data

let pmhChips: [String] = [
    "Hypertension", "T2DM", "T1DM", "Ischaemic heart disease", "Atrial fibrillation",
    "Heart failure", "Stroke / TIA", "CKD", "COPD", "Asthma",
    "Liver disease / Cirrhosis", "Peptic ulcer disease", "GORD / Reflux", "IBD (Crohn's / UC)",
    "Malignancy", "Thyroid disease", "OSA", "DVT / PE", "Anaemia", "Epilepsy",
    "Depression / Anxiety", "Dementia", "Osteoporosis", "Rheumatoid arthritis", "Immunocompromised",
]

let pshxChips: [String] = [
    "Cholecystectomy", "Appendicectomy", "Inguinal hernia repair", "Umbilical hernia repair",
    "Bowel resection", "Anterior resection", "APR", "Hartmann's procedure",
    "Gastric bypass / sleeve", "Fundoplication", "Whipple's procedure",
    "Liver resection", "Splenectomy", "Thyroidectomy", "Parathyroidectomy",
    "Mastectomy", "Sentinel node biopsy", "Laparotomy", "Diagnostic laparoscopy",
    "ERCP", "OGD / Gastroscopy", "Colonoscopy", "Haemorrhoidectomy",
    "Fistula / abscess repair", "Caesarean section", "Hysterectomy", "Other abdominal surgery",
]

let familyHistoryChips: [String] = [
    "Colorectal cancer", "Breast cancer", "Ovarian cancer", "Gastric cancer",
    "Pancreatic cancer", "Hepatocellular carcinoma", "Lynch syndrome",
    "Ischaemic heart disease", "Stroke", "Hypertension", "T2DM",
    "Familial hypercholesterolaemia", "AAA", "IBD", "BRCA1/BRCA2 mutation",
]

// MARK: - Cross-class allergy exclusion rules
// Returns true if a drug name should be excluded given the patient's allergy list.
// Handles drug class cross-reactivity (penicillin → all beta-lactams, etc.)
func crossClassAllergyExcludes(_ drug: String, allergies: [AllergyEntry]) -> Bool {
    let d = drug.lowercased()
    for allergy in allergies {
        let a = allergy.name.lowercased()
        // Direct name match
        if d.contains(a) || a.contains(d) { return true }
        // Penicillin allergy → exclude all beta-lactams
        if a.contains("penicillin") || a.contains("amoxicillin") || a.contains("co-amoxiclav") {
            let betaLactams = ["amoxicillin", "ampicillin", "flucloxacillin", "piperacillin",
                               "co-amoxiclav", "augmentin", "cephalexin", "cefalexin",
                               "cefazolin", "cefuroxime", "ceftriaxone", "ertapenem", "meropenem"]
            if betaLactams.contains(where: { d.contains($0) }) { return true }
        }
        // NSAID allergy/intolerance → exclude all NSAIDs
        if a.contains("nsaid") || a.contains("aspirin") || a.contains("ibuprofen") || a.contains("naproxen") || a.contains("diclofenac") {
            let nsaids = ["ibuprofen", "naproxen", "diclofenac", "indomethacin",
                          "celecoxib", "etoricoxib", "meloxicam", "ketorolac", "piroxicam"]
            if nsaids.contains(where: { d.contains($0) }) { return true }
        }
        // Sulfonamide allergy → exclude sulpha drugs
        if a.contains("sulfonamide") || a.contains("sulfamethoxazole") || a.contains("sulpha") {
            let sulpha = ["trimethoprim", "cotrimoxazole", "co-trimoxazole", "sulfamethoxazole",
                          "sulfasalazine", "sulphasalazine"]
            if sulpha.contains(where: { d.contains($0) }) { return true }
        }
        // Codeine allergy → exclude opioids with similar structure
        if a.contains("codeine") || a.contains("morphine") {
            let opioids = ["codeine", "dihydrocodeine", "tramadol"]
            if opioids.contains(where: { d.contains($0) }) { return true }
        }
    }
    return false
}

// MARK: - PMH → Investigations deterministic map

private let pmhInvestigations: [String: [CCInv]] = [
    "Hypertension":            [("U&E", .blood), ("Creatinine / eGFR", .blood), ("ECG", .other),
                                ("Urinalysis", .blood), ("Fasting lipids", .blood)],
    "T2DM":                    [("HbA1c", .blood), ("Fasting glucose", .blood), ("U&E", .blood),
                                ("Fasting lipids", .blood), ("eGFR / Creatinine", .blood),
                                ("Urinary ACR", .blood), ("ECG", .other)],
    "T1DM":                    [("HbA1c", .blood), ("Fasting glucose", .blood), ("U&E", .blood), ("eGFR", .blood)],
    "Ischaemic heart disease": [("ECG", .other), ("Troponin", .blood), ("FBC", .blood),
                                ("Fasting lipids", .blood), ("Echocardiogram", .imaging)],
    "Atrial fibrillation":     [("ECG", .other), ("TFT", .blood), ("INR", .blood),
                                ("Echocardiogram", .imaging), ("U&E", .blood)],
    "Heart failure":           [("BNP / NT-proBNP", .blood), ("ECG", .other), ("FBC", .blood),
                                ("U&E", .blood), ("Echocardiogram", .imaging), ("CXR", .imaging)],
    "CKD":                     [("U&E", .blood), ("eGFR / Creatinine", .blood), ("FBC", .blood),
                                ("Phosphate", .blood), ("PTH", .blood), ("Urinalysis", .blood)],
    "Liver disease / Cirrhosis": [("LFT", .blood), ("INR / coagulation", .blood), ("FBC", .blood),
                                  ("Albumin", .blood), ("USS abdomen", .imaging)],
    "COPD":                    [("Spirometry", .other), ("CXR", .imaging), ("FBC", .blood), ("ABG", .blood)],
    "Asthma":                  [("Spirometry / PEFR", .other), ("CXR", .imaging), ("FBC", .blood)],
    "Malignancy":              [("FBC", .blood), ("LFT", .blood), ("U&E", .blood), ("Albumin", .blood),
                                ("CRP / ESR", .blood), ("CT chest/abdomen/pelvis", .imaging)],
    "DVT / PE":                [("INR", .blood), ("Anti-Xa", .blood), ("USS Doppler legs", .imaging),
                                ("CTPA", .imaging), ("FBC", .blood), ("D-dimer", .blood)],
    "Anaemia":                 [("FBC", .blood), ("Iron studies", .blood), ("B12 / Folate", .blood),
                                ("Reticulocytes", .blood), ("Blood film", .pathology)],
    "Rheumatoid arthritis":    [("FBC", .blood), ("CRP / ESR", .blood), ("LFT", .blood),
                                ("Rheumatoid factor", .blood), ("Anti-CCP", .blood)],
    "Thyroid disease":         [("TFT", .blood), ("TSH", .blood), ("Thyroid USS", .imaging)],
    "OSA":                     [("Sleep study / oximetry", .other), ("ABG", .blood), ("CXR", .imaging)],
]

// MARK: - PMH → common medication deterministic map
// Drug names must match ClinicalSearchService.searchDrugs() entries exactly.
let pmhToCommonMeds: [String: [String]] = [
    "Hypertension":              ["Amlodipine", "Lisinopril", "Atenolol", "Hydrochlorothiazide", "Ramipril"],
    "T2DM":                      ["Metformin", "Gliclazide", "Sitagliptin", "Empagliflozin", "Insulin glargine"],
    "T1DM":                      ["Insulin glargine", "Insulin aspart", "Metformin"],
    "Ischaemic heart disease":   ["Aspirin", "Atorvastatin", "Bisoprolol", "GTN spray", "Clopidogrel"],
    "Atrial fibrillation":       ["Apixaban", "Warfarin", "Bisoprolol", "Digoxin", "Rivaroxaban"],
    "Heart failure":             ["Furosemide", "Spironolactone", "Ramipril", "Bisoprolol", "Eplerenone"],
    "Stroke / TIA":              ["Aspirin", "Clopidogrel", "Atorvastatin", "Ramipril"],
    "CKD":                       ["Furosemide", "Amlodipine", "Calcium carbonate", "Alfacalcidol", "Erythropoietin"],
    "COPD":                      ["Salbutamol", "Tiotropium", "Salmeterol", "Prednisolone", "Ipratropium"],
    "Asthma":                    ["Salbutamol", "Beclomethasone inhaler", "Montelukast", "Prednisolone"],
    "Liver disease / Cirrhosis": ["Spironolactone", "Furosemide", "Lactulose", "Rifaximin", "Propranolol"],
    "Peptic ulcer disease":      ["Omeprazole", "Amoxicillin", "Clarithromycin", "Metronidazole"],
    "GORD / Reflux":             ["Omeprazole", "Lansoprazole", "Ranitidine", "Gaviscon"],
    "IBD (Crohn's / UC)":        ["Mesalazine", "Prednisolone", "Azathioprine", "Budesonide"],
    "Malignancy":                ["Dexamethasone", "Ondansetron", "Morphine", "Omeprazole"],
    "Thyroid disease":           ["Levothyroxine", "Carbimazole", "Propranolol"],
    "DVT / PE":                  ["Apixaban", "Rivaroxaban", "Warfarin", "Enoxaparin"],
    "Anaemia":                   ["Ferrous sulfate", "Folic acid", "Hydroxocobalamin"],
    "Epilepsy":                  ["Levetiracetam", "Sodium valproate", "Carbamazepine", "Lamotrigine"],
    "Depression / Anxiety":      ["Sertraline", "Fluoxetine", "Amitriptyline", "Diazepam"],
    "Rheumatoid arthritis":      ["Methotrexate", "Hydroxychloroquine", "Prednisolone", "Naproxen"],
    "Osteoporosis":              ["Alendronate", "Calcium carbonate", "Colecalciferol", "Denosumab"],
    "Immunocompromised":         ["Trimethoprim", "Fluconazole", "Aciclovir", "Cotrimoxazole"],
]

// MARK: - Common allergen quick-chip data

struct AllergenChip {
    let name: String
    let reaction: String
}

let commonAllergenChips: [AllergenChip] = [
    .init(name: "Penicillin",     reaction: "Rash / urticaria"),
    .init(name: "NSAIDs",         reaction: "GI upset / bronchospasm"),
    .init(name: "Codeine",        reaction: "Nausea / vomiting"),
    .init(name: "Sulfonamides",   reaction: "Rash"),
    .init(name: "Latex",          reaction: "Contact reaction"),
    .init(name: "Contrast dye",   reaction: "Anaphylaxis"),
    .init(name: "Aspirin",        reaction: "Bronchospasm"),
    .init(name: "Metronidazole",  reaction: "Nausea / metallic taste"),
]

// MARK: - CC → suggested investigations lookup

private typealias CCInv = (name: String, category: InvestigationEntry.InvCategory)

private let ccInvestigations: [String: [CCInv]] = [
    "Abdominal pain": [
        ("FBC", .blood), ("U&E", .blood), ("LFT", .blood), ("Lipase / Amylase", .blood),
        ("CRP", .blood), ("Urinalysis", .blood), ("β-hCG (females)", .blood),
        ("Abdominal USS", .imaging), ("CT abdomen/pelvis", .imaging),
    ],
    "Jaundice": [
        ("FBC", .blood), ("LFT", .blood), ("GGT", .blood), ("ALP", .blood),
        ("Bilirubin (direct/indirect)", .blood), ("INR / coagulation", .blood),
        ("Hepatitis serology", .blood), ("Abdominal USS", .imaging),
        ("CT abdomen/pelvis", .imaging), ("MRCP", .imaging), ("CA 19-9", .blood),
    ],
    "Dysphagia": [
        ("FBC", .blood), ("U&E", .blood), ("LFT", .blood), ("Albumin", .blood),
        ("OGD / Gastroscopy", .endoscopy), ("Barium swallow", .imaging),
        ("CT thorax/abdomen", .imaging), ("pH manometry", .other),
    ],
    "Reflux / Heartburn": [
        ("FBC", .blood), ("OGD / Gastroscopy", .endoscopy),
        ("H. pylori breath test", .other), ("pH manometry", .other),
    ],
    "Rectal bleeding": [
        ("FBC", .blood), ("LFT", .blood), ("Coagulation", .blood), ("CEA", .blood),
        ("Colonoscopy", .endoscopy), ("Flexible sigmoidoscopy", .endoscopy),
        ("CT colonography", .imaging),
    ],
    "Change in bowel habit": [
        ("FBC", .blood), ("LFT", .blood), ("CEA", .blood), ("CRP", .blood),
        ("Faecal calprotectin", .other), ("Colonoscopy", .endoscopy),
        ("CT abdomen/pelvis", .imaging),
    ],
    "Weight loss": [
        ("FBC", .blood), ("U&E", .blood), ("LFT", .blood), ("TFT", .blood),
        ("CRP / ESR", .blood), ("CEA", .blood), ("CA 19-9", .blood), ("PSA (males)", .blood),
        ("CT chest/abdomen/pelvis", .imaging), ("OGD / Gastroscopy", .endoscopy),
        ("Colonoscopy", .endoscopy),
    ],
    "Hernia": [
        ("FBC", .blood), ("U&E", .blood), ("ECG", .other),
        ("Abdominal USS", .imaging), ("CT abdomen/pelvis", .imaging),
    ],
    "Breast lump": [
        ("FBC", .blood), ("USS breast", .imaging), ("Mammogram", .imaging),
        ("Core needle biopsy", .pathology), ("ER/PR/HER2 receptor status", .pathology),
    ],
    "Neck lump": [
        ("FBC", .blood), ("TFT", .blood), ("LDH", .blood), ("EBV / CMV serology", .blood),
        ("USS neck", .imaging), ("CT neck/thorax", .imaging), ("FNA", .pathology),
    ],
    "Skin lesion": [
        ("Excision biopsy", .pathology), ("Punch biopsy", .pathology),
        ("Wide local excision + SNB", .pathology),
    ],
    "Anal pain": [
        ("FBC", .blood), ("CRP", .blood), ("Proctoscopy", .endoscopy),
        ("MRI pelvis / fistula", .imaging), ("CT abdomen/pelvis", .imaging),
    ],
    "Bloating": [
        ("FBC", .blood), ("LFT", .blood), ("TFT", .blood), ("Faecal calprotectin", .other),
        ("Abdominal USS", .imaging), ("OGD / Gastroscopy", .endoscopy),
        ("Colonoscopy", .endoscopy),
    ],
    "Nausea / Vomiting": [
        ("FBC", .blood), ("U&E", .blood), ("LFT", .blood), ("Glucose", .blood),
        ("AXR", .imaging), ("Abdominal USS", .imaging), ("CT abdomen/pelvis", .imaging),
        ("OGD / Gastroscopy", .endoscopy),
    ],
    "Wound / Post-op": [
        ("FBC", .blood), ("CRP", .blood), ("Wound swab M/C/S", .pathology),
        ("USS wound", .imaging), ("CT abdomen/pelvis", .imaging),
    ],
    "ERCP / Biliary": [
        ("FBC", .blood), ("LFT", .blood), ("INR", .blood), ("Lipase / Amylase", .blood),
        ("Abdominal USS", .imaging), ("MRCP", .imaging), ("ERCP", .endoscopy),
    ],
    "Screening": [
        ("Colonoscopy", .endoscopy), ("Faecal immunochemical test (FIT)", .other),
        ("Mammogram", .imaging), ("USS abdomen", .imaging),
    ],
    "Chest pain": [
        ("FBC", .blood), ("Troponin I/T (serial)", .blood), ("ECG", .other),
        ("CXR", .imaging), ("D-dimer", .blood), ("BNP / NT-proBNP", .blood),
        ("Echo", .imaging), ("CT pulmonary angiogram", .imaging),
    ],
    "Shortness of breath": [
        ("FBC", .blood), ("BNP / NT-proBNP", .blood), ("CRP", .blood),
        ("Spirometry / PFTs", .other), ("CXR", .imaging), ("Echo", .imaging),
        ("CT thorax", .imaging), ("ABG", .blood), ("Sputum M/C/S", .pathology),
    ],
    "Fever / Infection": [
        ("FBC", .blood), ("CRP / ESR", .blood), ("Blood cultures ×2", .blood),
        ("Urinalysis + M/C/S", .pathology), ("CXR", .imaging),
        ("Dengue serology (NS1 + IgM/IgG)", .blood), ("Malaria RDT / thick film", .blood),
        ("LFT", .blood), ("Leptospira serology", .blood), ("Widal test", .blood),
    ],
    "Urinary symptoms": [
        ("Urinalysis", .blood), ("Urine M/C/S", .pathology),
        ("FBC", .blood), ("U&E + creatinine", .blood), ("PSA (males)", .blood),
        ("USS KUB", .imaging), ("CT KUB", .imaging),
    ],
    "Joint pain": [
        ("FBC", .blood), ("CRP / ESR", .blood), ("Uric acid", .blood),
        ("Rheumatoid factor / anti-CCP", .blood), ("ANA / dsDNA", .blood),
        ("X-ray affected joint", .imaging), ("Synovial fluid M/C/S + crystals", .pathology),
    ],
    "Hypertension review": [
        ("FBC", .blood), ("U&E + creatinine", .blood), ("Fasting glucose / HbA1c", .blood),
        ("Fasting lipids", .blood), ("Urinalysis + ACR", .blood),
        ("ECG", .other), ("Echo", .imaging), ("Fundoscopy", .other),
    ],
    "Diabetes review": [
        ("HbA1c", .blood), ("Fasting glucose", .blood), ("U&E + creatinine", .blood),
        ("Urinalysis + ACR (microalbuminuria)", .blood), ("Lipids", .blood),
        ("ECG", .other), ("Foot exam", .other),
    ],
    "Thyroid symptoms": [
        ("TFT (TSH + Free T4 + T3)", .blood), ("Anti-TPO / anti-thyroglobulin", .blood),
        ("FBC", .blood), ("USS thyroid", .imaging), ("FNA if nodule", .pathology),
    ],
]

// Common baseline investigation chips (fallback when no CC-specific set exists)
private let commonBaselineInvs: [CCInv] = [
    ("FBC", .blood), ("U&E", .blood), ("LFTs", .blood), ("CRP", .blood),
    ("Coagulation (INR/APTT)", .blood), ("Blood glucose", .blood),
    ("Group & Save", .blood), ("Blood cultures", .blood),
    ("CXR", .imaging), ("AXR", .imaging), ("USS abdomen", .imaging),
    ("ECG", .other), ("Urinalysis", .other),
]

// MARK: - SOCRATES HPI builder data

struct SOCRATESDimension: Identifiable {
    let id: String
    let title: String
    let question: String
    let icon: String
    let chips: [String]
    let multiSelect: Bool
}

// CC-adaptive chip sets — shared across SOCRATES dimensions
enum SOCRATESChips {
    // Stable across all complaint types
    static let onset    = ["Today", "Yesterday", "2–3 days ago", "4–7 days ago", "1–4 weeks ago", "1–6 months ago", "Over a year", "Sudden", "Gradual"]
    static let timing   = ["Constant", "Intermittent", "Progressive", "Post-prandial", "Nocturnal", "Episodic", "Worse over time"]
    static let severity = ["Mild (1–3/10)", "Moderate (4–6/10)", "Severe (7–9/10)", "Worst (10/10)"]

    // Site sets
    static let siteAbdominal  = ["RUQ", "LUQ", "RLQ", "LLQ", "Epigastric", "Periumbilical", "Suprapubic", "Diffuse", "Right side", "Left side", "Loin", "Groin", "Perineal", "Chest"]
    static let siteNeck       = ["Anterior triangle (right)", "Anterior triangle (left)", "Posterior triangle (right)", "Posterior triangle (left)", "Midline", "Submandibular", "Submental", "Parotid region", "Thyroid (right lobe)", "Thyroid (left lobe)", "Thyroid isthmus", "Supraclavicular", "Occipital", "Diffuse neck"]
    static let siteBreast     = ["Upper outer (right)", "Upper outer (left)", "Upper inner (right)", "Upper inner (left)", "Lower outer (right)", "Lower outer (left)", "Lower inner (right)", "Lower inner (left)", "Central / areola", "Axilla (right)", "Axilla (left)", "Bilateral"]
    static let siteChest      = ["Retrosternal", "Left chest", "Right chest", "Epigastric", "Left shoulder", "Right shoulder", "Jaw", "Left arm", "Interscapular"]
    static let siteGroin      = ["Right inguinal", "Left inguinal", "Right femoral", "Left femoral", "Umbilical", "Epigastric / linea alba", "Incisional", "Right scrotum", "Left scrotum", "Bilateral"]
    static let siteDysphagia  = ["Throat", "Upper neck", "Mid-neck", "Upper chest", "Mid-chest", "Lower chest / epigastric"]
    static let siteAnorectal  = ["Perianal", "Anal canal", "Rectum", "Left lateral", "Right lateral", "Posterior midline", "Anterior", "Perineal"]
    static let siteSkin       = ["Face", "Scalp", "Neck", "Shoulder", "Back", "Chest", "Abdomen", "Arm", "Forearm", "Hand", "Thigh", "Lower leg", "Foot"]
    static let siteUrology    = ["Right loin", "Left loin", "Right flank", "Left flank", "Suprapubic", "Perineal", "Diffuse"]

    // Character sets
    static let charPain  = ["Sharp", "Dull", "Colicky", "Burning", "Throbbing", "Cramping", "Aching", "Pressure", "Bloating", "Pulling", "Stabbing"]
    static let charLump  = ["Smooth", "Irregular", "Firm", "Hard", "Soft", "Cystic / fluctuant", "Pulsatile", "Mobile", "Fixed", "Tender", "Non-tender", "Matted"]
    static let charBreast = ["Smooth", "Irregular", "Firm", "Soft", "Cystic", "Mobile", "Fixed to skin", "Fixed to muscle", "Tender", "Non-tender"]
    static let charSkin  = ["Pigmented", "Non-pigmented", "Raised", "Flat", "Ulcerated", "Itchy", "Bleeding", "Crusted", "Smooth", "Irregular borders", "Multiple"]

    // Radiation sets
    static let radAbdominal = ["No radiation", "Right shoulder", "Left shoulder", "Back", "Groin", "Chest", "Jaw", "Arm"]
    static let radChest     = ["No radiation", "Left arm", "Right arm", "Jaw", "Neck", "Back", "Left shoulder", "Epigastric"]
    static let radNeck      = ["No radiation", "Ear (right)", "Ear (left)", "Chest", "Arm (right)", "Arm (left)", "Jaw"]
    static let radUrology   = ["No radiation", "Groin", "Perineum", "Inner thigh", "Testicle"]
    static let radNone      = ["No radiation", "Localised only", "Diffuse"]

    // Association sets
    static let assocAbdominal = ["Nausea", "Vomiting", "Fever", "Rigors", "Anorexia", "Weight loss", "Jaundice", "Rectal bleeding", "Melaena", "Change in bowel habit", "Dysphagia", "Heartburn", "Haematuria", "Dysuria"]
    static let assocNeck      = ["Dysphagia", "Hoarseness / voice change", "Weight loss", "Night sweats", "Fever", "Ear pain", "Fatigue", "Shortness of breath", "Haemoptysis", "Facial swelling", "Stridor"]
    static let assocBreast    = ["Nipple discharge", "Skin changes / dimpling", "Nipple inversion", "Axillary lump", "Mastalgia", "Cyclical changes", "Weight loss", "Fatigue", "Fever"]
    static let assocChest     = ["Shortness of breath", "Diaphoresis", "Nausea", "Vomiting", "Palpitations", "Dizziness / syncope", "Cough", "Haemoptysis", "Fever", "Pleuritic pain"]
    static let assocAnorectal = ["Rectal bleeding", "Pruritus ani", "Pain on defaecation", "Soiling", "Change in bowel habit", "Mucus discharge", "Tenesmus", "Weight loss"]
    static let assocDysphagia = ["Regurgitation", "Odynophagia", "Weight loss", "Aspiration", "Voice change", "Heartburn", "Nausea", "Vomiting", "Haematemesis", "Melaena"]
    static let assocUrology   = ["Haematuria", "Dysuria", "Frequency", "Urgency", "Nocturia", "Hesitancy", "Poor stream", "Weight loss", "Fever", "Loin pain"]
    static let assocSkin      = ["Itching", "Bleeding", "Ulceration", "Change in size", "Change in colour", "Regional lymphadenopathy", "Satellite lesions", "Systemic symptoms"]

    // Exacerbating sets
    static let excPain    = ["Movement", "Eating", "Fatty food", "Lying flat", "Deep breathing", "Coughing", "Straining", "Alcohol", "NSAIDs"]
    static let excLump    = ["Straining / Valsalva", "Standing", "Eating", "Stress / anxiety", "None"]
    static let excChest   = ["Exertion", "Lying flat", "Cold air", "Stress", "Eating", "Deep breathing", "Palpation"]
    static let excDysph   = ["Solids", "Liquids", "Both solids and liquids", "Eating quickly", "Stress", "None"]
    static let excAnoRect = ["Defaecation", "Sitting", "Straining", "Eating"]

    // Relieving sets
    static let relPain    = ["Rest", "Antacids", "Analgesics", "Vomiting", "Defaecation", "Sitting forward", "Eating", "Fasting", "Nothing"]
    static let relLump    = ["Lying down", "Manual reduction", "Rest", "Nothing"]
    static let relChest   = ["Rest", "GTN spray", "Antacids", "Sitting up", "Analgesics", "Nothing"]
    static let relDysph   = ["Small sips of water", "Liquids only", "Sitting upright", "Nothing"]
    static let relAnoRect = ["Lying down", "Warm bath / sitz bath", "Analgesics", "Nothing"]
}

// Returns SOCRATES chip sets adapted to the chief complaint keyword(s)
func socrateDimensions(for cc: String) -> [SOCRATESDimension] {
    let lc = cc.lowercased()

    let isNeck     = lc.contains("neck") || lc.contains("thyroid") || lc.contains("goitre") || lc.contains("goiter") || lc.contains("lymph") || lc.contains("cervical gland")
    let isBreast   = lc.contains("breast") || lc.contains("nipple") || lc.contains("mastalgia")
    let isChestPain = (lc.contains("chest") && lc.contains("pain")) || lc.contains("cardiac") || lc.contains("angina")
    let isGroin    = lc.contains("groin") || lc.contains("hernia") || lc.contains("inguinal") || lc.contains("femoral") || lc.contains("scrotal") || lc.contains("umbilical lump") || lc.contains("incisional")
    let isDysph    = lc.contains("dysphagia") || lc.contains("swallow")
    let isAnoRect  = lc.contains("rectal") || lc.contains("anorectal") || lc.contains("anal") || lc.contains("haemorrhoid") || lc.contains("hemorrhoid") || lc.contains("fissure") || lc.contains("fistula") || lc.contains("perianal")
    let isSkin     = lc.contains("skin") || lc.contains("mole") || lc.contains("melanoma") || lc.contains("sebaceous") || lc.contains("lipoma") || (lc.contains("lump") && (lc.contains("back") || lc.contains("arm") || lc.contains("leg") || lc.contains("scalp") || lc.contains("face")))
    let isUro      = lc.contains("haematuria") || lc.contains("hematuria") || lc.contains("urinary") || lc.contains("urological") || lc.contains("renal colic") || lc.contains("kidney stone") || lc.contains("bladder")
    let isLump     = lc.contains("lump") || lc.contains("mass") || lc.contains("swelling") || lc.contains("node")

    let site: [String], char: [String], rad: [String], assoc: [String], exc: [String], rel: [String]

    switch true {
    case isNeck:
        site = SOCRATESChips.siteNeck;   char = SOCRATESChips.charLump
        rad  = SOCRATESChips.radNeck;    assoc = SOCRATESChips.assocNeck
        exc  = SOCRATESChips.excLump;    rel   = SOCRATESChips.relLump
    case isBreast:
        site = SOCRATESChips.siteBreast; char = SOCRATESChips.charBreast
        rad  = SOCRATESChips.radNone;    assoc = SOCRATESChips.assocBreast
        exc  = SOCRATESChips.excLump;    rel   = SOCRATESChips.relLump
    case isChestPain:
        site = SOCRATESChips.siteChest;  char = SOCRATESChips.charPain
        rad  = SOCRATESChips.radChest;   assoc = SOCRATESChips.assocChest
        exc  = SOCRATESChips.excChest;   rel   = SOCRATESChips.relChest
    case isGroin:
        site = SOCRATESChips.siteGroin;  char = isLump ? SOCRATESChips.charLump : SOCRATESChips.charPain
        rad  = SOCRATESChips.radAbdominal; assoc = SOCRATESChips.assocAbdominal
        exc  = SOCRATESChips.excLump;    rel   = SOCRATESChips.relLump
    case isDysph:
        site = SOCRATESChips.siteDysphagia; char = SOCRATESChips.charPain
        rad  = SOCRATESChips.radNone;    assoc = SOCRATESChips.assocDysphagia
        exc  = SOCRATESChips.excDysph;   rel   = SOCRATESChips.relDysph
    case isAnoRect:
        site = SOCRATESChips.siteAnorectal; char = SOCRATESChips.charPain
        rad  = SOCRATESChips.radNone;    assoc = SOCRATESChips.assocAnorectal
        exc  = SOCRATESChips.excAnoRect; rel   = SOCRATESChips.relAnoRect
    case isSkin:
        site = SOCRATESChips.siteSkin;   char = SOCRATESChips.charSkin
        rad  = SOCRATESChips.radNone;    assoc = SOCRATESChips.assocSkin
        exc  = ["Sun exposure", "Trauma", "None"]
        rel  = ["None", "Reducing sun exposure"]
    case isUro:
        site = SOCRATESChips.siteUrology; char = SOCRATESChips.charPain
        rad  = SOCRATESChips.radUrology; assoc = SOCRATESChips.assocUrology
        exc  = SOCRATESChips.excPain;    rel   = SOCRATESChips.relPain
    default:
        // Default: abdominal / general surgical presentation
        site = SOCRATESChips.siteAbdominal; char = SOCRATESChips.charPain
        rad  = SOCRATESChips.radAbdominal;  assoc = SOCRATESChips.assocAbdominal
        exc  = SOCRATESChips.excPain;       rel   = SOCRATESChips.relPain
    }

    return [
        .init(id: "onset",        title: "Onset",        question: "When did it start?",         icon: "clock",
              chips: SOCRATESChips.onset,    multiSelect: false),
        .init(id: "site",         title: "Site",         question: "Where exactly?",              icon: "mappin",
              chips: site,                   multiSelect: true),
        .init(id: "character",    title: "Character",    question: "What is it like?",            icon: "waveform.path",
              chips: char,                   multiSelect: true),
        .init(id: "radiation",    title: "Radiation",    question: "Does it spread?",             icon: "arrow.up.right.and.arrow.down.left",
              chips: rad,                    multiSelect: false),
        .init(id: "associations", title: "Associations", question: "Associated symptoms?",        icon: "list.bullet",
              chips: assoc,                  multiSelect: true),
        .init(id: "timing",       title: "Timing",       question: "Pattern of symptoms?",        icon: "chart.line.uptrend.xyaxis",
              chips: SOCRATESChips.timing,   multiSelect: true),
        .init(id: "exacerbating", title: "Exacerbating", question: "What makes it worse?",        icon: "arrow.up.circle",
              chips: exc,                    multiSelect: true),
        .init(id: "relieving",    title: "Relieving",    question: "What makes it better?",       icon: "arrow.down.circle",
              chips: rel,                    multiSelect: true),
        .init(id: "severity",     title: "Severity",     question: "Severity rating?",            icon: "speedometer",
              chips: SOCRATESChips.severity, multiSelect: false),
    ]
}

// MARK: - Specialty Early Form data

/// A single chip in the specialty early form. The `dimId` + `value` pair maps directly
/// to a feature key/value in DiagnosticDatabase.json, so tapping the chip feeds the
/// Bayesian scorer through the existing toggleSOCRATES mechanism.
struct EFChip: Identifiable {
    let id = UUID()
    let label: String
    let dimId: String          // DB feature key (standard SOCRATES dim or custom specialist key)
    let value: String          // must match the DB feature value (case-insensitive contains)
    var multiSelect: Bool = true
}

/// A labelled group of early-form chips shown under one clinical question.
struct EFGroup: Identifiable {
    let id = UUID()
    let question: String
    let icon: String
    let chips: [EFChip]
}

// swiftlint:disable line_length

// ── Neurology: Headache ──────────────────────────────────────────────────────
private let neurologHeadacheEarlyForm: [EFGroup] = [
    EFGroup(question: "Onset character", icon: "clock.badge.exclamationmark.fill", chips: [
        EFChip(label: "Thunderclap — worst ever",      dimId: "onset",        value: "Thunderclap",            multiSelect: false),
        EFChip(label: "Sudden",                        dimId: "onset",        value: "Sudden",                 multiSelect: false),
        EFChip(label: "Sentinel (prior milder episode)", dimId: "onset",      value: "Sentinel headache",      multiSelect: false),
    ]),
    EFGroup(question: "Headache character", icon: "waveform.path", chips: [
        EFChip(label: "Pulsating / throbbing",         dimId: "character",    value: "Pulsating"),
        EFChip(label: "Pressure / band-like",          dimId: "character",    value: "Pressure"),
        EFChip(label: "Orbital / retro-orbital",       dimId: "character",    value: "Orbital / retro-orbital"),
        EFChip(label: "Temporal region",               dimId: "character",    value: "Temporal"),
        EFChip(label: "Unilateral",                    dimId: "character",    value: "Unilateral"),
        EFChip(label: "Excruciating severity",         dimId: "character",    value: "Excruciating"),
    ]),
    EFGroup(question: "Key associated features", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Neck stiffness / meningism",    dimId: "associations", value: "Neck stiffness"),
        EFChip(label: "Scintillating scotoma",         dimId: "associations", value: "Scintillating scotoma"),
        EFChip(label: "Jaw claudication",              dimId: "associations", value: "Jaw claudication"),
        EFChip(label: "Scalp tenderness",              dimId: "associations", value: "Scalp tenderness"),
        EFChip(label: "Lacrimation / eye watering",    dimId: "associations", value: "Lacrimation"),
        EFChip(label: "Photophobia / phonophobia",     dimId: "associations", value: "Photophobia"),
        EFChip(label: "Loss of consciousness",         dimId: "associations", value: "Loss of consciousness"),
        EFChip(label: "Nausea / vomiting",             dimId: "associations", value: "Nausea"),
    ]),
    EFGroup(question: "Timing pattern", icon: "clock.arrow.2.circlepath", chips: [
        EFChip(label: "Circadian clustering (same time each day)", dimId: "timing", value: "Circadian clustering"),
        EFChip(label: "Multiple attacks per day",      dimId: "timing",       value: "Multiple attacks per day"),
        EFChip(label: "Seasonal clustering",           dimId: "timing",       value: "Seasonal clustering"),
    ]),
]

// ── Neurology: Dizziness / Vertigo ───────────────────────────────────────────
private let neurologDizzinessEarlyForm: [EFGroup] = [
    EFGroup(question: "Type of dizziness", icon: "rotate.3d", chips: [
        EFChip(label: "Positional (position-triggered)", dimId: "character",  value: "Positional",             multiSelect: false),
        EFChip(label: "Lightheadedness / near-faint",  dimId: "character",    value: "Lightheadedness",        multiSelect: false),
    ]),
    EFGroup(question: "Pattern & trigger", icon: "clock.arrow.2.circlepath", chips: [
        EFChip(label: "Brief (seconds)",               dimId: "timing",       value: "Brief"),
        EFChip(label: "Episodic (minutes–hours)",       dimId: "timing",       value: "Episodic"),
        EFChip(label: "Continuous / persistent",       dimId: "timing",       value: "Continuous"),
        EFChip(label: "Rolling over in bed",           dimId: "exacerbating", value: "Rolling over"),
        EFChip(label: "Standing up / postural change", dimId: "exacerbating", value: "Standing up"),
        EFChip(label: "Looking upward",                dimId: "exacerbating", value: "Looking up"),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Tinnitus",                      dimId: "associations", value: "Tinnitus"),
        EFChip(label: "Hearing loss",                  dimId: "associations", value: "Hearing loss"),
        EFChip(label: "Diplopia / double vision",      dimId: "associations", value: "Diplopia"),
        EFChip(label: "Dysarthria / slurred speech",   dimId: "associations", value: "Dysarthria"),
        EFChip(label: "Limb ataxia / unsteadiness",    dimId: "associations", value: "Limb ataxia"),
        EFChip(label: "Diaphoresis / sweating",        dimId: "associations", value: "Diaphoresis"),
    ]),
]

// ── Neurosurgery: Head injury / Trauma ───────────────────────────────────────
private let neurosurgTraumaEarlyForm: [EFGroup] = [
    EFGroup(question: "Key clinical history", icon: "bolt.trianglebadge.exclamationmark.fill", chips: [
        EFChip(label: "Lucid interval (talked, then deteriorated)", dimId: "lucid_interval",   value: "present"),
        EFChip(label: "New-onset seizure post-injury",              dimId: "seizure",          value: "new_onset_adult"),
        EFChip(label: "Ipsilateral pupil dilation",                dimId: "pupil",            value: "ipsilateral_dilation"),
    ]),
    EFGroup(question: "Associated symptoms", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Thunderclap / sudden severe headache",       dimId: "onset",            value: "Thunderclap"),
        EFChip(label: "Neck stiffness",                            dimId: "associations",     value: "Neck stiffness"),
        EFChip(label: "Loss of consciousness",                     dimId: "associations",     value: "Loss of consciousness"),
    ]),
]

// ── Neurosurgery: Severe headache ─────────────────────────────────────────────
private let neurosurgHeadacheEarlyForm: [EFGroup] = [
    EFGroup(question: "Onset", icon: "clock.badge.exclamationmark.fill", chips: [
        EFChip(label: "Thunderclap — worst ever",      dimId: "onset",        value: "Thunderclap",            multiSelect: false),
        EFChip(label: "Sudden",                        dimId: "onset",        value: "Sudden",                 multiSelect: false),
        EFChip(label: "Sentinel (prior milder)",       dimId: "onset",        value: "Sentinel headache",      multiSelect: false),
    ]),
    EFGroup(question: "Red flag features", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Neck stiffness / meningism",    dimId: "associations", value: "Neck stiffness"),
        EFChip(label: "Loss of consciousness",         dimId: "associations", value: "Loss of consciousness"),
        EFChip(label: "Seizure at onset",              dimId: "associations", value: "Seizure at ictus"),
        EFChip(label: "Lucid interval (post-trauma)",  dimId: "lucid_interval", value: "present"),
        EFChip(label: "Progressive over days/weeks",   dimId: "new_focal_deficit", value: "present"),
    ]),
]

// ── Neurosurgery: Brain tumour / Hydrocephalus ───────────────────────────────
private let neurosurgTumourEarlyForm: [EFGroup] = [
    EFGroup(question: "Specific features", icon: "brain.head.profile", chips: [
        EFChip(label: "New-onset seizure in adult",                dimId: "seizure",          value: "new_onset_adult"),
        EFChip(label: "Progressive focal neurological deficit",    dimId: "new_focal_deficit", value: "present"),
        EFChip(label: "Gait + cognition + incontinence triad",     dimId: "triad_nph",        value: "gait_cognitive_incontinence"),
        EFChip(label: "Headache worse lying flat / AM",            dimId: "associations",     value: "Loss of consciousness"),
    ]),
]

// ── Cardiology: Chest pain ───────────────────────────────────────────────────
private let cardiologyChestEarlyForm: [EFGroup] = [
    EFGroup(question: "Pain character", icon: "heart.fill", chips: [
        EFChip(label: "Pressure / tightness",          dimId: "character",    value: "Pressure"),
        EFChip(label: "Tearing / ripping",             dimId: "character",    value: "Tearing"),
        EFChip(label: "Sharp / pleuritic",             dimId: "character",    value: "Sharp"),
    ]),
    EFGroup(question: "Radiation", icon: "arrow.up.right.and.arrow.down.left", chips: [
        EFChip(label: "Arm radiation",                 dimId: "radiation",    value: "Arm"),
        EFChip(label: "Jaw radiation",                 dimId: "radiation",    value: "Jaw"),
        EFChip(label: "Back radiation",                dimId: "radiation",    value: "Back"),
    ]),
    EFGroup(question: "Modifying factors & onset", icon: "arrow.2.circlepath", chips: [
        EFChip(label: "Exertion-triggered",            dimId: "exacerbating", value: "Exertion"),
        EFChip(label: "Relieved by rest",              dimId: "relieving",    value: "Rest"),
        EFChip(label: "Relieved by nitrates",          dimId: "relieving",    value: "Nitrates"),
        EFChip(label: "Sudden onset",                  dimId: "onset",        value: "Sudden"),
        EFChip(label: "Shortness of breath",           dimId: "associations", value: "Shortness of breath"),
    ]),
]

// ── Cardiology: Arrhythmia / Palpitations ────────────────────────────────────
private let cardiologyArrhythmiaEarlyForm: [EFGroup] = [
    EFGroup(question: "ECG pattern (if available)", icon: "waveform.path.ecg.rectangle", chips: [
        EFChip(label: "Irregularly irregular pulse",   dimId: "pulse",        value: "irregularly_irregular"),
        EFChip(label: "No P waves (AF on ECG)",        dimId: "ecg",          value: "no_p_waves_irregular_rhythm"),
        EFChip(label: "Short PR + delta wave (WPW)",   dimId: "ecg",          value: "short_pr_delta_wave"),
        EFChip(label: "Wide QRS, regular >100 bpm",    dimId: "ecg",          value: "wide_qrs_regular_above_100"),
        EFChip(label: "P waves independent of QRS",    dimId: "ecg",          value: "p_waves_independent_qrs"),
    ]),
    EFGroup(question: "Clinical context", icon: "heart.text.square.fill", chips: [
        EFChip(label: "Known structural heart disease", dimId: "structural_heart_disease", value: "present"),
        EFChip(label: "Terminates with vagal manoeuvre", dimId: "vagal_response",          value: "terminates"),
    ]),
]

// ── Internal Medicine: Anaemia workup ────────────────────────────────────────
private let internalMedAnaemiaEarlyForm: [EFGroup] = [
    EFGroup(question: "Associated features", icon: "drop.circle.fill", chips: [
        EFChip(label: "Crisis pain (sickle)",          dimId: "associations", value: "Crisis pain"),
        EFChip(label: "Jaundice (haemolysis)",         dimId: "associations", value: "Jaundice"),
        EFChip(label: "Pica (craving non-food items)", dimId: "associations", value: "Pica"),
        EFChip(label: "Peripheral neuropathy (B12)",   dimId: "associations", value: "Neuropathy"),
        EFChip(label: "Dark urine (haemolysis)",       dimId: "associations", value: "Dark urine"),
        EFChip(label: "Pallor",                        dimId: "associations", value: "Pallor"),
        EFChip(label: "Sore tongue (B12/folate)",      dimId: "associations", value: "Sore tongue"),
    ]),
]

// ── Internal Medicine: Fatigue ───────────────────────────────────────────────
private let internalMedFatigueEarlyForm: [EFGroup] = [
    EFGroup(question: "Duration & pattern", icon: "clock.arrow.2.circlepath", chips: [
        EFChip(label: "Worse with exertion (CFS/ME)",  dimId: "associations", value: "Post-exertional malaise"),
        EFChip(label: ">6 months duration",            dimId: "timing",       value: ">6 months"),
        EFChip(label: ">2 weeks duration",             dimId: "timing",       value: ">2 weeks"),
    ]),
    EFGroup(question: "Specific associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Low mood / anhedonia",          dimId: "associations", value: "Low mood"),
        EFChip(label: "Snoring / witnessed apnoea",    dimId: "associations", value: "Witnessed apnoea"),
        EFChip(label: "Polyuria / polydipsia (DM)",    dimId: "associations", value: "Polyuria"),
        EFChip(label: "Cold intolerance (hypothyroid)", dimId: "associations", value: "Cold intolerance"),
        EFChip(label: "Pallor (anaemia)",              dimId: "associations", value: "Pallor"),
        EFChip(label: "Cognitive impairment",          dimId: "associations", value: "Cognitive impairment"),
    ]),
]

// MARK: - General Surgery early forms — Abdominal Pain

private let surgAbdominalPainEarlyForm: [EFGroup] = [
    EFGroup(question: "Pain site (single select)", icon: "mappin.circle.fill", chips: [
        EFChip(label: "Right iliac fossa (appendix)",  dimId: "site", value: "RLQ",        multiSelect: false),
        EFChip(label: "Epigastric (PUD / reflux)",     dimId: "site", value: "Epigastric", multiSelect: false),
        EFChip(label: "Left iliac fossa (diverticula)", dimId: "site", value: "LLQ",       multiSelect: false),
        EFChip(label: "Loin (renal colic)",             dimId: "site", value: "Loin",      multiSelect: false),
        EFChip(label: "Generalised / peritonitis",      dimId: "site", value: "Generalised", multiSelect: false),
    ]),
    EFGroup(question: "Pain character (single select)", icon: "waveform.path.ecg", chips: [
        EFChip(label: "Colicky",   dimId: "character", value: "Colicky",  multiSelect: false),
        EFChip(label: "Burning",   dimId: "character", value: "Burning",  multiSelect: false),
        EFChip(label: "Cramping",  dimId: "character", value: "Cramping", multiSelect: false),
        EFChip(label: "Constant",  dimId: "character", value: "Constant", multiSelect: false),
    ]),
    EFGroup(question: "Key associated features", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Haematuria",              dimId: "associations", value: "Haematuria"),
        EFChip(label: "Vomiting",                dimId: "associations", value: "Vomiting"),
        EFChip(label: "Abdominal distension",    dimId: "associations", value: "Distension"),
        EFChip(label: "No bowel motion / flatus", dimId: "associations", value: "No bowel motion"),
        EFChip(label: "Rectal bleeding",         dimId: "associations", value: "Rectal bleeding"),
        EFChip(label: "Heartburn",               dimId: "associations", value: "Heartburn"),
        EFChip(label: "Melaena",                 dimId: "associations", value: "Melaena"),
        EFChip(label: "Haematemesis",            dimId: "associations", value: "Haematemesis"),
    ]),
    EFGroup(question: "Radiation & modifiers", icon: "arrow.forward.circle.fill", chips: [
        EFChip(label: "Radiates loin → groin",   dimId: "radiation",   value: "Groin"),
        EFChip(label: "Relieved by antacids",     dimId: "relieving",  value: "Antacids"),
        EFChip(label: "Relieved by defaecation",  dimId: "relieving",  value: "Defaecation"),
        EFChip(label: "Worse lying flat",         dimId: "exacerbating", value: "Lying flat"),
        EFChip(label: "Worse with NSAIDs",        dimId: "exacerbating", value: "NSAIDs"),
    ]),
]

private let surgObstructionEarlyForm: [EFGroup] = [
    EFGroup(question: "Obstruction features (select all that apply)", icon: "exclamationmark.circle.fill", chips: [
        EFChip(label: "Colicky abdominal pain",  dimId: "character",    value: "Colicky"),
        EFChip(label: "Abdominal distension",    dimId: "associations", value: "Distension"),
        EFChip(label: "Vomiting",                dimId: "associations", value: "Vomiting"),
        EFChip(label: "Absolute constipation",   dimId: "associations", value: "No bowel motion"),
        EFChip(label: "Bilious vomit (SBO)",     dimId: "character",    value: "Bilious"),
        EFChip(label: "Projectile vomit (GOO)",  dimId: "character",    value: "Projectile"),
        EFChip(label: "High-pitched bowel sounds", dimId: "exam",       value: "high pitched"),
    ]),
    EFGroup(question: "Previous history", icon: "clock.arrow.circlepath", chips: [
        EFChip(label: "Prior laparotomy / adhesions", dimId: "pshx", value: "laparotomy"),
        EFChip(label: "Known colorectal cancer",      dimId: "pmh",  value: "colorectal"),
        EFChip(label: "Incisional hernia",            dimId: "pmh",  value: "hernia"),
    ]),
]

private let surgHerniaEarlyForm: [EFGroup] = [
    EFGroup(question: "Hernia type features (single select)", icon: "arrow.down.circle.fill", chips: [
        EFChip(label: "Groin — above inguinal ligament (inguinal)", dimId: "site",  value: "Groin", multiSelect: false),
        EFChip(label: "Groin — below inguinal ligament (femoral)",  dimId: "exam",  value: "below inguinal", multiSelect: false),
        EFChip(label: "Umbilical / paraumbilical",  dimId: "site",  value: "Midline", multiSelect: false),
        EFChip(label: "Prior laparotomy scar (incisional)", dimId: "pmh", value: "laparotomy", multiSelect: false),
    ]),
    EFGroup(question: "Clinical behaviour", icon: "checkmark.seal.fill", chips: [
        EFChip(label: "Cough impulse present",  dimId: "exam",         value: "cough impulse"),
        EFChip(label: "Reducible",              dimId: "exam",         value: "reducible"),
        EFChip(label: "Worse with straining",   dimId: "exacerbating", value: "Straining"),
        EFChip(label: "Severe irreducible pain (strangulation?)", dimId: "associations", value: "Severe pain"),
        EFChip(label: "Female sex (↑ femoral)", dimId: "sex_female",   value: ""),
    ]),
]

private let surgUpperGIBleedEarlyForm: [EFGroup] = [
    EFGroup(question: "Bleeding character (single select)", icon: "drop.fill", chips: [
        EFChip(label: "Melaena (dark / tarry stool)", dimId: "character", value: "Melaena",    multiSelect: false),
        EFChip(label: "Haematemesis (bright red)",    dimId: "character", value: "Haematemesis", multiSelect: false),
        EFChip(label: "Coffee-ground vomiting",       dimId: "character", value: "Coffee-ground", multiSelect: false),
    ]),
    EFGroup(question: "Prior history (major risk discriminators)", icon: "clock.badge.exclamationmark.fill", chips: [
        EFChip(label: "Known peptic ulcer",     dimId: "pmh",  value: "peptic ulcer"),
        EFChip(label: "NSAID / aspirin use",    dimId: "pmh",  value: "nsaid"),
        EFChip(label: "H. pylori positive",     dimId: "pmh",  value: "h.pylori"),
        EFChip(label: "Liver cirrhosis",        dimId: "pmh",  value: "cirrhosis"),
        EFChip(label: "Alcohol excess",         dimId: "pmh",  value: "alcohol"),
        EFChip(label: "Preceded by retching (Mallory-Weiss)", dimId: "onset", value: "After retching"),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.clipboard.fill", chips: [
        EFChip(label: "Epigastric pain",        dimId: "associations", value: "Epigastric pain"),
        EFChip(label: "Weight loss",            dimId: "associations", value: "Weight loss"),
        EFChip(label: "Dysphagia",              dimId: "associations", value: "Dysphagia"),
        EFChip(label: "Ascites on exam",        dimId: "exam",         value: "ascites"),
    ]),
]

private let surgRenalColicEarlyForm: [EFGroup] = [
    EFGroup(question: "Renal colic pattern (single select)", icon: "bolt.circle.fill", chips: [
        EFChip(label: "Sudden onset",              dimId: "onset",     value: "Sudden",        multiSelect: false),
        EFChip(label: "Colicky character",         dimId: "character", value: "Colicky",       multiSelect: false),
    ]),
    EFGroup(question: "Key features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Loin to groin radiation",   dimId: "radiation",    value: "Loin to groin"),
        EFChip(label: "Haematuria",                dimId: "associations", value: "Haematuria"),
        EFChip(label: "Restlessness (can't settle)", dimId: "associations", value: "Restlessness"),
        EFChip(label: "Previous renal stones",     dimId: "pmh",          value: "renal stone"),
        EFChip(label: "Fever (pyelonephritis?)",   dimId: "associations", value: "Fever"),
        EFChip(label: "Dysuria",                   dimId: "associations", value: "Dysuria"),
    ]),
]

private let surgVascularEarlyForm: [EFGroup] = [
    EFGroup(question: "Vascular red flags (single select)", icon: "heart.circle.fill", chips: [
        EFChip(label: "Pulsatile abdominal mass (AAA)", dimId: "exam",  value: "pulsatile abdominal mass", multiSelect: false),
        EFChip(label: "Intermittent claudication (PAD)", dimId: "associations", value: "Intermittent claudication", multiSelect: false),
        EFChip(label: "Limb rest pain (critical ischaemia)", dimId: "associations", value: "Rest pain", multiSelect: false),
        EFChip(label: "Absent pedal pulses",              dimId: "exam", value: "absent pulses",          multiSelect: false),
    ]),
    EFGroup(question: "Risk factors", icon: "staroflife.circle", chips: [
        EFChip(label: "Smoking history",      dimId: "pmh", value: "smoking"),
        EFChip(label: "Diabetes",             dimId: "pmh", value: "diabetes"),
        EFChip(label: "Family AAA history",   dimId: "pmh", value: "family aneurysm"),
        EFChip(label: "Age > 65",             dimId: "age_over", value: "65"),
        EFChip(label: "Male sex",             dimId: "sex_male", value: ""),
        EFChip(label: "Back pain with AAA sx", dimId: "associations", value: "Back pain"),
    ]),
]

private let surgRectalBleedEarlyForm: [EFGroup] = [
    EFGroup(question: "Bleeding pattern & associated symptoms", icon: "drop.fill", chips: [
        EFChip(label: "Bright red per rectum",        dimId: "associations", value: "Rectal bleeding"),
        EFChip(label: "Blood mixed in stool (IBD/Ca)", dimId: "diarrhoea",   value: "bloody_chronic"),
        EFChip(label: "Severe pain on defaecation (fissure)", dimId: "pain", value: "severe_on_defecation"),
        EFChip(label: "Change in bowel habit",        dimId: "associations", value: "Change in bowel habit"),
        EFChip(label: "Weight loss",                  dimId: "associations", value: "Weight loss"),
        EFChip(label: "Age > 50 (colorectal Ca risk)", dimId: "age_over",   value: "50"),
    ]),
    EFGroup(question: "Risk factors & history", icon: "clock.badge.fill", chips: [
        EFChip(label: "Known diverticular disease",  dimId: "pmh", value: "divert"),
        EFChip(label: "Known Crohn's / colitis",     dimId: "pmh", value: "crohn"),
        EFChip(label: "Iron deficiency anaemia",     dimId: "iron_deficiency_anaemia", value: "present"),
    ]),
]

private let surgGERDEarlyForm: [EFGroup] = [
    EFGroup(question: "Reflux symptoms", icon: "flame.fill", chips: [
        EFChip(label: "Heartburn",                dimId: "associations", value: "Heartburn"),
        EFChip(label: "Regurgitation",            dimId: "associations", value: "Regurgitation"),
        EFChip(label: "Burning epigastric pain",  dimId: "character",    value: "Burning"),
        EFChip(label: "Worse lying flat",         dimId: "exacerbating", value: "Lying flat"),
        EFChip(label: "Relieved by antacids",     dimId: "relieving",    value: "Antacids"),
        EFChip(label: "Epigastric site",          dimId: "site",         value: "Epigastric"),
    ]),
    EFGroup(question: "Duration & alarm features", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: ">5 years (Barrett's risk)",   dimId: "timing",       value: "years"),
        EFChip(label: "Dysphagia (alarm)",           dimId: "associations", value: "Dysphagia"),
        EFChip(label: "Melaena / haematemesis (alarm)", dimId: "associations", value: "Melaena"),
        EFChip(label: "Weight loss (alarm)",         dimId: "associations", value: "Weight loss"),
    ]),
]

// MARK: - General & GI Surgery — additional forms

private let surgJaundiceEarlyForm: [EFGroup] = [
    EFGroup(question: "Jaundice type (single select)", icon: "sun.max.fill", chips: [
        EFChip(label: "Obstructive — dark urine, pale stools", dimId: "character",    value: "Obstructive", multiSelect: false),
        EFChip(label: "Haemolytic — known haemolytic condition", dimId: "pmh",        value: "sickle",      multiSelect: false),
        EFChip(label: "Hepatocellular — alcohol / hepatitis",    dimId: "pmh",        value: "cirrhosis",   multiSelect: false),
    ]),
    EFGroup(question: "Key discriminators", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Known gallstones",             dimId: "pmh",          value: "gallstone"),
        EFChip(label: "Fever + rigors (cholangitis)", dimId: "associations", value: "Rigors"),
        EFChip(label: "Progressive (pancreatic Ca?)", dimId: "timing",       value: "Progressive"),
        EFChip(label: "Weight loss",                  dimId: "associations", value: "Weight loss"),
        EFChip(label: "Painless (Courvoisier's sign)", dimId: "character",   value: "Painless"),
    ]),
]

private let surgDysphagiaEarlyForm: [EFGroup] = [
    EFGroup(question: "Dysphagia pattern (single select)", icon: "mouth.fill", chips: [
        EFChip(label: "Solids only → progressive (Ca / stricture)", dimId: "character",    value: "Progressive solids", multiSelect: false),
        EFChip(label: "Solids AND liquids (achalasia)",              dimId: "dysphagia_type", value: "solids_and_liquids", multiSelect: false),
        EFChip(label: "Intermittent with regurgitation (pouch)",     dimId: "regurgitation",  value: "undigested_food_hours_later", multiSelect: false),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Weight loss (alarm)",         dimId: "weight_loss",  value: "significant"),
        EFChip(label: "Heartburn history (GERD)",    dimId: "pmh",          value: "gerd"),
        EFChip(label: "Hoarse voice (recurrent laryngeal nerve)", dimId: "associations", value: "Hoarse voice"),
        EFChip(label: "Regurgitation of undigested food",         dimId: "regurgitation", value: "undigested_food"),
        EFChip(label: "Gurgling sensation in neck (Zenker's)",    dimId: "gurgling_neck",  value: "present"),
    ]),
]

private let surgNeckLumpEarlyForm: [EFGroup] = [
    EFGroup(question: "Lump character (single select)", icon: "person.bust.fill", chips: [
        EFChip(label: "Moves with swallowing (thyroid)",  dimId: "exam",      value: "moves with swallowing", multiSelect: false),
        EFChip(label: "Tender + recent infection (reactive)", dimId: "character", value: "Tender",            multiSelect: false),
        EFChip(label: "Rubbery / non-tender (lymphoma)",  dimId: "character", value: "Rubbery",               multiSelect: false),
        EFChip(label: "Hard / fixed (metastatic)",        dimId: "character", value: "Hard",                  multiSelect: false),
        EFChip(label: "Anterior sternomastoid (branchial cyst)", dimId: "location", value: "anterior_sternomastoid_upper_third", multiSelect: false),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Night sweats / weight loss",  dimId: "associations", value: "Night sweats"),
        EFChip(label: "Hoarse voice",                dimId: "associations", value: "Hoarse voice"),
        EFChip(label: "Age > 50",                    dimId: "age_over",     value: "50"),
    ]),
]

private let surgBreastLumpEarlyForm: [EFGroup] = [
    EFGroup(question: "Lump character (single select)", icon: "circle.circle.fill", chips: [
        EFChip(label: "Hard / fixed (Ca)",                dimId: "character", value: "Hard",         multiSelect: false),
        EFChip(label: "Smooth / mobile (fibroadenoma)",   dimId: "character", value: "Smooth mobile", multiSelect: false),
        EFChip(label: "Soft / fluctuant (cyst / abscess)", dimId: "character", value: "Soft fluctuant", multiSelect: false),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Skin dimpling (Ca)",             dimId: "associations", value: "Skin dimpling"),
        EFChip(label: "Axillary lymphadenopathy (Ca)",  dimId: "associations", value: "Axillary lymphadenopathy"),
        EFChip(label: "Tender + breastfeeding (mastitis)", dimId: "pmh",       value: "breastfeeding"),
        EFChip(label: "Skin tethering",                 dimId: "associations", value: "Skin tethering"),
        EFChip(label: "Age < 35 (fibroadenoma common)", dimId: "age_under",    value: "35"),
    ]),
]

private let surgPerianaleEarlyForm: [EFGroup] = [
    EFGroup(question: "Main symptom (single select)", icon: "figure.walk.fill", chips: [
        EFChip(label: "Bright red bleeding on paper (haemorrhoids)", dimId: "associations", value: "Bright red rectal bleeding", multiSelect: false),
        EFChip(label: "Severe tearing pain on defaecation (fissure)", dimId: "character",   value: "Tearing",                   multiSelect: false),
        EFChip(label: "Throbbing constant pain (abscess)",            dimId: "character",   value: "Throbbing",                 multiSelect: false),
        EFChip(label: "Recurrent discharge / track (fistula)",        dimId: "associations", value: "Recurrent discharge",       multiSelect: false),
    ]),
    EFGroup(question: "Additional features", icon: "list.bullet.circle", chips: [
        EFChip(label: "Post-defaecation spasm",        dimId: "associations", value: "Sphincter spasm"),
        EFChip(label: "Protrusion / prolapse",         dimId: "associations", value: "Protrusion"),
        EFChip(label: "Pruritus ani",                  dimId: "associations", value: "Pruritus ani"),
        EFChip(label: "Fluctuant perianal swelling",   dimId: "exam",         value: "fluctuant swelling"),
        EFChip(label: "Known Crohn's disease",         dimId: "pmh",          value: "crohn"),
    ]),
]

private let surgAcuteLimbEarlyForm: [EFGroup] = [
    EFGroup(question: "Six Ps — acute ischaemia features", icon: "bolt.trianglebadge.exclamationmark.fill", chips: [
        EFChip(label: "Pain — sudden onset",          dimId: "onset",        value: "Sudden"),
        EFChip(label: "Pallor",                       dimId: "associations", value: "Pallor"),
        EFChip(label: "Pulselessness",                dimId: "associations", value: "Pulselessness"),
        EFChip(label: "Paralysis (motor loss)",       dimId: "associations", value: "Paralysis"),
        EFChip(label: "Bilateral legs (aortoiliac)",  dimId: "site",         value: "Bilateral legs"),
    ]),
    EFGroup(question: "Aetiology clues", icon: "clock.badge.exclamationmark.fill", chips: [
        EFChip(label: "Known AF (embolism)",          dimId: "pmh", value: "atrial fibrillation"),
        EFChip(label: "Known PAD / claudication",     dimId: "pmh", value: "peripheral arterial disease"),
        EFChip(label: "Popliteal mass (aneurysm)",    dimId: "exam", value: "popliteal mass"),
        EFChip(label: "Absent femoral pulses",        dimId: "exam", value: "absent femoral pulses"),
    ]),
]

private let surgWoundEarlyForm: [EFGroup] = [
    EFGroup(question: "Wound problem type (single select)", icon: "bandage.fill", chips: [
        EFChip(label: "Wound opening / dehiscence",  dimId: "associations", value: "Wound opening",    multiSelect: false),
        EFChip(label: "Wound redness + discharge (SSI)", dimId: "associations", value: "Wound discharge", multiSelect: false),
        EFChip(label: "Fluctuant swelling (seroma / abscess)", dimId: "associations", value: "Fluctuant swelling", multiSelect: false),
        EFChip(label: "Pink fluid leakage (burst abdomen)", dimId: "associations", value: "Pink fluid leakage",    multiSelect: false),
    ]),
    EFGroup(question: "Severity indicators", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Fever",               dimId: "associations", value: "Fever"),
        EFChip(label: "Deep wound pain",     dimId: "associations", value: "Deep wound pain"),
        EFChip(label: "Wound dehiscence",    dimId: "associations", value: "Wound dehiscence"),
        EFChip(label: "Crepitus (gas — NF?)", dimId: "exam",        value: "crepitus"),
    ]),
]

// MARK: - Cardiovascular early forms

private let cardioHeartFailureEarlyForm: [EFGroup] = [
    EFGroup(question: "Predominant symptom pattern (single select)", icon: "heart.slash.fill", chips: [
        EFChip(label: "Orthopnoea / PND (HFrEF)",    dimId: "character",    value: "Orthopnoea",   multiSelect: false),
        EFChip(label: "Exertional dyspnoea",          dimId: "exacerbating", value: "Exertion",     multiSelect: false),
        EFChip(label: "Leg oedema",                   dimId: "associations", value: "Leg swelling", multiSelect: false),
    ]),
    EFGroup(question: "Key features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Known heart failure",         dimId: "pmh",   value: "heart failure"),
        EFChip(label: "S3 gallop on exam",           dimId: "exam",  value: "s3 gallop"),
        EFChip(label: "Palpable pulsatile liver (tamponade?)", dimId: "becks_triad", value: "jvp_muffled_hypotension"),
        EFChip(label: "Shortness of breath",         dimId: "associations", value: "Shortness of breath"),
    ]),
]

private let cardioStrokeTIAEarlyForm: [EFGroup] = [
    EFGroup(question: "Deficit pattern (single select)", icon: "brain.head.profile.fill", chips: [
        EFChip(label: "Unilateral face/arm/leg weakness", dimId: "face_arm_leg",   value: "unilateral_weakness",      multiSelect: false),
        EFChip(label: "Sudden focal deficit (ischaemic)", dimId: "sudden_onset",   value: "focal_neurological_deficit", multiSelect: false),
        EFChip(label: "Thunderclap headache at onset (haemorrhagic)", dimId: "headache", value: "thunderclap_at_onset", multiSelect: false),
        EFChip(label: "Complete resolution < 24 h (TIA)", dimId: "focal_deficit", value: "complete_resolution_24h",  multiSelect: false),
    ]),
    EFGroup(question: "Risk markers", icon: "staroflife.circle", chips: [
        EFChip(label: "BP > 180 (PRES / hypertensive)", dimId: "BP",           value: "severely_elevated_above_180"),
        EFChip(label: "Known TIA / prior stroke",       dimId: "pmh",          value: "tia"),
        EFChip(label: "Known carotid stenosis",         dimId: "carotid_stenosis", value: "ipsilateral_significant"),
        EFChip(label: "Prior migraine (vestibular migraine ddx)", dimId: "prior_migraine_history", value: "present"),
    ]),
]

private let cardioDVTPEEarlyForm: [EFGroup] = [
    EFGroup(question: "Presentation (single select)", icon: "arrow.down.to.line.circle.fill", chips: [
        EFChip(label: "Leg swelling / DVT",          dimId: "associations", value: "Swelling",             multiSelect: false),
        EFChip(label: "Sudden SOB / pleuritic pain (PE)", dimId: "onset", value: "Sudden",                  multiSelect: false),
        EFChip(label: "Superficial cord (thrombophlebitis)", dimId: "palpable_cord", value: "superficial_vein", multiSelect: false),
    ]),
    EFGroup(question: "Risk factors", icon: "exclamationmark.circle.fill", chips: [
        EFChip(label: "Previous DVT / PE",          dimId: "pmh",          value: "dvt"),
        EFChip(label: "Known malignancy",           dimId: "pmh",          value: "malignancy"),
        EFChip(label: "Shortness of breath",        dimId: "associations", value: "Shortness of breath"),
        EFChip(label: "Long bone fracture / surgery (fat embolism)", dimId: "preceding_event", value: "long_bone_fracture_or_arthroplasty"),
        EFChip(label: "Petechiae (axilla / conjunctiva)", dimId: "petechiae", value: "axilla_conjunctiva"),
    ]),
]

private let cardioHypertensionEarlyForm: [EFGroup] = [
    EFGroup(question: "BP reading context (single select)", icon: "waveform.path.ecg.rectangle.fill", chips: [
        EFChip(label: "BP > 180/120 — possible urgency/emergency", dimId: "BP",             value: "above_180_120", multiSelect: false),
        EFChip(label: "Resistant hypertension (≥3 drugs)",         dimId: "associations",   value: "Resistant hypertension", multiSelect: false),
        EFChip(label: "Normal home BP — white coat suspected",      dimId: "home_BP",        value: "below_135_85", multiSelect: false),
    ]),
    EFGroup(question: "Secondary cause flags", icon: "staroflife.circle.fill", chips: [
        EFChip(label: "Hypokalaemia (Conn's syndrome)",        dimId: "associations", value: "Hypokalaemia"),
        EFChip(label: "ACEi worsens renal function (renovascular)", dimId: "associations", value: "ACE inhibitor worsens renal function"),
        EFChip(label: "Papilloedema / encephalopathy (emergency)", dimId: "end_organ_damage", value: "papilloedema_encephalopathy_AKI"),
    ]),
]

// MARK: - Respiratory early forms

private let respCoughEarlyForm: [EFGroup] = [
    EFGroup(question: "Key discriminating feature (single select)", icon: "waveform.path.fill", chips: [
        EFChip(label: "Resolves on stopping ACEi",     dimId: "relieving",  value: "Stop ACEi",      multiSelect: false),
        EFChip(label: "Wheeze — known asthma",         dimId: "pmh",        value: "asthma",         multiSelect: false),
        EFChip(label: "Post-nasal drip sensation",     dimId: "character",  value: "Drip sensation", multiSelect: false),
        EFChip(label: "Worse lying (GERD cough)",      dimId: "timing",     value: "Worse lying",    multiSelect: false),
        EFChip(label: "Haemoptysis",                   dimId: "associations", value: "Haemoptysis",  multiSelect: false),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Night sweats (TB?)",            dimId: "associations", value: "Night sweats"),
        EFChip(label: "Weight loss",                   dimId: "associations", value: "Weight loss"),
        EFChip(label: "Smoker (COPD / Ca)",            dimId: "social",       value: "smok"),
        EFChip(label: "Breathlessness",                dimId: "associations", value: "Breathlessness"),
        EFChip(label: "Relieved by bronchodilator (asthma)", dimId: "relieving", value: "Bronchodilator"),
    ]),
]

private let respSOBEarlyForm: [EFGroup] = [
    EFGroup(question: "Most likely pattern (single select)", icon: "lungs.fill", chips: [
        EFChip(label: "Wheeze — asthma / COPD",      dimId: "character",  value: "Wheeze",          multiSelect: false),
        EFChip(label: "Known COPD exacerbation",     dimId: "pmh",        value: "copd",            multiSelect: false),
        EFChip(label: "Sudden onset (pneumothorax)", dimId: "onset",      value: "Sudden",          multiSelect: false),
        EFChip(label: "Heart failure features",      dimId: "pmh",        value: "heart failure",   multiSelect: false),
        EFChip(label: "Consolidation signs (pneumonia)", dimId: "exam",   value: "consolidation",   multiSelect: false),
    ]),
    EFGroup(question: "Red flag features", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Haemoptysis",           dimId: "associations", value: "Haemoptysis"),
        EFChip(label: "Night sweats (TB)",     dimId: "associations", value: "Night sweats"),
        EFChip(label: "Weight loss",           dimId: "associations", value: "Weight loss"),
        EFChip(label: "Reduced breath sounds", dimId: "exam",         value: "reduced breath sounds"),
        EFChip(label: "Hyperresonance (PTX)",  dimId: "exam",         value: "hyperresonance"),
    ]),
]

// MARK: - Endocrine & Metabolic early forms

private let endoDiabetesEarlyForm: [EFGroup] = [
    EFGroup(question: "Review focus (single select)", icon: "cross.case.fill", chips: [
        EFChip(label: "HbA1c > 48 — new or poorly controlled", dimId: "HbA1c",          value: "above_48",  multiSelect: false),
        EFChip(label: "HbA1c 39–47 — pre-diabetes",            dimId: "HbA1c",          value: "39_to_47",  multiSelect: false),
        EFChip(label: "HbA1c > 9% — poor control",             dimId: "HbA1c",          value: "above_9",   multiSelect: false),
    ]),
    EFGroup(question: "Complications screen", icon: "list.bullet.clipboard.fill", chips: [
        EFChip(label: "Foot ulcer",                   dimId: "associations", value: "Foot ulcer"),
        EFChip(label: "Peripheral neuropathy",        dimId: "associations", value: "Peripheral neuropathy"),
        EFChip(label: "Proteinuria (nephropathy)",    dimId: "associations", value: "Proteinuria"),
        EFChip(label: "eGFR low (nephropathy)",       dimId: "inv",          value: "eGFR low"),
        EFChip(label: "Long-standing diabetes",       dimId: "pmh",          value: "long standing diabetes"),
    ]),
]

private let endoThyroidEarlyForm: [EFGroup] = [
    EFGroup(question: "Functional state (single select)", icon: "staroflife.fill", chips: [
        EFChip(label: "TSH elevated — hypothyroid",   dimId: "inv", value: "tsh elevated",   multiSelect: false),
        EFChip(label: "TSH suppressed — hyperthyroid", dimId: "inv", value: "tsh suppressed", multiSelect: false),
        EFChip(label: "FNAC malignant — carcinoma",   dimId: "inv", value: "fnac malignant",  multiSelect: false),
    ]),
    EFGroup(question: "Examination / investigation features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Exophthalmos (Graves')",        dimId: "associations", value: "Exophthalmos"),
        EFChip(label: "Hard thyroid nodule",           dimId: "exam",         value: "hard nodule"),
        EFChip(label: "Hoarse voice (Ca / nerve)",     dimId: "associations", value: "Hoarse voice"),
        EFChip(label: "TPO antibody positive (Hashimoto's)", dimId: "inv",    value: "tpo antibody"),
        EFChip(label: "Neck pain + raised ESR (De Quervain's)", dimId: "associations", value: "Neck pain"),
    ]),
]

private let endoAdrenalEarlyForm: [EFGroup] = [
    EFGroup(question: "Clinical syndrome (single select)", icon: "bolt.circle.fill", chips: [
        EFChip(label: "Resistant HTN + hypokalaemia (Conn's)", dimId: "associations", value: "Hypokalaemia",       multiSelect: false),
        EFChip(label: "Hypertensive crisis (phaeochromocytoma)", dimId: "associations", value: "Hypertensive crisis", multiSelect: false),
        EFChip(label: "Striae + bruising + obesity (Cushing's)", dimId: "associations", value: "Striae",            multiSelect: false),
        EFChip(label: "Incidental adrenal mass",               dimId: "imaging_finding", value: "incidental_adrenal_mass", multiSelect: false),
    ]),
    EFGroup(question: "Supporting features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "MEN2 history (phaeochromocytoma risk)", dimId: "pmh",          value: "men2"),
        EFChip(label: "Steroid use history (Cushing's)",       dimId: "associations", value: "Steroid use"),
        EFChip(label: "Resistant hypertension",                dimId: "associations", value: "Resistant hypertension"),
    ]),
]

// MARK: - Urology & Renal early forms

private let uroUrinaryEarlyForm: [EFGroup] = [
    EFGroup(question: "Urinary symptom pattern (single select)", icon: "drop.fill", chips: [
        EFChip(label: "Dysuria + frequency (UTI)",           dimId: "associations", value: "Dysuria",             multiSelect: false),
        EFChip(label: "Loin pain + fever (pyelonephritis)",  dimId: "associations", value: "Loin pain",           multiSelect: false),
        EFChip(label: "Painless haematuria (bladder Ca?)",   dimId: "associations", value: "Painless haematuria", multiSelect: false),
        EFChip(label: "Urgency / urge incontinence (OAB)",   dimId: "associations", value: "Urgency",             multiSelect: false),
        EFChip(label: "Pelvic pain + negative culture (IC)", dimId: "associations", value: "Pelvic pain",         multiSelect: false),
    ]),
    EFGroup(question: "Risk factors", icon: "staroflife.circle", chips: [
        EFChip(label: "Smoking (bladder Ca risk)", dimId: "pmh", value: "smoking"),
        EFChip(label: "Fever",                     dimId: "associations", value: "Fever"),
        EFChip(label: "Renal angle tenderness",    dimId: "exam",         value: "renal angle tenderness"),
    ]),
]

private let uroRetentionEarlyForm: [EFGroup] = [
    EFGroup(question: "Retention cause (single select)", icon: "nosign.fill", chips: [
        EFChip(label: "Male > 50 — enlarged prostate (BPH)", dimId: "sex_male", value: "", multiSelect: false),
        EFChip(label: "Poor stream — urethral stricture",    dimId: "associations", value: "Poor stream", multiSelect: false),
        EFChip(label: "Irregular prostate (Ca?)",            dimId: "exam",         value: "irregular prostate", multiSelect: false),
        EFChip(label: "Neurogenic (SCI / MS)",               dimId: "pmh",          value: "spinal cord injury", multiSelect: false),
    ]),
    EFGroup(question: "Supporting features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Hesitancy",          dimId: "associations", value: "Hesitancy"),
        EFChip(label: "Weak stream",        dimId: "associations", value: "Weak stream"),
        EFChip(label: "Bone pain (Ca mets)", dimId: "associations", value: "Bone pain"),
        EFChip(label: "Prior urethral trauma or STI (stricture)", dimId: "pmh", value: "urethral trauma"),
        EFChip(label: "Age > 50",           dimId: "age_over",     value: "50"),
    ]),
]

private let uroScrotalEarlyForm: [EFGroup] = [
    EFGroup(question: "Scrotal presentation (single select)", icon: "circle.grid.2x1.fill", chips: [
        EFChip(label: "Sudden severe pain — torsion (EMERGENCY)", dimId: "onset",     value: "Sudden",             multiSelect: false),
        EFChip(label: "Tender epididymis + discharge (E-O)",      dimId: "exam",      value: "tender epididymis",  multiSelect: false),
        EFChip(label: "Transilluminates (hydrocele)",             dimId: "exam",      value: "transilluminates",   multiSelect: false),
        EFChip(label: "Hard nodule / solid mass (tumour)",        dimId: "exam",      value: "hard nodule",        multiSelect: false),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Absent cremasteric reflex (torsion)",  dimId: "exam",          value: "absent cremasteric reflex"),
        EFChip(label: "Urethral discharge (epididymo-orchitis)", dimId: "associations", value: "Urethral discharge"),
        EFChip(label: "Prior undescended testis (tumour risk)", dimId: "pmh",          value: "undescended testis"),
        EFChip(label: "Raised AFP / βhCG",                    dimId: "inv",           value: "afp or bhcg"),
    ]),
]

// MARK: - Musculoskeletal early forms

private let mskBackPainEarlyForm: [EFGroup] = [
    EFGroup(question: "Red flag pattern (single select)", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Urinary retention + saddle anaesthesia (Cauda Equina — EMERGENCY)", dimId: "associations", value: "Urinary retention", multiSelect: false),
        EFChip(label: "Known cancer + progressive (MSCC)", dimId: "pmh",    value: "cancer",       multiSelect: false),
        EFChip(label: "Trauma + osteoporosis (fracture)",  dimId: "onset",  value: "After trauma", multiSelect: false),
        EFChip(label: "Leg radiation + SLR positive (disc)", dimId: "radiation", value: "Leg",     multiSelect: false),
        EFChip(label: "Morning stiffness > 1 h (ankylosing spondylitis)", dimId: "timing", value: "Morning stiffness", multiSelect: false),
    ]),
    EFGroup(question: "Supporting features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Saddle anaesthesia",              dimId: "exam",         value: "saddle anaesthesia"),
        EFChip(label: "Bilateral leg weakness",          dimId: "associations", value: "Bilateral leg weakness"),
        EFChip(label: "Nocturnal / progressive pain",    dimId: "timing",       value: "Nocturnal"),
        EFChip(label: "Relieved by exercise (AS)",       dimId: "relieving",    value: "Exercise"),
        EFChip(label: "Worse with movement (mechanical)", dimId: "exacerbating", value: "Movement"),
    ]),
]

private let mskJointPainEarlyForm: [EFGroup] = [
    EFGroup(question: "Joint presentation (single select)", icon: "figure.walk.motion.fill", chips: [
        EFChip(label: "First MTP — gout (urate crystals)", dimId: "joint_affected", value: "first_MTP",  multiSelect: false),
        EFChip(label: "Hot swollen joint — septic arthritis", dimId: "character",   value: "Hot",        multiSelect: false),
        EFChip(label: "After GI / STI infection (reactive)", dimId: "recent_infection", value: "GI_or_STI", multiSelect: false),
        EFChip(label: "Weight-bearing ache + crepitus (OA)", dimId: "character",    value: "Deep ache",  multiSelect: false),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Tophi present (gout)",               dimId: "tophi",         value: "present"),
        EFChip(label: "Dengue fever features",              dimId: "dengue_NS1_IgM", value: "positive"),
        EFChip(label: "Keratoderma blennorrhagica (reactive)", dimId: "skin_lesion", value: "keratoderma_blennorrhagica"),
        EFChip(label: "X-ray joint space narrowing (OA)",   dimId: "xray",          value: "joint_space_narrowing_osteophytes"),
    ]),
]

// MARK: - Infectious & Tropical early forms

private let infectFeverEarlyForm: [EFGroup] = [
    EFGroup(question: "Infection pattern (single select)", icon: "thermometer.medium.fill", chips: [
        EFChip(label: "Dengue — platelet < 100 + NS1/IgM", dimId: "platelet_count", value: "below_100",        multiSelect: false),
        EFChip(label: "Leptospirosis — flood/water exposure", dimId: "exposure",    value: "flooding_animal_water_contact", multiSelect: false),
        EFChip(label: "Typhoid — rose spots + blood culture", dimId: "rose_spots",  value: "present",          multiSelect: false),
        EFChip(label: "UTI — positive dipstick / dysuria",   dimId: "urinalysis_nitrites", value: "positive",  multiSelect: false),
        EFChip(label: "Pneumonia — consolidation on CXR",    dimId: "CXR",         value: "new_consolidation", multiSelect: false),
    ]),
    EFGroup(question: "Additional features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Conjunctival suffusion (leptospirosis)", dimId: "conjunctival_suffusion", value: "present"),
        EFChip(label: "Rigors",                           dimId: "associations", value: "Rigors"),
        EFChip(label: "Skin / soft tissue erythema (cellulitis)", dimId: "exam", value: "erythema"),
        EFChip(label: "Weil's syndrome — jaundice + renal failure", dimId: "jaundice_renal", value: "Weil_syndrome"),
    ]),
]

private let infectSepsisEarlyForm: [EFGroup] = [
    EFGroup(question: "Sepsis source (single select)", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Intra-abdominal — peritonism / free air", dimId: "peritonism",   value: "guarding_rigidity",         multiSelect: false),
        EFChip(label: "Urosepsis — urine culture + obstructed kidney", dimId: "urine_culture", value: "significant_growth", multiSelect: false),
        EFChip(label: "Pulmonary — new CXR infiltrate",          dimId: "CXR",          value: "new_infiltrate",            multiSelect: false),
        EFChip(label: "Necrotising fasciitis — crepitus + necrosis", dimId: "exam",     value: "crepitus",                  multiSelect: false),
    ]),
    EFGroup(question: "Alarming local features (NF / gas gangrene)", icon: "bolt.trianglebadge.exclamationmark.fill", chips: [
        EFChip(label: "Skin necrosis",                    dimId: "exam",         value: "skin necrosis"),
        EFChip(label: "Dishwater fluid",                  dimId: "exam",         value: "dishwater fluid"),
        EFChip(label: "Scrotal / perineal crepitus (Fournier's)", dimId: "site", value: "Scrotum"),
        EFChip(label: "Hypotension / shock",              dimId: "associations", value: "Hypotension"),
        EFChip(label: "Diabetes (NF risk factor)",        dimId: "pmh",          value: "diabetes"),
    ]),
]

// MARK: - Haematology & Oncology early forms

private let haemAnaemiaEarlyForm: [EFGroup] = [
    EFGroup(question: "Anaemia type clues (single select)", icon: "drop.circle.fill", chips: [
        EFChip(label: "Iron deficiency — pallor + pica",    dimId: "associations", value: "Pica",               multiSelect: false),
        EFChip(label: "Haemolytic — jaundice + dark urine", dimId: "associations", value: "Dark urine",         multiSelect: false),
        EFChip(label: "Sickle cell — pain crisis",          dimId: "associations", value: "Crisis pain",        multiSelect: false),
        EFChip(label: "B12/folate — neuropathy + sore tongue", dimId: "associations", value: "Neuropathy",      multiSelect: false),
        EFChip(label: "Chronic disease — known chronic illness", dimId: "associations", value: "Chronic illness", multiSelect: false),
    ]),
    EFGroup(question: "Additional features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Pallor",            dimId: "associations", value: "Pallor"),
        EFChip(label: "Sore tongue",       dimId: "associations", value: "Sore tongue"),
        EFChip(label: "Jaundice",          dimId: "associations", value: "Jaundice"),
        EFChip(label: "Splenomegaly",      dimId: "exam",         value: "splenomegaly"),
    ]),
]

private let haemLymphadenopathyEarlyForm: [EFGroup] = [
    EFGroup(question: "Node characteristics (single select)", icon: "circle.grid.3x3.fill", chips: [
        EFChip(label: "Tender + recent infection (reactive)", dimId: "character", value: "Tender",   multiSelect: false),
        EFChip(label: "Rubbery / painless (lymphoma)",        dimId: "character", value: "Rubbery",  multiSelect: false),
        EFChip(label: "Hard / fixed (metastatic)",            dimId: "character", value: "Hard",     multiSelect: false),
    ]),
    EFGroup(question: "B symptoms / systemic features", icon: "exclamationmark.circle.fill", chips: [
        EFChip(label: "Night sweats",                       dimId: "associations", value: "Night sweats"),
        EFChip(label: "Weight loss",                        dimId: "associations", value: "Weight loss"),
        EFChip(label: "Mediastinal widening on CXR",        dimId: "inv",          value: "mediastinal widening"),
        EFChip(label: "Age > 50 (metastatic risk)",         dimId: "age_over",     value: "50"),
    ]),
]

// MARK: - Gynaecology & Obstetrics early forms

private let gynaePelvicPainEarlyForm: [EFGroup] = [
    EFGroup(question: "Pelvic pain aetiology (single select)", icon: "waveform.path.ecg.fill", chips: [
        EFChip(label: "Positive pregnancy test (ectopic — EMERGENCY)", dimId: "positive_pregnancy_test", value: "present", multiSelect: false),
        EFChip(label: "Absent ovarian Doppler flow (torsion)",          dimId: "doppler",                 value: "absent_flow", multiSelect: false),
        EFChip(label: "STI screen positive (PID)",                      dimId: "sti_screen",              value: "positive_chlamydia_gonorrhoea", multiSelect: false),
        EFChip(label: "Ultrasound fibroid confirmed",                   dimId: "ultrasound",              value: "fibroid_confirmed", multiSelect: false),
    ]),
    EFGroup(question: "Additional features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Free fluid on ultrasound (haemoperitoneum)", dimId: "haemoperitoneum", value: "free_fluid"),
        EFChip(label: "Adnexal mass on ultrasound",                 dimId: "adnexal_mass",    value: "present_on_ultrasound"),
        EFChip(label: "Uterosacral nodularity (endometriosis)",     dimId: "uterosacral_nodularity", value: "present"),
        EFChip(label: "Haemodynamic instability (ectopic — EMERGENCY)", dimId: "shock",       value: "haemodynamic_instability"),
    ]),
]

private let gynaeVaginalBleedEarlyForm: [EFGroup] = [
    EFGroup(question: "Bleeding context (single select)", icon: "drop.fill", chips: [
        EFChip(label: "Positive pregnancy — threatened miscarriage",     dimId: "positive_pregnancy_test", value: "present", multiSelect: false),
        EFChip(label: "Postmenopausal bleeding (endometrial pathology?)", dimId: "postmenopausal_bleeding", value: "present", multiSelect: false),
        EFChip(label: "Antepartum haemorrhage (> 20 weeks)",             dimId: "second_third_trimester",  value: "antepartum_bleed", multiSelect: false),
        EFChip(label: "Low-lying placenta (praevia)",                    dimId: "ultrasound",              value: "low_lying_placenta", multiSelect: false),
    ]),
    EFGroup(question: "Examination features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Friable irregular cervix (carcinoma)",           dimId: "cervix",        value: "friable_irregular"),
        EFChip(label: "Endometrial thickness > 4 mm (postmenop)",      dimId: "endometrial_thickness", value: "above_4mm_postmenop"),
        EFChip(label: "Painful rigid uterus (abruption)",              dimId: "painful_rigid_uterus", value: "present"),
        EFChip(label: "CTG showing fetal distress",                    dimId: "ctg",           value: "fetal_distress"),
    ]),
]

private let gynaeObstetricEarlyForm: [EFGroup] = [
    EFGroup(question: "Obstetric complication type (single select)", icon: "heart.circle.fill", chips: [
        EFChip(label: "Persistent vomiting (hyperemesis gravidarum)",   dimId: "positive_pregnancy_test", value: "present", multiSelect: false),
        EFChip(label: "BP > 140/90 after 20 wks + proteinuria (pre-eclampsia)", dimId: "hypertension", value: "above_140_90_after_20_weeks", multiSelect: false),
        EFChip(label: "Abnormal OGTT (gestational diabetes)",           dimId: "ogtt",             value: "abnormal_pregnancy", multiSelect: false),
    ]),
    EFGroup(question: "Pre-eclampsia severity", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Proteinuria > 300 mg/24 h",      dimId: "proteinuria", value: "above_300mg_24h"),
        EFChip(label: "Fetal distress on CTG",          dimId: "ctg",         value: "fetal_distress"),
    ]),
]

// MARK: - Paediatrics early forms

private let paedFeverEarlyForm: [EFGroup] = [
    EFGroup(question: "Fever source (single select)", icon: "thermometer.medium.fill", chips: [
        EFChip(label: "Non-blanching rash (meningococcal — EMERGENCY)", dimId: "petechiae_purpura", value: "non_blanching", multiSelect: false),
        EFChip(label: "Bulging fontanelle (meningitis in infant)",      dimId: "bulging_fontanelle", value: "in_infant",    multiSelect: false),
        EFChip(label: "Ear pain — otoscopy abnormal (otitis media)",    dimId: "otoscopy",          value: "bulging_erythematous_membrane", multiSelect: false),
        EFChip(label: "Significant urine culture (febrile UTI)",        dimId: "mssu",              value: "growth_significant", multiSelect: false),
        EFChip(label: "CXR consolidation (childhood pneumonia)",        dimId: "chest_xray",        value: "consolidation", multiSelect: false),
    ]),
    EFGroup(question: "Severity indicators", icon: "exclamationmark.circle.fill", chips: [
        EFChip(label: "Altered consciousness / stiff neck", dimId: "associations", value: "Neck stiffness"),
        EFChip(label: "Respiratory distress",               dimId: "associations", value: "Respiratory distress"),
        EFChip(label: "Prolonged fever > 5 days (Kawasaki?)", dimId: "timing",     value: ">5 days"),
    ]),
]

private let paedAbdomEarlyForm: [EFGroup] = [
    EFGroup(question: "Paediatric abdominal cause (single select)", icon: "waveform.path.ecg.fill", chips: [
        EFChip(label: "Sausage mass + currant jelly stool (intussusception)", dimId: "currant_jelly_stool", value: "present",             multiSelect: false),
        EFChip(label: "Projectile non-bilious vomiting in infant (pyloric stenosis)", dimId: "vomiting", value: "projectile_non_bilious", multiSelect: false),
        EFChip(label: "RIF pain + anorexia + fever (appendicitis)",           dimId: "associations",       value: "RIF pain",            multiSelect: false),
        EFChip(label: "Umbilical → RIF migration (appendicitis)",             dimId: "site",               value: "RLQ",                 multiSelect: false),
    ]),
    EFGroup(question: "Supporting features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Palpable sausage-shaped RUQ mass",      dimId: "abdominal_mass",   value: "sausage_shaped_ruq"),
        EFChip(label: "Olive mass RUQ in infant (pyloric)",    dimId: "olive_mass",       value: "palpable_ruq"),
        EFChip(label: "Anorexia",                              dimId: "associations",     value: "Anorexia"),
        EFChip(label: "Rebound tenderness (appendicitis)",     dimId: "exam",             value: "rebound"),
    ]),
]

// MARK: - Dermatology early forms

private let dermaRashEarlyForm: [EFGroup] = [
    EFGroup(question: "Rash pattern (single select)", icon: "oval.portrait.fill", chips: [
        EFChip(label: "Well-demarcated silvery plaques (psoriasis)", dimId: "plaques", value: "well_demarcated_silvery_scale", multiSelect: false),
        EFChip(label: "Migratory wheals (urticaria)",               dimId: "wheals",  value: "migratory_blanching_pruritic", multiSelect: false),
        EFChip(label: "Annular with central clearing (tinea)",      dimId: "character", value: "Annular",                    multiSelect: false),
        EFChip(label: "Herald patch then trunk rash (pityriasis rosea)", dimId: "herald_patch", value: "single_ovoid_salmon", multiSelect: false),
        EFChip(label: "Contact distribution (contact dermatitis)",  dimId: "character", value: "Contact",                   multiSelect: false),
    ]),
    EFGroup(question: "Features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "KOH scraping positive hyphae (tinea)", dimId: "koh_scraping",  value: "positive_hyphae"),
        EFChip(label: "Patch test positive (contact derm)",   dimId: "patch_test",    value: "positive"),
        EFChip(label: "Known atopy / eczema history",         dimId: "pmh",           value: "atopy"),
        EFChip(label: "Worse with allergen exposure",         dimId: "exacerbating",  value: "Allergen"),
    ]),
]

private let dermaSkinLesionEarlyForm: [EFGroup] = [
    EFGroup(question: "Lesion characteristics (single select)", icon: "oval.lefthalf.filled", chips: [
        EFChip(label: "Irregular border + multiple colours (melanoma)", dimId: "associations", value: "Irregular border",   multiSelect: false),
        EFChip(label: "Pearly rolled border (BCC)",                    dimId: "associations", value: "Rolled border",      multiSelect: false),
        EFChip(label: "Indurated / crusting / ulceration (SCC)",       dimId: "associations", value: "Indurated",          multiSelect: false),
        EFChip(label: "Central punctum — soft (epidermoid cyst)",      dimId: "exam",         value: "punctum",            multiSelect: false),
        EFChip(label: "Soft / slips under finger (lipoma)",            dimId: "character",    value: "Soft compressible",  multiSelect: false),
    ]),
    EFGroup(question: "History factors", icon: "clock.badge.exclamationmark.fill", chips: [
        EFChip(label: "Changing / growing lesion",            dimId: "timing", value: "Changing"),
        EFChip(label: "Diameter > 6 mm",                     dimId: "associations", value: "Diameter > 6mm"),
        EFChip(label: "Prior melanoma",                      dimId: "pmh",    value: "previous melanoma"),
        EFChip(label: "Prior actinic keratosis (SCC risk)",  dimId: "pmh",    value: "actinic keratosis"),
    ]),
]

// MARK: - Psychiatry / Mental Health early forms

private let psychDepressionEarlyForm: [EFGroup] = [
    EFGroup(question: "Primary presentation (single select)", icon: "cloud.rain.fill", chips: [
        EFChip(label: "Low mood / anhedonia (depression)",         dimId: "associations", value: "Low mood",            multiSelect: false),
        EFChip(label: "Post-exertional malaise > 6 months (CFS/ME)", dimId: "timing",     value: ">6 months",           multiSelect: false),
        EFChip(label: "Anxiety / worry",                           dimId: "associations", value: "Anxiety",             multiSelect: false),
        EFChip(label: "Witnessed apnoea / snoring (OSA)",          dimId: "associations", value: "Witnessed apnoea",    multiSelect: false),
    ]),
    EFGroup(question: "Associated features", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Cognitive impairment",   dimId: "associations", value: "Cognitive impairment"),
        EFChip(label: "Pallor (anaemia ddx)",   dimId: "associations", value: "Pallor"),
        EFChip(label: "Cold intolerance (hypothyroid ddx)", dimId: "associations", value: "Cold intolerance"),
        EFChip(label: "Polyuria / polydipsia (DM ddx)", dimId: "associations", value: "Polyuria"),
        EFChip(label: "> 2 weeks duration",     dimId: "timing",       value: ">2 weeks"),
    ]),
]

// MARK: - Internal Medicine — additional forms

private let internalCKDEarlyForm: [EFGroup] = [
    EFGroup(question: "CKD / renal disease pattern (single select)", icon: "drop.triangle.fill", chips: [
        EFChip(label: "eGFR < 60 × 3 months (CKD stage 3+)",       dimId: "gfr",          value: "below_60_three_months", multiSelect: false),
        EFChip(label: "Creatinine rise > 26 μmol in 48 h (AKI)",   dimId: "creatinine",   value: "rise_above_26_in_48h",  multiSelect: false),
        EFChip(label: "Proteinuria > 3.5 g/24 h (nephrotic)",      dimId: "proteinuria",  value: "above_3_5g_24h",        multiSelect: false),
        EFChip(label: "RBC casts + haematuria (nephritis/IgA)",     dimId: "rbc_casts",    value: "present",               multiSelect: false),
    ]),
    EFGroup(question: "Context / risk", icon: "list.bullet.circle.fill", chips: [
        EFChip(label: "Known diabetes", dimId: "pmh", value: "diabetes"),
        EFChip(label: "Known hypertension", dimId: "pmh", value: "hypertension"),
        EFChip(label: "Proteinuria",    dimId: "associations", value: "Proteinuria"),
    ]),
]

private let internalLiverEarlyForm: [EFGroup] = [
    EFGroup(question: "Liver disease type (single select)", icon: "leaf.fill", chips: [
        EFChip(label: "Hepatitis B — HBsAg + > 6 months",     dimId: "hbsag",      value: "positive_above_6_months", multiSelect: false),
        EFChip(label: "Hepatitis C — HCV RNA detectable",      dimId: "hcv_rna",    value: "detectable",              multiSelect: false),
        EFChip(label: "Cirrhosis — decompensated (ascites etc)", dimId: "exam",      value: "ascites",                 multiSelect: false),
        EFChip(label: "NAFLD — obesity / metabolic syndrome",  dimId: "pmh",        value: "obesity",                 multiSelect: false),
        EFChip(label: "Alcoholic hepatitis",                   dimId: "pmh",        value: "alcohol",                 multiSelect: false),
    ]),
    EFGroup(question: "Complication flags", icon: "exclamationmark.triangle.fill", chips: [
        EFChip(label: "Haematemesis (varices)",  dimId: "associations", value: "Haematemesis"),
        EFChip(label: "Jaundice",               dimId: "associations", value: "Jaundice"),
        EFChip(label: "Ascites on exam",        dimId: "exam",         value: "ascites"),
        EFChip(label: "Encephalopathy",         dimId: "associations", value: "Encephalopathy"),
    ]),
]

// swiftlint:enable line_length

/// Returns the early form chip groups for the given specialty hint + chief complaint.
/// Returns an empty array when no targeted form exists for the combination.
func specialtyEarlyFormGroups(hint: String, cc: String) -> [EFGroup] {
    let lc = cc.lowercased()
    switch hint {
    case "Neurology":
        if lc.contains("headache") || lc.contains("migraine") { return neurologHeadacheEarlyForm }
        if lc.contains("dizz") || lc.contains("vertigo") { return neurologDizzinessEarlyForm }
        return []
    case "Neurosurgery":
        if lc.contains("head injur") || lc.contains("trauma") { return neurosurgTraumaEarlyForm }
        if lc.contains("severe") || lc.contains("headache") { return neurosurgHeadacheEarlyForm }
        if lc.contains("tumour") || lc.contains("tumor") || lc.contains("hydrocephal") { return neurosurgTumourEarlyForm }
        return []
    case "Cardiology":
        if lc.contains("chest") { return cardiologyChestEarlyForm }
        if lc.contains("arrhythmia") || lc.contains("palpitation") || lc.contains("atrial") || lc.contains("fibrillation") {
            return cardiologyArrhythmiaEarlyForm
        }
        return []
    case "Internal Medicine":
        if lc.contains("ckd") || lc.contains("renal dis") || lc.contains("kidney") || lc.contains("nephro") { return internalCKDEarlyForm }
        if lc.contains("liver") || lc.contains("cirrhosis") || lc.contains("hepatitis") || lc.contains("hepat") { return internalLiverEarlyForm }
        if lc.contains("anaemia") || lc.contains("anemia") { return internalMedAnaemiaEarlyForm }
        if lc.contains("fatigue") || lc.contains("tired") || lc.contains("lethargy") { return internalMedFatigueEarlyForm }
        return []
    case "General & GI Surgery":
        if lc.contains("wound") || lc.contains("post-op") || lc.contains("postop") || lc.contains("post op") { return surgWoundEarlyForm }
        if lc.contains("obstruct") || lc.contains("ileus") || lc.contains("volvulus") { return surgObstructionEarlyForm }
        if lc.contains("hernia") { return surgHerniaEarlyForm }
        if lc.contains("bleed") && (lc.contains("upper") || lc.contains("gi") || lc.contains("haematemesis") || lc.contains("melaena")) { return surgUpperGIBleedEarlyForm }
        if lc.contains("rectal") || lc.contains("pr bleed") || lc.contains("haematochezia") { return surgRectalBleedEarlyForm }
        if lc.contains("perianal") || lc.contains("anal pain") || lc.contains("haemorrhoid") || lc.contains("fissure") || lc.contains("fistula") || lc.contains("abscess") { return surgPerianaleEarlyForm }
        if lc.contains("renal colic") || lc.contains("ureteric") || lc.contains("kidney stone") { return surgRenalColicEarlyForm }
        if lc.contains("acute limb") || lc.contains("ischaem") || lc.contains("embol") { return surgAcuteLimbEarlyForm }
        if lc.contains("vascular") || lc.contains("aneur") || lc.contains("claudic") || lc.contains("arterial") { return surgVascularEarlyForm }
        if lc.contains("reflux") || lc.contains("gerd") || lc.contains("heartburn") { return surgGERDEarlyForm }
        if lc.contains("dysphagia") || lc.contains("swallowing") { return surgDysphagiaEarlyForm }
        if lc.contains("jaundice") || lc.contains("biliary") || lc.contains("ercp") { return surgJaundiceEarlyForm }
        if lc.contains("neck lump") || lc.contains("neck mass") || lc.contains("lymph") || lc.contains("thyroid") { return surgNeckLumpEarlyForm }
        if lc.contains("breast") { return surgBreastLumpEarlyForm }
        if lc.contains("skin lesion") || lc.contains("melanoma") || lc.contains("skin lump") { return dermaSkinLesionEarlyForm }
        if lc.contains("abdom") || lc.contains("pain") || lc.contains("appendic") || lc.contains("cholecyst") || lc.contains("pancreati") || lc.contains("divertic") { return surgAbdominalPainEarlyForm }
        return []
    case "Cardiovascular":
        if lc.contains("stroke") || lc.contains("tia") || lc.contains("weakness") || lc.contains("facial droop") { return cardioStrokeTIAEarlyForm }
        if lc.contains("dvt") || lc.contains("pe") || lc.contains("embol") || lc.contains("thrombos") || lc.contains("leg swel") { return cardioDVTPEEarlyForm }
        if lc.contains("heart fail") || lc.contains("oedema") || lc.contains("breathless") { return cardioHeartFailureEarlyForm }
        if lc.contains("hypertens") || lc.contains("high bp") { return cardioHypertensionEarlyForm }
        if lc.contains("chest") { return cardiologyChestEarlyForm }
        if lc.contains("palpitat") || lc.contains("arrhyth") || lc.contains("fibrillat") { return cardiologyArrhythmiaEarlyForm }
        return []
    case "Respiratory":
        if lc.contains("cough") { return respCoughEarlyForm }
        if lc.contains("breath") || lc.contains("wheeze") || lc.contains("asthma") || lc.contains("copd") || lc.contains("shortness") { return respSOBEarlyForm }
        if lc.contains("haemoptysis") || lc.contains("pleurit") || lc.contains("tb") { return respSOBEarlyForm }
        return []
    case "Endocrine & Metabolic":
        if lc.contains("thyroid") || lc.contains("goitre") || lc.contains("hypothy") || lc.contains("hyperthy") { return endoThyroidEarlyForm }
        if lc.contains("adrenal") || lc.contains("cushing") || lc.contains("phaeo") || lc.contains("conn") { return endoAdrenalEarlyForm }
        if lc.contains("diabet") || lc.contains("glucose") || lc.contains("hba1c") { return endoDiabetesEarlyForm }
        return []
    case "Urology & Renal":
        if lc.contains("scrotal") || lc.contains("testicular") || lc.contains("torsion") { return uroScrotalEarlyForm }
        if lc.contains("retention") { return uroRetentionEarlyForm }
        if lc.contains("urinary") || lc.contains("haematuria") || lc.contains("dysuria") || lc.contains("uti") { return uroUrinaryEarlyForm }
        if lc.contains("renal colic") || lc.contains("stone") { return surgRenalColicEarlyForm }
        return []
    case "Musculoskeletal":
        if lc.contains("back") || lc.contains("sciatica") || lc.contains("spine") || lc.contains("cauda") { return mskBackPainEarlyForm }
        if lc.contains("joint") || lc.contains("gout") || lc.contains("arthrit") || lc.contains("knee") || lc.contains("hip") { return mskJointPainEarlyForm }
        return []
    case "Infectious & Tropical":
        if lc.contains("sepsis") || lc.contains("necrotis") || lc.contains("fasciit") || lc.contains("gangrene") { return infectSepsisEarlyForm }
        if lc.contains("fever") || lc.contains("dengue") || lc.contains("lepto") || lc.contains("typhoid") || lc.contains("infect") { return infectFeverEarlyForm }
        return []
    case "Haematology & Oncology":
        if lc.contains("lymph") || lc.contains("lymphoma") || lc.contains("node") { return haemLymphadenopathyEarlyForm }
        if lc.contains("anaemia") || lc.contains("anemia") || lc.contains("fatigue") || lc.contains("bleed") { return haemAnaemiaEarlyForm }
        return []
    case "Gynaecology & Obstetrics":
        if lc.contains("pregnan") || lc.contains("antenatal") || lc.contains("obstet") || lc.contains("hyperemesis") || lc.contains("pre-eclamp") { return gynaeObstetricEarlyForm }
        if lc.contains("vaginal bleed") || lc.contains("postmenop") || lc.contains("miscarriage") { return gynaeVaginalBleedEarlyForm }
        if lc.contains("pelvic") || lc.contains("ectopic") || lc.contains("ovarian") || lc.contains("fibroid") || lc.contains("pid") || lc.contains("endometrio") { return gynaePelvicPainEarlyForm }
        return []
    case "Paediatrics":
        if lc.contains("abdom") || lc.contains("vomiting") || lc.contains("intussus") || lc.contains("pyloric") { return paedAbdomEarlyForm }
        if lc.contains("fever") || lc.contains("rash") || lc.contains("child") || lc.contains("infect") || lc.contains("ear") || lc.contains("throat") { return paedFeverEarlyForm }
        return []
    case "Dermatology":
        if lc.contains("lesion") || lc.contains("melanoma") || lc.contains("mole") || lc.contains("bcc") || lc.contains("scc") || lc.contains("lump") { return dermaSkinLesionEarlyForm }
        if lc.contains("rash") || lc.contains("eczema") || lc.contains("psoriasis") || lc.contains("urticaria") || lc.contains("itch") || lc.contains("tinea") { return dermaRashEarlyForm }
        return []
    case "Psychiatry / Mental Health":
        return psychDepressionEarlyForm
    default:
        return []
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
}

