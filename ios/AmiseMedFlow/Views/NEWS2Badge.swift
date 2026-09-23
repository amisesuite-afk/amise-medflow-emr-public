// NEWS2Badge.swift
// NEWS2 score badge for dashboard rows.

import SwiftUI

// MARK: - NEWS2 badge

private struct NEWS2Badge: View {
    let score: Int
    let risk: String

    private var color: Color {
        switch risk {
        case "High":   return .red
        case "Medium": return .orange
        default:       return .green
        }
    }

    var body: some View {
        HStack(spacing: 3) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
            Text("N2:\(score)")
                .font(.caption2.monospacedDigit().weight(.semibold))
                .foregroundStyle(color)
        }
        .padding(.horizontal, 6).padding(.vertical, 3)
        .background(color.opacity(0.10), in: Capsule())
    }
}
