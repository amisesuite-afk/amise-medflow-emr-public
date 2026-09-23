// ConsultationView+PSHxTab.swift
// Past surgical history tab and structured history entry rows.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - PSHx tab

    var pshxTab: some View {
        List {
            // Structured entries — one row per procedure
            if !patient.pshxEntries.isEmpty {
                Section {
                    ForEach(patient.pshxEntries.indices, id: \.self) { i in
                        pshxEntryRow(index: i)
                    }
                    .onDelete { idxSet in
                        var list = patient.pshxEntries
                        list.remove(atOffsets: idxSet)
                        patient.pshxEntries = list
                        touch()
                    }
                } header: {
                    sectionHeader("Surgical History (\(patient.pshxEntries.count))",
                                  icon: "scissors", filled: true)
                }
            }

            Section {
                // Bypass card
                if !(patient.surgicalHistory ?? "").isEmpty && !pshxBypassConfirmed {
                    historyBypassCard(
                        title: "Surgical history already on record",
                        subtitle: "Still accurate for this encounter?",
                        onConfirm: { pshxBypassConfirmed = true }
                    )
                }

                // No prior surgery quick-set
                Button {
                    patient.surgicalHistory = "No previous surgical history"
                    pshxChipSelections = []
                    pshxBypassConfirmed = true
                    touch()
                } label: {
                    Label("No previous surgical history", systemImage: "checkmark.shield")
                        .font(.subheadline)
                        .foregroundStyle(.green)
                }
                .buttonStyle(.plain)

                // Procedure list
                ForEach(pshxChips, id: \.self) { chip in
                    let sel = pshxChipSelections.contains(chip)
                    Button { pshxChipSelections.formSymmetricDifference([chip]) } label: {
                        HStack(spacing: 10) {
                            Image(systemName: sel ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 13))
                                .foregroundStyle(sel ? AMColor.accent : Color.secondary)
                            Text(chip)
                                .font(.callout.weight(sel ? .semibold : .regular))
                                .foregroundStyle(.primary)
                            Spacer()
                        }
                    }.buttonStyle(.plain)
                }

                // Apply button
                if !pshxChipSelections.isEmpty {
                    Button {
                        appendHistory(existing: patient.surgicalHistory, chips: pshxChipSelections) {
                            patient.surgicalHistory = $0
                        }
                        // Create structured entries for each new procedure
                        var entries = patient.pshxEntries
                        for chip in pshxChipSelections.sorted() {
                            if !entries.contains(where: { $0.procedure == chip }) {
                                entries.append(PSHxEntry(procedure: chip))
                            }
                        }
                        patient.pshxEntries = entries
                        pshxChipSelections = []
                        pshxBypassConfirmed = true
                        touch()
                    } label: {
                        Label("Append \(pshxChipSelections.count) procedure\(pshxChipSelections.count == 1 ? "" : "s") to Surgical History",
                              systemImage: "plus.circle.fill")
                    }
                    .foregroundStyle(AMColor.accent)
                }

                // Manual text editor
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.surgicalHistory ?? "" },
                                            set: { patient.surgicalHistory = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 120)
                    if (patient.surgicalHistory ?? "").isEmpty {
                        Text("Previous operations, procedures, anaesthetic history, complications…")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Past Surgical History", icon: "scissors",
                              filled: !(patient.surgicalHistory ?? "").isEmpty)
            }
        }
    }

    // MARK: - Structured history entry rows

    @ViewBuilder
    func pmhEntryRow(index i: Int) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "stethoscope")
                .font(.system(size: 11))
                .foregroundStyle(AMColor.accent)
                .frame(width: 16)
            Text(i < patient.pmhEntries.count ? patient.pmhEntries[i].condition : "")
                .font(.callout)
                .foregroundStyle(.primary)
            Spacer()
            TextField("Year", text: Binding(
                get: { i < patient.pmhEntries.count ? patient.pmhEntries[i].yearText : "" },
                set: { v in
                    guard i < patient.pmhEntries.count else { return }
                    var list = patient.pmhEntries
                    list[i].yearText = v
                    patient.pmhEntries = list
                    touch()
                }
            ))
            .keyboardType(.numberPad)
            .font(.system(size: 12).monospacedDigit())
            .foregroundStyle(.secondary)
            .frame(width: 52)
            .multilineTextAlignment(.trailing)
        }
    }

    @ViewBuilder
    func pshxEntryRow(index i: Int) -> some View {
        let entry = i < patient.pshxEntries.count ? patient.pshxEntries[i] : PSHxEntry(procedure: "")
        HStack(spacing: 8) {
            Image(systemName: "scissors")
                .font(.system(size: 11))
                .foregroundStyle(AMColor.accent)
                .frame(width: 16)
            Text(entry.procedure)
                .font(.callout)
                .foregroundStyle(.primary)
            Spacer()
            TextField("Year", text: Binding(
                get: { i < patient.pshxEntries.count ? patient.pshxEntries[i].yearText : "" },
                set: { v in
                    guard i < patient.pshxEntries.count else { return }
                    var list = patient.pshxEntries
                    list[i].yearText = v
                    patient.pshxEntries = list
                    touch()
                }
            ))
            .keyboardType(.numberPad)
            .font(.system(size: 12).monospacedDigit())
            .foregroundStyle(.secondary)
            .frame(width: 48)
            .multilineTextAlignment(.trailing)

            Menu {
                Button("Unknown / Not recorded") {
                    guard i < patient.pshxEntries.count else { return }
                    var list = patient.pshxEntries
                    list[i].anaesthetic = ""
                    patient.pshxEntries = list; touch()
                }
                ForEach(["GA", "Spinal", "Epidural", "Local", "Sedation", "Regional"], id: \.self) { type in
                    Button(type) {
                        guard i < patient.pshxEntries.count else { return }
                        var list = patient.pshxEntries
                        list[i].anaesthetic = type
                        patient.pshxEntries = list; touch()
                    }
                }
            } label: {
                Text(entry.anaesthetic.isEmpty ? "Anaesth." : entry.anaesthetic)
                    .font(.caption2.weight(.medium))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(
                        entry.anaesthetic.isEmpty ? Color(.systemGray5) : AMColor.accentLt,
                        in: Capsule()
                    )
                    .foregroundStyle(entry.anaesthetic.isEmpty ? .secondary : AMColor.accent)
            }
            .menuStyle(.button)
        }
    }


}
