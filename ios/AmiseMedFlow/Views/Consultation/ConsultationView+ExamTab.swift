// ConsultationView+ExamTab.swift
// Physical examination tab.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - Exam tab

    var examTab: some View {
        List {
            Section {
                HStack {
                    Picker("", selection: $examMode) {
                        Text("Short").tag(ExamMode.short)
                        Text("Full").tag(ExamMode.full)
                    }
                    .pickerStyle(.segmented)
                    Spacer(minLength: 12)
                    Button("All Normal") { markAllNormal() }
                        .font(.caption).foregroundStyle(AMColor.accent)
                }

                // The region comes from the complaint's history frame (ExamRegion): its chips go in
                // the field its findings belong to, so a cough is examined at the chest.
                let region = examRegion
                examField(region.label(for: .general),
                          text: Binding(get: { patient.examGeneral ?? "" },
                                        set: { patient.examGeneral = $0.isEmpty ? nil : $0; touch() }),
                          chips: region.chips(for: .general))
                examField(region.label(for: .cvs),
                          text: Binding(get: { patient.examCVS ?? "" },
                                        set: { patient.examCVS = $0.isEmpty ? nil : $0; touch() }),
                          chips: primaryCVSChips)
                examField(region.label(for: .resp),
                          text: Binding(get: { patient.examResp ?? "" },
                                        set: { patient.examResp = $0.isEmpty ? nil : $0; touch() }),
                          chips: region.chips(for: .resp))
                examField(primaryExamLabel,
                          text: Binding(get: { patient.examAbdo ?? "" },
                                        set: { patient.examAbdo = $0.isEmpty ? nil : $0; touch() }),
                          chips: primaryExamChips)

                if examMode == .full || region.showsInShortExam(.neuro) {
                    examField(region.label(for: .neuro), text: Binding(
                        get: { patient.examNeuro ?? "" },
                        set: { patient.examNeuro = $0.isEmpty ? nil : $0; touch() }),
                        chips: region.chips(for: .neuro))
                }
                if examMode == .full || region.showsInShortExam(.msk) {
                    examField(region.label(for: .msk), text: Binding(
                        get: { patient.examMSK ?? "" },
                        set: { patient.examMSK = $0.isEmpty ? nil : $0; touch() }),
                        chips: region.chips(for: .msk))
                }
                if examMode == .full || region.showsInShortExam(.skin) {
                    examField(region.label(for: .skin), text: Binding(
                        get: { patient.examSkin ?? "" },
                        set: { patient.examSkin = $0.isEmpty ? nil : $0; touch() }),
                        chips: region.chips(for: .skin))
                }

                examField("Other / Additional findings", text: Binding(
                    get: { patient.examOther ?? "" },
                    set: { patient.examOther = $0.isEmpty ? nil : $0; touch() }))

                Button {
                    Task { await draftExam() }
                } label: {
                    HStack {
                        Label(DraftButtonText.title(section: "Examination"), systemImage: DraftButtonText.systemImage())
                        Spacer()
                        if ai.isGenerating { ProgressView() }
                    }
                }
                .disabled(ai.isGenerating)
                .foregroundStyle(AMColor.accent)
                .accessibilityLabel(DraftButtonText.accessibilityLabel(section: "Examination"))
                .accessibilityHint("Fills only empty systems with normal template text. Edit it to what you found.")
                .accessibilityIdentifier("consult.exam.draft")
            } header: {
                sectionHeader("Physical Examination", icon: "stethoscope",
                              filled: !(patient.examGeneral ?? "").isEmpty || !(patient.examAbdo ?? "").isEmpty)
            }

            // Evidence-based high-yield signs and decision rules (evidence-exam): chips written as
            // "[sign]" lines in Other / additional findings; nothing is pre-filled as normal.
            ExamSignsSection(patient: patient,
                             frameIDs: examFrameIDs,
                             leadingDiagnoses: bayesianDx.prefix(3).map { $0.name },
                             onChange: {
                                 touch()
                                 refreshBayesian()
                             })
        }
    }

    @ViewBuilder
    func examField(_ label: String, text: Binding<String>, chips: [String] = []) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                TextField("Findings…", text: text, axis: .vertical).lineLimit(2...).font(.callout)
                    .accessibilityIdentifier("consult.exam.\(label)")
            }
            if !chips.isEmpty {
                ChipFlow(hSpacing: 6, vSpacing: 6) {
                    ForEach(chips, id: \.self) { chip in
                        Button {
                            let existing = text.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines)
                            text.wrappedValue = existing.isEmpty ? chip : existing + " " + chip
                        } label: {
                            Text(chip)
                                .font(.system(size: 11))
                                .padding(.horizontal, 8).padding(.vertical, 4)
                                .background(Color.secondary.opacity(0.1), in: Capsule())
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(.vertical, 2)
    }


}
