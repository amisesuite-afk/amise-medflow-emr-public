// AdaptiveQuestionnaireSheet.swift
// Adaptive pre-encounter questionnaire sheet and reusable checkbox grid.

import SwiftUI
import SwiftData

struct AdaptiveQuestionnaireSheet: View {
    var patient: Patient?

    @Environment(\.dismiss) var dismiss
    @Environment(\.modelContext) var context
    @EnvironmentObject var sync: SyncService

    @State var answers = EncounterAnswers()
    @State var currentStepIndex = 0
    @State var symptomFilter = ""
    @State var prescriptionPhotoItem: PhotosPickerItem?
    @State var prescriptionImageData: Data?

    // Patient demographics used for gating — resolved once from the model
    var patientSex: Sex { patient?.sex ?? .unspecified }
    var patientAge: Int {
        guard let dob = patient?.dateOfBirth else { return 99 }
        return Calendar.ect.dateComponents([.year], from: dob, to: .now).year ?? 99
    }

    // MARK: Step sequencing

    private enum QPhase: Equatable {
        case cc, socrates, symptoms, redFlags, pmhx, social
        var title: String {
            switch self {
            case .cc:       "Chief Complaint"
            case .socrates: "Pain Details"
            case .symptoms: "Associated Symptoms"
            case .redFlags: "Red Flags"
            case .pmhx:     "Medical History"
            case .social:   "Social History"
            }
        }
        var icon: String {
            switch self {
            case .cc:       "text.bubble"
            case .socrates: "waveform.path.ecg"
            case .symptoms: "checklist"
            case .redFlags: "exclamationmark.triangle"
            case .pmhx:     "cross.case"
            case .social:   "person.2"
            }
        }
    }

    var phases: [QPhase] {
        var result: [QPhase] = [.cc]
        if let cc = answers.ccCategory {
            if cc.isPainType { result.append(.socrates) }
            result += [.symptoms, .redFlags]
        }
        result += [.pmhx, .social]
        return result
    }

    var safeIndex: Int { min(currentStepIndex, phases.count - 1) }
    var currentPhase: QPhase { phases[safeIndex] }
    var isLastStep: Bool { safeIndex >= phases.count - 1 }

    var canAdvance: Bool {
        if currentPhase == .cc {
            return answers.ccCategory != nil ||
                   !answers.ccClarification.trimmingCharacters(in: .whitespaces).isEmpty
        }
        return true
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // ── Step progress strip ───────────────────────────────────
                stepProgressStrip

                Divider()

                // ── Phase content ─────────────────────────────────────────
                Form {
                    if let patient {
                        patientHeaderSection(patient)
                    }
                    phaseGuidanceBanner
                    switch currentPhase {
                    case .cc:
                        phase1CCSection
                    case .socrates:
                        if let cc = answers.ccCategory, cc.isPainType {
                            phase2SocratesSection(cc: cc)
                        }
                    case .symptoms:
                        phase3AssociatedSection
                    case .redFlags:
                        phase4RedFlagsSection
                    case .pmhx:
                        phase5PMHxSection
                    case .social:
                        phase6SocialSection
                    }
                }

                Divider()

                // ── Navigation bar ────────────────────────────────────────
                HStack(spacing: 16) {
                    if safeIndex > 0 {
                        Button {
                            withAnimation(.easeInOut(duration: 0.18)) { currentStepIndex -= 1 }
                        } label: {
                            Label("Back", systemImage: "chevron.left")
                        }
                        .buttonStyle(.bordered)
                        .tint(.secondary)
                    }
                    Spacer()
                    if isLastStep {
                        Button("Save & Close") { save() }
                            .buttonStyle(.borderedProminent)
                            .tint(AMColor.accent)
                            .fontWeight(.semibold)
                            .disabled(answers.ccCategory == nil &&
                                      answers.ccClarification.trimmingCharacters(in: .whitespaces).isEmpty)
                    } else {
                        Button {
                            withAnimation(.easeInOut(duration: 0.18)) {
                                currentStepIndex += 1
                                symptomFilter = ""
                            }
                        } label: {
                            HStack(spacing: 4) {
                                Text(currentPhase == .cc && answers.ccCategory == nil ? "Skip" : "Next")
                                Image(systemName: "chevron.right")
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(canAdvance ? AMColor.accent : .secondary)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 14)
            }
            .navigationTitle(patient.map { "Questionnaire — \($0.fullName)" } ?? "Walk-In Questionnaire")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onChange(of: answers.ccCategory) { _, _ in
                // When CC changes, clamp the step index to the new phase list length
                currentStepIndex = min(currentStepIndex, phases.count - 1)
            }
        }
    }

}
