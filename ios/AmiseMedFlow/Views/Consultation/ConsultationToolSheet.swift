// ConsultationToolSheet.swift
// Scores, Vitals and Prescriptions opened as a sheet over the current consultation step
// (UX review: reachable from inside the consultation on every pathway, iPhone and iPad).
// The consultation underneath keeps its step and its unsaved chip state; closing the sheet
// returns to exactly where the clinician was. Whose record it is stays on screen (M1).

import SwiftUI
import SwiftData

/// Toolbar menu: Scores · Vitals · Prescriptions.
struct ConsultationToolsMenu: View {
    let onSelect: (ConsultTool) -> Void

    var body: some View {
        Menu {
            ForEach(ConsultTool.allCases) { tool in
                Button { onSelect(tool) } label: {
                    Label(tool.title, systemImage: tool.systemImage)
                }
                .accessibilityIdentifier(tool.menuIdentifier)
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "wrench.and.screwdriver")
                Text("Tools")
                    .scaledFont(size: 13, weight: .semibold, relativeTo: .footnote)
            }
            .foregroundStyle(AMColor.accent)
            .minimumTouchTarget()
        }
        .accessibilityLabel("Tools: scores, vitals, prescriptions")
        .accessibilityHint("Opens over the current step")
        .accessibilityIdentifier("consult.tools")
    }
}

/// The sheet: patient identity + safety strip, then the tool itself, with Done.
struct ConsultationToolSheet: View {
    @Bindable var patient: Patient
    let tool: ConsultTool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                identity
                Divider()
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .accessibilityLabel("Done, back to the consultation")
                        .accessibilityIdentifier("consult.tools.done")
                }
            }
        }
    }

    private var identity: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: "person.crop.circle.fill")
                    .foregroundStyle(AMColor.accent)
                    .accessibilityHidden(true)
                Text(patient.consultationTitle)
                    .font(.subheadline.weight(.bold))
                    .lineLimit(1)
                if !patient.consultationSubtitle.isEmpty {
                    Text(patient.consultationSubtitle)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("consult.tools.patient")
            RecordSafetyStrip(patient: patient)
            Text(ConsultTool.keepsStepHint)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 16).padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background { Color(.secondarySystemBackground) }
    }

    @ViewBuilder
    private var content: some View {
        switch tool {
        case .scores:        ClinicalScoresView(patient: patient)
        case .vitals:        VitalsHistoryView(patient: patient).navigationTitle("Vitals")
        case .prescriptions: PrescriptionView(patient: patient)
        }
    }
}
