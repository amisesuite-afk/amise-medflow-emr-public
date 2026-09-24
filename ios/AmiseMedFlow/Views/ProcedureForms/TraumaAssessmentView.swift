import SwiftUI
import SwiftData

// MARK: - View

struct TraumaAssessmentView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State var data: TraumaData = TraumaData()
    @State var hasTOI = false
    @State var expandedSection: String? = "mist"
    @State var pdfWrapper: PDFDataWrapper?

    private let mechanismOptions = [
        "RTA", "Fall", "Assault", "Stab wound", "Gunshot wound",
        "Crush injury", "Burns", "Blast injury", "Drowning", "Other"
    ]
    private let preHospitalOptions = [
        "CPR", "Intubation", "IV access", "Fluid resuscitation",
        "Needle decompression", "Chest seal", "Tourniquet",
        "Wound packing", "Spinal immobilisation", "Oxygen", "None"
    ]
    private let aisOptions = [0, 1, 2, 3, 4, 5, 6]
    private let secondaryRegions = [
        "Head", "Face", "Neck", "Chest", "Abdomen",
        "Pelvis", "Spine", "Left Upper Limb", "Right Upper Limb",
        "Left Lower Limb", "Right Lower Limb", "Back", "Perineum", "Skin"
    ]
    private let burnRegionKeys = [
        "Head": 9.0, "Right Arm": 9.0, "Left Arm": 9.0,
        "Anterior Trunk": 18.0, "Posterior Trunk": 18.0,
        "Right Thigh": 4.5, "Right Leg": 4.5,
        "Left Thigh": 4.5, "Left Leg": 4.5,
        "Genitalia": 1.0
    ]

    var body: some View {
        Form {
            // MTP trigger banner
            if data.mtpTrigger {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("MTP TRIGGER CRITERIA MET")
                            .font(.system(size: 11, weight: .heavy))
                            .tracking(0.5)
                        Text("HR > 120 + SBP < 90 — consider massive transfusion protocol")
                            .font(.caption2)
                    }
                }
                .foregroundStyle(.red)
                .padding(10)
                .listRowBackground(Color.red.opacity(0.08))
            }

            // Resulted trauma labs panel
            let traumaLabs = LabPanel.parse(from: patient.investigations)
            let hasTraumaLabs = traumaLabs.haemoglobin != nil || traumaLabs.inr != nil ||
                                traumaLabs.platelets != nil || traumaLabs.lactate != nil ||
                                traumaLabs.creatinine != nil
            if hasTraumaLabs {
                VStack(alignment: .leading, spacing: 6) {
                    Label("Lab Results", systemImage: "flask.fill")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(traumaLabs.hasCriticalValues ? .red : .teal)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            if let hb = traumaLabs.haemoglobin {
                                TraumaLabChip(label: "Hb", value: String(format: "%.1f g/dL", hb.value),
                                             critical: hb.value < 8)
                            }
                            if let inr = traumaLabs.inr {
                                TraumaLabChip(label: "INR", value: String(format: "%.1f", inr.value),
                                             critical: inr.value > 2.5)
                            }
                            if let plt = traumaLabs.platelets {
                                TraumaLabChip(label: "Plt", value: "\(Int(plt.value)) ×10⁹/L",
                                             critical: plt.value < 50)
                            }
                            if let lac = traumaLabs.lactate {
                                TraumaLabChip(label: "Lactate", value: String(format: "%.1f mmol/L", lac.value),
                                             critical: lac.value >= 4.0)
                            }
                            if let cr = traumaLabs.creatinine {
                                TraumaLabChip(label: "Cr", value: "\(Int(cr.value)) µmol/L",
                                             critical: cr.value > 300)
                            }
                        }
                    }
                }
                .padding(.vertical, 4)
                .listRowBackground(traumaLabs.hasCriticalValues ? Color.red.opacity(0.05) : Color.teal.opacity(0.05))
            }

            // ISS/NISS quick badge
            if data.iss > 0 {
                HStack(spacing: 16) {
                    issBadge("ISS", score: data.iss)
                    issBadge("NISS", score: data.niss)
                    Spacer()
                    Text(issCategory(data.iss))
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(issColor(data.iss))
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(issColor(data.iss).opacity(0.12), in: Capsule())
                }
                .listRowBackground(Color.secondary.opacity(0.05))
            }

            collapsibleSection("MIST Handover", icon: "person.crop.circle.badge.questionmark", key: "mist") {
                mistSection
            }

            collapsibleSection("Vitals on Admission", icon: "waveform.path.ecg", key: "vitals") {
                admissionVitalsSection
            }

            collapsibleSection("ABCDE Primary Survey", icon: "scope", key: "abcde") {
                abcdeSection
            }

            collapsibleSection("ISS / NISS Calculator", icon: "chart.bar", key: "iss") {
                issSection
            }

            collapsibleSection("Secondary Survey", icon: "figure.stand", key: "secondary") {
                secondarySection
            }

            collapsibleSection("Burns Assessment", icon: "flame", key: "burns") {
                burnsSection
            }

            Section {
                multiSelectRow("Interventions", options: [
                    "IV access", "Arterial line", "CVP line", "Urinary catheter",
                    "NG tube", "Chest drain", "Pericardiocentesis",
                    "Damage control surgery", "Transfusion", "Intubation"
                ], selected: $data.interventions)
                TextField("Additional notes", text: $data.notes, axis: .vertical)
                    .lineLimit(3...)
            } header: {
                HStack {
                    Text("Interventions & Notes")
                    Spacer()
                    MedicalDictationButton(mode: .assessment, patient: patient) { polished in
                        data.notes += (data.notes.isEmpty ? "" : "\n\n") + polished
                        save()
                    }
                }
            }
            .onChange(of: data.interventions) { _, _ in save() }
            .onChange(of: data.notes) { _, _ in save() }
        }
        .navigationTitle("Trauma Assessment")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    pdfWrapper = PDFDataWrapper(data: ProcedureFormPDF.traumaAssessment(patient: patient, data: data))
                } label: {
                    Label("Export PDF", systemImage: "arrow.up.doc.fill")
                }
            }
        }
        .sheet(item: $pdfWrapper) { wrapper in
            ShareSheet(items: [wrapper.data])
        }
        .onAppear { data = patient.traumaData; hasTOI = data.timeOfInjury != nil }
    }

    // MARK: MIST

    private var mistSection: some View {
        Group {
            multiSelectRow("Mechanism", options: mechanismOptions, selected: $data.mechanism)
                .onChange(of: data.mechanism) { _, _ in save() }

            Toggle("Time of injury known", isOn: $hasTOI)
                .onChange(of: hasTOI) { _, on in
                    if !on { data.timeOfInjury = nil } else if data.timeOfInjury == nil { data.timeOfInjury = .now }
                    save()
                }
            if hasTOI {
                DatePicker("Time of injury",
                           selection: Binding(get: { data.timeOfInjury ?? .now },
                                             set: { data.timeOfInjury = $0; save() }),
                           displayedComponents: [.date, .hourAndMinute])
            }
            TextField("Injuries suspected", text: $data.injuriesSuspected, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.injuriesSuspected) { _, _ in save() }
            TextField("Signs at scene", text: $data.signsAtScene, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.signsAtScene) { _, _ in save() }
            multiSelectRow("Pre-hospital interventions", options: preHospitalOptions, selected: $data.preHospitalInterventions)
                .onChange(of: data.preHospitalInterventions) { _, _ in save() }
        }
    }

    // MARK: Vitals on Admission

    private var admissionVitalsSection: some View {
        Group {
            vitalRow("Heart rate (bpm)", value: $data.hr, keyboard: .numberPad)
            HStack {
                vitalField("SBP", value: $data.sbp)
                Text("/").foregroundStyle(.secondary)
                vitalField("DBP", value: $data.dbp)
                Text("mmHg").font(.caption).foregroundStyle(.secondary)
            }
            vitalRow("Resp rate (/min)", value: $data.rr, keyboard: .numberPad)
            vitalRow("SpO₂ (%)", value: $data.spo2, keyboard: .numberPad)
            vitalRow("Temp (°C)", value: $data.temp, keyboard: .decimalPad)
            HStack {
                Text("GCS (E+V+M)")
                Spacer()
                Text("\(data.gcsTotalDisplay)").font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(gcsColor(data.gcsTotalDisplay))
            }
            gcsRow
            vitalRow("Blood glucose (mmol/L)", value: $data.glucose, keyboard: .decimalPad)
            TextField("Pupils", text: $data.pupils)
                .onChange(of: data.pupils) { _, _ in save() }
            vitalRow("Pain score (0–10)", value: $data.pain, keyboard: .numberPad)
            vitalRow("Estimated blood loss (mL)", value: $data.ebl, keyboard: .numberPad)
        }
    }

    // MARK: ABCDE

    private var abcdeSection: some View {
        Group {
            // A
            Section(header: Text("A — Airway").font(.system(size: 12, weight: .heavy)).foregroundStyle(.orange)) {
                Picker("Airway", selection: $data.airway) {
                    ForEach(["Patent", "Compromised", "Obstructed", "Intubated"], id: \.self) { Text($0) }
                }
                .onChange(of: data.airway) { _, _ in save() }
                TextField("Notes", text: $data.airwayNotes, axis: .vertical).lineLimit(2...)
                    .onChange(of: data.airwayNotes) { _, _ in save() }
            }

            // B
            Section(header: Text("B — Breathing").font(.system(size: 12, weight: .heavy)).foregroundStyle(.orange)) {
                vitalRow("Rate (/min)", value: $data.breathingRate, keyboard: .numberPad)
                Picker("Air entry", selection: $data.breathingSounds) {
                    ForEach(["Clear bilaterally", "Reduced R", "Reduced L", "Absent R", "Absent L", "Wheeze", "Crackles"], id: \.self) { Text($0) }
                }
                .onChange(of: data.breathingSounds) { _, _ in save() }
                TextField("Notes", text: $data.breathingNotes, axis: .vertical).lineLimit(2...)
                    .onChange(of: data.breathingNotes) { _, _ in save() }
            }

            // C
            Section(header: Text("C — Circulation").font(.system(size: 12, weight: .heavy)).foregroundStyle(.orange)) {
                vitalRow("HR (bpm)", value: $data.circulationHR, keyboard: .numberPad)
                vitalRow("BP (mmHg)", value: $data.circulationBP, keyboard: .numbersAndPunctuation)
                TextField("Notes", text: $data.circulationNotes, axis: .vertical).lineLimit(2...)
                    .onChange(of: data.circulationNotes) { _, _ in save() }
            }

            // D
            Section(header: Text("D — Disability").font(.system(size: 12, weight: .heavy)).foregroundStyle(.orange)) {
                HStack {
                    Text("GCS Total: \(data.gcsTotalDisplay)")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(gcsColor(data.gcsTotalDisplay))
                    Spacer()
                }
                gcsRow
                TextField("Notes", text: $data.disabilityNotes, axis: .vertical).lineLimit(2...)
                    .onChange(of: data.disabilityNotes) { _, _ in save() }
            }

            // E
            Section(header: Text("E — Exposure").font(.system(size: 12, weight: .heavy)).foregroundStyle(.orange)) {
                TextField("Findings on full exposure", text: $data.exposureNotes, axis: .vertical).lineLimit(3...)
                    .onChange(of: data.exposureNotes) { _, _ in save() }
            }
        }
    }

    private var gcsRow: some View {
        HStack(spacing: 8) {
            gcsPicker("E (1-4)", selection: $data.gcsE, max: 4)
            gcsPicker("V (1-5)", selection: $data.gcsV, max: 5)
            gcsPicker("M (1-6)", selection: $data.gcsM, max: 6)
        }
    }

}
