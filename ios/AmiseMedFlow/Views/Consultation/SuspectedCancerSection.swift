// SuspectedCancerSection.swift
// Diagnosis-tab card for the NICE NG12 suspected-cancer screen (SuspectedCancerScreening). Shown
// only when a 1.1.0 criterion is met (the ferritin check for a microcytic anaemia is in the "What's
// missing" row since 2026-09-26). The clinician can
// add the investigations as Suggested, add the referral line to the plan, or dismiss the card for
// this session; nothing is ordered or referred from here.

import SwiftUI

/// Card dismissals for this app session, keyed by patient and criterion set: a newly met
/// criterion shows the card again.
final class SuspectedCancerDismissals: ObservableObject {
    static let shared = SuspectedCancerDismissals()
    @Published private(set) var keys: Set<String> = []

    func key(_ patient: Patient, _ prompt: SuspectedCancerPrompt) -> String { "\(patient.syncCode)|\(prompt.key)" }
    func isDismissed(_ patient: Patient, _ prompt: SuspectedCancerPrompt) -> Bool { keys.contains(key(patient, prompt)) }
    func dismiss(_ patient: Patient, _ prompt: SuspectedCancerPrompt) { keys.insert(key(patient, prompt)) }
}

struct SuspectedCancerSection: View {
    @Bindable var patient: Patient
    @ObservedObject private var dismissals = SuspectedCancerDismissals.shared
    @State private var addedInvestigations = false
    @State private var addedPlan = false

    var body: some View {
        // The ferritin check (microcytic anaemia, no ferritin) is shown by the "What's missing" row
        // (WhatsMissingRow: what, why and "Add test" for Ferritin), so this card shows only the
        // suspected-cancer referral prompt.
        if let prompt = SuspectedCancerScreening.prompt(for: patient), prompt.kind == .suspectedCancer,
           !dismissals.isDismissed(patient, prompt) {
            Section {
                content(prompt)
            } header: {
                HStack(spacing: 6) {
                    Image(systemName: prompt.kind == .suspectedCancer ? "exclamationmark.triangle.fill" : "drop.fill")
                        .foregroundStyle(prompt.kind == .suspectedCancer ? Color.red : Color.orange)
                        .accessibilityHidden(true)
                    Text(prompt.kind == .suspectedCancer ? "Suspected cancer (NICE NG12)" : "Anaemia work-up")
                        .font(.caption.weight(.semibold))
                    Spacer()
                    Button {
                        dismissals.dismiss(patient, prompt)
                    } label: {
                        Image(systemName: "xmark").font(.caption)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.secondary)
                    .accessibilityLabel("Dismiss suspected-cancer prompt")
                }
            } footer: {
                Text("Deterministic rules (NICE NG12, BSG 2021) — a prompt, not a diagnosis. Nothing is ordered or referred until you do it.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func content(_ prompt: SuspectedCancerPrompt) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(prompt.title).font(.subheadline.weight(.semibold))
            Text(prompt.finding).font(.caption)
            Text(prompt.rationale).font(.caption2).foregroundStyle(.secondary)
            if !prompt.investigations.isEmpty {
                Text("Consider: " + prompt.investigations.joined(separator: " · "))
                    .font(.caption2)
            }
            HStack(spacing: 8) {
                if !prompt.investigations.isEmpty {
                    Button(addedInvestigations ? "In Ix list" : "Add to Ix") { addInvestigations(prompt) }
                        .disabled(addedInvestigations)
                        .accessibilityLabel("Add suggested investigations")
                }
                if !prompt.planLines.isEmpty {
                    Button(addedPlan ? "Added to plan" : "Add to plan") { addToPlan(prompt) }
                        .disabled(addedPlan)
                        .accessibilityLabel("Add referral line to the management plan")
                }
            }
            .font(.caption.weight(.semibold))
            .buttonStyle(.bordered)
        }
        .padding(.vertical, 2)
    }

    private func addInvestigations(_ prompt: SuspectedCancerPrompt) {
        var list = patient.investigations
        for name in prompt.investigations
        where !list.contains(where: { $0.name.caseInsensitiveCompare(name) == .orderedSame && $0.status != .cancelled }) {
            var entry = InvestigationEntry(name: name, category: category(for: name), status: .suggested)
            entry.suggestedFor = "NG12: \(prompt.title)"
            list.append(entry)
        }
        patient.investigations = list
        patient.updatedAt = .now
        patient.pendingSync = true
        addedInvestigations = true
    }

    private func addToPlan(_ prompt: SuspectedCancerPrompt) {
        let block = prompt.planLines.joined(separator: "\n")
        let existing = patient.managementPlan ?? ""
        guard !existing.contains(prompt.planLines[0]) else { addedPlan = true; return }
        patient.managementPlan = existing.isEmpty ? block : existing + "\n" + block
        patient.updatedAt = .now
        patient.pendingSync = true
        addedPlan = true
    }

    private func category(for name: String) -> InvestigationEntry.InvCategory {
        let n = name.lowercased()
        if n.contains("microdochectomy") { return .other }
        if ["colonoscopy", "ogd", "cystoscopy"].contains(where: { n.contains($0) }) { return .endoscopy }
        if ["mammogram", "ultrasound", "ct ", "ductogram", "mri"].contains(where: { n.contains($0) }) { return .imaging }
        if n.contains("urinalysis") || n.contains("culture") { return .pathology }
        return .blood
    }
}
