// SyncService+Documents.swift
// Document metadata pull — re-hydrates doc list after reinstall.

import Foundation
import SwiftData
import Supabase

extension SyncService {

    // MARK: - Document metadata pull (re-hydrates the doc list after reinstall)

    private struct RemoteDocument: Decodable, Sendable {
        let id: String
        let patient_id: String
        let file_name: String
        let mime_type: String
        let storage_url: String?
        let ai_summary: String?
        let extracted_text: String?
        let category: String?
        let deleted_at: String?   // nil when live, or when the server predates Migration 87
    }

    func pullDocumentMetadata(context: ModelContext) async throws {
        let rows: [RemoteDocument] = try await selectIncludingDeleted(
            from: "patient_documents",
            columns: "id, patient_id, file_name, mime_type, storage_url, ai_summary, extracted_text, category",
            orderBy: "uploaded_at", limit: 500)

        let allLocalDocs = try context.fetch(FetchDescriptor<PatientDocument>())
        let allPatients  = try context.fetch(FetchDescriptor<Patient>())

        let deleted = SyncTombstones.ids(in: .documents)
        for row in rows {
            guard !deleted.contains(row.id) else { continue }   // deleted on this device
            // isLive first: never read attributes of a model deleted earlier in this loop.
            let existing = allLocalDocs.first(where: { $0.isLive && $0.remoteId == row.id })
            if row.deleted_at != nil {
                // Deleted on another device or the web: drop the local copy and never insert it.
                // (Documents have no pending local edits: metadata is written straight to the server.)
                if let existing { context.delete(existing) }
                continue
            }
            guard existing == nil else { continue }
            guard let patient = allPatients.first(where: { $0.isLive && $0.remoteId == row.patient_id }) else { continue }

            let doc = PatientDocument(fileName: row.file_name,
                                     mimeType: row.mime_type,
                                     category: row.category)
            doc.storageUrl    = row.storage_url
            doc.aiSummary     = row.ai_summary
            doc.extractedText = row.extracted_text
            doc.remoteId      = row.id
            doc.patient       = patient
            context.insert(doc)
        }
        try context.save()
    }


}
