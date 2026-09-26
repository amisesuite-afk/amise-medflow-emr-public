// SupplementCatalogue.swift
// Herbs, teas, bush remedies and supplements — clinical content (decision support only).
//
// The items, shared wording, prompt texts and trigger words live once, as data:
// clinical-content/rules/supplement-catalogue.json, the same file the dashboard reads
// (`artifacts/dashboard/src/lib/supplement-catalogue.ts`), bundled as the "rules" folder and loaded
// by SharedClinicalContent. Change the JSON, not a platform copy; `lint:shared-content` checks the
// Codable structs below against clinical-content/schemas/supplement-catalogue.schema.json.
// Registered in clinical-content/registry.json (`supplement-catalogue`).
//
// Source: the practice owner's evidence briefing (Dr Dawit Daniel Kabiye, "Ancient Remedy, Modern
// Market", Sept 2026) §5 and §7, and the references it cites: Ang-Lee MK et al. JAMA 2001;
// OpenAnesthesia / SPAQI 2025; J Clin Anesth 2024 review; Proc (Bayl Univ Med Cent) 2022;
// Halegoua-DeMarzio D et al. Am J Med 2023 (DILIN, turmeric); NIDDK LiverTox (ashwagandha);
// Björnsson HK et al. Liver Int 2020; Saper RB et al. JAMA 2008 (Ayurvedic metals); Nortier JL
// et al. NEJM 2000 and Debelle FD et al. Kidney Int 2008 (aristolochic acid); Schwarz C et al.
// JAMA Netw Open 2022 (SmartAge).
//
// Items with interaction rules point at a `DrugClasses.terms` key (`term`), which holds their
// names; the others carry their own `names`. Stop times are for the CLINICIAN: nothing here stops,
// prescribes or edits anything. Caribbean bush teas (cerasee, soursop leaf, …) are deliberately
// not items — their pharmacology is not in the briefing (see "Needs sign-off" in
// docs/clinical-validation/changes/supplements-interactions.md).

import Foundation

struct SupplementItem: Identifiable, Equatable, Codable {
    /// Stable id stored with a recorded entry.
    let id: String
    /// Display name.
    let label: String
    /// `DrugClasses.terms` key used by the interaction screen ("" = no interaction rules).
    let term: String
    /// "name|synonym" list for items without a term ("" when `term` is set).
    let names: String
    /// Main clinical concern (clinician-facing).
    let concern: String
    /// Commonly cited stop time before elective surgery ("" when none is cited).
    let stopTime: String
    /// Liver / renal / metal and other harms ("" when none beyond the concern).
    let harms: String
    /// Evidence note ("" when none).
    let evidence: String
    /// Citation(s).
    let source: String
}

struct SupplementPromptText: Equatable, Codable {
    let id: String
    let title: String
    let detail: String
}

enum SupplementCatalogue {

    // MARK: - Shared content (clinical-content/rules/supplement-catalogue.json)

    /// Shared wording: clinician heading, patient question, rationale, approved patient paragraph.
    struct Wording: Codable, Equatable {
        let sectionTitle: String
        let patientQuestion: String
        let disclosureRationale: String
        let herbalPreOpPatientText: String
    }

    /// The whole file (lint:shared-content checks these fields against the schema).
    struct Content: Codable {
        let version: String
        let items: [SupplementItem]
        let text: Wording
        let prompts: [SupplementPromptText]
        let triggerTerms: [String: [String]]
    }

    /// nil when the file is missing or does not decode: then no item matches, SupplementAlerts
    /// shows only a "not loaded" notice, and Settings → Diagnostics says why.
    static let content: Content? = SharedClinicalContent.load(Content.self, .supplementCatalogue)

    static var catalogueVersion: String { content?.version ?? "unavailable" }

    static var items: [SupplementItem] { content?.items ?? [] }

    // MARK: - Shared wording (the same JSON fields as the web constants)

    /// Falls back to the questionnaire picker's own label, never to other wording.
    static var sectionTitle: String { content?.text.sectionTitle ?? "Herbs, bush teas or supplements" }
    static var patientQuestion: String { content?.text.patientQuestion ?? "Herbs, bush teas or supplements" }
    static var disclosureRationale: String { content?.text.disclosureRationale ?? "" }
    static var herbalPreOpPatientText: String { content?.text.herbalPreOpPatientText ?? "" }

    // MARK: - Prompts (SupplementAlerts.swift; web supplement-prompts.ts)
    // Clinician-facing "ask about" prompts and alerts. Each only suggests a question or shows a
    // concern; none changes the record. Trigger words are matched negation-aware.

    static var prompts: [SupplementPromptText] { content?.prompts ?? [] }

    /// Negation-aware trigger words for the prompts (lowercase; matched in the clinical text).
    static var triggerTerms: [String: [String]] { content?.triggerTerms ?? [:] }

    static func prompt(_ id: String) -> SupplementPromptText {
        prompts.first { $0.id == id } ?? SupplementPromptText(id: id, title: id, detail: "")
    }

    // MARK: - Lookup

    static func item(id: String?) -> SupplementItem? {
        guard let id = id else { return nil }
        return items.first { $0.id == id }
    }

    /// Every name of an item (lowercased): the term's members, or the item's own `names`.
    static func names(of item: SupplementItem) -> [String] {
        if !item.term.isEmpty {
            return (DrugClasses.terms[item.term]?.members ?? []).flatMap { DrugClasses.parseMember($0).names }
        }
        return DrugClasses.parseMember(item.names).names
    }

    /// Catalogue items named in a free-text entry (whole words, case-insensitive), in catalogue order.
    static func match(_ text: String) -> [SupplementItem] {
        let lc = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !lc.isEmpty else { return [] }
        return items.filter { item in names(of: item).contains { DrugClasses.containsWholeWord($0, in: lc) } }
    }

    /// Picker search: label or any name containing the query; everything for an empty query.
    static func search(_ query: String) -> [SupplementItem] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return items }
        return items.filter { item in
            item.label.lowercased().contains(q) || names(of: item).contains { $0.contains(q) }
        }
    }

    /// Clinician-facing perioperative alert (same text as the web `perioperativeAlertText`):
    /// "Supplement: <name> — <concern>. Commonly cited stop time: <…> before elective surgery (source)."
    /// Informational only — the clinician decides; nothing is stopped automatically.
    static func perioperativeAlertText(_ item: SupplementItem) -> String {
        let stop = item.stopTime.isEmpty ? "" : " Commonly cited stop time: \(item.stopTime) before elective surgery"
        return "Supplement: \(item.label) — \(item.concern).\(stop) (\(item.source))."
    }
}
