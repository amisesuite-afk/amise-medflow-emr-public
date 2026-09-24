// ClinicalScoresView+FormHelpers.swift
// Shared UI helper functions used across multiple score form extension files.
// Recovered from pre-split source (lost in b4f4c7c split commit).

import SwiftUI

extension ClinicalScoresView {

    // MARK: - Slider helpers

    func mewsSlider(label: String, autoKey: String,
                    value: Binding<Double>, in range: ClosedRange<Double>,
                    step: Double.Stride, display: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary).textCase(.uppercase)
                if autoFill.isAuto(autoKey) {
                    HStack(spacing: 3) {
                        Image(systemName: "wand.and.stars").font(.system(size: 8))
                        Text("Auto").font(.system(size: 8, weight: .semibold))
                    }
                    .foregroundStyle(.teal)
                    .padding(.horizontal, 4).padding(.vertical, 1)
                    .background(.teal.opacity(0.12), in: Capsule())
                }
            }
            HStack {
                Slider(value: value, in: range, step: step)
                    .tint(autoFill.isAuto(autoKey) ? .teal : AMColor.accent)
                Text(display).font(.caption.monospacedDigit()).frame(width: 54, alignment: .trailing)
            }
        }
    }

    // Convenience overload: no autoKey, uses `range:` external label and `unit:` for display suffix.
    func mewsSlider(_ label: String, value: Binding<Double>,
                    range: ClosedRange<Double>, step: Double.Stride, unit: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary).textCase(.uppercase)
            HStack {
                Slider(value: value, in: range, step: step).tint(AMColor.accent)
                let v = value.wrappedValue
                let display = step < 1 ? String(format: "%.2f \(unit)", v) : "\(Int(v)) \(unit)"
                Text(display).font(.caption.monospacedDigit()).frame(width: 66, alignment: .trailing)
            }
        }
    }

    // MARK: - Picker row with auto-fill badge

    func mewsPickerRow<C: View>(label: String, autoKey: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary).textCase(.uppercase)
                if autoFill.isAuto(autoKey) {
                    HStack(spacing: 3) {
                        Image(systemName: "wand.and.stars").font(.system(size: 8))
                        Text("Auto").font(.system(size: 8, weight: .semibold))
                    }
                    .foregroundStyle(.teal)
                    .padding(.horizontal, 4).padding(.vertical, 1)
                    .background(.teal.opacity(0.12), in: Capsule())
                }
            }
            content()
        }
    }

    // MARK: - SOFA domain picker (0–4 segmented with label)

    func sofaDomainSection(_ title: String, selection: Binding<Int>, labels: [String]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Picker("", selection: selection) {
                Text("0").tag(0)
                Text("1").tag(1)
                Text("2").tag(2)
                Text("3").tag(3)
                Text("4").tag(4)
            }
            .pickerStyle(.segmented)
            if selection.wrappedValue < labels.count {
                Text(labels[selection.wrappedValue])
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 1)
            }
        }
    }

    // MARK: - Apache/CTSI-style segmented picker with labelled options

    func apacheSegment(_ title: String, selection: Binding<Int>,
                       options: [(Int, String)]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Picker("", selection: selection) {
                ForEach(0..<options.count, id: \.self) { idx in
                    Text("\(options[idx].0)").tag(options[idx].0)
                }
            }
            .pickerStyle(.segmented)
            if let match = options.first(where: { $0.0 == selection.wrappedValue }) {
                Text(match.1)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 1)
            }
        }
    }

    // MARK: - Score history risk colour

    func scoreHistoryColor(_ riskRaw: String) -> Color {
        switch riskRaw {
        case ScoreRisk.low.rawValue:      return .green
        case ScoreRisk.moderate.rawValue: return .orange
        case ScoreRisk.high.rawValue:     return Color(red: 0.9, green: 0.4, blue: 0.1)
        default:                          return .red
        }
    }

    // MARK: - SAPS II integer stepper row

    func sapsIIStepper(_ label: String, value: Binding<Int>,
                       range: ClosedRange<Int>, step: Int) -> some View {
        HStack {
            Text(label).font(.subheadline)
            Spacer()
            Stepper("\(value.wrappedValue)", value: value, in: range, step: step)
                .fixedSize()
        }
    }

    // MARK: - AUDIT-C item picker (0-indexed points)

    func auditCPicker(_ label: String, labels: [String], value: Binding<Int>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.subheadline)
            Picker("", selection: value) {
                ForEach(0..<labels.count, id: \.self) { idx in
                    Text("\(idx) — \(labels[idx])").tag(idx)
                }
            }
            .pickerStyle(.menu)
        }
    }

    // MARK: - IPSS symptom item picker (0–5)

    func ipssItemPicker(_ label: String,
                        keyPath: WritableKeyPath<ClinicalScoringEngine.IPSSInput, Int>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.subheadline)
            Picker("", selection: Binding(get: { ipssI[keyPath: keyPath] },
                                          set: { ipssI[keyPath: keyPath] = $0 })) {
                ForEach(0...5, id: \.self) { Text("\($0)").tag($0) }
            }
            .pickerStyle(.segmented)
        }
    }

    // MARK: - Braden scale menu picker

    func bradenPicker(_ label: String, labels: [String], value: Binding<Int>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.subheadline)
            Picker("", selection: value) {
                ForEach(1...labels.count, id: \.self) { idx in
                    Text(labels[idx - 1]).tag(idx)
                }
            }
            .pickerStyle(.menu)
        }
    }

}
