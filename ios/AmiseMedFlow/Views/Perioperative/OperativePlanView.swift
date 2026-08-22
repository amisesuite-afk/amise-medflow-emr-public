import SwiftUI
import SwiftData

// MARK: - Operative Plan + WHO Surgical Safety Checklist

struct OperativePlanView: View {
    @Bindable var patient: Patient
    @StateObject private var ai = AIService()
    @Environment(\.modelContext) private var context

    // WHO checklist state — persisted in patient.notes as a simple serialisation
    @State private var who = WHOChecklist()
    @State private var consentSigned = false
    @State private var consentProcedure = ""
    @State private var anaesthesiaType = "General"
    @State private var positioning = "Supine"
    @State private var antibioticProphylaxis = ""
    @State private var vteProphy = "TED stockings + LMWH"
    @State private var specialEquipment = ""
    @State private var surgicalTeamNote = ""
    @State private var showAIError = false
    @State private var aiError: String?

    var body: some View {
        List {
            consentSection
            anaesthesiaSection
            whoSection
            teamSection
            aiSection
        }
        .navigationTitle("Operative Plan")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { loadFromPatient() }
        .alert("AI Error", isPresented: $showAIError) {
            Button("OK", role: .cancel) {}
        } message: { Text(aiError ?? "Unknown error") }
    }

    // MARK: - Consent

    @ViewBuilder
    private var consentSection: some View {
        Section("Surgical Consent") {
            if let dx = patient.workingDiagnosis {
                Label("Diagnosis: \(dx)", systemImage: "stethoscope")
                    .font(.caption).foregroundStyle(.secondary)
            }
            TextField("Procedure to consent for", text: $consentProcedure, axis: .vertical)
                .lineLimit(2...)
                .onAppear {
                    if consentProcedure.isEmpty {
                        consentProcedure = patient.workingDiagnosis.map { "Surgery for \($0)" } ?? ""
                    }
                }
            Toggle("Consent obtained and signed", isOn: $consentSigned)
                .tint(.teal)
        }
    }

    // MARK: - Anaesthesia & prep

    @ViewBuilder
    private var anaesthesiaSection: some View {
        Section("Anaesthesia & Preparation") {
            Picker("Anaesthesia type", selection: $anaesthesiaType) {
                ForEach(["General", "Spinal", "Epidural", "Local + Sedation", "Local only", "Regional"], id: \.self) {
                    Text($0).tag($0)
                }
            }
            Picker("Patient position", selection: $positioning) {
                ForEach(["Supine", "Lloyd-Davies", "Left lateral", "Right lateral", "Prone", "Lithotomy", "Trendelenburg", "Reverse Trendelenburg"], id: \.self) {
                    Text($0).tag($0)
                }
            }
            TextField("Antibiotic prophylaxis (drug + dose)", text: $antibioticProphylaxis)
            TextField("VTE prophylaxis", text: $vteProphy)
            TextField("Special equipment / implants", text: $specialEquipment, axis: .vertical)
                .lineLimit(2...)
        }
    }

    // MARK: - WHO Surgical Safety Checklist

    @ViewBuilder
    private var whoSection: some View {
        Section {
            Label("Sign In (before induction)", systemImage: "checkmark.circle")
                .font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            Toggle("Patient identity confirmed", isOn: $who.identityConfirmed)
            Toggle("Site marked", isOn: $who.siteMarked)
            Toggle("Anaesthesia safety check complete", isOn: $who.anaesthesiaCheckDone)
            Toggle("Pulse oximeter on and functioning", isOn: $who.pulseOxOk)
            Toggle("Allergies reviewed", isOn: $who.allergiesReviewed)
            Toggle("Aspiration risk assessed", isOn: $who.aspirationRisk)
            Toggle("Airway risk assessed", isOn: $who.airwayRisk)

            Divider()

            Label("Time Out (before incision)", systemImage: "checkmark.circle")
                .font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            Toggle("Team introduced by name & role", isOn: $who.teamIntroduced)
            Toggle("Consent and procedure confirmed", isOn: $who.procedureConfirmed)
            Toggle("Antibiotic prophylaxis given <60 min", isOn: $who.antibioticGiven)
            Toggle("Critical steps discussed", isOn: $who.criticalStepsDiscussed)
            Toggle("Imaging displayed", isOn: $who.imagingDisplayed)
            Toggle("Sterility confirmed", isOn: $who.sterilityConfirmed)

            Divider()

            Label("Sign Out (before patient leaves)", systemImage: "checkmark.circle")
                .font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            Toggle("Swabs, instruments, needles counted", isOn: $who.swabsCounted)
            Toggle("Specimen labelled correctly", isOn: $who.specimenLabelled)
            Toggle("Equipment problems noted", isOn: $who.equipmentIssues)
            Toggle("Key concerns for recovery documented", isOn: $who.recoveryConcerns)

            let complete = who.completedCount
            let total = who.totalCount
            ProgressView(value: Double(complete), total: Double(total))
                .tint(complete == total ? .green : .orange)
            Text("\(complete) / \(total) items complete")
                .font(.caption).foregroundStyle(complete == total ? .green : .secondary)

        } header: {
            Label("WHO Surgical Safety Checklist", systemImage: "checklist")
        }
    }

    // MARK: - Team & notes

    @ViewBuilder
    private var teamSection: some View {
        Section("Team Notes") {
            TextField("Surgical team, scrub nurse, special instructions…",
                      text: $surgicalTeamNote, axis: .vertical)
                .lineLimit(3...)
        }
    }

    // MARK: - AI op note draft

    @ViewBuilder
    private var aiSection: some View {
        Section("AI Operative Note") {
            Button {
                Task { await draftOpNote() }
            } label: {
                HStack {
                    Label("Draft Operative Note", systemImage: "sparkles")
                    Spacer()
                    if ai.isGenerating { ProgressView() }
                }
            }
            .disabled(ai.isGenerating || consentProcedure.isEmpty)
            .foregroundStyle(.purple)

            if consentProcedure.isEmpty {
                Text("Fill in procedure above first")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Helpers

    private func draftOpNote() async {
        let findings = [
            anaesthesiaType.isEmpty ? "" : "Anaesthesia: \(anaesthesiaType)",
            positioning.isEmpty ? "" : "Position: \(positioning)",
            specialEquipment.isEmpty ? "" : "Equipment: \(specialEquipment)",
            surgicalTeamNote.isEmpty ? "" : surgicalTeamNote,
        ].filter { !$0.isEmpty }.joined(separator: ". ")

        do {
            let opNote = try await ai.generateOpNote(
                patient: patient,
                procedure: consentProcedure,
                findings: findings.isEmpty ? "As per operative plan" : findings
            )
            // Insert as a new operative note in clinical notes
            let note = ClinicalNote(noteType: .operative, patient: patient)
            note.freeText = opNote
            context.insert(note)
            patient.updatedAt = .now
            patient.pendingSync = true
        } catch {
            aiError = error.localizedDescription
            showAIError = true
        }
    }

    private func loadFromPatient() {
        // Seed consent procedure from working diagnosis if not already set
        if consentProcedure.isEmpty, let dx = patient.workingDiagnosis {
            consentProcedure = "Surgery for \(dx)"
        }
        if antibioticProphylaxis.isEmpty {
            antibioticProphylaxis = "Co-amoxiclav 1.2 g IV at induction"
        }
    }
}

// MARK: - WHO checklist model

struct WHOChecklist {
    // Sign In
    var identityConfirmed = false
    var siteMarked = false
    var anaesthesiaCheckDone = false
    var pulseOxOk = false
    var allergiesReviewed = false
    var aspirationRisk = false
    var airwayRisk = false

    // Time Out
    var teamIntroduced = false
    var procedureConfirmed = false
    var antibioticGiven = false
    var criticalStepsDiscussed = false
    var imagingDisplayed = false
    var sterilityConfirmed = false

    // Sign Out
    var swabsCounted = false
    var specimenLabelled = false
    var equipmentIssues = false
    var recoveryConcerns = false

    var totalCount: Int { 17 }

    var completedCount: Int {
        [identityConfirmed, siteMarked, anaesthesiaCheckDone, pulseOxOk, allergiesReviewed,
         aspirationRisk, airwayRisk, teamIntroduced, procedureConfirmed, antibioticGiven,
         criticalStepsDiscussed, imagingDisplayed, sterilityConfirmed, swabsCounted,
         specimenLabelled, equipmentIssues, recoveryConcerns].filter { $0 }.count
    }
}
