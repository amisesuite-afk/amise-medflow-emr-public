// FinalDiagnosisSection.swift
// Outcomes loop, iOS: the "Final diagnosis" section of a saved visit (EncounterDetailSheet) and
// its capture sheet. A nurse, doctor or admin confirms the final diagnosis later, from histology
// or an imported report, operative findings or note, a discharge summary or a follow-up visit,
// with the source and its date. A gentle "Final diagnosis not yet recorded" shows on completed
// visits older than 14 days that had an operation or pathology.
//
// Coded only (ICD-10), stored on the Encounter (OutcomeSnapshot.swift). Local and sync-ready:
// not pushed to Supabase yet. Nothing here edits the working diagnosis or any clinical field.

import SwiftUI
import SwiftData

struct EncounterFinalDiagnosisSection: View {
    let encounter: Encounter
    @EnvironmentObject private var sync: SyncService
    @Environment(\.modelContext) private var context
    @State private var showCapture = false
    @State private var confirmRetract = false

    private var canRecord: Bool { sync.currentUserRole.hasAccess(to: .nurse) }

    private func leaderText(_ entry: OutcomeDifferentialEntry) -> String {
        let code = entry.icd10 ?? "—"
        guard let p = entry.probability else { return code }
        let percent = Int((p * 100).rounded())
        return "\(code) · \(percent)%"
    }

    var body: some View {
        let prediction = encounter.outcomePrediction
        let confirmed = encounter.confirmedFinalDiagnosis
        if canRecord && (prediction != nil || confirmed != nil) {
            Section {
                if let leader = prediction?.topDifferential.first {
                    LabeledContent("Engines' leading diagnosis", value: leaderText(leader))
                        .font(.subheadline)
                }
                if let confirmed {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(confirmed.finalIcd10) \(FinalDiagnosisText.description(for: confirmed.finalIcd10))")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.green)
                        Text("\(confirmed.sourceLabel) · \(confirmed.sourceDate)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .accessibilityElement(children: .combine)
                    Button("Retract (to correct it)", role: .destructive) { confirmRetract = true }
                        .font(.subheadline)
                } else {
                    if encounter.finalDiagnosisDue {
                        Label("Final diagnosis not yet recorded", systemImage: "clock.badge.exclamationmark")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.orange)
                            .accessibilityIdentifier("finalDx.due")
                    }
                    Button {
                        showCapture = true
                    } label: {
                        Label("Record final diagnosis", systemImage: "checkmark.seal")
                    }
                    .accessibilityIdentifier("finalDx.record")
                }
            } header: {
                Text("Final diagnosis")
            } footer: {
                Text("Confirmed later from histology, operative findings, a discharge summary or a follow-up visit, to measure how accurate the engines were. ICD-10 code only. Kept on this device for now.")
            }
            .sheet(isPresented: $showCapture) {
                FinalDiagnosisCaptureSheet(encounter: encounter)
            }
            .confirmationDialog("Retract this final diagnosis?", isPresented: $confirmRetract, titleVisibility: .visible) {
                Button("Retract", role: .destructive) {
                    encounter.retractFinalDiagnosis()
                    try? context.save()
                    AuditLog.record("update", "final_diagnosis", patient: encounter.patient,
                                    resourceId: encounter.syncCode, details: ["status": "retracted"])
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("It is kept in the visit record as retracted. Then record the correct one.")
            }
        }
    }
}

enum FinalDiagnosisText {
    /// The catalogue description of an ICD-10 code, or an empty string.
    static func description(for code: String) -> String {
        ICDCode.allCodes.first(where: { $0.code == code })?.description ?? ""
    }
}

struct FinalDiagnosisCaptureSheet: View {
    let encounter: Encounter
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var results: [ICDCode] = []
    @State private var pickedCode: String? = nil
    @State private var sourceType: OutcomeSourceType = .histology
    @State private var sourceDate = Date()
    @State private var acuity: OutcomeAcuity? = nil

    private var workingCode: String? { OutcomeCodes.normaliseICD10(encounter.workingDiagnosisICD) }
    private var typedCode: String? { OutcomeCodes.normaliseICD10(query) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if let pickedCode {
                        HStack {
                            Text("\(pickedCode) \(FinalDiagnosisText.description(for: pickedCode))")
                                .font(.subheadline.weight(.semibold))
                            Spacer()
                            Button("Change") { self.pickedCode = nil }
                                .font(.subheadline)
                        }
                    } else {
                        if let workingCode {
                            Button("Same as the working diagnosis: \(workingCode)") { pickedCode = workingCode }
                        }
                        TextField("Search a diagnosis or type an ICD-10 code", text: $query)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .onChange(of: query) { _, q in
                                results = q.count >= 2 ? ICDCode.search(q) : []
                            }
                        ForEach(results.prefix(8)) { code in
                            Button {
                                pickedCode = OutcomeCodes.normaliseICD10(code.code)
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(code.code).font(.subheadline.weight(.semibold))
                                    Text(code.description).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                        if let typedCode, results.isEmpty {
                            Button("Use ICD-10 code \(typedCode)") { pickedCode = typedCode }
                        }
                    }
                } header: {
                    Text("Final diagnosis (ICD-10)")
                }

                Section {
                    Picker("Source", selection: $sourceType) {
                        ForEach(OutcomeSourceType.allCases) { Text($0.label).tag($0) }
                    }
                    DatePicker("Date of the source", selection: $sourceDate, in: ...Date(), displayedComponents: .date)
                    Picker("Urgency the case needed", selection: $acuity) {
                        Text("Not assessed").tag(OutcomeAcuity?.none)
                        ForEach(OutcomeAcuity.allCases) { Text($0.label).tag(OutcomeAcuity?.some($0)) }
                    }
                } header: {
                    Text("Source")
                } footer: {
                    Text("The urgency is optional: it is compared with the triage level at the visit.")
                }

                Section {
                    Button {
                        confirm()
                    } label: {
                        Label("Confirm final diagnosis", systemImage: "checkmark.seal.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(pickedCode == nil)
                    .accessibilityIdentifier("finalDx.confirm")
                }
            }
            .navigationTitle("Final diagnosis")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
            .onAppear {
                if let prediction = encounter.outcomePrediction {
                    sourceType = prediction.outcomeTriggers.contains("pathology") ? .histology
                        : prediction.outcomeTriggers.contains("operation") ? .operativeFindings : .followUp
                }
            }
        }
    }

    private func confirm() {
        guard let pickedCode, let ref = OutcomeCodes.encounterRef(syncCode: encounter.syncCode) else { return }
        let record = OutcomeFinalDiagnosisRecord(
            encounterRef: ref,
            finalIcd10: pickedCode,
            sourceType: sourceType,
            sourceDate: OutcomeCodes.practiceDay(sourceDate),
            retrospectiveAcuity: acuity
        )
        encounter.confirmFinalDiagnosis(record)
        try? context.save()
        AuditLog.record("create", "final_diagnosis", patient: encounter.patient, resourceId: encounter.syncCode,
                        details: ["source": sourceType.rawValue])
        dismiss()
    }
}
