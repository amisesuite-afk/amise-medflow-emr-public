// NEWS2Badge.swift
// NEWS2 score badge for dashboard rows.

import SwiftUI

// MARK: - NEWS2 badge

struct NEWS2Badge: View {
    let score: Int
    let risk: String
    /// True when one or more NEWS2 parameters were not recorded (missing ones count as 0).
    var incomplete: Bool = false

    private var color: Color {
        switch risk {
        case "High":                 return .red
        case "Medium", "Low-medium": return .orange
        default:                     return .green
        }
    }

    private var label: String {
        incomplete ? "N2:\(score) partial" : "N2:\(score)"
    }

    /// "NEWS2 7, high risk" (A11yLabel.news2): the risk band is otherwise shown only by colour.
    private var accessibilityText: String {
        A11yLabel.news2(score: score, risk: risk, incomplete: incomplete)
    }

    var body: some View {
        HStack(spacing: 3) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
            Text(label)
                .font(.caption2.monospacedDigit().weight(.semibold))
                .foregroundStyle(color)
        }
        .padding(.horizontal, 6).padding(.vertical, 3)
        .background(color.opacity(0.10), in: Capsule())
        // Dense badge inside list rows: grows with text size up to xxxLarge, then holds.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(accessibilityText))
    }
}
