// ExamSignsSection.swift
// Exam step — "High-yield signs" (evidence-exam 1.0.0). Deterministic; no AI.
//
// Offers the evidence-based signs for the complaint and the leading differential
// (clinical-content/rules/exam-signs.json), those for the leading diagnoses first, then by the size of their
// likelihood ratio. Each sign is present / absent / not examined; tapping its name shows how to
// elicit it and its likelihood ratios. Nothing is pre-filled: an unmarked sign was not examined,
// and only an examined, absent sign whose absence is meaningful lowers a diagnosis. The choice is
// written as a "[sign]" line in "Other / additional findings" (ExamSignRecord) and the
// differential is refreshed.
//
// Also lists the decision rules for the complaint; a rule with an iOS calculator opens it
// (ClinicalScoresView, pre-filled from the record). Web twin: artifacts/dashboard/src/components/
// ExamSignsPanel.tsx.

import SwiftUI
import SwiftData

struct ExamSignsSection: View {
    @Bindable var patient: Patient
    /// Names of the current leading diagnoses (Bayesian differential, most likely first).
    let leadingDiagnoses: [String]
    /// Called after a sign changes or a calculator closes (save + refresh the differential).
    let onChange: () -> Void

    @State private var expanded: String? = nil
    @State private var showAll = false
    @State private var openScore: ActiveScore? = nil

    private static let shownFirst = 8

    private var relevanceText: String {
        [patient.chiefComplaint ?? "", patient.hpi ?? ""].joined(separator: ". ")
    }

    private var states: [String: String] { ExamSignRecord.states(in: patient.examOther) }

    private var signs: [ExamEvidenceCatalogue.Sign] {
        var list = ExamEvidenceCatalogue.relevantSigns(text: relevanceText, ageYears: patient.ageYears,
                                                       leadingDiagnoses: leadingDiagnoses)
        // A sign already recorded stays visible even when it is no longer suggested.
        for id in states.keys.sorted() where !list.contains(where: { $0.id == id }) {
            if let sign = ExamEvidenceCatalogue.sign(id) { list.append(sign) }
        }
        return list
    }

    private var rules: [ExamEvidenceCatalogue.Rule] { ExamEvidenceCatalogue.relevantRules(text: relevanceText) }

    var body: some View {
        let all = signs
        let ruleList = rules
        let shown = showAll ? all : Array(all.prefix(Self.shownFirst))
        if !all.isEmpty || !ruleList.isEmpty {
            Section {
                ForEach(shown) { sign in
                    signRow(sign)
                }
                if all.count > Self.shownFirst {
                    Button(showAll ? "Show fewer" : "Show \(all.count - Self.shownFirst) more") { showAll.toggle() }
                        .font(.caption)
                        .foregroundStyle(AMColor.accent)
                }
                if !ruleList.isEmpty {
                    Text("Decision rules").amSectionLabel()
                    ForEach(ruleList) { rule in
                        ruleRow(rule)
                    }
                }
            } header: {
                Text("High-yield signs").amSectionLabel()
            } footer: {
                Text("Mark only what you examined: an unmarked sign counts as not examined. Likelihood ratios are unverified until the surgeon signs them off.")
                    .font(.caption2)
            }
            .sheet(item: $openScore, onDismiss: onChange) { score in
                NavigationStack {
                    ClinicalScoresView(patient: patient, initialScore: score)
                        .toolbar {
                            ToolbarItem(placement: .confirmationAction) { Button("Done") { openScore = nil } }
                        }
                }
            }
        }
    }

    // MARK: - Signs

    private func binding(for id: String) -> Binding<String> {
        Binding(
            get: { ExamSignRecord.states(in: patient.examOther)[id] ?? "" },
            set: { newValue in
                patient.examOther = ExamSignRecord.settingState(newValue.isEmpty ? nil : newValue,
                                                                signID: id, in: patient.examOther)
                onChange()
            }
        )
    }

    @ViewBuilder
    private func signRow(_ sign: ExamEvidenceCatalogue.Sign) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Button {
                    expanded = expanded == sign.id ? nil : sign.id
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: expanded == sign.id ? "chevron.down" : "chevron.right")
                            .font(.caption2)
                        Text(sign.name)
                            .font(.subheadline.weight(.semibold))
                            .multilineTextAlignment(.leading)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityHint("Shows how to elicit it and its likelihood ratios")
                Spacer(minLength: 6)
                Text(lrSummary(sign))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Picker(sign.name, selection: binding(for: sign.id)) {
                Text("Present").tag("present")
                Text("Absent").tag("absent")
                Text("Not examined").tag("")
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .accessibilityIdentifier("consult.exam.sign.\(sign.id)")
            if expanded == sign.id {
                details(sign)
            }
        }
        .padding(.vertical, 2)
    }

    private func lrSummary(_ sign: ExamEvidenceCatalogue.Sign) -> String {
        guard let pos = sign.lrPositive else { return "LR not established" }
        let low = sign.engine == "none" ? " · low value" : ""
        return "LR+ " + ExamEvidenceCatalogue.format(ExamEvidenceCatalogue.LR(point: pos.point, low: nil, high: nil)) + low
    }

    @ViewBuilder
    private func details(_ sign: ExamEvidenceCatalogue.Sign) -> some View {
        let target = ExamEvidenceCatalogue.group(sign.target.group)?.label ?? sign.target.group
        VStack(alignment: .leading, spacing: 3) {
            Text("How: \(sign.elicit)")
                .font(.caption)
            Text("For \(target): LR+ \(ExamEvidenceCatalogue.format(sign.lrPositive)), LR− \(ExamEvidenceCatalogue.format(sign.lrNegative))")
                .font(.caption)
            if sign.engine == "none" {
                Text("Low value: documentation only; it does not change the differential.")
                    .font(.caption2)
                    .foregroundStyle(.orange)
            } else if !sign.negativeMeaningful {
                Text("Absence is not used (LR− near 1, or a red-flag sign).")
                    .font(.caption2)
                    .foregroundStyle(.orange)
            }
            if let note = sign.note {
                Text(note)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Text("\(sign.quality) · \(sign.source)\(sign.fromMemory ? " · value not yet verified against the source" : "")")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Decision rules

    private func activeScore(_ rule: ExamEvidenceCatalogue.Rule) -> ActiveScore? {
        guard let name = rule.ios?.activeScore else { return nil }
        return ActiveScore.allCases.first { String(describing: $0) == name }
    }

    /// The stored result of a rule with an iOS calculator.
    private func storedValue(_ rule: ExamEvidenceCatalogue.Rule) -> Double? {
        switch rule.id {
        case "alvarado":  return patient.alvaradoScore.map { Double($0) }
        case "air":       return patient.airScore.map { Double($0) }
        case "wells-pe":  return patient.wellsPEScore
        case "perc":      return patient.percViolations.map { Double($0) }
        case "wells-dvt": return patient.wellsDVTScore
        case "heart":     return patient.heartScore.map { Double($0) }
        case "centor":    return patient.centorScore.map { Double($0) }
        case "lrinec":    return patient.lrinecScore.map { Double($0) }
        case "curb65":    return patient.curb65Score.map { Double($0) }
        default:          return nil
        }
    }

    private func ruleCaption(_ rule: ExamEvidenceCatalogue.Rule) -> String {
        var parts: [String] = []
        if let value = storedValue(rule) {
            let shown = value == value.rounded() ? String(Int(value)) : String(value)
            if let band = DecisionRuleEvidence.band(of: rule, value: value) {
                let lr = band.lr.map { " — LR \(ExamEvidenceCatalogue.format($0)) for \(rule.target.finding)" } ?? ""
                parts.append("Recorded \(shown): \(band.label)\(lr)\(band.risk.map { " — \($0)" } ?? "")")
            } else {
                parts.append("Recorded \(shown)")
            }
        } else if activeScore(rule) != nil {
            parts.append("Opens the calculator, pre-filled from the record")
        } else {
            parts.append("Calculator on the web Scales step (not yet on iOS)")
        }
        if rule.kind == "prognostic" { parts.append("prognostic: does not change the differential") }
        return parts.joined(separator: " · ")
    }

    @ViewBuilder
    private func ruleRow(_ rule: ExamEvidenceCatalogue.Rule) -> some View {
        let score = activeScore(rule)
        Button {
            if let score { openScore = score }
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(rule.name)
                        .font(.subheadline)
                        .foregroundStyle(.primary)
                    Text(ruleCaption(rule))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if score != nil {
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .disabled(score == nil)
        .accessibilityIdentifier("consult.exam.rule.\(rule.id)")
    }
}
