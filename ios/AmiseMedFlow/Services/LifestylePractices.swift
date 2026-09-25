// LifestylePractices.swift
// Structured social / lifestyle history (ritual fasting, complementary therapies, sleep and
// shift work), clinician-facing safety prompts, and evidence-graded non-drug plan suggestions.
//
// Source: the practice owner's evidence briefing (Dr Dawit Daniel Kabiye, Sept 2026) — §4
// (habits and rituals), §6 (hands-on and device therapies), §8 (verdict table) and the matching
// §10 references. Clinical content only; none of this is shown to patients.
//
// iOS twin of lib/triage-engine/src/lifestyle-practices.ts.
// DRIFT NOTE: the value lists, labels, matcher terms, thresholds (age ≥ 65, sleep < 6 h,
// BMI ≥ 30) and every prompt / plan-line string must stay identical to the TS file. The test
// vectors in AmiseMedFlowTests/LifestylePracticesTests.swift are ported one for one from
// artifacts/dashboard/src/lib/__tests__/lifestyle-practices.test.ts — change both files and both
// test files in the same PR, and bump `version` with the registry entry `lifestyle-practices`.
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

        var label: String {
            switch self {
            case .notFasting:     return "None"
            case .ramadan:        return "Ramadan"
            case .orthodoxLent:   return "Orthodox or Lent fasting"
            case .danielFast:     return "Daniel Fast"
            case .timeRestricted: return "Time-restricted eating / intermittent fasting"
            case .other:          return "Other"
            }
        }
    }

    enum FastStatus: String, Codable, CaseIterable {
        case current, planned
        case notCurrently = "not_currently"

        var label: String {
            switch self {
            case .current:      return "Currently fasting"
            case .planned:      return "Fast planned"
            case .notCurrently: return "Not currently fasting"
            }
        }
    }

    enum Therapy: String, Codable, CaseIterable {
        case acupuncture, cupping, yoga
        case taiChi = "tai_chi"
        case mindfulness
        case slowBreathing = "slow_breathing"
        case detoxCleanse = "detox_cleanse"
        case ivVitaminDrips = "iv_vitamin_drips"
        case other

        var label: String {
            switch self {
            case .acupuncture:    return "Acupuncture"
            case .cupping:        return "Cupping"
            case .yoga:           return "Yoga"
            case .taiChi:         return "Tai chi"
            case .mindfulness:    return "Mindfulness / meditation"
            case .slowBreathing:  return "Slow-breathing practice"
            case .detoxCleanse:   return "Detox or cleanse programmes"
            case .ivVitaminDrips: return "IV vitamin drips"
            case .other:          return "Other"
            }
        }
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

    /// Bump with any rule or wording change; mirrored in clinical-content/registry.json.
    static let version = "0.1.0"

    /// Thresholds — listed for surgeon sign-off (docs/clinical-validation/changes/lifestyle-practices.md).
    static let olderAdultAge = 65
    static let shortSleepHours = 6.0
    static let obesityBMI = 30.0

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

    // Regex sources are shared verbatim with the TS file (ICU / JS).
    static let diabetesPatterns = [
        #"(?<!pre[- ])\bdiabet(?:es|ic)\b(?!\s+insipidus)"#,
        #"\bt[12]\s?dm\b"#,
        #"\bn?iddm\b"#,
        #"\btype\s*(?:1|2|i|ii)\s*dm\b"#,
    ]
    static let insulinPatterns = [
        #"\binsulins?\b(?!\s+resist)"#,
        #"\b(?:glargine|detemir|degludec|lispro|glulisine|lantus|levemir|tresiba|toujeo|novorapid|humalog|apidra|humulin|novomix|mixtard|actrapid|insulatard|basaglar|fiasp)\b"#,
        #"\binsulin\s+aspart\b"#,
    ]
    static let sulfonylureaPatterns = [
        #"\b(?:gliclazide|glibenclamide|glyburide|glimepiride|glipizide|tolbutamide|chlorpropamide|diamicron|amaryl|daonil)\b"#,
        #"\bsulph?onylureas?\b"#,
        #"\bsulfonylureas?\b"#,
    ]
    static let fallsTerms = [
        "falls", "recurrent fall", "mechanical fall", "fall risk", "history of fall", "fear of falling",
        "frailty", "frail", "unsteady", "poor balance", "balance problem", "balance impairment",
    ]
    static let backPainTerms = ["low back pain", "lower back pain", "back pain", "backache", "lumbago", "lumbar pain"]
    static let neckPainTerms = ["neck pain", "cervical spondylosis"]
    static let osteoarthritisTerms = ["osteoarthritis", "osteoarthrosis", "degenerative joint disease"]
    static let headacheTerms = ["chronic headache", "migraine", "tension headache", "tension-type headache"]
    static let depressionPatterns = [
        #"(?<!\bst[- ])(?<!respiratory )(?<!segment )\bdepressi(?:on|ve)\b"#,
        #"\bmdd\b"#,
    ]
    static let anxietyTerms = ["anxiety", "anxious", "panic attack", "panic disorder"]
    static let obesityTerms = ["obesity", "obese"]
    static let hypertensionTerms = ["hypertension", "hypertensive", "high blood pressure", "htn"]
    static let lipidTerms = [
        "dyslipidaemia", "dyslipidemia", "hypercholesterolaemia", "hypercholesterolemia",
        "hyperlipidaemia", "hyperlipidemia", "high cholesterol",
    ]
    static let cardiovascularTerms = [
        "ischaemic heart disease", "ischemic heart disease", "ihd", "coronary artery disease",
        "coronary heart disease", "angina", "myocardial infarction", "heart attack", "heart failure",
        "stroke", "metabolic syndrome", "peripheral arterial disease", "peripheral vascular disease",
    ]

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

    static let idfDarSource =
        "IDF-DAR Diabetes and Ramadan: Practical Guidelines 2021 (cited in the practice evidence briefing, Sept 2026, §4)"
    static let briefingFastingSource = "Practice evidence briefing (Dr D. D. Kabiye, Sept 2026), §4 — Ramadan and Orthodox fasting"
    static let briefingSleepSource = "Practice evidence briefing (Dr D. D. Kabiye, Sept 2026), §4 and §8 — sleep, circadian timing and protected rest"

    enum PromptText {
        static let fastingInsulin = "Fasting with insulin/sulfonylurea: risk of hypoglycaemia and dehydration — pre-fast risk stratification and medication review recommended (IDF-DAR 2021)."
        static let fastingDiabetes = "Fasting with diabetes: risk of hypoglycaemia and dehydration — pre-fast risk stratification recommended (IDF-DAR 2021)."
        static let fastingPeriop = "Religious fast overlaps the pre-operative fast — check hydration and glucose plan."
        static let nightShiftSleep = "Night-shift work / short sleep is associated with metabolic, cardiovascular and mood disorders."
    }

    /// Clinician-facing prompts, most serious first. Dismissible; they change nothing by themselves.
    static func safetyPrompts(_ ctx: Context) -> [Prompt] {
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
    enum EvidenceGrade: String {
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

    enum Sources {
        static let taiChi = "Huang ZG et al. Tai Chi for fall prevention and balance improvement in older adults: systematic review and meta-analysis of RCTs. Front Public Health 2023 (24 RCTs; falls RR 0.76)."
        static let yoga = "Saper RB et al. Yoga, physical therapy, or education for chronic low back pain: a randomized noninferiority trial. Ann Intern Med 2017;167:85-94."
        static let mbct = "Kuyken W et al. Efficacy of MBCT in prevention of depressive relapse: an individual patient data meta-analysis. JAMA Psychiatry 2016;73:565-74 (relapse HR 0.69)."
        static let slowBreathing = "Practice evidence briefing (Dr D. D. Kabiye, Sept 2026), §4 and §8 — slow breathing (no primary reference listed)."
        static let acupuncture = "Vickers AJ et al. Acupuncture for chronic pain: individual patient data meta-analysis. Arch Intern Med 2012; update J Pain 2018."
        static let timeRestricted = "Liu D et al. Calorie restriction with or without time-restricted eating in weight loss. N Engl J Med 2022;386:1495-1504."
        static let cuppingDetox = "Practice evidence briefing (Dr D. D. Kabiye, Sept 2026), §6 and §8 — cupping, detox teas, colon cleanses (no benefit)."
        static let ivDrips = "Practice evidence briefing (Dr D. D. Kabiye, Sept 2026), §6 — \"biohacking\" add-ons: IV vitamin drips (mixed)."
    }

    enum PlanLines {
        static let taiChi = "Non-drug: tai chi programme for balance and falls prevention (evidence: works — 24 RCTs, falls RR 0.76; Huang ZG et al. 2023)."
        static let yoga = "Non-drug: structured yoga programme for chronic non-specific low back pain (evidence: works — non-inferior to physical therapy; Saper RB et al., Ann Intern Med 2017)."
        static let mbct = "Referral option: mindfulness-based cognitive therapy (MBCT) for relapse prevention in recurrent depression (evidence: works — HR 0.69; Kuyken W et al., JAMA Psychiatry 2016)."
        static let slowBreathing = "Non-drug: slow breathing (about 6 breaths a minute) for short-term anxiety relief, e.g. before the procedure — not a treatment for high blood pressure (evidence: modest)."
        static let acupuncture = "Referral option: acupuncture for chronic pain (evidence: modest — small margin over sham; Vickers AJ et al., Arch Intern Med 2012)."
        static let timeRestricted = "Non-drug: time-restricted eating as an adherence strategy for weight management — weight loss similar to calorie restriction (evidence: modest; Liu D et al., NEJM 2022)."
        static let timeRestrictedDiabetesNote = "Diabetes on insulin/sulfonylurea: hypoglycaemia risk during fasting windows — pre-fast risk stratification and medication review recommended before starting (IDF-DAR 2021)."
        static let cupping = "Discussed cupping: no reliable evidence of benefit beyond placebo."
        static let detox = "Discussed detox teas / colon cleanses: no reliable evidence of benefit; risks of dehydration, electrolyte disturbance and laxative dependence."
        static let ivDrips = "Discussed IV vitamin drips: little outcome evidence outside a specific medical indication; risks of infection and fluid overload."
    }

    static let cuppingText = ["cupping", "hijama"]
    static let detoxText = ["detox", "cleanse", "colon cleanse", "colonic", "colonic irrigation"]
    static let ivDripText = ["iv drip", "iv vitamin", "vitamin drip", "drip therapy", "nad drip", "myers cocktail"]

    /// "31.3" / "32" (same output as the web `String(Math.round(bmi * 10) / 10)`).
    static func formatBMI(_ bmi: Double) -> String {
        String(format: "%g", (bmi * 10).rounded() / 10)
    }

    /// Evidence-graded non-drug suggestions, in a fixed order. Nothing is added to the plan until
    /// the clinician taps a suggestion.
    static func planSuggestions(_ ctx: Context) -> [Suggestion] {
        let h = ctx.lifestyle
        let f = findings(ctx)
        var out: [Suggestion] = []
        func uses(_ t: LifestyleHistory.Therapy) -> Bool { h.therapies.contains(t) }
        let otherText = h.therapiesOther

        if f.olderAdult || f.fallsOrFrailty {
            var reasons: [String] = []
            if f.olderAdult, let age = ctx.ageYears { reasons.append("Age \(age) (≥ \(olderAdultAge))") }
            if f.fallsOrFrailty { reasons.append("falls or frailty recorded") }
            if f.olderAdult && ctx.procedureBooked { reasons.append("post-operative rehabilitation") }
            out.append(Suggestion(id: "tai-chi", kind: .suggestion, practice: "Tai chi", evidence: .works,
                                  reason: reasons.joined(separator: "; "), planLine: PlanLines.taiChi,
                                  source: Sources.taiChi, alreadyUsed: uses(.taiChi)))
        }
        if f.backPain {
            out.append(Suggestion(id: "yoga", kind: .suggestion, practice: "Yoga", evidence: .works,
                                  reason: "Low back pain recorded (evidence is for chronic non-specific low back pain)",
                                  planLine: PlanLines.yoga, source: Sources.yoga, alreadyUsed: uses(.yoga)))
        }
        if f.depression {
            out.append(Suggestion(id: "mbct", kind: .suggestion, practice: "Mindfulness-based cognitive therapy (MBCT)",
                                  evidence: .works,
                                  reason: "Depression recorded (evidence is for relapse prevention in recurrent depression)",
                                  planLine: PlanLines.mbct, source: Sources.mbct, alreadyUsed: uses(.mindfulness)))
        }
        if f.anxiety {
            out.append(Suggestion(id: "slow-breathing", kind: .suggestion, practice: "Slow breathing (about 6 breaths a minute)",
                                  evidence: .modest,
                                  reason: ctx.procedureBooked ? "Anxiety recorded; procedure booked" : "Anxiety recorded",
                                  planLine: PlanLines.slowBreathing, source: Sources.slowBreathing,
                                  alreadyUsed: uses(.slowBreathing)))
        }
        if f.chronicPain {
            out.append(Suggestion(id: "acupuncture", kind: .suggestion, practice: "Acupuncture", evidence: .modest,
                                  reason: "Back or neck pain, osteoarthritis or chronic headache recorded (evidence is for chronic pain)",
                                  planLine: PlanLines.acupuncture, source: Sources.acupuncture, alreadyUsed: uses(.acupuncture)))
        }
        if f.obesity {
            let withNote = f.diabetes && f.insulinOrSulfonylurea
            let reason: String
            if let bmi = ctx.bmi, bmi >= obesityBMI {
                reason = "BMI \(formatBMI(bmi)) (≥ \(Int(obesityBMI)))"
            } else {
                reason = "Obesity recorded"
            }
            out.append(Suggestion(id: "time-restricted-eating", kind: .suggestion, practice: "Time-restricted eating",
                                  evidence: .modest, reason: reason,
                                  planLine: withNote ? "\(PlanLines.timeRestricted) \(PlanLines.timeRestrictedDiabetesNote)" : PlanLines.timeRestricted,
                                  source: withNote ? "\(Sources.timeRestricted) \(idfDarSource)" : Sources.timeRestricted,
                                  alreadyUsed: h.fasting.contains(.timeRestricted)))
        }

        // "No benefit shown" information: only when the patient's record lists the practice.
        if uses(.cupping) || anyTerm(otherText, cuppingText) {
            out.append(Suggestion(id: "counsel-cupping", kind: .counsel, practice: "Cupping", evidence: .noBenefit,
                                  reason: "Cupping recorded", planLine: PlanLines.cupping,
                                  source: Sources.cuppingDetox, alreadyUsed: true))
        }
        if h.usesDetoxOrCleanse || anyTerm(otherText, detoxText) {
            out.append(Suggestion(id: "counsel-detox", kind: .counsel, practice: "Detox teas and colon cleanses",
                                  evidence: .noBenefit, reason: "Detox or cleanse programme recorded",
                                  planLine: PlanLines.detox, source: Sources.cuppingDetox, alreadyUsed: true))
        }
        if h.usesIvVitaminDrips || anyTerm(otherText, ivDripText) {
            out.append(Suggestion(id: "counsel-iv-drips", kind: .counsel, practice: "IV vitamin drips", evidence: .mixed,
                                  reason: "IV vitamin drips recorded", planLine: PlanLines.ivDrips,
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
