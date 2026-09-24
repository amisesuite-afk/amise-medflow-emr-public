// SyncService+PathwayData.swift
// Cloud sync of the consultation pathway forms (burns, wellness screening, ward review):
// Patient.pathwayDataJson ⇄ patients.pathway_data_json (supabase-pathway-data-migration.sql).
//
// Runs in its own requests after the main sync and swallows errors, so if the column has not
// been added on the server yet (migration 86 not run), patients/notes/vitals sync is unaffected
// and this simply retries on the next sync.
//
// Conflict rule: local edits not yet pushed win (they are pushed first); otherwise the device
// takes the server copy.

import Foundation
import SwiftData
import Supabase

extension SyncService {

    func syncPathwayData(context: ModelContext) async {
        guard let all = try? context.fetch(FetchDescriptor<Patient>()) else { return }

        // Push local edits made since the last confirmed sync.
        for p in all where p.isLive {
            guard let rid = p.remoteId, !rid.isEmpty, !rid.hasPrefix("appt:"),
                  let json = p.pathwayDataJson, json != p.pathwaySyncedJson else { continue }
            struct Row: Encodable { let pathway_data_json: String }
            do {
                try await SupabaseConfig.client
                    .from("patients")
                    .update(Row(pathway_data_json: json))
                    .eq("id", value: rid)
                    .execute()
            } catch {
                return   // column missing, offline or not permitted — retry next sync
            }
            // The await above may have outlived a delete.
            if p.isLive { p.pathwaySyncedJson = json }
        }

        // Pull server copies.
        struct Remote: Decodable { let id: String; let pathway_data_json: String? }
        let rows: [Remote]
        do {
            rows = try await SupabaseConfig.client
                .from("patients")
                .select("id, pathway_data_json")
                .order("created_at", ascending: false)
                .limit(500)
                .execute()
                .value
        } catch {
            try? context.save()
            return
        }
        let byRemoteId = Dictionary(
            all.filter(\.isLive).compactMap { p in p.remoteId.map { ($0, p) } },
            uniquingKeysWith: { first, _ in first })
        for row in rows {
            guard let json = row.pathway_data_json, !json.isEmpty,
                  let p = byRemoteId[row.id], p.isLive else { continue }
            let hasUnpushedEdits = p.pathwayDataJson != nil && p.pathwayDataJson != p.pathwaySyncedJson
            if p.pathwayDataJson == json {
                p.pathwaySyncedJson = json
            } else if !hasUnpushedEdits {
                p.pathwayDataJson = json
                p.pathwaySyncedJson = json
            }
        }
        try? context.save()
    }
}
