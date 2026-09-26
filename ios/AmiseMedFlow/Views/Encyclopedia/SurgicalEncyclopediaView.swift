import SwiftUI

// MARK: - Root View

struct SurgicalEncyclopediaView: View {
    var preselectedDiagnosis: String? = nil

    @State private var searchText = ""
    @State private var selectedSystem: SurgicalSystem? = nil
    @State private var selectedCondition: SurgicalCondition? = nil

    private let engine = SurgicalAlgorithmEngine.shared

    private var displayedConditions: [SurgicalCondition] {
        var results: [SurgicalCondition]
        if !searchText.isEmpty {
            results = engine.search(searchText)
        } else if let sys = selectedSystem {
            results = engine.conditions(for: sys)
        } else {
            results = SurgicalVademecum.allConditions.sorted {
                $0.urgency.sortOrder < $1.urgency.sortOrder
            }
        }
        return results
    }

    var body: some View {
        NavigationSplitView {
            sidebar
        } detail: {
            if let condition = selectedCondition {
                ConditionDetailView(condition: condition)
            } else {
                emptyDetail
            }
        }
        .onAppear {
            if let dx = preselectedDiagnosis {
                selectedCondition = engine.lookup(diagnosisName: dx)
            }
        }
    }

    // MARK: Sidebar

    private var sidebar: some View {
        List(selection: $selectedCondition) {
            systemGrid
            if !searchText.isEmpty || selectedSystem != nil {
                conditionRows
            } else {
                allConditionRows
            }
        }
        .listStyle(.sidebar)
        .searchable(text: $searchText, prompt: "Search conditions, procedures…")
        .navigationTitle("Surgical Encyclopedia")
        .toolbar {
            if selectedSystem != nil {
                ToolbarItem(placement: .cancellationAction) {
                    Button("All") { selectedSystem = nil }
                }
            }
        }
    }

    private var systemGrid: some View {
        Section("Systems") {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 80))], spacing: 8) {
                ForEach(SurgicalSystem.allCases) { system in
                    SystemChip(system: system, isSelected: selectedSystem == system)
                        .onTapGesture {
                            selectedSystem = selectedSystem == system ? nil : system
                            searchText = ""
                        }
                }
            }
            .padding(.vertical, 4)
        }
    }

    private var conditionRows: some View {
        Section(selectedSystem?.rawValue ?? "Results") {
            ForEach(displayedConditions) { condition in
                ConditionRow(condition: condition)
                    .tag(condition)
            }
        }
    }

    private var allConditionRows: some View {
        ForEach(SurgicalUrgency.allCases, id: \.self) { urgency in
            let items = engine.conditions(urgency: urgency)
            if !items.isEmpty {
                Section(urgency.rawValue) {
                    ForEach(items) { condition in
                        ConditionRow(condition: condition)
                            .tag(condition)
                    }
                }
            }
        }
    }

    private var emptyDetail: some View {
        VStack(spacing: 12) {
            Image(systemName: "cross.case")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("Select a condition")
                .font(.title3)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
    }
}

// MARK: - System Chip

private struct SystemChip: View {
    let system: SurgicalSystem
    let isSelected: Bool

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: system.icon)
                .font(.system(size: 18))
            Text(system.rawValue)
                .font(.system(size: 9, weight: .medium))
                .multilineTextAlignment(.center)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background { isSelected ? Color.teal.opacity(0.15) : Color(.secondarySystemGroupedBackground) }
        .foregroundStyle(isSelected ? .teal : .secondary)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(isSelected ? Color.teal : Color.clear, lineWidth: 1.5)
        )
    }
}

// MARK: - Condition Row

private struct ConditionRow: View {
    let condition: SurgicalCondition

    var body: some View {
        HStack(spacing: 10) {
            UrgencyDot(urgency: condition.urgency)
            VStack(alignment: .leading, spacing: 2) {
                Text(condition.name)
                    .font(.system(size: 14, weight: .medium))
                HStack(spacing: 6) {
                    Text(condition.icd10)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.secondary)
                    Text("·")
                        .foregroundStyle(.tertiary)
                    Text(condition.system.rawValue)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}

private struct UrgencyDot: View {
    let urgency: SurgicalUrgency
    var body: some View {
        Circle()
            .fill(urgencyColor)
            .frame(width: 8, height: 8)
    }
    private var urgencyColor: Color {
        switch urgency {
        case .elective:  return .green
        case .urgent:    return .orange
        case .emergency: return .red
        case .immediate: return .purple
        }
    }
}
