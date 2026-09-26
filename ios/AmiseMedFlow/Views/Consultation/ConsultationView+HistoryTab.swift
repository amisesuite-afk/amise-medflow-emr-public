// ConsultationView+HistoryTab.swift
// Encounter history tab.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - Encounter History Tab

    var encounterHistoryTab: some View {
        let sorted = patient.encounters
            .filter(\.isComplete)
            .sorted { $0.encounterDate > $1.encounterDate }
        return Group {
            if sorted.isEmpty {
                ContentUnavailableView(
                    "No Saved Visits",
                    systemImage: "clock.badge.questionmark",
                    description: Text("Tap \"Save Visit\" to snapshot the current consultation into history.")
                )
            } else {
                List {
                    // What this visit continues from: the last visit's problem and plan.
                    if let last = VisitContinuity.lastVisit(for: patient) {
                        Section {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(last.problem ?? "Previous visit")
                                    .font(.subheadline.weight(.semibold))
                                Text("Last seen \(last.date.formatted(date: .abbreviated, time: .omitted))")
                                    .font(.caption).foregroundStyle(.secondary)
                                if let plan = last.plan, !plan.isEmpty {
                                    Text("Plan: \(plan)").font(.caption).lineLimit(4)
                                }
                                Text(VisitContinuity.isSameProblem(current: patient.chiefComplaint, previous: last)
                                     ? "Same problem — update the condition, PMH, surgery, medicines and allergies as you go."
                                     : "Today's complaint looks new — full history for the new problem.")
                                    .font(.caption2).foregroundStyle(AMColor.accent)
                            }
                            .accessibilityElement(children: .combine)
                        } header: { Text("Continuing from") }
                    }
                    ForEach(sorted, id: \.id) { enc in
                        Button { selectedEncounter = enc } label: {
                            EncounterHistoryRow(encounter: enc)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .listStyle(.insetGrouped)
                .sheet(item: $selectedEncounter) { enc in
                    EncounterDetailSheet(encounter: enc)
                }
            }
        }
    }
}

// MARK: - Drug interaction row

struct InteractionAlertRow: View {
    let alert: DrugInteractionAlert
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: alert.interaction.severity.icon)
                    .foregroundStyle(alert.interaction.severity.color)
                Text(alert.pairDisplay).font(.caption.weight(.semibold))
            }
            Text(alert.interaction.clinicalEffect).font(.caption)
            Text(alert.interaction.mechanism).font(.caption).foregroundStyle(.secondary)
            Text("→ \(alert.interaction.management)").font(.caption2).foregroundStyle(.orange)
            InteractionRelatedEffects(related: alert.related)
        }
    }
}

// MARK: - Add Medication sheet

struct AddMedicationSheet: View {
    @Bindable var patient: Patient
    let context: ModelContext
    @Environment(\.dismiss) private var dismiss

    @State private var drugQuery = ""
    @State var suggestions: [SurgicalDrug] = []
    @State private var selectedDrug: SurgicalDrug?
    @State var dose = ""
    @State var route = "Oral"
    @State var frequency = "Once daily"
    @State var duration = "7 days"
    @State private var indication = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                        TextField("Drug name", text: $drugQuery)
                            .autocorrectionDisabled()
                            .onChange(of: drugQuery) { _, q in
                                suggestions = q.count >= 2 ? ClinicalSearchService.searchDrugs(q) : []
                            }
                        if !drugQuery.isEmpty {
                            Button { drugQuery = ""; suggestions = [] }
                                label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                        }
                    }
                    ForEach(suggestions.prefix(6)) { drug in
                        Button {
                            selectedDrug = drug; drugQuery = drug.name
                            dose = drug.commonDoses; indication = patient.workingDiagnosis ?? ""
                            suggestions = []
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(drug.name).foregroundStyle(.primary).font(.subheadline)
                                Text(drug.commonDoses).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                } header: { Label("Search Formulary", systemImage: "magnifyingglass") }

                if selectedDrug != nil {
                    Section("Dose & Route") {
                        TextField("Dose", text: $dose)
                        Picker("Route", selection: $route) {
                            ForEach(["Oral", "IV", "IM", "SC", "Topical", "Inhaled", "PR", "SL"],
                                    id: \.self) { Text($0).tag($0) }
                        }
                        TextField("Frequency", text: $frequency)
                        TextField("Duration", text: $duration)
                        TextField("Indication", text: $indication)
                    }
                }
            }
            .navigationTitle("Add Medication")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        guard let drug = selectedDrug else { return }
                        let rx = Prescription(drug: drug.name, dose: dose, route: route,
                                              frequency: frequency, duration: duration, indication: indication)
                        rx.patient = patient
                        context.insert(rx)
                        AuditLog.record("create", "prescription", patient: patient, resourceId: rx.syncCode)
                        patient.updatedAt = .now; patient.pendingSync = true
                        dismiss()
                    }
                    .bold()
                    .disabled(selectedDrug == nil || dose.isEmpty)
                }
            }
        }
    }
}

// MARK: - Bayesian differential row

struct BayesianDxRow: View {
    let result: BayesianDiagnosisEngine.DiagnosisResult
    let onApply: () -> Void

    var barColor: Color {
        switch result.probability {
        case 55...: return .green
        case 30...: return .orange
        default:    return .secondary
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(result.name)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.primary)
                    Text(result.icdCode)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(result.probability)%")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(barColor)
                    Text(result.confidence.label)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Button("Apply") { onApply() }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .tint(barColor)
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.secondary.opacity(0.15))
                    RoundedRectangle(cornerRadius: 3)
                        .fill(barColor.opacity(0.75))
                        .frame(width: geo.size.width * CGFloat(result.probability) / 100)
                }
            }
            .frame(height: 5)

            if !result.evidence.isEmpty {
                Text(result.evidence.joined(separator: " · "))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Consultation Letter Sheet

struct ConsultationLetterSheet: View {
    let letterText: String
    let patient: Patient
    @Environment(\.dismiss) private var dismiss
    @State private var showShare = false

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(letterText)
                    .font(.system(.body, design: .serif))
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .navigationTitle("Consultation Letter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showShare = true
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
            .sheet(isPresented: $showShare) {
                ShareSheet(items: [letterText]).ignoresSafeArea()
            }
        }
    }

}

// MARK: - EncounterHistoryRow

private struct EncounterHistoryRow: View {
    let encounter: Encounter

    var dateText: String {
        encounter.encounterDate.formatted(date: .abbreviated, time: .omitted)
    }

    var topDx: String? {
        if let dx = encounter.workingDiagnosis, !dx.isEmpty { return dx }
        let snap = encounter.decodedBayesianSnapshot
        return snap.first.map { "\($0.name) (\($0.probability)%)" }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: encounter.visitType.icon)
                    .font(.caption)
                    .foregroundStyle(AMColor.accent)
                Text(encounter.visitType.rawValue)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AMColor.accent)
                Spacer()
                Text(dateText)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            if let cc = encounter.chiefComplaint {
                Text(cc)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
            }
            if let dx = topDx {
                Text(dx)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            if let plan = encounter.managementPlan, !plan.isEmpty {
                Text(plan)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .lineLimit(2)
            }
            // Outcomes loop: a gentle reminder, only after an operation or pathology (> 14 days).
            if encounter.finalDiagnosisDue {
                Label("Final diagnosis not yet recorded", systemImage: "clock.badge.exclamationmark")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.orange)
            }
        }
        .padding(.vertical, 4)
    }


}
