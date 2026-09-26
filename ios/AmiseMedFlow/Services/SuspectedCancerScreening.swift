// SuspectedCancerScreening.swift
// NICE NG12 suspected-cancer (2-week-wait) criteria and the BSG 2021 iron-deficiency-anaemia rule,
// from the complaint, the clinician's text and lab values. Pure and deterministic: no AI, no network.
//
// DRIFT NOTE — Swift twin of the web `screenForCancer` / `readCancerScreenLabs`
// (lib/triage-engine/src/cancer-screening.ts, CANCER_SCREENING_VERSION 1.1.0, registry entry
// `cancer-screening`) and of the consultation prompt built from it
// (artifacts/dashboard/src/lib/preventive-screening-prompts.ts `suspectedCancerPrompts`). Same
// rules, thresholds, rule texts, guideline labels and investigations; change both together.
// Test vectors: AmiseMedFlowTests/SuspectedCancerScreeningTests.swift mirror
// artifacts/api-server/src/test/cancer-screening-ng12.test.ts. The iOS registry entry is
// `ios-suspected-cancer-screening` (clinical-content/registry.json), `rulesVersion` below.
//
// Free text goes through NegationMatcher (the twin of negation.ts): "no rectal bleeding" does not
// count. Lab names are matched whole-word with LabNameMatch ("HbA1c" is not Hb). Every citation is
// unverified until the surgeon checks it. Nothing here orders a test or a referral: the
// consultation shows a dismissible card and the clinician decides.

import Foundation

/// Lab values the lab-driven rules read. Hb in g/dL, ferritin in µg/L, MCV in fL, FIT in µg Hb/g
/// faeces. `fitPositive` is set when a FIT is recorded as positive/negative without a number.
struct CancerScreenLabs: Equatable {
    var haemoglobinGdl: Double? = nil
    var ferritinUgL: Double? = nil
    var mcvFl: Double? = nil
    var fitUgHbG: Double? = nil
    var fitPositive: Bool? = nil
}

struct CancerCriterion: Equatable {
    enum Pathway: String { case twoWeekWait = "two_week_wait", urgent }
    let rule: String
    let met: Bool
    let guideline: String
    /// nil = NG12 suspected-cancer (2-week-wait) referral.
    var pathway: Pathway? = nil
    /// Set on the 1.1.0 rules (the red flags and lab results easy to miss).
    var id: String? = nil
    var site: String? = nil
    var investigations: [String] = []
}

struct CancerScreenResult {
    enum Urgency: String { case twoWeekWait = "two_week_wait", urgent, none }
    let triggered: Bool
    let criteria: [CancerCriterion]
    let referralUrgency: Urgency
    let recommendedInvestigation: [String]
    let cancerType: String?

    var metCriteria: [CancerCriterion] { criteria.filter(\.met) }
}

struct CancerScreenInput {
    var age: Int?
    var sex: Sex
    /// Complaint text or chip ids ("rectal_bleeding", "weight_loss"), one per item.
    var chiefComplaints: [String] = []
    /// Symptom chips, one per item.
    var symptoms: [String] = []
    var familyHistory: [String] = []
    /// Questionnaire answers by key ("rectal_bleeding_character", "nipple_discharge_type", …).
    var responses: [String: String] = [:]
    /// Clinician free text (HPI, exam, assessment): read by the 1.1.0 rules only.
    var freeText: String = ""
    var labs: CancerScreenLabs = CancerScreenLabs()
}

enum SuspectedCancerScreening {

    /// Same number as the web CANCER_SCREENING_VERSION this twin follows (registry
    /// `ios-suspected-cancer-screening`). Bump with a registry changelog entry.
    static let rulesVersion = "1.1.0"

    // MARK: - Lab reading (readCancerScreenLabs)

    static let haemoglobinKeywords = ["haemoglobin", "hemoglobin", "hgb", "hb"]
    static let ferritinKeywords = ["ferritin", "serum ferritin"]
    static let mcvKeywords = ["mcv", "mean cell volume", "mean corpuscular volume"]
    static let fitKeywords = ["fit", "qfit", "faecal immunochemical", "fecal immunochemical",
                              "stool fit", "faecal fit", "fecal fit"]

    /// Reads Hb, ferritin, MCV and FIT from (name, result text) pairs, latest first: the first
    /// match of each analyte wins. Whole-word names; Hb above 25 or written in g/L → g/dL.
    static func readLabs(_ results: [(name: String, result: String)]) -> CancerScreenLabs {
        var out = CancerScreenLabs()
        for (name, raw) in results {
            let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !value.isEmpty else { continue }
            let words = LabNameMatch.words(of: name)
            let lowerName = name.lowercased()
            if out.haemoglobinGdl == nil, LabNameMatch.matchesAny(words, haemoglobinKeywords),
               !["a1c", "glyc", "electrophoresis", "hplc", "urine", "dipstick"].contains(where: { lowerName.contains($0) }) {
                if let n = firstNumber(value), n > 0 {
                    let gPerL = matches(#"g\s*/\s*l\b"#, value) && !matches(#"g\s*/\s*dl"#, value)
                    out.haemoglobinGdl = gPerL || n > 25 ? n / 10 : n
                }
            } else if out.ferritinUgL == nil, LabNameMatch.matchesAny(words, ferritinKeywords) {
                out.ferritinUgL = firstNumber(value)
            } else if out.mcvFl == nil, LabNameMatch.matchesAny(words, mcvKeywords) {
                out.mcvFl = firstNumber(value)
            } else if out.fitUgHbG == nil, out.fitPositive == nil, LabNameMatch.matchesAny(words, fitKeywords) {
                if let n = firstNumber(value) {
                    out.fitUgHbG = matches(#"(<|less than|below)\s*\d"#, value) ? max(0, n - 0.1) : n
                } else if matches(#"\bnot detected\b|\bnegative\b"#, value) {
                    out.fitPositive = false
                } else if matches(#"\bpositive\b|\bdetected\b"#, value) {
                    out.fitPositive = true
                }
            }
        }
        return out
    }

    /// Resulted lab entries of the patient (imaging / endoscopy narratives excluded), latest first.
    static func readLabs(patient p: Patient) -> CancerScreenLabs {
        let entries = p.investigations
            .filter { $0.status == .resulted && $0.category.holdsLabValues && !$0.result.isEmpty }
            .sorted { ($0.resultedAt ?? $0.orderedAt) > ($1.resultedAt ?? $1.orderedAt) }
        return readLabs(entries.map { (name: $0.name, result: $0.result) })
    }

    /// WHO / BSG 2021: Hb < 13.0 g/dL (men), < 12.0 g/dL (women; also when sex is unknown).
    static func isAnaemic(_ hbGdl: Double?, sex: Sex) -> Bool {
        guard let hb = hbGdl else { return false }
        return hb < (sex == .male ? 13.0 : 12.0)
    }

    /// Anaemia plus serum ferritin < 45 µg/L (BSG 2021).
    static func hasLabIronDeficiencyAnaemia(_ labs: CancerScreenLabs, sex: Sex) -> Bool {
        guard let f = labs.ferritinUgL else { return false }
        return isAnaemic(labs.haemoglobinGdl, sex: sex) && f < 45
    }

    /// FIT ≥ 10 µg Hb/g faeces (NICE DG56 2023; BSG/ACPGBI 2022), or recorded positive.
    static func isFitPositive(_ labs: CancerScreenLabs) -> Bool {
        if let n = labs.fitUgHbG { return n >= 10 }
        return labs.fitPositive == true
    }

    // MARK: - NG12 criteria (screenForCancer)

    // swiftlint:disable:next function_body_length cyclomatic_complexity
    static func screen(_ input: CancerScreenInput) -> CancerScreenResult {
        var criteria: [CancerCriterion] = []
        var investigations: [String] = []
        var cancerType: String? = nil
        let age = input.age ?? 0
        let cc = input.chiefComplaints.map { $0.lowercased() }
        let sx = input.symptoms.map { $0.lowercased() }
        let all = NegationMatcher.Source(NegationMatcher.joinClauses((cc + sx).map { Optional($0) }))
        let text = NegationMatcher.Source(NegationMatcher.joinClauses((cc + sx + [input.freeText]).map { Optional($0) }))
        let fhx = NegationMatcher.Source(NegationMatcher.joinClauses(input.familyHistory.map { Optional($0.lowercased()) }))
        let r = input.responses
        let labs = input.labs
        let sex = input.sex
        func t(_ pattern: String, _ s: NegationMatcher.Source) -> Bool {
            guard let re = regex(pattern) else { return false }
            return s.matches(re)
        }

        // --- Colorectal ---
        let hasRectalBleeding = cc.contains("rectal_bleeding") || t("rectal bleed|blood in stool|pr bleed", all)
        let hasBowelChange = cc.contains("change_in_bowel_habit") || t("bowel habit change|alternating", all)
        let hasDarkStool = r["rectal_bleeding_character"] == "dark_tarry"
        let hasWeightLoss = cc.contains("weight_loss") || t("weight loss", all)
        let hasIronDeficiency = t("anaemia|pale|unusually tired", all)
        let hasFhxCRC = t("bowel|colon|colorectal|rectal", fhx)
        let txRectalBleeding = hasRectalBleeding
            || t(#"\b(rectal bleed(ing)?|bleeding per rectum|blood (in|mixed with|on) (the )?(stools?|faeces|feces)|bright red blood|haematochezia|hematochezia|pr bleed(ing)?)\b"#, text)
        let txWeightLoss = hasWeightLoss || t(#"\b(weight loss|losing weight|lost \d+(\.\d+)? ?(kg|lb|kilos?|pounds))\b"#, text)
        let txAbdoPain = cc.contains("abdominal_pain")
            || t(#"\b(abdominal pain|abdominal discomfort|tummy pain|belly pain|abdominal cramps?|abdominal cramping)\b"#, text)
        let labIda = hasLabIronDeficiencyAnaemia(labs, sex: sex)
        let fitPositive = isFitPositive(labs)

        criteria.append(.init(rule: "Age >=40 with rectal bleeding AND change in bowel habit",
                              met: age >= 40 && hasRectalBleeding && hasBowelChange, guideline: "NICE NG12 1.3.1"))
        criteria.append(.init(rule: "Age >=60 with unexplained change in bowel habit",
                              met: age >= 60 && hasBowelChange, guideline: "NICE NG12 1.3.2"))
        criteria.append(.init(rule: "Age >=60 with iron deficiency anaemia",
                              met: age >= 60 && hasIronDeficiency, guideline: "NICE NG12 1.3.4"))
        criteria.append(.init(rule: "Dark tarry stool (melaena) at any age",
                              met: hasDarkStool, guideline: "BSG upper/lower GI bleed"))
        criteria.append(.init(rule: "Family history of colorectal cancer with GI symptoms",
                              met: hasFhxCRC && (hasRectalBleeding || hasBowelChange), guideline: "BSG polyp surveillance"))

        let lowerGi = ["Colonoscopy", "FBC with iron studies"]
        let idaInvestigations = ["Colonoscopy", "OGD (bidirectional endoscopy with colonoscopy)",
                                 "Coeliac serology (tTG-IgA)", "Urinalysis"]
        criteria.append(.init(rule: "Age >=50 with unexplained rectal bleeding", met: age >= 50 && txRectalBleeding,
                              guideline: "NICE NG12 1.3.1 (2015)",
                              id: "ng12-rectal-bleeding-50", site: "colorectal", investigations: lowerGi))
        criteria.append(.init(rule: "Age >=40 with unexplained weight loss AND abdominal pain (colorectal)",
                              met: age >= 40 && txWeightLoss && txAbdoPain, guideline: "NICE NG12 1.3.1 (2015)",
                              id: "ng12-weight-loss-abdominal-pain-40", site: "colorectal", investigations: lowerGi))
        criteria.append(.init(rule: "FIT >=10 µg Hb/g faeces (colorectal)", met: fitPositive,
                              guideline: "NICE DG56 (2023); BSG/ACPGBI FIT 2022",
                              id: "fit-10", site: "colorectal", investigations: lowerGi))
        criteria.append(.init(rule: "Age >=60 with iron deficiency anaemia on blood results (colorectal)",
                              met: age >= 60 && labIda, guideline: "NICE NG12 1.3.1 (2015); BSG 2021 IDA thresholds",
                              id: "ng12-ida-60", site: "colorectal / upper GI", investigations: idaInvestigations))
        criteria.append(.init(rule: "Iron deficiency anaemia in a man or a woman aged >=50: bidirectional endoscopy (colorectal / upper GI)",
                              met: labIda && age >= 18 && age < 60 && (sex == .male || age >= 50),
                              guideline: "BSG 2021 iron deficiency anaemia", pathway: .urgent,
                              id: "bsg-ida", site: "colorectal / upper GI", investigations: idaInvestigations))

        if criteria.contains(where: { c in c.met && ["colorectal", "bowel", "rectal", "tarry", "iron deficiency"].contains { c.rule.contains($0) } }) {
            cancerType = "colorectal"
            investigations += ["Colonoscopy", "FBC with iron studies", "CEA"]
            if hasDarkStool { investigations.append("OGD (to exclude upper GI source)") }
            if labIda { investigations += idaInvestigations }
        }

        // --- Upper GI ---
        let hasDysphagia = cc.contains("difficulty_swallowing") || t("dysphagia|swallowing", all)
        let hasAlarmGI = hasWeightLoss || hasDysphagia || t("loss of appetite|early satiety", all)
        criteria.append(.init(rule: "Age >=55 with weight loss AND upper abdominal symptoms or reflux",
                              met: age >= 55 && hasWeightLoss && t("reflux|heartburn|epigastric|abdominal pain|dyspepsia", all),
                              guideline: "NICE NG12 1.6.1"))
        criteria.append(.init(rule: "New dysphagia at any age", met: hasDysphagia, guideline: "NICE NG12 1.6.2"))
        criteria.append(.init(rule: "Age >=55 with treatment-resistant dyspepsia",
                              met: age >= 55 && t("reflux|heartburn|dyspepsia|acid", all) && hasAlarmGI,
                              guideline: "NICE NG12 1.6.3"))
        if criteria.contains(where: { c in c.met && ["dysphagia", "upper abdominal", "dyspepsia"].contains { c.rule.contains($0) } }) {
            cancerType = cancerType ?? "oesophago-gastric"
            investigations.append("OGD (oesophago-gastro-duodenoscopy)")
            if hasWeightLoss { investigations.append("CT abdomen/pelvis") }
        }

        // --- Breast ---
        let hasBreastLump = cc.contains("breast_concern") || cc.contains("lump_or_mass") || t("breast lump|breast mass", all)
        let hasNippleDischarge = t("bloody nipple|nipple discharge.*bloody", all) || r["nipple_discharge_type"] == "bloody"
        let hasSkinChanges = t("dimpling|puckering|skin changes.*breast|peau d.orange", all) || r["skin_changes"] == "true"
        let hasBreastFhx = t("breast|ovarian|brca", fhx)
        let lumpGrowing = r["breast_lump_change"] == "getting_larger"
        let nippleChange = cc.contains("nipple_discharge") || !(r["nipple_discharge_type"] ?? "").isEmpty
            || t(#"\b(nipple discharge|discharge from (the |her |his |my )?(left |right )?nipple|bloody nipple|blood-stained (nipple )?discharge|nipple (retraction|inversion|change|eczema|crusting)|(retracted|inverted) nipple)\b"#, text)
        let nippleBilateral = t(#"\bbilateral\b[^.]{0,30}\bnipple|\bnipple[^.]{0,30}\b(bilateral|both (breasts|nipples|sides))\b"#, text)

        criteria.append(.init(rule: "Age >=30 with unexplained breast lump", met: age >= 30 && hasBreastLump, guideline: "NICE NG12 1.8.1"))
        criteria.append(.init(rule: "Breast lump with skin changes or bloody nipple discharge",
                              met: hasBreastLump && (hasSkinChanges || hasNippleDischarge), guideline: "NICE NG12 1.8.2"))
        criteria.append(.init(rule: "Breast lump getting larger", met: hasBreastLump && lumpGrowing, guideline: "NICE NG12 1.8.3"))
        let bloodyNippleDischarge = hasNippleDischarge
            || t(#"\b(blood[- ]stained|bloody|haemoserous|serosanguinous)\b[^.]{0,30}\b(nipple|discharge)\b"#, text)
        let ductExcision = "Microdochectomy / duct excision if imaging is normal"
        criteria.append(.init(rule: "Age >=50 with discharge, retraction or other change in one nipple (breast)",
                              met: age >= 50 && nippleChange && !nippleBilateral, guideline: "NICE NG12 1.8.1 (2015)",
                              id: "ng12-nipple-50", site: "breast",
                              investigations: ["Mammogram", "Breast ultrasound"] + (bloodyNippleDischarge ? [ductExcision] : [])))
        if criteria.contains(where: { $0.met && $0.rule.lowercased().contains("breast") }) {
            cancerType = cancerType ?? "breast"
            investigations += ["Breast ultrasound", "Mammogram"]
            if bloodyNippleDischarge {
                investigations.append("Ductogram or MRI breast")
                if nippleChange { investigations.append(ductExcision) }
            }
            if hasBreastFhx { investigations.append("BRCA risk assessment") }
        }

        // --- Pancreatic ---
        let hasJaundice = cc.contains("jaundice") || t("jaundice|yellow", all)
        criteria.append(.init(rule: "Age >=40 with jaundice", met: age >= 40 && hasJaundice, guideline: "NICE NG12 1.10.1"))
        criteria.append(.init(rule: "Unexplained weight loss with new-onset back or epigastric pain",
                              met: hasWeightLoss && t("back pain|epigastric", all), guideline: "NICE NG12 1.10.2"))
        if criteria.contains(where: { $0.met && ($0.rule.contains("jaundice") || $0.rule.contains("epigastric pain")) }) {
            cancerType = cancerType ?? "pancreatic"
            investigations += ["CT pancreas protocol", "LFTs", "CA 19-9"]
            if hasJaundice { investigations.append("MRCP or ERCP") }
        }

        // --- Bladder / renal (NICE NG12 1.6, 2015) ---
        let visibleHaematuria = cc.contains("haematuria") || cc.contains("blood_in_urine")
            || t(#"\b(haematuria|hematuria|blood in (the |his |her |my )?urine|red urine|passing blood in (the )?urine)\b"#, text)
        let nonVisibleOnly = t(#"\b(non-visible|nonvisible|microscopic|dipstick) (haematuria|hematuria)\b"#, text)
            && !t(#"\b(visible|frank|macroscopic|gross) (haematuria|hematuria)\b"#, text)
        let haematuriaExplained = t(#"\b(uti|urinary tract infection|cystitis|dysuria|loin pain|flank pain|renal colic|ureteric colic|kidney stones?|renal stones?|ureteric stones?|urolithiasis|calculus|calculi)\b"#, text)
        let urological = ["Cystoscopy", "CT urogram", "Urine culture (exclude UTI)", "U&E / eGFR"]
        criteria.append(.init(rule: "Age >=45 with unexplained visible haematuria (urological)",
                              met: age >= 45 && visibleHaematuria && !nonVisibleOnly && !haematuriaExplained,
                              guideline: "NICE NG12 1.6 (2015) bladder cancer",
                              id: "ng12-haematuria-45", site: "urological", investigations: urological))
        if criteria.contains(where: { $0.met && $0.rule.contains("haematuria") }) {
            cancerType = cancerType ?? "urological"
            investigations += urological
        }

        let met = criteria.filter(\.met)
        let urgency: CancerScreenResult.Urgency = met.contains { ($0.pathway ?? .twoWeekWait) == .twoWeekWait }
            ? .twoWeekWait : (met.isEmpty ? .none : .urgent)
        var seen = Set<String>()
        return CancerScreenResult(triggered: !met.isEmpty, criteria: criteria, referralUrgency: urgency,
                                  recommendedInvestigation: investigations.filter { seen.insert($0).inserted },
                                  cancerType: cancerType)
    }

    // MARK: - Helpers

    /// Case-insensitive pattern; nil (never matches) if invalid. Compiled per call: a screen runs
    /// a few dozen short patterns once per refresh.
    private static func regex(_ pattern: String) -> NSRegularExpression? {
        try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
    }

    /// Plain (not negation-aware) case-insensitive test, for lab result text.
    private static func matches(_ pattern: String, _ s: String) -> Bool {
        guard let re = regex(pattern) else { return false }
        return re.firstMatch(in: s, range: NSRange(location: 0, length: (s as NSString).length)) != nil
    }

    /// First number in a result ("9.4 g/dL" → 9.4, "1,234" → 1234, "< 10" → 10).
    static func firstNumber(_ value: String) -> Double? {
        let s = value.replacingOccurrences(of: ",", with: "")
        guard let re = regex(#"-?\d+(?:\.\d+)?"#),
              let m = re.firstMatch(in: s, range: NSRange(location: 0, length: (s as NSString).length)) else { return nil }
        return Double((s as NSString).substring(with: m.range))
    }
}
