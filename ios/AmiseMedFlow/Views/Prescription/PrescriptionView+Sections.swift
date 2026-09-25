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
                            .scaledFont(size: 13)
                            .foregroundStyle(.indigo)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Dosing Guide")
                                .scaledFont(size: 12, weight: .bold)
                                .foregroundStyle(.indigo)
                            Text("\(entries.count) drug\(entries.count == 1 ? "" : "s") for \(dx)")
                                .scaledFont(size: 11)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        // Inline renal/hepatic lab value chips
                        if let cr = labs.creatinine, entries.contains(where: { $0.renalCaution }) {
                            Text("Cr \(Int(cr.value)) µmol/L")
                                .scaledFont(size: 9, weight: .semibold)
                                .foregroundStyle(cr.value > 150 ? .orange : .secondary)
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .background((cr.value > 150 ? Color.orange : Color(.systemGray5)).opacity(cr.value > 150 ? 0.15 : 1), in: Capsule())
                        }
                        if let bil = labs.bilirubin, entries.contains(where: { $0.hepaticCaution }) {
                            Text("Bil \(Int(bil.value)) µmol/L")
                                .scaledFont(size: 9, weight: .semibold)
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
                            .scaledFont(size: 11)
                            .foregroundStyle(.secondary)
                    }
                    // Lab chips are capped so the header stays one line up to xxxLarge.
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                    .padding(.vertical, 4)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                // The chips' orange / purple tint was the only sign of a raised value.
                .accessibilityLabel(Text(dosingHeaderAccessibilityLabel(entries: entries, dx: dx,
                                                                        labs: labs, weightKg: weightKg)))
                .accessibilityValue(dosingExpanded ? "Expanded" : "Collapsed")

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

    /// "Dosing guide, 4 drugs for Cholecystitis, creatinine 180 µmol/L, raised, …".
    func dosingHeaderAccessibilityLabel(entries: [DosingEntry], dx: String,
                                        labs: LabPanel, weightKg: Double?) -> String {
        var parts: [String?] = ["Dosing guide",
                                "\(entries.count) drug\(entries.count == 1 ? "" : "s") for \(dx)"]
        if let cr = labs.creatinine, entries.contains(where: { $0.renalCaution }) {
            parts.append("creatinine \(Int(cr.value)) µmol/L\(cr.value > 150 ? ", raised" : "")")
        }
        if let bil = labs.bilirubin, entries.contains(where: { $0.hepaticCaution }) {
            parts.append("bilirubin \(Int(bil.value)) µmol/L\(bil.value > 35 ? ", raised" : "")")
        }
        if let wt = weightKg { parts.append(String(format: "weight %.0f kg", wt)) }
        return A11yLabel.joined(parts)
    }

    /// Drug + indication beside the dose, or the dose below at accessibility text sizes (so
    /// the drug name and dose wrap instead of squeezing each other).
    var dosingRowLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
            : AnyLayout(HStackLayout(alignment: .top, spacing: 6))
    }

    /// Caution badges in a row, or one per line at accessibility sizes.
    var badgeLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
            : AnyLayout(HStackLayout(spacing: 5))
    }

    @ViewBuilder
    func dosingRow(entry: DosingEntry, weightKg: Double?, contraindicated: Bool, labs: LabPanel = LabPanel()) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            dosingRowLayout {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text(entry.drug)
                            .scaledFont(size: 13, weight: .semibold)
                            .foregroundStyle(contraindicated ? .red : .primary)
                        if contraindicated {
                            Label("CONTRAINDICATED", systemImage: "exclamationmark.triangle.fill")
                                .scaledFont(size: 9, weight: .black)
                                .foregroundStyle(.white)
                                .padding(.horizontal, 5).padding(.vertical, 2)
                                .background(Color.red, in: Capsule())
                                .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                                .fixedSize()
                        }
                    }
                    Text(entry.indication)
                        .scaledFont(size: 11)
                        .foregroundStyle(.secondary)
                }
                if !dynamicTypeSize.isAccessibilitySize { Spacer() }
                VStack(alignment: dynamicTypeSize.isAccessibilitySize ? .leading : .trailing, spacing: 2) {
                    // Weight-adjusted dose if weight is known
                    if entry.weightBased, let wt = weightKg,
                       let num = parseWeightDoseMultiplier(entry.dose) {
                        let computed = num * wt
                        Text(String(format: "≈ %.0f mg", computed))
                            .scaledFont(size: 12, weight: .bold)
                            .foregroundStyle(.indigo)
                        Text(entry.dose)
                            .scaledFont(size: 10)
                            .foregroundStyle(.tertiary)
                    } else {
                        Text(entry.dose)
                            .scaledFont(size: 12, weight: .semibold)
                            .foregroundStyle(.primary)
                    }
                    Text(entry.route)
                        .scaledFont(size: 10)
                        .foregroundStyle(.secondary)
                }
            }

            // Caution badges with actual lab values where available
            let badges = cautionBadges(entry: entry, labs: labs)
            if !badges.isEmpty {
                badgeLayout {
                    ForEach(badges, id: \.0) { (label, color) in
                        Text(label)
                            .scaledFont(size: 9, weight: .semibold)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background(color, in: Capsule())
                            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                    }
                }
            }

            if let note = entry.notes {
                Text(note)
                    .scaledFont(size: 10)
                    .foregroundStyle(.orange)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 7)
        .padding(.horizontal, 2)
        .opacity(contraindicated ? 0.8 : 1.0)
        .accessibilityElement(children: .combine)
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

    /// Display only (hazard log H-07): shows which class each drug matched through, every
    /// merged effect, and the "absence of an alert" note. Never blocks or edits a prescription.
    @ViewBuilder
    func interactionsSection(_ alerts: [DrugInteractionAlert]) -> some View {
        Section {
            if alerts.isEmpty {
                InteractionAbsenceNote(noneFound: true)
            } else {
                ForEach(alerts) { alert in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 6) {
                            Image(systemName: alert.interaction.severity.icon)
                                .foregroundStyle(alert.interaction.severity.color)
                                .accessibilityHidden(true)
                            Text(alert.pairDisplay)
                                .font(.subheadline.weight(.semibold))
                            Spacer()
                            Text(alert.interaction.severity.rawValue)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(alert.interaction.severity.color)
                                .fixedSize()   // the severity never truncates; the drug pair wraps
                        }
                        Text(alert.interaction.clinicalEffect)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(alert.interaction.management)
                            .font(.caption.italic())
                            .foregroundStyle(.orange)
                        InteractionRelatedEffects(related: alert.related)
                    }
                    .padding(.vertical, 2)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(Text(InteractionAccessibility.label(for: alert, includeManagement: true)))
                    .accessibilityIdentifier("rx.interactionAlert")
                }
            }
        } header: {
            Label(interactionsHeaderTitle(count: alerts.count), systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
        } footer: {
            if !alerts.isEmpty {
                InteractionAbsenceNote()
            }
        }
    }

    private func interactionsHeaderTitle(count: Int) -> String {
        count == 0 ? "Drug Interactions" : "Drug Interactions (\(count))"
    }

    // MARK: - Prescription list

    /// Duration and indication side by side, or stacked at accessibility text sizes.
    private var rxMetaLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 2))
            : AnyLayout(HStackLayout(spacing: 8))
    }

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
                        rxMetaLayout {
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
                    .accessibilityElement(children: .combine)
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
