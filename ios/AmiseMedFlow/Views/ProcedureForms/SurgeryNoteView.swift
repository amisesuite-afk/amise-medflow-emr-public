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
    @State private var pdfWrapper: PDFDataWrapper?
    @State private var showTemplatePicker = false
    @State private var suggestedTemplate: ProcedureTemplate? = nil

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
            templatePickerSection
            teamSection
            anaesthesiaSection
            whoChecklistSection
            preOpLabsSection
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
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    pdfWrapper = PDFDataWrapper(data: ProcedureFormPDF.operativeNote(patient: patient, data: data))
                } label: {
                    Label("Export PDF", systemImage: "arrow.up.doc.fill")
                }
            }
        }
        .sheet(item: $pdfWrapper) { wrapper in
            ShareSheet(items: [wrapper.data])
        }
        .sheet(isPresented: $showTemplatePicker) {
            ProcedurePickerSheet { template in
                template.applySurgeryFields(to: &data)
                save()
            }
        }
        .onAppear {
            data = patient.surgeryData
            hasSurgeryDate = data.dateOfSurgery != nil
            hasStartTime = data.startTime != nil
            hasEndTime = data.endTime != nil
            if data.dateOfSurgery == nil, let opDate = patient.operationDate {
                data.dateOfSurgery = opDate
                hasSurgeryDate = true
            }
            if data.procedureName.isEmpty {
                data.procedureName = patient.appointmentType ?? patient.chiefComplaint ?? ""
            }
            if data.indication.isEmpty, let cc = patient.chiefComplaint, !cc.isEmpty {
                data.indication = cc
            }
            // Suggest a template if the procedure name already matches one
            // but the standard fields haven't been filled yet
            if data.anaesthesiaType == "General" && data.incision.isEmpty && data.procedureDescription.isEmpty {
                suggestedTemplate = matchTemplate(for: data.procedureName)
            }
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
        } catch is AIError {
            // AI disabled pending HIPAA BAA — pre-fill from available structured data
            let proc = data.procedureName.isEmpty ? (patient.workingDiagnosis ?? "surgical procedure") : data.procedureName
            if data.indication.isEmpty {
                data.indication = patient.chiefComplaint ?? patient.workingDiagnosis ?? ""
            }
            let labs = LabPanel.parse(from: patient.investigations)
            var labNote = ""
            if let hb = labs.haemoglobin { labNote += String(format: " Pre-op Hb %.1f g/dL.", hb.value) }
            if let inr = labs.inr        { labNote += String(format: " INR %.1f.", inr.value) }
            if data.findingsIntraoperative.isEmpty {
                data.findingsIntraoperative = "Intraoperative findings for \(proc) to be documented.\(labNote)"
            }
            if data.postOpOrders.isEmpty {
                data.postOpOrders = "Routine post-operative care. Follow-up in \(data.followUpWeeks) weeks."
            }
            save()
        } catch {
            aiError = error.localizedDescription
        }
    }

    // MARK: Pre-op Labs (read-only)

    @ViewBuilder
    private var preOpLabsSection: some View {
        let labs = LabPanel.parse(from: patient.investigations)
        let hasAny = labs.haemoglobin != nil || labs.wbc != nil || labs.platelets != nil ||
                     labs.inr != nil || labs.sodium != nil || labs.potassium != nil || labs.creatinine != nil

        if hasAny {
            Section {
                if let hb = labs.haemoglobin {
                    surgLabRow("Haemoglobin", value: String(format: "%.1f g/dL", hb.value),
                               flag: hb.value < 10 ? "Low" : nil, critical: hb.value < 8)
                }
                if let wbc = labs.wbc {
                    surgLabRow("WBC", value: String(format: "%.1f ×10⁹/L", wbc.value), flag: nil, critical: false)
                }
                if let plt = labs.platelets {
                    surgLabRow("Platelets", value: "\(Int(plt.value)) ×10⁹/L",
                               flag: plt.value < 100 ? "Low" : nil, critical: plt.value < 50)
                }
                if let inr = labs.inr {
                    surgLabRow("INR", value: String(format: "%.1f", inr.value),
                               flag: inr.value > 1.5 ? "Elevated — coagulopathy" : nil, critical: inr.value > 2.5)
                }
                if let na = labs.sodium {
                    surgLabRow("Sodium", value: "\(Int(na.value)) mmol/L",
                               flag: (na.value < 130 || na.value > 150) ? "Abnormal" : nil,
                               critical: na.value < 120 || na.value > 155)
                }
                if let k = labs.potassium {
                    surgLabRow("Potassium", value: String(format: "%.1f mmol/L", k.value),
                               flag: (k.value < 3.0 || k.value > 5.5) ? "Abnormal" : nil,
                               critical: k.value < 2.5 || k.value > 6.0)
                }
                if let cr = labs.creatinine {
                    surgLabRow("Creatinine", value: "\(Int(cr.value)) µmol/L",
                               flag: cr.value > 130 ? "Elevated" : nil, critical: cr.value > 300)
                }
            } header: {
                Text("Pre-operative Results")
            } footer: {
                if labs.hasCriticalValues {
                    Label("Critical lab values — anaesthetist must be informed", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption2).foregroundStyle(.red)
                }
            }
        }
    }

    private func surgLabRow(_ name: String, value: String, flag: String?, critical: Bool) -> some View {
        HStack {
            Text(name).foregroundStyle(.primary)
            Spacer()
            if let f = flag {
                Text(f)
                    .font(.caption)
                    .foregroundStyle(critical ? .red : .orange)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background((critical ? Color.red : Color.orange).opacity(0.1), in: Capsule())
            }
            Text(value)
                .font(.system(.subheadline, design: .monospaced))
                .foregroundStyle(critical ? .red : flag != nil ? .orange : .secondary)
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

    private var templatePickerSection: some View {
        Section {
            Button {
                showTemplatePicker = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "doc.text.magnifyingglass")
                        .font(.system(size: 18))
                        .foregroundStyle(AMColor.accent)
                        .frame(width: 28)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Load Procedure Template")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.primary)
                        Text(data.procedureName.isEmpty
                             ? "Pre-fills anaesthesia, position, incision, technique & closure"
                             : "Loaded: \(data.procedureName)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.tertiary)
                }
                .padding(.vertical, 4)
            }
            .buttonStyle(.plain)
        } footer: {
            Text("Selecting a template pre-fills the standard fields. Patient-specific findings and team details are always entered manually.")
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
            staffField("Surgeon", text: $data.surgeon, role: .surgeon)
            staffField("Assistant(s)", text: $data.assistant, role: .assistant)
            staffField("Anaesthetist", text: $data.anaesthetist, role: .anaesthetist)
            staffField("Scrub nurse", text: $data.scrubNurse, role: .nurse)
            staffField("Circulating nurse", text: $data.circNurse, role: .nurse)
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
                .onChange(of: data.procedureName) { _, new in
                    save()
                    suggestedTemplate = matchTemplate(for: new)
                }

            if let t = suggestedTemplate {
                Button {
                    t.applySurgeryFields(to: &data)
                    suggestedTemplate = nil
                    save()
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 14))
                            .foregroundStyle(AMColor.accent)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Apply "\(t.name)" template")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(AMColor.accent)
                            Text("Pre-fills anaesthesia · position · incision · technique · closure")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button {
                            suggestedTemplate = nil
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.tertiary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.vertical, 4)
                }
                .buttonStyle(.plain)
                .listRowBackground(AMColor.accentLt.opacity(0.25))
            }

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
        if data.surgeon.count >= 4      { StaffRegistry.shared.add(data.surgeon,       to: .surgeon) }
        if data.assistant.count >= 4    { StaffRegistry.shared.add(data.assistant,     to: .assistant) }
        if data.anaesthetist.count >= 4 { StaffRegistry.shared.add(data.anaesthetist,  to: .anaesthetist) }
        if data.scrubNurse.count >= 4   { StaffRegistry.shared.add(data.scrubNurse,    to: .nurse) }
        if data.circNurse.count >= 4    { StaffRegistry.shared.add(data.circNurse,     to: .nurse) }
        patient.surgeryData = data
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    // Returns the best-matching template when the user types a procedure name,
    // so we can surface a one-tap "Apply template" suggestion without requiring
    // the surgeon to know the picker exists.
    private func matchTemplate(for name: String) -> ProcedureTemplate? {
        let q = name.trimmingCharacters(in: .whitespaces).lowercased()
        guard q.count >= 4 else { return nil }
        // Exact or substring match first
        if let t = ProcedureTemplate.all.first(where: { $0.name.lowercased().contains(q) || q.contains($0.name.lowercased()) }) {
            return t
        }
        // Word-overlap: require at least 2 significant words to match
        let stopWords: Set<String> = ["the","and","or","of","for","a","an","with","on","in","to"]
        let queryWords = Set(q.components(separatedBy: .whitespacesAndNewlines)
            .map { $0.trimmingCharacters(in: .punctuationCharacters) }
            .filter { $0.count > 2 && !stopWords.contains($0) })
        return ProcedureTemplate.all.first { template in
            let tWords = Set(template.name.lowercased().components(separatedBy: .whitespacesAndNewlines)
                .filter { $0.count > 2 && !stopWords.contains($0) })
            return queryWords.intersection(tWords).count >= 2
        }
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
    private func staffField(_ label: String, text: Binding<String>, role: StaffRegistry.Role) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            TextField(label, text: text).onChange(of: text.wrappedValue) { _, _ in save() }
            let q = text.wrappedValue.lowercased()
            let names = StaffRegistry.shared.names(for: role).filter { q.isEmpty || $0.lowercased().contains(q) }
            let showSuggestions = !names.isEmpty && !names.contains(text.wrappedValue)
            if showSuggestions {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(names, id: \.self) { name in
                            Button {
                                text.wrappedValue = name
                                save()
                            } label: {
                                Text(name)
                                    .font(.system(size: 11))
                                    .padding(.horizontal, 8).padding(.vertical, 3)
                                    .background(Color.secondary.opacity(0.12), in: Capsule())
                                    .foregroundStyle(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
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
