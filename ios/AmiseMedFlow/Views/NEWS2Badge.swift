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

    private var accessibilityText: String {
        incomplete
            ? "NEWS2 \(score), \(risk), incomplete: some observations not recorded"
            : "NEWS2 \(score), \(risk)"
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
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text(accessibilityText))
    }
}
