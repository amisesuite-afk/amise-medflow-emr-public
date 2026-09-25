// CompleteEncounterSheet.swift
// "Review and complete" (UX review M8, iOS twin of the web sign-off dialog): before a visit is
// completed the clinician sees what is still missing, the allergy status, content the app filled
// in that nobody has edited, and the diagnosis and orders; then ticks the attestation. Only then
// is "Complete visit" enabled. Completing also saves the visit snapshot (as before).
// Nothing here edits the record: every gap is fixed back in the consultation.

import SwiftUI
import SwiftData

struct CompleteEncounterSheet: View {
    let patient: Patient
    let pathwayTitle: String
    let review: EncounterCompletionReview
    let onComplete: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var attested = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(patient.consultationTitle)
                            .font(.headline)
                        if !patient.consultationSubtitle.isEmpty {
                            Text(patient.consultationSubtitle)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        Text(pathwayTitle)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(AMColor.accent)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("consult.completeSheet.patient")
                }

                Section {
                    if review.missingSteps.isEmpty {
                        Label("Every pathway step has documentation", systemImage: "checkmark.circle")
                            .font(.subheadline)
                            .foregroundStyle(.green)
                    } else {
                        ForEach(review.missingSteps, id: \.self) { step in
                            Label(step, systemImage: "circle.dashed")
                                .font(.subheadline)
                                .foregroundStyle(.orange)
                        }
                    }
                } header: {
                    Text("Not yet documented")
                }
                .accessibilityIdentifier("consult.completeSheet.missing")

                Section {
                    Label(review.allergyText,
                          systemImage: review.allergyNeedsAttention ? "exclamationmark.triangle.fill" : "shield")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(review.allergyNeedsAttention ? Color.orange : Color.primary)
                } header: {
                    Text("Allergies")
                }

                if !review.unconfirmed.isEmpty {
                    Section {
                        ForEach(review.unconfirmed, id: \.self) { item in
                            Label(item, systemImage: "doc.badge.gearshape")
                                .font(.subheadline)
                        }
                    } header: {
                        Text("Filled in by the app, not yet edited")
                    } footer: {
                        Text("Check these against what you found. Edit or delete them in the consultation if they are not accurate.")
                    }
                    .accessibilityIdentifier("consult.completeSheet.unconfirmed")
                }

                Section {
                    Label(review.diagnosis ?? "No working diagnosis recorded", systemImage: "stethoscope")
                        .font(.subheadline)
                        .foregroundStyle(review.diagnosis == nil ? Color.secondary : Color.primary)
                    if !review.investigations.isEmpty {
                        Label("Investigations: " + review.investigations.joined(separator: ", "),
                              systemImage: "testtube.2")
                            .font(.subheadline)
                    }
                    if !review.prescriptions.isEmpty {
                        Label("Prescriptions: " + review.prescriptions.joined(separator: ", "),
                              systemImage: "pills")
                            .font(.subheadline)
                    }
                } header: {
                    Text("Diagnosis and orders")
                }

                Section {
                    Button {
                        attested.toggle()
                    } label: {
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: attested ? "checkmark.square.fill" : "square")
                                .font(.title3)
                                .foregroundStyle(attested ? AMColor.accent : Color.secondary)
                            Text(EncounterCompletionReview.attestation)
                                .font(.subheadline)
                                .foregroundStyle(.primary)
                                .multilineTextAlignment(.leading)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(EncounterCompletionReview.attestation)
                    .accessibilityValue(attested ? "Ticked" : "Not ticked")
                    .accessibilityAddTraits(attested ? .isSelected : [])
                    .accessibilityIdentifier("consult.completeSheet.attest")
                } footer: {
                    Text(EncounterCompletionReview.actionsExplanation)
                }

                Section {
                    Button {
                        onComplete()
                        dismiss()
                    } label: {
                        Label("Complete visit", systemImage: "checkmark.seal.fill")
                            .font(.body.weight(.semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(!attested)
                    .accessibilityHint(attested ? "Saves the visit snapshot and marks the visit complete"
                                                : "Tick the attestation first")
                    .accessibilityIdentifier("consult.completeSheet.confirm")
                }
            }
            .navigationTitle("Review and complete")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Back to visit") { dismiss() }
                        .accessibilityIdentifier("consult.completeSheet.cancel")
                }
            }
        }
    }
}
