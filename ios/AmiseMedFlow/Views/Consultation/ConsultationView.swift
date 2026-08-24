import SwiftUI
import SwiftData

// MARK: - Allergy model (JSON-encoded in Patient.allergiesJson)

struct AllergyEntry: Codable, Identifiable {
    var id: UUID = UUID()
    var name: String
    var severity: String  // "Mild" | "Moderate" | "Severe"
    var reaction: String
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
            !(pmhNotes ?? "").isEmpty || !(surgicalHistory ?? "").isEmpty,
            !allergies.isEmpty,
            !prescriptions.isEmpty,
            !(examGeneral ?? "").isEmpty || !(examAbdo ?? "").isEmpty,
            workingDiagnosis != nil,
            !(managementPlan ?? "").isEmpty
        ]
        return (checks.filter { $0 }.count, checks.count)
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

let ccSurgicalChips: [CCSurgicalChip] = [
    CCSurgicalChip(label: "Abdominal pain",        icon: "waveform.path.ecg"),
    CCSurgicalChip(label: "Hernia",                icon: "arrow.up.left.and.arrow.down.right"),
    CCSurgicalChip(label: "Breast lump",           icon: "circle.circle"),
    CCSurgicalChip(label: "Reflux / Heartburn",    icon: "flame"),
    CCSurgicalChip(label: "Change in bowel habit", icon: "arrow.left.arrow.right"),
    CCSurgicalChip(label: "Rectal bleeding",       icon: "drop.fill"),
    CCSurgicalChip(label: "Weight loss",           icon: "arrow.down.circle"),
    CCSurgicalChip(label: "Jaundice",              icon: "sun.max"),
    CCSurgicalChip(label: "Dysphagia",             icon: "mouth"),
    CCSurgicalChip(label: "Wound / Post-op",       icon: "bandage"),
    CCSurgicalChip(label: "Neck lump",             icon: "person.bust"),
    CCSurgicalChip(label: "Bloating",              icon: "bubble.left"),
    CCSurgicalChip(label: "Skin lesion",           icon: "oval.lefthalf.filled"),
    CCSurgicalChip(label: "Anal pain",             icon: "figure.walk"),
    CCSurgicalChip(label: "Nausea / Vomiting",     icon: "arrow.up.circle"),
    CCSurgicalChip(label: "Follow-up",             icon: "arrow.clockwise"),
    CCSurgicalChip(label: "Screening",             icon: "magnifyingglass"),
    CCSurgicalChip(label: "ERCP / Biliary",        icon: "circle.dotted"),
    CCSurgicalChip(label: "Other",                 icon: "ellipsis.circle"),
]

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

let socrateDimensions: [SOCRATESDimension] = [
    .init(id: "onset",        title: "Onset",        question: "When did it start?",         icon: "clock",
          chips: ["Today", "Yesterday", "2–3 days ago", "4–7 days ago", "1–4 weeks ago", "1–6 months ago", "Over a year", "Sudden", "Gradual"],
          multiSelect: false),
    .init(id: "site",         title: "Site",         question: "Where exactly?",              icon: "mappin",
          chips: ["RUQ", "LUQ", "RLQ", "LLQ", "Epigastric", "Periumbilical", "Suprapubic", "Diffuse", "Right side", "Left side", "Loin", "Groin", "Perineal", "Chest"],
          multiSelect: true),
    .init(id: "character",    title: "Character",    question: "What is it like?",            icon: "waveform.path",
          chips: ["Sharp", "Dull", "Colicky", "Burning", "Throbbing", "Cramping", "Aching", "Pressure", "Bloating", "Pulling", "Stabbing"],
          multiSelect: true),
    .init(id: "radiation",    title: "Radiation",    question: "Does it spread?",             icon: "arrow.up.right.and.arrow.down.left",
          chips: ["No radiation", "Right shoulder", "Left shoulder", "Back", "Groin", "Chest", "Jaw", "Arm"],
          multiSelect: false),
    .init(id: "associations", title: "Associations", question: "Associated symptoms?",        icon: "list.bullet",
          chips: ["Nausea", "Vomiting", "Fever", "Rigors", "Anorexia", "Weight loss", "Jaundice", "Rectal bleeding", "Melaena", "Change in bowel habit", "Dysphagia", "Heartburn", "Haematuria", "Dysuria"],
          multiSelect: true),
    .init(id: "timing",       title: "Timing",       question: "Pattern of symptoms?",        icon: "chart.line.uptrend.xyaxis",
          chips: ["Constant", "Intermittent", "Progressive", "Post-prandial", "Nocturnal", "Episodic", "Worse over time"],
          multiSelect: true),
    .init(id: "exacerbating", title: "Exacerbating", question: "What makes it worse?",        icon: "arrow.up.circle",
          chips: ["Movement", "Eating", "Fatty food", "Lying flat", "Deep breathing", "Coughing", "Straining", "Alcohol", "NSAIDs"],
          multiSelect: true),
    .init(id: "relieving",    title: "Relieving",    question: "What makes it better?",       icon: "arrow.down.circle",
          chips: ["Rest", "Antacids", "Analgesics", "Vomiting", "Defaecation", "Sitting forward", "Eating", "Fasting", "Nothing"],
          multiSelect: true),
    .init(id: "severity",     title: "Severity",     question: "Severity rating?",            icon: "speedometer",
          chips: ["Mild (1–3/10)", "Moderate (4–6/10)", "Severe (7–9/10)", "Worst (10/10)"],
          multiSelect: false),
]

// MARK: - Consultation sub-tab

enum ConsultTab: String, CaseIterable {
    case cc        = "CC"
    case hpi       = "HPI"
    case pmh       = "PMH"
    case pshx      = "PSHx"
    case allergies = "Allergies"
    case social    = "Social"
    case exam           = "Exam"
    case investigations = "Ix"
    case diagnosis      = "Diagnosis"
    case plan      = "Plan"
}

// MARK: - ConsultationView

struct ConsultationView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context
    @StateObject private var ai = AIService()

    @State private var activeTab: ConsultTab = .cc
    @State private var examMode: ExamMode = .short
    @State private var showAddAllergy = false
    @State private var showAddMedication = false
    @State private var newAllergyName = ""
    @State private var newAllergySeverity = "Moderate"
    @State private var newAllergyReaction = ""
    @State private var triageResult: TriageResult?
    @State private var isAssessing = false
    @State private var pathwayTask: Task<Void, Never>?
    @State private var icdQuery = ""
    @State private var icdSuggestions: [ICDCode] = []
    @State private var showAIError = false
    @State private var showSavedConfirmation = false
    @State private var socratesSelections: [String: Set<String>] = [:]
    @State private var socratesExpandedDim: String? = "onset"
    @State private var pmhChipSelections: Set<String> = []
    @State private var pmhBypassConfirmed = false
    @State private var pshxChipSelections: Set<String> = []
    @State private var pshxBypassConfirmed = false
    @State private var newInvName = ""
    @State private var newInvCategory: InvestigationEntry.InvCategory = .blood

    enum ExamMode { case short, full }

    private var interactions: [DrugInteractionAlert] {
        DrugInteractionService.check(drugs: patient.prescriptions.map { $0.drug })
    }

    var body: some View {
        VStack(spacing: 0) {
            if !patient.allergies.isEmpty { allergyBanner }
            completenessBar
            tabBar
            Divider()
            tabContent
        }
        .navigationTitle("Consultation")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: patient.chiefComplaint) { _, newCC in
            guard let cc = newCC, !cc.isEmpty else { triageResult = nil; return }
            pathwayTask?.cancel()
            pathwayTask = Task {
                try? await Task.sleep(nanoseconds: 800_000_000)
                guard !Task.isCancelled else { return }
                await MainActor.run { runPathway() }
            }
        }
        .sheet(isPresented: $showAddAllergy) { addAllergySheet }
        .sheet(isPresented: $showAddMedication) {
            AddMedicationSheet(patient: patient, context: context)
        }
        .alert("AI Error", isPresented: $showAIError) {
            Button("OK", role: .cancel) {}
        } message: { Text(ai.error ?? "Unknown error") }
        .alert("SOAP Note Saved", isPresented: $showSavedConfirmation) {
            Button("OK", role: .cancel) {}
        } message: { Text("Consultation saved to Notes tab.") }
    }

    // MARK: - Allergy banner

    private var allergyBanner: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("ALLERGY ALERT", systemImage: "exclamationmark.triangle.fill")
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
            ForEach(patient.allergies) { a in
                HStack(spacing: 5) {
                    Circle().fill(.white.opacity(0.7)).frame(width: 5, height: 5)
                    Text("\(a.name)  [\(a.severity)]  — \(a.reaction)")
                        .font(.caption2).foregroundStyle(.white)
                }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.red.opacity(0.85))
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
        case .pmh:       return !(patient.pmhNotes ?? "").isEmpty
        case .pshx:      return !(patient.surgicalHistory ?? "").isEmpty
        case .allergies: return !patient.allergies.isEmpty
        case .social:    return !(patient.socialHistory ?? "").isEmpty
        case .exam:           return !(patient.examGeneral ?? "").isEmpty || !(patient.examAbdo ?? "").isEmpty
        case .investigations: return !patient.investigations.isEmpty
        case .diagnosis:      return patient.workingDiagnosis != nil
        case .plan:      return !(patient.managementPlan ?? "").isEmpty
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
        case .allergies: allergiesTab
        case .social:    socialTab
        case .exam:           examTab
        case .investigations: investigationsTab
        case .diagnosis:      diagnosisTab
        case .plan:      planTab
        }
    }

    // MARK: - CC tab

    private var selectedChipLabel: String? {
        let cc = patient.chiefComplaint ?? ""
        return ccSurgicalChips.first(where: { $0.label == cc })?.label
    }

    private var ccTab: some View {
        List {
            Section {
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

                // Chip grid
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(ccSurgicalChips) { chip in
                        let isSelected = selectedChipLabel == chip.label
                        Button {
                            patient.chiefComplaint = chip.label
                            touch()
                        } label: {
                            Label(chip.label, systemImage: chip.icon)
                                .font(.system(size: 12, weight: isSelected ? .semibold : .regular))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(
                                    isSelected ? AMColor.accent : AMColor.accentLt,
                                    in: Capsule()
                                )
                                .foregroundStyle(isSelected ? Color.white : AMColor.accent)
                                .animation(.easeInOut(duration: 0.15), value: isSelected)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)

                // Free-text override
                TextField("Or type a custom complaint…",
                          text: Binding(get: { patient.chiefComplaint ?? "" },
                                        set: { patient.chiefComplaint = $0.isEmpty ? nil : $0; touch() }),
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

            if let result = triageResult { pathwayResult(result) }
        }
    }

    // MARK: - HPI tab (SOCRATES chip builder)

    private var hpiTab: some View {
        List {
            // SOCRATES builder accordion
            Section {
                ForEach(socrateDimensions) { dim in
                    socratesDimRow(dim)
                }
            } header: {
                let filled = socrateDimensions.filter { !(socratesSelections[$0.id] ?? []).isEmpty }.count
                HStack {
                    Label("SOCRATES Builder", systemImage: "square.grid.2x2")
                    Spacer()
                    Text("\(filled)/\(socrateDimensions.count)")
                        .font(.caption.weight(.semibold).monospacedDigit())
                        .foregroundStyle(filled == socrateDimensions.count ? .green : .secondary)
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
            let ids = socrateDimensions.map(\.id)
            if let idx = ids.firstIndex(of: dimId), idx + 1 < ids.count {
                withAnimation(.easeInOut(duration: 0.18)) { socratesExpandedDim = ids[idx + 1] }
            }
        }
    }

    // MARK: - HPI prose generation from SOCRATES chips

    private var socratesPreview: String? {
        guard socrateDimensions.contains(where: { !(socratesSelections[$0.id] ?? []).isEmpty }) else { return nil }
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

    private var pmhTab: some View {
        List {
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

                // Condition chip grid
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(pmhChips, id: \.self) { chip in
                        let sel = pmhChipSelections.contains(chip)
                        Button { pmhChipSelections.formSymmetricDifference([chip]) } label: {
                            Text(chip)
                                .font(.system(size: 12, weight: sel ? .semibold : .regular))
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(sel ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                .foregroundStyle(sel ? Color.white : AMColor.accent)
                                .animation(.easeInOut(duration: 0.12), value: sel)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)

                // Apply button
                if !pmhChipSelections.isEmpty {
                    Button {
                        appendHistory(existing: patient.pmhNotes, chips: pmhChipSelections) {
                            patient.pmhNotes = $0
                        }
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
                        Text("Free-text PMH — or use chips above")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Past Medical History", icon: "clock.arrow.circlepath",
                              filled: !(patient.pmhNotes ?? "").isEmpty)
            }

            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.familyHistoryNotes ?? "" },
                                            set: { patient.familyHistoryNotes = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 80)
                    if (patient.familyHistoryNotes ?? "").isEmpty {
                        Text("Colorectal cancer, breast cancer, cardiovascular disease, etc.")
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

                // Procedure chip grid
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(pshxChips, id: \.self) { chip in
                        let sel = pshxChipSelections.contains(chip)
                        Button { pshxChipSelections.formSymmetricDifference([chip]) } label: {
                            Text(chip)
                                .font(.system(size: 12, weight: sel ? .semibold : .regular))
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(sel ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                .foregroundStyle(sel ? Color.white : AMColor.accent)
                                .animation(.easeInOut(duration: 0.12), value: sel)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)

                // Apply button
                if !pshxChipSelections.isEmpty {
                    Button {
                        appendHistory(existing: patient.surgicalHistory, chips: pshxChipSelections) {
                            patient.surgicalHistory = $0
                        }
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
        }
        .padding(.vertical, 2)
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
            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.socialHistory ?? "" },
                                            set: { patient.socialHistory = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 220)
                    if (patient.socialHistory ?? "").isEmpty {
                        Text("Occupation · Smoking · Alcohol · Recreational drugs · Living situation · Exercise · Diet · Travel · Functional status")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Social History", icon: "person.2.circle",
                              filled: !(patient.socialHistory ?? "").isEmpty)
            }
        }
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

                examField("General appearance", text: Binding(
                    get: { patient.examGeneral ?? "" },
                    set: { patient.examGeneral = $0.isEmpty ? nil : $0; touch() }))
                examField("Cardiovascular", text: Binding(
                    get: { patient.examCVS ?? "" },
                    set: { patient.examCVS = $0.isEmpty ? nil : $0; touch() }))
                examField("Respiratory", text: Binding(
                    get: { patient.examResp ?? "" },
                    set: { patient.examResp = $0.isEmpty ? nil : $0; touch() }))
                examField("Abdomen", text: Binding(
                    get: { patient.examAbdo ?? "" },
                    set: { patient.examAbdo = $0.isEmpty ? nil : $0; touch() }))

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
    private func examField(_ label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            TextField("Findings…", text: text, axis: .vertical).lineLimit(2...).font(.callout)
        }
        .padding(.vertical, 2)
    }

    // MARK: - Diagnosis tab

    private var diagnosisTab: some View {
        List {
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

    private var planTab: some View {
        List {
            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.managementPlan ?? "" },
                                            set: { patient.managementPlan = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 160)
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
                    Task { await saveSoapNote() }
                } label: {
                    Label("Save as SOAP Note", systemImage: "square.and.arrow.down")
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
                Text(acuityLabel(result.suggestedAcuity)).font(.subheadline.weight(.semibold))
                Spacer()
                Text("Confidence \(result.confidencePercent)%").font(.caption).foregroundStyle(.secondary)
            }

            if !result.differentials.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Differentials").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    ForEach(Array(result.differentials.prefix(4).enumerated()), id: \.offset) { i, dx in
                        HStack {
                            Text(i == 0 ? "→" : "•").foregroundStyle(i == 0 ? AMColor.accent : .secondary)
                            Text(dx).font(.caption)
                                .foregroundStyle(i == 0 ? .primary : .secondary)
                            Spacer()
                            if i == 0 && patient.workingDiagnosis != dx {
                                Button("Use") {
                                    patient.workingDiagnosis = dx
                                    patient.workingDiagnosisICD = nil
                                    touch()
                                    activeTab = .diagnosis
                                }
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(AMColor.accent)
                            } else if i == 0 && patient.workingDiagnosis == dx {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(.green).font(.caption)
                            }
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

    // MARK: - Helpers

    private func touch() { patient.updatedAt = .now; patient.pendingSync = true }

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

    private func acuityLabel(_ a: Acuity) -> String {
        switch a {
        case .emergency: return "Emergency"
        case .urgent:    return "Urgent"
        case .priority:  return "Priority"
        case .routine:   return "Routine"
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

    private func saveSoapNote() async {
        let parts: [String] = [
            patient.chiefComplaint.map { "CC: \($0)" },
            patient.hpi.map { "HPI:\n\($0)" },
            patient.pmhNotes.map { "PMH: \($0)" },
            patient.surgicalHistory.map { "Past Surgical Hx: \($0)" },
            allergySummary(),
            medicationSummary(),
            examSummary(),
            patient.workingDiagnosis.map { dx -> String in
                let icdSuffix = patient.workingDiagnosisICD.map { " (\($0))" } ?? ""
                return "Diagnosis: \(dx)\(icdSuffix)"
            },
            patient.managementPlan.map { "Plan:\n\($0)" },
        ].compactMap { $0 }

        let note = ClinicalNote(noteType: .soap, patient: patient)
        note.freeText = parts.joined(separator: "\n\n")
        context.insert(note); touch()
        showSavedConfirmation = true
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
