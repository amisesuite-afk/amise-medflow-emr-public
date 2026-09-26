import Foundation

// MARK: - Plan safety filter: web prompt-parity rules (web-last-gaps)
//
// DRIFT NOTE: iOS twin of the web-last-gaps changes to the clinical prompts in
// `artifacts/dashboard/src/lib/clinical-inference.ts` (web tests:
// `artifacts/dashboard/src/lib/__tests__/web-last-gaps.test.ts`; change log
// docs/clinical-validation/changes/web-last-gaps.md). iOS has no prompt strip, so the same rules
// run at the iOS plan choke points: every plan line through `PlanSafetyFilter.adaptLine` (radiation
// card, SOAP draft plan, pipeline decisions and actions) and the card-level adjustments in
// `DiagnosisRadiationEngine+PromptParity.swift`. Wording is the web wording where the same
// guideline applies; the vectors in `AmiseMedFlowTests/WebLastGapsParityTests.swift` port the web
// vectors. Change the web prompt, this file and both test files together, and bump
// `PlanSafetyFilter.version` with the registry entry `ios-plan-safety-filter`.
//
// Deliberate differences from the web are listed for sign-off in
// docs/clinical-validation/changes/ios-parity-web-last-gaps.md.
//
// Deterministic text matching, negation-aware (NegationMatcher, twin of lib/triage-engine
// negation.ts). CLINICIAN-FACING only (hazard H-10): every line is a suggestion the surgeon
// reviews; nothing is ordered, prescribed or written without a tap.

extension PlanSafetyFilter {

    // MARK: Relatives' entries (web adaptive-triage FAMILY_ENTRY)

    /// A past-history entry about a relative, not the patient (web `FAMILY_ENTRY`).
    static let familyEntryPattern =
        #"\b(family history|fam(ily)? hx|fhx|f/h|mother|father|sister|brother|parents?|aunt|uncle|grand(mother|father|parent)s?|cousin|relatives?)\b"#

    static func isRelativeEntry(_ entry: String) -> Bool { test(familyEntryPattern, entry) }

    /// History entries (split at new lines, full stops, semicolons and commas) that are about the
    /// patient: "Family history of colorectal cancer (father, 58)" is not the patient's cancer.
    static func ownHistoryEntries(_ text: String) -> [String] {
        text.components(separatedBy: CharacterSet(charactersIn: "\n;,."))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty && !isRelativeEntry($0) }
    }

    /// The text with every clause (between new lines, full stops, semicolons and commas) that names
    /// a relative removed; the other clauses and the separators are kept as written.
    static func removingRelativeEntries(_ text: String) -> String {
        guard let re = regex(#"[^\n;,.]+"#) else { return text }
        let ns = text as NSString
        var out = text
        for m in re.matches(in: text, range: NSRange(location: 0, length: ns.length)).reversed()
            where isRelativeEntry(ns.substring(with: m.range)) {
            guard let r = Range(m.range, in: out) else { continue }
            out.replaceSubrange(r, with: "")
        }
        return out
    }

    /// Any of `terms` affirmed in one of the patient's own history entries (web `hasPmh`).
    static func ownHistoryHas(_ s: Signals, _ terms: [String]) -> Bool {
        s.ownHistory.contains { NegationMatcher.containsAnyAffirmed($0, terms) }
    }

    // MARK: NSAID exclusions (web ANALGESIA_LINE; NICE NG148; BNF)

    /// Anticoagulants the web template reads (`anticoagNames`).
    static let templateAnticoagulants = vka + doacs + ["enoxaparin", "heparin", "fondaparinux", "dalteparin", "tinzaparin"]

    static func onDialysis(_ s: Signals) -> Bool {
        ownHistoryHas(s, ["dialysis", "haemodialysis", "hemodialysis", "end-stage renal", "esrf", "eskd", "end stage renal"])
    }

    /// Web `renalImpairment` of the operative templates: dialysis, eGFR < 60 or CKD / renal
    /// impairment in the history (broader than `Signals.renalImpairment`, which is AKI / CKD 4–5).
    static func templateRenalImpairment(_ s: Signals) -> Bool {
        onDialysis(s) || (s.egfr.map { $0 < 60 } ?? false)
            || ownHistoryHas(s, ["ckd", "chronic kidney", "renal impairment", "renal failure", "kidney disease", "nephropathy", "renal insufficiency"])
    }

    /// Why NSAIDs are avoided for this patient (web `nsaidReasons`), in the web order.
    static func nsaidReasons(_ s: Signals) -> [String] {
        var r: [String] = []
        if templateRenalImpairment(s) { r.append("renal impairment") }
        if let a = s.age, a >= 75 { r.append("age ≥ 75") }
        if ownHistoryHas(s, ["heart failure", "cardiac failure"]) { r.append("heart failure") }
        if ownHistoryHas(s, ["peptic ulcer", "gi bleed", "gastrointestinal bleed", "upper gi bleed"]) { r.append("peptic ulcer / GI bleeding history") }
        if !drugsPresent(s.meds, templateAnticoagulants).isEmpty { r.append("anticoagulant") }
        return r
    }

    /// A line that stops / withholds / avoids a drug is not a proposal to give it.
    static let stopInstruction = #"\b(stop\w*|hold|holding|withh\w*|avoid\w*|omit\w*|discontinu\w*|suspend\w*)\b"#

    /// iOS line rule (the web applies these exclusions to its operative-template analgesia line):
    /// a line proposing an NSAID is withheld when the patient has a web NSAID exclusion.
    static func nsaidExclusionRule(_ line: String, _ s: Signals, prefix: String) -> (text: String, withheld: String?)? {
        let hits = affirmedMentions(line, nsaids)
        guard !hits.isEmpty, !test(stopInstruction, norm(line)) else { return nil }
        let reasons = nsaidReasons(s)
        guard !reasons.isEmpty else { return nil }
        return ("\(prefix)⚠ NSAID withheld (contains \(hits.joined(separator: ", "))): avoid NSAIDs — \(reasons.joined(separator: ", ")) (NICE NG148; BNF). Use paracetamol ± an opioid.",
                "NSAID: \(reasons.joined(separator: ", "))")
    }

    // MARK: Malignant large-bowel obstruction: colonic stent (WSES 2018; ESGE 2020)

    struct ColonicStentAssessment: Equatable {
        var malignant = false
        var rightSided = false
        var largeBowelObstruction = false
        /// In the web order and wording.
        var contraindications: [String] = []
    }

    static func colonicStent(_ s: Signals) -> ColonicStentAssessment {
        var a = ColonicStentAssessment()
        let text = s.obstructionText
        let tumour = "(?:tumou?r|cancer|carcinoma|malignan\\w*|mass|lesion|stricture)"
        let rightSite = "(?:caecum|caecal|cecum|cecal|ascending colon|hepatic flexure|right colon|right[- ]sided colon|right hemicolon)"
        a.rightSided = NegationMatcher.testAffirmed("\\b\(tumour)\\s+(?:at|of|in|involving|arising (?:at|in|from))\\s+(?:the\\s+)?\(rightSite)\\b", text)
            || NegationMatcher.testAffirmed("\\b\(rightSite)\\b[^.;\\n]{0,20}\\b\(tumour)\\b", text)
        a.malignant = NegationMatcher.testAffirmed(#"\b(colonic|colorectal|colon|sigmoid|rectal|rectosigmoid|caecal|splenic flexure|descending colon|hepatic flexure)\b[^.;\n]{0,15}\b(cancer|carcinoma|tumou?r|malignan\w*)\b"#, text)
            || NegationMatcher.testAffirmed(#"\b(cancer|carcinoma|tumou?r)\b[^.;\n]{0,30}\b(colon|sigmoid|rectum|rectosigmoid|flexure|caecum)\b"#, text)
            || NegationMatcher.containsAnyAffirmed(text, ["malignant large bowel obstruction", "malignant lbo"])
        a.largeBowelObstruction = NegationMatcher.containsAnyAffirmed(text, ["large bowel obstruction", "colonic obstruction", "obstructing colon", "obstructing sigmoid", "obstructing rectal"])
            || NegationMatcher.testAffirmed(#"\blbo\b"#, text)

        let withExam = NegationMatcher.joinClauses([text, s.exam])
        if NegationMatcher.containsAnyAffirmed(withExam, ["perforat", "free gas", "pneumoperitoneum", "free air"]) {
            a.contraindications.append("perforation or impending perforation")
        }
        if NegationMatcher.containsAnyAffirmed(s.exam, ["peritonitis", "peritonism", "rebound", "guarding"])
            || NegationMatcher.containsAnyAffirmed(text, ["peritonitis"]) {
            a.contraindications.append("peritonitis / peritonism")
        }
        if NegationMatcher.containsAnyAffirmed(text, ["pneumatosis", "ischaem", "ischem", "gangren", "non-viable"]) {
            a.contraindications.append("caecal / colonic ischaemia or pneumatosis")
        }
        if NegationMatcher.containsAnyAffirmed(text, ["closed loop", "closed-loop"]) {
            a.contraindications.append("closed-loop obstruction")
        }
        if let raw = capture(#"\b(?:caecum|caecal|cecum|cecal)\b[^.;\n]{0,25}?(\d{1,2}(?:\.\d)?)\s*cm\b"#, text),
           let cm = Double(raw), cm >= 12 {
            a.contraindications.append("caecum \(cm == cm.rounded() ? String(Int(cm)) : String(cm)) cm")
        }
        return a
    }

    /// Web step 5 wording, one branch per situation (nil: no malignant LBO recorded).
    static func colonicStentPlanLine(_ a: ColonicStentAssessment) -> String? {
        if a.malignant && !a.contraindications.isEmpty {
            return "Colonic stenting is contraindicated (\(a.contraindications.joined(separator: ", "))): emergency surgery — resection (subtotal colectomy when the caecum is ischaemic or perforating) after resuscitation and antibiotics (WSES 2018; ESGE 2020)."
        }
        if a.malignant && a.rightSided {
            return "Right-sided obstructing colon cancer: right (extended) hemicolectomy with primary ileocolic anastomosis if the patient is stable; ileostomy if unstable or contaminated. Stenting is not routinely recommended for right-sided lesions (WSES 2018)."
        }
        if a.malignant {
            return "Left-sided obstructing colon cancer without perforation, peritonitis, ischaemia or a closed loop: colonic stent as a bridge to elective resection (selected patients, MDT), or emergency resection / Hartmann's procedure (WSES 2018; ESGE 2020)."
        }
        if a.largeBowelObstruction {
            return "If the large-bowel obstruction is due to a left-sided colonic cancer with no perforation, peritonitis, ischaemia or closed loop: colonic stent as a bridge to elective resection, or emergency resection (WSES 2018; ESGE 2020). Right-sided cancer: right hemicolectomy."
        }
        return nil
    }

    /// A line about a colonic stent (not a biliary, ureteric or coronary one).
    static let colonicStentContext =
        #"\bsems\b|self-expanding metal stent|colonic stent|stent\w*[^.;\n]{0,60}\bbridge|bridge[^.;\n]{0,40}\bstent|(?:colon\w*|colorectal|large[- ]bowel|sigmoid|malignant (?:large bowel )?obstruction)[^.;\n]{0,60}\bstent"#

    /// A line proposing a colonic stent for a malignant LBO with a contraindication or a
    /// right-sided tumour is withheld with the web branch line.
    static func colonicStentRule(_ line: String, _ s: Signals, prefix: String) -> (text: String, withheld: String?)? {
        guard test(colonicStentContext, norm(line)),
              affirmedMention(line, ["sems", "stent", "stents", "stenting", "stented"]) != nil else { return nil }
        let a = colonicStent(s)
        guard a.malignant, !a.contraindications.isEmpty || a.rightSided, let text = colonicStentPlanLine(a) else { return nil }
        return ("\(prefix)⚠ \(text)", a.contraindications.isEmpty ? "right-sided tumour" : "colonic stent contraindicated")
    }

    // MARK: GI bleeding: haemodynamically significant or stable (BSG 2019; NICE CG141)

    /// Web `giUnstable`: SBP < 90, shock index > 1, Hb < 8 g/dL, or collapse / syncope / a large
    /// volume / clots in the history.
    static func giBleedUnstable(_ s: Signals) -> Bool {
        if let sbp = s.systolicBP, sbp < 90 { return true }
        if let sbp = s.systolicBP, let hr = s.heartRate, Double(hr) / Double(max(sbp, 1)) > 1 { return true }
        if let hb = s.haemoglobinGdl, hb < 8 { return true }
        return NegationMatcher.containsAnyAffirmed(s.historyAll, ["collapse", "syncope", "fainted", "massive", "large volume", "passing clots", "heavy bleeding"])
    }

    /// iOS: "stable" needs a recorded SBP or heart rate (the web treats missing vital signs as stable).
    static func giBleedStable(_ s: Signals) -> Bool {
        (s.systolicBP != nil || s.heartRate != nil) && !giBleedUnstable(s)
    }

    static let stableUpperGIBleedLine = "Haemodynamically stable upper GI bleeding: Glasgow-Blatchford score — 0–1: outpatient management and endoscopy; higher: admit, endoscopy within 24 h (NICE CG141; ESGE 2021)."
    static let stableLowerGIBleedLine = "Haemodynamically stable lower GI bleeding: Oakland score — ≤ 8 with no other indication for admission: discharge for outpatient investigation; > 8: admit, colonoscopy on the next available list (BSG 2019)."

    // MARK: Hyperkalaemia bands (UKKA 2023)

    static func hyperkalaemicECGChanges(_ s: Signals) -> Bool {
        NegationMatcher.testAffirmed(#"\b(peaked t|tented t|broad qrs|wide qrs|ecg changes|sine[- ]wave|absent p waves?|loss of p waves?)"#, s.historyAll)
    }

    /// Web: 5.5–5.9 → treat the cause and repeat K⁺ (no shift therapy); ≥ 6.0 → insulin–glucose;
    /// ≥ 6.5 → add nebulised salbutamol. Applied only when a potassium result is recorded and no
    /// hyperkalaemic ECG change is written (the card lines stay as written otherwise).
    static func hyperkalaemiaBandRule(_ line: String, _ s: Signals, prefix: String) -> (text: String, withheld: String?)? {
        guard let k = s.potassium, !hyperkalaemicECGChanges(s) else { return nil }
        let l = norm(line)
        let value = String(format: "%.1f", k)
        let insulinShift = test(#"insulin\s*(?:[-/+]|and|with)\s*(?:glucose|dextrose)|\bactrapid\b|soluble insulin[^.;\n]{0,30}\b(?:glucose|dextrose)"#, l)
        if insulinShift && k < 6.0 {
            let text = k >= 5.5
                ? "Mild hyperkalaemia (K⁺ \(value) mmol/L; 5.5–5.9 — UKKA 2023): potassium-shifting treatment withheld — treat the cause, stop contributing drugs, repeat K⁺ (exclude haemolysis); shifting treatment is for K⁺ ≥ 6.0 mmol/L."
                : "K⁺ \(value) mmol/L: potassium-shifting treatment withheld — it is for K⁺ ≥ 6.0 mmol/L (UKKA 2023); treat the cause and repeat K⁺."
            return ("\(prefix)⚠ \(text)", "K⁺ \(value) mmol/L")
        }
        let salbutamolShift = test(#"\bsalbutamol\b"#, l) && test(#"k⁺|k\+|potassium|hyperkal|adjunct|\b10\s*-\s*20\s*mg\b"#, l)
        if salbutamolShift && k < 6.5 {
            return ("\(prefix)⚠ K⁺ \(value) mmol/L: nebulised salbutamol withheld — an adjunct for severe hyperkalaemia (K⁺ ≥ 6.5 mmol/L) only (UKKA 2023).",
                    "K⁺ \(value) mmol/L")
        }
        return nil
    }

    // MARK: D-dimer in pregnancy (RCOG Green-top 37a/37b; NICE NG158)

    static func dDimerPregnancyRule(_ line: String, _ s: Signals, prefix: String) -> (text: String, withheld: String?)? {
        guard s.pregnancy == .pregnant,
              affirmedMention(line, ["d-dimer", "d dimer", "ddimer"]) != nil,
              !test(#"unhelpful|not used|not recommended|unreliable|do not"#, norm(line)) else { return nil }
        return ("\(prefix)⚠ PREGNANCY: D-dimer withheld — D-dimer is not recommended to diagnose VTE in pregnancy (it is unhelpful in pregnancy — RCOG GTG 37a/b); go straight to imaging: compression duplex ultrasound for DVT, CTPA or V/Q for PE.",
                "pregnancy")
    }

    // MARK: Imaging in children and pregnancy (WSES 2020; RCR iRefer; ACR 2018; ACOG CO 723)

    static func occultMalignancyScreenInPregnancyRule(_ line: String, _ s: Signals, prefix: String) -> (text: String, withheld: String?)? {
        let l = norm(line)
        guard s.pregnancy == .pregnant, test(#"occult malignan"#, l), test(#"\bct\b"#, l) else { return nil }
        return ("\(prefix)⚠ PREGNANCY: CT occult-malignancy screen withheld — imaging for weight loss only for a specific clinical question: ultrasound first, MRI if needed; no ionising occult-malignancy screen (ACOG CO 723, 2017).",
                "pregnancy")
    }

    static let childCTNote = " [Child: ultrasound first; CT only if ultrasound is inconclusive and the diagnosis is still uncertain (WSES 2020; RCR iRefer).]"
    static let pregnancyCTNote = " [Pregnancy: ultrasound first; MRI (not CT) if ultrasound is inconclusive (WSES 2020; ACR 2018).]"

    /// CT of the abdomen / pelvis in a child or in pregnancy without an ultrasound-first qualifier
    /// gets the web wording appended (the line is kept: CT remains the second step).
    static func ultrasoundFirstAnnotation(_ text: String, _ s: Signals) -> String {
        let l = norm(text)
        guard s.child || s.pregnancy == .pregnant,
              test(#"\bct\b[^\n]{0,40}(abdo|pelvi)"#, l),
              !test(#"inconclusive|non-diagnostic|equivocal|\bif us\b|\bif uss\b|child|paediatric|pregnan"#, l) else { return text }
        return text + (s.child ? childCTNote : pregnancyCTNote)
    }

    // MARK: Pre-operative clotting (NICE NG45; PAUSE; ACCP 2022)

    /// Jaundice in THIS patient: a sign or symptom, or bilirubin ≥ 34 µmol/L (web `clinicalJaundice`).
    static func clinicalJaundice(_ s: Signals) -> Bool {
        NegationMatcher.containsAnyAffirmed(s.exam, ["jaundice", "jaundiced", "icteric"])
            || NegationMatcher.containsAnyAffirmed(s.historyAll, ["jaundice", "jaundiced", "icteric"])
            || (s.bilirubin.map { $0 >= 34 } ?? false)
    }

    /// Web `coagIndicated`: an emergency operation, liver disease or a bleeding disorder, a vitamin
    /// K antagonist or heparin, or clinical jaundice. A DOAC with standard interruption needs no
    /// coagulation test.
    static func coagulationIndicated(_ s: Signals, emergency: Bool) -> Bool {
        emergency
            || ownHistoryHas(s, ["cirrhosis", "liver disease", "hepatic", "haemophilia", "hemophilia", "von willebrand",
                                 "bleeding disorder", "coagulopathy", "thrombocytopenia"])
            || !drugsPresent(s.meds, vka + ["heparin"]).isEmpty
            || clinicalJaundice(s)
    }

    // MARK: Injury on an anticoagulant (NICE NG232 2023; ACC 2020 ECDP)

    static func injuryRecorded(_ s: Signals) -> Bool {
        NegationMatcher.containsAnyAffirmed(s.historyAll, [
            "head injury", "hit her head", "hit his head", "hit my head", "hit head", "hit her forehead", "hit his forehead",
            "trauma", "road traffic", "collision", "assault", "fracture",
        ]) || NegationMatcher.testAffirmed(#"\bfell\b|\bfall (?:at home|down|from|onto|on)\b"#, s.historyAll)
    }

    /// The web injury prompt as one safety line (vitamin K antagonists and DOACs).
    static func injuryOnAnticoagulantNote(_ s: Signals) -> Note? {
        guard injuryRecorded(s), let drug = (drugsPresent(s.meds, vka) + drugsPresent(s.meds, doacs)).first else { return nil }
        let warfarin = vka.contains(drug)
        let reversal = warfarin ? "IV vitamin K + four-factor PCC" : drug == "dabigatran" ? "idarucizumab" : "andexanet alfa or four-factor PCC"
        let first = warfarin ? "INR now" : "\(drug): time of the last dose and renal function"
        return Note(kind: .anticoagulation, severity: .critical,
            text: "Injury on \(drug): exclude bleeding — \(first). Head injury on an anticoagulant: CT head within 8 hours of the injury, even without other risk factors (NICE NG232 2023). Withhold the \(drug) until bleeding is excluded. If bleeding is confirmed or the patient is unstable: \(reversal) with haematology (ACC 2020 ECDP). Elective interruption plans do not apply.")
    }

    // MARK: Operative-template lines (web shared lines)

    static let fastingLine = "Fasting: food up to 6 h and clear fluids up to 2 h before anaesthesia (AAGBI 2010; ESA 2011)."

    /// Web ANALGESIA_LINE. iOS adds pregnancy to the reasons (no NSAID proposed in pregnancy).
    static func analgesiaLine(_ s: Signals) -> String {
        var reasons = nsaidReasons(s)
        if s.pregnancy == .pregnant { reasons.append("pregnancy") }
        return reasons.isEmpty
            ? "Paracetamol 1g QDS + Ibuprofen 400mg TDS (regular) if renal function is normal."
            : "Paracetamol 1g QDS (regular); NSAIDs avoided (\(reasons.joined(separator: ", ")) — NICE NG148; BNF)."
    }

    /// Acute (not chronic) cholecystitis in the working diagnosis / assessment.
    static func acuteCholecystitis(_ s: Signals) -> Bool {
        NegationMatcher.containsAnyAffirmed(s.assessment, ["cholecystitis"]) && !s.assessment.contains("chronic cholecystitis")
    }

    /// SIGN 104 high-risk laparoscopic cholecystectomy (web `lapCholeHighRisk`).
    static func lapCholeHighRisk(_ s: Signals) -> Bool {
        acuteCholecystitis(s) || clinicalJaundice(s) || s.pregnancy == .pregnant
            || NegationMatcher.containsAnyAffirmed(s.assessment, ["pancreatitis"])
            || ownHistoryHas(s, ["immunosuppress", "transplant", "chemotherapy", "hiv"])
    }

    static func lapCholeProphylaxisLine(highRisk: Bool) -> String {
        highRisk
            ? "Antibiotic prophylaxis: single dose at induction per the local antimicrobial policy (SIGN 104 high-risk laparoscopic cholecystectomy); check the allergy record."
            : "Antibiotic prophylaxis not indicated for low-risk elective laparoscopic cholecystectomy (SIGN 104); a single dose if the operation becomes high-risk (conversion, bile spillage, cholangiography)."
    }

    static let postCholecystectomyAntibioticsLine = "Post-operative antibiotics are not needed after cholecystectomy for TG18 Grade I–II acute cholecystitis; continue only for complicated disease (gangrene, perforation, abscess) (TG18)."

    /// Web `isIncarcerated`: irreducible / incarcerated / strangulated / obstructed hernia.
    static func herniaIncarcerated(_ s: Signals) -> Bool {
        NegationMatcher.containsAnyAffirmed(NegationMatcher.joinClauses([s.exam, s.historyAll]),
                                            ["irreducible", "incarcerat", "strangulat", "obstructed", "with obstruction"])
    }

    static func herniaProphylaxisLine(incarcerated: Bool) -> String {
        incarcerated
            ? "Antibiotic prophylaxis: single dose at induction per the local antimicrobial policy (emergency repair; possible contamination); check the allergy record."
            : "Antibiotic prophylaxis: not routinely recommended for elective mesh repair in average-risk patients (HerniaSurge 2018); a single dose for high-risk patients per local policy."
    }

    /// Cirrhosis with ascites before a hernia repair (web `cirrhosisAscites`).
    static func cirrhosisAscites(_ s: Signals) -> Bool {
        ownHistoryHas(s, ["cirrhosis", "ascites", "portal hypertension", "liver failure"])
            || NegationMatcher.containsAnyAffirmed(NegationMatcher.joinClauses([s.assessment, s.exam]), ["ascites", "cirrhosis"])
    }

    static let cirrhosisHerniaLine = "Cirrhosis / ascites: hepatology optimisation first — control ascites (diuretics, paracentesis; consider TIPS), correct coagulopathy; repair as an inpatient (planned admission); urgent repair if the skin is thinning, ulcerated or leaking, or the hernia incarcerates (EHS/AHS 2020)."
    static let cirrhosisHerniaInpatientLine = "Inpatient post-operative care (cirrhosis / ascites): monitor for ascitic leak, wound breakdown, encephalopathy and renal function; drain ascites as planned with hepatology."

    // MARK: Line rules (called by adaptLine)

    /// The web-last-gaps line rules, in order. nil: the line is not affected.
    static func promptParityRule(_ line: String, _ s: Signals, prefix: String) -> (text: String, withheld: String?)? {
        dDimerPregnancyRule(line, s, prefix: prefix)
            ?? occultMalignancyScreenInPregnancyRule(line, s, prefix: prefix)
            ?? colonicStentRule(line, s, prefix: prefix)
            ?? hyperkalaemiaBandRule(line, s, prefix: prefix)
            ?? nsaidExclusionRule(line, s, prefix: prefix)
    }
}
