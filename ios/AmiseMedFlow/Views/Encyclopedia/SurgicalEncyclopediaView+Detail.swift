// SurgicalEncyclopediaView+Detail.swift
// ConditionDetailView, OverviewTab, AlgorithmTab, ProceduresTab,
// PostOpTab, FollowupTab — detail sheet for a selected surgical condition.

import SwiftUI

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
                .contentShape(Rectangle())   // whole row tappable, not only its text
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
        .background { Color.red.opacity(0.06) }
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
