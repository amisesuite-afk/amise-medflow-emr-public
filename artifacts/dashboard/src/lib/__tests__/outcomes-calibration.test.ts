/**
 * Outcomes loop — calibration maths, shrinkage proposals, coded-data sanitising and the
 * de-identified export (@workspace/triage-engine/outcomes). Fixed fixtures with hand-computed
 * Brier scores and accuracies.
 */
import { describe, expect, it } from 'vitest';
import {
  betaCdf, betaInterval, betaQuantile, buildResearchExport, calibrationReportMarkdown, caseBrier,
  computeCalibrationReport, hitRank, normaliseIcd10, pendingOutcomes, proposalsMarkdown, proposeAdjustments,
  researchExportToCases, sanitizeFinalDiagnosis, sanitizeSnapshot, toCommonAcuity, wilson,
} from '@workspace/triage-engine/outcomes';
import type {
  DifferentialEntry, FinalDiagnosis, OutcomeCase, PredictionSnapshot, ShrinkageModel,
} from '@workspace/triage-engine/outcomes';

const NOW = new Date('2026-09-26T12:00:00.000Z');

function snap(ref: string, top: Array<[string | null, string | null, number | null]>, extra: Partial<PredictionSnapshot> = {}): PredictionSnapshot {
  const topDifferential: DifferentialEntry[] = top.map(([diseaseId, icd10, probability], i) => ({ rank: i + 1, diseaseId, icd10, probability }));
  return {
    snapshotVersion: 1, platform: 'web', encounterRef: ref, completedAt: '2026-08-01T15:00:00.000Z',
    differentialEngine: 'pane', differentialModelVersion: '1.0.1', modelVersions: { pane: '1.0.1' },
    topDifferential, triageLevel: null, triageScale: null, scores: [], decisionBands: [], features: {},
    workingDiseaseId: null, workingIcd10: null, recordedIcd10: [], expectsOutcome: true, outcomeTriggers: ['operation'],
    ...extra,
  };
}

function outcome(ref: string, icd: string, id: string | null, extra: Partial<FinalDiagnosis> = {}): FinalDiagnosis {
  return {
    encounterRef: ref, finalIcd10: icd, finalDiseaseId: id, sourceType: 'histology', sourceDate: '2026-08-10',
    actionsTaken: [], retrospectiveAcuity: null, status: 'confirmed', ...extra,
  };
}

// Four matched cases, hand-computed:
//   A leader right            Brier (0.7−1)² + 0.2² = 0.13            leader 0.09
//   B right at rank 2          0.6² + (0.3−1)² = 0.85                  leader 0.36
//   C unlisted (K80 vs K81)    0.95² + 0.04² + 1 = 1.9041              leader 0.9025 (overconfident)
//   D rank 2 by ICD category   0.5² + (0.3−1)² + 0.2² = 0.78           leader 0.25
// Mean Brier 3.6641 / 4 = 0.916025; leader Brier 1.6025 / 4 = 0.400625.
const A = snap('web:aaaaaaaa-0000-4000-8000-000000000001', [['acute_appendicitis', 'K35.80', 0.7], ['acute_cholecystitis', 'K81.0', 0.2]], {
  triageLevel: 'urgent', triageScale: 'web-adaptive',
  decisionBands: [{ decisionId: 'appendicitis', optionId: 'appendicectomy', kind: 'operation', band: 'treat', probability: 0.7 }],
});
const B = snap('web:aaaaaaaa-0000-4000-8000-000000000002', [['acute_appendicitis', 'K35.80', 0.6], ['diverticulitis', 'K57.32', 0.3]], {
  triageLevel: 'routine', triageScale: 'web-adaptive',
  decisionBands: [{ decisionId: 'appendicitis', optionId: 'appendicectomy', kind: 'operation', band: 'observe', probability: 0.6 }],
});
const C = snap('web:aaaaaaaa-0000-4000-8000-000000000003', [['acute_cholecystitis', 'K81.0', 0.95], ['acute_pancreatitis', 'K85.9', 0.04]], {
  triageLevel: 'priority', triageScale: 'web-adaptive',
  decisionBands: [{ decisionId: 'cholecystitis', optionId: 'cholecystectomy', kind: 'operation', band: 'treat', probability: 0.95 }],
});
const D = snap('web:aaaaaaaa-0000-4000-8000-000000000004', [['gord', 'K21.9', 0.5], ['peptic_ulcer', 'K25.9', 0.3], ['gastritis', 'K29.7', 0.2]], {
  decisionBands: [{ decisionId: 'pud', optionId: 'ogd', kind: 'endoscopy', band: 'test', probability: 0.3 }],
});
const OUTCOMES: FinalDiagnosis[] = [
  outcome(A.encounterRef, 'K35.80', 'acute_appendicitis', { retrospectiveAcuity: 'emergency', actionsTaken: [{ optionId: 'appendicectomy', done: true }] }),
  outcome(B.encounterRef, 'K57.32', 'diverticulitis', { retrospectiveAcuity: 'urgent', actionsTaken: [{ optionId: 'appendicectomy', done: false }] }),
  outcome(C.encounterRef, 'K80.20', null, { retrospectiveAcuity: 'soon', actionsTaken: [{ optionId: 'cholecystectomy', done: false }] }),
  outcome(D.encounterRef, 'K25.3', null, { actionsTaken: [{ optionId: 'ogd', done: true }] }),
];

describe('calibration report (fixed fixture)', () => {
  const report = computeCalibrationReport([A, B, C, D], OUTCOMES, { now: NOW });

  it('hit ranks: id match, ICD-category match, no match', () => {
    expect(hitRank(A, OUTCOMES[0])).toBe(1);
    expect(hitRank(B, OUTCOMES[1])).toBe(2);
    expect(hitRank(C, OUTCOMES[2])).toBeNull();
    expect(hitRank(D, OUTCOMES[3])).toBe(2);
  });

  it('per-case Brier scores', () => {
    expect(caseBrier(A, OUTCOMES[0])).toBeCloseTo(0.13, 10);
    expect(caseBrier(B, OUTCOMES[1])).toBeCloseTo(0.85, 10);
    expect(caseBrier(C, OUTCOMES[2])).toBeCloseTo(1.9041, 10);
    expect(caseBrier(D, OUTCOMES[3])).toBeCloseTo(0.78, 10);
  });

  it('top-k accuracy, Brier and overconfidence per engine and version', () => {
    expect(report.cases).toBe(4);
    const a = report.accuracy[0];
    expect(a.engine).toBe('pane@1.0.1');
    expect([a.top1.k, a.top3.k, a.top5.k, a.n]).toEqual([1, 3, 3, 4]);
    expect(a.top1.rate).toBe(0.25);
    expect(a.top3.rate).toBe(0.75);
    expect(a.brier).toBeCloseTo(0.916, 4);
    expect(a.top1Brier).toBeCloseTo(0.4006, 4);
    expect(a.overconfidentLeaders).toBe(1);
    expect(a.top1.ci.low).toBeLessThan(0.25);
    expect(a.top1.ci.high).toBeGreaterThan(0.25);
  });

  it('reliability bins by decile', () => {
    const bins = report.reliability[0].bins;
    expect(bins).toHaveLength(10);
    expect(bins[3]).toMatchObject({ n: 2, observed: { k: 2, n: 2, rate: 1 } });
    expect(bins[2]).toMatchObject({ n: 2, observed: { k: 0, n: 2 } });
    expect(bins[9]).toMatchObject({ n: 1, meanPredicted: 0.95, observed: { k: 0 } });
    expect(bins[7]).toMatchObject({ n: 1, observed: { k: 1 } });
  });

  it('per-diagnosis sensitivity and PPV', () => {
    const rows = report.perDiagnosis[0].rows;
    const app = rows.find(r => r.key === 'acute_appendicitis')!;
    expect(app.cases).toBe(1);
    expect(app.sensitivityTop1).toMatchObject({ k: 1, n: 1 });
    expect(app.ppvTop1).toMatchObject({ k: 1, n: 2, rate: 0.5 });
    const div = rows.find(r => r.key === 'diverticulitis')!;
    expect(div.sensitivityTop1.k).toBe(0);
    expect(div.sensitivityTop3.k).toBe(1);
    expect(rows.find(r => r.key === 'icd:K80')!.sensitivityTop3.k).toBe(0);
  });

  it('triage over / under against the retrospective urgency (common scale)', () => {
    expect(toCommonAcuity('urgent', 'web-adaptive')).toBe('emergency');
    expect(toCommonAcuity('priority', 'ios-acuity')).toBe('soon');
    const t = report.triage[0];
    expect(t.scale).toBe('web-adaptive');
    expect([t.n, t.agree.k, t.over.k, t.under.k]).toEqual([3, 1, 1, 1]);
    expect(t.matrix.routine.urgent).toBe(1);
  });

  it('decision-band agreement: treat+done and observe+not done agree; test is not graded', () => {
    expect(report.bands.overall).toMatchObject({ k: 2, n: 3 });
    const ogd = report.bands.rows.find(r => r.optionId === 'ogd')!;
    expect(ogd).toMatchObject({ graded: 0, notGraded: 1 });
    const chole = report.bands.rows.find(r => r.optionId === 'cholecystectomy')!;
    expect(chole).toMatchObject({ graded: 1, disagree: 1 });
  });

  it('retracted outcomes are ignored and orphans are counted', () => {
    const r = computeCalibrationReport([A], [
      outcome(A.encounterRef, 'K35.80', 'acute_appendicitis', { status: 'retracted' }),
      outcome('web:ffffffff-0000-4000-8000-000000000009', 'K35.80', null),
    ], { now: NOW });
    expect(r.cases).toBe(0);
    expect(r.outcomesWithoutSnapshot).toBe(1);
    expect(calibrationReportMarkdown(r)).toContain('Only 0 matched cases');
  });

  it('markdown states that it is a report only', () => {
    const md = calibrationReportMarkdown(report);
    expect(md).toContain('Nothing here changes an engine');
    expect(md).toContain('| pane@1.0.1 | 4 |');
  });
});

describe('pending final diagnoses', () => {
  it('lists expected outcomes older than N days without a confirmed diagnosis', () => {
    const old = snap('web:bbbbbbbb-0000-4000-8000-000000000001', [], { completedAt: '2026-08-20T12:00:00.000Z' });
    const recent = snap('web:bbbbbbbb-0000-4000-8000-000000000002', [], { completedAt: '2026-09-22T12:00:00.000Z' });
    const noNeed = snap('web:bbbbbbbb-0000-4000-8000-000000000003', [], { completedAt: '2026-08-20T12:00:00.000Z', expectsOutcome: false, outcomeTriggers: [] });
    const done = snap('web:bbbbbbbb-0000-4000-8000-000000000004', [], { completedAt: '2026-08-20T12:00:00.000Z' });
    const retracted = snap('web:bbbbbbbb-0000-4000-8000-000000000005', [], { completedAt: '2026-08-21T12:00:00.000Z' });
    const pending = pendingOutcomes([old, recent, noNeed, done, retracted], [
      outcome(done.encounterRef, 'K35.80', null),
      outcome(retracted.encounterRef, 'K35.80', null, { status: 'retracted' }),
    ], NOW, 14);
    expect(pending.map(s => s.encounterRef)).toEqual([old.encounterRef, retracted.encounterRef]);
  });
});

describe('statistics', () => {
  it('Wilson interval', () => {
    const ci = wilson(5, 10);
    expect(ci.low).toBeCloseTo(0.2366, 4);
    expect(ci.high).toBeCloseTo(0.7634, 4);
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 });
  });

  it('Beta CDF and quantiles', () => {
    expect(betaCdf(0.3, 1, 3)).toBeCloseTo(1 - 0.7 ** 3, 10);
    expect(betaQuantile(0.975, 1, 1)).toBeCloseTo(0.975, 8);
    expect(betaQuantile(0.5, 2, 2)).toBeCloseTo(0.5, 8);
    expect(betaQuantile(1 - 0.7 ** 3, 1, 3)).toBeCloseTo(0.3, 8);
    const ci = betaInterval(38, 12);
    expect(ci.low).toBeGreaterThan(0.6);
    expect(ci.high).toBeLessThan(0.87);
  });
});

describe('proposed adjustments (empirical Bayes)', () => {
  const tiers = { common: 0.03, frequent: 0.015, uncommon: 0.007, rare: 0.003, veryRare: 0.001 };
  const priors: Record<string, number> = { common_d: 0.03, rare_d: 0.003 };
  for (let i = 0; i < 50; i++) priors[`other_${i}`] = 0.015;
  const likelihoods: Record<string, number> = { 'rare_d|f1': 0.5, 'rare_d|f2': 0.5 };
  const model: ShrinkageModel = {
    engine: 'pane', modelVersion: '1.0.1', priors, tiers,
    likelihood: (d, f) => likelihoods[`${d}|${f}`] ?? 0.05,
    baseRate: () => 0.05,
    diseaseForIcd: icd => (icd.startsWith('K99') ? 'rare_d' : null),
  };

  function cases(nRare: number, nOther: number, f1Present: number, f2Present: number): OutcomeCase[] {
    const out: OutcomeCase[] = [];
    for (let i = 0; i < nRare; i++) {
      const ref = `web:cccccccc-0000-4000-8000-${String(i).padStart(12, '0')}`;
      out.push({
        snapshot: snap(ref, [], { features: { f1: i < f1Present, f2: i < f2Present } }),
        // Half carry the disease id, half only the ICD code (mapped by diseaseForIcd).
        outcome: outcome(ref, 'K99.1', i % 2 ? 'rare_d' : null),
      });
    }
    for (let i = 0; i < nOther; i++) {
      const ref = `web:dddddddd-0000-4000-8000-${String(i).padStart(12, '0')}`;
      out.push({ snapshot: snap(ref, []), outcome: outcome(ref, 'K35.80', `other_${i % 50}`) });
    }
    return out;
  }

  it('proposes a prior tier change only with enough cases and a credible change', () => {
    const p = proposeAdjustments(cases(30, 30, 28, 16), model, { now: NOW });
    expect(p.status).toMatch(/not applied/);
    expect(p.casesUsed).toBe(60);
    const rare = p.priors.find(x => x.diseaseId === 'rare_d')!;
    expect(rare).toBeDefined();
    expect(rare.currentTier).toBe('rare');
    expect(rare.cases).toBe(30);
    expect(rare.shareInterval.low).toBeGreaterThan(rare.currentShare);
    expect(rare.proposedShare).toBeLessThan(rare.observedShare); // shrunk towards the current value
    expect(rare.proposedTier).not.toBe('rare');
    // other_* have 30 cases spread over 50 diseases: none reaches the minimum.
    expect(p.priors.some(x => x.diseaseId.startsWith('other_'))).toBe(false);

    const none = proposeAdjustments(cases(30, 30, 28, 16), model, { now: NOW, minCasesPrior: 31 });
    expect(none.priors).toHaveLength(0);
  });

  it('proposes a likelihood change only when the interval excludes the current value and the change is material', () => {
    const p = proposeAdjustments(cases(30, 0, 28, 16), model, { now: NOW });
    const f1 = p.likelihoods.find(x => x.featureId === 'f1')!;
    expect(f1).toMatchObject({ diseaseId: 'rare_d', present: 28, recorded: 30, current: 0.5 });
    expect(f1.proposed).toBeCloseTo(38 / 50, 4); // Beta(20·0.5 + 28, 20·0.5 + 2)
    expect(f1.interval.low).toBeGreaterThan(0.5);
    expect(f1.proposedLrVsBackground).toBeCloseTo(15.2, 1);
    expect(p.likelihoods.find(x => x.featureId === 'f2')).toBeUndefined();

    const few = proposeAdjustments(cases(19, 0, 19, 0), model, { now: NOW });
    expect(few.likelihoods).toHaveLength(0);
  });

  it('writes a reviewable diff with a sign-off table', () => {
    const md = proposalsMarkdown(proposeAdjustments(cases(30, 30, 28, 16), model, { now: NOW }));
    expect(md).toContain('PROPOSAL — not applied');
    expect(md).toMatch(/^- rare_d\.prior = 0\.003 \(rare\)/m);
    expect(md).toMatch(/^\+ rare_d\.prior = /m);
    expect(md).toMatch(/^\+ rare_d\.features\.f1 = 0\.76 \[95% CrI/m);
    expect(md).toContain('| rare_d.features.f1 | | | |');
  });
});

describe('coded data only', () => {
  it('normalises ICD-10 codes and drops their labels', () => {
    expect(normaliseIcd10('K35.80 — Acute appendicitis')).toBe('K35.80');
    expect(normaliseIcd10('k3580')).toBe('K35.80');
    expect(normaliseIcd10('Appendicitis')).toBeNull();
    expect(normaliseIcd10('K35')).toBe('K35');
  });

  it('sanitises a snapshot: free text, unknown keys and bad values are dropped', () => {
    const r = sanitizeSnapshot({
      platform: 'web', encounterRef: 'web:aaaaaaaa-0000-4000-8000-000000000001', completedAt: '2026-09-26T10:00:00Z',
      differentialEngine: 'pane', differentialModelVersion: '1.0.1',
      modelVersions: { pane: '1.0.1', note: 'patient said it hurts a lot' },
      topDifferential: [{ diseaseId: 'Acute appendicitis', icd10: 'K35.80 — Acute appendicitis', probability: 1.4 }, { diseaseId: 'x y', icd10: 'nope' }],
      triageLevel: 'urgent', triageScale: 'web-adaptive',
      scores: [{ key: 'alvarado', value: 8, source: 'calculator' }, { key: 'free text key!', value: 3 }],
      features: { rlq_pain: true, 'Mr Smith': true, fever: 'yes' },
      workingDiseaseId: 'acute_appendicitis', workingIcd10: 'K35.80 Acute appendicitis', recordedIcd10: ['K35.80 — Appendicitis', 'garbage'],
      outcomeTriggers: ['operation', 'operation', 'biopsy text'],
      patientName: 'Jane Doe',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = r.value;
    expect(JSON.stringify(s)).not.toMatch(/Jane|Smith|hurts|Acute appendicitis/);
    expect(s.topDifferential).toEqual([{ rank: 1, diseaseId: null, icd10: 'K35.80', probability: 1 }]);
    expect(s.modelVersions).toEqual({ pane: '1.0.1' });
    expect(s.scores).toEqual([{ key: 'alvarado', value: 8, source: 'calculator' }]);
    expect(s.features).toEqual({ rlq_pain: true });
    expect(s.workingIcd10).toBeNull(); // "K35.80 Acute appendicitis" is not a bare code
    expect(s.recordedIcd10).toEqual(['K35.80']);
    expect(s.outcomeTriggers).toEqual(['operation']);
    expect(s.expectsOutcome).toBe(true);
  });

  it('refuses a snapshot without a valid platform, reference or version', () => {
    expect(sanitizeSnapshot({ platform: 'android' }).ok).toBe(false);
    expect(sanitizeSnapshot({ platform: 'web', encounterRef: 'ios:abc', completedAt: '2026-09-26T10:00:00Z' }).ok).toBe(false);
    expect(sanitizeSnapshot({
      platform: 'web', encounterRef: 'web:abc', completedAt: '2026-09-26T10:00:00Z', differentialEngine: 'pane', differentialModelVersion: '',
    }).ok).toBe(false);
  });

  it('sanitises a final diagnosis', () => {
    expect(sanitizeFinalDiagnosis({ encounterRef: 'web:abc', finalIcd10: 'appendix', sourceType: 'histology', sourceDate: '2026-09-01' }).ok).toBe(false);
    expect(sanitizeFinalDiagnosis({ encounterRef: 'web:abc', finalIcd10: 'K35.2', sourceType: 'gut feeling', sourceDate: '2026-09-01' }).ok).toBe(false);
    expect(sanitizeFinalDiagnosis({ encounterRef: 'web:abc', finalIcd10: 'K35.2', sourceType: 'histology', sourceDate: '2026-02-30' }).ok).toBe(false);
    const ok = sanitizeFinalDiagnosis({
      encounterRef: 'web:abc', finalIcd10: 'k352', sourceType: 'operative_findings', sourceDate: '2026-09-01',
      actionsTaken: [{ optionId: 'appendicectomy', done: true }, { optionId: 'appendicectomy', done: false }, { optionId: 'x', done: 'yes' }],
      retrospectiveAcuity: 'emergency', comment: 'free text',
    });
    expect(ok.ok && ok.value).toMatchObject({ finalIcd10: 'K35.2', actionsTaken: [{ optionId: 'appendicectomy', done: true }], retrospectiveAcuity: 'emergency' });
    expect(JSON.stringify(ok)).not.toContain('free text');
  });
});

describe('de-identified research export', () => {
  it('removes identifiers and exact dates, bands the age and randomises the case ids', () => {
    let n = 0;
    const x = buildResearchExport(
      [
        { snapshot: A, outcome: OUTCOMES[0], dateOfBirth: '1980-08-02', sex: 'female' },
        { snapshot: B, outcome: null, dateOfBirth: null, sex: 'other' },
      ],
      NOW, () => `11111111-2222-4333-8444-${String(++n).padStart(12, '0')}`, () => 0.3,
    );
    const json = JSON.stringify(x);
    expect(json).not.toContain('aaaaaaaa'); // encounter refs
    expect(json).not.toContain('1980');
    expect(json).not.toContain('2026-08-01');
    expect(json).not.toContain('2026-08-10');
    const a = x.cases.find(c => c.outcome)!;
    expect(a).toMatchObject({ ageBand: '45-59', sex: 'female', completedMonth: '2026-08', outcome: { sourceMonth: '2026-08', finalIcd10: 'K35.80' } });
    const b = x.cases.find(c => !c.outcome)!;
    expect(b).toMatchObject({ ageBand: 'unknown', sex: 'unknown' });
    expect(new Set(x.cases.map(c => c.caseId)).size).toBe(2);
    // The script can run the calibration report straight from an export file.
    const back = researchExportToCases(x);
    expect(computeCalibrationReport(back.snapshots, back.outcomes, { now: NOW }).cases).toBe(1);
  });

  it('bands the age on the completion date in St Lucia time (birthday not yet reached)', () => {
    const x = buildResearchExport(
      [{ snapshot: { ...A, completedAt: '2026-08-02T02:00:00.000Z' }, outcome: null, dateOfBirth: '1981-08-02', sex: 'male' }],
      NOW, () => 'id-1',
    );
    // 02:00 UTC on 2 Aug is 22:00 on 1 Aug in St Lucia: still 44.
    expect(x.cases[0].ageBand).toBe('30-44');
  });
});
