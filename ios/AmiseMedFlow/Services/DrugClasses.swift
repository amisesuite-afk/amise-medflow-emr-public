// DrugClasses.swift
// Drug-term vocabulary for the interaction screen (`DrugInteractionService`) — hazard log H-07.
//
// Interaction rules are written against TERMS: either a class ("nsaid", "opioid", "ssri") or a
// specific drug ("warfarin"). A class name never appears in a real prescription string, so
// before this map "Warfarin" + "Diclofenac" raised NO alert (the rule said "warfarin" + "nsaid").
// Every term used by any rule MUST have an entry here; `DrugInteractionTests` fails when a rule
// names a term that is not mapped, or a class that has no members.
//
// Ported from the dashboard's `artifacts/dashboard/src/lib/drug-classes.ts` (same members,
// brands and citations). The iOS rule list also names nine specific drugs the web list does not
// (diclofenac, ketorolac, enoxaparin, venlafaxine, fentanyl, vancomycin, co-amoxiclav,
// lansoprazole, ondansetron); they are appended at the end with their synonyms/brands.
//
// Member syntax: "generic|synonym|Brand|Brand". The first name is the canonical generic (used
// to tell two different drugs of the same class apart); the rest are older/other INN spellings
// (frusemide, indomethacin, meperidine, acetaminophen) and common Caribbean / UK / US brand
// names. Members match case-insensitively as WHOLE WORDS, so a short brand cannot fire inside
// an unrelated word (e.g. "ASA" never matches "nasal").
//
// Two matching details differ from the web file, both to avoid false alerts:
//  - the pre-H-07 raw-substring match is kept only for terms the ORIGINAL iOS rules use
//    (`DrugInteractionService.legacyTerms`), so the new "arb" term cannot fire inside
//    "Carbamazepine", "Carboplatin" or "Calcium carbonate";
//  - a name directly after "<digit>-" is not a word start, so the formulary entry
//    "Mesalazine (5-ASA, Pentasa)" is not read as ASA (aspirin).
//
// Class membership follows the BNF (British National Formulary — drug monographs and the
// Interactions appendix) and Stockley's Drug Interactions; brand names from the product SmPCs
// (UK eMC) / US labels. QT-prolonging membership follows CredibleMeds "Known Risk of TdP"
// (AZCERT), cross-checked with the BNF. Each term records its source.
//
// Decision support only. This list is partial by design; absence of an alert does not mean
// absence of an interaction.

import Foundation

struct DrugTermDef {
    enum Kind { case drugClass, drug }

    /// `.drugClass` = pharmacological class; `.drug` = a single drug (members = its synonyms/brands).
    let kind: Kind
    /// Display label shown when an alert fires through class membership (e.g. "NSAID").
    let label: String
    /// Standard the membership is taken from — required for every clinical term.
    let source: String
    /// "generic|synonym|Brand…" strings. A class must have at least one member.
    let members: [String]
}

struct DrugTermMember: Equatable {
    /// Canonical generic (first name), lowercased.
    let generic: String
    /// All names, lowercased, including the generic.
    let names: [String]
}

struct DrugTermMatch: Equatable {
    /// Canonical drug identity (generic name, or the raw term for a legacy substring match).
    let canonical: String
    /// True when the raw term is a substring of the entry (the pre-H-07 matching rule).
    let legacy: Bool
    /// Class label when matched through class membership (e.g. "NSAID"), else nil.
    let viaClass: String?
}

enum DrugClasses {

    // MARK: - Parsing / matching

    static func parseMember(_ member: String) -> DrugTermMember {
        let names: [String] = member.split(separator: "|")
            .map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
            .filter { !$0.isEmpty }
        return DrugTermMember(generic: names.first ?? "", names: names)
    }

    private struct CompiledMember {
        let generic: String
        let names: [[UInt8]]
    }

    private static let compiled: [String: [CompiledMember]] = {
        var out: [String: [CompiledMember]] = [:]
        for (term, def) in DrugClasses.terms {
            out[term] = def.members.map { (raw: String) -> CompiledMember in
                let parsed = DrugClasses.parseMember(raw)
                return CompiledMember(generic: parsed.generic, names: parsed.names.map { Array($0.utf8) })
            }
        }
        return out
    }()

    /// Does the medication entry match a rule term?
    ///  1. Pre-H-07 behaviour, kept unchanged so no existing alert can disappear: the raw term as
    ///     a substring of the lowercased entry ("nsaid" in "nsaid prn", "warfarin" in "warfarin 5mg").
    ///     Only for terms the original iOS rules use (`DrugInteractionService.legacyTerms`); a
    ///     term that only the new rules use is never substring-matched, so "arb" cannot fire
    ///     inside "carbamazepine" or "calcium carbonate".
    ///  2. NEW (H-07): any member name of the term, as a whole word.
    static func match(term: String, in entry: String) -> DrugTermMatch? {
        let t = term.lowercased()
        let lc = entry.lowercased()
        return match(term: t, lowercasedEntry: lc, bytes: Array(lc.utf8),
                     substringFallback: DrugInteractionService.legacyTerms.contains(t))
    }

    /// Fast path for the interaction screen: `lowercasedEntry` is already lowercased and
    /// `bytes` is its UTF-8. `term` must be lowercase.
    static func match(term: String, lowercasedEntry lc: String, bytes: [UInt8],
                      substringFallback: Bool) -> DrugTermMatch? {
        let substringHit = substringFallback && lc.contains(term)
        if let def = terms[term], let members = compiled[term] {
            for member in members {
                if member.names.contains(where: { isWholeWord($0, in: bytes) }) {
                    return DrugTermMatch(canonical: member.generic,
                                         legacy: substringHit,
                                         viaClass: def.kind == .drugClass ? def.label : nil)
                }
            }
        }
        if substringHit {
            return DrugTermMatch(canonical: term, legacy: true, viaClass: nil)
        }
        return nil
    }

    /// Case-insensitive whole-word test: `name` must not be embedded in a longer word.
    /// "asa" matches "ASA 81 mg" but not "nasal spray".
    static func containsWholeWord(_ name: String, in text: String) -> Bool {
        isWholeWord(Array(name.lowercased().utf8), in: Array(text.lowercased().utf8))
    }

    /// Same boundary rule as the web regex `(^|[^a-z0-9])name(?=$|[^a-z0-9])` on lowercased
    /// text, plus one exception: a name directly after "<digit>-" is part of a chemical
    /// abbreviation, not a new word. "5-ASA" (mesalazine; the formulary entry is
    /// "Mesalazine (5-ASA, Pentasa)") must not read as "ASA" (aspirin).
    /// Every member name is ASCII, so a byte match can never start inside a multi-byte
    /// character, and any non-ASCII byte counts as a boundary (as it does in the web regex).
    private static func isWholeWord(_ needle: [UInt8], in hay: [UInt8]) -> Bool {
        let n = needle.count
        let h = hay.count
        guard n > 0, n <= h else { return false }
        var start = 0
        while start + n <= h {
            var same = true
            var k = 0
            while k < n {
                if hay[start + k] != needle[k] { same = false; break }
                k += 1
            }
            if same {
                let boundaryBefore = start == 0
                    || (!isWordByte(hay[start - 1]) && !followsDigitHyphen(hay, start))
                let boundaryAfter = start + n == h || !isWordByte(hay[start + n])
                if boundaryBefore && boundaryAfter { return true }
            }
            start += 1
        }
        return false
    }

    /// ASCII a–z or 0–9 (text is lowercased before matching).
    private static func isWordByte(_ b: UInt8) -> Bool {
        (b >= 0x61 && b <= 0x7A) || (b >= 0x30 && b <= 0x39)
    }

    /// True when the bytes just before `start` are "<digit>-" (e.g. the "5-" of "5-asa").
    private static func followsDigitHyphen(_ hay: [UInt8], _ start: Int) -> Bool {
        guard start >= 2, hay[start - 1] == 0x2D else { return false }
        let d = hay[start - 2]
        return d >= 0x30 && d <= 0x39
    }

    // MARK: - Vocabulary

    // ── Reusable member lists (same as the web file) ──────────────────────────────

    private static let bnf = "BNF (drug monographs and Interactions appendix); Stockley's Drug Interactions"

    private static let warfarinNames = "warfarin|coumadin|marevan|jantoven"
    private static let aspirinNames = "aspirin|acetylsalicylic acid|asa|ecotrin|disprin|nu-seals|aspro"
    private static let ciprofloxacinNames = "ciprofloxacin|cipro|ciproxin"
    private static let fluconazoleNames = "fluconazole|diflucan"
    private static let amiodaroneNames = "amiodarone|cordarone|pacerone"
    private static let citalopramNames = "citalopram|cipramil|celexa"
    private static let escitalopramNames = "escitalopram|cipralex|lexapro"
    private static let erythromycinNames = "erythromycin|erythrocin|erymax|e-mycin"
    private static let clarithromycinNames = "clarithromycin|klaricid|biaxin"
    private static let azithromycinNames = "azithromycin|zithromax"
    private static let sotalolNames = "sotalol|sotacor|beta-cardone|betapace"
    private static let spironolactoneNames = "spironolactone|aldactone"
    private static let eplerenoneNames = "eplerenone|inspra"
    private static let amilorideNames = "amiloride|midamor|moduretic|co-amilofruse|co-amilozide"
    private static let triamtereneNames = "triamterene|dyazide|dytac|maxzide"
    private static let heparinNames: [String] = [
        "heparin|heparin sodium|unfractionated heparin",
        "enoxaparin|clexane|lovenox|inhixa",
        "dalteparin|fragmin",
        "tinzaparin|innohep",
    ]

    // anticoagulant = coumarins/phenindione + DOACs + heparins + fondaparinux + parenteral DTIs.
    private static let anticoagulantMembers: [String] =
        [
            warfarinNames,
            "acenocoumarol|sinthrome|sintrom",
            "phenindione",
            "rivaroxaban|xarelto",
            "apixaban|eliquis",
            "dabigatran|pradaxa",
            "edoxaban|lixiana|savaysa",
        ]
        + heparinNames
        + [
            "fondaparinux|arixtra",
            "argatroban",
            "bivalirudin|angiomax",
        ]

    /// Every term used by a rule in `DrugInteractionService.rules` MUST have an entry here
    /// (`DrugInteractionTests` fails otherwise). Keys are lowercase rule terms.
    static let terms: [String: DrugTermDef] = [
        // ═════════════════════════════ CLASSES ═════════════════════════════

        "nsaid": DrugTermDef(
            kind: .drugClass, label: "NSAID",
            source: "\(bnf) — non-steroidal anti-inflammatory drugs. Aspirin is deliberately NOT included: the BNF lists it under antiplatelet drugs and handles its interactions separately (e.g. low-dose aspirin + lithium is not the NSAID interaction).",
            members: [
                "diclofenac|voltaren|voltarol|cataflam|arthrotec|dyloject",
                "ibuprofen|advil|motrin|nurofen|brufen",
                "naproxen|naprosyn|aleve|anaprox|naprogesic|vimovo",
                "ketorolac|toradol",
                "celecoxib|celebrex",
                "etoricoxib|arcoxia",
                "parecoxib|dynastat",
                "meloxicam|mobic",
                "indometacin|indomethacin|indocin|indocid",
                "mefenamic acid|ponstan",
                "piroxicam|feldene",
                "ketoprofen|oruvail",
                "dexketoprofen|keral",
                "aceclofenac|preservex",
                "etodolac|lodine",
                "nabumetone|relifex",
                "flurbiprofen",
                "sulindac",
                "tenoxicam|mobiflex",
                "lornoxicam",
                "diflunisal",
                "tolfenamic acid",
            ]),

        "opioid": DrugTermDef(
            kind: .drugClass, label: "opioid",
            source: "\(bnf) — opioid analgesics (incl. combination products containing codeine/dihydrocodeine/tramadol/oxycodone).",
            members: [
                "morphine|mst continus|ms contin|oramorph|sevredol|zomorph",
                "diamorphine",
                "codeine|codeine phosphate|co-codamol|tylenol with codeine|tylenol #3|solpadeine|kapake|zapain",
                "dihydrocodeine|df118|dhc continus|co-dydramol",
                "oxycodone|oxycontin|oxynorm|percocet|endone|targinact",
                "hydromorphone|palladone|dilaudid",
                "fentanyl|durogesic|actiq|abstral|sublimaze",
                "alfentanil",
                "remifentanil|ultiva",
                "sufentanil",
                "tramadol|ultram|zydol|zamadol|tramacet|ultracet",
                "tapentadol|palexia|nucynta",
                "pethidine|meperidine|demerol",
                "methadone|physeptone",
                "buprenorphine|subutex|suboxone|temgesic|butrans|transtec",
                "hydrocodone|vicodin|norco",
                "nalbuphine|nubain",
                "pentazocine",
                "meptazinol",
            ]),

        "benzodiazepine": DrugTermDef(
            kind: .drugClass, label: "benzodiazepine",
            source: "\(bnf) — benzodiazepines (MHRA Drug Safety Update, March 2020: opioids + benzodiazepines, risk of profound sedation, respiratory depression, coma and death).",
            members: [
                "diazepam|valium|stesolid",
                "lorazepam|ativan",
                "midazolam|hypnovel|versed|buccolam|epistatus",
                "alprazolam|xanax",
                "clonazepam|klonopin|rivotril",
                "temazepam",
                "chlordiazepoxide|librium",
                "nitrazepam|mogadon",
                "oxazepam",
                "bromazepam|lexotan",
                "clobazam|frisium",
                "lormetazepam",
                "flurazepam",
                "clorazepate|tranxene",
                "remimazolam|byfavo",
            ]),

        "ssri": DrugTermDef(
            kind: .drugClass, label: "SSRI",
            source: "\(bnf) — selective serotonin re-uptake inhibitors.",
            members: [
                "sertraline|zoloft|lustral",
                "fluoxetine|prozac|sarafem",
                citalopramNames,
                escitalopramNames,
                "paroxetine|seroxat|paxil",
                "fluvoxamine|faverin|luvox",
            ]),

        "snri": DrugTermDef(
            kind: .drugClass, label: "SNRI",
            source: "\(bnf) — serotonin and noradrenaline re-uptake inhibitors.",
            members: [
                "venlafaxine|effexor|efexor",
                "desvenlafaxine|pristiq",
                "duloxetine|cymbalta|yentreve",
                "milnacipran|savella",
                "levomilnacipran|fetzima",
            ]),

        "maoi": DrugTermDef(
            kind: .drugClass, label: "MAOI",
            source: "\(bnf) — monoamine-oxidase inhibitors, irreversible and reversible (moclobemide), MAO-B inhibitors (selegiline, rasagiline, safinamide: SmPCs contraindicate pethidine and warn on tramadol/SSRIs). Linezolid is a reversible non-selective MAOI (BNF; Zyvox SmPC). Methylthioninium chloride (methylene blue) is a potent MAO-A inhibitor — MHRA/Proveblue SmPC: serotonin syndrome with serotonergic drugs; relevant to parathyroid/sentinel-node surgery.",
            members: [
                "phenelzine|nardil",
                "tranylcypromine|parnate",
                "isocarboxazid|marplan",
                "moclobemide|manerix|aurorix",
                "selegiline|eldepryl|zelapar|emsam",
                "rasagiline|azilect",
                "safinamide|xadago",
                "linezolid|zyvox",
                "methylthioninium chloride|methylene blue|methylthioninium|proveblue",
            ]),

        "steroid": DrugTermDef(
            kind: .drugClass, label: "systemic corticosteroid",
            source: "\(bnf) — systemic corticosteroids (hyperglycaemia; GI bleeding with NSAIDs). Inhaled/topical-only agents (beclometasone, fluticasone, mometasone) are deliberately not listed.",
            members: [
                "prednisolone",
                "prednisone|deltasone",
                "hydrocortisone|solu-cortef|efcortesol",
                "methylprednisolone|solu-medrol|medrol|depo-medrone",
                "dexamethasone|decadron",
                "deflazacort",
            ]),

        "ace inhibitor": DrugTermDef(
            kind: .drugClass, label: "ACE inhibitor",
            source: "\(bnf) — angiotensin-converting enzyme inhibitors.",
            members: [
                "lisinopril|zestril|prinivil|zestoretic|carace",
                "enalapril|vasotec|innovace|renitec",
                "ramipril|tritace|altace",
                "perindopril|coversyl|aceon",
                "captopril|capoten",
                "quinapril|accupro|accupril",
                "fosinopril",
                "trandolapril|gopten|mavik",
                "benazepril|lotensin",
                "cilazapril",
                "imidapril",
                "moexipril",
            ]),

        "arb": DrugTermDef(
            kind: .drugClass, label: "angiotensin-II receptor blocker",
            source: "\(bnf) — angiotensin-II receptor antagonists (incl. sacubitril/valsartan).",
            members: [
                "losartan|cozaar|hyzaar",
                "valsartan|diovan|entresto|exforge",
                "irbesartan|aprovel|avapro",
                "candesartan|atacand|amias",
                "telmisartan|micardis",
                "olmesartan|benicar|olmetec",
                "azilsartan|edarbi",
                "eprosartan",
            ]),

        "diuretic": DrugTermDef(
            kind: .drugClass, label: "diuretic",
            source: "\(bnf) — loop, thiazide/thiazide-like and potassium-sparing diuretics (lithium: BNF — diuretics reduce lithium excretion).",
            members: [
                "furosemide|frusemide|lasix",
                "bumetanide|burinex|bumex",
                "torasemide|torsemide|demadex",
                "bendroflumethiazide|bendrofluazide|aprinox",
                "hydrochlorothiazide|hctz",
                "chlortalidone|chlorthalidone|hygroton",
                "indapamide|natrilix|natrixam",
                "metolazone|zaroxolyn",
                spironolactoneNames,
                eplerenoneNames,
                amilorideNames,
                triamtereneNames,
            ]),

        "potassium-sparing diuretic": DrugTermDef(
            kind: .drugClass, label: "potassium-sparing diuretic / aldosterone antagonist",
            source: "\(bnf) — potassium-sparing diuretics and aldosterone antagonists (hyperkalaemia with ACE inhibitors / ARBs / potassium).",
            members: [
                spironolactoneNames,
                eplerenoneNames,
                amilorideNames,
                triamtereneNames,
            ]),

        "potassium": DrugTermDef(
            kind: .drugClass, label: "potassium supplement",
            source: "\(bnf) — potassium salts (oral/IV potassium chloride products).",
            members: ["potassium chloride|slow-k|sando-k|kay-cee-l|klor-con|k-dur"]),

        "beta blocker": DrugTermDef(
            kind: .drugClass, label: "beta-blocker",
            source: "\(bnf) — beta-adrenoceptor blocking drugs.",
            members: [
                "atenolol|tenormin|tenoretic|co-tenidone",
                "bisoprolol|cardicor|concor|emcor",
                "metoprolol|lopressor|betaloc|toprol",
                "propranolol|inderal",
                "carvedilol|coreg|eucardic",
                "labetalol|trandate",
                "nebivolol|nebilet|bystolic",
                sotalolNames,
                "esmolol|brevibloc",
                "nadolol|corgard",
                "acebutolol|sectral",
                "celiprolol",
            ]),

        "antacid": DrugTermDef(
            kind: .drugClass, label: "antacid",
            source: "\(bnf) — antacids containing aluminium, magnesium or calcium (chelate quinolones; separate doses). Ciprofloxacin SmPC.",
            members: [
                "aluminium hydroxide|aluminum hydroxide",
                "magnesium hydroxide|milk of magnesia",
                "magnesium trisilicate",
                "calcium carbonate|tums|rennie",
                "gaviscon",
                "maalox",
                "mylanta",
            ]),

        "neuromuscular blocking": DrugTermDef(
            kind: .drugClass, label: "neuromuscular blocker",
            source: "\(bnf) — neuromuscular blocking drugs (clindamycin enhances blockade; clindamycin SmPC).",
            members: [
                "rocuronium|esmeron|zemuron",
                "vecuronium",
                "atracurium|tracrium",
                "cisatracurium|nimbex",
                "suxamethonium|succinylcholine|anectine",
                "pancuronium",
                "mivacurium",
            ]),

        "contrast": DrugTermDef(
            kind: .drugClass, label: "iodinated contrast",
            source: "RCR \"Guidance on the use of iodinated contrast media\" and metformin SmPC; BNF metformin monograph. Gadolinium (MRI) agents are not iodinated and not listed.",
            members: [
                "iodinated contrast|iv contrast|ct contrast",
                "iohexol|omnipaque",
                "iopamidol|isovue|niopam",
                "iodixanol|visipaque",
                "ioversol|optiray",
                "iopromide|ultravist",
                "iomeprol|iomeron",
            ]),

        "insulin": DrugTermDef(
            kind: .drugClass, label: "insulin",
            source: "\(bnf) — insulins (analogue and human).",
            members: [
                "insulin glargine|lantus|toujeo|abasaglar|basaglar|semglee",
                "insulin detemir|levemir",
                "insulin degludec|tresiba",
                "insulin aspart|novorapid|novolog|fiasp",
                "insulin lispro|humalog|admelog|lyumjev",
                "insulin glulisine|apidra",
                "human insulin|actrapid|humulin|insulatard|novolin|mixtard",
                "biphasic insulin aspart|novomix",
            ]),

        "heparin": DrugTermDef(
            kind: .drugClass, label: "heparin / LMWH",
            source: "\(bnf) — heparins: unfractionated and low-molecular-weight (NSAIDs increase bleeding risk).",
            members: heparinNames),

        "anticoagulant": DrugTermDef(
            kind: .drugClass, label: "anticoagulant",
            source: "\(bnf) — coumarins/phenindione, direct oral anticoagulants (DOACs), heparins, fondaparinux, parenteral direct thrombin inhibitors.",
            members: anticoagulantMembers),

        "antiplatelet": DrugTermDef(
            kind: .drugClass, label: "antiplatelet",
            source: "\(bnf) — antiplatelet drugs.",
            members: [
                aspirinNames,
                "clopidogrel|plavix",
                "prasugrel|effient",
                "ticagrelor|brilinta|brilique",
                "dipyridamole|persantin|asasantin|aggrenox",
                "cilostazol|pletal",
                "ticlopidine",
            ]),

        "qt prolonging": DrugTermDef(
            kind: .drugClass, label: "QT-prolonging drug",
            source: "CredibleMeds (AZCERT) \"Known Risk of TdP\" list, cross-checked with BNF. Intra-operative anaesthetic agents on that list (propofol, sevoflurane) are deliberately not included: they are given under continuous ECG monitoring by the anaesthetist and would fire on every theatre case.",
            members: [
                amiodaroneNames,
                "dronedarone|multaq",
                sotalolNames,
                "flecainide|tambocor",
                "disopyramide|rythmodan",
                "quinidine",
                "dofetilide|tikosyn",
                "haloperidol|haldol|serenace",
                "droperidol|xomolix",
                "chlorpromazine|largactil|thorazine",
                "pimozide|orap",
                "thioridazine",
                "sulpiride|dolmatil",
                citalopramNames,
                escitalopramNames,
                "ondansetron|zofran",
                "domperidone|motilium",
                "methadone|physeptone",
                erythromycinNames,
                clarithromycinNames,
                azithromycinNames,
                "levofloxacin|levaquin|tavanic",
                "moxifloxacin|avelox",
                ciprofloxacinNames,
                fluconazoleNames,
                "hydroxychloroquine|plaquenil",
                "chloroquine|avloclor",
                "donepezil|aricept",
                "pentamidine",
            ]),

        "macrolide": DrugTermDef(
            kind: .drugClass, label: "macrolide",
            source: "\(bnf) — macrolides (increase the anticoagulant effect of warfarin).",
            members: [
                erythromycinNames,
                clarithromycinNames,
                azithromycinNames,
                "roxithromycin",
            ]),

        "azole antifungal": DrugTermDef(
            kind: .drugClass, label: "azole antifungal",
            source: "\(bnf) — triazole and imidazole antifungals (CYP2C9/3A4 inhibition). MHRA Drug Safety Update (June 2016): miconazole oral gel + warfarin — serious bleeding.",
            members: [
                fluconazoleNames,
                "itraconazole|sporanox",
                "ketoconazole|nizoral",
                "voriconazole|vfend",
                "posaconazole|noxafil",
                "isavuconazole|cresemba",
                "miconazole|daktarin",
            ]),

        "gabapentinoid": DrugTermDef(
            kind: .drugClass, label: "gabapentinoid",
            source: "\(bnf); MHRA Drug Safety Update (Oct 2017 gabapentin, Feb 2021 pregabalin): respiratory depression with opioids.",
            members: [
                "gabapentin|neurontin",
                "pregabalin|lyrica",
            ]),

        // ═════════════════════════════ SPECIFIC DRUGS ═════════════════════════════
        // members = the drug's own synonyms and brands (and, where the legacy substring already
        // matched a close relative, that relative — e.g. "omeprazole" ⊂ "esomeprazole").

        "warfarin": DrugTermDef(
            kind: .drug, label: "warfarin",
            source: bnf,
            members: [warfarinNames]),

        "aspirin": DrugTermDef(
            kind: .drug, label: "aspirin",
            source: bnf,
            members: [aspirinNames]),

        "ibuprofen": DrugTermDef(
            kind: .drug, label: "ibuprofen",
            source: bnf,
            members: ["ibuprofen|advil|motrin|nurofen|brufen"]),

        "metronidazole": DrugTermDef(
            kind: .drug, label: "metronidazole",
            source: bnf,
            members: ["metronidazole|flagyl|metrogyl"]),

        "ciprofloxacin": DrugTermDef(
            kind: .drug, label: "ciprofloxacin",
            source: bnf,
            members: [ciprofloxacinNames]),

        "fluconazole": DrugTermDef(
            kind: .drug, label: "fluconazole",
            source: bnf,
            members: [fluconazoleNames]),

        "amiodarone": DrugTermDef(
            kind: .drug, label: "amiodarone",
            source: bnf,
            members: [amiodaroneNames]),

        "rivaroxaban": DrugTermDef(
            kind: .drug, label: "rivaroxaban",
            source: bnf,
            members: ["rivaroxaban|xarelto"]),

        "apixaban": DrugTermDef(
            kind: .drug, label: "apixaban",
            source: bnf,
            members: ["apixaban|eliquis"]),

        "clopidogrel": DrugTermDef(
            kind: .drug, label: "clopidogrel",
            source: bnf,
            members: ["clopidogrel|plavix"]),

        "omeprazole": DrugTermDef(
            kind: .drug, label: "omeprazole / esomeprazole",
            source: "\(bnf); MHRA Drug Safety Update (April 2010): avoid omeprazole and esomeprazole with clopidogrel.",
            members: [
                "omeprazole|losec|prilosec",
                "esomeprazole|nexium",
            ]),

        "alcohol": DrugTermDef(
            kind: .drug, label: "alcohol",
            source: bnf,
            members: ["alcohol|ethanol"]),

        "theophylline": DrugTermDef(
            kind: .drug, label: "theophylline / aminophylline",
            source: "\(bnf) — aminophylline is theophylline ethylenediamine and shares its interactions.",
            members: [
                "theophylline|uniphyllin|nuelin|theo-dur",
                "aminophylline|phyllocontin",
            ]),

        "gentamicin": DrugTermDef(
            kind: .drug, label: "gentamicin",
            source: bnf,
            members: ["gentamicin|cidomycin|genticin|garamycin"]),

        "furosemide": DrugTermDef(
            kind: .drug, label: "furosemide",
            source: bnf,
            members: ["furosemide|frusemide|lasix"]),

        "clindamycin": DrugTermDef(
            kind: .drug, label: "clindamycin",
            source: bnf,
            members: ["clindamycin|dalacin|cleocin"]),

        "metformin": DrugTermDef(
            kind: .drug, label: "metformin",
            source: "\(bnf); combination-product SmPCs.",
            members: ["metformin|glucophage|janumet|jentadueto|synjardy|xigduo|eucreas|vokanamet|invokamet|kombiglyze|komboglyze"]),

        "digoxin": DrugTermDef(
            kind: .drug, label: "digoxin",
            source: bnf,
            members: ["digoxin|lanoxin"]),

        "lisinopril": DrugTermDef(
            kind: .drug, label: "lisinopril",
            source: bnf,
            members: ["lisinopril|zestril|prinivil|zestoretic|carace"]),

        "amlodipine": DrugTermDef(
            kind: .drug, label: "amlodipine",
            source: bnf,
            members: ["amlodipine|norvasc|istin|exforge|caduet"]),

        "simvastatin": DrugTermDef(
            kind: .drug, label: "simvastatin",
            source: bnf,
            members: ["simvastatin|zocor|inegy|vytorin"]),

        "tramadol": DrugTermDef(
            kind: .drug, label: "tramadol",
            source: bnf,
            members: ["tramadol|ultram|zydol|zamadol|tramacet|ultracet"]),

        "sertraline": DrugTermDef(
            kind: .drug, label: "sertraline",
            source: bnf,
            members: ["sertraline|zoloft|lustral"]),

        "fluoxetine": DrugTermDef(
            kind: .drug, label: "fluoxetine",
            source: bnf,
            members: ["fluoxetine|prozac|sarafem"]),

        "morphine": DrugTermDef(
            kind: .drug, label: "morphine",
            source: bnf,
            members: ["morphine|mst continus|ms contin|oramorph|sevredol|zomorph"]),

        "midazolam": DrugTermDef(
            kind: .drug, label: "midazolam",
            source: bnf,
            members: ["midazolam|hypnovel|versed|buccolam|epistatus"]),

        "paracetamol": DrugTermDef(
            kind: .drug, label: "paracetamol",
            source: "\(bnf); combination-product SmPCs.",
            members: ["paracetamol|acetaminophen|panadol|tylenol|calpol|co-codamol|co-dydramol|tramacet|ultracet|percocet|solpadeine"]),

        "lithium": DrugTermDef(
            kind: .drug, label: "lithium",
            source: bnf,
            members: ["lithium|priadel|camcolit|liskonum"]),

        "pethidine": DrugTermDef(
            kind: .drug, label: "pethidine",
            source: bnf,
            members: ["pethidine|meperidine|demerol"]),

        "methotrexate": DrugTermDef(
            kind: .drug, label: "methotrexate",
            source: bnf,
            members: ["methotrexate|maxtrex|metoject|trexall|otrexup"]),

        "clarithromycin": DrugTermDef(
            kind: .drug, label: "clarithromycin",
            source: bnf,
            members: [clarithromycinNames]),

        "erythromycin": DrugTermDef(
            kind: .drug, label: "erythromycin",
            source: bnf,
            members: [erythromycinNames]),

        // ── iOS-only specific-drug terms (named by the iOS rule list, not by the web list) ──

        "diclofenac": DrugTermDef(
            kind: .drug, label: "diclofenac",
            source: bnf,
            members: ["diclofenac|voltaren|voltarol|cataflam|arthrotec|dyloject"]),

        "ketorolac": DrugTermDef(
            kind: .drug, label: "ketorolac",
            source: bnf,
            members: ["ketorolac|toradol"]),

        "enoxaparin": DrugTermDef(
            kind: .drug, label: "enoxaparin",
            source: bnf,
            members: ["enoxaparin|clexane|lovenox|inhixa"]),

        "venlafaxine": DrugTermDef(
            kind: .drug, label: "venlafaxine",
            source: bnf,
            members: ["venlafaxine|effexor|efexor"]),

        "fentanyl": DrugTermDef(
            kind: .drug, label: "fentanyl",
            source: bnf,
            members: ["fentanyl|durogesic|actiq|abstral|sublimaze"]),

        "vancomycin": DrugTermDef(
            kind: .drug, label: "vancomycin",
            source: bnf,
            members: ["vancomycin|vancocin"]),

        "co-amoxiclav": DrugTermDef(
            kind: .drug, label: "co-amoxiclav",
            source: bnf,
            members: ["co-amoxiclav|augmentin|amoxicillin-clavulanate"]),

        "lansoprazole": DrugTermDef(
            kind: .drug, label: "lansoprazole",
            source: bnf,
            members: ["lansoprazole|zoton|prevacid"]),

        "ondansetron": DrugTermDef(
            kind: .drug, label: "ondansetron",
            source: bnf,
            members: ["ondansetron|zofran"]),
    ]
}
