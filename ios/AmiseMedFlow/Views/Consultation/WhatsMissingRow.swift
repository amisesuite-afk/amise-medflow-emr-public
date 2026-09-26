// WhatsMissingRow.swift
// "What's missing" — a compact row under the consultation's header safety strip (allergy status),
// with a sheet for the full ranked list. Each item: what is missing, why (one line), and one tap —
// go to the step / tool that records it, or add the test as a *suggested* investigation. Nothing is
// ordered or recorded automatically. "Dismiss" hides an item for this consultation view only.
//
// Logic: Services/WhatsMissingPatient.swift → WhatsMissingCore (web twin: WhatsMissingStrip.tsx).
// Colours: plain Color values only (no Color.opacity passed to .background / .foregroundStyle).

import SwiftUI

struct WhatsMissingRow: View {
    @Bindable var patient: Patient
    let bayes: [BayesianDiagnosisEngine.DiagnosisResult]
    let onTab: (ConsultTab) -> Void
    let onTool: (ConsultTool) -> Void

    @State private var result: WhatsMissing.Result? = nil
    @State private var dismissed: Set<String> = []
    @State private var added: Set<String> = []
    @State private var showSheet = false

    private var items: [WhatsMissing.Item] {
        (result?.items ?? []).filter { !dismissed.contains($0.id) }
    }

    private var refreshKey: String {
        "\(patient.updatedAt.timeIntervalSince1970)|\(patient.investigationsJson?.count ?? 0)|\(bayes.map { $0.name }.joined(separator: ","))"
    }

    var body: some View {
        Group {
            if let first = items.first {
                row(first)
            }
        }
        .task(id: refreshKey) {
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard !Task.isCancelled, patient.isLive else { return }
            result = WhatsMissingPatient.result(for: patient, bayes: bayes)
        }
        .sheet(isPresented: $showSheet) {
            WhatsMissingSheet(items: items, topN: result?.topN ?? 5, added: added,
                              onAction: { item, action in perform(item, action) },
                              onDismiss: { dismissed.insert($0.id) })
        }
    }

    private func row(_ first: WhatsMissing.Item) -> some View {
        HStack(spacing: 8) {
            Circle().fill(WhatsMissingStyle.color(first.tier)).frame(width: 7, height: 7)
                .accessibilityHidden(true)
            Text("Missing")
                .font(.caption2.weight(.heavy))
                .foregroundStyle(AMColor.accent)
            Text(first.what)
                .font(.caption.weight(.semibold))
                .foregroundStyle(AMColor.ink)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: 4)
            Button(WhatsMissingStyle.actionLabel(first.action)) { perform(first, first.action) }
                .font(.caption.weight(.semibold))
                .buttonStyle(.borderless)
                .disabled(first.action.kind == "test" && added.contains(first.id))
                .accessibilityIdentifier("consult.whatsMissing.action")
            if items.count > 1 {
                Button("+\(items.count - 1)") { showSheet = true }
                    .font(.caption.weight(.semibold))
                    .buttonStyle(.borderless)
                    .accessibilityLabel("Show all \(items.count) missing items")
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .onTapGesture { showSheet = true }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Text("What's missing: \(first.what). \(first.why)"))
        .accessibilityIdentifier("consult.whatsMissing")
    }

    private func perform(_ item: WhatsMissing.Item, _ action: WhatsMissing.Action) {
        if action.kind == "test", let test = action.test {
            addSuggestedTest(test, for: item)
            return
        }
        guard let field = action.field else { return }
        showSheet = false
        if field.hasPrefix("score:") { onTool(.scores); return }
        switch field {
        case "weight", "vitals": onTool(.vitals)
        case "allergies": onTab(.allergies)
        case "medications", "supplements": onTab(.meds)
        case "exam": onTab(.exam)
        default: onTab(.hpi)   // pregnancy status, history questions
        }
    }

    private func addSuggestedTest(_ label: String, for item: WhatsMissing.Item) {
        if patient.investigations.contains(where: { $0.name == label && $0.status != .cancelled }) {
            added.insert(item.id)
            return
        }
        let lower = label.lowercased()
        let imagingWords = ["ct ", "ctpa", "ultrasound", "uss", "mri", "x-ray", "xr ", "scan"]
        let category: InvestigationEntry.InvCategory = imagingWords.contains(where: { lower.contains($0) }) ? .imaging : .blood
        let entry = InvestigationEntry(name: label, category: category, status: .suggested,
                                       suggestedFor: "\(item.what) (what's missing)")
        patient.investigations.append(entry)
        patient.updatedAt = .now
        patient.pendingSync = true
        added.insert(item.id)
    }
}

enum WhatsMissingStyle {
    static func color(_ tier: String) -> Color {
        switch tier {
        case "safety": return AMColor.emergency
        case "decision": return AMColor.priorityCol
        default: return Color(.systemGray)
        }
    }

    static func tierLabel(_ tier: String) -> String {
        switch tier {
        case "safety": return "Safety"
        case "decision": return "Decision"
        default: return "Score"
        }
    }

    static func actionLabel(_ a: WhatsMissing.Action) -> String {
        if a.kind == "test" { return "Add test" }
        let f = a.field ?? ""
        if f.hasPrefix("score:") { return "Open score" }
        switch f {
        case "weight": return "Record weight"
        case "vitals": return "Record observations"
        case "allergies": return "Record allergies"
        case "pregnancy": return "Record status"
        case "medications": return "Record last dose"
        case "supplements": return "Ask"
        case "exam": return "Examine"
        default: return "Ask"
        }
    }
}

struct WhatsMissingSheet: View {
    let items: [WhatsMissing.Item]
    let topN: Int
    let added: Set<String>
    let onAction: (WhatsMissing.Item, WhatsMissing.Action) -> Void
    let onDismiss: (WhatsMissing.Item) -> Void
    @Environment(\.dismiss) private var close
    @State private var showAll = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(Array((showAll ? items : Array(items.prefix(topN))).enumerated()), id: \.element.id) { pair in
                        itemRow(pair.offset + 1, pair.element)
                    }
                    if items.count > topN {
                        Button(showAll ? "Show top \(topN)" : "More… (\(items.count - topN))") { showAll.toggle() }
                            .font(.footnote)
                    }
                } footer: {
                    Text("Ranked: safety first, then what could change the decision, then score completeness. Suggestions only — nothing is ordered or recorded until you tap.")
                        .font(.caption2)
                }
            }
            .navigationTitle("What's missing")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { close() } }
            }
        }
    }

    private func itemRow(_ rank: Int, _ item: WhatsMissing.Item) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Circle().fill(WhatsMissingStyle.color(item.tier)).frame(width: 7, height: 7)
                    .accessibilityHidden(true)
                Text("\(rank). \(WhatsMissingStyle.tierLabel(item.tier))")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(WhatsMissingStyle.color(item.tier))
                Spacer(minLength: 0)
            }
            Text(item.what).font(.subheadline.weight(.semibold))
            Text(item.why).font(.caption).foregroundStyle(.secondary)
            ForEach(item.also, id: \.self) { a in
                Text("Also: \(a)").font(.caption2).foregroundStyle(.secondary)
            }
            HStack(spacing: 12) {
                Button(added.contains(item.id) && item.action.kind == "test" ? "Suggested ✓" : WhatsMissingStyle.actionLabel(item.action)) {
                    onAction(item, item.action)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .disabled(added.contains(item.id) && item.action.kind == "test")
                if let alt = item.alt {
                    Button(WhatsMissingStyle.actionLabel(alt)) { onAction(item, alt) }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                }
                Spacer(minLength: 0)
                Button("Dismiss") { onDismiss(item) }
                    .font(.caption)
                    .buttonStyle(.borderless)
            }
        }
        .padding(.vertical, 2)
        .accessibilityIdentifier("consult.whatsMissing.item")
    }
}
