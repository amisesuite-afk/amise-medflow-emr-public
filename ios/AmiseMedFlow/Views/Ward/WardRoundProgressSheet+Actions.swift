// WardRoundProgressSheet+Actions.swift
// Action buttons and sign-off logic for WardRoundProgressSheet.

import SwiftUI
import SwiftData


extension WardRoundProgressSheet {

    // MARK: - Actions

    var actionsSection: some View {
        Section {
            Button {
                showFullRecord = true
            } label: {
                HStack {
                    Image(systemName: "doc.richtext")
                        .foregroundStyle(AMColor.accent)
                    Text("Open Full Patient Record")
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") { dismiss() }
                .foregroundStyle(.secondary)
        }
        ToolbarItem(placement: .confirmationAction) {
            Button {
                signAndReview()
            } label: {
                Label("Sign & Reviewed", systemImage: "signature")
                    .font(.subheadline.weight(.semibold))
            }
            .foregroundStyle(AMColor.accent)
            .disabled(isNoteEmpty)
        }
    }

    // MARK: - Logic

    var isNoteEmpty: Bool {
        [subjective, objective, assessment, plan].allSatisfy {
            $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    func prefillSOAP() {
        let draft = SOAPDraftEngine.draft(patient: patient)
        // Only pre-fill fields that are still empty (don't overwrite any edits)
        if subjective.isEmpty { subjective = draft.s }
        if objective.isEmpty  { objective  = draft.o }
        if assessment.isEmpty { assessment = draft.a }
        if plan.isEmpty       { plan       = draft.p }
    }

    func signAndReview() {
        let note = ClinicalNote(noteType: .progress, patient: patient)
        note.subjective  = subjective.isEmpty ? nil : subjective
        note.objective   = objective.isEmpty  ? nil : objective
        note.assessment  = assessment.isEmpty ? nil : assessment
        note.plan        = plan.isEmpty       ? nil : plan
        note.status      = .signed
        note.updatedAt   = .now
        note.pendingSync = true
        context.insert(note)
        patient.updatedAt   = .now
        patient.pendingSync = true
        signed = true
        onMarkReviewed(patient)
        dismiss()
    }

}
