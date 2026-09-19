import SwiftUI
import SwiftData

// MARK: - Data model

struct PostOpReviewData: Codable {
    var reviewDate: Date?
    var postOpDay: Int = 1
    var reviewedBy: String = "Dr Dawit Daniel Kabiye MD DM"
    var procedure: String = ""
    var procedureDate: Date?

    // Symptoms
    var pain: Int = 0
    var nausea: Bool = false
    var vomiting: Bool = false
    var fever: Bool = false
    var dyspnoea: Bool = false

    // Wound
    var woundInspected: Bool = true
    var woundStatus: String = "Clean and dry"
    var woundFindings: [String] = []
    var woundNotes: String = ""

    // Drain
    var drainPresent: Bool = false
    var drainOutput: String = ""
    var drainFluid: String = "Serous"
    var drainRemoved: Bool = false

    // GI recovery
    var flatus: Bool = false
    var bowelsOpen: Bool = false
    var toleratingDiet: Bool = false
    var dietType: String = "Free fluids"
    var nauseaVomiting: Bool = false

    // Urinary
    var urinaryCatheter: Bool = false
    var urineOutput: String = ""
    var catheterRemoved: Bool = false

    // Mobility
    var mobilising: Bool = false
    var physioSeen: Bool = false

    // VTE
    var dvtProphylaxisGiven: Bool = true
    var teds: Bool = true

    // Vitals
    var tempNormal: Bool = true
    var bpNormal: Bool = true
    var hrNormal: Bool = true
    var news2: String = ""
    var vitalsNotes: String = ""

    // Labs
    var labsOrdered: [String] = []
    var labNotes: String = ""

    // Assessment / plan
    var assessment: String = ""
    var plan: String = ""
    var expectedDischargeDate: Date?
    var dischargeBarriers: [String] = []
}

extension Patient {
    var postOpReviewData: PostOpReviewData {
        get {
            guard let json = postOpReviewDataJson,
                  let raw = json.data(using: .utf8) else {
                var d = PostOpReviewData()
                let sx = surgeryData
                d.procedure    = sx.procedureName
                d.drainPresent = sx.drainInserted
                if let op = operationDate {
                    d.procedureDate = op
                    d.postOpDay = max(1, Calendar.current.dateComponents([.day], from: op, to: .now).day ?? 1)
                }
                return d
            }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            return (try? decoder.decode(PostOpReviewData.self, from: raw)) ?? PostOpReviewData()
        }
        set {
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            postOpReviewDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}

// MARK: - View

struct PostOpReviewView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State private var data = PostOpReviewData()
    @State private var hasReviewDate = false
    @State private var hasExpectedDischarge = false
    @State private var pdfWrapper: PDFDataWrapper?

    private let woundFindingOptions = [
        "Sutures intact", "Staples intact", "Wound open / dehiscence",
        "Purulent discharge", "Haematoma", "Seroma",
        "Superficial infection", "Deep infection", "Healing well"
    ]
    private let drainFluidOptions = ["Serous", "Serosanguineous", "Sanguineous", "Bile", "Pus", "Enteric content"]
    private let labOptions = ["FBC", "U&E / Creatinine", "LFT", "CRP", "Serum amylase",
                               "Coagulation", "Blood cultures", "Wound swab", "Urine MC&S"]
    private let dischargeBarrierOptions = [
        "Ongoing pain", "Nausea / vomiting", "Wound concern",
        "Awaiting pathology", "Awaiting imaging", "Social care",
        "Physiotherapy input needed", "District nurse arrangement", "Medical clearance needed"
    ]

    var body: some View {
        Form {
            reviewHeaderSection
            symptomsSection
            woundSection
            if data.drainPresent { drainSection }
            giRecoverySection
            urinarySection
            mobilityVTESection
            vitalsSection
            labsSection
            assessmentSection
            dischargeSection
        }
        .navigationTitle("Post-op Review")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    let pdf = ProcedureFormPDF.postOpReview(patient: patient, data: data)
                    pdfWrapper = PDFDataWrapper(data: pdf)
                } label: {
                    Label("Export PDF", systemImage: "arrow.up.doc.fill")
                }
            }
        }
        .sheet(item: $pdfWrapper) { wrapper in
            ShareSheet(items: [wrapper.data])
        }
        .onAppear {
            data = patient.postOpReviewData
            hasReviewDate = data.reviewDate != nil
            hasExpectedDischarge = data.expectedDischargeDate != nil

            // Cross-populate drain state from surgery note when not yet set
            // (handles re-opening after surgery note was updated)
            if !data.drainPresent && patient.surgeryData.drainInserted {
                data.drainPresent = true
                save()
            }
        }
    }

    // MARK: Sections

    private var reviewHeaderSection: some View {
        Section("Review Details") {
            TextField("Reviewed by", text: $data.reviewedBy)
                .onChange(of: data.reviewedBy) { _, _ in save() }
            Toggle("Set review date", isOn: $hasReviewDate)
                .onChange(of: hasReviewDate) { _, on in
                    data.reviewDate = on ? (data.reviewDate ?? .now) : nil; save()
                }
            if hasReviewDate {
                DatePicker("Review date", selection: Binding(
                    get: { data.reviewDate ?? .now },
                    set: { data.reviewDate = $0; save() }
                ), displayedComponents: [.date, .hourAndMinute])
            }
            Stepper("Post-op day: \(data.postOpDay)", value: $data.postOpDay, in: 0...365)
                .onChange(of: data.postOpDay) { _, _ in save() }
            TextField("Procedure reviewed", text: $data.procedure)
                .onChange(of: data.procedure) { _, _ in save() }
        }
    }

    private var symptomsSection: some View {
        Section("Symptoms") {
            VStack(alignment: .leading, spacing: 4) {
                Text("Pain score (VAS 0–10)")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                HStack {
                    Text("0").font(.caption).foregroundStyle(.secondary)
                    Slider(value: Binding(
                        get: { Double(data.pain) },
                        set: { data.pain = Int($0); save() }
                    ), in: 0...10, step: 1)
                    Text("10").font(.caption).foregroundStyle(.secondary)
                    Text("\(data.pain)")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(data.pain >= 7 ? .red : data.pain >= 4 ? .orange : .green)
                        .frame(width: 28)
                }
            }
            Toggle("Nausea", isOn: $data.nausea)
                .onChange(of: data.nausea) { _, _ in save() }
            Toggle("Vomiting", isOn: $data.vomiting)
                .onChange(of: data.vomiting) { _, _ in save() }
            Toggle("Fever", isOn: $data.fever)
                .onChange(of: data.fever) { _, _ in save() }
            Toggle("Dyspnoea", isOn: $data.dyspnoea)
                .onChange(of: data.dyspnoea) { _, _ in save() }
        }
    }

    private var woundSection: some View {
        Section("Wound Assessment") {
            Toggle("Wound inspected", isOn: $data.woundInspected)
                .onChange(of: data.woundInspected) { _, _ in save() }
            if data.woundInspected {
                Picker("Status", selection: $data.woundStatus) {
                    ForEach(["Clean and dry", "Moist", "Erythematous",
                             "Discharging", "Dehisced", "Not yet reviewed"], id: \.self) { Text($0) }
                }
                .onChange(of: data.woundStatus) { _, _ in save() }
                chipMultiSelect("Findings", options: woundFindingOptions, selected: $data.woundFindings)
                    .onChange(of: data.woundFindings) { _, _ in save() }
                TextField("Wound notes", text: $data.woundNotes, axis: .vertical)
                    .lineLimit(2...)
                    .onChange(of: data.woundNotes) { _, _ in save() }
            }
            Toggle("Drain present", isOn: $data.drainPresent)
                .onChange(of: data.drainPresent) { _, _ in save() }
        }
    }

    private var drainSection: some View {
        Section("Drain") {
            HStack {
                Text("Output")
                Spacer()
                TextField("—", text: $data.drainOutput)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 70)
                    .onChange(of: data.drainOutput) { _, _ in save() }
                Text("mL / 24 h").foregroundStyle(.secondary)
            }
            Picker("Fluid character", selection: $data.drainFluid) {
                ForEach(drainFluidOptions, id: \.self) { Text($0) }
            }
            .onChange(of: data.drainFluid) { _, _ in save() }
            Toggle("Drain removed today", isOn: $data.drainRemoved)
                .onChange(of: data.drainRemoved) { _, _ in save() }
        }
    }

    private var giRecoverySection: some View {
        Section("GI Recovery") {
            Toggle("Flatus passed", isOn: $data.flatus)
                .onChange(of: data.flatus) { _, _ in save() }
            Toggle("Bowels opened", isOn: $data.bowelsOpen)
                .onChange(of: data.bowelsOpen) { _, _ in save() }
            Toggle("Tolerating diet", isOn: $data.toleratingDiet)
                .onChange(of: data.toleratingDiet) { _, _ in save() }
            if data.toleratingDiet {
                Picker("Diet type", selection: $data.dietType) {
                    ForEach(["Sips only", "Free fluids", "Soft diet", "Normal diet", "Nil by mouth"], id: \.self) { Text($0) }
                }
                .onChange(of: data.dietType) { _, _ in save() }
            }
        }
    }

    private var urinarySection: some View {
        Section("Urinary") {
            Toggle("Urinary catheter in situ", isOn: $data.urinaryCatheter)
                .onChange(of: data.urinaryCatheter) { _, _ in save() }
            if data.urinaryCatheter {
                HStack {
                    Text("Urine output")
                    Spacer()
                    TextField("—", text: $data.urineOutput)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 70)
                        .onChange(of: data.urineOutput) { _, _ in save() }
                    Text("mL / 24 h").foregroundStyle(.secondary)
                }
                Toggle("Catheter removed today", isOn: $data.catheterRemoved)
                    .onChange(of: data.catheterRemoved) { _, _ in save() }
            }
        }
    }

    private var mobilityVTESection: some View {
        Section("Mobility & VTE") {
            Toggle("Mobilising", isOn: $data.mobilising)
                .onChange(of: data.mobilising) { _, _ in save() }
            Toggle("Physiotherapy seen", isOn: $data.physioSeen)
                .onChange(of: data.physioSeen) { _, _ in save() }
            Toggle("DVT prophylaxis given today", isOn: $data.dvtProphylaxisGiven)
                .onChange(of: data.dvtProphylaxisGiven) { _, _ in save() }
            Toggle("TEDs worn", isOn: $data.teds)
                .onChange(of: data.teds) { _, _ in save() }
        }
    }

    private var vitalsSection: some View {
        Section("Vitals Overview") {
            Toggle("Temperature normal", isOn: $data.tempNormal)
                .onChange(of: data.tempNormal) { _, _ in save() }
            Toggle("Blood pressure normal", isOn: $data.bpNormal)
                .onChange(of: data.bpNormal) { _, _ in save() }
            Toggle("Heart rate normal", isOn: $data.hrNormal)
                .onChange(of: data.hrNormal) { _, _ in save() }
            HStack {
                Text("NEWS2 score")
                Spacer()
                TextField("—", text: $data.news2)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 60)
                    .onChange(of: data.news2) { _, _ in save() }
            }
            TextField("Vitals notes", text: $data.vitalsNotes)
                .onChange(of: data.vitalsNotes) { _, _ in save() }
        }
    }

    private var labsSection: some View {
        Section("Investigations") {
            chipMultiSelect("Labs ordered", options: labOptions, selected: $data.labsOrdered)
                .onChange(of: data.labsOrdered) { _, _ in save() }
            TextField("Lab / investigation notes", text: $data.labNotes, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.labNotes) { _, _ in save() }
        }
    }

    private var assessmentSection: some View {
        Section {
            TextField("Assessment", text: $data.assessment, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.assessment) { _, _ in save() }
            TextField("Plan for today", text: $data.plan, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.plan) { _, _ in save() }
        } header: {
            HStack {
                Text("Assessment & Plan")
                Spacer()
                MedicalDictationButton(mode: .consultation, patient: patient) { polished in
                    data.assessment += (data.assessment.isEmpty ? "" : "\n\n") + polished
                    save()
                }
            }
        }
    }

    private var dischargeSection: some View {
        Section("Discharge Planning") {
            Toggle("Set expected discharge date", isOn: $hasExpectedDischarge)
                .onChange(of: hasExpectedDischarge) { _, on in
                    data.expectedDischargeDate = on ? (data.expectedDischargeDate ?? .now) : nil; save()
                }
            if hasExpectedDischarge {
                DatePicker("Expected discharge", selection: Binding(
                    get: { data.expectedDischargeDate ?? .now },
                    set: { data.expectedDischargeDate = $0; save() }
                ), displayedComponents: [.date])
            }
            chipMultiSelect("Barriers to discharge", options: dischargeBarrierOptions,
                            selected: $data.dischargeBarriers)
                .onChange(of: data.dischargeBarriers) { _, _ in save() }
        }
    }

    // MARK: Helpers

    private func save() {
        patient.postOpReviewData = data
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
