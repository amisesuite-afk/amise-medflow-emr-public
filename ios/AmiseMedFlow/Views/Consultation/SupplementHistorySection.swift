// SupplementHistorySection.swift
// "Herbs, teas, bush remedies & supplements" — the mandatory question and what the patient takes.
// Shown in the consultation Meds step and the pre-op checklist (same record: Patient.supplementHistory,
// stored in PathwayData). Searchable from SupplementCatalogue plus free text. A recorded supplement
// is screened by the drug-interaction checks like a drug. Nothing here stops or prescribes anything:
// stop times are shown to the clinician, who decides.

import SwiftUI
import SwiftData

struct SupplementHistorySection: View {
    @Bindable var patient: Patient
    /// Pre-op checklist: show the perioperative alert for each recorded catalogue item.
    var showPerioperativeAlerts: Bool = false

    @Environment(\.modelContext) private var context
    @State private var query = ""
    @State private var details = ""

    var body: some View {
        let history = patient.supplementHistory
        let recorded = history.recordedItems
        Section {
            Picker("Asked about herbs, teas, bush remedies & supplements", selection: statusBinding(history)) {
                ForEach(SupplementStatus.allCases, id: \.self) { s in
                    Text(s.label).tag(s)
                }
            }
            .pickerStyle(.segmented)
            .accessibilityHint(SupplementCatalogue.disclosureRationale)

            if !history.isAnswered {
                Label("Not asked yet — mandatory question", systemImage: "exclamationmark.circle.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.orange)
            }

            if let reported = patient.patientReportedSupplements {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Patient questionnaire: \(reported)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if SupplementHistory.questionnaireValueNamesProducts(reported) {
                        Button("Add as a recorded entry") {
                            add(name: reported, catalogueId: SupplementCatalogue.match(reported).first?.id)
                        }
                        .font(.caption.weight(.semibold))
                        .disabled(history.entries.contains { $0.name.caseInsensitiveCompare(reported) == .orderedSame })
                    } else {
                        Text("Confirm with the patient and record the answer above.")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            ForEach(history.entries) { entry in
                entryRow(entry)
            }
            .onDelete { offsets in
                var h = patient.supplementHistory
                h.entries.remove(atOffsets: offsets)
                save(h)
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Image(systemName: "leaf").foregroundStyle(.secondary)
                        .accessibilityHidden(true)
                    TextField("Search or type (garlic, turmeric, cerasee tea…)", text: $query)
                        .autocorrectionDisabled()
                }
                TextField("Dose / how often (optional)", text: $details)
                    .font(.callout)
                let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    ForEach(SupplementCatalogue.search(trimmed).prefix(5)) { item in
                        Button {
                            add(name: item.label, catalogueId: item.id)
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.label).font(.subheadline)
                                Text(item.concern).font(.caption2).foregroundStyle(.secondary).lineLimit(2)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                    Button {
                        add(name: trimmed, catalogueId: SupplementCatalogue.match(trimmed).first?.id)
                    } label: {
                        Label("Add \u{201C}\(trimmed)\u{201D} as written", systemImage: "plus.circle")
                            .font(.callout)
                    }
                }
            }

            if showPerioperativeAlerts {
                ForEach(recorded) { item in
                    Label(SupplementCatalogue.perioperativeAlertText(item), systemImage: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
                if !recorded.isEmpty {
                    Text("Decision support only — the clinician decides whether anything is stopped.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        } header: {
            Label(SupplementCatalogue.sectionTitle, systemImage: "leaf")
        } footer: {
            Text(SupplementCatalogue.disclosureRationale)
        }
    }

    @ViewBuilder
    private func entryRow(_ entry: SupplementEntry) -> some View {
        let item = SupplementCatalogue.item(id: entry.catalogueId) ?? SupplementCatalogue.match(entry.name).first
        VStack(alignment: .leading, spacing: 2) {
            Text(entry.details.isEmpty ? entry.name : "\(entry.name) — \(entry.details)")
                .font(.callout.weight(.semibold))
            if let item = item {
                Text(item.concern)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("Not in the catalogue — identify the plant or product.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func statusBinding(_ history: SupplementHistory) -> Binding<SupplementStatus> {
        Binding(
            get: { history.effectiveStatus },
            set: { newValue in
                var h = patient.supplementHistory
                // Recorded entries mean "takes some"; "None" never discards them silently.
                if newValue != .taking && !h.entries.isEmpty { return }
                h.status = newValue
                h.askedAt = newValue == .notAsked ? nil : .now
                save(h)
            })
    }

    private func add(name: String, catalogueId: String?) {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        var h = patient.supplementHistory
        h.entries.append(SupplementEntry(catalogueId: catalogueId, name: clean,
                                         details: details.trimmingCharacters(in: .whitespacesAndNewlines)))
        h.status = .taking
        h.askedAt = .now
        save(h)
        query = ""
        details = ""
    }

    private func save(_ h: SupplementHistory) {
        patient.supplementHistory = h
        patient.updatedAt = .now
        try? context.save()
    }
}
