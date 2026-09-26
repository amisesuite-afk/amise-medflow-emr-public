// SyncService+AppointmentSync.swift
// Pull confirmed appointments → auto-create patient records;
// push edits to existing synced patients (pendingSync cleared only on a confirmed update).

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
        let linked = AppointmentLinks.ids()

        for appt in rows {
            guard let name = appt.patient_name, !name.isEmpty else { continue }
            let placeholder = SyncRemoteId.placeholder(forAppointment: appt.id)
            guard !PatientIdentityStore.isDeleted(placeholder) else { continue }
            // Its placeholder patient already has a real patients row (pushPendingPatients or the
            // pull linked it). That patient no longer carries the placeholder, and may have been
            // renamed or deleted since: never create it again.
            guard !linked.contains(appt.id) else { continue }
            // One patient per name: match by appointment_id stored in remoteId, or by name.
            let existing = allLocal.first { $0.remoteId == placeholder }
                ?? allLocal.registeredMatches(name: name, dateOfBirth: nil).first
            guard existing == nil else { continue }

            let p = Patient(fullName: name)
            p.mrn = MRNGenerator.next(in: context)
            p.phone = appt.patient_phone
            p.email = appt.patient_email
            p.chiefComplaint = appt.reason
            // Placeholder, not a row id (SyncRemoteIds.swift): an untouched booking is not pushed
            // back. Once it has local work to upload, pushPendingPatients links or inserts the
            // patients row and replaces this with the real id.
            p.remoteId = placeholder
            p.pendingSync = false
            p.syncedAt = .now
            context.insert(p)
        }
        try context.save()
    }

    /// The patients row the server already links to a booking (appointment_requests.patient_id,
    /// written by the web check-in in api-server visit-lifecycle.ts) and that row's MRN, or nil.
    /// No migration in this repo adds that column, so a deployment without it (42703), a row this
    /// user cannot read, or any other server error gives nil and the caller links by MRN or
    /// inserts. Only a transport error is thrown: the push loop stops, as every later request
    /// would fail too.
    func serverPatientLink(forAppointment appointmentId: String) async throws
        -> (id: String, mrn: String?)? {
        guard SyncRemoteId.isValidUUID(appointmentId) else { return nil }
        struct BookingRow: Decodable { let patient_id: String? }
        struct PatientRow: Decodable { let id: String; let mrn: String? }
        do {
            let bookings: [BookingRow] = try await SupabaseConfig.client
                .from("appointment_requests")
                .select("patient_id")
                .eq("id", value: appointmentId)
                .limit(1)
                .execute()
                .value
            guard let patientId = SyncRemoteId.serverId(bookings.first?.patient_id) else { return nil }
            let patients: [PatientRow] = try await SupabaseConfig.client
                .from("patients")
                .select("id, mrn")
                .eq("id", value: patientId)
                .limit(1)
                .execute()
                .value
            guard let row = patients.first, SyncRemoteId.serverId(row.id) != nil else { return nil }
            return (id: row.id, mrn: row.mrn)
        } catch {
            if error is URLError || error is CancellationError { throw error }
            return nil
        }
    }

    // MARK: - Push edits to existing synced patients

    func pushPatientEdits(context: ModelContext) async throws {
        let refused = SyncRefusals.ids(.patient)
        // Only patients with a server row id. A booking placeholder ("appt:…") is not a row id
        // (Postgres rejects it as a uuid): pushPendingPatients, earlier in the same sync, replaces
        // it with the real id first. A malformed id is never sent.
        let dirty = try context.fetch(FetchDescriptor<Patient>())
            .filter { $0.pendingSync && SyncRemoteId.serverId($0.remoteId) != nil
                      && !refused.contains($0.id.uuidString) }
        guard !dirty.isEmpty else { return }

        // Front desk may change only the columns on the Migration 89 allow-list. Leaving the rest
        // out means a stale local copy of a clinical field (the pull never overwrites a non-empty
        // local one) cannot get the whole update refused. Only when the role is confirmed: a
        // doctor whose role fetch failed must still push their clinical edits.
        let frontDeskOnly = isRoleConfirmed && currentUserRole == .frontDesk
        let iso = ISO8601DateFormatter()
        var firstError: Error?

        for patient in dirty {
            // The loop awaits the network; a patient deleted meanwhile must not be read.
            guard patient.isLive, let remoteId = SyncRemoteId.serverId(patient.remoteId) else { continue }
            let localId = patient.id
            let row = PatientUpdateRow(patient, frontDeskOnly: frontDeskOnly, iso: iso)
            // pendingSync is what protects these edits from the pull (PatientPullMerge), so it is
            // cleared only when the server confirms the update. An update the server does not
            // apply (RLS, or the row is gone) returns no rows without an error; the edit then
            // stays pending locally rather than being reverted by the next pull (and is marked
            // refused when the row is still there: markRefusedIfUpdateNotApplied). A 42501 (not
            // permitted for this role) marks the patient refused: it stays pending and is not
            // retried until the next sign-in. Same rule as pushPendingNotes.
            let editedAt = patient.updatedAt
            struct UpdateResponse: Decodable { let id: String }
            do {
                let updated: [UpdateResponse] = try await SupabaseConfig.client
                    .from("patients")
                    .update(row)
                    .eq("id", value: remoteId)
                    .select("id")
                    .execute()
                    .value
                // 0 rows back with the row still there: not permitted for this role (marked
                // refused, like a 42501).
                try await markRefusedIfUpdateNotApplied(rowsReturned: updated.count, table: "patients",
                                                        remoteId: remoteId, id: localId, kind: .patient)
                // The await above may have outlived a delete; and an edit made while it ran was
                // not in this request, so it keeps the patient pending for the next sync.
                guard patient.isLive, !updated.isEmpty, patient.updatedAt == editedAt else { continue }
                patient.pendingSync = false
                patient.syncedAt = .now
            } catch {
                guard continueAfterPushFailure(error, id: localId, kind: .patient,
                                               firstError: &firstError) else { break }
            }
        }
        try context.save()
        if let firstError { throw firstError }
    }

}

// MARK: - Patient UPDATE payload

/// Columns a front-desk user may change on `patients`. Mirrors `admin_columns` in
/// `enforce_front_desk_patient_columns()` (supabase-staff-only-rls-migration.sql, Migration 89):
/// keep the two in step.
enum FrontDeskPatientColumns {
    static let allowed: Set<String> = [
        // identity and contact
        "full_name", "first_name", "last_name", "date_of_birth", "sex",
        "phone", "email", "address", "quarter", "occupation", "photo_url",
        "mrn", "nhi_number",
        // next of kin / emergency contact
        "nok_name", "nok_relation", "nok_phone", "emergency_contact", "emergency_phone",
        // insurance and referral administration
        "insurance_provider", "policy_number", "pre_auth_status", "referred_by",
        // scheduling / encounter flow
        "check_in_time", "encounter_status", "setting", "location", "operation_date",
        "visit_type", "appointment_type",   // appointment_type: own request, SyncService+AppointmentType
        // patient-reported intake
        "chief_complaint", "pmh_notes", "family_history_notes", "surgical_history",
        "allergies_json", "height_cm",
        // bookkeeping
        "updated_at", "updated_by",
    ]
}

/// The body of the `patients` UPDATE sent by `pushPatientEdits`. A nil property is left out of
/// the JSON (synthesised Encodable skips nil optionals), so it never clears a server value.
/// With `frontDeskOnly`, every column outside `FrontDeskPatientColumns.allowed` is nil, i.e. not
/// sent. Internal (not private) so the front-desk filter is unit-tested (FrontDeskSyncTests).
struct PatientUpdateRow: Encodable {
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
    let acuity: String?
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

    init(_ patient: Patient, frontDeskOnly: Bool, iso: ISO8601DateFormatter = ISO8601DateFormatter()) {
        /// The value, or nil (not sent) when a front-desk push may not change `column`.
        func v<T>(_ column: String, _ value: T?) -> T? {
            frontDeskOnly && !FrontDeskPatientColumns.allowed.contains(column) ? nil : value
        }
        // The non-optional columns (full_name, sex, setting, location, encounter_status,
        // updated_at) are all on the front-desk allow-list, so they are always sent.
        full_name = patient.fullName
        sex = patient.sex.supabaseValue
        phone = v("phone", patient.phone)
        email = v("email", patient.email)
        address = v("address", patient.address)
        mrn = v("mrn", patient.mrn)
        nok_name = v("nok_name", patient.nokName)
        nok_relation = v("nok_relation", patient.nokRelation)
        nok_phone = v("nok_phone", patient.nokPhone)
        insurance_provider = v("insurance_provider", patient.insuranceProvider)
        policy_number = v("policy_number", patient.policyNumber)
        pmh_notes = v("pmh_notes", patient.pmhNotes)
        family_history_notes = v("family_history_notes", patient.familyHistoryNotes)
        working_diagnosis = v("working_diagnosis", patient.workingDiagnosis)
        working_diagnosis_icd = v("working_diagnosis_icd", patient.workingDiagnosisICD)
        setting = patient.setting.rawValue.lowercased()
        location = PatientUpdateRow.locationCode(patient.location)
        acuity = v("acuity", patient.acuity.label.lowercased())
        chief_complaint = v("chief_complaint", patient.chiefComplaint)
        hpi = v("hpi", patient.hpi)
        assessment_text = v("assessment_text", patient.assessmentText)
        management_plan = v("management_plan", patient.managementPlan)
        allergies_json = v("allergies_json", patient.allergiesJson)
        investigations_json = v("investigations_json", patient.investigationsJson)
        pmh_entries_json = v("pmh_entries_json", patient.pmhEntriesJson)
        pshx_entries_json = v("pshx_entries_json", patient.pshxEntriesJson)
        social_history = v("social_history", patient.socialHistory)
        surgical_history = v("surgical_history", patient.surgicalHistory)
        height_cm = v("height_cm", patient.heightCm)
        ward = v("ward", patient.ward)
        bed_number = v("bed_number", patient.bedNumber)
        exam_general = v("exam_general", patient.examGeneral)
        exam_cvs = v("exam_cvs", patient.examCVS)
        exam_resp = v("exam_resp", patient.examResp)
        exam_abdo = v("exam_abdo", patient.examAbdo)
        exam_neuro = v("exam_neuro", patient.examNeuro)
        exam_msk = v("exam_msk", patient.examMSK)
        exam_skin = v("exam_skin", patient.examSkin)
        exam_other = v("exam_other", patient.examOther)
        encounter_status = patient.encounterStatus.rawValue
        check_in_time = v("check_in_time", patient.checkInTime.map { iso.string(from: $0) })
        updated_at = iso.string(from: patient.updatedAt)
        visit_type = v("visit_type", patient.visitType?.rawValue)
        mallampati_score = v("mallampati_score", patient.mallampatiScore)
        operation_date = v("operation_date", patient.operationDate.map { iso.string(from: $0) })
        trauma_data_json = v("trauma_data_json", patient.traumaDataJson)
        ogd_data_json = v("ogd_data_json", patient.ogdDataJson)
        colonoscopy_data_json = v("colonoscopy_data_json", patient.colonoscopyDataJson)
        surgery_data_json = v("surgery_data_json", patient.surgeryDataJson)
        ercp_data_json = v("ercp_data_json", patient.ercpDataJson)
        bronchoscopy_data_json = v("bronchoscopy_data_json", patient.bronchoscopyDataJson)
        discharge_summary_data_json = v("discharge_summary_data_json", patient.dischargeSummaryDataJson)
        post_op_review_data_json = v("post_op_review_data_json", patient.postOpReviewDataJson)
        referral_letter_data_json = v("referral_letter_data_json", patient.referralLetterDataJson)
        consent_form_data_json = v("consent_form_data_json", patient.consentFormDataJson)
        pre_op_checklist_data_json = v("pre_op_checklist_data_json", patient.preOpChecklistDataJson)
        patient_instructions_data_json = v("patient_instructions_data_json", patient.patientInstructionsDataJson)
    }

    /// Same mapping as SyncService.locationCode(_:).
    static func locationCode(_ location: ClinicalLocation) -> String {
        switch location {
        case .rodney_bay: return "rodney_bay"
        case .tapion:     return "tapion"
        case .okeu:       return "okeu"
        case .victoria:   return "victoria"
        case .other:      return "other"
        }
    }
}
