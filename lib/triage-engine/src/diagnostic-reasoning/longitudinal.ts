/**
 * Longitudinal pattern view — read-only, across the patient's visits and results.
 * iOS twin: ios/AmiseMedFlow/Services/LongitudinalPatterns.swift. Test vectors:
 * DiagnosticReasoningVectors.json ("longitudinal").
 *
 *  - Recurring presentations: three or more visits for the same problem (visits are grouped when
 *    their complaint shares a meaningful word, visit-continuity.ts meaningfulWords).
 *  - Trends: creatinine rising (≥ 26.5 µmol/L or ≥ 1.5 × the lowest earlier value, KDIGO 2012),
 *    haemoglobin falling (≥ 20 g/L below the highest earlier value), weight loss (≥ 5 % of the
 *    highest weight in the 6 months before the latest, NICE NG12 / MUST).
 *  - Diagnoses that did not hold: an earlier diagnosis for the same problem that a later visit
 *    replaced with a different one.
 * Dates are compared by their first 10 characters (YYYY-MM-DD).
 */

import { meaningfulWords } from '../visit-continuity';

export interface LongitudinalVisit {
  /** YYYY-MM-DD (a longer ISO string is cut to its date). */
  date: string;
  complaint: string | null;
  diagnosis: string | null;
}

export interface MeasurementPoint {
  date: string;
  value: number;
}

export interface LongitudinalInput {
  visits: LongitudinalVisit[];
  /** µmol/L (values below 20 are read as mg/dL). */
  creatinine: MeasurementPoint[];
  /** g/L or g/dL (values up to 25 are read as g/dL). */
  haemoglobin: MeasurementPoint[];
  /** kg. */
  weight: MeasurementPoint[];
}

export interface RecurringPresentation {
  problem: string;
  count: number;
  dates: string[];
}

export interface Trend {
  analyte: 'creatinine' | 'haemoglobin' | 'weight';
  from: number;
  to: number;
  fromDate: string;
  toDate: string;
  text: string;
}

export interface UnheldDiagnosis {
  diagnosis: string;
  date: string;
  replacedBy: string;
  replacedOn: string;
}

export interface LongitudinalPatterns {
  recurring: RecurringPresentation[];
  trends: Trend[];
  unheld: UnheldDiagnosis[];
}

export const LONGITUDINAL_THRESHOLDS = {
  recurringVisits: 3,
  creatinineRiseUmol: 26.5,
  creatinineRatio: 1.5,
  haemoglobinDropGL: 20,
  weightLossFraction: 0.05,
  weightWindowDays: 183,
} as const;

function day(date: string): string {
  return date.slice(0, 10);
}

/** Days since 1970-01-01 for a YYYY-MM-DD date. */
export function dayNumber(date: string): number {
  const [y, m, d] = day(date).split('-').map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000);
}

/** One decimal, or none when it is a whole number ("72", "71.5"). */
export function fmtNum(x: number): string {
  const r = Math.round(x * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function sorted(points: MeasurementPoint[]): MeasurementPoint[] {
  return points.map((p, i) => ({ p, i }))
    .sort((a, b) => (day(a.p.date) < day(b.p.date) ? -1 : day(a.p.date) > day(b.p.date) ? 1 : a.i - b.i))
    .map(x => x.p);
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  for (const w of a) if (b.has(w)) return true;
  return false;
}

function clusters(visits: LongitudinalVisit[]): LongitudinalVisit[][] {
  const ordered = visits.map((v, i) => ({ v, i }))
    .sort((a, b) => (day(a.v.date) < day(b.v.date) ? -1 : day(a.v.date) > day(b.v.date) ? 1 : a.i - b.i))
    .map(x => x.v);
  const groups: { words: Set<string>; visits: LongitudinalVisit[] }[] = [];
  for (const v of ordered) {
    const text = (v.complaint ?? '').trim() || (v.diagnosis ?? '').trim();
    const words = meaningfulWords(text);
    if (words.size === 0) continue;
    const g = groups.find(x => overlaps(x.words, words));
    if (g) { g.visits.push(v); for (const w of words) g.words.add(w); }
    else groups.push({ words: new Set(words), visits: [v] });
  }
  return groups.map(g => g.visits);
}

export function longitudinalPatterns(input: LongitudinalInput): LongitudinalPatterns {
  const L = LONGITUDINAL_THRESHOLDS;
  const recurring: RecurringPresentation[] = [];
  const unheld: UnheldDiagnosis[] = [];
  for (const group of clusters(input.visits)) {
    if (group.length >= L.recurringVisits) {
      const first = group[0];
      recurring.push({
        problem: (first.complaint ?? '').trim() || (first.diagnosis ?? '').trim(),
        count: group.length,
        dates: group.map(v => day(v.date)),
      });
    }
    let prev: { dx: string; date: string } | null = null;
    for (const v of group) {
      const dx = (v.diagnosis ?? '').trim();
      if (!dx) continue;
      if (prev && !overlaps(meaningfulWords(prev.dx), meaningfulWords(dx))) {
        unheld.push({ diagnosis: prev.dx, date: prev.date, replacedBy: dx, replacedOn: day(v.date) });
      }
      prev = { dx, date: day(v.date) };
    }
  }

  const trends: Trend[] = [];
  const cr = sorted(input.creatinine).map(p => ({ date: day(p.date), value: p.value < 20 ? p.value * 88.4 : p.value }));
  if (cr.length >= 2) {
    const last = cr[cr.length - 1];
    const base = cr.slice(0, -1).reduce((m, p) => (p.value < m.value ? p : m));
    if (last.value > base.value && (last.value - base.value >= L.creatinineRiseUmol || last.value >= L.creatinineRatio * base.value)) {
      trends.push({
        analyte: 'creatinine', from: base.value, to: last.value, fromDate: base.date, toDate: last.date,
        text: `Creatinine rising: ${Math.round(base.value)} → ${Math.round(last.value)} µmol/L (${base.date} → ${last.date}).`,
      });
    }
  }
  const hb = sorted(input.haemoglobin).map(p => ({ date: day(p.date), value: p.value > 25 ? p.value : p.value * 10 }));
  if (hb.length >= 2) {
    const last = hb[hb.length - 1];
    const base = hb.slice(0, -1).reduce((m, p) => (p.value > m.value ? p : m));
    if (base.value - last.value >= L.haemoglobinDropGL) {
      trends.push({
        analyte: 'haemoglobin', from: base.value, to: last.value, fromDate: base.date, toDate: last.date,
        text: `Haemoglobin falling: ${fmtNum(base.value / 10)} → ${fmtNum(last.value / 10)} g/dL (${base.date} → ${last.date}).`,
      });
    }
  }
  const wt = sorted(input.weight).map(p => ({ date: day(p.date), value: p.value }));
  if (wt.length >= 2) {
    const last = wt[wt.length - 1];
    const window = wt.slice(0, -1).filter(p => dayNumber(last.date) - dayNumber(p.date) <= L.weightWindowDays);
    if (window.length) {
      const base = window.reduce((m, p) => (p.value > m.value ? p : m));
      const loss = base.value > 0 ? (base.value - last.value) / base.value : 0;
      if (loss >= L.weightLossFraction) {
        const days = dayNumber(last.date) - dayNumber(base.date);
        trends.push({
          analyte: 'weight', from: base.value, to: last.value, fromDate: base.date, toDate: last.date,
          text: `Weight loss ${Math.round(loss * 100)}%: ${fmtNum(base.value)} → ${fmtNum(last.value)} kg over ${days} days.`,
        });
      }
    }
  }
  return { recurring, trends, unheld };
}
