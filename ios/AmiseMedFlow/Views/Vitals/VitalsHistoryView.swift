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
                if sortedEntries.filter({ $0.hasAnyValue }).count >= 2 {
                    NEWS2Sparkline(entries: sortedEntries)
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                }

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

// MARK: - NEWS2 sparkline

struct NEWS2Sparkline: View {
    let entries: [VitalsEntry]

    private var displayEntries: [VitalsEntry] {
        Array(entries.filter { $0.hasAnyValue }.prefix(7).reversed())
    }

    private var scores: [Int] { displayEntries.map { $0.news2Score } }

    private var trendColor: Color {
        guard scores.count >= 2 else { return .secondary }
        let delta = scores.last! - scores.first!
        if delta < 0 { return .green }
        if delta > 0 { return .red }
        return .secondary
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("NEWS2 trend — last \(displayEntries.count) readings")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .kerning(0.3)

            Canvas { ctx, size in
                guard scores.count >= 2 else { return }
                let maxScore = max(7, scores.max() ?? 7)
                let minScore = min(0, scores.min() ?? 0)
                let range = Double(maxScore - minScore) == 0 ? 1.0 : Double(maxScore - minScore)
                let stepX = size.width / Double(scores.count - 1)

                func pt(_ i: Int) -> CGPoint {
                    let x = Double(i) * stepX
                    let y = size.height * (1.0 - Double(scores[i] - minScore) / range)
                    return CGPoint(x: x, y: y)
                }

                var fillPath = Path()
                fillPath.move(to: CGPoint(x: 0, y: size.height))
                for i in 0 ..< scores.count { fillPath.addLine(to: pt(i)) }
                fillPath.addLine(to: CGPoint(x: size.width, y: size.height))
                fillPath.closeSubpath()
                ctx.fill(fillPath, with: .color(trendColor.opacity(0.08)))

                var linePath = Path()
                linePath.move(to: pt(0))
                for i in 1 ..< scores.count { linePath.addLine(to: pt(i)) }
                ctx.stroke(linePath, with: .color(trendColor), style: StrokeStyle(lineWidth: 2, lineJoin: .round))

                for i in 0 ..< scores.count {
                    let p = pt(i)
                    let dot = CGRect(x: p.x - 3, y: p.y - 3, width: 6, height: 6)
                    ctx.fill(Path(ellipseIn: dot), with: .color(trendColor))
                    let inner = CGRect(x: p.x - 1.5, y: p.y - 1.5, width: 3, height: 3)
                    ctx.fill(Path(ellipseIn: inner), with: .color(.white))
                }
            }
            .frame(height: 44)
        }
        .padding(.horizontal, 2)
        .padding(.vertical, 6)
    }
}
