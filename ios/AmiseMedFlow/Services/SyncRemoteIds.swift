// SyncRemoteIds.swift
// What a local record's `remoteId` is, and whether it may be sent to the server.
//
// A `remoteId` is normally the Supabase row id (a UUID). Two other values exist:
//   • nil / empty: the record has not reached the server yet (the push inserts it).
//   • "appt:<appointment_requests.id>": a placeholder set by pullConfirmedAppointments on a
//     patient created from a confirmed booking (SyncService+AppointmentSync.swift). There is no
//     `patients` row behind it. Postgres rejects it as a uuid (22P02), so it must never be sent
//     as a row id or a patient_id. pushPendingPatients replaces it with a real row id (the
//     booking's patients row, an MRN match, or a new insert) once the patient has local work
//     to upload.
// Anything else that is not a UUID is malformed and is never sent either.
//
// Pure (no network, no model context), unit-tested in AmiseMedFlowTests/SyncGapsTests.swift.

import Foundation

enum SyncRemoteId {
    static let appointmentPrefix = "appt:"

    enum Kind: Equatable {
        /// nil or empty: not inserted yet.
        case none
        /// A booking placeholder; the associated value is the appointment_requests id.
        case appointmentPlaceholder(appointmentId: String)
        /// A server row id (canonical UUID).
        case server(String)
        /// Anything else. Never sent.
        case invalid
    }

    static func kind(_ remoteId: String?) -> Kind {
        guard let raw = remoteId, !raw.isEmpty else { return .none }
        if raw.hasPrefix(appointmentPrefix) {
            return .appointmentPlaceholder(appointmentId: String(raw.dropFirst(appointmentPrefix.count)))
        }
        return isValidUUID(raw) ? .server(raw) : .invalid
    }

    /// True for the canonical 8-4-4-4-12 hexadecimal form (either case), the only form the app
    /// stores for a server row id.
    static func isValidUUID(_ value: String) -> Bool {
        UUID(uuidString: value) != nil
    }

    /// The UUID guard for every push: the id to send as a row id (`.eq("id", …)`) or a foreign
    /// key (`patient_id`), or nil when `remoteId` is missing, a placeholder or malformed.
    static func serverId(_ remoteId: String?) -> String? {
        if case .server(let id) = kind(remoteId) { return id }
        return nil
    }

    static func isAppointmentPlaceholder(_ remoteId: String?) -> Bool {
        if case .appointmentPlaceholder = kind(remoteId) { return true }
        return false
    }

    static func placeholder(forAppointment appointmentId: String) -> String {
        appointmentPrefix + appointmentId
    }

    /// True when the patient has no server row yet, so pushPendingPatients should create or link
    /// one: never inserted, or only a booking placeholder. A malformed id is not included (an
    /// insert could duplicate a row that exists under the id the app lost).
    static func needsServerRow(_ remoteId: String?) -> Bool {
        switch kind(remoteId) {
        case .none, .appointmentPlaceholder: return true
        case .server, .invalid:              return false
        }
    }
}

/// Bookings whose placeholder patient has been linked to a real `patients` row. The patient's
/// remoteId no longer names the booking, so pullConfirmedAppointments checks this list instead;
/// without it the next appointment pull would create the patient again (or again after a delete).
/// Booking ids only (no patient data), in UserDefaults like the tombstones.
enum AppointmentLinks {
    private static let key = "amf.appointments.linkedIds"

    static func remember(_ appointmentId: String) {
        guard !appointmentId.isEmpty else { return }
        var ids = UserDefaults.standard.stringArray(forKey: key) ?? []
        guard !ids.contains(appointmentId) else { return }
        ids.append(appointmentId)
        if ids.count > 5000 { ids.removeFirst(ids.count - 5000) }
        UserDefaults.standard.set(ids, forKey: key)
    }

    /// Remembers the booking when `remoteId` is a placeholder that is about to be replaced.
    static func rememberIfPlaceholder(_ remoteId: String?) {
        if case .appointmentPlaceholder(let appointmentId) = SyncRemoteId.kind(remoteId) {
            remember(appointmentId)
        }
    }

    /// All linked booking ids — read once per pull, not per row.
    static func ids() -> Set<String> {
        Set(UserDefaults.standard.stringArray(forKey: key) ?? [])
    }
}

extension Patient {
    /// Links the patient to its server row, remembering a replaced booking placeholder.
    func adoptServerId(_ serverId: String) {
        AppointmentLinks.rememberIfPlaceholder(remoteId)
        remoteId = serverId
    }

    /// True when a note, prescription, vitals entry, billing item or operative plan of this
    /// patient is waiting to be uploaded. A booking-placeholder patient with such work is
    /// inserted so the work has a patient_id to go to.
    var hasPendingChildRecords: Bool {
        clinicalNotes.contains { $0.isLive && $0.pendingSync }
            || prescriptions.contains { $0.isLive && $0.pendingSync }
            || vitalsEntries.contains { $0.isLive && $0.pendingSync }
            || billingItems.contains { $0.isLive && $0.pendingSync }
            || operativePlans.contains { $0.isLive && $0.pendingSync }
    }
}
