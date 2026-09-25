import SwiftUI
import SwiftData

struct VitalsEntryView: View {
    let patient: Patient
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var bpSystolic = ""
    @State private var bpDiastolic = ""
    @State private var heartRate = ""
    @State private var respiratoryRate = ""
    @State private var temperatureStr = ""
    @State private var spo2 = ""
    @State private var weightKg = ""
    @State private var glucoseMmol = ""
    @State private var avpu: AVPU = .alert
    @State private var onSupplementalO2 = false
    /// Patient-level NEWS2 SpO₂ Scale 2 opt-in (confirmed hypercapnic respiratory failure).
    @State private var useSpO2Scale2: Bool
    @State private var notes = ""
    @State private var recordedAt = Date.now
    @State private var scoreToggles: [String: Bool] = [:]

    // Quick-fill presets
    private let bpPresets: [(sys: String, dia: String)] = [
        ("100", "60"), ("110", "70"), ("120", "80"),
        ("130", "80"), ("140", "90"), ("150", "95"), ("160", "100"),
    ]
    private let hrPresets   = ["55", "60", "70", "72", "80", "90", "100", "110", "120"]
    private let rrPresets   = ["12", "14", "16", "18", "20", "22", "24"]
    private let tempPresets = ["36.0", "36.5", "36.8", "37.0", "37.5", "38.0", "38.5", "39.0", "39.5"]
    private let spo2Presets     = ["88", "90", "92", "94", "95", "96", "97", "98", "99", "100"]
    private let glucosePresets  = ["3.5", "4.0", "5.0", "5.6", "6.0", "7.0", "8.0", "10.0", "12.0", "15.0", "20.0"]

    init(patient: Patient) {
        self.patient = patient
        _useSpO2Scale2 = State(initialValue: patient.news2UseSpO2Scale2)
    }

    var body: some View {
        NavigationStack {
            Form {
                // One-tap normal fill + live NEWS2 preview
                Section {
                    Button {
                        fillAllNormal()
                    } label: {
                        Label("All Normal (Adult)", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                    .buttonStyle(.plain)
                    DatePicker("Recorded at", selection: $recordedAt)

                    if hasScoreableValue {
                        HStack(spacing: 8) {
                            Image(systemName: liveNews2.band == .high
                                  ? "exclamationmark.triangle.fill"
                                  : liveNews2.band > .low
                                      ? "exclamationmark.triangle"
                                      : "checkmark.circle")
                                .scaledFont(size: 13)
                                .foregroundStyle(liveNews2Color)
                                .accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 1) {
                                Text("NEWS2: \(liveNews2.total) — \(liveNews2.band.label)")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(liveNews2Color)
                                if liveNews2.band == .lowMedium {
                                    Text("Single parameter scoring 3 — urgent ward-based response")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(liveNews2Color)
                                }
                                if let note = liveNews2.incompleteNote {
                                    Text("Partial score — \(note)")
                                        .font(.caption2)
                                        .foregroundStyle(.orange)
                                }
                                Text("Live score · updates as you type")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                        .padding(.vertical, 2)
                        .animation(.easeInOut(duration: 0.2), value: liveNews2.total)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(Text(liveNews2AccessibilityLabel))
                        .accessibilityAddTraits(.updatesFrequently)
                    }
                }

                // BP
                Section {
                    HStack {
                        TextField("Systolic", text: $bpSystolic).keyboardType(.numberPad)
                            .accessibilityLabel("Systolic blood pressure, mmHg")
                        Text("/").foregroundStyle(.secondary)
                            .accessibilityHidden(true)
                        TextField("Diastolic", text: $bpDiastolic).keyboardType(.numberPad)
                            .accessibilityLabel("Diastolic blood pressure, mmHg")
                    }
                    quickChips(bpPresets.map { "\($0.sys)/\($0.dia)" },
                               current: bpSystolic.isEmpty ? "" : "\(bpSystolic)/\(bpDiastolic)") { v in
                        let parts = v.split(separator: "/")
                        bpSystolic = String(parts[0]); bpDiastolic = String(parts[1])
                    }
                } header: { Text("Blood pressure (mmHg)") }

                // HR
                Section {
                    TextField("e.g. 72", text: $heartRate).keyboardType(.numberPad)
                        .accessibilityLabel("Heart rate, beats per minute")
                    quickChips(hrPresets, current: heartRate) { heartRate = $0 }
                } header: { Text("Heart rate (bpm)") }

                // RR
                Section {
                    TextField("e.g. 16", text: $respiratoryRate).keyboardType(.numberPad)
                        .accessibilityLabel("Respiratory rate, breaths per minute")
                    quickChips(rrPresets, current: respiratoryRate) { respiratoryRate = $0 }
                } header: { Text("Respiratory rate (breaths/min)") }

                // Temp
                Section {
                    TextField("e.g. 36.8", text: $temperatureStr).keyboardType(.decimalPad)
                        .accessibilityLabel("Temperature, degrees Celsius")
                    quickChips(tempPresets, current: temperatureStr) { temperatureStr = $0 }
                } header: { Text("Temperature (°C)") }

                // SpO2 + supplemental O₂
                Section {
                    TextField("e.g. 98", text: $spo2).keyboardType(.numberPad)
                        .accessibilityLabel("Oxygen saturation, percent")
                    quickChips(spo2Presets, current: spo2) { spo2 = $0 }
                    Toggle(isOn: $onSupplementalO2) {
                        Label("On supplemental O₂", systemImage: "wind")
                            .font(.subheadline)
                    }
                    .tint(.blue)
                    if onSupplementalO2 {
                        Text("+2 NEWS2 points for supplemental O₂")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    Toggle(isOn: $useSpO2Scale2) {
                        Text("SpO₂ Scale 2 (confirmed hypercapnic respiratory failure)")
                            .font(.subheadline)
                    }
                    .tint(.orange)
                } header: {
                    Text("SpO₂ (%)")
                } footer: {
                    Text(spo2ScaleFooter)
                        .font(.caption2)
                }

                // AVPU consciousness
                Section {
                    Picker("Consciousness", selection: $avpu) {
                        ForEach(AVPU.allCases, id: \.self) { level in
                            Text(level.label).tag(level)
                        }
                    }
                    .pickerStyle(.menu)
                    if avpu != .alert {
                        Label("AVPU \(avpu.rawValue) adds 3 points — review urgently", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                } header: { Text("Consciousness (AVPU)") }

                // Weight — live BMI preview if height is on record
                Section("Weight (kg)") {
                    TextField("e.g. 75.0", text: $weightKg).keyboardType(.decimalPad)
                        .accessibilityLabel("Weight, kilograms")
                    if let wt = Double(weightKg), wt > 0,
                       let h = patient.heightCm, h > 0 {
                        let hm = h / 100.0
                        let bmi = wt / (hm * hm)
                        let cat: String = bmi < 18.5 ? "Underweight"
                                        : bmi < 25   ? "Normal"
                                        : bmi < 30   ? "Overweight"
                                        :               "Obese"
                        LabeledContent("BMI") {
                            Text(String(format: "%.1f — %@", bmi, cat))
                                .foregroundStyle(bmi < 18.5 || bmi >= 30 ? .orange : .secondary)
                        }
                        .font(.caption)
                        .animation(.easeInOut(duration: 0.15), value: weightKg)
                    }
                }
                // Blood glucose — quick chips cover common clinical values
                Section("Blood glucose (mmol/L)") {
                    TextField("e.g. 5.6", text: $glucoseMmol).keyboardType(.decimalPad)
                        .accessibilityLabel("Blood glucose, millimoles per litre")
                    quickChips(glucosePresets, current: glucoseMmol) { glucoseMmol = $0 }
                }

                Section("Notes") {
                    TextField("Any additional observations", text: $notes, axis: .vertical)
                        .lineLimit(3...)
                }

                if let radiation = DiagnosisRadiationEngine.radiate(
                    workingDiagnosis: patient.workingDiagnosis,
                    ageYears: patient.ageYears,
                    sex: patient.sex
                ), let scoring = radiation.scoringCriteria {
                    clinicalScoringSection(radiation: radiation, scoring: scoring)
                }
            }
            .navigationTitle("Record Vitals")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }.disabled(!hasAnyValue)
                }
            }
        }
    }

    // MARK: - Quick-chip row (horizontal scroll, accent when selected)

    @ViewBuilder
    private func quickChips(_ values: [String], current: String, onTap: @escaping (String) -> Void) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(values, id: \.self) { v in
                    let sel = v == current
                    Button { onTap(v) } label: {
                        Text(v)
                            .font(.caption2.weight(sel ? .semibold : .regular))
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(sel ? AMColor.accent : AMColor.accentLt, in: Capsule())
                            .foregroundStyle(sel ? Color.white : AMColor.accent)
                            // 44 pt tall hit area; the capsule keeps its size.
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(sel ? .isSelected : [])
                }
            }
        }
        // The 44 pt chip targets reach into the row's own vertical inset, so the row keeps
        // its height (the chips used to add 2 pt of padding here).
        .padding(.vertical, -8)
    }

    // MARK: - Clinical scoring section (diagnosis-radiation driven)

    @ViewBuilder
    private func clinicalScoringSection(
        radiation: DiagnosisRadiation,
        scoring: DiagnosisRadiation.ScoringCriteria
    ) -> some View {
        let liveScore = scoring.variables.reduce(0) { acc, v in
            acc + ((scoreToggles[v.id] == true) ? v.points : 0)
        }
        let isSevere = liveScore >= scoring.severeThreshold
        Section {
            HStack(spacing: 10) {
                Image(systemName: isSevere ? "exclamationmark.triangle.fill" : "checklist")
                    .foregroundStyle(isSevere ? .red : .teal)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(scoring.scoreName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(isSevere ? .red : .primary)
                    Text(scoring.timingNote)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 1) {
                    Text("\(liveScore) / \(scoring.maxScore)")
                        .font(.title3.weight(.bold).monospacedDigit())
                        .foregroundStyle(isSevere ? .red : .teal)
                    Text(isSevere ? scoring.aboveThresholdLabel : scoring.belowThresholdLabel)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(isSevere ? .red : .secondary)
                }
            }
            .padding(.vertical, 4)
            .animation(.easeInOut(duration: 0.15), value: liveScore)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text(A11yLabel.joined([
                scoring.scoreName,
                "\(liveScore) of \(scoring.maxScore)",
                isSevere ? scoring.aboveThresholdLabel : scoring.belowThresholdLabel,
                scoring.timingNote,
            ])))

            ForEach(scoring.variables, id: \.id) { variable in
                let isOn = Binding(
                    get: { scoreToggles[variable.id] ?? false },
                    set: { scoreToggles[variable.id] = $0 }
                )
                Toggle(isOn: isOn) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(variable.label)
                            .font(.subheadline)
                        if !variable.hint.isEmpty {
                            Text(variable.hint)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .tint(.teal)
            }
        } header: {
            HStack(spacing: 4) {
                Image(systemName: "brain.head.profile")
                    .font(.caption)
                    .foregroundStyle(.teal)
                    .accessibilityHidden(true)
                Text("Clinical Scoring · \(radiation.conditionName)")
            }
            .foregroundStyle(.teal)
        } footer: {
            if let ref = radiation.guidelineReference {
                Text(ref)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Live NEWS2 preview (same NEWS2Chart calculation as VitalsEntry and the Scores screen)

    private var liveNews2: NEWS2Result {
        NEWS2Chart.evaluate(respiratoryRate: Int(respiratoryRate),
                            spo2: Int(spo2),
                            onOxygen: onSupplementalO2,
                            useSpO2Scale2: useSpO2Scale2,
                            systolicBP: Int(bpSystolic),
                            heartRate: Int(heartRate),
                            temperatureCelsius: Double(temperatureStr),
                            avpu: avpu)
    }

    /// "NEWS2 7, high risk", the single-parameter / incomplete notes, and that it is live.
    private var liveNews2AccessibilityLabel: String {
        let r = liveNews2
        return A11yLabel.joined([
            A11yLabel.news2(score: r.total, risk: r.band.label),
            r.band == .lowMedium ? "Single parameter scoring 3, urgent ward-based response" : nil,
            r.incompleteNote.map { "Partial score, \($0)" },
            "Live score, updates as you type",
        ])
    }

    private var spo2ScaleFooter: String {
        useSpO2Scale2
            ? "Scale 2 applies to all NEWS2 scores for this patient. Use only on a clinician's decision for confirmed hypercapnic respiratory failure (RCP NEWS2)."
            : "Scale 1 (standard). Being on oxygen does not change the scale; Scale 2 is only for confirmed hypercapnic respiratory failure."
    }

    private var liveNews2Color: Color {
        switch liveNews2.band {
        case .high:      return .red
        case .medium:    return .orange
        case .lowMedium: return .orange
        case .low:       return .green
        }
    }

    private var hasScoreableValue: Bool {
        !bpSystolic.isEmpty || !heartRate.isEmpty || !respiratoryRate.isEmpty ||
        !temperatureStr.isEmpty || !spo2.isEmpty
    }

    // MARK: - Helpers

    private func fillAllNormal() {
        bpSystolic = "120"; bpDiastolic = "80"
        heartRate = "72"
        respiratoryRate = "16"
        temperatureStr = "36.8"
        spo2 = "98"
    }

    private var hasAnyValue: Bool {
        !bpSystolic.isEmpty || !heartRate.isEmpty || !respiratoryRate.isEmpty ||
        !temperatureStr.isEmpty || !spo2.isEmpty || !weightKg.isEmpty || !glucoseMmol.isEmpty
    }

    private func save() {
        let entry = VitalsEntry(patient: patient, recordedAt: recordedAt)
        entry.bpSystolic         = Int(bpSystolic)
        entry.bpDiastolic        = Int(bpDiastolic)
        entry.heartRate          = Int(heartRate)
        entry.respiratoryRate    = Int(respiratoryRate)
        entry.temperatureCelsius = Double(temperatureStr)
        entry.spo2               = Int(spo2)
        entry.weightKg           = Double(weightKg)
        entry.glucoseMmol        = Double(glucoseMmol)
        entry.avpu               = avpu
        entry.onSupplementalO2   = onSupplementalO2
        entry.notes              = notes.isEmpty ? nil : notes
        if patient.news2UseSpO2Scale2 != useSpO2Scale2 {
            patient.news2UseSpO2Scale2 = useSpO2Scale2
            patient.updatedAt = .now
            patient.pendingSync = true
            AuditLog.record("update", "patient", patient: patient,
                            details: ["news2_spo2_scale2": useSpO2Scale2 ? "on" : "off"])
        }
        context.insert(entry)
        try? context.save()
        AuditLog.record("create", "vitals", patient: patient, resourceId: entry.syncCode)
        dismiss()
    }
}
