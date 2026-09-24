// PeerSyncService+ApplyRecords.swift
// Apply received manifest records and helper methods for peer sync.
//
// Pending rule (PeerApplyPending): applying a peer's copy never clears this device's pendingSync
// (that flag is what protects unsent local edits from the next cloud pull). When the peer's copy
// holds a change it has not uploaded yet (its pendingSync) and applying it changed this device's
// record, the record becomes pending here too, so whichever device reaches the cloud first
// uploads it and the cloud pull cannot overwrite it meanwhile. Only for a record that already
// has a server row: that upload is an update, and two devices sending the same values is
// idempotent. A record with no server row yet is left to the device it came from (two inserts
// would make two rows); it is linked by syncCode here and by remoteId once the origin uploads.

import Foundation
import MultipeerConnectivity
import SwiftData
import UIKit

/// Whether a record is pending after a peer's copy has been applied to it. Pure; tested in
/// SyncGapsTests.
enum PeerApplyPending {
    /// - localPending: this device's record had unsent edits before the apply. Never cleared.
    /// - contentChanged: the apply changed the record's content here (a new record counts).
    /// - hasServerRow: the record has a server row id, so uploading it is an idempotent update.
    /// - peerPending: the peer's copy had a change it has not uploaded (nil: an older build).
    static func pendingAfterApply(localPending: Bool, contentChanged: Bool, hasServerRow: Bool,
                                  peerPending: Bool?) -> Bool {
        if localPending { return true }
        guard contentChanged, hasServerRow else { return false }
        return peerPending == true
    }
}

extension PeerSyncService {

    // MARK: - Apply received records

    func applyPatients(_ records: [PeerPatient], context: ModelContext) throws {
        let existing = (try? context.fetch(FetchDescriptor<Patient>())) ?? []
        let iso = ISO8601DateFormatter()
        for rec in records {
            // Deleted on this device: don't let a peer recreate it.
            if PatientIdentityStore.isDeleted(rec.syncCode) || PatientIdentityStore.isDeleted(rec.remoteId) { continue }
            // Match by syncCode first; fall back to remoteId for records synced before this feature
            let matched: Patient? = existing.first(where: { $0.syncCode == rec.syncCode })
                ?? existing.first(where: { rid in rec.remoteId != nil && rid.remoteId == rec.remoteId })
            // Before the merge: unsent local edits, and the content to compare against afterwards.
            let wasPending = matched?.pendingSync ?? false
            var contentBefore: Data?
            if let m = matched { contentBefore = Self.contentFingerprint(m) }
            let patient: Patient
            if let m = matched {
                patient = m
            } else {
                patient = Patient(fullName: rec.fullName)
                context.insert(patient)
            }

            let peerTime = Date(timeIntervalSince1970: rec.syncedAt)
            let myTime   = patient.syncedAt ?? .distantPast
            // A record created here from the peer takes the peer's administrative fields even when
            // neither side has a cloud sync time yet (both would otherwise be distantPast).
            let remoteIsNewer = matched == nil || peerTime > myTime

            // Identity — always propagate syncCode; link the server row when this copy has none.
            patient.syncCode = rec.syncCode
            linkPeerRemoteId(rec.remoteId, to: patient, others: existing)

            // ── Administrative fields: remote wins when it is newer ──────────
            // A blank / missing / unparseable remote value never replaces a non-empty local one
            // (adminMerge); a newer non-empty remote value still wins.
            if remoteIsNewer {
                if let name = nonBlank(rec.fullName) { patient.fullName = name }
                if let s = rec.sex, let sex = Sex(rawValue: s.capitalized), sex != .unspecified {
                    patient.sex = sex
                }
                if let d = rec.dob, let dob = iso.date(from: d) { patient.dateOfBirth = dob }
                patient.phone       = adminMerge(patient.phone,       rec.phone)
                patient.email       = adminMerge(patient.email,       rec.email)
                patient.address     = adminMerge(patient.address,     rec.address)
                patient.mrn         = adminMerge(patient.mrn,         rec.mrn)
                patient.nokName     = adminMerge(patient.nokName,     rec.nokName)
                patient.nokRelation = adminMerge(patient.nokRelation, rec.nokRelation)
                patient.nokPhone    = adminMerge(patient.nokPhone,    rec.nokPhone)
                patient.insuranceProvider = adminMerge(patient.insuranceProvider, rec.insuranceProvider)
                patient.policyNumber      = adminMerge(patient.policyNumber,      rec.policyNumber)
                if let s = rec.setting, let setting = ClinicalSetting(rawValue: s.capitalized) {
                    patient.setting = setting
                }
                if let l = rec.location, let location = ClinicalLocation(rawValue: l) {
                    patient.location = location
                }
                if let a = rec.acuity   { patient.acuity    = acuityFrom(a) }
                if let h = rec.heightCm { patient.heightCm  = h }
                if let w = rec.ward,        !w.isEmpty { patient.ward       = w }
                if let b = rec.bedNumber,   !b.isEmpty { patient.bedNumber  = b }
                // NEWS2 SpO₂ scale (clinician decision): newer wins; absent in older payloads.
                if let scale2 = rec.news2UseSpO2Scale2 { patient.news2UseSpO2Scale2 = scale2 }
            }

            // ── Clinical narrative: longer value wins regardless of timestamp ─
            // Questionnaire data is multi-line structured text; booking stubs are
            // short phrases. The longer string is reliably the more clinically
            // informative source, so length is a safe proxy for richness.
            patient.chiefComplaint     = peerMerge(patient.chiefComplaint,     rec.chiefComplaint)
            patient.hpi                = peerMerge(patient.hpi,                rec.hpi)
            patient.pmhNotes           = peerMerge(patient.pmhNotes,           rec.pmhNotes)
            patient.familyHistoryNotes = peerMerge(patient.familyHistoryNotes, rec.familyHistoryNotes)
            patient.allergiesJson      = peerMerge(patient.allergiesJson,      rec.allergiesJson)
            patient.investigationsJson = peerMerge(patient.investigationsJson, rec.investigationsJson)
            patient.pmhEntriesJson     = peerMerge(patient.pmhEntriesJson,     rec.pmhEntriesJson)
            patient.pshxEntriesJson    = peerMerge(patient.pshxEntriesJson,    rec.pshxEntriesJson)
            patient.socialHistory      = peerMerge(patient.socialHistory,      rec.socialHistory)
            patient.surgicalHistory    = peerMerge(patient.surgicalHistory,    rec.surgicalHistory)

            // ── Visit metadata: nil on first fill; newer wins for updates ────────────
            if let vt = rec.visitType, patient.visitType == nil || remoteIsNewer {
                patient.visitType = VisitType(rawValue: vt)
            }
            if let ms = rec.mallampatiScore, (patient.mallampatiScore == nil || remoteIsNewer) {
                patient.mallampatiScore = ms
            }
            if let od = rec.operationDate {
                let iso = ISO8601DateFormatter()
                if let d = iso.date(from: od), (patient.operationDate == nil || remoteIsNewer) {
                    patient.operationDate = d
                }
            }

            // ── Procedure form JSON blobs: longer value wins (richer data) ───────────
            patient.traumaDataJson              = peerMerge(patient.traumaDataJson,              rec.traumaDataJson)
            patient.ogdDataJson                 = peerMerge(patient.ogdDataJson,                 rec.ogdDataJson)
            patient.colonoscopyDataJson         = peerMerge(patient.colonoscopyDataJson,         rec.colonoscopyDataJson)
            patient.surgeryDataJson             = peerMerge(patient.surgeryDataJson,             rec.surgeryDataJson)
            patient.ercpDataJson                = peerMerge(patient.ercpDataJson,                rec.ercpDataJson)
            patient.bronchoscopyDataJson        = peerMerge(patient.bronchoscopyDataJson,        rec.bronchoscopyDataJson)
            patient.dischargeSummaryDataJson    = peerMerge(patient.dischargeSummaryDataJson,    rec.dischargeSummaryDataJson)
            patient.postOpReviewDataJson        = peerMerge(patient.postOpReviewDataJson,        rec.postOpReviewDataJson)
            patient.referralLetterDataJson      = peerMerge(patient.referralLetterDataJson,      rec.referralLetterDataJson)
            patient.consentFormDataJson         = peerMerge(patient.consentFormDataJson,         rec.consentFormDataJson)
            patient.preOpChecklistDataJson      = peerMerge(patient.preOpChecklistDataJson,      rec.preOpChecklistDataJson)
            patient.patientInstructionsDataJson = peerMerge(patient.patientInstructionsDataJson, rec.patientInstructionsDataJson)
            // Pathway forms are edited in place (checklists, toggles): newer wins, not longer.
            patient.pathwayDataJson = mergeDoc(patient.pathwayDataJson, rec.pathwayDataJson, remoteIsNewer: remoteIsNewer)

            // ── Doctor-assessed fields: non-empty on first fill; newer wins for updates ──
            patient.assessmentText = mergeDoc(patient.assessmentText, rec.assessmentText, remoteIsNewer: remoteIsNewer)
            patient.managementPlan = mergeDoc(patient.managementPlan, rec.managementPlan, remoteIsNewer: remoteIsNewer)
            if let r = rec.workingDiagnosis, !r.isEmpty {
                if (patient.workingDiagnosis ?? "").isEmpty || remoteIsNewer {
                    patient.workingDiagnosis    = r
                    patient.workingDiagnosisICD = rec.workingDiagnosisICD
                }
            }

            // ── Exam findings: non-empty on first fill; newer wins for updates ─
            patient.examGeneral = mergeDoc(patient.examGeneral, rec.examGeneral, remoteIsNewer: remoteIsNewer)
            patient.examCVS     = mergeDoc(patient.examCVS,     rec.examCVS,     remoteIsNewer: remoteIsNewer)
            patient.examResp    = mergeDoc(patient.examResp,    rec.examResp,    remoteIsNewer: remoteIsNewer)
            patient.examAbdo    = mergeDoc(patient.examAbdo,    rec.examAbdo,    remoteIsNewer: remoteIsNewer)
            patient.examNeuro   = mergeDoc(patient.examNeuro,   rec.examNeuro,   remoteIsNewer: remoteIsNewer)
            patient.examMSK     = mergeDoc(patient.examMSK,     rec.examMSK,     remoteIsNewer: remoteIsNewer)
            patient.examSkin    = mergeDoc(patient.examSkin,    rec.examSkin,    remoteIsNewer: remoteIsNewer)
            patient.examOther   = mergeDoc(patient.examOther,   rec.examOther,   remoteIsNewer: remoteIsNewer)

            patient.syncedAt    = max(myTime, peerTime)
            // Unsent local edits stay pending; a peer's unsent change to a record with a server
            // row becomes pending here too (PeerApplyPending). A content change bumps updatedAt,
            // so a cloud push already in flight for this patient does not clear pendingSync over
            // values it did not send.
            let contentChanged = matched == nil || contentBefore == nil
                || contentBefore != Self.contentFingerprint(patient)
            if contentChanged && matched != nil { patient.updatedAt = .now }
            patient.pendingSync = PeerApplyPending.pendingAfterApply(
                localPending: wasPending,
                contentChanged: contentChanged,
                hasServerRow: SyncRemoteId.serverId(patient.remoteId) != nil,
                peerPending: rec.pendingSync)
        }
        try context.save()
    }

    func applyNotes(_ records: [PeerNote], context: ModelContext) throws {
        let existing = (try? context.fetch(FetchDescriptor<ClinicalNote>())) ?? []
        let allPatients = (try? context.fetch(FetchDescriptor<Patient>())) ?? []
        let tombstoned = SyncTombstones.ids(in: .clinicalNotes)
        for rec in records {
            if let local = existing.first(where: { $0.syncCode == rec.syncCode }) {
                // Already here: only take the server row id this copy lacks, so its push updates
                // that row (no second insert) and the cloud pull matches it (no second copy).
                let linked = Self.linkedChildRemoteId(local: local.remoteId, peer: rec.remoteId,
                                                      tombstoned: tombstoned)
                if linked != local.remoteId { local.remoteId = linked }
                continue
            }
            // Deleted on this device: don't let a peer recreate it.
            if let rid = rec.remoteId, tombstoned.contains(rid) { continue }
            // Match patient by syncCode; fall back to remoteId
            guard let patient = allPatients.first(where: { $0.syncCode == rec.patientSyncCode })
                              ?? allPatients.first(where: { $0.remoteId == rec.patientSyncCode }) else { continue }
            let noteType = NoteType(rawValue: rec.noteType) ?? .other
            let note = ClinicalNote(noteType: noteType, patient: patient)
            note.syncCode    = rec.syncCode
            note.remoteId    = rec.remoteId
            note.status      = NoteStatus(rawValue: rec.status) ?? .draft
            // SOAP fields for a structured note (as the cloud pull does), so contentForSync gives
            // back the same content if this device uploads it.
            note.applySyncContent(rec.content)
            note.syncedAt    = Date(timeIntervalSince1970: rec.syncedAt)
            note.pendingSync = PeerApplyPending.pendingAfterApply(
                localPending: false, contentChanged: true,
                hasServerRow: SyncRemoteId.serverId(rec.remoteId) != nil,
                peerPending: rec.pendingSync)
            context.insert(note)
        }
        try context.save()
    }

    func applyPrescriptions(_ records: [PeerPrescription], context: ModelContext) throws {
        let existing = (try? context.fetch(FetchDescriptor<Prescription>())) ?? []
        let allPatients = (try? context.fetch(FetchDescriptor<Patient>())) ?? []
        let tombstoned = SyncTombstones.ids(in: .prescriptions)
        for rec in records {
            if let local = existing.first(where: { $0.syncCode == rec.syncCode }) {
                let linked = Self.linkedChildRemoteId(local: local.remoteId, peer: rec.remoteId,
                                                      tombstoned: tombstoned)
                if linked != local.remoteId { local.remoteId = linked }
                continue
            }
            if let rid = rec.remoteId, tombstoned.contains(rid) { continue }   // deleted here
            guard let patient = allPatients.first(where: { $0.syncCode == rec.patientSyncCode })
                             ?? allPatients.first(where: { $0.remoteId == rec.patientSyncCode }) else { continue }
            let rx = Prescription(drug: rec.drug,
                                  dose: rec.dose ?? "",
                                  route: rec.route ?? "Oral",
                                  frequency: rec.frequency ?? "",
                                  duration: rec.duration ?? "",
                                  indication: rec.indication ?? "")
            rx.syncCode     = rec.syncCode
            rx.instructions = rec.instructions
            rx.prescribedAt = Date(timeIntervalSince1970: rec.prescribedAt)
            rx.patient      = patient
            rx.remoteId     = rec.remoteId
            rx.syncedAt     = Date(timeIntervalSince1970: rec.syncedAt)
            rx.pendingSync  = PeerApplyPending.pendingAfterApply(
                localPending: false, contentChanged: true,
                hasServerRow: SyncRemoteId.serverId(rec.remoteId) != nil,
                peerPending: rec.pendingSync)
            context.insert(rx)
        }
        try context.save()
    }

    func applyVitals(_ records: [PeerVitals], context: ModelContext) throws {
        let existing = (try? context.fetch(FetchDescriptor<VitalsEntry>())) ?? []
        let allPatients = (try? context.fetch(FetchDescriptor<Patient>())) ?? []
        let tombstoned = SyncTombstones.ids(in: .vitals)
        for rec in records {
            if let local = existing.first(where: { $0.syncCode == rec.syncCode }) {
                let linked = Self.linkedChildRemoteId(local: local.remoteId, peer: rec.remoteId,
                                                      tombstoned: tombstoned)
                if linked != local.remoteId { local.remoteId = linked }
                continue
            }
            if let rid = rec.remoteId, tombstoned.contains(rid) { continue }   // deleted here
            guard let patient = allPatients.first(where: { $0.syncCode == rec.patientSyncCode })
                             ?? allPatients.first(where: { $0.remoteId == rec.patientSyncCode }) else { continue }
            let v = VitalsEntry(patient: patient,
                                recordedAt: Date(timeIntervalSince1970: rec.recordedAt))
            v.syncCode           = rec.syncCode
            v.bpSystolic         = rec.bpSystolic
            v.bpDiastolic        = rec.bpDiastolic
            v.heartRate          = rec.heartRate
            v.respiratoryRate    = rec.respiratoryRate
            v.temperatureCelsius = rec.temperatureCelsius
            v.spo2               = rec.spo2
            v.weightKg           = rec.weightKg
            v.glucoseMmol        = rec.glucoseMmol
            v.avpu               = AVPU(rawValue: rec.avpu) ?? .alert
            v.onSupplementalO2   = rec.onSupplementalO2
            v.notes              = rec.notes
            v.remoteId           = rec.remoteId
            v.syncedAt           = Date(timeIntervalSince1970: rec.syncedAt)
            v.pendingSync        = PeerApplyPending.pendingAfterApply(
                localPending: false, contentChanged: true,
                hasServerRow: SyncRemoteId.serverId(rec.remoteId) != nil,
                peerPending: rec.pendingSync)
            context.insert(v)
        }
        try context.save()
    }

    func applyBillingItems(_ records: [PeerBillingItem], context: ModelContext) throws {
        let existing = (try? context.fetch(FetchDescriptor<BillingLineItem>())) ?? []
        let allPatients = (try? context.fetch(FetchDescriptor<Patient>())) ?? []
        let tombstoned = SyncTombstones.ids(in: .billingItems)
        for rec in records {
            if let local = existing.first(where: { $0.syncCode == rec.syncCode }) {
                let linked = Self.linkedChildRemoteId(local: local.remoteId, peer: rec.remoteId,
                                                      tombstoned: tombstoned)
                if linked != local.remoteId { local.remoteId = linked }
                continue
            }
            if let rid = rec.remoteId, tombstoned.contains(rid) { continue }   // deleted here
            guard let patient = allPatients.first(where: { $0.syncCode == rec.patientSyncCode })
                             ?? allPatients.first(where: { $0.remoteId == rec.patientSyncCode }) else { continue }
            let item = BillingLineItem(code: rec.cptCode,
                                      description: rec.cptDescription,
                                      category: rec.cptCategory)
            item.syncCode    = rec.syncCode
            item.units       = rec.units
            item.amountXCD   = rec.amountXCD
            item.modifier    = rec.modifier
            item.note        = rec.note
            item.addedAt     = Date(timeIntervalSince1970: rec.addedAt)
            item.patient     = patient
            item.remoteId    = rec.remoteId
            item.syncedAt    = Date(timeIntervalSince1970: rec.syncedAt)
            item.pendingSync = PeerApplyPending.pendingAfterApply(
                localPending: false, contentChanged: true,
                hasServerRow: SyncRemoteId.serverId(rec.remoteId) != nil,
                peerPending: rec.pendingSync)
            context.insert(item)
        }
        try context.save()
    }

    // MARK: - Identity helpers

    /// Links `patient` to the server row the peer's copy names, when this copy has none (or only
    /// a booking placeholder). Never gives a second local record the same remoteId (unique on
    /// this device) and never replaces a server id.
    func linkPeerRemoteId(_ peerRemoteId: String?, to patient: Patient, others: [Patient]) {
        guard let rid = peerRemoteId, !rid.isEmpty, patient.remoteId != rid else { return }
        let takesIt: Bool
        switch SyncRemoteId.kind(patient.remoteId) {
        case .notInserted:
            takesIt = true   // a server id, or the peer's booking placeholder (as before)
        case .appointmentPlaceholder, .invalid:
            takesIt = SyncRemoteId.serverId(rid) != nil
        case .server:
            takesIt = false
        }
        guard takesIt else { return }
        guard !others.contains(where: { $0 !== patient && $0.isLive && $0.remoteId == rid }) else { return }
        if SyncRemoteId.serverId(rid) != nil {
            patient.adoptServerId(rid)   // remembers a replaced booking placeholder
        } else {
            patient.remoteId = rid
        }
    }

    /// The remoteId a local child record (note, prescription, vitals, billing item) should hold
    /// once a peer's copy of it arrives: the peer's server id when this copy has none yet (not a
    /// row deleted on this device); otherwise unchanged. Pure; tested in SyncGapsTests.
    static func linkedChildRemoteId(local: String?, peer: String?, tombstoned: Set<String>) -> String? {
        guard case .notInserted = SyncRemoteId.kind(local),
              let id = SyncRemoteId.serverId(peer), !tombstoned.contains(id) else { return local }
        return id
    }

    /// The synced content of a patient (the peer payload without sync bookkeeping), to tell
    /// whether applying a peer's copy changed anything on this device. nil if it cannot be
    /// encoded (treated as changed).
    static func contentFingerprint(_ patient: Patient) -> Data? {
        guard let data = try? JSONEncoder().encode(PeerPatient(patient)),
              var object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        else { return nil }
        for key in PeerPatient.bookkeepingKeys { object.removeValue(forKey: key) }
        return try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    }

    // MARK: - Helpers

    // DJB2 — stable across devices/processes, unlike Swift's randomized hashValue
    static func stableHash(_ s: String) -> String {
        var h: UInt64 = 5381
        for byte in s.utf8 { h = h &* 33 &+ UInt64(byte) }
        return String(h)
    }

    func acuityFrom(_ s: String) -> Acuity {
        switch s {
        case "emergency": return .emergency
        case "urgent":    return .urgent
        case "priority":  return .priority
        default:          return .routine
        }
    }

    // Non-empty wins; on both-non-empty, keeps the longer (more structured) value.
    // Used for questionnaire narrative fields where length correlates with clinical richness.
    func peerMerge(_ local: String?, _ remote: String?) -> String? {
        let loc = (local ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let rem = (remote ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if loc.isEmpty && rem.isEmpty { return nil }
        if loc.isEmpty { return rem }
        if rem.isEmpty { return loc }
        return loc.count >= rem.count ? loc : rem
    }

    // Administrative fields when the remote record is newer: a non-empty remote value wins, but a
    // blank or missing remote value never erases a non-empty local one (phone, email, MRN, NOK…).
    func adminMerge(_ local: String?, _ remote: String?) -> String? {
        if let rem = nonBlank(remote) { return rem }
        return local
    }

    /// Trimmed value, or nil when nil/blank.
    func nonBlank(_ s: String?) -> String? {
        let t = (s ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    // Non-empty wins on first fill; newer timestamp wins when both sides have content.
    // Used for doctor-entered fields (assessment, exam) that may be revised on any device.
    func mergeDoc(_ local: String?, _ remote: String?, remoteIsNewer: Bool) -> String? {
        let loc = (local ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let rem = (remote ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if rem.isEmpty { return local }   // Never overwrite existing content with empty
        if loc.isEmpty { return rem }     // Fill from remote if local is empty
        return remoteIsNewer ? rem : loc  // Both have content: newer device wins
    }

}
