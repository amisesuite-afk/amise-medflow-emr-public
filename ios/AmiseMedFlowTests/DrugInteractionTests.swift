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
