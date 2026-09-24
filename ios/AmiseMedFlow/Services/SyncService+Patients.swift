// SyncService+Patients.swift
// Patient sync: pull new patients, confirmed appointments, push patient edits.

import Foundation
import SwiftData
import Supabase

extension SyncService {

    // MARK: - Patient sync

    private struct RemotePatient: Decodable {
        let id: String
        let full_name: String
        let sex: String?
        let date_of_birth: String?
        let phone: String?
        let email: String?
        let address: String?
        let mrn: String?
        let nok_name: String?
        let nok_relation: String?
        let nok_phone: String?
        let pmh_notes: String?
        let family_history_notes: String?
        let insurance_provider: String?
        let policy_number: String?
        let setting: String?
        let location: String?
        let acuity: String?
        let visit_type: String?
        let mallampati_score: Int?
        let operation_date: String?
        let chief_complaint: String?
        let hpi: String?
        let assessment_text: String?
        let management_plan: String?
        let working_diagnosis: String?
        let working_diagnosis_icd: String?
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
        let encounter_status: String?
        let check_in_time: String?
        let created_at: String
        // Procedure form JSON blobs
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

    func pullPatients(context: ModelContext) async throws {
        let rows: [RemotePatient] = try await SupabaseConfig.client
            .from("patients")
            .select("id, full_name, sex, date_of_birth, phone, email, address, mrn, nok_name, nok_relation, nok_phone, pmh_notes, family_history_notes, insurance_provider, policy_number, setting, location, acuity, visit_type, mallampati_score, operation_date, chief_complaint, hpi, assessment_text, management_plan, working_diagnosis, working_diagnosis_icd, allergies_json, investigations_json, pmh_entries_json, pshx_entries_json, social_history, surgical_history, height_cm, ward, bed_number, exam_general, exam_cvs, exam_resp, exam_abdo, exam_neuro, exam_msk, exam_skin, exam_other, encounter_status, check_in_time, created_at, trauma_data_json, ogd_data_json, colonoscopy_data_json, surgery_data_json, ercp_data_json, bronchoscopy_data_json, discharge_summary_data_json, post_op_review_data_json, referral_letter_data_json, consent_form_data_json, pre_op_checklist_data_json, patient_instructions_data_json")
            .order("created_at", ascending: false)
            .limit(500)
            .execute()
            .value

        let iso = ISO8601DateFormatter()

        // Load all local patients once, then match in Swift (avoids #Predicate capture issues)
        let allLocal = try context.fetch(FetchDescriptor<Patient>())

        for row in rows {
            // Deleted on this device: skip so it does not reappear (deletes are local-only).
            if PatientIdentityStore.isDeleted(row.id) { continue }
            // Match the Supabase row; else adopt a local record with the same MRN that has not
            // received its remoteId yet (e.g. its insert reached the server but the app was
            // closed before the id was saved), instead of creating a second copy.
            let existing = allLocal.first { $0.remoteId == row.id }
                ?? allLocal.first { p in
                    p.remoteId == nil && !(p.mrn ?? "").isEmpty && p.mrn == row.mrn &&
                    p.normalizedName == Patient.normalize(row.full_name)
                }
            let patient = existing ?? {
                let p = Patient(fullName: row.full_name)
                context.insert(p)
                return p
            }()

            patient.remoteId = row.id
            patient.fullName = row.full_name
            patient.sex = Sex.fromSupabase(row.sex)
            if let dob = row.date_of_birth { patient.dateOfBirth = iso.date(from: dob) }
            patient.phone = row.phone
            patient.email = row.email
            patient.address = row.address
            patient.mrn = row.mrn
            patient.nokName = row.nok_name
            patient.nokRelation = row.nok_relation
            patient.nokPhone = row.nok_phone
            patient.pmhNotes = row.pmh_notes
            patient.familyHistoryNotes = row.family_history_notes
            patient.insuranceProvider = row.insurance_provider
            patient.policyNumber = row.policy_number
            if let s = row.setting { patient.setting = ClinicalSetting(rawValue: s.capitalized) ?? .outpatient }
            if let l = row.location { patient.location = ClinicalLocation(rawValue: locationDisplayName(l)) ?? .rodney_bay }
            if let a = row.acuity { patient.acuity = acuityFromString(a) }
            // Clinical fields — only update from remote if local is still empty
            // (prefer local edits; remote is the source of truth only on first pull)
            if let cc = row.chief_complaint, (patient.chiefComplaint ?? "").isEmpty {
                patient.chiefComplaint = cc
            }
            if let hpi = row.hpi, (patient.hpi ?? "").isEmpty {
                patient.hpi = hpi
            }
            if let at = row.assessment_text, (patient.assessmentText ?? "").isEmpty {
                patient.assessmentText = at
            }
            if let mp = row.management_plan, (patient.managementPlan ?? "").isEmpty {
                patient.managementPlan = mp
            }
            if let wd = row.working_diagnosis, (patient.workingDiagnosis ?? "").isEmpty {
                patient.workingDiagnosis = wd
                patient.workingDiagnosisICD = row.working_diagnosis_icd
            }
            if let vt = row.visit_type, patient.visitType == nil {
                patient.visitType = VisitType(rawValue: vt)
            }
            if let ms = row.mallampati_score, patient.mallampatiScore == nil {
                patient.mallampatiScore = ms
            }
            if let od = row.operation_date, patient.operationDate == nil {
                patient.operationDate = iso.date(from: od)
            }
            if let aj = row.allergies_json, (patient.allergiesJson ?? "").isEmpty {
                patient.allergiesJson = aj
            }
            if let ij = row.investigations_json, (patient.investigationsJson ?? "").isEmpty {
                patient.investigationsJson = ij
            }
            if let pmh = row.pmh_entries_json, (patient.pmhEntriesJson ?? "").isEmpty {
                patient.pmhEntriesJson = pmh
            }
            if let psx = row.pshx_entries_json, (patient.pshxEntriesJson ?? "").isEmpty {
                patient.pshxEntriesJson = psx
            }
            if let sh = row.social_history, (patient.socialHistory ?? "").isEmpty {
                patient.socialHistory = sh
            }
            if let sx = row.surgical_history, (patient.surgicalHistory ?? "").isEmpty {
                patient.surgicalHistory = sx
            }
            if let h = row.height_cm, patient.heightCm == nil { patient.heightCm = h }
            if let w = row.ward,   (patient.ward ?? "").isEmpty   { patient.ward = w }
            if let b = row.bed_number, (patient.bedNumber ?? "").isEmpty { patient.bedNumber = b }
            if let eg = row.exam_general, (patient.examGeneral ?? "").isEmpty { patient.examGeneral = eg }
            if let ec = row.exam_cvs,    (patient.examCVS ?? "").isEmpty     { patient.examCVS     = ec }
            if let er = row.exam_resp,   (patient.examResp ?? "").isEmpty    { patient.examResp    = er }
            if let ea = row.exam_abdo,   (patient.examAbdo ?? "").isEmpty    { patient.examAbdo    = ea }
            if let en = row.exam_neuro,  (patient.examNeuro ?? "").isEmpty   { patient.examNeuro   = en }
            if let em = row.exam_msk,    (patient.examMSK ?? "").isEmpty     { patient.examMSK     = em }
            if let es = row.exam_skin,   (patient.examSkin ?? "").isEmpty    { patient.examSkin    = es }
            if let eo = row.exam_other,  (patient.examOther ?? "").isEmpty   { patient.examOther   = eo }

            // Procedure form JSON blobs — prefer local if non-empty
            if let v = row.trauma_data_json,               (patient.traumaDataJson ?? "").isEmpty               { patient.traumaDataJson               = v }
            if let v = row.ogd_data_json,                  (patient.ogdDataJson ?? "").isEmpty                  { patient.ogdDataJson                  = v }
            if let v = row.colonoscopy_data_json,          (patient.colonoscopyDataJson ?? "").isEmpty          { patient.colonoscopyDataJson          = v }
            if let v = row.surgery_data_json,              (patient.surgeryDataJson ?? "").isEmpty              { patient.surgeryDataJson              = v }
            if let v = row.ercp_data_json,                 (patient.ercpDataJson ?? "").isEmpty                 { patient.ercpDataJson                 = v }
            if let v = row.bronchoscopy_data_json,         (patient.bronchoscopyDataJson ?? "").isEmpty         { patient.bronchoscopyDataJson         = v }
            if let v = row.discharge_summary_data_json,    (patient.dischargeSummaryDataJson ?? "").isEmpty     { patient.dischargeSummaryDataJson     = v }
            if let v = row.post_op_review_data_json,       (patient.postOpReviewDataJson ?? "").isEmpty         { patient.postOpReviewDataJson         = v }
            if let v = row.referral_letter_data_json,      (patient.referralLetterDataJson ?? "").isEmpty       { patient.referralLetterDataJson       = v }
            if let v = row.consent_form_data_json,         (patient.consentFormDataJson ?? "").isEmpty          { patient.consentFormDataJson          = v }
            if let v = row.pre_op_checklist_data_json,     (patient.preOpChecklistDataJson ?? "").isEmpty       { patient.preOpChecklistDataJson       = v }
            if let v = row.patient_instructions_data_json, (patient.patientInstructionsDataJson ?? "").isEmpty  { patient.patientInstructionsDataJson  = v }

            if let es = row.encounter_status {
                patient.encounterStatus = EncounterStatus(rawValue: es) ?? .notCheckedIn
            }
            if let ct = row.check_in_time {
                patient.checkInTime = iso.date(from: ct)
            }
            patient.syncedAt = .now
            // Only mark clean for patients created from this pull.
            // Existing dirty patients keep pendingSync=true so pushPatientEdits
            // can still flush their local edits in the same sync cycle.
            if existing == nil {
                patient.pendingSync = false
            }
        }

        try context.save()
    }

    func locationDisplayName(_ code: String) -> String {
        switch code {
        case "rodney_bay": return "Rodney Bay"
        case "tapion":     return "Tapion"
        case "okeu":       return "OKEU"
        case "victoria":   return "Victoria"
        default:           return "Other"
        }
    }

    func locationCode(_ location: ClinicalLocation) -> String {
        switch location {
        case .rodney_bay: return "rodney_bay"
        case .tapion:     return "tapion"
        case .okeu:       return "okeu"
        case .victoria:   return "victoria"
        case .other:      return "other"
        }
    }

    func acuityFromString(_ s: String) -> Acuity {
        switch s {
        case "emergency": return .emergency
        case "urgent":    return .urgent
        case "priority":  return .priority
        default:          return .routine
        }
    }

    func pushPendingPatients(context: ModelContext) async throws {
        let pending = try context.fetch(FetchDescriptor<Patient>())
            .filter { $0.pendingSync && $0.remoteId == nil }
        guard !pending.isEmpty else { return }

        for patient in pending {
            struct InsertRow: Encodable {
                let full_name: String
                let sex: String
                let date_of_birth: String?
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
            let isoFmt = ISO8601DateFormatter()
            let row = InsertRow(
                full_name: patient.fullName,
                sex: patient.sex.supabaseValue,
                date_of_birth: patient.dateOfBirth.map { isoFmt.string(from: $0) },
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
                check_in_time: patient.checkInTime.map { isoFmt.string(from: $0) },
                visit_type: patient.visitType?.rawValue,
                mallampati_score: patient.mallampatiScore,
                operation_date: patient.operationDate.map { isoFmt.string(from: $0) },
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
            struct InsertResponse: Decodable { let id: String }
            // Idempotent push: if an earlier insert for this MRN already reached the server
            // (response lost, app killed before save), adopt that row instead of inserting again.
            // MRN AND name must both match: MRN counters are per-device, so an MRN alone could
            // belong to a different patient registered on another device.
            if let mrn = patient.mrn, !mrn.isEmpty {
                struct ExistingRow: Decodable { let id: String; let full_name: String }
                let already: [ExistingRow] = try await SupabaseConfig.client
                    .from("patients")
                    .select("id, full_name")
                    .eq("mrn", value: mrn)
                    .execute()
                    .value
                let claimed = Set(try context.fetch(FetchDescriptor<Patient>()).compactMap(\.remoteId))
                if let row = already.first(where: {
                    Patient.normalize($0.full_name) == patient.normalizedName && !claimed.contains($0.id)
                }) {
                    patient.remoteId = row.id
                    patient.pendingSync = false
                    patient.syncedAt = .now
                    try context.save()
                    continue
                }
            }
            let response: [InsertResponse] = try await SupabaseConfig.client
                .from("patients")
                .insert(row)
                .select("id")
                .execute()
                .value
            if let first = response.first {
                patient.remoteId = first.id
                patient.pendingSync = false
                patient.syncedAt = .now
                try context.save()   // persist the id immediately so a crash can't cause a re-insert
            }
        }
        try context.save()
    }

}
