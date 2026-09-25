// AuditLog.swift
// iOS audit trail: who viewed or changed which record, when, from which device.
//
// Events are written to a small on-device queue (Application Support/audit-queue.json) the
// moment they happen, so the trail is kept offline too, then uploaded to the same Supabase
// `audit_log` table the web app uses (supabase-slice-d-audit-migration.sql: authenticated
// users may INSERT; admins/doctors may SELECT). Upload runs with every sync.
//
// No clinical content goes in an event: only the action, record type, record ids and short
// fixed labels (e.g. note type, visit pathway). Never put names, diagnoses or free text in
// `details`.

import Foundation
import UIKit
import Supabase

struct AuditEvent: Codable, Identifiable {
    var id = UUID()
    var at: Date
    var action: String            // view, create, update, delete, sign, export, login, logout, state_transition
    var resourceType: String      // patient, clinical_note, prescription, vitals, encounter, document, user
    var resourceId: String?
    var patientRemoteId: String?  // Supabase patients.id when the patient has synced
    var patientLocalId: String?   // Patient.syncCode (stable across devices, before first sync)
    var userId: String?
    var userEmail: String?
    var details: [String: String] = [:]
}

@MainActor
enum AuditLog {

    private static var queue: [AuditEvent] = loadQueue()
    private static var isFlushing = false

    // MARK: - Recording

    static func record(_ action: String, _ resourceType: String,
                       patient: Patient? = nil, resourceId: String? = nil,
                       details: [String: String] = [:]) {
        #if DEBUG
        if UITestDemoMode.isActive { return }   // demo mode: synthetic data is never audited or uploaded
        #endif
        let user = SupabaseConfig.client.auth.currentUser
        let event = AuditEvent(
            at: .now,
            action: action,
            resourceType: resourceType,
            resourceId: resourceId,
            patientRemoteId: patient.flatMap { $0.isLive ? $0.remoteId : nil },
            patientLocalId: patient.flatMap { $0.isLive ? $0.syncCode : nil },
            userId: user?.id.uuidString,
            userEmail: user?.email,
            details: details
        )
        queue.append(event)
        // Keep the on-device queue bounded if the device stays offline for a long time.
        if queue.count > 5000 { queue.removeFirst(queue.count - 5000) }
        saveQueue()
    }

    static var pendingCount: Int { queue.count }

    // MARK: - Upload

    /// Uploads queued events to Supabase `audit_log`. Safe to call repeatedly; never throws.
    static func flush() async {
        #if DEBUG
        if UITestDemoMode.isActive { return }
        #endif
        guard !isFlushing, !queue.isEmpty else { return }
        isFlushing = true
        defer { isFlushing = false }

        let batch = Array(queue.prefix(200))
        let device = "\(UIDevice.current.model) iOS \(UIDevice.current.systemVersion)"
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        // #/…/# form: bare /…/ regex literals need a compiler flag in Swift 5 mode.
        let uuidRe = #/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/#

        struct Row: Encodable {
            let user_id: String?
            let user_email: String?
            let action: String
            let resource_type: String
            let resource_id: String?
            let patient_id: String?
            let details: [String: String]
            let user_agent: String
            let mode: String
            let created_at: String
        }
        let iso = ISO8601DateFormatter()
        let rows = batch.map { e -> Row in
            var details = e.details
            details["event_id"] = e.id.uuidString
            if let local = e.patientLocalId { details["patient_sync_code"] = local }
            let pid = e.patientRemoteId.flatMap { $0.wholeMatch(of: uuidRe) != nil ? $0 : nil }
            if let r = e.patientRemoteId, pid == nil { details["patient_ref"] = r }
            return Row(user_id: e.userId.flatMap { $0.wholeMatch(of: uuidRe) != nil ? $0 : nil },
                       user_email: e.userEmail,
                       action: e.action,
                       resource_type: e.resourceType,
                       resource_id: e.resourceId,
                       patient_id: pid,
                       details: details,
                       user_agent: "AmiseMedFlow iOS \(version) (\(device))",
                       mode: "ios",
                       created_at: iso.string(from: e.at))
        }
        do {
            try await SupabaseConfig.client.from("audit_log").insert(rows).execute()
            let sent = Set(batch.map(\.id))
            queue.removeAll { sent.contains($0.id) }
            saveQueue()
        } catch {
            // Offline or not signed in: keep the events and try again on the next sync.
        }
    }

    // MARK: - Persistence

    private static var fileURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("audit-queue.json")
    }

    private static func loadQueue() -> [AuditEvent] {
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
        guard let data = try? Data(contentsOf: fileURL),
              let events = try? decoder.decode([AuditEvent].self, from: data) else { return [] }
        return events
    }

    private static func saveQueue() {
        let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(queue) else { return }
        // Protected until first unlock, like the rest of the app's data.
        try? data.write(to: fileURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
}
