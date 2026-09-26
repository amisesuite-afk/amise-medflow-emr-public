import SwiftUI

// MARK: - Decision support — clinician decides (Plan step)
// Score → action, result → action, what the results changed, and for the leading diagnoses the
// ranked treatment options with the observe | test | treat bar (the patient's probability marked),
// expected benefit and harm for this patient, the factors that moved them, missing inputs and
// sources. Suggestions only: "Add to plan" / "Add test" / "Dismiss" per item; nothing is written
// without the tap (BayesianDecisionEngine+Treatment.swift; web twin DecisionSupportPanel.tsx).

struct DecisionSupportSection: View {
    @Bindable var patient: Patient
    var bayesianDx: [BayesianDiagnosisEngine.DiagnosisResult]
    var socratesSelections: [String: Set<String>]
    var specialtyHint: String?
    /// Called after a plan line or test is added (ConsultationView.touch()).
    var onEdit: () -> Void

    @State private var dismissed: Set<String> = []
    @State private var shifts: [DecisionSupportPatient.Shift] = []

    private var shiftKey: String {
        patient.investigations
            .filter { $0.status == .resulted && !$0.result.isEmpty }
            .map { "\($0.name)=\($0.result)" }
            .joined(separator: "|") + "#\(patient.chiefComplaint ?? "")"
    }

    var body: some View {
        let result = DecisionSupportPatient.support(for: patient, bayes: bayesianDx)
        if let r = result, !r.scoreActions.isEmpty || !r.resultActions.isEmpty || !r.decisions.isEmpty || !shifts.isEmpty {
            Section {
                if !shifts.isEmpty {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("What the results changed").font(.caption.weight(.bold))
                        ForEach(shifts.prefix(3)) { s in
                            Text(s.text).font(.caption).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .accessibilityIdentifier("decision.shifts")
                }
                ForEach(r.resultActions.filter { !dismissed.contains("r:\($0.id)") }) { c in
                    ActionCardRow(chip: c.chip, title: c.label, detail: c.thresholdText, action: c.action,
                                  withheld: c.withheld, sources: c.sources, level: c.level,
                                  inPlan: planContains(c.action),
                                  onAdd: { addPlan(c.action) }, onDismiss: { _ = dismissed.insert("r:\(c.id)") })
                }
                ForEach(r.scoreActions.filter { !dismissed.contains("s:\($0.id)") }) { c in
                    ActionCardRow(chip: c.chip + (c.scoreSource == "record" ? " (from the record)" : ""), title: c.band, detail: nil,
                                  action: c.action, withheld: c.withheld, sources: c.sources, level: c.level,
                                  inPlan: planContains(c.action),
                                  onAdd: { addPlan(c.action) }, onDismiss: { _ = dismissed.insert("s:\(c.id)") })
                }
                ForEach(r.decisions) { d in
                    DecisionBlock(decision: d, dismissed: dismissed,
                                  planContains: { planContains($0) },
                                  onAddPlan: { addPlan($0) },
                                  onAddTest: { addTest($0, for: d.label) },
                                  onDismiss: { _ = dismissed.insert("o:\(d.id):\($0)") })
                }
            } header: {
                Label("Decision support — clinician decides", systemImage: "scale.3d")
            } footer: {
                Text("Suggestions only: nothing is added, ordered or prescribed until you tap. Content \(r.contentVersion) (cited from memory) awaits surgeon sign-off.")
                    .font(.caption2)
            }
            .task(id: shiftKey) {
                shifts = DecisionSupportPatient.posteriorShifts(for: patient, socratesSelections: socratesSelections,
                                                                specialtyHint: specialtyHint)
            }
        }
    }

    private func planContains(_ line: String) -> Bool {
        (patient.managementPlan ?? "").contains(line)
    }

    private func addPlan(_ line: String) {
        patient.managementPlan = LifestylePractices.appendPlanLine(patient.managementPlan ?? "", line)
        onEdit()
    }

    private func addTest(_ label: String, for decision: String) {
        if patient.investigations.contains(where: { $0.name == label && $0.status != .cancelled }) { return }
        let lower = label.lowercased()
        let imagingWords = ["ct ", "ctpa", "ultrasound", "uss", "mri", "x-ray", "xr ", "angiograph", "scan"]
        let category: InvestigationEntry.InvCategory = imagingWords.contains(where: { lower.contains($0) }) ? .imaging : .blood
        let entry = InvestigationEntry(name: label, category: category, status: .suggested,
                                       suggestedFor: "\(decision) (decision support)")
        patient.investigations.append(entry)
        onEdit()
    }
}

// MARK: - Score / result card

private struct ActionCardRow: View {
    let chip: String
    let title: String
    let detail: String?
    let action: String
    let withheld: Bool
    let sources: [TreatmentDecisions.SourceRef]
    let level: String
    let inPlan: Bool
    let onAdd: () -> Void
    let onDismiss: () -> Void

    private var levelColor: Color {
        switch level {
        case "critical": return AMColor.emergency
        case "high": return Color.orange
        case "moderate": return AMColor.priorityCol
        default: return AMColor.accentDk
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text(chip)
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .foregroundStyle(AMColor.accentDk)
                    .background(AMColor.accentLt, in: Capsule())
                Text(title).font(.caption.weight(.bold)).foregroundStyle(levelColor)
                Spacer(minLength: 4)
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle").foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Dismiss \(title)")
            }
            if let d = detail {
                Text(d).font(.caption2).foregroundStyle(.secondary)
            }
            Text(action).font(.caption).fixedSize(horizontal: false, vertical: true)
            SourcesDisclosure(sources: sources)
            if !withheld {
                Button(inPlan ? "In plan" : "Add to plan", action: onAdd)
                    .font(.caption.weight(.semibold))
                    .disabled(inPlan)
            }
        }
        .padding(.vertical, 2)
    }
}

private struct SourcesDisclosure: View {
    let sources: [TreatmentDecisions.SourceRef]

    var body: some View {
        DisclosureGroup {
            ForEach(sources, id: \.id) { s in
                Text(s.citation).font(.caption2).foregroundStyle(.secondary)
            }
        } label: {
            Text("Sources (\(sources.count)) — cited from memory, awaiting surgeon sign-off")
                .font(.caption2).foregroundStyle(.secondary)
        }
    }
}

// MARK: - Decision

private struct DecisionBlock: View {
    let decision: TreatmentDecisions.DecisionResult
    let dismissed: Set<String>
    let planContains: (String) -> Bool
    let onAddPlan: (String) -> Void
    let onAddTest: (String) -> Void
    let onDismiss: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text(decision.label).font(.subheadline.weight(.bold))
                Spacer(minLength: 4)
            }
            HStack(spacing: 6) {
                Text(decision.chip)
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .foregroundStyle(AMColor.accentDk)
                    .background(AMColor.accentLt, in: Capsule())
                if let p = decision.probability {
                    Text("\(decision.probabilityLabel) \(TreatmentDecisions.formatPercent(p))")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }
            ForEach(decision.options.filter { !dismissed.contains("o:\(decision.id):\($0.id)") }) { o in
                OptionRowView(decision: decision, option: o, planContains: planContains,
                              onAddPlan: onAddPlan, onAddTest: onAddTest, onDismiss: { onDismiss(o.id) })
            }
            ForEach(decision.missing.prefix(4), id: \.self) { m in
                Text(m).font(.caption2).foregroundStyle(AMColor.priorityCol).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 4)
        .accessibilityIdentifier("decision.\(decision.id)")
    }
}

private struct OptionRowView: View {
    let decision: TreatmentDecisions.DecisionResult
    let option: TreatmentDecisions.OptionResult
    let planContains: (String) -> Bool
    let onAddPlan: (String) -> Void
    let onAddTest: (String) -> Void
    let onDismiss: () -> Void

    private var bandColor: Color {
        switch option.band {
        case .treat: return Color.green
        case .test: return AMColor.priorityCol
        case .observe: return Color.blue
        case .notForPatient: return AMColor.emergency
        case .unknown: return Color.gray
        }
    }

    /// The suggestion for the current band; "Test further" shows the diagnostic-reasoning best next
    /// test when that panel provides one.
    @MainActor private var line: String? {
        if option.band == .test, let provider = DecisionSupportLinks.bestNextTest, let t = provider(decision.diagnosisName) {
            return t
        }
        return option.suggestedLine
    }

    private func per100(_ t: TreatmentDecisions.Triple) -> String {
        let f: (Double) -> String = { x in TreatmentDecisions.formatValue(TreatmentDecisions.jsRound(x * 1000) / 10) }
        return "\(f(t.point)) per 100 (\(f(t.low))–\(f(t.high)))"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                if let rank = option.rank {
                    Text("#\(rank)").font(.caption.weight(.heavy))
                }
                Text(option.label).font(.caption.weight(.bold))
                Text(option.band.label)
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .foregroundStyle(.white)
                    .background(bandColor, in: Capsule())
                Spacer(minLength: 4)
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle").foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Dismiss \(option.label)")
            }
            if option.borderline {
                Text("Borderline: \(option.bandRange.map { $0.label }.joined(separator: " / ")) across the evidence range")
                    .font(.caption2).foregroundStyle(AMColor.priorityCol)
            }
            if option.lowEvidence {
                Text("Low evidence — estimate").font(.caption2.weight(.bold)).foregroundStyle(Color.orange)
            }
            if option.band != .notForPatient {
                ThresholdBarView(option: option, probability: decision.probability)
                if decision.probability != nil {
                    Text("For this patient: benefit \(per100(option.expectedBenefit)) · harm \(per100(option.expectedHarm))")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }
            if let s = option.factorSummary {
                Text(s).font(.caption2).fixedSize(horizontal: false, vertical: true)
            }
            if let w = option.withheldText {
                Text(w).font(.caption2).foregroundStyle(AMColor.emergency).fixedSize(horizontal: false, vertical: true)
            } else if let e = option.excludedReason {
                Text(e).font(.caption2).foregroundStyle(AMColor.emergency).fixedSize(horizontal: false, vertical: true)
            }
            if let l = line, option.band != .notForPatient {
                Text(l).font(.caption).fixedSize(horizontal: false, vertical: true)
            }
            SourcesDisclosure(sources: option.sources)
            if let l = line, option.band == .treat || option.band == .observe || option.band == .test {
                if option.band == .test || option.suggestedAddAs == "test" {
                    Button("Add test") { onAddTest(l) }
                        .font(.caption.weight(.semibold))
                } else {
                    Button(planContains(l) ? "In plan" : "Add to plan") { onAddPlan(l) }
                        .font(.caption.weight(.semibold))
                        .disabled(planContains(l))
                }
            }
        }
        .padding(.vertical, 3)
    }
}

// MARK: - Observe | Test | Treat bar

private struct ThresholdBarView: View {
    let option: TreatmentDecisions.OptionResult
    let probability: Double?

    private var observeTint: Color { Color(red: 0.73, green: 0.90, blue: 0.99) }
    private var testTint: Color { Color(red: 0.99, green: 0.90, blue: 0.54) }
    private var treatTint: Color { Color(red: 0.73, green: 0.97, blue: 0.82) }
    private var rangeTint: Color { Color(red: 0.55, green: 0.60, blue: 0.66) }

    var body: some View {
        let treat = option.treatThreshold.point
        let test = option.testThreshold?.point
        let obsEnd = test ?? treat
        VStack(alignment: .leading, spacing: 2) {
            GeometryReader { geo in
                let w = geo.size.width
                ZStack(alignment: .leading) {
                    Rectangle().fill(treatTint).frame(width: w, height: 10)
                    if let t = test {
                        Rectangle().fill(testTint).frame(width: w * CGFloat(treat), height: 10)
                        Rectangle().fill(observeTint).frame(width: w * CGFloat(t), height: 10)
                    } else {
                        Rectangle().fill(observeTint).frame(width: w * CGFloat(treat), height: 10)
                    }
                    Rectangle().fill(rangeTint)
                        .frame(width: max(1, w * CGFloat(option.treatThreshold.high - option.treatThreshold.low)), height: 3)
                        .offset(x: w * CGFloat(option.treatThreshold.low), y: 4)
                    if let p = probability {
                        Rectangle().fill(Color.black)
                            .frame(width: 3, height: 14)
                            .offset(x: w * CGFloat(min(1, max(0, p))) - 1.5)
                    }
                }
            }
            .frame(height: 14)
            .accessibilityElement()
            .accessibilityLabel(accessibilityText(obsEnd: obsEnd, test: test, treat: treat))
            HStack {
                Text("Observe < \(TreatmentDecisions.formatPercent(obsEnd))")
                Spacer()
                if let t = test {
                    Text("Test \(TreatmentDecisions.formatPercent(t))–\(TreatmentDecisions.formatPercent(treat))")
                    Spacer()
                }
                Text("Treat ≥ \(TreatmentDecisions.formatPercent(treat))")
            }
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
    }

    private func accessibilityText(obsEnd: Double, test: Double?, treat: Double) -> String {
        var s = "Observe below \(TreatmentDecisions.formatPercent(obsEnd))"
        if let t = test { s += ", test further from \(TreatmentDecisions.formatPercent(t))" }
        s += ", treat from \(TreatmentDecisions.formatPercent(treat))"
        if let p = probability { s += "; current \(TreatmentDecisions.formatPercent(p))" }
        return s
    }
}
