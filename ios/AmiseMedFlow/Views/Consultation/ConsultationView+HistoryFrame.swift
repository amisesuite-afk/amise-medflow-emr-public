// ConsultationView+HistoryFrame.swift
// HPI step: the history builder adapts to the chief complaint (HistoryFrames.swift). SOCRATES for
// pain (by region); a cough, lump, bleeding, dysphagia … history for everything else; the other
// symptoms named in the complaint add their key questions. One tap switches the frame.
//
// Chips store their value in socratesSelections[key] exactly as the SOCRATES builder did, so the
// Bayesian engine, the encounter snapshot and the pipeline read them unchanged.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - Frame

    var resolvedHistoryFrame: ResolvedHistoryFrame {
        HistoryFrames.resolve(complaint: patient.chiefComplaint ?? "",
                              system: selectedSpecialtyHint,
                              overrideFrameId: historyFrameOverride)
    }

    /// The frame that owns a question (a secondary question belongs to its own frame's aliases).
    func historyOwner(_ dim: ResolvedHistoryDimension, _ resolved: ResolvedHistoryFrame) -> HistoryFrameSpec {
        HistoryFrames.frame(id: dim.frameId) ?? resolved.frame
    }

    func historySelectedLabels(_ dim: ResolvedHistoryDimension, _ resolved: ResolvedHistoryFrame) -> [String] {
        let owner = historyOwner(dim, resolved)
        return dim.spec.options
            .filter { HistoryFrames.isSelected($0, in: owner, selections: socratesSelections) }
            .map(\.label)
    }

    func historyAnsweredCount(_ resolved: ResolvedHistoryFrame) -> Int {
        resolved.dimensions.filter { !historySelectedLabels($0, resolved).isEmpty }.count
    }

    /// Frames offered for a one-tap switch: the complaint's own, its other symptoms', and General.
    func historyQuickFrames(_ resolved: ResolvedHistoryFrame) -> [HistoryFrameSpec] {
        var ids = [resolved.choice.frameId] + resolved.choice.secondary + ["general"]
        if !ids.contains(resolved.frame.id) { ids.insert(resolved.frame.id, at: 0) }
        var seen: Set<String> = []
        return ids.compactMap { id in
            guard !seen.contains(id), let f = HistoryFrames.frame(id: id) else { return nil }
            seen.insert(id)
            return f
        }
    }

    // MARK: - Section

    @ViewBuilder
    var historyFrameSection: some View {
        let resolved = resolvedHistoryFrame
        let filled = historyAnsweredCount(resolved)
        Section {
            historyFrameSwitcher(resolved)
            ForEach(resolved.dimensions) { dim in
                historyDimRow(dim, resolved: resolved)
            }
        } header: {
            HStack {
                Label(resolved.frame.type == "pain" ? "SOCRATES Builder" : resolved.frame.title,
                      systemImage: "square.grid.2x2")
                Spacer()
                Text("\(filled)/\(resolved.dimensions.count)")
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .foregroundStyle(filled == resolved.dimensions.count ? .green : .secondary)
            }
        } footer: {
            Text(resolved.frame.type == "pain"
                 ? "SOCRATES for \(resolved.frame.label.lowercased()). Change the frame above if the complaint is not pain."
                 : "\(resolved.frame.title): questions chosen from the complaint. SOCRATES is used for pain only.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }

        let others = otherRecordedHistory(resolved)
        if !others.isEmpty {
            Section {
                ForEach(Array(others.enumerated()), id: \.offset) { _, item in
                    HStack {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(HistoryFrames.keyTitle(item.key))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text(HistoryFrames.displayLabel(key: item.key, value: item.value))
                                .font(.callout)
                        }
                        Spacer()
                        Button {
                            removeHistoryValue(key: item.key, value: item.value)
                        } label: {
                            Image(systemName: "xmark.circle")
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Remove")
                    }
                }
            } header: {
                Label("Also recorded", systemImage: "tray.full")
            } footer: {
                Text("Answers given under another frame or an earlier version. They still feed the differential until removed.")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    // MARK: - Frame switcher (one tap)

    @ViewBuilder
    func historyFrameSwitcher(_ resolved: ResolvedHistoryFrame) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text("History frame")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Menu {
                    Button {
                        historyFrameOverride = nil
                    } label: {
                        Label("Automatic (from the complaint)",
                              systemImage: historyFrameOverride == nil ? "checkmark" : "wand.and.stars")
                    }
                    ForEach(HistoryFrameData.frames, id: \.id) { f in
                        Button {
                            historyFrameOverride = f.id
                            socratesExpandedDim = f.dimensions.first?.id
                        } label: {
                            if resolved.frame.id == f.id {
                                Label(f.label, systemImage: "checkmark")
                            } else {
                                Text(f.label)
                            }
                        }
                    }
                } label: {
                    Label("All frames", systemImage: "chevron.up.chevron.down")
                        .font(.caption)
                }
                .accessibilityIdentifier("consult.hpi.frameMenu")
            }
            ChipFlow(hSpacing: 7, vSpacing: 7) {
                ForEach(historyQuickFrames(resolved), id: \.id) { f in
                    let isOn = resolved.frame.id == f.id
                    Button {
                        historyFrameOverride = f.id == resolved.choice.frameId ? nil : f.id
                        socratesExpandedDim = f.dimensions.first?.id
                    } label: {
                        Text(f.label)
                            .font(.system(size: 12, weight: isOn ? .semibold : .regular))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(isOn ? AMColor.accent : AMColor.accentLt, in: Capsule())
                            .foregroundStyle(isOn ? Color.white : AMColor.accent)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("consult.hpi.frame.\(f.id)")
                }
            }
        }
        .padding(.vertical, 4)
    }

    // MARK: - Question row (accordion)

    @ViewBuilder
    func historyDimRow(_ dim: ResolvedHistoryDimension, resolved: ResolvedHistoryFrame) -> some View {
        let selections = historySelectedLabels(dim, resolved)
        let isExpanded = socratesExpandedDim == dim.id
        let owner = historyOwner(dim, resolved)

        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.18)) {
                    socratesExpandedDim = isExpanded ? nil : dim.id
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: dim.spec.icon)
                        .foregroundStyle(selections.isEmpty ? .secondary : AMColor.accent)
                        .frame(width: 20, alignment: .center)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(dim.title)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.primary)
                        if !selections.isEmpty {
                            Text(selections.joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(AMColor.accent)
                                .lineLimit(1)
                        } else if !isExpanded {
                            Text(dim.spec.question)
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    Spacer()
                    if !selections.isEmpty {
                        Text("\(selections.count)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 18, height: 18)
                            .background(AMColor.accent, in: Circle())
                    }
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                }
                .padding(.vertical, 6)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("consult.hpi.dim.\(dim.id)")

            if isExpanded {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(dim.spec.options, id: \.label) { option in
                        let isSelected = HistoryFrames.isSelected(option, in: owner, selections: socratesSelections)
                        Button {
                            toggleHistoryChip(option, dim: dim, owner: owner, resolved: resolved)
                        } label: {
                            Text(option.label)
                                .font(.system(size: 12, weight: isSelected ? .semibold : .regular))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(isSelected ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                .foregroundStyle(isSelected ? Color.white : AMColor.accent)
                                .animation(.easeInOut(duration: 0.12), value: isSelected)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.top, 10)
                .padding(.bottom, 4)
            }
        }
    }

    // MARK: - Toggle + auto-advance

    func toggleHistoryChip(_ option: HistoryOptionSpec, dim: ResolvedHistoryDimension,
                           owner: HistoryFrameSpec, resolved: ResolvedHistoryFrame) {
        let wasSelected = HistoryFrames.isSelected(option, in: owner, selections: socratesSelections)
        socratesSelections = HistoryFrames.toggled(option, in: dim.spec, frame: owner, selections: socratesSelections)
        if !dim.spec.multiSelect && !wasSelected {
            let ids = resolved.dimensions.map(\.id)
            if let idx = ids.firstIndex(of: dim.id), idx + 1 < ids.count {
                withAnimation(.easeInOut(duration: 0.18)) { socratesExpandedDim = ids[idx + 1] }
            }
        }
    }

    func removeHistoryValue(key: String, value: String) {
        socratesSelections[key]?.remove(value)
        if socratesSelections[key]?.isEmpty == true { socratesSelections[key] = nil }
    }

    /// Stored selections the current frame does not show (another frame, a legacy value), excluding
    /// the Quick Clinical Flags shown above.
    func otherRecordedHistory(_ resolved: ResolvedHistoryFrame) -> [(key: String, value: String)] {
        var shown: Set<String> = []
        for dim in resolved.dimensions {
            let owner = historyOwner(dim, resolved)
            for o in dim.spec.options {
                shown.insert("\(o.key)\u{1F}\(o.value)")
                for a in owner.aliases where a.key == o.key && a.current == o.label {
                    shown.insert("\(a.key)\u{1F}\(a.legacy)")
                }
            }
        }
        let flags = specialtyEarlyFormGroups(hint: selectedSpecialtyHint ?? "", cc: patient.chiefComplaint ?? "")
        for group in flags {
            for chip in group.chips { shown.insert("\(chip.dimId)\u{1F}\(chip.value)") }
        }
        var out: [(key: String, value: String)] = []
        for key in HistoryFrames.orderedKeys(Array(socratesSelections.keys)) {
            for v in (socratesSelections[key] ?? []).sorted() where !shown.contains("\(key)\u{1F}\(v)") {
                out.append((key: key, value: v))
            }
        }
        return out
    }

    // MARK: - HPI prose

    var historyPreview: String? {
        let resolved = resolvedHistoryFrame
        guard historyAnsweredCount(resolved) > 0 else { return nil }
        let secondary = historySentences(resolved.dimensions.filter(\.secondary), resolved)
        let main: String
        if resolved.frame.type == "pain" && resolved.frame.variant != "head" {
            // Pain: the SOCRATES prose, unchanged.
            main = buildHpiProse()
        } else {
            main = ([historyOpeningSentence()] + [historySentences(resolved.dimensions.filter { !$0.secondary }, resolved)])
                .filter { !$0.isEmpty }
                .joined(separator: " ")
        }
        return secondary.isEmpty ? main : "\(main) \(secondary)"
    }

    func historyOpeningSentence() -> String {
        let cc = patient.chiefComplaint ?? "presenting complaint"
        var open = patient.fullName
        if patient.ageYears > 0 {
            open += ", a \(patient.ageYears)-year-old \(patient.sex.rawValue.lowercased()),"
        }
        return open + " presents with \(cc)."
    }

    func historySentences(_ dims: [ResolvedHistoryDimension], _ resolved: ResolvedHistoryFrame) -> String {
        var parts: [String] = []
        for dim in dims {
            let labels = historySelectedLabels(dim, resolved)
            guard !labels.isEmpty else { continue }
            parts.append("\(dim.title): \(joinList(labels.map(historyProseCase))).")
        }
        return parts.joined(separator: " ")
    }

    /// "Dry cough" → "dry cough"; acronyms ("MRC 2 …", "RUQ") keep their case.
    func historyProseCase(_ label: String) -> String {
        let chars = Array(label)
        if chars.count > 1, chars[0].isUppercase, chars[1].isUppercase { return label }
        guard let first = chars.first else { return label }
        return String(first).lowercased() + String(chars.dropFirst())
    }
}
