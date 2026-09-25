// DiagnosticReasoningCard.swift
// Diagnosis tab — "Diagnostic reasoning": for / against / missing / doesn't fit for the leading
// diagnoses (with each finding's likelihood ratio and source), the best next discriminator,
// "Doesn't fit the working diagnosis" alerts, a diagnostic time-out, the zebra check and the
// longitudinal pattern view. Deterministic (DiagnosticReasoningAdapter / DiagnosticReasoningCore);
// no AI. Collapsible; the alerts stay visible. Nothing is added to the record except by a tap
// ("Add to differential" appends to the assessment, "Add test" adds a Suggested investigation).
// Web twin: artifacts/dashboard/src/components/DiagnosticReasoningPanel.tsx.

import SwiftUI

struct DiagnosticReasoningSection: View {
    @Bindable var patient: Patient
    let results: [BayesianDiagnosisEngine.DiagnosisResult]

    @State private var expanded = true
    @State private var dismissedAlerts: Set<String> = []
    @State private var added: Set<String> = []

    private var againstColor: Color { Color(red: 0.73, green: 0.11, blue: 0.11) }
    private var forColor: Color { Color(red: 0.04, green: 0.42, blue: 0.32) }
    private var fitColor: Color { Color(red: 0.63, green: 0.38, blue: 0.03) }
    private var alertBackground: Color { Color(red: 0.99, green: 0.95, blue: 0.80, opacity: 1) }

    var body: some View {
        if !results.isEmpty {
            let report = DiagnosticReasoningAdapter.report(results: results, patient: patient)
            let alerts = report.closureAlerts.filter { !dismissedAlerts.contains($0.key) }
            Section {
                ForEach(alerts) { alert in
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                            .accessibilityHidden(true)
                        Text(alert.text).font(.caption)
                        Spacer(minLength: 4)
                        Button {
                            dismissedAlerts.insert(alert.key)
                        } label: {
                            Image(systemName: "xmark").font(.caption2)
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(.secondary)
                        .accessibilityLabel("Dismiss this alert for this visit")
                    }
                    .padding(8)
                    .background(alertBackground, in: RoundedRectangle(cornerRadius: 8))
                }
                DisclosureGroup(isExpanded: $expanded) {
                    details(report)
                } label: {
                    Text(expanded ? "Why these diagnoses" : "Show the reasoning")
                        .font(.caption.weight(.semibold))
                }
            } header: {
                HStack(spacing: 6) {
                    Image(systemName: "list.bullet.clipboard").foregroundStyle(.purple).accessibilityHidden(true)
                    Text("Diagnostic Reasoning").font(.caption.weight(.semibold))
                    Spacer()
                    Text("engine-derived").font(.caption2).foregroundStyle(.secondary)
                }
            } footer: {
                Text("Findings are what the record says; LRs and percentages are engine estimates. Nothing is added unless you tap. Rules \(DiagnosticReasoning.version), zebras \(ZebraCheck.version) — unreviewed, awaiting sign-off.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func details(_ report: DiagnosticReasoningAdapter.Report) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if report.timeOut.suggested {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Diagnostic time-out suggested", systemImage: "pause.circle")
                        .font(.caption.weight(.semibold))
                    ForEach(report.timeOut.reasons, id: \.self) { Text($0).font(.caption2) }
                    ForEach(Array(report.timeOut.checklist.enumerated()), id: \.offset) { item in
                        Text("\(item.offset + 1). \(item.element)").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }

            Text("\(report.findingsUsed) recorded finding\(report.findingsUsed == 1 ? "" : "s") used")
                .font(.caption2).foregroundStyle(.secondary)
            ForEach(Array(report.explanations.enumerated()), id: \.offset) { item in
                hypothesisBlock(item.element, rank: item.offset < DiagnosticReasoningAdapter.topK ? item.offset + 1 : nil,
                                working: report.workingId == item.element.hypothesisId)
            }

            if !report.discriminators.isEmpty {
                Text("Best next discriminator").font(.caption.weight(.semibold))
                ForEach(report.discriminators) { d in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(d.probe.cost.label)
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 5).padding(.vertical, 1)
                                .background(d.probe.cost == .advanced ? Color.orange : AMColor.accent, in: RoundedRectangle(cornerRadius: 4))
                            Text(d.probe.label).font(.caption.weight(.semibold))
                            Spacer(minLength: 4)
                            if d.probe.kind == .investigation {
                                Button(added.contains("ix:\(d.id)") ? "Added" : "Add test") { addTest(d) }
                                    .font(.caption2.weight(.semibold))
                                    .buttonStyle(.bordered)
                                    .disabled(added.contains("ix:\(d.id)"))
                                    .accessibilityLabel("Add \(d.probe.label) as a suggested investigation")
                            }
                        }
                        Text(d.why).font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }

            if !report.zebras.isEmpty {
                Text("Zebra check — rare but real").font(.caption.weight(.semibold))
                ForEach(report.zebras) { z in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(z.match.condition).font(.caption.weight(.semibold))
                            if z.inDifferential {
                                Text("in the differential").font(.caption2).foregroundStyle(forColor)
                            }
                            Spacer(minLength: 4)
                            Button(added.contains("dx:\(z.match.condition)") ? "Added" : "Add to differential") {
                                addDifferential(z.match.condition)
                            }
                            .font(.caption2.weight(.semibold))
                            .buttonStyle(.bordered)
                            .disabled(added.contains("dx:\(z.match.condition)"))
                        }
                        Text("\(z.match.explains). Recorded: \(z.match.matched.joined(separator: " + ")).").font(.caption2)
                        if z.match.link == "supplements" {
                            Text("See Herbs, teas, bush remedies & supplements in the history.").font(.caption2).foregroundStyle(fitColor)
                        }
                        Text(z.match.citation).font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }

            if let l = report.longitudinal {
                Text("Across visits (read-only)").font(.caption.weight(.semibold))
                ForEach(l.recurring, id: \.problem) { r in
                    Text("Recurring: \(r.problem) — \(r.count) visits (\(r.dates.joined(separator: ", ")))").font(.caption2)
                }
                ForEach(l.trends, id: \.analyte) { t in Text(t.text).font(.caption2) }
                ForEach(Array(l.unheld.enumerated()), id: \.offset) { item in
                    Text("Earlier diagnosis revised: \(item.element.diagnosis) (\(item.element.date)) → \(item.element.replacedBy) (\(item.element.replacedOn))")
                        .font(.caption2)
                }
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func hypothesisBlock(_ e: DiagnosticReasoning.Explanation, rank: Int?, working: Bool) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                Text(rankPrefix(rank) + e.label).font(.caption.weight(.semibold))
                if working { Text("working").font(.caption2.weight(.bold)).foregroundStyle(AMColor.accent) }
                Text("engine \(DiagnosticReasoning.fmtPct(e.probability))").font(.caption2).foregroundStyle(.secondary)
                if e.lowEvidence { Text("low evidence").font(.caption2).foregroundStyle(fitColor) }
                Spacer(minLength: 4)
                Button(added.contains("dx:\(e.label)") ? "Added" : "Add to differential") { addDifferential(e.label) }
                    .font(.caption2.weight(.semibold))
                    .buttonStyle(.bordered)
                    .disabled(added.contains("dx:\(e.label)"))
            }
            evidenceLine("For", e.forFindings.map(forText), forColor)
            evidenceLine("Against", e.against.map(againstText), againstColor)
            evidenceLine("Expected, missing", e.missing.map(missingText), Color.secondary)
            evidenceLine("Doesn't fit", e.doesntFit.map(doesntFitText), fitColor)
        }
        .padding(.vertical, 2)
    }

    private func rankPrefix(_ rank: Int?) -> String {
        guard let rank else { return "" }
        return "\(rank). "
    }

    private func forText(_ x: DiagnosticReasoning.EvidenceLine) -> String {
        "\(x.label) (LR \(DiagnosticReasoning.formatLr(x.lr)))"
    }

    private func againstText(_ x: DiagnosticReasoning.EvidenceLine) -> String {
        let name = x.status == .absent ? "no " + DiagnosticReasoning.lowerFirst(x.label) : x.label
        return "\(name) (LR \(DiagnosticReasoning.formatLr(x.lr)))"
    }

    private func missingText(_ x: DiagnosticReasoning.EvidenceLine) -> String {
        x.label + (x.documented ? " (absent)" : " (not recorded)")
    }

    private func doesntFitText(_ x: DiagnosticReasoning.EvidenceLine) -> String {
        if let favours = x.favours { return x.label + " → " + favours }
        return x.label + " (unexplained)"
    }

    @ViewBuilder
    private func evidenceLine(_ title: String, _ items: [String], _ colour: Color) -> some View {
        if !items.isEmpty {
            (Text("\(title): ").font(.caption2.weight(.bold)).foregroundStyle(colour)
             + Text(items.prefix(6).joined(separator: " · ")).font(.caption2))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func addDifferential(_ name: String) {
        let line = "Differential (considered): \(name)"
        let existing = patient.assessmentText ?? ""
        if !existing.contains(line) {
            patient.assessmentText = existing.isEmpty ? line : existing + "\n" + line
            patient.updatedAt = .now
            patient.pendingSync = true
        }
        added.insert("dx:\(name)")
    }

    private func addTest(_ d: DiagnosticReasoningAdapter.Discriminator) {
        var list = patient.investigations
        if !list.contains(where: { $0.name.caseInsensitiveCompare(d.probe.label) == .orderedSame && $0.status != .cancelled }) {
            var entry = InvestigationEntry(name: d.probe.label, category: category(d.probe.cost, d.probe.label), status: .suggested)
            entry.suggestedFor = "Diagnostic reasoning: separates \(d.separates.joined(separator: " / "))"
            list.append(entry)
            patient.investigations = list
            patient.updatedAt = .now
            patient.pendingSync = true
        }
        added.insert("ix:\(d.id)")
    }

    private func category(_ cost: DiagnosticReasoning.ProbeCost, _ label: String) -> InvestigationEntry.InvCategory {
        let n = label.lowercased()
        if ["ogd", "endoscop", "colonoscop", "sigmoidoscop", "ercp", "gastroscop"].contains(where: { n.contains($0) }) { return .endoscopy }
        switch cost {
        case .imaging, .advanced: return .imaging
        case .lab: return .blood
        default: return .other
        }
    }
}
