// LifestyleQuestions.swift
// Patient questionnaire questions on religious / ritual fasting and traditional or complementary
// treatments, for the front-desk iPad questionnaire (AdaptiveQuestionnaireSheet).
//
// iOS twin of lib/triage-engine/src/lifestyle-questions.ts (the web intake and the token
// questionnaire). DRIFT NOTE: question text, help text, option values and labels, and the
// "(patient-reported)" line prefixes must stay identical to the TS file;
// artifacts/dashboard/src/lib/__tests__/lifestyle-questions-ios-parity.test.ts parses this file
// and fails when they differ. Change both files in the same PR.
//
// Information only (hazard H-10): the wording gives no advice, names no medicine and has no
// instruction verb. Asked last in the questionnaire and never in place of a clinical question.
//
// Where the answers go — the same as the web:
//   - a short "… (patient-reported): …" social-history line (web `lifestyleQuestionnaireLine`;
//     here in Patient.pmhNotes, which front desk may write under Migration 89, and in the
//     pre-visit note). A "No" answer gives no line.
//   - never straight into the structured record (PathwayData.lifestyle, pathway_data_json is
//     clinician-only under Migration 89). The clinician sees the answers in the Social tab
//     (LifestyleHistorySection) and records them with one tap (`filling(_:)`), which only fills
//     what is not recorded yet.
//
// Pure: no SwiftData, no network, never AIService.

import Foundation

enum LifestyleQuestions {

    struct Option: Hashable {
        let value: String
        let label: String
    }

    // ── religious_fasting (multi choice; "No" is exclusive) ───────────────────
    static let fastingText =
        "Do you fast for religious or other reasons (for example Ramadan, Lent, a Daniel Fast or intermittent fasting)?"
    static let fastingHelp =
        "This is for information only, so the team can plan your care. Select all that apply."
    static let fastingOptions: [Option] = [
        Option(value: "none", label: "No"),
        Option(value: "ramadan", label: "Ramadan"),
        Option(value: "orthodox_lent", label: "Orthodox or Lent fasting"),
        Option(value: "daniel_fast", label: "Daniel Fast"),
        Option(value: "time_restricted", label: "Intermittent fasting or time-restricted eating"),
        Option(value: "other", label: "Other"),
    ]

    // ── religious_fasting_timing (single choice; asked when any fast is chosen) ──
    static let timingText = "Are you fasting at the moment, or planning a fast soon?"
    static let timingOptions: [Option] = [
        Option(value: "now", label: "Fasting now"),
        Option(value: "within_month", label: "Planning to fast within the next month"),
        Option(value: "later", label: "Planning to fast later"),
        Option(value: "not_sure", label: "Not sure"),
    ]

    // ── complementary_therapies (multi choice; "No" is exclusive) ─────────────
    static let therapiesText =
        "Do you use any traditional or complementary treatments (for example acupuncture, cupping, yoga, detox or cleanse programmes, vitamin drips)?"
    static let therapiesHelp =
        "This is for information only, so the team has a full picture. Select all that apply."
    static let therapyOptions: [Option] = [
        Option(value: "none", label: "No"),
        Option(value: "acupuncture", label: "Acupuncture"),
        Option(value: "cupping", label: "Cupping"),
        Option(value: "yoga", label: "Yoga"),
        Option(value: "tai_chi", label: "Tai chi"),
        Option(value: "mindfulness", label: "Mindfulness or meditation"),
        Option(value: "slow_breathing", label: "Breathing exercises"),
        Option(value: "detox_cleanse", label: "Detox or cleanse programmes (including detox teas)"),
        Option(value: "iv_vitamin_drips", label: "Vitamin drips"),
        Option(value: "other", label: "Other"),
    ]

    // ── Social-history lines (web QUESTIONNAIRE_LINE_LABELS) ──────────────────
    static let fastingLinePrefix = "Fasting (patient-reported):"
    static let timingLinePrefix = "Fasting timing (patient-reported):"
    static let therapiesLinePrefix = "Complementary treatments (patient-reported):"

    /// Labels of the chosen values, in option order, joined like the web `formatAnswerDisplay`.
    static func display(_ values: Set<String>, options: [Option]) -> String {
        options.filter { values.contains($0.value) }.map(\.label).joined(separator: ", ")
    }

    /// Same rule as the web `lifestyleQuestionnaireLine`: nil when the answer is empty or "No".
    static func line(prefix: String, display: String) -> String? {
        let v = display.trimmingCharacters(in: .whitespacesAndNewlines)
        if v.isEmpty || ["no", "none"].contains(v.lowercased()) { return nil }
        return "\(prefix) \(v)"
    }

    /// Option values for a display string written by `display(_:options:)`.
    static func values(fromDisplay display: String, options: [Option]) -> Set<String> {
        let labels = display.components(separatedBy: ", ").map { $0.trimmingCharacters(in: .whitespaces) }
        return Set(options.filter { labels.contains($0.label) }.map(\.value))
    }
}

/// The patient's answers to the lifestyle questions (option values, as on the web).
struct LifestyleQuestionnaireAnswers: Equatable {
    var fasting: Set<String> = []
    var timing: String?
    var therapies: Set<String> = []

    /// The timing follow-up is asked once any fast (not "No") is chosen.
    var asksTiming: Bool { fasting.contains { $0 != "none" } }

    /// Set the fasting choices; "No" is exclusive (choosing it clears the others and vice versa).
    mutating func setFasting(_ newValues: Set<String>) {
        fasting = Self.exclusiveNone(old: fasting, new: newValues)
        if !asksTiming { timing = nil }
    }

    mutating func setTherapies(_ newValues: Set<String>) {
        therapies = Self.exclusiveNone(old: therapies, new: newValues)
    }

    private static func exclusiveNone(old: Set<String>, new: Set<String>) -> Set<String> {
        let added = new.subtracting(old)
        if added.contains("none") { return ["none"] }
        if !added.isEmpty { return new.subtracting(["none"]) }
        return new
    }

    /// The social-history lines, in question order (none for an unanswered or "No" answer).
    var lines: [String] {
        var out: [String] = []
        if let l = LifestyleQuestions.line(prefix: LifestyleQuestions.fastingLinePrefix,
                                           display: LifestyleQuestions.display(fasting, options: LifestyleQuestions.fastingOptions)) {
            out.append(l)
        }
        if asksTiming, let t = timing,
           let l = LifestyleQuestions.line(prefix: LifestyleQuestions.timingLinePrefix,
                                           display: LifestyleQuestions.display([t], options: LifestyleQuestions.timingOptions)) {
            out.append(l)
        }
        if let l = LifestyleQuestions.line(prefix: LifestyleQuestions.therapiesLinePrefix,
                                           display: LifestyleQuestions.display(therapies, options: LifestyleQuestions.therapyOptions)) {
            out.append(l)
        }
        return out
    }

    /// Read the answers back from the lines in a text (Patient.pmhNotes); nil when there are none.
    static func parse(_ text: String) -> LifestyleQuestionnaireAnswers? {
        var a = LifestyleQuestionnaireAnswers()
        var found = false
        for raw in text.components(separatedBy: .newlines) {
            let t = raw.trimmingCharacters(in: .whitespaces)
            if let v = value(of: LifestyleQuestions.fastingLinePrefix, in: t) {
                a.fasting = LifestyleQuestions.values(fromDisplay: v, options: LifestyleQuestions.fastingOptions)
                found = true
            } else if let v = value(of: LifestyleQuestions.timingLinePrefix, in: t) {
                a.timing = LifestyleQuestions.values(fromDisplay: v, options: LifestyleQuestions.timingOptions).first
                found = true
            } else if let v = value(of: LifestyleQuestions.therapiesLinePrefix, in: t) {
                a.therapies = LifestyleQuestions.values(fromDisplay: v, options: LifestyleQuestions.therapyOptions)
                found = true
            }
        }
        return found ? a : nil
    }

    private static func value(of prefix: String, in line: String) -> String? {
        guard line.hasPrefix(prefix) else { return nil }
        return String(line.dropFirst(prefix.count)).trimmingCharacters(in: .whitespaces)
    }

    /// The structured record with the patient's answers filled in where nothing is recorded yet
    /// (a clinician-recorded field is never changed). Used only when the clinician taps
    /// "Record the patient's answers" in the Social tab.
    func filling(_ history: LifestyleHistory) -> LifestyleHistory {
        var out = history
        if out.fasting.isEmpty {
            let chosen = LifestyleHistory.Fasting.allCases.filter { fasting.contains($0.rawValue) }
            out.fasting = chosen.count > 1 ? chosen.filter { $0 != .notFasting } : chosen
        }
        if out.recordsFasting {
            if out.fastingStatus == nil {
                switch timing ?? "" {
                case "now": out.fastingStatus = .current
                case "within_month", "later": out.fastingStatus = .planned
                default: break
                }
            }
            if out.fastingWhen.isEmpty, timing == "within_month" {
                out.fastingWhen = "Within the next month"
            }
        }
        if out.therapies.isEmpty {
            out.therapies = LifestyleHistory.Therapy.allCases.filter { therapies.contains($0.rawValue) }
        }
        return out
    }
}

extension Patient {
    /// The front-desk questionnaire's lifestyle answers, read back from the pmhNotes lines, for
    /// the clinician to confirm (LifestyleHistorySection). Nil when the patient gave none.
    var patientReportedLifestyle: LifestyleQuestionnaireAnswers? {
        guard let notes = pmhNotes, !notes.isEmpty else { return nil }
        return LifestyleQuestionnaireAnswers.parse(notes)
    }
}
