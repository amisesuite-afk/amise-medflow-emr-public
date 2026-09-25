// AddPrescriptionSheet.swift
// Modal sheet for adding a new prescription to a patient record.

import SwiftUI
import SwiftData


// MARK: - Add Prescription Sheet

struct AddPrescriptionSheet: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var drugQuery = ""
    @State private var drugSuggestions: [SurgicalDrug] = []
    @State private var selectedDrug: SurgicalDrug?
    @State private var dose = ""
    @State private var route = "Oral"
    @State private var frequency = ""
    @State private var duration = ""
    @State private var indication = ""
    @State private var instructions = ""

    private let freqChips   = ["OD", "BD", "TDS", "QDS", "PRN", "STAT", "Nocte", "Weekly"]
    private let durationChips = ["3 days", "5 days", "7 days", "10 days", "14 days", "1 month", "Ongoing"]

    private var liveInteractions: [DrugInteractionAlert] {
        guard !drugQuery.isEmpty else { return [] }
        let existingDrugs = patient.prescriptions.map { $0.drug }
        return DrugInteractionService.check(drugs: existingDrugs + [drugQuery])
            .filter { $0.drugA == drugQuery || $0.drugB == drugQuery }
    }

    /// True once the typed drug has been screened against at least one existing prescription.
    private var liveInteractionCheckRan: Bool {
        drugQuery.trimmingCharacters(in: .whitespaces).count >= 3 && !patient.prescriptions.isEmpty
    }

    private var allergyMatches: [AllergyEntry] {
        guard drugQuery.count >= 3 else { return [] }
        let q = drugQuery.lowercased()
        return patient.allergies.filter { entry in
            let n = entry.name.lowercased()
            return n.contains(q) || q.contains(n)
        }
    }

    @ViewBuilder
    private func quickChips(_ values: [String], current: String, onTap: @escaping (String) -> Void) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(values, id: \.self) { v in
                    let sel = v == current
                    Button { onTap(v) } label: {
                        Text(v)
                            .font(.caption2.weight(sel ? .semibold : .regular))
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(sel ? AMColor.accent : AMColor.accentLt, in: Capsule())
                            .foregroundStyle(sel ? Color.white : AMColor.accent)
                            // 44 pt tall hit area; the capsule keeps its size.
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(sel ? .isSelected : [])
                }
            }
        }
        // The 44 pt chip targets reach into the row's own vertical inset, so the row keeps
        // its height (the chips used to add 2 pt of padding here).
        .padding(.vertical, -8)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Drug") {
                    VStack(alignment: .leading, spacing: 0) {
                        HStack {
                            Image(systemName: "pills").foregroundStyle(.secondary)
                                .accessibilityHidden(true)
                            TextField("Search drug name", text: $drugQuery)
                                .autocorrectionDisabled()
                                .accessibilityIdentifier("rx.drugSearch")
                                .onChange(of: drugQuery) { _, q in
                                    drugSuggestions = q.count >= 2 ? ClinicalSearchService.searchDrugs(q) : []
                                    selectedDrug = nil
                                }
                        }

                        if !drugSuggestions.isEmpty {
                            Divider().padding(.top, 6)
                            ForEach(drugSuggestions.prefix(5)) { drug in
                                Button {
                                    drugQuery = drug.name
                                    selectedDrug = drug
                                    if dose.isEmpty && !drug.commonDoses.isEmpty { dose = drug.commonDoses }
                                    route = drug.route
                                    drugSuggestions = []
                                    if indication.isEmpty { indication = patient.workingDiagnosis ?? "" }
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(drug.name).font(.subheadline).foregroundStyle(.primary)
                                            Text(drug.category).font(.caption).foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        if !drug.commonDoses.isEmpty {
                                            Text(drug.commonDoses).font(.caption2).foregroundStyle(.tertiary)
                                        }
                                    }
                                }
                                .padding(.vertical, 4)
                                .accessibilityIdentifier("rx.drugSuggestion")
                                Divider()
                            }
                        }

                        if drugSuggestions.isEmpty && drugQuery.count >= 2 && selectedDrug == nil {
                            Divider().padding(.top, 6)
                            Button {
                                CustomDrugStore.shared.add(drugQuery.trimmingCharacters(in: .whitespaces))
                                drugSuggestions = ClinicalSearchService.searchDrugs(drugQuery)
                            } label: {
                                Label("Save \"\(drugQuery)\" to My Drug List", systemImage: "plus.circle")
                                    .font(.caption)
                                    .foregroundStyle(AMColor.accent)
                            }
                            .buttonStyle(.plain)
                            .padding(.vertical, 4)
                        }
                    }

                    if let drug = selectedDrug, !drug.commonDoses.isEmpty {
                        Button(drug.commonDoses) { dose = drug.commonDoses }
                            .font(.caption)
                            .buttonStyle(.bordered)
                            .tint(dose == drug.commonDoses ? .teal : .secondary)
                    }

                    if let drug = selectedDrug, !drug.sideEffects.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Label("Common side effects", systemImage: "exclamationmark.circle")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.orange)
                            Text(drug.sideEffects)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(.vertical, 4)
                    }
                }

                if !allergyMatches.isEmpty {
                    Section {
                        ForEach(allergyMatches) { entry in
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: "exclamationmark.shield.fill")
                                    .foregroundStyle(.red)
                                    .scaledFont(size: 14)
                                    .accessibilityHidden(true)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("ALLERGY: \(entry.name)")
                                        .font(.subheadline.weight(.bold))
                                        .foregroundStyle(.red)
                                    Text("\(entry.reaction) — \(entry.severity)")
                                        .font(.caption)
                                        .foregroundStyle(.red.opacity(0.8))
                                }
                            }
                            .padding(.vertical, 2)
                            .accessibilityElement(children: .combine)
                        }
                    } header: {
                        Label("Allergy Alert", systemImage: "exclamationmark.shield.fill")
                            .foregroundStyle(.red)
                    }
                }

                // Display only (H-07): the class each drug matched through, every merged effect,
                // and the "absence of an alert" note. Never blocks saving.
                let live = liveInteractions
                if !live.isEmpty {
                    Section {
                        ForEach(live) { alert in
                            VStack(alignment: .leading, spacing: 3) {
                                HStack(spacing: 6) {
                                    Image(systemName: alert.interaction.severity.icon)
                                        .foregroundStyle(alert.interaction.severity.color)
                                    Text(alert.pairDisplay)
                                        .font(.caption.weight(.semibold))
                                }
                                Text(alert.interaction.clinicalEffect)
                                    .font(.caption)
                                InteractionRelatedEffects(related: alert.related)
                            }
                            // Severity is shown only by the icon's shape and colour here: speak it.
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel(Text(InteractionAccessibility.label(for: alert, includeManagement: false)))
                            .accessibilityIdentifier("rx.liveInteraction")
                        }
                    } header: {
                        Label("Interaction Warning", systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                    } footer: {
                        InteractionAbsenceNote()
                    }
                } else if liveInteractionCheckRan {
                    Section {
                        InteractionAbsenceNote(noneFound: true)
                    }
                }

                Section("Dosing") {
                    TextField("Dose (e.g. 500 mg)", text: $dose)
                    Picker("Route", selection: $route) {
                        ForEach(["Oral", "IV", "IM", "SC", "Topical", "Inhaled", "PR", "SL"], id: \.self) {
                            Text($0).tag($0)
                        }
                    }
                    TextField("Frequency", text: $frequency)
                    quickChips(freqChips, current: frequency) { frequency = $0 }
                    TextField("Duration", text: $duration)
                    quickChips(durationChips, current: duration) { duration = $0 }
                }

                Section("Clinical") {
                    TextField("Indication", text: $indication)
                    TextField("Special instructions", text: $instructions, axis: .vertical)
                        .lineLimit(2...)
                }
            }
            .navigationTitle("Add Prescription")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }
                        .disabled(drugQuery.trimmingCharacters(in: .whitespaces).isEmpty)
                        .accessibilityIdentifier("rx.save")
                }
            }
        }
    }

    private func save() {
        let rx = Prescription(
            drug: drugQuery.trimmingCharacters(in: .whitespaces),
            dose: dose,
            route: route,
            frequency: frequency,
            duration: duration,
            indication: indication
        )
        rx.instructions = instructions.isEmpty ? nil : instructions
        rx.patient = patient
        context.insert(rx)
        AuditLog.record("create", "prescription", patient: patient, resourceId: rx.syncCode)
        patient.updatedAt = .now
        patient.pendingSync = true
        dismiss()
    }
}
