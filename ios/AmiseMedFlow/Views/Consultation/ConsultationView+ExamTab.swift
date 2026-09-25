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

                examField("General appearance",
                          text: Binding(get: { patient.examGeneral ?? "" },
                                        set: { patient.examGeneral = $0.isEmpty ? nil : $0; touch() }),
                          chips: ["Alert, no distress.", "Cachexic.", "Jaundiced.", "Pallor.", "Ankle oedema.", "Unwell."])
                examField("Cardiovascular",
                          text: Binding(get: { patient.examCVS ?? "" },
                                        set: { patient.examCVS = $0.isEmpty ? nil : $0; touch() }),
                          chips: primaryCVSChips)
                examField("Respiratory",
                          text: Binding(get: { patient.examResp ?? "" },
                                        set: { patient.examResp = $0.isEmpty ? nil : $0; touch() }),
                          chips: ["Clear to auscultation bilaterally.", "Reduced air entry.", "Fine crackles.", "Expiratory wheeze.", "Dull to percussion."])
                examField(primaryExamLabel,
                          text: Binding(get: { patient.examAbdo ?? "" },
                                        set: { patient.examAbdo = $0.isEmpty ? nil : $0; touch() }),
                          chips: primaryExamChips)

                if examMode == .full {
                    examField("Neurological", text: Binding(
                        get: { patient.examNeuro ?? "" },
                        set: { patient.examNeuro = $0.isEmpty ? nil : $0; touch() }))
                    examField("Musculoskeletal", text: Binding(
                        get: { patient.examMSK ?? "" },
                        set: { patient.examMSK = $0.isEmpty ? nil : $0; touch() }))
                    examField("Skin / Wound", text: Binding(
                        get: { patient.examSkin ?? "" },
                        set: { patient.examSkin = $0.isEmpty ? nil : $0; touch() }))
                }

                examField("Other / Additional findings", text: Binding(
                    get: { patient.examOther ?? "" },
                    set: { patient.examOther = $0.isEmpty ? nil : $0; touch() }))

                Button {
                    Task { await draftExam() }
                } label: {
                    HStack {
                        Label("AI Draft Examination", systemImage: "sparkles")
                        Spacer()
                        if ai.isGenerating { ProgressView() }
                    }
                }
                .disabled(ai.isGenerating)
                .foregroundStyle(.purple)
            } header: {
                sectionHeader("Physical Examination", icon: "stethoscope",
                              filled: !(patient.examGeneral ?? "").isEmpty || !(patient.examAbdo ?? "").isEmpty)
            }
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
