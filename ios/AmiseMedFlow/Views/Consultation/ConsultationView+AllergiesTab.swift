// ConsultationView+AllergiesTab.swift
// Allergies tab.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - Allergies tab

    var allergiesTab: some View {
        List {
            // Quick-add common allergen chips
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(commonAllergenChips, id: \.name) { chip in
                        let added = patient.allergies.contains(where: { $0.name == chip.name })
                        Button {
                            guard !added else { return }
                            var list = patient.allergies
                            list.append(AllergyEntry(name: chip.name, severity: "Moderate",
                                                     reaction: chip.reaction))
                            patient.allergies = list; touch()
                        } label: {
                            HStack(spacing: 4) {
                                if added {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 9, weight: .bold))
                                }
                                Text(chip.name)
                                    .font(.system(size: 12, weight: added ? .semibold : .regular))
                            }
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(added ? Color.red.opacity(0.15) : Color.red.opacity(0.07),
                                        in: Capsule())
                            .foregroundStyle(added ? .red : .red.opacity(0.75))
                            .overlay(Capsule()
                                .stroke(added ? Color.red.opacity(0.35) : Color.clear, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .disabled(added)
                    }
                }
                .padding(.vertical, 4)

                Button {
                    let nkda = AllergyEntry(name: "NKDA", severity: "Mild", reaction: "None")
                    if !patient.allergies.contains(where: { $0.name == "NKDA" }) {
                        var list = patient.allergies; list.insert(nkda, at: 0)
                        patient.allergies = list; touch()
                    }
                } label: {
                    Label("Mark NKDA (No Known Drug Allergies)", systemImage: "checkmark.shield")
                        .font(.subheadline).foregroundStyle(.green)
                }
                .buttonStyle(.plain)
                .disabled(patient.allergies.contains(where: { $0.name == "NKDA" }))
            } header: {
                Label("Common Allergens", systemImage: "bolt.heart")
            }

            Section {
                if patient.allergies.isEmpty {
                    // Empty is "not recorded", not NKDA: NKDA must be marked explicitly.
                    HStack {
                        Image(systemName: "questionmark.circle").foregroundStyle(.orange)
                        Text("Allergies not recorded — add an allergy or mark NKDA")
                            .foregroundStyle(.secondary).font(.callout)
                    }
                } else {
                    ForEach(patient.allergies) { a in
                        HStack(spacing: 10) {
                            Circle().fill(severityColor(a.severity)).frame(width: 9, height: 9)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(a.name).font(.subheadline.weight(.semibold))
                                Text("\(a.severity) — \(a.reaction)").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    .onDelete { idx in
                        var list = patient.allergies; list.remove(atOffsets: idx)
                        patient.allergies = list; touch()
                    }
                }
                Button { showAddAllergy = true } label: {
                    Label("Add Allergy / Intolerance", systemImage: "plus.circle")
                }
                .foregroundStyle(.red)
            } header: {
                sectionHeader("Allergies & Intolerances", icon: "exclamationmark.shield",
                              filled: !patient.allergies.isEmpty, filledColor: .red)
            }

            // Display only (H-07). Shown whenever two or more drugs were screened, so an empty
            // result still carries the "absence of an alert" note.
            let alerts = interactions
            if !alerts.isEmpty {
                Section {
                    ForEach(alerts) { alert in InteractionAlertRow(alert: alert) }
                } header: {
                    Label("Drug Interaction Alerts", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                } footer: {
                    InteractionAbsenceNote()
                }
            } else if patient.prescriptions.count >= 2 {
                Section {
                    InteractionAbsenceNote(noneFound: true)
                } header: {
                    Label("Drug Interaction Alerts", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.secondary)
                }
            }
        }
    }


}
