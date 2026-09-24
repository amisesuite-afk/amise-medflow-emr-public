// SurgicalEncyclopediaView+Detail2.swift
// ProceduresTab, PostOpTab, FollowupTab, and sub-view components for
// the surgical condition detail sheet.

import SwiftUI

// MARK: - Procedures Tab

struct ProceduresTab: View {
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

struct PostOpTab: View {
    let condition: SurgicalCondition

    var body: some View {
        if let postOp = condition.postOp {
            VStack(alignment: .leading, spacing: 16) {
                if postOp.icu {
                    Label("ICU admission expected", systemImage: "exclamationmark.triangle.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.red)
                        .padding(8)
                        .background { Color.red.opacity(0.08) }
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

struct FollowUpTab: View {
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
