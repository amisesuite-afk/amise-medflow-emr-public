// SyncService+OperativePlans.swift
// Operative plan sync (push-only, upserted per patient).

import Foundation
import SwiftData
import Supabase

extension SyncService {

    // MARK: - Operative plan sync (push-only; plan is per-patient and upserted)

    func pushPendingOperativePlans(context: ModelContext) async throws {
        let refused = SyncRefusals.ids(.operativePlan)
        let pending = try context.fetch(FetchDescriptor<OperativePlan>())
            .filter { $0.pendingSync && !refused.contains($0.id.uuidString) }
        guard !pending.isEmpty else { return }

        let iso = ISO8601DateFormatter()
        var firstError: Error?

        for plan in pending {
            // The loop awaits the network; a plan deleted meanwhile must not be read.
            guard plan.isLive else { continue }
            // UUID guard: no placeholder ("appt:…") or malformed id is ever sent, as patient_id or
            // as the plan's row id (SyncRemoteIds.swift).
            guard let patientId = SyncRemoteId.serverId(plan.patient?.remoteId) else { continue }
            let planRemoteId: String?
            switch SyncRemoteId.kind(plan.remoteId) {
            case .server(let id):                   planRemoteId = id
            case .none:                             planRemoteId = nil
            case .appointmentPlaceholder, .invalid: continue
            }
            let localId = plan.id

            let whoDict: [String: Bool] = [
                "identity":           plan.whoIdentityConfirmed,
                "site_marked":        plan.whoSiteMarked,
                "anaesthesia_check":  plan.whoAnaesthesiaCheckDone,
                "pulse_ox":           plan.whoPulseOxOk,
                "allergies":          plan.whoAllergiesReviewed,
                "aspiration_risk":    plan.whoAspirationRisk,
                "airway_risk":        plan.whoAirwayRisk,
                "team_introduced":    plan.whoTeamIntroduced,
                "procedure_confirmed":plan.whoProcedureConfirmed,
                "antibiotic_given":   plan.whoAntibioticGiven,
                "critical_steps":     plan.whoCriticalStepsDiscussed,
                "imaging_displayed":  plan.whoImagingDisplayed,
                "sterility":          plan.whoSterilityConfirmed,
                "swabs_counted":      plan.whoSwabsCounted,
                "specimen_labelled":  plan.whoSpecimenLabelled,
                "equipment_issues":   plan.whoEquipmentIssues,
                "recovery_concerns":  plan.whoRecoveryConcerns,
            ]
            let whoJSON = (try? JSONSerialization.data(withJSONObject: whoDict))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"

            struct PlanRow: Encodable {
                let patient_id: String
                let updated_at: String
                let consent_procedure: String
                let consent_signed: Bool
                let anaesthesia_type: String
                let positioning: String
                let antibiotic_prophylaxis: String
                let vte_prophy: String
                let special_equipment: String
                let surgical_team_note: String
                let who_checklist: String   // raw JSON string; Supabase coerces to JSONB
            }
            let row = PlanRow(
                patient_id: patientId,
                updated_at: iso.string(from: plan.updatedAt),
                consent_procedure: plan.consentProcedure,
                consent_signed: plan.consentSigned,
                anaesthesia_type: plan.anaesthesiaType,
                positioning: plan.positioning,
                antibiotic_prophylaxis: plan.antibioticProphylaxis,
                vte_prophy: plan.vteProphy,
                special_equipment: plan.specialEquipment,
                surgical_team_note: plan.surgicalTeamNote,
                who_checklist: whoJSON
            )

            // pendingSync protects the plan from the pull below, so it is cleared only when the
            // server confirms the write (an update RLS does not apply returns no rows, no error),
            // and not if the plan was edited again while the request ran.
            let editedAt = plan.updatedAt
            struct PlanResponse: Decodable { let id: String }
            let confirmed: [PlanResponse]
            // Per-record: one refused or rejected plan stays pending and does not hold back the
            // rest (SyncService+Refusals.swift).
            do {
                if let remoteId = planRemoteId {
                    // Update existing row
                    confirmed = try await SupabaseConfig.client
                        .from("patient_operative_plans")
                        .update(row)
                        .eq("id", value: remoteId)
                        .select("id")
                        .execute()
                        .value
                } else {
                    // Insert new row
                    confirmed = try await SupabaseConfig.client
                        .from("patient_operative_plans")
                        .insert(row)
                        .select("id")
                        .execute()
                        .value
                }
            } catch {
                guard continueAfterPushFailure(error, id: localId, kind: .operativePlan,
                                               firstError: &firstError) else { break }
                continue
            }
            // The await above may have outlived a delete.
            guard plan.isLive, let first = confirmed.first else { continue }
            if plan.remoteId == nil { plan.remoteId = first.id }
            if plan.updatedAt == editedAt { plan.pendingSync = false }
        }
        try context.save()
        if let firstError { throw firstError }
    }

    private struct RemoteOperativePlan: Decodable {
        let id: String
        let patient_id: String
        let consent_procedure: String
        let consent_signed: Bool
        let anaesthesia_type: String
        let positioning: String
        let antibiotic_prophylaxis: String
        let vte_prophy: String
        let special_equipment: String
        let surgical_team_note: String
        let who_checklist: String?   // JSONB arrives as a JSON string
        let updated_at: String
    }

    func pullOperativePlans(context: ModelContext) async throws {
        let rows: [RemoteOperativePlan] = try await SupabaseConfig.client
            .from("patient_operative_plans")
            .select("id, patient_id, consent_procedure, consent_signed, anaesthesia_type, positioning, antibiotic_prophylaxis, vte_prophy, special_equipment, surgical_team_note, who_checklist, updated_at")
            .order("updated_at", ascending: false)
            .limit(500)
            .execute()
            .value

        let allLocal = try context.fetch(FetchDescriptor<OperativePlan>())
        let allPatients = try context.fetch(FetchDescriptor<Patient>())
        let iso = ISO8601DateFormatter()

        for row in rows {
            guard let patient = allPatients.first(where: { $0.remoteId == row.patient_id }) else { continue }

            let plan: OperativePlan
            var isNewPlan = false
            if let existing = allLocal.first(where: { $0.remoteId == row.id }) {
                plan = existing
            } else if let existing = allLocal.first(where: { $0.patient?.remoteId == row.patient_id }) {
                // Match by patient when remoteId not yet set locally
                plan = existing
            } else {
                plan = OperativePlan()
                plan.patient = patient
                context.insert(plan)
                isNewPlan = true
            }

            plan.remoteId = row.id
            // Local edits not yet pushed win (e.g. a WHO checklist tick or consent change made
            // while this request ran, or one the server did not confirm): only the link above is
            // taken, never the fields. Same rule as the note and patient pulls.
            if plan.pendingSync && !isNewPlan { continue }
            if (plan.consentProcedure).isEmpty     { plan.consentProcedure      = row.consent_procedure }
            plan.consentSigned                     = row.consent_signed
            if (plan.anaesthesiaType).isEmpty      { plan.anaesthesiaType       = row.anaesthesia_type }
            if (plan.positioning).isEmpty          { plan.positioning            = row.positioning }
            if (plan.antibioticProphylaxis).isEmpty { plan.antibioticProphylaxis = row.antibiotic_prophylaxis }
            if (plan.vteProphy).isEmpty            { plan.vteProphy             = row.vte_prophy }
            if (plan.specialEquipment).isEmpty     { plan.specialEquipment      = row.special_equipment }
            if (plan.surgicalTeamNote).isEmpty     { plan.surgicalTeamNote      = row.surgical_team_note }
            plan.updatedAt = iso.date(from: row.updated_at) ?? .now

            // Restore WHO checklist booleans from JSONB
            if let jsonStr = row.who_checklist,
               let data = jsonStr.data(using: .utf8),
               let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Bool] {
                plan.whoIdentityConfirmed         = dict["identity"] ?? plan.whoIdentityConfirmed
                plan.whoSiteMarked                = dict["site_marked"] ?? plan.whoSiteMarked
                plan.whoAnaesthesiaCheckDone      = dict["anaesthesia_check"] ?? plan.whoAnaesthesiaCheckDone
                plan.whoPulseOxOk                 = dict["pulse_ox"] ?? plan.whoPulseOxOk
                plan.whoAllergiesReviewed         = dict["allergies"] ?? plan.whoAllergiesReviewed
                plan.whoAspirationRisk            = dict["aspiration_risk"] ?? plan.whoAspirationRisk
                plan.whoAirwayRisk                = dict["airway_risk"] ?? plan.whoAirwayRisk
                plan.whoTeamIntroduced            = dict["team_introduced"] ?? plan.whoTeamIntroduced
                plan.whoProcedureConfirmed        = dict["procedure_confirmed"] ?? plan.whoProcedureConfirmed
                plan.whoAntibioticGiven           = dict["antibiotic_given"] ?? plan.whoAntibioticGiven
                plan.whoCriticalStepsDiscussed    = dict["critical_steps"] ?? plan.whoCriticalStepsDiscussed
                plan.whoImagingDisplayed          = dict["imaging_displayed"] ?? plan.whoImagingDisplayed
                plan.whoSterilityConfirmed        = dict["sterility"] ?? plan.whoSterilityConfirmed
                plan.whoSwabsCounted              = dict["swabs_counted"] ?? plan.whoSwabsCounted
                plan.whoSpecimenLabelled          = dict["specimen_labelled"] ?? plan.whoSpecimenLabelled
                plan.whoEquipmentIssues           = dict["equipment_issues"] ?? plan.whoEquipmentIssues
                plan.whoRecoveryConcerns          = dict["recovery_concerns"] ?? plan.whoRecoveryConcerns
            }
            plan.pendingSync = false
        }
        try context.save()
    }


}
