import SwiftUI

// MARK: - Diagnosis Radiation Card
// Displayed in the Plan tab when a working diagnosis is confirmed.
// All suggestions require explicit clinician action — nothing is auto-applied.

struct DiagnosisRadiationCard: View {
    let radiation: DiagnosisRadiation
    let onAddInvestigation: (DiagnosisRadiation.SuggestedInvestigation) -> Void
    let onUsePlan: (String) -> Void
    let onDismiss: () -> Void

    @State private var expanded = true
    @State private var addedNames: Set<String> = []

    var body: some View {
        Section {
            VStack(alignment: .leading, spacing: 0) {
                header
                if expanded {
                    Divider()
                    content
                }
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 10) {
            Image(systemName: "wand.and.stars")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.teal)
            VStack(alignment: .leading, spacing: 1) {
                Text("Diagnosis Radiation")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.teal)
                Text(radiation.conditionName)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() }
            } label: {
                Image(systemName: expanded ? "chevron.up" : "chevron.down")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            Button {
                onDismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary.opacity(0.6))
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 8)
    }

    // MARK: - Content

    private var content: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Urgency / red flags
            if let urgency = radiation.urgencyNote {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange).font(.caption)
                    Text(urgency)
                        .font(.caption).foregroundStyle(.orange)
                }
            }
            if !radiation.redFlags.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Red flags", systemImage: "flag.fill")
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(.red)
                    ForEach(radiation.redFlags, id: \.self) { flag in
                        HStack(alignment: .top, spacing: 6) {
                            Circle().fill(Color.red).frame(width: 4, height: 4).padding(.top, 4)
                            Text(flag).font(.caption).foregroundStyle(.red.opacity(0.85))
                        }
                    }
                }
            }

            // Suggested investigations
            if !radiation.investigations.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Label("Suggested Investigations", systemImage: "testtube.2")
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(.indigo)
                    ForEach(radiation.investigations, id: \.name) { inv in
                        HStack(spacing: 8) {
                            Image(systemName: inv.category.icon)
                                .font(.system(size: 10)).foregroundStyle(.secondary)
                                .frame(width: 14)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(inv.name).font(.system(size: 12, weight: .medium))
                                Text(inv.rationale).font(.system(size: 10)).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button {
                                if !addedNames.contains(inv.name) {
                                    addedNames.insert(inv.name)
                                    onAddInvestigation(inv)
                                }
                            } label: {
                                Image(systemName: addedNames.contains(inv.name)
                                      ? "checkmark.square.fill" : "square")
                                    .font(.system(size: 20))
                                    .foregroundStyle(addedNames.contains(inv.name) ? .green : .secondary)
                            }
                            .buttonStyle(.plain)
                            .disabled(addedNames.contains(inv.name))
                        }
                    }
                }
            }

            // Plan template
            if !radiation.planTemplate.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Label("Suggested Plan", systemImage: "doc.plaintext")
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(.purple)
                    Text(radiation.planTemplate)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .lineLimit(6)
                    Button {
                        onUsePlan(radiation.planTemplate)
                    } label: {
                        Label("Use as Plan", systemImage: "arrow.down.doc.fill")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.purple)
                    .controlSize(.small)
                }
            }

            // Billing / ICD codes
            if !radiation.billingCodes.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Billing Codes", systemImage: "creditcard.fill")
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(.green)
                    ForEach(radiation.billingCodes, id: \.icd10) { code in
                        HStack(spacing: 8) {
                            Text(code.icd10)
                                .font(.system(size: 10, weight: .semibold).monospaced())
                                .foregroundStyle(.green)
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .background(Color.green.opacity(0.1), in: RoundedRectangle(cornerRadius: 4))
                            VStack(alignment: .leading, spacing: 1) {
                                Text(code.icdDescription).font(.system(size: 11))
                                if let cpt = code.cpt, let cptDesc = code.cptDescription {
                                    Text("CPT \(cpt) · \(cptDesc)")
                                        .font(.system(size: 10)).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }

            // Follow-up note
            if !radiation.followUp.isEmpty {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "calendar.badge.clock")
                        .font(.caption).foregroundStyle(.blue)
                    Text(radiation.followUp)
                        .font(.caption).foregroundStyle(.secondary)
                }
            }

            // Guideline citation
            if let guideline = radiation.guidelineReference {
                HStack(spacing: 5) {
                    Image(systemName: "books.vertical")
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary.opacity(0.6))
                    Text(guideline)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(.secondary.opacity(0.6))
                }
                .padding(.top, 2)
            }
        }
        .padding(.vertical, 8)
    }

    // MARK: - Score calculator

    @ViewBuilder
    private func scoringSection(_ criteria: DiagnosisRadiation.ScoringCriteria) -> some View {
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
    private func binaryToggle(for variable: DiagnosisRadiation.ScoreVariable) -> some View {
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
                    .background(current == "0" ? Color.secondary.opacity(0.2) : Color.clear)
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
                    .background(isYes ? (isNeg ? Color.orange.opacity(0.15) : Color.green.opacity(0.15)) : Color.clear)
            }
            .buttonStyle(.plain)
        }
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.3), lineWidth: 0.5))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    @ViewBuilder
    private func scoreVariableRow(_ variable: DiagnosisRadiation.ScoreVariable) -> some View {
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
    private func scoreBadge(_ criteria: DiagnosisRadiation.ScoringCriteria) -> some View {
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
    private func pointIndicator(for variable: DiagnosisRadiation.ScoreVariable) -> some View {
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

    // MARK: - Helpers

    private func binding(for variable: DiagnosisRadiation.ScoreVariable) -> Binding<String> {
        Binding(
            get: { scoreValues[variable.id] ?? "" },
            set: { scoreValues[variable.id] = $0 }
        )
    }

    private func computedScore(_ criteria: DiagnosisRadiation.ScoringCriteria) -> Int {
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

    private func enteredCount(_ variables: [DiagnosisRadiation.ScoreVariable]) -> Int {
        variables.filter { !(scoreValues[$0.id] ?? "").isEmpty }.count
    }

    private func pendingVariables(_ variables: [DiagnosisRadiation.ScoreVariable]) -> [DiagnosisRadiation.ScoreVariable] {
        dedupedVariables(variables).filter { (scoreValues[$0.id] ?? "").isEmpty }
    }

    // Collapse grouped variables — show only the first in each group
    private func dedupedVariables(_ variables: [DiagnosisRadiation.ScoreVariable]) -> [DiagnosisRadiation.ScoreVariable] {
        var seen: Set<String> = []
        return variables.filter { v in
            guard let gid = v.groupId else { return true }
            if seen.contains(gid) { return false }
            seen.insert(gid)
            return true
        }
    }

    private func scoreColor(_ score: Int, threshold: Int) -> Color {
        if score >= threshold + 2 { return .red }
        if score >= threshold { return .orange }
        return .green
    }

    private func preloadAgeFields() {
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
