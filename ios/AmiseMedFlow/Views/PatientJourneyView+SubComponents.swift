// PatientJourneyView+SubComponents.swift
// FilterChip and other sub-views used by PatientJourneyView.

import SwiftUI
import SwiftData


// MARK: - Sub-components

struct FilterChip: View {
    let label: String
    var count: Int? = nil
    var color: Color = AMColor.accent
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(label)
                    .font(.caption.weight(.medium))
                if let count {
                    Text("\(count)")
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background {
                            Capsule().fill(isSelected ? Color.white.opacity(0.3) : color.opacity(0.15))
                        }
                }
            }
            .foregroundStyle(isSelected ? .white : color)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background {
                Capsule().fill(isSelected ? color : color.opacity(0.1))
            }
        }
        .buttonStyle(.plain)
    }
}

struct StatTile: View {
    let value: Int
    let label: String

    var body: some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(.headline.monospacedDigit())
                .foregroundStyle(AMColor.ink)
            Text(label)
                .font(.caption2)
                .foregroundStyle(AMColor.muted)
        }
        .frame(maxWidth: .infinity)
    }
}

struct TimelineEventRow: View {
    let event: JourneyEvent
    let isFirst: Bool
    let isLast: Bool
    let isExpanded: Bool
    let onTap: () -> Void

    private let df: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_LC")
        f.timeZone = .ect
        f.dateFormat = "dd MMM yyyy  HH:mm"
        return f
    }()

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            // Timeline spine
            VStack(spacing: 0) {
                // Line above dot
                Rectangle()
                    .fill(isFirst ? Color.clear : AMColor.line)
                    .frame(width: 1.5)
                    .frame(height: 14)

                // Category dot
                Circle()
                    .fill(event.category.color)
                    .frame(width: 10, height: 10)
                    .overlay { Circle().stroke(Color(.systemBackground), lineWidth: 2) }

                // Line below dot (extending to bottom of card)
                Rectangle()
                    .fill(isLast ? Color.clear : AMColor.line)
                    .frame(width: 1.5)
                    .frame(maxHeight: .infinity)
            }
            .frame(width: 24)
            .padding(.top, 2)

            // Card content
            Button(action: onTap) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .top, spacing: 10) {
                        // Icon
                        Image(systemName: event.icon)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(event.category.color)
                            .frame(width: 24, height: 24)
                            .background {
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(event.category.color.opacity(0.1))
                            }

                        VStack(alignment: .leading, spacing: 3) {
                            // Title + timestamp
                            HStack(alignment: .firstTextBaseline) {
                                Text(event.title)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(AMColor.ink)
                                    .lineLimit(isExpanded ? nil : 1)
                                Spacer(minLength: 8)
                                Text(df.string(from: event.date))
                                    .font(.caption2.monospacedDigit())
                                    .foregroundStyle(AMColor.muted)
                            }

                            // Subtitle
                            if !event.subtitle.isEmpty {
                                Text(event.subtitle)
                                    .font(.caption)
                                    .foregroundStyle(AMColor.muted)
                                    .lineLimit(isExpanded ? nil : 2)
                                    .fixedSize(horizontal: false, vertical: isExpanded)
                            }

                            // Category badge
                            if isExpanded {
                                Text(event.category.label.uppercased())
                                    .font(.system(size: 9, weight: .bold))
                                    .tracking(1)
                                    .foregroundStyle(event.category.color)
                                    .padding(.top, 4)
                            }
                        }
                    }
                    .padding(12)
                }
                .background {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color(.systemBackground))
                        .shadow(color: .black.opacity(0.04), radius: 2, y: 1)
                }
            }
            .buttonStyle(.plain)
            .padding(.leading, 10)
            .padding(.bottom, isLast ? 0 : 6)
        }
    }
}
