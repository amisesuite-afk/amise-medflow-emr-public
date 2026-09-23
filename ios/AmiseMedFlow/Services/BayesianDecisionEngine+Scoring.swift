// BayesianDecisionEngine+Scoring.swift
// Score candidates against collected evidence; build ScoredCandidate.

import Foundation

extension BayesianDecisionEngine {

    // MARK: - Scoring

    struct ScoredCandidate {
        let candidate: Candidate
        var logPosterior: Int
        var evidence: [String]
        var evidenceSources: [String: [String]] = [:]
        var pathognomicFindings: [String] = []   // features with logLR ≥ 18 that fired
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
        bmi: Double? = nil
    ) -> [ScoredCandidate] {
        let pmhL = pmh.lowercased()
        let pshxL = pshx.lowercased()
        let examL = [examAbdo, examGeneral, examCVS, examResp, examNeuro, examMSK, examSkin, examOther]
            .joined(separator: " ").lowercased()
        let invNames = investigations.map { $0.name.lowercased() }
        let invResults = investigations.filter { $0.status == .resulted }
            .map { $0.name.lowercased() + " " + $0.result.lowercased() }
        let medsL = medications.map { $0.lowercased() }
        let socialL = socialText.lowercased()

        return candidates.map { c in
            var logP = c.logPrior
            var evidence: [String] = []
            var evidenceSources: [String: [String]] = [:]
            var pathognomicFindings: [String] = []

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
                    fired = words.allSatisfy { examL.contains($0) }
                case "exam_general":
                    let words = f.value.lowercased().split(separator: " ").map(String.init)
                    fired = words.allSatisfy { examGeneral.lowercased().contains($0) } ||
                            words.allSatisfy { examL.contains($0) }
                case "exam_abdo":
                    let words = f.value.lowercased().split(separator: " ").map(String.init)
                    fired = words.allSatisfy { examAbdo.lowercased().contains($0) } ||
                            words.allSatisfy { examL.contains($0) }
                case "exam_cvs":
                    let words = f.value.lowercased().split(separator: " ").map(String.init)
                    fired = words.allSatisfy { examCVS.lowercased().contains($0) } ||
                            words.allSatisfy { examL.contains($0) }
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
                let src = invResults.filter { r in keywords.contains(where: { r.contains($0) }) }
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
                    triggered = words.allSatisfy { examL.contains($0) }
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
                    // majority-token match: require ≥60% of significant tokens (≥4 chars,
                    // not stop-words) to appear in any single invNames or invResults entry.
                    let fv = f.value.lowercased()
                    let stop: Set<String> = ["with","and","the","for","that","this","from","into","positive","negative","confirmed","elevated","raised","normal","abnormal","level","result"]
                    let fTokens = fv.split(separator: " ").map(String.init)
                        .filter { $0.count >= 4 && !stop.contains($0) }
                    let threshold = max(1, Int((Double(fTokens.count) * 0.6).rounded(.up)))
                    func tokenMatch(_ src: String) -> Bool {
                        src.contains(fv) ||
                        (fTokens.count >= 2 && fTokens.filter { src.contains($0) }.count >= threshold)
                    }
                    triggered = invNames.contains(where: { tokenMatch($0) }) ||
                                invResults.contains(where: { tokenMatch($0) })
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
                    let broadText = ([examAbdo, examGeneral, examCVS, examResp, examNeuro,
                                      examMSK, examSkin, examOther, pmh] +
                                     socrates.values.flatMap { Array($0) })
                        .joined(separator: " ").lowercased()
                    let words = f.value.lowercased().split(separator: " ").map(String.init)
                        .filter { $0.count >= 4 }
                    triggered = words.isEmpty ? broadText.contains(f.value.lowercased())
                               : words.allSatisfy { broadText.contains($0) }
                    sourceKey = "symptoms"

                case "investigations":
                    // Synonym for "inv" — matches against investigation names + results.
                    let fv = f.value.lowercased()
                    let stop2: Set<String> = ["with","and","the","for","that","this","from","into","positive","negative","confirmed","elevated","raised","normal","abnormal","level","result"]
                    let fTok = fv.split(separator: " ").map(String.init).filter { $0.count >= 4 && !stop2.contains($0) }
                    let thr = max(1, Int((Double(fTok.count) * 0.6).rounded(.up)))
                    func invMatch(_ src: String) -> Bool {
                        src.contains(fv) || (fTok.count >= 2 && fTok.filter { src.contains($0) }.count >= thr)
                    }
                    triggered = invNames.contains(where: { invMatch($0) }) ||
                                invResults.contains(where: { invMatch($0) })
                    sourceKey = "investigation"

                case "exam_general":
                    // Matches against examGeneral text specifically, then broad exam.
                    let egL = examGeneral.lowercased()
                    let words2 = f.value.lowercased().split(separator: " ").map(String.init)
                    triggered = words2.allSatisfy { egL.contains($0) } ||
                                words2.allSatisfy { examL.contains($0) }
                    sourceKey = "exam"

                case "exam_abdo":
                    // Matches against examAbdo text specifically, then broad exam.
                    let eaL = examAbdo.lowercased()
                    let words3 = f.value.lowercased().split(separator: " ").map(String.init)
                    triggered = words3.allSatisfy { eaL.contains($0) } ||
                                words3.allSatisfy { examL.contains($0) }
                    sourceKey = "exam"

                case "exam_cvs":
                    let eCVS = examCVS.lowercased()
                    let words4 = f.value.lowercased().split(separator: " ").map(String.init)
                    triggered = words4.allSatisfy { eCVS.contains($0) } ||
                                words4.allSatisfy { examL.contains($0) }
                    sourceKey = "exam"

                case "socrates_character":
                    // DB stores character chips under this key; match against character SOCRATES.
                    let charSel = socrates["character"] ?? []
                    let fvLow = f.value.lowercased()
                    triggered = charSel.contains(where: { $0.lowercased().contains(fvLow) })
                    sourceKey = "symptoms"

                case "history", "risk_factors", "risk":
                    // Broad historical risk factor — match against PMH + medications + social.
                    let histText = ([pmh] + medsL + [socialText]).joined(separator: " ").lowercased()
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
                    let haemSrc = [examAbdo, examGeneral, examOther].joined(separator: " ").lowercased()
                    triggered = haemSrc.contains("haematuria") || haemSrc.contains("hematuria") ||
                                haemSrc.contains("blood in urine") ||
                                invResults.contains(where: { $0.contains("haematuria") || $0.contains("hematuria") }) ||
                                (fvHaem == "microscopic" && (haemSrc.contains("microscopic") || haemSrc.contains("dipstick")))
                    sourceKey = "exam"

                case "rash":
                    let fvRash = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let rashSrc = [examSkin, examGeneral].joined(separator: " ").lowercased()
                    let rashToks = fvRash.split(separator: " ").map(String.init).filter { $0.count >= 4 }
                    triggered = rashToks.isEmpty ? rashSrc.contains("rash") || rashSrc.contains(fvRash)
                               : rashToks.allSatisfy { rashSrc.contains($0) }
                    sourceKey = "exam"

                case "distribution":
                    let fvDist = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let distSrc = [examSkin, examGeneral].joined(separator: " ").lowercased()
                    let distToks = fvDist.split(separator: " ").map(String.init).filter { $0.count >= 4 }
                    triggered = distToks.isEmpty ? distSrc.contains(fvDist)
                               : distToks.filter { distSrc.contains($0) }.count >= max(1, distToks.count / 2)
                    sourceKey = "exam"

                case "hearing":
                    let hearSrc = [examNeuro, examOther, examGeneral].joined(separator: " ").lowercased()
                    let fvHear = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    triggered = hearSrc.contains("hearing") || hearSrc.contains("ear") || hearSrc.contains(fvHear)
                    sourceKey = "exam"

                case "haemodynamic_instability":
                    let hdSrc = [examGeneral, examCVS, examAbdo].joined(separator: " ").lowercased()
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
                    let feverSrc = [examGeneral, examAbdo].joined(separator: " ").lowercased()
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
                    let wlSrc = ([examGeneral, pmh, socialText] + socrates.values.flatMap { Array($0) })
                                .joined(separator: " ").lowercased()
                    triggered = wlSrc.contains("weight loss") || wlSrc.contains("weight_loss") ||
                                wlSrc.contains("losing weight") || wlSrc.contains("cachexia") ||
                                wlSrc.contains("unintentional weight")
                    sourceKey = "symptoms"

                case "headache":
                    let hdSrc2 = (socrates.values.flatMap { Array($0) } + [examGeneral, examNeuro, examOther])
                                .joined(separator: " ").lowercased()
                    let fvHD = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let hdToks = fvHD.split(separator: " ").map(String.init).filter { $0.count >= 4 }
                    triggered = hdToks.isEmpty ? hdSrc2.contains("headache") || hdSrc2.contains(fvHD)
                               : hdToks.allSatisfy { hdSrc2.contains($0) }
                    sourceKey = "symptoms"

                case "hypertension":
                    let htSrc = [pmh, socialText].joined(separator: " ").lowercased()
                    triggered = htSrc.contains("hypertension") || htSrc.contains(" htn") || htSrc.contains("high blood pressure")
                    sourceKey = "history"

                case "diabetes":
                    let dbSrc = [pmh, socialText].joined(separator: " ").lowercased()
                    triggered = dbSrc.contains("diabetes") || dbSrc.contains("diabetic") ||
                                dbSrc.contains(" dm2") || dbSrc.contains(" dm1") || dbSrc.contains(" dm ")
                    sourceKey = "history"

                case "location":
                    let fvLoc = f.value.lowercased().replacingOccurrences(of: "_", with: " ")
                    let locToks = fvLoc.split(separator: " ").map(String.init).filter { $0.count >= 4 }
                    let locSrc = (invResults + [examAbdo, examGeneral]).joined(separator: " ").lowercased()
                    triggered = locToks.isEmpty ? locSrc.contains(fvLoc)
                               : locToks.filter { locSrc.contains($0) }.count >= max(1, locToks.count / 2)
                    sourceKey = "exam"

                case "recurrence":
                    let recSrc = [pmh, socialText].joined(separator: " ").lowercased()
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
                    let bpSrc = [examCVS, examGeneral].joined(separator: " ").lowercased()
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
                        let keyToks = f.key.lowercased()
                            .replacingOccurrences(of: "_or_", with: " ")
                            .replacingOccurrences(of: "_", with: " ")
                            .split(separator: " ").map(String.init)
                            .filter { $0.count >= 4 && !keyStop.contains($0) }
                        if !keyToks.isEmpty {
                            let broadSrc = ([pmh, pshx, examAbdo, examGeneral, examCVS,
                                             examResp, examNeuro, examMSK, examSkin, examOther,
                                             socialText]
                                            + invResults + invNames
                                            + socrates.values.flatMap { Array($0) })
                                .joined(separator: " ").lowercased()
                            let matchCount = keyToks.filter { broadSrc.contains($0) }.count
                            let threshold  = max(1, keyToks.count / 2)
                            let findingPresent = matchCount >= threshold
                            let fvL = f.value.lowercased()
                            let isNegated = fvL == "absent" || fvL == "false" || fvL == "no" ||
                                            fvL == "negative" || fvL == "none" || fvL == "normal"
                            triggered  = isNegated ? !findingPresent : findingPresent
                            sourceKey  = "symptoms"
                        }
                    }
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
                            baseLogLR: Double(f.logLR)
                        )
                        effectiveLR = Int(adj.rounded())
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
                                   evidenceSources: evidenceSources, pathognomicFindings: pathognomicFindings)
        }
    }


}
