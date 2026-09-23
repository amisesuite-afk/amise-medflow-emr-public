// BronchoscopyFormView+Sections.swift
// BronchoscopyFormView section views and helpers.

import SwiftUI
import SwiftData


extension BronchoscopyFormView {

    // MARK: - Sections

    var preProcedureSection: some View {
        Section("Pre-procedure") {
            Toggle("Consent obtained", isOn: $data.consent)

            if hasProcedureDate, let _ = data.dateOfProcedure {
                DatePicker("Date",
                           selection: Binding(
                               get: { data.dateOfProcedure ?? Date() },
                               set: { data.dateOfProcedure = $0 }),
                           displayedComponents: [.date, .hourAndMinute])
            } else {
                Button("Set Procedure Date") {
                    data.dateOfProcedure = Date()
                    hasProcedureDate = true
                }
            }

            TextField("Operator", text: $data.operator_)
            TextField("Assistant", text: $data.assistant)

            // Indication chips
            VStack(alignment: .leading, spacing: 6) {
                Text("Indication").font(.subheadline).foregroundStyle(.secondary)
                chipGrid(options: indications, selected: $data.indication)
                if data.indication.contains("Other") {
                    TextField("Specify…", text: $data.indicationOther)
                        .font(.footnote)
                }
            }
        }
    }

    var procedureSection: some View {
        Section("Procedure") {
            Picker("Approach", selection: $data.approach) {
                ForEach(approachOptions, id: \.self) { Text($0) }
            }
            Picker("Sedation", selection: $data.sedationUsed) {
                ForEach(sedationOptions, id: \.self) { Text($0) }
            }
            TextField("Sedation dose", text: $data.sedationDose)
            Picker("Oxygen", selection: $data.oxygenSupplementation) {
                ForEach(oxygenOptions, id: \.self) { Text($0) }
            }
            TextField("Bronchoscope model", text: $data.bronchoscopeModel)
            TextField("Duration (minutes)", text: $data.duration)
                .keyboardType(.numberPad)
            Picker("Quality", selection: $data.quality) {
                ForEach(["Good", "Adequate", "Poor", "Abandoned"], id: \.self) { Text($0) }
            }
        }
    }

    var upperAirwaySection: some View {
        Section("Upper Airway") {
            // Nasopharynx
            HStack {
                Text("Nasopharynx")
                Spacer()
                Toggle("Normal", isOn: $data.nasopharynxNormal)
            }
            if !data.nasopharynxNormal {
                TextField("Nasopharynx findings", text: $data.nasopharynxNotes, axis: .vertical)
                    .lineLimit(2...4)
            }

            // Vocal cords
            HStack {
                Text("Vocal Cords")
                Spacer()
                Toggle("Normal", isOn: $data.vocalCordsNormal)
            }
            if !data.vocalCordsNormal {
                chipGrid(options: vocalCordsOptions, selected: $data.vocalCordsFindings)
                TextField("Vocal cord notes", text: $data.vocalCordsNotes, axis: .vertical)
                    .lineLimit(2...4)
            }

            // Larynx (overall)
            HStack {
                Text("Larynx (overall)")
                Spacer()
                Toggle("Normal", isOn: $data.larynxNormal)
            }
            if !data.larynxNormal {
                TextField("Larynx findings", text: $data.larynxNotes, axis: .vertical)
                    .lineLimit(2...4)
            }
        }
    }

    @ViewBuilder
    var trachealSection: some View {
        Section("Trachea") {
            HStack {
                Text("Trachea")
                Spacer()
                Toggle("Normal", isOn: $data.tracheaNormal)
            }
            if !data.tracheaNormal {
                chipGrid(options: tracheaFindingOptions, selected: $data.tracheaFindings)
                TextField("Trachea notes", text: $data.tracheaNotes, axis: .vertical)
                    .lineLimit(2...4)
            }
        }

        Section("Carina") {
            HStack {
                Text("Carina")
                Spacer()
                Toggle("Normal", isOn: $data.carinaNormal)
            }
            if !data.carinaNormal {
                chipGrid(options: carinaFindingOptions, selected: $data.carinaFindings)
                TextField("Carina notes", text: $data.carinaNotes, axis: .vertical)
                    .lineLimit(2...4)
            }
        }
    }

    var rightTreeSection: some View {
        Section("Right Bronchial Tree") {
            HStack {
                Text("Right Main Bronchus")
                Spacer()
                Toggle("Normal", isOn: $data.rightMainNormal)
            }
            if !data.rightMainNormal {
                TextField("Right main findings", text: $data.rightMainNotes, axis: .vertical)
                    .lineLimit(2...4)
            }

            bronchialSubsegmentRow(
                label: "Right Upper Lobe (RB1–3)",
                normal: $data.rightUpperLobeNormal,
                findings: $data.rightUpperLobeFindings,
                notes: $data.rightUpperLobeNotes
            )
            bronchialSubsegmentRow(
                label: "Right Middle Lobe (RB4–5)",
                normal: $data.rightMiddleLobeNormal,
                findings: $data.rightMiddleLobeFindings,
                notes: $data.rightMiddleLobeNotes
            )
            bronchialSubsegmentRow(
                label: "Right Lower Lobe (RB6–10)",
                normal: $data.rightLowerLobeNormal,
                findings: $data.rightLowerLobeFindings,
                notes: $data.rightLowerLobeNotes
            )
        }
    }

    var leftTreeSection: some View {
        Section("Left Bronchial Tree") {
            HStack {
                Text("Left Main Bronchus")
                Spacer()
                Toggle("Normal", isOn: $data.leftMainNormal)
            }
            if !data.leftMainNormal {
                TextField("Left main findings", text: $data.leftMainNotes, axis: .vertical)
                    .lineLimit(2...4)
            }

            bronchialSubsegmentRow(
                label: "Left Upper Lobe + Lingula (LB1–5)",
                normal: $data.leftUpperLobeNormal,
                findings: $data.leftUpperLobeFindings,
                notes: $data.leftUpperLobeNotes
            )
            bronchialSubsegmentRow(
                label: "Left Lower Lobe (LB6–10)",
                normal: $data.leftLowerLobeNormal,
                findings: $data.leftLowerLobeFindings,
                notes: $data.leftLowerLobeNotes
            )
        }
    }

    var specimensSection: some View {
        Section("Specimens") {
            Toggle("BAL performed", isOn: $data.balPerformed)
            if data.balPerformed {
                TextField("BAL site (lobe/segment)", text: $data.balSite)
            }
            Toggle("Endobronchial biopsy taken", isOn: $data.biopsyTaken)
            if data.biopsyTaken {
                TextField("Biopsy sites", text: $data.biopsyNotes, axis: .vertical)
                    .lineLimit(2...4)
            }
            // Interventions picker
            VStack(alignment: .leading, spacing: 6) {
                Text("Interventions").font(.subheadline).foregroundStyle(.secondary)
                chipGrid(options: interventionOptions, selected: $data.interventionsDone)
            }
        }
    }

    var interventionsSection: some View {
        Section("Intervention Notes") {
            TextField("Details", text: $data.interventionNotes, axis: .vertical)
                .lineLimit(3...6)
        }
    }

    var complicationsSection: some View {
        Section("Complications") {
            Picker("Completion", selection: $data.completionStatus) {
                ForEach(["Complete", "Incomplete — poor visibility",
                         "Incomplete — patient tolerance", "Abandoned — complication"], id: \.self) { Text($0) }
            }
            chipGrid(options: complicationOptions, selected: $data.complications)
            if data.complications.contains(where: { $0 != "None" }) {
                TextField("Complication details", text: $data.complicationNotes, axis: .vertical)
                    .lineLimit(2...4)
            }
        }
    }

    var impressionSection: some View {
        Section("Impression & Plan") {
            if isAllNormal && data.impression.isEmpty {
                Button("Fill Normal Study") {
                    data.impression = normalImpressionText
                }
                .font(.subheadline)
                .foregroundStyle(.teal)
            }
            TextField("Impression", text: $data.impression, axis: .vertical)
                .lineLimit(3...8)
            TextField("Recommendations", text: $data.recommendations, axis: .vertical)
                .lineLimit(2...6)
            Picker("Follow-up", selection: $data.followUpWeeks) {
                ForEach(["1", "2", "4", "6", "8", "12"], id: \.self) {
                    Text("In \($0) weeks")
                }
                Text("As indicated").tag("PRN")
            }
        }
    }

    // MARK: - Helpers

    @ViewBuilder
    func bronchialSubsegmentRow(
        label: String,
        normal: Binding<Bool>,
        findings: Binding<[String]>,
        notes: Binding<String>
    ) -> some View {
        HStack {
            Text(label).font(.subheadline)
            Spacer()
            Toggle("Normal", isOn: normal)
        }
        if !normal.wrappedValue {
            chipGrid(options: airwayFindingOptions, selected: findings)
            TextField("\(label) notes", text: notes, axis: .vertical)
                .lineLimit(2...4)
        }
    }

    @ViewBuilder
    func chipGrid(options: [String], selected: Binding<[String]>) -> some View {
        FlowLayout(spacing: 6) {
            ForEach(options, id: \.self) { opt in
                let isOn = selected.wrappedValue.contains(opt)
                Button {
                    if isOn { selected.wrappedValue.removeAll { $0 == opt } }
                    else     { selected.wrappedValue.append(opt) }
                } label: {
                    Text(opt)
                        .font(.caption)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(isOn ? Color.teal.opacity(0.2) : Color.secondary.opacity(0.1),
                                    in: Capsule())
                        .foregroundStyle(isOn ? .teal : .secondary)
                }
                .buttonStyle(.plain)
            }
        }
    }

    var isAllNormal: Bool {
        data.nasopharynxNormal && data.larynxNormal && data.vocalCordsNormal &&
        data.tracheaNormal && data.carinaNormal &&
        data.rightMainNormal && data.rightUpperLobeNormal && data.rightMiddleLobeNormal && data.rightLowerLobeNormal &&
        data.leftMainNormal && data.leftUpperLobeNormal && data.leftLowerLobeNormal
    }

    var normalImpressionText: String {
        let op = data.operator_.isEmpty ? "Surgeon" : data.operator_
        return "Flexible bronchoscopy performed by \(op). " +
        "The nasopharynx, larynx, and vocal cords were normal with bilateral cord mobility confirmed. " +
        "The trachea was patent with a sharp, midline carina. " +
        "The right and left bronchial trees were systematically inspected to sub-segmental level. " +
        "No endobronchial lesion, mucosal abnormality, compression, or haemorrhage was identified. " +
        "Procedure completed successfully without complication."
    }

    func buildReportText() -> String {
        let fmt = DateFormatter()
        fmt.dateStyle = .long; fmt.timeStyle = .short
        fmt.timeZone = TimeZone(identifier: "America/St_Lucia")
        let dateStr = data.dateOfProcedure.map { fmt.string(from: $0) } ?? "—"

        var lines: [String] = [
            "BRONCHOSCOPY REPORT",
            "",
            "Patient: \(patient.fullName)  |  DOB: \(patient.formattedDOB)",
            "Date: \(dateStr)  |  Operator: \(data.operator_)  |  Assistant: \(data.assistant)",
            "Indication: \(data.indication.joined(separator: ", "))",
            "Approach: \(data.approach)  |  Sedation: \(data.sedationUsed)  |  Bronchoscope: \(data.bronchoscopeModel)",
            "",
            "FINDINGS:"
        ]
        func segLine(_ label: String, normal: Bool, findings: [String], notes: String) {
            if normal {
                lines.append("  \(label): Normal")
            } else {
                let f = (findings + (notes.isEmpty ? [] : [notes])).joined(separator: "; ")
                lines.append("  \(label): \(f)")
            }
        }
        segLine("Nasopharynx", normal: data.nasopharynxNormal, findings: [], notes: data.nasopharynxNotes)
        segLine("Vocal cords", normal: data.vocalCordsNormal, findings: data.vocalCordsFindings, notes: data.vocalCordsNotes)
        segLine("Trachea", normal: data.tracheaNormal, findings: data.tracheaFindings, notes: data.tracheaNotes)
        segLine("Carina", normal: data.carinaNormal, findings: data.carinaFindings, notes: data.carinaNotes)
        segLine("Right upper lobe", normal: data.rightUpperLobeNormal, findings: data.rightUpperLobeFindings, notes: data.rightUpperLobeNotes)
        segLine("Right middle lobe", normal: data.rightMiddleLobeNormal, findings: data.rightMiddleLobeFindings, notes: data.rightMiddleLobeNotes)
        segLine("Right lower lobe", normal: data.rightLowerLobeNormal, findings: data.rightLowerLobeFindings, notes: data.rightLowerLobeNotes)
        segLine("Left upper lobe", normal: data.leftUpperLobeNormal, findings: data.leftUpperLobeFindings, notes: data.leftUpperLobeNotes)
        segLine("Left lower lobe", normal: data.leftLowerLobeNormal, findings: data.leftLowerLobeFindings, notes: data.leftLowerLobeNotes)

        if data.balPerformed { lines.append("  BAL: Performed — site: \(data.balSite)") }
        if data.biopsyTaken  { lines.append("  Biopsy: \(data.biopsyNotes)") }
        if !data.interventionsDone.isEmpty {
            lines.append("  Interventions: \(data.interventionsDone.joined(separator: ", "))")
        }
        lines.append("")
        lines.append("Complications: \(data.complications.isEmpty ? "None" : data.complications.joined(separator: ", "))")
        lines.append("")
        lines.append("IMPRESSION: \(data.impression)")
        if !data.recommendations.isEmpty { lines.append("PLAN: \(data.recommendations)") }
        if !data.followUpWeeks.isEmpty   { lines.append("Follow-up: in \(data.followUpWeeks) weeks") }
        return lines.joined(separator: "\n")
    }

    func save() {
        patient.bronchoscopyData = data
        patient.updatedAt = .now
        patient.pendingSync = true
    }
}

// MARK: - FlowLayout helper (chip grid)

private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        var y: CGFloat = 0; var x: CGFloat = 0; var maxHeight: CGFloat = 0
        for view in subviews {
            let sz = view.sizeThatFits(.unspecified)
            if x + sz.width > width && x > 0 { x = 0; y += maxHeight + spacing; maxHeight = 0 }
            x += sz.width + spacing
            maxHeight = max(maxHeight, sz.height)
        }
        return CGSize(width: width, height: y + maxHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX; var y = bounds.minY; var maxHeight: CGFloat = 0
        for view in subviews {
            let sz = view.sizeThatFits(.unspecified)
            if x + sz.width > bounds.maxX && x > bounds.minX { x = bounds.minX; y += maxHeight + spacing; maxHeight = 0 }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(sz))
            x += sz.width + spacing
            maxHeight = max(maxHeight, sz.height)
        }
    }

}
