import Foundation

// MARK: - Pregnancy context (read from the record text)
//
// The iOS Patient has no pregnancy field, so pregnancy is read from what the clinician wrote:
// chief complaint, HPI, PMH, social history, examination and assessment ("32 weeks pregnant",
// "G2P1 at 22 weeks", "Primigravida at 34 weeks", "Pregnancy (29 weeks)", "positive pregnancy
// test"). Matching is negation-aware (NegationMatcher): "not pregnant", "pregnancy test negative"
// and "no chance of pregnancy" do not count. Deterministic; never inferred from age or sex alone.
//
// Used by ClinicalAcuityEngine (NICE NG133 blood-pressure thresholds, obstetric recognition) and
// RadiationSafetyFilter (pregnancy-unsafe drugs and imaging on the plan cards). When nothing is
// written the status is `.notDocumented`: callers treat that as "pregnancy not excluded" only
// where a guideline asks for a pregnancy test (women 12–55), never as "not pregnant".

struct PregnancyContext: Equatable {
    enum Status: Equatable {
        case pregnant
        case notDocumented
    }

    let status: Status
    /// Completed weeks of gestation when written ("32 weeks", "34+2 weeks"), else nil.
    let gestationWeeks: Int?

    var isPregnant: Bool { status == .pregnant }

    /// NICE NG133 / MHRA: NSAIDs are avoided from 20 weeks. Unknown gestation in a pregnant woman
    /// is treated as ≥ 20 weeks (the conservative reading).
    var atOrBeyond20Weeks: Bool { isPregnant && (gestationWeeks ?? 20) >= 20 }

    static let none = PregnancyContext(status: .notDocumented, gestationWeeks: nil)

    // MARK: Detection

    private static let pregnancyTerms = [
        "pregnant", "in pregnancy", "during pregnancy", "this pregnancy", "first pregnancy", "second pregnancy",
        "third pregnancy", "primigravida", "multigravida", "gravid uterus", "weeks' gestation", "weeks gestation",
        "weeks of gestation", "antenatal", "positive pregnancy test", "pregnancy test positive",
        "urine hcg positive", "hcg positive", "positive hcg", "intrauterine pregnancy",
    ]

    private static let obstetricNotation = try? NSRegularExpression(
        pattern: #"\bg\d+\s*p\d+\b|\bg\d+\b\s+at\s+\d{1,2}\s*(?:\+\s*\d\s*)?weeks|\bpregnancy\s*\(\s*\d{1,2}\s*weeks"#,
        options: [.caseInsensitive])

    private static let gestationPattern = try? NSRegularExpression(
        pattern: #"(\d{1,2})\s*(?:\+\s*\d\s*)?(?:weeks?|wks?)'?\s*(?:pregnant|gestation|of gestation|by dates|\))?"#,
        options: [.caseInsensitive])

    private static let wordNumbers: [String: Int] = [
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13,
        "fourteen": 14, "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
        "twenty": 20, "twenty-one": 21, "twenty-two": 22, "twenty-three": 23, "twenty-four": 24,
        "twenty-five": 25, "twenty-six": 26, "twenty-seven": 27, "twenty-eight": 28, "twenty-nine": 29,
        "thirty": 30, "thirty-one": 31, "thirty-two": 32, "thirty-three": 33, "thirty-four": 34,
        "thirty-five": 35, "thirty-six": 36, "thirty-seven": 37, "thirty-eight": 38, "thirty-nine": 39,
        "forty": 40,
    ]

    /// Reads pregnancy from free-text fields. `sex` other than female, or an age outside 10–60,
    /// never gives "pregnant".
    static func detect(texts: [String?], sex: Sex, ageYears: Int?) -> PregnancyContext {
        guard sex == .female else { return .none }
        if let age = ageYears, age < 10 || age > 60 { return .none }
        let joined = NegationMatcher.joinClauses(texts)
        guard !joined.isEmpty else { return .none }
        // Sentence by sentence: a past pregnancy ("gestational diabetes during her last
        // pregnancy", "previous pregnancy 2019", "postpartum") is not a current one.
        let sentences = joined.components(separatedBy: CharacterSet(charactersIn: ".;\n"))
        var pregnant = false
        for sentence in sentences where !sentence.trimmingCharacters(in: .whitespaces).isEmpty {
            let lower = sentence.lowercased()
            if pastPregnancyWords.contains(where: { lower.contains($0) }) { continue }
            let source = NegationMatcher.Source(sentence)
            if source.containsAny(pregnancyTerms) || (obstetricNotation.map { source.matches($0) } ?? false) {
                pregnant = true
                break
            }
        }
        guard pregnant else { return .none }
        return PregnancyContext(status: .pregnant, gestationWeeks: gestation(in: joined.lowercased()))
    }

    private static let pastPregnancyWords = [
        "previous pregnan", "prior pregnan", "last pregnan", "past pregnan", "earlier pregnan", "postpartum",
        "post-partum", "after delivery", "since delivery", "history of", "years ago", "in 19", "in 20",
    ]

    static func detect(patient p: Patient) -> PregnancyContext {
        detect(texts: [p.chiefComplaint, p.hpi, p.pmhNotes, p.socialHistory, p.examGeneral, p.examAbdo,
                       p.examOther, p.assessmentText, p.workingDiagnosis] + p.pmhEntries.map { Optional($0.condition) },
               sex: p.sex, ageYears: p.dateOfBirth == nil ? nil : p.ageYears)
    }

    /// The first "N weeks" written in a sentence that talks about pregnancy or gestation.
    private static func gestation(in lower: String) -> Int? {
        let sentences = lower.components(separatedBy: CharacterSet(charactersIn: ".;\n"))
        let cue = ["pregnan", "gestation", "gravida", "g1", "g2", "g3", "g4", "g5", "weeks by dates", "antenatal"]
        for sentence in sentences where cue.contains(where: { sentence.contains($0) }) {
            let ns = sentence as NSString
            if let re = gestationPattern,
               let m = re.firstMatch(in: sentence, range: NSRange(location: 0, length: ns.length)),
               let weeks = Int(ns.substring(with: m.range(at: 1))), (4...43).contains(weeks) {
                return weeks
            }
            for (word, value) in wordNumbers.sorted(by: { $0.key.count > $1.key.count })
            where sentence.contains("\(word) weeks") {
                return value
            }
        }
        return nil
    }
}
