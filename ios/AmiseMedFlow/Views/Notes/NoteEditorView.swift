import SwiftUI
import SwiftData

struct NoteEditorView: View {
    @Bindable var note: ClinicalNote
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) var context
    @State private var isDrafting = false

    @State private var showAIOptions        = false
    @State private var aiError: String?
    @State private var showError            = false
    @State private var showShareSheet       = false
    @State private var shareURL: URL?
    @State private var isExportingPDF       = false
    @State private var showReferralSheet    = false
    @State private var referralSpecialty    = ""
    @State private var referralReason       = ""
    @State private var showDischargeSheet   = false
    @State private var dischargeTreatment   = ""
    @State private var dischargeFollowUp    = ""

    private let soapPlaceholders = (
        s: "What the patient reports — symptoms, history, concerns",
        o: "Vital signs, examination findings, investigation results",
        a: "Impression, working diagnosis, problem list",
        p: "Management plan — investigations, medications, follow-up, referrals"
    )

    var body: some View {
        NavigationStack {
            Group {
                if note.status == .signed {
                    // Signed notes are read-only — display only
                    signedNoteView
                } else if note.noteType.isStructured {
                    soapForm
                } else {
                    freeTextForm
                }
            }
            .navigationTitle(note.noteType.label)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(note.status == .signed ? "Close" : "Cancel") { dismiss() }
                }
                if note.status != .signed {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            note.updatedAt = .now
                            note.pendingSync = true
                            dismiss()
                        }
                    }
                }
                ToolbarItem(placement: .bottomBar) {
                    HStack {
                        if note.status == .signed {
                            // Signed badge + addendum button
                            Label("Signed", systemImage: "lock.fill")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.green)
                            Spacer()
                            Button {
                                createAddendum()
                            } label: {
                                Label("Addendum", systemImage: "plus.bubble")
                                    .font(.caption)
                            }
                            .foregroundStyle(.teal)
                        } else {
                            statusPicker
                        }
                        Spacer()
                        Button {
                            Task { await exportPDF() }
                        } label: {
                            HStack(spacing: 4) {
                                if isExportingPDF { ProgressView().scaleEffect(0.7) }
                                Label("PDF", systemImage: "arrow.up.doc.fill")
                                    .font(.caption)
                            }
                        }
                        .disabled(isExportingPDF || note.isEmpty || note.patient == nil)
                        .foregroundStyle(.indigo)

                        if note.status != .signed {
                            Button {
                                showAIOptions = true
                            } label: {
                                HStack(spacing: 4) {
                                    if isDrafting { ProgressView().scaleEffect(0.7) }
                                    Label("Draft", systemImage: "doc.text.magnifyingglass")
                                        .font(.caption)
                                }
                            }
                            .disabled(isDrafting || note.patient == nil)
                            .foregroundStyle(.teal)
                        }
                    }
                }
            }
            .confirmationDialog("Draft — \(note.noteType.label)", isPresented: $showAIOptions, titleVisibility: .visible) {
                if note.noteType.isStructured, let patient = note.patient {
                    Button("Auto-fill SOAP from chart") { Task { await generateSOAP(patient: patient) } }
                }
                if note.noteType == .referralLetter {
                    Button("Draft referral letter…") { showReferralSheet = true }
                } else if note.noteType == .discharge {
                    Button("Draft discharge summary…") { showDischargeSheet = true }
                } else if let patient = note.patient {
                    Button("Draft from chart data") { Task { await generateFreeText(patient: patient) } }
                }
                Button("Cancel", role: .cancel) {}
            }
            .alert("Draft Error", isPresented: $showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(aiError ?? "Unknown error")
            }
            .sheet(isPresented: $showShareSheet) {
                if let url = shareURL {
                    ShareSheet(items: [url])
                        .presentationDetents([.medium, .large])
                }
            }
            .sheet(isPresented: $showReferralSheet) {
                if let patient = note.patient {
                    ReferralParamsSheet(
                        specialty: $referralSpecialty,
                        reason: $referralReason
                    ) {
                        showReferralSheet = false
                        Task { await generateReferralNote(patient: patient) }
                    }
                }
            }
            .sheet(isPresented: $showDischargeSheet) {
                if let patient = note.patient {
                    DischargeParamsSheet(
                        treatment: $dischargeTreatment,
                        followUp: $dischargeFollowUp
                    ) {
                        showDischargeSheet = false
                        Task { await generateDischargeSummaryNote(patient: patient) }
                    }
                }
            }
        }
    }
}
