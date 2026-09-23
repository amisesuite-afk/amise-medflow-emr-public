// VitalsHistoryView+Sparklines.swift
// Multi-vital sparkline views and lab summary strip for VitalsHistoryView.

import SwiftUI
import SwiftData


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

            let hrValues      = displayEntries.compactMap { $0.heartRate.map      { Double($0) } }
            let bpValues      = displayEntries.compactMap { $0.bpSystolic.map     { Double($0) } }
            let spo2Values    = displayEntries.compactMap { $0.spo2.map           { Double($0) } }
            let tempValues    = displayEntries.compactMap { $0.temperatureCelsius }
            let glucoseValues = displayEntries.compactMap { $0.glucoseMmol }
            let weightValues  = displayEntries.compactMap { $0.weightKg }

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
                               color: .teal, alertAbove: 38.5, alertBelow: 36.0,
                               formatDecimal: true)
            }
            if glucoseValues.count >= 2 {
                VitalTrendLine(label: "BGL", unit: "mmol/L", values: glucoseValues,
                               color: .purple, alertAbove: 11.0, alertBelow: 3.9,
                               formatDecimal: true)
            }
            if weightValues.count >= 2 {
                VitalTrendLine(label: "Wt", unit: "kg", values: weightValues,
                               color: .gray, alertAbove: nil, alertBelow: nil,
                               formatDecimal: true)
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
    var formatDecimal: Bool = false

    private var isAlert: Bool {
        guard let last = values.last else { return false }
        if let hi = alertAbove, last > hi { return true }
        if let lo = alertBelow, last < lo { return true }
        return false
    }

    private var lineColor: Color { isAlert ? .red : color }

    private func formatted(_ v: Double) -> String {
        if formatDecimal { return String(format: "%.1f", v) }
        return "\(Int(v))"
    }

    var body: some View {
        HStack(spacing: 8) {
            VStack(alignment: .trailing, spacing: 1) {
                Text(label)
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                if let last = values.last {
                    Text(formatted(last))
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

// MARK: - Lab summary strip

struct LabSummaryStrip: View {
    let labs: LabPanel

    private struct LabItem: Identifiable {
        let id = UUID()
        let label: String
        let value: String
        let critical: Bool
    }

    private var items: [LabItem] {
        var result: [LabItem] = []
        if let hb = labs.haemoglobin {
            result.append(.init(label: "Hb", value: String(format: "%.1f g/dL", hb.value),
                               critical: hb.value < 8.0))
        }
        if let pl = labs.platelets {
            result.append(.init(label: "Plt", value: "\(Int(pl.value)) ×10⁹",
                               critical: pl.value < 50))
        }
        if let cr = labs.creatinine {
            result.append(.init(label: "Cr", value: "\(Int(cr.value)) µmol/L",
                               critical: cr.value > 300))
        }
        if let ir = labs.inr {
            result.append(.init(label: "INR", value: String(format: "%.1f", ir.value),
                               critical: ir.value > 2.5))
        }
        if let na = labs.sodium {
            result.append(.init(label: "Na", value: "\(Int(na.value)) mmol/L",
                               critical: na.value < 120 || na.value > 155))
        }
        if let al = labs.alt {
            result.append(.init(label: "ALT", value: "\(Int(al.value)) U/L",
                               critical: false))
        }
        if let la = labs.lactate {
            result.append(.init(label: "Lactate", value: String(format: "%.1f mmol/L", la.value),
                               critical: la.value >= 4.0))
        }
        return result
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: labs.hasCriticalValues ? "flask.fill" : "flask")
                    .font(.system(size: 9, weight: labs.hasCriticalValues ? .bold : .regular))
                    .foregroundStyle(labs.hasCriticalValues ? .red : .teal)
                Text("Latest lab results")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(labs.hasCriticalValues ? .red : .teal)
                    .textCase(.uppercase)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(items) { item in
                        VitalChip(label: item.label, value: item.value, unit: "",
                                  alert: item.critical)
                    }
                }
            }
        }
    }
}
