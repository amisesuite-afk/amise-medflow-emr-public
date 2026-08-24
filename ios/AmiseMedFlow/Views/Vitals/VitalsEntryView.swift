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
    private let spo2Presets = ["88", "90", "92", "94", "95", "96", "97", "98", "99", "100"]

    var body: some View {
        NavigationStack {
            Form {
                // One-tap normal fill
                Section {
                    Button {
                        fillAllNormal()
                    } label: {
                        Label("All Normal (Adult)", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                    .buttonStyle(.plain)
                    DatePicker("Recorded at", selection: $recordedAt)
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

                // Weight & glucose — no presets, too patient-specific
                Section("Weight (kg)") {
                    TextField("e.g. 75.0", text: $weightKg).keyboardType(.decimalPad)
                }
                Section("Blood glucose (mmol/L)") {
                    TextField("e.g. 5.6", text: $glucoseMmol).keyboardType(.decimalPad)
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
        !temperatureStr.isEmpty || !spo2.isEmpty || !weightKg.isEmpty
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
