// Practice reference ranges — the one place every consumer reads a normal range, an upper limit
// of normal (ULN) or a critical limit from. Pure and deterministic (no network, no AI).
//
// Where the numbers come from, in order:
//   1. the practice's own ranges (Supabase `lab_reference_ranges`, Migration 96, edited by an
//      admin in Settings → Reference ranges), when a row matches the analyte, the patient's sex
//      and age and is in effect on the result date;
//   2. otherwise DEFAULT_REFERENCE_RANGES below — conservative adult defaults, each marked
//      "default — replace with your laboratory's ranges".
//
// The defaults deliberately reproduce the numbers the app already used before this table
// existed (decision layer ULNs lipase 60 / amylase 100 / troponin 14 ng/L, the pre-operative
// critical limits of iOS LabPanel.hasCriticalValues, TG18 cholangitis ULNs, the tumour-marker
// ULNs, Light's serum LDH ULN), so turning this on changes nothing until the practice enters its
// laboratory's ranges. Needs sign-off: docs/clinical-validation/changes/lab-feed.md.
//
// iOS twin (read-only, defaults only): ios/AmiseMedFlow/Services/LabReferenceRanges.swift.
// `pnpm --filter @workspace/scripts run lint:reference-range-parity` fails when the two drift.
//
// Semantics:
//   - Units are the catalogue app units (report-import/catalog.ts). A value is compared only when
//     its unit is the range's unit (normalised); otherwise the result is "unknown", never guessed.
//   - Normal range: low when value < lower, high when value > upper (the limits are normal).
//   - Critical: value < criticalLow or value > criticalHigh (strict, as the lab critical lists
//     and iOS LabPanel print them). The iOS lactate rule "≥ 4.0" is stored as "> 3.9".
//   - Age band: ageMinYears inclusive, ageMaxYears exclusive; null = open.

import { analyteForKey, LAB_ANALYTES, normaliseUnit } from './report-import/catalog';

export const REFERENCE_RANGES_VERSION = '1.0.0';

/** Shown as the lab source of every default row. */
export const DEFAULT_RANGE_SOURCE = "default — replace with your laboratory's ranges";

/** Effective date of the defaults (the day this table was introduced). */
export const DEFAULT_RANGE_EFFECTIVE = '2026-09-26';

export type RangeSex = 'any' | 'male' | 'female';

export interface ReferenceRange {
  /** Catalogue saved name (catalog.ts `name`), e.g. "Haemoglobin". */
  analyte: string;
  /** Catalogue app unit as displayed ("g/dL"); '' for unitless (INR). */
  unit: string;
  sex: RangeSex;
  /** Inclusive; null = no lower bound. */
  ageMinYears: number | null;
  /** Exclusive; null = no upper bound. */
  ageMaxYears: number | null;
  lower: number | null;
  upper: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  labSource: string;
  /** YYYY-MM-DD: the range applies to results collected on or after this date. */
  effectiveFrom: string;
  /** True for DEFAULT_REFERENCE_RANGES rows (never for a practice row). */
  isDefault: boolean;
}

type Row = [analyte: string, unit: string, sex: RangeSex, lower: number | null, upper: number | null,
  criticalLow: number | null, criticalHigh: number | null];

// Adults (18 years and over). Children get no default: only the laboratory's own flag applies.
const ADULT_DEFAULTS: Row[] = [
  // Haematology
  ['WBC', '×10⁹/L', 'any', 4.0, 11.0, null, null],
  ['Haemoglobin', 'g/dL', 'male', 13.0, 17.0, 8.0, null],
  ['Haemoglobin', 'g/dL', 'female', 12.0, 15.5, 8.0, null],
  ['Platelets', '×10⁹/L', 'any', 150, 400, 50, null],
  ['INR', '', 'any', 0.8, 1.2, null, 2.5],
  ['D-dimer', 'µg/L FEU', 'any', null, 500, null, null],
  // Inflammation
  ['CRP', 'mg/L', 'any', null, 5, null, null],
  // Renal and electrolytes
  ['Sodium', 'mmol/L', 'any', 135, 145, 120, 155],
  ['Potassium', 'mmol/L', 'any', 3.5, 5.3, 2.5, 6.0],
  ['Urea', 'mmol/L', 'any', 2.5, 7.8, null, null],
  ['Creatinine', 'µmol/L', 'male', 59, 104, null, 300],
  ['Creatinine', 'µmol/L', 'female', 45, 84, null, 300],
  ['eGFR', 'mL/min/1.73m²', 'any', 60, null, null, null],
  ['Calcium', 'mmol/L', 'any', 2.2, 2.6, 1.75, 3.0],
  ['Magnesium', 'mmol/L', 'any', 0.7, 1.0, null, null],
  // Glucose
  ['Glucose', 'mmol/L', 'any', 3.9, 7.8, 3.0, 20.0],
  ['A1c (glycated)', '%', 'any', null, 5.6, null, null],
  // Liver
  ['Bilirubin', 'µmol/L', 'any', null, 21, null, null],
  ['ALT', 'U/L', 'any', null, 40, null, null],
  ['AST', 'U/L', 'any', null, 40, null, null],
  ['ALP', 'U/L', 'any', 30, 130, null, null],
  ['GGT', 'U/L', 'any', null, 65, null, null],
  ['Albumin', 'g/L', 'any', 35, 50, null, null],
  // Pancreas, LDH, lactate, cardiac
  ['Amylase', 'U/L', 'any', null, 100, null, null],
  ['Lipase', 'U/L', 'any', null, 60, null, null],
  ['LDH', 'U/L', 'any', null, 200, null, null],
  ['Lactate', 'mmol/L', 'any', null, 2.0, null, 3.9],
  ['Troponin I', 'ng/L', 'any', null, 14, null, 52],
  ['Troponin T', 'ng/L', 'any', null, 14, null, 52],
  ['Troponin', 'ng/L', 'any', null, 14, null, 52],
  // Tumour markers (stored as reported; compared only in these units)
  ['CEA', 'ng/mL', 'any', null, 5, null, null],
  ['CA 19-9', 'U/mL', 'any', null, 37, null, null],
  ['AFP', 'ng/mL', 'any', null, 10, null, null],
  ['CA-125', 'U/mL', 'any', null, 35, null, null],
  ['PSA', 'ng/mL', 'male', null, 4, null, null],
];

export const DEFAULT_REFERENCE_RANGES: ReadonlyArray<ReferenceRange> = ADULT_DEFAULTS.map(
  ([analyte, unit, sex, lower, upper, criticalLow, criticalHigh]) => ({
    analyte, unit, sex, ageMinYears: 18, ageMaxYears: null, lower, upper, criticalLow, criticalHigh,
    labSource: DEFAULT_RANGE_SOURCE, effectiveFrom: DEFAULT_RANGE_EFFECTIVE, isDefault: true,
  }),
);

// ── Validation (admin edits, database rows) ───────────────────────────────────────────────────

const CATALOGUE_NAMES = new Set(LAB_ANALYTES.map(a => a.name));

/** The catalogue app unit for a saved name, or null when the catalogue stores it as reported. */
export function catalogueUnitFor(analyte: string): string | null {
  const an = LAB_ANALYTES.find(a => a.name === analyte);
  return an ? an.appUnit : null;
}

/** Every catalogue saved name a range may be entered for, in catalogue order. */
export function rangeAnalyteNames(): string[] {
  return [...new Set(LAB_ANALYTES.map(a => a.name))];
}

/** Problems with a range (empty = valid). Used by the admin UI and the API before a write. */
export function referenceRangeProblems(r: Omit<ReferenceRange, 'isDefault'>): string[] {
  const out: string[] = [];
  if (!CATALOGUE_NAMES.has(r.analyte)) out.push(`“${r.analyte}” is not an analyte in the catalogue`);
  const appUnit = catalogueUnitFor(r.analyte);
  if (appUnit !== null && normaliseUnit(r.unit) !== normaliseUnit(appUnit)) {
    out.push(`${r.analyte} is stored in ${appUnit === '' ? 'no unit' : appUnit}; enter the range in that unit`);
  }
  if (!['any', 'male', 'female'].includes(r.sex)) out.push('Sex must be any, male or female');
  const nums: Array<[string, number | null]> = [
    ['Lower', r.lower], ['Upper', r.upper], ['Critical low', r.criticalLow], ['Critical high', r.criticalHigh],
    ['Minimum age', r.ageMinYears], ['Maximum age', r.ageMaxYears],
  ];
  for (const [label, v] of nums) {
    if (v !== null && (typeof v !== 'number' || !Number.isFinite(v))) out.push(`${label} must be a number`);
    else if (v !== null && v < 0) out.push(`${label} cannot be negative`);
  }
  if (r.lower === null && r.upper === null && r.criticalLow === null && r.criticalHigh === null) {
    out.push('Enter at least one limit');
  }
  if (r.lower !== null && r.upper !== null && r.lower > r.upper) out.push('Lower is above upper');
  if (r.criticalLow !== null && r.lower !== null && r.criticalLow > r.lower) out.push('Critical low is above the lower limit');
  if (r.criticalHigh !== null && r.upper !== null && r.criticalHigh < r.upper) out.push('Critical high is below the upper limit');
  if (r.criticalLow !== null && r.criticalHigh !== null && r.criticalLow >= r.criticalHigh) out.push('Critical low is not below critical high');
  if (r.ageMinYears !== null && r.ageMaxYears !== null && r.ageMinYears >= r.ageMaxYears) out.push('Minimum age is not below maximum age');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.effectiveFrom)) out.push('Effective date must be YYYY-MM-DD');
  if (r.labSource.trim() === '') out.push('Enter the laboratory the range comes from');
  return out;
}

// ── Database rows (lab_reference_ranges) ────────────────────────────────────────────────────

export interface ReferenceRangeRow {
  id?: string;
  analyte: string;
  unit: string;
  sex: string;
  age_min_years: number | string | null;
  age_max_years: number | string | null;
  lower_limit: number | string | null;
  upper_limit: number | string | null;
  critical_low: number | string | null;
  critical_high: number | string | null;
  lab_source: string;
  /** 'YYYY-MM-DD' from PostgREST (a Date from some drivers). */
  effective_from: string | Date;
  retired_at?: string | null;
  is_default?: boolean | null;
}

function isoDate(v: string | Date | null | undefined): string {
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.toISOString().slice(0, 10) : '';
  return String(v ?? '').slice(0, 10);
}

function numOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * A database row as a ReferenceRange; null when retired or invalid (it then never applies).
 * Seeded default rows keep isDefault: the lookup uses the code's defaults for those.
 */
export function rowToReferenceRange(row: ReferenceRangeRow): ReferenceRange | null {
  if (row.retired_at) return null;
  const sex = row.sex === 'male' || row.sex === 'female' ? row.sex : row.sex === 'any' ? 'any' : null;
  if (sex === null) return null;
  const r: ReferenceRange = {
    analyte: row.analyte, unit: row.unit ?? '', sex,
    ageMinYears: numOrNull(row.age_min_years), ageMaxYears: numOrNull(row.age_max_years),
    lower: numOrNull(row.lower_limit), upper: numOrNull(row.upper_limit),
    criticalLow: numOrNull(row.critical_low), criticalHigh: numOrNull(row.critical_high),
    labSource: row.lab_source ?? '', effectiveFrom: isoDate(row.effective_from),
    isDefault: row.is_default === true,
  };
  return referenceRangeProblems(r).length === 0 ? r : null;
}

export function referenceRangeToRow(r: Omit<ReferenceRange, 'isDefault'>): ReferenceRangeRow {
  return {
    analyte: r.analyte, unit: r.unit, sex: r.sex,
    age_min_years: r.ageMinYears, age_max_years: r.ageMaxYears,
    lower_limit: r.lower, upper_limit: r.upper, critical_low: r.criticalLow, critical_high: r.criticalHigh,
    lab_source: r.labSource.trim(), effective_from: r.effectiveFrom,
  };
}

// ── Lookup ─────────────────────────────────────────────────────────────────────────────────

export type PatientSex = 'male' | 'female' | 'other' | 'unknown' | null | undefined;

export interface RangeContext {
  sex?: PatientSex | string;
  ageYears?: number | null;
  /** YYYY-MM-DD of collection; defaults to "any date" (latest effective row wins). */
  onDate?: string | null;
}

function sexMatches(rangeSex: RangeSex, patientSex: string | null | undefined): boolean {
  if (rangeSex === 'any') return true;
  return (patientSex ?? '').toLowerCase() === rangeSex;
}

function ageMatches(r: ReferenceRange, age: number | null | undefined): boolean {
  if (r.ageMinYears === null && r.ageMaxYears === null) return true;
  // A banded range never applies to a patient of unknown age, except an open adult band
  // (from 18 or younger, no maximum), which applies when the age is unknown: the practice sees
  // adults.
  if (age === null || age === undefined || !Number.isFinite(age)) {
    return r.ageMaxYears === null && (r.ageMinYears === null || r.ageMinYears <= 18);
  }
  if (r.ageMinYears !== null && age < r.ageMinYears) return false;
  if (r.ageMaxYears !== null && age >= r.ageMaxYears) return false;
  return true;
}

function specificity(r: ReferenceRange): number {
  let s = r.sex === 'any' ? 0 : 100;
  if (r.ageMinYears !== null || r.ageMaxYears !== null) {
    const width = (r.ageMaxYears ?? 150) - (r.ageMinYears ?? 0);
    s += Math.max(0, 150 - width) / 10;
  }
  return s;
}

function pick(candidates: ReferenceRange[], analyte: string, ctx: RangeContext): ReferenceRange | null {
  const on = ctx.onDate ? ctx.onDate.slice(0, 10) : null;
  const matching = candidates.filter(r =>
    r.analyte === analyte && sexMatches(r.sex, ctx.sex as string | null | undefined) && ageMatches(r, ctx.ageYears)
    // The built-in defaults apply on every date; a practice range from its effective date.
    && (on === null || r.isDefault || r.effectiveFrom <= on));
  if (matching.length === 0) return null;
  // Most specific first (sex, then narrowest age band), then the latest effective date.
  matching.sort((a, b) => (specificity(b) - specificity(a)) || b.effectiveFrom.localeCompare(a.effectiveFrom));
  return matching[0];
}

/**
 * The range that applies to one analyte for one patient: the practice's own when one matches,
 * else the default. `practice` is whatever the caller loaded (possibly empty: table absent).
 */
export function resolveReferenceRange(
  practice: ReadonlyArray<ReferenceRange> | null | undefined,
  analyte: string,
  ctx: RangeContext = {},
): ReferenceRange | null {
  const own = pick((practice ?? []).filter(r => !r.isDefault), analyte, ctx);
  if (own) return own;
  return pick([...DEFAULT_REFERENCE_RANGES], analyte, ctx);
}

/** By catalogue key ("lipase", "troponinT") instead of saved name. */
export function resolveReferenceRangeForKey(
  practice: ReadonlyArray<ReferenceRange> | null | undefined,
  key: string,
  ctx: RangeContext = {},
): ReferenceRange | null {
  const an = analyteForKey(key);
  return an ? resolveReferenceRange(practice, an.name, ctx) : null;
}

/** Upper limit of normal and whether it came from the practice's own ranges. */
export function upperLimitOfNormal(
  practice: ReadonlyArray<ReferenceRange> | null | undefined,
  analyte: string,
  ctx: RangeContext = {},
): { value: number; fromPractice: boolean; range: ReferenceRange } | null {
  const r = resolveReferenceRange(practice, analyte, ctx);
  if (!r || r.upper === null) return null;
  return { value: r.upper, fromPractice: !r.isDefault, range: r };
}

// ── Classification ─────────────────────────────────────────────────────────────────────────

export type RangeFlag = 'low' | 'high' | 'normal' | 'unknown';
export type CriticalFlag = 'low' | 'high' | null;

export interface RangeClassification {
  flag: RangeFlag;
  critical: CriticalFlag;
  /** The range used; null when none applies or the unit differs. */
  range: ReferenceRange | null;
  /** "135–145 mmol/L" for display; '' when none. */
  rangeText: string;
}

/** The unit a value was reported in is the range's unit (after normalisation and catalogue aliases). */
export function unitMatchesRange(range: ReferenceRange, unit: string | null | undefined): boolean {
  const u = normaliseUnit(unit ?? '');
  const ru = normaliseUnit(range.unit);
  if (u === ru) return true;
  const an = LAB_ANALYTES.find(a => a.name === range.analyte);
  if (an && an.appUnit !== null && normaliseUnit(an.appUnit) === ru && an.unitAliases.includes(u)) return true;
  return false;
}

function fmt(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

export function rangeText(r: ReferenceRange | null): string {
  if (!r) return '';
  const unit = r.unit ? ` ${r.unit}` : '';
  if (r.lower !== null && r.upper !== null) return `${fmt(r.lower)}–${fmt(r.upper)}${unit}`;
  if (r.upper !== null) return `≤ ${fmt(r.upper)}${unit}`;
  if (r.lower !== null) return `≥ ${fmt(r.lower)}${unit}`;
  return '';
}

/** Low / high / normal and critical for one numeric value in `unit`. */
export function classifyValue(range: ReferenceRange | null, value: number | null, unit: string | null | undefined): RangeClassification {
  if (!range || value === null || !Number.isFinite(value) || !unitMatchesRange(range, unit)) {
    return { flag: 'unknown', critical: null, range: null, rangeText: '' };
  }
  let flag: RangeFlag = 'unknown';
  if (range.lower !== null || range.upper !== null) {
    flag = range.lower !== null && value < range.lower ? 'low'
      : range.upper !== null && value > range.upper ? 'high' : 'normal';
  }
  const critical: CriticalFlag = range.criticalLow !== null && value < range.criticalLow ? 'low'
    : range.criticalHigh !== null && value > range.criticalHigh ? 'high' : null;
  if (critical !== null && flag !== 'low' && flag !== 'high') flag = critical;
  return { flag, critical, range, rangeText: rangeText(range) };
}

/** Classify a catalogue analyte's value for a patient (practice range, else default). */
export function classifyAnalyte(
  practice: ReadonlyArray<ReferenceRange> | null | undefined,
  analyte: string,
  value: number | null,
  unit: string | null | undefined,
  ctx: RangeContext = {},
): RangeClassification {
  return classifyValue(resolveReferenceRange(practice, analyte, ctx), value, unit);
}

/**
 * Critical by the practice / default critical limits, for a value already in the catalogue app
 * unit (report import, lab feed). Unit-free: the caller guarantees the app unit.
 */
export function isCriticalInAppUnit(
  practice: ReadonlyArray<ReferenceRange> | null | undefined,
  analyteKey: string | null,
  value: number,
  ctx: RangeContext = {},
): boolean {
  if (analyteKey === null) return false;
  const an = analyteForKey(analyteKey);
  if (!an) return false;
  const r = resolveReferenceRange(practice, an.name, ctx);
  if (!r) return false;
  return (r.criticalLow !== null && value < r.criticalLow) || (r.criticalHigh !== null && value > r.criticalHigh);
}

/** Age in whole years on a date (YYYY-MM-DD strings); null when either is missing or invalid. */
export function ageInYears(dateOfBirth: string | null | undefined, onDate: string | null | undefined): number | null {
  if (!dateOfBirth || !onDate) return null;
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth);
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(onDate);
  if (!b || !d) return null;
  let age = Number(d[1]) - Number(b[1]);
  if (Number(d[2]) < Number(b[2]) || (Number(d[2]) === Number(b[2]) && Number(d[3]) < Number(b[3]))) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}

// ── Decision layer (lib/pane-engine/src/decision) ───────────────────────────────────────────

export type DecisionUlnKey = 'lipase' | 'amylase' | 'troponin';

/**
 * ULNs for the decision layer's "× ULN" thresholds, from the PRACTICE ranges only. A default is
 * left out on purpose: the engine then uses its content default and says "assumed — use the
 * local reference range", which stays true until the practice enters its laboratory's range.
 * `troponinKey` is the catalogue analyte the troponin value came from.
 */
export function decisionUlnFromRanges(
  practice: ReadonlyArray<ReferenceRange> | null | undefined,
  ctx: RangeContext = {},
  troponinKey: 'troponin' | 'troponinT' | 'troponinI' = 'troponin',
): Partial<Record<DecisionUlnKey, number>> {
  const out: Partial<Record<DecisionUlnKey, number>> = {};
  const set = (k: DecisionUlnKey, analyteKey: string) => {
    const an = analyteForKey(analyteKey);
    if (!an) return;
    const u = upperLimitOfNormal(practice, an.name, ctx);
    if (u && u.fromPractice) out[k] = u.value;
  };
  set('lipase', 'lipase');
  set('amylase', 'amylase');
  set('troponin', troponinKey);
  return out;
}
