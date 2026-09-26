// ConsultationView+InvestigationsTab.swift
// Investigations tab and history bypass card.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - Investigations tab

    var investigationsTab: some View {
        List {
            // Results from the lab / imaging portals (PDF or pasted text, parsed on the device)
            Section {
                ReportImportMenu(patient: patient)
            } footer: {
                Text("Laboratory Services Ltd results or Tapion imaging reports. Read on this device; you review every value before it is saved.")
            }

            // CC-matched suggestions
            if let cc = patient.chiefComplaint,
               let suggestions = ccInvestigations[cc], !suggestions.isEmpty {
                let existing = Set(patient.investigations.map { $0.name })
                let toShow = suggestions.filter { !existing.contains($0.name) }
                if !toShow.isEmpty {
                    Section {
                        ChipFlow(hSpacing: 8, vSpacing: 8) {
                            ForEach(toShow, id: \.name) { inv in
                                Button { addInvestigation(name: inv.name, category: inv.category) } label: {
                                    HStack(spacing: 4) {
                                        Image(systemName: inv.category.icon).font(.system(size: 10))
                                        Text(inv.name).font(.system(size: 12))
                                    }
                                    .padding(.horizontal, 10).padding(.vertical, 5)
                                    .background(AMColor.accentLt, in: Capsule())
                                    .foregroundStyle(AMColor.accent)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 4)
                    } header: {
                        Label("Suggested for \(cc)", systemImage: "sparkles")
                    }
                }
            }

            // PMH-matched suggestions
            let pmhIx = pmhDerivedIxSuggestions
            if !pmhIx.isEmpty {
                Section {
                    ChipFlow(hSpacing: 8, vSpacing: 8) {
                        ForEach(pmhIx, id: \.name) { inv in
                            Button { addInvestigation(name: inv.name, category: inv.category) } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: inv.category.icon).font(.system(size: 10))
                                    Text(inv.name).font(.system(size: 12))
                                }
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(AMColor.accentLt, in: Capsule())
                                .foregroundStyle(AMColor.accent)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Label("From your PMH", systemImage: "cross.case")
                }
            }

            // Common baseline fallback — shown when CC has no matched suggestion set
            let hasCCMatch = patient.chiefComplaint.flatMap { ccInvestigations[$0] } != nil
            let existingNames = Set(patient.investigations.map { $0.name })
            let baselineToShow = commonBaselineInvs.filter { !existingNames.contains($0.name) }
            if !hasCCMatch && !baselineToShow.isEmpty {
                Section {
                    ChipFlow(hSpacing: 8, vSpacing: 8) {
                        ForEach(baselineToShow, id: \.name) { inv in
                            Button { addInvestigation(name: inv.name, category: inv.category) } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: inv.category.icon).font(.system(size: 10))
                                    Text(inv.name).font(.system(size: 12))
                                }
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(AMColor.accentLt, in: Capsule())
                                .foregroundStyle(AMColor.accent)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Label("Common Baseline Tests", systemImage: "list.bullet.clipboard")
                }
            }

            // Ordered / pending / resulted list
            let active = patient.investigations.filter { $0.status != .cancelled }
            if !active.isEmpty {
                Section {
                    ForEach(active) { inv in invRow(inv) }
                    .onDelete { idxSet in
                        let toRemove = idxSet.map { active[$0].id }
                        var list = patient.investigations
                        list.removeAll { toRemove.contains($0.id) }
                        patient.investigations = list; touch()
                    }
                } header: {
                    sectionHeader("Ordered Investigations (\(active.count))", icon: "flask",
                                  filled: !active.isEmpty)
                }
            }

            // Manual add
            Section {
                HStack(spacing: 10) {
                    TextField("Investigation name", text: $newInvName)
                        .autocorrectionDisabled()
                    Picker("", selection: $newInvCategory) {
                        ForEach(InvestigationEntry.InvCategory.allCases, id: \.self) { cat in
                            Label(cat.rawValue, systemImage: cat.icon).tag(cat)
                        }
                    }
                    .labelsHidden()
                    .frame(width: 90)
                    Button {
                        let trimmed = newInvName.trimmingCharacters(in: .whitespaces)
                        guard !trimmed.isEmpty else { return }
                        addInvestigation(name: trimmed, category: newInvCategory)
                        newInvName = ""
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(newInvName.isEmpty ? .secondary : AMColor.accent)
                            .font(.title3)
                    }
                    .disabled(newInvName.trimmingCharacters(in: .whitespaces).isEmpty)
                    .buttonStyle(.plain)
                }
            } header: {
                Label("Add Manually", systemImage: "plus.circle")
            }
        }
    }

    @ViewBuilder
    func invRow(_ inv: InvestigationEntry) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: inv.category.icon)
                    .foregroundStyle(invStatusColor(inv.status))
                    .frame(width: 20, alignment: .center)
                VStack(alignment: .leading, spacing: 1) {
                    Text(inv.name).font(.subheadline.weight(.medium))
                    Text(inv.source.map { "\(inv.category.rawValue) · \($0)" } ?? inv.category.rawValue)
                        .font(.caption2).foregroundStyle(.secondary)
                }
                Spacer()
                // Tappable status badge — tap to advance ordered → pending → resulted
                if inv.status.next != nil {
                    Button { advanceInvStatus(inv) } label: {
                        Text(inv.status.rawValue)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(invStatusColor(inv.status).opacity(0.15), in: Capsule())
                            .foregroundStyle(invStatusColor(inv.status))
                    }
                    .buttonStyle(.plain)
                } else {
                    Text(inv.status.rawValue)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(invStatusColor(inv.status).opacity(0.15), in: Capsule())
                        .foregroundStyle(invStatusColor(inv.status))
                }
            }
            if inv.status == .resulted || inv.status == .pending {
                TextField("Result / notes…",
                          text: Binding(
                            get: { inv.result },
                            set: { setInvResult(id: inv.id, result: $0) }
                          ),
                          axis: .vertical)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2...)
                    .padding(.leading, 28)
            }
            // Imaging study in the hospital portal (opens Safari; never fetched by MedFlow)
            if let link = inv.portalURL, case .success(let url) = PortalLink.validate(link) {
                Link(destination: url) {
                    Label("Open in portal", systemImage: "safari")
                        .font(.caption.weight(.semibold))
                }
                .buttonStyle(.borderless)
                .padding(.leading, 28)
            }
            // Inline critical value badge and trend arrow
            if inv.status == .resulted && !inv.result.isEmpty {
                let singleLabs = LabPanel.parse(from: [inv])
                HStack(spacing: 6) {
                    if singleLabs.hasCriticalValues {
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 9, weight: .bold))
                            Text("CRITICAL VALUE")
                                .font(.system(size: 9, weight: .black))
                                .tracking(0.3)
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(Color.red, in: Capsule())
                    }
                    if let trend = labTrend(for: inv) {
                        HStack(spacing: 3) {
                            Text(trend.arrow)
                                .font(.system(size: 10, weight: .bold))
                            Text(trend.deltaText)
                                .font(.system(size: 10))
                        }
                        .foregroundStyle(trend.color)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(trend.color.opacity(0.12), in: Capsule())
                    }
                }
                .padding(.leading, 28)
            }
        }
        .padding(.vertical, 2)
    }

    struct LabTrend {
        let arrow: String
        let deltaText: String
        let color: Color
    }

    func parseFirstNumber(_ text: String) -> Double? {
        var numStr = ""
        var foundDigit = false
        for scalar in text.unicodeScalars {
            let c = Character(scalar)
            if c.isNumber { numStr.append(c); foundDigit = true }
            else if c == "." && foundDigit { numStr.append(c) }
            else if foundDigit { break }
        }
        return foundDigit ? Double(numStr) : nil
    }

    func labTrend(for inv: InvestigationEntry) -> LabTrend? {
        guard inv.status == .resulted else { return nil }
        guard let cur = parseFirstNumber(inv.result) else { return nil }
        let prior = patient.investigations
            .filter {
                $0.status == .resulted &&
                $0.id != inv.id &&
                $0.name.lowercased() == inv.name.lowercased()
            }
            .sorted { ($0.resultedAt ?? $0.orderedAt) < ($1.resultedAt ?? $1.orderedAt) }
            .compactMap { parseFirstNumber($0.result) }
            .last
        guard let prev = prior else { return nil }
        let delta = cur - prev
        let pct = prev != 0 ? abs(delta / prev * 100) : 0
        let deltaText = String(format: "%.0f%%", pct)
        if abs(delta) < prev * 0.03 {
            return LabTrend(arrow: "→", deltaText: "stable", color: .secondary)
        } else if delta > 0 {
            return LabTrend(arrow: "↑", deltaText: "+\(deltaText)", color: .orange)
        } else {
            return LabTrend(arrow: "↓", deltaText: "-\(deltaText)", color: .blue)
        }
    }

    func invStatusColor(_ status: InvestigationEntry.InvStatus) -> Color {
        switch status {
        case .suggested: return .secondary
        case .ordered:   return .blue
        case .pending:   return .orange
        case .resulted:  return .green
        case .cancelled: return .red
        }
    }

    func addInvestigation(name: String, category: InvestigationEntry.InvCategory) {
        var list = patient.investigations
        list.append(InvestigationEntry(
            name: name, category: category, status: .ordered,
            suggestedFor: patient.chiefComplaint ?? ""
        ))
        patient.investigations = list; touch()
    }

    func advanceInvStatus(_ inv: InvestigationEntry) {
        guard let next = inv.status.next else { return }
        var list = patient.investigations
        if let idx = list.firstIndex(where: { $0.id == inv.id }) {
            list[idx].status = next
            if next == .resulted { list[idx].resultedAt = Date() }
        }
        patient.investigations = list; touch()
        // Fire critical value alert when status just reached .resulted
        if next == .resulted {
            let labs = LabPanel.parse(from: list)
            if labs.hasCriticalValues {
                var parts: [String] = []
                if let hb = labs.haemoglobin, hb.value < 8   { parts.append("Hb \(String(format: "%.1f", hb.value)) g/dL") }
                if let pl = labs.platelets,  pl.value < 50   { parts.append("Plt \(Int(pl.value)) ×10⁹/L") }
                if let cr = labs.creatinine, cr.value > 300  { parts.append("Creatinine \(Int(cr.value)) µmol/L") }
                if let ir = labs.inr,        ir.value > 2.5  { parts.append("INR \(String(format: "%.1f", ir.value))") }
                if let na = labs.sodium, na.value < 120 || na.value > 155 { parts.append("Na \(Int(na.value)) mmol/L") }
                if let k  = labs.potassium,  k.value < 2.5 || k.value > 6.0  { parts.append("K \(String(format: "%.1f", k.value)) mmol/L") }
                if let la = labs.lactate,    la.value >= 4.0 { parts.append("Lactate \(String(format: "%.1f", la.value)) mmol/L") }
                if let tr = labs.troponin,   tr.value > 52   { parts.append("Troponin \(Int(tr.value)) ng/L") }
                if let ca = labs.calcium, ca.value < 1.75 || ca.value > 3.0 { parts.append("Ca \(String(format: "%.2f", ca.value)) mmol/L") }
                if let gl = labs.glucose,  gl.value < 3.0 || gl.value > 20.0 { parts.append("Glucose \(String(format: "%.1f", gl.value)) mmol/L") }
                criticalLabAlert = parts.isEmpty ? "Critical value detected — review results." : parts.joined(separator: "\n")
            }
        }
    }

    func setInvResult(id: UUID, result: String) {
        var list = patient.investigations
        if let idx = list.firstIndex(where: { $0.id == id }) {
            list[idx].result = result
        }
        patient.investigations = list; touch()
    }

    // MARK: - History bypass card

    @ViewBuilder
    func historyBypassCard(title: String, subtitle: String, onConfirm: @escaping () -> Void) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark.seal.fill")
                .foregroundStyle(.green).font(.title3)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Button("Confirm") { onConfirm() }
                .font(.caption.weight(.semibold))
                .foregroundStyle(AMColor.accent)
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(AMColor.accentLt, in: Capsule())
        }
        .padding(.vertical, 4)
    }

    // MARK: - Append chip list to a history field

    func appendHistory(existing: String?, chips: Set<String>, write: (String) -> Void) {
        let lines = chips.sorted().map { "· \($0)" }.joined(separator: "\n")
        write((existing ?? "").isEmpty ? lines : (existing ?? "") + "\n" + lines)
    }


}
