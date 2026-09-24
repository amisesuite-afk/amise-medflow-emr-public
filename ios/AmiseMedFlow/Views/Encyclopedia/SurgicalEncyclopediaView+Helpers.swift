// SurgicalEncyclopediaView+Helpers.swift
// CardSection view helper and SurgicalCondition Equatable+Hashable conformance.

import SwiftUI

// MARK: - Shared Helpers

struct CardSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.5)
            VStack(alignment: .leading, spacing: 4) {
                content()
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

struct BulletList: View {
    let items: [String]
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "circle.fill")
                        .font(.system(size: 5))
                        .foregroundStyle(color)
                        .padding(.top, 5)
                    Text(item)
                        .font(.system(size: 13))
                }
            }
        }
    }
}

struct UrgencyChip: View {
    let label: String
    var body: some View {
        Text(label)
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(chipColor)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background { chipColor.opacity(0.12) }
            .clipShape(Capsule())
    }
    private var chipColor: Color {
        switch label.lowercased() {
        case "stat": return .red
        case "urgent": return .orange
        default: return .secondary
        }
    }
}

// MARK: - SurgicalCondition: Equatable + Hashable for tag/selection

extension SurgicalCondition: Equatable, Hashable {
    static func == (lhs: SurgicalCondition, rhs: SurgicalCondition) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
