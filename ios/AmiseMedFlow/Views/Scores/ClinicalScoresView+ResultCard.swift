// ClinicalScoresView+ResultCard.swift
// Score result card and score form builder.

import SwiftUI
import SwiftData

extension ClinicalScoresView {

    // MARK: - Result card

    func resultCard(_ r: ClinicalScore) -> some View {
        // Layer 5: check if score corroborates working diagnosis
        let corroborates = bayesianCorroboration(
            score: r,
            workingDx: patient.workingDiagnosis?.lowercased() ?? ""
        )

        return VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(r.systemName)
                        .font(.headline)
                    Text(r.interpretation)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                riskBadge(r.risk, score: r.score, max: r.maxScore)
            }

            // Layer 5: Bayesian corroboration banner
            if corroborates, let dx = patient.workingDiagnosis, !dx.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: "brain.head.profile")
                        .font(.caption)
                        .foregroundStyle(AMColor.accent)
                    Text("Score corroborates working diagnosis: \(dx)")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(AMColor.accent)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AMColor.accentLt.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
            }

            if !r.redFlags.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Label("Red Flags", systemImage: "exclamationmark.octagon.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.red)
                    ForEach(r.redFlags, id: \.self) { flag in
                        Text("• \(flag)")
                            .font(.caption)
                            .foregroundStyle(.red.opacity(0.85))
                    }
                }
                .padding(10)
                .background { Color.red.opacity(0.08) }
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            if !r.recommendations.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Recommendations")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    ForEach(Array(r.recommendations.enumerated()), id: \.0) { idx, rec in
                        HStack(alignment: .top, spacing: 8) {
                            Text("\(idx + 1).")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(AMColor.accent)
                                .frame(width: 18, alignment: .leading)
                            Text(rec)
                                .font(.caption)
                        }
                    }
                }
            }

            // Score breakdown
            VStack(alignment: .leading, spacing: 4) {
                Text("Score Breakdown")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                ForEach(r.items.filter(\.present)) { item in
                    HStack {
                        Text("✓ \(item.label)")
                            .font(.caption)
                        Spacer()
                        Text(item.points == Double(Int(item.points))
                             ? "+\(Int(item.points))"
                             : "+\(String(format: "%.1f", item.points))")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(AMColor.accent)
                    }
                }
            }

            if !autoFill.autoFieldKeys.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "wand.and.stars")
                        .font(.caption2)
                        .foregroundStyle(.teal)
                    Text("\(autoFill.autoFieldKeys.count) field\(autoFill.autoFieldKeys.count == 1 ? "" : "s") pre-filled from patient record — review teal toggles.")
                        .font(.caption2)
                        .foregroundStyle(.teal)
                }
                .padding(.top, 2)
            }

            if let note = r.evidenceNote {
                Text(note)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .padding(.top, 4)
            }

            // Score history for current system
            let history = patient.scoreHistory
                .filter { $0.scoreName == r.systemName }
                .sorted { $0.recordedAt > $1.recordedAt }
                .prefix(5)
            if !history.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Recent saves")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    ForEach(Array(history), id: \.id) { entry in
                        HStack {
                            Text(entry.abbreviation)
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(scoreHistoryColor(entry.riskRaw))
                            Text("— \(entry.riskRaw)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(entry.recordedAt, style: .date)
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                    }
                }
                .padding(10)
                .background(Color.secondary.opacity(0.07), in: RoundedRectangle(cornerRadius: 8))
            }

            Button(action: { saveScoreToAssessment(r) }) {
                Label(
                    scoreSaved ? "Saved to Assessment" : "Save score to Assessment",
                    systemImage: scoreSaved ? "checkmark.circle.fill" : "note.text.badge.plus"
                )
                .font(.caption.weight(.medium))
                .foregroundStyle(scoreSaved ? .green : AMColor.accent)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(
                    (scoreSaved ? Color.green : AMColor.accent).opacity(0.08),
                    in: RoundedRectangle(cornerRadius: 8)
                )
            }
            .buttonStyle(.plain)
            .disabled(scoreSaved)
            .animation(.easeInOut(duration: 0.2), value: scoreSaved)
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.07), radius: 6, y: 3)
    }

    func riskBadge(_ risk: ScoreRisk, score: Double, max: Double) -> some View {
        let color: Color = switch risk {
        case .low:      .green
        case .moderate: .orange
        case .high:     Color(red: 0.9, green: 0.4, blue: 0.1)
        case .critical: .red
        }
        let scoreStr  = score == Double(Int(score)) ? "\(Int(score))" : String(format: "%.1f", score)
        let maxStr    = max == Double(Int(max))   ? "\(Int(max))"   : String(format: "%.0f", max)
        let scoreLabel = max > 0 ? "\(scoreStr)/\(maxStr)" : scoreStr
        return VStack(spacing: 2) {
            Text(scoreLabel)
                .font(.title3.weight(.bold).monospacedDigit())
                .foregroundStyle(color)
            Text(risk.rawValue)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(color)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
    }


}
