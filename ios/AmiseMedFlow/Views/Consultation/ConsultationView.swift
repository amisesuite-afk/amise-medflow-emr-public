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

// MARK: - ConsultationView

struct ConsultationView: View {
    @Bindable var patient: Patient
    var startingTab: ConsultTab = .hpi
    var embeddedInNav: Bool = false
    @Environment(\.modelContext) private var context
    @StateObject private var ai = AIService()
    @StateObject private var pipeline = ClinicalPipelineOrchestrator()

    @State private var activeTab: ConsultTab = .hpi
    @State private var examMode: ExamMode = .short
    @State private var showAddAllergy = false
    @State private var showAddMedication = false
    @State private var newAllergyName = ""
    @State private var newAllergySeverity = "Moderate"
    @State private var newAllergyReaction = ""
    @State private var triageResult: TriageResult?
    @State private var ccBayesDiff: [BayesianDiagnosisEngine.DiagnosisResult] = []
    @State private var selectedSpecialtyHint: String? = nil  // set when a CC chip is tapped
    @State private var isAssessing = false
    @State private var pathwayTask: Task<Void, Never>?
    @State private var icdQuery = ""
    @State private var icdSuggestions: [ICDCode] = []
    @State private var showAIError = false
    @State private var consultationPDFWrapper: PDFDataWrapper?
    @State private var showLetterSheet = false
    @State private var generatedLetterText = ""
    @State private var socratesSelections: [String: Set<String>] = [:]
    @State private var socratesExpandedDim: String? = "onset"
    @State private var pmhChipSelections: Set<String> = []
    @State private var pmhBypassConfirmed = false
    @State private var pshxChipSelections: Set<String> = []
    @State private var pshxBypassConfirmed = false
    @State private var fhChipSelections: Set<String> = []
    @State private var selectedSocialChips: Set<String> = []
    // PMH — medication history
    @State private var medQuery = ""
    @State private var medSuggestions: [SurgicalDrug] = []
    @State private var expandedMed: SurgicalDrug? = nil
    @State private var medDose = ""
    @State private var medRoute = "Oral"
    @State private var medFreq = "OD"
    @State private var isSuggestingMeds = false
    @State private var aiMedSuggestions: [String] = []
    @State private var newInvName = ""
    @State private var newInvCategory: InvestigationEntry.InvCategory = .blood
    @State private var criticalLabAlert: String? = nil   // non-nil triggers alert
    @State private var bayesianDx: [BayesianDiagnosisEngine.DiagnosisResult] = []
    @State private var dismissedRadiation = false
    @State private var clinicalAlarms: [ClinicalTextParser.ClinicalAlarm] = []
    @State private var dismissedAlarmIds: Set<UUID> = []
    @State private var surgicalRiskAlerts: [SurgicalRiskAlert] = []
    @State private var showCompleteEncounterConfirm = false
    @State private var showSaveEncounterConfirm = false
    @State private var encounterSavedFeedback = false
    @State private var selectedEncounter: Encounter? = nil

    enum ExamMode { case short, full }

    private var interactions: [DrugInteractionAlert] {
        DrugInteractionService.check(drugs: patient.prescriptions.map { $0.drug })
    }

    // Recompute surgical risk alerts from current state. Call whenever PMH,
    // medications, social chips, or vitals change.
    private func recomputeRisk() {
        var inputs = SurgicalRiskInputs(
            pmh: pmhChipSelections,
            medicationNames: patient.prescriptions.map { $0.drug },
            ageYears: patient.ageYears,
            bmiKgM2: patient.latestBMI(),
            socialChips: selectedSocialChips
        )
        inputs.labs = LabPanel.parse(from: patient.investigations)
        surgicalRiskAlerts = SurgicalRiskEngine.assess(inputs)
    }

    // Deterministic PMH → medication quick-picks.
    // Unions all selected PMH chips, de-dupes, excludes already-added drugs,
    // and excludes any drug the patient is allergic to (name match, case-insensitive).
    private var pmhDerivedMedSuggestions: [String] {
        let addedNames = Set(patient.prescriptions.map { $0.drug.lowercased() })
        let allergies  = patient.allergies
        var seen = Set<String>()
        var result: [String] = []
        for chip in pmhChipSelections {
            for med in pmhToCommonMeds[chip] ?? [] {
                let lower = med.lowercased()
                guard !seen.contains(lower),
                      !addedNames.contains(lower),
                      !crossClassAllergyExcludes(lower, allergies: allergies)
                else { continue }
                seen.insert(lower)
                result.append(med)
            }
        }
        return result
    }

    // Deterministic PMH → Investigations quick-suggest.
    private var pmhDerivedIxSuggestions: [(name: String, category: InvestigationEntry.InvCategory)] {
        let existing = Set(patient.investigations.map { $0.name })
        var seen = Set<String>()
        var result: [(name: String, category: InvestigationEntry.InvCategory)] = []
        for chip in pmhChipSelections {
            for inv in pmhInvestigations[chip] ?? [] {
                guard !seen.contains(inv.name), !existing.contains(inv.name) else { continue }
                seen.insert(inv.name)
                result.append(inv)
            }
        }
        return result
    }

    var body: some View {
        VStack(spacing: 0) {
            if !patient.allergies.isEmpty { allergyBanner }
            // Clinical alarm banner — fires from free text parsing
            let activeAlarms = clinicalAlarms.filter { !dismissedAlarmIds.contains($0.id) }
            if !activeAlarms.isEmpty { clinicalAlarmBanner(activeAlarms) }
            if !embeddedInNav {
                completenessBar
                tabBar
                Divider()
            }
            tabContent
        }
        .background(Color(.systemBackground))
        .onAppear {
            activeTab = startingTab
            // Advance encounter status to withDoctor the moment the doctor opens the record
            if patient.encounterStatus == .waiting || patient.encounterStatus == .notCheckedIn {
                patient.encounterStatus = .withDoctor
                patient.updatedAt = .now
                patient.pendingSync = true
                try? context.save()
            }
            // Pre-populate SOCRATES from questionnaire HPI if not yet filled
            if socratesSelections.isEmpty, let hpi = patient.hpi {
                socratesSelections = parseSocratesFromHPI(hpi)
            }
            // Pre-populate PMH chips from persisted pmhNotes (questionnaire write-back)
            if pmhChipSelections.isEmpty, let notes = patient.pmhNotes {
                pmhChipSelections = parsePMHChipsFromNotes(notes)
            }
            // P9: Pre-populate PSHx chips from persisted surgicalHistory
            if pshxChipSelections.isEmpty, let pshx = patient.surgicalHistory {
                pshxChipSelections = parsePSHxChipsFromSurgicalHistory(pshx)
            }
            // P8: Re-populate social chips so SurgicalRiskEngine sees correct state
            if selectedSocialChips.isEmpty, let social = patient.socialHistory {
                selectedSocialChips = parseSocialChipsFromHistory(social)
                recomputeRisk()
            }
            pipeline.runNow(for: patient, socratesSelections: socratesSelections)
            MRNGenerator.backfillIfNeeded(patient)
        }
        .navigationTitle("Consultation")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarBackground(Color(.systemBackground), for: .navigationBar)
        .onChange(of: activeTab) { _, tab in
            if tab == .diagnosis { refreshBayesian() }
        }
        .onChange(of: patient.workingDiagnosis) { _, _ in
            dismissedRadiation = false
        }
        .onChange(of: patient.chiefComplaint) { _, newCC in
            guard let cc = newCC, !cc.isEmpty else {
                triageResult = nil
                ccBayesDiff = []
                return
            }
            // Immediate early Bayesian differential using CC + PMH/PSHx only
            let pmhNotes  = patient.pmhEntries.map(\.condition).joined(separator: ", ")
            let pshxNotes = patient.pshxEntries.map(\.procedure).joined(separator: ", ")
            let earlyDiff = BayesianDiagnosisEngine.infer(
                chiefComplaint: cc,
                socratesSelections: [:],
                pmhNotes: pmhNotes,
                surgicalHistory: pshxNotes,
                examAbdo: nil,
                examGeneral: nil,
                investigations: [],
                ageYears: patient.ageYears,
                sex: patient.sex,
                specialtyHint: selectedSpecialtyHint
            )
            ccBayesDiff = Array(earlyDiff.prefix(4))
            // Debounced full pathway + Bayesian refresh
            pathwayTask?.cancel()
            pathwayTask = Task {
                try? await Task.sleep(nanoseconds: 800_000_000)
                guard !Task.isCancelled else { return }
                await MainActor.run { runPathway(); refreshBayesian() }
            }
        }
        .onChange(of: patient.hpi) { _, _ in
            refreshBayesian()
            pipeline.schedule(for: patient, socratesSelections: socratesSelections)
        }
        .onChange(of: patient.examGeneral) { _, _ in
            refreshBayesian()
            pipeline.schedule(for: patient, socratesSelections: socratesSelections)
        }
        .onChange(of: patient.examAbdo) { _, _ in
            refreshBayesian()
            pipeline.schedule(for: patient, socratesSelections: socratesSelections)
        }
        .onChange(of: patient.investigationsJson) { _, _ in
            refreshBayesian()
            pipeline.schedule(for: patient, socratesSelections: socratesSelections)
        }
        .onChange(of: socratesSelections) { _, _ in
            pipeline.schedule(for: patient, socratesSelections: socratesSelections)
        }
        .sheet(isPresented: $showAddAllergy) { addAllergySheet }
        .sheet(isPresented: $showAddMedication) {
            AddMedicationSheet(patient: patient, context: context)
        }
        .alert("Critical Lab Value", isPresented: Binding(
            get: { criticalLabAlert != nil },
            set: { if !$0 { criticalLabAlert = nil } }
        )) {
            Button("Acknowledged", role: .cancel) { criticalLabAlert = nil }
        } message: {
            Text((criticalLabAlert ?? "") + "\n\nNotify the doctor immediately.")
        }
        .alert("AI Error", isPresented: $showAIError) {
            Button("OK", role: .cancel) {}
        } message: { Text(ai.error ?? "Unknown error") }
        .sheet(item: $consultationPDFWrapper) { wrapper in
            ShareSheet(items: [wrapper.data as Any]).ignoresSafeArea()
        }
        .sheet(isPresented: $showLetterSheet) {
            ConsultationLetterSheet(letterText: generatedLetterText, patient: patient)
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button {
                    showSaveEncounterConfirm = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: encounterSavedFeedback ? "archivebox.fill" : "archivebox")
                        Text("Save Visit")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(encounterSavedFeedback ? Color.green : AMColor.accent)
                }
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                if patient.encounterStatus != .complete {
                    let completeness = patient.consultationCompleteness
                    Button {
                        showCompleteEncounterConfirm = true
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: completeness.filled == completeness.total
                                ? "checkmark.circle.fill" : "checkmark.circle")
                            Text("Complete")
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .foregroundStyle(completeness.filled >= 6 ? Color.green : Color(.tertiaryLabel))
                    }
                } else {
                    Label("Encounter complete", systemImage: "checkmark.seal.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.green)
                        .labelStyle(.iconOnly)
                }
            }
        }
        .confirmationDialog(completeEncounterDialogTitle,
                            isPresented: $showCompleteEncounterConfirm,
                            titleVisibility: .visible) {
            Button("Mark as Complete") {
                patient.encounterStatus = .complete
                patient.updatedAt = .now
                patient.pendingSync = true
                try? context.save()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(completeEncounterDialogMessage)
        }
        .confirmationDialog(
            "Save this visit to encounter history?",
            isPresented: $showSaveEncounterConfirm,
            titleVisibility: .visible
        ) {
            Button("Save Visit") { saveEncounter() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("A snapshot of the current clinical data will be saved to the patient's encounter history. The working record stays editable.")
        }
    }

    // MARK: - Save Encounter

    private func saveEncounter() {
        let encounter = Encounter(
            visitType: patient.visitType ?? .newConsult,
            acuity: patient.acuity,
            setting: patient.setting,
            location: patient.location
        )
        encounter.snapshot(
            from: patient,
            socratesSelections: socratesSelections,
            bayesianDx: bayesianDx
        )
        encounter.isComplete = true
        patient.encounters.append(encounter)
        context.insert(encounter)
        try? context.save()
        encounterSavedFeedback = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            encounterSavedFeedback = false
        }
    }

    // P5: Complete encounter dialog helpers
    private var completeEncounterDialogTitle: String {
        let c = patient.consultationCompleteness
        if c.filled < c.total {
            return "Complete encounter (\(c.filled)/\(c.total) items filled)?"
        }
        return "Mark encounter as complete?"
    }

    private var completeEncounterDialogMessage: String {
        let c = patient.consultationCompleteness
        if c.filled < c.total {
            let missing = incompleteConsultationItems()
            return "Missing: \(missing.joined(separator: ", ")). You can still complete the encounter — record will remain editable."
        }
        return "The encounter will be marked complete. The record remains editable."
    }

    private func incompleteConsultationItems() -> [String] {
        var missing: [String] = []
        if (patient.chiefComplaint ?? "").isEmpty { missing.append("chief complaint") }
        if (patient.hpi ?? "").isEmpty            { missing.append("HPI") }
        let hasPMH = !(patient.pmhNotes ?? "").isEmpty || !(patient.surgicalHistory ?? "").isEmpty
            || !patient.pmhEntries.isEmpty || !patient.pshxEntries.isEmpty
        if !hasPMH                                { missing.append("PMH") }
        if patient.allergies.isEmpty              { missing.append("allergies") }
        if patient.prescriptions.isEmpty          { missing.append("medications") }
        let hasExam = !(patient.examGeneral ?? "").isEmpty || !(patient.examAbdo ?? "").isEmpty
        if !hasExam                               { missing.append("examination") }
        if patient.workingDiagnosis == nil        { missing.append("working diagnosis") }
        if (patient.managementPlan ?? "").isEmpty { missing.append("management plan") }
        return missing
    }

    // MARK: - Allergy banner

    // MARK: - Surgical risk profile section

    @ViewBuilder
    private func riskAlertRow(_ alert: SurgicalRiskAlert) -> some View {
        let bandColor: Color = {
            switch alert.band {
            case .advisory:  .teal
            case .moderate:  .orange
            case .high:      Color(red: 0.85, green: 0.2, blue: 0.1)
            case .critical:  .red
            }
        }()
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: alert.domain.icon)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(bandColor)
                    .frame(width: 16)
                Text(alert.title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.primary)
                Spacer()
                Text(alert.band.label.uppercased())
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(bandColor)
                    .padding(.horizontal, 5).padding(.vertical, 2)
                    .background(bandColor.opacity(0.12), in: Capsule())
            }
            Text(alert.detail)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            HStack(alignment: .top, spacing: 4) {
                Image(systemName: "arrow.right.circle")
                    .font(.system(size: 10))
                    .foregroundStyle(bandColor)
                Text(alert.action)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 6)
    }

    private var surgicalRiskSection: some View {
        Section {
            ForEach(surgicalRiskAlerts) { alert in
                riskAlertRow(alert)
            }
        } header: {
            HStack(spacing: 6) {
                Image(systemName: "shield.lefthalf.filled.trianglebadge.exclamationmark")
                    .font(.system(size: 11, weight: .semibold))
                Text("Surgical Risk Profile")
                    .font(.system(size: 11, weight: .semibold))
                    .textCase(nil)
                Spacer()
                let maxBand = surgicalRiskAlerts.map { $0.band }.max()
                if let top = maxBand {
                    let topColor: Color = {
                        switch top {
                        case .advisory:  .teal
                        case .moderate:  .orange
                        case .high:      Color(red: 0.85, green: 0.2, blue: 0.1)
                        case .critical:  .red
                        }
                    }()
                    Text("\(surgicalRiskAlerts.count) alert\(surgicalRiskAlerts.count == 1 ? "" : "s") · \(top.label)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(topColor)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(topColor.opacity(0.12), in: Capsule())
                }
            }
            .foregroundStyle(.secondary)
        }
    }

    // MARK: - Allergy banner

    private var allergyBanner: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("ALLERGY ALERT", systemImage: "exclamationmark.triangle.fill")
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
            ForEach(patient.allergies) { a in
                HStack(spacing: 5) {
                    Circle().fill(Color(white: 1, opacity: 0.7)).frame(width: 5, height: 5)
                    Text("\(a.name)  [\(a.severity)]  — \(a.reaction)")
                        .font(.caption2).foregroundStyle(.white)
                }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background { allergyBannerBg }
    }

    // MARK: - Clinical alarm banner

    private var allergyBannerBg: Color { Color.red.opacity(0.85) }

    private func alarmBannerColor(isEmergency: Bool) -> Color {
        isEmergency ? Color.red.opacity(0.92) : Color.orange.opacity(0.88)
    }

    @ViewBuilder
    private func alarmRow(_ alarm: ClinicalTextParser.ClinicalAlarm, isLast: Bool) -> some View {
        let isEmergency = alarm.severity == .emergency
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: alarm.systemImage)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 18)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(alarm.title)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                    Text(isEmergency ? "EMERGENCY" : "CRITICAL")
                        .font(.system(size: 9, weight: .black))
                        .foregroundStyle(isEmergency ? .red : .orange)
                        .padding(.horizontal, 4).padding(.vertical, 1)
                        .background(Color.white, in: Capsule())
                }
                Text(alarm.detail)
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.9))
                Text(alarm.action)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.white.opacity(0.75))
                    .padding(.top, 1)
            }
            Spacer()
            Button {
                withAnimation(.easeOut(duration: 0.15)) {
                    _ = dismissedAlarmIds.insert(alarm.id)
                }
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.7))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14).padding(.vertical, 9)
        .background { alarmBannerColor(isEmergency: isEmergency) }
        if !isLast { Divider().background { Color(white: 1, opacity: 0.3) } }
    }

    private func clinicalAlarmBanner(_ alarms: [ClinicalTextParser.ClinicalAlarm]) -> some View {
        VStack(spacing: 0) {
            ForEach(alarms) { alarm in
                alarmRow(alarm, isLast: alarm.id == alarms.last?.id)
            }
        }
        .transition(.move(edge: .top).combined(with: .opacity))
        .animation(.easeInOut(duration: 0.2), value: alarms.count)
    }

    // MARK: - Completeness bar

    private var completenessBar: some View {
        let (filled, total) = patient.consultationCompleteness
        return HStack(spacing: 10) {
            ProgressView(value: Double(filled), total: Double(total))
                .tint(filled == total ? .green : AMColor.accent)
            Text("\(filled)/\(total)")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(filled == total ? .green : .secondary)
                .monospacedDigit()
            if filled == total {
                Image(systemName: "checkmark.seal.fill").foregroundStyle(.green).font(.caption2)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 7)
        .background(AMColor.bg)
    }

    // MARK: - Horizontal tab bar

    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                ForEach(ConsultTab.allCases, id: \.self) { tab in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { activeTab = tab }
                    } label: {
                        VStack(spacing: 0) {
                            HStack(spacing: 4) {
                                if tabFilled(tab) {
                                    Circle()
                                        .fill(activeTab == tab ? AMColor.accent : Color.green)
                                        .frame(width: 5, height: 5)
                                }
                                Text(tab.rawValue)
                                    .font(.system(size: 13, weight: activeTab == tab ? .bold : .semibold))
                                    .foregroundStyle(activeTab == tab ? AMColor.accent : AMColor.sidebarText)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 10)
                            }
                            Rectangle()
                                .fill(activeTab == tab ? AMColor.accent : Color.clear)
                                .frame(height: 2)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 4)
        }
        .background(AMColor.sidebarBg)
        .frame(height: 44)
    }

    private func tabFilled(_ tab: ConsultTab) -> Bool {
        switch tab {
        case .cc:        return !(patient.chiefComplaint ?? "").isEmpty
        case .hpi:       return !(patient.hpi ?? "").isEmpty
        case .pmh:       return !(patient.pmhNotes ?? "").isEmpty || !patient.pmhEntries.isEmpty
        case .pshx:      return !(patient.surgicalHistory ?? "").isEmpty || !patient.pshxEntries.isEmpty
        case .meds:      return !patient.prescriptions.isEmpty
        case .allergies: return !patient.allergies.isEmpty
        case .social:    return !(patient.socialHistory ?? "").isEmpty
        case .exam:           return !(patient.examGeneral ?? "").isEmpty || !(patient.examAbdo ?? "").isEmpty
        case .investigations: return !patient.investigations.isEmpty
        case .diagnosis:      return patient.workingDiagnosis != nil
        case .plan:      return !(patient.managementPlan ?? "").isEmpty
        case .history:   return !patient.encounters.isEmpty
        }
    }

    // MARK: - Tab content dispatch

    @ViewBuilder
    private var tabContent: some View {
        switch activeTab {
        case .cc:        ccTab
        case .hpi:       hpiTab
        case .pmh:       pmhTab
        case .pshx:      pshxTab
        case .meds:      List { medicationsSection }
        case .allergies: allergiesTab
        case .social:    socialTab
        case .exam:           examTab
        case .investigations: investigationsTab
        case .diagnosis:      diagnosisTab
        case .plan:      planTab
        case .history:   encounterHistoryTab
        }
    }

    // MARK: - CC tab

    private var selectedChipLabel: String? {
        let cc = patient.chiefComplaint ?? ""
        return ccSpecialtyGroups.flatMap(\.chips).first(where: { $0.label == cc })?.label
    }

    private var ccTab: some View {
        List {
            // Patient identity + free-text input
            Section {
                HStack(spacing: 6) {
                    Image(systemName: "person.text.rectangle")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let mrn = patient.mrn, !mrn.isEmpty {
                        Text(mrn)
                            .font(.system(.caption, design: .monospaced).weight(.medium))
                            .foregroundStyle(.secondary)
                    } else {
                        Text("Assigning MRN…")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                    Spacer()
                    Text("\(patient.encounters.filter(\.isComplete).count) saved visit(s)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                if let vt = patient.visitType {
                    HStack(spacing: 6) {
                        Image(systemName: vt.icon).foregroundStyle(AMColor.accent)
                        Text(vt.rawValue)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AMColor.accent)
                        Spacer()
                        Text("Visit type").font(.caption2).foregroundStyle(.tertiary)
                    }
                }
                // Free-text override
                TextField("Type a complaint or select below…",
                          text: Binding(get: { patient.chiefComplaint ?? "" },
                                        set: { patient.chiefComplaint = $0.isEmpty ? nil : $0; selectedSpecialtyHint = nil; touch() }),
                          axis: .vertical)
                    .font(.callout)
                    .lineLimit(3...)
                if isAssessing {
                    HStack(spacing: 8) {
                        ProgressView().scaleEffect(0.8)
                        Text("Analysing pathway…").font(.caption).foregroundStyle(.secondary)
                    }
                }
            } header: {
                sectionHeader("Chief Complaint", icon: "person.fill.questionmark",
                              filled: !(patient.chiefComplaint ?? "").isEmpty)
            }

            // Inline Bayesian early differential
            if !ccBayesDiff.isEmpty {
                ccBayesDifferentialSection
            }

            // Pathway result
            if let result = triageResult { pathwayResult(result) }

            // Specialty-grouped complaint sections
            ForEach(ccSpecialtyGroups) { group in
                Section {
                    ForEach(group.chips) { chip in
                        let isSelected = selectedChipLabel == chip.label
                        Button {
                            patient.chiefComplaint = chip.label
                            selectedSpecialtyHint = group.name
                            touch()
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: chip.icon)
                                    .font(.system(size: 11))
                                    .foregroundStyle(isSelected ? AMColor.accent : .secondary)
                                    .frame(width: 16)
                                Text(chip.label)
                                    .font(.callout.weight(isSelected ? .semibold : .regular))
                                    .foregroundStyle(.primary)
                                Spacer()
                                if isSelected {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundStyle(AMColor.accent)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Label(group.name, systemImage: group.icon)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .textCase(nil)
                }
            }
        }
    }

    // MARK: - CC Bayesian differential (early, CC-only signal)

    @ViewBuilder private var ccBayesDifferentialSection: some View {
        Section {
            ForEach(ccBayesDiff.prefix(4), id: \.name) { dx in
                HStack(spacing: 8) {
                    // Urgency left stripe: amber=urgent, red=emergency, deep red=critical
                    if dx.urgency > 0 {
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(urgencyColor(dx.urgency))
                            .frame(width: 3)
                            .frame(minHeight: 36)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(dx.name)
                            .font(.subheadline.weight(.medium))
                        Text(dx.icdCode)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                        if dx.urgency > 0 {
                            Text(urgencyLabel(dx.urgency))
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(urgencyColor(dx.urgency))
                        }
                    }
                    Spacer()
                    // Probability bar + label
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.secondary.opacity(0.15))
                            .frame(width: 60, height: 6)
                        Capsule()
                            .fill(bayesColor(dx.confidence))
                            .frame(width: max(4, CGFloat(dx.probability) / 100 * 60), height: 6)
                    }
                    Text("\(dx.probability)%")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(bayesColor(dx.confidence))
                        .frame(width: 34, alignment: .trailing)
                }
            }
        } header: {
            Label("Early Differential — tap to confirm", systemImage: "wand.and.stars")
                .font(.caption.weight(.semibold))
                .foregroundStyle(AMColor.accent)
                .textCase(nil)
        } footer: {
            Text("Based on chief complaint + PMH only. Colour stripe = urgency tier. Refines as you add more evidence.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    private func bayesColor(_ c: DiagnosisResult.Confidence) -> Color {
        switch c {
        case .certain:  return .red
        case .high:     return .orange
        case .moderate: return AMColor.accent
        case .low:      return .secondary
        }
    }

    private func urgencyColor(_ level: Int) -> Color {
        switch level {
        case 3: return Color(red: 0.72, green: 0.0, blue: 0.0)
        case 2: return .red
        case 1: return .orange
        default: return .clear
        }
    }

    private func urgencyLabel(_ level: Int) -> String {
        switch level {
        case 3: return "⚠ CRITICAL"
        case 2: return "⚠ EMERGENCY"
        case 1: return "URGENT"
        default: return ""
        }
    }

    // MARK: - Specialty Early Form

    /// Renders targeted clinical flag chips above the SOCRATES builder when a focused
    /// specialty CC is selected. Chips pre-populate socratesSelections, feeding directly
    /// into the Bayesian scorer without requiring SOCRATES to be re-opened.
    @ViewBuilder
    private var specialtyEarlyFormSection: some View {
        let hint = selectedSpecialtyHint ?? ""
        let cc   = patient.chiefComplaint ?? ""
        let groups = specialtyEarlyFormGroups(hint: hint, cc: cc)
        if !groups.isEmpty {
            Section {
                ForEach(groups) { group in
                    VStack(alignment: .leading, spacing: 6) {
                        Label(group.question, systemImage: group.icon)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.secondary)
                        ChipFlow(hSpacing: 7, vSpacing: 7) {
                            ForEach(group.chips) { chip in
                                let isSelected = (socratesSelections[chip.dimId] ?? []).contains(chip.value)
                                Button {
                                    toggleSOCRATES(dimId: chip.dimId, chip: chip.value, multiSelect: chip.multiSelect)
                                } label: {
                                    Text(chip.label)
                                        .font(.system(size: 12, weight: isSelected ? .semibold : .regular))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 5)
                                        .background(isSelected ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                        .foregroundStyle(isSelected ? Color.white : AMColor.accent)
                                        .animation(.easeInOut(duration: 0.12), value: isSelected)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            } header: {
                Label("Quick Clinical Flags — \(hint)", systemImage: "staroflife.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AMColor.accent)
                    .textCase(nil)
            } footer: {
                Text("Chips feed the Bayesian scorer directly. Tap to select — findings also appear in SOCRATES.")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    // MARK: - HPI tab (SOCRATES chip builder)

    // Chip sets re-evaluated whenever the CC changes
    private var adaptedSocrateDimensions: [SOCRATESDimension] {
        socrateDimensions(for: patient.chiefComplaint ?? "")
    }

    // MARK: - Exam adaptive chips

    private var primaryExamLabel: String {
        let lc = (patient.chiefComplaint ?? "").lowercased()
        if lc.contains("neck") || lc.contains("thyroid") || lc.contains("goitre") || lc.contains("lymph") || lc.contains("goiter") { return "Neck Examination" }
        if lc.contains("breast") || lc.contains("nipple") || lc.contains("mastalgia") { return "Breast Examination" }
        if (lc.contains("chest") && lc.contains("pain")) || lc.contains("angina") || lc.contains("palpitation") { return "Chest / Cardiac" }
        if lc.contains("hernia") || lc.contains("inguinal") || lc.contains("femoral") || lc.contains("groin") { return "Groin / Hernia" }
        if lc.contains("dysphagia") || lc.contains("swallow") { return "Oropharynx / Neck" }
        if lc.contains("perianal") || lc.contains("anal") || lc.contains("haemorrhoid") || lc.contains("hemorrhoid") || lc.contains("rectal") || lc.contains("fissure") || lc.contains("fistula") { return "Perianal / PR Examination" }
        if lc.contains("skin") || lc.contains("mole") || lc.contains("melanoma") || lc.contains("lesion") || lc.contains("lipoma") { return "Skin Lesion" }
        if lc.contains("scrotum") || lc.contains("testicular") || lc.contains("testicle") || lc.contains("orchit") || lc.contains("hydrocele") || lc.contains("scrotal") { return "Scrotal / Testicular" }
        if lc.contains("haematuria") || lc.contains("urinary") || lc.contains("retention") || lc.contains("prostate") { return "Renal / Urological" }
        if lc.contains("parotid") || lc.contains("salivary") { return "Salivary Gland / Jaw" }
        return "Abdomen"
    }

    private var primaryExamChips: [String] {
        let lc = (patient.chiefComplaint ?? "").lowercased()
        if lc.contains("neck") || lc.contains("thyroid") || lc.contains("goitre") || lc.contains("lymph") || lc.contains("goiter") {
            return ["Mobile, non-tender.", "Fixed to deep tissue.", "Moves on swallowing.", "Pulsatile; bruit present.", "Hard and irregular.", "Smooth and soft.", "Tender.", "Non-tender.", "Thyroid diffusely enlarged.", "Single nodule.", "Multiple nodes palpable.", "No palpable lymphadenopathy."]
        }
        if lc.contains("breast") || lc.contains("nipple") || lc.contains("mastalgia") {
            return ["Mobile, non-tender.", "Fixed to overlying skin.", "Fixed to pectoral muscle.", "Irregular, hard.", "Smooth, soft.", "Nipple inversion.", "Skin dimpling / peau d'orange.", "Axillary nodes palpable.", "Axillary nodes not palpable.", "Nipple discharge.", "No skin changes."]
        }
        if (lc.contains("chest") && lc.contains("pain")) || lc.contains("angina") || lc.contains("palpitation") {
            return ["No chest wall tenderness.", "Reproducible on palpation.", "Apex beat non-displaced.", "Bilateral air entry.", "No peripheral oedema.", "Peripheral pulses present.", "JVP not elevated."]
        }
        if lc.contains("hernia") || lc.contains("inguinal") || lc.contains("femoral") || lc.contains("groin") {
            return ["Cough impulse present.", "Reducible.", "Irreducible.", "Above inguinal ligament.", "Below inguinal ligament.", "Extending into scrotum.", "Transilluminates.", "No transillumination.", "Tender on palpation.", "Soft, easily reducible."]
        }
        if lc.contains("dysphagia") || lc.contains("swallow") {
            return ["Oropharynx clear.", "No neck mass.", "Moves on swallowing.", "Cervical lymphadenopathy.", "Voice normal on exam.", "Hoarse voice."]
        }
        if lc.contains("perianal") || lc.contains("anal") || lc.contains("haemorrhoid") || lc.contains("hemorrhoid") || lc.contains("rectal") || lc.contains("fissure") || lc.contains("fistula") {
            return ["Perianal skin normal.", "External haemorrhoids visible.", "Perianal erythema.", "Fluctuant perianal mass.", "Skin tag.", "External fistula opening.", "Posterior midline fissure.", "Normal rectal tone on DRE.", "Tender on DRE.", "Blood on glove.", "Mucosa normal on PR."]
        }
        if lc.contains("skin") || lc.contains("mole") || lc.contains("melanoma") || lc.contains("lesion") || lc.contains("lipoma") {
            return ["Well-defined border.", "Ill-defined border.", "Pigmented lesion.", "Non-pigmented.", "Raised >2 mm.", "Flat.", "Ulcerated.", "Smooth surface.", "Regional nodes not palpable.", "Regional nodes enlarged.", "Satellite lesions."]
        }
        if lc.contains("scrotum") || lc.contains("testicular") || lc.contains("testicle") || lc.contains("orchit") || lc.contains("hydrocele") || lc.contains("scrotal") {
            return ["Tender testis.", "Non-tender.", "Transilluminates (hydrocele).", "No transillumination.", "Warm and erythematous.", "Normal cremasteric reflex.", "Absent cremasteric reflex.", "Epididymal cyst.", "Scrotal oedema.", "Mass separate from testis."]
        }
        if lc.contains("haematuria") || lc.contains("urinary") || lc.contains("retention") || lc.contains("prostate") {
            return ["No renal angle tenderness.", "Right renal angle tender.", "Left renal angle tender.", "Bladder palpable to umbilicus.", "Suprapubic tenderness.", "Prostate smooth, not enlarged (DRE).", "Prostate enlarged, benign (DRE).", "Prostate hard, irregular (DRE)."]
        }
        if lc.contains("parotid") || lc.contains("salivary") {
            return ["Soft, mobile.", "Firm, fixed.", "Tender.", "Non-tender.", "Facial nerve intact.", "Bimanual — stone palpable.", "No stone palpable.", "Erythema overlying skin."]
        }
        return ["Soft, non-tender.", "Tender RUQ.", "Tender RLQ.", "Guarding.", "Rigidity.", "Murphy's +ve.", "Bowel sounds normal.", "No organomegaly.", "Hepatomegaly.", "Distended."]
    }

    private var primaryCVSChips: [String] {
        let lc = (patient.chiefComplaint ?? "").lowercased()
        if (lc.contains("chest") && lc.contains("pain")) || lc.contains("angina") || lc.contains("palpitation") || lc.contains("cardiac") {
            return ["Regular rate and rhythm.", "Irregular (AF).", "Dual heart sounds.", "Systolic murmur.", "Ejection systolic murmur.", "S3 gallop.", "Elevated JVP.", "Pitting oedema ankles.", "Peripheral pulses present bilaterally.", "Absent left radial pulse."]
        }
        return ["Regular rate and rhythm. No murmurs.", "Dual heart sounds.", "Systolic murmur.", "Pitting oedema ankles.", "Elevated JVP."]
    }

    private var hpiTab: some View {
        List {
            // Specialty early form: targeted discriminating chips before full SOCRATES
            specialtyEarlyFormSection

            // SOCRATES builder accordion
            Section {
                ForEach(adaptedSocrateDimensions) { dim in
                    socratesDimRow(dim)
                }
            } header: {
                let filled = adaptedSocrateDimensions.filter { !(socratesSelections[$0.id] ?? []).isEmpty }.count
                HStack {
                    Label("SOCRATES Builder", systemImage: "square.grid.2x2")
                    Spacer()
                    Text("\(filled)/\(adaptedSocrateDimensions.count)")
                        .font(.caption.weight(.semibold).monospacedDigit())
                        .foregroundStyle(filled == adaptedSocrateDimensions.count ? .green : .secondary)
                }
            }

            // Live preview + apply
            if let preview = socratesPreview {
                Section {
                    Text(preview)
                        .font(.callout)
                        .foregroundStyle(.primary)
                        .padding(.vertical, 4)
                    Button {
                        patient.hpi = preview; touch()
                    } label: {
                        Label("Apply to HPI", systemImage: "checkmark.circle.fill")
                    }
                    .foregroundStyle(AMColor.accent)
                } header: {
                    Label("Preview", systemImage: "text.viewfinder")
                }
            }

            // Manual / AI fallback
            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.hpi ?? "" },
                                            set: { patient.hpi = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 140)
                        .medicalDictation(mode: .hpi, patient: patient,
                                          text: Binding(get: { patient.hpi ?? "" },
                                                        set: { patient.hpi = $0.isEmpty ? nil : $0; touch() }))
                    if (patient.hpi ?? "").isEmpty {
                        Text("Committed HPI will appear here — or type directly")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
                Button {
                    Task { await draftHPI() }
                } label: {
                    HStack {
                        Label("AI Draft HPI", systemImage: "sparkles")
                        Spacer()
                        if ai.isGenerating { ProgressView() }
                    }
                }
                .disabled(ai.isGenerating || (patient.chiefComplaint ?? "").isEmpty)
                .foregroundStyle(.purple)
            } header: {
                sectionHeader("HPI Text", icon: "text.bubble",
                              filled: !(patient.hpi ?? "").isEmpty)
            }
        }
    }

    // MARK: - SOCRATES dimension accordion row

    @ViewBuilder
    private func socratesDimRow(_ dim: SOCRATESDimension) -> some View {
        let selections = socratesSelections[dim.id] ?? []
        let isExpanded = socratesExpandedDim == dim.id

        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.18)) {
                    socratesExpandedDim = isExpanded ? nil : dim.id
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: dim.icon)
                        .foregroundStyle(selections.isEmpty ? .secondary : AMColor.accent)
                        .frame(width: 20, alignment: .center)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(dim.title)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.primary)
                        if !selections.isEmpty {
                            Text(selections.sorted().joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(AMColor.accent)
                                .lineLimit(1)
                        } else if !isExpanded {
                            Text(dim.question)
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    Spacer()
                    if !selections.isEmpty {
                        Text("\(selections.count)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 18, height: 18)
                            .background(AMColor.accent, in: Circle())
                    }
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                }
                .padding(.vertical, 6)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(dim.chips, id: \.self) { chip in
                        let isSelected = selections.contains(chip)
                        Button {
                            toggleSOCRATES(dimId: dim.id, chip: chip, multiSelect: dim.multiSelect)
                        } label: {
                            Text(chip)
                                .font(.system(size: 12, weight: isSelected ? .semibold : .regular))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(isSelected ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                .foregroundStyle(isSelected ? Color.white : AMColor.accent)
                                .animation(.easeInOut(duration: 0.12), value: isSelected)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.top, 10)
                .padding(.bottom, 4)
            }
        }
    }

    // MARK: - SOCRATES chip toggle + auto-advance

    private func toggleSOCRATES(dimId: String, chip: String, multiSelect: Bool) {
        var current = socratesSelections[dimId] ?? []
        if multiSelect {
            if current.contains(chip) { current.remove(chip) } else { current.insert(chip) }
        } else {
            current = current.contains(chip) ? [] : [chip]
        }
        socratesSelections[dimId] = current

        // Auto-advance to next dim on single-select
        if !multiSelect && !current.isEmpty {
            let ids = adaptedSocrateDimensions.map(\.id)
            if let idx = ids.firstIndex(of: dimId), idx + 1 < ids.count {
                withAnimation(.easeInOut(duration: 0.18)) { socratesExpandedDim = ids[idx + 1] }
            }
        }
    }

    // MARK: - HPI prose generation from SOCRATES chips

    private var socratesPreview: String? {
        guard adaptedSocrateDimensions.contains(where: { !(socratesSelections[$0.id] ?? []).isEmpty }) else { return nil }
        return buildHpiProse()
    }

    private func buildHpiProse() -> String {
        let cc   = patient.chiefComplaint ?? "presenting complaint"
        let onset = (socratesSelections["onset"] ?? []).first ?? ""
        let sites = (socratesSelections["site"] ?? []).sorted()
        let chars = (socratesSelections["character"] ?? []).sorted()
        let rad   = socratesSelections["radiation"]?.first
        let assoc = (socratesSelections["associations"] ?? []).sorted()
        let timing = (socratesSelections["timing"] ?? []).sorted()
        let exc   = (socratesSelections["exacerbating"] ?? []).sorted()
        let rel   = (socratesSelections["relieving"] ?? []).sorted()
        let sev   = socratesSelections["severity"]?.first

        var parts: [String] = []

        // Opening sentence
        var open = patient.fullName
        if patient.ageYears > 0 {
            open += ", a \(patient.ageYears)-year-old \(patient.sex.rawValue.lowercased()),"
        }
        open += " presents with \(cc)"
        if !onset.isEmpty { open += " of \(onset.lowercased()) duration" }
        open += "."
        parts.append(open)

        // Character + site
        if !chars.isEmpty || !sites.isEmpty {
            var s = "The \(cc)"
            if !chars.isEmpty { s += " is \(joinList(chars.map { $0.lowercased() })) in character" }
            if !sites.isEmpty { s += (chars.isEmpty ? " is" : ",") + " localised to the \(joinList(sites))" }
            parts.append(s + ".")
        }

        // Radiation
        if let r = rad, r != "No radiation" {
            parts.append("The pain radiates to the \(r.lowercased()).")
        }

        // Timing
        if !timing.isEmpty {
            parts.append("Symptoms are \(joinList(timing.map { $0.lowercased() })) in nature.")
        }

        // Associations
        if !assoc.isEmpty {
            parts.append("Associated symptoms include \(joinList(assoc.map { $0.lowercased() })).")
        }

        // Exacerbating
        if !exc.isEmpty {
            parts.append("Symptoms are exacerbated by \(joinList(exc.map { $0.lowercased() })).")
        }

        // Relieving
        let relFiltered = rel.filter { $0 != "Nothing" }
        if !relFiltered.isEmpty {
            parts.append("Relief is obtained with \(joinList(relFiltered.map { $0.lowercased() })).")
        }

        // Severity
        if let s = sev {
            parts.append("Severity is rated as \(s.lowercased()).")
        }

        return parts.joined(separator: " ")
    }

    private func joinList(_ items: [String]) -> String {
        switch items.count {
        case 0: return ""
        case 1: return items[0]
        case 2: return "\(items[0]) and \(items[1])"
        default: return items.dropLast().joined(separator: ", ") + ", and \(items.last!)"
        }
    }

    // MARK: - PMH tab

    // MARK: - PMH medications section

    private var medicationsSection: some View {
        Section {
            // PMH-derived quick-picks — deterministic, no AI
            let pmhMeds = pmhDerivedMedSuggestions
            if !pmhMeds.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Label("From your PMH — tap to add", systemImage: "cross.case")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(pmhMeds, id: \.self) { name in
                                Button {
                                    let match = ClinicalSearchService.searchDrugs(name).first
                                    if let drug = match {
                                        medQuery = drug.name
                                        expandedMed = drug
                                        medDose = drug.commonDoses
                                        medRoute = drug.route
                                        medFreq = "OD"
                                        medSuggestions = []
                                    } else {
                                        addMedicationEntry(name: name, dose: "", route: "Oral", freq: "OD")
                                    }
                                } label: {
                                    Text(name)
                                        .font(.caption.weight(.medium))
                                        .padding(.horizontal, 10).padding(.vertical, 5)
                                        .background(AMColor.accentLt, in: Capsule())
                                        .foregroundStyle(AMColor.accent)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.vertical, 2)
            }

            // Drug search field
            HStack(spacing: 8) {
                Image(systemName: "pills").foregroundStyle(.secondary)
                TextField("Search medication…", text: $medQuery)
                    .autocorrectionDisabled()
                    .onChange(of: medQuery) { _, q in
                        medSuggestions = q.count >= 2 ? ClinicalSearchService.searchDrugs(q) : []
                        if expandedMed != nil && expandedMed?.name.lowercased() != q.lowercased() {
                            expandedMed = nil
                        }
                    }
                if !medQuery.isEmpty {
                    Button { medQuery = ""; medSuggestions = []; expandedMed = nil } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                    }.buttonStyle(.plain)
                }
            }

            // Drug suggestion list
            ForEach(medSuggestions.prefix(6)) { drug in
                Button {
                    medQuery  = drug.name
                    expandedMed = drug
                    medDose   = drug.commonDoses
                    medRoute  = drug.route
                    medFreq   = "OD"
                    medSuggestions = []
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(drug.name).font(.subheadline).foregroundStyle(.primary)
                            Text(drug.category).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(drug.commonDoses).font(.caption2).foregroundStyle(.tertiary)
                    }
                }.buttonStyle(.plain)
            }

            // Inline dose/route/frequency submenu
            if let drug = expandedMed {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Label(drug.name, systemImage: "pill.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AMColor.accent)
                        Spacer()
                        Button { expandedMed = nil; medQuery = "" } label: {
                            Image(systemName: "xmark").font(.caption)
                        }.buttonStyle(.plain).foregroundStyle(.secondary)
                    }

                    // Dose
                    VStack(alignment: .leading, spacing: 4) {
                        Text("DOSE").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                        HStack(spacing: 6) {
                            TextField("e.g. 500 mg", text: $medDose)
                                .font(.callout)
                                .frame(maxWidth: .infinity)
                            if !drug.commonDoses.isEmpty && medDose != drug.commonDoses {
                                Button(drug.commonDoses) { medDose = drug.commonDoses }
                                    .font(.caption2).buttonStyle(.bordered).tint(.teal)
                            }
                        }
                    }

                    // Route chips
                    VStack(alignment: .leading, spacing: 4) {
                        Text("ROUTE").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(["Oral","IV","IM","SC","Topical","Inhaled","PR","SL"], id: \.self) { r in
                                    let sel = medRoute == r
                                    Button(r) { medRoute = r }
                                        .font(.caption2.weight(sel ? .semibold : .regular))
                                        .padding(.horizontal, 8).padding(.vertical, 3)
                                        .background(sel ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                        .foregroundStyle(sel ? .white : AMColor.accent)
                                        .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    // Frequency chips
                    VStack(alignment: .leading, spacing: 4) {
                        Text("FREQUENCY").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(["OD","BD","TDS","QDS","PRN","STAT","Nocte","Weekly"], id: \.self) { f in
                                    let sel = medFreq == f
                                    Button(f) { medFreq = f }
                                        .font(.caption2.weight(sel ? .semibold : .regular))
                                        .padding(.horizontal, 8).padding(.vertical, 3)
                                        .background(sel ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                        .foregroundStyle(sel ? .white : AMColor.accent)
                                        .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    if !drug.notes.isEmpty {
                        Text(drug.notes).font(.caption.italic()).foregroundStyle(.secondary)
                    }

                    Button {
                        addMedicationEntry(name: drug.name, dose: medDose, route: medRoute, freq: medFreq)
                        expandedMed = nil; medQuery = ""; medDose = ""; medRoute = "Oral"; medFreq = "OD"
                    } label: {
                        Label("Add to current medications", systemImage: "plus.circle.fill")
                            .font(.callout.weight(.semibold))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(AMColor.accent)
                }
                .padding(.vertical, 4)
            }

            // AI suggestions
            if !aiMedSuggestions.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Label("AI Suggestions — tap to add", systemImage: "brain")
                        .font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    ForEach(aiMedSuggestions, id: \.self) { name in
                        Button {
                            let match = ClinicalSearchService.searchDrugs(name).first
                            if let drug = match {
                                medQuery = drug.name; expandedMed = drug
                                medDose = drug.commonDoses; medRoute = drug.route; medFreq = "OD"
                            } else {
                                addMedicationEntry(name: name, dose: "", route: "Oral", freq: "OD")
                            }
                            aiMedSuggestions.removeAll { $0 == name }
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "plus.circle").foregroundStyle(AMColor.accent)
                                Text(name).font(.callout)
                                Spacer()
                            }
                        }.buttonStyle(.plain)
                    }
                }
            }

            // AI Suggest Medications — on hold (HIPAA compliance)
            // Button hidden; re-enable when clinical AI clearance is in place.

            // Current medication list
            if !patient.prescriptions.isEmpty {
                Divider()
                let sortedRx = patient.prescriptions.sorted { $0.prescribedAt > $1.prescribedAt }
                ForEach(sortedRx) { rx in
                    HStack(spacing: 10) {
                        Image(systemName: "pill")
                            .font(.system(size: 11))
                            .foregroundStyle(AMColor.accent)
                            .frame(width: 16)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(rx.drug).font(.callout.weight(.semibold))
                            Text(rx.displayLine)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(rx.prescribedAt.formatted(.dateTime.month(.abbreviated).year()))
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.tertiary)
                    }
                }
                .onDelete { idxSet in
                    for i in idxSet { context.delete(sortedRx[i]) }
                    touch()
                }
            }
        } header: {
            sectionHeader("Medications", icon: "pills",
                          filled: !patient.prescriptions.isEmpty)
        }
    }

    private var pmhTab: some View {
        List {
            // Structured entries — one row per condition
            if !patient.pmhEntries.isEmpty {
                Section {
                    ForEach(patient.pmhEntries.indices, id: \.self) { i in
                        pmhEntryRow(index: i)
                    }
                    .onDelete { idxSet in
                        var list = patient.pmhEntries
                        list.remove(atOffsets: idxSet)
                        patient.pmhEntries = list
                        touch()
                    }
                } header: {
                    sectionHeader("Medical History (\(patient.pmhEntries.count))",
                                  icon: "stethoscope", filled: true)
                }
            }

            Section {
                // Bypass card — PMH already on record
                if !(patient.pmhNotes ?? "").isEmpty && !pmhBypassConfirmed {
                    historyBypassCard(
                        title: "PMH already on record",
                        subtitle: "Still accurate for this encounter?",
                        onConfirm: { pmhBypassConfirmed = true }
                    )
                }

                // NKPMH quick-set
                Button {
                    patient.pmhNotes = "No known past medical history (NKPMH)"
                    pmhChipSelections = []
                    pmhBypassConfirmed = true
                    touch()
                } label: {
                    Label("No known PMH (NKPMH)", systemImage: "checkmark.shield")
                        .font(.subheadline)
                        .foregroundStyle(.green)
                }
                .buttonStyle(.plain)

                // Condition list
                ForEach(pmhChips, id: \.self) { chip in
                    let sel = pmhChipSelections.contains(chip)
                    Button {
                        pmhChipSelections.formSymmetricDifference([chip])
                        recomputeRisk()
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: sel ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 13))
                                .foregroundStyle(sel ? AMColor.accent : Color.secondary)
                            Text(chip)
                                .font(.callout.weight(sel ? .semibold : .regular))
                                .foregroundStyle(.primary)
                            Spacer()
                        }
                    }.buttonStyle(.plain)
                }

                // Apply button
                if !pmhChipSelections.isEmpty {
                    Button {
                        appendHistory(existing: patient.pmhNotes, chips: pmhChipSelections) {
                            patient.pmhNotes = $0
                        }
                        // Create structured entries for each new condition
                        var entries = patient.pmhEntries
                        for chip in pmhChipSelections.sorted() {
                            if !entries.contains(where: { $0.condition == chip }) {
                                entries.append(PMHEntry(condition: chip))
                            }
                        }
                        patient.pmhEntries = entries
                        pmhChipSelections = []
                        pmhBypassConfirmed = true
                        touch()
                    } label: {
                        Label("Append \(pmhChipSelections.count) condition\(pmhChipSelections.count == 1 ? "" : "s") to PMH Notes",
                              systemImage: "plus.circle.fill")
                    }
                    .foregroundStyle(AMColor.accent)
                }

                // Manual text editor
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.pmhNotes ?? "" },
                                            set: { patient.pmhNotes = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 100)
                    if (patient.pmhNotes ?? "").isEmpty {
                        Text("Free-text PMH — or tick conditions above")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Past Medical History", icon: "clock.arrow.circlepath",
                              filled: !(patient.pmhNotes ?? "").isEmpty)
            }

            // Surgical risk profile — reactive to PMH chips, medications, age, BMI, social
            if !surgicalRiskAlerts.isEmpty {
                surgicalRiskSection
            }

            Section {
                ForEach(familyHistoryChips, id: \.self) { chip in
                    let sel = fhChipSelections.contains(chip)
                    Button { fhChipSelections.formSymmetricDifference([chip]) } label: {
                        HStack(spacing: 10) {
                            Image(systemName: sel ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 13))
                                .foregroundStyle(sel ? AMColor.accent : Color.secondary)
                            Text(chip)
                                .font(.callout.weight(sel ? .semibold : .regular))
                                .foregroundStyle(.primary)
                            Spacer()
                        }
                    }.buttonStyle(.plain)
                }

                if !fhChipSelections.isEmpty {
                    Button {
                        appendHistory(existing: patient.familyHistoryNotes, chips: fhChipSelections) {
                            patient.familyHistoryNotes = $0
                        }
                        fhChipSelections = []
                        touch()
                    } label: {
                        Label("Append \(fhChipSelections.count) item\(fhChipSelections.count == 1 ? "" : "s") to Family History",
                              systemImage: "plus.circle.fill")
                    }
                    .foregroundStyle(AMColor.accent)
                }

                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.familyHistoryNotes ?? "" },
                                            set: { patient.familyHistoryNotes = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 80)
                    if (patient.familyHistoryNotes ?? "").isEmpty {
                        Text("Free-text — or tick conditions above")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Family History", icon: "person.2",
                              filled: !(patient.familyHistoryNotes ?? "").isEmpty)
            }
        }
    }

    // MARK: - PSHx tab

    private var pshxTab: some View {
        List {
            // Structured entries — one row per procedure
            if !patient.pshxEntries.isEmpty {
                Section {
                    ForEach(patient.pshxEntries.indices, id: \.self) { i in
                        pshxEntryRow(index: i)
                    }
                    .onDelete { idxSet in
                        var list = patient.pshxEntries
                        list.remove(atOffsets: idxSet)
                        patient.pshxEntries = list
                        touch()
                    }
                } header: {
                    sectionHeader("Surgical History (\(patient.pshxEntries.count))",
                                  icon: "scissors", filled: true)
                }
            }

            Section {
                // Bypass card
                if !(patient.surgicalHistory ?? "").isEmpty && !pshxBypassConfirmed {
                    historyBypassCard(
                        title: "Surgical history already on record",
                        subtitle: "Still accurate for this encounter?",
                        onConfirm: { pshxBypassConfirmed = true }
                    )
                }

                // No prior surgery quick-set
                Button {
                    patient.surgicalHistory = "No previous surgical history"
                    pshxChipSelections = []
                    pshxBypassConfirmed = true
                    touch()
                } label: {
                    Label("No previous surgical history", systemImage: "checkmark.shield")
                        .font(.subheadline)
                        .foregroundStyle(.green)
                }
                .buttonStyle(.plain)

                // Procedure list
                ForEach(pshxChips, id: \.self) { chip in
                    let sel = pshxChipSelections.contains(chip)
                    Button { pshxChipSelections.formSymmetricDifference([chip]) } label: {
                        HStack(spacing: 10) {
                            Image(systemName: sel ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 13))
                                .foregroundStyle(sel ? AMColor.accent : Color.secondary)
                            Text(chip)
                                .font(.callout.weight(sel ? .semibold : .regular))
                                .foregroundStyle(.primary)
                            Spacer()
                        }
                    }.buttonStyle(.plain)
                }

                // Apply button
                if !pshxChipSelections.isEmpty {
                    Button {
                        appendHistory(existing: patient.surgicalHistory, chips: pshxChipSelections) {
                            patient.surgicalHistory = $0
                        }
                        // Create structured entries for each new procedure
                        var entries = patient.pshxEntries
                        for chip in pshxChipSelections.sorted() {
                            if !entries.contains(where: { $0.procedure == chip }) {
                                entries.append(PSHxEntry(procedure: chip))
                            }
                        }
                        patient.pshxEntries = entries
                        pshxChipSelections = []
                        pshxBypassConfirmed = true
                        touch()
                    } label: {
                        Label("Append \(pshxChipSelections.count) procedure\(pshxChipSelections.count == 1 ? "" : "s") to Surgical History",
                              systemImage: "plus.circle.fill")
                    }
                    .foregroundStyle(AMColor.accent)
                }

                // Manual text editor
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.surgicalHistory ?? "" },
                                            set: { patient.surgicalHistory = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 120)
                    if (patient.surgicalHistory ?? "").isEmpty {
                        Text("Previous operations, procedures, anaesthetic history, complications…")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Past Surgical History", icon: "scissors",
                              filled: !(patient.surgicalHistory ?? "").isEmpty)
            }
        }
    }

    // MARK: - Structured history entry rows

    @ViewBuilder
    private func pmhEntryRow(index i: Int) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "stethoscope")
                .font(.system(size: 11))
                .foregroundStyle(AMColor.accent)
                .frame(width: 16)
            Text(i < patient.pmhEntries.count ? patient.pmhEntries[i].condition : "")
                .font(.callout)
                .foregroundStyle(.primary)
            Spacer()
            TextField("Year", text: Binding(
                get: { i < patient.pmhEntries.count ? patient.pmhEntries[i].yearText : "" },
                set: { v in
                    guard i < patient.pmhEntries.count else { return }
                    var list = patient.pmhEntries
                    list[i].yearText = v
                    patient.pmhEntries = list
                    touch()
                }
            ))
            .keyboardType(.numberPad)
            .font(.system(size: 12).monospacedDigit())
            .foregroundStyle(.secondary)
            .frame(width: 52)
            .multilineTextAlignment(.trailing)
        }
    }

    @ViewBuilder
    private func pshxEntryRow(index i: Int) -> some View {
        let entry = i < patient.pshxEntries.count ? patient.pshxEntries[i] : PSHxEntry(procedure: "")
        HStack(spacing: 8) {
            Image(systemName: "scissors")
                .font(.system(size: 11))
                .foregroundStyle(AMColor.accent)
                .frame(width: 16)
            Text(entry.procedure)
                .font(.callout)
                .foregroundStyle(.primary)
            Spacer()
            TextField("Year", text: Binding(
                get: { i < patient.pshxEntries.count ? patient.pshxEntries[i].yearText : "" },
                set: { v in
                    guard i < patient.pshxEntries.count else { return }
                    var list = patient.pshxEntries
                    list[i].yearText = v
                    patient.pshxEntries = list
                    touch()
                }
            ))
            .keyboardType(.numberPad)
            .font(.system(size: 12).monospacedDigit())
            .foregroundStyle(.secondary)
            .frame(width: 48)
            .multilineTextAlignment(.trailing)

            Menu {
                Button("Unknown / Not recorded") {
                    guard i < patient.pshxEntries.count else { return }
                    var list = patient.pshxEntries
                    list[i].anaesthetic = ""
                    patient.pshxEntries = list; touch()
                }
                ForEach(["GA", "Spinal", "Epidural", "Local", "Sedation", "Regional"], id: \.self) { type in
                    Button(type) {
                        guard i < patient.pshxEntries.count else { return }
                        var list = patient.pshxEntries
                        list[i].anaesthetic = type
                        patient.pshxEntries = list; touch()
                    }
                }
            } label: {
                Text(entry.anaesthetic.isEmpty ? "Anaesth." : entry.anaesthetic)
                    .font(.caption2.weight(.medium))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(
                        entry.anaesthetic.isEmpty ? Color(.systemGray5) : AMColor.accentLt,
                        in: Capsule()
                    )
                    .foregroundStyle(entry.anaesthetic.isEmpty ? .secondary : AMColor.accent)
            }
            .menuStyle(.button)
        }
    }

    // MARK: - Investigations tab

    private var investigationsTab: some View {
        List {
            // CC-matched suggestions
            if let cc = patient.chiefComplaint,
               let suggestions = ccInvestigations[cc], !suggestions.isEmpty {
                let existing = Set(patient.investigations.map { $0.name })
                let toShow = suggestions.filter { !existing.contains($0.name) }
                if !toShow.isEmpty {
                    Section {
                        ChipFlow(hSpacing: 8, vSpacing: 8) {
                            ForEach(toShow, id: \.name) { inv in
                                Button { addInvestigation(name: inv.name, category: inv.category) } label: {
                                    HStack(spacing: 4) {
                                        Image(systemName: inv.category.icon).font(.system(size: 10))
                                        Text(inv.name).font(.system(size: 12))
                                    }
                                    .padding(.horizontal, 10).padding(.vertical, 5)
                                    .background(AMColor.accentLt, in: Capsule())
                                    .foregroundStyle(AMColor.accent)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 4)
                    } header: {
                        Label("Suggested for \(cc)", systemImage: "sparkles")
                    }
                }
            }

            // PMH-matched suggestions
            let pmhIx = pmhDerivedIxSuggestions
            if !pmhIx.isEmpty {
                Section {
                    ChipFlow(hSpacing: 8, vSpacing: 8) {
                        ForEach(pmhIx, id: \.name) { inv in
                            Button { addInvestigation(name: inv.name, category: inv.category) } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: inv.category.icon).font(.system(size: 10))
                                    Text(inv.name).font(.system(size: 12))
                                }
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(AMColor.accentLt, in: Capsule())
                                .foregroundStyle(AMColor.accent)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Label("From your PMH", systemImage: "cross.case")
                }
            }

            // Common baseline fallback — shown when CC has no matched suggestion set
            let hasCCMatch = patient.chiefComplaint.flatMap { ccInvestigations[$0] } != nil
            let existingNames = Set(patient.investigations.map { $0.name })
            let baselineToShow = commonBaselineInvs.filter { !existingNames.contains($0.name) }
            if !hasCCMatch && !baselineToShow.isEmpty {
                Section {
                    ChipFlow(hSpacing: 8, vSpacing: 8) {
                        ForEach(baselineToShow, id: \.name) { inv in
                            Button { addInvestigation(name: inv.name, category: inv.category) } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: inv.category.icon).font(.system(size: 10))
                                    Text(inv.name).font(.system(size: 12))
                                }
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(AMColor.accentLt, in: Capsule())
                                .foregroundStyle(AMColor.accent)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Label("Common Baseline Tests", systemImage: "list.bullet.clipboard")
                }
            }

            // Ordered / pending / resulted list
            let active = patient.investigations.filter { $0.status != .cancelled }
            if !active.isEmpty {
                Section {
                    ForEach(active) { inv in invRow(inv) }
                    .onDelete { idxSet in
                        let toRemove = idxSet.map { active[$0].id }
                        var list = patient.investigations
                        list.removeAll { toRemove.contains($0.id) }
                        patient.investigations = list; touch()
                    }
                } header: {
                    sectionHeader("Ordered Investigations (\(active.count))", icon: "flask",
                                  filled: !active.isEmpty)
                }
            }

            // Manual add
            Section {
                HStack(spacing: 10) {
                    TextField("Investigation name", text: $newInvName)
                        .autocorrectionDisabled()
                    Picker("", selection: $newInvCategory) {
                        ForEach(InvestigationEntry.InvCategory.allCases, id: \.self) { cat in
                            Label(cat.rawValue, systemImage: cat.icon).tag(cat)
                        }
                    }
                    .labelsHidden()
                    .frame(width: 90)
                    Button {
                        let trimmed = newInvName.trimmingCharacters(in: .whitespaces)
                        guard !trimmed.isEmpty else { return }
                        addInvestigation(name: trimmed, category: newInvCategory)
                        newInvName = ""
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(newInvName.isEmpty ? .secondary : AMColor.accent)
                            .font(.title3)
                    }
                    .disabled(newInvName.trimmingCharacters(in: .whitespaces).isEmpty)
                    .buttonStyle(.plain)
                }
            } header: {
                Label("Add Manually", systemImage: "plus.circle")
            }
        }
    }

    @ViewBuilder
    private func invRow(_ inv: InvestigationEntry) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: inv.category.icon)
                    .foregroundStyle(invStatusColor(inv.status))
                    .frame(width: 20, alignment: .center)
                VStack(alignment: .leading, spacing: 1) {
                    Text(inv.name).font(.subheadline.weight(.medium))
                    Text(inv.category.rawValue).font(.caption2).foregroundStyle(.secondary)
                }
                Spacer()
                // Tappable status badge — tap to advance ordered → pending → resulted
                if inv.status.next != nil {
                    Button { advanceInvStatus(inv) } label: {
                        Text(inv.status.rawValue)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(invStatusColor(inv.status).opacity(0.15), in: Capsule())
                            .foregroundStyle(invStatusColor(inv.status))
                    }
                    .buttonStyle(.plain)
                } else {
                    Text(inv.status.rawValue)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(invStatusColor(inv.status).opacity(0.15), in: Capsule())
                        .foregroundStyle(invStatusColor(inv.status))
                }
            }
            if inv.status == .resulted || inv.status == .pending {
                TextField("Result / notes…",
                          text: Binding(
                            get: { inv.result },
                            set: { setInvResult(id: inv.id, result: $0) }
                          ),
                          axis: .vertical)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2...)
                    .padding(.leading, 28)
            }
            // Inline critical value badge and trend arrow
            if inv.status == .resulted && !inv.result.isEmpty {
                let singleLabs = LabPanel.parse(from: [inv])
                HStack(spacing: 6) {
                    if singleLabs.hasCriticalValues {
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 9, weight: .bold))
                            Text("CRITICAL VALUE")
                                .font(.system(size: 9, weight: .black))
                                .tracking(0.3)
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(Color.red, in: Capsule())
                    }
                    if let trend = labTrend(for: inv) {
                        HStack(spacing: 3) {
                            Text(trend.arrow)
                                .font(.system(size: 10, weight: .bold))
                            Text(trend.deltaText)
                                .font(.system(size: 10))
                        }
                        .foregroundStyle(trend.color)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(trend.color.opacity(0.12), in: Capsule())
                    }
                }
                .padding(.leading, 28)
            }
        }
        .padding(.vertical, 2)
    }

    private struct LabTrend {
        let arrow: String
        let deltaText: String
        let color: Color
    }

    private func parseFirstNumber(_ text: String) -> Double? {
        var numStr = ""
        var foundDigit = false
        for scalar in text.unicodeScalars {
            let c = Character(scalar)
            if c.isNumber { numStr.append(c); foundDigit = true }
            else if c == "." && foundDigit { numStr.append(c) }
            else if foundDigit { break }
        }
        return foundDigit ? Double(numStr) : nil
    }

    private func labTrend(for inv: InvestigationEntry) -> LabTrend? {
        guard inv.status == .resulted else { return nil }
        guard let cur = parseFirstNumber(inv.result) else { return nil }
        let prior = patient.investigations
            .filter {
                $0.status == .resulted &&
                $0.id != inv.id &&
                $0.name.lowercased() == inv.name.lowercased()
            }
            .sorted { ($0.resultedAt ?? $0.orderedAt) < ($1.resultedAt ?? $1.orderedAt) }
            .compactMap { parseFirstNumber($0.result) }
            .last
        guard let prev = prior else { return nil }
        let delta = cur - prev
        let pct = prev != 0 ? abs(delta / prev * 100) : 0
        let deltaText = String(format: "%.0f%%", pct)
        if abs(delta) < prev * 0.03 {
            return LabTrend(arrow: "→", deltaText: "stable", color: .secondary)
        } else if delta > 0 {
            return LabTrend(arrow: "↑", deltaText: "+\(deltaText)", color: .orange)
        } else {
            return LabTrend(arrow: "↓", deltaText: "-\(deltaText)", color: .blue)
        }
    }

    private func invStatusColor(_ status: InvestigationEntry.InvStatus) -> Color {
        switch status {
        case .suggested: return .secondary
        case .ordered:   return .blue
        case .pending:   return .orange
        case .resulted:  return .green
        case .cancelled: return .red
        }
    }

    private func addInvestigation(name: String, category: InvestigationEntry.InvCategory) {
        var list = patient.investigations
        list.append(InvestigationEntry(
            name: name, category: category, status: .ordered,
            suggestedFor: patient.chiefComplaint ?? ""
        ))
        patient.investigations = list; touch()
    }

    private func advanceInvStatus(_ inv: InvestigationEntry) {
        guard let next = inv.status.next else { return }
        var list = patient.investigations
        if let idx = list.firstIndex(where: { $0.id == inv.id }) {
            list[idx].status = next
            if next == .resulted { list[idx].resultedAt = Date() }
        }
        patient.investigations = list; touch()
        // Fire critical value alert when status just reached .resulted
        if next == .resulted {
            let labs = LabPanel.parse(from: list)
            if labs.hasCriticalValues {
                var parts: [String] = []
                if let hb = labs.haemoglobin, hb.value < 8   { parts.append("Hb \(String(format: "%.1f", hb.value)) g/dL") }
                if let pl = labs.platelets,  pl.value < 50   { parts.append("Plt \(Int(pl.value)) ×10⁹/L") }
                if let cr = labs.creatinine, cr.value > 300  { parts.append("Creatinine \(Int(cr.value)) µmol/L") }
                if let ir = labs.inr,        ir.value > 2.5  { parts.append("INR \(String(format: "%.1f", ir.value))") }
                if let na = labs.sodium, na.value < 120 || na.value > 155 { parts.append("Na \(Int(na.value)) mmol/L") }
                if let k  = labs.potassium,  k.value < 2.5 || k.value > 6.0  { parts.append("K \(String(format: "%.1f", k.value)) mmol/L") }
                if let la = labs.lactate,    la.value >= 4.0 { parts.append("Lactate \(String(format: "%.1f", la.value)) mmol/L") }
                if let tr = labs.troponin,   tr.value > 52   { parts.append("Troponin \(Int(tr.value)) ng/L") }
                if let ca = labs.calcium, ca.value < 1.75 || ca.value > 3.0 { parts.append("Ca \(String(format: "%.2f", ca.value)) mmol/L") }
                if let gl = labs.glucose,  gl.value < 3.0 || gl.value > 20.0 { parts.append("Glucose \(String(format: "%.1f", gl.value)) mmol/L") }
                criticalLabAlert = parts.isEmpty ? "Critical value detected — review results." : parts.joined(separator: "\n")
            }
        }
    }

    private func setInvResult(id: UUID, result: String) {
        var list = patient.investigations
        if let idx = list.firstIndex(where: { $0.id == id }) {
            list[idx].result = result
        }
        patient.investigations = list; touch()
    }

    // MARK: - History bypass card

    @ViewBuilder
    private func historyBypassCard(title: String, subtitle: String, onConfirm: @escaping () -> Void) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark.seal.fill")
                .foregroundStyle(.green).font(.title3)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Button("Confirm") { onConfirm() }
                .font(.caption.weight(.semibold))
                .foregroundStyle(AMColor.accent)
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(AMColor.accentLt, in: Capsule())
        }
        .padding(.vertical, 4)
    }

    // MARK: - Append chip list to a history field

    private func appendHistory(existing: String?, chips: Set<String>, write: (String) -> Void) {
        let lines = chips.sorted().map { "· \($0)" }.joined(separator: "\n")
        write((existing ?? "").isEmpty ? lines : (existing ?? "") + "\n" + lines)
    }

    // MARK: - Allergies tab

    private var allergiesTab: some View {
        List {
            // Quick-add common allergen chips
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(commonAllergenChips, id: \.name) { chip in
                        let added = patient.allergies.contains(where: { $0.name == chip.name })
                        Button {
                            guard !added else { return }
                            var list = patient.allergies
                            list.append(AllergyEntry(name: chip.name, severity: "Moderate",
                                                     reaction: chip.reaction))
                            patient.allergies = list; touch()
                        } label: {
                            HStack(spacing: 4) {
                                if added {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 9, weight: .bold))
                                }
                                Text(chip.name)
                                    .font(.system(size: 12, weight: added ? .semibold : .regular))
                            }
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(added ? Color.red.opacity(0.15) : Color.red.opacity(0.07),
                                        in: Capsule())
                            .foregroundStyle(added ? Color.red : Color.red.opacity(0.75))
                            .overlay(Capsule()
                                .stroke(added ? Color.red.opacity(0.35) : Color.clear, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .disabled(added)
                    }
                }
                .padding(.vertical, 4)

                Button {
                    let nkda = AllergyEntry(name: "NKDA", severity: "Mild", reaction: "None")
                    if !patient.allergies.contains(where: { $0.name == "NKDA" }) {
                        var list = patient.allergies; list.insert(nkda, at: 0)
                        patient.allergies = list; touch()
                    }
                } label: {
                    Label("Mark NKDA (No Known Drug Allergies)", systemImage: "checkmark.shield")
                        .font(.subheadline).foregroundStyle(.green)
                }
                .buttonStyle(.plain)
                .disabled(patient.allergies.contains(where: { $0.name == "NKDA" }))
            } header: {
                Label("Common Allergens", systemImage: "bolt.heart")
            }

            Section {
                if patient.allergies.isEmpty {
                    HStack {
                        Image(systemName: "checkmark.shield").foregroundStyle(.green)
                        Text("No known drug allergies (NKDA)").foregroundStyle(.secondary).font(.callout)
                    }
                } else {
                    ForEach(patient.allergies) { a in
                        HStack(spacing: 10) {
                            Circle().fill(severityColor(a.severity)).frame(width: 9, height: 9)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(a.name).font(.subheadline.weight(.semibold))
                                Text("\(a.severity) — \(a.reaction)").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    .onDelete { idx in
                        var list = patient.allergies; list.remove(atOffsets: idx)
                        patient.allergies = list; touch()
                    }
                }
                Button { showAddAllergy = true } label: {
                    Label("Add Allergy / Intolerance", systemImage: "plus.circle")
                }
                .foregroundStyle(.red)
            } header: {
                sectionHeader("Allergies & Intolerances", icon: "exclamationmark.shield",
                              filled: !patient.allergies.isEmpty, filledColor: .red)
            }

            if !interactions.isEmpty {
                Section {
                    ForEach(interactions) { alert in InteractionAlertRow(alert: alert) }
                } header: {
                    Label("Drug Interaction Alerts", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                }
            }
        }
    }

    // MARK: - Social tab

    private var socialTab: some View {
        List {
            // Smoking status — single choice
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(["Non-smoker", "Ex-smoker", "Light smoker (<10/day)",
                             "Moderate smoker (10–20/day)", "Heavy smoker (>20/day)"], id: \.self) { chip in
                        let key = "Smoking:\(chip)"
                        let done = selectedSocialChips.contains(key)
                        Button {
                            selectSingleSocialChip(prefix: "Smoking", value: chip, displayText: chip)
                        } label: {
                            socialChipLabel(chip, selected: done)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("Smoking", systemImage: "smoke")
            }

            // Alcohol — single choice
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(["Non-drinker", "Social drinker (<14 units/wk)",
                             "Moderate (14–21 units/wk)", "Heavy (>21 units/wk)"], id: \.self) { chip in
                        let key = "Alcohol:\(chip)"
                        let done = selectedSocialChips.contains(key)
                        Button {
                            selectSingleSocialChip(prefix: "Alcohol", value: chip, displayText: chip)
                        } label: {
                            socialChipLabel(chip, selected: done)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("Alcohol", systemImage: "wineglass")
            }

            // Living situation — single choice
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(["Lives alone", "Lives with partner", "Lives with family", "Care home resident"],
                            id: \.self) { chip in
                        let key = "Living:\(chip)"
                        let done = selectedSocialChips.contains(key)
                        Button {
                            selectSingleSocialChip(prefix: "Living", value: chip, displayText: chip)
                        } label: {
                            socialChipLabel(chip, selected: done)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("Living Situation", systemImage: "house")
            }

            // Occupation — single choice
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(["Retired", "Sedentary / desk work", "Manual labour", "Healthcare worker"],
                            id: \.self) { chip in
                        let key = "Occ:\(chip)"
                        let done = selectedSocialChips.contains(key)
                        Button {
                            selectSingleSocialChip(prefix: "Occ", value: chip, displayText: chip)
                        } label: {
                            socialChipLabel(chip, selected: done)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("Occupation", systemImage: "briefcase")
            }

            // Activity level — single choice
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(["Physically active (>150 min/wk)", "Sedentary lifestyle"], id: \.self) { chip in
                        let key = "Activity:\(chip)"
                        let done = selectedSocialChips.contains(key)
                        Button {
                            selectSingleSocialChip(prefix: "Activity", value: chip, displayText: chip)
                        } label: {
                            socialChipLabel(chip, selected: done)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("Activity Level", systemImage: "figure.walk")
            }

            // Free text notes
            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.socialHistory ?? "" },
                                            set: { patient.socialHistory = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 120)
                    if (patient.socialHistory ?? "").isEmpty {
                        Text("Additional notes — travel, diet, recreational drugs, functional status…")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Social History Notes", icon: "person.2.circle",
                              filled: !(patient.socialHistory ?? "").isEmpty)
            }
        }
    }

    // Shared chip label for the social tab (radio-select style)
    @ViewBuilder
    private func socialChipLabel(_ text: String, selected: Bool) -> some View {
        HStack(spacing: 4) {
            Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 11))
                .foregroundStyle(selected ? .green : AMColor.accent.opacity(0.5))
            Text(text)
                .font(.system(size: 12))
        }
        .padding(.horizontal, 10).padding(.vertical, 5)
        .background(selected ? Color.green.opacity(0.12) : AMColor.accentLt, in: Capsule())
        .foregroundStyle(selected ? .green : AMColor.accent)
    }

    // Selects one chip within a prefix group (radio behaviour).
    // Tapping the already-selected chip deselects it.
    private func selectSingleSocialChip(prefix: String, value: String, displayText: String) {
        let key = "\(prefix):\(value)"
        let isCurrentlySelected = selectedSocialChips.contains(key)

        // Remove all chips with this prefix from the in-memory set
        selectedSocialChips = selectedSocialChips.filter { !$0.hasPrefix("\(prefix):") }

        // Remove matching lines from stored social history
        var lines = (patient.socialHistory ?? "")
            .components(separatedBy: "\n")
            .filter { line in
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                    .trimmingCharacters(in: CharacterSet(charactersIn: "·").union(.whitespaces))
                return !trimmed.hasPrefix("\(prefix): ")
            }

        // If not deselecting, add the new selection
        if !isCurrentlySelected {
            selectedSocialChips.insert(key)
            lines.append("· \(prefix): \(displayText)")
        }

        let joined = lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        patient.socialHistory = joined.isEmpty ? nil : joined
        touch()
        recomputeRisk()
    }

    private func appendSocialChip(_ item: String) {
        let existing = (patient.socialHistory ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        patient.socialHistory = existing.isEmpty ? "· \(item)" : existing + "\n· \(item)"
        touch()
        recomputeRisk()
    }

    // MARK: - Exam tab

    private var examTab: some View {
        List {
            Section {
                HStack {
                    Picker("", selection: $examMode) {
                        Text("Short").tag(ExamMode.short)
                        Text("Full").tag(ExamMode.full)
                    }
                    .pickerStyle(.segmented)
                    Spacer(minLength: 12)
                    Button("All Normal") { markAllNormal() }
                        .font(.caption).foregroundStyle(AMColor.accent)
                }

                examField("General appearance",
                          text: Binding(get: { patient.examGeneral ?? "" },
                                        set: { patient.examGeneral = $0.isEmpty ? nil : $0; touch() }),
                          chips: ["Alert, no distress.", "Cachexic.", "Jaundiced.", "Pallor.", "Ankle oedema.", "Unwell."])
                examField("Cardiovascular",
                          text: Binding(get: { patient.examCVS ?? "" },
                                        set: { patient.examCVS = $0.isEmpty ? nil : $0; touch() }),
                          chips: primaryCVSChips)
                examField("Respiratory",
                          text: Binding(get: { patient.examResp ?? "" },
                                        set: { patient.examResp = $0.isEmpty ? nil : $0; touch() }),
                          chips: ["Clear to auscultation bilaterally.", "Reduced air entry.", "Fine crackles.", "Expiratory wheeze.", "Dull to percussion."])
                examField(primaryExamLabel,
                          text: Binding(get: { patient.examAbdo ?? "" },
                                        set: { patient.examAbdo = $0.isEmpty ? nil : $0; touch() }),
                          chips: primaryExamChips)

                if examMode == .full {
                    examField("Neurological", text: Binding(
                        get: { patient.examNeuro ?? "" },
                        set: { patient.examNeuro = $0.isEmpty ? nil : $0; touch() }))
                    examField("Musculoskeletal", text: Binding(
                        get: { patient.examMSK ?? "" },
                        set: { patient.examMSK = $0.isEmpty ? nil : $0; touch() }))
                    examField("Skin / Wound", text: Binding(
                        get: { patient.examSkin ?? "" },
                        set: { patient.examSkin = $0.isEmpty ? nil : $0; touch() }))
                }

                examField("Other / Additional findings", text: Binding(
                    get: { patient.examOther ?? "" },
                    set: { patient.examOther = $0.isEmpty ? nil : $0; touch() }))

                Button {
                    Task { await draftExam() }
                } label: {
                    HStack {
                        Label("AI Draft Examination", systemImage: "sparkles")
                        Spacer()
                        if ai.isGenerating { ProgressView() }
                    }
                }
                .disabled(ai.isGenerating)
                .foregroundStyle(.purple)
            } header: {
                sectionHeader("Physical Examination", icon: "stethoscope",
                              filled: !(patient.examGeneral ?? "").isEmpty || !(patient.examAbdo ?? "").isEmpty)
            }
        }
    }

    @ViewBuilder
    private func examField(_ label: String, text: Binding<String>, chips: [String] = []) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                TextField("Findings…", text: text, axis: .vertical).lineLimit(2...).font(.callout)
            }
            if !chips.isEmpty {
                ChipFlow(hSpacing: 6, vSpacing: 6) {
                    ForEach(chips, id: \.self) { chip in
                        Button {
                            let existing = text.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines)
                            text.wrappedValue = existing.isEmpty ? chip : existing + " " + chip
                        } label: {
                            Text(chip)
                                .font(.system(size: 11))
                                .padding(.horizontal, 8).padding(.vertical, 4)
                                .background(Color.secondary.opacity(0.1), in: Capsule())
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(.vertical, 2)
    }

    // MARK: - Pre-encounter questionnaire SOCRATES parser
    // Reads the structured KEY: value lines written by EncounterAnswers.hpiText
    // and converts them to the socratesSelections dictionary format so the
    // Bayesian engine and SOCRATES chips are pre-populated from front-desk data.
    // This is a one-time seed on .onAppear — the doctor can override chips freely.

    private func parseSocratesFromHPI(_ hpi: String) -> [String: Set<String>] {
        var result: [String: Set<String>] = [:]
        for line in hpi.components(separatedBy: "\n") {
            let parts = line.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            guard parts.count == 2 else { continue }
            let key = parts[0].lowercased()
            let val = parts[1]
            switch key {
            case "site":
                result["site"] = [val]
            case "onset":
                result["onset"] = [val]
            case "character":
                result["character"] = [val]
            case "radiation":
                if !val.lowercased().contains("none") { result["radiation"] = [val] }
            case "severity":
                result["severity"] = [val]
            case "timing":
                result["timing"] = [val]
            case "worse":
                result["exacerbating"] = Set(val.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) })
            case "better":
                result["relieving"] = Set(val.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) })
            case "associated":
                result["associations"] = Set(val.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) })
            default:
                break
            }
        }
        return result
    }

    // MARK: - PMH notes → chip pre-population
    // Maps structured CONDITIONS: line written by EncounterAnswers.pmhxText to the
    // pmhChips display labels so the PMH section is pre-selected on first open.
    // Handles label mismatches between PMHxCondition.rawValue and pmhChips (e.g.
    // "Diabetes mellitus" → both "T2DM" and "T1DM"; "Cancer (any)" → "Malignancy").

    private func parsePMHChipsFromNotes(_ notes: String) -> Set<String> {
        var matched = Set<String>()
        // Extract conditions from the structured "CONDITIONS: a, b, c" line
        let conditionLine: String? = notes.components(separatedBy: "\n").first(where: {
            $0.uppercased().hasPrefix("CONDITIONS:")
        }).map { String($0.dropFirst("CONDITIONS:".count)).trimmingCharacters(in: .whitespaces) }

        let conditions: [String]
        if let line = conditionLine {
            conditions = line.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        } else {
            // Fallback: scan all lines for any text that matches a known condition
            conditions = notes.components(separatedBy: "\n")
        }

        // Mapping rules: PMHxCondition.rawValue (or keywords) → pmhChips label
        let mapping: [(keywords: [String], chip: String)] = [
            (["Hypertension", "hypertension"],                     "Hypertension"),
            (["Diabetes mellitus", "T2DM", "Type 2"],              "T2DM"),
            (["Diabetes mellitus", "T1DM", "Type 1"],              "T1DM"),
            (["Heart disease", "IHD", "Ischaemic heart"],          "Ischaemic heart disease"),
            (["Atrial fibrillation", "AF", "atrial fibrillation"], "Atrial fibrillation"),
            (["Heart failure"],                                     "Heart failure"),
            (["Stroke", "TIA"],                                     "Stroke / TIA"),
            (["Chronic kidney disease", "CKD"],                    "CKD"),
            (["COPD", "Chronic obstructive"],                      "COPD"),
            (["Asthma"],                                           "Asthma"),
            (["Liver disease", "Cirrhosis"],                       "Liver disease / Cirrhosis"),
            (["Peptic ulcer"],                                     "Peptic ulcer disease"),
            (["GORD", "Reflux", "GERD"],                          "GORD / Reflux"),
            (["Inflammatory bowel", "IBD", "Crohn", "Colitis"],   "IBD (Crohn's / UC)"),
            (["Cancer", "Malignancy", "Tumour", "Tumor"],         "Malignancy"),
            (["Thyroid"],                                          "Thyroid disease"),
            (["OSA", "Sleep apn", "Obstructive sleep"],           "OSA"),
            (["DVT", "PE", "pulmonary embolism", "thrombosis"],   "DVT / PE"),
            (["Anaemia", "Anemia"],                               "Anaemia"),
            (["Epilepsy", "seizure"],                             "Epilepsy"),
            (["Depression", "Anxiety", "Mental health"],          "Depression / Anxiety"),
            (["Dementia", "Alzheimer"],                           "Dementia"),
            (["Osteoporosis"],                                    "Osteoporosis"),
            (["Rheumatoid arthritis", "Rheumatoid"],              "Rheumatoid arthritis"),
            (["Immunocompromised", "HIV", "AIDS"],                "Immunocompromised"),
        ]

        let lowerConditions = conditions.map { $0.lowercased() }
        for rule in mapping {
            if rule.keywords.contains(where: { kw in
                lowerConditions.contains(where: { $0.contains(kw.lowercased()) })
            }) {
                matched.insert(rule.chip)
            }
        }
        return matched
    }

    // MARK: - P9: surgicalHistory text → PSHx chip pre-population
    // Matches free-text surgical history (from questionnaire or typed notes) against
    // the pshxChips labels by keyword. Called on .onAppear — doctor can modify freely.

    private func parsePSHxChipsFromSurgicalHistory(_ text: String) -> Set<String> {
        let lower = text.lowercased()
        var matched = Set<String>()
        let mapping: [(keywords: [String], chip: String)] = [
            (["cholecystectomy", "gallbladder removal"],          "Cholecystectomy"),
            (["appendicectomy", "appendectomy"],                  "Appendicectomy"),
            (["inguinal hernia"],                                 "Inguinal hernia repair"),
            (["umbilical hernia"],                                 "Umbilical hernia repair"),
            (["bowel resection", "small bowel resection"],        "Bowel resection"),
            (["anterior resection", "low anterior"],              "Anterior resection"),
            (["apr", "abdominoperineal"],                         "APR"),
            (["hartmann"],                                        "Hartmann's procedure"),
            (["gastric bypass", "sleeve gastrectomy", "bariatric"], "Gastric bypass / sleeve"),
            (["fundoplication", "nissen"],                        "Fundoplication"),
            (["whipple", "pancreaticoduodenectomy"],              "Whipple's procedure"),
            (["liver resection", "hepatectomy"],                  "Liver resection"),
            (["splenectomy"],                                     "Splenectomy"),
            (["thyroidectomy"],                                   "Thyroidectomy"),
            (["parathyroidectomy"],                               "Parathyroidectomy"),
            (["mastectomy"],                                      "Mastectomy"),
            (["sentinel node", "sentinel lymph"],                 "Sentinel node biopsy"),
            (["laparotomy"],                                      "Laparotomy"),
            (["diagnostic laparoscopy"],                          "Diagnostic laparoscopy"),
            (["ercp"],                                            "ERCP"),
            (["ogd", "gastroscopy", "upper gi endoscopy"],       "OGD / Gastroscopy"),
            (["colonoscopy"],                                     "Colonoscopy"),
            (["haemorrhoidectomy", "hemorrhoidectomy"],           "Haemorrhoidectomy"),
            (["fistula", "fistulotomy", "perianal abscess"],      "Fistula / abscess repair"),
            (["caesarean", "cesarean", "c-section"],              "Caesarean section"),
            (["hysterectomy"],                                    "Hysterectomy"),
        ]
        for rule in mapping {
            if rule.keywords.contains(where: { lower.contains($0) }) {
                matched.insert(rule.chip)
            }
        }
        return matched
    }

    // MARK: - P8: socialHistory text → social chip pre-population
    // Rebuilds the selectedSocialChips set from the "· Key: Value" lines written by
    // appendSocialChip(). This restores the chip state so SurgicalRiskEngine receives
    // the correct smoking/alcohol/lifestyle signals on every ConsultationView open.

    private func parseSocialChipsFromHistory(_ text: String) -> Set<String> {
        var chips = Set<String>()
        let lines = text.components(separatedBy: "\n").map {
            $0.trimmingCharacters(in: .whitespaces).trimmingCharacters(in: CharacterSet(charactersIn: "·").union(.whitespaces))
        }
        let smokingOptions  = ["Non-smoker", "Ex-smoker", "Light smoker (<10/day)",
                               "Moderate smoker (10–20/day)", "Heavy smoker (>20/day)"]
        let alcoholOptions  = ["Non-drinker", "Social drinker (<14 units/wk)",
                               "Moderate (14–21 units/wk)", "Heavy (>21 units/wk)"]
        let livingOptions   = ["Lives alone", "Lives with partner", "Lives with family", "Care home resident"]
        let occOptions      = ["Retired", "Sedentary / desk work", "Manual labour", "Healthcare worker"]
        let activityOptions = ["Physically active (>150 min/wk)", "Sedentary lifestyle"]

        for line in lines where !line.isEmpty {
            if line.hasPrefix("Smoking: ") {
                let val = String(line.dropFirst("Smoking: ".count))
                if smokingOptions.contains(val) { chips.insert("Smoking:\(val)") }
            } else if line.hasPrefix("Alcohol: ") {
                let val = String(line.dropFirst("Alcohol: ".count))
                if alcoholOptions.contains(val) { chips.insert("Alcohol:\(val)") }
            } else if line.hasPrefix("Living: ") {
                let val = String(line.dropFirst("Living: ".count))
                if livingOptions.contains(val) { chips.insert("Living:\(val)") }
            } else if line.hasPrefix("Occ: ") {
                let val = String(line.dropFirst("Occ: ".count))
                if occOptions.contains(val) { chips.insert("Occ:\(val)") }
            } else if line.hasPrefix("Activity: ") {
                let val = String(line.dropFirst("Activity: ".count))
                if activityOptions.contains(val) { chips.insert("Activity:\(val)") }
            } else {
                // Free text or legacy unkeyed entries
                chips.insert(line)
            }
        }
        return chips
    }

    // MARK: - Bayesian engine refresh
    // Augments SOCRATES selections with clinical features extracted from free text
    // (HPI, exam findings, notes) so the engine fires from any typed data, not
    // only structured chip selections.

    private func refreshBayesian() {
        // Concatenate resulted investigation findings so the clinical text parser
        // can detect critical patterns in imaging/lab reports (e.g. "pneumoperitoneum",
        // "ruptured", "free gas") and raise appropriate clinical alarms.
        let invResultsText = patient.investigations
            .filter { $0.status == .resulted && !$0.result.isEmpty }
            .map { "\($0.name): \($0.result)" }
            .joined(separator: ". ")
        let examOtherText = [patient.examCVS, patient.examResp, patient.examNeuro,
                             patient.examMSK, patient.examSkin, patient.examOther]
            .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
        let parsed = ClinicalTextParser.parse(
            hpi: patient.hpi,
            examGeneral: patient.examGeneral,
            examAbdo: patient.examAbdo,
            examOther: examOtherText.isEmpty ? nil : examOtherText,
            notes: invResultsText.isEmpty ? nil : invResultsText
        )

        // Merge parser-extracted features into the chip-selection dict
        var augmented = socratesSelections
        for (dim, chips) in parsed.featureAugments {
            augmented[dim, default: []].formUnion(chips)
        }

        // Offer a CC hint only when no CC is set yet
        if (patient.chiefComplaint ?? "").isEmpty, let hint = parsed.ccHint {
            patient.chiefComplaint = hint
        }

        let latestVitals = patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
        bayesianDx = BayesianDiagnosisEngine.infer(
            chiefComplaint: patient.chiefComplaint,
            socratesSelections: augmented,
            pmhNotes: patient.pmhNotes,
            surgicalHistory: patient.surgicalHistory,
            examAbdo: patient.examAbdo,
            examGeneral: patient.examGeneral,
            examCVS: patient.examCVS,
            examResp: patient.examResp,
            examNeuro: patient.examNeuro,
            examMSK: patient.examMSK,
            examSkin: patient.examSkin,
            examOther: patient.examOther,
            investigations: patient.investigations,
            ageYears: patient.ageYears,
            sex: patient.sex,
            longitudinal: patient.longitudinalContext,
            latestHR: latestVitals?.heartRate,
            latestSBP: latestVitals?.bpSystolic,
            latestTemp: latestVitals?.temperatureCelsius,
            latestSpO2: latestVitals?.spo2,
            latestRR: latestVitals?.respiratoryRate,
            news2Score: latestVitals.flatMap { $0.hasAnyValue ? $0.news2Score : nil },
            specialtyHint: selectedSpecialtyHint
        )

        // Update alarm list (keep dismissed state across refreshes)
        clinicalAlarms = parsed.clinicalAlarms
    }

    // MARK: - Diagnosis tab

    private var diagnosisTab: some View {
        List {
            if !bayesianDx.isEmpty {
                Section {
                    ForEach(bayesianDx) { result in
                        BayesianDxRow(result: result) {
                            patient.workingDiagnosis = result.name
                            patient.workingDiagnosisICD = result.icdCode
                            touch()
                            icdQuery = "\(result.icdCode) \(result.name)"
                            icdSuggestions = []
                        }
                    }
                } header: {
                    HStack(spacing: 6) {
                        Image(systemName: "brain.head.profile").foregroundStyle(.purple)
                        Text("Suggested Differentials")
                            .font(.caption.weight(.semibold))
                        Spacer()
                        Button {
                            refreshBayesian()
                        } label: {
                            Image(systemName: "arrow.clockwise")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                } footer: {
                    Text("Based on CC · SOCRATES · PMH · Exam · Ix · Age/Sex. Apply to confirm.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            // ── AutoFunction Action Panel ──────────────────────────────────
            let visibleActions = pipeline.filteredAutoActions(for: patient.visitType)
            if !visibleActions.isEmpty {
                Section {
                    ForEach(visibleActions.prefix(6)) { action in
                        AutoActionRow(action: action)
                    }
                } header: {
                    HStack(spacing: 6) {
                        Image(systemName: "wand.and.sparkles").foregroundStyle(.indigo)
                        Text("Clinical Actions")
                            .font(.caption.weight(.semibold))
                        Spacer()
                        if pipeline.isRunning {
                            ProgressView().scaleEffect(0.7)
                        }
                    }
                } footer: {
                    Text("Deterministic pipeline — SOCRATES · Exam · Ix · Vitals trend · Decision network.")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }

            // ── DBN Trajectory Panel ───────────────────────────────────────
            if !pipeline.trajectories.isEmpty {
                Section {
                    ForEach(pipeline.trajectories) { traj in
                        TrajectoryRow(trajectory: traj)
                    }
                } header: {
                    HStack(spacing: 6) {
                        Image(systemName: "chart.line.uptrend.xyaxis").foregroundStyle(.orange)
                        Text("Disease Trajectories (12h projection)")
                            .font(.caption.weight(.semibold))
                    }
                }
            }

            // ── Value of Information Panel ─────────────────────────────────
            if !pipeline.informationItems.isEmpty {
                Section {
                    ForEach(Array(pipeline.informationItems.prefix(5))) { item in
                        VOIRow(item: item,
                               alreadyResulted: patient.investigations.contains {
                                   $0.status == .resulted &&
                                   $0.name.lowercased().contains(item.name.lowercased())
                               })
                    }
                } header: {
                    HStack(spacing: 6) {
                        Image(systemName: "lightbulb.min").foregroundStyle(.yellow)
                        Text("Highest-Value Next Investigations (EVPI)")
                            .font(.caption.weight(.semibold))
                    }
                } footer: {
                    Text("Expected value of perfect information — ranked by bits of diagnostic uncertainty resolved.")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }

            Section {
                HStack {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                    TextField("Search ICD-10 codes or diagnosis", text: $icdQuery)
                        .autocorrectionDisabled()
                        .onChange(of: icdQuery) { _, q in
                            icdSuggestions = q.count >= 2 ? ClinicalSearchService.searchICD(q) : []
                        }
                    if !icdQuery.isEmpty {
                        Button { icdQuery = ""; icdSuggestions = [] } label: {
                            Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                        }
                    }
                }

                ForEach(icdSuggestions.prefix(6)) { icd in
                    Button {
                        patient.workingDiagnosis = icd.description
                        patient.workingDiagnosisICD = icd.code
                        touch()
                        icdQuery = "\(icd.code) \(icd.description)"
                        icdSuggestions = []
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(icd.description).font(.subheadline).foregroundStyle(.primary)
                                Text(icd.code).font(.caption.monospaced()).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(icd.category).font(.caption2).foregroundStyle(.tertiary)
                        }
                    }
                }

                if let dx = patient.workingDiagnosis {
                    HStack {
                        Image(systemName: "stethoscope").foregroundStyle(AMColor.accent)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(dx).font(.subheadline.weight(.medium))
                            if let icd = patient.workingDiagnosisICD {
                                Text(icd).font(.caption.monospaced()).foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        Button("Clear") {
                            patient.workingDiagnosis = nil; patient.workingDiagnosisICD = nil
                            touch(); icdQuery = ""
                        }.font(.caption).foregroundStyle(.red)
                    }
                    Label("Radiates to: Notes · Prescriptions · Billing",
                          systemImage: "arrow.triangle.branch")
                        .font(.caption).foregroundStyle(AMColor.accent)
                }
            } header: {
                sectionHeader("Working Diagnosis", icon: "stethoscope",
                              filled: patient.workingDiagnosis != nil)
            }
        }
    }

    // MARK: - Plan tab

    private var radiationResult: DiagnosisRadiation? {
        DiagnosisRadiationEngine.radiate(
            workingDiagnosis: patient.workingDiagnosis,
            ageYears: patient.ageYears,
            sex: patient.sex
        )
    }

    private var planTab: some View {
        List {
            // Diagnosis radiation card — shown when a working Dx is set and dismissed flag is clear
            if let radiation = radiationResult, !dismissedRadiation {
                DiagnosisRadiationCard(
                    radiation: radiation,
                    patientAge: computedAge(from: patient.dateOfBirth),
                    alreadyOrderedNames: Set(patient.investigations
                        .filter { $0.status != .cancelled }
                        .map { $0.name }),
                    onAddInvestigation: { inv in
                        let entry = InvestigationEntry(
                            name: inv.name, category: inv.category,
                            status: .suggested, suggestedFor: radiation.conditionName
                        )
                        patient.investigations.append(entry)
                        touch()
                    },
                    onUsePlan: { planText in
                        if (patient.managementPlan ?? "").isEmpty {
                            patient.managementPlan = planText; touch()
                        }
                        dismissedRadiation = true
                    },
                    onDismiss: { dismissedRadiation = true }
                )
            }

            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.managementPlan ?? "" },
                                            set: { patient.managementPlan = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 160)
                        .medicalDictation(mode: .plan, patient: patient,
                                          text: Binding(get: { patient.managementPlan ?? "" },
                                                        set: { patient.managementPlan = $0.isEmpty ? nil : $0; touch() }))
                    if (patient.managementPlan ?? "").isEmpty {
                        Text("Investigations · Referrals · Prescriptions · Follow-up plan · Red flag advice…")
                            .foregroundStyle(.tertiary).font(.callout)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Assessment & Management Plan", icon: "doc.text.magnifyingglass",
                              filled: !(patient.managementPlan ?? "").isEmpty)
            }

            Section {
                Button {
                    Task { await draftPlan() }
                } label: {
                    HStack {
                        Label("AI Draft Plan", systemImage: "sparkles")
                        Spacer()
                        if ai.isGenerating { ProgressView() }
                    }
                }
                .disabled(ai.isGenerating)
                .foregroundStyle(.purple)

                Button {
                    Task { await generateLetter() }
                } label: {
                    HStack {
                        Label("Generate Consultation Letter", systemImage: "envelope.badge.shield.half.filled")
                        Spacer()
                        if ai.isGenerating { ProgressView().scaleEffect(0.8) }
                    }
                }
                .disabled(ai.isGenerating)
                .foregroundStyle(.teal)

                Button {
                    consultationPDFWrapper = exportConsultationPDF()
                } label: {
                    Label("Export as PDF", systemImage: "square.and.arrow.up")
                }
                .foregroundStyle(.blue)
            }
        }
    }

    // MARK: - Pathway result (shown inline in CC tab)

    @ViewBuilder
    private func pathwayResult(_ result: TriageResult) -> some View {
        Section {
            HStack {
                AcuityPip(acuity: result.suggestedAcuity)
                Text(result.suggestedAcuity.label).font(.subheadline.weight(.semibold))
                Spacer()
                Text("Confidence \(result.confidencePercent)%").font(.caption).foregroundStyle(.secondary)
            }

            if !result.differentials.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Differentials").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    ForEach(Array(result.differentials.prefix(5).enumerated()), id: \.offset) { i, dx in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 6) {
                                Text(dx.name)
                                    .font(.caption.weight(i == 0 ? .semibold : .regular))
                                    .foregroundStyle(i == 0 ? .primary : .secondary)
                                Spacer()
                                Text("\(dx.probability)%")
                                    .font(.caption2.weight(.medium).monospacedDigit())
                                    .foregroundStyle(i == 0 ? AMColor.accent : .secondary)
                                if patient.workingDiagnosis != dx.name {
                                    Button("Use") {
                                        patient.workingDiagnosis = dx.name
                                        patient.workingDiagnosisICD = nil
                                        touch()
                                        activeTab = .diagnosis
                                    }
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(AMColor.accent)
                                } else {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.green).font(.caption2)
                                }
                            }
                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    Capsule()
                                        .fill(.secondary.opacity(0.12))
                                        .frame(height: 4)
                                    Capsule()
                                        .fill(i == 0 ? AMColor.accent : Color.secondary.opacity(0.35))
                                        .frame(width: geo.size.width * CGFloat(dx.probability) / 100,
                                               height: 4)
                                }
                            }
                            .frame(height: 4)
                        }
                    }
                }
            }

            if !result.redFlags.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Red Flags", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption.weight(.semibold)).foregroundStyle(.red)
                    ForEach(result.redFlags, id: \.self) { Text("• \($0)").font(.caption).foregroundStyle(.red) }
                }
            }
        } header: {
            Label("Pathway: \(result.pathway)", systemImage: "waveform.path.ecg.rectangle")
        }
    }

    // MARK: - Add Allergy sheet

    @ViewBuilder
    private var addAllergySheet: some View {
        NavigationStack {
            Form {
                Section("Allergen / Drug") {
                    TextField("e.g. Penicillin, Latex, Contrast, NSAIDs", text: $newAllergyName)
                        .autocorrectionDisabled()
                }
                Section("Severity") {
                    Picker("Severity", selection: $newAllergySeverity) {
                        ForEach(["Mild", "Moderate", "Severe"], id: \.self) { Text($0).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
                Section("Reaction / Symptom") {
                    TextField("e.g. Rash, Urticaria, Anaphylaxis, GI upset", text: $newAllergyReaction)
                }
            }
            .navigationTitle("Add Allergy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { resetAllergyForm(); showAddAllergy = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        var list = patient.allergies
                        list.append(AllergyEntry(
                            name: newAllergyName.trimmingCharacters(in: .whitespaces),
                            severity: newAllergySeverity,
                            reaction: newAllergyReaction.trimmingCharacters(in: .whitespaces)
                        ))
                        patient.allergies = list; touch()
                        resetAllergyForm(); showAddAllergy = false
                    }
                    .bold()
                    .disabled(newAllergyName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    // MARK: - Shared section header

    @ViewBuilder
    private func sectionHeader(
        _ title: String, icon: String, filled: Bool, filledColor: Color = .teal
    ) -> some View {
        HStack(spacing: 6) {
            Label(title, systemImage: icon)
            Spacer()
            if filled {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(filledColor).font(.caption)
            }
        }
    }

    // MARK: - Medication history helpers

    private func addMedicationEntry(name: String, dose: String, route: String, freq: String) {
        let rx = Prescription(drug: name, dose: dose, route: route, frequency: freq)
        rx.patient = patient
        context.insert(rx)
        touch()
        recomputeRisk()
    }

    @MainActor
    private func suggestMedicationsForDiagnosis() async {
        guard let dx = patient.workingDiagnosis else { return }
        isSuggestingMeds = true
        defer { isSuggestingMeds = false }
        do {
            let system = "You are a surgical clinical assistant. List appropriate first-line medications for a surgical patient with the given diagnosis. Return ONLY a plain list, one drug name per line, no doses, no numbering, no extra text. Maximum 6 drugs."
            let raw = try await ai.generate(systemPrompt: system,
                                            userMessage: "Diagnosis: \(dx). Age: \(patient.ageYears)y. Setting: \(patient.setting.rawValue).")
            aiMedSuggestions = raw
                .components(separatedBy: .newlines)
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
        } catch {
            showAIError = true
        }
    }

    // MARK: - Helpers

    private func touch() { patient.updatedAt = .now; patient.pendingSync = true }

    private func computedAge(from dob: Date?) -> Int? {
        guard let dob else { return nil }
        return Calendar.current.dateComponents([.year], from: dob, to: .now).year
    }

    private func resetAllergyForm() {
        newAllergyName = ""; newAllergySeverity = "Moderate"; newAllergyReaction = ""
    }

    private func severityColor(_ s: String) -> Color {
        switch s {
        case "Severe":   return .red
        case "Moderate": return .orange
        default:         return .yellow
        }
    }


    private func markAllNormal() {
        if (patient.examGeneral ?? "").isEmpty { patient.examGeneral = "Alert and oriented. No acute distress." }
        if (patient.examCVS ?? "").isEmpty    { patient.examCVS = "Regular rate and rhythm. No murmurs." }
        if (patient.examResp ?? "").isEmpty   { patient.examResp = "Clear to auscultation bilaterally." }
        if (patient.examAbdo ?? "").isEmpty   { patient.examAbdo = "Soft, non-tender, non-distended. No organomegaly." }
        touch()
    }

    private func runPathway() {
        isAssessing = true
        let result = ClinicalPathwayEngine.assess(
            chiefComplaint: patient.chiefComplaint ?? "",
            pmh: patient.pmhNotes ?? ""
        )
        triageResult = result
        if result.suggestedAcuity < patient.acuity { patient.acuity = result.suggestedAcuity; touch() }
        isAssessing = false
    }

    private func draftHPI() async {
        let system = """
        You are a surgical registrar AI assistant to Dr Dawit Daniel Kabiye MD DM, consultant general and endoscopic surgeon, Amise Medical Services, Saint Lucia.
        Write concise professional clinical documentation. British spelling.
        Mark AI-generated content: [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        let user = """
        Write a concise HPI paragraph (3-5 sentences) for a surgical outpatient consultation note using the SOCRATES framework.
        Patient: \(patient.fullName), \(patient.sex.rawValue), \(patient.ageYears)y
        Chief Complaint: \(patient.chiefComplaint ?? "Not specified")
        PMH: \(patient.pmhNotes ?? "None documented")
        Surgical History: \(patient.surgicalHistory ?? "Nil")
        Mark as [AI DRAFT — REVIEW BEFORE SIGNING].
        """
        do { let draft = try await ai.generate(systemPrompt: system, userMessage: user); patient.hpi = draft; touch() }
        catch { showAIError = true }
    }

    private func draftExam() async {
        let system = "You are a surgical registrar AI assistant. Write brief, realistic examination findings. British spelling."
        let user = """
        Write brief surgical examination findings. Return ONLY in this exact format, one per line:
        General: [finding]
        CVS: [finding]
        Resp: [finding]
        Abdomen: [finding]

        Patient: \(patient.fullName), \(patient.sex.rawValue), \(patient.ageYears)y
        Presentation: \(patient.chiefComplaint ?? patient.workingDiagnosis ?? "Not specified")
        Mark each as [AI DRAFT].
        """
        do {
            let draft = try await ai.generate(systemPrompt: system, userMessage: user)
            for line in draft.components(separatedBy: "\n") {
                let l = line.trimmingCharacters(in: .whitespaces)
                if l.lowercased().hasPrefix("general:")  { patient.examGeneral = l }
                else if l.lowercased().hasPrefix("cvs:") { patient.examCVS = l }
                else if l.lowercased().hasPrefix("resp:") { patient.examResp = l }
                else if l.lowercased().hasPrefix("abdo")  { patient.examAbdo = l }
            }
            touch()
        } catch { showAIError = true }
    }

    private func draftPlan() async {
        do {
            let soap = try await ai.generateSOAP(patient: patient, noteType: .soap)
            patient.managementPlan = "Assessment: \(soap.a)\n\nPlan: \(soap.p)"; touch()
        } catch { showAIError = true }
    }

    private func generateLetter() async {
        do {
            generatedLetterText = try await ai.generateFirstVisitLetter(patient: patient)
            showLetterSheet = true
        } catch { showAIError = true }
    }

    private func exportConsultationPDF() -> PDFDataWrapper? {
        let pageW: CGFloat = 595.2
        let pageH: CGFloat = 841.8
        let margin: CGFloat = 48
        let bodyW = pageW - margin * 2

        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pageW, height: pageH))
        let data = renderer.pdfData { ctx in
            let para = NSMutableParagraphStyle(); para.lineSpacing = 2

            let titleAttrs:  [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 14, weight: .bold),    .paragraphStyle: para]
            let headingAttrs:[NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 11, weight: .semibold), .paragraphStyle: para]
            let bodyAttrs:   [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 10),                    .paragraphStyle: para]
            let mutedAttrs:  [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 8),  .foregroundColor: UIColor.secondaryLabel, .paragraphStyle: para]

            func draw(_ s: String, attrs: [NSAttributedString.Key: Any], x: CGFloat, y: inout CGFloat, width: CGFloat) {
                guard !s.isEmpty else { return }
                let ns = NSAttributedString(string: s, attributes: attrs)
                let rect = ns.boundingRect(with: CGSize(width: width, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin], context: nil)
                if y + rect.height > pageH - margin {
                    ctx.beginPage(); y = margin
                }
                ns.draw(in: CGRect(x: x, y: y, width: width, height: rect.height))
                y += rect.height + 3
            }

            func section(_ title: String, body: String, y: inout CGFloat) {
                guard !body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
                y += 6
                draw(title.uppercased(), attrs: headingAttrs, x: margin, y: &y, width: bodyW)
                UIColor.separator.setFill()
                UIRectFill(CGRect(x: margin, y: y, width: bodyW, height: 0.5))
                y += 4
                draw(body, attrs: bodyAttrs, x: margin, y: &y, width: bodyW)
            }

            ctx.beginPage()
            var y: CGFloat = margin

            // Header
            let dob = patient.dateOfBirth.map { DateFormatter.localizedString(from: $0, dateStyle: .medium, timeStyle: .none) } ?? "DOB unknown"
            let ageStr = computedAge(from: patient.dateOfBirth).map { ", \($0)y" } ?? ""
            draw("CONSULTATION REPORT — \(patient.fullName.uppercased())", attrs: titleAttrs, x: margin, y: &y, width: bodyW)
            draw("\(patient.sex.rawValue)  ·  \(dob)\(ageStr)  ·  \(DateFormatter.localizedString(from: .now, dateStyle: .long, timeStyle: .short))",
                 attrs: mutedAttrs, x: margin, y: &y, width: bodyW)
            y += 4
            UIColor.separator.setFill(); UIRectFill(CGRect(x: margin, y: y, width: bodyW, height: 1)); y += 10

            // Clinical sections
            if let cc = patient.chiefComplaint { section("Presenting Complaint", body: cc, y: &y) }
            if let hpi = patient.hpi { section("History of Presenting Illness", body: hpi, y: &y) }
            section("Allergies", body: allergySummary(), y: &y)

            let med = medicationSummary()
            if !med.isEmpty { section("Current Medications", body: med.replacingOccurrences(of: "Medications: ", with: ""), y: &y) }

            if let pmh = patient.pmhNotes { section("Past Medical History", body: pmh, y: &y) }
            if let psh = patient.surgicalHistory { section("Past Surgical History", body: psh, y: &y) }
            if let fh = patient.familyHistoryNotes { section("Family History", body: fh, y: &y) }
            if let sh = patient.socialHistory { section("Social History", body: sh, y: &y) }

            let exam = examSummary()
            if !exam.isEmpty { section("Examination Findings", body: exam, y: &y) }

            // Investigations
            let invs = patient.investigations.filter { $0.status != .suggested }
            if !invs.isEmpty {
                section("Investigations", body: invs.map { "• \($0.name): \($0.result ?? "Pending")" }.joined(separator: "\n"), y: &y)
            }

            // Diagnosis
            if let dx = patient.workingDiagnosis {
                let icd = patient.workingDiagnosisICD.map { " (\($0))" } ?? ""
                section("Working Diagnosis", body: "\(dx)\(icd)", y: &y)
            }

            if let plan = patient.managementPlan { section("Management Plan", body: plan, y: &y) }

            // Footer on last page
            y = pageH - margin
            draw("AMISE MEDICAL SERVICES · SAINT LUCIA · Generated \(DateFormatter.localizedString(from: .now, dateStyle: .medium, timeStyle: .short))",
                 attrs: mutedAttrs, x: margin, y: &y, width: bodyW)
        }

        // Also archive a record in Notes
        let note = ClinicalNote(noteType: .soap, patient: patient)
        let parts: [String] = [
            patient.chiefComplaint.map { "CC: \($0)" },
            patient.hpi.map { "HPI:\n\($0)" },
            patient.workingDiagnosis.map { "Diagnosis: \($0)" },
            patient.managementPlan.map { "Plan:\n\($0)" },
        ].compactMap { $0 }
        note.freeText = parts.joined(separator: "\n\n")
        context.insert(note); touch()
        return PDFDataWrapper(data: data)
    }

    private func allergySummary() -> String {
        let list = patient.allergies
        guard !list.isEmpty else { return "Allergies: NKDA" }
        return "Allergies: " + list.map { "\($0.name) [\($0.severity)]" }.joined(separator: ", ")
    }

    private func medicationSummary() -> String {
        let rxs = patient.prescriptions
        guard !rxs.isEmpty else { return "" }
        return "Medications: " + rxs.map { $0.displayLine }.joined(separator: "; ")
    }

    private func examSummary() -> String {
        [patient.examGeneral, patient.examCVS, patient.examResp, patient.examAbdo,
         patient.examNeuro, patient.examMSK, patient.examSkin, patient.examOther]
            .compactMap { $0 }.joined(separator: "\n")
    }

    // MARK: - Encounter History Tab

    private var encounterHistoryTab: some View {
        let sorted = patient.encounters
            .filter(\.isComplete)
            .sorted { $0.encounterDate > $1.encounterDate }
        return Group {
            if sorted.isEmpty {
                ContentUnavailableView(
                    "No Saved Visits",
                    systemImage: "clock.badge.questionmark",
                    description: Text("Tap \"Save Visit\" to snapshot the current consultation into history.")
                )
            } else {
                List {
                    ForEach(sorted, id: \.id) { enc in
                        Button { selectedEncounter = enc } label: {
                            EncounterHistoryRow(encounter: enc)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .listStyle(.insetGrouped)
                .sheet(item: $selectedEncounter) { enc in
                    EncounterDetailSheet(encounter: enc)
                }
            }
        }
    }
}

// MARK: - Drug interaction row

private struct InteractionAlertRow: View {
    let alert: DrugInteractionAlert
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: alert.interaction.severity.icon)
                    .foregroundStyle(alert.interaction.severity.color)
                Text("\(alert.drugA) + \(alert.drugB)").font(.caption.weight(.semibold))
            }
            Text(alert.interaction.mechanism).font(.caption).foregroundStyle(.secondary)
            Text("→ \(alert.interaction.management)").font(.caption2).foregroundStyle(.orange)
        }
    }
}

// MARK: - Add Medication sheet

private struct AddMedicationSheet: View {
    @Bindable var patient: Patient
    let context: ModelContext
    @Environment(\.dismiss) private var dismiss

    @State private var drugQuery = ""
    @State private var suggestions: [SurgicalDrug] = []
    @State private var selectedDrug: SurgicalDrug?
    @State private var dose = ""
    @State private var route = "Oral"
    @State private var frequency = "Once daily"
    @State private var duration = "7 days"
    @State private var indication = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                        TextField("Drug name", text: $drugQuery)
                            .autocorrectionDisabled()
                            .onChange(of: drugQuery) { _, q in
                                suggestions = q.count >= 2 ? ClinicalSearchService.searchDrugs(q) : []
                            }
                        if !drugQuery.isEmpty {
                            Button { drugQuery = ""; suggestions = [] }
                                label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                        }
                    }
                    ForEach(suggestions.prefix(6)) { drug in
                        Button {
                            selectedDrug = drug; drugQuery = drug.name
                            dose = drug.commonDoses; indication = patient.workingDiagnosis ?? ""
                            suggestions = []
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(drug.name).foregroundStyle(.primary).font(.subheadline)
                                Text(drug.commonDoses).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                } header: { Label("Search Formulary", systemImage: "magnifyingglass") }

                if selectedDrug != nil {
                    Section("Dose & Route") {
                        TextField("Dose", text: $dose)
                        Picker("Route", selection: $route) {
                            ForEach(["Oral", "IV", "IM", "SC", "Topical", "Inhaled", "PR", "SL"],
                                    id: \.self) { Text($0).tag($0) }
                        }
                        TextField("Frequency", text: $frequency)
                        TextField("Duration", text: $duration)
                        TextField("Indication", text: $indication)
                    }
                }
            }
            .navigationTitle("Add Medication")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        guard let drug = selectedDrug else { return }
                        let rx = Prescription(drug: drug.name, dose: dose, route: route,
                                              frequency: frequency, duration: duration, indication: indication)
                        rx.patient = patient
                        context.insert(rx)
                        patient.updatedAt = .now; patient.pendingSync = true
                        dismiss()
                    }
                    .bold()
                    .disabled(selectedDrug == nil || dose.isEmpty)
                }
            }
        }
    }
}

// MARK: - Bayesian differential row

private struct BayesianDxRow: View {
    let result: BayesianDiagnosisEngine.DiagnosisResult
    let onApply: () -> Void

    private var barColor: Color {
        switch result.probability {
        case 55...: return .green
        case 30...: return .orange
        default:    return .secondary
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(result.name)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.primary)
                    Text(result.icdCode)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(result.probability)%")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(barColor)
                    Text(result.confidence.label)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Button("Apply") { onApply() }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .tint(barColor)
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.secondary.opacity(0.15))
                    RoundedRectangle(cornerRadius: 3)
                        .fill(barColor.opacity(0.75))
                        .frame(width: geo.size.width * CGFloat(result.probability) / 100)
                }
            }
            .frame(height: 5)

            if !result.evidence.isEmpty {
                Text(result.evidence.joined(separator: " · "))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Consultation Letter Sheet

private struct ConsultationLetterSheet: View {
    let letterText: String
    let patient: Patient
    @Environment(\.dismiss) private var dismiss
    @State private var showShare = false

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(letterText)
                    .font(.system(.body, design: .serif))
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .navigationTitle("Consultation Letter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showShare = true
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
            .sheet(isPresented: $showShare) {
                ShareSheet(items: [letterText]).ignoresSafeArea()
            }
        }
    }

}

// MARK: - EncounterHistoryRow

private struct EncounterHistoryRow: View {
    let encounter: Encounter

    private var dateText: String {
        encounter.encounterDate.formatted(date: .abbreviated, time: .omitted)
    }

    private var topDx: String? {
        if let dx = encounter.workingDiagnosis, !dx.isEmpty { return dx }
        let snap = encounter.decodedBayesianSnapshot
        return snap.first.map { "\($0.name) (\($0.probability)%)" }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: encounter.visitType.icon)
                    .font(.caption)
                    .foregroundStyle(AMColor.accent)
                Text(encounter.visitType.rawValue)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AMColor.accent)
                Spacer()
                Text(dateText)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            if let cc = encounter.chiefComplaint {
                Text(cc)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
            }
            if let dx = topDx {
                Text(dx)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            if let plan = encounter.managementPlan, !plan.isEmpty {
                Text(plan)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 4)
    }
}
