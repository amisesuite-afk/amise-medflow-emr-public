// ConsultationView+VisitType.swift
// Visit type chip in the step bar (ConsultVisitTypeChip) and the pathway suggestion it can raise.

import SwiftUI
import SwiftData

extension ConsultationView {

    /// The clinician chose a visit type from the step-bar chip. Saved like every patient edit;
    /// the pathway is not switched: when it no longer fits, a suggestion shows under the step bar.
    func changeVisitType(to vt: VisitType) {
        guard patient.isLive, patient.visitType != vt else { return }
        CrashReporting.breadcrumb("Changed visit type")
        AuditLog.record("update", "patient", patient: patient,
                        details: ["field": "visit_type", "to": vt.rawValue])
        patient.visitType = vt
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
        visitTypePathwaySuggestion = ConsultPathway.suggestion(afterChangingTo: vt,
                                                               current: pathway,
                                                               recommended: ConsultPathway.recommend(for: patient))
    }

    /// One tap on the suggestion: switch the step bar to that pathway. The visit type the clinician
    /// chose stays as it is. The current step stays open when the new pathway has it.
    func acceptPathwaySuggestion(_ p: ConsultPathway) {
        CrashReporting.breadcrumb("Accepted pathway suggestion: \(p.rawValue)")
        visitTypePathwaySuggestion = nil
        pathway = p
        if !p.steps.contains(activeTab) {
            withAnimation(.easeInOut(duration: 0.15)) { activeTab = p.steps.first ?? .hpi }
        }
    }

    @ViewBuilder
    var visitTypePathwaySuggestionBanner: some View {
        if let s = visitTypePathwaySuggestion, s.pathway != pathway {
            let accent = Color(hex: s.pathway.accentHex)
            HStack(spacing: 8) {
                Image(systemName: s.pathway.icon)
                    .foregroundStyle(accent)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Suggested pathway: \(s.pathway.title)")
                        .font(.caption.weight(.semibold))
                    Text((["Now: \(pathway.title)"] + s.reasons).joined(separator: " · "))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 4)
                Button("Switch") { acceptPathwaySuggestion(s.pathway) }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .tint(accent)
                    .accessibilityLabel("Switch to the \(s.pathway.title) pathway")
                    .accessibilityIdentifier("consult.visitType.suggestion.accept")
                Button {
                    visitTypePathwaySuggestion = nil
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .minimumTouchTarget()
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Keep the \(pathway.title) pathway")
                .accessibilityIdentifier("consult.visitType.suggestion.dismiss")
            }
            .padding(.leading, 12).padding(.trailing, 4).padding(.vertical, 4)
            .background(accent.opacity(0.08), in: Rectangle())
            .accessibilityElement(children: .contain)
        }
    }
}
