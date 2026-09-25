// ClinicalScoresViewForms.swift
// Input form @ViewBuilder computed properties for every clinical score.
// Split from ClinicalScoresView.swift to keep the primary struct navigable.

import SwiftUI

extension ClinicalScoresView {

    func inputForm(for score: ActiveScore) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Button {
                    selectedScore = nil
                    result = nil
                } label: {
                    Label(showingAllScores ? "All Scores" : "Patient Scores", systemImage: "chevron.left")
                        .font(.subheadline)
                        .expandedHitArea(vertical: 12)
                }
                .accessibilityLabel(showingAllScores ? "Back to all scores" : "Back to patient scores")
                Spacer()
                Text(score.rawValue)
                    .font(.headline)
            }
            .padding(.bottom, 12)
            formBody(for: score)
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
    }

    @ViewBuilder private func formBody(for score: ActiveScore) -> some View {
        pendingVariablesPanel
        formBodyByCategory(score)
    }

    // Returns AnyView on purpose: the score.category dispatch used to fold ~100 form types into one
    // nested generic; instantiating it overflowed the main-thread stack (Swift demangler recursion).
    private func formBodyByCategory(_ score: ActiveScore) -> AnyView {
        switch score.category {
        case .all: return AnyView(EmptyView())
        case .acute: return acuteFormBody(score)
        case .gi: return giFormBody(score)
        case .vascular: return vascularFormBody(score)
        case .sepsis: return sepsisFormBody(score)
        case .preop: return preopFormBody(score)
        case .neuro: return neuroFormBody(score)
        case .cardiac: return cardiacFormBody(score)
        case .monitoring: return monitoringFormBody(score)
        }
    }

    // MARK: - Shared form helpers

    @ViewBuilder var pendingVariablesPanel: some View {
        if autoFill.hasPending {
            VStack(alignment: .leading, spacing: 8) {
                Label("Variables to confirm", systemImage: "checklist.unchecked")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.orange)
                ForEach(autoFill.pendingFields) { field in
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: "questionmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(.orange)
                            .padding(.top, 1)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(field.label)
                                .font(.caption)
                                .foregroundStyle(.primary)
                            Text(field.source)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        // Confirm button: sets toggle true + writes to PMH.
                        // MEWS/NEWS2 pending fields are vitals measurements — use Save to Vitals instead.
                        if selectedScore != .mews && selectedScore != .news2 {
                            Button {
                                confirmPendingField(field)
                            } label: {
                                Text("Yes")
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(.orange, in: Capsule())
                                    // 44 pt target without making the row taller.
                                    .expandedHitArea(horizontal: 6, vertical: 12)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Confirm \(field.label)")
                        }
                    }
                }
            }
            .padding(10)
            .background(.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(.orange.opacity(0.3), lineWidth: 1))
            .padding(.bottom, 8)
        }
    }

    func scoreToggle(_ label: String, binding: Binding<Bool>, points: String, autoKey: String? = nil) -> some View {
        let isAuto = autoKey.map { autoFill.isAuto($0) } ?? false
        return Toggle(isOn: binding) {
            HStack(spacing: 6) {
                Text(label)
                    .font(.subheadline)
                if isAuto {
                    HStack(spacing: 3) {
                        Image(systemName: "wand.and.stars")
                            .scaledFont(size: 9)
                        Text("Auto")
                            .scaledFont(size: 9, weight: .semibold)
                    }
                    .foregroundStyle(.teal)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(.teal.opacity(0.12), in: Capsule())
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Pre-filled from the record")
                }
                Spacer()
                Text(points)
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .foregroundStyle(binding.wrappedValue ? (isAuto ? .teal : AMColor.accent) : .secondary)
            }
        }
        .toggleStyle(.switch)
        .tint(isAuto ? .teal : AMColor.accent)
        .padding(.vertical, 2)
    }

    func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .textCase(.uppercase)
            .padding(.top, 8)
    }

}
