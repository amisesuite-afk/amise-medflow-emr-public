// ConsultVisitTypeChip.swift
// The patient's visit type, beside the pathway pill in the consultation step bar. One tap opens a
// menu of every visit type; choosing one calls `onSelect` (ConsultationView.changeVisitType).

import SwiftUI

struct ConsultVisitTypeChip: View {
    let visitType: VisitType?
    /// Compact width (iPhone): icon only, to keep the step bar dense.
    var iconOnly: Bool = false
    let onSelect: (VisitType) -> Void

    private var color: Color { Color(hex: visitType?.accentHex ?? "#6B7280") }

    var body: some View {
        Menu {
            Picker("Visit type", selection: Binding<VisitType?>(
                get: { visitType },
                set: { if let vt = $0 { onSelect(vt) } }
            )) {
                ForEach(VisitType.allCases, id: \.self) { vt in
                    Label(vt.rawValue, systemImage: vt.icon).tag(Optional(vt))
                }
            }
        } label: {
            chipLabel
        }
        // Dense chip beside the scrolling steps: grows up to xxxLarge, then holds.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .accessibilityLabel("Visit type: \(visitType?.rawValue ?? "not set")")
        .accessibilityHint("Change the visit type")
        .accessibilityIdentifier("consult.visitType")
    }

    private var chipLabel: some View {
        HStack(spacing: 4) {
            Image(systemName: visitType?.icon ?? "tag")
            if !iconOnly {
                Text(visitType?.shortLabel ?? "Visit type")
                    .lineLimit(1)
            }
            Image(systemName: "chevron.down").scaledFont(size: 8, weight: .bold)
        }
        .scaledFont(size: 11, weight: .semibold)
        .foregroundStyle(color)
        .padding(.horizontal, 8).padding(.vertical, 5)
        .background(color.opacity(0.12), in: Capsule())
        .minimumTouchTarget()
    }
}
