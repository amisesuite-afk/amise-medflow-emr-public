import SwiftUI
import SwiftData

struct VitalsHistoryView: View {
    let patient: Patient
    @Environment(\.modelContext) private var context
    @State private var showEntry = false

    private var sortedEntries: [VitalsEntry] {
        patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }
    }

    var body: some View {
        Group {
            if sortedEntries.isEmpty {
                ContentUnavailableView(
                    "No vitals recorded",
                    systemImage: "waveform.path.ecg",
                    description: Text("Tap + to record the first set of vitals.")
                )
                .listRowBackground(Color.clear)
            } else {
                ForEach(sortedEntries) { entry in
                    VitalsRow(entry: entry)
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                context.delete(entry)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showEntry = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showEntry) {
            VitalsEntryView(patient: patient)
        }
    }
}

// MARK: - Vitals row

struct VitalsRow: View {
    let entry: VitalsEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(entry.recordedAt, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                if entry.hasAnyValue {
                    Text("NEWS2: \(entry.news2Score) — \(entry.news2Risk)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color(hex: entry.news2Color))
                }
            }

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
            ], alignment: .leading, spacing: 4) {
                if let bp = entry.bpString {
                    VitalChip(label: "BP", value: bp, unit: "mmHg")
                }
                if let hr = entry.heartRate {
                    VitalChip(label: "HR", value: "\(hr)", unit: "bpm")
                }
                if let rr = entry.respiratoryRate {
                    VitalChip(label: "RR", value: "\(rr)", unit: "/min")
                }
                if let temp = entry.temperatureCelsius {
                    VitalChip(label: "Temp", value: String(format: "%.1f", temp), unit: "°C",
                              alert: temp > 38.5 || temp < 36.0)
                }
                if let spo = entry.spo2 {
                    VitalChip(label: "SpO₂", value: "\(spo)", unit: "%",
                              alert: spo < 94)
                }
                if let wt = entry.weightKg {
                    VitalChip(label: "Wt", value: String(format: "%.1f", wt), unit: "kg")
                }
                if let gluc = entry.glucoseMmol {
                    VitalChip(label: "Glucose", value: String(format: "%.1f", gluc), unit: "mmol/L",
                              alert: gluc > 11.0 || gluc < 3.9)
                }
            }

            if let notes = entry.notes {
                Text(notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Vital chip

struct VitalChip: View {
    let label: String
    let value: String
    let unit: String
    var alert: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            HStack(alignment: .lastTextBaseline, spacing: 2) {
                Text(value)
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(alert ? .red : .primary)
                Text(unit)
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(alert ? Color.red.opacity(0.08) : Color.secondary.opacity(0.08))
        )
    }
}
