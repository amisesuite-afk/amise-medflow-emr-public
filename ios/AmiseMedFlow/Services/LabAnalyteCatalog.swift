// LabAnalyteCatalog.swift
// The analytes the lab-report importer recognises, the names they are saved under, and the units
// the rest of the app expects. Pure and deterministic (no network, no AI).
//
// Saved names are chosen for the two readers of Patient.investigations:
//   - `Patient.latestLab(named:)` (score auto-populator, bowel prep): a resulted entry whose
//     name contains any keyword as whole words (`LabNameMatch`), first number of `result`;
//   - `LabPanel.parse(from:)` (critical values, risk engines, procedure forms): an if/else chain of
//     the same whole-word tests on the name.
// Both used to match substrings, so a careless name was read as another analyte ("Fasting glucose"
// contains "ast", "HbA1c" contains "hb", "Lactate dehydrogenase" contains "lactate"). The saved
// names below still avoid those spellings. Every saved name here reads as its own analyte only;
// LabReportParserTests.testCanonicalNamesAreReadOnlyAsTheirOwnAnalyte enforces it against the
// real LabPanel and the keyword lists copied in `LabScoreKeywords`, and LabKeywordMatchingTests
// covers hand-typed names.
//
// Units: values the scores read are stored in the unit the app assumes (µmol/L creatinine,
// mmol/L urea and glucose, g/dL Hb, g/L albumin, ...). A printed unit with an exact factor is
// converted and the original kept in the result text; an ambiguous or unexpected unit is never
// converted: the row is flagged and left unticked for the clinician.

import Foundation

// MARK: - Unit spellings

enum LabUnits {
    /// Comparison form of a printed unit: lowercase, no spaces, µ/μ → u, superscripts → digits,
    /// exponent markers dropped ("x10^9/L" → "109/l"), common synonyms folded.
    static func normalise(_ raw: String) -> String {
        var s = raw.lowercased()
        let replacements: [(String, String)] = [
            ("µ", "u"), ("μ", "u"), ("×", "x"), ("⁹", "9"), ("³", "3"), ("¹", "1"), ("²", "2"),
            ("⁶", "6"), ("\u{00A0}", ""), (" ", ""), ("\t", ""), ("^", ""), ("*", ""),
            ("10e", "10"), ("cumm", "ul"), ("cmm", "ul"), ("mm3", "ul"),
        ]
        for (from, to) in replacements { s = s.replacingOccurrences(of: from, with: to) }
        if s.hasPrefix("x") { s.removeFirst() }
        if s.hasPrefix("(") && s.hasSuffix(")") { s = String(s.dropFirst().dropLast()) }
        return synonyms[s] ?? s
    }

    private static let synonyms: [String: String] = [
        "gm/dl": "g/dl", "g%": "g/dl", "gm%": "g/dl", "mg%": "mg/dl",
        "mcg/l": "ug/l", "mcg/dl": "ug/dl", "mcmol/l": "umol/l",
        "iu/l": "u/l", "units/l": "u/l",
        "sec": "s", "secs": "s", "seconds": "s", "second": "s",
        "mm/hr": "mm/h", "mm/1sthr": "mm/h", "mm/1sth": "mm/h", "mm/hour": "mm/h",
        "uiu/ml": "miu/l", "uu/ml": "miu/l", "mu/l": "miu/l",
        "103/ul": "109/l", "k/ul": "109/l", "thou/ul": "109/l", "k/mm3": "109/l",
        "106/ul": "1012/l", "m/ul": "1012/l", "mill/ul": "1012/l", "mil/ul": "1012/l",
        "ng/ml": "ug/l", "pg/ml": "ng/l", "u/ml": "ku/l",
        "ml/min/1.73": "ml/min/1.73m2", "ml/min/1.73m": "ml/min/1.73m2",
        "cells/ul": "/ul",
        "ratio": "",
    ]

    /// Every unit spelling (normalised) the parser treats as a unit when it stands alone.
    static let known: Set<String> = [
        "109/l", "1012/l", "/ul", "g/dl", "g/l", "mg/dl", "mg/l", "ug/l", "ng/l", "ug/dl",
        "mmol/l", "umol/l", "nmol/l", "pmol/l", "meq/l", "mmol/mol", "u/l", "ku/l", "miu/l",
        "iu/ml", "%", "fl", "pg", "s", "mm/h", "ml/min/1.73m2", "ml/min", "l/l",
        "ug/lfeu", "mg/lfeu", "ug/mlfeu", "ng/mlfeu", "mg/mmol", "mosm/kg", "g/24h", "ug/ml",
        "/hpf", "/lpf", "cells/hpf",
    ]
}

// MARK: - Analyte

struct LabAnalyte: Equatable {
    /// Stable id, e.g. "haemoglobin".
    let key: String
    /// The InvestigationEntry name the value is saved under.
    let name: String
    /// Printed labels (lowercase) matched at the start of a result line; longest wins.
    let aliases: [String]
    /// Unit the app's consumers expect, as displayed; nil = stored as reported.
    let appUnit: String?
    /// Normalised spellings of `appUnit` (factor 1).
    let unitAliases: [String]
    /// Normalised unit → factor to `appUnit`.
    let conversions: [String: Double]
    /// Normalised unit → why it is never converted.
    let ambiguousUnits: [String: String]
    /// A missing unit leaves the row unticked (the value could be in either unit).
    let unitRequired: Bool
    /// Physiologically possible range in `appUnit`; outside it the row is unticked.
    let plausible: ClosedRange<Double>?
    /// Where a score's own unit guess misreads a correct value (see PatientScoreAutoPopulator).
    let misread: LabMisreadRule?
    /// Decimals for a converted value.
    let decimals: Int
    /// Words after the label that make it another analyte ("Hb A1c" → hba1c).
    let qualifierRemaps: [(word: String, key: String)]

    static func == (a: LabAnalyte, b: LabAnalyte) -> Bool { a.key == b.key }

    var isUnitHandled: Bool { appUnit != nil }
}

/// A band of correct values that a score's magnitude-based unit guess reads wrongly.
struct LabMisreadRule: Equatable {
    let below: Double?
    let above: Double?
    let message: String

    func applies(to value: Double) -> Bool {
        if let below, value < below { return true }
        if let above, value > above { return true }
        return false
    }
}

// MARK: - Catalogue

enum LabAnalyteCatalog {

    static let all: [LabAnalyte] = scoreAnalytes + otherAnalytes

    static func analyte(forKey key: String?) -> LabAnalyte? {
        guard let key else { return nil }
        return byKey[key]
    }

    private static let byKey: [String: LabAnalyte] =
        Dictionary(all.map { ($0.key, $0) }, uniquingKeysWith: { first, _ in first })

    /// (alias, key), longest alias first, so "hb a1c" wins over "hb" and "direct bilirubin"
    /// over "bilirubin".
    static let aliasIndex: [(alias: String, key: String)] = all
        .flatMap { a in a.aliases.map { (alias: $0, key: a.key) } }
        .sorted { $0.alias.count > $1.alias.count }

    // Unit families
    private static let countPer9 = ["109/l"]
    private static let perMicrolitre: [String: Double] = ["/ul": 0.001]
    private static let mmol = ["mmol/l", "meq/l"]
    private static let enzyme = ["u/l"]

    private static func a(_ key: String, _ name: String, _ aliases: [String],
                          unit: String? = nil, unitAliases: [String] = [],
                          conversions: [String: Double] = [:],
                          ambiguous: [String: String] = [:],
                          unitRequired: Bool = false,
                          plausible: ClosedRange<Double>? = nil,
                          misread: LabMisreadRule? = nil,
                          decimals: Int = 1,
                          remaps: [(word: String, key: String)] = []) -> LabAnalyte {
        LabAnalyte(key: key, name: name, aliases: aliases, appUnit: unit,
                   unitAliases: unitAliases, conversions: conversions, ambiguousUnits: ambiguous,
                   unitRequired: unitRequired, plausible: plausible, misread: misread,
                   decimals: decimals, qualifierRemaps: remaps)
    }

    /// Analytes a score, LabPanel or bowel prep reads: unit-handled.
    static let scoreAnalytes: [LabAnalyte] = [
        a("wbc", "WBC",
          ["wbc", "wcc", "white blood cell count", "white blood cells", "white blood cell",
           "white cell count", "white cells", "total white cell count", "total leucocyte count",
           "total leukocyte count", "leucocyte count", "leukocyte count", "leucocytes",
           "leukocytes", "tlc"],
          unit: "×10⁹/L", unitAliases: countPer9, conversions: perMicrolitre,
          ambiguous: ["g/l": "“G/L” may mean giga/L or grams/L"],
          unitRequired: true, plausible: 0.05...600,
          misread: LabMisreadRule(below: nil, above: 100,
                                  message: "Scores treat a WBC above 100 as cells/µL and divide it by 1000."),
          decimals: 1),
        a("haemoglobin", "Haemoglobin", ["haemoglobin", "hemoglobin", "hgb", "hb"],
          unit: "g/dL", unitAliases: ["g/dl"], conversions: ["g/l": 0.1],
          ambiguous: ["mmol/l": "Hb in mmol/L is not converted here"],
          unitRequired: true, plausible: 1...25,
          misread: LabMisreadRule(below: nil, above: 20,
                                  message: "Scores treat an Hb above 20 as g/L and divide it by 10."),
          decimals: 1,
          remaps: [("a1c", "hba1c"), ("glyc", "hba1c")]),
        a("platelets", "Platelets", ["platelets", "platelet count", "platelet", "plt", "plts"],
          unit: "×10⁹/L", unitAliases: countPer9, conversions: perMicrolitre,
          ambiguous: ["g/l": "“G/L” may mean giga/L or grams/L"],
          unitRequired: true, plausible: 1...3000, decimals: 0),
        a("crp", "CRP",
          ["crp", "c-reactive protein", "c reactive protein", "hs-crp", "hscrp", "hs crp",
           "high sensitivity crp", "c-reactive protein (crp)"],
          unit: "mg/L", unitAliases: ["mg/l"], conversions: ["mg/dl": 10],
          unitRequired: true, plausible: 0...800, decimals: 0),
        a("sodium", "Sodium", ["sodium", "na", "na+"],
          unit: "mmol/L", unitAliases: mmol, plausible: 90...200, decimals: 0),
        a("potassium", "Potassium", ["potassium", "k", "k+"],
          unit: "mmol/L", unitAliases: mmol, plausible: 1...12, decimals: 1),
        a("urea", "Urea", ["urea", "blood urea", "serum urea"],
          unit: "mmol/L", unitAliases: ["mmol/l"],
          ambiguous: ["mg/dl": "“Urea” in mg/dL may be urea or BUN, which convert differently"],
          unitRequired: true, plausible: 0.3...150,
          misread: LabMisreadRule(below: nil, above: 50,
                                  message: "Scores treat a urea above 50 as BUN mg/dL and divide it by 2.8."),
          decimals: 1),
        a("bun", "Urea", ["bun", "blood urea nitrogen", "urea nitrogen", "urea nitrogen (bun)"],
          unit: "mmol/L", unitAliases: ["mmol/l"], conversions: ["mg/dl": 0.357],
          unitRequired: true, plausible: 0.3...150,
          misread: LabMisreadRule(below: nil, above: 50,
                                  message: "Scores treat a urea above 50 as BUN mg/dL and divide it by 2.8."),
          decimals: 1),
        a("creatinine", "Creatinine", ["creatinine", "creat", "serum creatinine", "creatinine, serum"],
          unit: "µmol/L", unitAliases: ["umol/l"], conversions: ["mg/dl": 88.4],
          unitRequired: true, plausible: 5...3000,
          misread: LabMisreadRule(below: 15, above: nil,
                                  message: "Scores treat a creatinine below 15 as mg/dL and multiply it by 88."),
          decimals: 0),
        a("egfr", "eGFR",
          ["egfr", "e-gfr", "estimated gfr", "egfr (ckd-epi)", "egfr ckd-epi", "gfr (estimated)",
           "estimated glomerular filtration rate"],
          unit: "mL/min/1.73m²", unitAliases: ["ml/min/1.73m2", "ml/min"],
          plausible: 0...200, decimals: 0),
        a("glucose", "Glucose",
          ["glucose", "blood glucose", "plasma glucose", "serum glucose", "fasting glucose",
           "fasting blood glucose", "fasting plasma glucose", "random glucose",
           "random blood glucose", "random plasma glucose", "glucose (fasting)",
           "glucose (random)", "glucose, fasting", "glucose, random", "blood sugar",
           "fasting blood sugar", "random blood sugar", "fbs", "fbg", "fpg", "rbs", "rbg"],
          unit: "mmol/L", unitAliases: ["mmol/l"], conversions: ["mg/dl": 0.0555],
          unitRequired: true, plausible: 0.5...120,
          misread: LabMisreadRule(below: nil, above: 30,
                                  message: "Scores treat a glucose above 30 as mg/dL and divide it by 18 — check glucose in any score by hand."),
          decimals: 1),
        a("hba1c", "A1c (glycated)",
          ["hba1c", "hb a1c", "hb-a1c", "hba1c (ngsp)", "haemoglobin a1c", "hemoglobin a1c",
           "glycated haemoglobin", "glycated hemoglobin", "glycosylated haemoglobin",
           "glycosylated hemoglobin", "a1c"],
          unit: "%", unitAliases: ["%"],
          ambiguous: ["mmol/mol": "IFCC mmol/mol is not converted to %"],
          unitRequired: true, plausible: 3...25, decimals: 1),
        a("bilirubin", "Bilirubin",
          ["total bilirubin", "bilirubin total", "bilirubin, total", "bilirubin (total)",
           "t. bilirubin", "t bilirubin", "t.bilirubin", "serum bilirubin", "tbil", "t.bil",
           "bilirubin"],
          unit: "µmol/L", unitAliases: ["umol/l"], conversions: ["mg/dl": 17.1],
          unitRequired: true, plausible: 0...1000,
          misread: LabMisreadRule(below: 5, above: nil,
                                  message: "Scores treat a bilirubin below 5 as mg/dL and multiply it by 17."),
          decimals: 0,
          remaps: [("unconjugated", "bilirubinIndirect"), ("indirect", "bilirubinIndirect"),
                   ("conjugated", "bilirubinDirect"), ("direct", "bilirubinDirect")]),
        a("alt", "ALT",
          ["alt", "alt (sgpt)", "sgpt", "sgpt (alt)", "alat", "alanine aminotransferase",
           "alanine transaminase", "alanine aminotransferase (alt)"],
          unit: "U/L", unitAliases: enzyme, plausible: 0...30000, decimals: 0),
        a("ast", "AST",
          ["ast", "ast (sgot)", "sgot", "sgot (ast)", "asat", "aspartate aminotransferase",
           "aspartate transaminase", "aspartate aminotransferase (ast)"],
          unit: "U/L", unitAliases: enzyme, plausible: 0...30000, decimals: 0),
        a("alp", "ALP",
          ["alp", "alkaline phosphatase", "alk phos", "alk. phos", "alk phosphatase",
           "alkaline phosphatase (alp)"],
          unit: "U/L", unitAliases: enzyme, plausible: 0...10000, decimals: 0),
        a("albumin", "Albumin", ["albumin", "serum albumin", "alb"],
          unit: "g/L", unitAliases: ["g/l"], conversions: ["g/dl": 10],
          unitRequired: true, plausible: 5...70,
          misread: LabMisreadRule(below: 10, above: nil,
                                  message: "Scores treat an albumin below 10 as g/dL and multiply it by 10."),
          decimals: 0),
        a("calcium", "Calcium", ["calcium", "total calcium", "calcium total", "calcium, total",
                                 "serum calcium", "ca"],
          unit: "mmol/L", unitAliases: ["mmol/l"], conversions: ["mg/dl": 0.2495, "meq/l": 0.5],
          unitRequired: true, plausible: 0.5...5.5,
          misread: LabMisreadRule(below: nil, above: 4.99,
                                  message: "Scores treat a calcium of 5 or more as mg/dL and divide it by 4."),
          decimals: 2,
          remaps: [("ionised", "calciumIonised"), ("ionized", "calciumIonised"),
                   ("adjusted", "calciumAdjusted"), ("corrected", "calciumAdjusted"),
                   ("19-9", "ca199"), ("15-3", "ca153")]),
        a("magnesium", "Magnesium", ["magnesium", "serum magnesium", "mg", "mg++", "mg2+"],
          unit: "mmol/L", unitAliases: ["mmol/l"], conversions: ["mg/dl": 0.4114, "meq/l": 0.5],
          unitRequired: true, plausible: 0.1...5, decimals: 2),
        a("amylase", "Amylase", ["amylase", "serum amylase", "amylase, serum", "amylase (serum)"],
          unit: "U/L", unitAliases: enzyme, plausible: 0...20000, decimals: 0),
        a("lipase", "Lipase", ["lipase", "serum lipase"],
          unit: "U/L", unitAliases: enzyme, plausible: 0...50000, decimals: 0),
        a("ldh", "LDH", ["ldh", "ld", "lactate dehydrogenase", "lactic dehydrogenase",
                         "lactate dehydrogenase (ldh)"],
          unit: "U/L", unitAliases: enzyme, plausible: 0...30000, decimals: 0),
        a("lactate", "Lactate", ["lactate", "lactic acid", "blood lactate", "venous lactate",
                                 "arterial lactate", "plasma lactate"],
          unit: "mmol/L", unitAliases: ["mmol/l"], conversions: ["mg/dl": 0.111],
          unitRequired: true, plausible: 0...30, decimals: 1),
        a("troponinI", "Troponin I",
          ["troponin i", "trop i", "tni", "ctni", "hs troponin i", "hs-troponin i",
           "high sensitivity troponin i", "hs-tni", "hstni", "cardiac troponin i"],
          unit: "ng/L", unitAliases: ["ng/l"], conversions: ["ug/l": 1000],
          unitRequired: true, plausible: 0...200000, decimals: 0),
        a("troponinT", "Troponin T",
          ["troponin t", "trop t", "tnt", "ctnt", "hs troponin t", "hs-troponin t",
           "high sensitivity troponin t", "hs-tnt", "hstnt", "cardiac troponin t"],
          unit: "ng/L", unitAliases: ["ng/l"], conversions: ["ug/l": 1000],
          unitRequired: true, plausible: 0...200000, decimals: 0),
        a("troponin", "Troponin", ["troponin", "hs troponin", "high sensitivity troponin"],
          unit: "ng/L", unitAliases: ["ng/l"], conversions: ["ug/l": 1000],
          unitRequired: true, plausible: 0...200000, decimals: 0),
        a("inr", "INR", ["inr", "pt-inr", "pt inr", "pt/inr", "inr ratio",
                         "international normalised ratio", "international normalized ratio"],
          unit: "", unitAliases: [""], plausible: 0.5...20, decimals: 1),
        a("dDimer", "D-dimer", ["d-dimer", "d dimer", "ddimer", "d-dimer (feu)"],
          unit: "µg/L FEU", unitAliases: ["ug/lfeu", "ng/mlfeu"],
          conversions: ["mg/lfeu": 1000, "ug/mlfeu": 1000],
          ambiguous: ["ug/l": "D-dimer without FEU/DDU is not converted",
                      "mg/l": "D-dimer without FEU/DDU is not converted",
                      "ug/ml": "D-dimer without FEU/DDU is not converted"],
          unitRequired: true, plausible: 0...200000, decimals: 0),
        a("esr", "ESR", ["esr", "erythrocyte sedimentation rate", "sed rate"],
          unit: "mm/h", unitAliases: ["mm/h"], plausible: 0...200, decimals: 0),
    ]

    /// Stored as reported: nothing in the app reads these as numbers.
    static let otherAnalytes: [LabAnalyte] = [
        a("neutrophils", "Neutrophils", ["neutrophils", "neutrophil count", "neutrophil",
                                         "absolute neutrophil count", "anc", "neut", "polymorphs",
                                         "segmented neutrophils", "granulocytes"]),
        a("lymphocytes", "Lymphocytes", ["lymphocytes", "lymphocyte count", "lymphocyte", "lymph", "lym"]),
        a("monocytes", "Monocytes", ["monocytes", "monocyte count", "monocyte", "mono"]),
        a("eosinophils", "Eosinophils", ["eosinophils", "eosinophil count", "eosinophil", "eos"]),
        a("basophils", "Basophils", ["basophils", "basophil count", "basophil", "baso"]),
        a("haematocrit", "Haematocrit", ["haematocrit", "hematocrit", "hct", "pcv", "packed cell volume"]),
        a("rbc", "Red cell count", ["rbc", "red blood cell count", "red blood cells", "red cell count",
                                    "erythrocytes", "erythrocyte count"]),
        a("mcv", "MCV", ["mcv", "mean cell volume", "mean corpuscular volume"]),
        a("mch", "MCH", ["mch", "mean cell haemoglobin", "mean cell hemoglobin",
                         "mean corpuscular haemoglobin", "mean corpuscular hemoglobin"]),
        a("mchc", "MCHC", ["mchc", "mean cell haemoglobin concentration",
                           "mean cell hemoglobin concentration",
                           "mean corpuscular haemoglobin concentration",
                           "mean corpuscular hemoglobin concentration"]),
        a("rdw", "RDW", ["rdw", "rdw-cv", "rdw cv", "red cell distribution width"]),
        a("chloride", "Chloride", ["chloride", "cl", "cl-"]),
        a("bicarbonate", "Bicarbonate", ["bicarbonate", "hco3", "hco3-", "total co2", "tco2", "co2"]),
        a("ggt", "GGT", ["ggt", "gamma gt", "gamma-gt", "gamma glutamyl transferase",
                         "gamma-glutamyl transferase", "gamma glutamyltransferase", "ggtp", "γgt"]),
        a("bilirubinDirect", "Direct bili (conjugated)",
          ["direct bilirubin", "bilirubin direct", "bilirubin, direct", "bilirubin (direct)",
           "conjugated bilirubin", "bilirubin conjugated", "d. bilirubin", "d bilirubin", "dbil"]),
        a("bilirubinIndirect", "Indirect bili (unconjugated)",
          ["indirect bilirubin", "bilirubin indirect", "bilirubin, indirect", "bilirubin (indirect)",
           "unconjugated bilirubin", "bilirubin unconjugated", "ibil"]),
        a("totalProtein", "Total protein", ["total protein", "protein total", "protein, total",
                                            "total proteins", "serum protein"]),
        a("globulin", "Globulin", ["globulin", "globulins"]),
        a("calciumAdjusted", "Corrected Ca",
          ["adjusted calcium", "corrected calcium", "calcium (adjusted)", "calcium (corrected)",
           "calcium adjusted", "calcium corrected", "calcium, adjusted", "calcium, corrected",
           "adj calcium", "adj. calcium", "corr calcium", "corr. calcium"]),
        a("calciumIonised", "Ionised Ca",
          ["ionised calcium", "ionized calcium", "calcium ionised", "calcium ionized",
           "calcium, ionised", "calcium, ionized", "ionised ca", "ionized ca", "ica", "ca++", "ca2+"]),
        a("phosphate", "Phosphate", ["phosphate", "phosphorus", "inorganic phosphate",
                                     "phosphate (inorganic)", "phos", "po4"]),
        a("uricAcid", "Uric acid", ["uric acid", "urate", "serum uric acid"]),
        a("ck", "Creatine kinase", ["creatine kinase", "creatine phosphokinase", "ck", "cpk", "ck total"]),
        a("procalcitonin", "Procalcitonin", ["procalcitonin", "pct"]),
        a("pt", "Prothrombin time", ["prothrombin time", "prothrombin time (pt)", "pro time",
                                     "protime", "pt"],
          remaps: [("inr", "inr")]),
        a("aptt", "APTT", ["aptt", "ptt", "activated partial thromboplastin time",
                           "partial thromboplastin time", "a.p.t.t."]),
        a("fibrinogen", "Fibrinogen", ["fibrinogen"]),
        a("tsh", "TSH", ["tsh", "thyroid stimulating hormone", "thyroid-stimulating hormone", "thyrotropin"]),
        a("ft4", "Free T4", ["free t4", "ft4", "free thyroxine", "t4 free", "t4, free"]),
        a("ft3", "Free T3", ["free t3", "ft3", "free triiodothyronine", "t3 free", "t3, free"]),
        a("ferritin", "Ferritin", ["ferritin", "serum ferritin"]),
        a("iron", "Iron", ["iron", "serum iron", "fe"]),
        a("tibc", "TIBC", ["tibc", "total iron binding capacity"]),
        a("b12", "Vitamin B12", ["vitamin b12", "vit b12", "b12", "cobalamin"]),
        a("folate", "Folate", ["folate", "serum folate", "folic acid", "red cell folate"]),
        a("cea", "CEA", ["cea", "carcinoembryonic antigen"]),
        a("ca199", "CA 19-9", ["ca 19-9", "ca19-9", "ca 19.9", "ca19.9", "ca 199", "ca199",
                               "carbohydrate antigen 19-9"]),
        a("ca125", "CA-125", ["ca 125", "ca-125", "ca125"]),
        a("ca153", "CA 15-3", ["ca 15-3", "ca15-3", "ca 15.3", "ca15.3"]),
        a("psa", "PSA", ["psa", "total psa", "psa total", "psa, total", "prostate specific antigen",
                         "prostate-specific antigen"]),
        a("freePsa", "Free PSA", ["free psa", "psa free", "psa, free", "fpsa"]),
        a("afp", "AFP", ["afp", "alpha fetoprotein", "alpha-fetoprotein", "a-fetoprotein"]),
        a("cholesterol", "Total cholesterol", ["total cholesterol", "cholesterol total",
                                               "cholesterol, total", "cholesterol", "t. cholesterol"]),
        a("hdl", "HDL cholesterol", ["hdl cholesterol", "hdl-cholesterol", "hdl-c", "hdl"]),
        a("ldl", "LDL cholesterol", ["ldl cholesterol", "ldl-cholesterol", "ldl-c",
                                     "ldl (calculated)", "ldl calculated", "ldl"]),
        a("triglycerides", "Triglycerides", ["triglycerides", "triglyceride", "trig", "tg"]),
    ]
}

// MARK: - What the rest of the app would read a name as

/// Keyword lists `Patient.latestLab(named:)` is called with (copied from the callers:
/// PatientScoreAutoPopulator+*.swift, PatientScoreAutoPopulator.creatinineUmolL,
/// BowelPrepProtocols+Patient). Used to warn when an unmapped name would be read as one of these,
/// and by the tests that keep the saved names safe. Update together with those callers.
enum LabScoreKeywords {
    static let groups: [(key: String, keywords: [String])] = [
        ("wbc", ["wbc", "white blood cell", "white cell count", "leucocyte", "leukocyte"]),
        ("urea", ["urea", "blood urea", "bun", "blood urea nitrogen"]),
        ("bilirubin", ["bilirubin"]),
        ("sodium", ["sodium"]),
        ("ldh", ["ldh", "lactate dehydrogenase"]),
        ("inr", ["inr", "pt-inr"]),
        ("haemoglobin", ["haemoglobin", "hemoglobin", "hgb", "hb"]),
        ("glucose", ["glucose", "blood glucose", "rbs", "fasting glucose"]),
        ("ast", ["ast", "aspartate aminotransferase", "aspartate transaminase"]),
        ("egfr", ["egfr"]),
        ("crp", ["crp", "c-reactive protein", "c reactive protein"]),
        ("creatinine", ["creatinine"]),
        ("calcium", ["calcium"]),
        ("alt", ["alt", "alanine aminotransferase"]),
        ("albumin", ["albumin"]),
        ("magnesium", ["magnesium"]),
    ]

    /// Score keyword groups whose keywords a saved name would match (the same whole-word
    /// matching as `Patient.latestLab(named:)`).
    static func groups(readingName name: String) -> [String] {
        let words = LabNameMatch.words(of: name)
        return groups.filter { g in LabNameMatch.matchesAny(words, g.keywords) }.map(\.key)
    }
}

enum LabPanelProbe {
    /// The LabPanel field a resulted entry with this name fills (via the real LabPanel.parse).
    static func field(readingName name: String) -> String? {
        let probe = InvestigationEntry(name: name, category: .blood, status: .resulted, result: "1")
        let p = LabPanel.parse(from: [probe])
        let fields: [(String, Bool)] = [
            ("wbc", p.wbc != nil), ("haemoglobin", p.haemoglobin != nil),
            ("platelets", p.platelets != nil), ("crp", p.crp != nil), ("esr", p.esr != nil),
            ("sodium", p.sodium != nil), ("potassium", p.potassium != nil),
            ("creatinine", p.creatinine != nil), ("urea", p.urea != nil),
            ("bilirubin", p.bilirubin != nil), ("alt", p.alt != nil), ("ast", p.ast != nil),
            ("alp", p.alp != nil), ("albumin", p.albumin != nil), ("calcium", p.calcium != nil),
            ("amylase", p.amylase != nil), ("lipase", p.lipase != nil),
            ("lactate", p.lactate != nil), ("dDimer", p.dDimer != nil),
            ("troponin", p.troponin != nil), ("inr", p.inr != nil),
            ("glucose", p.glucose != nil), ("hba1c", p.hba1c != nil),
        ]
        return fields.first { $0.1 }?.0
    }

    /// Human labels for everything that would read `name` as a number: score keyword groups and
    /// the LabPanel field. Empty when nothing would.
    static func readers(ofName name: String) -> [String] {
        var out = LabScoreKeywords.groups(readingName: name)
        if let f = field(readingName: name), !out.contains(f) { out.append(f) }
        return out.map { LabAnalyteCatalog.analyte(forKey: $0)?.name ?? $0 }
    }
}
