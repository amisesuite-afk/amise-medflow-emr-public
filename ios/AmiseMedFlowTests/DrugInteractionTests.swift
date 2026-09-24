import XCTest
@testable import AmiseMedFlow

/// Drug-interaction screen — hazard log H-07 (false reassurance).
/// Services/DrugInteractionService.swift + Services/DrugClasses.swift. Pure: no SwiftData.
///
/// 1. Lint: every term a rule uses is defined in `DrugClasses.terms`, and every class has members.
/// 2. Class-based rules fire on real prescription strings (generics, old INNs, brands).
/// 3. Whole-word matching ("ASA" is not "nasal"), pairing, merging and severity order.
/// 4. Never-remove invariant: every alert the pre-H-07 engine raised still fires, for the same
///    medication pair, with the same effect at the same or higher severity.
final class DrugInteractionTests: XCTestCase {

    private typealias Alert = DrugInteractionAlert

    private func check(_ meds: [String]) -> [Alert] {
        DrugInteractionService.check(drugs: meds)
    }

    /// The alert for the pair whose entries contain `a` and `b` (case-insensitive), either order.
    private func find(_ meds: [String], _ a: String, _ b: String) -> Alert? {
        check(meds).first { alert in
            let x = alert.drugA.lowercased(), y = alert.drugB.lowercased()
            return (x.contains(a) && y.contains(b)) || (x.contains(b) && y.contains(a))
        }
    }

    private func allRules(_ alert: Alert) -> [DrugInteraction] {
        [alert.interaction] + alert.related
    }

    // MARK: - 1. Lint

    private var ruleTerms: [String] {
        var seen: [String] = []
        for rule in DrugInteractionService.rules {
            for t in [rule.drug1Pattern, rule.drug2Pattern] where !seen.contains(t) { seen.append(t) }
        }
        return seen
    }

    func testEveryRuleTermIsMapped() {
        let unmapped = ruleTerms.filter { DrugClasses.terms[$0] == nil }
        XCTAssertEqual(unmapped, [], "unmapped rule terms: \(unmapped.joined(separator: ", "))")
    }

    func testEveryClassUsedByARuleHasMembers() {
        for term in ruleTerms {
            guard let def = DrugClasses.terms[term] else { XCTFail("\(term) not mapped"); continue }
            XCTAssertFalse(def.members.isEmpty, "\(term) has no members")
            for member in def.members {
                XCTAssertFalse(DrugClasses.parseMember(member).generic.isEmpty, "\(term): empty member")
            }
        }
    }

    func testEveryTermCitesItsSource() {
        for (term, def) in DrugClasses.terms {
            XCTAssertFalse(def.source.isEmpty, "\(term) has no source")
            XCTAssertFalse(def.label.isEmpty, "\(term) has no label")
            XCTAssertFalse(def.members.isEmpty, "\(term) has no members")
        }
    }

    func testEveryMemberMatchesItsOwnTerm() {
        for (term, def) in DrugClasses.terms {
            for member in def.members {
                for name in DrugClasses.parseMember(member).names {
                    XCTAssertNotNil(DrugClasses.match(term: term, in: "\(name) 10 mg"), "\(term) <- \(name)")
                }
            }
        }
    }

    func testRuleTermsAreLowercase() {
        for term in ruleTerms { XCTAssertEqual(term, term.lowercased()) }
    }

    func testOriginalRuleBlockIsIntactAtTheHead() {
        let rules = DrugInteractionService.rules
        let n = DrugInteractionService.originalRuleCount
        XCTAssertEqual(n, 27)
        XCTAssertGreaterThan(rules.count, n)
        XCTAssertEqual(rules[0].drug1Pattern, "warfarin")
        XCTAssertEqual(rules[0].drug2Pattern, "nsaid")
        XCTAssertEqual(rules[n - 1].drug1Pattern, "ondansetron")
        XCTAssertEqual(rules[n - 1].drug2Pattern, "fluconazole")
        XCTAssertEqual(rules[n - 1].severity, .moderate)
    }

    func testOnlyLegacyTermsKeepSubstringMatching() {
        let legacy = DrugInteractionService.legacyTerms
        for t in ["warfarin", "nsaid", "ssri", "snri", "opioid", "benzodiazepine", "ace inhibitor", "contrast"] {
            XCTAssertTrue(legacy.contains(t), t)
        }
        for t in ["arb", "anticoagulant", "antiplatelet", "maoi", "qt prolonging", "potassium"] {
            XCTAssertFalse(legacy.contains(t), t)
        }
    }

    // MARK: - 2. Headline cases

    func testWarfarinPlusDiclofenacAlertsViaNSAIDClass() {
        let meds = ["Warfarin 5 mg od", "Diclofenac 50 mg tds"]
        guard let alert = find(meds, "warfarin", "diclofenac") else { return XCTFail("no alert") }
        XCTAssertEqual(alert.interaction.severity, .major)
        XCTAssertTrue(alert.interaction.clinicalEffect.lowercased().contains("bleeding"))
        XCTAssertEqual(alert.viaClassB, "NSAID")
        XCTAssertEqual(alert.pairDisplay, "Warfarin 5 mg od + Diclofenac 50 mg tds (NSAID)")
        XCTAssertEqual(check(meds).count, 1, "one alert per medication pair")
    }

    func testTramadolPlusSertralineAlerts() {
        guard let alert = find(["Tramadol 50mg qds prn", "Sertraline 100mg od"], "tramadol", "sertraline")
        else { return XCTFail("no alert") }
        XCTAssertEqual(alert.interaction.severity, .major)
        XCTAssertTrue(alert.interaction.clinicalEffect.lowercased().contains("serotonin"))
        XCTAssertEqual(alert.viaClassB, "SSRI")
    }

    func testMorphinePlusDiazepamAlerts() {
        guard let alert = find(["Morphine sulfate 10mg", "Diazepam 5mg nocte"], "morphine", "diazepam")
        else { return XCTFail("no alert") }
        XCTAssertEqual(alert.interaction.severity, .major)
        XCTAssertTrue(alert.interaction.clinicalEffect.lowercased().contains("respiratory depression"))
        XCTAssertEqual(alert.viaClassA, "opioid")
        XCTAssertEqual(alert.viaClassB, "benzodiazepine")
    }

    // MARK: - Per class

    /// (label, medication list, lowercase text expected in the headline or a related effect)
    private let perClassCases: [(String, [String], String)] = [
        // NSAIDs (generics, old INNs, brands)
        ("warfarin + Voltaren", ["Coumadin 3mg", "Voltaren 75mg"], "bleeding"),
        ("warfarin + indomethacin PR", ["warfarin", "indomethacin 100mg PR"], "bleeding"),
        ("methotrexate + Advil", ["methotrexate 15mg weekly", "Advil 400mg"], "methotrexate toxicity"),
        ("gentamicin + naproxen", ["gentamicin 5mg/kg", "naproxen 500mg bd"], "nephrotoxicity"),
        // Anticoagulants: DOACs and heparins
        ("Xarelto + naproxen", ["Xarelto 20mg", "naproxen 250mg"], "bleeding"),
        ("apixaban + ketorolac", ["apixaban 5mg bd", "ketorolac 10mg"], "bleeding"),
        ("dabigatran + celecoxib", ["Pradaxa 150mg", "Celebrex 200mg"], "bleeding"),
        ("Clexane + diclofenac", ["Clexane 40mg sc", "diclofenac 50mg"], "bleeding"),
        ("tinzaparin + ibuprofen", ["tinzaparin 4500 units", "ibuprofen 400mg"], "bleeding"),
        ("Toradol + Lovenox", ["Toradol 10mg", "Lovenox 40mg"], "haemorrhage"),
        // Antiplatelets
        ("warfarin + Plavix", ["warfarin", "Plavix 75mg"], "bleeding"),
        ("rivaroxaban + ASA", ["rivaroxaban", "ASA 81 mg"], "bleeding"),
        ("apixaban + ticagrelor", ["Eliquis", "Brilinta 90mg"], "bleeding"),
        // SSRIs / SNRIs
        ("warfarin + citalopram", ["warfarin", "citalopram 20mg"], "bleeding"),
        ("tramadol + Prozac", ["Ultram 50mg", "Prozac 20mg"], "serotonin"),
        ("tramadol + Effexor", ["tramadol", "Effexor XR 75mg"], "serotonin"),
        ("tramadol + duloxetine", ["Zydol 50mg", "duloxetine 60mg"], "serotonin"),
        ("naproxen + duloxetine", ["naproxen", "duloxetine 60mg"], "gi bleeding"),
        ("ibuprofen + escitalopram", ["ibuprofen", "Lexapro 10mg"], "gi bleeding"),
        // MAOIs
        ("linezolid + sertraline", ["linezolid 600mg bd", "sertraline"], "serotonin"),
        ("methylene blue + fluoxetine", ["methylene blue 1mg/kg IV", "fluoxetine 20mg"], "serotonin"),
        ("phenelzine + venlafaxine", ["phenelzine 15mg", "venlafaxine"], "serotonin"),
        // Opioids + benzodiazepines / gabapentinoids
        ("fentanyl + lorazepam", ["Sublimaze 50mcg", "Ativan 1mg"], "respiratory"),
        ("oxycodone + alprazolam", ["OxyContin 10mg", "Xanax 0.5mg"], "respiratory"),
        ("co-codamol + diazepam", ["co-codamol 30/500", "Valium 5mg"], "respiratory"),
        ("morphine + Hypnovel", ["morphine 10mg", "Hypnovel 2mg"], "respiratory"),
        ("fentanyl + Versed", ["Durogesic 25mcg/h patch", "Versed 2mg"], "respiratory"),
        ("oxycodone + pregabalin", ["oxycodone 5mg", "Lyrica 75mg"], "respiratory"),
        ("morphine + gabapentin", ["morphine", "gabapentin 300mg"], "respiratory"),
        // QT-prolonging drugs
        ("ondansetron + azithromycin", ["Zofran 4mg", "azithromycin 500mg"], "qt"),
        ("haloperidol + erythromycin", ["haloperidol 0.5mg", "erythromycin"], "qt"),
        ("domperidone + citalopram", ["Motilium 10mg", "Celexa 20mg"], "qt"),
        ("ondansetron + Cipro", ["ondansetron", "Cipro 500mg"], "qt"),
        // ACE inhibitors / ARBs / potassium-sparing diuretics / potassium
        ("ramipril + spironolactone", ["ramipril 5mg", "spironolactone 25mg"], "hyperkalaemia"),
        ("losartan + amiloride", ["losartan 50mg", "amiloride 5mg"], "hyperkalaemia"),
        ("valsartan + potassium chloride", ["Diovan 80mg", "potassium chloride 600mg"], "hyperkalaemia"),
        ("Entresto + Slow-K", ["Entresto 49/51mg", "Slow-K 600mg"], "hyperkalaemia"),
        ("lisinopril + ibuprofen", ["lisinopril 10mg", "ibuprofen 400mg"], "kidney"),
        ("Coversyl + naproxen", ["Coversyl 4mg", "naproxen"], "kidney"),
        ("candesartan + diclofenac", ["candesartan 8mg", "diclofenac"], "kidney"),
        // Aminoglycosides
        ("gentamicin + Lasix", ["gentamicin 5mg/kg", "Lasix 40mg"], "hearing loss"),
        ("gentamicin + frusemide", ["gentamicin", "frusemide 40mg"], "hearing loss"),
        ("gentamicin + Vancocin", ["gentamicin", "Vancocin 1g"], "kidney"),
        // Warfarin potentiation: macrolides / azoles / metronidazole
        ("warfarin + clarithromycin", ["warfarin", "clarithromycin 500mg bd"], "inr"),
        ("warfarin + miconazole oral gel", ["warfarin", "miconazole oral gel"], "inr"),
        ("Marevan + itraconazole", ["Marevan", "itraconazole 200mg"], "inr"),
        ("Marevan + Diflucan", ["Marevan 3mg", "Diflucan 150mg"], "inr"),
        ("warfarin + Flagyl", ["warfarin", "Flagyl 400mg"], "inr"),
        // Statins
        ("Klaricid + Zocor", ["Klaricid 500mg", "Zocor 40mg"], "myopathy"),
        ("erythromycin + simvastatin", ["erythromycin 500mg", "simvastatin 40mg"], "myopathy"),
        // Others
        ("methotrexate + Augmentin", ["methotrexate", "Augmentin 625mg"], "methotrexate"),
        ("methotrexate + Ciproxin", ["Metoject 15mg", "Ciproxin 500mg"], "methotrexate"),
        ("Glucophage + Omnipaque", ["Glucophage 500mg", "Omnipaque 350"], "lactic"),
        ("clopidogrel + Nexium", ["Plavix", "Nexium 40mg"], "antiplatelet"),
        ("clopidogrel + Zoton", ["clopidogrel", "Zoton 30mg"], "antiplatelet"),
    ]

    func testPerClassCases() {
        for (label, meds, effect) in perClassCases {
            let effects = check(meds).flatMap { allRules($0).map { $0.clinicalEffect.lowercased() } }
            XCTAssertTrue(effects.contains { $0.contains(effect) }, "\(label): got \(effects)")
        }
    }

    // MARK: - 3. Matching precision

    func testASADoesNotMatchNasal() {
        XCTAssertNil(DrugClasses.match(term: "aspirin", in: "Mometasone nasal spray"))
        XCTAssertFalse(DrugClasses.containsWholeWord("asa", in: "nasal"))
        XCTAssertEqual(DrugClasses.match(term: "aspirin", in: "ASA 81mg")?.canonical, "aspirin")
        XCTAssertTrue(DrugClasses.containsWholeWord("ASA", in: "asa 81 mg"))
        XCTAssertEqual(check(["Warfarin 5mg", "Mometasone nasal spray"]).count, 0)
        XCTAssertEqual(check(["Warfarin 5mg", "ASA 81 mg"]).count, 1)
        XCTAssertEqual(DrugClasses.match(term: "ssri", in: "escitalopram 10mg")?.canonical, "escitalopram")
    }

    /// iOS formulary entry "Mesalazine (5-ASA, Pentasa)": 5-ASA is 5-aminosalicylic acid, not aspirin.
    func testFiveASAIsNotAspirin() {
        XCTAssertNil(DrugClasses.match(term: "aspirin", in: "Mesalazine (5-ASA, Pentasa)"))
        XCTAssertNil(DrugClasses.match(term: "antiplatelet", in: "Mesalazine (5-ASA, Pentasa)"))
        XCTAssertEqual(check(["Warfarin", "Mesalazine (5-ASA, Pentasa)"]).count, 0)
    }

    /// "arb" (a class only the new rules use) must not substring-match inside unrelated words.
    func testNewClassTermsAreNotSubstringMatched() {
        XCTAssertNil(DrugClasses.match(term: "arb", in: "Carbamazepine (Tegretol)"))
        XCTAssertNil(DrugClasses.match(term: "arb", in: "Calcium carbonate + D3 (Adcal-D3)"))
        XCTAssertEqual(check(["Ibuprofen 400mg", "Carbamazepine (Tegretol)"]).count, 0)
        XCTAssertEqual(check(["Sodium bicarbonate", "Potassium chloride IV"]).count, 0)
        XCTAssertEqual(check(["Spironolactone", "Calcium carbonate + D3 (Adcal-D3)"]).count, 0)
    }

    /// Legacy literal class names still fire exactly as before.
    func testLegacyClassNamesStillMatch() {
        XCTAssertEqual(DrugClasses.match(term: "nsaid", in: "NSAID prn")?.legacy, true)
        XCTAssertNotNil(find(["warfarin 5mg", "nsaid prn"], "warfarin", "nsaid"))
        XCTAssertNotNil(find(["opioid analgesia", "benzodiazepine"], "opioid", "benzodiazepine"))
    }

    func testNoAlertForANonInteractingPair() {
        XCTAssertEqual(check(["Paracetamol 1g qds", "Amoxicillin 500mg tds"]).count, 0)
    }

    func testAnEntryIsNeverPairedWithItself() {
        // One entry that names both drugs of a rule is not an interaction with itself
        // (the pre-H-07 loop never paired an entry with itself either).
        XCTAssertEqual(check(["morphine + midazolam infusion", "paracetamol 1g"]).count, 0)
        XCTAssertEqual(check(["co-codamol 30/500", "amoxicillin 500mg"]).count, 0)
        XCTAssertEqual(check(["losartan potassium 50mg"]).count, 0)
    }

    func testQTPlusQTNeedsTwoDifferentDrugs() {
        XCTAssertEqual(check(["ondansetron 4mg", "ondansetron 8mg"]).count, 0)
        XCTAssertEqual(check(["Zofran 4mg", "ondansetron 8mg"]).count, 0)
        XCTAssertEqual(check(["ondansetron 4mg", "Zithromax 500mg"]).count, 1)
    }

    func testEveryNSAIDInTheListIsPaired() {
        let alerts = check(["warfarin", "diclofenac 50mg", "ibuprofen 400mg"])
        let partners = alerts.map { $0.drugA.contains("warfarin") ? $0.drugB : $0.drugA }.sorted()
        XCTAssertEqual(partners, ["diclofenac 50mg", "ibuprofen 400mg"])
    }

    func testOneAlertPerPairWithOtherEffectsKeptAsRelated() {
        // warfarin + diclofenac: original rule (warfarin + nsaid) is the headline; the new
        // anticoagulant + nsaid rule has a different effect and is kept as related.
        let wd = check(["Warfarin", "Diclofenac"])
        XCTAssertEqual(wd.count, 1)
        XCTAssertEqual(wd.first?.interaction.drug2Pattern, "nsaid")
        XCTAssertEqual(wd.first?.interaction.drug1Pattern, "warfarin")
        XCTAssertEqual(wd.first?.related.map { $0.clinicalEffect }, ["Increased bleeding risk"])

        // ketorolac + enoxaparin: both major; original wording first (rule order breaks the tie).
        let ke = check(["Enoxaparin 40mg", "Ketorolac 10mg"])
        XCTAssertEqual(ke.count, 1)
        XCTAssertEqual(ke.first?.interaction.drug1Pattern, "ketorolac")
        XCTAssertEqual(ke.first?.drugA, "Ketorolac 10mg")

        // tramadol + venlafaxine: tramadol + venlafaxine and tramadol + snri share the same
        // effect, so only one is shown (same severity).
        let tv = check(["Tramadol", "Venlafaxine (Efexor)"])
        XCTAssertEqual(tv.count, 1)
        XCTAssertEqual(tv.first?.interaction.drug2Pattern, "venlafaxine")
        XCTAssertEqual(tv.first?.related.count, 0)
    }

    func testMoreSevereNewRuleBecomesHeadlineAndOriginalIsKept() {
        // Original rule: moderate. New QT + QT rule: major. The original stays visible as related.
        guard let alert = check(["Ondansetron", "Ciprofloxacin"]).first else { return XCTFail("no alert") }
        XCTAssertEqual(alert.interaction.severity, .major)
        XCTAssertEqual(alert.viaClassA, "QT-prolonging drug")
        XCTAssertTrue(alert.related.contains { $0.drug1Pattern == "ondansetron" && $0.severity == .moderate })
    }

    // MARK: - Severity order

    func testSeverityRankIsClinicalNotAlphabetical() {
        typealias S = DrugInteraction.Severity
        XCTAssertGreaterThan(S.contraindicated.rank, S.major.rank)
        XCTAssertGreaterThan(S.major.rank, S.moderate.rank)
        XCTAssertGreaterThan(S.moderate.rank, S.minor.rank)
        // Alphabetical order would put "Minor" before "Moderate".
        XCTAssertLessThan(S.minor.rawValue, S.moderate.rawValue)
    }

    func testResultsAreOrderedMostSevereFirst() {
        let alerts = check(["ondansetron", "azithromycin", "phenelzine", "sertraline",
                            "Clopidogrel 75mg", "Omeprazole 20mg", "Warfarin"])
        let ranks = alerts.map { $0.interaction.severity.rank }
        XCTAssertEqual(ranks, ranks.sorted(by: >))
        XCTAssertEqual(alerts.first?.interaction.severity, .contraindicated)
        XCTAssertEqual(alerts.last?.interaction.severity, .moderate)
        XCTAssertTrue(alerts.contains { $0.interaction.severity == .major })
    }

    // MARK: - Display strings

    func testDisplayShowsTheMatchedClass() {
        XCTAssertEqual(Alert.withClass("diclofenac", "NSAID"), "diclofenac (NSAID)")
        XCTAssertEqual(Alert.withClass("warfarin", nil), "warfarin")
        XCTAssertTrue(DrugInteractionService.absenceNote
            .contains("Absence of an alert does not mean there is no interaction."))
    }

    // MARK: - 5. Rules ported from the web (platform parity)

    private struct PortedRule {
        let a: String
        let b: String
        let severity: DrugInteraction.Severity
        let effect: String
        let management: String
        /// Medication lists that must raise this rule (generics, old INNs, brands).
        let positives: [[String]]
    }

    /// Same terms, grade and wording as the web `drug-interactions.ts`
    /// (web `effect` = `clinicalEffect`, web `action` = `management`).
    private let portedRules: [PortedRule] = [
        PortedRule(a: "metronidazole", b: "alcohol", severity: .contraindicated,
                   effect: "Disulfiram-like reaction (flushing, vomiting)",
                   management: "Abstain from alcohol during and 48 h after course",
                   positives: [["Metronidazole 400mg tds", "Alcohol excess"], ["Flagyl 400mg", "Ethanol"]]),
        PortedRule(a: "ciprofloxacin", b: "theophylline", severity: .major,
                   effect: "Theophylline toxicity",
                   management: "Halve theophylline dose; monitor levels",
                   positives: [["Ciprofloxacin 500mg bd", "Theophylline MR 200mg"], ["Cipro 500mg", "Aminophylline infusion"]]),
        PortedRule(a: "ciprofloxacin", b: "antacid", severity: .moderate,
                   effect: "Reduced ciprofloxacin absorption",
                   management: "Separate doses by ≥2 hours",
                   positives: [["Ciprofloxacin 500mg", "Gaviscon 10ml qds"], ["Ciproxin 250mg", "Magnesium hydroxide"]]),
        PortedRule(a: "clindamycin", b: "neuromuscular blocking", severity: .moderate,
                   effect: "Enhanced neuromuscular blockade",
                   management: "Monitor for prolonged paralysis",
                   positives: [["Clindamycin 600mg IV", "Rocuronium 50mg"], ["Dalacin C 300mg", "Suxamethonium 100mg"]]),
        PortedRule(a: "warfarin", b: "amiodarone", severity: .major,
                   effect: "Potentiates anticoagulation significantly",
                   management: "Reduce warfarin by 30–50%; frequent INR",
                   positives: [["Warfarin 5mg", "Amiodarone 200mg"], ["Coumadin 3mg", "Cordarone X 200mg"]]),
        PortedRule(a: "digoxin", b: "amiodarone", severity: .major,
                   effect: "Digoxin toxicity (↑ digoxin levels)",
                   management: "Halve digoxin dose when adding amiodarone; monitor levels",
                   positives: [["Digoxin 125mcg", "Amiodarone 200mg"], ["Lanoxin 62.5mcg", "Pacerone 200mg"]]),
        PortedRule(a: "digoxin", b: "furosemide", severity: .major,
                   effect: "Hypokalaemia potentiates digoxin toxicity",
                   management: "Monitor potassium; replace aggressively",
                   positives: [["Digoxin 125mcg", "Furosemide 40mg"], ["Lanoxin", "Frusemide 40mg"], ["Lanoxin", "Lasix 40mg"]]),
        PortedRule(a: "ace inhibitor", b: "potassium", severity: .major,
                   effect: "Hyperkalaemia",
                   management: "Monitor potassium closely; avoid potassium supplements unless clearly necessary",
                   positives: [["Ramipril 5mg", "Potassium chloride 600mg"], ["Coversyl 4mg", "Sando-K 2 tabs"],
                               ["Lisinopril 10mg", "Slow-K 600mg"]]),
        // Always shown through ace inhibitor + potassium (same effect, earlier rule) on both
        // platforms, so it has no positive list here; see testLisinoprilPlusPotassium.
        PortedRule(a: "lisinopril", b: "potassium", severity: .major,
                   effect: "Hyperkalaemia",
                   management: "Monitor potassium",
                   positives: []),
        PortedRule(a: "amlodipine", b: "simvastatin", severity: .major,
                   effect: "Increased simvastatin plasma level → myopathy",
                   management: "Limit simvastatin to 20 mg/day or switch to rosuvastatin",
                   positives: [["Amlodipine 5mg", "Simvastatin 40mg"], ["Norvasc 10mg", "Zocor 20mg"]]),
        PortedRule(a: "nsaid", b: "steroid", severity: .major,
                   effect: "Increased risk of peptic ulceration and GI bleed",
                   management: "Co-prescribe PPI (omeprazole 20mg od)",
                   positives: [["Naproxen 500mg bd", "Prednisolone 40mg"], ["Voltarol 50mg", "Dexamethasone 8mg IV"]]),
        PortedRule(a: "paracetamol", b: "alcohol", severity: .major,
                   effect: "Hepatotoxicity risk in chronic alcohol use",
                   management: "Reduce paracetamol to 2g/day max in alcoholic patients",
                   positives: [["Paracetamol 1g qds", "Alcohol excess"], ["Panadol 500mg", "Ethanol"]]),
        PortedRule(a: "metformin", b: "alcohol", severity: .moderate,
                   effect: "Increased lactic acidosis risk",
                   management: "Advise alcohol reduction",
                   positives: [["Metformin 500mg bd", "Alcohol"], ["Glucophage 850mg", "Alcohol excess"]]),
        PortedRule(a: "insulin", b: "beta blocker", severity: .moderate,
                   effect: "Hypoglycaemia masked; delayed recovery",
                   management: "Monitor BGL closely; use cardioselective beta-blocker",
                   positives: [["NovoRapid sliding scale", "Bisoprolol 5mg"], ["Insulin glargine 20 units", "Atenolol 50mg"]]),
        PortedRule(a: "steroid", b: "insulin", severity: .moderate,
                   effect: "Corticosteroids raise blood glucose",
                   management: "Increase insulin monitoring; may need steroid cover protocol",
                   positives: [["Dexamethasone 8mg IV", "Lantus 20 units"], ["Hydrocortisone 100mg IV", "Actrapid sliding scale"]]),
        PortedRule(a: "maoi", b: "tramadol", severity: .contraindicated,
                   effect: "Severe serotonin syndrome",
                   management: "Contraindicated; do not co-administer",
                   positives: [["Phenelzine 15mg", "Tramadol 50mg"], ["Nardil 15mg", "Zydol 50mg"],
                               ["Linezolid 600mg bd", "Tramadol 50mg"]]),
        PortedRule(a: "maoi", b: "pethidine", severity: .contraindicated,
                   effect: "Life-threatening serotonin crisis",
                   management: "Contraindicated; use morphine instead",
                   positives: [["Selegiline 5mg", "Pethidine 50mg IM"], ["Moclobemide 150mg", "Demerol 50mg"]]),
        PortedRule(a: "lithium", b: "nsaid", severity: .major,
                   effect: "Lithium toxicity (NSAIDs reduce renal lithium clearance)",
                   management: "Avoid NSAIDs; monitor lithium levels",
                   positives: [["Lithium carbonate 400mg", "Ibuprofen 400mg"], ["Priadel 400mg", "Naproxen 500mg bd"]]),
        PortedRule(a: "lithium", b: "diuretic", severity: .major,
                   effect: "Lithium toxicity",
                   management: "Monitor lithium levels closely; maintain adequate fluid intake",
                   positives: [["Lithium carbonate 400mg", "Bendroflumethiazide 2.5mg"], ["Priadel", "Frusemide 40mg"]]),
    ]

    /// The rule with exactly these terms (either order) among every rule shown for `meds`.
    private func rule(_ meds: [String], _ a: String, _ b: String) -> DrugInteraction? {
        check(meds).flatMap { allRules($0) }.first { r in
            (r.drug1Pattern == a && r.drug2Pattern == b) || (r.drug1Pattern == b && r.drug2Pattern == a)
        }
    }

    func testPortedRulesAreListedWithTheWebGradeAndWording() {
        let rules = DrugInteractionService.rules
        XCTAssertEqual(portedRules.count, 19)
        for p in portedRules {
            let hits = rules.enumerated().filter { $0.element.drug1Pattern == p.a && $0.element.drug2Pattern == p.b }
            XCTAssertEqual(hits.count, 1, "\(p.a) + \(p.b) should be listed once")
            guard let hit = hits.first else { continue }
            XCTAssertEqual(hit.element.severity, p.severity, "\(p.a) + \(p.b)")
            XCTAssertEqual(hit.element.clinicalEffect, p.effect, "\(p.a) + \(p.b)")
            XCTAssertEqual(hit.element.management, p.management, "\(p.a) + \(p.b)")
            XCTAssertFalse(hit.element.mechanism.isEmpty, "\(p.a) + \(p.b)")
            // Appended after the original block, so `legacyTerms` is unchanged.
            XCTAssertGreaterThanOrEqual(hit.offset, DrugInteractionService.originalRuleCount)
        }
    }

    func testPortedRulesFire() {
        for p in portedRules {
            for meds in p.positives {
                guard let r = rule(meds, p.a, p.b) else {
                    XCTFail("\(p.a) + \(p.b) did not fire for \(meds): got \(check(meds).map { $0.pairDisplay })")
                    continue
                }
                XCTAssertEqual(r.severity, p.severity, "\(meds)")
                XCTAssertEqual(r.clinicalEffect, p.effect, "\(meds)")
                XCTAssertEqual(r.management, p.management, "\(meds)")
                XCTAssertNotNil(rule(Array(meds.reversed()), p.a, p.b), "reversed \(meds)")
            }
        }
    }

    func testLisinoprilPlusPotassium() {
        // Same pair also hits ace inhibitor + potassium with the same effect; the earlier rule's
        // wording is the one shown (same merging as the web).
        guard let alert = find(["Zestril 10mg", "Slow-K 600mg"], "zestril", "slow-k") else {
            return XCTFail("no alert")
        }
        XCTAssertEqual(alert.interaction.severity, .major)
        XCTAssertEqual(alert.interaction.clinicalEffect, "Hyperkalaemia")
        XCTAssertEqual(alert.interaction.drug1Pattern, "ace inhibitor")
        XCTAssertEqual(DrugClasses.match(term: "lisinopril", in: "Zestril 10mg")?.canonical, "lisinopril")
        XCTAssertNil(DrugClasses.match(term: "lisinopril", in: "Enalapril 10mg"))
    }

    /// (label, medication list, rule terms that must NOT fire)
    private let portedFalseMatchCases: [(String, [String], String, String)] = [
        // "Ethanolamine oleate" (variceal sclerotherapy) is not ethanol.
        ("ethanolamine + metronidazole", ["Metronidazole 400mg", "Ethanolamine oleate 5% injection"], "metronidazole", "alcohol"),
        ("ethanolamine + paracetamol", ["Paracetamol 1g", "Ethanolamine oleate 5% injection"], "paracetamol", "alcohol"),
        ("ethanolamine + metformin", ["Metformin 500mg", "Ethanolamine oleate 5% injection"], "metformin", "alcohol"),
        ("gliclazide is not metformin", ["Gliclazide 80mg", "Alcohol excess"], "metformin", "alcohol"),
        // Look-alike / sound-alike names.
        ("trazodone is not tramadol", ["Phenelzine 15mg", "Trazodone 50mg"], "maoi", "tramadol"),
        ("amlodipine is not amiodarone (warfarin)", ["Warfarin 5mg", "Amlodipine 5mg"], "warfarin", "amiodarone"),
        ("amlodipine is not amiodarone (digoxin)", ["Digoxin 125mcg", "Amlodipine 5mg"], "digoxin", "amiodarone"),
        // Related drugs outside the rule term or class.
        ("morphine is not pethidine", ["Phenelzine 15mg", "Morphine 10mg"], "maoi", "pethidine"),
        ("spironolactone is not furosemide", ["Digoxin 125mcg", "Spironolactone 25mg"], "digoxin", "furosemide"),
        ("amoxicillin is not ciprofloxacin", ["Amoxicillin 500mg", "Theophylline MR 200mg"], "ciprofloxacin", "theophylline"),
        ("a PPI is not an antacid", ["Ciprofloxacin 500mg", "Omeprazole 20mg"], "ciprofloxacin", "antacid"),
        ("sugammadex is not a neuromuscular blocker", ["Clindamycin 600mg", "Sugammadex 200mg"], "clindamycin", "neuromuscular blocking"),
        ("an ARB is not an ACE inhibitor", ["Losartan 50mg", "Slow-K 600mg"], "ace inhibitor", "potassium"),
        ("rosuvastatin is not simvastatin", ["Amlodipine 5mg", "Rosuvastatin 10mg"], "amlodipine", "simvastatin"),
        ("inhaled steroid is not systemic", ["Ibuprofen 400mg", "Beclometasone inhaler"], "nsaid", "steroid"),
        ("nasal steroid is not systemic", ["Naproxen 500mg", "Fluticasone nasal spray"], "nsaid", "steroid"),
        ("inhaled steroid + insulin", ["Fluticasone inhaler", "Lantus 20 units"], "steroid", "insulin"),
        ("an alpha-blocker is not a beta-blocker", ["Insulin glargine 20 units", "Tamsulosin 400mcg"], "insulin", "beta blocker"),
        ("aspirin is not an NSAID (lithium)", ["Lithium carbonate 400mg", "Aspirin 75mg"], "lithium", "nsaid"),
        ("amlodipine is not a diuretic", ["Lithium carbonate 400mg", "Amlodipine 5mg"], "lithium", "diuretic"),
    ]

    func testPortedRulesDoNotFalseMatch() {
        for (label, meds, a, b) in portedFalseMatchCases {
            XCTAssertNil(rule(meds, a, b), label)
        }
        // The recommended alternatives raise nothing at all.
        XCTAssertEqual(check(["Amlodipine 5mg", "Rosuvastatin 10mg"]).count, 0)
        XCTAssertEqual(check(["Metronidazole 400mg", "Paracetamol 1g", "Metformin 500mg",
                              "Ethanolamine oleate 5% injection"]).count, 0)
    }

    // MARK: - 4. Never remove an alert

    private struct LegacyAlert {
        let drugA: String
        let drugB: String
        let rule: DrugInteraction
    }

    /// Verbatim port of the pre-H-07 matcher, run over the original rules only.
    private func legacyCheck(_ drugs: [String]) -> [LegacyAlert] {
        guard drugs.count >= 2 else { return [] }
        let original = Array(DrugInteractionService.rules.prefix(DrugInteractionService.originalRuleCount))
        var alerts: [LegacyAlert] = []
        let normalised = drugs.map { $0.lowercased() }
        for i in 0..<normalised.count {
            for j in (i + 1)..<normalised.count {
                let a = normalised[i]
                let b = normalised[j]
                for rule in original {
                    let p1 = rule.drug1Pattern.lowercased()
                    let p2 = rule.drug2Pattern.lowercased()
                    if (a.contains(p1) && b.contains(p2)) || (a.contains(p2) && b.contains(p1)) {
                        alerts.append(LegacyAlert(drugA: drugs[i], drugB: drugs[j], rule: rule))
                    }
                }
            }
        }
        return alerts
    }

    /// Common drugs as they appear on this app's prescriptions (formulary names, brands, doses)
    /// plus the literal class names the old rules were written against.
    private let corpus: [String] = [
        "Warfarin 5mg", "nsaid prn", "Ibuprofen 400mg", "Diclofenac 50mg", "Ketorolac 10mg",
        "Enoxaparin 40mg SC", "Metronidazole 400mg", "Ciprofloxacin 500mg", "Fluconazole 150mg",
        "Aspirin 75mg", "Clopidogrel 75mg", "ace inhibitor", "Lisinopril 10mg", "Tramadol 50mg",
        "ssri", "Sertraline 50mg", "Venlafaxine (Efexor)", "snri", "opioid analgesia",
        "benzodiazepine", "Morphine 10mg", "Midazolam 2mg", "Fentanyl 50mcg", "Metformin 500mg",
        "iv contrast", "Gentamicin", "Furosemide 40mg", "Vancomycin", "Methotrexate (MTX)",
        "Co-amoxiclav", "Omeprazole 20mg", "Esomeprazole (Nexium)", "Lansoprazole", "Ondansetron 4mg",
        "Diazepam 5mg", "Naproxen", "Losartan", "Spironolactone", "Potassium chloride IV",
        "Linezolid", "Clarithromycin", "Simvastatin 40mg", "Azithromycin", "Pregabalin",
        "Rivaroxaban", "Paracetamol 1g", "Amoxicillin", "morphine + midazolam infusion",
        "Mesalazine (5-ASA, Pentasa)", "Carbamazepine (Tegretol)",
    ]

    func testEveryPreH07AlertStillFires() {
        var lists: [[String]] = []
        for i in 0..<corpus.count {
            for j in (i + 1)..<corpus.count {
                lists.append([corpus[i], corpus[j]])
                var k = j + 1
                while k < corpus.count {
                    lists.append([corpus[i], corpus[j], corpus[k]])
                    k += 7
                }
            }
        }

        var checked = 0
        for meds in lists {
            let now = check(meds)
            for old in legacyCheck(meds) {
                checked += 1
                let pair = [old.drugA, old.drugB].sorted()
                let effect = old.rule.clinicalEffect.lowercased()
                let stillFires = now.contains { alert in
                    [alert.drugA, alert.drugB].sorted() == pair
                        && allRules(alert).contains {
                            $0.clinicalEffect.lowercased() == effect && $0.severity.rank >= old.rule.severity.rank
                        }
                }
                XCTAssertTrue(stillFires,
                              "lost alert \(old.rule.drug1Pattern) + \(old.rule.drug2Pattern) for \(meds)")
            }
        }
        XCTAssertGreaterThan(checked, 100)
    }
}
