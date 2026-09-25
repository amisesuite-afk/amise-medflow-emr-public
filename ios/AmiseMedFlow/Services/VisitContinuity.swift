// VisitContinuity.swift
// Is this a returning patient, and is today's complaint the same problem as last time?
//
// The consultation used to start from the booked visit type, which stays "New Consult" after the
// first visit, so every later visit opened as a first visit. Now a returning patient is a
// follow-up of the last problem unless the chief complaint is a new, different one, in which case
// it is a new-problem (first-visit) consultation. Pure except for reading the patient's records;
// tested in VisitContinuityTests.

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

    /// Lower-cased content words of four letters or more, with simple plural/suffix trimming.
    static func meaningfulWords(_ text: String) -> Set<String> {
        let words = text.lowercased()
            .components(separatedBy: CharacterSet.letters.inverted)
            .filter { !$0.isEmpty }
        var out = Set<String>()
        for w in words {
            if let region = regionOf[w] { out.insert(region); continue }   // "RUQ" ≈ "abdominal"
            guard w.count >= 4, !stopWords.contains(w) else { continue }
            out.insert(stem(w))
        }
        return out
    }

    /// Body-region words, so a reworded complaint about the same area is not a new problem.
    private static let regionOf: [String: String] = {
        var m: [String: String] = [:]
        for w in ["abdomen", "abdominal", "belly", "stomach", "tummy", "epigastric", "epigastrium",
                  "ruq", "luq", "rlq", "llq", "rif", "lif", "umbilical", "periumbilical", "flank",
                  "hypochondrium", "suprapubic"] { m[w] = "region-abdomen" }
        for w in ["groin", "inguinal", "femoral", "scrotal", "scrotum"] { m[w] = "region-groin" }
        for w in ["anal", "anus", "perianal", "rectal", "rectum", "bottom", "piles", "haemorrhoids",
                  "hemorrhoids"] { m[w] = "region-anorectal" }
        for w in ["breast", "breasts", "nipple", "axilla", "axillary"] { m[w] = "region-breast" }
        for w in ["neck", "thyroid", "goitre", "goiter"] { m[w] = "region-neck" }
        for w in ["foot", "feet", "toe", "toes", "heel"] { m[w] = "region-foot" }
        return m
    }()

    private static func stem(_ w: String) -> String {
        for suffix in ["ing", "ed", "s"] where w.hasSuffix(suffix) && !w.hasSuffix("ss")
            && w.count - suffix.count >= 4 {
            return String(w.dropLast(suffix.count))
        }
        return w
    }

    /// Words that say nothing about which problem it is.
    private static let stopWords: Set<String> = [
        "pain", "painful", "ache", "aching", "with", "without", "since", "days", "weeks", "months",
        "years", "hours", "left", "right", "both", "bilateral", "severe", "mild", "moderate",
        "acute", "chronic", "worse", "worsening", "better", "improving", "review", "follow",
        "followup", "check", "visit", "problem", "issue", "patient", "history", "after", "before",
        "about", "some", "more", "less", "also", "still", "again", "recurrent", "ongoing", "new",
        "unspecified", "other", "site", "area", "general", "symptoms", "symptom",
        "lump", "lumps", "swelling", "mass", "masses", "again",
    ]
}
