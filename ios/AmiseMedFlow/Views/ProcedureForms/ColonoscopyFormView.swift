// MARK: - View

struct ColonoscopyFormView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State var data: ColonoscopyData = ColonoscopyData()
    @State var hasProcedureDate = false
    @State var pdfWrapper: PDFDataWrapper?

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
            preProcedureLabsSection
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

            // Pre-fill normal impression on first load
            let allNormal = data.rectumNormal && data.sigmoidNormal && data.descendingNormal &&
                            data.splenicNormal && data.transverseNormal && data.hepaticNormal &&
                            data.ascendingNormal && data.cecumNormal
            if data.impression.isEmpty && allNormal {
                let op = data.operator_.isEmpty ? "the endoscopist" : data.operator_
                let ileum = data.ilealIntubation ? " The terminal ileum was intubated and normal." : ""
                data.impression = "Colonoscopy performed by \(op). " +
                    "Caecal intubation was achieved and confirmed by identification of the appendix orifice and ileocaecal valve.\(ileum) " +
                    "Boston Bowel Preparation Scale: right \(data.bostonRight)/3, transverse \(data.bostonTransverse)/3, left \(data.bostonLeft)/3. " +
                    "Systematic examination of all colonic segments on withdrawal was normal. " +
                    "The rectum was inspected in retroflexion and was normal. " +
                    "No polyps, diverticular disease, mucosal abnormality, or lesions identified. " +
                    "No biopsies taken. Procedure completed without complication."
            }

            save()
        }
    }

}
