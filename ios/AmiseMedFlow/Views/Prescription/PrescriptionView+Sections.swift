// PrescriptionView+Sections.swift
// Diagnosis dosing guide, interaction alerts, and prescription list sections.

import SwiftUI
import SwiftData


extension PrescriptionView {

    // MARK: - Diagnosis dosing guide

    @ViewBuilder
    func dosingGuideSection(entries: [DosingEntry], dx: String, labs: LabPanel) -> some View {
        let allergyNames = patient.allergies.map { $0.name.lowercased() }
        let weightKg = patient.vitalsEntries
            .sorted { $0.recordedAt > $1.recordedAt }
            .first(where: { $0.weightKg != nil })?.weightKg

        Section {
            VStack(alignment: .leading, spacing: 0) {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { dosingExpanded.toggle() }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "pills.fill")
                            .font(.system(size: 13))
                            .foregroundStyle(.indigo)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Dosing Guide")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(.indigo)
                            Text("\(entries.count) drug\(entries.count == 1 ? "" : "s") for \(dx)")
                                .font(.system(size: 11))
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        // Inline renal/hepatic lab value chips
                        if let cr = labs.creatinine, entries.contains(where: { $0.renalCaution }) {
                            Text("Cr \(Int(cr.value)) µmol/L")
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundStyle(cr.value > 150 ? .orange : .secondary)
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .background((cr.value > 150 ? Color.orange : Color(.systemGray5)).opacity(cr.value > 150 ? 0.15 : 1), in: Capsule())
                        }
                        if let bil = labs.bilirubin, entries.contains(where: { $0.hepaticCaution }) {
                            Text("Bil \(Int(bil.value)) µmol/L")
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundStyle(bil.value > 35 ? .purple : .secondary)
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .background((bil.value > 35 ? Color.purple : Color(.systemGray5)).opacity(bil.value > 35 ? 0.15 : 1), in: Capsule())
                        }
                        if let wt = weightKg {
                            Text(String(format: "%.0f kg", wt))
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(Color(.systemGray5), in: Capsule())
                        }
                        Image(systemName: dosingExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                if dosingExpanded {
                    Divider().padding(.top, 6)
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(entries) { entry in
                            let isContraindicated = allergyNames.contains(where: { name in
                                entry.allergyKeywords.contains(where: { name.contains($0) })
                            })
                            dosingRow(entry: entry, weightKg: weightKg, contraindicated: isContraindicated, labs: labs)
                            if entry.id != entries.last?.id {
                                Divider().padding(.leading, 8)
                            }
                        }
                    }
                    .padding(.top, 6)
                }
            }
            .padding(.vertical, 2)
        } header: {
            Label("Dosing Reference · \(dx)", systemImage: "pills")
                .foregroundStyle(.indigo)
        } footer: {
            Text("Reference guide only — verify dose, renal function, and allergies before prescribing.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    @ViewBuilder
    func dosingRow(entry: DosingEntry, weightKg: Double?, contraindicated: Bool, labs: LabPanel = LabPanel()) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .top, spacing: 6) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text(entry.drug)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(contraindicated ? .red : .primary)
                        if contraindicated {
                            Label("CONTRAINDICATED", systemImage: "exclamationmark.triangle.fill")
                                .font(.system(size: 9, weight: .black))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .background(Color.red, in: Capsule())
                        }
                    }
                    Text(entry.indication)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    // Weight-adjusted dose if weight is known
                    if entry.weightBased, let wt = weightKg,
                       let num = parseWeightDoseMultiplier(entry.dose) {
                        let computed = num * wt
                        Text(String(format: "≈ %.0f mg", computed))
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.indigo)
                        Text(entry.dose)
                            .font(.system(size: 10))
                            .foregroundStyle(.tertiary)
                    } else {
                        Text(entry.dose)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.primary)
                    }
                    Text(entry.route)
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                }
            }

            // Caution badges with actual lab values where available
            let badges = cautionBadges(entry: entry, labs: labs)
            if !badges.isEmpty {
                HStack(spacing: 5) {
                    ForEach(badges, id: \.0) { (label, color) in
                        Text(label)
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background(color, in: Capsule())
                    }
                }
            }

            if let note = entry.notes {
                Text(note)
                    .font(.system(size: 10))
                    .foregroundStyle(.orange)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 7)
        .padding(.horizontal, 2)
        .opacity(contraindicated ? 0.8 : 1.0)
    }

    func cautionBadges(entry: DosingEntry, labs: LabPanel = LabPanel()) -> [(String, Color)] {
        var badges: [(String, Color)] = []
        if entry.renalCaution {
            if let cr = labs.creatinine {
                let label = "RENAL · Cr \(Int(cr.value)) µmol/L"
                badges.append((label, cr.value > 300 ? .red : .orange))
            } else {
                badges.append(("RENAL CAUTION", .orange))
            }
        }
        if entry.hepaticCaution {
            var parts: [String] = []
            if let bil = labs.bilirubin { parts.append("Bil \(Int(bil.value))") }
            if let alt = labs.alt { parts.append("ALT \(Int(alt.value))") }
            let label = parts.isEmpty ? "HEPATIC CAUTION" : "HEPATIC · \(parts.joined(separator: " / "))"
            badges.append((label, .purple))
        }
        if entry.weightBased { badges.append(("WEIGHT-BASED", .blue)) }
        return badges
    }

    func parseWeightDoseMultiplier(_ doseString: String) -> Double? {
        // Parse "X mg/kg" patterns like "5 mg/kg" → 5.0
        let pattern = #"(\d+(?:\.\d+)?)\s*mg/kg"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let match = regex.firstMatch(in: doseString, range: NSRange(doseString.startIndex..., in: doseString)),
              let range = Range(match.range(at: 1), in: doseString)
        else { return nil }
        return Double(doseString[range])
    }

    // MARK: - Interaction alerts

    @ViewBuilder
    var interactionsSection: some View {
        Section {
            ForEach(interactions) { alert in
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Image(systemName: alert.interaction.severity.icon)
                            .foregroundStyle(alert.interaction.severity.color)
                        Text("\(alert.drugA) + \(alert.drugB)")
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Text(alert.interaction.severity.rawValue)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(alert.interaction.severity.color)
                    }
                    Text(alert.interaction.clinicalEffect)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(alert.interaction.management)
                        .font(.caption.italic())
                        .foregroundStyle(.orange)
                }
                .padding(.vertical, 2)
            }
        } header: {
            Label("Drug Interactions (\(interactions.count))", systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
        }
    }

    // MARK: - Prescription list

    @ViewBuilder
    var prescriptionsSection: some View {
        Section {
            if patient.prescriptions.isEmpty {
                ContentUnavailableView(
                    "No prescriptions",
                    systemImage: "pills",
                    description: Text("Tap + to add a prescription")
                )
                .listRowBackground(Color.clear)
            } else {
                ForEach(patient.prescriptions.sorted { $0.prescribedAt > $1.prescribedAt }) { rx in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(rx.drug).font(.subheadline.weight(.semibold))
                        Text(rx.displayLine).font(.caption).foregroundStyle(.secondary)
                        HStack(spacing: 8) {
                            if !rx.duration.isEmpty {
                                Label(rx.duration, systemImage: "clock")
                                    .font(.caption2)
                                    .foregroundStyle(.tertiary)
                            }
                            if !rx.indication.isEmpty {
                                Text("For: \(rx.indication)").font(.caption2).foregroundStyle(.tertiary)
                            }
                        }
                        if let instr = rx.instructions, !instr.isEmpty {
                            Text(instr).font(.caption2.italic()).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                }
                .onDelete { indexSet in
                    let sorted = patient.prescriptions.sorted { $0.prescribedAt > $1.prescribedAt }
                    indexSet.forEach {
                        AuditLog.record("delete", "prescription", patient: patient, resourceId: sorted[$0].syncCode)
                        SyncTombstones.add(sorted[$0].remoteId, in: .prescriptions)
                        context.delete(sorted[$0])
                    }
                    patient.updatedAt = .now
                    patient.pendingSync = true
                }
            }
        } header: {
            Text("Current Prescriptions")
        }
    }

}
