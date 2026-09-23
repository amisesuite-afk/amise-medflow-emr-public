import SwiftUI
import SwiftData
import EventKit

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
            let category = DiagnosisRadiationEngine.radiate(
                workingDiagnosis: dx,
                ageYears: patient.ageYears,
                sex: patient.sex
            )?.consentCategory
            p.consentProcedure = category ?? "Surgery for \(dx)"
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
