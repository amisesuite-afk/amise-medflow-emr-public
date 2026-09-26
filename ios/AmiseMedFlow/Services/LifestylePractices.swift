// LifestylePractices.swift
// Structured social / lifestyle history (ritual fasting, complementary therapies, sleep and
// shift work), clinician-facing safety prompts, and evidence-graded non-drug plan suggestions.
//
// Source: the practice owner's evidence briefing (Dr Dawit Daniel Kabiye, Sept 2026) — §4
// (habits and rituals), §6 (hands-on and device therapies), §8 (verdict table) and the matching
// §10 references. Clinical content only; none of this is shown to patients.
//
// iOS twin of lib/triage-engine/src/lifestyle-practices.ts. The content lives once, as data:
// clinical-content/rules/lifestyle-practices.json (labels, thresholds, matcher terms and regex
// patterns, every prompt / plan-line / source / practice / evidence-grade / reason string), the
// same file the web reads, bundled as the "rules" folder and loaded by SharedClinicalContent.
// Change the JSON, not a platform copy; lint:shared-content checks the Codable structs below
// against clinical-content/schemas/lifestyle-practices.schema.json.
// DRIFT NOTE: the rule logic (which finding raises which prompt or suggestion) and the stored
// value lists (enum raw values; lint:shared-content does not check the label keys, the web test
// does) stay mirrored in code. The test vectors in AmiseMedFlowTests/LifestylePracticesTests.swift
// are ported one for one from artifacts/dashboard/src/lib/__tests__/lifestyle-practices.test.ts —
// change both files and both test files in the same PR, and bump the JSON `version` with the
// registry entry `lifestyle-practices`.
// When the file is missing or does not decode, no prompt or suggestion is shown, labels read as
// their stored values, and Settings → Diagnostics says why.
//
// Safety rules (CLAUDE.md, hazard H-10, "Central diagnosis radiation"):
//   - Deterministic. Nothing here writes to the record: prompts are dismissible and a plan line is
//     added only when the clinician taps it.
//   - No text tells anyone to take, hold, stop or adjust a named medicine. "Medication review
//     recommended" is the limit.
//   - Matching is negation-aware (NegationMatcher).
//   - Pure: no SwiftData, no network, never AIService.

import Foundation

// MARK: - Stored record (PathwayData.lifestyle → patients.pathway_data_json)

struct LifestyleHistory: Codable, Equatable {

    enum Fasting: String, Codable, CaseIterable {
        /// Stored as "none"; named notFasting so it is never confused with Optional's none.
        case notFasting = "none"
        case ramadan
        case orthodoxLent = "orthodox_lent"
        case danielFast = "daniel_fast"
        case timeRestricted = "time_restricted"
        case other

        /// Shared label (lifestyle-practices.json `labels.fasting`), else the stored value.
        var label: String { LifestylePractices.content?.labels.fasting[rawValue] ?? rawValue }
    }

    enum FastStatus: String, Codable, CaseIterable {
        case current, planned
        case notCurrently = "not_currently"

        /// Shared label (lifestyle-practices.json `labels.fastingStatus`), else the stored value.
        var label: String { LifestylePractices.content?.labels.fastingStatus[rawValue] ?? rawValue }
    }

    enum Therapy: String, Codable, CaseIterable {
        case acupuncture, cupping, yoga
        case taiChi = "tai_chi"
        case mindfulness
        case slowBreathing = "slow_breathing"
        case detoxCleanse = "detox_cleanse"
        case ivVitaminDrips = "iv_vitamin_drips"
        case other

        /// Shared label (lifestyle-practices.json `labels.therapies`), else the stored value.
        var label: String { LifestylePractices.content?.labels.therapies[rawValue] ?? rawValue }
    }

    /// Empty = not recorded. `.notFasting` is exclusive (the clinician recorded "does not fast").
    var fasting: [Fasting] = []
    var fastingOther: String = ""
    var fastingStatus: FastStatus?
    /// When the next fast is planned (free text).
    var fastingWhen: String = ""
    var therapies: [Therapy] = []
    var therapiesOther: String = ""
    /// nil = not recorded.
    var nightShift: Bool?
    /// Usual hours of sleep a night; nil = not recorded.
    var sleepHours: Double?

    init() {}

    private enum CodingKeys: String, CodingKey {
        case fasting, fastingOther, fastingStatus, fastingWhen, therapies, therapiesOther, nightShift, sleepHours
    }

    /// Tolerant decode (same rules as the web `parseLifestyleHistory`): unknown values are dropped,
    /// a missing or malformed key reads as "not recorded".
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        var f: [Fasting] = []
        for raw in (try? c.decodeIfPresent([String].self, forKey: .fasting)) ?? [] {
            if let v = Fasting(rawValue: raw), !f.contains(v) { f.append(v) }
        }
        if f.contains(.notFasting) && f.count > 1 { f.removeAll { $0 == .notFasting } }
        fasting = f
        fastingOther = (try? c.decodeIfPresent(String.self, forKey: .fastingOther)) ?? ""
        fastingStatus = ((try? c.decodeIfPresent(String.self, forKey: .fastingStatus)) ?? nil).flatMap(FastStatus.init(rawValue:))
        fastingWhen = (try? c.decodeIfPresent(String.self, forKey: .fastingWhen)) ?? ""
        var t: [Therapy] = []
        for raw in (try? c.decodeIfPresent([String].self, forKey: .therapies)) ?? [] {
            if let v = Therapy(rawValue: raw), !t.contains(v) { t.append(v) }
        }
        therapies = t
        therapiesOther = (try? c.decodeIfPresent(String.self, forKey: .therapiesOther)) ?? ""
        nightShift = (try? c.decodeIfPresent(Bool.self, forKey: .nightShift)) ?? nil
        sleepHours = LifestyleHistory.normalisedSleepHours((try? c.decodeIfPresent(Double.self, forKey: .sleepHours)) ?? nil)
    }

    /// Plausible usual sleep (0–24 h), else nil.
    static func normalisedSleepHours(_ v: Double?) -> Double? {
        guard let v, v.isFinite, v >= 0, v <= 24 else { return nil }
        return v
    }

    /// Toggle a fasting practice: `.notFasting` clears the others and vice versa.
    mutating func toggleFasting(_ f: Fasting) {
        if fasting.contains(f) { fasting.removeAll { $0 == f } }
        else if f == .notFasting { fasting = [.notFasting] }
        else { fasting.removeAll { $0 == .notFasting }; fasting.append(f) }
        if !fasting.contains(.other) { fastingOther = "" }
        if fasting.isEmpty || fasting == [.notFasting] { fastingStatus = nil; fastingWhen = "" }
    }

    mutating func toggleTherapy(_ t: Therapy) {
        if therapies.contains(t) { therapies.removeAll { $0 == t } } else { therapies.append(t) }
        if !therapies.contains(.other) { therapiesOther = "" }
    }

    var isRecorded: Bool {
        !fasting.isEmpty || !therapies.isEmpty || nightShift != nil || sleepHours != nil
    }

    /// Any fasting practice recorded (not `.notFasting`).
    var recordsFasting: Bool { fasting.contains { $0 != .notFasting } }

    /// A religious or ritual fast is recorded (Ramadan, Orthodox/Lent, Daniel Fast, other).
    var recordsReligiousFasting: Bool {
        fasting.contains { [.ramadan, .orthodoxLent, .danielFast, .other].contains($0) }
    }

    /// Current or planned; an unrecorded status counts (safety bias).
    var fastingActiveOrPlanned: Bool { fastingStatus != .notCurrently }

    /// "Detox or cleanse programmes" recorded — for other modules (e.g. supplement / LFT prompts).
    var usesDetoxOrCleanse: Bool { therapies.contains(.detoxCleanse) }

    /// "IV vitamin drips" recorded — for other modules.
    var usesIvVitaminDrips: Bool { therapies.contains(.ivVitaminDrips) }

    /// The SOAP background (social history) sentence(s), or nil when nothing is recorded.
    var summary: String? {
        var sentences: [String] = []
        if fasting == [.notFasting] {
            sentences.append("No religious or ritual fasting.")
        } else if recordsFasting {
            let other = fastingOther.trimmingCharacters(in: .whitespacesAndNewlines)
            let names = fasting.filter { $0 != .notFasting }.map { $0 == .other ? (other.isEmpty ? "Other fasting" : other) : $0.label }
            var s = "Fasting: \(names.joined(separator: ", "))"
            let when = fastingWhen.trimmingCharacters(in: .whitespacesAndNewlines)
            switch fastingStatus {
            case .current:      s += " (currently fasting)"
            case .planned:      s += when.isEmpty ? " (fast planned)" : " (next planned: \(when))"
            case .notCurrently: s += " (not currently fasting)"
            case nil:           if !when.isEmpty { s += " (next planned: \(when))" }
            }
            sentences.append(s + ".")
        }
        if !therapies.isEmpty {
            let other = therapiesOther.trimmingCharacters(in: .whitespacesAndNewlines)
            let names = therapies.map { $0 == .other ? (other.isEmpty ? "Other" : other) : $0.label }
            sentences.append("Complementary therapies: \(names.joined(separator: ", ")).")
        }
        var sleep: [String] = []
        if nightShift == true { sleep.append("Night-shift work") }
        else if nightShift == false { sleep.append("No night-shift work") }
        if let h = sleepHours {
            let hours = LifestyleHistory.formatHours(h)
            sleep.append(sleep.isEmpty ? "Usual sleep \(hours) h a night" : "usual sleep \(hours) h a night")
        }
        if !sleep.isEmpty { sentences.append(sleep.joined(separator: "; ") + ".") }
        return sentences.isEmpty ? nil : sentences.joined(separator: " ")
    }

    /// "5", "5.5" (same output as the web `formatSleepHours`).
    static func formatHours(_ n: Double) -> String {
        String(format: "%g", (n * 100).rounded() / 100)
    }
}

// MARK: - Rules

enum LifestylePractices {

    // MARK: Shared content (clinical-content/rules/lifestyle-practices.json)

    struct Thresholds: Codable {
        let olderAdultAge: Int
        let shortSleepHours: Double
        let obesityBMI: Double
    }

    /// Display label by stored value (the enum raw values).
    struct Labels: Codable {
        let fasting: [String: String]
        let fastingStatus: [String: String]
        let therapies: [String: String]
    }

    /// Regular expressions, shared verbatim with the web (ICU / JavaScript).
    struct Patterns: Codable {
        let diabetes: [String]
        let insulin: [String]
        let sulfonylurea: [String]
        let depression: [String]
    }

    /// Whole-word, negation-aware match terms.
    struct Terms: Codable {
        let falls: [String]
        let backPain: [String]
        let neckPain: [String]
        let osteoarthritis: [String]
        let headache: [String]
        let anxiety: [String]
        let obesity: [String]
        let hypertension: [String]
        let lipid: [String]
        let cardiovascular: [String]
        let cupping: [String]
        let detox: [String]
        let ivDrip: [String]
    }

    struct PromptTexts: Codable {
        let fastingInsulin: String
        let fastingDiabetes: String
        let fastingPeriop: String
        let nightShiftSleep: String
    }

    struct PromptSourceTexts: Codable {
        let idfDar: String
        let briefingFasting: String
        let briefingSleep: String
    }

    struct SourceTexts: Codable {
        let taiChi: String
        let yoga: String
        let mbct: String
        let slowBreathing: String
        let acupuncture: String
        let timeRestricted: String
        let cuppingDetox: String
        let ivDrips: String
    }

    struct PlanLineTexts: Codable {
        let taiChi: String
        let yoga: String
        let mbct: String
        let slowBreathing: String
        let acupuncture: String
        let timeRestricted: String
        let timeRestrictedDiabetesNote: String
        let cupping: String
        let detox: String
        let ivDrips: String
    }

    /// Display name and evidence grade of a suggestion (by suggestion id).
    struct SuggestionText: Codable {
        let practice: String
        let evidence: EvidenceGrade
    }

    /// Why a suggestion is shown (the age and BMI reasons are formatted in code).
    struct Reasons: Codable {
        let fallsOrFrailty: String
        let postOperativeRehabilitation: String
        let backPain: String
        let depression: String
        let anxiety: String
        let anxietyProcedure: String
        let chronicPain: String
        let obesity: String
        let cupping: String
        let detox: String
        let ivDrips: String
    }

    /// The whole file (lint:shared-content checks these fields against the schema).
    struct Content: Codable {
        let version: String
        let thresholds: Thresholds
        let labels: Labels
        let patterns: Patterns
        let terms: Terms
        let promptText: PromptTexts
        let promptSources: PromptSourceTexts
        let sources: SourceTexts
        let planLines: PlanLineTexts
        let suggestions: [String: SuggestionText]
        let reasons: Reasons
    }

    /// nil when the file is missing or does not decode: then no prompt or suggestion is shown.
    static let content: Content? = SharedClinicalContent.load(Content.self, .lifestylePractices)

    /// The JSON `version`; bump with any rule or wording change, with the registry entry.
    static var version: String { content?.version ?? "unavailable" }

    /// Thresholds — listed for surgeon sign-off (docs/clinical-validation/changes/lifestyle-practices.md).
    /// Without the file nothing is evaluated, so the fallbacks never apply.
    static var olderAdultAge: Int { content?.thresholds.olderAdultAge ?? Int.max }
    static var shortSleepHours: Double { content?.thresholds.shortSleepHours ?? 0 }
    static var obesityBMI: Double { content?.thresholds.obesityBMI ?? Double.greatestFiniteMagnitude }

    struct Context {
        var lifestyle: LifestyleHistory
        /// nil when the date of birth is not recorded.
        var ageYears: Int?
        /// The clinician's working diagnosis (and ICD code), if any.
        var diagnosisText: String
        /// Problem list: PMH entries and PMH notes, one item per clause.
        var problemText: String
        /// Chief complaint and presenting symptoms.
        var complaintText: String
        /// Medication list.
        var medicationText: String
        var bmi: Double?
        /// A procedure or operation is booked, or this is a procedure visit.
        var procedureBooked: Bool
    }

    // Regex sources are shared verbatim with the web (ICU / JS); terms are whole-word.
    static var diabetesPatterns: [String] { content?.patterns.diabetes ?? [] }
    static var insulinPatterns: [String] { content?.patterns.insulin ?? [] }
    static var sulfonylureaPatterns: [String] { content?.patterns.sulfonylurea ?? [] }
    static var fallsTerms: [String] { content?.terms.falls ?? [] }
    static var backPainTerms: [String] { content?.terms.backPain ?? [] }
    static var neckPainTerms: [String] { content?.terms.neckPain ?? [] }
    static var osteoarthritisTerms: [String] { content?.terms.osteoarthritis ?? [] }
    static var headacheTerms: [String] { content?.terms.headache ?? [] }
    static var depressionPatterns: [String] { content?.patterns.depression ?? [] }
    static var anxietyTerms: [String] { content?.terms.anxiety ?? [] }
    static var obesityTerms: [String] { content?.terms.obesity ?? [] }
    static var hypertensionTerms: [String] { content?.terms.hypertension ?? [] }
    static var lipidTerms: [String] { content?.terms.lipid ?? [] }
    static var cardiovascularTerms: [String] { content?.terms.cardiovascular ?? [] }

    private static func anyPattern(_ text: String, _ patterns: [String]) -> Bool {
        guard !text.isEmpty else { return false }
        return patterns.contains { NegationMatcher.testAffirmed($0, text) }
    }

    private static func anyTerm(_ text: String, _ terms: [String]) -> Bool {
        guard !text.isEmpty else { return false }
        return NegationMatcher.containsAnyAffirmed(text, terms, wholeWord: true)
    }

    private struct Findings {
        var diabetes = false
        var insulinOrSulfonylurea = false
        var obesity = false
        var cardiometabolic = false
        var olderAdult = false
        var fallsOrFrailty = false
        var backPain = false
        var chronicPain = false
        var depression = false
        var anxiety = false
    }

    private static func findings(_ ctx: Context) -> Findings {
        let clinical = NegationMatcher.joinClauses([ctx.diagnosisText, ctx.problemText, ctx.complaintText])
        let drugText = NegationMatcher.joinClauses([ctx.medicationText, ctx.problemText])
        var f = Findings()
        f.diabetes = anyPattern(clinical, diabetesPatterns)
        f.insulinOrSulfonylurea = anyPattern(drugText, insulinPatterns) || anyPattern(drugText, sulfonylureaPatterns)
        f.obesity = (ctx.bmi.map { $0 >= obesityBMI } ?? false) || anyTerm(clinical, obesityTerms)
        f.cardiometabolic = f.diabetes || f.obesity || anyTerm(clinical, hypertensionTerms)
            || anyTerm(clinical, lipidTerms) || anyTerm(clinical, cardiovascularTerms)
        f.olderAdult = (ctx.ageYears.map { $0 >= olderAdultAge }) ?? false
        f.fallsOrFrailty = anyTerm(clinical, fallsTerms)
        f.backPain = anyTerm(clinical, backPainTerms)
        f.chronicPain = f.backPain || anyTerm(clinical, neckPainTerms) || anyTerm(clinical, osteoarthritisTerms)
            || anyTerm(clinical, headacheTerms)
        f.depression = anyPattern(clinical, depressionPatterns)
        f.anxiety = anyTerm(clinical, anxietyTerms)
        return f
    }

    // MARK: Safety prompts

    enum PromptGrade: String { case warning, caution, info }

    struct Prompt: Identifiable, Equatable {
        let id: String
        let grade: PromptGrade
        let text: String
        let source: String
    }

    static var idfDarSource: String { content?.promptSources.idfDar ?? "" }
    static var briefingFastingSource: String { content?.promptSources.briefingFasting ?? "" }
    static var briefingSleepSource: String { content?.promptSources.briefingSleep ?? "" }

    /// JSON `promptText`.
    enum PromptText {
        static var fastingInsulin: String { LifestylePractices.content?.promptText.fastingInsulin ?? "" }
        static var fastingDiabetes: String { LifestylePractices.content?.promptText.fastingDiabetes ?? "" }
        static var fastingPeriop: String { LifestylePractices.content?.promptText.fastingPeriop ?? "" }
        static var nightShiftSleep: String { LifestylePractices.content?.promptText.nightShiftSleep ?? "" }
    }

    /// Clinician-facing prompts, most serious first. Dismissible; they change nothing by themselves.
    static func safetyPrompts(_ ctx: Context) -> [Prompt] {
        guard content != nil else { return [] }
        let h = ctx.lifestyle
        let f = findings(ctx)
        var out: [Prompt] = []
        let fastingNow = h.recordsFasting && h.fastingActiveOrPlanned
        if fastingNow && f.diabetes {
            out.append(f.insulinOrSulfonylurea
                ? Prompt(id: "fasting-diabetes-insulin-su", grade: .warning, text: PromptText.fastingInsulin, source: idfDarSource)
                : Prompt(id: "fasting-diabetes", grade: .caution, text: PromptText.fastingDiabetes, source: idfDarSource))
        }
        if h.recordsReligiousFasting && h.fastingActiveOrPlanned && ctx.procedureBooked {
            out.append(Prompt(id: "fasting-perioperative", grade: .caution, text: PromptText.fastingPeriop, source: briefingFastingSource))
        }
        let shortSleep = h.sleepHours.map { $0 < shortSleepHours } ?? false
        if (h.nightShift == true || shortSleep) && f.cardiometabolic {
            out.append(Prompt(id: "night-shift-short-sleep", grade: .info, text: PromptText.nightShiftSleep, source: briefingSleepSource))
        }
        return out
    }

    // MARK: Non-drug plan suggestions

    /// Grade labels from the briefing's verdict table (§8) and §6.
    enum EvidenceGrade: String, Codable {
        case works = "Works"
        case modest = "Modest"
        case mixed = "Mixed"
        case noBenefit = "No benefit shown"
    }

    enum SuggestionKind: String { case suggestion, counsel }

    struct Suggestion: Identifiable, Equatable {
        let id: String
        let kind: SuggestionKind
        let practice: String
        let evidence: EvidenceGrade
        /// Why it is shown for this patient.
        let reason: String
        /// The line added to the plan when the clinician taps it.
        let planLine: String
        let source: String
        /// The patient already records this practice.
        let alreadyUsed: Bool
    }

    /// JSON `sources`.
    enum Sources {
        static var taiChi: String { LifestylePractices.content?.sources.taiChi ?? "" }
        static var yoga: String { LifestylePractices.content?.sources.yoga ?? "" }
        static var mbct: String { LifestylePractices.content?.sources.mbct ?? "" }
        static var slowBreathing: String { LifestylePractices.content?.sources.slowBreathing ?? "" }
        static var acupuncture: String { LifestylePractices.content?.sources.acupuncture ?? "" }
        static var timeRestricted: String { LifestylePractices.content?.sources.timeRestricted ?? "" }
        static var cuppingDetox: String { LifestylePractices.content?.sources.cuppingDetox ?? "" }
        static var ivDrips: String { LifestylePractices.content?.sources.ivDrips ?? "" }
    }

    /// JSON `planLines`.
    enum PlanLines {
        static var taiChi: String { LifestylePractices.content?.planLines.taiChi ?? "" }
        static var yoga: String { LifestylePractices.content?.planLines.yoga ?? "" }
        static var mbct: String { LifestylePractices.content?.planLines.mbct ?? "" }
        static var slowBreathing: String { LifestylePractices.content?.planLines.slowBreathing ?? "" }
        static var acupuncture: String { LifestylePractices.content?.planLines.acupuncture ?? "" }
        static var timeRestricted: String { LifestylePractices.content?.planLines.timeRestricted ?? "" }
        static var timeRestrictedDiabetesNote: String { LifestylePractices.content?.planLines.timeRestrictedDiabetesNote ?? "" }
        static var cupping: String { LifestylePractices.content?.planLines.cupping ?? "" }
        static var detox: String { LifestylePractices.content?.planLines.detox ?? "" }
        static var ivDrips: String { LifestylePractices.content?.planLines.ivDrips ?? "" }
    }

    static var cuppingText: [String] { content?.terms.cupping ?? [] }
    static var detoxText: [String] { content?.terms.detox ?? [] }
    static var ivDripText: [String] { content?.terms.ivDrip ?? [] }

    /// "31.3" / "32" (same output as the web `String(Math.round(bmi * 10) / 10)`).
    static func formatBMI(_ bmi: Double) -> String {
        String(format: "%g", (bmi * 10).rounded() / 10)
    }

    /// A suggestion with its shared display name and evidence grade (JSON `suggestions`); nil when
    /// the file has no entry for the id (the schema requires every id, so this does not happen).
    private static func suggestion(_ id: String, _ kind: SuggestionKind, reason: String, planLine: String,
                                   source: String, alreadyUsed: Bool) -> Suggestion? {
        guard let text = content?.suggestions[id] else { return nil }
        return Suggestion(id: id, kind: kind, practice: text.practice, evidence: text.evidence, reason: reason,
                          planLine: planLine, source: source, alreadyUsed: alreadyUsed)
    }

    /// Evidence-graded non-drug suggestions, in a fixed order. Nothing is added to the plan until
    /// the clinician taps a suggestion.
    static func planSuggestions(_ ctx: Context) -> [Suggestion] {
        guard let reasonText = content?.reasons else { return [] }
        let h = ctx.lifestyle
        let f = findings(ctx)
        var out: [Suggestion] = []
        func uses(_ t: LifestyleHistory.Therapy) -> Bool { h.therapies.contains(t) }
        func add(_ s: Suggestion?) { if let s { out.append(s) } }
        let otherText = h.therapiesOther

        if f.olderAdult || f.fallsOrFrailty {
            var reasons: [String] = []
            if f.olderAdult, let age = ctx.ageYears { reasons.append("Age \(age) (≥ \(olderAdultAge))") }
            if f.fallsOrFrailty { reasons.append(reasonText.fallsOrFrailty) }
            if f.olderAdult && ctx.procedureBooked { reasons.append(reasonText.postOperativeRehabilitation) }
            add(suggestion("tai-chi", .suggestion, reason: reasons.joined(separator: "; "), planLine: PlanLines.taiChi,
                           source: Sources.taiChi, alreadyUsed: uses(.taiChi)))
        }
        if f.backPain {
            add(suggestion("yoga", .suggestion, reason: reasonText.backPain, planLine: PlanLines.yoga,
                           source: Sources.yoga, alreadyUsed: uses(.yoga)))
        }
        if f.depression {
            add(suggestion("mbct", .suggestion, reason: reasonText.depression, planLine: PlanLines.mbct,
                           source: Sources.mbct, alreadyUsed: uses(.mindfulness)))
        }
        if f.anxiety {
            add(suggestion("slow-breathing", .suggestion,
                           reason: ctx.procedureBooked ? reasonText.anxietyProcedure : reasonText.anxiety,
                           planLine: PlanLines.slowBreathing, source: Sources.slowBreathing,
                           alreadyUsed: uses(.slowBreathing)))
        }
        if f.chronicPain {
            add(suggestion("acupuncture", .suggestion, reason: reasonText.chronicPain, planLine: PlanLines.acupuncture,
                           source: Sources.acupuncture, alreadyUsed: uses(.acupuncture)))
        }
        if f.obesity {
            let withNote = f.diabetes && f.insulinOrSulfonylurea
            let reason: String
            if let bmi = ctx.bmi, bmi >= obesityBMI {
                reason = "BMI \(formatBMI(bmi)) (≥ \(Int(obesityBMI)))"
            } else {
                reason = reasonText.obesity
            }
            add(suggestion("time-restricted-eating", .suggestion, reason: reason,
                           planLine: withNote ? "\(PlanLines.timeRestricted) \(PlanLines.timeRestrictedDiabetesNote)" : PlanLines.timeRestricted,
                           source: withNote ? "\(Sources.timeRestricted) \(idfDarSource)" : Sources.timeRestricted,
                           alreadyUsed: h.fasting.contains(.timeRestricted)))
        }

        // "No benefit shown" information: only when the patient's record lists the practice.
        if uses(.cupping) || anyTerm(otherText, cuppingText) {
            add(suggestion("counsel-cupping", .counsel, reason: reasonText.cupping, planLine: PlanLines.cupping,
                           source: Sources.cuppingDetox, alreadyUsed: true))
        }
        if h.usesDetoxOrCleanse || anyTerm(otherText, detoxText) {
            add(suggestion("counsel-detox", .counsel, reason: reasonText.detox, planLine: PlanLines.detox,
                           source: Sources.cuppingDetox, alreadyUsed: true))
        }
        if h.usesIvVitaminDrips || anyTerm(otherText, ivDripText) {
            add(suggestion("counsel-iv-drips", .counsel, reason: reasonText.ivDrips, planLine: PlanLines.ivDrips,
                           source: Sources.ivDrips, alreadyUsed: true))
        }
        return out
    }

    /// The plan after the clinician taps "Add": the line goes on its own line at the end; a line
    /// already in the plan is not added twice.
    static func appendPlanLine(_ plan: String, _ line: String) -> String {
        if plan.contains(line) { return plan }
        var trimmed = plan
        while let last = trimmed.last, last.isWhitespace { trimmed.removeLast() }
        return trimmed.isEmpty ? line : "\(trimmed)\n\(line)"
    }
}
