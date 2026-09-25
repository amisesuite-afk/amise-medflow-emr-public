import Foundation

// MARK: - Plan safety filter (Swift twin of the web plan-safety filter)
//
// DRIFT NOTE: this file is the iOS twin of `lib/pane-engine/src/management/planSafety.ts`
// (PLAN_SAFETY_VERSION 1.0.0). The rules, trigger words, thresholds and line wording follow the web
// file; the test vectors in `AmiseMedFlowTests/PlanSafetyFilterTests.swift` are ported from
// `lib/pane-engine/src/__tests__/planSafety.test.ts`. Change both files together and bump both
// versions (registry entry `ios-plan-safety-filter`).
//
// Known, deliberate differences from the web (listed for sign-off in
// docs/clinical-validation/changes/ios-plan-safety.md):
//   - iOS has no protocol object: "operative" is a radiation card with a consent category, an
//     "emergency" protocol is a card with the recognise-and-redirect line, a "bleeding" protocol
//     is a card whose name says bleeding / haemorrhage / variceal.
//   - iOS has no pregnancy field or "pregnancy possible" tick: pregnancy comes from
//     `PregnancyContext` (record text). Not documented in a woman aged 12–55 is treated like the
//     web's "possible / unknown" for the β-HCG line.
//   - After an immediate (anaphylactic) penicillin reaction iOS withholds cephalosporins and
//     carbapenems (BNF: avoid other beta-lactams after immediate penicillin hypersensitivity);
//     the web only adds a caution line. After a non-immediate reaction iOS adds the web caution.
//   - The planned procedure is read from the working diagnosis and the assessment (the web reads
//     the assessment only; iOS keeps "pre-operative assessment …" in the diagnosis).
//
// Everything is deterministic text matching and CLINICIAN-FACING only (hazard H-10). Nothing is
// sent to a patient; every line is a suggestion the surgeon reviews before the plan is signed.

enum PlanSafetyFilter {

    /// Content version (clinical-content/registry.json `ios-plan-safety-filter`).
    static let version = "1.0.0"

    // MARK: Types

    enum ProcedureKind: Equatable { case surgery, endoscopyHigh, endoscopyLow, none }

    enum Severity: Int, Comparable {
        case critical = 0, warning = 1, info = 2
        static func < (a: Severity, b: Severity) -> Bool { a.rawValue < b.rawValue }
        var label: String {
            switch self {
            case .critical: return "CRITICAL"
            case .warning:  return "WARNING"
            case .info:     return "INFO"
            }
        }
    }

    enum Kind: String {
        case allergy, pregnancy, paediatric, vte, anticoagulation, antiplatelet, diabetes, steroid, anaesthetic
        case immunosuppression, renal, haemodynamics, frailty, surgicalRisk, hormonal
    }

    struct Note: Equatable {
        let kind: Kind
        let severity: Severity
        let text: String
    }

    enum PregnancyStatus: Equatable { case pregnant, notPregnant, postpartum, unknown }

    /// What the rules read about the patient (one per plan).
    struct Signals {
        var age: Int?
        var child: Bool
        var infant: Bool
        var female: Bool
        var pregnancy: PregnancyStatus
        var gestationWeeks: Int?
        var allergy: AllergyProfile
        /// Current medicines, lowercased, joined.
        var meds: String
        /// PMH, surgical history, HPI, social history (lowercased).
        var history: String
        /// Assessment + working diagnosis + history (lowercased).
        var text: String
        /// Working diagnosis + assessment (lowercased).
        var assessment: String
        var renalImpairment: Bool
        var egfr: Double?
    }

    // MARK: Text helpers

    static func norm(_ s: String) -> String {
        s.lowercased()
            .replacingOccurrences(of: "\u{2019}", with: "'")
            .replacingOccurrences(of: "\u{2018}", with: "'")
            .replacingOccurrences(of: "\u{2013}", with: "-")
            .replacingOccurrences(of: "\u{2014}", with: "-")
    }

    static func regex(_ pattern: String) -> NSRegularExpression? {
        try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
    }

    static func test(_ pattern: String, _ text: String) -> Bool {
        guard let re = regex(pattern) else { return false }
        return re.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) != nil
    }

    /// Capture group `group` of the first match, or nil.
    static func capture(_ pattern: String, _ text: String, group: Int = 1) -> String? {
        guard let re = regex(pattern),
              let m = re.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)),
              m.numberOfRanges > group else { return nil }
        let r = m.range(at: group)
        guard r.location != NSNotFound else { return nil }
        return (text as NSString).substring(with: r)
    }

    static func replaceAll(_ pattern: String, in text: String, with template: String) -> String {
        guard let re = regex(pattern) else { return text }
        return re.stringByReplacingMatches(in: text, range: NSRange(location: 0, length: (text as NSString).length),
                                           withTemplate: template)
    }

    /// Whole-word pattern for a term (web `termRe`): spaces may be a hyphen, a space or nothing.
    static func termPattern(_ term: String) -> String {
        let body = term.lowercased().split(separator: " ").map { NSRegularExpression.escapedPattern(for: String($0)) }
            .joined(separator: "[-\\s]?")
        return "(^|[^a-z0-9])" + body + "(?=$|[^a-z0-9])"
    }

    static func anyMention(_ text: String, _ terms: [String]) -> String? {
        let t = norm(text)
        return terms.first { test(termPattern($0), t) }
    }

    private static let negationBefore =
        #"\b(?:avoid|avoiding|no|not|never|without|stop|stopped|withhold|withheld|hold|omit|contraindicated|except|instead of|rather than|nor|allergic to|non)\b[^.;:]{0,30}$"#
    /// "penicillin allergy", "NSAID-induced", "non-penicillin": the drug is named but not given.
    private static let notGivenAfter =
        #"^[\s-]*(?:allerg\w*|hypersensitiv\w*|sensitiv\w*|intoleran\w*|induced|associated|related|exposure|history|free\b)"#

    /// First affirmed (not "avoid X" / "no X" / "X allergy") mention of any term.
    static func affirmedMention(_ text: String, _ terms: [String]) -> String? {
        let t = norm(text)
        let ns = t as NSString
        for term in terms {
            guard let re = regex(termPattern(term)) else { continue }
            for m in re.matches(in: t, range: NSRange(location: 0, length: ns.length)) {
                let lead = m.range(at: 1).location == NSNotFound ? 0 : m.range(at: 1).length
                let idx = m.range.location + lead
                let end = m.range.location + m.range.length
                let from = max(0, idx - 40)
                let before = ns.substring(with: NSRange(location: from, length: idx - from))
                let after = ns.substring(with: NSRange(location: end, length: min(16, ns.length - end)))
                if test(negationBefore, before) || test(notGivenAfter, after) { continue }
                return term
            }
        }
        return nil
    }

    /// All affirmed terms found; a term inside a longer found term ("amoxiclav" in "co-amoxiclav") is named once.
    static func affirmedMentions(_ text: String, _ terms: [String]) -> [String] {
        var out: [String] = []
        for term in terms where affirmedMention(text, [term]) != nil && !out.contains(term) { out.append(term) }
        return out.filter { t in !out.contains { $0 != t && $0.contains(t) } }
    }

    private static let negatedFinding =
        #"(?:\b(?:no|not|denies|without|negative for|ruled out|excluded|cannot|could not)\b|\bcan'?t\b|\bcouldn'?t\b)[^.;]{0,25}$"#

    /// Affirmed clinical finding in free text (simple negation window, same clause).
    static func findingPresent(_ text: String, _ pattern: String) -> Bool {
        let t = norm(text)
        let ns = t as NSString
        guard let re = regex(pattern) else { return false }
        for m in re.matches(in: t, range: NSRange(location: 0, length: ns.length)) {
            let from = max(0, m.range.location - 35)
            let before = ns.substring(with: NSRange(location: from, length: m.range.location - from))
            if !test(negatedFinding, before) { return true }
        }
        return false
    }

    static func drugsPresent(_ meds: String, _ terms: [String]) -> [String] {
        terms.filter { test(termPattern($0), meds) }
    }

    // MARK: Allergy classes (BNF)

    struct AllergyClass {
        let id: String
        let label: String
        let triggers: [String]
        let members: [String]
        let caution: [String]
        let cautionText: String?
        let alternative: String
    }

    struct AllergyProfile {
        var classes: [AllergyClass] = []
        var otherDrugs: [String] = []
        var latex = false
        var chlorhexidine = false
        var contrast = false
        /// First recorded allergy text per class id.
        var recorded: [String: String] = [:]
        /// A penicillin allergy with an immediate (anaphylactic / urticarial / severe) reaction.
        var immediatePenicillin = false
    }

    /// The existing iOS allergy class lists (DiagnosisRadiationEngine.drugClasses) merged with the web lists.
    private static func iosMembers(_ name: String) -> [String] {
        DiagnosisRadiationEngine.drugClasses.first { $0.name == name }?.members ?? []
    }

    private static func merged(_ web: [String], _ iosName: String) -> [String] {
        var out = web
        for m in iosMembers(iosName) where !out.contains(m) { out.append(m) }
        return out
    }

    static let penicillins = ["penicillin", "penicillins", "amoxicillin", "amoxycillin", "co-amoxiclav", "amoxiclav", "augmentin",
                              "flucloxacillin", "ampicillin", "piperacillin", "piperacillin-tazobactam", "pip-tazo", "tazocin",
                              "benzylpenicillin", "phenoxymethylpenicillin", "temocillin", "pivmecillinam"]
    static let cephalosporins = ["cephalosporin", "cephalosporins", "cefuroxime", "ceftriaxone", "cefalexin", "cephalexin", "cefazolin",
                                 "cefotaxime", "ceftazidime", "cefixime", "cefaclor", "cefradine", "cefepime"]
    static let carbapenems = ["carbapenem", "meropenem", "imipenem", "ertapenem"]
    static let nsaids = ["nsaid", "nsaids", "ibuprofen", "diclofenac", "naproxen", "ketorolac", "celecoxib", "parecoxib",
                         "etoricoxib", "mefenamic acid", "indometacin", "indomethacin"]
    static let opioids = ["morphine", "codeine", "oxycodone", "tramadol", "pethidine", "fentanyl", "dihydrocodeine", "diamorphine"]
    static let heparins = ["heparin", "unfractionated heparin", "lmwh", "enoxaparin", "dalteparin", "tinzaparin"]

    static let allergyClasses: [AllergyClass] = {
        let pen = merged(penicillins, "penicillin")
        let ceph = merged(cephalosporins, "cephalosporin")
        let nsaid = merged(nsaids, "NSAID")
        return [
            AllergyClass(id: "penicillin", label: "penicillin", triggers: pen + ["beta-lactam", "β-lactam"], members: pen,
                         caution: ceph + carbapenems,
                         cautionText: "Penicillin allergy recorded: check the reaction type — after an immediate (anaphylactic) penicillin reaction avoid cephalosporins and carbapenems unless there is no alternative (BNF).",
                         alternative: "Choose a non-penicillin regimen per local antimicrobial policy / microbiology advice (check the reaction type — BNF)."),
            AllergyClass(id: "cephalosporin", label: "cephalosporin", triggers: ceph, members: ceph, caution: [], cautionText: nil,
                         alternative: "Choose a non-cephalosporin regimen per local antimicrobial policy / microbiology advice."),
            AllergyClass(id: "carbapenem", label: "carbapenem", triggers: carbapenems, members: carbapenems, caution: [], cautionText: nil,
                         alternative: "Choose a non-carbapenem regimen per microbiology advice."),
            AllergyClass(id: "macrolide", label: "macrolide", triggers: merged(["macrolide", "clarithromycin", "erythromycin", "azithromycin"], "macrolide"),
                         members: ["clarithromycin", "erythromycin", "azithromycin"], caution: [], cautionText: nil,
                         alternative: "Choose a non-macrolide alternative per local policy."),
            AllergyClass(id: "fluoroquinolone", label: "fluoroquinolone",
                         triggers: merged(["quinolone", "fluoroquinolone", "ciprofloxacin", "levofloxacin", "moxifloxacin", "ofloxacin"], "fluoroquinolone"),
                         members: ["ciprofloxacin", "levofloxacin", "moxifloxacin", "ofloxacin"], caution: [], cautionText: nil,
                         alternative: "Choose a non-quinolone alternative per local policy."),
            AllergyClass(id: "tetracycline", label: "tetracycline", triggers: ["tetracycline", "doxycycline", "lymecycline", "minocycline"],
                         members: ["tetracycline", "doxycycline", "lymecycline", "minocycline"], caution: [], cautionText: nil,
                         alternative: "Choose a non-tetracycline alternative per local policy."),
            AllergyClass(id: "sulfonamide", label: "sulfonamide",
                         triggers: merged(["sulfa", "sulpha", "sulfonamide", "sulphonamide", "co-trimoxazole", "sulfamethoxazole"], "sulfonamide"),
                         members: ["co-trimoxazole", "cotrimoxazole", "sulfamethoxazole", "sulfasalazine", "trimethoprim-sulfamethoxazole"],
                         caution: [], cautionText: nil,
                         alternative: "Choose a non-sulfonamide alternative per local policy."),
            AllergyClass(id: "nitroimidazole", label: "metronidazole", triggers: ["metronidazole", "tinidazole"], members: ["metronidazole", "tinidazole"],
                         caution: [], cautionText: nil, alternative: "Anaerobic cover without metronidazole per microbiology advice."),
            AllergyClass(id: "aminoglycoside", label: "aminoglycoside", triggers: ["gentamicin", "amikacin", "tobramycin", "aminoglycoside"],
                         members: ["gentamicin", "amikacin", "tobramycin"], caution: [], cautionText: nil,
                         alternative: "Choose a non-aminoglycoside alternative per local policy."),
            AllergyClass(id: "glycopeptide", label: "glycopeptide", triggers: ["vancomycin", "teicoplanin"], members: ["vancomycin", "teicoplanin"],
                         caution: [], cautionText: nil, alternative: "Choose an alternative per microbiology advice."),
            AllergyClass(id: "clindamycin", label: "clindamycin", triggers: ["clindamycin"], members: ["clindamycin"],
                         caution: [], cautionText: nil, alternative: "Choose an alternative per microbiology advice."),
            // BNF: NSAIDs are contra-indicated after hypersensitivity to aspirin or any other NSAID.
            AllergyClass(id: "nsaid", label: "NSAID / aspirin", triggers: nsaid + ["aspirin"], members: nsaid + ["aspirin"],
                         caution: [], cautionText: nil,
                         alternative: "Paracetamol-based analgesia; no NSAID (BNF: contra-indicated after aspirin/NSAID hypersensitivity)."),
            AllergyClass(id: "opioid", label: "opioid", triggers: merged(opioids, "opioid"), members: opioids, caution: [], cautionText: nil,
                         alternative: "Check the reaction type (intolerance vs true allergy); choose an alternative analgesic with the anaesthetist/pharmacist."),
            AllergyClass(id: "heparin", label: "heparin", triggers: heparins + ["hit", "heparin-induced thrombocytopenia"], members: heparins,
                         caution: [], cautionText: nil,
                         alternative: "Heparin allergy / HIT: non-heparin anticoagulant (e.g. fondaparinux or argatroban) per haematology advice."),
        ]
    }()

    private static let noAllergy = #"^(nkda|nka|none|nil|no known (drug )?allerg\w*|no allerg\w*)$"#
    private static let immediateReactionWords = ["anaphyla", "angio", "urticaria", "hives", "collapse", "bronchospasm", "swelling", "wheeze"]

    static func allergyProfile(_ allergies: [AllergyEntry]) -> AllergyProfile {
        var p = AllergyProfile()
        for entry in allergies where entry.name != Patient.nkdaMarkerName {
            let recordedText = entry.reaction.isEmpty ? entry.name : "\(entry.name) (\(entry.reaction))"
            for part in entry.name.components(separatedBy: CharacterSet(charactersIn: ",;\n")) {
                let a = norm(part).trimmingCharacters(in: .whitespaces)
                if a.isEmpty || test(noAllergy, a) { continue }
                var matched = false
                for cls in allergyClasses where anyMention(a, cls.triggers) != nil {
                    matched = true
                    if !p.classes.contains(where: { $0.id == cls.id }) { p.classes.append(cls) }
                    if p.recorded[cls.id] == nil { p.recorded[cls.id] = recordedText }
                    if cls.id == "penicillin" {
                        let reaction = norm(entry.reaction)
                        if norm(entry.severity) == "severe" || immediateReactionWords.contains(where: { reaction.contains($0) }) {
                            p.immediatePenicillin = true
                        }
                    }
                }
                if anyMention(a, ["latex"]) != nil { p.latex = true; matched = true }
                if anyMention(a, ["chlorhexidine"]) != nil { p.chlorhexidine = true; matched = true }
                if anyMention(a, ["contrast", "iodinated contrast", "iodine", "radiocontrast", "x-ray dye"]) != nil { p.contrast = true; matched = true }
                if !matched {
                    let name = replaceAll(#"\(.*?\)|\ballergy\b|\ballergic\b|\bintolerance\b|\banaphylaxis\b"#, in: a, with: "")
                        .trimmingCharacters(in: .whitespaces)
                    if name.count >= 4 { p.otherDrugs.append(name) }
                }
            }
        }
        return p
    }

    // MARK: Medicines on record

    static let vka = ["warfarin", "acenocoumarol", "phenindione"]
    static let doacs = ["apixaban", "rivaroxaban", "edoxaban", "dabigatran"]
    static let p2y12 = ["clopidogrel", "prasugrel", "ticagrelor"]
    static let aspirin = ["aspirin"]
    static let sglt2 = ["sglt2", "sglt-2", "empagliflozin", "dapagliflozin", "canagliflozin", "ertugliflozin", "sotagliflozin"]
    static let sulfonylureas = ["gliclazide", "glipizide", "glimepiride", "glibenclamide", "tolbutamide", "sulfonylurea", "sulphonylurea"]
    static let insulins = ["insulin", "glargine", "detemir", "degludec", "lantus", "levemir", "tresiba", "humulin", "novomix", "isophane",
                           "aspart", "lispro", "actrapid", "novorapid"]
    static let steroids = ["prednisolone", "prednisone", "hydrocortisone", "dexamethasone", "methylprednisolone", "fludrocortisone"]
    static let immunosuppressants = ["tacrolimus", "ciclosporin", "cyclosporine", "mycophenolate", "azathioprine", "methotrexate", "sirolimus",
                                     "adalimumab", "infliximab", "etanercept", "vedolizumab", "ustekinumab", "tocilizumab", "rituximab",
                                     "cyclophosphamide", "chemotherapy", "capecitabine", "oxaliplatin", "fluorouracil"]
    static let betaBlockers = ["bisoprolol", "metoprolol", "atenolol", "carvedilol", "propranolol", "nebivolol", "labetalol", "sotalol"]
    static let oestrogens = ["combined oral contraceptive", "combined pill", "cocp", "coc", "ethinylestradiol", "oestrogen", "estrogen",
                             "estradiol", "hrt", "hormone replacement"]

    // MARK: Signals

    static func signals(_ c: RadiationContext) -> Signals {
        let age = c.ageYears
        let meds = norm(c.medications.joined(separator: " ; "))
        let history = norm([c.pmhText, c.freeText].joined(separator: " ; "))
        let assessment = norm(NegationMatcher.joinClauses([c.diagnosis, c.assessment]))
        let text = [assessment, history].joined(separator: " ; ")
        let renal = (c.egfr.map { $0 < 30 } ?? false)
            || findingPresent(text, #"\b(aki|acute kidney injury|anuri\w*|oligur\w*|solitary kidney|single kidney|ckd (?:stage )?(?:4|5|iv|v)\b|end-stage renal|esrf|eskd|dialysis|haemodialysis|hemodialysis)\b"#)
        // Pregnancy: the record (PregnancyContext) first; then what the text rules out.
        var status: PregnancyStatus = .unknown
        if c.sex == .male {
            status = .notPregnant
        } else if c.pregnancy.isPregnant {
            status = .pregnant
        } else if test(#"\b(post-?partum|puerper\w*|after delivery|since delivery)\b"#, text) {
            status = .postpartum
        } else if test(#"\bpregnancy test (?:is |was )?negative\b|\bnegative (?:urine |serum )?(?:pregnancy test|β-?hcg|b-?hcg|beta-?hcg|hcg)\b|\bnot pregnant\b|\bpost-?menopausal\b|\btotal (?:abdominal )?hysterectomy\b"#, text) {
            status = .notPregnant
        }
        return Signals(
            age: age,
            child: age.map { $0 < 16 } ?? false,
            infant: age.map { $0 < 1 } ?? false,
            female: c.sex == .female,
            pregnancy: status,
            gestationWeeks: status == .pregnant ? c.pregnancy.gestationWeeks : nil,
            allergy: allergyProfile(c.allergies),
            meds: meds,
            history: history,
            text: text,
            assessment: assessment,
            renalImpairment: renal,
            egfr: c.egfr)
    }

    // MARK: Line filter (allergy, pregnancy, renal, paediatric)

    static let paediatricHernia = "⚠ CHILD (under 16): adult hernia technique withheld — paediatric inguinal hernia is repaired by open herniotomy (no mesh) by a paediatric surgeon; in infants repair promptly because of the incarceration risk."

    private static let pregnancyAvoid: [(terms: [String], reason: String)] = [
        (["doxycycline", "tetracycline", "lymecycline", "minocycline"], "tetracyclines are avoided in pregnancy (BNF)"),
        (["ciprofloxacin", "levofloxacin", "moxifloxacin", "ofloxacin"], "quinolones are avoided in pregnancy (BNF)"),
        (["methotrexate"], "methotrexate is contraindicated in pregnancy (BNF)"),
        (["ramipril", "lisinopril", "enalapril", "perindopril", "losartan", "candesartan", "valsartan"], "ACE-i / ARB drugs are avoided in pregnancy (BNF)"),
        (["atorvastatin", "simvastatin", "rosuvastatin"], "statins are avoided in pregnancy (BNF)"),
        (["trimethoprim"], "trimethoprim is avoided in the first trimester (folate antagonist — BNF, NICE NG111)"),
        (["tamoxifen", "anastrozole", "letrozole", "exemestane"], "endocrine therapy (tamoxifen, aromatase inhibitors) is contraindicated in pregnancy — breast cancer in pregnancy is planned with the obstetric and oncology MDT (BNF; RCOG GTG 12)"),
        (["trastuzumab", "pertuzumab", "herceptin"], "HER2-targeted antibodies are avoided in pregnancy (oligohydramnios — BNF/SPC)"),
        (["radioiodine", "i-131"], "radioiodine is contraindicated in pregnancy (BNF)"),
    ]

    /// Applies the drug filters to one plan line. Lines already written by a filter ("⚠ …") are kept.
    /// `pregnancySpecific`: an obstetric card (its drugs are chosen for pregnancy).
    /// `paediatricDosing`: a card written with paediatric doses (e.g. RCUK 2021 anaphylaxis).
    static func adaptLine(_ line: String, _ s: Signals, pregnancySpecific: Bool = false, paediatricDosing: Bool = false,
                          herniaCard: Bool = false) -> (text: String, withheld: String?) {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty || trimmed.contains("⚠") { return (line, nil) }
        let lead = String(line.prefix { $0 == " " || $0 == "-" || $0 == "•" })
        // Safety header lines written by the filters name drugs only to rule them out.
        let body = trimmed.drop { $0 == "-" || $0 == "•" || $0 == " " }
        if ["PREGNANT", "ALLERGY CROSS-CHECK", "CHILD (under 16)", "PATIENT-SPECIFIC SAFETY", "[CRITICAL]", "[WARNING]", "[INFO]"]
            .contains(where: { body.hasPrefix($0) }) { return (line, nil) }
        let prefix = lead.isEmpty ? "" : lead

        // Allergy (class-aware), then other named drugs.
        for cls in s.allergy.classes {
            let hits = affirmedMentions(line, cls.members)
            if !hits.isEmpty {
                let recorded = s.allergy.recorded[cls.id] ?? cls.label
                return ("\(prefix)⚠ ALLERGY — \(cls.label) allergy recorded (\(recorded)): withheld (contains \(hits.joined(separator: ", "))). Alternative: \(cls.alternative)",
                        "allergy: \(recorded)")
            }
        }
        if s.allergy.immediatePenicillin {
            let hits = affirmedMentions(line, cephalosporins + carbapenems)
            if !hits.isEmpty {
                let recorded = s.allergy.recorded["penicillin"] ?? "penicillin"
                return ("\(prefix)⚠ ALLERGY — immediate penicillin reaction recorded (\(recorded)): withheld (contains \(hits.joined(separator: ", "))) — avoid other beta-lactams after immediate penicillin hypersensitivity (BNF). Alternative: choose a non-beta-lactam regimen per microbiology advice.",
                        "allergy: \(recorded)")
            }
        }
        for drug in s.allergy.otherDrugs where affirmedMention(line, [drug]) != nil {
            return ("\(prefix)⚠ ALLERGY — \(drug) recorded: withheld (contains \(drug)). Choose an alternative.", "allergy: \(drug)")
        }

        if s.pregnancy == .pregnant && !pregnancySpecific {
            let anticoag = affirmedMentions(line, doacs + vka + ["doac", "doacs"])
            if !anticoag.isEmpty {
                return ("\(prefix)⚠ PREGNANCY: withheld (contains \(anticoag.joined(separator: ", "))) — DOACs and warfarin are contraindicated in pregnancy (warfarin is teratogenic). Use weight-adjusted LMWH for treatment and prophylaxis (RCOG Green-top 37a/37b, 2015).",
                        "pregnancy")
            }
            let nsaid = affirmedMentions(line, nsaids)
            if !nsaid.isEmpty && (s.gestationWeeks ?? 20) >= 20 {
                let when = s.gestationWeeks.map { "\($0) weeks" } ?? "gestation not recorded"
                return ("\(prefix)⚠ PREGNANCY (\(when)): withheld (contains \(nsaid.joined(separator: ", "))) — avoid NSAIDs from 20 weeks' gestation (FDA Drug Safety Communication 2020; BNF). Use paracetamol ± an opioid.",
                        "pregnancy ≥ 20 weeks")
            }
            for rule in pregnancyAvoid {
                let hits = affirmedMentions(line, rule.terms)
                if hits.isEmpty { continue }
                if rule.terms.contains("trimethoprim"), let w = s.gestationWeeks, w >= 13 { continue }
                return ("\(prefix)⚠ PREGNANCY: withheld (contains \(hits.joined(separator: ", "))) — \(rule.reason). Choose a pregnancy-compatible alternative with the obstetric team / pharmacist.",
                        "pregnancy")
            }
        }

        if s.renalImpairment {
            let nsaid = affirmedMentions(line, nsaids)
            if !nsaid.isEmpty {
                return ("\(prefix)⚠ RENAL: withheld (contains \(nsaid.joined(separator: ", "))) — NSAIDs contraindicated in AKI, severe CKD or a solitary obstructed kidney (NICE NG148 2019; BNF). Use paracetamol ± an opioid.",
                        "renal impairment")
            }
        }

        var text = line
        if s.pregnancy == .pregnant && !pregnancySpecific, let w = s.gestationWeeks, w < 20 {
            let nsaid = affirmedMentions(line, nsaids)
            if !nsaid.isEmpty {
                text += " [Pregnancy (\(w) weeks): \(nsaid.joined(separator: ", ")) only if the benefit outweighs the risk and never from 20 weeks — prefer paracetamol ± an opioid (BNF).]"
            }
        }
        if s.pregnancy == .pregnant && affirmedMention(line, ["ercp"]) != nil && !norm(line).contains("fluoroscop") {
            text += " [Pregnancy: minimise fluoroscopy time and shield the fetus; obstetric involvement (ASGE 2012 endoscopy in pregnancy).]"
        }

        if s.child {
            let lower = norm(line)
            if test(#"\b(mesh|lichtenstein|tep|tapp|truss)\b"#, lower)
                && (herniaCard || test(#"hernia|herniorrhaphy|lichtenstein|\btep\b|\btapp\b|truss"#, lower)) {
                return (prefix + paediatricHernia, "adult hernia technique")
            }
            if !paediatricDosing { text = DiagnosisRadiationEngine.suppressAdultDoses(text) }
        }
        return (text, nil)
    }

    /// Line filter over a multi-line text (each line separately).
    static func adaptText(_ text: String, _ s: Signals, pregnancySpecific: Bool = false, paediatricDosing: Bool = false,
                          herniaCard: Bool = false) -> String {
        var seen: [String] = []
        var out: [String] = []
        for line in text.components(separatedBy: "\n") {
            let v = adaptLine(line, s, pregnancySpecific: pregnancySpecific, paediatricDosing: paediatricDosing, herniaCard: herniaCard)
            // Two lines replaced by the same filter line are shown once.
            if v.text != line {
                if seen.contains(v.text) { continue }
                seen.append(v.text)
            }
            out.append(v.text)
        }
        return out.joined(separator: "\n")
    }

    // MARK: Procedure context

    static let highRiskEndoscopy = #"\b(polypectomy|emr|endoscopic mucosal resection|esd|submucosal dissection|sphincterotomy|ampullectomy|dilat(?:ation|ion)|peg|gastrostomy|eus[- ]?(?:guided\s+)?(?:fna|fnb)|fine[- ]needle|cystgastrostomy|band ligation|variceal banding)\b"#
    static let lowRiskEndoscopy = #"\b(ogd|gastroscopy|colonoscopy|sigmoidoscopy|endoscopy|oesophagogastroduodenoscopy|capsule endoscopy|enteroscopy|biliary stent\w*|ercp|eus)\b"#
    static let surgeryWords = #"\b(\w+ectomy|\w+otomy|\w+plasty|repair|laparoscop\w*|laparotomy|resection|excision|anastomosis|herniotomy|herniorrhaphy|fundoplication|surgery|surgical|operation|operative|theatre)\b"#

    /// Wording that names surgery without planning it ("surgical review", "no surgery", "day 4 after
    /// right hemicolectomy", "post-thyroidectomy").
    static let notAPlannedOperation = [
        #"\b(?:surgical|surgery|surgeon)\s+(?:review|assessment|opinion|referral|team|input|consult\w*|on-call|clinic|follow-up)\b"#,
        #"\b(?:no|not for|without|avoid|declin\w*)\s+(?:\w+\s){0,2}?(?:surgery|operation|resection|repair)\b"#,
        #"\b(?:day\s+\d+\s+)?(?:after|following|since|post[- ]?op\w*\s+(?:from|after)?)\s+(?:an?\s+|the\s+|his\s+|her\s+)?(?:\w+[\s-]){0,3}?\w*(?:ectomy|otomy|plasty|repair|surgery|operation|resection|anastomosis)\b"#,
        #"\bpost[- ]?\w*(?:ectomy|otomy|operative)\b"#,
        #"\bsurgical (?:history|site infection)\b"#,
    ].joined(separator: "|")

    static func operationWordsIn(_ text: String) -> Bool {
        test(surgeryWords, replaceAll(notAPlannedOperation, in: norm(text), with: " "))
    }

    /// The planned procedure, read from the working diagnosis and assessment (not the history).
    static func procedure(_ s: Signals, operative: Bool) -> ProcedureKind {
        let a = replaceAll(notAPlannedOperation, in: s.assessment, with: " ")
        if test(highRiskEndoscopy, a) { return .endoscopyHigh }
        if test(surgeryWords, a) { return .surgery }
        if test(lowRiskEndoscopy, a) { return .endoscopyLow }
        return operative ? .surgery : .none
    }

    /// "low bleeding-risk procedure", "risk of bleeding", "bleeding history" — not active bleeding.
    static let notActiveBleeding = #"\b(?:(?:low|high|moderate|increased|minimal)[- ])?bleed(?:ing)?[- ]risk\b|\brisk of (?:\w+ )?(?:bleed\w*|haemorrhag\w*|hemorrhag\w*)|\bbleeding (?:history|disorder|tendency|problems?)\b|\bpost[- ]?(?:polypectomy|procedure) bleed\w* risk\b"#
    static let acuteIllnessText = #"\b(sepsis|septic|shock|hypotensi\w*|acute kidney injury|aki|ketoacidosis|dka|hhs|peritonitis|emergency|lactate\s*[4-9])\b"#
    static let bleedingText = #"\b(haemoperitoneum|hemoperitoneum|haemorrhag\w*|hemorrhag\w*|bleed\w*|haematemesis|hematemesis|melaena|melena|haematochezia|haematoma|hematoma|haemothorax|hemothorax|haematuria|hematuria|intracranial|head injury|subdural|extradural)\b"#

    static func activeBleeding(_ s: Signals) -> Bool {
        findingPresent(replaceAll(notActiveBleeding, in: s.assessment, with: " "), bleedingText)
    }

    static func emergencyText(_ s: Signals) -> Bool {
        findingPresent(s.assessment, #"\b(emergency|emergent|urgent (?:surgery|laparotomy|operation))\b"#)
    }

    // MARK: Coronary stent timing

    static let coronaryStent = #"\b(des|drug[- ]eluting|bare[- ]metal|pci|coronary stent\w*|coronary angioplasty|stent\w*(?=[^.;]{0,40}\b(?:coronary|cardiac|lad|rca|circumflex|nstemi|stemi|acs|mi|angina)\b)|(?:coronary|cardiac|lad|rca|nstemi|stemi|acs)[^.;]{0,40}\bstent\w*)\b"#
    static let acsText = #"\b(nstemi|stemi|acute coronary syndrome|acs|myocardial infarction|heart attack|unstable angina)\b"#

    static func stentInfo(_ text: String) -> (present: Bool, months: Double?, acs: Bool) {
        let t = norm(text)
        let ns = t as NSString
        guard let re = regex(coronaryStent),
              let m = re.firstMatch(in: t, range: NSRange(location: 0, length: ns.length)) else { return (false, nil, false) }
        let from = max(0, m.range.location - 80)
        let to = min(ns.length, m.range.location + 120)
        let window = ns.substring(with: NSRange(location: from, length: to - from))
        var months: Double?
        if let n = capture(#"\b(\d{1,2})\s*(months?|weeks?|days?)\b"#, window).flatMap({ Double($0) }),
           let unit = capture(#"\b(\d{1,2})\s*(months?|weeks?|days?)\b"#, window, group: 2) {
            months = unit.hasPrefix("month") ? n : unit.hasPrefix("week") ? n / 4.345 : n / 30.4
        }
        return (true, months, test(acsText, window) || test(acsText, t))
    }
}
