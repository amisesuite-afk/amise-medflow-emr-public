// SyncService+AppointmentSync.swift
// Pull confirmed appointments → auto-create patient records;
// push edits to existing synced patients.

import Foundation
import SwiftData
import Supabase


extension SyncService {

    // MARK: - Pull confirmed appointments → auto-create patient records

    private struct RemoteAppointment: Decodable {
        let id: String
        let patient_name: String?
        let patient_phone: String?
        let patient_email: String?
        let reason: String?
        let preferred_slot: String?
        let status: String?
        let created_at: String
    }

    func pullConfirmedAppointments(context: ModelContext) async throws {
        let oneWeekAgo = ISO8601DateFormatter().string(from: Date(timeIntervalSinceNow: -7 * 86400))
        let rows: [RemoteAppointment]
        do {
            rows = try await SupabaseConfig.client
                .from("appointment_requests")
                .select("id, patient_name, patient_phone, patient_email, reason, preferred_slot, status, created_at")
                .in("status", values: ["staff_confirmed", "patient_confirmed"])
                .gte("created_at", value: oneWeekAgo)
                .order("created_at", ascending: false)
                .limit(200)
                .execute()
                .value
        } catch {
            // appointment_requests schema varies across deployments — skip without failing the whole sync
            return
        }

        let allLocal = try context.fetch(FetchDescriptor<Patient>())

        for appt in rows {
            guard let name = appt.patient_name, !name.isEmpty else { continue }
            guard !PatientIdentityStore.isDeleted("appt:\(appt.id)") else { continue }
            // Avoid duplicates: match by appointment_id stored in remoteId, or by name+phone
            let existing = allLocal.first { p in
                p.remoteId == "appt:\(appt.id)" ||
                (p.fullName.lowercased() == name.lowercased() && p.phone == appt.patient_phone)
            }
            guard existing == nil else { continue }

            let p = Patient(fullName: name)
            p.mrn = MRNGenerator.next(in: context)
            p.phone = appt.patient_phone
            p.email = appt.patient_email
            p.chiefComplaint = appt.reason
            p.remoteId = "appt:\(appt.id)"  // sentinel so we don't push this back
            p.pendingSync = false
            p.syncedAt = .now
            context.insert(p)
        }
        try context.save()
    }

    // MARK: - Push edits to existing synced patients

    func pushPatientEdits(context: ModelContext) async throws {
        let dirty = try context.fetch(FetchDescriptor<Patient>())
            .filter { $0.pendingSync && $0.remoteId != nil }
        guard !dirty.isEmpty else { return }

        for patient in dirty {
            guard let remoteId = patient.remoteId else { continue }
            struct UpdateRow: Encodable {
                let full_name: String
                let sex: String
                let phone: String?
                let email: String?
                let address: String?
                let mrn: String?
                let nok_name: String?
                let nok_relation: String?
                let nok_phone: String?
                let insurance_provider: String?
                let policy_number: String?
                let pmh_notes: String?
                let family_history_notes: String?
                let working_diagnosis: String?
                let working_diagnosis_icd: String?
                let setting: String
                let location: String
                let acuity: String
                let chief_complaint: String?
                let hpi: String?
                let assessment_text: String?
                let management_plan: String?
                let allergies_json: String?
                let investigations_json: String?
                let pmh_entries_json: String?
                let pshx_entries_json: String?
                let social_history: String?
                let surgical_history: String?
                let height_cm: Double?
                let ward: String?
                let bed_number: String?
                let exam_general: String?
                let exam_cvs: String?
                let exam_resp: String?
                let exam_abdo: String?
                let exam_neuro: String?
                let exam_msk: String?
                let exam_skin: String?
                let exam_other: String?
                let encounter_status: String
                let check_in_time: String?
                let updated_at: String
                let visit_type: String?
                let mallampati_score: Int?
                let operation_date: String?
                let trauma_data_json: String?
                let ogd_data_json: String?
                let colonoscopy_data_json: String?
                let surgery_data_json: String?
                let ercp_data_json: String?
                let bronchoscopy_data_json: String?
                let discharge_summary_data_json: String?
                let post_op_review_data_json: String?
                let referral_letter_data_json: String?
                let consent_form_data_json: String?
                let pre_op_checklist_data_json: String?
                let patient_instructions_data_json: String?
            }
            let iso = ISO8601DateFormatter()
            let row = UpdateRow(
                full_name: patient.fullName,
                sex: patient.sex.supabaseValue,
                phone: patient.phone,
                email: patient.email,
                address: patient.address,
                mrn: patient.mrn,
                nok_name: patient.nokName,
                nok_relation: patient.nokRelation,
                nok_phone: patient.nokPhone,
                insurance_provider: patient.insuranceProvider,
                policy_number: patient.policyNumber,
                pmh_notes: patient.pmhNotes,
                family_history_notes: patient.familyHistoryNotes,
                working_diagnosis: patient.workingDiagnosis,
                working_diagnosis_icd: patient.workingDiagnosisICD,
                setting: patient.setting.rawValue.lowercased(),
                location: locationCode(patient.location),
                acuity: patient.acuity.label.lowercased(),
                chief_complaint: patient.chiefComplaint,
                hpi: patient.hpi,
                assessment_text: patient.assessmentText,
                management_plan: patient.managementPlan,
                allergies_json: patient.allergiesJson,
                investigations_json: patient.investigationsJson,
                pmh_entries_json: patient.pmhEntriesJson,
                pshx_entries_json: patient.pshxEntriesJson,
                social_history: patient.socialHistory,
                surgical_history: patient.surgicalHistory,
                height_cm: patient.heightCm,
                ward: patient.ward,
                bed_number: patient.bedNumber,
                exam_general: patient.examGeneral,
                exam_cvs: patient.examCVS,
                exam_resp: patient.examResp,
                exam_abdo: patient.examAbdo,
                exam_neuro: patient.examNeuro,
                exam_msk: patient.examMSK,
                exam_skin: patient.examSkin,
                exam_other: patient.examOther,
                encounter_status: patient.encounterStatus.rawValue,
                check_in_time: patient.checkInTime.map { iso.string(from: $0) },
                updated_at: iso.string(from: patient.updatedAt),
                visit_type: patient.visitType?.rawValue,
                mallampati_score: patient.mallampatiScore,
                operation_date: patient.operationDate.map { iso.string(from: $0) },
                trauma_data_json: patient.traumaDataJson,
                ogd_data_json: patient.ogdDataJson,
                colonoscopy_data_json: patient.colonoscopyDataJson,
                surgery_data_json: patient.surgeryDataJson,
                ercp_data_json: patient.ercpDataJson,
                bronchoscopy_data_json: patient.bronchoscopyDataJson,
                discharge_summary_data_json: patient.dischargeSummaryDataJson,
                post_op_review_data_json: patient.postOpReviewDataJson,
                referral_letter_data_json: patient.referralLetterDataJson,
                consent_form_data_json: patient.consentFormDataJson,
                pre_op_checklist_data_json: patient.preOpChecklistDataJson,
                patient_instructions_data_json: patient.patientInstructionsDataJson
            )
            try await SupabaseConfig.client
                .from("patients")
                .update(row)
                .eq("id", value: remoteId)
                .execute()
            patient.pendingSync = false
            patient.syncedAt = .now
        }
        try context.save()
    }

}
