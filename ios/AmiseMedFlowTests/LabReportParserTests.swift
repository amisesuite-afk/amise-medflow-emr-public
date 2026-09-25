import XCTest
import SwiftData
@testable import AmiseMedFlow

/// Lab and imaging report import: deterministic parsers (LabReportParser, ImagingReportParser,
/// ReportHeaderParser), unit handling (LabAnalyteCatalog / LabRowNormaliser), the identity check,
/// and how saved rows feed Patient.latestLab(named:) and LabPanel. Synthetic reports only — the
/// names, dates and numbers are invented.
@MainActor
final class LabReportParserTests: XCTestCase {

    private let stLucia = TimeZone(identifier: "America/St_Lucia")!
    private let utc = TimeZone(identifier: "UTC")!
    /// 25 Sep 2026, fixed so ages and two-digit years do not drift.
    private let now = Date(timeIntervalSince1970: 1_790_337_600)

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

    // MARK: - Fixtures (synthetic)

    /// Table: Test | Result | Flag | Units | Reference range; SI units; flag column sometimes empty.
    private let tableReport = """
    LABORATORY SERVICES LTD
    Castries, Saint Lucia   Tel: 758-452-0000
    Patient Name: DOE, JANE A            Lab No: LS-24-018832
    DOB: 14/03/1968 (58 Y)   Sex: F      Collected: 12/09/2026 08:40
    Referring Doctor: Dr Example         Reported: 12/09/2026 14:05

    HAEMATOLOGY
    Test                    Result   Flag   Units      Reference Range
    Haemoglobin             10.9     L      g/dL       12.0 - 16.0
    WBC                     14.2     H      x10^9/L    4.0 - 11.0
    Platelets               388             x10^9/L    150 - 400
    Neutrophils             11.1     H      x10^9/L    2.0 - 7.5

    BIOCHEMISTRY
    Sodium                  133      L      mmol/L     135 - 145
    Potassium               4.1             mmol/L     3.5 - 5.1
    Urea                    9.8      H      mmol/L     2.5 - 7.8
    Creatinine              112      H      umol/L     45 - 90
    eGFR                    47       L      mL/min/1.73m2   >60
    Total Bilirubin         38       H      umol/L     3 - 21
    ALT                     145      H      U/L        7 - 40
    ALP                     310      H      U/L        30 - 130
    GGT                     402      H      U/L        7 - 40
    Albumin                 31       L      g/L        35 - 50
    CRP                     87       H      mg/L       <5
    Amylase                 1450     H      U/L        30 - 110
    """

    /// "Test: value[flag] unit (range)" with conventional (US) units.
    private let conventionalReport = """
    Laboratory Services Ltd - Final Report
    Name: SMITH, JOHN    DOB: 02-May-1955    Age/Sex: 71Y/M
    Accession No: 26-44102     Date Collected: 2026-09-20 07:15
    Glucose, Fasting: 212H mg/dL (70-99)
    Creatinine: 1.9H mg/dL (0.7-1.3)
    BUN: 38H mg/dL (7-20)
    Calcium: 8.1L mg/dL (8.5-10.5)
    Total Bilirubin: 2.4H mg/dL (0.2-1.2)
    Albumin: 2.9L g/dL (3.5-5.0)
    Hemoglobin: 13.8 g/dL (13.5-17.5)
    WBC: 7,800 /uL (4,500-11,000)
    Troponin I (hs): 0.045 ng/mL (<0.034)
    HbA1c: 8.4 % (4.0-5.6)
    """

    /// One cell per line (as some PDFs extract), two pages with the header repeated.
    private let cellPerLineReport = """
    Patient Name: DOE, JANE
    Date of Birth: 14/03/1968
    Lab No: LS-24-018833
    Collected: 13/09/2026 09:10
    LIVER FUNCTION TESTS
    ALT
    88
    U/L
    7 - 40
    H
    AST
    61
    U/L
    8 - 35
    H
    \u{000C}Patient Name: DOE, JANE
    Date of Birth: 14/03/1968
    Page 2 of 2
    COAGULATION
    INR 1.4 H 0.8-1.2
    PT 16.2 sec 11.0-13.5 H
    """

    // MARK: - Lab layouts

    func testTableLayoutReadsHeaderAndEveryRow() throws {
        let report = LabReportParser.parse(text: tableReport, now: now)
        let h = report.header
        XCTAssertEqual(h.patientName, "DOE, JANE A")
        XCTAssertEqual(h.dateOfBirth.map { [$0.year, $0.month, $0.day] }, [1968, 3, 14])
        XCTAssertEqual(h.ageYears, 58)
        XCTAssertEqual(h.sex, .female)
        XCTAssertEqual(h.accession, "LS-24-018832")
        let collected = try XCTUnwrap(h.collected)
        XCTAssertEqual([collected.year, collected.month, collected.day, collected.hour, collected.minute],
                       [2026, 9, 12, 8, 40])
        XCTAssertEqual(h.reported?.hour, 14)

        XCTAssertEqual(report.rows.count, 16)
        XCTAssertFalse(report.layoutWarning)
        XCTAssertEqual(report.rows.map { $0.analyteKey ?? "-" },
                       ["haemoglobin", "wbc", "platelets", "neutrophils", "sodium", "potassium",
                        "urea", "creatinine", "egfr", "bilirubin", "alt", "alp", "ggt", "albumin",
                        "crp", "amylase"])

        let hb = report.rows[0]
        XCTAssertEqual([hb.valueText, hb.flag, hb.unit, hb.referenceRange], ["10.9", "L", "g/dL", "12.0 - 16.0"])
        let platelets = report.rows[2]
        XCTAssertEqual([platelets.valueText, platelets.flag, platelets.unit], ["388", "", "x10^9/L"])
        let egfr = report.rows[8]
        XCTAssertEqual([egfr.valueText, egfr.unit, egfr.referenceRange], ["47", "mL/min/1.73m2", ">60"])
        XCTAssertEqual(report.rows[14].referenceRange, "<5")

        // Every row is recognised, in the expected unit, and ticked.
        let draft = LabImportDraft.make(report: report, origin: .pdfText, existing: [], now: now, timeZone: stLucia)
        XCTAssertEqual(draft.rows.filter(\.include).count, 16)
        XCTAssertEqual(draft.accession, "LS-24-018832")
        for row in draft.rows {
            XCTAssertTrue(row.assessment().issues.isEmpty, "\(row.savedName): \(row.assessment().issues)")
        }
        XCTAssertEqual(draft.rows[0].assessment().abnormality, .low)       // printed flag L
        XCTAssertEqual(draft.rows[5].assessment().abnormality, .normal)    // K 4.1, no flag, in range
        XCTAssertEqual(LabRowNormaliser.abnormality(value: 5.6, range: "3.5 - 5.1", flag: ""), .high)
        XCTAssertEqual(LabRowNormaliser.abnormality(value: 90, range: ">60", flag: ""), .normal)
        XCTAssertEqual(LabRowNormaliser.abnormality(value: 7, range: "<5", flag: ""), .high)
        XCTAssertEqual(LabRowNormaliser.abnormality(value: nil, range: "", flag: ""), .unknown)
    }

    func testConventionalUnitsAreConvertedAndTheOriginalKept() throws {
        let report = LabReportParser.parse(text: conventionalReport, now: now)
        XCTAssertEqual(report.header.patientName, "SMITH, JOHN")
        XCTAssertEqual(report.header.dateOfBirth.map { [$0.year, $0.month, $0.day] }, [1955, 5, 2])
        XCTAssertEqual(report.header.ageYears, 71)
        XCTAssertEqual(report.header.sex, .male)
        XCTAssertEqual(report.header.accession, "26-44102")
        XCTAssertEqual(report.header.collected?.minute, 15)

        let draft = LabImportDraft.make(report: report, origin: .pdfText, existing: [], now: now, timeZone: stLucia)
        func row(_ key: String) throws -> LabImportRow {
            try XCTUnwrap(draft.rows.first { $0.analyteKey == key }, key)
        }
        let expected: [(String, String, String)] = [
            ("glucose", "11.8", "mmol/L"), ("creatinine", "168", "µmol/L"), ("bun", "13.6", "mmol/L"),
            ("calcium", "2.02", "mmol/L"), ("bilirubin", "41", "µmol/L"), ("albumin", "29", "g/L"),
            ("haemoglobin", "13.8", "g/dL"), ("wbc", "7.8", "×10⁹/L"), ("troponinI", "45", "ng/L"),
            ("hba1c", "8.4", "%"),
        ]
        for (key, value, unit) in expected {
            let a = try row(key).assessment()
            XCTAssertEqual(a.storedValue, value, key)
            XCTAssertEqual(LabUnits.normalise(a.storedUnit), LabUnits.normalise(unit), key)
            XCTAssertTrue(a.issues.isEmpty, "\(key): \(a.issues)")
        }
        XCTAssertNil(try row("haemoglobin").assessment().conversionNote)   // already g/dL

        // The saved text starts with the converted value; the printed value and range stay.
        let glucose = try row("glucose")
        XCTAssertEqual(ReportImportBuilder.resultText(row: glucose, assessment: glucose.assessment()),
                       "11.8 mmol/L · ref 70-99 mg/dL · H · converted from 212 mg/dL · as printed: Glucose, Fasting")
        let bun = try row("bun")
        XCTAssertEqual(bun.savedName, "Urea")
        XCTAssertTrue(ReportImportBuilder.resultText(row: bun, assessment: bun.assessment())
            .hasPrefix("13.6 mmol/L · ref 7-20 mg/dL · H · converted from 38 mg/dL"))
    }

    func testOneCellPerLineAndMultiPageReport() {
        let report = LabReportParser.parse(text: cellPerLineReport, now: now)
        XCTAssertEqual(report.header.allPatientNames, ["DOE, JANE"])    // repeated header, one patient
        XCTAssertEqual(report.header.accession, "LS-24-018833")
        XCTAssertEqual(report.rows.map { $0.analyteKey ?? "-" }, ["alt", "ast", "inr", "pt"])
        XCTAssertEqual(report.rows.map(\.valueText), ["88", "61", "1.4", "16.2"])
        XCTAssertEqual(report.rows.map(\.flag), ["H", "H", "H", "H"])
        XCTAssertEqual(report.rows.map(\.referenceRange), ["7 - 40", "8 - 35", "0.8-1.2", "11.0-13.5"])
        XCTAssertEqual(report.rows.map(\.page), [0, 0, 1, 1])
        XCTAssertEqual(report.pageCount, 2)
    }

    func testColumnByColumnLayoutIsNeverPairedByPosition() {
        let text = "HAEMATOLOGY\nSodium\nPotassium\nUrea\n138\n4.2\n5.0\nmmol/L\nmmol/L\nmmol/L\n"
        let report = LabReportParser.parse(text: text, now: now)
        XCTAssertTrue(report.rows.isEmpty)
        XCTAssertTrue(report.layoutWarning)
    }

    func testTabsSideBySideGluedUnitsAndLeadingRanges() {
        let text = """
        Na 138 mmol/L K 5.9 mmol/L
        Sodium\t140\tmmol/L\t135-145
        Potassium 6.3 H mmol/L 3.5-5.1
        Haemoglobin 12.0 - 16.0 11.2 g/dL
        Creatinine 88umol/L 60-110
        """
        let rows = LabReportParser.parse(text: text, now: now).rows
        XCTAssertEqual(rows.map { $0.analyteKey ?? "-" }, ["sodium", "potassium", "sodium", "potassium", "haemoglobin", "creatinine"])
        XCTAssertEqual(rows.map(\.valueText), ["138", "5.9", "140", "6.3", "11.2", "88"])
        XCTAssertEqual(rows[4].referenceRange, "12.0 - 16.0")
        XCTAssertEqual(rows[5].unit, "umol/L")
        XCTAssertEqual(rows[5].referenceRange, "60-110")
    }

    func testNoiseLinesAreNotResults() {
        let text = """
        Page 1 of 2
        Tel: 758 452 1234  Fax: 758 452 9999
        P.O. Box 1234, Castries
        Comment: Haemolysed sample, potassium may be falsely elevated.
        Printed on 12/03/2026 10:14
        Specimen: Serum
        Age: 45 Years
        Sex hormone binding globulin 40 nmol/L (18-114)
        """
        let report = LabReportParser.parse(text: text, now: now)
        XCTAssertEqual(report.header.ageYears, 45)
        XCTAssertEqual(report.rows.map(\.reportLabel), ["Sex hormone binding globulin"])   // not a "Sex:" header
        XCTAssertNil(report.rows.first?.analyteKey)
    }

    // MARK: - Similar names never cross over

    func testSimilarNamesMapToDistinctAnalytes() {
        let text = """
        Hb 11.2 g/dL (12.0-15.5) L
        Hb A1c 7.9 % (4.0-5.6) H
        Haemoglobin (glycated) 8.0 %
        Bilirubin Direct 12 umol/L (0-5) H
        Bilirubin - Conjugated 11 umol/L
        Lactate Dehydrogenase 420 U/L (125-220) H
        Lactate 2.9 mmol/L (0.5-2.2) H
        Calcium (Adjusted) 2.61 mmol/L (2.20-2.60) H
        Ionised Calcium 1.30 mmol/L (1.15-1.33)
        CA 19-9 88 U/mL (<37) H
        PT (INR) 1.1
        Mean Cell Haemoglobin 29.1 pg (27-32)
        """
        let rows = LabReportParser.parse(text: text, now: now).rows
        XCTAssertEqual(rows.map { $0.analyteKey ?? "-" },
                       ["haemoglobin", "hba1c", "hba1c", "bilirubinDirect", "bilirubinDirect", "ldh",
                        "lactate", "calciumAdjusted", "calciumIonised", "ca199", "inr", "mch"])
    }

    func testCanonicalNamesAreReadOnlyAsTheirOwnAnalyte() {
        // What each saved name must feed (and nothing else): latestLab keyword groups and LabPanel.
        let scoreGroup: [String: String] = [
            "wbc": "wbc", "urea": "urea", "bun": "urea", "bilirubin": "bilirubin", "sodium": "sodium",
            "ldh": "ldh", "inr": "inr", "haemoglobin": "haemoglobin", "glucose": "glucose", "ast": "ast",
            "egfr": "egfr", "crp": "crp", "creatinine": "creatinine", "calcium": "calcium", "alt": "alt",
            "albumin": "albumin", "magnesium": "magnesium",
        ]
        let panelField: [String: String] = [
            "wbc": "wbc", "haemoglobin": "haemoglobin", "platelets": "platelets", "crp": "crp", "esr": "esr",
            "sodium": "sodium", "potassium": "potassium", "creatinine": "creatinine", "urea": "urea",
            "bun": "urea", "bilirubin": "bilirubin", "alt": "alt", "ast": "ast", "alp": "alp",
            "albumin": "albumin", "calcium": "calcium", "amylase": "amylase", "lipase": "lipase",
            "lactate": "lactate", "dDimer": "dDimer", "troponinI": "troponin", "troponinT": "troponin",
            "troponin": "troponin", "inr": "inr", "glucose": "glucose",
        ]
        for analyte in LabAnalyteCatalog.all {
            var names = [analyte.name]
            if ["neutrophils", "lymphocytes", "monocytes", "eosinophils", "basophils"].contains(analyte.key) {
                names.append(analyte.name + " %")
            }
            for name in names {
                XCTAssertEqual(LabScoreKeywords.groups(readingName: name),
                               scoreGroup[analyte.key].map { [$0] } ?? [], "score readers of \(name)")
                XCTAssertEqual(LabPanelProbe.field(readingName: name), panelField[analyte.key], "LabPanel reader of \(name)")
            }
        }
    }

    func testEveryAliasMatchesItsOwnAnalyte() {
        for analyte in LabAnalyteCatalog.all {
            for alias in analyte.aliases {
                XCTAssertEqual(alias, alias.lowercased())
                XCTAssertEqual(LabReportParser.matchAnalyte(alias + " 1")?.key, analyte.key, alias)
            }
            for unit in analyte.unitAliases + Array(analyte.conversions.keys) + Array(analyte.ambiguousUnits.keys) {
                XCTAssertEqual(LabUnits.normalise(unit), unit, "\(analyte.key) unit \(unit) must be normalised")
            }
        }
    }

    // MARK: - Unmapped rows are kept

    func testUnmappedAndUrineRowsArePreservedAndGuarded() {
        let text = """
        Vitamin D 25-OH 18 ng/mL (30-100) L
        HBsAg Non-reactive
        Albumin/Globulin ratio 1.2 (1.0-2.2)
        URINALYSIS
        Protein Negative
        Glucose Negative
        WBC 3 /hpf
        """
        let report = LabReportParser.parse(text: text, now: now)
        let draft = LabImportDraft.make(report: report, origin: .pasted, existing: [], now: now, timeZone: stLucia)
        XCTAssertEqual(draft.rows.map(\.savedName),
                       ["Vitamin D 25-OH", "HBsAg", "Albumin/Globulin ratio", "Urine Protein", "Urine Glucose", "Urine WBC"])
        XCTAssertTrue(draft.rows.allSatisfy { $0.analyteKey == nil })
        XCTAssertEqual(draft.rows.map(\.include), [true, false, false, true, false, false])

        // Unticked because a score would read the name as Hb / albumin / glucose / WBC.
        XCTAssertTrue(draft.rows[1].assessment().issues.contains(.readAsOther(["Haemoglobin"])))
        XCTAssertTrue(draft.rows[4].assessment().issues.contains { if case .readAsOther = $0 { return true }; return false })
        XCTAssertEqual(draft.rows[3].specimen, .urine)

        // An unmapped row is saved under its (editable) name, with its text.
        let entry = ReportImportBuilder.labEntry(row: draft.rows[0], reportedAt: nil, accession: "",
                                                 source: "test", documentId: nil)
        XCTAssertEqual(entry.name, "Vitamin D 25-OH")
        XCTAssertEqual(entry.result, "18 ng/mL · ref 30-100 · L")
    }

    // MARK: - Units

    func testUnitNormalisation() {
        XCTAssertEqual(LabUnits.normalise("x10^9/L"), "109/l")
        XCTAssertEqual(LabUnits.normalise("×10⁹/L"), "109/l")
        XCTAssertEqual(LabUnits.normalise("10*3/uL"), "109/l")
        XCTAssertEqual(LabUnits.normalise("K/µL"), "109/l")
        XCTAssertEqual(LabUnits.normalise("cells/µL"), "/ul")
        XCTAssertEqual(LabUnits.normalise("/cumm"), "/ul")
        XCTAssertEqual(LabUnits.normalise("µmol/L"), "umol/l")
        XCTAssertEqual(LabUnits.normalise("IU/L"), "u/l")
        XCTAssertEqual(LabUnits.normalise("mEq/L"), "meq/l")
        XCTAssertEqual(LabUnits.normalise("ng/mL"), "ug/l")
        XCTAssertEqual(LabUnits.normalise("mL/min/1.73 m²"), "ml/min/1.73m2")
        XCTAssertEqual(LabUnits.normalise("Ratio"), "")
    }

    private func assess(_ key: String?, _ value: String, _ unit: String, name: String = "",
                        range: String = "", flag: String = "") -> LabRowAssessment {
        LabRowNormaliser.assess(analyteKey: key, name: name, valueText: value, unit: unit,
                                referenceRange: range, flag: flag, specimen: .blood)
    }

    func testAmbiguousOrUnexpectedUnitsAreFlaggedNeverConverted() {
        // "Urea" in mg/dL may be urea or BUN: not converted, unticked.
        let urea = assess("urea", "32", "mg/dL")
        XCTAssertEqual(urea.storedValue, "32")
        XCTAssertNil(urea.conversionNote)
        XCTAssertTrue(urea.excludedByDefault)
        XCTAssertTrue(urea.issues.contains { if case .unitAmbiguous = $0 { return true }; return false })
        // Explicit BUN converts.
        XCTAssertEqual(assess("bun", "32", "mg/dL").storedValue, "11.4")

        // No unit where the value could be in either unit.
        let creatinineUnit = LabAnalyteCatalog.analyte(forKey: "creatinine")?.appUnit ?? ""
        let creat = assess("creatinine", "95", "")
        XCTAssertTrue(creat.issues.contains(.unitMissing(expected: creatinineUnit)))
        XCTAssertTrue(creat.excludedByDefault)
        // No unit where only one unit exists: kept, not flagged.
        XCTAssertTrue(assess("sodium", "138", "").issues.isEmpty)
        XCTAssertTrue(assess("inr", "1.2", "ratio").issues.isEmpty)

        // Hb in mmol/L and WBC in "G/L" are not converted.
        XCTAssertTrue(assess("haemoglobin", "7.5", "mmol/L").excludedByDefault)
        XCTAssertTrue(assess("wbc", "7.5", "G/L").excludedByDefault)
        // A unit this analyte is never reported in.
        XCTAssertTrue(assess("creatinine", "95", "U/L").issues.contains(.unitUnexpected(unit: "U/L", expected: creatinineUnit)))
        // IFCC HbA1c is not converted to %.
        XCTAssertTrue(assess("hba1c", "64", "mmol/mol").excludedByDefault)
        // g/L haemoglobin is converted to g/dL.
        XCTAssertEqual(assess("haemoglobin", "112", "g/L").storedValue, "11.2")
    }

    func testImplausibleCensoredNegativeAndMisreadValues() {
        let k = assess("potassium", "45", "mmol/L")
        XCTAssertTrue(k.issues.contains(.implausible("Potassium")))
        XCTAssertTrue(k.excludedByDefault)

        let crp = assess("crp", "<5", "mg/L")
        XCTAssertEqual(crp.censor, "<")
        XCTAssertEqual(crp.storedValue, "<5")
        XCTAssertTrue(crp.issues.contains(.censored("5")))
        XCTAssertFalse(crp.excludedByDefault)

        // Correct SI values that a score's own unit guess would misread: kept, but flagged.
        let glucose = assess("glucose", "35.2", "mmol/L")
        XCTAssertFalse(glucose.excludedByDefault)
        XCTAssertTrue(glucose.needsAttention)
        XCTAssertTrue(glucose.issues.contains { if case .scoreMisread = $0 { return true }; return false })
        XCTAssertTrue(assess("bilirubin", "4", "umol/L").needsAttention)
        XCTAssertFalse(assess("bilirubin", "12", "umol/L").needsAttention)

        let be = assess(nil, "-3.1", "mmol/L", name: "Base excess")
        XCTAssertFalse(be.issues.contains(.negative))    // no score reads "Base excess"

        // Thousands separators are saved without the comma (latestLab stops at a comma).
        XCTAssertEqual(assess("platelets", "1,020", "x10^9/L").storedValue, "1020")
    }

    // MARK: - Saved rows feed the scores

    func testSavedResultsFeedLatestLabAndLabPanel() throws {
        let p = Patient(fullName: "Synthetic Patient", sex: .male)
        context.insert(p)
        let report = LabReportParser.parse(text: conventionalReport, now: now)
        let draft = LabImportDraft.make(report: report, origin: .pdfText, existing: [], now: now, timeZone: stLucia)
        let entries = ReportImportBuilder.labEntries(draft: draft,
                                                     source: ReportImportBuilder.labSource(origin: .pdfText, hasPDF: true),
                                                     documentId: nil)
        p.investigations = entries

        XCTAssertEqual(entries.first?.source, "Laboratory Services Ltd (imported PDF)")
        XCTAssertEqual(entries.first?.accession, "26-44102")
        XCTAssertTrue(entries.allSatisfy { $0.status == .resulted && $0.category == .blood })
        XCTAssertEqual(p.latestLab(named: ["glucose", "blood glucose", "rbs"]), 11.8)
        XCTAssertEqual(p.creatinineUmolL(), 168)
        XCTAssertEqual(p.latestLab(named: ["urea", "blood urea", "bun", "blood urea nitrogen"]), 13.6)
        XCTAssertEqual(p.latestLab(named: ["calcium"]), 2.02)
        XCTAssertEqual(p.latestLab(named: ["bilirubin"]), 41)
        XCTAssertEqual(p.latestLab(named: ["albumin"]), 29)
        XCTAssertEqual(p.latestLab(named: ["haemoglobin", "hemoglobin", "hgb", "hb"]), 13.8)   // not the A1c
        XCTAssertEqual(p.latestLab(named: ["wbc", "white blood cell", "white cell count", "leucocyte", "leukocyte"]), 7.8)

        let labs = LabPanel.parse(from: p.investigations)
        XCTAssertEqual(labs.haemoglobin?.value, 13.8)
        XCTAssertEqual(labs.wbc?.value, 7.8)
        XCTAssertEqual(labs.creatinine?.value, 168)
        XCTAssertEqual(labs.glucose?.value, 11.8)
        XCTAssertEqual(labs.troponin?.value, 45)
        XCTAssertEqual(labs.calcium?.value, 2.02)
        XCTAssertFalse(labs.hasCriticalValues)
    }

    func testCollectionTimeIsTheResultTime() throws {
        let draft = LabImportDraft.make(report: LabReportParser.parse(text: tableReport, now: now),
                                        origin: .pdfText, existing: [], now: now, timeZone: stLucia)
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = stLucia
        let c = cal.dateComponents([.year, .month, .day, .hour, .minute], from: draft.collectedAt)
        XCTAssertEqual([c.year, c.month, c.day, c.hour, c.minute], [2026, 9, 12, 8, 40])
        let entry = ReportImportBuilder.labEntry(row: draft.rows[0], reportedAt: draft.reportedAt,
                                                 accession: draft.accession, source: "s", documentId: nil)
        XCTAssertEqual(entry.resultedAt, draft.collectedAt)
        XCTAssertEqual(entry.orderedAt, draft.collectedAt)
        XCTAssertNotNil(entry.reportedAt)
        XCTAssertEqual(entry.flag, "L")
        XCTAssertEqual(entry.referenceRange, "12.0 - 16.0")
    }

    func testImportingTheSameReportTwiceIsFlaggedAndUnticked() {
        let report = LabReportParser.parse(text: tableReport, now: now)
        let first = LabImportDraft.make(report: report, origin: .pdfText, existing: [], now: now, timeZone: stLucia)
        let saved = ReportImportBuilder.labEntries(draft: first, source: "s", documentId: nil)
        let again = LabImportDraft.make(report: report, origin: .pdfText, existing: saved, now: now, timeZone: stLucia)
        XCTAssertTrue(again.rows.allSatisfy { !$0.include })
        XCTAssertTrue(again.rows.allSatisfy { $0.assessment(existing: saved).issues.contains(.alreadyInRecord) })
    }

    func testOldInvestigationJSONStillDecodes() throws {
        let json = #"[{"id":"6F9619FF-8B86-D011-B42D-00C04FC964FF","name":"Sodium","category":"Blood","status":"Resulted","result":"138","orderedAt":0,"suggestedFor":""}]"#
        let p = Patient(fullName: "Synthetic Patient")
        context.insert(p)
        p.investigationsJson = json
        XCTAssertEqual(p.investigations.count, 1)
        XCTAssertNil(p.investigations.first?.source)
        // New fields round-trip.
        var e = p.investigations[0]
        e.source = "Laboratory Services Ltd (imported PDF)"
        e.portalURL = "https://portal.example.org/study/1"
        p.investigations = [e]
        XCTAssertEqual(p.investigations.first?.portalURL, "https://portal.example.org/study/1")
    }

    // MARK: - Dates and header labels

    func testDateFormats() throws {
        let dmy = try XCTUnwrap(ReportDateParser.parse("14/03/1968", isBirthDate: true, now: now))
        XCTAssertEqual([dmy.year, dmy.month, dmy.day], [1968, 3, 14])
        XCTAssertFalse(dmy.dayMonthAmbiguous)

        let ambiguous = try XCTUnwrap(ReportDateParser.parse("02/05/1970", isBirthDate: true, now: now))
        XCTAssertEqual([ambiguous.month, ambiguous.day], [5, 2])          // day first assumed
        XCTAssertTrue(ambiguous.dayMonthAmbiguous)
        XCTAssertEqual(ambiguous.swapped.map { [$0.month, $0.day] }, [2, 5])

        let us = try XCTUnwrap(ReportDateParser.parse("5/13/1970", isBirthDate: true, now: now))
        XCTAssertEqual([us.month, us.day], [5, 13])

        XCTAssertEqual(ReportDateParser.parse("1970-05-02")?.day, 2)
        XCTAssertEqual(ReportDateParser.parse("2 May 70", isBirthDate: true, now: now)?.year, 1970)
        XCTAssertEqual(ReportDateParser.parse("12 May 20", isBirthDate: true, now: now)?.year, 2020)
        XCTAssertEqual(ReportDateParser.parse("May 2, 1970")?.month, 5)
        let withTime = try XCTUnwrap(ReportDateParser.parse("13/09/2026 9.10 pm"))
        XCTAssertEqual([withTime.hour, withTime.minute], [21, 10])
        XCTAssertNil(ReportDateParser.parse("31/02/2026"))
        XCTAssertNil(ReportDateParser.parse("no date here"))
    }

    func testHeaderLabelsSplitOneLineAndNeedWordBoundaries() {
        let fields = ReportHeaderParser.fields(in: "Name: John Dobson  DOB: 01/02/1980  Lab No: 24-1")
        XCTAssertEqual(fields.map { $0.value }, ["John Dobson", "01/02/1980", "24-1"])
        XCTAssertEqual(fields.map { $0.field }, [.name, .dob, .accession])
        XCTAssertTrue(ReportHeaderParser.fields(in: "Sex hormone binding globulin 40 nmol/L").isEmpty)
        XCTAssertTrue(ReportHeaderParser.fields(in: "Reported by: Dr Example").isEmpty)
        XCTAssertEqual(ReportHeaderParser.cleanName("DOE, JANE F 45Y"), "DOE, JANE")
        XCTAssertEqual(ReportHeaderParser.cleanName("SMITH, JOHN (M)"), "SMITH, JOHN")
    }

    // MARK: - Identity check

    private func dob(_ y: Int, _ m: Int, _ d: Int, in tz: TimeZone) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = tz
        return cal.date(from: DateComponents(year: y, month: m, day: d))!
    }

    private func header(name: String?, dob: String?, sex: Sex? = nil, age: Int? = nil) -> ReportHeader {
        var h = ReportHeader()
        h.patientName = name
        h.allPatientNames = name.map { [$0] } ?? []
        h.dateOfBirth = dob.flatMap { ReportDateParser.parse($0, isBirthDate: true, now: now) }
        h.sex = sex
        h.ageYears = age
        return h
    }

    private func check(_ h: ReportHeader, chart: String, dob chartDOB: Date?, sex: Sex = .female) -> ReportIdentityCheck {
        PatientIdentityMatcher.check(header: h, chartName: chart, chartDOB: chartDOB, chartSex: sex,
                                     timeZones: [stLucia, utc], now: now)
    }

    func testIdentityMatchesDespiteOrderCaseAndSpacing() {
        let chartDOB = dob(1968, 3, 14, in: stLucia)
        let c = check(header(name: "DOE, JANE", dob: "14/03/1968", sex: .female, age: 58), chart: "Jane Doe", dob: chartDOB)
        XCTAssertEqual(c.name, .exact)
        XCTAssertEqual(c.dob, .match)
        XCTAssertTrue(c.isConsistent)
        XCTAssertFalse(c.requiresConfirmation)

        XCTAssertEqual(PatientIdentityMatcher.compareNames(report: "O'NEIL, KEVIN", chart: "Kevin ONeil"), .exact)
        XCTAssertEqual(PatientIdentityMatcher.compareNames(report: "JEAN-BAPTISTE, PAUL", chart: "Paul Jean Baptiste"), .exact)
        XCTAssertEqual(PatientIdentityMatcher.compareNames(report: "Mr. Kevin St Rose", chart: "Kevin St. Rose"), .exact)
        if case .compatible = PatientIdentityMatcher.compareNames(report: "SMITH, J", chart: "John Smith") {} else {
            XCTFail("initial should be compatible")
        }
        if case .compatible = PatientIdentityMatcher.compareNames(report: "JOSEPH, MARYANN", chart: "Mary Ann Joseph") {} else {
            XCTFail("joined names should be compatible")
        }
    }

    func testMismatchOrMissingDOBRequiresConfirmation() {
        let chartDOB = dob(1968, 3, 14, in: stLucia)
        let wrongName = check(header(name: "DOE, JOHN", dob: "14/03/1968"), chart: "Jane Doe", dob: chartDOB)
        XCTAssertEqual(wrongName.name, .mismatch)
        XCTAssertTrue(wrongName.requiresConfirmation)

        let wrongDOB = check(header(name: "DOE, JANE", dob: "15/03/1968"), chart: "Jane Doe", dob: chartDOB)
        XCTAssertEqual(wrongDOB.dob, .mismatch)
        XCTAssertTrue(wrongDOB.requiresConfirmation)

        let noDOB = check(header(name: "DOE, JANE", dob: nil), chart: "Jane Doe", dob: chartDOB)
        XCTAssertEqual(noDOB.dob, .missingInReport)
        XCTAssertTrue(noDOB.requiresConfirmation)

        let noChartDOB = check(header(name: "DOE, JANE", dob: "14/03/1968"), chart: "Jane Doe", dob: nil)
        XCTAssertEqual(noChartDOB.dob, .missingInChart)
        XCTAssertTrue(noChartDOB.requiresConfirmation)

        let noName = check(header(name: nil, dob: "14/03/1968"), chart: "Jane Doe", dob: chartDOB)
        XCTAssertEqual(noName.name, .missingInReport)
        XCTAssertTrue(noName.requiresConfirmation)

        let sex = check(header(name: "DOE, JANE", dob: "14/03/1968", sex: .male), chart: "Jane Doe", dob: chartDOB)
        XCTAssertTrue(sex.sexMismatch)
        XCTAssertTrue(sex.requiresConfirmation)

        var two = header(name: "DOE, JANE", dob: "14/03/1968")
        two.allPatientNames = ["DOE, JANE", "ROE, JOAN"]
        XCTAssertTrue(check(two, chart: "Jane Doe", dob: chartDOB).requiresConfirmation)
    }

    func testDOBMatchingOnlyWhenReadMonthDayIsNotAccepted() {
        // Chart DOB 5 Feb 1970; report prints 02/05/1970 (read as 2 May by default).
        let c = check(header(name: "DOE, JANE", dob: "02/05/1970"), chart: "Jane Doe", dob: dob(1970, 2, 5, in: stLucia))
        XCTAssertEqual(c.dob, .matchesOnlyIfSwapped)
        XCTAssertTrue(c.requiresConfirmation)
    }

    func testChartDOBSavedAtUTCMidnightStillMatches() {
        // A DOB pulled from the server as UTC midnight reads as the previous evening in Saint Lucia.
        let c = check(header(name: "DOE, JANE", dob: "14/03/1968"), chart: "Jane Doe", dob: dob(1968, 3, 14, in: utc))
        XCTAssertEqual(c.dob, .match)
    }

    func testSearchSeedIsTheSurname() {
        XCTAssertEqual(PatientIdentityMatcher.searchSeed(from: "DOE, JANE A"), "DOE")
        XCTAssertEqual(PatientIdentityMatcher.searchSeed(from: "Mr Kevin Joseph"), "Joseph")
        XCTAssertEqual(PatientIdentityMatcher.searchSeed(from: "Li, Wen"), "Li, Wen")   // too short to search alone
        XCTAssertEqual(PatientIdentityMatcher.searchSeed(from: nil), "")
    }

    // MARK: - Imaging reports

    private let usReport = """
    TAPION HOSPITAL - DEPARTMENT OF IMAGING
    Patient Name: DOE, JANE        DOB: 14/03/1968      Sex: F
    Accession No: TH-US-771203     Exam Date: 15/09/2026
    Referring Physician: Dr Example
    Examination: ULTRASOUND ABDOMEN
    Clinical History: RUQ pain, fever. ?cholecystitis
    Findings:
    The gallbladder is distended with a thickened wall measuring 5 mm.
    Multiple mobile calculi are seen, the largest 14 mm. Positive sonographic Murphy's sign.
    The CBD measures 5 mm. The liver is normal in size and echotexture.
    Impression:
    1. Features in keeping with acute calculous cholecystitis.
    2. No biliary dilatation.
    Reported by: Dr A Radiologist, Consultant Radiologist
    """

    private let ctReport = """
    TAPION HOSPITAL IMAGING DEPARTMENT
    Name: DOE, JANE  |  D.O.B.: 14/03/1968  |  Study No: CT-26-11873
    Study Date: 16/09/2026 11:20
    CT ABDOMEN AND PELVIS WITH IV CONTRAST
    CLINICAL INFORMATION: Rising inflammatory markers, ?collection.
    TECHNIQUE: Axial images from the diaphragm to the symphysis pubis following IV contrast.
    COMPARISON: Ultrasound 15/09/2026.
    FINDINGS: There is a 4.2 x 3.1 cm rim-enhancing collection in the gallbladder fossa.
    No free intraperitoneal gas. The pancreas is normal.
    CONCLUSION: Gallbladder fossa collection in keeping with perforated cholecystitis with abscess.
    """

    private let mrcpReport = """
    Tapion Hospital Imaging
    Patient: DOE, JANE   DOB 14/03/1968   Accession #: MR-26-2091
    Exam: MRCP
    Date of Exam: 20/09/2026
    Indication: Obstructive LFTs.
    Report:
    The common bile duct is dilated to 11 mm with a 9 mm filling defect in the distal duct, consistent with a calculus.
    No intrahepatic duct dilatation. Pancreatic duct normal.
    Opinion: Choledocholithiasis with CBD dilatation. ERCP recommended.
    Electronically signed by Dr A Radiologist on 20/09/2026
    """

    func testUltrasoundAbdomenReport() {
        let r = ImagingReportParser.parse(text: usReport, now: now)
        XCTAssertEqual(r.header.patientName, "DOE, JANE")
        XCTAssertEqual(r.header.accession, "TH-US-771203")
        XCTAssertEqual(r.header.examDate.map { [$0.year, $0.month, $0.day] }, [2026, 9, 15])
        XCTAssertEqual(r.modality, .ultrasound)
        XCTAssertEqual(r.examTitle, "ULTRASOUND ABDOMEN")
        XCTAssertEqual(r.clinicalHistory, "RUQ pain, fever. ?cholecystitis")
        XCTAssertTrue(r.findings.hasPrefix("The gallbladder is distended"))
        XCTAssertTrue(r.findings.hasSuffix("normal in size and echotexture."))
        XCTAssertEqual(r.impression, "1. Features in keeping with acute calculous cholecystitis.\n2. No biliary dilatation.")
        XCTAssertFalse(r.impression.contains("Radiologist"))
        XCTAssertEqual(ReportKindGuesser.guess(text: usReport), .imaging)
    }

    func testCTAbdomenPelvisReport() {
        let r = ImagingReportParser.parse(text: ctReport, now: now)
        XCTAssertEqual(r.header.accession, "CT-26-11873")
        XCTAssertEqual(r.header.examDate?.hour, 11)
        XCTAssertEqual(r.modality, .ct)
        XCTAssertEqual(r.examTitle, "CT ABDOMEN AND PELVIS WITH IV CONTRAST")
        XCTAssertEqual(r.technique, "Axial images from the diaphragm to the symphysis pubis following IV contrast.")
        XCTAssertEqual(r.comparison, "Ultrasound 15/09/2026.")
        XCTAssertEqual(r.findings, "There is a 4.2 x 3.1 cm rim-enhancing collection in the gallbladder fossa. No free intraperitoneal gas. The pancreas is normal.")
        XCTAssertEqual(r.impression, "Gallbladder fossa collection in keeping with perforated cholecystitis with abscess.")
        XCTAssertEqual(ReportKindGuesser.guess(text: ctReport), .imaging)
    }

    func testMRCPReport() {
        let r = ImagingReportParser.parse(text: mrcpReport, now: now)
        XCTAssertEqual(r.header.patientName, "DOE, JANE")
        XCTAssertEqual(r.header.dateOfBirth?.year, 1968)
        XCTAssertEqual(r.header.accession, "MR-26-2091")
        XCTAssertEqual(r.header.examDate?.day, 20)
        XCTAssertEqual(r.modality, .mri)
        XCTAssertEqual(r.examTitle, "MRCP")
        XCTAssertEqual(r.clinicalHistory, "Obstructive LFTs.")
        XCTAssertTrue(r.findings.hasPrefix("The common bile duct is dilated to 11 mm"))
        XCTAssertEqual(r.impression, "Choledocholithiasis with CBD dilatation. ERCP recommended.")
        XCTAssertEqual(ImagingReportParser.investigationName(modality: .mri, exam: "MRCP"), "MRCP")
        XCTAssertEqual(ImagingReportParser.investigationName(modality: .ct, exam: "Abdomen and pelvis"), "CT Abdomen and pelvis")
    }

    func testLabReportsAreGuessedAsLab() {
        XCTAssertEqual(ReportKindGuesser.guess(text: tableReport), .lab)
        XCTAssertEqual(ReportKindGuesser.guess(text: conventionalReport), .lab)
        XCTAssertEqual(ReportKindGuesser.guess(text: cellPerLineReport), .lab)
    }

    func testModalityAbbreviationsNeedCapitals() {
        XCTAssertEqual(ImagingModality.detect(in: "US ABDOMEN"), .ultrasound)
        XCTAssertNil(ImagingModality.detect(in: "Please contact us for results"))
        XCTAssertNil(ImagingModality.detect(in: "Mr John Doe"))
        XCTAssertEqual(ImagingModality.detect(in: "CT chest"), .ct)
        XCTAssertEqual(ImagingModality.detect(in: "Barium swallow"), .fluoroscopy)
        XCTAssertEqual(ImagingModality.detect(in: "Bilateral mammogram"), .mammography)
    }

    func testImagingEntryIsSavedAndNeverReadAsALabValue() throws {
        let parsed = ImagingReportParser.parse(text: ctReport, now: now)
        var draft = ImagingImportDraft.make(report: parsed, origin: .pdfText, sourceChoice: .tapion,
                                            customSource: "", now: now, timeZone: stLucia)
        draft.portalLink = "https://portal.example.org/study/CT-26-11873"
        let entry = ReportImportBuilder.imagingEntry(draft: draft,
                                                     source: ReportImportBuilder.imagingSource(draft, hasPDF: true),
                                                     documentId: nil)
        XCTAssertEqual(entry.category, .imaging)
        XCTAssertEqual(entry.status, .resulted)
        XCTAssertEqual(entry.name, "CT ABDOMEN AND PELVIS WITH IV CONTRAST")
        XCTAssertEqual(entry.source, "Tapion Hospital imaging (imported PDF)")
        XCTAssertEqual(entry.accession, "CT-26-11873")
        XCTAssertEqual(entry.portalURL, "https://portal.example.org/study/CT-26-11873")
        XCTAssertTrue(entry.result.hasPrefix("Impression: Gallbladder fossa collection"))
        XCTAssertTrue(entry.result.contains("Findings: There is a 4.2 x 3.1 cm"))

        // "contrast" contains "ast" and the findings contain numbers: the lab readers skip imaging.
        let p = Patient(fullName: "Synthetic Patient")
        context.insert(p)
        p.investigations = [entry]
        XCTAssertNil(p.latestLab(named: ["ast", "aspartate aminotransferase"]))
        XCTAssertNil(LabPanel.parse(from: p.investigations).ast)

        var other = draft
        other.sourceChoice = .okeu
        XCTAssertEqual(ReportImportBuilder.imagingSource(other, hasPDF: true), "OKEU Hospital imaging (imported PDF)")
        other.sourceChoice = .stJudes
        other.origin = .pasted
        XCTAssertEqual(ReportImportBuilder.imagingSource(other, hasPDF: false), "St Jude's Hospital imaging (pasted text)")
    }

    // MARK: - Portal link

    func testPortalLinkNeverKeepsCredentials() {
        XCTAssertNotNil(try? PortalLink.validate("https://portal.example.org/viewer?study=CT-26-11873").get())
        XCTAssertEqual(PortalLink.validate("ftp://portal.example.org/x"), .failure(.notWeb))
        XCTAssertEqual(PortalLink.validate("not a link"), .failure(.notALink))
        XCTAssertEqual(PortalLink.validate("https://user:secret@portal.example.org/x"), .failure(.containsCredentials))
        XCTAssertEqual(PortalLink.validate("https://portal.example.org/x?token=abc"), .failure(.containsCredentials))
        XCTAssertEqual(PortalLink.validate("https://portal.example.org/x#access_token=abc"), .failure(.containsCredentials))
        XCTAssertEqual(PortalLink.validate("https://portal.example.org/x?sessionid=1"), .failure(.containsCredentials))
    }

    // MARK: - OCR line assembly

    func testOCRFragmentsAreRebuiltIntoLines() {
        let fragments = [
            OCRFragment(text: "138", box: CGRect(x: 0.40, y: 0.800, width: 0.05, height: 0.02)),
            OCRFragment(text: "Sodium", box: CGRect(x: 0.05, y: 0.802, width: 0.10, height: 0.02)),
            OCRFragment(text: "mmol/L", box: CGRect(x: 0.55, y: 0.799, width: 0.08, height: 0.02)),
            OCRFragment(text: "Potassium", box: CGRect(x: 0.05, y: 0.770, width: 0.12, height: 0.02)),
            OCRFragment(text: "4.2", box: CGRect(x: 0.40, y: 0.771, width: 0.04, height: 0.02)),
        ]
        XCTAssertEqual(OCRLineAssembler.lines(from: fragments), ["Sodium  138  mmol/L", "Potassium  4.2"])
        let rows = LabReportParser.parse(text: OCRLineAssembler.lines(from: fragments).joined(separator: "\n")).rows
        XCTAssertEqual(rows.map(\.valueText), ["138", "4.2"])
    }
}
