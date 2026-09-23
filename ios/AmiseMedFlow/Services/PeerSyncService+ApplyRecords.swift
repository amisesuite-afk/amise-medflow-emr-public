// PeerSyncService+ApplyRecords.swift
// Apply received manifest records and helper methods for peer sync.

import Foundation
import MultipeerConnectivity
import SwiftData
import UIKit


extension PeerSyncService {

    // MARK: - Apply received records

    func applyPatients(_ records: [PeerPatient], context: ModelContext) throws {
        let existing = (try? context.fetch(FetchDescriptor<Patient>())) ?? []
        let iso = ISO8601DateFormatter()
        for rec in records {
            // Match by syncCode first; fall back to remoteId for records synced before this feature
            let patient = existing.first { $0.syncCode == rec.syncCode }
                ?? existing.first { rid in rec.remoteId != nil && rid.remoteId == rec.remoteId }
                ?? {
                    let p = Patient(fullName: rec.fullName)
                    context.insert(p)
                    return p
                }()

            let peerTime = Date(timeIntervalSince1970: rec.syncedAt)
            let myTime   = patient.syncedAt ?? .distantPast
            let remoteIsNewer = peerTime > myTime

            // Identity — always propagate syncCode; fill in remoteId if missing
            patient.syncCode = rec.syncCode
            if patient.remoteId == nil, let rid = rec.remoteId { patient.remoteId = rid }

            // ── Administrative fields: remote wins when it is newer ──────────
            if remoteIsNewer {
                patient.fullName    = rec.fullName
                patient.sex         = Sex(rawValue: (rec.sex ?? "").capitalized) ?? .unspecified
                if let d = rec.dob  { patient.dateOfBirth = iso.date(from: d) }
                patient.phone       = rec.phone
                patient.email       = rec.email
                patient.address     = rec.address
                patient.mrn         = rec.mrn
                patient.nokName     = rec.nokName
                patient.nokRelation = rec.nokRelation
                patient.nokPhone    = rec.nokPhone
                patient.insuranceProvider = rec.insuranceProvider
                patient.policyNumber      = rec.policyNumber
                if let s = rec.setting  { patient.setting  = ClinicalSetting(rawValue: s.capitalized) ?? .outpatient }
                if let l = rec.location { patient.location  = ClinicalLocation(rawValue: l) ?? .rodney_bay }
                if let a = rec.acuity   { patient.acuity    = acuityFrom(a) }
                if let h = rec.heightCm { patient.heightCm  = h }
                if let w = rec.ward,        !w.isEmpty { patient.ward       = w }
                if let b = rec.bedNumber,   !b.isEmpty { patient.bedNumber  = b }
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
            patient.pendingSync = false
        }
        try context.save()
    }

    func applyNotes(_ records: [PeerNote], context: ModelContext) throws {
        let existing = (try? context.fetch(FetchDescriptor<ClinicalNote>())) ?? []
        let allPatients = (try? context.fetch(FetchDescriptor<Patient>())) ?? []
        for rec in records {
            guard existing.first(where: { $0.syncCode == rec.syncCode }) == nil else { continue }
            // Match patient by syncCode; fall back to remoteId
            guard let patient = allPatients.first(where: { $0.syncCode == rec.patientSyncCode })
                              ?? allPatients.first(where: { $0.remoteId == rec.patientSyncCode }) else { continue }
            let noteType = NoteType(rawValue: rec.noteType) ?? .other
            let note = ClinicalNote(noteType: noteType, patient: patient)
            note.syncCode    = rec.syncCode
            note.remoteId    = rec.remoteId
            note.status      = NoteStatus(rawValue: rec.status) ?? .draft
            note.freeText    = rec.content
            note.syncedAt    = Date(timeIntervalSince1970: rec.syncedAt)
            note.pendingSync = false
            context.insert(note)
        }
        try context.save()
    }

    func applyPrescriptions(_ records: [PeerPrescription], context: ModelContext) throws {
        let existing = (try? context.fetch(FetchDescriptor<Prescription>())) ?? []
        let allPatients = (try? context.fetch(FetchDescriptor<Patient>())) ?? []
        for rec in records {
            guard existing.first(where: { $0.syncCode == rec.syncCode }) == nil else { continue }
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
            rx.pendingSync  = false
            context.insert(rx)
        }
        try context.save()
    }

    func applyVitals(_ records: [PeerVitals], context: ModelContext) throws {
        let existing = (try? context.fetch(FetchDescriptor<VitalsEntry>())) ?? []
        let allPatients = (try? context.fetch(FetchDescriptor<Patient>())) ?? []
        for rec in records {
            guard existing.first(where: { $0.syncCode == rec.syncCode }) == nil else { continue }
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
            v.pendingSync        = false
            context.insert(v)
        }
        try context.save()
    }

    func applyBillingItems(_ records: [PeerBillingItem], context: ModelContext) throws {
        let existing = (try? context.fetch(FetchDescriptor<BillingLineItem>())) ?? []
        let allPatients = (try? context.fetch(FetchDescriptor<Patient>())) ?? []
        for rec in records {
            guard existing.first(where: { $0.syncCode == rec.syncCode }) == nil else { continue }
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
            item.pendingSync = false
            context.insert(item)
        }
        try context.save()
    }

    // MARK: - Helpers

    // DJB2 — stable across devices/processes, unlike Swift's randomized hashValue
    private static func stableHash(_ s: String) -> String {
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
