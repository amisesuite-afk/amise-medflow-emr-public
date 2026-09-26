// DrugInteractionNoteViews.swift
// Shared pieces for every place that shows DrugInteractionService results (hazard log H-07).
// Display only: nothing here blocks, edits or acts on a prescription.

import SwiftUI

/// Other rules that hit the same pair of medications, listed under the headline alert.
struct InteractionRelatedEffects: View {
    let related: [DrugInteraction]

    var body: some View {
        if !related.isEmpty {
            VStack(alignment: .leading, spacing: 3) {
                ForEach(related) { rule in
                    HStack(alignment: .top, spacing: 4) {
                        Image(systemName: rule.severity.icon)
                            .font(.caption2)
                            .foregroundStyle(rule.severity.color)
                            .accessibilityHidden(true)   // the line says the severity
                        Text(Self.line(for: rule))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
    }

    static func line(for rule: DrugInteraction) -> String {
        "Also (\(rule.severity.rawValue.lowercased())): \(rule.clinicalEffect) — \(rule.management)"
    }
}

/// "Absence of an alert does not mean there is no interaction." Shown with every set of
/// interaction results, and on its own when a checked list raised no alert.
struct InteractionAbsenceNote: View {
    var noneFound: Bool = false

    private var message: String {
        noneFound
            ? "No interaction found. " + DrugInteractionService.absenceNote
            : DrugInteractionService.absenceNote
    }

    var body: some View {
        HStack(alignment: .top, spacing: 4) {
            Image(systemName: "info.circle")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            Text(message)
                .font(.caption2)
                .italic()
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Spoken text for one interaction alert: severity first (on screen it can be only the icon's
/// shape and colour), then the drug pair, effect, management and the related rules.
enum InteractionAccessibility {
    static func label(for alert: DrugInteractionAlert, includeManagement: Bool) -> String {
        var parts: [String?] = [
            "\(alert.interaction.severity.rawValue) interaction",
            alert.pairDisplay,
            alert.interaction.clinicalEffect,
        ]
        if includeManagement { parts.append(alert.interaction.management) }
        parts.append(contentsOf: alert.related.map { InteractionRelatedEffects.line(for: $0) })
        return A11yLabel.joined(parts)
    }
}
