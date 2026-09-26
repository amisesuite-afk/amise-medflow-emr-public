/**
 * Calibration report: prediction snapshots joined to confirmed final diagnoses.
 *
 *   - top-1 / top-3 / top-5 accuracy per engine and model version (Wilson 95% CI);
 *   - reliability table: predicted probability by decile against the observed hit rate;
 *   - Brier score (multi-class over the listed candidates; a final diagnosis the engine did not
 *     list counts as probability 0) and the leader's binary Brier;
 *   - per-diagnosis sensitivity (top-1, top-3) and PPV (top-1);
 *   - triage over- / under-triage against the clinician's retrospective urgency;
 *   - decision-band agreement with what was actually done.
 *
 * Pure and deterministic ("now" is an argument). Reports; never changes an engine.
 */

import { icdCategory } from './codes';
import { round, wilson } from './stats';
import type { Interval } from './stats';
import type {
  CommonAcuity, DifferentialEntry, FinalDiagnosis, OutcomeCase, PredictionSnapshot, TriageScale,
} from './types';

// ── Matching ────────────────────────────────────────────────────────────────────────────────

/**
 * A predicted entry matches the final diagnosis when both carry a PANE disease id and the ids
 * are equal; otherwise when their ICD-10 categories (first three characters) are equal. Disease
 * ids are stricter (acute vs chronic cholecystitis share K81) and win when both exist.
 */
export function predictionMatches(pred: DifferentialEntry, outcome: FinalDiagnosis): boolean {
  if (pred.diseaseId && outcome.finalDiseaseId) return pred.diseaseId === outcome.finalDiseaseId;
  const a = icdCategory(pred.icd10);
  return !!a && a === icdCategory(outcome.finalIcd10);
}

/** Rank (1-based) of the first listed candidate that matches; null when none does. */
export function hitRank(snapshot: PredictionSnapshot, outcome: FinalDiagnosis): number | null {
  const sorted = [...snapshot.topDifferential].sort((a, b) => a.rank - b.rank);
  const i = sorted.findIndex(p => predictionMatches(p, outcome));
  return i < 0 ? null : i + 1;
}

/** Key a diagnosis is reported under: the PANE id when known, else the ICD-10 category. */
export function diagnosisKey(diseaseId: string | null, icd10: string | null): string {
  if (diseaseId) return diseaseId;
  const cat = icdCategory(icd10);
  return cat ? `icd:${cat}` : 'unknown';
}

export const engineKey = (s: PredictionSnapshot): string => `${s.differentialEngine}@${s.differentialModelVersion}`;

/** Snapshots joined to their confirmed final diagnosis (retracted outcomes are ignored). */
export function joinCases(snapshots: PredictionSnapshot[], outcomes: FinalDiagnosis[]): {
  cases: OutcomeCase[]; outcomesWithoutSnapshot: number;
} {
  const confirmed = new Map<string, FinalDiagnosis>();
  for (const o of outcomes) if (o.status === 'confirmed') confirmed.set(o.encounterRef, o);
  const refs = new Set(snapshots.map(s => s.encounterRef));
  const cases: OutcomeCase[] = [];
  for (const s of snapshots) {
    const o = confirmed.get(s.encounterRef);
    if (o) cases.push({ snapshot: s, outcome: o });
  }
  let orphans = 0;
  for (const ref of confirmed.keys()) if (!refs.has(ref)) orphans++;
  return { cases, outcomesWithoutSnapshot: orphans };
}

/**
 * Closed encounters that still need a final diagnosis: an operation or pathology was expected,
 * completion was at least `dueDays` days before `now`, and no confirmed final diagnosis exists.
 */
export function pendingOutcomes(
  snapshots: PredictionSnapshot[], outcomes: FinalDiagnosis[], now: Date, dueDays: number,
): PredictionSnapshot[] {
  const done = new Set(outcomes.filter(o => o.status === 'confirmed').map(o => o.encounterRef));
  const cutoff = now.getTime() - dueDays * 86_400_000;
  return snapshots
    .filter(s => s.expectsOutcome && !done.has(s.encounterRef) && Date.parse(s.completedAt) <= cutoff)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

// ── Report types ────────────────────────────────────────────────────────────────────────────

export interface Proportion { k: number; n: number; rate: number | null; ci: Interval }

function prop(k: number, n: number): Proportion {
  const ci = wilson(k, n);
  return { k, n, rate: n ? round(k / n) : null, ci: { low: round(ci.low), high: round(ci.high) } };
}

export interface AccuracyRow {
  engine: string;
  n: number;
  top1: Proportion;
  top3: Proportion;
  top5: Proportion;
  /** Mean multi-class Brier score over the listed candidates (0 best, 2 worst). */
  brier: number | null;
  /** Mean binary Brier score of the leading candidate. */
  top1Brier: number | null;
  /** Leader probability ≥ 0.9 while the leader was wrong. */
  overconfidentLeaders: number;
}

export interface CalibrationBin {
  bin: number;
  range: [number, number];
  n: number;
  meanPredicted: number | null;
  observed: Proportion;
}

export interface DiagnosisRow {
  key: string;
  icd10: string | null;
  cases: number;
  sensitivityTop1: Proportion;
  sensitivityTop3: Proportion;
  /** Of the cases the engine ranked this diagnosis first, the share that had it. */
  ppvTop1: Proportion;
}

export interface TriageRow {
  scale: TriageScale;
  n: number;
  agree: Proportion;
  over: Proportion;
  under: Proportion;
  /** predicted common level → reference common level → count. */
  matrix: Record<CommonAcuity, Record<CommonAcuity, number>>;
}

export interface BandRow {
  decisionId: string;
  optionId: string;
  band: string;
  graded: number;
  agree: number;
  disagree: number;
  notGraded: number;
}

export interface CalibrationReport {
  generatedAt: string;
  snapshots: number;
  outcomes: number;
  cases: number;
  outcomesWithoutSnapshot: number;
  pendingOutcomes: number;
  accuracy: AccuracyRow[];
  reliability: { engine: string; bins: CalibrationBin[] }[];
  perDiagnosis: { engine: string; rows: DiagnosisRow[] }[];
  triage: TriageRow[];
  bands: { overall: Proportion; rows: BandRow[] };
  notes: string[];
}

// ── Triage scales ───────────────────────────────────────────────────────────────────────────

const COMMON_ORDER: CommonAcuity[] = ['routine', 'soon', 'urgent', 'emergency'];

/**
 * Each platform's triage level on the common scale (needs sign-off, SURGEON-DECISIONS I2):
 * web urgent (emergency now) → emergency, priority (same-day call) → urgent, review (24–48 h)
 * → soon; iOS emergency / urgent / priority → emergency / urgent / soon.
 */
export function toCommonAcuity(level: string | null, scale: TriageScale | null): CommonAcuity | null {
  if (!level || !scale) return null;
  if (scale === 'web-adaptive') {
    return ({ urgent: 'emergency', priority: 'urgent', review: 'soon', routine: 'routine' } as Record<string, CommonAcuity>)[level] ?? null;
  }
  return ({ emergency: 'emergency', urgent: 'urgent', priority: 'soon', routine: 'routine' } as Record<string, CommonAcuity>)[level] ?? null;
}

function emptyMatrix(): Record<CommonAcuity, Record<CommonAcuity, number>> {
  const row = () => ({ routine: 0, soon: 0, urgent: 0, emergency: 0 });
  return { routine: row(), soon: row(), urgent: row(), emergency: row() };
}

// ── Metrics ─────────────────────────────────────────────────────────────────────────────────

/** Multi-class Brier of one case: listed candidates, plus 1 when the final diagnosis is unlisted. */
export function caseBrier(snapshot: PredictionSnapshot, outcome: FinalDiagnosis): number | null {
  const listed = snapshot.topDifferential.filter(p => p.probability !== null);
  if (listed.length === 0) return null;
  let sum = 0;
  let hit = false;
  for (const p of listed) {
    const y = !hit && predictionMatches(p, outcome) ? 1 : 0;
    if (y) hit = true;
    sum += ((p.probability as number) - y) ** 2;
  }
  return hit ? sum : sum + 1;
}

function accuracy(engine: string, cases: OutcomeCase[]): AccuracyRow {
  let t1 = 0; let t3 = 0; let t5 = 0; let over = 0;
  const briers: number[] = [];
  const leaderBriers: number[] = [];
  for (const { snapshot, outcome } of cases) {
    const r = hitRank(snapshot, outcome);
    if (r === 1) t1++;
    if (r !== null && r <= 3) t3++;
    if (r !== null && r <= 5) t5++;
    const b = caseBrier(snapshot, outcome);
    if (b !== null) briers.push(b);
    const leader = [...snapshot.topDifferential].sort((a, c) => a.rank - c.rank)[0];
    if (leader && leader.probability !== null) {
      const y = r === 1 ? 1 : 0;
      leaderBriers.push((leader.probability - y) ** 2);
      if (leader.probability >= 0.9 && y === 0) over++;
    }
  }
  const mean = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const n = cases.length;
  return {
    engine, n, top1: prop(t1, n), top3: prop(t3, n), top5: prop(t5, n),
    brier: mean(briers), top1Brier: mean(leaderBriers), overconfidentLeaders: over,
  };
}

function reliability(cases: OutcomeCase[]): CalibrationBin[] {
  const bins = Array.from({ length: 10 }, (_, i) => ({ i, sumP: 0, n: 0, hits: 0 }));
  for (const { snapshot, outcome } of cases) {
    let hit = false;
    for (const p of [...snapshot.topDifferential].sort((a, b) => a.rank - b.rank)) {
      if (p.probability === null) continue;
      const y = !hit && predictionMatches(p, outcome);
      if (y) hit = true;
      const b = bins[Math.min(9, Math.floor(p.probability * 10))];
      b.n++; b.sumP += p.probability; if (y) b.hits++;
    }
  }
  return bins.map(b => ({
    bin: b.i,
    range: [b.i / 10, (b.i + 1) / 10] as [number, number],
    n: b.n,
    meanPredicted: b.n ? round(b.sumP / b.n) : null,
    observed: prop(b.hits, b.n),
  }));
}

function perDiagnosis(cases: OutcomeCase[]): DiagnosisRow[] {
  const acc = new Map<string, { icd: string | null; cases: number; t1: number; t3: number; predicted1: number; tp1: number }>();
  const get = (key: string, icd: string | null) => {
    let e = acc.get(key);
    if (!e) { e = { icd, cases: 0, t1: 0, t3: 0, predicted1: 0, tp1: 0 }; acc.set(key, e); }
    return e;
  };
  for (const { snapshot, outcome } of cases) {
    const finalKey = diagnosisKey(outcome.finalDiseaseId, outcome.finalIcd10);
    const e = get(finalKey, icdCategory(outcome.finalIcd10));
    e.cases++;
    const r = hitRank(snapshot, outcome);
    if (r === 1) e.t1++;
    if (r !== null && r <= 3) e.t3++;
    const leader = [...snapshot.topDifferential].sort((a, b) => a.rank - b.rank)[0];
    if (leader) {
      // A leader that matches the final diagnosis is counted under the final diagnosis's key, so
      // the ICD-only and the id-bearing descriptions of one diagnosis are not split in two.
      const leaderKey = r === 1 ? finalKey : diagnosisKey(leader.diseaseId, leader.icd10);
      const le = get(leaderKey, icdCategory(leader.icd10));
      le.predicted1++;
      if (r === 1) le.tp1++;
    }
  }
  return [...acc.entries()]
    .map(([key, e]) => ({
      key, icd10: e.icd, cases: e.cases,
      sensitivityTop1: prop(e.t1, e.cases), sensitivityTop3: prop(e.t3, e.cases), ppvTop1: prop(e.tp1, e.predicted1),
    }))
    .sort((a, b) => b.cases - a.cases || b.ppvTop1.n - a.ppvTop1.n || a.key.localeCompare(b.key));
}

function triage(cases: OutcomeCase[]): TriageRow[] {
  const byScale = new Map<TriageScale, { n: number; agree: number; over: number; under: number; matrix: ReturnType<typeof emptyMatrix> }>();
  for (const { snapshot, outcome } of cases) {
    const predicted = toCommonAcuity(snapshot.triageLevel, snapshot.triageScale);
    const reference = outcome.retrospectiveAcuity;
    if (!predicted || !reference || !snapshot.triageScale) continue;
    let e = byScale.get(snapshot.triageScale);
    if (!e) { e = { n: 0, agree: 0, over: 0, under: 0, matrix: emptyMatrix() }; byScale.set(snapshot.triageScale, e); }
    e.n++;
    e.matrix[predicted][reference]++;
    const d = COMMON_ORDER.indexOf(predicted) - COMMON_ORDER.indexOf(reference);
    if (d === 0) e.agree++; else if (d > 0) e.over++; else e.under++;
  }
  return [...byScale.entries()].map(([scale, e]) => ({
    scale, n: e.n, agree: prop(e.agree, e.n), over: prop(e.over, e.n), under: prop(e.under, e.n), matrix: e.matrix,
  }));
}

/**
 * Agreement of each decision option's band with what was done: treat + done and observe / not
 * for this patient + not done agree; the reverse disagree. "test" and "unknown" bands are not
 * graded (a test band is about the next investigation, not the treatment).
 */
function bands(cases: OutcomeCase[]): CalibrationReport['bands'] {
  const rows = new Map<string, BandRow>();
  let graded = 0; let agree = 0;
  for (const { snapshot, outcome } of cases) {
    const done = new Map(outcome.actionsTaken.map(a => [a.optionId, a.done]));
    for (const b of snapshot.decisionBands) {
      if (!done.has(b.optionId)) continue;
      const key = `${b.decisionId}|${b.optionId}|${b.band}`;
      let row = rows.get(key);
      if (!row) { row = { decisionId: b.decisionId, optionId: b.optionId, band: b.band, graded: 0, agree: 0, disagree: 0, notGraded: 0 }; rows.set(key, row); }
      const wasDone = done.get(b.optionId) === true;
      if (b.band === 'treat' || b.band === 'observe' || b.band === 'not-for-patient') {
        const ok = b.band === 'treat' ? wasDone : !wasDone;
        row.graded++; graded++;
        if (ok) { row.agree++; agree++; } else row.disagree++;
      } else {
        row.notGraded++;
      }
    }
  }
  return {
    overall: prop(agree, graded),
    rows: [...rows.values()].sort((a, b) => b.graded - a.graded || a.decisionId.localeCompare(b.decisionId) || a.optionId.localeCompare(b.optionId)),
  };
}

export interface CalibrationOptions {
  now: Date;
  /** Days after completion before a missing final diagnosis is listed (default 14). */
  dueDays?: number;
}

export const DEFAULT_OUTCOME_DUE_DAYS = 14;

export function computeCalibrationReport(
  snapshots: PredictionSnapshot[], outcomes: FinalDiagnosis[], opts: CalibrationOptions,
): CalibrationReport {
  const { cases, outcomesWithoutSnapshot } = joinCases(snapshots, outcomes);
  const byEngine = new Map<string, OutcomeCase[]>();
  for (const c of cases) {
    const k = engineKey(c.snapshot);
    const list = byEngine.get(k) ?? [];
    list.push(c);
    byEngine.set(k, list);
  }
  const engines = [...byEngine.keys()].sort();
  const notes = [
    'Only encounters with a clinician-confirmed final diagnosis are counted. Confirmed diagnoses over-represent operated and biopsied cases (verification bias), so accuracy here is not the accuracy for every presentation.',
    'Probabilities are the engines\' own estimates at completion; iOS display percentages are divided by 100.',
    'A prediction matches when the PANE disease ids are equal, or, without ids, when the ICD-10 categories (first three characters) are equal.',
  ];
  if (cases.length < 30) notes.push(`Only ${cases.length} matched case${cases.length === 1 ? '' : 's'}: every figure has a wide interval.`);
  return {
    generatedAt: opts.now.toISOString(),
    snapshots: snapshots.length,
    outcomes: outcomes.filter(o => o.status === 'confirmed').length,
    cases: cases.length,
    outcomesWithoutSnapshot,
    pendingOutcomes: pendingOutcomes(snapshots, outcomes, opts.now, opts.dueDays ?? DEFAULT_OUTCOME_DUE_DAYS).length,
    accuracy: engines.map(e => accuracy(e, byEngine.get(e)!)),
    reliability: engines.map(e => ({ engine: e, bins: reliability(byEngine.get(e)!) })),
    perDiagnosis: engines.map(e => ({ engine: e, rows: perDiagnosis(byEngine.get(e)!) })),
    triage: triage(cases),
    bands: bands(cases),
    notes,
  };
}

// ── Markdown ────────────────────────────────────────────────────────────────────────────────

const pct = (p: Proportion) => (p.rate === null ? '—' : `${(p.rate * 100).toFixed(1)}% (${(p.ci.low * 100).toFixed(0)}–${(p.ci.high * 100).toFixed(0)}%, ${p.k}/${p.n})`);

export function calibrationReportMarkdown(r: CalibrationReport): string {
  const out: string[] = [];
  out.push('# Engine calibration report', '');
  out.push(`Generated ${r.generatedAt}. ${r.snapshots} snapshots, ${r.outcomes} confirmed final diagnoses, ${r.cases} matched cases; ${r.pendingOutcomes} final diagnoses overdue; ${r.outcomesWithoutSnapshot} final diagnoses without a snapshot.`, '');
  out.push('**Report only. Nothing here changes an engine.**', '');
  for (const n of r.notes) out.push(`- ${n}`);
  out.push('', '## Accuracy by engine and model version', '');
  out.push('| Engine | n | Top-1 | Top-3 | Top-5 | Brier | Leader Brier | Overconfident leaders |', '|---|---|---|---|---|---|---|---|');
  for (const a of r.accuracy) {
    out.push(`| ${a.engine} | ${a.n} | ${pct(a.top1)} | ${pct(a.top3)} | ${pct(a.top5)} | ${a.brier ?? '—'} | ${a.top1Brier ?? '—'} | ${a.overconfidentLeaders} |`);
  }
  for (const rel of r.reliability) {
    out.push('', `## Calibration (reliability) — ${rel.engine}`, '', '| Predicted | n | Mean predicted | Observed |', '|---|---|---|---|');
    for (const b of rel.bins) {
      out.push(`| ${(b.range[0] * 100).toFixed(0)}–${(b.range[1] * 100).toFixed(0)}% | ${b.n} | ${b.meanPredicted === null ? '—' : (b.meanPredicted * 100).toFixed(1) + '%'} | ${pct(b.observed)} |`);
    }
  }
  for (const pd of r.perDiagnosis) {
    out.push('', `## Per diagnosis — ${pd.engine}`, '', '| Final diagnosis | Cases | Sensitivity (top-1) | Sensitivity (top-3) | PPV (top-1) |', '|---|---|---|---|---|');
    for (const d of pd.rows) out.push(`| ${d.key} | ${d.cases} | ${pct(d.sensitivityTop1)} | ${pct(d.sensitivityTop3)} | ${pct(d.ppvTop1)} |`);
  }
  out.push('', '## Triage against the retrospective urgency', '');
  if (r.triage.length === 0) out.push('No case has both a triage level and a retrospective urgency.');
  for (const t of r.triage) {
    out.push(`- ${t.scale}: n = ${t.n}; agree ${pct(t.agree)}; over-triage ${pct(t.over)}; **under-triage ${pct(t.under)}**`);
  }
  out.push('', '## Decision bands against what was done', '', `Overall agreement: ${pct(r.bands.overall)}`, '');
  if (r.bands.rows.length) {
    out.push('| Decision | Option | Band | Graded | Agree | Disagree | Not graded |', '|---|---|---|---|---|---|---|');
    for (const b of r.bands.rows) out.push(`| ${b.decisionId} | ${b.optionId} | ${b.band} | ${b.graded} | ${b.agree} | ${b.disagree} | ${b.notGraded} |`);
  }
  return out.join('\n') + '\n';
}
