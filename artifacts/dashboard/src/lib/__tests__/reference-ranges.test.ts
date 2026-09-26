/**
 * Practice reference ranges (lib/triage-engine/src/reference-ranges.ts) and every dashboard
 * consumer that reads ranges through it:
 *   - lookup: practice first, else defaults; sex / age / effective date; unknown sex or age;
 *   - classification: low / high / normal / critical; units compared only when they match;
 *   - the defaults reproduce the numbers the app used before (report-import critical limits,
 *     decision-layer ULNs, TG18 ULNs, tumour markers), so nothing changes until the practice
 *     enters its laboratory's ranges;
 *   - decision support passes a practice ULN to the engine and nothing otherwise;
 *   - a stored (lab-feed) result → the consultation's results and score inputs.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RANGE_SOURCE, DEFAULT_REFERENCE_RANGES, ageInYears, classifyAnalyte, classifyValue,
  decisionUlnFromRanges, isCriticalInAppUnit, rangeText, referenceRangeProblems, resolveReferenceRange,
  rowToReferenceRange, upperLimitOfNormal, type ReferenceRange,
} from '@workspace/triage-engine/reference-ranges';
import { isCriticalLabValue } from '../report-import-save';
import { buildDecisionSupport, decisionInput } from '../decision-support';
import type { DecisionConsultation } from '../decision-support';
import { liverEnzymeUln, scoreTokyoCholangitis } from '../clinical-scores';
import { TUMOUR_MARKERS, tumourMarkerUpper } from '../tumour-markers';
import { isLabFeedRow, sessionFromStoredAnalytes } from '../lab-feed-session';

const practice = (analyte: string, patch: Partial<ReferenceRange>): ReferenceRange => ({
  ...DEFAULT_REFERENCE_RANGES.find(r => r.analyte === analyte)!,
  labSource: 'Laboratory Services Ltd 2026', effectiveFrom: '2026-01-01', isDefault: false, ...patch,
});

describe('lookup', () => {
  it('every default is an adult (18+) range marked as a default', () => {
    for (const r of DEFAULT_REFERENCE_RANGES) {
      expect(r).toMatchObject({ ageMinYears: 18, ageMaxYears: null, isDefault: true, labSource: DEFAULT_RANGE_SOURCE });
      expect(referenceRangeProblems(r), r.analyte).toEqual([]);
    }
  });

  it('uses the sex-specific default, and the critical-only row when sex is not recorded', () => {
    expect(rangeText(resolveReferenceRange([], 'Haemoglobin', { sex: 'male', ageYears: 40 }))).toBe('13–17 g/dL');
    expect(rangeText(resolveReferenceRange([], 'Haemoglobin', { sex: 'female', ageYears: 40 }))).toBe('12–15.5 g/dL');
    const unknown = resolveReferenceRange([], 'Haemoglobin', { sex: 'unknown' });
    expect(unknown).toMatchObject({ sex: 'any', lower: null, upper: null, criticalLow: 8 });
    expect(resolveReferenceRange([], 'PSA', { sex: 'female' })).toBeNull();
  });

  it('gives a child no default range; an unknown age gets the adult range', () => {
    expect(resolveReferenceRange([], 'Sodium', { ageYears: 9 })).toBeNull();
    expect(resolveReferenceRange([], 'Sodium', { ageYears: null })?.lower).toBe(135);
  });

  it('prefers the practice range, most specific first, from its effective date', () => {
    const own = [
      practice('Lipase', { upper: 73 }),
      practice('Lipase', { upper: 67, sex: 'female' }),
      practice('Lipase', { upper: 55, effectiveFrom: '2027-01-01' }),
    ];
    expect(resolveReferenceRange(own, 'Lipase', { sex: 'male', onDate: '2026-10-01' })?.upper).toBe(73);
    expect(resolveReferenceRange(own, 'Lipase', { sex: 'female', onDate: '2026-10-01' })?.upper).toBe(67);
    expect(resolveReferenceRange(own, 'Lipase', { sex: 'male', onDate: '2027-02-01' })?.upper).toBe(55);
    // Before any practice range: the default.
    expect(resolveReferenceRange(own, 'Lipase', { onDate: '2025-06-01' })).toMatchObject({ upper: 60, isDefault: true });
    // A paediatric practice band does not apply to an adult.
    const paeds = [practice('Sodium', { ageMinYears: 0, ageMaxYears: 18, lower: 133 })];
    expect(resolveReferenceRange(paeds, 'Sodium', { ageYears: 40 })?.isDefault).toBe(true);
    expect(resolveReferenceRange(paeds, 'Sodium', { ageYears: 9 })?.lower).toBe(133);
  });

  it('reads database rows; retired or invalid rows never apply', () => {
    const row = {
      analyte: 'Lipase', unit: 'U/L', sex: 'any', age_min_years: '18', age_max_years: null, lower_limit: null,
      upper_limit: '73', critical_low: null, critical_high: null, lab_source: 'SLU Lab', effective_from: '2026-10-01',
    };
    expect(rowToReferenceRange(row)).toMatchObject({ upper: 73, ageMinYears: 18, isDefault: false });
    expect(rowToReferenceRange({ ...row, retired_at: '2026-11-01T00:00:00Z' })).toBeNull();
    expect(rowToReferenceRange({ ...row, unit: 'mg/dL' })).toBeNull();
    expect(rowToReferenceRange({ ...row, analyte: 'Lipaze' })).toBeNull();
  });

  it('ageInYears counts birthdays', () => {
    expect(ageInYears('1970-05-20', '2026-05-19')).toBe(55);
    expect(ageInYears('1970-05-20', '2026-05-20')).toBe(56);
    expect(ageInYears(null, '2026-05-20')).toBeNull();
  });
});

describe('classification', () => {
  it('low, high, normal and critical (strict limits), in matching units only', () => {
    const k = resolveReferenceRange([], 'Potassium');
    expect(classifyValue(k, 3.4, 'mmol/L')).toMatchObject({ flag: 'low', critical: null });
    expect(classifyValue(k, 5.3, 'mmol/L')).toMatchObject({ flag: 'normal', critical: null });
    expect(classifyValue(k, 6.0, 'mmol/L')).toMatchObject({ flag: 'high', critical: null });
    expect(classifyValue(k, 6.1, 'mmol/L')).toMatchObject({ flag: 'high', critical: 'high' });
    expect(classifyValue(k, 2.4, 'mEq/L')).toMatchObject({ flag: 'low', critical: 'low' });
    expect(classifyValue(k, 6.1, 'mg/dL')).toMatchObject({ flag: 'unknown', critical: null, range: null });
    expect(classifyAnalyte([], 'Amylase', 88, 'IU/L')).toMatchObject({ flag: 'normal', rangeText: '≤ 100 U/L' });
  });

  it('a critical limit alone (sex unknown) still flags critical', () => {
    expect(classifyAnalyte([], 'Haemoglobin', 7.2, 'g/dL', { sex: null })).toMatchObject({ critical: 'low', flag: 'low' });
  });
});

describe('the defaults reproduce the numbers the app used before', () => {
  // The switch report-import-save.ts had before this change (iOS LabPanel.hasCriticalValues).
  const OLD = (key: string, v: number): boolean => {
    switch (key) {
      case 'haemoglobin': return v < 8.0;
      case 'platelets': return v < 50;
      case 'creatinine': return v > 300;
      case 'inr': return v > 2.5;
      case 'sodium': return v < 120 || v > 155;
      case 'potassium': return v < 2.5 || v > 6.0;
      case 'lactate': return v >= 4.0;
      case 'glucose': return v < 3.0 || v > 20.0;
      case 'calcium': return v < 1.75 || v > 3.0;
      default: return ['troponinI', 'troponinT', 'troponin'].includes(key) && v > 52;
    }
  };

  it('report-import critical limits: identical on a grid of values (lactate stored as > 3.9)', () => {
    const keys = ['haemoglobin', 'platelets', 'creatinine', 'inr', 'sodium', 'potassium', 'lactate', 'glucose',
      'calcium', 'troponinI', 'troponinT', 'troponin', 'alt', 'lipase', 'crp', 'wbc'];
    for (const key of keys) {
      for (let v = 0; v <= 400; v = Math.round((v + (v < 10 ? 0.05 : v < 200 ? 0.5 : 5)) * 100) / 100) {
        if (key === 'lactate' && v > 3.9 && v < 4.0) continue;
        expect(isCriticalLabValue(key, v), `${key} ${v}`).toBe(OLD(key, v));
      }
    }
    expect(isCriticalLabValue('lactate', 3.9)).toBe(false);
    expect(isCriticalLabValue('lactate', 4.0)).toBe(true);
    expect(isCriticalLabValue(null, 1)).toBe(false);
  });

  it('decision-layer ULNs (lipase 60, amylase 100, troponin 14), TG18 ULNs and tumour markers', () => {
    expect(upperLimitOfNormal([], 'Lipase')?.value).toBe(60);
    expect(upperLimitOfNormal([], 'Amylase')?.value).toBe(100);
    for (const t of ['Troponin', 'Troponin T', 'Troponin I']) expect(upperLimitOfNormal([], t)?.value).toBe(14);
    expect(liverEnzymeUln()).toEqual({ alp: 130, ggt: 65, ast: 40, alt: 40 });
    expect(upperLimitOfNormal([], 'LDH')?.value).toBe(200);
    const uppers = Object.fromEntries(TUMOUR_MARKERS.map(d => [d.label, tumourMarkerUpper(d, [], { sex: 'female' })]));
    expect(uppers).toEqual({ CEA: 5, 'CA19-9': 37, AFP: 10, 'CA-125': 35, PSA: 4 });
  });
});

describe('consumers read the practice ranges', () => {
  it('a practice critical limit changes the report-import critical flag', () => {
    expect(isCriticalLabValue('potassium', 6.3)).toBe(true);
    expect(isCriticalLabValue('potassium', 6.3, [practice('Potassium', { criticalHigh: 6.5 })])).toBe(false);
    expect(isCriticalInAppUnit([practice('Potassium', { criticalHigh: 6.5 })], 'potassium', 6.6)).toBe(true);
  });

  it('decision layer: a practice ULN only (a default keeps the engine\'s "assumed" wording)', () => {
    expect(decisionUlnFromRanges([])).toEqual({});
    expect(decisionUlnFromRanges([practice('Lipase', { upper: 73 }), practice('Troponin I', { upper: 26 })], {}, 'troponinI'))
      .toEqual({ lipase: 73, troponin: 26 });
    expect(decisionUlnFromRanges([practice('Troponin I', { upper: 26 })], {}, 'troponinT')).toEqual({});

    const base: DecisionConsultation = {
      age: '52', sex: 'male', pregnancyPossible: false, allergies: '', medications: [], medicationsText: '',
      comorbidities: [], pmhNotes: '', hpiNotes: '', freeText: '', surgicalHistory: [], assessment: '',
      extractedLabs: { lipase: 170 }, investigationResults: {}, vitals: {}, weightKg: '', heightCm: '', isPostOp: false,
      postOpDays: '', clinicalScores: {}, workingDiagnosis: null, icdCodes: [], paneTop: [], today: '2026-10-02',
    };
    expect(decisionInput(base).uln).toBeUndefined();
    const withRanges = { ...base, referenceRanges: [practice('Lipase', { upper: 50 })] };
    expect(decisionInput(withRanges).uln).toEqual({ lipase: 50 });
    // 170 U/L: below 3 × 60 (default) but above 3 × 50 (practice).
    const before = buildDecisionSupport(base).resultActions.find(a => a.id === 'lipase-3x-uln');
    const after = buildDecisionSupport(withRanges).resultActions.find(a => a.id === 'lipase-3x-uln');
    expect(before).toBeUndefined();
    expect(after?.thresholdText).toContain('(ULN 50 U/L)');
    expect(after?.thresholdText).not.toContain('assumed');
  });

  it('TG18 cholangitis criterion B2 uses the practice ALT limit', () => {
    const inputs = { fever_or_chills: true, biliary_dilatation: true };
    const withDefault = scoreTokyoCholangitis(inputs, { alt: 55 }, {});
    const withPractice = scoreTokyoCholangitis(inputs, { alt: 55 }, {}, liverEnzymeUln([practice('ALT', { upper: 33 })]));
    expect(withDefault.criteria_met).not.toContain('B2 liver enzymes elevated');
    expect(withPractice.criteria_met).toContain('B2 liver enzymes elevated');
  });

  it('tumour markers: a practice range in another unit is ignored (never compared)', () => {
    const cea = TUMOUR_MARKERS[0];
    expect(tumourMarkerUpper(cea, [practice('CEA', { upper: 3.4 })], {})).toBe(3.4);
    expect(tumourMarkerUpper(cea, [practice('CEA', { upper: 3.4, unit: 'U/mL' })], {})).toBe(5);
  });
});

describe('a stored lab-feed result → this consultation', () => {
  const analytes = [
    { key: 'glucose', name: 'Glucose', value: '11.8', unit: 'mmol/L', ref: '70-140 mg/dL', flag: 'H', specimen: 'blood', note: 'converted from 212 mg/dL' },
    { key: 'haemoglobin', name: 'Haemoglobin', value: '13.5', unit: 'g/dL', ref: '120-155 g/L', flag: '', specimen: 'blood' },
    { key: 'bilirubinDirect', name: 'Direct bili (conjugated)', value: '12', unit: 'µmol/L', ref: '', flag: '', specimen: 'blood' },
    { key: 'urea', name: 'Urea', value: '42', unit: 'mg/dL', ref: '', flag: '', specimen: 'blood' },
    { key: null, name: 'Vitamin Q', value: '42', unit: 'U/L', ref: '10-50', flag: '', specimen: 'blood' },
  ];

  it('writes the results the readers read, keeps misread names out, and fills confirmed score inputs', () => {
    const s = sessionFromStoredAnalytes(analytes);
    expect(s.sessionResults.Glucose).toBe('11.8 mmol/L · ref 70-140 mg/dL · H · converted from 212 mg/dL');
    expect(s.sessionResults.Haemoglobin).toBe('13.5 g/dL · ref 120-155 g/L');
    expect(s.sessionResults['Vitamin Q']).toBe('42 U/L · ref 10-50');
    expect(s.keptOut.map(k => k.name)).toContain('Direct bili (conjugated)');
    expect(s.scoreInputs).toMatchObject({ glucose: 11.8, haemoglobin: 135, bilirubin_direct: 12 });
    expect(s.scoreInputs.urea).toBeUndefined(); // mg/dL urea is ambiguous: never a score input
  });

  it('recognises a lab-feed row by its provenance note', () => {
    expect(isLabFeedRow({ notes: 'lab-feed · slulab · Report LAB-26-0456' })).toBe(true);
    expect(isLabFeedRow({ notes: 'PDF import · Lab No 123' })).toBe(false);
  });
});
