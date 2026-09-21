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
    @Environment(\.modelContext) private var context

    @State private var data = ConsentFormData()
    @State private var pdfWrapper: PDFDataWrapper?
    @State private var showTemplatePicker = false
    @State private var suggestedTemplate: ProcedureTemplate? = nil

    private let specificRiskOptions = [
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

    private let alternativeOptions = [
        "Conservative management / watchful waiting",
        "Medical management (medications)",
        "Endoscopic treatment",
        "Interventional radiology",
        "Alternative surgical approach",
        "Palliation / symptom management",
        "Referral to another specialist",
        "No treatment"
    ]

    private let anaesthesiaOptions = [
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

    // MARK: - Pre-operative investigations (read-only)

    @ViewBuilder
    private var preOpInvestigationsSection: some View {
        let labs = LabPanel.parse(from: patient.investigations)
        let resulted = patient.investigations.filter { $0.status == .resulted }
        let pending = patient.investigations.filter { $0.status == .ordered || $0.status == .pending }

        if !resulted.isEmpty || !pending.isEmpty {
            Section {
                if labs.hasCriticalValues {
                    Label("Critical lab values — review before signing consent", systemImage: "exclamationmark.triangle.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.red)
                }
                let labTokens: [String] = [
                    labs.haemoglobin.map { String(format: "Hb %.1f g/dL", $0.value) },
                    labs.platelets.map { "Plt \(Int($0.value)) ×10⁹/L" },
                    labs.inr.map { String(format: "INR %.1f", $0.value) },
                    labs.sodium.map { "Na \(Int($0.value)) mmol/L" },
                    labs.potassium.map { String(format: "K %.1f mmol/L", $0.value) },
                    labs.creatinine.map { "Cr \(Int($0.value)) µmol/L" }
                ].compactMap { $0 }
                if !labTokens.isEmpty {
                    Text(labTokens.joined(separator: "  ·  "))
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(labs.hasCriticalValues ? .red : .primary)
                }
                let imaging = resulted.filter { $0.category != .blood && !$0.result.isEmpty }
                ForEach(Array(imaging.prefix(3))) { inv in
                    HStack(alignment: .top) {
                        Text(inv.name).font(.caption.weight(.medium))
                        Spacer()
                        Text(inv.result).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                    }
                }
                if !pending.isEmpty {
                    Text("\(pending.count) investigation\(pending.count == 1 ? "" : "s") still pending")
                        .font(.caption).foregroundStyle(.orange)
                }
            } header: {
                Text("Pre-operative Investigations")
            }
        }
    }

    private var headerSection: some View {
        Section("Consent Details") {
            Picker("Type", selection: $data.consentType) {
                ForEach(["Elective", "Emergency", "Assent (minor)", "Proxy consent"], id: \.self) { Text($0) }
            }
            .onChange(of: data.consentType) { _, _ in save() }
            DatePicker("Date", selection: Binding(
                get: { data.consentDate },
                set: { data.consentDate = $0; save() }
            ), displayedComponents: [.date])
            TextField("Surgeon", text: $data.surgeonName)
                .onChange(of: data.surgeonName) { _, _ in save() }
            TextField("Anaesthetist", text: $data.anaesthetistName)
                .onChange(of: data.anaesthetistName) { _, _ in save() }
        }
    }

    private var procedureSection: some View {
        Section("Procedure") {
            TextField("Procedure name", text: $data.procedureName)
                .onChange(of: data.procedureName) { _, new in
                    save()
                    suggestedTemplate = matchTemplate(for: new)
                }

            if let t = suggestedTemplate {
                Button {
                    t.applyConsentFields(to: &data)
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
                            Text("Pre-fills description · specific risks · alternatives · anaesthesia")
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

            TextField("Indication / diagnosis", text: $data.indication, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.indication) { _, _ in save() }
            TextField("Procedure description (for patient)", text: $data.procedureDescription, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.procedureDescription) { _, _ in save() }
            Picker("Side / site", selection: $data.sideOrSite) {
                ForEach(["Not applicable", "Left", "Right", "Bilateral", "Midline", "Upper abdomen", "Lower abdomen"], id: \.self) { Text($0) }
            }
            .onChange(of: data.sideOrSite) { _, _ in save() }
        }
    }

    private var generalRisksSection: some View {
        Section {
            ForEach(data.generalRisks, id: \.self) { risk in
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(AMColor.accent)
                        .font(.system(size: 14))
                    Text(risk)
                        .font(.subheadline)
                }
            }
        } header: {
            Text("General Risks (always included)")
        } footer: {
            Text("These risks apply to all surgical procedures and are pre-selected.")
                .font(.caption2)
        }
    }

    private var specificRisksSection: some View {
        Section("Procedure-Specific Risks") {
            chipMultiSelect("Select applicable risks", options: specificRiskOptions, selected: $data.specificRisks)
                .onChange(of: data.specificRisks) { _, _ in save() }
            TextField("Other specific risks", text: $data.specificRisksOther, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.specificRisksOther) { _, _ in save() }
        }
    }

    private var alternativesSection: some View {
        Section("Alternative Treatments Discussed") {
            chipMultiSelect("", options: alternativeOptions, selected: $data.alternativesTreated)
                .onChange(of: data.alternativesTreated) { _, _ in save() }
            TextField("Other alternatives", text: $data.alternativesOther)
                .onChange(of: data.alternativesOther) { _, _ in save() }
        }
    }

    private var anaesthesiaSection: some View {
        Section("Anaesthesia") {
            Picker("Type", selection: $data.anaesthesiaType) {
                ForEach(anaesthesiaOptions, id: \.self) { Text($0) }
            }
            .onChange(of: data.anaesthesiaType) { _, _ in save() }
            Toggle("Anaesthesia risks discussed", isOn: $data.anaesthesiaRisksDiscussed)
                .onChange(of: data.anaesthesiaRisksDiscussed) { _, _ in save() }
        }
    }

    private var bloodProductsSection: some View {
        Section("Blood Products") {
            Toggle("Blood products / transfusion discussed", isOn: $data.bloodProductsDiscussed)
                .onChange(of: data.bloodProductsDiscussed) { _, _ in save() }
            Toggle("Patient declines blood products", isOn: $data.bloodProductsDeclined)
                .onChange(of: data.bloodProductsDeclined) { _, _ in save() }
                .tint(.red)
        }
    }

    private var capacitySection: some View {
        Section("Patient Understanding & Capacity") {
            Toggle("Decision-making capacity confirmed", isOn: $data.capacityConfirmed)
                .onChange(of: data.capacityConfirmed) { _, _ in save() }
            Toggle("Interpreter required", isOn: $data.interpreterRequired)
                .onChange(of: data.interpreterRequired) { _, _ in save() }
            if data.interpreterRequired {
                TextField("Interpreter name / language", text: $data.interpreterName)
                    .onChange(of: data.interpreterName) { _, _ in save() }
            }
            TextField("Questions asked by patient", text: $data.questionsAsked, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.questionsAsked) { _, _ in save() }
            Toggle("Questions answered to patient's satisfaction", isOn: $data.questionsAnswered)
                .onChange(of: data.questionsAnswered) { _, _ in save() }
        }
    }

    private var signatureSection: some View {
        Section("Signature Block") {
            TextField("Patient printed name", text: $data.patientPrintedName)
                .onChange(of: data.patientPrintedName) { _, _ in save() }
            TextField("Witness name", text: $data.witnessName)
                .onChange(of: data.witnessName) { _, _ in save() }
            TextField("Witness designation", text: $data.witnessDesignation,
                      prompt: Text("e.g. Registered Nurse"))
                .onChange(of: data.witnessDesignation) { _, _ in save() }
        }
    }

    private var additionalSection: some View {
        Section("Additional Notes") {
            TextField("Any other relevant information", text: $data.additionalNotes, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.additionalNotes) { _, _ in save() }
        }
    }

    // MARK: Helpers

    private func save() {
        patient.consentFormData = data
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    private func matchTemplate(for name: String) -> ProcedureTemplate? {
        let q = name.trimmingCharacters(in: .whitespaces).lowercased()
        guard q.count >= 4 else { return nil }
        if let t = ProcedureTemplate.all.first(where: { $0.name.lowercased().contains(q) || q.contains($0.name.lowercased()) }) {
            return t
        }
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
