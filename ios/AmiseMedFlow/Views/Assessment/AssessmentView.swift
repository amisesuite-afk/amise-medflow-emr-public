import SwiftUI
import SwiftData

struct AssessmentView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context
    @StateObject private var ai = AIService()

    @State private var icdQuery = ""
    @State private var icdSuggestions: [ICDCode] = []
    @State private var showIcdDropdown = false
    @State private var triageResult: TriageResult?
    @State private var isAssessing = false
    @State private var showAIError = false

    var body: some View {
        List {
            diagnosisSection
            bayesianSection
            if let result = triageResult { resultSection(result) }
            assessmentTextSection
        }
        .navigationTitle("Assessment")
        .navigationBarTitleDisplayMode(.inline)
        .alert("AI Error", isPresented: $showAIError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(ai.error ?? "Unknown error")
        }
    }

    // MARK: - Diagnosis search

    @ViewBuilder
    private var diagnosisSection: some View {
        Section("Working Diagnosis") {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                    TextField("Search ICD-10 codes or diagnosis", text: $icdQuery)
                        .autocorrectionDisabled()
                        .onChange(of: icdQuery) { _, q in
                            icdSuggestions = q.count >= 2 ? ClinicalSearchService.searchICD(q) : []
                            showIcdDropdown = !icdSuggestions.isEmpty
                        }
                    if !icdQuery.isEmpty {
                        Button { icdQuery = ""; icdSuggestions = []; showIcdDropdown = false }
                            label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                    }
                }

                if showIcdDropdown {
                    Divider().padding(.top, 6)
                    ForEach(icdSuggestions.prefix(6)) { icd in
                        Button {
                            patient.workingDiagnosis = icd.description
                            patient.workingDiagnosisICD = icd.code
                            patient.updatedAt = .now
                            patient.pendingSync = true
                            icdQuery = "\(icd.code) \(icd.description)"
                            showIcdDropdown = false
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(icd.description).font(.subheadline).foregroundStyle(.primary)
                                    Text(icd.code).font(.caption.monospaced()).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(icd.category).font(.caption2).foregroundStyle(.tertiary)
                            }
                        }
                        .padding(.vertical, 4)
                        Divider()
                    }
                }
            }

            if let dx = patient.workingDiagnosis {
                HStack {
                    Image(systemName: "stethoscope").foregroundStyle(.teal)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(dx).font(.subheadline.weight(.medium))
                        if let icd = patient.workingDiagnosisICD {
                            Text(icd).font(.caption.monospaced()).foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    Button("Clear") {
                        patient.workingDiagnosis = nil
                        patient.workingDiagnosisICD = nil
                        patient.updatedAt = .now
                        patient.pendingSync = true
                        icdQuery = ""
                    }
                    .font(.caption)
                    .foregroundStyle(.red)
                }
            }
        }

        if patient.workingDiagnosis != nil {
            Section {
                Label("Radiates to: Notes · Prescriptions · Billing", systemImage: "arrow.triangle.branch")
                    .font(.caption)
                    .foregroundStyle(.teal)
            }
        }
    }

    // MARK: - Bayesian engine

    @ViewBuilder
    private var bayesianSection: some View {
        Section("Clinical Pathway Engine") {
            Button {
                isAssessing = true
                let result = ClinicalPathwayEngine.assess(
                    chiefComplaint: patient.chiefComplaint ?? "",
                    pmh: patient.pmhNotes ?? ""
                )
                triageResult = result
                // Auto-suggest acuity — surgeon always confirms
                if result.suggestedAcuity < patient.acuity {
                    patient.acuity = result.suggestedAcuity
                    patient.updatedAt = .now
                    patient.pendingSync = true
                }
                isAssessing = false
            } label: {
                HStack {
                    Label("Run Pathway Assessment", systemImage: "waveform.path.ecg.rectangle")
                    Spacer()
                    if isAssessing { ProgressView() }
                }
            }
            .disabled(isAssessing || (patient.chiefComplaint ?? "").isEmpty)

            if (patient.chiefComplaint ?? "").isEmpty {
                Text("Enter chief complaint first")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Pathway result

    @ViewBuilder
    private func resultSection(_ result: TriageResult) -> some View {
        Section("Pathway Result — \(result.pathway)") {
            HStack {
                AcuityPip(acuity: result.suggestedAcuity)
                Text(result.suggestedAcuity.label)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("Confidence \(result.confidencePercent)%")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if !result.redFlags.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Red Flags", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.red)
                    ForEach(result.redFlags, id: \.self) { flag in
                        HStack(alignment: .top, spacing: 6) {
                            Text("•").foregroundStyle(.red)
                            Text(flag).font(.caption)
                        }
                    }
                }
            }

            if !result.differentials.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Differentials").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    ForEach(result.differentials, id: \.name) { d in
                        Text("• \(d.name)").font(.caption)
                    }
                }
            }
        }
    }

    // MARK: - Assessment free text

    @ViewBuilder
    private var assessmentTextSection: some View {
        Section {
            ZStack(alignment: .topLeading) {
                TextEditor(text: Binding(
                    get: { patient.assessmentText ?? "" },
                    set: {
                        patient.assessmentText = $0.isEmpty ? nil : $0
                        patient.updatedAt = .now
                        patient.pendingSync = true
                    }
                ))
                .frame(minHeight: 120)
                if (patient.assessmentText ?? "").isEmpty {
                    Text("Clinical impression, differentials, plan summary…")
                        .foregroundStyle(.tertiary)
                        .padding(.top, 8)
                        .padding(.leading, 4)
                        .allowsHitTesting(false)
                }
            }

            Button {
                Task {
                    do {
                        let draft = try await ai.generateSOAP(patient: patient, noteType: .soap)
                        let combined = """
                        A: \(draft.a)

                        P: \(draft.p)
                        """
                        patient.assessmentText = combined
                        patient.updatedAt = .now
                        patient.pendingSync = true
                    } catch {
                        showAIError = true
                    }
                }
            } label: {
                HStack {
                    Label("AI Draft Assessment", systemImage: "sparkles")
                    Spacer()
                    if ai.isGenerating { ProgressView() }
                }
            }
            .disabled(ai.isGenerating)
            .foregroundStyle(.purple)
        } header: {
            Label("Assessment Notes", systemImage: "doc.text.magnifyingglass")
        }
    }

}
