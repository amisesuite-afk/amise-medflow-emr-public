// ClinicalScoresView+ViewHelpers.swift
// Category filter bar, patient-contextualised view, monitoring pills, score grid, history, browse catalogue.

import SwiftUI
import SwiftData

extension ClinicalScoresView {

    // MARK: - Category filter bar

    var categoryBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(ScoreCategory.allCases) { cat in
                    Button {
                        selectedCategory = cat
                        selectedScore = nil
                        result = nil
                    } label: {
                        Text(cat.rawValue)
                            .font(.caption.weight(.medium))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(selectedCategory == cat
                                ? AMColor.accent
                                : Color.secondary.opacity(0.12),
                                in: Capsule())
                            .foregroundStyle(selectedCategory == cat ? .white : .primary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(Color(uiColor: .systemGroupedBackground))
    }

    // MARK: - Patient-contextualised default view (three-block layout)

    var patientContextView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {

                // ── Block 1: Monitoring ──────────────────────────────────────
                contextBlock(title: "MONITORING", icon: "waveform.path.ecg.rectangle") {
                    HStack(spacing: 12) {
                        monitoringPill(.news2)
                        monitoringPill(.mews)
                    }
                }

                // ── Block 2: Clinical — diagnosis-driven ─────────────────────
                if !cachedRecommendations.isEmpty {
                    contextBlock(title: dxBlockTitle, icon: "stethoscope") {
                        clinicalScoreGrid(Array(cachedRecommendations.prefix(4)))
                    }
                } else {
                    // No diagnosis set yet — nudge without cluttering
                    HStack(spacing: 8) {
                        Image(systemName: "info.circle")
                            .foregroundStyle(AMColor.accent)
                        Text("Set a working diagnosis to see tailored scores.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(12)
                    .background(AMColor.accentLt.opacity(0.35), in: RoundedRectangle(cornerRadius: 10))
                    .padding(.horizontal)
                }

                // ── Block 3: Risk profile — age, setting, PMH ────────────────
                let riskScores = riskProfileScores
                if !riskScores.isEmpty {
                    contextBlock(title: "RISK PROFILE", icon: "shield.lefthalf.filled") {
                        clinicalScoreGrid(riskScores.map {
                            DiagnosisScoreRecommendation(score: $0,
                                                        rationale: $0.category.rawValue,
                                                        priority: 99)
                        })
                    }
                }

                // ── Block 4: Recorded score history ──────────────────────────
                if !snapshot.history.isEmpty {
                    contextBlock(title: "RECORDED SCORES", icon: "clock.arrow.circlepath") {
                        scoreHistoryList
                    }
                    Button {
                        Task { await exportScoresPDF() }
                    } label: {
                        HStack(spacing: 6) {
                            if isExportingScoresPDF {
                                ProgressView().controlSize(.small)
                            } else {
                                Image(systemName: "square.and.arrow.up")
                            }
                            Text("Export Scores PDF")
                        }
                        .font(.subheadline)
                        .foregroundStyle(AMColor.accent)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal)
                    .disabled(isExportingScoresPDF)
                }

                // ── Secondary: browse full catalogue ─────────────────────────
                Button { showingAllScores = true } label: {
                    HStack {
                        Text("Browse all \(ActiveScore.allCases.count) scores")
                            .font(.subheadline)
                            .foregroundStyle(AMColor.accent)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
                .buttonStyle(.plain)
                .padding(.horizontal)
            }
            .padding(.top, 16)
            .padding(.bottom, 32)
        }
        .background(Color(uiColor: .systemGroupedBackground))
    }

    // MARK: - Context block chrome

    func contextBlock<Content: View>(
        title: String, icon: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(AMColor.accent)
                Text(title)
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(AMColor.accent)
                    .kerning(0.8)
            }
            .padding(.horizontal)
            content()
        }
    }

    var dxBlockTitle: String {
        if let dx = patient.workingDiagnosis, !dx.isEmpty {
            let icd = patient.workingDiagnosisICD.map { " · \($0)" } ?? ""
            return "FOR: \(dx.uppercased())\(icd)"
        }
        return "CLINICAL"
    }

    // MARK: - Monitoring pills (Block 1)

    func monitoringPill(_ score: ActiveScore) -> some View {
        // From the cached snapshot — no relationship sorting in body.
        let savedEntry = snapshot.latest(for: score)

        // NEWS2: derive live value directly from most-recent vitals
        let liveNews2: (value: Int, risk: String)? = {
            guard score == .news2, let n = snapshot.liveNEWS2 else { return nil }
            return (n.value, n.risk)
        }()

        let displayScore: String? = liveNews2.map { "\($0.value)" } ?? savedEntry?.abbreviation
        let displayRisk:  String? = liveNews2.map { $0.risk }       ?? savedEntry?.riskRaw
        let riskCol = displayRisk.map { scoreHistoryColor($0) } ?? Color.secondary

        return Button {
            selectedScore = score
            result = nil
        } label: {
            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline) {
                    Image(systemName: score.icon)
                        .font(.callout)
                        .foregroundStyle(AMColor.accent)
                    Spacer()
                    if let val = displayScore {
                        Text(val)
                            .font(.title2.weight(.bold).monospacedDigit())
                            .foregroundStyle(riskCol)
                    }
                }
                Text(monitoringShortName(score))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                if let risk = displayRisk {
                    Text(risk)
                        .font(.caption2)
                        .foregroundStyle(riskCol)
                } else if liveNews2 == nil && savedEntry == nil {
                    Text("Tap to record")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                if let vitalsAt = snapshot.latestVitalsAt, score == .news2 {
                    Text("Vitals: \(vitalsAt, style: .relative)")
                        .font(.system(size: 9))
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: 12))
            .overlay {
                RoundedRectangle(cornerRadius: 12)
                    .stroke(displayScore != nil ? riskCol.opacity(0.4) : AMColor.line, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
        .padding(.horizontal)
    }

    func monitoringShortName(_ score: ActiveScore) -> String {
        switch score {
        case .news2: return "NEWS2"
        case .mews:  return "MEWS"
        default:     return score.rawValue.components(separatedBy: " (").first ?? score.rawValue
        }
    }

    // MARK: - Clinical / risk score grid (Blocks 2 & 3)

    func clinicalScoreGrid(_ recs: [DiagnosisScoreRecommendation]) -> some View {
        let cols = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]
        return LazyVGrid(columns: cols, spacing: 10) {
            ForEach(recs) { rec in
                Button {
                    selectedScore = rec.score
                    result = nil
                } label: {
                    compactScoreCard(rec)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal)
    }

    func compactScoreCard(_ rec: DiagnosisScoreRecommendation) -> some View {
        let savedEntry = snapshot.latest(for: rec.score)

        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: rec.score.icon)
                    .font(.subheadline)
                    .foregroundStyle(AMColor.accent)
                Spacer()
                if let entry = savedEntry {
                    Text(entry.abbreviation)
                        .font(.caption2.monospacedDigit().weight(.bold))
                        .foregroundStyle(scoreHistoryColor(entry.riskRaw))
                }
            }
            Text(rec.score.rawValue.components(separatedBy: " (").first ?? rec.score.rawValue)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
            Text(rec.rationale)
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: 10))
        .overlay {
            RoundedRectangle(cornerRadius: 10)
                .stroke(AMColor.line, lineWidth: 1)
        }
    }

    // MARK: - Score history list (Block 4)

    var scoreHistoryList: some View {
        let entries = snapshot.history   // already newest first
        return VStack(spacing: 0) {
            ForEach(entries) { entry in
                HStack(spacing: 10) {
                    Circle()
                        .fill(scoreHistoryColor(entry.riskRaw))
                        .frame(width: 8, height: 8)
                    Text(entry.scoreName)
                        .font(.caption.weight(.medium))
                        .lineLimit(1)
                    Spacer()
                    Text(entry.abbreviation)
                        .font(.caption.monospacedDigit().weight(.semibold))
                        .foregroundStyle(scoreHistoryColor(entry.riskRaw))
                    Text(entry.recordedAt, style: .relative)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                    Button {
                        if let match = entry.activeScore {
                            selectedScore = match
                            result = nil
                        }
                    } label: {
                        Image(systemName: "arrow.right.circle")
                            .font(.caption)
                            .foregroundStyle(AMColor.accent)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal)
                .padding(.vertical, 9)
                .background(Color(uiColor: .systemBackground))
                if entry.id != entries.last?.id {
                    Divider().padding(.leading)
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }

    // MARK: - Score browse catalogue (shown when showingAllScores = true)

    var scoreGrid: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Back to patient view
                Button {
                    showingAllScores = false
                } label: {
                    Label("Back to patient view", systemImage: "chevron.left")
                        .font(.subheadline)
                        .foregroundStyle(AMColor.accent)
                }
                .buttonStyle(.plain)
                .padding(.horizontal)
                .padding(.vertical, 10)

                if !recommendedScores.isEmpty {
                    Text("Recommended scores are marked ✦")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .padding(.horizontal)
                        .padding(.bottom, 6)
                }

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 12)], spacing: 12) {
                    ForEach(filteredScores) { score in
                        Button {
                            selectedScore = score
                            result = nil
                        } label: {
                            scoreCard(score)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal)
                .padding(.bottom)
                .padding(.top, 4)
            }
        }
    }

    func scoreCard(_ score: ActiveScore) -> some View {
        let lastEntry = snapshot.latest(for: score)
        let isRecommended = recommendedScores.contains(where: { $0.score == score })

        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: score.icon)
                    .font(.title3)
                    .foregroundStyle(isRecommended ? AMColor.accent : .secondary)
                Spacer()
                if let entry = lastEntry {
                    Text(entry.abbreviation)
                        .font(.caption2.monospacedDigit().weight(.semibold))
                        .foregroundStyle(scoreHistoryColor(entry.riskRaw))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(scoreHistoryColor(entry.riskRaw).opacity(0.12), in: Capsule())
                } else {
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
            Text(score.rawValue)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.primary)
                .multilineTextAlignment(.leading)
            HStack(spacing: 4) {
                if isRecommended {
                    Image(systemName: "sparkle")
                        .font(.caption2)
                        .foregroundStyle(AMColor.accent)
                }
                Text(score.category.rawValue)
                    .font(.caption2)
                    .foregroundStyle(isRecommended ? AMColor.accent : .secondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isRecommended ? AMColor.accent.opacity(0.3) : Color.clear, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
    }


}
