// WellnessScreeningView.swift
// Wellness / check-up pathway: risk parameters → age/sex/risk-based screening list.
// Items are suggestions. "Add to Ix" puts a test on the Investigations list as Suggested,
// and the clinician orders it from there.

import SwiftUI
import SwiftData

struct WellnessScreeningView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context
    @State private var data = WellnessScreening()
    @State private var loaded = false
    @State private var planAdded = false
    @State private var openScore: ActiveScore? = nil

    private var age: Int? { patient.dateOfBirth == nil ? nil : patient.ageYears }
    private var items: [ScreeningItem] {
        ScreeningEngine.items(age: age, sex: patient.sex, bmi: patient.latestBMI(), w: data)
    }

    var body: some View {
        Form {
            riskSection
            dueSection
            planSection
        }
        .onAppear(perform: load)
        .sheet(item: $openScore) { score in
            NavigationStack {
                ClinicalScoresView(patient: patient, initialScore: score)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) { Button("Done") { openScore = nil } }
                    }
            }
        }
    }

    /// Screening items that are completed with a score in Clinical Scores.
    private func linkedScore(_ item: ScreeningItem) -> ActiveScore? {
        switch item.id {
        case "audit": return .auditC
        case "phq":   return .phq9
        default:      return nil
        }
    }

    // MARK: - Risk parameters

    private var riskSection: some View {
        Section {
            HStack {
                Text("Patient")
                Spacer()
                Text([age.map { "\($0) y" } ?? "No DOB", patient.sex.rawValue,
                      patient.latestBMI().map { String(format: "BMI %.1f", $0) } ?? "No BMI"]
                        .joined(separator: " · "))
                    .foregroundStyle(.secondary)
            }
            Picker("Smoking", selection: binding(\.smoking)) {
                ForEach(WellnessScreening.Smoking.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            if data.smoking != .never {
                Stepper(String(format: "Pack-years: %.0f", data.packYears),
                        value: binding(\.packYears), in: 0...150, step: 1)
            }
            if data.smoking == .former {
                Stepper("Quit \(data.yearsSinceQuit) years ago", value: binding(\.yearsSinceQuit), in: 0...70)
            }
            Toggle("Hypertension", isOn: binding(\.hypertension))
            Toggle("Family history: diabetes", isOn: binding(\.familyHxDiabetes))
            Toggle("Family history: bowel cancer (1st degree)", isOn: binding(\.familyHxColorectal))
            Toggle("Previous colon polyps", isOn: binding(\.priorPolyps))
            if patient.sex == .female {
                Toggle("Family history: breast / ovarian cancer", isOn: binding(\.familyHxBreastOvarian))
            }
            if patient.sex == .male {
                Toggle("Family history: prostate cancer", isOn: binding(\.familyHxProstate))
                Toggle("African-Caribbean descent", isOn: binding(\.africanCaribbean))
            }
        } header: {
            Text("Risk parameters")
        } footer: {
            if patient.sex == .unspecified {
                Text("Sex not recorded — sex-specific screening is not shown.")
            }
        }
    }

    // MARK: - Screening list

    private var dueSection: some View {
        Section {
            ForEach(items) { item in
                row(item)
            }
        } header: {
            Text("Screening & prevention (\(items.count))")
        } footer: {
            Text("Based on USPSTF recommendations adapted to common Caribbean practice. Adjust to local guidelines and individual risk. Suggestions only — nothing is ordered until you order it in Investigations.")
        }
    }

    private func row(_ item: ScreeningItem) -> some View {
        let status = data.statuses[item.id]
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                if item.highRisk {
                    Image(systemName: "exclamationmark.triangle.fill").font(.caption).foregroundStyle(.orange)
                }
                Text(item.title).font(.subheadline.weight(.semibold))
                Spacer()
                if let status {
                    Text(status.rawValue)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(status == .declined ? Color.secondary : AMColor.accent)
                }
            }
            Text(item.detail).font(.caption).foregroundStyle(.secondary)
            HStack(spacing: 8) {
                if let ix = item.ixName {
                    chip(status == .suggested ? "In Ix list" : "Add to Ix", active: status == .suggested) {
                        addInvestigation(ix, category: item.ixCategory, for: item)
                    }
                }
                if let score = linkedScore(item) {
                    chip("Open score", active: false) { openScore = score }
                }
                chip("Up to date", active: status == .upToDate) { toggle(item, .upToDate) }
                chip("Declined", active: status == .declined) { toggle(item, .declined) }
            }
        }
        .padding(.vertical, 2)
    }

    private func chip(_ title: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .padding(.horizontal, 8).padding(.vertical, 4)
                .foregroundStyle(active ? .white : AMColor.accent)
                .background(active ? AMColor.accent : AMColor.accent.opacity(0.1), in: Capsule())
        }
        .buttonStyle(.borderless)
    }

    // MARK: - Plan

    private var planSection: some View {
        Section {
            Button {
                appendPlan()
            } label: {
                Label(planAdded ? "Added to management plan" : "Add screening plan to management plan",
                      systemImage: planAdded ? "checkmark.circle.fill" : "text.badge.plus")
            }
        }
    }

    // MARK: - Actions

    private func toggle(_ item: ScreeningItem, _ s: WellnessScreening.Status) {
        data.statuses[item.id] = data.statuses[item.id] == s ? nil : s
        save()
    }

    private func addInvestigation(_ name: String, category: InvestigationEntry.InvCategory, for item: ScreeningItem) {
        var list = patient.investigations
        if !list.contains(where: { $0.name.caseInsensitiveCompare(name) == .orderedSame && $0.status != .cancelled }) {
            var entry = InvestigationEntry(name: name, category: category, status: .suggested)
            entry.suggestedFor = "Screening: \(item.title)"
            list.append(entry)
            patient.investigations = list
            patient.updatedAt = .now
            patient.pendingSync = true
        }
        data.statuses[item.id] = .suggested
        save()
    }

    private func appendPlan() {
        let lines = items.compactMap { item -> String? in
            switch data.statuses[item.id] {
            case .upToDate: return nil
            case .declined: return "• \(item.title): declined after discussion"
            case .suggested: return "• \(item.title): arranged"
            case nil: return "• \(item.title): \(item.detail)"
            }
        }
        guard !lines.isEmpty else { planAdded = true; return }
        let block = "Screening & prevention (\(Date.now.formatted(date: .abbreviated, time: .omitted))):\n"
            + lines.joined(separator: "\n")
        let existing = patient.managementPlan ?? ""
        patient.managementPlan = existing.isEmpty ? block : existing + "\n\n" + block
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
        planAdded = true
    }

    private func binding<T>(_ keyPath: WritableKeyPath<WellnessScreening, T>) -> Binding<T> {
        Binding(get: { data[keyPath: keyPath] },
                set: { data[keyPath: keyPath] = $0; save() })
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        data = patient.pathwayData.wellness
        // Seed from the record where it is unambiguous (only when still at defaults).
        let social = (patient.socialHistory ?? "").lowercased()
        if data.smoking == .never {
            if social.contains("ex-smok") || social.contains("former smok") { data.smoking = .former }
            else if social.contains("smok") && !social.contains("non-smok") && !social.contains("never smok") { data.smoking = .current }
        }
        let pmh = (patient.pmhEntries.map(\.condition) + [patient.pmhNotes ?? ""]).joined(separator: " ").lowercased()
        if !data.hypertension && pmh.contains("hypertens") { data.hypertension = true }
    }

    private func save() {
        var all = patient.pathwayData
        all.wellness = data
        patient.pathwayData = all
    }
}
