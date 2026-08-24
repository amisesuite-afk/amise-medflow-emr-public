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
    @State private var notes = ""
    @State private var recordedAt = Date.now

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
                            Image(systemName: liveNews2Score >= 7
                                  ? "exclamationmark.triangle.fill"
                                  : liveNews2Score >= 5
                                      ? "exclamationmark.triangle"
                                      : "checkmark.circle")
                                .font(.system(size: 13))
                                .foregroundStyle(liveNews2Color)
                            VStack(alignment: .leading, spacing: 1) {
                                Text("NEWS2: \(liveNews2Score) — \(liveNews2Risk)")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(liveNews2Color)
                                Text("Live score · updates as you type")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                        .padding(.vertical, 2)
                        .animation(.easeInOut(duration: 0.2), value: liveNews2Score)
                    }
                }

                // BP
                Section {
                    HStack {
                        TextField("Systolic", text: $bpSystolic).keyboardType(.numberPad)
                        Text("/").foregroundStyle(.secondary)
                        TextField("Diastolic", text: $bpDiastolic).keyboardType(.numberPad)
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
                    quickChips(hrPresets, current: heartRate) { heartRate = $0 }
                } header: { Text("Heart rate (bpm)") }

                // RR
                Section {
                    TextField("e.g. 16", text: $respiratoryRate).keyboardType(.numberPad)
                    quickChips(rrPresets, current: respiratoryRate) { respiratoryRate = $0 }
                } header: { Text("Respiratory rate (breaths/min)") }

                // Temp
                Section {
                    TextField("e.g. 36.8", text: $temperatureStr).keyboardType(.decimalPad)
                    quickChips(tempPresets, current: temperatureStr) { temperatureStr = $0 }
                } header: { Text("Temperature (°C)") }

                // SpO2
                Section {
                    TextField("e.g. 98", text: $spo2).keyboardType(.numberPad)
                    quickChips(spo2Presets, current: spo2) { spo2 = $0 }
                } header: { Text("SpO₂ (%)") }

                // Weight — live BMI preview if height is on record
                Section("Weight (kg)") {
                    TextField("e.g. 75.0", text: $weightKg).keyboardType(.decimalPad)
                    if let wt = Double(weightKg), wt > 0,
                       let h = patient.heightCm, h > 0 {
                        let hm = h / 100.0
                        let bmi = wt / (hm * hm)
                        let cat: String
                        switch bmi {
                        case ..<18.5: cat = "Underweight"
                        case 18.5..<25: cat = "Normal"
                        case 25..<30: cat = "Overweight"
                        default: cat = "Obese"
                        }
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
                    quickChips(glucosePresets, current: glucoseMmol) { glucoseMmol = $0 }
                }

                Section("Notes") {
                    TextField("Any additional observations", text: $notes, axis: .vertical)
                        .lineLimit(3...)
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
                    Button(v) { onTap(v) }
                        .font(.caption2.weight(sel ? .semibold : .regular))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(sel ? AMColor.accent : AMColor.accentLt, in: Capsule())
                        .foregroundStyle(sel ? Color.white : AMColor.accent)
                        .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 2)
        }
    }

    // MARK: - Live NEWS2 preview (mirrors VitalsEntry.news2Score)

    private var liveNews2Score: Int {
        var s = 0
        if let rr = Int(respiratoryRate) {
            s += rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3
        }
        if let spo = Int(spo2) {
            s += spo >= 96 ? 0 : spo >= 94 ? 1 : spo >= 92 ? 2 : 3
        }
        if let sys = Int(bpSystolic) {
            s += sys <= 90 ? 3 : sys <= 100 ? 2 : sys <= 110 ? 1 : sys <= 219 ? 0 : 3
        }
        if let hr = Int(heartRate) {
            s += hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3
        }
        if let t = Double(temperatureStr) {
            s += t <= 35.0 ? 3 : t <= 36.0 ? 1 : t <= 38.0 ? 0 : t <= 39.0 ? 1 : 2
        }
        return s
    }

    private var liveNews2Risk: String {
        liveNews2Score <= 4 ? "Low" : liveNews2Score <= 6 ? "Medium" : "High"
    }

    private var liveNews2Color: Color {
        liveNews2Score <= 4 ? .green : liveNews2Score <= 6 ? .orange : .red
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
        entry.notes              = notes.isEmpty ? nil : notes
        context.insert(entry)
        dismiss()
    }
}
