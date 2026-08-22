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

    var body: some View {
        NavigationStack {
            Form {
                Section("Blood pressure (mmHg)") {
                    HStack {
                        TextField("Systolic", text: $bpSystolic)
                            .keyboardType(.numberPad)
                        Text("/")
                            .foregroundStyle(.secondary)
                        TextField("Diastolic", text: $bpDiastolic)
                            .keyboardType(.numberPad)
                    }
                }

                Section("Heart rate (bpm)") {
                    TextField("e.g. 72", text: $heartRate)
                        .keyboardType(.numberPad)
                }

                Section("Respiratory rate (breaths/min)") {
                    TextField("e.g. 16", text: $respiratoryRate)
                        .keyboardType(.numberPad)
                }

                Section("Temperature (°C)") {
                    TextField("e.g. 36.8", text: $temperatureStr)
                        .keyboardType(.decimalPad)
                }

                Section("SpO₂ (%)") {
                    TextField("e.g. 98", text: $spo2)
                        .keyboardType(.numberPad)
                }

                Section("Weight (kg)") {
                    TextField("e.g. 75.0", text: $weightKg)
                        .keyboardType(.decimalPad)
                }

                Section("Blood glucose (mmol/L)") {
                    TextField("e.g. 5.6", text: $glucoseMmol)
                        .keyboardType(.decimalPad)
                }

                Section("Notes") {
                    TextField("Any additional observations", text: $notes, axis: .vertical)
                        .lineLimit(3...)
                }

                Section {
                    DatePicker("Recorded at", selection: $recordedAt)
                }
            }
            .navigationTitle("Record Vitals")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!hasAnyValue)
                }
            }
        }
    }

    private var hasAnyValue: Bool {
        !bpSystolic.isEmpty || !heartRate.isEmpty || !respiratoryRate.isEmpty ||
        !temperatureStr.isEmpty || !spo2.isEmpty || !weightKg.isEmpty
    }

    private func save() {
        let entry = VitalsEntry(patient: patient, recordedAt: recordedAt)
        entry.bpSystolic      = Int(bpSystolic)
        entry.bpDiastolic     = Int(bpDiastolic)
        entry.heartRate       = Int(heartRate)
        entry.respiratoryRate = Int(respiratoryRate)
        entry.temperatureCelsius = Double(temperatureStr)
        entry.spo2            = Int(spo2)
        entry.weightKg        = Double(weightKg)
        entry.glucoseMmol     = Double(glucoseMmol)
        entry.notes           = notes.isEmpty ? nil : notes
        context.insert(entry)
        dismiss()
    }
}
