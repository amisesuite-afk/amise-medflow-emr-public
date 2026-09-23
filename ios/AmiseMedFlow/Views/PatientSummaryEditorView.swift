import SwiftUI
import SwiftData

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

    // MARK: - AI / local draft

    private func runAIAssist() async {
        do {
            noteText = try await ai.generateClinicalSummary(patient: patient)
            save()
        } catch is AIError {
            // AI is disabled pending HIPAA BAA — fall back to narrative summary local draft
            noteText = SOAPDraftEngine.narrativeSummary(patient: patient)
            save()
        } catch {
            ai.error = error.localizedDescription
            showError = true
        }
    }

    // MARK: - PDF export (only on demand)

    private func exportAsPDF() -> PDFDataWrapper? {
        // Ensure the note is saved with current text before exporting
        save()
        guard let note = existingNote ?? patient.clinicalNotes.first(where: { $0.noteType == .clinicalSummary }) else { return nil }
        let data = ClinicalNotePDF.generate(note: note, patient: patient)
        return PDFDataWrapper(data: data)
    }
}
