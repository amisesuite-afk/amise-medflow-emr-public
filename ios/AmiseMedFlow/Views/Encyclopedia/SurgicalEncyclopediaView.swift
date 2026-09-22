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
        .background(isSelected ? Color.teal.opacity(0.15) : Color(.secondarySystemGroupedBackground))
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

// MARK: - Condition Detail

struct ConditionDetailView: View {
    let condition: SurgicalCondition
    @State private var selectedTab: DetailTab = .overview

    enum DetailTab: String, CaseIterable, Identifiable {
        case overview   = "Overview"
        case algorithm  = "Algorithm"
        case procedures = "Procedures"
        case postop     = "Post-op"
        case followup   = "Follow-up"
        var id: String { rawValue }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                tabPicker
                    .padding(.horizontal)
                    .padding(.top, 12)
                Divider().padding(.top, 8)
                tabContent
                    .padding()
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(condition.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                UrgencyBadge(urgency: condition.urgency)
                Text(condition.icd10)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color(.systemFill))
                    .clipShape(Capsule())
                Text(condition.system.rawValue)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.secondary)
            }
            Text(condition.summary)
                .font(.system(size: 14))
                .foregroundStyle(.primary)

            if !condition.redFlags.isEmpty {
                RedFlagBanner(flags: condition.redFlags)
            }
        }
        .padding()
        .background(Color(.systemBackground))
    }

    private var tabPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 4) {
                ForEach(DetailTab.allCases) { tab in
                    let isSelected = selectedTab == tab
                    Button(tab.rawValue) { selectedTab = tab }
                        .font(.system(size: 13, weight: isSelected ? .semibold : .regular))
                        .foregroundStyle(isSelected ? .white : .secondary)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(isSelected ? Color.teal : Color.clear)
                        .clipShape(Capsule())
                        .animation(.easeInOut(duration: 0.15), value: selectedTab)
                }
            }
        }
    }

    @ViewBuilder
    private var tabContent: some View {
        switch selectedTab {
        case .overview:   OverviewTab(condition: condition)
        case .algorithm:  AlgorithmTab(condition: condition)
        case .procedures: ProceduresTab(condition: condition)
        case .postop:     PostOpTab(condition: condition)
        case .followup:   FollowUpTab(condition: condition)
        }
    }
}

// MARK: - Urgency Badge

private struct UrgencyBadge: View {
    let urgency: SurgicalUrgency
    var body: some View {
        Text(urgency.rawValue.uppercased())
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(badgeColor)
            .clipShape(Capsule())
    }
    private var badgeColor: Color {
        switch urgency {
        case .elective:  return .green
        case .urgent:    return .orange
        case .emergency: return .red
        case .immediate: return .purple
        }
    }
}

// MARK: - Red Flag Banner

private struct RedFlagBanner: View {
    let flags: [String]
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button {
                withAnimation(.easeInOut(duration: 0.15)) { expanded.toggle() }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                    Text("Red Flags (\(flags.count))")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.red)
                    Spacer()
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)

            if expanded {
                ForEach(flags, id: \.self) { flag in
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "minus")
                            .font(.system(size: 10))
                            .foregroundStyle(.red)
                            .padding(.top, 2)
                        Text(flag)
                            .font(.system(size: 13))
                            .foregroundStyle(.primary)
                    }
                }
            }
        }
        .padding(10)
        .background(.red.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - Overview Tab

private struct OverviewTab: View {
    let condition: SurgicalCondition
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            InvestigationsSection(investigations: condition.investigations)
            PearlsSection(pearls: condition.pearls)
        }
    }
}

private struct InvestigationsSection: View {
    let investigations: [SurgicalInvestigation]
    var body: some View {
        CardSection(title: "Investigations") {
            ForEach(investigations) { inv in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(inv.name)
                            .font(.system(size: 14, weight: .semibold))
                        Spacer()
                        UrgencyChip(label: inv.urgency)
                    }
                    Text(inv.rationale)
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                    if !inv.keyFindings.isEmpty {
                        VStack(alignment: .leading, spacing: 2) {
                            ForEach(inv.keyFindings, id: \.self) { finding in
                                HStack(alignment: .top, spacing: 6) {
                                    Image(systemName: "arrow.right")
                                        .font(.system(size: 10))
                                        .foregroundStyle(.teal)
                                        .padding(.top, 2)
                                    Text(finding)
                                        .font(.system(size: 12))
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .padding(.top, 2)
                    }
                }
                .padding(.vertical, 4)
                Divider()
            }
        }
    }
}

private struct PearlsSection: View {
    let pearls: [String]
    var body: some View {
        CardSection(title: "Clinical Pearls") {
            ForEach(pearls, id: \.self) { pearl in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "star.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(.yellow)
                        .padding(.top, 3)
                    Text(pearl)
                        .font(.system(size: 13))
                }
                .padding(.vertical, 2)
            }
        }
    }
}

// MARK: - Algorithm Tab

private struct AlgorithmTab: View {
    let condition: SurgicalCondition
    private var alg: SurgicalAlgorithm { condition.algorithm }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            CardSection(title: "Clinical Question") {
                Text(alg.clinicalQuestion)
                    .font(.system(size: 14, weight: .medium))
            }
            CardSection(title: "Urgency Assessment") {
                Text(alg.urgencyAssessment)
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
            }
            CardSection(title: "Operative Indications") {
                BulletList(items: alg.operativeIndications, color: .red)
            }
            CardSection(title: "Non-operative Indications") {
                BulletList(items: alg.nonOperativeIndications, color: .green)
            }
            if !alg.nonOperativeManagement.isEmpty {
                CardSection(title: "Non-operative Management") {
                    BulletList(items: alg.nonOperativeManagement, color: .blue)
                }
            }
            if !alg.pitfalls.isEmpty {
                CardSection(title: "Pitfalls") {
                    ForEach(alg.pitfalls, id: \.self) { pitfall in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .font(.system(size: 12))
                                .foregroundStyle(.orange)
                                .padding(.top, 2)
                            Text(pitfall)
                                .font(.system(size: 13))
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
            if !alg.keyScores.isEmpty {
                CardSection(title: "Key Scores") {
                    BulletList(items: alg.keyScores, color: .purple)
                }
            }
        }
    }
}

// MARK: - Procedures Tab

private struct ProceduresTab: View {
    let condition: SurgicalCondition

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(condition.algorithm.operativeOptions) { option in
                OperativeOptionCard(option: option)
            }
        }
    }
}

private struct OperativeOptionCard: View {
    let option: OperativeOption
    @State private var expanded = false

    var body: some View {
        CardSection(title: option.name) {
            HStack(spacing: 8) {
                ApproachBadge(approach: option.approach)
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.system(size: 11))
                    Text(option.operativeTime)
                        .font(.system(size: 12))
                }
                .foregroundStyle(.secondary)
                HStack(spacing: 4) {
                    Image(systemName: "bed.double")
                        .font(.system(size: 11))
                    Text(option.los)
                        .font(.system(size: 12))
                }
                .foregroundStyle(.secondary)
            }

            Text(option.indication)
                .font(.system(size: 13))
                .foregroundStyle(.secondary)
                .padding(.top, 2)

            Button {
                withAnimation(.easeInOut(duration: 0.15)) { expanded.toggle() }
            } label: {
                HStack {
                    Text(expanded ? "Hide steps" : "Key steps & complications")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.teal)
                    Spacer()
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11))
                        .foregroundStyle(.teal)
                }
            }
            .buttonStyle(.plain)
            .padding(.top, 4)

            if expanded {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Key Steps")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.secondary)
                    ForEach(Array(option.keySteps.enumerated()), id: \.offset) { idx, step in
                        HStack(alignment: .top, spacing: 8) {
                            Text("\(idx + 1).")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(.teal)
                                .frame(width: 20, alignment: .trailing)
                            Text(step)
                                .font(.system(size: 12))
                        }
                    }

                    Text("Complications")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .padding(.top, 4)
                    ForEach(option.complications) { comp in
                        HStack(alignment: .top, spacing: 6) {
                            VStack(alignment: .leading, spacing: 1) {
                                HStack {
                                    Text(comp.name)
                                        .font(.system(size: 12, weight: .medium))
                                    Text(comp.incidence)
                                        .font(.system(size: 11))
                                        .foregroundStyle(.secondary)
                                }
                                Text(comp.management)
                                    .font(.system(size: 11))
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    Text("Consent Points")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .padding(.top, 4)
                    BulletList(items: option.consentPoints, color: .orange)
                }
                .padding(.top, 6)
            }
        }
    }
}

private struct ApproachBadge: View {
    let approach: OperativeApproach
    var body: some View {
        Text(approach.rawValue)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(approachColor)
            .clipShape(Capsule())
    }
    private var approachColor: Color {
        switch approach {
        case .laparoscopic:   return .teal
        case .open:           return .indigo
        case .roboticAssist:  return .purple
        case .endoscopic:     return .cyan
        case .percutaneous:   return .orange
        case .hybrid:         return .mint
        }
    }
}

// MARK: - Post-op Tab

private struct PostOpTab: View {
    let condition: SurgicalCondition

    var body: some View {
        if let postOp = condition.postOp {
            VStack(alignment: .leading, spacing: 16) {
                if postOp.icu {
                    Label("ICU admission expected", systemImage: "exclamationmark.triangle.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.red)
                        .padding(8)
                        .background(.red.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                CardSection(title: "Post-operative Protocol") {
                    PostOpRow(label: "Diet", value: postOp.diet)
                    PostOpRow(label: "Mobilisation", value: postOp.mobilisation)
                    PostOpRow(label: "Analgesia", value: postOp.analgesia)
                    PostOpRow(label: "Drains", value: postOp.drains)
                    PostOpRow(label: "Antibiotics", value: postOp.antibiotics)
                    PostOpRow(label: "VTE Prophylaxis", value: postOp.thromboembolicProphylaxis)
                }
                if !postOp.specialInstructions.isEmpty {
                    CardSection(title: "Special Instructions") {
                        BulletList(items: postOp.specialInstructions, color: .teal)
                    }
                }
            }
        } else {
            Text("Post-operative protocol not available for this condition.")
                .foregroundStyle(.secondary)
                .font(.system(size: 14))
        }
    }
}

private struct PostOpRow: View {
    let label: String
    let value: String
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
                .frame(width: 100, alignment: .trailing)
            Text(value)
                .font(.system(size: 13))
            Spacer()
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Follow-up Tab

private struct FollowUpTab: View {
    let condition: SurgicalCondition
    private var fu: FollowUpProtocol { condition.followUp }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            CardSection(title: "Follow-up Schedule") {
                PostOpRow(label: "Wound check", value: fu.woundCheck)
                PostOpRow(label: "Clinic review", value: fu.clinicReview)
                PostOpRow(label: "Surveillance", value: fu.surveillance)
                PostOpRow(label: "Pathology", value: fu.pathologyReview)
            }
            if !fu.redFlagReturn.isEmpty {
                CardSection(title: "Red Flag Return") {
                    BulletList(items: fu.redFlagReturn, color: .red)
                }
            }
        }
    }
}

// MARK: - Shared Helpers

private struct CardSection<Content: View>: View {
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

private struct BulletList: View {
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

private struct UrgencyChip: View {
    let label: String
    var body: some View {
        Text(label)
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(chipColor)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(chipColor.opacity(0.12))
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
