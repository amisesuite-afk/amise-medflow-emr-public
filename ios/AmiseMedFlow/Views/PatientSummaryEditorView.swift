import SwiftUI
import SwiftData
import UIKit

// MARK: - Editable clinical summary
// Persisted as a ClinicalNote(.clinicalSummary) in SwiftData — survives app restart.
// Export to PDF only on explicit user request; iCloud / NAS sync to be added later.

struct PatientSummaryEditorView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var ctx
    @Environment(\.dismiss) private var dismiss

    @StateObject private var ai = AIService()
    @State private var noteText: String = ""
    @State private var existingNote: ClinicalNote?
    @State private var pdfWrapper: PDFDataWrapper?
    @State private var showAIConfirm = false   // confirm overwrite if text already exists
    @State private var showError = false
    @FocusState private var editorFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                // ── Editor ───────────────────────────────────────────────
                TextEditor(text: $noteText)
                    .font(.system(.body))
                    .padding(.horizontal, 12)
                    .padding(.top, 8)
                    .focused($editorFocused)
                    .onChange(of: noteText) { save() }
                    .medicalDictation(mode: .clinicalSummary, patient: patient, text: $noteText)

                // ── Empty state ──────────────────────────────────────────
                if noteText.isEmpty && !ai.isGenerating {
                    VStack(spacing: 20) {
                        Image(systemName: "doc.text.fill")
                            .font(.system(size: 52))
                            .foregroundStyle(.tertiary)
                        Text("No summary yet")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text("Start typing, or let AI draft one from the patient's chart.")
                            .font(.subheadline)
                            .foregroundStyle(.tertiary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                        Button {
                            Task { await runAIAssist() }
                        } label: {
                            Label("Generate with AI", systemImage: "sparkles")
                                .font(.body.weight(.semibold))
                                .padding(.horizontal, 20)
                                .padding(.vertical, 10)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .allowsHitTesting(!ai.isGenerating)
                }

                // ── AI loading overlay ───────────────────────────────────
                if ai.isGenerating {
                    ZStack {
                        Color(.systemBackground).opacity(0.85)
                        VStack(spacing: 14) {
                            ProgressView()
                                .scaleEffect(1.3)
                            Text("AI is drafting your summary…")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .ignoresSafeArea()
                }
            }
            .navigationTitle("Clinical Summary")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { editorFocused = false; dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    HStack(spacing: 14) {
                        // AI Assist
                        Button {
                            if noteText.isEmpty {
                                Task { await runAIAssist() }
                            } else {
                                showAIConfirm = true
                            }
                        } label: {
                            Image(systemName: "sparkles")
                        }
                        .disabled(ai.isGenerating)
                        .help("Regenerate with AI")

                        // Export PDF
                        Button {
                            pdfWrapper = exportAsPDF()
                        } label: {
                            Image(systemName: "square.and.arrow.up")
                        }
                        .disabled(noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .help("Export as PDF")
                    }
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { editorFocused = false }
                }
            }
            .confirmationDialog(
                "Regenerate Summary?",
                isPresented: $showAIConfirm,
                titleVisibility: .visible
            ) {
                Button("Replace with AI draft", role: .destructive) {
                    Task { await runAIAssist() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will replace your current text with a new AI-generated draft.")
            }
            .alert("AI Error", isPresented: $showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(ai.error ?? "Unknown error")
            }
            .sheet(item: $pdfWrapper) { wrapper in
                ShareSheet(items: [wrapper.data as Any]).ignoresSafeArea()
            }
        }
        .onAppear { loadExisting() }
    }

    // MARK: - Persistence

    private func loadExisting() {
        if let note = patient.clinicalNotes.first(where: { $0.noteType == .clinicalSummary }) {
            existingNote = note
            noteText = note.freeText ?? ""
        }
    }

    private func save() {
        let note: ClinicalNote
        if let existing = existingNote {
            note = existing
        } else {
            note = ClinicalNote(noteType: .clinicalSummary, patient: patient)
            ctx.insert(note)
            existingNote = note
        }
        note.freeText = noteText
        note.updatedAt = .now
        note.pendingSync = true
        try? ctx.save()
    }

    // MARK: - AI

    private func runAIAssist() async {
        do {
            noteText = try await ai.generateClinicalSummary(patient: patient)
            save()
        } catch {
            ai.error = error.localizedDescription
            showError = true
        }
    }

    // MARK: - PDF export (only on demand)

    private func exportAsPDF() -> PDFDataWrapper? {
        let pageW: CGFloat = 595.2
        let pageH: CGFloat = 841.8
        let margin: CGFloat = 48
        let bodyW = pageW - margin * 2

        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pageW, height: pageH))
        let data = renderer.pdfData { ctx in
            let paragraphStyle = NSMutableParagraphStyle()
            paragraphStyle.lineSpacing = 3

            let headerAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 14, weight: .bold),
                .paragraphStyle: paragraphStyle
            ]
            let bodyAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 10),
                .paragraphStyle: paragraphStyle
            ]
            let footerAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 8),
                .foregroundColor: UIColor.secondaryLabel,
                .paragraphStyle: paragraphStyle
            ]

            func newPage() {
                ctx.beginPage()
            }

            @discardableResult
            func drawString(_ s: String, attrs: [NSAttributedString.Key: Any], x: CGFloat, y: CGFloat, width: CGFloat) -> CGFloat {
                let ns = NSAttributedString(string: s, attributes: attrs)
                let rect = ns.boundingRect(with: CGSize(width: width, height: .greatestFiniteMagnitude),
                                           options: [.usesLineFragmentOrigin], context: nil)
                ns.draw(in: CGRect(x: x, y: y, width: width, height: rect.height))
                return rect.height
            }

            newPage()
            var y: CGFloat = margin

            // Header
            let header = "AMISE MEDICAL SERVICES — \(patient.fullName.uppercased())"
            y += drawString(header, attrs: headerAttrs, x: margin, y: y, width: bodyW)
            y += 4
            let sub = "Clinical Summary  ·  \(DateFormatter.localizedString(from: .now, dateStyle: .long, timeStyle: .short))"
            y += drawString(sub, attrs: footerAttrs, x: margin, y: y, width: bodyW)
            y += 12

            // Separator
            UIColor.separator.setFill()
            UIRectFill(CGRect(x: margin, y: y, width: bodyW, height: 0.5))
            y += 12

            // Body — split by lines, start new page when needed
            let lines = noteText.components(separatedBy: "\n")
            for line in lines {
                let attrs: [NSAttributedString.Key: Any] = line == line.uppercased() && line.count > 2
                    ? headerAttrs : bodyAttrs
                let ns = NSAttributedString(string: line.isEmpty ? " " : line, attributes: attrs)
                let rect = ns.boundingRect(with: CGSize(width: bodyW, height: .greatestFiniteMagnitude),
                                           options: [.usesLineFragmentOrigin], context: nil)
                if y + rect.height > pageH - margin * 2 {
                    newPage()
                    y = margin
                }
                ns.draw(in: CGRect(x: margin, y: y, width: bodyW, height: rect.height))
                y += rect.height + (line.isEmpty ? 2 : 1)
            }

            // Footer
            let footerY = pageH - margin
            drawString("Amise Medical Services · Saint Lucia · Generated \(DateFormatter.localizedString(from: .now, dateStyle: .medium, timeStyle: .short))",
                       attrs: footerAttrs, x: margin, y: footerY - 16, width: bodyW)
        }
        return PDFDataWrapper(data: data)
    }
}
