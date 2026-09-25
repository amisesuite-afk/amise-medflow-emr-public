// AdaptiveQuestionnaireSheet+Lifestyle.swift
// The lifestyle questions (religious / ritual fasting with its timing follow-up, and traditional
// or complementary treatments) — the same questions, wording and options as the web intake
// (LifestyleQuestions.swift ⇄ lib/triage-engine/src/lifestyle-questions.ts).
//
// Always the last sections of the last step, after every clinical question, so they never take a
// clinical question's place. Like the web (asked for new consultations, screening, pre-op and
// second opinions), they are not asked for a follow-up or post-operative review. Information only:
// nothing here gives advice (hazard H-10), and the answers become "(patient-reported)" lines in
// the record (EncounterAnswers.pmhxText), never the structured record (Migration 89).

import SwiftUI

extension AdaptiveQuestionnaireSheet {

    /// Web parity: the follow-up and post-operative questionnaires do not ask these.
    var asksLifestyleQuestions: Bool {
        if answers.ccCategory == .postop { return false }
        switch livePatient?.visitType {
        case .followUp?, .postOp?: return false
        default: return true
        }
    }

    @ViewBuilder
    var lifestyleQuestionSections: some View {
        if asksLifestyleQuestions {
            Section {
                Text(LifestyleQuestions.fastingText)
                    .font(.callout)
                QCheckboxGrid(label: nil,
                              options: LifestyleQuestions.fastingOptions.map(\.label),
                              rawSelection: lifestyleLabelBinding(
                                options: LifestyleQuestions.fastingOptions,
                                get: { answers.lifestyle.fasting },
                                set: { answers.lifestyle.setFasting($0) }))
                if answers.lifestyle.asksTiming {
                    Text(LifestyleQuestions.timingText)
                        .font(.callout)
                    Picker(LifestyleQuestions.timingText, selection: $answers.lifestyle.timing) {
                        ForEach(LifestyleQuestions.timingOptions, id: \.value) { option in
                            Text(option.label).tag(Optional(option.value))
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }
            } header: {
                Label("Fasting", systemImage: "moon.stars")
                    .textCase(nil).scaledFont(size: 11, weight: .semibold)
            } footer: {
                Text(LifestyleQuestions.fastingHelp)
                    .font(.caption).foregroundStyle(.secondary)
            }

            Section {
                Text(LifestyleQuestions.therapiesText)
                    .font(.callout)
                QCheckboxGrid(label: nil,
                              options: LifestyleQuestions.therapyOptions.map(\.label),
                              rawSelection: lifestyleLabelBinding(
                                options: LifestyleQuestions.therapyOptions,
                                get: { answers.lifestyle.therapies },
                                set: { answers.lifestyle.setTherapies($0) }))
            } header: {
                Label("Traditional or complementary treatments", systemImage: "leaf")
                    .textCase(nil).scaledFont(size: 11, weight: .semibold)
            } footer: {
                Text(LifestyleQuestions.therapiesHelp)
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    /// QCheckboxGrid works on labels; the answers keep the web option values.
    private func lifestyleLabelBinding(options: [LifestyleQuestions.Option],
                                       get: @escaping () -> Set<String>,
                                       set: @escaping (Set<String>) -> Void) -> Binding<Set<String>> {
        Binding(
            get: {
                let values = get()
                return Set(options.filter { values.contains($0.value) }.map(\.label))
            },
            set: { labels in
                set(Set(options.filter { labels.contains($0.label) }.map(\.value)))
            }
        )
    }
}
