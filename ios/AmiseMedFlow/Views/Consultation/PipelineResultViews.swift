import SwiftUI

// MARK: - AutoAction Row

struct AutoActionRow: View {
    let action: AutoAction

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: functionIcon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(urgencyColor)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(action.title)
                        .font(.system(size: 13, weight: .semibold))
                    Spacer()
                    Text(action.function.rawValue.uppercased())
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(urgencyColor)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(urgencyColor.opacity(0.12), in: Capsule())
                }
                Text(action.detail)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 4)
    }

    private var functionIcon: String {
        switch action.function {
        case .ask:       return "questionmark.bubble"
        case .order:     return "cross.vial.fill"
        case .calculate: return "function"
        case .document:  return "doc.text"
        case .compare:   return "arrow.left.arrow.right"
        case .alert:     return "exclamationmark.triangle.fill"
        case .schedule:  return "calendar.badge.plus"
        case .prepare:   return "checkmark.shield"
        }
    }

    private var urgencyColor: Color {
        switch action.urgency {
        case .stat:    return .red
        case .urgent:  return .orange
        case .routine: return .blue
        }
    }
}

// MARK: - Disease Trajectory Row

struct TrajectoryRow: View {
    let trajectory: DiseaseTrajectory

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text(trajectory.diseaseName)
                    .font(.system(size: 13, weight: .semibold))
                Spacer()
                if let alert = trajectory.deteriorationAlert {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(alert.priority == .emergency ? .red : .orange)
                        .font(.system(size: 12))
                }
            }

            // Current state
            HStack(spacing: 6) {
                Text("Now:")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
                Text(trajectory.currentState.shortLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(stateColor(trajectory.currentState))
                Text("→")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                Text(trajectory.projectedState.shortLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(stateColor(trajectory.projectedState))
                Text("(12h)")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }

            // Belief bar
            BeliefBar(beliefs: trajectory.currentBelief, states: trajectory.states)

            // Deterioration alert
            if let alert = trajectory.deteriorationAlert {
                Text(alert.message)
                    .font(.system(size: 11))
                    .foregroundStyle(alert.priority == .emergency ? .red : .orange)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 4)
    }

    private func stateColor(_ state: DiseaseState) -> Color {
        switch state.urgency {
        case .emergency:  return .red
        case .urgent:     return .orange
        case .semiUrgent: return .yellow
        case .elective:   return .green
        }
    }
}

// MARK: - Belief bar (probability distribution over disease states)

struct BeliefBar: View {
    let beliefs: [Double]
    let states: [DiseaseState]

    var body: some View {
        GeometryReader { geo in
            HStack(spacing: 1) {
                ForEach(states.indices, id: \.self) { i in
                    let p = i < beliefs.count ? beliefs[i] : 0
                    RoundedRectangle(cornerRadius: 2)
                        .fill(segmentColor(state: states[i], probability: p))
                        .frame(width: geo.size.width * p)
                }
            }
        }
        .frame(height: 6)
        .clipShape(RoundedRectangle(cornerRadius: 3))
    }

    private func segmentColor(state: DiseaseState, probability: Double) -> Color {
        let base: Color = {
            switch state.urgency {
            case .emergency:  return .red
            case .urgent:     return .orange
            case .semiUrgent: return .yellow
            case .elective:   return .green
            }
        }()
        return base.opacity(0.4 + 0.6 * probability)
    }
}

// MARK: - Value of Information Row

struct VOIRow: View {
    let item: InformationItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // EVPI meter (0–2 bits visual)
            ZStack {
                Circle()
                    .stroke(Color(.systemFill), lineWidth: 3)
                Circle()
                    .trim(from: 0, to: min(item.evpi / 2.0, 1.0))
                    .stroke(evpiColor, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text(String(format: "%.1f", item.evpi))
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(evpiColor)
            }
            .frame(width: 28, height: 28)

            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(item.name)
                        .font(.system(size: 13, weight: .semibold))
                    Spacer()
                    Text(item.timeToResult)
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                }
                Text(item.clinicalNote)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                if !item.targetDiagnoses.isEmpty {
                    Text(item.targetDiagnoses.prefix(3).joined(separator: " · "))
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private var evpiColor: Color {
        if item.evpi >= 1.0 { return .red }
        if item.evpi >= 0.5 { return .orange }
        return .blue
    }
}
