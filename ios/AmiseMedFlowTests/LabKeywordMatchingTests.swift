import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Hand-typed investigation names must be read as their own analyte only. `Patient.latestLab(named:)`
/// (scores, bowel prep, eGFR), `LabPanel.parse(from:)` (critical values, risk engines, procedure
/// forms) and the importer's copy of the score keywords (`LabScoreKeywords`) match whole words
/// (`LabNameMatch`); substring matching read "HbA1c" and "HBsAg" as Hb, "Fasting glucose" as AST,
/// "Lactate dehydrogenase" as lactate and "Urine sodium" as sodium. Synthetic values only.
@MainActor
final class LabKeywordMatchingTests: XCTestCase {

    private var container: ModelContainer!
    private var context: ModelContext!

    override func setUp() async throws {
        let schema = Schema([Patient.self, ClinicalNote.self, VitalsEntry.self, Prescription.self,
                             PatientDocument.self, OperativePlan.self, BillingLineItem.self,
                             Encounter.self, ScoreHistoryEntry.self])
        container = try ModelContainer(for: schema,
                                       configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        context = container.mainContext
    }

    // MARK: - Helpers

    /// A patient whose only investigation is one resulted blood test.
    private func patient(with name: String, result: String) -> Patient {
        let p = Patient(fullName: "Synthetic Patient", sex: .female)
        context.insert(p)
        p.investigations = [InvestigationEntry(name: name, category: .blood, status: .resulted,
                                               result: result, resultedAt: Date())]
        return p
    }

    /// The keyword list a score reader passes to `latestLab(named:)` (copied in LabScoreKeywords).
    private func keywords(_ key: String) -> [String] {
        LabScoreKeywords.groups.first { $0.key == key }?.keywords ?? []
    }

    private func panel(_ name: String, _ result: String = "5") -> LabPanel {
        LabPanel.parse(from: [InvestigationEntry(name: name, category: .blood, status: .resulted,
                                                 result: result, resultedAt: Date())])
    }

    // MARK: - Words

    func testNamesSplitIntoWordsAtSpacesAndPunctuation() {
        XCTAssertEqual(LabNameMatch.words(of: "PT/INR"), ["pt", "inr"])
        XCTAssertEqual(LabNameMatch.words(of: "CA 19-9"), ["ca", "19", "9"])
        XCTAssertEqual(LabNameMatch.words(of: "C-Reactive Protein (CRP)"), ["c", "reactive", "protein", "crp"])
        XCTAssertEqual(LabNameMatch.words(of: "HbA1c"), ["hba1c"])
        XCTAssertEqual(LabNameMatch.words(of: "Ca++"), ["ca++"])     // ionised, not "Ca"
        XCTAssertEqual(LabNameMatch.words(of: "  Hb (g/dL) "), ["hb", "g", "dl"])
        XCTAssertEqual(LabNameMatch.words(of: ""), [])
    }

    func testKeywordsMatchWholeWordsInOrder() {
        XCTAssertTrue(LabNameMatch.matches(name: "Pre-op Hb", keyword: "hb"))
        XCTAssertTrue(LabNameMatch.matches(name: "White cell count", keyword: "white cell"))
        XCTAssertFalse(LabNameMatch.matches(name: "Red cell count", keyword: "white cell"))
        XCTAssertFalse(LabNameMatch.matches(name: "Cell count, white", keyword: "white cell"))
        XCTAssertTrue(LabNameMatch.matches(name: "Platelets", keyword: "platelet"))   // plural
        XCTAssertFalse(LabNameMatch.matches(name: "Anti-HBs", keyword: "hb"))         // "hbs" is not a plural of "hb"
        XCTAssertTrue(LabNameMatch.matches(name: "PT-INR", keyword: "pt-inr"))
        XCTAssertTrue(LabNameMatch.matches(name: "Lactate dehydrogenase", keyword: "lactate dehydrogenase"))
        XCTAssertFalse(LabNameMatch.matches(name: "Lactate dehydrogenase", keyword: "lactate"))
        XCTAssertTrue(LabNameMatch.isExactly(LabNameMatch.words(of: "NA:"), "na"))
        XCTAssertFalse(LabNameMatch.isExactly(LabNameMatch.words(of: "CA 19-9"), "ca"))
        XCTAssertFalse(LabNameMatch.matches(name: "", keyword: "hb"))
        XCTAssertFalse(LabNameMatch.matches(name: "Hb", keyword: ""))
    }

    // MARK: - Collisions: never read as the other analyte

    func testHaemoglobinIsNotHbA1cHepatitisBOrRedCellIndices() {
        let hb = keywords("haemoglobin")
        for name in ["HbA1c", "Hb A1c", "Hb-A1c", "Haemoglobin A1c", "Hemoglobin A1c",
                     "Glycated haemoglobin", "Haemoglobin (glycated)", "HBsAg", "Anti-HBs",
                     "HBeAg", "HBV DNA", "Mean cell haemoglobin", "Mean corpuscular hemoglobin",
                     "Hb S", "Hb electrophoresis", "Urine haemoglobin"] {
            XCTAssertNil(patient(with: name, result: "8.4").latestLab(named: hb), name)
            XCTAssertNil(panel(name, "8.4").haemoglobin, name)
            XCTAssertEqual(LabScoreKeywords.groups(readingName: name).filter { $0 == "haemoglobin" }, [], name)
        }
        // A1c spellings feed the A1c field, not Hb.
        for name in ["HbA1c", "Hb A1c", "Haemoglobin A1c", "Glycated haemoglobin", "A1c (glycated)"] {
            XCTAssertEqual(panel(name, "8.4").hba1c?.value, 8.4, name)
        }
        // Low Hb from an A1c would have been a critical value.
        XCTAssertFalse(panel("Hb A1c", "7.2").hasCriticalValues)
    }

    func testCA199IsNotCalciumAndIonisedIsNotTotalCalcium() {
        for name in ["CA 19-9", "Ca 19.9", "CA19-9", "CA 15-3", "CA-125", "Ca++", "Ionised calcium",
                     "Calcium, ionized", "Urine calcium", "Coronary calcium score"] {
            XCTAssertNil(patient(with: name, result: "1.1").latestLab(named: keywords("calcium")), name)
            XCTAssertNil(panel(name, "1.1").calcium, name)
        }
        XCTAssertFalse(panel("CA 19-9", "88").hasCriticalValues)
    }

    func testPTHAndPTAreNotINR() {
        for name in ["PTH", "Parathyroid hormone (PTH)", "PT", "Prothrombin time", "APTT", "PTT"] {
            XCTAssertNil(patient(with: name, result: "16.2").latestLab(named: keywords("inr")), name)
            XCTAssertNil(panel(name, "16.2").inr, name)
        }
        // The importer keeps them apart too.
        XCTAssertNil(LabReportParser.matchAnalyte("PTH 45"))
        XCTAssertEqual(LabReportParser.matchAnalyte("PT 16.2")?.key, "pt")
        let rows = LabReportParser.parse(text: "PTH 45 pg/mL (15-65)\nPT (INR) 1.1", now: Date()).rows
        XCTAssertFalse(rows.contains { $0.analyteKey == "pt" })
        XCTAssertEqual(rows.last?.analyteKey, "inr")
    }

    func testLDHIsNotLactate() {
        for name in ["LDH", "Lactate dehydrogenase", "Lactic dehydrogenase", "Lactate dehydrogenase (LDH)"] {
            XCTAssertNil(panel(name, "420").lactate, name)
            XCTAssertFalse(panel(name, "420").hasCriticalValues, name)   // lactate ≥ 4 was critical
        }
        XCTAssertEqual(patient(with: "Lactate dehydrogenase", result: "420").latestLab(named: keywords("ldh")), 420)
        XCTAssertNil(patient(with: "Lactate", result: "2.9").latestLab(named: keywords("ldh")))
        XCTAssertEqual(panel("Lactate", "2.9").lactate?.value, 2.9)
    }

    func testTransaminaseAbbreviationsAreNotInsideOtherWords() {
        for name in ["Fasting glucose", "Gastrin", "Mast cell tryptase", "Blast cells"] {
            XCTAssertNil(patient(with: name, result: "5.2").latestLab(named: keywords("ast")), name)
            XCTAssertNil(panel(name, "5.2").ast, name)
        }
        for name in ["Salt", "Cobalt"] {
            XCTAssertNil(patient(with: name, result: "5.2").latestLab(named: keywords("alt")), name)
            XCTAssertNil(panel(name, "5.2").alt, name)
        }
        XCTAssertNil(panel("Alpha fetoprotein", "12").alp)
        XCTAssertNil(panel("Alpha-1 antitrypsin", "1.2").alp)
        // Fasting glucose is still glucose.
        XCTAssertEqual(patient(with: "Fasting glucose", result: "5.2").latestLab(named: keywords("glucose")), 5.2)
        XCTAssertEqual(panel("Fasting glucose", "5.2").glucose?.value, 5.2)
    }

    func testOtherSpecimensAreNotBloodValues() {
        let cases: [(name: String, key: String)] = [
            ("Urine sodium", "sodium"), ("Urine glucose", "glucose"), ("Urine WBC", "wbc"),
            ("Urine creatinine", "creatinine"), ("Urinary urea", "urea"), ("CSF glucose", "glucose"),
            ("Ascitic fluid albumin", "albumin"), ("Pleural fluid LDH", "ldh"),
        ]
        for c in cases {
            XCTAssertNil(patient(with: c.name, result: "20").latestLab(named: keywords(c.key)), c.name)
            XCTAssertEqual(LabScoreKeywords.groups(readingName: c.name), [], c.name)
            XCTAssertNil(LabPanelProbe.field(readingName: c.name), c.name)
        }
        // Urine sodium 20 was read as serum sodium 20: a false critical value.
        XCTAssertFalse(panel("Urine sodium", "20").hasCriticalValues)
        XCTAssertNil(panel("Drain amylase", "2400").amylase)
    }

    func testDerivedAndRelatedTestsAreNotTheAnalyte() {
        let cases: [(name: String, key: String)] = [
            ("Albumin/Globulin ratio", "albumin"), ("Urine albumin:creatinine ratio", "albumin"),
            ("Urine albumin:creatinine ratio", "creatinine"), ("Creatinine clearance", "creatinine"),
            ("Protein/creatinine ratio", "creatinine"), ("Direct bilirubin", "bilirubin"),
            ("Bilirubin, conjugated", "bilirubin"), ("Indirect bilirubin", "bilirubin"),
            ("D. Bilirubin", "bilirubin"), ("Leucocyte esterase", "wbc"),
            ("Glucose-6-phosphate dehydrogenase", "glucose"), ("Sodium valproate level", "sodium"),
            ("Urea breath test", "urea"),
        ]
        for c in cases {
            XCTAssertNil(patient(with: c.name, result: "1.2").latestLab(named: keywords(c.key)), "\(c.name) as \(c.key)")
        }
        XCTAssertNil(panel("Mean platelet volume", "10.2").platelets)   // was a critical platelet count
        XCTAssertFalse(panel("Mean platelet volume", "10.2").hasCriticalValues)
        XCTAssertNil(panel("Albumin/Globulin ratio", "1.2").albumin)
        XCTAssertNil(panel("Creatinine clearance", "95").creatinine)
        XCTAssertNil(panel("Direct bilirubin", "12").bilirubin)
        XCTAssertNil(panel("Leucocyte esterase", "2").wbc)
    }

    // MARK: - Real names still match

    func testCommonSpellingsStillMatch() {
        let cases: [(name: String, key: String)] = [
            ("Haemoglobin", "haemoglobin"), ("Hemoglobin", "haemoglobin"), ("Hb", "haemoglobin"),
            ("Hgb", "haemoglobin"), ("HB", "haemoglobin"), ("Hb (g/dL)", "haemoglobin"),
            ("Pre-op Hb", "haemoglobin"),
            ("WBC", "wbc"), ("White cell count", "wbc"), ("White blood cells", "wbc"),
            ("Leucocytes", "wbc"), ("Leukocyte count", "wbc"),
            ("Urea", "urea"), ("Blood urea", "urea"), ("BUN", "urea"), ("Blood urea nitrogen", "urea"),
            ("Bilirubin", "bilirubin"), ("Total bilirubin", "bilirubin"), ("Bilirubin, total", "bilirubin"),
            ("Sodium", "sodium"), ("Serum sodium", "sodium"),
            ("LDH", "ldh"), ("Lactate dehydrogenase", "ldh"),
            ("INR", "inr"), ("PT/INR", "inr"), ("PT (INR)", "inr"), ("PT-INR", "inr"),
            ("Glucose", "glucose"), ("Blood glucose", "glucose"), ("Random blood glucose", "glucose"),
            ("RBS", "glucose"), ("Glucose, fasting", "glucose"),
            ("AST", "ast"), ("Aspartate aminotransferase", "ast"), ("AST (SGOT)", "ast"),
            ("ALT", "alt"), ("Alanine aminotransferase", "alt"),
            ("eGFR", "egfr"), ("eGFR (CKD-EPI)", "egfr"),
            ("CRP", "crp"), ("hs-CRP", "crp"), ("C-reactive protein", "crp"), ("C reactive protein", "crp"),
            ("Creatinine", "creatinine"), ("Serum creatinine", "creatinine"),
            ("Calcium", "calcium"), ("Serum calcium", "calcium"), ("Total calcium", "calcium"),
            ("Albumin", "albumin"), ("Serum albumin", "albumin"),
            ("Magnesium", "magnesium"),
        ]
        for c in cases {
            XCTAssertEqual(patient(with: c.name, result: "7.5").latestLab(named: keywords(c.key)), 7.5,
                           "\(c.name) as \(c.key)")
            XCTAssertEqual(LabScoreKeywords.groups(readingName: c.name), [c.key], c.name)
        }
    }

    func testLabPanelStillReadsCommonSpellings() {
        XCTAssertEqual(panel("Hb").haemoglobin?.value, 5)
        XCTAssertEqual(panel("Haemoglobin").haemoglobin?.value, 5)
        XCTAssertEqual(panel("WBC").wbc?.value, 5)
        XCTAssertEqual(panel("White cells").wbc?.value, 5)
        XCTAssertEqual(panel("Platelets").platelets?.value, 5)
        XCTAssertEqual(panel("Platelet count").platelets?.value, 5)
        XCTAssertEqual(panel("Na").sodium?.value, 5)
        XCTAssertEqual(panel("K").potassium?.value, 5)
        XCTAssertEqual(panel("Ca").calcium?.value, 5)
        XCTAssertNil(panel("eGFR").creatinine)
        XCTAssertEqual(panel("Blood urea nitrogen").urea?.value, 5)
        XCTAssertEqual(panel("Alkaline phosphatase").alp?.value, 5)
        XCTAssertEqual(panel("D-dimer").dDimer?.value, 5)
        XCTAssertEqual(panel("D dimer").dDimer?.value, 5)
        XCTAssertEqual(panel("Troponin I (hs)").troponin?.value, 5)
        XCTAssertEqual(panel("Serum amylase").amylase?.value, 5)
        XCTAssertEqual(panel("Lipase").lipase?.value, 5)
        XCTAssertEqual(panel("ESR").esr?.value, 5)
    }

    // MARK: - The importer's copy agrees with the real reader

    func testLabScoreKeywordsAgreesWithLatestLab() {
        let names = ["HbA1c", "Hb", "HBsAg", "Fasting glucose", "Lactate dehydrogenase", "Urine sodium",
                     "CA 19-9", "Calcium", "PT/INR", "PTH", "Albumin/Globulin ratio", "White cell count",
                     "Direct bilirubin", "Blood urea nitrogen", "C-reactive protein", "eGFR", "Magnesium"]
        for name in names {
            let p = patient(with: name, result: "3")
            let read = LabScoreKeywords.groups.filter { p.latestLab(named: $0.keywords) != nil }.map(\.key)
            XCTAssertEqual(LabScoreKeywords.groups(readingName: name), read, name)
        }
    }

    // MARK: - Catalogue names and their aliases

    /// Every printed spelling the importer recognises, typed by hand as an investigation name,
    /// is read either as nothing or as the same analyte its saved name is read as — never as
    /// another analyte. (The saved names themselves are pinned by
    /// LabReportParserTests.testCanonicalNamesAreReadOnlyAsTheirOwnAnalyte.)
    func testCatalogueAliasesAreNeverReadAsAnotherAnalyte() {
        for analyte in LabAnalyteCatalog.all {
            let ownGroups = Set(LabScoreKeywords.groups(readingName: analyte.name))
            let ownField = LabPanelProbe.field(readingName: analyte.name)
            for alias in analyte.aliases {
                // Hand-typed corrected / adjusted calcium is read as calcium, as before this
                // change (the importer saves it as "Corrected Ca", which nothing reads).
                if analyte.key == "calciumAdjusted" { continue }
                let groups = Set(LabScoreKeywords.groups(readingName: alias))
                XCTAssertTrue(groups.isSubset(of: ownGroups), "\(alias) (\(analyte.key)) read as \(groups)")
                let field = LabPanelProbe.field(readingName: alias)
                XCTAssertTrue(field == nil || field == ownField, "\(alias) (\(analyte.key)) read as \(field ?? "")")
            }
        }
    }
}
