/**
 * Lab and imaging report import: the TypeScript port in lib/triage-engine/src/report-import must
 * behave exactly like the iOS parsers. These are the vectors of
 * ios/AmiseMedFlowTests/LabReportParserTests.swift, ported one for one (synthetic reports only —
 * names, dates and numbers are invented). iOS-only pieces (SwiftData, OCR line assembly, the
 * iOS readers `latestLab` / `LabPanel`) are replaced by their pure equivalents: the iOS reader
 * probe (`iosNameReaders`, `iosLabPanelField`) ported next to the catalogue.
 */
import { describe, expect, it } from 'vitest';
import {
  ECT_OFFSET_MINUTES, UTC_OFFSET_MINUTES, LAB_ANALYTES, analyteForKey, assessLabRow,
  assessmentExcludedByDefault, assessmentNeedsAttention, chartDOBDays, checkReportIdentity,
  compareNames, detectModality, emptyReportHeader, formatFixed, guessReportKind, headerFields, cleanName,
  identityIsConsistent, identityRequiresConfirmation, imagingEntry, imagingInvestigationName,
  imagingSource, iosLabPanelField, iosNameReaders, iosScoreGroupsReadingName, labAbnormality,
  labEntries, labEntry, labResultText, labRowAssessment, labRowSavedName, labSource,
  makeImagingImportDraft, makeLabImportDraft, matchAnalyte, normaliseUnit, parseImagingReport,
  parseLabReport, parseReportDate, searchSeed, swappedDate, validatePortalLink,
  type CalendarDay, type ExistingResult, type LabRowAssessment, type ReportHeader,
  type LabImportRow, type LabSpecimen, type ChartSex, type ReportSex,
} from '@workspace/triage-engine/report-import';

/** 25 Sep 2026, fixed so ages and two-digit years do not drift. */
const NOW = 1_790_337_600_000;
const readers = iosNameReaders;

// ── Fixtures (synthetic) ─────────────────────────────────────────────────────

/** Table: Test | Result | Flag | Units | Reference range; SI units; flag column sometimes empty. */
const tableReport = `LABORATORY SERVICES LTD
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
Amylase                 1450     H      U/L        30 - 110`;

/** "Test: value[flag] unit (range)" with conventional (US) units. */
const conventionalReport = `Laboratory Services Ltd - Final Report
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
HbA1c: 8.4 % (4.0-5.6)`;

/** One cell per line (as some PDFs extract), two pages with the header repeated. */
const cellPerLineReport = `Patient Name: DOE, JANE
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
\u000CPatient Name: DOE, JANE
Date of Birth: 14/03/1968
Page 2 of 2
COAGULATION
INR 1.4 H 0.8-1.2
PT 16.2 sec 11.0-13.5 H`;

const labDraft = (text: string, existing: ExistingResult[] = [], origin: 'pdfText' | 'pasted' = 'pdfText') =>
  makeLabImportDraft({ report: parseLabReport(text, NOW), origin, existing, nowMs: NOW, offsetMinutes: ECT_OFFSET_MINUTES, readers });

const assessment = (row: LabImportRow): LabRowAssessment => labRowAssessment(row, readers);

/** What iOS saves becomes the "existing" list of the next import. */
const asExisting = (entries: ReturnType<typeof labEntries>): ExistingResult[] =>
  entries.map(e => ({ name: e.name, resulted: true, at: e.resultedAt, result: e.result }));

/** ECT wall-clock fields of an instant. */
function ect(ms: number) {
  const d = new Date(ms + ECT_OFFSET_MINUTES * 60_000);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()];
}

// ── Lab layouts ──────────────────────────────────────────────────────────────

describe('lab layouts', () => {
  it('table layout reads the header and every row', () => {
    const report = parseLabReport(tableReport, NOW);
    const h = report.header;
    expect(h.patientName).toBe('DOE, JANE A');
    expect(h.dateOfBirth && [h.dateOfBirth.year, h.dateOfBirth.month, h.dateOfBirth.day]).toEqual([1968, 3, 14]);
    expect(h.ageYears).toBe(58);
    expect(h.sex).toBe('female');
    expect(h.accession).toBe('LS-24-018832');
    const c = h.collected!;
    expect([c.year, c.month, c.day, c.hour, c.minute]).toEqual([2026, 9, 12, 8, 40]);
    expect(h.reported?.hour).toBe(14);

    expect(report.rows.length).toBe(16);
    expect(report.layoutWarning).toBe(false);
    expect(report.rows.map(r => r.analyteKey ?? '-')).toEqual([
      'haemoglobin', 'wbc', 'platelets', 'neutrophils', 'sodium', 'potassium',
      'urea', 'creatinine', 'egfr', 'bilirubin', 'alt', 'alp', 'ggt', 'albumin',
      'crp', 'amylase',
    ]);

    const hb = report.rows[0];
    expect([hb.valueText, hb.flag, hb.unit, hb.referenceRange]).toEqual(['10.9', 'L', 'g/dL', '12.0 - 16.0']);
    const platelets = report.rows[2];
    expect([platelets.valueText, platelets.flag, platelets.unit]).toEqual(['388', '', 'x10^9/L']);
    const egfr = report.rows[8];
    expect([egfr.valueText, egfr.unit, egfr.referenceRange]).toEqual(['47', 'mL/min/1.73m2', '>60']);
    expect(report.rows[14].referenceRange).toBe('<5');

    // Every row is recognised, in the expected unit, and ticked.
    const draft = labDraft(tableReport);
    expect(draft.rows.filter(r => r.include).length).toBe(16);
    expect(draft.accession).toBe('LS-24-018832');
    for (const row of draft.rows) {
      expect(assessment(row).issues, labRowSavedName(row)).toEqual([]);
    }
    expect(assessment(draft.rows[0]).abnormality).toBe('low');      // printed flag L
    expect(assessment(draft.rows[5]).abnormality).toBe('normal');   // K 4.1, no flag, in range
    expect(labAbnormality(5.6, '3.5 - 5.1', '')).toBe('high');
    expect(labAbnormality(90, '>60', '')).toBe('normal');
    expect(labAbnormality(7, '<5', '')).toBe('high');
    expect(labAbnormality(null, '', '')).toBe('unknown');
  });

  it('converts conventional units and keeps the original', () => {
    const report = parseLabReport(conventionalReport, NOW);
    expect(report.header.patientName).toBe('SMITH, JOHN');
    const dob = report.header.dateOfBirth!;
    expect([dob.year, dob.month, dob.day]).toEqual([1955, 5, 2]);
    expect(report.header.ageYears).toBe(71);
    expect(report.header.sex).toBe('male');
    expect(report.header.accession).toBe('26-44102');
    expect(report.header.collected?.minute).toBe(15);

    const draft = labDraft(conventionalReport);
    const row = (key: string) => {
      const r = draft.rows.find(x => x.analyteKey === key);
      if (!r) throw new Error(`no row ${key}`);
      return r;
    };
    const expected: [string, string, string][] = [
      ['glucose', '11.8', 'mmol/L'], ['creatinine', '168', 'µmol/L'], ['bun', '13.6', 'mmol/L'],
      ['calcium', '2.02', 'mmol/L'], ['bilirubin', '41', 'µmol/L'], ['albumin', '29', 'g/L'],
      ['haemoglobin', '13.8', 'g/dL'], ['wbc', '7.8', '×10⁹/L'], ['troponinI', '45', 'ng/L'],
      ['hba1c', '8.4', '%'],
    ];
    for (const [key, value, unit] of expected) {
      const a = assessment(row(key));
      expect(a.storedValue, key).toBe(value);
      expect(normaliseUnit(a.storedUnit), key).toBe(normaliseUnit(unit));
      expect(a.issues, key).toEqual([]);
    }
    expect(assessment(row('haemoglobin')).conversionNote).toBeNull();   // already g/dL

    // The saved text starts with the converted value; the printed value and range stay.
    const glucose = row('glucose');
    expect(labResultText(glucose, assessment(glucose)))
      .toBe('11.8 mmol/L · ref 70-99 mg/dL · H · converted from 212 mg/dL · as printed: Glucose, Fasting');
    const bun = row('bun');
    expect(labRowSavedName(bun)).toBe('Urea');
    expect(labResultText(bun, assessment(bun)).startsWith('13.6 mmol/L · ref 7-20 mg/dL · H · converted from 38 mg/dL')).toBe(true);
  });

  it('reads one cell per line and a multi-page report', () => {
    const report = parseLabReport(cellPerLineReport, NOW);
    expect(report.header.allPatientNames).toEqual(['DOE, JANE']);   // repeated header, one patient
    expect(report.header.accession).toBe('LS-24-018833');
    expect(report.rows.map(r => r.analyteKey ?? '-')).toEqual(['alt', 'ast', 'inr', 'pt']);
    expect(report.rows.map(r => r.valueText)).toEqual(['88', '61', '1.4', '16.2']);
    expect(report.rows.map(r => r.flag)).toEqual(['H', 'H', 'H', 'H']);
    expect(report.rows.map(r => r.referenceRange)).toEqual(['7 - 40', '8 - 35', '0.8-1.2', '11.0-13.5']);
    expect(report.rows.map(r => r.page)).toEqual([0, 0, 1, 1]);
    expect(report.pageCount).toBe(2);
  });

  it('never pairs a column-by-column layout by position', () => {
    const text = 'HAEMATOLOGY\nSodium\nPotassium\nUrea\n138\n4.2\n5.0\nmmol/L\nmmol/L\nmmol/L\n';
    const report = parseLabReport(text, NOW);
    expect(report.rows).toEqual([]);
    expect(report.layoutWarning).toBe(true);
  });

  it('reads tabs, side-by-side results, glued units and leading ranges', () => {
    const text = 'Na 138 mmol/L K 5.9 mmol/L\nSodium\t140\tmmol/L\t135-145\nPotassium 6.3 H mmol/L 3.5-5.1\nHaemoglobin 12.0 - 16.0 11.2 g/dL\nCreatinine 88umol/L 60-110';
    const rows = parseLabReport(text, NOW).rows;
    expect(rows.map(r => r.analyteKey ?? '-')).toEqual(['sodium', 'potassium', 'sodium', 'potassium', 'haemoglobin', 'creatinine']);
    expect(rows.map(r => r.valueText)).toEqual(['138', '5.9', '140', '6.3', '11.2', '88']);
    expect(rows[4].referenceRange).toBe('12.0 - 16.0');
    expect(rows[5].unit).toBe('umol/L');
    expect(rows[5].referenceRange).toBe('60-110');
  });

  it('does not read noise lines as results', () => {
    const text = [
      'Page 1 of 2',
      'Tel: 758 452 1234  Fax: 758 452 9999',
      'P.O. Box 1234, Castries',
      'Comment: Haemolysed sample, potassium may be falsely elevated.',
      'Printed on 12/03/2026 10:14',
      'Specimen: Serum',
      'Age: 45 Years',
      'Sex hormone binding globulin 40 nmol/L (18-114)',
    ].join('\n');
    const report = parseLabReport(text, NOW);
    expect(report.header.ageYears).toBe(45);
    expect(report.rows.map(r => r.reportLabel)).toEqual(['Sex hormone binding globulin']);   // not a "Sex:" header
    expect(report.rows[0]?.analyteKey).toBeNull();
  });
});

// ── Similar names never cross over ──────────────────────────────────────────

describe('analyte names', () => {
  it('maps similar names to distinct analytes', () => {
    const text = [
      'Hb 11.2 g/dL (12.0-15.5) L',
      'Hb A1c 7.9 % (4.0-5.6) H',
      'Haemoglobin (glycated) 8.0 %',
      'Bilirubin Direct 12 umol/L (0-5) H',
      'Bilirubin - Conjugated 11 umol/L',
      'Lactate Dehydrogenase 420 U/L (125-220) H',
      'Lactate 2.9 mmol/L (0.5-2.2) H',
      'Calcium (Adjusted) 2.61 mmol/L (2.20-2.60) H',
      'Ionised Calcium 1.30 mmol/L (1.15-1.33)',
      'CA 19-9 88 U/mL (<37) H',
      'PT (INR) 1.1',
      'Mean Cell Haemoglobin 29.1 pg (27-32)',
    ].join('\n');
    const rows = parseLabReport(text, NOW).rows;
    expect(rows.map(r => r.analyteKey ?? '-')).toEqual([
      'haemoglobin', 'hba1c', 'hba1c', 'bilirubinDirect', 'bilirubinDirect', 'ldh',
      'lactate', 'calciumAdjusted', 'calciumIonised', 'ca199', 'inr', 'mch',
    ]);
  });

  it('canonical names are read only as their own analyte by the iOS readers', () => {
    const scoreGroup: Record<string, string> = {
      wbc: 'wbc', urea: 'urea', bun: 'urea', bilirubin: 'bilirubin', sodium: 'sodium',
      ldh: 'ldh', inr: 'inr', haemoglobin: 'haemoglobin', glucose: 'glucose', ast: 'ast',
      egfr: 'egfr', crp: 'crp', creatinine: 'creatinine', calcium: 'calcium', alt: 'alt',
      albumin: 'albumin', magnesium: 'magnesium',
    };
    const panelField: Record<string, string> = {
      wbc: 'wbc', haemoglobin: 'haemoglobin', platelets: 'platelets', crp: 'crp', esr: 'esr',
      sodium: 'sodium', potassium: 'potassium', creatinine: 'creatinine', urea: 'urea',
      bun: 'urea', bilirubin: 'bilirubin', alt: 'alt', ast: 'ast', alp: 'alp',
      albumin: 'albumin', calcium: 'calcium', amylase: 'amylase', lipase: 'lipase',
      lactate: 'lactate', dDimer: 'dDimer', troponinI: 'troponin', troponinT: 'troponin',
      troponin: 'troponin', inr: 'inr', glucose: 'glucose',
    };
    for (const an of LAB_ANALYTES) {
      const names = [an.name];
      if (['neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils'].includes(an.key)) names.push(an.name + ' %');
      for (const name of names) {
        expect(iosScoreGroupsReadingName(name), `score readers of ${name}`).toEqual(scoreGroup[an.key] ? [scoreGroup[an.key]] : []);
        expect(iosLabPanelField(name), `LabPanel reader of ${name}`).toBe(panelField[an.key] ?? null);
      }
    }
  });

  it('every alias matches its own analyte, and every unit key is normalised', () => {
    const seen = new Map<string, string>();
    for (const an of LAB_ANALYTES) {
      for (const alias of an.aliases) {
        expect(alias).toBe(alias.toLowerCase());
        expect(matchAnalyte(alias + ' 1')?.key, alias).toBe(an.key);
        // Two analytes never share an alias (the longest-first order would then be arbitrary).
        expect(seen.get(alias), alias).toBeUndefined();
        seen.set(alias, an.key);
      }
      for (const unit of [...an.unitAliases, ...Object.keys(an.conversions), ...Object.keys(an.ambiguousUnits)]) {
        expect(normaliseUnit(unit), `${an.key} unit ${unit} must be normalised`).toBe(unit);
      }
    }
  });
});

// ── Unmapped rows are kept ──────────────────────────────────────────────────

describe('unmapped and urine rows', () => {
  it('are preserved and guarded', () => {
    const text = [
      'Vitamin D 25-OH 18 ng/mL (30-100) L',
      'HBsAg Non-reactive',
      'Albumin/Globulin ratio 1.2 (1.0-2.2)',
      'URINALYSIS',
      'Protein Negative',
      'Glucose Negative',
      'WBC 3 /hpf',
    ].join('\n');
    const draft = labDraft(text, [], 'pasted');
    expect(draft.rows.map(labRowSavedName)).toEqual(['Vitamin D 25-OH', 'HBsAg', 'Albumin/Globulin ratio', 'Urine Protein', 'Urine Glucose', 'Urine WBC']);
    expect(draft.rows.every(r => r.analyteKey === null)).toBe(true);
    expect(draft.rows.map(r => r.include)).toEqual([true, false, false, true, false, false]);

    // Unticked because a score would read the name as Hb / albumin / glucose / WBC.
    expect(assessment(draft.rows[1]).issues).toContainEqual({ kind: 'readAsOther', readers: ['Haemoglobin'] });
    expect(assessment(draft.rows[4]).issues.some(i => i.kind === 'readAsOther')).toBe(true);
    expect(draft.rows[3].specimen).toBe('urine');

    // An unmapped row is saved under its (editable) name, with its text.
    const entry = labEntry({ row: draft.rows[0], readers, reportedAt: null, accession: '', source: 'test', documentId: null });
    expect(entry.name).toBe('Vitamin D 25-OH');
    expect(entry.result).toBe('18 ng/mL · ref 30-100 · L');
  });
});

// ── Units ───────────────────────────────────────────────────────────────────

const assess = (key: string | null, value: string, unit: string, o: { name?: string; range?: string; flag?: string; specimen?: LabSpecimen } = {}) =>
  assessLabRow({ analyteKey: key, name: o.name ?? '', valueText: value, unit, referenceRange: o.range ?? '', flag: o.flag ?? '', specimen: o.specimen ?? 'blood' }, readers);

describe('units', () => {
  it('normalises unit spellings', () => {
    expect(normaliseUnit('x10^9/L')).toBe('109/l');
    expect(normaliseUnit('×10⁹/L')).toBe('109/l');
    expect(normaliseUnit('10*3/uL')).toBe('109/l');
    expect(normaliseUnit('K/µL')).toBe('109/l');
    expect(normaliseUnit('cells/µL')).toBe('/ul');
    expect(normaliseUnit('/cumm')).toBe('/ul');
    expect(normaliseUnit('µmol/L')).toBe('umol/l');
    expect(normaliseUnit('IU/L')).toBe('u/l');
    expect(normaliseUnit('mEq/L')).toBe('meq/l');
    expect(normaliseUnit('ng/mL')).toBe('ug/l');
    expect(normaliseUnit('mL/min/1.73 m²')).toBe('ml/min/1.73m2');
    expect(normaliseUnit('Ratio')).toBe('');
  });

  it('flags ambiguous or unexpected units and never converts them', () => {
    // "Urea" in mg/dL may be urea or BUN: not converted, unticked.
    const urea = assess('urea', '32', 'mg/dL');
    expect(urea.storedValue).toBe('32');
    expect(urea.conversionNote).toBeNull();
    expect(assessmentExcludedByDefault(urea)).toBe(true);
    expect(urea.issues.some(i => i.kind === 'unitAmbiguous')).toBe(true);
    // Explicit BUN converts.
    expect(assess('bun', '32', 'mg/dL').storedValue).toBe('11.4');

    // No unit where the value could be in either unit.
    const creatinineUnit = analyteForKey('creatinine')?.appUnit ?? '';
    const creat = assess('creatinine', '95', '');
    expect(creat.issues).toContainEqual({ kind: 'unitMissing', expected: creatinineUnit });
    expect(assessmentExcludedByDefault(creat)).toBe(true);
    // No unit where only one unit exists: kept, not flagged.
    expect(assess('sodium', '138', '').issues).toEqual([]);
    expect(assess('inr', '1.2', 'ratio').issues).toEqual([]);

    // Hb in mmol/L and WBC in "G/L" are not converted.
    expect(assessmentExcludedByDefault(assess('haemoglobin', '7.5', 'mmol/L'))).toBe(true);
    expect(assessmentExcludedByDefault(assess('wbc', '7.5', 'G/L'))).toBe(true);
    // A unit this analyte is never reported in.
    expect(assess('creatinine', '95', 'U/L').issues).toContainEqual({ kind: 'unitUnexpected', unit: 'U/L', expected: creatinineUnit });
    // IFCC HbA1c is not converted to %.
    expect(assessmentExcludedByDefault(assess('hba1c', '64', 'mmol/mol'))).toBe(true);
    // g/L haemoglobin is converted to g/dL.
    expect(assess('haemoglobin', '112', 'g/L').storedValue).toBe('11.2');
  });

  it('handles implausible, censored, negative and misread values', () => {
    const k = assess('potassium', '45', 'mmol/L');
    expect(k.issues).toContainEqual({ kind: 'implausible', name: 'Potassium' });
    expect(assessmentExcludedByDefault(k)).toBe(true);

    const crp = assess('crp', '<5', 'mg/L');
    expect(crp.censor).toBe('<');
    expect(crp.storedValue).toBe('<5');
    expect(crp.issues).toContainEqual({ kind: 'censored', reading: '5' });
    expect(assessmentExcludedByDefault(crp)).toBe(false);

    // Correct SI values that a score's own unit guess would misread: kept, but flagged.
    const glucose = assess('glucose', '35.2', 'mmol/L');
    expect(assessmentExcludedByDefault(glucose)).toBe(false);
    expect(assessmentNeedsAttention(glucose)).toBe(true);
    expect(glucose.issues.some(i => i.kind === 'scoreMisread')).toBe(true);
    expect(assessmentNeedsAttention(assess('bilirubin', '4', 'umol/L'))).toBe(true);
    expect(assessmentNeedsAttention(assess('bilirubin', '12', 'umol/L'))).toBe(false);

    const be = assess(null, '-3.1', 'mmol/L', { name: 'Base excess' });
    expect(be.issues.some(i => i.kind === 'negative')).toBe(false);    // nothing reads "Base excess"

    // Thousands separators are saved without the comma (readers stop at a comma).
    expect(assess('platelets', '1,020', 'x10^9/L').storedValue).toBe('1020');
  });
});

// ── Saved entries ───────────────────────────────────────────────────────────

describe('saved entries', () => {
  it('lab entries carry source, accession and the value first', () => {
    const draft = labDraft(conventionalReport);
    const entries = labEntries(draft, readers, labSource('pdfText', true), null);
    expect(entries[0]?.source).toBe('Laboratory Services Ltd (imported PDF)');
    expect(entries[0]?.accession).toBe('26-44102');
    expect(entries.every(e => e.status === 'Resulted' && e.category === 'Blood')).toBe(true);
    const byName = (n: string) => entries.find(e => e.name === n)!;
    expect(byName('Glucose').result.split(' ')[0]).toBe('11.8');
    expect(byName('Creatinine').result.split(' ')[0]).toBe('168');
    expect(byName('Urea').result.split(' ')[0]).toBe('13.6');
    expect(byName('Calcium').result.split(' ')[0]).toBe('2.02');
    expect(byName('Bilirubin').result.split(' ')[0]).toBe('41');
    expect(byName('Albumin').result.split(' ')[0]).toBe('29');
    expect(byName('Haemoglobin').result.split(' ')[0]).toBe('13.8');
    expect(byName('WBC').result.split(' ')[0]).toBe('7.8');
    expect(byName('Troponin I').result.split(' ')[0]).toBe('45');
  });

  it('uses the collection time as the result time', () => {
    const draft = labDraft(tableReport);
    expect(ect(draft.collectedAt)).toEqual([2026, 9, 12, 8, 40]);
    const entry = labEntry({ row: draft.rows[0], readers, reportedAt: draft.reportedAt, accession: draft.accession, source: 's', documentId: null });
    expect(entry.resultedAt).toBe(draft.collectedAt);
    expect(entry.orderedAt).toBe(draft.collectedAt);
    expect(entry.reportedAt).not.toBeNull();
    expect(entry.flag).toBe('L');
    expect(entry.referenceRange).toBe('12.0 - 16.0');
  });

  it('flags and unticks the same report imported twice', () => {
    const first = labDraft(tableReport);
    const saved = asExisting(labEntries(first, readers, 's', null));
    const again = labDraft(tableReport, saved);
    expect(again.rows.every(r => !r.include)).toBe(true);
    expect(again.rows.every(r => labRowAssessment(r, readers, saved).issues.some(i => i.kind === 'alreadyInRecord'))).toBe(true);
  });
});

// ── Dates and header labels ─────────────────────────────────────────────────

describe('dates and header labels', () => {
  it('reads the date formats', () => {
    const dmy = parseReportDate('14/03/1968', true, NOW)!;
    expect([dmy.year, dmy.month, dmy.day]).toEqual([1968, 3, 14]);
    expect(dmy.dayMonthAmbiguous).toBe(false);

    const ambiguous = parseReportDate('02/05/1970', true, NOW)!;
    expect([ambiguous.month, ambiguous.day]).toEqual([5, 2]);          // day first assumed
    expect(ambiguous.dayMonthAmbiguous).toBe(true);
    const sw = swappedDate(ambiguous)!;
    expect([sw.month, sw.day]).toEqual([2, 5]);

    const us = parseReportDate('5/13/1970', true, NOW)!;
    expect([us.month, us.day]).toEqual([5, 13]);

    expect(parseReportDate('1970-05-02')?.day).toBe(2);
    expect(parseReportDate('2 May 70', true, NOW)?.year).toBe(1970);
    expect(parseReportDate('12 May 20', true, NOW)?.year).toBe(2020);
    expect(parseReportDate('May 2, 1970')?.month).toBe(5);
    const withTime = parseReportDate('13/09/2026 9.10 pm')!;
    expect([withTime.hour, withTime.minute]).toEqual([21, 10]);
    expect(parseReportDate('31/02/2026')).toBeNull();
    expect(parseReportDate('no date here')).toBeNull();
  });

  it('splits several labels on one line and needs word boundaries', () => {
    const fields = headerFields('Name: John Dobson  DOB: 01/02/1980  Lab No: 24-1');
    expect(fields.map(f => f.value)).toEqual(['John Dobson', '01/02/1980', '24-1']);
    expect(fields.map(f => f.field)).toEqual(['name', 'dob', 'accession']);
    expect(headerFields('Sex hormone binding globulin 40 nmol/L')).toEqual([]);
    expect(headerFields('Reported by: Dr Example')).toEqual([]);
    expect(cleanName('DOE, JANE F 45Y')).toBe('DOE, JANE');
    expect(cleanName('SMITH, JOHN (M)')).toBe('SMITH, JOHN');
  });
});

// ── Identity check ──────────────────────────────────────────────────────────

/** A DOB saved at local midnight in a fixed-offset zone, as an instant. */
const dobInstant = (y: number, m: number, d: number, offsetMinutes: number) => Date.UTC(y, m - 1, d) - offsetMinutes * 60_000;
const chartDays = (ms: number): CalendarDay[] => chartDOBDays(ms, [ECT_OFFSET_MINUTES, UTC_OFFSET_MINUTES]);

function header(name: string | null, dob: string | null, sex: ReportSex | null = null, age: number | null = null): ReportHeader {
  const h = emptyReportHeader();
  h.patientName = name;
  h.allPatientNames = name ? [name] : [];
  h.dateOfBirth = dob ? parseReportDate(dob, true, NOW) : null;
  h.sex = sex;
  h.ageYears = age;
  return h;
}

const check = (h: ReportHeader, chart: string, dobMs: number | null, sex: ChartSex = 'female') =>
  checkReportIdentity({ header: h, chartName: chart, chartDOB: dobMs === null ? null : chartDays(dobMs), chartSex: sex, nowMs: NOW });

describe('identity check', () => {
  it('matches despite order, case and spacing', () => {
    const chartDOB = dobInstant(1968, 3, 14, ECT_OFFSET_MINUTES);
    const c = check(header('DOE, JANE', '14/03/1968', 'female', 58), 'Jane Doe', chartDOB);
    expect(c.name).toEqual({ kind: 'exact' });
    expect(c.dob).toBe('match');
    expect(identityIsConsistent(c)).toBe(true);
    expect(identityRequiresConfirmation(c)).toBe(false);

    expect(compareNames("O'NEIL, KEVIN", 'Kevin ONeil')).toEqual({ kind: 'exact' });
    expect(compareNames('JEAN-BAPTISTE, PAUL', 'Paul Jean Baptiste')).toEqual({ kind: 'exact' });
    expect(compareNames('Mr. Kevin St Rose', 'Kevin St. Rose')).toEqual({ kind: 'exact' });
    expect(compareNames('SMITH, J', 'John Smith').kind).toBe('compatible');
    expect(compareNames('JOSEPH, MARYANN', 'Mary Ann Joseph').kind).toBe('compatible');
  });

  it('requires confirmation on any mismatch or missing DOB', () => {
    const chartDOB = dobInstant(1968, 3, 14, ECT_OFFSET_MINUTES);
    const wrongName = check(header('DOE, JOHN', '14/03/1968'), 'Jane Doe', chartDOB);
    expect(wrongName.name).toEqual({ kind: 'mismatch' });
    expect(identityRequiresConfirmation(wrongName)).toBe(true);

    const wrongDOB = check(header('DOE, JANE', '15/03/1968'), 'Jane Doe', chartDOB);
    expect(wrongDOB.dob).toBe('mismatch');
    expect(identityRequiresConfirmation(wrongDOB)).toBe(true);

    const noDOB = check(header('DOE, JANE', null), 'Jane Doe', chartDOB);
    expect(noDOB.dob).toBe('missingInReport');
    expect(identityRequiresConfirmation(noDOB)).toBe(true);

    const noChartDOB = check(header('DOE, JANE', '14/03/1968'), 'Jane Doe', null);
    expect(noChartDOB.dob).toBe('missingInChart');
    expect(identityRequiresConfirmation(noChartDOB)).toBe(true);

    const noName = check(header(null, '14/03/1968'), 'Jane Doe', chartDOB);
    expect(noName.name).toEqual({ kind: 'missingInReport' });
    expect(identityRequiresConfirmation(noName)).toBe(true);

    const sex = check(header('DOE, JANE', '14/03/1968', 'male'), 'Jane Doe', chartDOB);
    expect(sex.sexMismatch).toBe(true);
    expect(identityRequiresConfirmation(sex)).toBe(true);

    const two = header('DOE, JANE', '14/03/1968');
    two.allPatientNames = ['DOE, JANE', 'ROE, JOAN'];
    expect(identityRequiresConfirmation(check(two, 'Jane Doe', chartDOB))).toBe(true);
  });

  it('does not accept a DOB that matches only when read month/day', () => {
    // Chart DOB 5 Feb 1970; report prints 02/05/1970 (read as 2 May by default).
    const c = check(header('DOE, JANE', '02/05/1970'), 'Jane Doe', dobInstant(1970, 2, 5, ECT_OFFSET_MINUTES));
    expect(c.dob).toBe('matchesOnlyIfSwapped');
    expect(identityRequiresConfirmation(c)).toBe(true);
  });

  it('still matches a chart DOB saved at UTC midnight', () => {
    // A DOB pulled from the server as UTC midnight reads as the previous evening in Saint Lucia.
    const c = check(header('DOE, JANE', '14/03/1968'), 'Jane Doe', dobInstant(1968, 3, 14, UTC_OFFSET_MINUTES));
    expect(c.dob).toBe('match');
  });

  it('seeds the patient search with the surname', () => {
    expect(searchSeed('DOE, JANE A')).toBe('DOE');
    expect(searchSeed('Mr Kevin Joseph')).toBe('Joseph');
    expect(searchSeed('Li, Wen')).toBe('Li, Wen');   // too short to search alone
    expect(searchSeed(null)).toBe('');
  });
});

// ── Imaging reports ─────────────────────────────────────────────────────────

const usReport = `TAPION HOSPITAL - DEPARTMENT OF IMAGING
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
Reported by: Dr A Radiologist, Consultant Radiologist`;

const ctReport = `TAPION HOSPITAL IMAGING DEPARTMENT
Name: DOE, JANE  |  D.O.B.: 14/03/1968  |  Study No: CT-26-11873
Study Date: 16/09/2026 11:20
CT ABDOMEN AND PELVIS WITH IV CONTRAST
CLINICAL INFORMATION: Rising inflammatory markers, ?collection.
TECHNIQUE: Axial images from the diaphragm to the symphysis pubis following IV contrast.
COMPARISON: Ultrasound 15/09/2026.
FINDINGS: There is a 4.2 x 3.1 cm rim-enhancing collection in the gallbladder fossa.
No free intraperitoneal gas. The pancreas is normal.
CONCLUSION: Gallbladder fossa collection in keeping with perforated cholecystitis with abscess.`;

const mrcpReport = `Tapion Hospital Imaging
Patient: DOE, JANE   DOB 14/03/1968   Accession #: MR-26-2091
Exam: MRCP
Date of Exam: 20/09/2026
Indication: Obstructive LFTs.
Report:
The common bile duct is dilated to 11 mm with a 9 mm filling defect in the distal duct, consistent with a calculus.
No intrahepatic duct dilatation. Pancreatic duct normal.
Opinion: Choledocholithiasis with CBD dilatation. ERCP recommended.
Electronically signed by Dr A Radiologist on 20/09/2026`;

describe('imaging reports', () => {
  it('ultrasound abdomen report', () => {
    const r = parseImagingReport(usReport, NOW);
    expect(r.header.patientName).toBe('DOE, JANE');
    expect(r.header.accession).toBe('TH-US-771203');
    const d = r.header.examDate!;
    expect([d.year, d.month, d.day]).toEqual([2026, 9, 15]);
    expect(r.modality).toBe('ultrasound');
    expect(r.examTitle).toBe('ULTRASOUND ABDOMEN');
    expect(r.clinicalHistory).toBe('RUQ pain, fever. ?cholecystitis');
    expect(r.findings.startsWith('The gallbladder is distended')).toBe(true);
    expect(r.findings.endsWith('normal in size and echotexture.')).toBe(true);
    expect(r.impression).toBe('1. Features in keeping with acute calculous cholecystitis.\n2. No biliary dilatation.');
    expect(r.impression.includes('Radiologist')).toBe(false);
    expect(guessReportKind(usReport, NOW)).toBe('imaging');
  });

  it('CT abdomen and pelvis report', () => {
    const r = parseImagingReport(ctReport, NOW);
    expect(r.header.accession).toBe('CT-26-11873');
    expect(r.header.examDate?.hour).toBe(11);
    expect(r.modality).toBe('ct');
    expect(r.examTitle).toBe('CT ABDOMEN AND PELVIS WITH IV CONTRAST');
    expect(r.technique).toBe('Axial images from the diaphragm to the symphysis pubis following IV contrast.');
    expect(r.comparison).toBe('Ultrasound 15/09/2026.');
    expect(r.findings).toBe('There is a 4.2 x 3.1 cm rim-enhancing collection in the gallbladder fossa. No free intraperitoneal gas. The pancreas is normal.');
    expect(r.impression).toBe('Gallbladder fossa collection in keeping with perforated cholecystitis with abscess.');
    expect(guessReportKind(ctReport, NOW)).toBe('imaging');
  });

  it('MRCP report', () => {
    const r = parseImagingReport(mrcpReport, NOW);
    expect(r.header.patientName).toBe('DOE, JANE');
    expect(r.header.dateOfBirth?.year).toBe(1968);
    expect(r.header.accession).toBe('MR-26-2091');
    expect(r.header.examDate?.day).toBe(20);
    expect(r.modality).toBe('mri');
    expect(r.examTitle).toBe('MRCP');
    expect(r.clinicalHistory).toBe('Obstructive LFTs.');
    expect(r.findings.startsWith('The common bile duct is dilated to 11 mm')).toBe(true);
    expect(r.impression).toBe('Choledocholithiasis with CBD dilatation. ERCP recommended.');
    expect(imagingInvestigationName('mri', 'MRCP')).toBe('MRCP');
    expect(imagingInvestigationName('ct', 'Abdomen and pelvis')).toBe('CT Abdomen and pelvis');
  });

  it('guesses lab reports as lab', () => {
    expect(guessReportKind(tableReport, NOW)).toBe('lab');
    expect(guessReportKind(conventionalReport, NOW)).toBe('lab');
    expect(guessReportKind(cellPerLineReport, NOW)).toBe('lab');
  });

  it('modality abbreviations need capitals', () => {
    expect(detectModality('US ABDOMEN')).toBe('ultrasound');
    expect(detectModality('Please contact us for results')).toBeNull();
    expect(detectModality('Mr John Doe')).toBeNull();
    expect(detectModality('CT chest')).toBe('ct');
    expect(detectModality('Barium swallow')).toBe('fluoroscopy');
    expect(detectModality('Bilateral mammogram')).toBe('mammography');
  });

  it('saves one imaging entry that is never read as a lab value', () => {
    const parsed = parseImagingReport(ctReport, NOW);
    const draft = makeImagingImportDraft({ report: parsed, origin: 'pdfText', sourceChoice: 'tapion', customSource: '', nowMs: NOW, offsetMinutes: ECT_OFFSET_MINUTES });
    draft.portalLink = 'https://portal.example.org/study/CT-26-11873';
    const entry = imagingEntry(draft, imagingSource(draft, true), null);
    expect(entry.category).toBe('Imaging');
    expect(entry.status).toBe('Resulted');
    expect(entry.name).toBe('CT ABDOMEN AND PELVIS WITH IV CONTRAST');
    expect(entry.source).toBe('Tapion Hospital imaging (imported PDF)');
    expect(entry.accession).toBe('CT-26-11873');
    expect(entry.portalURL).toBe('https://portal.example.org/study/CT-26-11873');
    expect(entry.result.startsWith('Impression: Gallbladder fossa collection')).toBe(true);
    expect(entry.result.includes('Findings: There is a 4.2 x 3.1 cm')).toBe(true);

    expect(imagingSource({ ...draft, sourceChoice: 'okeu' }, true)).toBe('OKEU Hospital imaging (imported PDF)');
    expect(imagingSource({ ...draft, sourceChoice: 'stJudes', origin: 'pasted' }, false)).toBe("St Jude's Hospital imaging (pasted text)");
  });
});

// ── Portal link ─────────────────────────────────────────────────────────────

describe('portal link', () => {
  it('never keeps credentials', () => {
    expect(validatePortalLink('https://portal.example.org/viewer?study=CT-26-11873').ok).toBe(true);
    expect(validatePortalLink('ftp://portal.example.org/x')).toEqual({ ok: false, error: 'notWeb' });
    expect(validatePortalLink('not a link')).toEqual({ ok: false, error: 'notALink' });
    expect(validatePortalLink('https://user:secret@portal.example.org/x')).toEqual({ ok: false, error: 'containsCredentials' });
    expect(validatePortalLink('https://portal.example.org/x?token=abc')).toEqual({ ok: false, error: 'containsCredentials' });
    expect(validatePortalLink('https://portal.example.org/x#access_token=abc')).toEqual({ ok: false, error: 'containsCredentials' });
    expect(validatePortalLink('https://portal.example.org/x?sessionid=1')).toEqual({ ok: false, error: 'containsCredentials' });
  });
});

// ── Pasted text (the web's stand-in for the iOS OCR line test) ───────────────

describe('pasted text', () => {
  it('reads rows separated by double spaces, as copied from a portal table', () => {
    const rows = parseLabReport('Sodium  138  mmol/L\nPotassium  4.2').rows;
    expect(rows.map(r => r.valueText)).toEqual(['138', '4.2']);
  });

  it('iOS readers say which analyte a name would be read as', () => {
    expect(readers('HBsAg')).toEqual(['Haemoglobin']);
    expect(readers('Vitamin D 25-OH')).toEqual([]);
    // Sanity: the resultText helper never lists the label when it is the saved name.
    const row: LabImportRow = {
      id: 'x', include: true, reportLabel: 'Sodium', analyteKey: 'sodium', name: 'Sodium', valueText: '138',
      unit: 'mmol/L', referenceRange: '', flag: '', comment: '', collectedAt: NOW, specimen: 'blood', sourceLine: '',
    };
    expect(labResultText(row, assessment(row))).toBe('138 mmol/L');
  });
});

// ── Number formatting (String(format: "%.Nf") on iOS) ───────────────────────

describe('converted value formatting', () => {
  it('rounds like printf: exact binary value, ties to even', () => {
    expect(formatFixed(212 * 0.0555, 1)).toBe('11.8');
    expect(formatFixed(1.9 * 88.4, 0)).toBe('168');
    expect(formatFixed(8.1 * 0.2495, 2)).toBe('2.02');
    expect(formatFixed(2.5, 0)).toBe('2');        // exact tie → even
    expect(formatFixed(3.5, 0)).toBe('4');
    expect(formatFixed(0.125, 2)).toBe('0.12');   // exact tie → even
    expect(formatFixed(0.1 + 0.2, 1)).toBe('0.3');
    expect(formatFixed(1.005, 2)).toBe('1.00');   // 1.00499999… in binary
    expect(formatFixed(-0.04, 1)).toBe('-0.0');
    expect(formatFixed(999.96, 1)).toBe('1000.0');
  });
});
