// BayesianDecisionEngine+Scoring.swift
// Score candidates against collected evidence; build ScoredCandidate.

import Foundation

extension BayesianDecisionEngine {

    // MARK: - Scoring

    /// "a|b&c": true when any "|" alternative has all of its "&" terms affirmed at a word start.
    static func anyAlternative(_ spec: String, in source: NegationMatcher.Source) -> Bool {
        alternatives(spec).contains { terms in terms.allSatisfy { source.contains($0, wordStart: true) } }
    }

    /// True when an alternative's terms are all mentioned but at least one is only ever negated.
    static func anyAlternativeDocumentedAbsent(_ spec: String, in source: NegationMatcher.Source) -> Bool {
        alternatives(spec).contains { terms in
            terms.allSatisfy { !source.occurrences(of: $0, wordStart: true).isEmpty } &&
                !terms.allSatisfy { source.contains($0, wordStart: true) }
        }
    }

    /// Text for "finding" / "findingAbsent" / "notFinding" features. A single term is looked
    /// for anywhere; the terms of an "a&b" alternative must all occur in one sentence, one result
    /// line or one chip, so "lipase&raised" cannot pair a "Lipase: 40" line with a "raised
    /// bilirubin" chip.
    struct FeatureText {
        let whole: NegationMatcher.Source
        let sentences: [NegationMatcher.Source]

        init(_ parts: [String]) {
            whole = NegationMatcher.Source(parts.joined(separator: " .\n "))
            sentences = parts.flatMap { FeatureText.sentenceSplit($0) }.map { NegationMatcher.Source($0) }
        }

        /// Splits at ". ", "; " and line breaks ("7.2" stays whole).
        static func sentenceSplit(_ text: String) -> [String] {
            text.replacingOccurrences(of: ". ", with: "\n")
                .replacingOccurrences(of: "; ", with: "\n")
                .split(separator: "\n")
                .map(String.init)
                .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        }
    }

    static func anyAlternative(_ spec: String, in text: FeatureText) -> Bool {
        alternatives(spec).contains { terms in
            terms.count == 1
                ? text.whole.contains(terms[0], wordStart: true)
                : text.sentences.contains { s in terms.allSatisfy { s.contains($0, wordStart: true) } }
        }
    }

    /// True when no alternative is affirmed and one of them is mentioned (in one sentence, for
    /// an "a&b" alternative) only as negated: "no neck stiffness", "D-dimer negative".
    static func anyAlternativeDocumentedAbsent(_ spec: String, in text: FeatureText) -> Bool {
        guard !anyAlternative(spec, in: text) else { return false }
        return alternatives(spec).contains { terms in
            (terms.count == 1 ? [text.whole] : text.sentences).contains { s in
                terms.allSatisfy { !s.occurrences(of: $0, wordStart: true).isEmpty }
            }
        }
    }

    private static func alternatives(_ spec: String) -> [[String]] {
        spec.lowercased().split(separator: "|").map { alt in
            alt.split(separator: "&")
                .map(String.init)   // spaces are significant: "red " must not match "reduced"
                .filter { !$0.isEmpty }
        }.filter { !$0.isEmpty }
    }

    struct ScoredCandidate {
        let candidate: Candidate
        var logPosterior: Int
        var evidence: [String]
        var evidenceSources: [String: [String]] = [:]
        var pathognomicFindings: [String] = []   // features with logLR ≥ 18 that fired
        /// A "finding" / "inv" feature with logLR ≥ reportEvidenceMinLogLR matched a resulted
        /// report or an evidence chip (not only the history): infer() adds such a curated
        /// candidate even when the complaint's route did not bring it in.
        var reportEvidence = false
    }

    static func score(
        candidates: [Candidate],
        socrates: [String: Set<String>],
        pmh: String, pshx: String,
        examAbdo: String, examGeneral: String,
        examCVS: String = "", examResp: String = "",
        examNeuro: String = "", examMSK: String = "",
        examSkin: String = "", examOther: String = "",
        investigations: [InvestigationEntry],
        age: Int, sex: Sex,
        medications: [String] = [],
        socialText: String = "",
        bmi: Double? = nil,
        complaint: String = "",
        hpi: String = ""
    ) -> [ScoredCandidate] {
        // Free text (exam, PMH, PSHx, social history, resulted reports) is matched negation-aware
        // through NegationMatcher: "Murphy's sign negative", "no guarding", "No crepitus",
        // "no family history of …", "US: no gallstones" are not findings. Fields are joined with a
        // sentence break so a negation cannot reach into the next field; the spaces around it keep
        // space-delimited keywords (" htn", " dm ") matching at a field boundary as before.
        func clauses(_ parts: [String]) -> NegationMatcher.Source {
            NegationMatcher.Source(parts.joined(separator: " .\n "))
        }
        let pmhL = NegationMatcher.Source(pmh)
        let pshxL = NegationMatcher.Source(pshx)
        let examL = clauses([examAbdo, examGeneral, examCVS, examResp, examNeuro, examMSK, examSkin, examOther])
        let examGeneralL = NegationMatcher.Source(examGeneral)
        let examAbdoL = NegationMatcher.Source(examAbdo)
        let examCVSL = NegationMatcher.Source(examCVS)
        let invNames = investigations.map { $0.name.lowercased() }
        let invResults = investigations.filter { $0.status == .resulted }
            .map { $0.name.lowercased() + " " + $0.result.lowercased() }
        let invResultsL = invResults.map { NegationMatcher.Source($0) }
        let medsL = medications.map { $0.lowercased() }
        let socialL = NegationMatcher.Source(socialText)
        let chipTexts = socrates.values.flatMap { Array($0) }
        let associatedText = clauses([examAbdo, examGeneral, examCVS, examResp, examNeuro,
                                      examMSK, examSkin, examOther, pmh] + chipTexts)
        let historyText = clauses([pmh] + medsL + [socialText])
        let haemText = clauses([examAbdo, examGeneral, examOther])
        let skinText = clauses([examSkin, examGeneral])
        let hearText = clauses([examNeuro, examOther, examGeneral])
        let haemodynamicText = clauses([examGeneral, examCVS, examAbdo])
        let feverText = clauses([examGeneral, examAbdo])
        let weightLossText = clauses([examGeneral, pmh, socialText] + chipTexts)
        let headacheText = clauses(chipTexts + [examGeneral, examNeuro, examOther])
        let pmhSocialText = clauses([pmh, socialText])
        let locationText = clauses(invResults + [examAbdo, examGeneral])
        let bpText = clauses([examCVS, examGeneral])
        let broadRecordText = clauses([pmh, pshx, examAbdo, examGeneral, examCVS,
                                       examResp, examNeuro, examMSK, examSkin, examOther,
                                       socialText] + invResults + invNames + chipTexts)
        let complaintL = NegationMatcher.Source(complaint)
        let findingText = FeatureText([complaint, hpi, examAbdo, examGeneral, examCVS, examResp, examNeuro,
                                       examMSK, examSkin, examOther, pmh, pshx] + chipTexts + invResults)
        /// Resulted reports and evidence chips only (no history): what can add a diagnosis to the
        /// list by itself (ScoredCandidate.reportEvidence).
        let reportText = FeatureText(invResults + chipTexts)
        // Patient context (BayesianDiagnosisEngine+Context.swift): the post-operative day written in
        // the record ("postOpDay" features) and the masking contexts of negative features.
        let postOpDay = BayesianDiagnosisEngine.postOperativeDay([complaint, hpi, pshx, pmh])
        let maskingContexts = BayesianDiagnosisEngine.MaskingContext.active(
            age: age, sex: sex,
            record: NegationMatcher.Source(NegationMatcher.joinClauses(
                [complaint, hpi, examAbdo, examGeneral, examCVS, examResp, examNeuro, examMSK, examSkin, examOther, pmh, pshx])))
        /// Test for the words of one feature value, matched one by one. A value written as a
        /// negative ("absent pulse", "absent cremasteric reflex", "no transillumination") has the
        /// negation as its finding: its words are matched plainly, as before. Otherwise each word
        /// must occur un-negated.
        func wordTest(_ words: [String], _ text: NegationMatcher.Source) -> (String) -> Bool {
            if words.count > 1 && words.contains(where: { NegationMatcher.isNegationCue($0) }) {
                return { text.lower.contains($0) }
            }
            return { text.contains($0) }
        }

        return candidates.map { c in
            var logP = c.logPrior
            var evidence: [String] = []
            var evidenceSources: [String: [String]] = [:]
            var pathognomicFindings: [String] = []
            var reportEvidence = false

            // Pre-pass: collect DAG node IDs for features that have already fired,
            // so downstream correlated features receive CPT-based discounting.
            // Covers both canonical keys AND synonym keys so discounting fires for
            // specialist-pool features that use non-standard key names.
            var observedNetworkIDs = Set<String>()
            for f in c.features {
                guard let nid = Self.featureNetworkID(key: f.key, value: f.value) else { continue }
                let fired: Bool
                switch f.key {
                case "associations", "onset", "character", "radiation",
                     "timing", "exacerbating", "relieving", "severity", "site":
                    let sel = socrates[f.key] ?? []
                    fired = sel.contains(where: { $0.lowercased().contains(f.value.lowercased()) })
                case "associated":
                    // Synonym for "associations" — check against canonical associations set.
                    let sel = socrates["associations"] ?? []
                    let words = f.value.lowercased().split(separator: " ").map(String.init).filter { $0.count >= 4 }
                    fired = words.isEmpty
                        ? sel.contains(where: { $0.lowercased().contains(f.value.lowercased()) })
                        : words.allSatisfy { w in sel.contains(where: { $0.lowercased().contains(w) }) }
                case "exam":
                    let words = f.value.lowercased().split(separator: " ").map(String.init)
                    fired = words.allSatisfy(wordTest(words, examL))
                case "exam_general":
                    let words = f.value.lowercased().split(separator: " ").map(String.init)
                    fired = words.allSatisfy(wordTest(words, examGeneralL)) ||
                            words.allSatisfy(wordTest(words, examL))
                case "exam_abdo":
                    let words = f.value.lowercased().split(separator: " ").map(String.init)
                    fired = words.allSatisfy(wordTest(words, examAbdoL)) ||
                            words.allSatisfy(wordTest(words, examL))
                case "exam_cvs":
                    let words = f.value.lowercased().split(separator: " ").map(String.init)
                    fired = words.allSatisfy(wordTest(words, examCVSL)) ||
                            words.allSatisfy(wordTest(words, examL))
                default:
                    fired = false
                }
                if fired { observedNetworkIDs.insert(nid) }
            }

            // Helper: match a coded/free-text finding value against investigation results
            // filtered to a specific imaging or lab modality.
            func invModalityMatch(keywords: [String], finding: String) -> Bool {
                let fv = finding.lowercased().replacingOccurrences(of: "_", with: " ")
                let toks = fv.split(separator: " ").map(String.init).filter { $0.count >= 4 }
                let src = invResultsL.filter { r in keywords.contains(where: { r.lower.contains($0) }) }
                if toks.isEmpty { return src.contains(where: { $0.contains(fv) }) }
                return src.contains(where: { r in toks.filter { r.contains($0) }.count >= max(1, toks.count / 2) })
            }

            for f in c.features {
                var triggered = false
                var sourceKey = "other"
                switch f.key {
                case "onset", "site", "character", "radiation", "associations",
                     "timing", "exacerbating", "relieving", "severity":
                    let sel = socrates[f.key] ?? []
                    triggered = sel.contains(where: {
                        $0.lowercased().contains(f.value.lowercased())
                    })
                    sourceKey = "symptoms"
                case "exam":
                    // Space-separated value = all words must appear in exam text (AND logic).
                    let words = f.value.lowercased().split(separator: " ").map(String.init)
                    triggered = words.allSatisfy(wordTest(words, examL))
                    sourceKey = "exam"
                case "pmh":
                    triggered = pmhL.contains(f.value.lowercased())
                    sourceKey = "history"
                case "pshx":
                    triggered = pshxL.contains(f.value.lowercased())
                    sourceKey = "history"
                case "inv":
                    // First try exact substring match (fast path for short feature values).
                    // For multi-word values the exact phrase rarely survives abbreviation
                    // differences (e.g. "axr" vs "abdominal x-ray"), so fall back to a
                    // token match: every significant token (≥4 chars, not a stop-word) must
                    // appear, in any order, in one invNames or invResults entry
                    // (allSignificantTokens). The former 60% rule let "irregular gallbladder
                    // wall thickening" fire on "oedematous gallbladder wall thickening".
                    let fv = f.value.lowercased()
                    let stop: Set<String> = ["with","and","the","for","that","this","from","into","positive","negative","confirmed","elevated","raised","normal","abnormal","level","result"]
                    let fTokens = fv.split(separator: " ").map(String.init)
                        .filter { $0.count >= 4 && !stop.contains($0) }
                    let threshold = max(1, fTokens.count)
                    // Names are matched plainly (a test name is not a finding); report text
                    // negation-aware ("US: no gallstones").
                    func tokenMatch(_ has: (String) -> Bool) -> Bool {
                        has(fv) ||
                        (fTokens.count >= 2 && fTokens.filter { has($0) }.count >= threshold)
                    }
                    triggered = invNames.contains(where: { name in tokenMatch { name.contains($0) } }) ||
                                invResultsL.contains(where: { report in tokenMatch { report.contains($0) } })
                    sourceKey = "investigation"
                case "age_over":
                    if let threshold = Int(f.value) { triggered = age >= threshold }
                    sourceKey = "demographics"
                case "age_under":
                    if let threshold = Int(f.value) { triggered = age > 0 && age < threshold }
                    sourceKey = "demographics"
                case "sex_female":
                    triggered = sex == .female
                    sourceKey = "demographics"
                case "sex_male":
                    triggered = sex == .male
                    sourceKey = "demographics"
                case "med":
                    triggered = medsL.contains(where: { $0.contains(f.value.lowercased()) })
                    sourceKey = "history"
                case "social":
                    triggered = socialL.contains(f.value.lowercased())
                    sourceKey = "history"
                case "bmi_over":
                    if let threshold = Double(f.value), let bmiVal = bmi { triggered = bmiVal >= threshold }
                    sourceKey = "demographics"
                case "bmi_under":
                    if let threshold = Double(f.value), let bmiVal = bmi { triggered = bmiVal > 0 && bmiVal < threshold }
                    sourceKey = "demographics"

                // Non-standard DB key synonyms — aliases used in specialist pools that
                // are semantically equivalent to standard keys but named differently.
                case "associated":
                    // Free-text association phrases; match against all clinical text.
                    let broadText = associatedText
                    let words = f.value.lowercased().split(separator: " ").map(String.init)
                        .filter { $0.count >= 4 }
                    triggered = words.isEmpty ? broadText.contains(f.value.lowercased())
                               : words.allSatisfy(wordTest(words, broadText))
                    sourceKey = "symptoms"

                case "investigations":
                    // Synonym for "inv" — matches against investigation names + results.
                    let fv = f.value.lowercased()
                    let stop2: Set<String> = ["with","and","the","for","that","this","from","into","positive","negative","confirmed","elevated","raised","normal","abnormal","level","result"]
                    let fTok = fv.split(separator: " ").map(String.init).filter { $0.count >= 4 && !stop2.contains($0) }
                    let thr = max(1, fTok.count)   // allSignificantTokens, as for "inv"
                    func invMatch(_ has: (String) -> Bool) -> Bool {
                        has(fv) || (fTok.count >= 2 && fTok.filter { has($0) }.count >= thr)
                    }
                    triggered = invNames.contains(where: { name in invMatch { name.contains($0) } }) ||
                                invResultsL.contains(where: { report in invMatch { report.contains($0) } })
                    sourceKey = "investigation"

                case "exam_general":
                    // Matches against examGeneral text specifically, then broad exam.
                    let egL = examGeneralL
                    let words2 = f.value.lowercased().split(separator: " ").map(String.init)
                    triggered = words2.allSatisfy(wordTest(words2, egL)) ||
                                words2.allSatisfy(wordTest(words2, examL))
                    sourceKey = "exam"

                case "exam_abdo":
                    // Matches against examAbdo text specifically, then broad exam.
                    let eaL = examAbdoL
                    let words3 = f.value.lowercased().split(separator: " ").map(String.init)
                    triggered = words3.allSatisfy(wordTest(words3, eaL)) ||
                                words3.allSatisfy(wordTest(words3, examL))
                    sourceKey = "exam"

                case "exam_cvs":
                    let eCVS = examCVSL
                    let words4 = f.value.lowercased().split(separator: " ").map(String.init)
                    triggered = words4.allSatisfy(wordTest(words4, eCVS)) ||
                                words4.allSatisfy(wordTest(words4, examL))
                    sourceKey = "exam"

                case "socrates_character":
                    // DB stores character chips under this key; match against character SOCRATES.
                    let charSel = socrates["character"] ?? []
                    let fvLow = f.value.lowercased()
                    triggered = charSel.contains(where: { $0.lowercased().contains(fvLow) })
                    sourceKey = "symptoms"

                case "history", "risk_factors", "risk":
                    // Broad historical risk factor — match against PMH + medications + social.
                    let histText = historyText
                    triggered = histText.contains(f.value.lowercased())
                    sourceKey = "history"

                // ── SOCRATES synonym keys ─────────────────────────────────────────────
                case "socrates_timing", "duration":
                    let timeSel = (socrates["timing"] ?? []).union(socrates["duration"] ?? [])
                    let fvT = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = timeSel.contains(where: { $0.lowercased().contains(fvT) }) ||
                                examL.contains(fvT)
                    sourceKey = "symptoms"

                case "socrates_duration":
                    let durSel = (socrates["timing"] ?? []).union(socrates["duration"] ?? [])
                    let fvSD = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = durSel.contains(where: { $0.lowercased().contains(fvSD) })
                    sourceKey = "symptoms"

                case "socrates_site":
                    let siteSel = socrates["site"] ?? []
                    triggered = siteSel.contains(where: { $0.lowercased().contains(f.value.lowercased()) })
                    sourceKey = "symptoms"

                case "aggravating":
                    let aggSel = (socrates["exacerbating"] ?? []).union(socrates["aggravating"] ?? [])
                    let fvAgg = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = aggSel.contains(where: { $0.lowercased().contains(fvAgg) })
                    sourceKey = "symptoms"

                case "pain":
                    let painSel = (socrates["character"] ?? []).union(socrates["severity"] ?? [])
                    let fvPain = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = painSel.contains(where: { $0.lowercased().contains(fvPain) }) ||
                                examL.contains(fvPain)
                    sourceKey = "symptoms"

                // ── Imaging investigation result keys ────────────────────────────────
                case "ct_abdomen":
                    triggered = invModalityMatch(keywords: ["ct ", "ct-", "computed tomography", "abdomen ct", "abdo ct"], finding: f.value)
                    sourceKey = "investigation"

                case "ultrasound", "uss":
                    triggered = invModalityMatch(keywords: ["ultrasound", "uss", "u/s", "sonograph"], finding: f.value)
                    sourceKey = "investigation"

                case "cxr":
                    triggered = invModalityMatch(keywords: ["cxr", "chest x-ray", "chest xray", "chest x ray", "chest radiograph"], finding: f.value)
                    sourceKey = "investigation"

                case "mri":
                    triggered = invModalityMatch(keywords: ["mri", "magnetic resonance"], finding: f.value)
                    sourceKey = "investigation"

                case "ecg":
                    triggered = invModalityMatch(keywords: ["ecg", "ekg", "electrocardiograph", "electrocardiogram"], finding: f.value)
                    sourceKey = "investigation"

                case "biopsy":
                    triggered = invModalityMatch(keywords: ["biopsy", "histolog", "patholog", "tissue diagnos"], finding: f.value)
                    sourceKey = "investigation"

                // ── Lab investigation result keys ────────────────────────────────────
                case "wbc":
                    let fvWBC = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let wbcSrc = invResults.filter { $0.contains("wbc") || $0.contains("white cell") ||
                                                     $0.contains("white blood cell") || $0.contains("leukocyt") }
                    if !wbcSrc.isEmpty {
                        if fvWBC.contains("markedly") {
                            triggered = wbcSrc.contains(where: { $0.contains("markedly") || $0.contains("severely") })
                        } else {
                            triggered = wbcSrc.contains(where: { $0.contains("elevat") || $0.contains("high") ||
                                                                   $0.contains("raised") || $0.contains("neutrophil") ||
                                                                   $0.contains("leukocytosis") || $0.contains(fvWBC) })
                        }
                    }
                    sourceKey = "investigation"

                case "iron_deficiency_anaemia":
                    triggered = invResults.contains(where: {
                        $0.contains("iron deficiency") || $0.contains("ferritin") ||
                        $0.contains("microcytic") || $0.contains("hypochromic") || $0.contains("iron deficien")
                    })
                    sourceKey = "investigation"

                case "hba1c":
                    triggered = invResults.contains(where: { $0.contains("hba1c") || $0.contains("glycated haemoglobin") || $0.contains("hemoglobin a1c") })
                    sourceKey = "investigation"

                case "lactate":
                    let lacSrc = invResults.filter { $0.contains("lactate") || $0.contains("lactic acid") }
                    let fvLac = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = lacSrc.contains(where: { $0.contains(fvLac) }) ||
                                (fvLac.contains("elevated") || fvLac.contains("above") || fvLac.contains("raised"))
                                && lacSrc.contains(where: { $0.contains("elevat") || $0.contains("high") ||
                                                             $0.contains("raised") || $0.contains("≥") || $0.contains(">=") })
                    sourceKey = "investigation"

                case "blood_culture":
                    triggered = invModalityMatch(keywords: ["blood culture", "blood cx", "bacteraemia", "bacteremia"], finding: f.value)
                    sourceKey = "investigation"

                // ── Examination finding keys ─────────────────────────────────────────
                case "splenomegaly":
                    triggered = examL.contains("splenomegaly") || examL.contains("enlarged spleen") || examL.contains("spleen enlarged")
                    sourceKey = "exam"

                case "haematuria":
                    let fvHaem = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let haemSrc = haemText
                    triggered = haemSrc.contains("haematuria") || haemSrc.contains("hematuria") ||
                                haemSrc.contains("blood in urine") ||
                                invResultsL.contains(where: { $0.contains("haematuria") || $0.contains("hematuria") }) ||
                                (fvHaem == "microscopic" && (haemSrc.contains("microscopic") || haemSrc.contains("dipstick")))
                    sourceKey = "exam"

                case "rash":
                    let fvRash = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let rashSrc = skinText
                    let rashToks = fvRash.split(separator: " ").map(String.init).filter { $0.count >= 4 }
                    triggered = rashToks.isEmpty ? rashSrc.contains("rash") || rashSrc.contains(fvRash)
                               : rashToks.allSatisfy { rashSrc.contains($0) }
                    sourceKey = "exam"

                case "distribution":
                    let fvDist = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let distSrc = skinText
                    let distToks = fvDist.split(separator: " ").map(String.init).filter { $0.count >= 4 }
                    triggered = distToks.isEmpty ? distSrc.contains(fvDist)
                               : distToks.filter { distSrc.contains($0) }.count >= max(1, distToks.count / 2)
                    sourceKey = "exam"

                case "hearing":
                    let hearSrc = hearText
                    let fvHear = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = hearSrc.contains("hearing") || hearSrc.contains("ear") || hearSrc.contains(fvHear)
                    sourceKey = "exam"

                case "haemodynamic_instability":
                    let hdSrc = haemodynamicText
                    triggered = hdSrc.contains("haemodynamic") || hdSrc.contains("hemodynamic") ||
                                hdSrc.contains("shocked") || hdSrc.contains("shock") ||
                                (hdSrc.contains("tachycardia") && hdSrc.contains("hypotension")) ||
                                (socrates["associations"] ?? []).contains(where: {
                                    let s = $0.lowercased()
                                    return s.contains("hypotension") || s.contains("tachycardia")
                                })
                    sourceKey = "exam"

                // ── History / demographics ───────────────────────────────────────────
                case "age":
                    let fvAge = f.value.lowercased()
                    switch true {
                    case fvAge == "young_adult" || fvAge == "young": triggered = age < 35
                    case fvAge == "middle_aged":                     triggered = age >= 35 && age < 60
                    case fvAge == "elderly" || fvAge == "older" || fvAge == "old": triggered = age >= 65
                    default:
                        let nums = fvAge.components(separatedBy: CharacterSet(charactersIn: "0123456789").inverted)
                                        .compactMap(Int.init)
                        if let n = nums.first {
                            if fvAge.contains("over") || fvAge.contains("above") || fvAge.contains(">") ||
                               fvAge.contains("older") || fvAge.hasPrefix("over_") {
                                triggered = age >= n
                            } else if fvAge.contains("under") || fvAge.contains("below") || fvAge.contains("<") {
                                triggered = age > 0 && age < n
                            }
                        }
                    }
                    sourceKey = "demographics"

                case "fever":
                    let feverSrc = feverText
                    triggered = feverSrc.contains("fever") || feverSrc.contains("febrile") ||
                                feverSrc.contains("pyrexia") ||
                                (socrates["associations"] ?? []).contains(where: { $0.lowercased().contains("fever") })
                    sourceKey = "symptoms"

                case "family_history":
                    let fvFH = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let fhToks = fvFH.split(separator: " ").map(String.init).filter { $0.count >= 3 }
                    triggered = fhToks.isEmpty ? pmhL.contains("family history") || pmhL.contains(fvFH)
                               : pmhL.contains("family") &&
                                 fhToks.filter { pmhL.contains($0) }.count >= max(1, fhToks.count / 2)
                    sourceKey = "history"

                case "weight_loss":
                    let wlSrc = weightLossText
                    triggered = wlSrc.contains("weight loss") || wlSrc.contains("weight_loss") ||
                                wlSrc.contains("losing weight") || wlSrc.contains("cachexia") ||
                                wlSrc.contains("unintentional weight")
                    sourceKey = "symptoms"

                case "headache":
                    let hdSrc2 = headacheText
                    let fvHD = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let hdToks = fvHD.split(separator: " ").map(String.init).filter { $0.count >= 4 }
                    triggered = hdToks.isEmpty ? hdSrc2.contains("headache") || hdSrc2.contains(fvHD)
                               : hdToks.allSatisfy { hdSrc2.contains($0) }
                    sourceKey = "symptoms"

                case "hypertension":
                    let htSrc = pmhSocialText
                    triggered = htSrc.contains("hypertension") || htSrc.contains(" htn") || htSrc.contains("high blood pressure")
                    sourceKey = "history"

                case "diabetes":
                    let dbSrc = pmhSocialText
                    triggered = dbSrc.contains("diabetes") || dbSrc.contains("diabetic") ||
                                dbSrc.contains(" dm2") || dbSrc.contains(" dm1") || dbSrc.contains(" dm ")
                    sourceKey = "history"

                case "location":
                    let fvLoc = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let locToks = fvLoc.split(separator: " ").map(String.init).filter { $0.count >= 4 }
                    let locSrc = locationText
                    triggered = locToks.isEmpty ? locSrc.contains(fvLoc)
                               : locToks.filter { locSrc.contains($0) }.count >= max(1, locToks.count / 2)
                    sourceKey = "exam"

                case "recurrence":
                    let recSrc = pmhSocialText
                    triggered = recSrc.contains("recurr") || recSrc.contains(f.value.lowercased().replacingOccurrences(of: "_", with: " "))
                    sourceKey = "history"

                // ── Short clinical abbreviation keys (≤3 chars, missed by default pass 2) ──
                case "crp":
                    let crpSrc = invResults.filter { $0.contains("crp") || $0.contains("c-reactive protein") || $0.contains("c reactive protein") }
                    let fvCRP = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = crpSrc.contains(where: { $0.contains(fvCRP) }) ||
                                (fvCRP.contains("elevated") || fvCRP.contains("raised") || fvCRP.contains("rising"))
                                && crpSrc.contains(where: { $0.contains("elevat") || $0.contains("high") || $0.contains("raised") || $0.contains("rising") })
                    sourceKey = "investigation"

                case "esr_crp", "crp_esr", "wbc_crp":
                    let inflSrc = invResults.filter { $0.contains("crp") || $0.contains("esr") || $0.contains("wbc") ||
                                                       $0.contains("erythrocyte sedimentation") || $0.contains("inflammatory marker") }
                    let fvInfl = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = inflSrc.contains(where: { $0.contains("elevat") || $0.contains("raised") || $0.contains("high") || $0.contains(fvInfl) })
                    sourceKey = "investigation"

                case "ogd":
                    triggered = invModalityMatch(keywords: ["ogd", "oesophagogastroduodenoscopy", "upper endoscopy", "upper gi endoscopy", "gastroscopy"], finding: f.value)
                    sourceKey = "investigation"

                case "ct":
                    triggered = invModalityMatch(keywords: ["ct ", "ct-", "computed tomography"], finding: f.value)
                    sourceKey = "investigation"

                case "us":
                    triggered = invModalityMatch(keywords: ["ultrasound", "uss", "u/s", "sonograph"], finding: f.value)
                    sourceKey = "investigation"

                case "fbc":
                    let fvFBC = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let fbcSrc = invResults.filter { $0.contains("fbc") || $0.contains("full blood count") || $0.contains("complete blood count") }
                    triggered = fbcSrc.contains(where: { $0.contains(fvFBC) }) ||
                                (fbcSrc.contains(where: { $0.contains("anaemia") || $0.contains("pancytopenia") || $0.contains("neutropenia") }))
                    sourceKey = "investigation"

                case "fna":
                    triggered = invModalityMatch(keywords: ["fna", "fine needle", "fnac", "fine-needle"], finding: f.value)
                    sourceKey = "investigation"

                case "ck":
                    let ckSrc = invResults.filter { $0.contains(" ck ") || $0.contains("creatine kinase") || $0.contains("ck:") || $0.hasPrefix("ck ") }
                    let fvCK = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = ckSrc.contains(where: { $0.contains("elevat") || $0.contains("raised") || $0.contains("high") || $0.contains(fvCK) })
                    sourceKey = "investigation"

                case "mri_dwi":
                    triggered = invModalityMatch(keywords: ["mri", "dwi", "diffusion weighted", "diffusion-weighted"], finding: f.value)
                    sourceKey = "investigation"

                case "hla_b27":
                    triggered = invResults.contains(where: { $0.contains("hla") && $0.contains("b27") }) ||
                                invResults.contains(where: { $0.contains("hla-b27") || $0.contains("hla b27") })
                    sourceKey = "investigation"

                case "hpv":
                    triggered = invResults.contains(where: { $0.contains("hpv") || $0.contains("human papillomavirus") })
                    sourceKey = "investigation"

                case "alt_ast":
                    let liverSrc = invResults.filter { $0.contains("alt") || $0.contains("ast") || $0.contains("alanine") || $0.contains("aspartate") }
                    let fvLiver = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = liverSrc.contains(where: { $0.contains("elevat") || $0.contains("raised") || $0.contains("above") || $0.contains(fvLiver) })
                    sourceKey = "investigation"

                case "pcr":
                    let fvPCR = f.value.lowercased()
                    triggered = invResults.contains(where: { $0.contains("pcr") && ($0.contains("positive") || fvPCR.contains("positive") || $0.contains("detected")) })
                    sourceKey = "investigation"

                case "bp":
                    let bpSrc = bpText
                    let fvBP = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = bpSrc.contains("hypertension") || bpSrc.contains("severely elevated") ||
                                bpSrc.contains("markedly elevated") || bpSrc.contains("bp elevated") ||
                                bpSrc.contains(fvBP) ||
                                (socrates["associations"] ?? []).contains(where: { $0.lowercased().contains("hyperten") })
                    sourceKey = "exam"

                case "bmi":
                    let fvBMI = f.value.lowercased()
                    if let b = bmi {
                        switch true {
                        case fvBMI.contains("above_30") || fvBMI.contains("overweight") || fvBMI.contains("obese"): triggered = b >= 30
                        case fvBMI.contains("lean") || fvBMI.contains("normal"):                                      triggered = b < 25
                        default:
                            if let n = fvBMI.components(separatedBy: CharacterSet(charactersIn:"0123456789").inverted).compactMap(Int.init).first {
                                triggered = fvBMI.contains("above") || fvBMI.contains("over") ? b >= Double(n) : b < Double(n)
                            }
                        }
                    } else {
                        triggered = pmhL.contains("obese") || pmhL.contains("overweight") || pmhL.contains("obesity")
                    }
                    sourceKey = "demographics"

                case "sex":
                    let fvSex = f.value.lowercased()
                    triggered = (fvSex == "male" && sex == .male) || (fvSex == "female" && sex == .female)
                    sourceKey = "demographics"

                case "age_over_50":
                    triggered = age >= 50
                    sourceKey = "demographics"

                // ── Curated keys (DiagnosticDatabase.json 2.0.0 "coreConditions") ────────────
                // Value: "|" separates alternatives, "&" joins terms that must all be present.
                // Matched negation-aware at word starts (NegationMatcher).
                case "complaint":
                    // The presenting complaint itself ("swollen lips", "cannot breathe").
                    triggered = Self.anyAlternative(f.value, in: complaintL)
                    sourceKey = "symptoms"

                case "finding":
                    // Complaint, HPI, examination, PMH, SOCRATES chips and resulted reports.
                    triggered = Self.anyAlternative(f.value, in: findingText)
                    sourceKey = "symptoms"

                case "findingAbsent":
                    // A finding documented as absent ("no neck stiffness"): mentioned, never affirmed.
                    triggered = Self.anyAlternativeDocumentedAbsent(f.value, in: findingText)
                    sourceKey = "symptoms"

                case "notFinding":
                    // A cardinal feature missing from the whole record (not written, or only
                    // negated): e.g. no chest, arm, jaw, epigastric or breathing complaint for ACS.
                    // Carries a likelihood ratio below 1.
                    triggered = !Self.anyAlternative(f.value, in: findingText)
                    sourceKey = "other"

                case "postOpDay":
                    // "a-b": the post-operative day written in the record (complaint, HPI, PSHx,
                    // PMH) is between a and b ("0-1": within a day of the operation).
                    triggered = BayesianDiagnosisEngine.postOpDayMatches(f.value, day: postOpDay)
                    sourceKey = "history"

                default:
                    // Pass 1: SOCRATES dict lookup — specialist early-form chips may store
                    // any custom DB key (e.g. lucid_interval, ecg, triad_nph) into
                    // socratesSelections, letting specialty pool features fire from intake
                    // without structural changes to those pools.
                    if let sel = socrates[f.key], !sel.isEmpty {
                        triggered = sel.contains(where: { $0.lowercased().contains(f.value.lowercased()) })
                        sourceKey = "symptoms"
                    }
                    // Pass 2: Singleton clinical-finding keys — the DB stores ~5500 unique keys
                    // that encode the finding name directly (e.g. "flank_or_loin_pain",
                    // "retrosternal_chest_pain_squeezing"). Extract meaningful words from the
                    // key and look for them in the broad clinical record.
                    if !triggered {
                        let keyStop: Set<String> = ["pain","sign","test","with","type","form",
                                                     "and","the","for","from","that","this",
                                                     "into","also","show","seen","find","rate",
                                                     "does","have","been","true","false","over",
                                                     "under","each","both","when","more","less"]
                        // "_or_" separates alternatives ("flank_or_loin_pain"); every word of one
                        // alternative must be in the record (a single shared word such as
                        // "tender" used to be enough, which fired unrelated diagnoses).
                        let keyGroups = f.key.lowercased()
                            .components(separatedBy: "_or_")
                            .map { group in
                                group.replacingOccurrences(of: "_", with: " ")
                                    .split(separator: " ").map(String.init)
                                    .filter { $0.count >= 4 && !keyStop.contains($0) }
                            }
                            .filter { !$0.isEmpty }
                        if !keyGroups.isEmpty {
                            let broadSrc = broadRecordText
                            let findingPresent = keyGroups.contains { g in g.allSatisfy(wordTest(g, broadSrc)) }
                            let fvL = f.value.lowercased()
                            let isNegated = fvL == "absent" || fvL == "false" || fvL == "no" ||
                                            fvL == "negative" || fvL == "none" || fvL == "normal"
                            if isNegated {
                                // An "absent" finding counts only when the record mentions it and
                                // it is negated there ("no neck stiffness"); a finding nobody wrote
                                // down is not evidence of its absence.
                                let mentioned = keyGroups.contains { g in g.allSatisfy { broadSrc.lower.contains($0) } }
                                triggered = mentioned && !findingPresent
                            } else {
                                triggered = findingPresent
                            }
                            sourceKey  = "symptoms"
                        }
                    }
                }

                // Masking contexts: a missing or documented-absent cardinal feature is not counted
                // against the diagnosis where it is often absent (peritonism on steroids or in the
                // elderly, chest pain in ACS in women, older people and diabetes).
                if triggered && BayesianDiagnosisEngine.isMasked(f.maskedBy, logLR: f.logLR, active: maskingContexts) {
                    triggered = false
                }
                if triggered, f.logLR >= BayesianDiagnosisEngine.reportEvidenceMinLogLR,
                   f.key == "inv" || (f.key == "finding" && Self.anyAlternative(f.value, in: reportText)) {
                    reportEvidence = true
                }

                if triggered {
                    // Apply CPT-based discounting when a correlated parent feature has
                    // already been observed — avoids double-counting co-occurring findings.
                    let effectiveLR: Int
                    if let nid = Self.featureNetworkID(key: f.key, value: f.value) {
                        let adj = BayesianFeatureNetwork.adjustedLogLR(
                            featureID: nid,
                            featurePresent: true,
                            observedIDs: observedNetworkIDs,
                            baseLogLR: Double(f.logLR) / BayesianDiagnosisEngine.logUnitsPerNat
                        )
                        // The network works in natural-log units; feature logLRs are ln × 5.
                        effectiveLR = Int((adj * BayesianDiagnosisEngine.logUnitsPerNat).rounded())
                    } else {
                        effectiveLR = f.logLR
                    }
                    logP += effectiveLR
                    if effectiveLR > 0 && !f.evidenceLabel.isEmpty {
                        evidence.append(f.evidenceLabel)
                        // Suppress demographics from the evidence panel (age/sex are context, not findings)
                        if sourceKey != "demographics" && sourceKey != "other" {
                            evidenceSources[sourceKey, default: []].append(f.evidenceLabel)
                        }
                    }
                    // Track pathognomonic findings (LR+ ≥ 36 ≙ logLR ≥ 18) — these gravitationally enforce working diagnosis
                    if f.logLR >= 18 && !f.evidenceLabel.isEmpty {
                        pathognomicFindings.append(f.evidenceLabel)
                    }
                }
            }

            return ScoredCandidate(candidate: c, logPosterior: logP, evidence: evidence,
                                   evidenceSources: evidenceSources, pathognomicFindings: pathognomicFindings,
                                   reportEvidence: reportEvidence)
        }
    }


}
