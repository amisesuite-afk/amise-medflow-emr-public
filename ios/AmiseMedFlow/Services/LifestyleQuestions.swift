// LifestyleQuestions.swift
// Patient questionnaire questions on religious / ritual fasting and traditional or complementary
// treatments, for the front-desk iPad questionnaire (AdaptiveQuestionnaireSheet).
//
// iOS twin of lib/triage-engine/src/lifestyle-questions.ts (the web intake and the token
// questionnaire). The question text, help text, option values and labels and the
// "(patient-reported)" line labels are the shared clinical rule file
// clinical-content/rules/lifestyle-questions.json, which both platforms read (here through
// SharedClinicalContent, File.lifestyleQuestions; lint:shared-content checks `Content` against its
// schema). Change the JSON, not this file. A missing or undecodable file gives no questions:
// `isAvailable` is false, the questionnaire shows no lifestyle section, and no line is written or
// read back (Settings → Diagnostics says why).
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

    // MARK: - Shared content (clinical-content/rules/lifestyle-questions.json)

    struct OptionContent: Codable {
        let value: String
        let label: String
        /// Web APCQ: the follow-up question keys this answer queues (iOS: `asksTiming`).
        let triggersKeys: [String]?
    }

    enum QuestionType: String, Codable {
        case singleChoice = "single_choice"
        case multiChoice = "multi_choice"
    }

    struct QuestionContent: Codable {
        let key: String
        let text: String
        let type: QuestionType
        let helpText: String?
        let options: [OptionContent]
    }

    struct Content: Codable {
        let version: String
        /// Question key → question.
        let questions: [String: QuestionContent]
        /// Question key → social-history line label ("Fasting (patient-reported)").
        let lineLabels: [String: String]
    }

    /// The shared questions (nil when the file is missing or does not decode).
    static let content: Content? = SharedClinicalContent.load(Content.self, .lifestyleQuestions)

    /// The questions can be asked. When false the questionnaire shows no lifestyle section and no
    /// "(patient-reported)" line is written or read back.
    static var isAvailable: Bool { content != nil }

    static let fastingKey = "religious_fasting"
    static let timingKey = "religious_fasting_timing"
    static let therapiesKey = "complementary_therapies"

    private static func question(_ key: String) -> QuestionContent? { content?.questions[key] }

    private static func options(_ key: String) -> [Option] {
        (question(key)?.options ?? []).map { Option(value: $0.value, label: $0.label) }
    }

    /// "Fasting (patient-reported):" — the label and a colon, as the web line is "<label>: <answer>".
    private static func linePrefix(_ key: String) -> String? {
        guard let label = content?.lineLabels[key], !label.isEmpty else { return nil }
        return label + ":"
    }

    // ── religious_fasting (multi choice; "No" is exclusive) ───────────────────
    static var fastingText: String { question(fastingKey)?.text ?? "" }
    static var fastingHelp: String { question(fastingKey)?.helpText ?? "" }
    static var fastingOptions: [Option] { options(fastingKey) }

    // ── religious_fasting_timing (single choice; asked when any fast is chosen) ──
    static var timingText: String { question(timingKey)?.text ?? "" }
    static var timingOptions: [Option] { options(timingKey) }

    // ── complementary_therapies (multi choice; "No" is exclusive) ─────────────
    static var therapiesText: String { question(therapiesKey)?.text ?? "" }
    static var therapiesHelp: String { question(therapiesKey)?.helpText ?? "" }
    static var therapyOptions: [Option] { options(therapiesKey) }

    // ── Social-history lines (web QUESTIONNAIRE_LINE_LABELS); nil when not loaded ──
    static var fastingLinePrefix: String? { linePrefix(fastingKey) }
    static var timingLinePrefix: String? { linePrefix(timingKey) }
    static var therapiesLinePrefix: String? { linePrefix(therapiesKey) }

    /// Labels of the chosen values, in option order, joined like the web `formatAnswerDisplay`.
    static func display(_ values: Set<String>, options: [Option]) -> String {
        options.filter { values.contains($0.value) }.map(\.label).joined(separator: ", ")
    }

    /// Same rule as the web `lifestyleQuestionnaireLine`: nil when the answer is empty or "No"
    /// (or when the shared file is not loaded, so there is no prefix).
    static func line(prefix: String?, display: String) -> String? {
        guard let prefix, !prefix.isEmpty else { return nil }
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

    private static func value(of prefix: String?, in line: String) -> String? {
        guard let prefix, !prefix.isEmpty, line.hasPrefix(prefix) else { return nil }
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
