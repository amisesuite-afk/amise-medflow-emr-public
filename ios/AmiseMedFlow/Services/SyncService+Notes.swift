// SyncService+Notes.swift
// Clinical note sync: push drafts, pull remote notes, SOAP text → structured fields.

import Foundation
import SwiftData
import Supabase

extension SyncService {

    // MARK: - Note sync

    func pushPendingNotes(context: ModelContext) async throws {
        let refused = SyncRefusals.ids(.clinicalNote)
        let pending = try context.fetch(FetchDescriptor<ClinicalNote>())
            .filter { $0.pendingSync && !refused.contains($0.id.uuidString) }
        guard !pending.isEmpty else { return }
        let userId = SupabaseConfig.client.auth.currentUser?.id.uuidString
        let iso = ISO8601DateFormatter()
        var firstError: Error?

        struct NoteResponse: Decodable { let id: String }
        let tombstoned = SyncTombstones.ids(in: .clinicalNotes)

        for note in pending {
            // The loop awaits the network; a note deleted meanwhile must not be read.
            guard note.isLive else { continue }
            // UUID guard: a patient with only a booking placeholder ("appt:…") has no patients
            // row yet (pushPendingPatients creates it first), and a malformed id is never sent.
            guard let patientRemoteId = SyncRemoteId.serverId(note.patient?.remoteId),
                  !note.isEmpty else { continue }
            // Same guard for the note's own id: update a server row, insert when there is none,
            // never send anything else. A row deleted on this device is never updated.
            let noteRemoteId: String?
            switch SyncRemoteId.kind(note.remoteId) {
            case .server(let id):
                guard !tombstoned.contains(id) else { continue }
                noteRemoteId = id
            case .notInserted:
                noteRemoteId = nil
            case .appointmentPlaceholder, .invalid:
                continue
            }
            let localId = note.id
            let signed = note.status == .signed
            let signedAt = signed ? iso.string(from: note.updatedAt) : nil
            // An edit made while the request below runs is not in it: the note then stays
            // pending (and protected from pullNotes) for the next sync.
            let editedAt = note.updatedAt

            // Errors are handled per note (SyncService+Refusals.swift): a note the server refuses
            // (e.g. inserted by a role that may not write notes) stays pending locally and does
            // not hold back the others.
            do {
                if let remoteId = noteRemoteId {
                    // Edit to a note that is already in the cloud: update it in place. RLS allows the
                    // author or an admin; 0 rows back means not permitted — keep it pending locally
                    // (the pull below will not overwrite it) rather than lose the edit.
                    struct NoteUpdate: Encodable {
                        let note_type: String
                        let status: String
                        let content: String
                        let updated_by: String?
                        let updated_at: String
                        let signed_by: String?
                        let signed_at: String?
                    }
                    let row = NoteUpdate(note_type: note.noteType.rawValue, status: note.status.rawValue,
                                         content: note.contentForSync, updated_by: userId,
                                         updated_at: iso.string(from: note.updatedAt),
                                         signed_by: signed ? userId : nil, signed_at: signedAt)
                    let updated: [NoteResponse] = try await SupabaseConfig.client
                        .from("clinical_notes")
                        .update(row)
                        .eq("id", value: remoteId)
                        .select("id")
                        .execute()
                        .value
                    guard note.isLive else { continue }
                    if !updated.isEmpty && note.updatedAt == editedAt {
                        note.pendingSync = false
                        note.syncedAt = .now
                        try? context.save()
                    }
                    continue
                }

                struct NoteRow: Encodable {
                    let patient_id: String
                    let note_type: String
                    let status: String
                    let content: String
                    let ai_assisted: Bool
                    let created_by: String?     // lets the author edit it later (RLS)
                    let signed_by: String?
                    let signed_at: String?
                }
                let row = NoteRow(
                    patient_id: patientRemoteId,
                    note_type: note.noteType.rawValue,
                    status: note.status.rawValue,
                    content: note.contentForSync,
                    ai_assisted: note.isAIAssisted,
                    created_by: userId,
                    signed_by: signed ? userId : nil,
                    signed_at: signedAt
                )
                let response: [NoteResponse] = try await SupabaseConfig.client
                    .from("clinical_notes")
                    .insert(row)
                    .select("id")
                    .execute()
                    .value
                guard note.isLive else { continue }
                if let first = response.first {
                    note.remoteId = first.id   // always: a later edit is then sent as an update
                    if note.updatedAt == editedAt {
                        note.pendingSync = false
                        note.syncedAt = .now
                    }
                    try? context.save()   // persist the id at once so a crash can't cause a re-insert
                }
            } catch {
                guard continueAfterPushFailure(error, id: localId, kind: .clinicalNote,
                                               firstError: &firstError) else { break }
            }
        }
        try context.save()
        if let firstError { throw firstError }
    }

    // MARK: - Pull clinical notes from remote

    private struct RemoteNote: Decodable, Sendable {
        let id: String
        let patient_id: String
        let note_type: String
        let status: String
        let content: String?
        let created_at: String
        let deleted_at: String?   // nil when live, or when the server predates Migration 87
    }

    func pullNotes(context: ModelContext) async throws {
        let rows: [RemoteNote] = try await selectIncludingDeleted(
            from: "clinical_notes",
            columns: "id, patient_id, note_type, status, content, created_at",
            orderBy: "created_at", limit: 200)

        let allLocalNotes  = try context.fetch(FetchDescriptor<ClinicalNote>())
        let allLocalPatients = try context.fetch(FetchDescriptor<Patient>())

        let deleted = SyncTombstones.ids(in: .clinicalNotes)
        for row in rows {
            guard !deleted.contains(row.id) else { continue }   // deleted on this device
            // isLive first: never read attributes of a model deleted earlier in this loop.
            let existing = allLocalNotes.first { $0.isLive && $0.remoteId == row.id }

            if row.deleted_at != nil {
                // Deleted on another device or the web: drop the local copy unless it holds
                // edits not yet uploaded. Never insert a deleted note.
                if let existing, !existing.pendingSync { context.delete(existing) }
                continue
            }

            let patient = allLocalPatients.first { $0.isLive && $0.remoteId == row.patient_id }
            guard let patient else { continue }

            let note: ClinicalNote
            if let e = existing {
                // Local edits not yet uploaded win: never overwrite them with the server copy.
                if e.pendingSync { continue }
                note = e
            } else {
                let noteType = NoteType(rawValue: row.note_type) ?? .other
                note = ClinicalNote(noteType: noteType, patient: patient)
                context.insert(note)
            }

            note.remoteId = row.id
            note.status = NoteStatus(rawValue: row.status) ?? .draft
            // Restore structured SOAP fields; fall back to freeText for all other types
            if note.noteType.isStructured, let content = row.content {
                restoreSOAPFields(note: note, content: content)
            } else {
                note.freeText = row.content
            }
            note.syncedAt = .now
            note.pendingSync = false
        }

        try context.save()
    }

    // MARK: - SOAP content → structured fields

    func restoreSOAPFields(note: ClinicalNote, content: String) {
        // Content is formatted by contentForSync: "S:\n...\n\nO:\n...\n\nA:\n...\n\nP:\n..."
        var s = "", o = "", a = "", p = ""
        var current: Character? = nil
        var buffer = ""

        func flush() {
            switch current {
            case "S": s = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
            case "O": o = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
            case "A": a = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
            case "P": p = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
            default: break
            }
        }

        for line in content.components(separatedBy: "\n") {
            if line == "S:" || line == "O:" || line == "A:" || line == "P:" {
                flush()
                current = line.first
                buffer = ""
            } else {
                buffer += (buffer.isEmpty ? "" : "\n") + line
            }
        }
        flush()

        note.subjective = s.isEmpty ? nil : s
        note.objective  = o.isEmpty ? nil : o
        note.assessment = a.isEmpty ? nil : a
        note.plan       = p.isEmpty ? nil : p
    }


}
