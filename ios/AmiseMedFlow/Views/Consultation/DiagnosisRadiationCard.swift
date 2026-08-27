import SwiftUI

// MARK: - Diagnosis Radiation Card
// Displayed in the Plan tab when a working diagnosis is confirmed.
// All suggestions require explicit clinician action — nothing is auto-applied.

struct DiagnosisRadiationCard: View {
    let radiation: DiagnosisRadiation
    let onAddInvestigation: (DiagnosisRadiation.SuggestedInvestigation) -> Void
    let onUsePlan: (String) -> Void
    let onDismiss: () -> Void

    @State private var expanded = true
    @State private var addedNames: Set<String> = []

    var body: some View {
        Section {
            VStack(alignment: .leading, spacing: 0) {
                header
                if expanded {
                    Divider()
                    content
                }
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 10) {
            Image(systemName: "wand.and.stars")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.teal)
            VStack(alignment: .leading, spacing: 1) {
                Text("Diagnosis Radiation")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.teal)
                Text(radiation.conditionName)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() }
            } label: {
                Image(systemName: expanded ? "chevron.up" : "chevron.down")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            Button {
                onDismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary.opacity(0.6))
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 8)
    }

    // MARK: - Content

    private var content: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Urgency / red flags
            if let urgency = radiation.urgencyNote {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange).font(.caption)
                    Text(urgency)
                        .font(.caption).foregroundStyle(.orange)
                }
            }
            if !radiation.redFlags.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Red flags", systemImage: "flag.fill")
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(.red)
                    ForEach(radiation.redFlags, id: \.self) { flag in
                        HStack(alignment: .top, spacing: 6) {
                            Circle().fill(Color.red).frame(width: 4, height: 4).padding(.top, 4)
                            Text(flag).font(.caption).foregroundStyle(.red.opacity(0.85))
                        }
                    }
                }
            }

            // Suggested investigations
            if !radiation.investigations.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Label("Suggested Investigations", systemImage: "testtube.2")
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(.indigo)
                    ForEach(radiation.investigations, id: \.name) { inv in
                        HStack(spacing: 8) {
                            Image(systemName: inv.category.icon)
                                .font(.system(size: 10)).foregroundStyle(.secondary)
                                .frame(width: 14)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(inv.name).font(.system(size: 12, weight: .medium))
                                Text(inv.rationale).font(.system(size: 10)).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if addedNames.contains(inv.name) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 16))
                                    .foregroundStyle(.green)
                            } else {
                                Button("Add") {
                                    addedNames.insert(inv.name)
                                    onAddInvestigation(inv)
                                }
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(.teal)
                            }
                        }
                    }
                }
            }

            // Plan template
            if !radiation.planTemplate.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Label("Suggested Plan", systemImage: "doc.plaintext")
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(.purple)
                    Text(radiation.planTemplate)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .lineLimit(6)
                    Button {
                        onUsePlan(radiation.planTemplate)
                    } label: {
                        Label("Use as Plan", systemImage: "arrow.down.doc.fill")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.purple)
                    .controlSize(.small)
                }
            }

            // Billing / ICD codes
            if !radiation.billingCodes.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Billing Codes", systemImage: "creditcard.fill")
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(.green)
                    ForEach(radiation.billingCodes, id: \.icd10) { code in
                        HStack(spacing: 8) {
                            Text(code.icd10)
                                .font(.system(size: 10, weight: .semibold).monospaced())
                                .foregroundStyle(.green)
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .background(Color.green.opacity(0.1), in: RoundedRectangle(cornerRadius: 4))
                            VStack(alignment: .leading, spacing: 1) {
                                Text(code.icdDescription).font(.system(size: 11))
                                if let cpt = code.cpt, let cptDesc = code.cptDescription {
                                    Text("CPT \(cpt) · \(cptDesc)")
                                        .font(.system(size: 10)).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }

            // Follow-up note
            if !radiation.followUp.isEmpty {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "calendar.badge.clock")
                        .font(.caption).foregroundStyle(.blue)
                    Text(radiation.followUp)
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 8)
    }
}
