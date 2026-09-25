// SupplementHistory.swift
// The patient's "Herbs, teas, bush remedies & supplements" history: the structured answer to the
// mandatory question (not asked / none / taking) and what is taken.
//
// Stored in `PathwayData.supplements` (Patient.pathwayDataJson), so it syncs over peer sync and
// Supabase `patients.pathway_data_json` (Migration 86) with no new column. The dashboard reads and
// writes the same `supplements` key (artifacts/dashboard/src/lib/supplement-store.ts), so the two
// platforms share one record. JSON shape (both platforms):
//   {"status": "not_asked" | "none" | "taking",
//    "entries": [{"id": "...", "catalogueId": "garlic" | null, "name": "...", "details": "..."}],
//    "askedAt": "2026-09-25T14:00:00Z" | null}
// Decoding is tolerant: a missing key, an unknown catalogue id, a malformed entry or date is
// dropped or defaulted, never a reason to blank the whole history.

import Foundation

enum SupplementStatus: String, Codable, CaseIterable {
    case notAsked = "not_asked"
    case noneReported = "none"
    case taking = "taking"

    var label: String {
        switch self {
        case .notAsked:     return "Not asked"
        case .noneReported: return "None"
        case .taking:       return "Takes some"
        }
    }
}

struct SupplementEntry: Codable, Identifiable, Equatable {
    var id: String = UUID().uuidString
    /// Catalogue id when the entry names a catalogue item, else nil (free text).
    var catalogueId: String?
    /// What the patient takes, as recorded ("Garlic (supplement)", "cerasee tea").
    var name: String
    /// Dose / how often / why, free text.
    var details: String = ""

    enum CodingKeys: String, CodingKey { case id, catalogueId, name, details }

    init(id: String = UUID().uuidString, catalogueId: String? = nil, name: String, details: String = "") {
        self.id = id
        self.catalogueId = catalogueId
        self.name = name
        self.details = details
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let raw = (try? c.decode(String.self, forKey: .name)) ?? ""
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw DecodingError.dataCorruptedError(forKey: .name, in: c, debugDescription: "empty supplement name")
        }
        name = trimmed
        id = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        let cat = (try? c.decodeIfPresent(String.self, forKey: .catalogueId)) ?? nil
        catalogueId = SupplementCatalogue.item(id: cat) == nil ? nil : cat
        details = (try? c.decodeIfPresent(String.self, forKey: .details)) ?? ""
    }
}

struct SupplementHistory: Codable, Equatable {
    var status: SupplementStatus = .notAsked
    var entries: [SupplementEntry] = []
    /// When the question was last answered.
    var askedAt: Date?

    enum CodingKeys: String, CodingKey { case status, entries, askedAt }

    init() {}

    init(status: SupplementStatus, entries: [SupplementEntry] = [], askedAt: Date? = nil) {
        self.status = status
        self.entries = entries
        self.askedAt = askedAt
    }

    /// One bad entry must not lose the others.
    private struct LossyEntry: Decodable {
        let value: SupplementEntry?
        init(from decoder: Decoder) throws { value = try? SupplementEntry(from: decoder) }
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        entries = ((try? c.decodeIfPresent([LossyEntry].self, forKey: .entries)) ?? nil)?
            .compactMap(\.value) ?? []
        let raw = (try? c.decodeIfPresent(String.self, forKey: .status)) ?? nil
        let decoded = raw.flatMap(SupplementStatus.init(rawValue:)) ?? .notAsked
        status = entries.isEmpty ? decoded : .taking
        askedAt = (try? c.decodeIfPresent(Date.self, forKey: .askedAt)) ?? nil
    }

    /// "taking" when anything is recorded, whatever the stored status says.
    var effectiveStatus: SupplementStatus { entries.isEmpty ? status : .taking }

    /// The question has been asked and answered.
    var isAnswered: Bool { effectiveStatus != .notAsked }

    /// SOAP / note background line (same wording as the web `supplementNoteLine`).
    var noteLine: String {
        if entries.isEmpty {
            switch status {
            case .notAsked:     return "Supplements: not asked."
            case .noneReported: return "Supplements: none reported."
            case .taking:       return "Supplements: taking (not named)."
            }
        }
        let list = entries.map { e -> String in
            let d = e.details.trimmingCharacters(in: .whitespacesAndNewlines)
            return d.isEmpty ? e.name : "\(e.name) (\(d))"
        }
        return "Supplements: \(list.joined(separator: "; "))."
    }

    /// Catalogue items of the recorded entries (stored id, else the entry's words), de-duplicated.
    var recordedItems: [SupplementItem] {
        var out: [SupplementItem] = []
        for e in entries {
            let found = [SupplementCatalogue.item(id: e.catalogueId)].compactMap { $0 } + SupplementCatalogue.match(e.name)
            for item in found where !out.contains(item) { out.append(item) }
        }
        return out
    }

    /// Entry strings for the drug-interaction screen: a recorded supplement is screened like a
    /// drug (same as the web `supplementInteractionEntries`).
    var interactionEntries: [String] {
        entries.map { e in
            if let item = SupplementCatalogue.item(id: e.catalogueId), !item.term.isEmpty,
               !SupplementCatalogue.match(e.name).contains(item) {
                return "\(e.name) (\(item.label))"
            }
            return e.name
        }
    }
}

extension Patient {
    /// The structured supplement history (PathwayData.supplements).
    var supplementHistory: SupplementHistory {
        get { pathwayData.supplements }
        set {
            var all = pathwayData
            all.supplements = newValue
            pathwayData = all
            pendingSync = true
        }
    }

    /// The patient's own questionnaire answer ("SUPPLEMENTS: …" line the front-desk questionnaire
    /// writes into pmhNotes), for the clinician to confirm. Nil when there is none.
    var patientReportedSupplements: String? {
        guard let notes = pmhNotes else { return nil }
        for line in notes.components(separatedBy: .newlines) {
            let t = line.trimmingCharacters(in: .whitespaces)
            if t.uppercased().hasPrefix(SupplementHistory.questionnairePrefix) {
                let value = t.dropFirst(SupplementHistory.questionnairePrefix.count)
                    .trimmingCharacters(in: .whitespaces)
                return value.isEmpty ? nil : value
            }
        }
        return nil
    }

    /// Supplement entry strings for the interaction screen (empty when none recorded).
    var supplementInteractionEntries: [String] { supplementHistory.interactionEntries }
}

extension SupplementHistory {
    /// Line prefix written by the pre-visit questionnaire (EncounterAnswers.pmhxText).
    static let questionnairePrefix = "SUPPLEMENTS (PATIENT-REPORTED):"
}
