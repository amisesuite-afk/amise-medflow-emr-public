// VisitPathwayPicker.swift
// The consultation "first door": choose the kind of visit. Shows the risk snapshot and a
// suggested pathway with its reasons. The clinician picks; nothing changes until they tap.

import SwiftUI

struct VisitPathwayPicker: View {
    let patient: Patient
    let current: ConsultPathway?
    let onSelect: (ConsultPathway) -> Void
    var showsRisk: Bool = true

    private var recommendation: ConsultPathway.Recommendation { ConsultPathway.recommend(for: patient) }

    var body: some View {
        let rec = recommendation
        VStack(alignment: .leading, spacing: 14) {
            if showsRisk {
                RiskSnapshotCard(flags: VisitRiskAssessment.assess(patient, pathway: current ?? rec.pathway))
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("SUGGESTED")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(AMColor.accent)
                pathwayCard(rec.pathway, reasons: rec.reasons, highlighted: true)
            }

            Text("ALL VISIT TYPES")
                .font(.system(size: 11, weight: .heavy))
                .tracking(0.6)
                .foregroundStyle(.secondary)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 10)], spacing: 10) {
                ForEach(ConsultPathway.allCases.filter { $0 != rec.pathway }) { p in
                    pathwayCard(p, reasons: [], highlighted: false)
                }
            }
        }
    }

    private func pathwayCard(_ p: ConsultPathway, reasons: [String], highlighted: Bool) -> some View {
        let color = Color(hex: p.accentHex)
        let isCurrent = p == current
        return Button { onSelect(p) } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: p.icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(color)
                    .frame(width: 26)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(p.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.primary)
                        if isCurrent {
                            Text("CURRENT")
                                .font(.system(size: 9, weight: .heavy))
                                .foregroundStyle(color)
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 4))
                        }
                    }
                    Text(p.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                    if !reasons.isEmpty {
                        Text(reasons.joined(separator: " · "))
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(color)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(color.opacity(highlighted ? 0.10 : 0.04), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12)
                .stroke(color.opacity(highlighted || isCurrent ? 0.6 : 0.15), lineWidth: highlighted ? 1.5 : 1))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("pathway.card.\(p.rawValue)")
    }
}

/// Sheet wrapper shown when a consultation starts.
struct VisitPathwaySheet: View {
    let patient: Patient
    let current: ConsultPathway?
    let onSelect: (ConsultPathway) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VisitPathwayPicker(patient: patient, current: current) { p in
                    onSelect(p)
                    dismiss()
                }
                .padding(16)
            }
            .navigationTitle("What kind of visit?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(current == nil ? "Skip" : "Keep \(current!.title)") { dismiss() }
                        .accessibilityIdentifier("pathway.dismiss")
                }
            }
        }
    }
}

/// Compact list of risk flags from VisitRiskAssessment.
struct RiskSnapshotCard: View {
    let flags: [RiskFlag]

    private func color(_ level: RiskFlag.Level) -> Color {
        switch level {
        case .high:     return .red
        case .moderate: return .orange
        case .info:     return .secondary
        }
    }

    var body: some View {
        let overall = VisitRiskAssessment.overall(flags)
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Risk snapshot", systemImage: "shield.lefthalf.filled")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(flags.isEmpty ? "No flags" : overall.label.uppercased())
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(flags.isEmpty ? Color.green : color(overall))
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background((flags.isEmpty ? Color.green : color(overall)).opacity(0.12), in: Capsule())
            }
            if flags.isEmpty {
                Text("Nothing flagged from the record so far.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            ForEach(flags) { f in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: f.icon)
                        .font(.caption)
                        .foregroundStyle(color(f.level))
                        .frame(width: 16)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(f.title)
                            .font(.caption.weight(.semibold))
                        Text(f.detail)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding(12)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
    }
}
