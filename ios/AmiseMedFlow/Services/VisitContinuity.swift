// VisitContinuity.swift
// Is this a returning patient, and is today's complaint the same problem as last time?
//
// The consultation used to start from the booked visit type, which stays "New Consult" after the
// first visit, so every later visit opened as a first visit. Now a returning patient is a
// follow-up of the last problem unless the chief complaint is a new, different one, in which case
// it is a new-problem (first-visit) consultation. Pure except for reading the patient's records;
// tested in VisitContinuityTests.
//
// Web twin: lib/triage-engine/src/visit-continuity.ts. The word rules (stop words, region map,
// suffix trimming, minimum word length) are data in the shared clinical rule file
// clinical-content/rules/visit-continuity.json, which both platforms read (here through
// SharedClinicalContent, File.visitContinuity; lint:shared-content checks `WordRules` against its
// schema). The matching logic stays twinned: both run the shared vectors
// AmiseMedFlowTests/Resources/VisitContinuityVectors.json, and the vectors in VisitContinuityTests
// are ported in the dashboard's visit-continuity.test.ts. A missing or undecodable file gives no
// word rules: every text has no meaningful words, `isAvailable` is false and the callers make no
// same-problem / new-problem call (Settings → Diagnostics says why).

import Foundation

enum VisitContinuity {

    /// The patient's last completed visit before today.
    struct PreviousVisit: Equatable {
        let date: Date
        let complaint: String?
        let diagnosis: String?
        let diagnosisICD: String?
        let plan: String?

        /// "Acute cholecystitis [K81.0]", else the complaint.
        var problem: String? {
            if let dx = diagnosis?.trimmingCharacters(in: .whitespacesAndNewlines), !dx.isEmpty {
                if let icd = diagnosisICD, !icd.isEmpty { return "\(dx) [\(icd)]" }
                return dx
            }
            if let cc = complaint?.trimmingCharacters(in: .whitespacesAndNewlines), !cc.isEmpty { return cc }
            return nil
        }
    }

    /// Note types that document a clinic or ward visit.
    private static let visitNoteTypes: Set<NoteType> = [.soap, .progress, .consultation]

    /// Last saved visit (Encounter) or, when none was saved, the last signed visit note, from
    /// before today. Today's own record is not "a previous visit".
    static func lastVisit(for p: Patient, now: Date = .now, calendar: Calendar = .current) -> PreviousVisit? {
        let startOfToday = calendar.startOfDay(for: now)
        if let enc = p.encounters
            .filter({ $0.isLive && $0.isComplete && $0.encounterDate < startOfToday })
            .max(by: { $0.encounterDate < $1.encounterDate }) {
            return PreviousVisit(date: enc.encounterDate, complaint: enc.chiefComplaint,
                                 diagnosis: enc.workingDiagnosis, diagnosisICD: enc.workingDiagnosisICD,
                                 plan: enc.managementPlan)
        }
        if let note = p.clinicalNotes
            .filter({ $0.isLive && $0.status == .signed && visitNoteTypes.contains($0.noteType)
                      && $0.createdAt < startOfToday })
            .max(by: { $0.createdAt < $1.createdAt }) {
            return PreviousVisit(date: note.createdAt, complaint: nil,
                                 diagnosis: p.workingDiagnosis, diagnosisICD: p.workingDiagnosisICD,
                                 plan: note.plan)
        }
        return nil
    }

    /// Same problem as last time? True when there is no new complaint, or when today's complaint
    /// shares a meaningful word with the last visit's complaint or diagnosis. A complaint with no
    /// word in common is a new problem.
    static func isSameProblem(current: String?, previous: PreviousVisit) -> Bool {
        let now = meaningfulWords(current ?? "")
        if now.isEmpty { return true }
        let before = meaningfulWords([previous.complaint, previous.diagnosis]
            .compactMap { $0 }.joined(separator: " "))
        if before.isEmpty { return true }   // nothing to compare with: treat as the same problem
        return !now.isDisjoint(with: before)
    }

    /// Lower-cased content words of `minWordLength` letters or more (four), with simple
    /// plural/suffix trimming. Empty when the shared word rules are not loaded.
    static func meaningfulWords(_ text: String) -> Set<String> {
        guard let rules = wordRules else { return [] }
        let words = text.lowercased()
            .components(separatedBy: CharacterSet.letters.inverted)
            .filter { !$0.isEmpty }
        var out = Set<String>()
        for w in words {
            if let region = regionOf[w] { out.insert(region); continue }   // "RUQ" ≈ "abdominal"
            guard w.count >= rules.minWordLength, !stopWords.contains(w) else { continue }
            out.insert(stem(w, rules.suffixRules))
        }
        return out
    }

    // MARK: - Word rules (shared file)

    /// clinical-content/rules/visit-continuity.json (checked against its schema by lint:shared-content).
    struct WordRules: Codable {
        let version: String
        /// A word shorter than this is not a content word, unless it is a region word.
        let minWordLength: Int
        /// Words that say nothing about which problem it is.
        let stopWords: [String]
        /// Region token ("region-abdomen") → its body-region words.
        let regions: [String: [String]]
        let suffixRules: SuffixRules
    }

    struct SuffixRules: Codable {
        /// Tried in this order; the first that fits is trimmed.
        let suffixes: [String]
        /// A word ending in this is not trimmed ("abscess").
        let keepEnding: String
        /// At least this many letters must remain.
        let minStemLength: Int
    }

    /// The shared word rules (nil when the file is missing or does not decode).
    static let wordRules: WordRules? = SharedClinicalContent.load(WordRules.self, .visitContinuity)

    /// The word rules are loaded. When false, callers make no same-problem / new-problem call.
    static var isAvailable: Bool { wordRules != nil }

    /// Body-region words, so a reworded complaint about the same area is not a new problem.
    private static let regionOf: [String: String] = {
        var m: [String: String] = [:]
        for (region, words) in wordRules?.regions ?? [:] {
            for w in words { m[w] = region }
        }
        return m
    }()

    private static func stem(_ w: String, _ rules: SuffixRules) -> String {
        for suffix in rules.suffixes where w.hasSuffix(suffix) && !w.hasSuffix(rules.keepEnding)
            && w.count - suffix.count >= rules.minStemLength {
            return String(w.dropLast(suffix.count))
        }
        return w
    }

    /// Words that say nothing about which problem it is.
    private static let stopWords: Set<String> = Set(wordRules?.stopWords ?? [])
}
