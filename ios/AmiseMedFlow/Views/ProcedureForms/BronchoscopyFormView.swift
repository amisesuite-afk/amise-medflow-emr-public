import SwiftUI
import SwiftData

// MARK: - Data model

struct BronchoscopyData: Codable {
    // Pre-procedure
    var indication: [String] = []
    var indicationOther: String = ""
    var consent: Bool = false
    var operator_: String = ""
    var assistant: String = ""
    var dateOfProcedure: Date?

    // Sedation
    var sedationUsed: String = "MAC / Propofol"
    var sedationDose: String = ""
    var oxygenSupplementation: String = "Nasal prongs"
    var topicalAnaesthesia: String = "Lidocaine spray + 2% instillation"

    // Approach
    var approach: String = "Trans-nasal"        // Trans-nasal / Trans-oral
    var bronchoscopeModel: String = ""
    var duration: String = ""
    var quality: String = "Good"

    // Upper airway
    var nasopharynxNormal: Bool = true
    var nasopharynxNotes: String = ""

    var larynxNormal: Bool = true
    var larynxNotes: String = ""
    var vocalCordsNormal: Bool = true
    var vocalCordsFindings: [String] = []
    var vocalCordsNotes: String = ""

    // Trachea & carina
    var tracheaNormal: Bool = true
    var tracheaFindings: [String] = []
    var tracheaNotes: String = ""

    var carinaNormal: Bool = true
    var carinaFindings: [String] = []
    var carinaNotes: String = ""

    // Right bronchial tree
    var rightMainNormal: Bool = true
    var rightMainNotes: String = ""

    var rightUpperLobeNormal: Bool = true
    var rightUpperLobeFindings: [String] = []
    var rightUpperLobeNotes: String = ""

    var rightMiddleLobeNormal: Bool = true
    var rightMiddleLobeFindings: [String] = []
    var rightMiddleLobeNotes: String = ""

    var rightLowerLobeNormal: Bool = true
    var rightLowerLobeFindings: [String] = []
    var rightLowerLobeNotes: String = ""

    // Left bronchial tree
    var leftMainNormal: Bool = true
    var leftMainNotes: String = ""

    var leftUpperLobeNormal: Bool = true
    var leftUpperLobeFindings: [String] = []
    var leftUpperLobeNotes: String = ""

    var leftLowerLobeNormal: Bool = true
    var leftLowerLobeFindings: [String] = []
    var leftLowerLobeNotes: String = ""

    // BAL / Specimens
    var balPerformed: Bool = false
    var balSite: String = ""
    var biopsyTaken: Bool = false
    var biopsySites: [String] = []
    var biopsyNotes: String = ""

    // Interventions
    var interventionsDone: [String] = []
    var interventionNotes: String = ""

    // Complications
    var completionStatus: String = "Complete"
    var complications: [String] = []
    var complicationNotes: String = ""

    // Impression / plan
    var impression: String = ""
    var recommendations: String = ""
    var followUpWeeks: String = ""
}

extension Patient {
    var bronchoscopyData: BronchoscopyData {
        get {
            guard let json = bronchoscopyDataJson,
                  let raw = json.data(using: .utf8) else { return BronchoscopyData() }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            return (try? decoder.decode(BronchoscopyData.self, from: raw)) ?? BronchoscopyData()
        }
        set {
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            bronchoscopyDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}

// MARK: - View

struct BronchoscopyFormView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State private var data: BronchoscopyData = BronchoscopyData()
    @State private var hasProcedureDate = false
    @State private var pdfWrapper: PDFDataWrapper?

    private let indications = [
        "Haemoptysis", "Persistent cough", "Wheeze / stridor",
        "Lung mass / suspicious lesion", "Mediastinal lymphadenopathy",
        "Recurrent pneumonia / consolidation", "Interstitial lung disease",
        "Foreign body removal", "Atelectasis", "Suspected endobronchial lesion",
        "Infection / microbiological sampling", "Post-intubation follow-up", "Other"
    ]
    private let vocalCordsOptions = [
        "Vocal cord palsy (left)", "Vocal cord palsy (right)", "Bilateral palsy",
        "Nodule / polyp", "Oedema", "Erythema", "Lesion requiring biopsy"
    ]
    private let airwayFindingOptions = [
        "Mucosal erythema / inflammation", "Endobronchial lesion",
        "Extrinsic compression", "Submucosal infiltration", "Mucus plug",
        "Haemorrhage / blood", "Stricture / stenosis", "Carcinoma in situ",
        "Post-surgical changes", "Foreign body", "Pus / secretions"
    ]
    private let tracheaFindingOptions = [
        "Tracheomalacia", "Extrinsic compression", "Tracheal stenosis",
        "Mucosal lesion", "Secretions", "Deviation"
    ] + airwayFindingOptions
    private let carinaFindingOptions = [
        "Carina blunted / widened", "Carina fixed", "Peribronchial infiltrate"
    ] + airwayFindingOptions
    private let interventionOptions = [
        "Bronchoalveolar lavage (BAL)", "Endobronchial biopsy",
        "Transbronchial biopsy (TBLB)", "EBUS-TBNA",
        "Brushings (cytology)", "Protected specimen brush",
        "Foreign body removal", "Endobronchial debulking",
        "Balloon dilation", "Stent insertion", "APC / laser"
    ]
    private let complicationOptions = [
        "None", "Oxygen desaturation",
        "Bronchospasm", "Haemorrhage (mild)", "Haemorrhage (significant)",
        "Pneumothorax", "Cardiorespiratory event", "Laryngospasm",
        "Reaction to sedation / topical anaesthesia"
    ]
    private let approachOptions = ["Trans-nasal", "Trans-oral"]
    private let sedationOptions  = ["MAC / Propofol", "Midazolam + Fentanyl", "General Anaesthesia", "Topical only (no sedation)"]
    private let oxygenOptions    = ["Nasal prongs", "Hudson mask", "High-flow nasal oxygen", "ETT / LMA (GA)"]

    var body: some View {
        Form {
            preProcedureSection
            procedureSection
            upperAirwaySection
            trachealSection
            rightTreeSection
            leftTreeSection
            specimensSection
            if !data.interventionsDone.isEmpty { interventionsSection }
            complicationsSection
            impressionSection
        }
        .navigationTitle("Bronchoscopy Report")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    // PDF export — reuse ProcedureFormPDF generic text report
                    let note = buildReportText()
                    let noteObj = ClinicalNote(noteType: .endoscopy, patient: patient)
                    noteObj.freeText = note
                    context.insert(noteObj)
                    patient.updatedAt = .now; patient.pendingSync = true
                } label: {
                    Label("Save Note", systemImage: "arrow.up.doc.fill")
                }
            }
        }
        .onAppear {
            data = patient.bronchoscopyData
            hasProcedureDate = data.dateOfProcedure != nil
            if data.dateOfProcedure == nil, let opDate = patient.operationDate {
                data.dateOfProcedure = opDate
                hasProcedureDate = true
            }
            if data.operator_.isEmpty {
                data.operator_ = StaffRegistry.shared.names(for: .surgeon).first ?? "Dr Dawit Daniel Kabiye"
            }
            if data.indication.isEmpty {
                let sources = [patient.workingDiagnosis, patient.chiefComplaint].compactMap { $0 }
                let combined = sources.joined(separator: " ").lowercased()
                let matched = indications.filter { combined.contains($0.lowercased()) }
                if !matched.isEmpty { data.indication = matched }
            }
            // Pre-fill normal impression when form is freshly opened
            if data.impression.isEmpty && isAllNormal {
                data.impression = normalImpressionText
            }
            save()
        }
        .onChange(of: data) { _, _ in save() }
    }

    // MARK: - Sections

    private var preProcedureSection: some View {
        Section("Pre-procedure") {
            Toggle("Consent obtained", isOn: $data.consent)

            if hasProcedureDate, let _ = data.dateOfProcedure {
                DatePicker("Date",
                           selection: Binding(
                               get: { data.dateOfProcedure ?? Date() },
                               set: { data.dateOfProcedure = $0 }),
                           displayedComponents: [.date, .hourAndMinute])
            } else {
                Button("Set Procedure Date") {
                    data.dateOfProcedure = Date()
                    hasProcedureDate = true
                }
            }

            TextField("Operator", text: $data.operator_)
            TextField("Assistant", text: $data.assistant)

            // Indication chips
            VStack(alignment: .leading, spacing: 6) {
                Text("Indication").font(.subheadline).foregroundStyle(.secondary)
                chipGrid(options: indications, selected: $data.indication)
                if data.indication.contains("Other") {
                    TextField("Specify…", text: $data.indicationOther)
                        .font(.footnote)
                }
            }
        }
    }

    private var procedureSection: some View {
        Section("Procedure") {
            Picker("Approach", selection: $data.approach) {
                ForEach(approachOptions, id: \.self) { Text($0) }
            }
            Picker("Sedation", selection: $data.sedationUsed) {
                ForEach(sedationOptions, id: \.self) { Text($0) }
            }
            TextField("Sedation dose", text: $data.sedationDose)
            Picker("Oxygen", selection: $data.oxygenSupplementation) {
                ForEach(oxygenOptions, id: \.self) { Text($0) }
            }
            TextField("Bronchoscope model", text: $data.bronchoscopeModel)
            TextField("Duration (minutes)", text: $data.duration)
                .keyboardType(.numberPad)
            Picker("Quality", selection: $data.quality) {
                ForEach(["Good", "Adequate", "Poor", "Abandoned"], id: \.self) { Text($0) }
            }
        }
    }

    private var upperAirwaySection: some View {
        Section("Upper Airway") {
            // Nasopharynx
            HStack {
                Text("Nasopharynx")
                Spacer()
                Toggle("Normal", isOn: $data.nasopharynxNormal)
            }
            if !data.nasopharynxNormal {
                TextField("Nasopharynx findings", text: $data.nasopharynxNotes, axis: .vertical)
                    .lineLimit(2...4)
            }

            // Vocal cords
            HStack {
                Text("Vocal Cords")
                Spacer()
                Toggle("Normal", isOn: $data.vocalCordsNormal)
            }
            if !data.vocalCordsNormal {
                chipGrid(options: vocalCordsOptions, selected: $data.vocalCordsFindings)
                TextField("Vocal cord notes", text: $data.vocalCordsNotes, axis: .vertical)
                    .lineLimit(2...4)
            }

            // Larynx (overall)
            HStack {
                Text("Larynx (overall)")
                Spacer()
                Toggle("Normal", isOn: $data.larynxNormal)
            }
            if !data.larynxNormal {
                TextField("Larynx findings", text: $data.larynxNotes, axis: .vertical)
                    .lineLimit(2...4)
            }
        }
    }

    @ViewBuilder
    private var trachealSection: some View {
        Section("Trachea") {
            HStack {
                Text("Trachea")
                Spacer()
                Toggle("Normal", isOn: $data.tracheaNormal)
            }
            if !data.tracheaNormal {
                chipGrid(options: tracheaFindingOptions, selected: $data.tracheaFindings)
                TextField("Trachea notes", text: $data.tracheaNotes, axis: .vertical)
                    .lineLimit(2...4)
            }
        }

        Section("Carina") {
            HStack {
                Text("Carina")
                Spacer()
                Toggle("Normal", isOn: $data.carinaNormal)
            }
            if !data.carinaNormal {
                chipGrid(options: carinaFindingOptions, selected: $data.carinaFindings)
                TextField("Carina notes", text: $data.carinaNotes, axis: .vertical)
                    .lineLimit(2...4)
            }
        }
    }

    private var rightTreeSection: some View {
        Section("Right Bronchial Tree") {
            HStack {
                Text("Right Main Bronchus")
                Spacer()
                Toggle("Normal", isOn: $data.rightMainNormal)
            }
            if !data.rightMainNormal {
                TextField("Right main findings", text: $data.rightMainNotes, axis: .vertical)
                    .lineLimit(2...4)
            }

            bronchialSubsegmentRow(
                label: "Right Upper Lobe (RB1–3)",
                normal: $data.rightUpperLobeNormal,
                findings: $data.rightUpperLobeFindings,
                notes: $data.rightUpperLobeNotes
            )
            bronchialSubsegmentRow(
                label: "Right Middle Lobe (RB4–5)",
                normal: $data.rightMiddleLobeNormal,
                findings: $data.rightMiddleLobeFindings,
                notes: $data.rightMiddleLobeNotes
            )
            bronchialSubsegmentRow(
                label: "Right Lower Lobe (RB6–10)",
                normal: $data.rightLowerLobeNormal,
                findings: $data.rightLowerLobeFindings,
                notes: $data.rightLowerLobeNotes
            )
        }
    }

    private var leftTreeSection: some View {
        Section("Left Bronchial Tree") {
            HStack {
                Text("Left Main Bronchus")
                Spacer()
                Toggle("Normal", isOn: $data.leftMainNormal)
            }
            if !data.leftMainNormal {
                TextField("Left main findings", text: $data.leftMainNotes, axis: .vertical)
                    .lineLimit(2...4)
            }

            bronchialSubsegmentRow(
                label: "Left Upper Lobe + Lingula (LB1–5)",
                normal: $data.leftUpperLobeNormal,
                findings: $data.leftUpperLobeFindings,
                notes: $data.leftUpperLobeNotes
            )
            bronchialSubsegmentRow(
                label: "Left Lower Lobe (LB6–10)",
                normal: $data.leftLowerLobeNormal,
                findings: $data.leftLowerLobeFindings,
                notes: $data.leftLowerLobeNotes
            )
        }
    }

    private var specimensSection: some View {
        Section("Specimens") {
            Toggle("BAL performed", isOn: $data.balPerformed)
            if data.balPerformed {
                TextField("BAL site (lobe/segment)", text: $data.balSite)
            }
            Toggle("Endobronchial biopsy taken", isOn: $data.biopsyTaken)
            if data.biopsyTaken {
                TextField("Biopsy sites", text: $data.biopsyNotes, axis: .vertical)
                    .lineLimit(2...4)
            }
            // Interventions picker
            VStack(alignment: .leading, spacing: 6) {
                Text("Interventions").font(.subheadline).foregroundStyle(.secondary)
                chipGrid(options: interventionOptions, selected: $data.interventionsDone)
            }
        }
    }

    private var interventionsSection: some View {
        Section("Intervention Notes") {
            TextField("Details", text: $data.interventionNotes, axis: .vertical)
                .lineLimit(3...6)
        }
    }

    private var complicationsSection: some View {
        Section("Complications") {
            Picker("Completion", selection: $data.completionStatus) {
                ForEach(["Complete", "Incomplete — poor visibility",
                         "Incomplete — patient tolerance", "Abandoned — complication"], id: \.self) { Text($0) }
            }
            chipGrid(options: complicationOptions, selected: $data.complications)
            if data.complications.contains(where: { $0 != "None" }) {
                TextField("Complication details", text: $data.complicationNotes, axis: .vertical)
                    .lineLimit(2...4)
            }
        }
    }

    private var impressionSection: some View {
        Section("Impression & Plan") {
            if isAllNormal && data.impression.isEmpty {
                Button("Fill Normal Study") {
                    data.impression = normalImpressionText
                }
                .font(.subheadline)
                .foregroundStyle(.teal)
            }
            TextField("Impression", text: $data.impression, axis: .vertical)
                .lineLimit(3...8)
            TextField("Recommendations", text: $data.recommendations, axis: .vertical)
                .lineLimit(2...6)
            Picker("Follow-up", selection: $data.followUpWeeks) {
                ForEach(["1", "2", "4", "6", "8", "12"], id: \.self) {
                    Text("In \($0) weeks")
                }
                Text("As indicated").tag("PRN")
            }
        }
    }

    // MARK: - Helpers

    @ViewBuilder
    private func bronchialSubsegmentRow(
        label: String,
        normal: Binding<Bool>,
        findings: Binding<[String]>,
        notes: Binding<String>
    ) -> some View {
        HStack {
            Text(label).font(.subheadline)
            Spacer()
            Toggle("Normal", isOn: normal)
        }
        if !normal.wrappedValue {
            chipGrid(options: airwayFindingOptions, selected: findings)
            TextField("\(label) notes", text: notes, axis: .vertical)
                .lineLimit(2...4)
        }
    }

    @ViewBuilder
    private func chipGrid(options: [String], selected: Binding<[String]>) -> some View {
        FlowLayout(spacing: 6) {
            ForEach(options, id: \.self) { opt in
                let isOn = selected.wrappedValue.contains(opt)
                Button {
                    if isOn { selected.wrappedValue.removeAll { $0 == opt } }
                    else     { selected.wrappedValue.append(opt) }
                } label: {
                    Text(opt)
                        .font(.caption)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(isOn ? Color.teal.opacity(0.2) : Color.secondary.opacity(0.1),
                                    in: Capsule())
                        .foregroundStyle(isOn ? .teal : .secondary)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var isAllNormal: Bool {
        data.nasopharynxNormal && data.larynxNormal && data.vocalCordsNormal &&
        data.tracheaNormal && data.carinaNormal &&
        data.rightMainNormal && data.rightUpperLobeNormal && data.rightMiddleLobeNormal && data.rightLowerLobeNormal &&
        data.leftMainNormal && data.leftUpperLobeNormal && data.leftLowerLobeNormal
    }

    private var normalImpressionText: String {
        let op = data.operator_.isEmpty ? "Surgeon" : data.operator_
        return "Flexible bronchoscopy performed by \(op). " +
        "The nasopharynx, larynx, and vocal cords were normal with bilateral cord mobility confirmed. " +
        "The trachea was patent with a sharp, midline carina. " +
        "The right and left bronchial trees were systematically inspected to sub-segmental level. " +
        "No endobronchial lesion, mucosal abnormality, compression, or haemorrhage was identified. " +
        "Procedure completed successfully without complication."
    }

    private func buildReportText() -> String {
        let fmt = DateFormatter()
        fmt.dateStyle = .long; fmt.timeStyle = .short
        fmt.timeZone = TimeZone(identifier: "America/St_Lucia")
        let dateStr = data.dateOfProcedure.map { fmt.string(from: $0) } ?? "—"

        var lines: [String] = [
            "BRONCHOSCOPY REPORT",
            "",
            "Patient: \(patient.fullName)  |  DOB: \(patient.formattedDOB)",
            "Date: \(dateStr)  |  Operator: \(data.operator_)  |  Assistant: \(data.assistant)",
            "Indication: \(data.indication.joined(separator: ", "))",
            "Approach: \(data.approach)  |  Sedation: \(data.sedationUsed)  |  Bronchoscope: \(data.bronchoscopeModel)",
            "",
            "FINDINGS:"
        ]
        func segLine(_ label: String, normal: Bool, findings: [String], notes: String) {
            if normal {
                lines.append("  \(label): Normal")
            } else {
                let f = (findings + (notes.isEmpty ? [] : [notes])).joined(separator: "; ")
                lines.append("  \(label): \(f)")
            }
        }
        segLine("Nasopharynx", normal: data.nasopharynxNormal, findings: [], notes: data.nasopharynxNotes)
        segLine("Vocal cords", normal: data.vocalCordsNormal, findings: data.vocalCordsFindings, notes: data.vocalCordsNotes)
        segLine("Trachea", normal: data.tracheaNormal, findings: data.tracheaFindings, notes: data.tracheaNotes)
        segLine("Carina", normal: data.carinaNormal, findings: data.carinaFindings, notes: data.carinaNotes)
        segLine("Right upper lobe", normal: data.rightUpperLobeNormal, findings: data.rightUpperLobeFindings, notes: data.rightUpperLobeNotes)
        segLine("Right middle lobe", normal: data.rightMiddleLobeNormal, findings: data.rightMiddleLobeFindings, notes: data.rightMiddleLobeNotes)
        segLine("Right lower lobe", normal: data.rightLowerLobeNormal, findings: data.rightLowerLobeFindings, notes: data.rightLowerLobeNotes)
        segLine("Left upper lobe", normal: data.leftUpperLobeNormal, findings: data.leftUpperLobeFindings, notes: data.leftUpperLobeNotes)
        segLine("Left lower lobe", normal: data.leftLowerLobeNormal, findings: data.leftLowerLobeFindings, notes: data.leftLowerLobeNotes)

        if data.balPerformed { lines.append("  BAL: Performed — site: \(data.balSite)") }
        if data.biopsyTaken  { lines.append("  Biopsy: \(data.biopsyNotes)") }
        if !data.interventionsDone.isEmpty {
            lines.append("  Interventions: \(data.interventionsDone.joined(separator: ", "))")
        }
        lines.append("")
        lines.append("Complications: \(data.complications.isEmpty ? "None" : data.complications.joined(separator: ", "))")
        lines.append("")
        lines.append("IMPRESSION: \(data.impression)")
        if !data.recommendations.isEmpty { lines.append("PLAN: \(data.recommendations)") }
        if !data.followUpWeeks.isEmpty   { lines.append("Follow-up: in \(data.followUpWeeks) weeks") }
        return lines.joined(separator: "\n")
    }

    private func save() {
        patient.bronchoscopyData = data
        patient.updatedAt = .now
        patient.pendingSync = true
    }
}

// MARK: - FlowLayout helper (chip grid)

private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        var y: CGFloat = 0; var x: CGFloat = 0; var maxHeight: CGFloat = 0
        for view in subviews {
            let sz = view.sizeThatFits(.unspecified)
            if x + sz.width > width && x > 0 { x = 0; y += maxHeight + spacing; maxHeight = 0 }
            x += sz.width + spacing
            maxHeight = max(maxHeight, sz.height)
        }
        return CGSize(width: width, height: y + maxHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX; var y = bounds.minY; var maxHeight: CGFloat = 0
        for view in subviews {
            let sz = view.sizeThatFits(.unspecified)
            if x + sz.width > bounds.maxX && x > bounds.minX { x = bounds.minX; y += maxHeight + spacing; maxHeight = 0 }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(sz))
            x += sz.width + spacing
            maxHeight = max(maxHeight, sz.height)
        }
    }
}
