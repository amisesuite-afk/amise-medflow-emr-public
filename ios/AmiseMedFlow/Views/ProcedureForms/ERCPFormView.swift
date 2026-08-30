import SwiftUI
import SwiftData

// MARK: - Data model

struct ERCPData: Codable {
    // Pre-procedure
    var indication: [String] = []
    var indicationOther: String = ""
    var consent: Bool = false
    var operator_: String = ""
    var assistant: String = ""
    var dateOfProcedure: Date?

    // Anaesthesia
    var anaesthesiaType: String = "MAC / Propofol"
    var position: String = "Prone"
    var antibiotic: Bool = false
    var antibioticUsed: String = ""

    // Equipment
    var duodenoscope: String = ""
    var fluoroscopy: Bool = true
    var contrastUsed: String = "Non-ionic (Omnipaque)"

    // Ampulla
    var ampullaAppearance: String = "Normal"
    var ampullaFindings: [String] = []

    // CBD / PD access
    var bileDuctCannulated: Bool = false
    var pancreaticDuctCannulated: Bool = false
    var sphincterotomy: Bool = false
    var sphincterotomyType: String = "Biliary"
    var precut: Bool = false
    var precutType: String = "Needle-knife"

    // Cholangiogram
    var cholangiogramDone: Bool = false
    var cbdDiameter: String = ""  // mm
    var cbdFindings: [String] = []
    var cbdFillDefect: Bool = false

    // Pancreatogram
    var pancreatogramDone: Bool = false
    var pdDiameter: String = ""
    var pdFindings: [String] = []

    // Stone extraction
    var stoneExtraction: Bool = false
    var stoneCount: String = ""
    var stoneSizeMax: String = ""   // mm
    var extractionMethod: [String] = []
    var clearance: String = "Complete"

    // Stenting
    var biliaryStenosis: Bool = false
    var biliaryStenosisLevel: String = "Distal CBD"
    var plasticStent: Bool = false
    var plasticStentSize: String = "10Fr 7cm"
    var metalStent: Bool = false
    var metalStentType: String = "Covered SEMS"
    var pancreaticStent: Bool = false
    var pancreaticStentSize: String = "5Fr 5cm"

    // Brush cytology / forceps biopsy
    var brushCytology: Bool = false
    var forcepsBiopsy: Bool = false
    var biopsySite: String = ""

    // Outcome / complications
    var completionStatus: String = "Complete"
    var complications: [String] = []
    var complicationNotes: String = ""

    // Post-procedure
    var impression: String = ""
    var recommendations: String = ""
    var followUpWeeks: String = "4"

    // Post-ERCP pancreatitis (PEP) risk
    var pepRisk: String = "Standard"
    var indomethacin: Bool = false   // rectal NSAID prophylaxis
    var pancreaticStentForPEP: Bool = false

    // Contrast-related
    var contrastAllergyPremeds: Bool = false
}

extension Patient {
    var ercpData: ERCPData {
        get {
            guard let json = ercpDataJson, let data = json.data(using: .utf8) else { return ERCPData() }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            return (try? decoder.decode(ERCPData.self, from: data)) ?? ERCPData()
        }
        set {
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            ercpDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}

// MARK: - View

struct ERCPFormView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State private var data: ERCPData = ERCPData()
    @State private var hasProcedureDate = false

    private let indications = [
        "Choledocholithiasis", "Cholangitis", "Biliary stricture (benign)",
        "Biliary stricture (malignant)", "Bile leak", "Jaundice",
        "Primary sclerosing cholangitis", "Choledochal cyst",
        "Pancreatitis (biliary)", "Chronic pancreatitis", "Pancreatic duct stricture",
        "Pancreatic pseudocyst drainage", "Sphincter of Oddi dysfunction", "Other"
    ]
    private let ampullaOptions = [
        "Periampullary diverticulum", "Ampullary adenoma", "Ampullary carcinoma",
        "Oedema", "Papillitis", "Stone impacted at papilla", "Prior sphincterotomy"
    ]
    private let cbdFindingOptions = [
        "Filling defect(s) — stones", "Stricture distal", "Stricture mid", "Stricture hilar",
        "Dilation", "Normal calibre", "Leak", "Pneumobilia", "Air bubble artefact"
    ]
    private let pdFindingOptions = [
        "Stricture", "Dilation", "Stones/protein plugs", "Leak",
        "Duct disruption", "Dominant stricture", "Normal calibre"
    ]
    private let extractionOptions = [
        "Balloon", "Dormia basket", "Mechanical lithotripsy",
        "EHL", "Laser lithotripsy", "Combination"
    ]
    private let complicationOptions = [
        "None", "Pancreatitis", "Cholangitis", "Haemorrhage",
        "Perforation", "Contrast reaction", "Cholecystitis",
        "Aspiration", "Cardiorespiratory event", "Stent migration"
    ]

    var body: some View {
        Form {
            preProcedureSection
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
        .onAppear {
            data = patient.ercpData
            hasProcedureDate = data.dateOfProcedure != nil
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
                    data.dateOfProcedure = on ? (data.dateOfProcedure ?? .now) : nil; save()
                }
            if hasProcedureDate {
                DatePicker("Date", selection: Binding(
                    get: { data.dateOfProcedure ?? .now },
                    set: { data.dateOfProcedure = $0; save() }
                ), displayedComponents: [.date, .hourAndMinute])
            }
            Picker("Anaesthesia", selection: $data.anaesthesiaType) {
                ForEach(["MAC / Propofol", "General ETT", "Spinal", "Local + sedation"], id: \.self) { Text($0) }
            }
            .onChange(of: data.anaesthesiaType) { _, _ in save() }
            Picker("Position", selection: $data.position) {
                ForEach(["Prone", "Left lateral", "Supine"], id: \.self) { Text($0) }
            }
            .onChange(of: data.position) { _, _ in save() }
            Toggle("Antibiotic prophylaxis", isOn: $data.antibiotic)
                .onChange(of: data.antibiotic) { _, _ in save() }
            if data.antibiotic {
                TextField("Antibiotic", text: $data.antibioticUsed)
                    .onChange(of: data.antibioticUsed) { _, _ in save() }
            }
            Toggle("Fluoroscopy", isOn: $data.fluoroscopy)
                .onChange(of: data.fluoroscopy) { _, _ in save() }
            TextField("Duodenoscope", text: $data.duodenoscope)
                .onChange(of: data.duodenoscope) { _, _ in save() }
            TextField("Contrast", text: $data.contrastUsed)
                .onChange(of: data.contrastUsed) { _, _ in save() }
            Toggle("Contrast allergy pre-meds given", isOn: $data.contrastAllergyPremeds)
                .onChange(of: data.contrastAllergyPremeds) { _, _ in save() }
        }
    }

    // MARK: Ampulla

    private var ampullaSection: some View {
        Section("Ampulla of Vater") {
            Picker("Appearance", selection: $data.ampullaAppearance) {
                ForEach(["Normal", "Abnormal", "Not identified", "Surgically altered"], id: \.self) { Text($0) }
            }
            .onChange(of: data.ampullaAppearance) { _, _ in save() }
            if data.ampullaAppearance == "Abnormal" {
                chipMultiSelect("Findings", options: ampullaOptions, selected: $data.ampullaFindings)
                    .onChange(of: data.ampullaFindings) { _, _ in save() }
            }
        }
    }

    // MARK: Access / Sphincterotomy

    private var accessSection: some View {
        Section("Duct Access") {
            Toggle("Bile duct cannulated", isOn: $data.bileDuctCannulated)
                .onChange(of: data.bileDuctCannulated) { _, _ in save() }
            Toggle("Pancreatic duct cannulated", isOn: $data.pancreaticDuctCannulated)
                .onChange(of: data.pancreaticDuctCannulated) { _, _ in save() }
            Toggle("Pancreatogram performed", isOn: $data.pancreatogramDone)
                .onChange(of: data.pancreatogramDone) { _, _ in save() }
            Toggle("Sphincterotomy", isOn: $data.sphincterotomy)
                .onChange(of: data.sphincterotomy) { _, _ in save() }
            if data.sphincterotomy {
                Picker("Type", selection: $data.sphincterotomyType) {
                    ForEach(["Biliary", "Pancreatic", "Minor papilla", "Combined"], id: \.self) { Text($0) }
                }
                .onChange(of: data.sphincterotomyType) { _, _ in save() }
            }
            Toggle("Pre-cut", isOn: $data.precut)
                .onChange(of: data.precut) { _, _ in save() }
            if data.precut {
                Picker("Pre-cut type", selection: $data.precutType) {
                    ForEach(["Needle-knife", "Transpancreatic", "Fistulotomy"], id: \.self) { Text($0) }
                }
                .onChange(of: data.precutType) { _, _ in save() }
            }
        }
    }

    // MARK: Cholangiogram

    private var cholangiogramSection: some View {
        Section("Cholangiogram (CBD)") {
            Toggle("Cholangiogram performed", isOn: $data.cholangiogramDone)
                .onChange(of: data.cholangiogramDone) { _, _ in save() }
            if data.cholangiogramDone {
                HStack {
                    Text("CBD diameter")
                    Spacer()
                    TextField("—", text: $data.cbdDiameter)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 60)
                        .onChange(of: data.cbdDiameter) { _, _ in save() }
                    Text("mm").foregroundStyle(.secondary)
                }
                chipMultiSelect("Findings", options: cbdFindingOptions, selected: $data.cbdFindings)
                    .onChange(of: data.cbdFindings) { _, _ in save() }
            }

            // Biliary stenosis / stenting
            Toggle("Biliary stricture / stenosis", isOn: $data.biliaryStenosis)
                .onChange(of: data.biliaryStenosis) { _, _ in save() }
            if data.biliaryStenosis {
                Picker("Level", selection: $data.biliaryStenosisLevel) {
                    ForEach(["Distal CBD", "Mid CBD", "Hilar (Bismuth I)", "Hilar (Bismuth II)",
                             "Hilar (Bismuth IIIa)", "Hilar (Bismuth IIIb)", "Hilar (Bismuth IV)"], id: \.self) { Text($0) }
                }
                .onChange(of: data.biliaryStenosisLevel) { _, _ in save() }
            }
        }
    }

    // MARK: Pancreatogram

    private var pancreatogramSection: some View {
        Section("Pancreatogram (PD)") {
            HStack {
                Text("PD diameter")
                Spacer()
                TextField("—", text: $data.pdDiameter)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 60)
                    .onChange(of: data.pdDiameter) { _, _ in save() }
                Text("mm").foregroundStyle(.secondary)
            }
            chipMultiSelect("Findings", options: pdFindingOptions, selected: $data.pdFindings)
                .onChange(of: data.pdFindings) { _, _ in save() }
        }
    }

    // MARK: Stone Extraction

    private var stoneSection: some View {
        Section("Stone Extraction") {
            Toggle("Stone extraction attempted", isOn: $data.stoneExtraction)
                .onChange(of: data.stoneExtraction) { _, _ in save() }
            if data.stoneExtraction {
                HStack {
                    Text("Stone count")
                    Spacer()
                    TextField("—", text: $data.stoneCount)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 60)
                        .onChange(of: data.stoneCount) { _, _ in save() }
                }
                HStack {
                    Text("Largest stone")
                    Spacer()
                    TextField("—", text: $data.stoneSizeMax)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 60)
                        .onChange(of: data.stoneSizeMax) { _, _ in save() }
                    Text("mm").foregroundStyle(.secondary)
                }
                chipMultiSelect("Extraction method", options: extractionOptions, selected: $data.extractionMethod)
                    .onChange(of: data.extractionMethod) { _, _ in save() }
                Picker("Clearance", selection: $data.clearance) {
                    ForEach(["Complete", "Partial", "Incomplete — large stones", "Incomplete — multiple stones"], id: \.self) { Text($0) }
                }
                .onChange(of: data.clearance) { _, _ in save() }
            }
        }
    }

    // MARK: Stenting

    private var stentSection: some View {
        Section("Stenting") {
            Toggle("Plastic biliary stent", isOn: $data.plasticStent)
                .onChange(of: data.plasticStent) { _, _ in save() }
            if data.plasticStent {
                TextField("Size (e.g. 10Fr 7cm)", text: $data.plasticStentSize)
                    .onChange(of: data.plasticStentSize) { _, _ in save() }
            }
            Toggle("Metal biliary stent (SEMS)", isOn: $data.metalStent)
                .onChange(of: data.metalStent) { _, _ in save() }
            if data.metalStent {
                Picker("Type", selection: $data.metalStentType) {
                    ForEach(["Covered SEMS", "Uncovered SEMS", "Partially covered SEMS"], id: \.self) { Text($0) }
                }
                .onChange(of: data.metalStentType) { _, _ in save() }
            }
            Toggle("Pancreatic stent", isOn: $data.pancreaticStent)
                .onChange(of: data.pancreaticStent) { _, _ in save() }
            if data.pancreaticStent {
                TextField("Size (e.g. 5Fr 5cm)", text: $data.pancreaticStentSize)
                    .onChange(of: data.pancreaticStentSize) { _, _ in save() }
            }
        }
    }

    // MARK: Biopsy

    private var biopsySection: some View {
        Section("Tissue Sampling") {
            Toggle("Brush cytology", isOn: $data.brushCytology)
                .onChange(of: data.brushCytology) { _, _ in save() }
            Toggle("Forceps biopsy", isOn: $data.forcepsBiopsy)
                .onChange(of: data.forcepsBiopsy) { _, _ in save() }
            if data.brushCytology || data.forcepsBiopsy {
                TextField("Site / lesion", text: $data.biopsySite)
                    .onChange(of: data.biopsySite) { _, _ in save() }
            }
        }
    }

    // MARK: Complications

    private var complicationsSection: some View {
        Section("Outcome & Complications") {
            Picker("Completion", selection: $data.completionStatus) {
                ForEach(["Complete", "Incomplete — anatomy", "Incomplete — patient intolerance",
                         "Incomplete — technical"], id: \.self) { Text($0) }
            }
            .onChange(of: data.completionStatus) { _, _ in save() }
            chipMultiSelect("Complications", options: complicationOptions, selected: $data.complications)
                .onChange(of: data.complications) { _, _ in save() }
            if !data.complications.isEmpty && !data.complications.contains("None") {
                TextField("Complication details", text: $data.complicationNotes, axis: .vertical)
                    .lineLimit(2...)
                    .onChange(of: data.complicationNotes) { _, _ in save() }
            }
        }
    }

    // MARK: PEP Prophylaxis

    private var pepProphylaxisSection: some View {
        Section("Post-ERCP Pancreatitis Prophylaxis") {
            Picker("PEP risk", selection: $data.pepRisk) {
                ForEach(["Standard", "High", "Very high"], id: \.self) { Text($0) }
            }
            .onChange(of: data.pepRisk) { _, _ in save() }
            Toggle("Rectal indomethacin given", isOn: $data.indomethacin)
                .onChange(of: data.indomethacin) { _, _ in save() }
            Toggle("Prophylactic pancreatic stent placed", isOn: $data.pancreaticStentForPEP)
                .onChange(of: data.pancreaticStentForPEP) { _, _ in save() }

            if data.pepRisk != "Standard" && !data.indomethacin {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                    Text("High-risk ERCP — consider rectal indomethacin prophylaxis")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
                .listRowBackground(Color.orange.opacity(0.06))
            }
        }
    }

    // MARK: Impression

    private var impressionSection: some View {
        Section("Impression & Plan") {
            TextField("Endoscopic impression", text: $data.impression, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.impression) { _, _ in save() }
            TextField("Recommendations / management", text: $data.recommendations, axis: .vertical)
                .lineLimit(3...)
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
        patient.ercpData = data
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
