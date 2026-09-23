// WardRoundView+DischargeSheet.swift
// Discharge flow sheet view — pre-fills a discharge summary note and
// triggers the patient discharge action.

import SwiftUI
import SwiftData


// MARK: - Discharge flow sheet

struct DischargeFlowSheet: View {
    let patient: Patient
    let note: ClinicalNote
    let onDischarge: (Patient) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var text: String

    init(patient: Patient, note: ClinicalNote, onDischarge: @escaping (Patient) -> Void) {
        self.patient = patient
        self.note = note
        self.onDischarge = onDischarge
        _text = State(initialValue: note.freeText ?? "")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                TextEditor(text: $text)
                    .font(.system(.body, design: .monospaced))
                    .frame(minHeight: 520)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
            }
            .navigationTitle("Discharge Summary")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Save Draft") {
                        // Save draft note, discharge patient
                        note.freeText = text
                        note.updatedAt = .now
                        note.pendingSync = true
                        onDischarge(patient)
                        dismiss()
                    }
                    .foregroundStyle(.secondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sign & Discharge") {
                        note.freeText = text
                        note.status = .signed
                        note.updatedAt = .now
                        note.pendingSync = true
                        onDischarge(patient)
                        dismiss()
                    }
                    .foregroundStyle(.teal)
                    .fontWeight(.semibold)
                }
            }
        }
    }
}
