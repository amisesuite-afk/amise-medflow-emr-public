// NASBackupService+WebDAV.swift
// WebDAV primitives, URL helpers, credential management,
// and backup manifest/DTO types for NASBackupService.

import Foundation
import Security
import SwiftData


extension NASBackupService {

    // MARK: - WebDAV primitives

    func ensureDirectory(path: String) async throws {
        var req = URLRequest(url: try urlFor(path: path))
        req.httpMethod = "MKCOL"
        addAuth(&req)
        let (_, resp) = try await session.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        // 201 Created  · 405 Already exists  · 301/302 redirect — all fine
        guard [200, 201, 204, 301, 302, 405, 207].contains(code) else {
            throw NASBackupError.httpError(code, "MKCOL \(path)")
        }
    }

    func put(path: String, data: Data) async throws -> Int {
        var req = URLRequest(url: try urlFor(path: path))
        req.httpMethod = "PUT"
        req.httpBody   = data
        req.setValue("application/json",    forHTTPHeaderField: "Content-Type")
        req.setValue("\(data.count)",        forHTTPHeaderField: "Content-Length")
        addAuth(&req)
        let (_, resp) = try await session.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200...299).contains(code) || code == 201 else {
            throw NASBackupError.httpError(code, "PUT \(path)")
        }
        return data.count
    }

    // MARK: - URL helpers

    func baseURL() throws -> URL {
        let raw = serverURL.trimmingCharacters(in: .whitespaces)
        guard let url = URL(string: raw) else { throw NASBackupError.invalidURL(raw) }
        return url
    }

    func urlFor(path: String) throws -> URL {
        try baseURL().appendingPathComponent(path)
    }

    func addAuth(_ request: inout URLRequest) {
        guard !username.isEmpty else { return }
        let token = Data("\(username):\(password)".utf8).base64EncodedString()
        request.setValue("Basic \(token)", forHTTPHeaderField: "Authorization")
    }

    // MARK: - Clear credentials

    func clearCredentials() {
        serverURL = ""
        username  = ""
        password  = ""
        KCHelper.delete(key: "nas_username")
        KCHelper.delete(key: "nas_password")
        UserDefaults.standard.removeObject(forKey: "nas_webdav_url")
        connectionStatus = .unconfigured
        backupError = nil
    }
}

// MARK: - Backup manifest

private struct BackupManifest: Codable {
    let createdAt: Date
    let appVersion: String
    let recordCounts: [String: Int]
}

// MARK: - Backup DTOs
// Codable snapshots of SwiftData models. Fields chosen for disaster recovery.
// Never embed the @Model classes themselves — SwiftData objects are not Codable.

struct PatientBackup: Codable {
    let id:               UUID
    let syncCode:         String
    let fullName:         String
    let dateOfBirth:      Date?
    let sex:              String
    let mrn:              String?
    let setting:          String
    let location:         String
    let acuity:           String
    let chiefComplaint:   String?
    let workingDiagnosis: String?
    let managementPlan:   String?
    let hpi:              String?
    let assessmentText:   String?
    let pmhNotes:         String?
    let ward:             String?
    let bedNumber:        String?
    let admittedAt:       Date?
    let createdAt:        Date
    let updatedAt:        Date

    init(_ p: Patient) {
        id               = p.id
        syncCode         = p.syncCode
        fullName         = p.fullName
        dateOfBirth      = p.dateOfBirth
        sex              = p.sex.rawValue
        mrn              = p.mrn
        setting          = p.setting.rawValue
        location         = p.location.rawValue
        acuity           = p.acuity.label
        chiefComplaint   = p.chiefComplaint
        workingDiagnosis = p.workingDiagnosis
        managementPlan   = p.managementPlan
        hpi              = p.hpi
        assessmentText   = p.assessmentText
        pmhNotes         = p.pmhNotes
        ward             = p.ward
        bedNumber        = p.bedNumber
        admittedAt       = p.admittedAt
        createdAt        = p.createdAt
        updatedAt        = p.updatedAt
    }
}

struct ClinicalNoteBackup: Codable {
    let id:              UUID
    let syncCode:        String
    let patientSyncCode: String
    let noteType:        String
    let status:          String
    let subjective:      String?
    let objective:       String?
    let assessment:      String?
    let plan:            String?
    let freeText:        String?
    let updatedAt:       Date

    init(_ n: ClinicalNote) {
        id              = n.id
        syncCode        = n.syncCode
        patientSyncCode = n.patient?.syncCode ?? ""
        noteType        = n.noteType.rawValue
        status          = n.status.rawValue
        subjective      = n.subjective
        objective       = n.objective
        assessment      = n.assessment
        plan            = n.plan
        freeText        = n.freeText
        updatedAt       = n.updatedAt
    }
}

struct PrescriptionBackup: Codable {
    let id:              UUID
    let syncCode:        String
    let patientSyncCode: String
    let drug:            String
    let dose:            String
    let route:           String
    let frequency:       String
    let duration:        String
    let indication:      String
    let prescribedAt:    Date

    init(_ rx: Prescription) {
        id              = rx.id
        syncCode        = rx.syncCode
        patientSyncCode = rx.patient?.syncCode ?? ""
        drug            = rx.drug
        dose            = rx.dose
        route           = rx.route
        frequency       = rx.frequency
        duration        = rx.duration
        indication      = rx.indication
        prescribedAt    = rx.prescribedAt
    }
}

struct VitalsBackup: Codable {
    let id:                 UUID
    let syncCode:           String
    let patientSyncCode:    String
    let recordedAt:         Date
    let heartRate:          Int?
    let bpSystolic:         Int?
    let bpDiastolic:        Int?
    let respiratoryRate:    Int?
    let temperatureCelsius: Double?
    let spo2:               Int?
    let weightKg:           Double?
    let glucoseMmol:        Double?

    init(_ v: VitalsEntry) {
        id                 = v.id
        syncCode           = v.syncCode
        patientSyncCode    = v.patient?.syncCode ?? ""
        recordedAt         = v.recordedAt
        heartRate          = v.heartRate
        bpSystolic         = v.bpSystolic
        bpDiastolic        = v.bpDiastolic
        respiratoryRate    = v.respiratoryRate
        temperatureCelsius = v.temperatureCelsius
        spo2               = v.spo2
        weightKg           = v.weightKg
        glucoseMmol        = v.glucoseMmol
    }

}
