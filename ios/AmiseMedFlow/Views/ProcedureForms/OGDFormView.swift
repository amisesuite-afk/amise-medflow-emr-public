import SwiftUI
import SwiftData

// MARK: - View

struct OGDFormView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) var context

    @State var data: OGDData = OGDData()
    @State var hasProcedureDate = false
    @StateObject private var ai = AIService()
    @State var aiError: String?
    @State var showAIOverwriteConfirm = false
    @State var pdfWrapper: PDFDataWrapper?

    let indications = [
        "Dyspepsia / reflux", "Dysphagia", "Haematemesis / melaena",
        "Anaemia", "Weight loss", "Abdominal pain", "Barrett's surveillance",
        "Coeliac screen", "Post-surgery follow-up", "Foreign body removal", "Other"
    ]
    let oesophagusOptions = [
        "Oesophagitis (Grade A)", "Oesophagitis (Grade B)", "Oesophagitis (Grade C)", "Oesophagitis (Grade D)",
        "Barrett's oesophagus", "Hiatus hernia", "Stricture", "Varices", "Schatzki ring",
        "Webs", "Candidiasis", "Diverticulum", "Polyp"
    ]
    let stomachOptions = [
        "Gastritis", "Erosions", "Ulcer (prepyloric)", "Ulcer (lesser curve)",
        "Ulcer (greater curve)", "Ulcer (fundus)", "Atrophy", "Metaplasia",
        "Polyp", "GAVE", "Portal hypertensive gastropathy", "Submucosal lesion",
        "Post-surgical changes"
    ]
    let duodenumOptions = [
        "Normal D1", "Duodenitis", "Ulcer D1", "Ulcer D2",
        "Polyp", "Villous atrophy", "Submucosal lesion", "Parasites"
    ]
    let interventionOptions = [
        "Biopsy", "Polypectomy", "APC", "Injection sclerotherapy",
        "Band ligation (varices)", "Haemostatic clip", "Adrenaline injection",
        "Dilation (Savary)", "Balloon dilation", "Foreign body removal",
        "PEG insertion", "Stent insertion"
    ]

    var body: some View {
        Form {
            preProcedureLabsSection
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
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    pdfWrapper = PDFDataWrapper(data: ProcedureFormPDF.ogdReport(patient: patient, data: data))
                } label: {
                    Label("Export PDF", systemImage: "arrow.up.doc.fill")
                }
            }
        }
        .sheet(item: $pdfWrapper) { wrapper in
            ShareSheet(items: [wrapper.data])
        }
        .onAppear {
            data = patient.ogdData
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
            // Pre-fill normal impression when all segments are normal and form is fresh
            if data.impression.isEmpty && data.oesophagusNormal && data.stomachNormal && data.duodenumNormal {
                let op = data.operator_.isEmpty ? "the endoscopist" : data.operator_
                data.impression = "OGD performed by \(op). " +
                    "The oesophagus was normal with no mucosal lesion, Barrett's change, or hiatus hernia identified. " +
                    "The gastro-oesophageal junction was well defined. " +
                    "Retroflexion in the fundus showed a normal cardia. " +
                    "The stomach — body, antrum, and pylorus — was normal with no ulceration, mass, or haemorrhage. " +
                    "The duodenum to D2 was normal. " +
                    "No biopsies taken. Procedure completed without complication."
            }
            save()
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
        } catch is AIError {
            // AI disabled — pre-fill from available structured data
            let indication = data.indication.isEmpty ? (patient.chiefComplaint ?? patient.workingDiagnosis ?? "") : data.indication.joined(separator: ", ")
            if data.oesophagusNotes.isEmpty { data.oesophagusNotes = "Oesophagus: Normal mucosa. No stricture, varices, or Barrett's change." }
            if data.stomachNotes.isEmpty    { data.stomachNotes = "Stomach: Normal appearing mucosa. No ulceration or mass." }
            if data.duodenumNotes.isEmpty   { data.duodenumNotes = "Duodenum: Normal first and second part. No duodenal ulceration." }
            if data.impression.isEmpty, !indication.isEmpty { data.impression = "OGD for \(indication). Findings as above." }
            if data.recommendations.isEmpty { data.recommendations = "Follow-up as clinically indicated." }
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

}
