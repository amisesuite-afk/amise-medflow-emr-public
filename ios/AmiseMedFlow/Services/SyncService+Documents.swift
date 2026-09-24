// SyncService+Documents.swift
// Document metadata pull — re-hydrates doc list after reinstall.

import Foundation
import SwiftData
import Supabase

extension SyncService {

    // MARK: - Document metadata pull (re-hydrates the doc list after reinstall)

    private struct RemoteDocument: Decodable {
        let id: String
        let patient_id: String
        let file_name: String
        let mime_type: String
        let storage_url: String?
        let ai_summary: String?
        let extracted_text: String?
        let category: String?
    }

    func pullDocumentMetadata(context: ModelContext) async throws {
        let rows: [RemoteDocument] = try await SupabaseConfig.client
            .from("patient_documents")
            .select("id, patient_id, file_name, mime_type, storage_url, ai_summary, extracted_text, category")
            .order("uploaded_at", ascending: false)
            .limit(500)
            .execute()
            .value

        let allLocalDocs = try context.fetch(FetchDescriptor<PatientDocument>())
        let allPatients  = try context.fetch(FetchDescriptor<Patient>())

        for row in rows {
            guard !SyncTombstones.ids(in: .documents).contains(row.id) else { continue }   // deleted here
            guard allLocalDocs.first(where: { $0.remoteId == row.id }) == nil else { continue }
            guard let patient = allPatients.first(where: { $0.remoteId == row.patient_id }) else { continue }

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
