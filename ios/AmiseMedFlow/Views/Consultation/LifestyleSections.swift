// LifestyleSections.swift
// Consultation → Social: structured lifestyle history (ritual fasting, complementary therapies,
// night-shift work, usual sleep). Consultation → Plan: the fasting / sleep safety prompts and the
// evidence-graded non-drug suggestions. Rules and wording: Services/LifestylePractices.swift
// (web twin: dashboard LifestyleHistoryCard / LifestylePracticesPanel).
//
// Nothing here changes the record by itself: prompts are dismissible, and a plan line is added
// only when the clinician taps "Add to plan" (CLAUDE.md "Central diagnosis radiation").
// Stored in PathwayData.lifestyle → patients.pathway_data_json (synced by SyncService+PathwayData).

import SwiftUI
import SwiftData

// MARK: - Shared pieces

private struct LifestyleChip: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 11))
                Text(title).font(.system(size: 12))
            }
            .padding(.horizontal, 10).padding(.vertical, 5)
            .foregroundStyle(selected ? Color.white : AMColor.accent)
            .background(selected ? AMColor.accent : AMColor.accentLt, in: Capsule())
        }
        .buttonStyle(.plain)
    }
}

private struct LifestylePromptRow: View {
    let prompt: LifestylePractices.Prompt
    let onDismiss: () -> Void

    private var tint: Color {
        switch prompt.grade {
        case .warning: return AMColor.emergency
        case .caution: return AMColor.priorityCol
        case .info:    return Color.blue
        }
    }

    private var label: String {
        switch prompt.grade {
        case .warning: return "Safety"
        case .caution: return "Caution"
        case .info:    return "Note"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: prompt.grade == .info ? "info.circle" : "exclamationmark.triangle.fill")
                    .foregroundStyle(tint)
                Text("\(label): \(prompt.text)")
                    .font(.caption)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 4)
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle").foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Dismiss")
            }
            Text("Source: \(prompt.source)")
                .font(.caption2).foregroundStyle(.secondary)
        }
        .padding(8)
        .background(tint.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
    }
}

/// The fasting / sleep safety prompts for this patient (dismissed ones hidden).
private struct LifestylePromptList: View {
    let prompts: [LifestylePractices.Prompt]
    @Binding var dismissed: Set<String>

    var body: some View {
        ForEach(prompts.filter { !dismissed.contains($0.id) }) { p in
            LifestylePromptRow(prompt: p) { dismissed.insert(p.id) }
        }
    }
}

// MARK: - Social tab

struct LifestyleHistorySection: View {
    @Bindable var patient: Patient
    /// Called after every edit (ConsultationView.touch()).
    var onEdit: () -> Void

    @State private var dismissed: Set<String> = []

    private var history: LifestyleHistory { patient.pathwayData.lifestyle }

    private func update(_ change: (inout LifestyleHistory) -> Void) {
        var data = patient.pathwayData
        change(&data.lifestyle)
        patient.pathwayData = data
        onEdit()
    }

    /// Stepper value; the first tap starts from 7 h. "Clear" returns it to not recorded.
    private var sleepHoursValue: Binding<Double> {
        Binding(
            get: { history.sleepHours ?? 7 },
            set: { v in update { $0.sleepHours = LifestyleHistory.normalisedSleepHours(v) } }
        )
    }

    var body: some View {
        Section {
            ChipFlow(hSpacing: 8, vSpacing: 8) {
                ForEach(LifestyleHistory.Fasting.allCases, id: \.self) { f in
                    LifestyleChip(title: f.label, selected: history.fasting.contains(f)) {
                        update { $0.toggleFasting(f) }
                    }
                }
            }
            .padding(.vertical, 4)
            if history.fasting.contains(.other) {
                TextField("Which fast?", text: Binding(
                    get: { history.fastingOther },
                    set: { v in update { $0.fastingOther = v } }))
            }
            if history.recordsFasting {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(LifestyleHistory.FastStatus.allCases, id: \.self) { st in
                        LifestyleChip(title: st.label, selected: history.fastingStatus == st) {
                            update { $0.fastingStatus = $0.fastingStatus == st ? nil : st }
                        }
                    }
                }
                .padding(.vertical, 4)
                TextField("When is the next fast planned? (e.g. Ramadan, February)", text: Binding(
                    get: { history.fastingWhen },
                    set: { v in update { $0.fastingWhen = v } }))
            }
        } header: {
            Label("Religious or ritual fasting", systemImage: "moon.stars")
        }

        Section {
            ChipFlow(hSpacing: 8, vSpacing: 8) {
                ForEach(LifestyleHistory.Therapy.allCases, id: \.self) { t in
                    LifestyleChip(title: t.label, selected: history.therapies.contains(t)) {
                        update { $0.toggleTherapy(t) }
                    }
                }
            }
            .padding(.vertical, 4)
            if history.therapies.contains(.other) {
                TextField("Which therapy?", text: Binding(
                    get: { history.therapiesOther },
                    set: { v in update { $0.therapiesOther = v } }))
            }
        } header: {
            Label("Complementary therapies used", systemImage: "leaf")
        }

        Section {
            ChipFlow(hSpacing: 8, vSpacing: 8) {
                LifestyleChip(title: "Night-shift work", selected: history.nightShift == true) {
                    update { $0.nightShift = $0.nightShift == true ? nil : true }
                }
                LifestyleChip(title: "No night-shift work", selected: history.nightShift == false) {
                    update { $0.nightShift = $0.nightShift == false ? nil : false }
                }
            }
            .padding(.vertical, 4)
            HStack {
                Stepper(value: sleepHoursValue, in: 0...24, step: 0.5) {
                    Text(history.sleepHours.map { "Usual sleep: \(LifestyleHistory.formatHours($0)) h a night" }
                         ?? "Usual sleep: not recorded")
                }
                if history.sleepHours != nil {
                    Button("Clear") { update { $0.sleepHours = nil } }
                        .buttonStyle(.borderless)
                }
            }
            LifestylePromptList(prompts: LifestylePractices.safetyPrompts(LifestylePractices.context(for: patient)),
                                dismissed: $dismissed)
        } header: {
            Label("Sleep and shift work", systemImage: "bed.double")
        }
    }
}

// MARK: - Plan tab

struct LifestylePracticesSection: View {
    @Bindable var patient: Patient
    /// Called after a plan line is added (ConsultationView.touch()).
    var onEdit: () -> Void

    @State private var dismissed: Set<String> = []

    private func gradeTint(_ g: LifestylePractices.EvidenceGrade) -> Color {
        switch g {
        case .works:     return Color.green
        case .modest:    return Color.blue
        case .mixed:     return AMColor.priorityCol
        case .noBenefit: return Color.gray
        }
    }

    var body: some View {
        let ctx = LifestylePractices.context(for: patient)
        let prompts = LifestylePractices.safetyPrompts(ctx)
        let suggestions = LifestylePractices.planSuggestions(ctx).filter { !dismissed.contains($0.id) }
        if !prompts.isEmpty || !suggestions.isEmpty {
            Section {
                LifestylePromptList(prompts: prompts, dismissed: $dismissed)
                ForEach(suggestions) { s in
                    suggestionRow(s)
                }
            } header: {
                Label("Lifestyle and non-drug options", systemImage: "figure.mind.and.body")
            } footer: {
                Text("Suggestions only. Tap Add to plan to include a line; review before signing.")
                    .font(.caption2)
            }
        }
    }

    @ViewBuilder
    private func suggestionRow(_ s: LifestylePractices.Suggestion) -> some View {
        let plan = patient.managementPlan ?? ""
        let added = plan.contains(s.planLine)
        let tint = gradeTint(s.evidence)
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text(s.kind == .counsel ? "Recorded — counsel" : "Suggested")
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .foregroundStyle(AMColor.accentDk)
                    .background(AMColor.accentLt, in: Capsule())
                Text(s.practice).font(.subheadline.weight(.semibold))
                Spacer(minLength: 4)
                Button {
                    dismissed.insert(s.id)
                } label: {
                    Image(systemName: "xmark.circle").foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Dismiss \(s.practice)")
            }
            HStack(spacing: 6) {
                Text("Evidence: \(s.evidence.rawValue)")
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .foregroundStyle(tint)
                    .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 4))
                if s.alreadyUsed && s.kind == .suggestion {
                    Text("already practises").font(.caption2).foregroundStyle(.secondary)
                }
            }
            Text("\(s.reason). \(s.planLine)")
                .font(.caption).foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Text("Source: \(s.source)")
                .font(.caption2).foregroundStyle(.tertiary)
            Button(added ? "In plan" : "Add to plan") {
                patient.managementPlan = LifestylePractices.appendPlanLine(plan, s.planLine)
                onEdit()
            }
            .font(.caption.weight(.semibold))
            .disabled(added)
        }
        .padding(.vertical, 2)
    }
}
