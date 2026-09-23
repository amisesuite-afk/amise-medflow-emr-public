// SyncService+Notes.swift
// Clinical note sync: push drafts, pull remote notes, SOAP text → structured fields.

import Foundation
import SwiftData
import Supabase

extension SyncService {

    // MARK: - Note sync

    func pushPendingNotes(context: ModelContext) async throws {
        let pending = try context.fetch(FetchDescriptor<ClinicalNote>())
            .filter { $0.pendingSync && $0.remoteId == nil }
        guard !pending.isEmpty else { return }

        for note in pending {
            guard let patientRemoteId = note.patient?.remoteId, !note.isEmpty else { continue }

            struct NoteRow: Encodable {
                let patient_id: String
                let note_type: String
                let status: String
                let content: String
                let ai_assisted: Bool
            }
            let row = NoteRow(
                patient_id: patientRemoteId,
                note_type: note.noteType.rawValue,
                status: note.status.rawValue,
                content: note.contentForSync,
                ai_assisted: note.isAIAssisted
            )
            struct NoteResponse: Decodable { let id: String }
            let response: [NoteResponse] = try await SupabaseConfig.client
                .from("clinical_notes")
                .insert(row)
                .select("id")
                .execute()
                .value
            if let first = response.first {
                note.remoteId = first.id
                note.pendingSync = false
                note.syncedAt = .now
            }
        }
        try context.save()
    }

    // MARK: - Pull clinical notes from remote

    private struct RemoteNote: Decodable {
        let id: String
        let patient_id: String
        let note_type: String
        let status: String
        let content: String?
        let created_at: String
    }

    func pullNotes(context: ModelContext) async throws {
        let rows: [RemoteNote] = try await SupabaseConfig.client
            .from("clinical_notes")
            .select("id, patient_id, note_type, status, content, created_at")
            .order("created_at", ascending: false)
            .limit(200)
            .execute()
            .value

        let allLocalNotes  = try context.fetch(FetchDescriptor<ClinicalNote>())
        let allLocalPatients = try context.fetch(FetchDescriptor<Patient>())

        for row in rows {
            let patient = allLocalPatients.first { $0.remoteId == row.patient_id }
            guard let patient else { continue }

            let existing = allLocalNotes.first { $0.remoteId == row.id }
            let note: ClinicalNote
            if let e = existing {
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
