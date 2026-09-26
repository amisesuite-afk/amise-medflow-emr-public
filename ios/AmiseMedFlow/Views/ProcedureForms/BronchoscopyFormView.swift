import SwiftUI
import SwiftData

// MARK: - View

struct BronchoscopyFormView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State var data: BronchoscopyData = BronchoscopyData()
    @State var hasProcedureDate = false
    @State var pdfWrapper: PDFDataWrapper?

    let indications = [
        "Haemoptysis", "Persistent cough", "Wheeze / stridor",
        "Lung mass / suspicious lesion", "Mediastinal lymphadenopathy",
        "Recurrent pneumonia / consolidation", "Interstitial lung disease",
        "Foreign body removal", "Atelectasis", "Suspected endobronchial lesion",
        "Infection / microbiological sampling", "Post-intubation follow-up", "Other"
    ]
    let vocalCordsOptions = [
        "Vocal cord palsy (left)", "Vocal cord palsy (right)", "Bilateral palsy",
        "Nodule / polyp", "Oedema", "Erythema", "Lesion requiring biopsy"
    ]
    static let airwayFindingOptions = [
        "Mucosal erythema / inflammation", "Endobronchial lesion",
        "Extrinsic compression", "Submucosal infiltration", "Mucus plug",
        "Haemorrhage / blood", "Stricture / stenosis", "Carcinoma in situ",
        "Post-surgical changes", "Foreign body", "Pus / secretions"
    ]
    let airwayFindingOptions = BronchoscopyFormView.airwayFindingOptions
    let tracheaFindingOptions = [
        "Tracheomalacia", "Extrinsic compression", "Tracheal stenosis",
        "Mucosal lesion", "Secretions", "Deviation"
    ] + BronchoscopyFormView.airwayFindingOptions
    let carinaFindingOptions = [
        "Carina blunted / widened", "Carina fixed", "Peribronchial infiltrate"
    ] + BronchoscopyFormView.airwayFindingOptions
    let interventionOptions = [
        "Bronchoalveolar lavage (BAL)", "Endobronchial biopsy",
        "Transbronchial biopsy (TBLB)", "EBUS-TBNA",
        "Brushings (cytology)", "Protected specimen brush",
        "Foreign body removal", "Endobronchial debulking",
        "Balloon dilation", "Stent insertion", "APC / laser"
    ]
    let complicationOptions = [
        "None", "Oxygen desaturation",
        "Bronchospasm", "Haemorrhage (mild)", "Haemorrhage (significant)",
        "Pneumothorax", "Cardiorespiratory event", "Laryngospasm",
        "Reaction to sedation / topical anaesthesia"
    ]
    let approachOptions = ["Trans-nasal", "Trans-oral"]
    let sedationOptions  = ["MAC / Propofol", "Midazolam + Fentanyl", "General Anaesthesia", "Topical only (no sedation)"]
    let oxygenOptions    = ["Nasal prongs", "Hudson mask", "High-flow nasal oxygen", "ETT / LMA (GA)"]

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
        .sheet(item: $pdfWrapper) { wrapper in
            ShareSheet(items: [wrapper.data])
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    pdfWrapper = PDFDataWrapper(data: ProcedureFormPDF.bronchoscopyReport(patient: patient, data: data))
                    let noteObj = ClinicalNote(noteType: .endoscopy, patient: patient)
                    noteObj.freeText = buildReportText()
                    context.insert(noteObj)
                    patient.updatedAt = .now; patient.pendingSync = true
                } label: {
                    Label("Export PDF", systemImage: "arrow.up.doc.fill")
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
                data.operator_ = StaffRegistry.shared.names(for: .surgeon).first ?? PracticeProfile.current.clinicianName
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

}
