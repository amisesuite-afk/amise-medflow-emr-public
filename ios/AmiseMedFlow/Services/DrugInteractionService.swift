import Foundation
import SwiftUI

// MARK: - Deterministic Drug Interaction Engine
//
// Decision support only; display only. Alerts never block, edit or auto-act on a prescription.
//
// Rule terms are either classes ("nsaid", "opioid", "ssri", "qt prolonging") or specific drugs
// ("warfarin"). Every term MUST be defined in `DrugClasses.terms` (class members, synonyms and
// Caribbean/UK/US brand names, each with its BNF / Stockley's / SmPC source);
// `DrugInteractionTests` fails if a rule names an unmapped term. Before H-07 the class names
// were only substring-matched, so "Warfarin" + "Diclofenac" raised no alert.
//
// Parity: the dashboard's `artifacts/dashboard/src/lib/drug-interactions.ts` (same vocabulary,
// same merging, same severity ordering; see `DrugClasses.swift` for two matching details that
// differ). Each rule keeps its own iOS severity grade; the surgeon reviews grades separately.
// Every rule pair on either platform is raised on the other (same pair, or a broader class
// rule); CI checks this with `pnpm --filter @workspace/scripts run lint:interaction-parity`.
// One grade differs and is pending a surgeon decision: opioid + benzodiazepine (web
// contraindicated, iOS major).

struct DrugInteraction: Identifiable {
    let id = UUID()
    let drug1Pattern: String
    let drug2Pattern: String
    let severity: Severity
    let mechanism: String
    let clinicalEffect: String
    let management: String

    enum Severity: String {
        case contraindicated = "Contraindicated"
        case major           = "Major"
        case moderate        = "Moderate"
        case minor           = "Minor"

        /// Clinical rank, higher = more severe. Sort by this, never by the name
        /// (alphabetical order put "Minor" before "Moderate").
        var rank: Int {
            switch self {
            case .contraindicated: return 4
            case .major:           return 3
            case .moderate:        return 2
            case .minor:           return 1
            }
        }

        var color: Color {
            switch self {
            case .contraindicated: return .red
            case .major:           return .orange
            case .moderate:        return Color(hex: "#EAB308")
            case .minor:           return .blue
            }
        }

        var icon: String {
            switch self {
            case .contraindicated: return "xmark.octagon.fill"
            case .major:           return "exclamationmark.triangle.fill"
            case .moderate:        return "exclamationmark.circle.fill"
            case .minor:           return "info.circle.fill"
            }
        }
    }
}

struct DrugInteractionAlert: Identifiable {
    let id = UUID()
    /// The medication entries exactly as written (e.g. "Diclofenac 50 mg"). `drugA` matched
    /// the headline rule's `drug1Pattern`, `drugB` its `drug2Pattern`.
    let drugA: String
    let drugB: String
    /// Headline rule: the most severe rule that hit this pair (original rule order breaks ties).
    let interaction: DrugInteraction
    /// Class label when drugA / drugB matched through class membership (e.g. "NSAID").
    var viaClassA: String? = nil
    var viaClassB: String? = nil
    /// Other rules that hit the SAME pair of medications with a different effect. Nothing is
    /// dropped: the most severe rule is the headline and the rest are listed here.
    var related: [DrugInteraction] = []

    /// "Diclofenac 50 mg (NSAID)" — shows which class the entry matched through.
    var drugADisplay: String { DrugInteractionAlert.withClass(drugA, viaClassA) }
    var drugBDisplay: String { DrugInteractionAlert.withClass(drugB, viaClassB) }
    var pairDisplay: String { "\(drugADisplay) + \(drugBDisplay)" }

    static func withClass(_ entry: String, _ viaClass: String?) -> String {
        guard let label = viaClass, !label.isEmpty else { return entry }
        return "\(entry) (\(label))"
    }
}

enum DrugInteractionService {

    /// Hazard log H-07: the checker is a partial reference list, so an empty result must never
    /// read as "no interaction". Shown wherever interaction results are displayed.
    static let absenceNote =
        "Partial reference list (BNF / Stockley's classes). Absence of an alert does not mean there is no interaction."

    /// The first `originalRuleCount` entries of `rules` are the pre-H-07 iOS rules, unchanged.
    /// Class-based rules are appended after them.
    static let originalRuleCount = 27

    /// Terms named by the original rules. Only these keep the pre-H-07 raw-substring match
    /// (so every old alert still fires); terms used only by the class rules added for H-07
    /// match through `DrugClasses` members alone ("arb" must not fire inside "carbamazepine").
    static let legacyTerms: Set<String> = Set(
        rules.prefix(originalRuleCount).flatMap { [$0.drug1Pattern.lowercased(), $0.drug2Pattern.lowercased()] }
    )

    private struct Entry {
        let index: Int
        let original: String
        let lc: String
        let bytes: [UInt8]
    }

    private struct TermHit {
        let entry: Entry
        let match: DrugTermMatch
    }

    private struct Hit {
        let rule: DrugInteraction
        let ruleOrder: Int
        let a: TermHit
        let b: TermHit
    }

    private struct PairKey: Hashable {
        let lo: Int
        let hi: Int
    }

    private struct Ranked {
        let alert: DrugInteractionAlert
        let ruleOrder: Int
        let key: PairKey
    }

    /// Deterministic interaction screen over a free-text medication list.
    ///
    /// A rule term matches an entry by (1) the pre-H-07 raw substring test, kept unchanged, OR
    /// (2) whole-word membership of the term's class / synonym list in `DrugClasses`. Class
    /// matches only ever ADD alerts. Every pair of entries is evaluated (never an entry with
    /// itself); a same-class rule (QT + QT) additionally needs two different drugs. Hits on the
    /// same pair of entries are merged into one alert (most severe first) with every other
    /// distinct effect kept in `related`. Results are ordered by clinical severity.
    static func check(drugs: [String]) -> [DrugInteractionAlert] {
        guard drugs.count >= 2 else { return [] }

        var entries: [Entry] = []
        for (i, drug) in drugs.enumerated() {
            let lc = drug.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if !lc.isEmpty {
                entries.append(Entry(index: i, original: drug, lc: lc, bytes: Array(lc.utf8)))
            }
        }
        guard entries.count >= 2 else { return [] }

        var hitCache: [String: [TermHit]] = [:]
        func hits(for term: String) -> [TermHit] {
            if let cached = hitCache[term] { return cached }
            let substringFallback = DrugInteractionService.legacyTerms.contains(term)
            var found: [TermHit] = []
            for entry in entries {
                if let m = DrugClasses.match(term: term, lowercasedEntry: entry.lc, bytes: entry.bytes,
                                             substringFallback: substringFallback) {
                    found.append(TermHit(entry: entry, match: m))
                }
            }
            hitCache[term] = found
            return found
        }

        var byPair: [PairKey: [Hit]] = [:]
        var pairOrder: [PairKey] = []

        for (ruleOrder, rule) in rules.enumerated() {
            let termA = rule.drug1Pattern.lowercased()
            let termB = rule.drug2Pattern.lowercased()
            let sameTerm = termA == termB
            let hitsA = hits(for: termA)
            if hitsA.isEmpty { continue }
            let hitsB = hits(for: termB)

            for ha in hitsA {
                for hb in hitsB {
                    // Never pair an entry with itself (the pre-H-07 loop never did either).
                    if ha.entry.index == hb.entry.index { continue }
                    // Same-class rule (QT + QT): count each pair once, and only for two different drugs.
                    if sameTerm && (ha.entry.index > hb.entry.index || ha.match.canonical == hb.match.canonical) {
                        continue
                    }
                    let key = PairKey(lo: min(ha.entry.index, hb.entry.index),
                                      hi: max(ha.entry.index, hb.entry.index))
                    var list = byPair[key] ?? []
                    if list.isEmpty { pairOrder.append(key) }
                    if !list.contains(where: { $0.ruleOrder == ruleOrder }) {
                        list.append(Hit(rule: rule, ruleOrder: ruleOrder, a: ha, b: hb))
                    }
                    byPair[key] = list
                }
            }
        }

        var ranked: [Ranked] = []
        for key in pairOrder {
            guard let pairHits = byPair[key] else { continue }
            // Most severe first; original rule order breaks ties (original wording wins).
            let sortedHits = pairHits.sorted { x, y in
                if x.rule.severity.rank != y.rule.severity.rank {
                    return x.rule.severity.rank > y.rule.severity.rank
                }
                return x.ruleOrder < y.ruleOrder
            }
            // Collapse only exact duplicates of the same effect (keeping the most severe);
            // every distinct effect stays visible.
            var kept: [Hit] = []
            for h in sortedHits {
                let effect = normalisedEffect(h.rule)
                if !kept.contains(where: { normalisedEffect($0.rule) == effect }) {
                    kept.append(h)
                }
            }
            guard let head = kept.first else { continue }
            let alert = DrugInteractionAlert(
                drugA: head.a.entry.original,
                drugB: head.b.entry.original,
                interaction: head.rule,
                viaClassA: head.a.match.viaClass,
                viaClassB: head.b.match.viaClass,
                related: kept.dropFirst().map { $0.rule }
            )
            ranked.append(Ranked(alert: alert, ruleOrder: head.ruleOrder, key: key))
        }

        // Clinical severity: contraindicated > major > moderate > minor (explicit rank).
        ranked.sort { x, y in
            let rx = x.alert.interaction.severity.rank
            let ry = y.alert.interaction.severity.rank
            if rx != ry { return rx > ry }
            if x.ruleOrder != y.ruleOrder { return x.ruleOrder < y.ruleOrder }
            if x.key.lo != y.key.lo { return x.key.lo < y.key.lo }
            return x.key.hi < y.key.hi
        }
        return ranked.map { $0.alert }
    }

    private static func normalisedEffect(_ rule: DrugInteraction) -> String {
        rule.clinicalEffect.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    // MARK: - Surgical Practice Interaction Rules
    //
    // Rules 1–27 are the original iOS rules, unchanged. The class-based rules ported from the
    // dashboard (H-07) are appended after them, so that when two rules hit the same pair the
    // original (more specific) wording is shown first at equal severity.

    static let rules: [DrugInteraction] = [
        // --- Anticoagulant interactions ---
        .init(drug1Pattern: "warfarin", drug2Pattern: "nsaid",
              severity: .major,
              mechanism: "Synergistic antihaemostatic effect: NSAID inhibits platelet function and may cause GI mucosal injury",
              clinicalEffect: "Significantly increased risk of major bleeding, particularly GI haemorrhage",
              management: "Avoid combination if possible; if necessary, add PPI and monitor INR closely"),

        .init(drug1Pattern: "warfarin", drug2Pattern: "metronidazole",
              severity: .major,
              mechanism: "Metronidazole inhibits CYP2C9 reducing warfarin metabolism",
              clinicalEffect: "INR may rise 2–3-fold within 2–3 days",
              management: "Halve warfarin dose; check INR every 2–3 days; consider alternative antibiotic"),

        .init(drug1Pattern: "warfarin", drug2Pattern: "ciprofloxacin",
              severity: .major,
              mechanism: "Ciprofloxacin inhibits CYP1A2 and reduces gut flora contributing to Vitamin K",
              clinicalEffect: "Unpredictable INR elevation — risk of over-anticoagulation",
              management: "Monitor INR within 2–3 days; consider dose reduction"),

        .init(drug1Pattern: "warfarin", drug2Pattern: "fluconazole",
              severity: .major,
              mechanism: "Fluconazole strongly inhibits CYP2C9 (major warfarin metaboliser)",
              clinicalEffect: "INR may double or more; risk of serious haemorrhage",
              management: "Reduce warfarin dose by 25–50%; monitor INR daily until stable"),

        .init(drug1Pattern: "warfarin", drug2Pattern: "aspirin",
              severity: .major,
              mechanism: "Additive antihaemostatic effect; aspirin inhibits platelet aggregation",
              clinicalEffect: "Greatly increased bleeding risk; GI haemorrhage in particular",
              management: "Use low-dose aspirin only if cardiovascular benefit clearly outweighs risk; add PPI"),

        .init(drug1Pattern: "warfarin", drug2Pattern: "clopidogrel",
              severity: .major,
              mechanism: "Dual antiplatelet + anticoagulant effect",
              clinicalEffect: "Highly increased bleeding risk — triple therapy requires cardiologist input",
              management: "Specialist review required; use for minimum necessary duration"),

        // --- NSAIDs + renal ---
        .init(drug1Pattern: "nsaid", drug2Pattern: "ace inhibitor",
              severity: .moderate,
              mechanism: "NSAIDs blunt prostaglandin-mediated afferent vasodilation; impair renin-angiotensin effect of ACE-I",
              clinicalEffect: "Acute kidney injury risk; reduced antihypertensive efficacy; hyperkalaemia",
              management: "Avoid combination in CKD; monitor renal function and electrolytes"),

        .init(drug1Pattern: "ibuprofen", drug2Pattern: "ace inhibitor",
              severity: .moderate,
              mechanism: "NSAIDs reduce renal prostaglandins; antagonise ACE inhibitor effect",
              clinicalEffect: "AKI risk, loss of BP control",
              management: "Use paracetamol instead; monitor renal function"),

        .init(drug1Pattern: "diclofenac", drug2Pattern: "ace inhibitor",
              severity: .moderate,
              mechanism: "NSAIDs blunt prostaglandin-mediated vasodilation",
              clinicalEffect: "AKI risk, loss of BP control",
              management: "Use paracetamol instead"),

        .init(drug1Pattern: "ketorolac", drug2Pattern: "enoxaparin",
              severity: .major,
              mechanism: "Additive antihaemostatic effect — ketorolac inhibits platelet aggregation and causes GI mucosal damage",
              clinicalEffect: "Significantly increased post-operative haemorrhage risk",
              management: "Avoid concurrent use; if both needed, monitor for bleeding"),

        // --- Serotonin syndrome ---
        .init(drug1Pattern: "tramadol", drug2Pattern: "ssri",
              severity: .major,
              mechanism: "Tramadol is a weak serotonin and noradrenaline reuptake inhibitor; additive effect with SSRIs",
              clinicalEffect: "Serotonin syndrome: agitation, clonus, hyperthermia, tachycardia",
              management: "Prefer alternative opioid (oxycodone, morphine); if combined, monitor closely"),

        .init(drug1Pattern: "tramadol", drug2Pattern: "venlafaxine",
              severity: .major,
              mechanism: "Dual serotonergic mechanism — same as with SSRIs",
              clinicalEffect: "Serotonin syndrome risk",
              management: "Avoid; use morphine or oxycodone instead"),

        .init(drug1Pattern: "tramadol", drug2Pattern: "snri",
              severity: .major,
              mechanism: "Dual serotonergic effect",
              clinicalEffect: "Serotonin syndrome risk",
              management: "Avoid combination; choose a different opioid analgesic"),

        // --- Respiratory depression ---
        .init(drug1Pattern: "opioid", drug2Pattern: "benzodiazepine",
              severity: .major,
              mechanism: "Synergistic CNS and respiratory depression",
              clinicalEffect: "Risk of fatal respiratory depression; death reported with concurrent use",
              management: "Avoid concurrent use; if unavoidable, use lowest possible doses and monitor for respiratory depression"),

        .init(drug1Pattern: "morphine", drug2Pattern: "midazolam",
              severity: .major,
              mechanism: "Synergistic CNS depression",
              clinicalEffect: "Respiratory depression, apnoea",
              management: "Use lowest effective dose; ensure resuscitation facilities available"),

        .init(drug1Pattern: "fentanyl", drug2Pattern: "midazolam",
              severity: .major,
              mechanism: "Synergistic CNS depression",
              clinicalEffect: "Respiratory depression, apnoea",
              management: "Standard anaesthetic precautions; monitoring required"),

        // --- Metformin + contrast ---
        .init(drug1Pattern: "metformin", drug2Pattern: "contrast",
              severity: .major,
              mechanism: "Iodinated contrast may cause acute kidney injury, reducing metformin excretion leading to accumulation",
              clinicalEffect: "Risk of lactic acidosis (rare but potentially fatal)",
              management: "Hold metformin 48h before and after IV contrast; resume once renal function confirmed stable"),

        // --- Aminoglycosides ---
        .init(drug1Pattern: "gentamicin", drug2Pattern: "furosemide",
              severity: .major,
              mechanism: "Both ototoxic; furosemide may increase gentamicin levels",
              clinicalEffect: "Irreversible sensorineural hearing loss; nephrotoxicity",
              management: "Monitor gentamicin levels; use lowest effective dose; avoid if alternatives available"),

        .init(drug1Pattern: "gentamicin", drug2Pattern: "vancomycin",
              severity: .major,
              mechanism: "Synergistic nephrotoxicity",
              clinicalEffect: "Acute kidney injury — additive renal tubular toxicity",
              management: "Monitor renal function and drug levels closely; ensure adequate hydration"),

        .init(drug1Pattern: "gentamicin", drug2Pattern: "nsaid",
              severity: .moderate,
              mechanism: "NSAIDs reduce renal perfusion; increase gentamicin exposure",
              clinicalEffect: "Increased nephrotoxicity and ototoxicity",
              management: "Avoid if possible; monitor renal function and gentamicin levels"),

        // --- Methotrexate ---
        .init(drug1Pattern: "methotrexate", drug2Pattern: "nsaid",
              severity: .major,
              mechanism: "NSAIDs reduce renal clearance of methotrexate via prostaglandin-mediated mechanisms",
              clinicalEffect: "Methotrexate toxicity: bone marrow suppression, mucositis, renal failure",
              management: "Avoid concurrent use; if unavoidable, reduce methotrexate dose and monitor FBC/LFTs"),

        .init(drug1Pattern: "methotrexate", drug2Pattern: "ciprofloxacin",
              severity: .major,
              mechanism: "Ciprofloxacin competes with methotrexate for renal tubular secretion",
              clinicalEffect: "Methotrexate toxicity",
              management: "Avoid; use alternative antibiotic"),

        .init(drug1Pattern: "methotrexate", drug2Pattern: "co-amoxiclav",
              severity: .moderate,
              mechanism: "Amoxicillin reduces renal tubular methotrexate excretion",
              clinicalEffect: "Risk of methotrexate accumulation and toxicity",
              management: "Use alternative antibiotic where possible; monitor FBC"),

        // --- Clopidogrel + PPI ---
        .init(drug1Pattern: "clopidogrel", drug2Pattern: "omeprazole",
              severity: .moderate,
              mechanism: "Omeprazole inhibits CYP2C19, the enzyme that converts clopidogrel to its active metabolite",
              clinicalEffect: "Reduced antiplatelet efficacy — increased risk of cardiovascular events",
              management: "Use pantoprazole instead (least CYP2C19 interaction); consult cardiology before stopping clopidogrel"),

        .init(drug1Pattern: "clopidogrel", drug2Pattern: "lansoprazole",
              severity: .moderate,
              mechanism: "CYP2C19 inhibition reduces clopidogrel activation",
              clinicalEffect: "Reduced antiplatelet effect",
              management: "Prefer pantoprazole; cardiologist input for dual antiplatelet patients"),

        // --- Ondansetron QT ---
        .init(drug1Pattern: "ondansetron", drug2Pattern: "ciprofloxacin",
              severity: .moderate,
              mechanism: "Both prolong the QT interval via hERG channel blockade",
              clinicalEffect: "Risk of torsades de pointes and ventricular arrhythmia",
              management: "Avoid if QTc > 500 ms; ECG monitoring if combined; consider alternative antiemetic"),

        .init(drug1Pattern: "ondansetron", drug2Pattern: "fluconazole",
              severity: .moderate,
              mechanism: "Additive QT prolongation + fluconazole inhibits ondansetron metabolism",
              clinicalEffect: "Risk of QT prolongation and arrhythmia",
              management: "ECG monitoring; avoid high-dose ondansetron; consider cyclizine instead"),

        // ── Class-based rules ported from the dashboard for H-07 ───────────────────────────
        // Same terms, severities, effects and actions as the dashboard's 21 added rules; the
        // three already on this list (nsaid + ace inhibitor, methotrexate + nsaid,
        // tramadol + snri) are not duplicated. Source for each: BNF Interactions appendix and
        // Stockley's Drug Interactions unless stated; MHRA Drug Safety Updates / SmPCs where cited.

        // Bleeding — BNF: NSAIDs, antiplatelets and SSRIs/SNRIs each increase bleeding risk with
        // coumarins, DOACs and heparins.
        .init(drug1Pattern: "anticoagulant", drug2Pattern: "nsaid",
              severity: .major,
              mechanism: "Additive antihaemostatic effect: NSAIDs inhibit platelet function and may cause GI mucosal injury (BNF)",
              clinicalEffect: "Increased bleeding risk",
              management: "Avoid NSAIDs; use paracetamol instead. If unavoidable, add PPI and monitor for bleeding"),

        .init(drug1Pattern: "anticoagulant", drug2Pattern: "antiplatelet",
              severity: .major,
              mechanism: "Additive antihaemostatic effect: platelet inhibition on top of anticoagulation (BNF)",
              clinicalEffect: "Increased bleeding risk",
              management: "Combine only with a clear indication (e.g. recent ACS/stent) and specialist input; add PPI; minimise duration"),

        .init(drug1Pattern: "anticoagulant", drug2Pattern: "ssri",
              severity: .moderate,
              mechanism: "SSRIs impair platelet serotonin uptake and platelet aggregation (BNF)",
              clinicalEffect: "Increased bleeding risk (SSRIs impair platelet serotonin uptake)",
              management: "Monitor for bleeding; check INR when starting/stopping an SSRI with warfarin; consider PPI"),

        .init(drug1Pattern: "anticoagulant", drug2Pattern: "snri",
              severity: .moderate,
              mechanism: "SNRIs impair platelet serotonin uptake and platelet aggregation (BNF)",
              clinicalEffect: "Increased bleeding risk (SNRIs impair platelet serotonin uptake)",
              management: "Monitor for bleeding; check INR when starting/stopping an SNRI with warfarin; consider PPI"),

        .init(drug1Pattern: "nsaid", drug2Pattern: "ssri",
              severity: .moderate,
              mechanism: "Both impair platelet function; NSAIDs also injure the GI mucosa (BNF)",
              clinicalEffect: "Increased risk of GI bleeding",
              management: "Consider PPI gastroprotection; avoid if previous GI bleed"),

        .init(drug1Pattern: "nsaid", drug2Pattern: "snri",
              severity: .moderate,
              mechanism: "Both impair platelet function; NSAIDs also injure the GI mucosa (BNF)",
              clinicalEffect: "Increased risk of GI bleeding",
              management: "Consider PPI gastroprotection; avoid if previous GI bleed"),

        // Serotonin toxicity — BNF; SSRI/SNRI SmPCs (MAOI + SSRI/SNRI contraindicated, including
        // for 14 days after stopping an irreversible MAOI).
        .init(drug1Pattern: "maoi", drug2Pattern: "ssri",
              severity: .contraindicated,
              mechanism: "Monoamine-oxidase inhibition plus serotonin re-uptake inhibition — additive serotonergic effect (BNF; SmPCs)",
              clinicalEffect: "Severe serotonin syndrome",
              management: "Contraindicated; do not co-administer (observe MAOI washout)"),

        .init(drug1Pattern: "maoi", drug2Pattern: "snri",
              severity: .contraindicated,
              mechanism: "Monoamine-oxidase inhibition plus serotonin re-uptake inhibition — additive serotonergic effect (BNF; SmPCs)",
              clinicalEffect: "Severe serotonin syndrome",
              management: "Contraindicated; do not co-administer (observe MAOI washout)"),

        // Respiratory depression — MHRA DSU Oct 2017 (gabapentin), Feb 2021 (pregabalin).
        .init(drug1Pattern: "opioid", drug2Pattern: "gabapentinoid",
              severity: .major,
              mechanism: "Additive CNS depression (MHRA Drug Safety Update: gabapentin Oct 2017, pregabalin Feb 2021)",
              clinicalEffect: "Additive CNS/respiratory depression",
              management: "Use lowest effective doses; monitor sedation and respiratory rate, especially elderly/post-op"),

        // QT — CredibleMeds "Known Risk of TdP"; BNF. Two DIFFERENT QT-prolonging drugs.
        .init(drug1Pattern: "qt prolonging", drug2Pattern: "qt prolonging",
              severity: .major,
              mechanism: "Both drugs are on the CredibleMeds \"Known Risk of TdP\" list — additive QT prolongation",
              clinicalEffect: "Additive QT prolongation — risk of torsade de pointes",
              management: "Avoid combination where possible; check baseline ECG (QTc), potassium and magnesium; stop if QTc >500 ms"),

        // Warfarin potentiation — BNF (macrolides; azoles). MHRA DSU June 2016: miconazole oral gel.
        .init(drug1Pattern: "warfarin", drug2Pattern: "macrolide",
              severity: .major,
              mechanism: "Macrolides increase the anticoagulant effect of warfarin (BNF)",
              clinicalEffect: "Potentiates anticoagulation — INR rise",
              management: "Check INR within 3–5 days of starting; adjust warfarin dose"),

        .init(drug1Pattern: "warfarin", drug2Pattern: "azole antifungal",
              severity: .major,
              mechanism: "Azole antifungals inhibit CYP2C9/3A4, reducing warfarin metabolism (BNF; MHRA Drug Safety Update June 2016: miconazole oral gel)",
              clinicalEffect: "Potentiates anticoagulation — INR rise (CYP2C9/3A4 inhibition)",
              management: "Avoid miconazole oral gel; otherwise reduce warfarin and monitor INR closely"),

        // Statin myopathy — Zocor (simvastatin) and Klaricid SmPCs: strong CYP3A4-inhibiting
        // macrolides are contraindicated with simvastatin.
        .init(drug1Pattern: "clarithromycin", drug2Pattern: "simvastatin",
              severity: .contraindicated,
              mechanism: "CYP3A4 inhibition by the macrolide greatly raises simvastatin exposure (Zocor and Klaricid SmPCs)",
              clinicalEffect: "Greatly raised simvastatin levels — myopathy / rhabdomyolysis",
              management: "Withhold simvastatin for the course, or use a non-interacting antibiotic (e.g. azithromycin)"),

        .init(drug1Pattern: "erythromycin", drug2Pattern: "simvastatin",
              severity: .contraindicated,
              mechanism: "CYP3A4 inhibition by the macrolide greatly raises simvastatin exposure (Zocor SmPC)",
              clinicalEffect: "Greatly raised simvastatin levels — myopathy / rhabdomyolysis",
              management: "Withhold simvastatin for the course, or use a non-interacting antibiotic (e.g. azithromycin)"),

        // Hyperkalaemia — BNF: ACE inhibitors / ARBs with potassium-sparing diuretics, aldosterone
        // antagonists or potassium salts.
        .init(drug1Pattern: "ace inhibitor", drug2Pattern: "potassium-sparing diuretic",
              severity: .major,
              mechanism: "Both reduce renal potassium excretion (BNF)",
              clinicalEffect: "Hyperkalaemia",
              management: "Monitor potassium and renal function closely"),

        .init(drug1Pattern: "arb", drug2Pattern: "potassium-sparing diuretic",
              severity: .major,
              mechanism: "Both reduce renal potassium excretion (BNF)",
              clinicalEffect: "Hyperkalaemia",
              management: "Monitor potassium and renal function closely"),

        .init(drug1Pattern: "arb", drug2Pattern: "potassium",
              severity: .major,
              mechanism: "Angiotensin-II receptor blockers reduce renal potassium excretion; the supplement adds potassium (BNF)",
              clinicalEffect: "Hyperkalaemia",
              management: "Monitor potassium closely; avoid potassium supplements unless clearly necessary"),

        // Renal — BNF: NSAIDs with ARBs increase the risk of renal impairment and reduce the
        // antihypertensive effect (the ACE-inhibitor equivalent is already rule 7 above).
        .init(drug1Pattern: "nsaid", drug2Pattern: "arb",
              severity: .moderate,
              mechanism: "NSAIDs blunt prostaglandin-mediated renal vasodilation and antagonise the antihypertensive effect (BNF)",
              clinicalEffect: "Risk of acute kidney injury; reduced antihypertensive effect",
              management: "Avoid in CKD, dehydration or with a diuretic; monitor renal function and potassium"),

        // ── Rules ported from the dashboard's original list (platform parity) ──────────────
        // Same terms, grade, effect (`clinicalEffect`) and action (`management`) as the web
        // `drug-interactions.ts`, grouped as on the web. The web has no mechanism field; each
        // mechanism here is a short BNF / Stockley's / SmPC summary. Every other web-only rule
        // is already raised here by a broader class rule (e.g. web tramadol + sertraline ⊂
        // tramadol + ssri). `lint:interaction-parity` (CI) fails if either platform has a rule
        // pair the other cannot raise. These terms are not in `legacyTerms`, so they match
        // through their `DrugClasses` members as whole words only.

        // Antibiotics
        .init(drug1Pattern: "metronidazole", drug2Pattern: "alcohol",
              severity: .contraindicated,
              mechanism: "Metronidazole inhibits aldehyde dehydrogenase, so acetaldehyde accumulates after alcohol (BNF; metronidazole SmPC)",
              clinicalEffect: "Disulfiram-like reaction (flushing, vomiting)",
              management: "Abstain from alcohol during and 48 h after course"),

        .init(drug1Pattern: "ciprofloxacin", drug2Pattern: "theophylline",
              severity: .major,
              mechanism: "Ciprofloxacin inhibits CYP1A2, reducing theophylline clearance (BNF)",
              clinicalEffect: "Theophylline toxicity",
              management: "Halve theophylline dose; monitor levels"),

        .init(drug1Pattern: "ciprofloxacin", drug2Pattern: "antacid",
              severity: .moderate,
              mechanism: "Aluminium, magnesium and calcium chelate ciprofloxacin in the gut (BNF; ciprofloxacin SmPC)",
              clinicalEffect: "Reduced ciprofloxacin absorption",
              management: "Separate doses by ≥2 hours"),

        .init(drug1Pattern: "clindamycin", drug2Pattern: "neuromuscular blocking",
              severity: .moderate,
              mechanism: "Clindamycin has intrinsic neuromuscular blocking activity (BNF; clindamycin SmPC)",
              clinicalEffect: "Enhanced neuromuscular blockade",
              management: "Monitor for prolonged paralysis"),

        // Anticoagulants / cardiovascular
        .init(drug1Pattern: "warfarin", drug2Pattern: "amiodarone",
              severity: .major,
              mechanism: "Amiodarone inhibits CYP2C9 and CYP3A4, reducing warfarin metabolism; the effect persists for weeks after stopping (BNF)",
              clinicalEffect: "Potentiates anticoagulation significantly",
              management: "Reduce warfarin by 30–50%; frequent INR"),

        .init(drug1Pattern: "digoxin", drug2Pattern: "amiodarone",
              severity: .major,
              mechanism: "Amiodarone reduces digoxin clearance (P-glycoprotein inhibition) (BNF)",
              clinicalEffect: "Digoxin toxicity (↑ digoxin levels)",
              management: "Halve digoxin dose when adding amiodarone; monitor levels"),

        .init(drug1Pattern: "digoxin", drug2Pattern: "furosemide",
              severity: .major,
              mechanism: "Loop-diuretic hypokalaemia increases myocardial sensitivity to digoxin (BNF)",
              clinicalEffect: "Hypokalaemia potentiates digoxin toxicity",
              management: "Monitor potassium; replace aggressively"),

        .init(drug1Pattern: "ace inhibitor", drug2Pattern: "potassium",
              severity: .major,
              mechanism: "ACE inhibitors reduce aldosterone and renal potassium excretion; the supplement adds potassium (BNF)",
              clinicalEffect: "Hyperkalaemia",
              management: "Monitor potassium closely; avoid potassium supplements unless clearly necessary"),

        .init(drug1Pattern: "lisinopril", drug2Pattern: "potassium",
              severity: .major,
              mechanism: "ACE inhibitors reduce aldosterone and renal potassium excretion; the supplement adds potassium (BNF)",
              clinicalEffect: "Hyperkalaemia",
              management: "Monitor potassium"),

        .init(drug1Pattern: "amlodipine", drug2Pattern: "simvastatin",
              severity: .major,
              mechanism: "Amlodipine inhibits CYP3A4, raising simvastatin exposure (BNF; simvastatin SmPC)",
              clinicalEffect: "Increased simvastatin plasma level → myopathy",
              management: "Limit simvastatin to 20 mg/day or switch to rosuvastatin"),

        // Analgesics / anaesthesia
        .init(drug1Pattern: "nsaid", drug2Pattern: "steroid",
              severity: .major,
              mechanism: "Additive GI mucosal injury: NSAIDs inhibit protective prostaglandins and corticosteroids impair mucosal healing (BNF)",
              clinicalEffect: "Increased risk of peptic ulceration and GI bleed",
              management: "Co-prescribe PPI (omeprazole 20mg od)"),

        .init(drug1Pattern: "paracetamol", drug2Pattern: "alcohol",
              severity: .major,
              mechanism: "Chronic alcohol use induces CYP2E1 and depletes glutathione, increasing the toxic paracetamol metabolite (NAPQI) (BNF)",
              clinicalEffect: "Hepatotoxicity risk in chronic alcohol use",
              management: "Reduce paracetamol to 2g/day max in alcoholic patients"),

        // Endocrine / metabolic
        .init(drug1Pattern: "metformin", drug2Pattern: "alcohol",
              severity: .moderate,
              mechanism: "Alcohol impairs hepatic lactate clearance (BNF; metformin SmPC)",
              clinicalEffect: "Increased lactic acidosis risk",
              management: "Advise alcohol reduction"),

        .init(drug1Pattern: "insulin", drug2Pattern: "beta blocker",
              severity: .moderate,
              mechanism: "Beta-blockers mask the adrenergic warning signs of hypoglycaemia (tremor, tachycardia) and may delay glucose recovery (BNF)",
              clinicalEffect: "Hypoglycaemia masked; delayed recovery",
              management: "Monitor BGL closely; use cardioselective beta-blocker"),

        .init(drug1Pattern: "steroid", drug2Pattern: "insulin",
              severity: .moderate,
              mechanism: "Corticosteroids antagonise insulin action and increase hepatic glucose output (BNF)",
              clinicalEffect: "Corticosteroids raise blood glucose",
              management: "Increase insulin monitoring; may need steroid cover protocol"),

        // Psychiatric / neurological
        .init(drug1Pattern: "maoi", drug2Pattern: "tramadol",
              severity: .contraindicated,
              mechanism: "Tramadol inhibits serotonin re-uptake; with monoamine-oxidase inhibition the serotonergic effect is additive (BNF; tramadol SmPC)",
              clinicalEffect: "Severe serotonin syndrome",
              management: "Contraindicated; do not co-administer"),

        .init(drug1Pattern: "maoi", drug2Pattern: "pethidine",
              severity: .contraindicated,
              mechanism: "Pethidine inhibits serotonin re-uptake; with monoamine-oxidase inhibition it causes serotonergic excitation or CNS depression (BNF; pethidine SmPC)",
              clinicalEffect: "Life-threatening serotonin crisis",
              management: "Contraindicated; use morphine instead"),

        .init(drug1Pattern: "lithium", drug2Pattern: "nsaid",
              severity: .major,
              mechanism: "NSAIDs reduce renal lithium excretion (BNF)",
              clinicalEffect: "Lithium toxicity (NSAIDs reduce renal lithium clearance)",
              management: "Avoid NSAIDs; monitor lithium levels"),

        .init(drug1Pattern: "lithium", drug2Pattern: "diuretic",
              severity: .major,
              mechanism: "Diuretics (especially thiazides) reduce renal lithium excretion (BNF)",
              clinicalEffect: "Lithium toxicity",
              management: "Monitor lithium levels closely; maintain adequate fluid intake"),

        // ── Herbal products and supplements (SupplementCatalogue.swift) ────────────────────
        // A supplement recorded under "Herbs, teas, bush remedies & supplements" is screened like
        // a drug. Sources: Ang-Lee MK et al. JAMA 2001;286:208-16; OpenAnesthesia / SPAQI 2025;
        // Proc (Bayl Univ Med Cent) 2022 (supplements and bleeding); BNF interactions (St John's
        // wort); NIDDK LiverTox. Grades are conservative (major for bleeding, serotonin toxicity and
        // transplant-drug levels) and await the surgeon's review. Same terms, grade, effect and
        // action as the web `drug-interactions.ts`; `lint:interaction-parity` compares the wording
        // of every supplement rule. Stop times are for the clinician only.

        .init(drug1Pattern: "garlic", drug2Pattern: "anticoagulant",
              severity: .major,
              mechanism: "Garlic inhibits platelet aggregation; additive with anticoagulant, antiplatelet and NSAID effects (Ang-Lee JAMA 2001; Proc Bayl Univ Med Cent 2022)",
              clinicalEffect: "Increased bleeding risk (garlic inhibits platelet aggregation)",
              management: "Review before any procedure; commonly cited stop time before elective surgery at least 7 days (many advise 2 weeks) — clinician to confirm; monitor for bleeding"),

        .init(drug1Pattern: "garlic", drug2Pattern: "antiplatelet",
              severity: .major,
              mechanism: "Garlic inhibits platelet aggregation; additive with anticoagulant, antiplatelet and NSAID effects (Ang-Lee JAMA 2001; Proc Bayl Univ Med Cent 2022)",
              clinicalEffect: "Increased bleeding risk (garlic inhibits platelet aggregation)",
              management: "Review before any procedure; commonly cited stop time before elective surgery at least 7 days (many advise 2 weeks) — clinician to confirm; monitor for bleeding"),

        .init(drug1Pattern: "garlic", drug2Pattern: "nsaid",
              severity: .major,
              mechanism: "Garlic inhibits platelet aggregation; additive with anticoagulant, antiplatelet and NSAID effects (Ang-Lee JAMA 2001; Proc Bayl Univ Med Cent 2022)",
              clinicalEffect: "Increased bleeding risk (garlic inhibits platelet aggregation)",
              management: "Review before any procedure; commonly cited stop time before elective surgery at least 7 days (many advise 2 weeks) — clinician to confirm; monitor for bleeding"),

        .init(drug1Pattern: "ginkgo", drug2Pattern: "anticoagulant",
              severity: .major,
              mechanism: "Ginkgolides inhibit platelet-activating factor; additive with anticoagulant, antiplatelet and NSAID effects (Ang-Lee JAMA 2001; SPAQI 2025)",
              clinicalEffect: "Increased bleeding risk (ginkgo inhibits platelet-activating factor)",
              management: "Review before any procedure; commonly cited stop time before elective surgery at least 36 hours (SPAQI advises 2 weeks) — clinician to confirm; monitor for bleeding"),

        .init(drug1Pattern: "ginkgo", drug2Pattern: "antiplatelet",
              severity: .major,
              mechanism: "Ginkgolides inhibit platelet-activating factor; additive with anticoagulant, antiplatelet and NSAID effects (Ang-Lee JAMA 2001; SPAQI 2025)",
              clinicalEffect: "Increased bleeding risk (ginkgo inhibits platelet-activating factor)",
              management: "Review before any procedure; commonly cited stop time before elective surgery at least 36 hours (SPAQI advises 2 weeks) — clinician to confirm; monitor for bleeding"),

        .init(drug1Pattern: "ginkgo", drug2Pattern: "nsaid",
              severity: .major,
              mechanism: "Ginkgolides inhibit platelet-activating factor; additive with anticoagulant, antiplatelet and NSAID effects (Ang-Lee JAMA 2001; SPAQI 2025)",
              clinicalEffect: "Increased bleeding risk (ginkgo inhibits platelet-activating factor)",
              management: "Review before any procedure; commonly cited stop time before elective surgery at least 36 hours (SPAQI advises 2 weeks) — clinician to confirm; monitor for bleeding"),

        .init(drug1Pattern: "ginger", drug2Pattern: "anticoagulant",
              severity: .major,
              mechanism: "Ginger inhibits thromboxane synthetase (platelet function); additive with anticoagulant, antiplatelet and NSAID effects (SPAQI 2025)",
              clinicalEffect: "Increased bleeding risk (ginger inhibits thromboxane synthetase)",
              management: "Review before any procedure; commonly cited stop time before elective surgery 2 weeks (SPAQI) — clinician to confirm; monitor for bleeding"),

        .init(drug1Pattern: "ginger", drug2Pattern: "antiplatelet",
              severity: .major,
              mechanism: "Ginger inhibits thromboxane synthetase (platelet function); additive with anticoagulant, antiplatelet and NSAID effects (SPAQI 2025)",
              clinicalEffect: "Increased bleeding risk (ginger inhibits thromboxane synthetase)",
              management: "Review before any procedure; commonly cited stop time before elective surgery 2 weeks (SPAQI) — clinician to confirm; monitor for bleeding"),

        .init(drug1Pattern: "ginger", drug2Pattern: "nsaid",
              severity: .major,
              mechanism: "Ginger inhibits thromboxane synthetase (platelet function); additive with anticoagulant, antiplatelet and NSAID effects (SPAQI 2025)",
              clinicalEffect: "Increased bleeding risk (ginger inhibits thromboxane synthetase)",
              management: "Review before any procedure; commonly cited stop time before elective surgery 2 weeks (SPAQI) — clinician to confirm; monitor for bleeding"),

        .init(drug1Pattern: "turmeric", drug2Pattern: "anticoagulant",
              severity: .major,
              mechanism: "Curcumin has antiplatelet effects; additive with anticoagulant, antiplatelet and NSAID effects (J Clin Anesth 2024 review)",
              clinicalEffect: "Increased bleeding risk (curcumin has antiplatelet effects)",
              management: "Review before any procedure; commonly cited stop time before elective surgery 2 weeks — clinician to confirm; monitor for bleeding"),

        .init(drug1Pattern: "turmeric", drug2Pattern: "antiplatelet",
              severity: .major,
              mechanism: "Curcumin has antiplatelet effects; additive with anticoagulant, antiplatelet and NSAID effects (J Clin Anesth 2024 review)",
              clinicalEffect: "Increased bleeding risk (curcumin has antiplatelet effects)",
              management: "Review before any procedure; commonly cited stop time before elective surgery 2 weeks — clinician to confirm; monitor for bleeding"),

        .init(drug1Pattern: "turmeric", drug2Pattern: "nsaid",
              severity: .major,
              mechanism: "Curcumin has antiplatelet effects; additive with anticoagulant, antiplatelet and NSAID effects (J Clin Anesth 2024 review)",
              clinicalEffect: "Increased bleeding risk (curcumin has antiplatelet effects)",
              management: "Review before any procedure; commonly cited stop time before elective surgery 2 weeks — clinician to confirm; monitor for bleeding"),

        .init(drug1Pattern: "ginseng", drug2Pattern: "anticoagulant",
              severity: .major,
              mechanism: "Ginsenosides may inhibit platelet function and lower blood glucose; American ginseng reduced the INR with warfarin (Ang-Lee JAMA 2001; SPAQI 2025)",
              clinicalEffect: "Possible increased bleeding risk (ginseng may inhibit platelet function)",
              management: "Review before any procedure; commonly cited stop time before elective surgery at least 7 days (SPAQI advises 2 weeks) — clinician to confirm; monitor for bleeding"),

        .init(drug1Pattern: "ginseng", drug2Pattern: "antiplatelet",
              severity: .major,
              mechanism: "Ginsenosides may inhibit platelet function and lower blood glucose; American ginseng reduced the INR with warfarin (Ang-Lee JAMA 2001; SPAQI 2025)",
              clinicalEffect: "Possible increased bleeding risk (ginseng may inhibit platelet function)",
              management: "Review before any procedure; commonly cited stop time before elective surgery at least 7 days (SPAQI advises 2 weeks) — clinician to confirm; monitor for bleeding"),

        .init(drug1Pattern: "ginseng", drug2Pattern: "nsaid",
              severity: .major,
              mechanism: "Ginsenosides may inhibit platelet function and lower blood glucose; American ginseng reduced the INR with warfarin (Ang-Lee JAMA 2001; SPAQI 2025)",
              clinicalEffect: "Possible increased bleeding risk (ginseng may inhibit platelet function)",
              management: "Review before any procedure; commonly cited stop time before elective surgery at least 7 days (SPAQI advises 2 weeks) — clinician to confirm; monitor for bleeding"),

        .init(drug1Pattern: "st johns wort", drug2Pattern: "warfarin",
              severity: .major,
              mechanism: "St John's wort induces CYP3A4 and P-glycoprotein and is serotonergic (Ang-Lee JAMA 2001; BNF interactions)",
              clinicalEffect: "Reduced warfarin effect — INR falls (St John's wort induces warfarin metabolism)",
              management: "Avoid combination; if St John's wort is stopped, check INR closely (it may rise)"),

        .init(drug1Pattern: "st johns wort", drug2Pattern: "doac",
              severity: .major,
              mechanism: "St John's wort induces CYP3A4 and P-glycoprotein and is serotonergic (Ang-Lee JAMA 2001; BNF interactions)",
              clinicalEffect: "Reduced DOAC levels (CYP3A4 / P-glycoprotein induction) — risk of thrombosis",
              management: "Avoid combination"),

        .init(drug1Pattern: "st johns wort", drug2Pattern: "calcineurin inhibitor",
              severity: .major,
              mechanism: "St John's wort induces CYP3A4 and P-glycoprotein and is serotonergic (Ang-Lee JAMA 2001; BNF interactions)",
              clinicalEffect: "Reduced ciclosporin / tacrolimus levels (CYP3A4 / P-glycoprotein induction) — risk of transplant rejection",
              management: "Avoid combination; check drug levels if it has been taken"),

        .init(drug1Pattern: "st johns wort", drug2Pattern: "ssri",
              severity: .major,
              mechanism: "St John's wort induces CYP3A4 and P-glycoprotein and is serotonergic (Ang-Lee JAMA 2001; BNF interactions)",
              clinicalEffect: "Serotonin syndrome risk",
              management: "Avoid combination"),

        .init(drug1Pattern: "st johns wort", drug2Pattern: "snri",
              severity: .major,
              mechanism: "St John's wort induces CYP3A4 and P-glycoprotein and is serotonergic (Ang-Lee JAMA 2001; BNF interactions)",
              clinicalEffect: "Serotonin syndrome risk",
              management: "Avoid combination"),

        .init(drug1Pattern: "st johns wort", drug2Pattern: "triptan",
              severity: .major,
              mechanism: "St John's wort induces CYP3A4 and P-glycoprotein and is serotonergic (Ang-Lee JAMA 2001; BNF interactions)",
              clinicalEffect: "Serotonin syndrome risk",
              management: "Avoid combination"),

        .init(drug1Pattern: "st johns wort", drug2Pattern: "combined oral contraceptive",
              severity: .major,
              mechanism: "St John's wort induces CYP3A4 and P-glycoprotein and is serotonergic (Ang-Lee JAMA 2001; BNF interactions)",
              clinicalEffect: "Reduced contraceptive efficacy (enzyme induction) — breakthrough bleeding and unplanned pregnancy",
              management: "Avoid combination; advise additional or alternative contraception"),

        .init(drug1Pattern: "ginseng", drug2Pattern: "insulin",
              severity: .moderate,
              mechanism: "Ginsenosides may inhibit platelet function and lower blood glucose; American ginseng reduced the INR with warfarin (Ang-Lee JAMA 2001; SPAQI 2025)",
              clinicalEffect: "Hypoglycaemia risk, especially in fasting patients (pre-op fast or religious fast)",
              management: "Monitor blood glucose, especially while fasting; commonly cited stop time before elective surgery at least 7 days (SPAQI advises 2 weeks) — clinician to confirm"),

        .init(drug1Pattern: "ginseng", drug2Pattern: "sulfonylurea",
              severity: .moderate,
              mechanism: "Ginsenosides may inhibit platelet function and lower blood glucose; American ginseng reduced the INR with warfarin (Ang-Lee JAMA 2001; SPAQI 2025)",
              clinicalEffect: "Hypoglycaemia risk, especially in fasting patients (pre-op fast or religious fast)",
              management: "Monitor blood glucose, especially while fasting; commonly cited stop time before elective surgery at least 7 days (SPAQI advises 2 weeks) — clinician to confirm"),

        .init(drug1Pattern: "ginseng", drug2Pattern: "warfarin",
              severity: .moderate,
              mechanism: "Ginsenosides may inhibit platelet function and lower blood glucose; American ginseng reduced the INR with warfarin (Ang-Lee JAMA 2001; SPAQI 2025)",
              clinicalEffect: "Reduced INR reported (American ginseng)",
              management: "Check INR when ginseng is started or stopped"),

        .init(drug1Pattern: "kava", drug2Pattern: "benzodiazepine",
              severity: .moderate,
              mechanism: "Kava potentiates GABA-mediated CNS depression and anaesthetic sedation (Ang-Lee JAMA 2001)",
              clinicalEffect: "Additive sedation / CNS depression",
              management: "Avoid combining; commonly cited stop time before surgery 24 hours — clinician to confirm; tell the anaesthetist"),

        .init(drug1Pattern: "kava", drug2Pattern: "opioid",
              severity: .moderate,
              mechanism: "Kava potentiates GABA-mediated CNS depression and anaesthetic sedation (Ang-Lee JAMA 2001)",
              clinicalEffect: "Additive sedation / CNS depression",
              management: "Avoid combining; commonly cited stop time before surgery 24 hours — clinician to confirm; tell the anaesthetist"),

        .init(drug1Pattern: "kava", drug2Pattern: "sedative hypnotic",
              severity: .moderate,
              mechanism: "Kava potentiates GABA-mediated CNS depression and anaesthetic sedation (Ang-Lee JAMA 2001)",
              clinicalEffect: "Additive sedation / CNS depression",
              management: "Avoid combining; commonly cited stop time before surgery 24 hours — clinician to confirm; tell the anaesthetist"),

        .init(drug1Pattern: "kava", drug2Pattern: "general anaesthetic",
              severity: .moderate,
              mechanism: "Kava potentiates GABA-mediated CNS depression and anaesthetic sedation (Ang-Lee JAMA 2001)",
              clinicalEffect: "Potentiates anaesthetic sedation",
              management: "Commonly cited stop time before surgery 24 hours — clinician to confirm; tell the anaesthetist"),

        .init(drug1Pattern: "valerian", drug2Pattern: "benzodiazepine",
              severity: .moderate,
              mechanism: "Valerian potentiates GABA-mediated CNS depression; abrupt withdrawal resembles benzodiazepine withdrawal (Ang-Lee JAMA 2001)",
              clinicalEffect: "Additive sedation / CNS depression",
              management: "Avoid combining; valerian is tapered over 1–2 weeks rather than stopped suddenly — clinician to confirm; tell the anaesthetist"),

        .init(drug1Pattern: "valerian", drug2Pattern: "opioid",
              severity: .moderate,
              mechanism: "Valerian potentiates GABA-mediated CNS depression; abrupt withdrawal resembles benzodiazepine withdrawal (Ang-Lee JAMA 2001)",
              clinicalEffect: "Additive sedation / CNS depression",
              management: "Avoid combining; valerian is tapered over 1–2 weeks rather than stopped suddenly — clinician to confirm; tell the anaesthetist"),

        .init(drug1Pattern: "valerian", drug2Pattern: "sedative hypnotic",
              severity: .moderate,
              mechanism: "Valerian potentiates GABA-mediated CNS depression; abrupt withdrawal resembles benzodiazepine withdrawal (Ang-Lee JAMA 2001)",
              clinicalEffect: "Additive sedation / CNS depression",
              management: "Avoid combining; valerian is tapered over 1–2 weeks rather than stopped suddenly — clinician to confirm; tell the anaesthetist"),

        .init(drug1Pattern: "valerian", drug2Pattern: "general anaesthetic",
              severity: .moderate,
              mechanism: "Valerian potentiates GABA-mediated CNS depression; abrupt withdrawal resembles benzodiazepine withdrawal (Ang-Lee JAMA 2001)",
              clinicalEffect: "Potentiates anaesthetic sedation; abrupt withdrawal can cause a benzodiazepine-like withdrawal",
              management: "Taper valerian over 1–2 weeks before elective surgery rather than stopping suddenly — clinician to confirm; tell the anaesthetist"),

        .init(drug1Pattern: "ephedra", drug2Pattern: "maoi",
              severity: .contraindicated,
              mechanism: "Ephedra (ephedrine alkaloids) is a direct and indirect sympathomimetic (Ang-Lee JAMA 2001; BNF)",
              clinicalEffect: "Hypertensive crisis",
              management: "Contraindicated; do not co-administer"),

        .init(drug1Pattern: "ephedra", drug2Pattern: "sympathomimetic",
              severity: .major,
              mechanism: "Ephedra (ephedrine alkaloids) is a direct and indirect sympathomimetic (Ang-Lee JAMA 2001; BNF)",
              clinicalEffect: "Hypertension, tachycardia and arrhythmia (additive sympathomimetic effect)",
              management: "Avoid combination"),

        .init(drug1Pattern: "ephedra", drug2Pattern: "general anaesthetic",
              severity: .major,
              mechanism: "Ephedra (ephedrine alkaloids) is a direct and indirect sympathomimetic (Ang-Lee JAMA 2001; BNF)",
              clinicalEffect: "Intra-operative haemodynamic instability — hypertension and arrhythmia",
              management: "Commonly cited stop time before surgery at least 24 hours (ideally avoid entirely) — clinician to confirm; tell the anaesthetist"),

        .init(drug1Pattern: "ashwagandha", drug2Pattern: "levothyroxine",
              severity: .moderate,
              mechanism: "Withania somnifera may raise thyroid hormone levels, is sedating and may stimulate immune function (NIDDK LiverTox; Danish ban 2023)",
              clinicalEffect: "May raise thyroid hormone levels (additive with levothyroxine)",
              management: "Check thyroid function; ashwagandha is best avoided in thyroid disease"),

        .init(drug1Pattern: "ashwagandha", drug2Pattern: "benzodiazepine",
              severity: .moderate,
              mechanism: "Withania somnifera may raise thyroid hormone levels, is sedating and may stimulate immune function (NIDDK LiverTox; Danish ban 2023)",
              clinicalEffect: "Additive sedation",
              management: "Avoid combining; tell the anaesthetist"),

        .init(drug1Pattern: "ashwagandha", drug2Pattern: "sedative hypnotic",
              severity: .moderate,
              mechanism: "Withania somnifera may raise thyroid hormone levels, is sedating and may stimulate immune function (NIDDK LiverTox; Danish ban 2023)",
              clinicalEffect: "Additive sedation",
              management: "Avoid combining; tell the anaesthetist"),

        .init(drug1Pattern: "ashwagandha", drug2Pattern: "immunosuppressant",
              severity: .moderate,
              mechanism: "Withania somnifera may raise thyroid hormone levels, is sedating and may stimulate immune function (NIDDK LiverTox; Danish ban 2023)",
              clinicalEffect: "May stimulate immune function and oppose immunosuppression",
              management: "Avoid in transplant recipients and before planned immunosuppression"),

        .init(drug1Pattern: "echinacea", drug2Pattern: "immunosuppressant",
              severity: .moderate,
              mechanism: "Echinacea has immune-stimulating effects that may oppose immunosuppression (Ang-Lee JAMA 2001)",
              clinicalEffect: "May oppose immunosuppression (immune-stimulating effects)",
              management: "Avoid in transplant recipients; stop early before planned immunosuppression or transplant-type surgery"),
    ]
}
