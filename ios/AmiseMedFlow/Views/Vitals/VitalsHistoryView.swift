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
                    VitalsMultiSparkline(entries: sortedEntries)
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 8, trailing: 16))
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
                if let bp = entry.bpString, let sys = entry.bpSystolic {
                    VitalChip(label: "BP", value: bp, unit: "mmHg",
                              alert: sys > 180 || sys < 90)
                }
                if let hr = entry.heartRate {
                    VitalChip(label: "HR", value: "\(hr)", unit: "bpm",
                              alert: hr > 130 || hr < 40)
                }
                if let rr = entry.respiratoryRate {
                    VitalChip(label: "RR", value: "\(rr)", unit: "/min",
                              alert: rr > 24 || rr <= 8)
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

// MARK: - Multi-vital sparklines

struct VitalsMultiSparkline: View {
    let entries: [VitalsEntry]

    private var displayEntries: [VitalsEntry] {
        Array(entries.filter { $0.hasAnyValue }.prefix(7).reversed())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Vital trends — last \(displayEntries.count) readings")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .kerning(0.3)

            let hrValues   = displayEntries.compactMap { $0.heartRate.map      { Double($0) } }
            let bpValues   = displayEntries.compactMap { $0.bpSystolic.map     { Double($0) } }
            let spo2Values = displayEntries.compactMap { $0.spo2.map           { Double($0) } }
            let tempValues = displayEntries.compactMap { $0.temperatureCelsius }

            if hrValues.count >= 2 {
                VitalTrendLine(label: "HR", unit: "bpm", values: hrValues,
                               color: .orange, alertAbove: 130, alertBelow: 40)
            }
            if bpValues.count >= 2 {
                VitalTrendLine(label: "BP sys", unit: "mmHg", values: bpValues,
                               color: .red, alertAbove: 180, alertBelow: 90)
            }
            if spo2Values.count >= 2 {
                VitalTrendLine(label: "SpO₂", unit: "%", values: spo2Values,
                               color: .blue, alertAbove: nil, alertBelow: 94)
            }
            if tempValues.count >= 2 {
                VitalTrendLine(label: "Temp", unit: "°C", values: tempValues,
                               color: .teal, alertAbove: 38.5, alertBelow: 36.0)
            }
        }
        .padding(.horizontal, 2)
        .padding(.vertical, 6)
    }
}

struct VitalTrendLine: View {
    let label: String
    let unit: String
    let values: [Double]
    let color: Color
    let alertAbove: Double?
    let alertBelow: Double?

    private var isAlert: Bool {
        guard let last = values.last else { return false }
        if let hi = alertAbove, last > hi { return true }
        if let lo = alertBelow, last < lo { return true }
        return false
    }

    private var lineColor: Color { isAlert ? .red : color }

    var body: some View {
        HStack(spacing: 8) {
            VStack(alignment: .trailing, spacing: 1) {
                Text(label)
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                if let last = values.last {
                    Text(label == "Temp" ? String(format: "%.1f", last) : "\(Int(last))")
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .foregroundStyle(isAlert ? .red : .primary)
                }
            }
            .frame(width: 36, alignment: .trailing)

            Canvas { ctx, size in
                guard values.count >= 2 else { return }
                let minV = values.min()! - 1
                let maxV = values.max()! + 1
                let range = maxV - minV == 0 ? 1.0 : maxV - minV
                let stepX = size.width / Double(values.count - 1)

                func pt(_ i: Int) -> CGPoint {
                    CGPoint(
                        x: Double(i) * stepX,
                        y: size.height * (1.0 - (values[i] - minV) / range)
                    )
                }

                var fill = Path()
                fill.move(to: CGPoint(x: 0, y: size.height))
                for i in 0 ..< values.count { fill.addLine(to: pt(i)) }
                fill.addLine(to: CGPoint(x: size.width, y: size.height))
                fill.closeSubpath()
                ctx.fill(fill, with: .color(lineColor.opacity(0.07)))

                var line = Path()
                line.move(to: pt(0))
                for i in 1 ..< values.count { line.addLine(to: pt(i)) }
                ctx.stroke(line, with: .color(lineColor),
                           style: StrokeStyle(lineWidth: 1.5, lineJoin: .round))

                let last = pt(values.count - 1)
                let dot = CGRect(x: last.x - 3, y: last.y - 3, width: 6, height: 6)
                ctx.fill(Path(ellipseIn: dot), with: .color(lineColor))
                let inner = CGRect(x: last.x - 1.5, y: last.y - 1.5, width: 3, height: 3)
                ctx.fill(Path(ellipseIn: inner), with: .color(.white))
            }
            .frame(height: 32)

            Text(unit)
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
                .frame(width: 26, alignment: .leading)
        }
    }
}
