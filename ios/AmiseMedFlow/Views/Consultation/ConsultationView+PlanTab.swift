// ConsultationView+PlanTab.swift
// Plan tab and pathway result.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - Plan tab

    var radiationResult: DiagnosisRadiation? {
        DiagnosisRadiationEngine.radiate(
            workingDiagnosis: patient.workingDiagnosis,
            ageYears: patient.ageYears,
            sex: patient.sex
        )
    }

    var planTab: some View {
        List {
            // Diagnosis radiation card — shown when a working Dx is set and dismissed flag is clear
            if let radiation = radiationResult, !dismissedRadiation {
                DiagnosisRadiationCard(
                    radiation: radiation,
                    onAddInvestigation: { inv in
                        let entry = InvestigationEntry(
                            name: inv.name, category: inv.category,
                            status: .suggested, suggestedFor: radiation.conditionName
                        )
                        patient.investigations.append(entry)
                        touch()
                    },
                    onUsePlan: { planText in
                        if (patient.managementPlan ?? "").isEmpty {
                            patient.managementPlan = planText; touch()
                        }
                        dismissedRadiation = true
                    },
                    onDismiss: { dismissedRadiation = true },
                    patientAge: computedAge(from: patient.dateOfBirth),
                    alreadyOrderedNames: Set(patient.investigations
                        .filter { $0.status != .cancelled }
                        .map { $0.name })
                )
            }

            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.managementPlan ?? "" },
                                            set: { patient.managementPlan = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 160)
                        .medicalDictation(mode: .plan, patient: patient,
                                          text: Binding(get: { patient.managementPlan ?? "" },
                                                        set: { patient.managementPlan = $0.isEmpty ? nil : $0; touch() }))
                    if (patient.managementPlan ?? "").isEmpty {
                        Text("Investigations · Referrals · Prescriptions · Follow-up plan · Red flag advice…")
                            .foregroundStyle(.tertiary).font(.callout)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Assessment & Management Plan", icon: "doc.text.magnifyingglass",
                              filled: !(patient.managementPlan ?? "").isEmpty)
            }

            Section {
                Button {
                    Task { await draftPlan() }
                } label: {
                    HStack {
                        Label("AI Draft Plan", systemImage: "sparkles")
                        Spacer()
                        if ai.isGenerating { ProgressView() }
                    }
                }
                .disabled(ai.isGenerating)
                .foregroundStyle(.purple)

                Button {
                    Task { await generateLetter() }
                } label: {
                    HStack {
                        Label("Generate Consultation Letter", systemImage: "envelope.badge.shield.half.filled")
                        Spacer()
                        if ai.isGenerating { ProgressView().scaleEffect(0.8) }
                    }
                }
                .disabled(ai.isGenerating)
                .foregroundStyle(.teal)

                Button {
                    consultationPDFWrapper = exportConsultationPDF()
                } label: {
                    Label("Export as PDF", systemImage: "square.and.arrow.up")
                }
                .foregroundStyle(.blue)
            }
        }
    }

    // MARK: - Pathway result (shown inline in CC tab)

    @ViewBuilder
    func pathwayResult(_ result: TriageResult) -> some View {
        Section {
            HStack {
                AcuityPip(acuity: result.suggestedAcuity)
                Text(result.suggestedAcuity.label).font(.subheadline.weight(.semibold))
                Spacer()
                Text("Confidence \(result.confidencePercent)%").font(.caption).foregroundStyle(.secondary)
            }

            if !result.differentials.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Differentials").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    ForEach(Array(result.differentials.prefix(5).enumerated()), id: \.offset) { i, dx in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 6) {
                                Text(dx.name)
                                    .font(.caption.weight(i == 0 ? .semibold : .regular))
                                    .foregroundStyle(i == 0 ? .primary : .secondary)
                                Spacer()
                                Text("\(dx.probability)%")
                                    .font(.caption2.weight(.medium).monospacedDigit())
                                    .foregroundStyle(i == 0 ? AMColor.accent : .secondary)
                                if patient.workingDiagnosis != dx.name {
                                    Button("Use") {
                                        patient.workingDiagnosis = dx.name
                                        patient.workingDiagnosisICD = nil
                                        touch()
                                        activeTab = .diagnosis
                                    }
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(AMColor.accent)
                                } else {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.green).font(.caption2)
                                }
                            }
                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    Capsule()
                                        .fill(.secondary.opacity(0.12))
                                        .frame(height: 4)
                                    Capsule()
                                        .fill(i == 0 ? AMColor.accent : Color.secondary.opacity(0.35))
                                        .frame(width: geo.size.width * CGFloat(dx.probability) / 100,
                                               height: 4)
                                }
                            }
                            .frame(height: 4)
                        }
                    }
                }
            }

            if !result.redFlags.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Red Flags", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption.weight(.semibold)).foregroundStyle(.red)
                    ForEach(result.redFlags, id: \.self) { Text("• \($0)").font(.caption).foregroundStyle(.red) }
                }
            }
        } header: {
            Label("Pathway: \(result.pathway)", systemImage: "waveform.path.ecg.rectangle")
        }
    }


}
