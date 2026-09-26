// PatientScoreAutoPopulator+DecisionRules.swift
// Pre-fill for the decision-rule calculators (ClinicalScoringEngine+DecisionRules*.swift). Twin of the
// web `prefill` functions (artifacts/dashboard/src/lib/decision-rule-scores.ts, RULE_SPECS): the same
// items are read from the same kinds of evidence, with the same regular expressions, negation-aware
// (NegationMatcher: "no midline tenderness" does not tick midline tenderness).
//
// Only what the record shows is ticked, and every ticked item is marked auto (the form shows
// "from record"). Nothing is assumed normal: an unmarked item was not recorded, and the clinician
// reviews every item before saving. No AI, no network.

import Foundation

/// The history, examination and resulted-investigation text of the record, read negation-aware
/// (the web's RuleRecord.text + recordHas).
struct DecisionRuleRecordText {
    let source: NegationMatcher.Source

    init(_ p: Patient) {
        let results = p.investigations
            .filter { $0.status == .resulted && !$0.result.isEmpty }
            .map { "\($0.name): \($0.result)" }
        source = NegationMatcher.Source(NegationMatcher.joinClauses(
            [p.chiefComplaint, p.hpi, p.examGeneral, p.examAbdo, p.examCVS, p.examResp, p.examNeuro,
             p.examMSK, p.examSkin, p.examOther, p.workingDiagnosis, p.assessmentText, p.pmhNotes]
            + p.pmhEntries.map { Optional($0.condition) }
            + results.map { Optional($0) }))
    }

    init(text: String) {
        source = NegationMatcher.Source(text)
    }

    /// True when `pattern` (case-insensitive) matches somewhere it is not negated.
    func has(_ pattern: String) -> Bool {
        guard let re = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return false }
        return source.matches(re)
    }
}

extension PatientScoreAutoPopulator {

    // The web's regular expressions (decision-rule-scores.ts), unchanged.
    static let unableToBearWeightPattern = #"\b(unable|cannot|can't|could not|couldn't) (to )?(bear weight|weight[- ]bear|walk)\b"#
    static let lateralMalleolusPattern = #"\b(tender\w*)\b[^.]{0,30}\blateral malleol\w*"#
    static let medialMalleolusPattern = #"\b(tender\w*)\b[^.]{0,30}\bmedial malleol\w*"#
    static let fifthMetatarsalPattern = #"\b(tender\w*)\b[^.]{0,40}\b(fifth|5th) metatarsal"#
    static let navicularPattern = #"\b(tender\w*)\b[^.]{0,30}\bnavicular"#
    static let repeatedVomitingPattern = #"\b(vomited|vomiting)\b[^.]{0,20}\b(twice|two|three|several|repeated\w*)\b|\brepeated vomiting\b"#
    static let basalSkullFracturePattern = #"\b(battle'?s sign|raccoon eyes|panda eyes|haemotympanum|hemotympanum|csf (otorrh|rhinorrh)\w*)"#
    static let midlineCervicalTendernessPattern = #"\bmidline (cervical |neck |c-spine )?tender\w*"#
    static let intoxicationPattern = #"\b(intoxicat\w*|drunk|smells? of alcohol)\b"#
    static let paraesthesiaPattern = #"\b(paraesthesi\w*|paresthesi\w*|tingling|pins and needles)\b"#
    static let vomitingPattern = #"\bvomit\w*"#
    static let nauseaPattern = #"\bnause\w*"#
    static let haematuriaPattern = #"\b(ha?ematuria|blood in (the )?urine|dipstick[^.]{0,20}blood)\b"#
    static let heartFailurePattern = #"\b(heart failure|ccf|chf|lvsd)\b"#
    static let breathlessPattern = #"\b(short(ness)? of breath|breathless\w*|dyspnoea|dyspnea)\b"#
    static let heartDiseasePattern = #"\b(ischaemic heart disease|ihd|heart failure|atrial fibrillation|myocardial infarction|valve disease|cardiomyopathy)\b"#

    /// Age in years from the date of birth, or nil when it is not recorded.
    private static func recordedAge(_ p: Patient) -> Int? {
        p.dateOfBirth == nil ? nil : p.ageYears
    }

    // MARK: - STONE (ureteric stone)

    static func stoneUreteric(patient p: Patient) -> (ClinicalScoringEngine.STONEUretericInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.STONEUretericInput()
        var f = ScoreAutoFill()
        f.isAttempted = true
        let t = DecisionRuleRecordText(p)
        if p.sex == .male { i.male = true; f.addAutoFilled(key: "male") }
        if t.has(vomitingPattern) {
            i.nausea = 2; f.addAutoFilled(key: "nausea")
        } else if t.has(nauseaPattern) {
            i.nausea = 1; f.addAutoFilled(key: "nausea")
        }
        if t.has(haematuriaPattern) { i.haematuria = true; f.addAutoFilled(key: "haematuria") }
        return (i, f)
    }

    // MARK: - Ottawa ankle and knee

    static func ottawaAnkle(patient p: Patient) -> (ClinicalScoringEngine.OttawaAnkleInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.OttawaAnkleInput()
        var f = ScoreAutoFill()
        f.isAttempted = true
        let t = DecisionRuleRecordText(p)
        if t.has(lateralMalleolusPattern) { i.lateralMalleolus = true; f.addAutoFilled(key: "lateralMalleolus") }
        if t.has(medialMalleolusPattern) { i.medialMalleolus = true; f.addAutoFilled(key: "medialMalleolus") }
        if t.has(fifthMetatarsalPattern) { i.fifthMetatarsalBase = true; f.addAutoFilled(key: "fifthMetatarsalBase") }
        if t.has(navicularPattern) { i.navicular = true; f.addAutoFilled(key: "navicular") }
        if t.has(unableToBearWeightPattern) { i.unableToBearWeight = true; f.addAutoFilled(key: "unableToBearWeight") }
        return (i, f)
    }

    static func ottawaKnee(patient p: Patient) -> (ClinicalScoringEngine.OttawaKneeInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.OttawaKneeInput()
        var f = ScoreAutoFill()
        f.isAttempted = true
        let t = DecisionRuleRecordText(p)
        if let age = recordedAge(p), age >= 55 { i.age55OrOver = true; f.addAutoFilled(key: "age55OrOver") }
        if t.has(unableToBearWeightPattern) { i.unableToBearWeight = true; f.addAutoFilled(key: "unableToBearWeight") }
        return (i, f)
    }

    // MARK: - Head and neck injury

    static func canadianCTHead(patient p: Patient) -> (ClinicalScoringEngine.CanadianCTHeadInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.CanadianCTHeadInput()
        var f = ScoreAutoFill()
        f.isAttempted = true
        let t = DecisionRuleRecordText(p)
        if let age = recordedAge(p), age >= 65 { i.age65OrOver = true; f.addAutoFilled(key: "age65OrOver") }
        if t.has(repeatedVomitingPattern) { i.vomitingTwiceOrMore = true; f.addAutoFilled(key: "vomitingTwiceOrMore") }
        if t.has(basalSkullFracturePattern) { i.basalSkullFractureSign = true; f.addAutoFilled(key: "basalSkullFractureSign") }
        return (i, f)
    }

    static func nexus(patient p: Patient) -> (ClinicalScoringEngine.NEXUSInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.NEXUSInput()
        var f = ScoreAutoFill()
        f.isAttempted = true
        let t = DecisionRuleRecordText(p)
        if t.has(midlineCervicalTendernessPattern) { i.midlineTenderness = true; f.addAutoFilled(key: "midlineTenderness") }
        if t.has(intoxicationPattern) { i.intoxication = true; f.addAutoFilled(key: "intoxication") }
        return (i, f)
    }

    static func canadianCSpine(patient p: Patient) -> (ClinicalScoringEngine.CanadianCSpineInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.CanadianCSpineInput()
        var f = ScoreAutoFill()
        f.isAttempted = true
        let t = DecisionRuleRecordText(p)
        if let age = recordedAge(p), age >= 65 { i.age65OrOver = true; f.addAutoFilled(key: "age65OrOver") }
        if t.has(paraesthesiaPattern) { i.paraesthesiaInExtremities = true; f.addAutoFilled(key: "paraesthesiaInExtremities") }
        return (i, f)
    }

    // MARK: - Syncope

    static func sfSyncope(patient p: Patient) -> (ClinicalScoringEngine.SanFranciscoSyncopeInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.SanFranciscoSyncopeInput()
        var f = ScoreAutoFill()
        f.isAttempted = true
        let t = DecisionRuleRecordText(p)
        if t.has(heartFailurePattern) { i.congestiveHeartFailure = true; f.addAutoFilled(key: "congestiveHeartFailure") }
        if t.has(breathlessPattern) { i.shortnessOfBreath = true; f.addAutoFilled(key: "shortnessOfBreath") }
        if let sbp = p.latestVitals?.bpSystolic, sbp < 90 { i.systolicBelow90 = true; f.addAutoFilled(key: "systolicBelow90") }
        return (i, f)
    }

    static func canadianSyncope(patient p: Patient) -> (ClinicalScoringEngine.CanadianSyncopeInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.CanadianSyncopeInput()
        var f = ScoreAutoFill()
        f.isAttempted = true
        let t = DecisionRuleRecordText(p)
        if t.has(heartDiseasePattern) { i.heartDisease = true; f.addAutoFilled(key: "heartDisease") }
        if let sbp = p.latestVitals?.bpSystolic, sbp < 90 || sbp > 180 {
            i.abnormalSystolic = true; f.addAutoFilled(key: "abnormalSystolic")
        }
        return (i, f)
    }
}
