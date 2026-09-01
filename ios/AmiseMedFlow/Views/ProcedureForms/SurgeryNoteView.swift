import SwiftUI
import SwiftData

// MARK: - Data model

struct SurgeryNoteData: Codable {
    // Preamble
    var dateOfSurgery: Date?
    var surgeon: String = ""
    var assistant: String = ""
    var anaesthetist: String = ""
    var scrubNurse: String = ""
    var circNurse: String = ""

    // Anaesthesia
    var anaesthesiaType: String = "General"
    var anaesthesiaDetails: String = ""
    var airwayManagement: String = "ETT"

    // Procedure info
    var procedureName: String = ""
    var procedureType: String = "Elective"
    var position: String = "Supine"
    var positioning: [String] = []
    var skinPrep: String = "Chlorhexidine/alcohol"
    var draping: String = "Standard surgical draping"

    // WHO checklist
    var whoSignIn: Bool = false
    var whoTimeout: Bool = false
    var whoSignOut: Bool = false

    // Findings
    var indication: String = ""
    var findingsIntraoperative: String = ""

    // Procedure description
    var incision: String = ""
    var procedureDescription: String = ""
    var haemostasis: String = ""
    var closure: String = ""

    // Specimens
    var specimensSent: Bool = false
    var specimensDetails: String = ""

    // Implants
    var implantsUsed: Bool = false
    var implantsDetails: String = ""

    // Drain / catheter
    var drainInserted: Bool = false
    var drainType: String = ""
    var catheterInserted: Bool = false

    // Blood loss / fluids
    var eblMl: String = ""
    var fluidsMl: String = ""
    var bloodProductsMl: String = ""
    var urineOutputMl: String = ""

    // Duration
    var startTime: Date?
    var endTime: Date?
    var durationMinutes: Int {
        guard let s = startTime, let e = endTime else { return 0 }
        return max(0, Int(e.timeIntervalSince(s) / 60))
    }

    // Complications
    var intraopComplications: [String] = []
    var intraopComplicationNotes: String = ""

    // Post-op
    var recoveryRoom: String = "Smooth recovery"
    var postOpOrders: String = ""
    var followUpWeeks: String = "2"
}

extension Patient {
    var surgeryData: SurgeryNoteData {
        get {
            guard let json = surgeryDataJson, let data = json.data(using: .utf8) else { return SurgeryNoteData() }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            return (try? decoder.decode(SurgeryNoteData.self, from: data)) ?? SurgeryNoteData()
        }
        set {
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            surgeryDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}

// MARK: - View

struct SurgeryNoteView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State private var data: SurgeryNoteData = SurgeryNoteData()
    @State private var hasSurgeryDate = false
    @State private var hasStartTime = false
    @State private var hasEndTime = false

    @StateObject private var ai = AIService()
    @State private var aiError: String?
    @State private var showAIOverwriteConfirm = false

    private let positionOptions = ["Supine", "Lithotomy", "Lateral decubitus (R)", "Lateral decubitus (L)",
                                   "Prone", "Beach chair", "Lloyd-Davies", "Reverse Trendelenburg", "Trendelenburg"]
    private let positioningExtras = ["Gel pads", "Bean bag", "Shoulder roll", "Arm board", "Leg stirrups",
                                     "Head ring", "Prone frame", "Axillary roll"]
    private let airwayOptions = ["ETT", "LMA", "Spinal", "Epidural", "Regional block", "Local", "MAC", "Awake FOI"]
    private let complicationOptions = ["Haemorrhage", "Visceral injury", "Vascular injury",
                                       "Anaesthetic complication", "Cardiac event", "Equipment failure",
                                       "Conversion to open", "Inadvertent enterotomy", "None"]

    var body: some View {
        Form {
            teamSection
            anaesthesiaSection
            whoChecklistSection
            procedureSection
            aiGenerateSection
            findingsSection
            descriptionSection
            specimensSection
            bloodFluidSection
            timingSection
            complicationsSection
            postOpSection
        }
        .navigationTitle("Operative Note")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            data = patient.surgeryData
            hasSurgeryDate = data.dateOfSurgery != nil
            hasStartTime = data.startTime != nil
            hasEndTime = data.endTime != nil
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
            "Overwrite existing technique?",
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
        !data.procedureName.isEmpty || patient.workingDiagnosis != nil
    }

    private var hasExistingTechniqueContent: Bool {
        !data.indication.isEmpty || !data.procedureDescription.isEmpty || !data.findingsIntraoperative.isEmpty
    }

    private func triggerAIGeneration() {
        if hasExistingTechniqueContent {
            showAIOverwriteConfirm = true
        } else {
            Task { await runAIGeneration() }
        }
    }

    @MainActor
    private func runAIGeneration() async {
        do {
            let result = try await ai.generateOperativeTechnique(
                patient: patient,
                procedureName: data.procedureName.isEmpty ? (patient.workingDiagnosis ?? "surgery") : data.procedureName,
                position: data.position,
                anaesthesiaType: data.anaesthesiaType
            )
            if !result.indication.isEmpty            { data.indication = result.indication }
            if !result.findingsIntraoperative.isEmpty { data.findingsIntraoperative = result.findingsIntraoperative }
            if !result.incision.isEmpty              { data.incision = result.incision }
            if !result.procedureDescription.isEmpty  { data.procedureDescription = result.procedureDescription }
            if !result.closure.isEmpty               { data.closure = result.closure }
            if !result.postOpOrders.isEmpty          { data.postOpOrders = result.postOpOrders }
            save()
        } catch {
            aiError = error.localizedDescription
        }
    }

    // MARK: Sections

    private var aiGenerateSection: some View {
        Section {
            let hasContext = canGenerateAI
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 10) {
                    if ai.isGenerating {
                        ProgressView()
                            .controlSize(.small)
                        Text("Generating operative technique…")
                            .font(.system(size: 13))
                            .foregroundStyle(.secondary)
                    } else {
                        Image(systemName: "wand.and.sparkles")
                            .font(.system(size: 16))
                            .foregroundStyle(hasContext ? AMColor.accent : .secondary)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("AI Generate Technique")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(hasContext ? .primary : .secondary)
                            Text(hasContext
                                 ? "Auto-fills indication, technique, findings & post-op orders"
                                 : "Enter a procedure name or working diagnosis first")
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
            }
            .padding(.vertical, 2)
        } header: {
            Text("AI Assistance")
        } footer: {
            Text("AI-generated content is pre-filled as a draft. Review and edit before signing.")
                .font(.caption2)
        }
    }

    private var teamSection: some View {
        Section("Surgical Team") {
            Toggle("Date of surgery", isOn: $hasSurgeryDate)
                .onChange(of: hasSurgeryDate) { _, on in
                    data.dateOfSurgery = on ? (data.dateOfSurgery ?? .now) : nil; save()
                }
            if hasSurgeryDate {
                DatePicker("Date", selection: Binding(
                    get: { data.dateOfSurgery ?? .now },
                    set: { data.dateOfSurgery = $0; save() }
                ), displayedComponents: [.date, .hourAndMinute])
            }
            TextField("Surgeon", text: $data.surgeon).onChange(of: data.surgeon) { _, _ in save() }
            TextField("Assistant(s)", text: $data.assistant).onChange(of: data.assistant) { _, _ in save() }
            TextField("Anaesthetist", text: $data.anaesthetist).onChange(of: data.anaesthetist) { _, _ in save() }
            TextField("Scrub nurse", text: $data.scrubNurse).onChange(of: data.scrubNurse) { _, _ in save() }
            TextField("Circulating nurse", text: $data.circNurse).onChange(of: data.circNurse) { _, _ in save() }
        }
    }

    private var anaesthesiaSection: some View {
        Section("Anaesthesia") {
            Picker("Type", selection: $data.anaesthesiaType) {
                ForEach(["General", "Spinal", "Epidural", "Combined spinal-epidural",
                         "Regional", "Local", "MAC", "Awake"], id: \.self) { Text($0) }
            }
            .onChange(of: data.anaesthesiaType) { _, _ in save() }
            Picker("Airway", selection: $data.airwayManagement) {
                ForEach(airwayOptions, id: \.self) { Text($0) }
            }
            .onChange(of: data.airwayManagement) { _, _ in save() }
            TextField("Details (agents/doses)", text: $data.anaesthesiaDetails, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.anaesthesiaDetails) { _, _ in save() }
        }
    }

    private var whoChecklistSection: some View {
        Section("WHO Surgical Safety Checklist") {
            Toggle("Sign-in completed", isOn: $data.whoSignIn)
                .onChange(of: data.whoSignIn) { _, _ in save() }
            Toggle("Time-out completed", isOn: $data.whoTimeout)
                .onChange(of: data.whoTimeout) { _, _ in save() }
            Toggle("Sign-out completed", isOn: $data.whoSignOut)
                .onChange(of: data.whoSignOut) { _, _ in save() }

            HStack(spacing: 16) {
                whoIcon("Sign-in", done: data.whoSignIn)
                whoIcon("Time-out", done: data.whoTimeout)
                whoIcon("Sign-out", done: data.whoSignOut)
                Spacer()
                if data.whoSignIn && data.whoTimeout && data.whoSignOut {
                    Label("All complete", systemImage: "checkmark.seal.fill")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.green)
                }
            }
            .padding(.vertical, 4)
            .listRowBackground(
                (data.whoSignIn && data.whoTimeout && data.whoSignOut)
                    ? Color.green.opacity(0.06)
                    : Color.orange.opacity(0.06)
            )
        }
    }

    private var procedureSection: some View {
        Section("Procedure") {
            TextField("Procedure name", text: $data.procedureName, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.procedureName) { _, _ in save() }
            Picker("Type", selection: $data.procedureType) {
                ForEach(["Elective", "Urgent", "Emergency", "Staged"], id: \.self) { Text($0) }
            }
            .onChange(of: data.procedureType) { _, _ in save() }
            Picker("Position", selection: $data.position) {
                ForEach(positionOptions, id: \.self) { Text($0) }
            }
            .onChange(of: data.position) { _, _ in save() }
            chipMultiSelect("Positioning extras", options: positioningExtras, selected: $data.positioning)
                .onChange(of: data.positioning) { _, _ in save() }
            TextField("Skin prep", text: $data.skinPrep)
                .onChange(of: data.skinPrep) { _, _ in save() }
            TextField("Draping", text: $data.draping)
                .onChange(of: data.draping) { _, _ in save() }
        }
    }

    private var findingsSection: some View {
        Section {
            TextField("Indication", text: $data.indication, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.indication) { _, _ in save() }
            TextField("Intraoperative findings", text: $data.findingsIntraoperative, axis: .vertical)
                .lineLimit(4...)
                .onChange(of: data.findingsIntraoperative) { _, _ in save() }
        } header: {
            HStack {
                Text("Indication & Findings")
                Spacer()
                MedicalDictationButton(mode: .operativeNote, patient: patient) { polished in
                    data.findingsIntraoperative += (data.findingsIntraoperative.isEmpty ? "" : "\n\n") + polished
                    save()
                }
            }
        }
    }

    private var descriptionSection: some View {
        Section {
            TextField("Incision", text: $data.incision)
                .onChange(of: data.incision) { _, _ in save() }
            TextField("Procedure description", text: $data.procedureDescription, axis: .vertical)
                .lineLimit(8...)
                .onChange(of: data.procedureDescription) { _, _ in save() }
            TextField("Haemostasis", text: $data.haemostasis)
                .onChange(of: data.haemostasis) { _, _ in save() }
            TextField("Closure", text: $data.closure, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.closure) { _, _ in save() }
            Toggle("Drain inserted", isOn: $data.drainInserted)
                .onChange(of: data.drainInserted) { _, _ in save() }
            if data.drainInserted {
                TextField("Drain type/site", text: $data.drainType)
                    .onChange(of: data.drainType) { _, _ in save() }
            }
            Toggle("Urinary catheter", isOn: $data.catheterInserted)
                .onChange(of: data.catheterInserted) { _, _ in save() }
        } header: {
            HStack {
                Text("Operative Description")
                Spacer()
                MedicalDictationButton(mode: .operativeNote, patient: patient) { polished in
                    data.procedureDescription += (data.procedureDescription.isEmpty ? "" : "\n\n") + polished
                    save()
                }
            }
        }
    }

    private var specimensSection: some View {
        Section("Specimens & Implants") {
            Toggle("Specimen(s) sent", isOn: $data.specimensSent)
                .onChange(of: data.specimensSent) { _, _ in save() }
            if data.specimensSent {
                TextField("Specimen details", text: $data.specimensDetails, axis: .vertical)
                    .lineLimit(2...)
                    .onChange(of: data.specimensDetails) { _, _ in save() }
            }
            Toggle("Implant(s) used", isOn: $data.implantsUsed)
                .onChange(of: data.implantsUsed) { _, _ in save() }
            if data.implantsUsed {
                TextField("Implant details (type/size/lot)", text: $data.implantsDetails, axis: .vertical)
                    .lineLimit(2...)
                    .onChange(of: data.implantsDetails) { _, _ in save() }
            }
        }
    }

    private var bloodFluidSection: some View {
        Section("Blood Loss & Fluids") {
            fluidRow("EBL (mL)", value: $data.eblMl)
            fluidRow("Fluids in (mL)", value: $data.fluidsMl)
            fluidRow("Blood products (mL)", value: $data.bloodProductsMl)
            fluidRow("Urine output (mL)", value: $data.urineOutputMl)
        }
    }

    private var timingSection: some View {
        Section("Timing") {
            Toggle("Knife-to-skin time", isOn: $hasStartTime)
                .onChange(of: hasStartTime) { _, on in
                    data.startTime = on ? (data.startTime ?? .now) : nil; save()
                }
            if hasStartTime {
                DatePicker("Start", selection: Binding(
                    get: { data.startTime ?? .now },
                    set: { data.startTime = $0; save() }
                ), displayedComponents: [.date, .hourAndMinute])
            }
            Toggle("Wound closure time", isOn: $hasEndTime)
                .onChange(of: hasEndTime) { _, on in
                    data.endTime = on ? (data.endTime ?? .now) : nil; save()
                }
            if hasEndTime {
                DatePicker("End", selection: Binding(
                    get: { data.endTime ?? .now },
                    set: { data.endTime = $0; save() }
                ), displayedComponents: [.date, .hourAndMinute])
            }
            if data.durationMinutes > 0 {
                LabeledContent("Duration") {
                    Text("\(data.durationMinutes) min (\(String(format: "%.1f", Double(data.durationMinutes) / 60)) h)")
                        .font(.system(size: 14, weight: .semibold))
                }
            }
        }
    }

    private var complicationsSection: some View {
        Section("Intraoperative Complications") {
            chipMultiSelect("Complications", options: complicationOptions, selected: $data.intraopComplications)
                .onChange(of: data.intraopComplications) { _, _ in save() }
            if !data.intraopComplications.isEmpty && !data.intraopComplications.contains("None") {
                TextField("Complication details", text: $data.intraopComplicationNotes, axis: .vertical)
                    .lineLimit(2...)
                    .onChange(of: data.intraopComplicationNotes) { _, _ in save() }
            }
        }
    }

    private var postOpSection: some View {
        Section("Post-operative") {
            TextField("Recovery room", text: $data.recoveryRoom)
                .onChange(of: data.recoveryRoom) { _, _ in save() }
            TextField("Post-op orders / instructions", text: $data.postOpOrders, axis: .vertical)
                .lineLimit(4...)
                .onChange(of: data.postOpOrders) { _, _ in save() }
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
        patient.surgeryData = data
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    @ViewBuilder
    private func whoIcon(_ label: String, done: Bool) -> some View {
        VStack(spacing: 2) {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 20))
                .foregroundStyle(done ? .green : .secondary)
            Text(label).font(.system(size: 9)).foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private func fluidRow(_ label: String, value: Binding<String>) -> some View {
        HStack {
            Text(label)
            Spacer()
            TextField("—", text: value)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .frame(width: 80)
                .onChange(of: value.wrappedValue) { _, _ in save() }
        }
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
