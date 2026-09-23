// ConsultationView+SocialTab.swift
// Social history tab.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - Social tab

    var socialTab: some View {
        List {
            // Smoking status — single choice
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(["Non-smoker", "Ex-smoker", "Light smoker (<10/day)",
                             "Moderate smoker (10–20/day)", "Heavy smoker (>20/day)"], id: \.self) { chip in
                        let key = "Smoking:\(chip)"
                        let done = selectedSocialChips.contains(key)
                        Button {
                            selectSingleSocialChip(prefix: "Smoking", value: chip, displayText: chip)
                        } label: {
                            socialChipLabel(chip, selected: done)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("Smoking", systemImage: "smoke")
            }

            // Alcohol — single choice
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(["Non-drinker", "Social drinker (<14 units/wk)",
                             "Moderate (14–21 units/wk)", "Heavy (>21 units/wk)"], id: \.self) { chip in
                        let key = "Alcohol:\(chip)"
                        let done = selectedSocialChips.contains(key)
                        Button {
                            selectSingleSocialChip(prefix: "Alcohol", value: chip, displayText: chip)
                        } label: {
                            socialChipLabel(chip, selected: done)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("Alcohol", systemImage: "wineglass")
            }

            // Living situation — single choice
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(["Lives alone", "Lives with partner", "Lives with family", "Care home resident"],
                            id: \.self) { chip in
                        let key = "Living:\(chip)"
                        let done = selectedSocialChips.contains(key)
                        Button {
                            selectSingleSocialChip(prefix: "Living", value: chip, displayText: chip)
                        } label: {
                            socialChipLabel(chip, selected: done)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("Living Situation", systemImage: "house")
            }

            // Occupation — single choice
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(["Retired", "Sedentary / desk work", "Manual labour", "Healthcare worker"],
                            id: \.self) { chip in
                        let key = "Occ:\(chip)"
                        let done = selectedSocialChips.contains(key)
                        Button {
                            selectSingleSocialChip(prefix: "Occ", value: chip, displayText: chip)
                        } label: {
                            socialChipLabel(chip, selected: done)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("Occupation", systemImage: "briefcase")
            }

            // Activity level — single choice
            Section {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(["Physically active (>150 min/wk)", "Sedentary lifestyle"], id: \.self) { chip in
                        let key = "Activity:\(chip)"
                        let done = selectedSocialChips.contains(key)
                        Button {
                            selectSingleSocialChip(prefix: "Activity", value: chip, displayText: chip)
                        } label: {
                            socialChipLabel(chip, selected: done)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("Activity Level", systemImage: "figure.walk")
            }

            // Free text notes
            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.socialHistory ?? "" },
                                            set: { patient.socialHistory = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 120)
                    if (patient.socialHistory ?? "").isEmpty {
                        Text("Additional notes — travel, diet, recreational drugs, functional status…")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Social History Notes", icon: "person.2.circle",
                              filled: !(patient.socialHistory ?? "").isEmpty)
            }
        }
    }

    // Shared chip label for the social tab (radio-select style)
    @ViewBuilder
    func socialChipLabel(_ text: String, selected: Bool) -> some View {
        HStack(spacing: 4) {
            Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 11))
                .foregroundStyle(selected ? .green : .teal.opacity(0.5))
            Text(text)
                .font(.system(size: 12))
        }
        .padding(.horizontal, 10).padding(.vertical, 5)
        .background(selected ? Color.green.opacity(0.12) : AMColor.accentLt, in: Capsule())
        .foregroundStyle(selected ? .green : AMColor.accent)
    }

    // Selects one chip within a prefix group (radio behaviour).
    // Tapping the already-selected chip deselects it.
    func selectSingleSocialChip(prefix: String, value: String, displayText: String) {
        let key = "\(prefix):\(value)"
        let isCurrentlySelected = selectedSocialChips.contains(key)

        // Remove all chips with this prefix from the in-memory set
        selectedSocialChips = selectedSocialChips.filter { !$0.hasPrefix("\(prefix):") }

        // Remove matching lines from stored social history
        var lines = (patient.socialHistory ?? "")
            .components(separatedBy: "\n")
            .filter { line in
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                    .trimmingCharacters(in: CharacterSet(charactersIn: "·").union(.whitespaces))
                return !trimmed.hasPrefix("\(prefix): ")
            }

        // If not deselecting, add the new selection
        if !isCurrentlySelected {
            selectedSocialChips.insert(key)
            lines.append("· \(prefix): \(displayText)")
        }

        let joined = lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        patient.socialHistory = joined.isEmpty ? nil : joined
        touch()
        recomputeRisk()
    }

    func appendSocialChip(_ item: String) {
        let existing = (patient.socialHistory ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        patient.socialHistory = existing.isEmpty ? "· \(item)" : existing + "\n· \(item)"
        touch()
        recomputeRisk()
    }


}
