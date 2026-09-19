import SwiftUI
import SwiftData

// MARK: - Data model

struct ColonoscopyData: Codable {
    // Pre-procedure
    var indication: [String] = []
    var indicationOther: String = ""
    var consent: Bool = false
    var operator_: String = ""
    var assistant: String = ""
    var dateOfProcedure: Date?

    // Sedation / prep
    var sedationUsed: String = "Midazolam + Fentanyl"
    var sedationDose: String = ""
    var antispasmodic: Bool = false
    var antibiotic: Bool = false
    var antibioticUsed: String = ""

    // Bowel preparation
    var bowelPrepAgent: String = "MoviPrep"
    var bowelPrepQuality: String = "Good"
    var bostonRight: Int = 3        // 0–3 per segment (Boston Bowel Prep Scale)
    var bostonTransverse: Int = 3
    var bostonLeft: Int = 3

    // Procedure
    var colonoscopeModel: String = ""
    var duration: String = ""
    var extentReached: String = "Cecum"
    var ilealIntubation: Bool = false
    var quality: String = "Complete"

    // Segment findings
    var rectumNormal: Bool = true
    var rectumFindings: [String] = []
    var rectumNotes: String = ""

    var sigmoidNormal: Bool = true
    var sigmoidFindings: [String] = []
    var sigmoidNotes: String = ""

    var descendingNormal: Bool = true
    var descendingFindings: [String] = []
    var descendingNotes: String = ""

    var splenicNormal: Bool = true
    var splenicFindings: [String] = []
    var splenicNotes: String = ""

    var transverseNormal: Bool = true
    var transverseFindings: [String] = []
    var transverseNotes: String = ""

    var hepaticNormal: Bool = true
    var hepaticFindings: [String] = []
    var hepaticNotes: String = ""

    var ascendingNormal: Bool = true
    var ascendingFindings: [String] = []
    var ascendingNotes: String = ""

    var cecumNormal: Bool = true
    var cecumFindings: [String] = []
    var cecumNotes: String = ""

    var terminalIleumNormal: Bool = true
    var terminalIleumFindings: [String] = []
    var terminalIleumNotes: String = ""

    // Biopsies
    var biopsyTaken: Bool = false
    var biopsySites: [String] = []
    var biopsyNotes: String = ""

    // Interventions
    var interventionsDone: [String] = []
    var interventionNotes: String = ""

    // Complications / outcome
    var completionStatus: String = "Complete"
    var complications: [String] = []
    var complicationNotes: String = ""

    // Impression / plan
    var impression: String = ""
    var recommendations: String = ""
    var surveillance: String = ""
    var followUpWeeks: String = ""
}

extension Patient {
    var colonoscopyData: ColonoscopyData {
        get {
            guard let json = colonoscopyDataJson,
                  let raw = json.data(using: .utf8) else { return ColonoscopyData() }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            return (try? decoder.decode(ColonoscopyData.self, from: raw)) ?? ColonoscopyData()
        }
        set {
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            colonoscopyDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}

// MARK: - View

struct ColonoscopyFormView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State private var data: ColonoscopyData = ColonoscopyData()
    @State private var hasProcedureDate = false
    @State private var pdfWrapper: PDFDataWrapper?

    // Common finding chips shared across colon segments
    private let colonFindingOptions = [
        "Polyp(s)", "Diverticulosis", "Diverticulitis", "Angiodysplasia",
        "Colitis (active)", "Colitis (chronic)", "Melanosis coli",
        "Mucosal oedema / erythema", "Haemorrhoids", "Tumour / mass",
        "Stricture", "Extrinsic compression", "Post-surgical changes", "Normal"
    ]
    private let ileumFindingOptions = [
        "Normal", "Lymphoid follicular hyperplasia", "Ulcers",
        "Stricture", "Nodularity", "Parasites", "Terminal ileitis"
    ]
    private let indications = [
        "Colorectal cancer screening", "Polyp surveillance",
        "Change in bowel habit", "Rectal bleeding", "Anaemia / iron deficiency",
        "Diarrhoea", "Abdominal pain", "Weight loss",
        "Inflammatory bowel disease (monitoring)", "Colitis (assessment)",
        "Abnormal CT / imaging", "Pre-operative assessment",
        "Therapeutic — dilation", "Therapeutic — APC / haemostasis", "Other"
    ]
    private let interventionOptions = [
        "Polypectomy (cold snare)", "Polypectomy (hot snare)",
        "Biopsy (forceps)", "APC", "Haemostatic clip",
        "Adrenaline injection", "Band ligation",
        "Balloon dilation", "Stent insertion",
        "Tattoo / marking", "Foreign body removal"
    ]
    private let complicationOptions = [
        "None", "Perforation", "Haemorrhage (intra-procedural)",
        "Haemorrhage (delayed)", "Post-polypectomy syndrome",
        "Cardiorespiratory event", "Pain / vasovagal"
    ]

    var body: some View {
        Form {
            preProcedureSection
            bowelPrepSection
            procedureSection
            rectumSection
            sigmoidSection
            descendingSection
            splenicSection
            transverseSection
            hepaticSection
            ascendingSection
            cecumSection
            if data.ilealIntubation { terminalIleumSection }
            biopsySection
            if !data.interventionsDone.isEmpty { interventionsSection }
            complicationsSection
            impressionSection
        }
        .navigationTitle("Colonoscopy Report")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    pdfWrapper = PDFDataWrapper(data: ProcedureFormPDF.colonoscopyReport(patient: patient, data: data))
                } label: {
                    Label("Export PDF", systemImage: "arrow.up.doc.fill")
                }
            }
        }
        .sheet(item: $pdfWrapper) { wrapper in
            ShareSheet(items: [wrapper.data])
        }
        .onAppear {
            data = patient.colonoscopyData
            hasProcedureDate = data.dateOfProcedure != nil

            // Pre-fill date from the patient's scheduled operation date
            if data.dateOfProcedure == nil, let opDate = patient.operationDate {
                data.dateOfProcedure = opDate
                hasProcedureDate = true
            }

            // Pre-fill operator from the registry (most recently used surgeon)
            if data.operator_.isEmpty {
                data.operator_ = StaffRegistry.shared.names(for: .surgeon).first ?? "Dr Dawit Daniel Kabiye"
            }

            // Pre-fill indication chips from working diagnosis + chief complaint
            if data.indication.isEmpty {
                let sources = [patient.workingDiagnosis, patient.chiefComplaint].compactMap { $0 }
                let combined = sources.joined(separator: " ").lowercased()
                let matched = indications.filter { combined.contains($0.lowercased()) }
                if !matched.isEmpty { data.indication = matched }
            }

            save()
        }
    }

    // MARK: Pre-procedure

    private var preProcedureSection: some View {
        Section("Pre-procedure") {
            chipMultiSelect("Indication", options: indications, selected: $data.indication)
                .onChange(of: data.indication) { _, _ in save() }
            if data.indication.contains("Other") {
                TextField("Other indication", text: $data.indicationOther)
                    .onChange(of: data.indicationOther) { _, _ in save() }
            }
            Toggle("Consent obtained", isOn: $data.consent)
                .onChange(of: data.consent) { _, _ in save() }
            TextField("Operator", text: $data.operator_)
                .onChange(of: data.operator_) { _, _ in save() }
            TextField("Assistant", text: $data.assistant)
                .onChange(of: data.assistant) { _, _ in save() }
            Toggle("Date of procedure", isOn: $hasProcedureDate)
                .onChange(of: hasProcedureDate) { _, on in
                    data.dateOfProcedure = on ? (data.dateOfProcedure ?? .now) : nil
                    save()
                }
            if hasProcedureDate {
                DatePicker("Date", selection: Binding(
                    get: { data.dateOfProcedure ?? .now },
                    set: { data.dateOfProcedure = $0; save() }
                ), displayedComponents: [.date, .hourAndMinute])
            }
            TextField("Sedation used", text: $data.sedationUsed)
                .onChange(of: data.sedationUsed) { _, _ in save() }
            TextField("Sedation dose", text: $data.sedationDose)
                .onChange(of: data.sedationDose) { _, _ in save() }
            Toggle("Antispasmodic given", isOn: $data.antispasmodic)
                .onChange(of: data.antispasmodic) { _, _ in save() }
            Toggle("Antibiotic prophylaxis", isOn: $data.antibiotic)
                .onChange(of: data.antibiotic) { _, _ in save() }
            if data.antibiotic {
                TextField("Antibiotic used", text: $data.antibioticUsed)
                    .onChange(of: data.antibioticUsed) { _, _ in save() }
            }
        }
    }

    // MARK: Bowel prep

    private var bowelPrepSection: some View {
        Section("Bowel Preparation") {
            Picker("Agent", selection: $data.bowelPrepAgent) {
                ForEach(["MoviPrep", "Klean-Prep", "Citrafleet", "Fleet Phospho-Soda",
                         "Plenvu", "Miralax", "Other"], id: \.self) { Text($0) }
            }
            .onChange(of: data.bowelPrepAgent) { _, _ in save() }
            Picker("Overall quality", selection: $data.bowelPrepQuality) {
                ForEach(["Excellent", "Good", "Adequate", "Poor"], id: \.self) { Text($0) }
            }
            .onChange(of: data.bowelPrepQuality) { _, _ in save() }
            VStack(alignment: .leading, spacing: 8) {
                Text("Boston Bowel Prep Scale (0–3 per segment)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                bbpsStepper("Right colon", value: $data.bostonRight)
                bbpsStepper("Transverse", value: $data.bostonTransverse)
                bbpsStepper("Left colon", value: $data.bostonLeft)
                let total = data.bostonRight + data.bostonTransverse + data.bostonLeft
                HStack {
                    Text("Total BBPS")
                        .font(.system(size: 13, weight: .medium))
                    Spacer()
                    Text("\(total) / 9")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(total >= 6 ? .green : total >= 3 ? .orange : .red)
                }
            }
        }
    }

    @ViewBuilder
    private func bbpsStepper(_ label: String, value: Binding<Int>) -> some View {
        HStack {
            Text(label).font(.system(size: 13))
            Spacer()
            Stepper("\(value.wrappedValue)", value: value, in: 0...3)
                .labelsHidden()
                .onChange(of: value.wrappedValue) { _, _ in save() }
            Text("\(value.wrappedValue)").frame(width: 18)
                .font(.system(size: 13, weight: .semibold))
        }
    }

    // MARK: Procedure details

    private var procedureSection: some View {
        Section("Procedure Details") {
            TextField("Colonoscope model", text: $data.colonoscopeModel)
                .onChange(of: data.colonoscopeModel) { _, _ in save() }
            HStack {
                Text("Duration")
                Spacer()
                TextField("—", text: $data.duration)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 60)
                    .onChange(of: data.duration) { _, _ in save() }
                Text("min").foregroundStyle(.secondary)
            }
            Picker("Extent reached", selection: $data.extentReached) {
                ForEach([
                    "Rectum only", "Sigmoid", "Descending colon",
                    "Splenic flexure", "Transverse colon", "Hepatic flexure",
                    "Ascending colon", "Cecum", "Terminal ileum"
                ], id: \.self) { Text($0) }
            }
            .onChange(of: data.extentReached) { _, _ in
                if data.extentReached == "Terminal ileum" { data.ilealIntubation = true }
                save()
            }
            Toggle("Terminal ileum intubated", isOn: $data.ilealIntubation)
                .onChange(of: data.ilealIntubation) { _, _ in save() }
            Picker("Completion", selection: $data.quality) {
                ForEach([
                    "Complete", "Incomplete — poor prep", "Incomplete — patient intolerance",
                    "Incomplete — obstructing lesion", "Incomplete — technical"
                ], id: \.self) { Text($0) }
            }
            .onChange(of: data.quality) { _, _ in save() }

            chipMultiSelect("Interventions done", options: interventionOptions, selected: $data.interventionsDone)
                .onChange(of: data.interventionsDone) { _, _ in save() }
        }
    }

    // MARK: Segment sections

    private var rectumSection: some View {
        segmentSection("Rectum", normal: $data.rectumNormal,
                       findings: $data.rectumFindings, notes: $data.rectumNotes)
    }
    private var sigmoidSection: some View {
        segmentSection("Sigmoid Colon", normal: $data.sigmoidNormal,
                       findings: $data.sigmoidFindings, notes: $data.sigmoidNotes)
    }
    private var descendingSection: some View {
        segmentSection("Descending Colon", normal: $data.descendingNormal,
                       findings: $data.descendingFindings, notes: $data.descendingNotes)
    }
    private var splenicSection: some View {
        segmentSection("Splenic Flexure", normal: $data.splenicNormal,
                       findings: $data.splenicFindings, notes: $data.splenicNotes)
    }
    private var transverseSection: some View {
        segmentSection("Transverse Colon", normal: $data.transverseNormal,
                       findings: $data.transverseFindings, notes: $data.transverseNotes)
    }
    private var hepaticSection: some View {
        segmentSection("Hepatic Flexure", normal: $data.hepaticNormal,
                       findings: $data.hepaticFindings, notes: $data.hepaticNotes)
    }
    private var ascendingSection: some View {
        segmentSection("Ascending Colon", normal: $data.ascendingNormal,
                       findings: $data.ascendingFindings, notes: $data.ascendingNotes)
    }
    private var cecumSection: some View {
        segmentSection("Cecum", normal: $data.cecumNormal,
                       findings: $data.cecumFindings, notes: $data.cecumNotes)
    }

    private var terminalIleumSection: some View {
        Section("Terminal Ileum") {
            Toggle("Normal", isOn: $data.terminalIleumNormal)
                .onChange(of: data.terminalIleumNormal) { _, _ in save() }
            if !data.terminalIleumNormal {
                chipMultiSelect("Findings", options: ileumFindingOptions,
                                selected: $data.terminalIleumFindings)
                    .onChange(of: data.terminalIleumFindings) { _, _ in save() }
                TextField("Notes", text: $data.terminalIleumNotes, axis: .vertical)
                    .lineLimit(2...)
                    .onChange(of: data.terminalIleumNotes) { _, _ in save() }
            }
        }
    }

    @ViewBuilder
    private func segmentSection(
        _ title: String,
        normal: Binding<Bool>,
        findings: Binding<[String]>,
        notes: Binding<String>
    ) -> some View {
        Section(title) {
            Toggle("Normal", isOn: normal)
                .onChange(of: normal.wrappedValue) { _, _ in save() }
            if !normal.wrappedValue {
                chipMultiSelect("Findings", options: colonFindingOptions, selected: findings)
                    .onChange(of: findings.wrappedValue) { _, _ in save() }
                TextField("Notes", text: notes, axis: .vertical)
                    .lineLimit(2...)
                    .onChange(of: notes.wrappedValue) { _, _ in save() }
            }
        }
    }

    // MARK: Biopsy

    private var biopsySection: some View {
        Section("Biopsies") {
            Toggle("Biopsy taken", isOn: $data.biopsyTaken)
                .onChange(of: data.biopsyTaken) { _, _ in save() }
            if data.biopsyTaken {
                chipMultiSelect("Sites", options: [
                    "Rectum", "Sigmoid", "Descending colon", "Transverse colon",
                    "Ascending colon", "Cecum", "Terminal ileum", "Polyp", "Mass", "Other"
                ], selected: $data.biopsySites)
                .onChange(of: data.biopsySites) { _, _ in save() }
                TextField("Biopsy notes", text: $data.biopsyNotes, axis: .vertical)
                    .lineLimit(2...)
                    .onChange(of: data.biopsyNotes) { _, _ in save() }
            }
        }
    }

    // MARK: Interventions

    private var interventionsSection: some View {
        Section("Intervention Notes") {
            TextField("Details of interventions performed", text: $data.interventionNotes, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.interventionNotes) { _, _ in save() }
        }
    }

    // MARK: Complications

    private var complicationsSection: some View {
        Section("Outcome & Complications") {
            chipMultiSelect("Complications", options: complicationOptions, selected: $data.complications)
                .onChange(of: data.complications) { _, _ in save() }
            if !data.complications.isEmpty && !data.complications.contains("None") {
                TextField("Complication details", text: $data.complicationNotes, axis: .vertical)
                    .lineLimit(2...)
                    .onChange(of: data.complicationNotes) { _, _ in save() }
            }
        }
    }

    // MARK: Impression

    private var impressionSection: some View {
        Section {
            TextField("Endoscopic impression", text: $data.impression, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.impression) { _, _ in save() }
            TextField("Recommendations / management", text: $data.recommendations, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.recommendations) { _, _ in save() }
            TextField("Surveillance interval (if applicable)", text: $data.surveillance)
                .onChange(of: data.surveillance) { _, _ in save() }
            HStack {
                Text("Follow-up")
                Spacer()
                TextField("—", text: $data.followUpWeeks)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 50)
                    .onChange(of: data.followUpWeeks) { _, _ in save() }
                Text("weeks").foregroundStyle(.secondary)
            }
        } header: {
            HStack {
                Text("Impression & Plan")
                Spacer()
                MedicalDictationButton(mode: .endoscopy, patient: patient) { polished in
                    data.impression += (data.impression.isEmpty ? "" : "\n\n") + polished
                    save()
                }
            }
        }
    }

    // MARK: Helpers

    private func save() {
        patient.colonoscopyData = data
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    @ViewBuilder
    private func chipMultiSelect(_ label: String, options: [String], selected: Binding<[String]>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if !label.isEmpty {
                Text(label).font(.system(size: 12)).foregroundStyle(.secondary)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(options, id: \.self) { opt in
                        let on = selected.wrappedValue.contains(opt)
                        Button {
                            if on { selected.wrappedValue.removeAll { $0 == opt } }
                            else  { selected.wrappedValue.append(opt) }
                        } label: {
                            Text(opt)
                                .font(.system(size: 11, weight: on ? .semibold : .regular))
                                .foregroundStyle(on ? .white : .primary)
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(on ? AMColor.accent : Color.secondary.opacity(0.12), in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}
