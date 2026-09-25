/**
 * Web save mapping of the deterministic lab / imaging report import (report-import-save.ts):
 * the durable investigation_results / imaging_orders payloads, the consultation's
 * investigationResults (read by CDS through numLab), the encounter's score inputs
 * (extractedLabs, clinical-scores.ts units), the reader-keyword guard and the review rules.
 * Synthetic reports only.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ECT_OFFSET_MINUTES, LAB_ANALYTES, identityRequiresConfirmation, checkReportIdentity,
  calendarDayFromISODate, imagingSource, labRowSavedName, labSource, makeImagingImportDraft,
  makeLabImportDraft, parseImagingReport, parseLabReport, type LabImportDraft,
} from '@workspace/triage-engine/report-import';
import {
  buildImagingImportSave, buildLabImportSave, canSaveReportResults, existingFromInvestigationRows,
  fromEctInputValue, imagingReviewCanSave, imagingSaveTitle, isCriticalLabValue, labReviewCanSave,
  labSaveTitle, orderTypeFor, toEctInputValue,
} from '../report-import-save';
import { WEB_LAB_READERS, webMisreaders, webNameReaders } from '../lab-reader-keywords';
import { numLab } from '../clinical-inference';

const NOW = 1_790_337_600_000;   // 25 Sep 2026
const PATIENT = '00000000-0000-4000-8000-000000000001';
const ENCOUNTER = '00000000-0000-4000-8000-000000000002';
const readers = webNameReaders;

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

const draftOf = (text: string, existing = [] as ReturnType<typeof existingFromInvestigationRows>): LabImportDraft =>
  makeLabImportDraft({ report: parseLabReport(text, NOW), origin: 'pdfText', existing, nowMs: NOW, offsetMinutes: ECT_OFFSET_MINUTES, readers });

const save = (draft: LabImportDraft, documentId: string | null = 'doc-1') =>
  buildLabImportSave({ draft, readers, patientId: PATIENT, encounterId: ENCOUNTER, source: labSource('pdfText', true), documentId });

describe('lab report → investigation_results row', () => {
  it('writes one multi-analyte row in the saveLabPanel shape, values converted to app units', () => {
    const s = save(draftOf(conventionalReport));
    expect(s.count).toBe(10);
    expect(s.row).toMatchObject({
      patient_id: PATIENT, encounter_id: ENCOUNTER, test_name: 'Lab report 26-44102', status: 'resulted',
      performing_lab: 'Laboratory Services Ltd', linked_document_id: 'doc-1', is_abnormal: true, is_critical: false,
      specimen_type: 'blood', test_category: 'other',   // FBC and chemistry together
      notes: 'Laboratory Services Ltd (imported PDF) · Lab No 26-44102',
    });
    // Collection time 20 Sep 2026 07:15 ECT = 11:15 UTC.
    expect(s.row.collected_at).toBe('2026-09-20T11:15:00.000Z');
    const by = Object.fromEntries(s.row.analytes.map(a => [a.name, a]));
    expect(by['Glucose']).toMatchObject({ value: '11.8', unit: 'mmol/L', ref: '70-99 mg/dL', abnormal: true, flag: 'H', note: 'converted from 212 mg/dL', printed_as: 'Glucose, Fasting' });
    expect(by['Creatinine']).toMatchObject({ value: '168', unit: 'µmol/L' });
    expect(by['Urea']).toMatchObject({ value: '13.6', unit: 'mmol/L', printed_as: 'BUN' });
    expect(by['WBC']).toMatchObject({ value: '7.8', unit: '×10⁹/L' });
    expect(by['Haemoglobin']).toMatchObject({ value: '13.8', unit: 'g/dL', abnormal: false });
    expect(by['A1c (glycated)']).toMatchObject({ value: '8.4', unit: '%' });
    expect(by['Troponin I']).toMatchObject({ value: '45', unit: 'ng/L' });
    expect(save(draftOf('Sodium 138 mmol/L\nUrea 5.1 mmol/L')).row.test_category).toBe('biochemistry');
    expect(save(draftOf('WBC 7.1 x10^9/L\nPlatelets 250 x10^9/L')).row.test_category).toBe('haematology');
  });

  it('flags critical values with the iOS thresholds', () => {
    const s = save(draftOf('Haemoglobin 7.5 g/dL (12.0-16.0) L\nPotassium 4.0 mmol/L'));
    expect(s.row.is_critical).toBe(true);
    expect(s.row.analytes.find(a => a.name === 'Haemoglobin')?.critical).toBe(true);
    expect(s.row.analytes.find(a => a.name === 'Potassium')?.critical).toBe(false);
    expect(isCriticalLabValue('potassium', 6.1)).toBe(true);
    expect(isCriticalLabValue('troponinI', 53)).toBe(true);
    expect(isCriticalLabValue('calcium', 1.7)).toBe(true);
    expect(isCriticalLabValue('alt', 5000)).toBe(false);
  });

  it('a second import of the same report is unticked (already in the record)', () => {
    const first = save(draftOf(conventionalReport));
    const existing = existingFromInvestigationRows([{
      status: 'resulted', collected_at: first.row.collected_at, reported_at: null, created_at: first.row.collected_at,
      analytes: first.row.analytes,
    }]);
    const again = draftOf(conventionalReport, existing);
    expect(again.rows.every(r => !r.include)).toBe(true);
    expect(save(again).count).toBe(0);
  });
});

describe("lab report → this consultation's results (CDS readers)", () => {
  it('each saved name is read by numLab as its own analyte, value first', () => {
    const s = save(draftOf(conventionalReport));
    const r = s.sessionResults;
    expect(numLab(r, 'glucose', 'blood sugar', 'bm')).toBe(11.8);
    expect(numLab(r, 'creatinine')).toBe(168);
    expect(numLab(r, 'haemoglobin', 'hgb', 'hb')).toBe(13.8);          // not the A1c
    expect(numLab(r, 'white blood', 'wbc', 'wcc', 'leucocyte')).toBe(7.8);
    expect(numLab(r, 'bilirubin', 'bili')).toBe(41);
    expect(numLab(r, 'albumin')).toBe(29);
    expect(numLab(r, 'hba1c', 'glycated', 'glycohaemoglobin')).toBe(8.4);
    expect(r['Glucose']).toBe('11.8 mmol/L · ref 70-99 mg/dL · H · converted from 212 mg/dL');
    // No free text in the values: the critical banner scans values for analyte words.
    for (const v of Object.values(r)) expect(v).not.toMatch(/haemoglobin|potassium|creatinine/i);
  });

  it('keeps names a reader would take for another analyte out of the consultation, but in the report', () => {
    const s = save(draftOf('Bilirubin Direct 12 umol/L (0-5) H\nPT 16.2 sec 11.0-13.5 H\nINR 1.1\nFree PSA 0.4 ng/mL'));
    expect(s.row.analytes.map(a => a.name)).toEqual(['Direct bili (conjugated)', 'Prothrombin time', 'INR', 'Free PSA']);
    expect(Object.keys(s.sessionResults)).toEqual(['INR']);
    expect(s.keptOutOfSession).toEqual([
      { name: 'Direct bili (conjugated)', readers: ['Bilirubin'] },
      { name: 'Prothrombin time', readers: ['INR'] },
      { name: 'Free PSA', readers: ['PSA'] },
    ]);
    expect(numLab(s.sessionResults, 'inr', 'pt/inr', 'prothrombin')).toBe(1.1);   // never the PT seconds
  });

  it('unmapped names a reader would take for another analyte are unticked and kept out', () => {
    const d = draftOf('HBsAg Non-reactive\nVitamin D 25-OH 18 ng/mL (30-100) L');
    expect(d.rows.map(r => [labRowSavedName(r), r.include])).toEqual([['HBsAg', false], ['Vitamin D 25-OH', true]]);
    const ticked = { ...d, rows: d.rows.map(r => ({ ...r, include: true })) };
    const s = save(ticked);
    expect(Object.keys(s.sessionResults)).toEqual(['Vitamin D 25-OH']);
    expect(s.keptOutOfSession).toEqual([{ name: 'HBsAg', readers: ['Haemoglobin'] }]);
  });
});

describe('lab report → score inputs (extractedLabs)', () => {
  it('uses the units clinical-scores.ts documents (Hb g/L), only for confirmed units', () => {
    const s = save(draftOf(conventionalReport));
    expect(s.scoreInputs).toEqual({
      glucose: 11.8, creatinine: 168, urea: 13.6, calcium: 2.02, bilirubin_total: 41,
      albumin: 29, haemoglobin: 138, wbc: 7.8,
    });
    expect(s.scoreInputs).not.toHaveProperty('hba1c');   // % → mmol/mol has no exact factor
  });

  it('a row ticked despite an ambiguous unit is saved, but never fed to the scores', () => {
    const d = draftOf('Urea 32 mg/dL\nSodium 138 mmol/L');
    expect(d.rows[0].include).toBe(false);
    const s = save({ ...d, rows: d.rows.map(r => ({ ...r, include: true })) });
    expect(s.row.analytes.map(a => a.name)).toEqual(['Urea', 'Sodium']);
    expect(s.scoreInputs).toEqual({ sodium: 138 });
  });

  it('direct bilirubin feeds bilirubin_direct only in µmol/L', () => {
    expect(save(draftOf('Direct Bilirubin 12 umol/L')).scoreInputs).toEqual({ bilirubin_direct: 12 });
    expect(save(draftOf('Direct Bilirubin 0.7 mg/dL')).scoreInputs).toEqual({});
  });
});

describe('imaging report → imaging_orders row', () => {
  const ctReport = `TAPION HOSPITAL IMAGING DEPARTMENT
Name: DOE, JANE  |  D.O.B.: 14/03/1968  |  Study No: CT-26-11873
Study Date: 16/09/2026 11:20
CT ABDOMEN AND PELVIS WITH IV CONTRAST
CLINICAL INFORMATION: Rising inflammatory markers, ?collection.
FINDINGS: There is a 4.2 x 3.1 cm rim-enhancing collection in the gallbladder fossa.
CONCLUSION: Gallbladder fossa collection in keeping with perforated cholecystitis with abscess.`;

  it('stores the narrative, source, accession and portal link', () => {
    const draft = makeImagingImportDraft({ report: parseImagingReport(ctReport, NOW), origin: 'pdfText', sourceChoice: 'tapion', customSource: '', nowMs: NOW, offsetMinutes: ECT_OFFSET_MINUTES });
    draft.portalLink = 'https://portal.example.org/study/CT-26-11873';
    const row = buildImagingImportSave({ draft, patientId: PATIENT, encounterId: null, source: imagingSource(draft, true), sourceName: 'Tapion Hospital imaging', documentId: 'doc-2', nowMs: NOW });
    expect(row).toMatchObject({
      order_type: 'ct', body_area: 'CT ABDOMEN AND PELVIS WITH IV CONTRAST', status: 'reported',
      clinical_indication: 'Rising inflammatory markers, ?collection.', performing_facility: 'Tapion Hospital imaging',
      linked_document_id: 'doc-2', performed_at: '2026-09-16T15:20:00.000Z',
      notes: 'Tapion Hospital imaging (imported PDF) · Accession CT-26-11873 · Portal: https://portal.example.org/study/CT-26-11873',
    });
    expect(row.report_text.startsWith('Impression: Gallbladder fossa collection')).toBe(true);
    expect(row.report_text).toContain('Findings: There is a 4.2 x 3.1 cm');
    // A link carrying a token is never stored.
    draft.portalLink = 'https://portal.example.org/x?token=abc';
    expect(buildImagingImportSave({ draft, patientId: PATIENT, encounterId: null, source: 's', sourceName: 's', documentId: null, nowMs: NOW }).notes).not.toContain('token');
    expect(orderTypeFor('mammography')).toBe('mammogram');
    expect(orderTypeFor('fluoroscopy')).toBe('other');
  });
});

describe('review rules (same as iOS)', () => {
  it('only nurse, doctor and admin save results', () => {
    expect(canSaveReportResults('front_desk')).toBe(false);
    expect(canSaveReportResults(null)).toBe(false);
    expect(canSaveReportResults('nurse')).toBe(true);
    expect(canSaveReportResults('doctor')).toBe(true);
    expect(canSaveReportResults('admin')).toBe(true);
  });

  it('lab save needs identity confirmation, the flagged-values tick, and front desk can only attach', () => {
    const base = { identityNeedsConfirmation: false, identityConfirmed: false, canSaveResults: true, includedCount: 3, needsCheckTick: false, flaggedChecked: false, hasPdf: true };
    expect(labReviewCanSave(base)).toBe(true);
    expect(labReviewCanSave({ ...base, identityNeedsConfirmation: true })).toBe(false);
    expect(labReviewCanSave({ ...base, identityNeedsConfirmation: true, identityConfirmed: true })).toBe(true);
    expect(labReviewCanSave({ ...base, needsCheckTick: true })).toBe(false);
    expect(labReviewCanSave({ ...base, needsCheckTick: true, flaggedChecked: true })).toBe(true);
    expect(labReviewCanSave({ ...base, canSaveResults: false })).toBe(true);                 // attach only
    expect(labReviewCanSave({ ...base, canSaveResults: false, hasPdf: false })).toBe(false); // pasted text, front desk
    expect(labSaveTitle(false, 3)).toBe('Attach PDF');
    expect(labSaveTitle(true, 0)).toBe('Attach PDF');
    expect(labSaveTitle(true, 1)).toBe('Save 1 result');
    expect(labSaveTitle(true, 16)).toBe('Save 16 results');
  });

  it('imaging save rules', () => {
    const base = { identityNeedsConfirmation: false, identityConfirmed: false, canSaveReport: true, portalLinkInvalid: false, hasContent: true, hasPdf: false };
    expect(imagingReviewCanSave(base)).toBe(true);
    expect(imagingReviewCanSave({ ...base, portalLinkInvalid: true })).toBe(false);
    expect(imagingReviewCanSave({ ...base, canSaveReport: false })).toBe(false);
    expect(imagingReviewCanSave({ ...base, canSaveReport: false, hasPdf: true })).toBe(true);
    expect(imagingReviewCanSave({ ...base, identityNeedsConfirmation: true })).toBe(false);
    expect(imagingSaveTitle(false)).toBe('Attach PDF');
  });

  it('a web chart DOB ("YYYY-MM-DD") matches the report DOB; a mismatch needs confirmation', () => {
    const header = parseLabReport(conventionalReport, NOW).header;
    const ok = checkReportIdentity({ header, chartName: 'John Smith', chartDOB: [calendarDayFromISODate('1955-05-02')!], chartSex: 'male', nowMs: NOW });
    expect(identityRequiresConfirmation(ok)).toBe(false);
    const other = checkReportIdentity({ header, chartName: 'John Smith', chartDOB: [calendarDayFromISODate('1955-05-03')!], chartSex: 'male', nowMs: NOW });
    expect(identityRequiresConfirmation(other)).toBe(true);
    expect(calendarDayFromISODate('')).toBeNull();
  });

  it('review dates are Eastern Caribbean Time', () => {
    const ms = Date.UTC(2026, 8, 12, 12, 40);                 // 08:40 ECT
    expect(toEctInputValue(ms)).toBe('2026-09-12T08:40');
    expect(fromEctInputValue('2026-09-12T08:40')).toBe(ms);
    expect(fromEctInputValue('')).toBeNull();
  });
});

describe('dashboard reader keywords', () => {
  it('only four catalogue names collide with a web reader, and they are kept out of the consultation', () => {
    const collisions: Record<string, string[]> = {};
    for (const an of LAB_ANALYTES) {
      const names = ['neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils'].includes(an.key) ? [an.name, `${an.name} %`] : [an.name];
      for (const name of names) {
        const mis = webMisreaders(an.key, name);
        if (mis.length > 0) collisions[name] = mis;
      }
    }
    expect(collisions).toEqual({
      'Direct bili (conjugated)': ['Bilirubin'],
      'Indirect bili (unconjugated)': ['Bilirubin'],
      'Prothrombin time': ['INR'],
      'Free PSA': ['PSA'],
    });
  });

  it('covers every keyword list the dashboard readers are called with (keep in step)', () => {
    const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
    const covered = new Set(WEB_LAB_READERS.flatMap(r => r.keywords));
    const lists: string[][] = [];
    for (const m of src('../clinical-inference.ts').matchAll(/numLab\(investigationResults,\s*([^)]*)\)/g)) {
      lists.push([...m[1].matchAll(/'([^']*)'/g)].map(x => x[1]));
    }
    for (const m of src('../../components/LabInterpretationPanel.tsx').matchAll(/trySet\('\w+',\s*([^)]*)\)/g)) {
      lists.push([...m[1].matchAll(/'([^']*)'/g)].map(x => x[1]));
    }
    expect(lists.length).toBeGreaterThan(15);
    const missing = lists.flat().map(k => k.toLowerCase()).filter(k => !covered.has(k));
    expect(missing).toEqual([]);
    // CriticalResultAlert scans for these words.
    for (const w of ['haemoglobin', 'potassium', 'creatinine']) expect(covered.has(w)).toBe(true);
  });
});
