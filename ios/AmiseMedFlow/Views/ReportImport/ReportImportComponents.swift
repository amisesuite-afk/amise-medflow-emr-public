// ReportImportComponents.swift
// Pieces shared by the lab and imaging import review screens: the patient identity card (with
// the explicit "This report belongs to …" confirmation), a PDFKit viewer, and colours.

import SwiftUI
import PDFKit

enum ReportImportStyle {
    // Initialiser colours (no .opacity() on Color: see CLAUDE.md "Color.opacity() ambiguity").
    static let abnormalRow = Color(red: 0.86, green: 0.15, blue: 0.15, opacity: 0.10)
    static let warningFill = Color(red: 0.96, green: 0.62, blue: 0.04, opacity: 0.14)
    static let dangerFill = Color(red: 0.73, green: 0.11, blue: 0.11, opacity: 0.12)
    static let okFill = Color(red: 0.0, green: 0.71, blue: 0.63, opacity: 0.12)

    static func dobText(_ d: ReportDate) -> String {
        String(format: "%02d/%02d/%04d", d.day, d.month, d.year)
    }

    static func chartDOBText(_ date: Date?) -> String {
        guard let date else { return "no DOB" }
        let f = DateFormatter()
        f.timeZone = TimeZone.ect
        f.dateFormat = "dd/MM/yyyy"
        return f.string(from: date)
    }

    static func sexLabel(_ s: Sex?) -> String {
        switch s {
        case .male?: return "M"
        case .female?: return "F"
        default: return "—"
        }
    }
}

/// Identity check against the chart. When anything conflicts or is missing, a prominent warning
/// and a confirmation toggle; nothing can be saved until it is ticked (enforced by the callers).
struct ReportIdentityCard: View {
    let check: ReportIdentityCheck
    let header: ReportHeader
    let patient: Patient
    @Binding var confirmed: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if check.isConsistent {
                Label("Name and date of birth match this chart", systemImage: "checkmark.seal.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AMColor.accentDk)
                if case .compatible(let note) = check.name {
                    Text("Name is similar but not identical (\(note)).")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else {
                Label("Check the patient before saving", systemImage: "exclamationmark.triangle.fill")
                    .font(.headline)
                    .foregroundStyle(AMColor.emergency)
                ForEach(check.messages, id: \.self) { m in
                    Text("• \(m)").font(.subheadline)
                }
            }
            comparison
            if check.requiresConfirmation {
                Toggle(isOn: $confirmed) {
                    Text("This report belongs to \(patient.isLive ? patient.fullName : "this patient")")
                        .font(.subheadline.weight(.semibold))
                }
                .tint(AMColor.emergency)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(check.isConsistent ? ReportImportStyle.okFill : ReportImportStyle.dangerFill,
                    in: RoundedRectangle(cornerRadius: 10))
    }

    private var comparison: some View {
        Grid(alignment: .leading, horizontalSpacing: 10, verticalSpacing: 4) {
            GridRow {
                Text("Report").font(.caption.weight(.bold)).foregroundStyle(.secondary)
                Text(header.patientName ?? "no name").font(.caption)
                Text(header.dateOfBirth.map { ReportImportStyle.dobText($0) } ?? (header.ageYears.map { "age \($0)" } ?? "no DOB"))
                    .font(.caption)
                Text(ReportImportStyle.sexLabel(header.sex)).font(.caption)
            }
            GridRow {
                Text("Chart").font(.caption.weight(.bold)).foregroundStyle(.secondary)
                Text(patient.isLive ? patient.fullName : "—").font(.caption)
                Text(ReportImportStyle.chartDOBText(patient.isLive ? patient.dateOfBirth : nil)).font(.caption)
                Text(patient.isLive ? ReportImportStyle.sexLabel(patient.sex) : "—").font(.caption)
            }
        }
    }
}

/// Read-only PDF view (PDFKit). No temporary copy of the file is written.
struct ReportPDFView: UIViewRepresentable {
    let data: Data

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.document = PDFDocument(data: data)
        return view
    }

    func updateUIView(_ uiView: PDFView, context: Context) {}
}

struct ReportPDFSheet: View {
    let data: Data
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ReportPDFView(data: data)
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle("Report PDF")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
                }
        }
    }
}

/// Small coloured caption for an issue on a row.
struct LabIssueLine: View {
    let issue: LabRowIssue

    var body: some View {
        Label(issue.message, systemImage: issue.isWarning ? "exclamationmark.triangle.fill" : "info.circle")
            .font(.caption2)
            .foregroundStyle(issue.isWarning ? Color.orange : Color.secondary)
    }
}
