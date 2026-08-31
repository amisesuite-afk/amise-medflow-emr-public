import SwiftUI
import SwiftData

// MARK: - Data model

struct OGDData: Codable {
    // Pre-procedure
    var indication: [String] = []
    var indicationOther: String = ""
    var consent: Bool = false
    var sedationUsed: String = "Midazolam + Fentanyl"
    var sedationDose: String = ""
    var antibiotic: Bool = false
    var antibioticUsed: String = ""
    var antispasmodic: Bool = false

    // Procedure
    var endoscopeModel: String = ""
    var operator_: String = ""
    var assistant: String = ""
    var dateOfProcedure: Date?
    var duration: String = ""    // minutes
    var quality: String = "Good"

    // Oesophagus findings
    var oesophagusNormal: Bool = true
    var oesophagusFindings: [String] = []
    var oesophagusNotes: String = ""
    var zLineCm: String = ""     // distance from incisors

    // Stomach findings
    var stomachNormal: Bool = true
    var stomachFindings: [String] = []
    var stomachNotes: String = ""

    // Duodenum findings
    var duodenumNormal: Bool = true
    var duodenumFindings: [String] = []
    var duodenumNotes: String = ""

    // Barrett's
    var barretts: Bool = false
    var barrettsCm: String = ""
    var pragueCmC: String = ""
    var pragueCmM: String = ""

    // H. pylori / biopsies
    var hpTestDone: Bool = false
    var hpResult: String = "Pending"
    var biopsyTaken: Bool = false
    var biopsySites: [String] = []
    var biopsyNotes: String = ""

    // Interventions
    var interventionsDone: [String] = []
    var interventionNotes: String = ""

    // Impression / plan
    var impression: String = ""
    var recommendations: String = ""
    var followUpWeeks: String = ""
}

extension Patient {
    var ogdData: OGDData {
        get {
            guard let json = ogdDataJson, let data = json.data(using: .utf8) else { return OGDData() }
            return (try? JSONDecoder().decode(OGDData.self, from: data)) ?? OGDData()
        }
        set {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            ogdDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}

// MARK: - View

struct OGDFormView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State private var data: OGDData = OGDData()
    @State private var hasProcedureDate = false
    @StateObject private var ai = AIService()
    @State private var aiError: String?
    @State private var showAIOverwriteConfirm = false

    private let indications = [
        "Dyspepsia / reflux", "Dysphagia", "Haematemesis / melaena",
        "Anaemia", "Weight loss", "Abdominal pain", "Barrett's surveillance",
        "Coeliac screen", "Post-surgery follow-up", "Foreign body removal", "Other"
    ]
    private let oesophagusOptions = [
        "Oesophagitis (Grade A)", "Oesophagitis (Grade B)", "Oesophagitis (Grade C)", "Oesophagitis (Grade D)",
        "Barrett's oesophagus", "Hiatus hernia", "Stricture", "Varices", "Schatzki ring",
        "Webs", "Candidiasis", "Diverticulum", "Polyp"
    ]
    private let stomachOptions = [
        "Gastritis", "Erosions", "Ulcer (prepyloric)", "Ulcer (lesser curve)",
        "Ulcer (greater curve)", "Ulcer (fundus)", "Atrophy", "Metaplasia",
        "Polyp", "GAVE", "Portal hypertensive gastropathy", "Submucosal lesion",
        "Post-surgical changes"
    ]
    private let duodenumOptions = [
        "Normal D1", "Duodenitis", "Ulcer D1", "Ulcer D2",
        "Polyp", "Villous atrophy", "Submucosal lesion", "Parasites"
    ]
    private let interventionOptions = [
        "Biopsy", "Polypectomy", "APC", "Injection sclerotherapy",
        "Band ligation (varices)", "Haemostatic clip", "Adrenaline injection",
        "Dilation (Savary)", "Balloon dilation", "Foreign body removal",
        "PEG insertion", "Stent insertion"
    ]

    var body: some View {
        Form {
            preProcedureSection
            procedureSection
            aiGenerateSection
            oesophagusSection
            stomachSection
            duodenumSection
            if data.barretts { barrettsSection }
            hpBiopsySection
            if !data.interventionsDone.isEmpty { interventionsSection }
            impressionSection
        }
        .navigationTitle("OGD Report")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            data = patient.ogdData
            hasProcedureDate = data.dateOfProcedure != nil
        }
        .alert("AI Error", isPresented: Binding(
            get: { aiError != nil },
            set: { if !$0 { aiError = nil } }
        )) {
            Button("OK") { aiError = nil }
        } message: {
            Text(aiError ?? "")
        }
        .confirmationDialog(
            "Overwrite existing report?",
            isPresented: $showAIOverwriteConfirm,
            titleVisibility: .visible
        ) {
            Button("Overwrite", role: .destructive) { Task { await runAIGeneration() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Some fields already contain content. AI-generated text will replace them.")
        }
    }

    private var canGenerateAI: Bool {
        !data.indication.isEmpty || patient.workingDiagnosis != nil
    }

    private var hasExistingContent: Bool {
        !data.impression.isEmpty || !data.oesophagusNotes.isEmpty || !data.stomachNotes.isEmpty
    }

    private func triggerAIGeneration() {
        if hasExistingContent {
            showAIOverwriteConfirm = true
        } else {
            Task { await runAIGeneration() }
        }
    }

    @MainActor
    private func runAIGeneration() async {
        do {
            let result = try await ai.generateOGDReport(
                patient: patient,
                indications: data.indication,
                indicationOther: data.indicationOther
            )
            if !result.oesophagusNotes.isEmpty { data.oesophagusNotes = result.oesophagusNotes }
            if !result.stomachNotes.isEmpty    { data.stomachNotes = result.stomachNotes }
            if !result.duodenumNotes.isEmpty   { data.duodenumNotes = result.duodenumNotes }
            if !result.impression.isEmpty      { data.impression = result.impression }
            if !result.recommendations.isEmpty { data.recommendations = result.recommendations }
            save()
        } catch {
            aiError = error.localizedDescription
        }
    }

    // MARK: AI generation

    private var aiGenerateSection: some View {
        Section {
            let hasContext = canGenerateAI
            HStack(spacing: 10) {
                if ai.isGenerating {
                    ProgressView().controlSize(.small)
                    Text("Generating OGD report…")
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                } else {
                    Image(systemName: "wand.and.sparkles")
                        .font(.system(size: 16))
                        .foregroundStyle(hasContext ? AMColor.accent : .secondary)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("AI Generate Report")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(hasContext ? .primary : .secondary)
                        Text(hasContext
                             ? "Auto-fills findings, impression & recommendations"
                             : "Select an indication or set a working diagnosis first")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if hasContext {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .contentShape(Rectangle())
            .onTapGesture {
                guard hasContext && !ai.isGenerating else { return }
                triggerAIGeneration()
            }
            .disabled(!hasContext || ai.isGenerating)
            .padding(.vertical, 2)
        } header: {
            Text("AI Assistance")
        } footer: {
            Text("AI-generated content is pre-filled as a draft. Review and edit before signing.")
                .font(.caption2)
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
        }
    }

    // MARK: Procedure details

    private var procedureSection: some View {
        Section("Procedure Details") {
            TextField("Endoscope model", text: $data.endoscopeModel)
                .onChange(of: data.endoscopeModel) { _, _ in save() }
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
            Picker("Quality / completion", selection: $data.quality) {
                ForEach(["Excellent", "Good", "Adequate", "Incomplete — patient intolerance", "Incomplete — technical"], id: \.self) { Text($0) }
            }
            .onChange(of: data.quality) { _, _ in save() }
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

    // MARK: Oesophagus

    private var oesophagusSection: some View {
        Section("Oesophagus") {
            Toggle("Normal", isOn: $data.oesophagusNormal)
                .onChange(of: data.oesophagusNormal) { _, _ in save() }
            if !data.oesophagusNormal {
                chipMultiSelect("Findings", options: oesophagusOptions, selected: $data.oesophagusFindings)
                    .onChange(of: data.oesophagusFindings) { _, _ in save() }
                HStack {
                    Text("Z-line from incisors")
                    Spacer()
                    TextField("—", text: $data.zLineCm).keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing).frame(width: 50)
                        .onChange(of: data.zLineCm) { _, _ in save() }
                    Text("cm").foregroundStyle(.secondary)
                }
                Toggle("Barrett's oesophagus", isOn: $data.barretts)
                    .onChange(of: data.barretts) { _, _ in save() }
                TextField("Notes", text: $data.oesophagusNotes, axis: .vertical).lineLimit(2...)
                    .onChange(of: data.oesophagusNotes) { _, _ in save() }
            }
        }
    }

    // MARK: Barrett's

    private var barrettsSection: some View {
        Section("Barrett's — Prague Criteria") {
            HStack {
                Text("Extent (C)")
                Spacer()
                TextField("cm", text: $data.pragueCmC).keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing).frame(width: 60)
                    .onChange(of: data.pragueCmC) { _, _ in save() }
                Text("cm").foregroundStyle(.secondary)
            }
            HStack {
                Text("Maximum (M)")
                Spacer()
                TextField("cm", text: $data.pragueCmM).keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing).frame(width: 60)
                    .onChange(of: data.pragueCmM) { _, _ in save() }
                Text("cm").foregroundStyle(.secondary)
            }
        }
    }

    // MARK: Stomach

    private var stomachSection: some View {
        Section("Stomach") {
            Toggle("Normal", isOn: $data.stomachNormal)
                .onChange(of: data.stomachNormal) { _, _ in save() }
            if !data.stomachNormal {
                chipMultiSelect("Findings", options: stomachOptions, selected: $data.stomachFindings)
                    .onChange(of: data.stomachFindings) { _, _ in save() }
                TextField("Notes", text: $data.stomachNotes, axis: .vertical).lineLimit(2...)
                    .onChange(of: data.stomachNotes) { _, _ in save() }
            }
        }
    }

    // MARK: Duodenum

    private var duodenumSection: some View {
        Section("Duodenum") {
            Toggle("Normal", isOn: $data.duodenumNormal)
                .onChange(of: data.duodenumNormal) { _, _ in save() }
            if !data.duodenumNormal {
                chipMultiSelect("Findings", options: duodenumOptions, selected: $data.duodenumFindings)
                    .onChange(of: data.duodenumFindings) { _, _ in save() }
                TextField("Notes", text: $data.duodenumNotes, axis: .vertical).lineLimit(2...)
                    .onChange(of: data.duodenumNotes) { _, _ in save() }
            }
        }
    }

    // MARK: H pylori / Biopsy

    private var hpBiopsySection: some View {
        Section("H. pylori & Biopsy") {
            Toggle("H. pylori test done", isOn: $data.hpTestDone)
                .onChange(of: data.hpTestDone) { _, _ in save() }
            if data.hpTestDone {
                Picker("Result", selection: $data.hpResult) {
                    ForEach(["Pending", "Positive", "Negative"], id: \.self) { Text($0) }
                }
                .onChange(of: data.hpResult) { _, _ in save() }
            }
            Toggle("Biopsy taken", isOn: $data.biopsyTaken)
                .onChange(of: data.biopsyTaken) { _, _ in save() }
            if data.biopsyTaken {
                chipMultiSelect("Biopsy sites", options: [
                    "Antrum", "Body", "Fundus", "Oesophagus (distal)", "Oesophagus (mid)", "D2", "Other"
                ], selected: $data.biopsySites)
                .onChange(of: data.biopsySites) { _, _ in save() }
                TextField("Biopsy notes", text: $data.biopsyNotes, axis: .vertical).lineLimit(2...)
                    .onChange(of: data.biopsyNotes) { _, _ in save() }
            }
        }
    }

    // MARK: Interventions

    private var interventionsSection: some View {
        Section("Interventions Performed") {
            chipMultiSelect("Interventions", options: interventionOptions, selected: $data.interventionsDone)
                .onChange(of: data.interventionsDone) { _, _ in save() }
            TextField("Intervention notes", text: $data.interventionNotes, axis: .vertical).lineLimit(2...)
                .onChange(of: data.interventionNotes) { _, _ in save() }
        }
    }

    // MARK: Impression

    private var impressionSection: some View {
        Section("Impression & Plan") {
            chipMultiSelect("Interventions done?", options: interventionOptions, selected: $data.interventionsDone)
                .onChange(of: data.interventionsDone) { _, _ in save() }
            TextField("Endoscopic impression", text: $data.impression, axis: .vertical).lineLimit(3...)
                .onChange(of: data.impression) { _, _ in save() }
            TextField("Recommendations / management", text: $data.recommendations, axis: .vertical).lineLimit(3...)
                .onChange(of: data.recommendations) { _, _ in save() }
            HStack {
                Text("Follow-up")
                Spacer()
                TextField("—", text: $data.followUpWeeks).keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing).frame(width: 50)
                    .onChange(of: data.followUpWeeks) { _, _ in save() }
                Text("weeks").foregroundStyle(.secondary)
            }
        }
    }

    // MARK: Helpers

    private func save() {
        patient.ogdData = data
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
                            else { selected.wrappedValue.append(opt) }
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
