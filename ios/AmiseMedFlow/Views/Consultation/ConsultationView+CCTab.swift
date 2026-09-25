// ConsultationView+CCTab.swift
// Chief complaint tab, Bayesian differential, specialty early form.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - CC tab

    var selectedChipLabel: String? {
        let cc = patient.chiefComplaint ?? ""
        return ccSpecialtyGroups.flatMap(\.chips).first(where: { $0.label == cc })?.label
    }

    var ccTab: some View {
        List {
            // Patient identity + free-text input
            Section {
                HStack(spacing: 6) {
                    Image(systemName: "person.text.rectangle")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let mrn = patient.mrn, !mrn.isEmpty {
                        Text(mrn)
                            .font(.system(.caption, design: .monospaced).weight(.medium))
                            .foregroundStyle(.secondary)
                    } else {
                        Text("Assigning MRN…")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                    Spacer()
                    Text("\(patient.encounters.filter(\.isComplete).count) saved visit(s)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                if let vt = patient.visitType {
                    HStack(spacing: 6) {
                        Image(systemName: vt.icon).foregroundStyle(AMColor.accent)
                        Text(vt.rawValue)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AMColor.accent)
                        Spacer()
                        Text("Visit type").font(.caption2).foregroundStyle(.tertiary)
                    }
                }
                // Free-text override
                TextField("Type a complaint or select below…",
                          text: Binding(get: { patient.chiefComplaint ?? "" },
                                        set: { patient.chiefComplaint = $0.isEmpty ? nil : $0; selectedSpecialtyHint = nil; touch() }),
                          axis: .vertical)
                    .font(.callout)
                    .lineLimit(3...)
                    .accessibilityIdentifier("consult.cc.field")
                if isAssessing {
                    HStack(spacing: 8) {
                        ProgressView().scaleEffect(0.8)
                        Text("Analysing pathway…").font(.caption).foregroundStyle(.secondary)
                    }
                }
            } header: {
                sectionHeader("Chief Complaint", icon: "person.fill.questionmark",
                              filled: !(patient.chiefComplaint ?? "").isEmpty)
            }

            // Inline Bayesian early differential
            if !ccBayesDiff.isEmpty {
                ccBayesDifferentialSection
            }

            // Pathway result
            if let result = triageResult { pathwayResult(result) }

            // Specialty-grouped complaint sections
            ForEach(ccSpecialtyGroups) { group in
                Section {
                    ForEach(group.chips) { chip in
                        let isSelected = selectedChipLabel == chip.label
                        Button {
                            patient.chiefComplaint = chip.label
                            selectedSpecialtyHint = group.name
                            touch()
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: chip.icon)
                                    .font(.system(size: 11))
                                    .foregroundStyle(isSelected ? AMColor.accent : .secondary)
                                    .frame(width: 16)
                                Text(chip.label)
                                    .font(.callout.weight(isSelected ? .semibold : .regular))
                                    .foregroundStyle(.primary)
                                Spacer()
                                if isSelected {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundStyle(AMColor.accent)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Label(group.name, systemImage: group.icon)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .textCase(nil)
                }
            }
        }
    }

    // MARK: - CC Bayesian differential (early, CC-only signal)

    @ViewBuilder private var ccBayesDifferentialSection: some View {
        Section {
            ForEach(ccBayesDiff.prefix(4), id: \.name) { dx in
                HStack(spacing: 8) {
                    // Urgency left stripe: amber=urgent, red=emergency, deep red=critical
                    if dx.urgency > 0 {
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(urgencyColor(dx.urgency))
                            .frame(width: 3)
                            .frame(minHeight: 36)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(dx.name)
                            .font(.subheadline.weight(.medium))
                        Text(dx.icdCode)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                        if dx.urgency > 0 {
                            Text(urgencyLabel(dx.urgency))
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(urgencyColor(dx.urgency))
                        }
                    }
                    Spacer()
                    // Probability bar + label
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.secondary.opacity(0.15))
                            .frame(width: 60, height: 6)
                        Capsule()
                            .fill(bayesColor(dx.confidence))
                            .frame(width: max(4, CGFloat(dx.probability) / 100 * 60), height: 6)
                    }
                    Text("\(dx.probability)%")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(bayesColor(dx.confidence))
                        .frame(width: 34, alignment: .trailing)
                }
            }
        } header: {
            Label("Early Differential — tap to confirm", systemImage: "wand.and.stars")
                .font(.caption.weight(.semibold))
                .foregroundStyle(AMColor.accent)
                .textCase(nil)
        } footer: {
            Text("Based on chief complaint + PMH only. Colour stripe = urgency tier. Refines as you add more evidence.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    func bayesColor(_ c: BayesianDiagnosisEngine.DiagnosisResult.Confidence) -> Color {
        switch c {
        case .certain:  return .red
        case .high:     return .orange
        case .moderate: return AMColor.accent
        case .low:      return .secondary
        }
    }

    func urgencyColor(_ level: Int) -> Color {
        switch level {
        case 3: return Color(red: 0.72, green: 0.0, blue: 0.0)
        case 2: return .red
        case 1: return .orange
        default: return .clear
        }
    }

    func urgencyLabel(_ level: Int) -> String {
        switch level {
        case 3: return "⚠ CRITICAL"
        case 2: return "⚠ EMERGENCY"
        case 1: return "URGENT"
        default: return ""
        }
    }

    // MARK: - Specialty Early Form

    /// Renders targeted clinical flag chips above the SOCRATES builder when a focused
    /// specialty CC is selected. Chips pre-populate socratesSelections, feeding directly
    /// into the Bayesian scorer without requiring SOCRATES to be re-opened.
    @ViewBuilder
    var specialtyEarlyFormSection: some View {
        let hint = selectedSpecialtyHint ?? ""
        let cc   = patient.chiefComplaint ?? ""
        let groups = specialtyEarlyFormGroups(hint: hint, cc: cc)
        if !groups.isEmpty {
            Section {
                ForEach(groups) { group in
                    VStack(alignment: .leading, spacing: 6) {
                        Label(group.question, systemImage: group.icon)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.secondary)
                        ChipFlow(hSpacing: 7, vSpacing: 7) {
                            ForEach(group.chips) { chip in
                                let isSelected = (socratesSelections[chip.dimId] ?? []).contains(chip.value)
                                Button {
                                    toggleSOCRATES(dimId: chip.dimId, chip: chip.value, multiSelect: chip.multiSelect)
                                } label: {
                                    Text(chip.label)
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
                    }
                    .padding(.vertical, 4)
                }
            } header: {
                Label("Quick Clinical Flags — \(hint)", systemImage: "staroflife.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AMColor.accent)
                    .textCase(nil)
            } footer: {
                Text("Chips feed the Bayesian scorer directly. Tap to select — findings also appear in SOCRATES.")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }


}
