import SwiftUI
import SwiftData

// MARK: - View

struct SurgeryNoteView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State var data: SurgeryNoteData = SurgeryNoteData()
    @State private var hasSurgeryDate = false
    @State var hasStartTime = false
    @State var hasEndTime = false
    @State private var pdfWrapper: PDFDataWrapper?
    @State private var showTemplatePicker = false
    @State private var suggestedTemplate: ProcedureTemplate? = nil

    @StateObject private var ai = AIService()
    @State private var aiError: String?
    @State private var showAIOverwriteConfirm = false

    let positionOptions = ["Supine", "Lithotomy", "Lateral decubitus (R)", "Lateral decubitus (L)",
                                   "Prone", "Beach chair", "Lloyd-Davies", "Reverse Trendelenburg", "Trendelenburg"]
    let positioningExtras = ["Gel pads", "Bean bag", "Shoulder roll", "Arm board", "Leg stirrups",
                                     "Head ring", "Prone frame", "Axillary roll"]
    let airwayOptions = ["ETT", "LMA", "Spinal", "Epidural", "Regional block", "Local", "MAC", "Awake FOI"]
    let complicationOptions = ["Haemorrhage", "Visceral injury", "Vascular injury",
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

    var canGenerateAI: Bool {
        !data.procedureName.isEmpty || patient.workingDiagnosis != nil
    }

    var hasExistingTechniqueContent: Bool {
        !data.indication.isEmpty || !data.procedureDescription.isEmpty || !data.findingsIntraoperative.isEmpty
    }

    func triggerAIGeneration() {
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
}
