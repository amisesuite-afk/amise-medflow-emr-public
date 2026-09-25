// LabReportReviewView.swift
// Review of a parsed lab report before anything is saved: every row editable (analyte, value,
// unit, range, flag, collection date), included or excluded, abnormal values highlighted,
// flagged rows explained. Save is disabled until the identity check passes or is confirmed and
// any flagged rows that stay ticked have been checked. The caller performs the save.

import SwiftUI

struct LabReportReviewView: View {
    @Binding var draft: LabImportDraft
    let patient: Patient
    let existing: [InvestigationEntry]
    let pdfData: Data?
    /// Nurse or doctor: may save results. Front desk may only attach the PDF.
    let canSaveResults: Bool
    let onSave: () -> Void

    @State private var editingRowID: UUID?
    @State private var showPDF = false

    private var identity: ReportIdentityCheck {
        PatientIdentityMatcher.check(header: draft.header, chartName: patient.fullName,
                                     chartDOB: patient.dateOfBirth, chartSex: patient.sex,
                                     timeZones: [TimeZone.ect, TimeZone(identifier: "UTC")!])
    }

    private var includedCount: Int { draft.includedRows.count }
    private var flaggedCount: Int { draft.flaggedIncludedCount(existing: existing) }
    private var needsCheckTick: Bool { flaggedCount > 0 || draft.origin == .ocr }

    private var criticalRowIDs: Set<UUID> {
        Set(draft.includedRows.filter { row in
            let entry = ReportImportBuilder.labEntry(row: row, reportedAt: nil, accession: "",
                                                     source: "", documentId: nil)
            return LabPanel.parse(from: [entry]).hasCriticalValues
        }.map(\.id))
    }

    private var canSave: Bool {
        guard patient.isLive, !StoreHealth.blocksNewClinicalData else { return false }
        if identity.requiresConfirmation && !draft.identityConfirmed { return false }
        if canSaveResults {
            if includedCount > 0 && needsCheckTick && !draft.flaggedChecked { return false }
            return includedCount > 0 || pdfData != nil
        }
        return pdfData != nil
    }

    private var saveTitle: String {
        if !canSaveResults || includedCount == 0 { return "Attach PDF" }
        return includedCount == 1 ? "Save 1 result" : "Save \(includedCount) results"
    }

    var body: some View {
        List {
            Section {
                ReportIdentityCard(check: identity, header: draft.header, patient: patient,
                                   confirmed: $draft.identityConfirmed)
                    .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
            }

            if draft.origin == .ocr {
                Section {
                    Label("Read from a scanned image on this device. Check every value against the PDF.",
                          systemImage: "text.viewfinder")
                        .font(.subheadline)
                        .foregroundStyle(.orange)
                }
            }
            if draft.layoutWarning {
                Section {
                    Label("The table layout could not be read reliably. Compare with the PDF, or add the values by hand.",
                          systemImage: "tablecells.badge.ellipsis")
                        .font(.subheadline)
                        .foregroundStyle(.orange)
                }
            }
            if !canSaveResults {
                Section {
                    Label("Only a nurse or doctor can save results. You can attach the PDF to the record.",
                          systemImage: "lock")
                        .font(.subheadline)
                }
            }

            Section("Report") {
                TextField("Lab number", text: $draft.accession)
                    .autocorrectionDisabled()
                DatePicker("Collected", selection: $draft.collectedAt)
                Button("Use this collection time for every row") {
                    for i in draft.rows.indices { draft.rows[i].collectedAt = draft.collectedAt }
                }
                .font(.subheadline)
                if let reported = draft.reportedAt {
                    LabeledContent("Reported", value: reported.formatted(date: .abbreviated, time: .shortened))
                }
                if let pdfData {
                    Button { showPDF = true } label: { Label("View PDF", systemImage: "doc.richtext") }
                        .sheet(isPresented: $showPDF) { ReportPDFSheet(data: pdfData) }
                }
            }

            if !criticalRowIDs.isEmpty {
                Section {
                    Label("Critical value in this report — review the highlighted rows.",
                          systemImage: "exclamationmark.octagon.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AMColor.emergency)
                }
            }

            Section {
                if draft.rows.isEmpty {
                    Text("No results were read from the text. Add them by hand, or attach the PDF only.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                ForEach($draft.rows) { $row in
                    LabReviewRow(row: $row, existing: existing,
                                 isCritical: criticalRowIDs.contains(row.id),
                                 onEdit: { editingRowID = row.id })
                }
                .onDelete { draft.rows.remove(atOffsets: $0) }
                Button {
                    let new = LabImportRow(include: true, reportLabel: "", analyteKey: nil, name: "",
                                           valueText: "", unit: "", referenceRange: "", flag: "",
                                           comment: "", collectedAt: draft.collectedAt,
                                           specimen: .blood, sourceLine: "")
                    draft.rows.append(new)
                    editingRowID = new.id
                } label: {
                    Label("Add a result by hand", systemImage: "plus.circle")
                }
            } header: {
                Text("Results (\(includedCount) of \(draft.rows.count) ticked)")
            } footer: {
                Text("Unticked rows are not saved. Abnormal values are highlighted. Tap a row to edit it.")
            }

            if canSaveResults && includedCount > 0 && needsCheckTick {
                Section {
                    Toggle(isOn: $draft.flaggedChecked) {
                        Text(draft.origin == .ocr
                             ? "I have checked every ticked value against the PDF"
                             : "I have checked the \(flaggedCount) flagged value\(flaggedCount == 1 ? "" : "s") I am saving")
                            .font(.subheadline.weight(.semibold))
                    }
                }
            }

            Section {
                Button(action: onSave) {
                    Text(saveTitle).frame(maxWidth: .infinity).font(.headline)
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canSave)
                .listRowBackground(Color.clear)
            } footer: {
                if StoreHealth.blocksNewClinicalData {
                    Text(StoreHealth.blockedAlertMessage)
                } else {
                    Text("Source: \(ReportImportBuilder.labSource(origin: draft.origin, hasPDF: pdfData != nil)). Nothing is saved until you tap \(saveTitle).")
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(saveTitle, action: onSave).disabled(!canSave)
            }
        }
        .sheet(item: Binding(
            get: { editingRowID.map { IdentifiedUUID(id: $0) } },
            set: { editingRowID = $0?.id }
        )) { item in
            LabRowEditor(row: rowBinding(item.id), existing: existing,
                         onDelete: {
                             editingRowID = nil
                             draft.rows.removeAll { $0.id == item.id }
                         })
        }
    }

    /// Binding by id (not by index), so removing a row while its editor closes cannot crash.
    private func rowBinding(_ id: UUID) -> Binding<LabImportRow> {
        Binding(
            get: {
                draft.rows.first { $0.id == id }
                    ?? LabImportRow(id: id, include: false, reportLabel: "", analyteKey: nil, name: "",
                                    valueText: "", unit: "", referenceRange: "", flag: "", comment: "",
                                    collectedAt: draft.collectedAt, specimen: .blood, sourceLine: "")
            },
            set: { new in
                if let i = draft.rows.firstIndex(where: { $0.id == id }) { draft.rows[i] = new }
            })
    }
}

struct IdentifiedUUID: Identifiable {
    let id: UUID
}

// MARK: - One row

private struct LabReviewRow: View {
    @Binding var row: LabImportRow
    let existing: [InvestigationEntry]
    let isCritical: Bool
    let onEdit: () -> Void

    var body: some View {
        let a = row.assessment(existing: existing)
        HStack(alignment: .top, spacing: 10) {
            Toggle("Include", isOn: $row.include)
                .labelsHidden()
                .toggleStyle(.switch)
                .fixedSize()
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(row.savedName.isEmpty ? "Name needed" : row.savedName)
                        .font(.subheadline.weight(.semibold))
                    if row.analyteKey == nil {
                        Text("UNMAPPED")
                            .font(.system(size: 9, weight: .heavy))
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background(ReportImportStyle.warningFill, in: Capsule())
                    }
                    if isCritical {
                        Text("CRITICAL")
                            .font(.system(size: 9, weight: .heavy))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background(Color.red, in: Capsule())
                    }
                }
                HStack(spacing: 8) {
                    Text("\(row.valueText) \(row.unit)".trimmingCharacters(in: .whitespaces))
                        .font(.subheadline.monospacedDigit().weight(a.abnormality.isAbnormal ? .bold : .regular))
                        .foregroundStyle(a.abnormality.isAbnormal ? AMColor.emergency : Color.primary)
                    if !row.flag.isEmpty || a.abnormality.isAbnormal {
                        Text(row.flag.isEmpty ? a.abnormality.label : row.flag)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(AMColor.emergency)
                    }
                    if !row.referenceRange.isEmpty {
                        Text("ref \(row.referenceRange)").font(.caption).foregroundStyle(.secondary)
                    }
                }
                if let note = a.conversionNote {
                    Text("Saves as \(a.storedValue) \(a.storedUnit) (\(note))")
                        .font(.caption2).foregroundStyle(.secondary)
                }
                if row.reportLabel.lowercased() != row.savedName.lowercased(), !row.reportLabel.isEmpty {
                    Text("Printed as “\(row.reportLabel)”").font(.caption2).foregroundStyle(.secondary)
                }
                Text(row.collectedAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption2).foregroundStyle(.secondary)
                ForEach(Array(a.issues.enumerated()), id: \.offset) { _, issue in
                    LabIssueLine(issue: issue)
                }
            }
            Spacer(minLength: 0)
            Button(action: onEdit) {
                Image(systemName: "square.and.pencil").font(.title3)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("Edit row")
        }
        .opacity(row.include ? 1 : 0.55)
        .listRowBackground(a.abnormality.isAbnormal || isCritical ? ReportImportStyle.abnormalRow : nil)
    }
}

// MARK: - Row editor

private struct LabRowEditor: View {
    @Binding var row: LabImportRow
    let existing: [InvestigationEntry]
    let onDelete: () -> Void
    @Environment(\.dismiss) private var dismiss

    private static let analytes: [LabAnalyte] = LabAnalyteCatalog.all.sorted {
        $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
    }

    private static func pickerName(_ a: LabAnalyte) -> String {
        a.key == "bun" ? "Urea (from BUN)" : a.name
    }

    var body: some View {
        let a = row.assessment(existing: existing)
        NavigationStack {
            Form {
                Section {
                    Toggle("Include this result", isOn: $row.include)
                }
                Section("Analyte") {
                    Picker("Saved as", selection: $row.analyteKey) {
                        Text("Unmapped (keep the name below)").tag(String?.none)
                        ForEach(Self.analytes, id: \.key) { analyte in
                            Text(Self.pickerName(analyte)).tag(Optional(analyte.key))
                        }
                    }
                    .pickerStyle(.navigationLink)
                    if row.analyteKey == nil {
                        TextField("Name", text: $row.name)
                            .autocorrectionDisabled()
                    }
                    if !row.reportLabel.isEmpty {
                        LabeledContent("Printed as", value: row.reportLabel)
                    }
                }
                Section("Result") {
                    TextField("Value", text: $row.valueText)
                        .keyboardType(.numbersAndPunctuation)
                        .autocorrectionDisabled()
                    TextField("Unit", text: $row.unit)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    TextField("Reference range", text: $row.referenceRange)
                        .autocorrectionDisabled()
                    TextField("Flag (H, L, …)", text: $row.flag)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.characters)
                    DatePicker("Collected", selection: $row.collectedAt)
                    if let unit = LabAnalyteCatalog.analyte(forKey: row.analyteKey)?.appUnit, !unit.isEmpty {
                        LabeledContent("MedFlow unit", value: unit)
                    }
                    if let note = a.conversionNote {
                        LabeledContent("Saved as", value: "\(a.storedValue) \(a.storedUnit)")
                        Text(note).font(.caption).foregroundStyle(.secondary)
                    }
                }
                if !a.issues.isEmpty {
                    Section("Check") {
                        ForEach(Array(a.issues.enumerated()), id: \.offset) { _, issue in
                            LabIssueLine(issue: issue)
                        }
                    }
                }
                if !row.sourceLine.isEmpty {
                    Section("Line in the report") {
                        Text(row.sourceLine).font(.system(.caption, design: .monospaced))
                    }
                }
                Section {
                    Button("Remove this row", role: .destructive) { onDelete() }
                }
            }
            .navigationTitle(row.savedName.isEmpty ? "Result" : row.savedName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}
