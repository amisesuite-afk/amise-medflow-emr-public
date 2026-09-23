import SwiftUI
import SwiftData

// MARK: - View

struct ERCPFormView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State private var data: ERCPData = ERCPData()
    @State private var hasProcedureDate = false
    @StateObject private var ai = AIService()
    @State private var aiError: String?
    @State private var showAIOverwriteConfirm = false
    @State private var pdfWrapper: PDFDataWrapper?

    let indications = [
        "Choledocholithiasis", "Cholangitis", "Biliary stricture (benign)",
        "Biliary stricture (malignant)", "Bile leak", "Jaundice",
        "Primary sclerosing cholangitis", "Choledochal cyst",
        "Pancreatitis (biliary)", "Chronic pancreatitis", "Pancreatic duct stricture",
        "Pancreatic pseudocyst drainage", "Sphincter of Oddi dysfunction", "Other"
    ]
    let ampullaOptions = [
        "Periampullary diverticulum", "Ampullary adenoma", "Ampullary carcinoma",
        "Oedema", "Papillitis", "Stone impacted at papilla", "Prior sphincterotomy"
    ]
    let cbdFindingOptions = [
        "Filling defect(s) — stones", "Stricture distal", "Stricture mid", "Stricture hilar",
        "Dilation", "Normal calibre", "Leak", "Pneumobilia", "Air bubble artefact"
    ]
    let pdFindingOptions = [
        "Stricture", "Dilation", "Stones/protein plugs", "Leak",
        "Duct disruption", "Dominant stricture", "Normal calibre"
    ]
    let extractionOptions = [
        "Balloon", "Dormia basket", "Mechanical lithotripsy",
        "EHL", "Laser lithotripsy", "Combination"
    ]
    let complicationOptions = [
        "None", "Pancreatitis", "Cholangitis", "Haemorrhage",
        "Perforation", "Contrast reaction", "Cholecystitis",
        "Aspiration", "Cardiorespiratory event", "Stent migration"
    ]

    var body: some View {
        Form {
            preProcedureLabsSection
            preProcedureSection
            aiGenerateSection
            ampullaSection
            accessSection
            cholangiogramSection
            if data.pancreatogramDone { pancreatogramSection }
            stoneSection
            stentSection
            biopsySection
            complicationsSection
            pepProphylaxisSection
            impressionSection
        }
        .navigationTitle("ERCP Report")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    pdfWrapper = PDFDataWrapper(data: ProcedureFormPDF.ercpReport(patient: patient, data: data))
                } label: {
                    Label("Export PDF", systemImage: "arrow.up.doc.fill")
                }
            }
        }
        .sheet(item: $pdfWrapper) { wrapper in
            ShareSheet(items: [wrapper.data])
        }
        .onAppear {
            data = patient.ercpData
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

            // Pre-fill standard normal impression template when form is freshly opened
            if data.impression.isEmpty {
                let op = data.operator_.isEmpty ? "the endoscopist" : data.operator_
                data.impression = "ERCP performed by \(op). " +
                    "The major papilla was identified in the second part of the duodenum. " +
                    "Selective deep cannulation of the common bile duct was achieved. " +
                    "Cholangiogram performed: the common bile duct was of normal calibre with no filling defect, stricture, or extrinsic compression identified. " +
                    "The intrahepatic ducts were normal. " +
                    "Biliary sphincterotomy performed. " +
                    "Post-sphincterotomy appearance satisfactory with adequate drainage confirmed. " +
                    "PR indomethacin 100 mg administered at end of procedure for post-ERCP pancreatitis prophylaxis. " +
                    "Procedure completed without immediate complication."
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

    var canGenerateAI: Bool {
        !data.indication.isEmpty || patient.workingDiagnosis != nil
    }

    var hasExistingContent: Bool {
        !data.impression.isEmpty || !data.recommendations.isEmpty
    }

    func triggerAIGeneration() {
        if hasExistingContent {
            showAIOverwriteConfirm = true
        } else {
            Task { await runAIGeneration() }
        }
    }

    @MainActor
    private func runAIGeneration() async {
        do {
            let result = try await ai.generateERCPReport(
                patient: patient,
                indications: data.indication,
                indicationOther: data.indicationOther
            )
            if !result.impression.isEmpty      { data.impression = result.impression }
            if !result.recommendations.isEmpty { data.recommendations = result.recommendations }
            save()
        } catch is AIError {
            // AI disabled pending HIPAA BAA — generate local impression from available data
            let labs = LabPanel.parse(from: patient.investigations)
            let indStr = data.indication.isEmpty ? (patient.workingDiagnosis ?? "ERCP") : data.indication.joined(separator: ", ")
            var imp = "ERCP performed for: \(indStr)."
            if let bil = labs.bilirubin {
                imp += String(format: " Bilirubin %.1f µmol/L%@.", bil.value, bil.value > 100 ? " [elevated]" : "")
            }
            if let inr = labs.inr {
                imp += String(format: " INR %.1f%@.", inr.value, inr.value > 1.5 ? " [elevated]" : "")
            }
            data.impression = imp.isEmpty ? data.impression : imp
            if data.recommendations.isEmpty {
                data.recommendations = "Review pathology/cytology results when available. Follow-up in \(data.followUpWeeks) weeks."
            }
            save()
        } catch {
            aiError = error.localizedDescription
        }
    }

    // MARK: AI section

    var aiGenerateSection: some View {
        Section {
            let hasContext = canGenerateAI
            HStack(spacing: 10) {
                if ai.isGenerating {
                    ProgressView().controlSize(.small)
                    Text("Generating ERCP report…")
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
                             ? "Auto-fills impression & recommendations from indication"
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
