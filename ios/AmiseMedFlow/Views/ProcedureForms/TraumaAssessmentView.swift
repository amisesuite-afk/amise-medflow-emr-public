import SwiftUI
import SwiftData

// MARK: - Data model

struct TraumaData: Codable {
    // MIST
    var mechanism: [String] = []
    var timeOfInjury: Date?
    var injuriesSuspected: String = ""
    var signsAtScene: String = ""
    var preHospitalInterventions: [String] = []

    // Vitals on admission
    var hr: String = ""
    var sbp: String = ""
    var dbp: String = ""
    var rr: String = ""
    var spo2: String = ""
    var temp: String = ""
    var gcs: String = ""
    var glucose: String = ""
    var pupils: String = ""
    var pain: String = ""
    var ebl: String = ""

    // ABCDE
    var airway: String = "Patent"
    var airwayNotes: String = ""
    var breathingRate: String = ""
    var breathingSounds: String = "Clear bilaterally"
    var breathingNotes: String = ""
    var circulationHR: String = ""
    var circulationBP: String = ""
    var circulationNotes: String = ""
    var gcsE: String = "4"
    var gcsV: String = "5"
    var gcsM: String = "6"
    var disabilityNotes: String = ""
    var exposureNotes: String = ""

    // ISS — AIS per region (0–6)
    var aisHead: Int = 0
    var aisFace: Int = 0
    var aisChest: Int = 0
    var aisAbdomen: Int = 0
    var aisExtremities: Int = 0
    var aisSkinSurface: Int = 0

    // Secondary survey (14 regions)
    var secondarySurveyNotes: [String: String] = [:]

    // Burns
    var burnRegions: [String: Double] = [:]
    var inhalationInjury: Bool = false
    var burnsNotes: String = ""
    var weightKg: String = ""

    // Interventions
    var interventions: [String] = []
    var notes: String = ""

    var iss: Int {
        let scores = [aisHead, aisFace, aisChest, aisAbdomen, aisExtremities, aisSkinSurface]
        let top3 = scores.filter { $0 > 0 }.sorted(by: >).prefix(3)
        return top3.map { $0 * $0 }.reduce(0, +)
    }

    var niss: Int {
        let scores = [aisHead, aisFace, aisChest, aisAbdomen, aisExtremities, aisSkinSurface]
        let top3 = scores.sorted(by: >).prefix(3)
        return top3.map { $0 * $0 }.reduce(0, +)
    }

    var tbsa: Double {
        burnRegions.values.reduce(0, +)
    }

    var parklandVolume: Double? {
        guard let wt = Double(weightKg), wt > 0, tbsa > 0 else { return nil }
        return 4 * wt * tbsa
    }

    var revisedBaux: Double? {
        // Requires age — stored externally
        return nil
    }

    var gcsTotalDisplay: Int {
        (Int(gcsE) ?? 0) + (Int(gcsV) ?? 0) + (Int(gcsM) ?? 0)
    }

    var mtpTrigger: Bool {
        guard let hrVal = Int(hr), let sbpVal = Int(sbp) else { return false }
        return hrVal > 120 && sbpVal < 90
    }
}

extension Patient {
    var traumaData: TraumaData {
        get {
            guard let json = traumaDataJson, let data = json.data(using: .utf8) else { return TraumaData() }
            return (try? JSONDecoder().decode(TraumaData.self, from: data)) ?? TraumaData()
        }
        set {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            traumaDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}

// MARK: - View

struct TraumaAssessmentView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State private var data: TraumaData = TraumaData()
    @State private var hasTOI = false
    @State private var expandedSection: String? = "mist"

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

            Section("Interventions & Notes") {
                multiSelectRow("Interventions", options: [
                    "IV access", "Arterial line", "CVP line", "Urinary catheter",
                    "NG tube", "Chest drain", "Pericardiocentesis",
                    "Damage control surgery", "Transfusion", "Intubation"
                ], selected: $data.interventions)
                TextField("Additional notes", text: $data.notes, axis: .vertical)
                    .lineLimit(3...)
            }
            .onChange(of: data.interventions) { _, _ in save() }
            .onChange(of: data.notes) { _, _ in save() }
        }
        .navigationTitle("Trauma Assessment")
        .navigationBarTitleDisplayMode(.inline)
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

    // MARK: ISS

    private var issSection: some View {
        Group {
            HStack(spacing: 20) {
                issBadge("ISS", score: data.iss)
                issBadge("NISS", score: data.niss)
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(issCategory(data.iss))
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(issColor(data.iss))
                    if data.iss == 75 {
                        Text("Unsurvivable").font(.caption2).foregroundStyle(.red)
                    }
                }
            }
            .padding(.vertical, 4)
            .listRowBackground(Color.secondary.opacity(0.05))

            aisRow("Head & Neck", value: $data.aisHead)
            aisRow("Face", value: $data.aisFace)
            aisRow("Chest", value: $data.aisChest)
            aisRow("Abdomen & Pelvis", value: $data.aisAbdomen)
            aisRow("Extremities & Pelvis", value: $data.aisExtremities)
            aisRow("External / Skin", value: $data.aisSkinSurface)
        }
    }

    // MARK: Secondary Survey

    private var secondarySection: some View {
        Group {
            ForEach(secondaryRegions, id: \.self) { region in
                TextField(region, text: Binding(
                    get: { data.secondarySurveyNotes[region] ?? "" },
                    set: { data.secondarySurveyNotes[region] = $0.isEmpty ? nil : $0; save() }
                ), axis: .vertical)
                .lineLimit(1...)
            }
        }
    }

    // MARK: Burns

    private var burnsSection: some View {
        Group {
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("TBSA").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
                    Text(String(format: "%.1f%%", data.tbsa))
                        .font(.system(size: 22, weight: .heavy))
                        .foregroundStyle(data.tbsa > 20 ? .red : data.tbsa > 10 ? .orange : .primary)
                }
                if let parkland = data.parklandVolume {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Parkland (24h)").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
                        Text(String(format: "%.0f mL", parkland))
                            .font(.system(size: 18, weight: .semibold)).foregroundStyle(.blue)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("First 8h").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
                        Text(String(format: "%.0f mL", parkland / 2))
                            .font(.system(size: 14)).foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.vertical, 4)
            .listRowBackground(Color.orange.opacity(0.06))

            HStack {
                TextField("Weight (kg)", text: $data.weightKg)
                    .keyboardType(.decimalPad)
                    .onChange(of: data.weightKg) { _, _ in save() }
                Text("kg").foregroundStyle(.secondary)
            }

            Text("Rule of Nines — tap region to toggle")
                .font(.caption).foregroundStyle(.secondary)

            ForEach(burnRegionKeys.keys.sorted(), id: \.self) { region in
                let maxPct = burnRegionKeys[region] ?? 9.0
                HStack {
                    Text(region).frame(width: 140, alignment: .leading)
                    Slider(value: Binding(
                        get: { data.burnRegions[region] ?? 0 },
                        set: { data.burnRegions[region] = $0; save() }
                    ), in: 0...maxPct, step: 0.5)
                    Text(String(format: "%.1f%%", data.burnRegions[region] ?? 0))
                        .font(.system(size: 12, weight: .semibold))
                        .frame(width: 44, alignment: .trailing)
                        .foregroundStyle((data.burnRegions[region] ?? 0) > 0 ? .orange : .secondary)
                }
            }

            Toggle("Inhalation injury", isOn: $data.inhalationInjury)
                .onChange(of: data.inhalationInjury) { _, _ in save() }

            if patient.ageYears > 0 {
                let baux = Double(patient.ageYears) + data.tbsa + (data.inhalationInjury ? 17 : 0)
                LabeledContent("Revised Baux Score") {
                    Text(String(format: "%.0f", baux))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(baux > 120 ? .red : baux > 80 ? .orange : .primary)
                }
            }

            TextField("Burns notes", text: $data.burnsNotes, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.burnsNotes) { _, _ in save() }
        }
    }

    // MARK: Helpers

    private func save() {
        patient.traumaData = data
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    @ViewBuilder
    private func collapsibleSection<Content: View>(_ title: String, icon: String, key: String, @ViewBuilder content: () -> Content) -> some View {
        Section {
            if expandedSection == key {
                content()
            }
        } header: {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    expandedSection = expandedSection == key ? nil : key
                }
            } label: {
                HStack {
                    Image(systemName: icon).font(.system(size: 11))
                    Text(title).font(.system(size: 12, weight: .semibold))
                    Spacer()
                    Image(systemName: expandedSection == key ? "chevron.up" : "chevron.down")
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                }
                .foregroundStyle(expandedSection == key ? AMColor.accent : .primary)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private func multiSelectRow(_ label: String, options: [String], selected: Binding<[String]>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.system(size: 12)).foregroundStyle(.secondary)
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

    @ViewBuilder
    private func vitalRow(_ label: String, value: Binding<String>, keyboard: UIKeyboardType = .numberPad) -> some View {
        HStack {
            Text(label).layoutPriority(1)
            Spacer()
            TextField("—", text: value)
                .keyboardType(keyboard)
                .multilineTextAlignment(.trailing)
                .frame(width: 80)
                .onChange(of: value.wrappedValue) { _, _ in save() }
        }
    }

    @ViewBuilder
    private func vitalField(_ placeholder: String, value: Binding<String>) -> some View {
        TextField(placeholder, text: value)
            .keyboardType(.numberPad)
            .frame(width: 50)
            .multilineTextAlignment(.center)
            .onChange(of: value.wrappedValue) { _, _ in save() }
    }

    @ViewBuilder
    private func gcsPicker(_ label: String, selection: Binding<String>, max: Int) -> some View {
        VStack(spacing: 2) {
            Text(label).font(.system(size: 9)).foregroundStyle(.secondary)
            Picker("", selection: selection) {
                ForEach(1...max, id: \.self) { n in Text("\(n)").tag("\(n)") }
            }
            .pickerStyle(.wheel)
            .frame(height: 80)
            .clipped()
            .onChange(of: selection.wrappedValue) { _, _ in save() }
        }
    }

    @ViewBuilder
    private func aisRow(_ region: String, value: Binding<Int>) -> some View {
        HStack {
            Text(region)
            Spacer()
            Picker("AIS", selection: value) {
                ForEach(aisOptions, id: \.self) { n in
                    Text("\(n)").tag(n)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 220)
            .onChange(of: value.wrappedValue) { _, _ in save() }
        }
    }

    private func issBadge(_ label: String, score: Int) -> some View {
        VStack(spacing: 1) {
            Text(label).font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
            Text("\(score)")
                .font(.system(size: 22, weight: .heavy))
                .foregroundStyle(issColor(score))
        }
    }

    private func issColor(_ score: Int) -> Color {
        switch score {
        case 0...15: return .green
        case 16...24: return .orange
        default: return .red
        }
    }

    private func issCategory(_ score: Int) -> String {
        switch score {
        case 0: return "No injury"
        case 1...8: return "Minor"
        case 9...15: return "Moderate"
        case 16...24: return "Serious"
        case 25...40: return "Severe"
        case 41...74: return "Critical"
        default: return "Unsurvivable"
        }
    }

    private func gcsColor(_ score: Int) -> Color {
        switch score {
        case 13...15: return .green
        case 9...12: return .orange
        default: return .red
        }
    }
}
