import SwiftUI
import SwiftData

struct OperativePlanView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context
    @StateObject private var ai = AIService()

    @State private var plan: OperativePlan?
    @State private var showAIError = false
    @State private var aiError: String?

    var body: some View {
        Group {
            if let plan = plan {
                PlanForm(patient: patient, plan: plan, ai: ai,
                         showAIError: $showAIError, aiError: $aiError,
                         context: context)
            } else {
                ProgressView("Loading plan…")
                    .onAppear { plan = getOrCreate() }
            }
        }
        .onAppear { plan = getOrCreate() }
        .navigationTitle("Operative Plan")
        .navigationBarTitleDisplayMode(.inline)
        .alert("AI Error", isPresented: $showAIError) {
            Button("OK", role: .cancel) {}
        } message: { Text(aiError ?? "Unknown error") }
    }

    private func getOrCreate() -> OperativePlan {
        if let existing = patient.operativePlans.sorted(by: { $0.updatedAt > $1.updatedAt }).first {
            return existing
        }
        let p = OperativePlan()
        p.patient = patient
        if p.consentProcedure.isEmpty, let dx = patient.workingDiagnosis {
            p.consentProcedure = "Surgery for \(dx)"
        }
        // Safer antibiotic default when penicillin-allergic — clear the beta-lactam default
        if patient.hasPenicillinAllergy {
            p.antibioticProphylaxis = "PENICILLIN ALLERGY — use Clindamycin 600mg IV or discuss with anaesthetist"
        }
        // Note existing anticoagulation in VTE prophylaxis
        if patient.hasAnticoagulation {
            let drugs = patient.activeAnticoagulants.map { $0.drug }.joined(separator: ", ")
            p.vteProphy = "On anticoagulation (\(drugs)) — review bridging protocol"
        }
        context.insert(p)
        return p
    }
}

// MARK: - Plan form (separated so @Bindable can take non-optional)

private struct PlanForm: View {
    @Bindable var patient: Patient
    @Bindable var plan: OperativePlan
    @ObservedObject var ai: AIService
    @Binding var showAIError: Bool
    @Binding var aiError: String?
    let context: ModelContext

    private let antibioticChips = [
        "Cefazolin 1g IV", "Cefazolin 2g IV", "Co-amoxiclav 1.2g IV",
        "Metronidazole 500mg IV", "Gentamicin 5mg/kg IV", "Nil (NKDA)"
    ]
    private let vteChips = [
        "Enoxaparin 40mg SC", "Enoxaparin 60mg SC", "Enoxaparin 20mg SC",
        "TED stockings only", "Compression boots", "No prophylaxis"
    ]

    @ViewBuilder
    private func quickChips(_ values: [String], current: String, onTap: @escaping (String) -> Void) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(values, id: \.self) { v in
                    let sel = v == current
                    Button(v) { onTap(v) }
                        .font(.caption2.weight(sel ? .semibold : .regular))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(sel ? AMColor.accent : AMColor.accentLt, in: Capsule())
                        .foregroundStyle(sel ? Color.white : AMColor.accent)
                        .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 2)
        }
    }

    var body: some View {
        List {
            consentSection
            anaesthesiaSection
            whoSignIn
            whoTimeOut
            whoSignOut
            progressSection
            teamSection
            aiSection
        }
    }

    // MARK: - Consent

    @ViewBuilder
    private var consentSection: some View {
        Section("Surgical Consent") {
            if let dx = patient.workingDiagnosis {
                Label("Diagnosis: \(dx)", systemImage: "stethoscope")
                    .font(.caption).foregroundStyle(.secondary)
            }
            TextField("Procedure to consent for", text: $plan.consentProcedure, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: plan.consentProcedure) { _, _ in touch() }
            Toggle("Consent obtained and signed", isOn: $plan.consentSigned)
                .tint(.teal)
                .onChange(of: plan.consentSigned) { _, _ in touch() }
        }
    }

    // MARK: - Anaesthesia

    @ViewBuilder
    private var anaesthesiaSection: some View {
        Section("Anaesthesia & Preparation") {
            // Safety alerts relevant to anaesthesia planning
            if patient.hasCriticalAllergy {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.shield.fill").foregroundStyle(.red)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("CRITICAL ALLERGY").font(.system(size: 11, weight: .heavy)).foregroundStyle(.red)
                        Text(patient.criticalAllergies.map { "\($0.name) — \($0.reaction)" }.joined(separator: "\n"))
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
            if patient.hasPenicillinAllergy {
                Label("Penicillin allergy — avoid beta-lactam antibiotics", systemImage: "exclamationmark.circle.fill")
                    .font(.caption).foregroundStyle(.orange)
            }
            if patient.hasAnticoagulation {
                HStack(spacing: 6) {
                    Image(systemName: "drop.fill").foregroundStyle(.purple).font(.caption)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Anticoagulant therapy").font(.caption.weight(.semibold)).foregroundStyle(.purple)
                        Text(patient.activeAnticoagulants.map { $0.drug }.joined(separator: ", "))
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
            Picker("Anaesthesia type", selection: $plan.anaesthesiaType) {
                ForEach(["General", "Spinal", "Epidural", "Local + Sedation", "Local only", "Regional"], id: \.self) { Text($0).tag($0) }
            }
            .onChange(of: plan.anaesthesiaType) { _, _ in touch() }
            Picker("Patient position", selection: $plan.positioning) {
                ForEach(["Supine", "Lloyd-Davies", "Left lateral", "Right lateral", "Prone", "Lithotomy", "Trendelenburg", "Reverse Trendelenburg"], id: \.self) { Text($0).tag($0) }
            }
            .onChange(of: plan.positioning) { _, _ in touch() }
            TextField("Antibiotic prophylaxis", text: $plan.antibioticProphylaxis)
                .onChange(of: plan.antibioticProphylaxis) { _, _ in touch() }
            quickChips(antibioticChips, current: plan.antibioticProphylaxis) {
                plan.antibioticProphylaxis = $0; touch()
            }
            TextField("VTE prophylaxis", text: $plan.vteProphy)
                .onChange(of: plan.vteProphy) { _, _ in touch() }
            quickChips(vteChips, current: plan.vteProphy) {
                plan.vteProphy = $0; touch()
            }
            TextField("Special equipment / implants", text: $plan.specialEquipment, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: plan.specialEquipment) { _, _ in touch() }
        }
    }

    // MARK: - WHO Sign In

    @ViewBuilder
    private var whoSignIn: some View {
        Section {
            Toggle("Patient identity confirmed", isOn: $plan.whoIdentityConfirmed).onChange(of: plan.whoIdentityConfirmed) { _, _ in touch() }
            Toggle("Site marked", isOn: $plan.whoSiteMarked).onChange(of: plan.whoSiteMarked) { _, _ in touch() }
            Toggle("Anaesthesia safety check complete", isOn: $plan.whoAnaesthesiaCheckDone).onChange(of: plan.whoAnaesthesiaCheckDone) { _, _ in touch() }
            Toggle("Pulse oximeter on and functioning", isOn: $plan.whoPulseOxOk).onChange(of: plan.whoPulseOxOk) { _, _ in touch() }
            Toggle("Allergies reviewed", isOn: $plan.whoAllergiesReviewed).onChange(of: plan.whoAllergiesReviewed) { _, _ in touch() }
            Toggle("Aspiration risk assessed", isOn: $plan.whoAspirationRisk).onChange(of: plan.whoAspirationRisk) { _, _ in touch() }
            Toggle("Airway risk assessed", isOn: $plan.whoAirwayRisk).onChange(of: plan.whoAirwayRisk) { _, _ in touch() }
        } header: {
            Label("Sign In — before induction", systemImage: "1.circle.fill")
        }
    }

    // MARK: - WHO Time Out

    @ViewBuilder
    private var whoTimeOut: some View {
        Section {
            Toggle("Team introduced by name and role", isOn: $plan.whoTeamIntroduced).onChange(of: plan.whoTeamIntroduced) { _, _ in touch() }
            Toggle("Consent and procedure confirmed", isOn: $plan.whoProcedureConfirmed).onChange(of: plan.whoProcedureConfirmed) { _, _ in touch() }
            Toggle("Antibiotic given within 60 min", isOn: $plan.whoAntibioticGiven).onChange(of: plan.whoAntibioticGiven) { _, _ in touch() }
            Toggle("Critical steps discussed", isOn: $plan.whoCriticalStepsDiscussed).onChange(of: plan.whoCriticalStepsDiscussed) { _, _ in touch() }
            Toggle("Imaging displayed", isOn: $plan.whoImagingDisplayed).onChange(of: plan.whoImagingDisplayed) { _, _ in touch() }
            Toggle("Sterility confirmed", isOn: $plan.whoSterilityConfirmed).onChange(of: plan.whoSterilityConfirmed) { _, _ in touch() }
        } header: {
            Label("Time Out — before incision", systemImage: "2.circle.fill")
        }
    }

    // MARK: - WHO Sign Out

    @ViewBuilder
    private var whoSignOut: some View {
        Section {
            Toggle("Swabs, instruments, needles counted", isOn: $plan.whoSwabsCounted).onChange(of: plan.whoSwabsCounted) { _, _ in touch() }
            Toggle("Specimen labelled correctly", isOn: $plan.whoSpecimenLabelled).onChange(of: plan.whoSpecimenLabelled) { _, _ in touch() }
            Toggle("Equipment problems noted", isOn: $plan.whoEquipmentIssues).onChange(of: plan.whoEquipmentIssues) { _, _ in touch() }
            Toggle("Key concerns for recovery documented", isOn: $plan.whoRecoveryConcerns).onChange(of: plan.whoRecoveryConcerns) { _, _ in touch() }
        } header: {
            Label("Sign Out — before patient leaves", systemImage: "3.circle.fill")
        }
    }

    // MARK: - WHO progress

    @ViewBuilder
    private var progressSection: some View {
        Section {
            let done = plan.whoCompletedCount
            let total = plan.whoTotalCount
            ProgressView(value: Double(done), total: Double(total))
                .tint(done == total ? .green : .orange)
            Text("\(done) / \(total) items complete")
                .font(.caption)
                .foregroundStyle(done == total ? .green : .secondary)
        }
    }

    // MARK: - Team notes

    @ViewBuilder
    private var teamSection: some View {
        Section("Team Notes") {
            TextField("Surgical team, scrub nurse, special instructions…",
                      text: $plan.surgicalTeamNote, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: plan.surgicalTeamNote) { _, _ in touch() }
        }
    }

    // MARK: - AI op note

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
            .disabled(ai.isGenerating || plan.consentProcedure.isEmpty)
            .foregroundStyle(.purple)
        }
    }

    // MARK: - Helpers

    private func touch() {
        plan.updatedAt = .now
    }

    private func draftOpNote() async {
        let ctx = [
            plan.anaesthesiaType.isEmpty ? "" : "Anaesthesia: \(plan.anaesthesiaType)",
            plan.positioning.isEmpty    ? "" : "Position: \(plan.positioning)",
            plan.specialEquipment.isEmpty ? "" : "Equipment: \(plan.specialEquipment)",
            plan.surgicalTeamNote.isEmpty ? "" : plan.surgicalTeamNote,
        ].filter { !$0.isEmpty }.joined(separator: ". ")
        do {
            let text = try await ai.generateOpNote(
                patient: patient,
                procedure: plan.consentProcedure,
                findings: ctx.isEmpty ? "As per operative plan" : ctx
            )
            let note = ClinicalNote(noteType: .operative, patient: patient)
            note.freeText = text
            context.insert(note)
            patient.updatedAt = .now
            patient.pendingSync = true
        } catch {
            aiError = error.localizedDescription
            showAIError = true
        }
    }
}
