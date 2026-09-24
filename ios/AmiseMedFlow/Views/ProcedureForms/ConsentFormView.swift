import SwiftUI
import SwiftData

// MARK: - Data model

struct ConsentFormData: Codable {
    var consentDate: Date = .now
    var surgeonName: String = "Dr Dawit Daniel Kabiye, MD, DM"
    var anaesthetistName: String = ""
    var consentType: String = "Elective"

    // Procedure
    var procedureName: String = ""
    var indication: String = ""
    var procedureDescription: String = ""
    var sideOrSite: String = "Not applicable"

    // General risks (always discussed)
    var generalRisks: [String] = [
        "Bleeding requiring transfusion",
        "Wound infection",
        "Anaesthetic risks",
        "Deep vein thrombosis / pulmonary embolism",
        "Damage to adjacent structures"
    ]

    // Procedure-specific risks
    var specificRisks: [String] = []
    var specificRisksOther: String = ""

    // Alternatives discussed
    var alternativesTreated: [String] = []
    var alternativesOther: String = ""

    // Patient understanding
    var capacityConfirmed: Bool = true
    var interpreterRequired: Bool = false
    var interpreterName: String = ""
    var questionsAsked: String = ""
    var questionsAnswered: Bool = true

    // Anaesthesia
    var anaesthesiaType: String = "General anaesthesia"
    var anaesthesiaRisksDiscussed: Bool = true

    // Blood products
    var bloodProductsDiscussed: Bool = true
    var bloodProductsDeclined: Bool = false

    // Signature block
    var patientPrintedName: String = ""
    var witnessName: String = ""
    var witnessDesignation: String = ""

    // Additional notes
    var additionalNotes: String = ""
}

extension Patient {
    var consentFormData: ConsentFormData {
        get {
            guard let json = consentFormDataJson,
                  let raw = json.data(using: .utf8) else {
                var d = ConsentFormData()
                d.procedureName  = surgeryData.procedureName
                d.indication     = workingDiagnosis ?? ""
                d.patientPrintedName = fullName
                return d
            }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            return (try? decoder.decode(ConsentFormData.self, from: raw)) ?? ConsentFormData()
        }
        set {
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            consentFormDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}

// MARK: - View

struct ConsentFormView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) var context

    @State var data = ConsentFormData()
    @State var pdfWrapper: PDFDataWrapper?
    @State var showTemplatePicker = false
    @State var suggestedTemplate: ProcedureTemplate? = nil

    let specificRiskOptions = [
        // GI / abdominal
        "Anastomotic leak", "Bile duct injury", "Bowel injury",
        "Post-op ileus / obstruction", "Hernia recurrence",
        "Conversion to open surgery", "Stoma formation (temporary or permanent)",
        // Hepatobiliary
        "Bile leak", "Retained stone", "Pancreatitis",
        // Vascular
        "Vascular injury requiring repair",
        // Endoscopy
        "Perforation", "Post-polypectomy bleeding", "Aspiration",
        // Urological
        "Urinary retention", "Urinary tract infection",
        // General
        "Nerve damage / paraesthesia", "Scar / keloid formation",
        "Chronic pain at incision site", "Port-site hernia",
        "Lymphoedema", "Seroma / haematoma", "Mesh-related complications"
    ]

    let alternativeOptions = [
        "Conservative management / watchful waiting",
        "Medical management (medications)",
        "Endoscopic treatment",
        "Interventional radiology",
        "Alternative surgical approach",
        "Palliation / symptom management",
        "Referral to another specialist",
        "No treatment"
    ]

    let anaesthesiaOptions = [
        "General anaesthesia", "Spinal anaesthesia",
        "Epidural anaesthesia", "Regional / local anaesthesia",
        "MAC / sedation", "Local anaesthesia only"
    ]

    var body: some View {
        Form {
            templatePickerSection
            headerSection
            preOpInvestigationsSection
            procedureSection
            generalRisksSection
            specificRisksSection
            alternativesSection
            anaesthesiaSection
            bloodProductsSection
            capacitySection
            signatureSection
            if !data.additionalNotes.isEmpty || true { additionalSection }
        }
        .navigationTitle("Surgical Consent")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    pdfWrapper = PDFDataWrapper(data: ProcedureFormPDF.consentForm(patient: patient, data: data))
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
                template.applyConsentFields(to: &data)
                save()
            }
        }
        .onAppear {
            data = patient.consentFormData
            // Suggest a template if the procedure name already matches one
            // but procedure-specific risks haven't been filled yet
            if data.specificRisks.isEmpty {
                suggestedTemplate = matchTemplate(for: data.procedureName)
            }
        }
    }

    // MARK: Sections

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
                        Text("Load Consent Template")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.primary)
                        Text(data.procedureName.isEmpty
                             ? "Pre-fills procedure name, description, risks & alternatives"
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
            Text("Selecting a template pre-fills procedure-specific risks and plain-language description. Review all content with the patient before signing.")
                .font(.caption2)
        }
    }

}
