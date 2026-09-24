// NASBackupService+Restore.swift
// Complete backups, read-back verification, a non-destructive restore test, and an additive
// restore — so a backup is known to be usable before it is ever needed.
//
// Full records use the peer-sync formats (PeerPatient, PeerNote, …): the complete chart
// (demographics, NOK, allergies, exam, investigations, procedure forms, pathway data), not the
// summary DTOs of the original backup. Restore goes through PeerSyncService's apply* merge,
// which only adds what is missing and never replaces newer data on the device.

import Foundation
import SwiftData

struct FullBackupBundle {
    var patients: [PeerPatient] = []
    var notes: [PeerNote] = []
    var prescriptions: [PeerPrescription] = []
    var vitals: [PeerVitals] = []
    var billing: [PeerBillingItem] = []

    var summary: String {
        "\(patients.count) patients · \(notes.count) notes · \(prescriptions.count) prescriptions · "
            + "\(vitals.count) vitals · \(billing.count) billing items"
    }
}

extension NASBackupService {

    static let lastBackupPathKey = "amf.nas.lastBackupPath"
    static let lastVerifiedKey   = "amf.nas.lastVerifiedAt"

    var lastBackupPath: String? { UserDefaults.standard.string(forKey: Self.lastBackupPathKey) }

    // MARK: - Writing full records (called from backup())

    func uploadFullRecords(context: ModelContext, dirPath: String,
                           upload: (String, Data) async throws -> Void) async throws -> FullBackupBundle {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        var bundle = FullBackupBundle()
        bundle.patients      = try context.fetch(FetchDescriptor<Patient>()).filter(\.isLive).map(PeerPatient.init)
        bundle.notes         = try context.fetch(FetchDescriptor<ClinicalNote>()).compactMap(PeerNote.init)
        bundle.prescriptions = try context.fetch(FetchDescriptor<Prescription>()).map(PeerPrescription.init)
        bundle.vitals        = try context.fetch(FetchDescriptor<VitalsEntry>()).map(PeerVitals.init)
        bundle.billing       = try context.fetch(FetchDescriptor<BillingLineItem>()).map(PeerBillingItem.init)
        try await upload("full-patients.json",      try encoder.encode(bundle.patients))
        try await upload("full-notes.json",         try encoder.encode(bundle.notes))
        try await upload("full-prescriptions.json", try encoder.encode(bundle.prescriptions))
        try await upload("full-vitals.json",        try encoder.encode(bundle.vitals))
        try await upload("full-billing.json",       try encoder.encode(bundle.billing))
        UserDefaults.standard.set(dirPath, forKey: Self.lastBackupPathKey)
        return bundle
    }

    // MARK: - Reading back

    func get(path: String) async throws -> Data {
        var req = URLRequest(url: try urlFor(path: path))
        req.httpMethod = "GET"
        addAuth(&req)
        let (data, resp) = try await session.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200...299).contains(code) else { throw NASBackupError.httpError(code, "GET \(path)") }
        return data
    }

    func downloadFullBundle(dirPath: String) async throws -> FullBackupBundle {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        func load<T: Decodable>(_ name: String, _ type: T.Type) async throws -> T {
            try decoder.decode(type, from: try await get(path: "\(dirPath)/\(name)"))
        }
        var b = FullBackupBundle()
        b.patients      = try await load("full-patients.json", [PeerPatient].self)
        b.notes         = try await load("full-notes.json", [PeerNote].self)
        b.prescriptions = try await load("full-prescriptions.json", [PeerPrescription].self)
        b.vitals        = try await load("full-vitals.json", [PeerVitals].self)
        b.billing       = try await load("full-billing.json", [PeerBillingItem].self)
        return b
    }

    // MARK: - Verify (non-destructive restore test)

    /// Downloads the latest backup, decodes every record and compares with this device.
    /// Nothing on the device is changed.
    func verifyLatestBackup(context: ModelContext) async -> String {
        guard let dir = lastBackupPath else {
            return "No full backup yet — tap Backup Now first."
        }
        do {
            let b = try await downloadFullBundle(dirPath: dir)
            let localCodes = Set(((try? context.fetch(FetchDescriptor<Patient>())) ?? [])
                .filter(\.isLive).map { $0.syncCode.isEmpty ? $0.id.uuidString : $0.syncCode })
            let missingHere = b.patients.filter { !localCodes.contains($0.syncCode) }.count
            UserDefaults.standard.set(Date.now, forKey: Self.lastVerifiedKey)
            AuditLog.record("export", "document", details: ["kind": "backup_verify", "patients": "\(b.patients.count)"])
            return "Backup OK and readable: \(b.summary)."
                + (missingHere > 0 ? " \(missingHere) patient(s) in the backup are not on this device." : "")
        } catch {
            return "Backup could not be read back: \(error.localizedDescription)"
        }
    }

    // MARK: - Restore (additive)

    /// Adds records from the latest backup that are missing on this device. Existing records
    /// are merged by the peer-sync rules (never overwritten by older backup data).
    func restoreMissingRecords(context: ModelContext, using peer: PeerSyncService) async -> String {
        guard let dir = lastBackupPath else { return "No full backup to restore from." }
        do {
            let b = try await downloadFullBundle(dirPath: dir)
            let before = (try? context.fetch(FetchDescriptor<Patient>()).count) ?? 0
            try peer.applyPatients(b.patients, context: context)
            try peer.applyNotes(b.notes, context: context)
            try peer.applyPrescriptions(b.prescriptions, context: context)
            try peer.applyVitals(b.vitals, context: context)
            try peer.applyBillingItems(b.billing, context: context)
            try context.save()
            let after = (try? context.fetch(FetchDescriptor<Patient>()).count) ?? 0
            AuditLog.record("create", "patient", details: ["kind": "backup_restore",
                                                           "patients_added": "\(max(0, after - before))"])
            return "Restore complete: \(max(0, after - before)) patient(s) added; notes, prescriptions, vitals and billing merged."
        } catch {
            return "Restore failed: \(error.localizedDescription)"
        }
    }
}
