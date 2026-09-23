// DiagnosisRadiationCard+Sections.swift
// Score calculator, referral suggestions, and helper views
// for DiagnosisRadiationCard.

import SwiftUI


extension DiagnosisRadiationCard {

    // MARK: - Score calculator

    @ViewBuilder
    func scoringSection(_ criteria: DiagnosisRadiation.ScoringCriteria) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(criteria.scoreName, systemImage: "chart.bar.doc.horizontal")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.teal)
                Spacer()
                scoreBadge(criteria)
            }
            Text(criteria.timingNote)
                .font(.system(size: 10))
                .foregroundStyle(.secondary)

            // Variable input rows — skip duplicate groupId entries (show only first in group)
            let displayedVars = dedupedVariables(criteria.variables)
            ForEach(displayedVars, id: \.id) { variable in
                scoreVariableRow(variable)
            }

            // Pending variables list
            let pending = pendingVariables(criteria.variables)
            if !pending.isEmpty {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Pending results:")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.secondary)
                    Text(pending.map { $0.label }.joined(separator: " · "))
                        .font(.system(size: 10))
                        .foregroundStyle(.orange)
                }
                .padding(6)
                .background(Color.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 6))
            }
        }
        .padding(.vertical, 2)
    }

    @ViewBuilder
    func binaryToggle(for variable: DiagnosisRadiation.ScoreVariable) -> some View {
        let current = scoreValues[variable.id]
        let isYes = current == "1"
        let isNeg = variable.points < 0
        HStack(spacing: 0) {
            Button {
                scoreValues[variable.id] = "0"
            } label: {
                Text("No")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(current == "0" ? Color.primary : Color.secondary)
                    .frame(width: 34)
                    .padding(.vertical, 5)
                    .background { current == "0" ? Color.secondary.opacity(0.2) : Color.clear }
            }
            .buttonStyle(.plain)
            Divider().frame(height: 22)
            Button {
                scoreValues[variable.id] = "1"
            } label: {
                Text("Yes")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(isYes ? (isNeg ? Color.orange : Color.green) : Color.secondary)
                    .frame(width: 34)
                    .padding(.vertical, 5)
                    .background { isYes ? (isNeg ? Color.orange.opacity(0.15) : Color.green.opacity(0.15)) : Color.clear }
            }
            .buttonStyle(.plain)
        }
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.3), lineWidth: 0.5))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    @ViewBuilder
    func scoreVariableRow(_ variable: DiagnosisRadiation.ScoreVariable) -> some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    Text(variable.label)
                        .font(.system(size: 11, weight: .medium))
                    if variable.points == 2 {
                        Text("×2")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.indigo)
                            .padding(.horizontal, 3).padding(.vertical, 1)
                            .background(Color.indigo.opacity(0.1), in: RoundedRectangle(cornerRadius: 3))
                    } else if variable.points < 0 {
                        Text("\(variable.points)")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.orange)
                            .padding(.horizontal, 3).padding(.vertical, 1)
                            .background(Color.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 3))
                    }
                }
                if !variable.hint.isEmpty {
                    Text(variable.hint)
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                }
            }
            .frame(minWidth: 80, alignment: .leading)

            Spacer()

            if variable.isBinary {
                binaryToggle(for: variable)
            } else {
                HStack(spacing: 4) {
                    TextField("—", text: binding(for: variable))
                        .keyboardType(.decimalPad)
                        .font(.system(size: 12, weight: .semibold).monospaced())
                        .multilineTextAlignment(.trailing)
                        .frame(width: 64)
                        .padding(.horizontal, 6).padding(.vertical, 4)
                        .background(Color(.secondarySystemFill), in: RoundedRectangle(cornerRadius: 6))
                    Text(variable.unit)
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                        .frame(width: 42, alignment: .leading)
                }
            }

            pointIndicator(for: variable)
        }
    }

    @ViewBuilder
    func scoreBadge(_ criteria: DiagnosisRadiation.ScoringCriteria) -> some View {
        let score = computedScore(criteria)
        let entered = enteredCount(criteria.variables)
        let total = criteria.variables.count

        HStack(spacing: 5) {
            if entered > 0 {
                Text("\(score)/\(criteria.maxScore)")
                    .font(.system(size: 13, weight: .bold).monospaced())
                    .foregroundStyle(scoreColor(score, threshold: criteria.severeThreshold))
                if entered < total {
                    Text("(\(entered)/\(total) entered)")
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                } else {
                    Text(score >= criteria.severeThreshold ? criteria.aboveThresholdLabel : criteria.belowThresholdLabel)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(scoreColor(score, threshold: criteria.severeThreshold))
                }
            } else {
                Text("Enter results")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(entered > 0
            ? scoreColor(score, threshold: criteria.severeThreshold).opacity(0.12)
            : Color(.secondarySystemFill),
            in: RoundedRectangle(cornerRadius: 8))
    }

    @ViewBuilder
    func pointIndicator(for variable: DiagnosisRadiation.ScoreVariable) -> some View {
        let text = scoreValues[variable.id] ?? ""
        if text.isEmpty {
            Circle().fill(Color.secondary.opacity(0.2)).frame(width: 16, height: 16)
        } else if variable.isBinary {
            let scored = text == "1"
            let pts = variable.points
            if scored {
                Circle()
                    .fill(pts < 0 ? Color.orange : Color.red)
                    .frame(width: 16, height: 16)
                    .overlay(
                        Text(pts > 0 ? "+\(pts)" : "\(pts)")
                            .font(.system(size: 7, weight: .bold)).foregroundStyle(.white)
                    )
            } else {
                Circle().fill(Color.green).frame(width: 16, height: 16)
                    .overlay(Text("0").font(.system(size: 7, weight: .bold)).foregroundStyle(.white))
            }
        } else if let val = Double(text) {
            let scored = variable.cutoffIsAbove ? val > variable.cutoffValue : val < variable.cutoffValue
            let pts = variable.points
            if scored {
                Circle()
                    .fill(pts < 0 ? Color.orange : Color.red)
                    .frame(width: 16, height: 16)
                    .overlay(
                        Text(pts > 0 ? "+\(pts)" : "\(pts)")
                            .font(.system(size: 7, weight: .bold)).foregroundStyle(.white)
                    )
            } else {
                Circle().fill(Color.green).frame(width: 16, height: 16)
                    .overlay(Text("0").font(.system(size: 7, weight: .bold)).foregroundStyle(.white))
            }
        } else {
            Circle().fill(Color.orange.opacity(0.5)).frame(width: 16, height: 16)
        }
    }

    // MARK: - Referrals

    var referralsSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Referral Suggestions", systemImage: "person.badge.clock.fill")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.blue)
            ForEach(radiation.referralSuggestions) { ref in
                HStack(alignment: .top, spacing: 8) {
                    urgencyPill(ref.urgency)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(ref.specialty)
                            .font(.system(size: 11, weight: .semibold))
                        Text(ref.reason)
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                        if let notes = ref.notes {
                            Text(notes)
                                .font(.system(size: 9))
                                .foregroundStyle(.secondary.opacity(0.7))
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    func urgencyPill(_ urgency: DiagnosisRadiation.ReferralSuggestion.ReferralUrgency) -> some View {
        let (bg, fg): (Color, Color) = {
            switch urgency {
            case .emergency: return (.red, .white)
            case .urgent:    return (.orange, .white)
            case .routine:   return (Color(.systemGray5), .primary)
            }
        }()
        Text(urgency.rawValue)
            .font(.system(size: 8, weight: .bold))
            .foregroundStyle(fg)
            .padding(.horizontal, 5).padding(.vertical, 2)
            .background(bg, in: Capsule())
            .fixedSize()
    }

    // MARK: - Helpers

    func binding(for variable: DiagnosisRadiation.ScoreVariable) -> Binding<String> {
        Binding(
            get: { scoreValues[variable.id] ?? "" },
            set: { scoreValues[variable.id] = $0 }
        )
    }

    func computedScore(_ criteria: DiagnosisRadiation.ScoringCriteria) -> Int {
        var total = 0
        var countedGroups: Set<String> = []
        for variable in criteria.variables {
            guard let text = scoreValues[variable.id], !text.isEmpty else { continue }
            let scored: Bool
            if variable.isBinary {
                scored = text == "1"
            } else {
                guard let val = Double(text) else { continue }
                scored = variable.cutoffIsAbove ? val > variable.cutoffValue : val < variable.cutoffValue
            }
            if let gid = variable.groupId {
                guard !countedGroups.contains(gid) else { continue }
                if scored { total += variable.points; countedGroups.insert(gid) }
            } else {
                if scored { total += variable.points }
            }
        }
        return total
    }

    func enteredCount(_ variables: [DiagnosisRadiation.ScoreVariable]) -> Int {
        variables.filter { !(scoreValues[$0.id] ?? "").isEmpty }.count
    }

    func pendingVariables(_ variables: [DiagnosisRadiation.ScoreVariable]) -> [DiagnosisRadiation.ScoreVariable] {
        dedupedVariables(variables).filter { (scoreValues[$0.id] ?? "").isEmpty }
    }

    // Collapse grouped variables — show only the first in each group
    func dedupedVariables(_ variables: [DiagnosisRadiation.ScoreVariable]) -> [DiagnosisRadiation.ScoreVariable] {
        var seen: Set<String> = []
        return variables.filter { v in
            guard let gid = v.groupId else { return true }
            if seen.contains(gid) { return false }
            seen.insert(gid)
            return true
        }
    }

    func scoreColor(_ score: Int, threshold: Int) -> Color {
        if score >= threshold + 2 { return .red }
        if score >= threshold { return .orange }
        return .green
    }

    func preloadAgeFields() {
        guard let age = patientAge else { return }
        if let criteria = radiation.scoringCriteria {
            for variable in criteria.variables {
                if let cutoffAge = variable.autoFillAge, (scoreValues[variable.id] ?? "").isEmpty {
                    scoreValues[variable.id] = String(age)
                    _ = cutoffAge  // cutoff is encoded in variable.cutoffValue
                }
            }
        }
    }

}
