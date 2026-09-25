/**
 * Decision support engine — shared vectors (the iOS twin runs the same file in
 * ios/AmiseMedFlowTests/TreatmentDecisionTests.swift) and the threshold arithmetic.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DECISION_CONTENT, bandFor, decisionSupport, diagnosisMatches, formatPercent, formatValue, keywordAt, thresholds,
} from '../index.js';
import type { DecisionInput, DecisionSupportResult } from '../index.js';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const VECTORS = JSON.parse(readFileSync(join(REPO_ROOT, 'ios/AmiseMedFlowTests/DecisionSupport/decision-vectors.json'), 'utf8')) as {
  contentVersion: string;
  vectors: { id: string; input: DecisionInput; expected: ReturnType<typeof expectedOf> }[];
};

function expectedOf(r: DecisionSupportResult) {
  return {
    activeFactors: r.activeFactors,
    scoreActions: r.scoreActions.map(s => ({ id: s.id, chip: s.chip, band: s.band, level: s.level, addAs: s.addAs })),
    resultActions: r.resultActions.map(s => ({ id: s.id, chip: s.chip, thresholdText: s.thresholdText })),
    decisions: r.decisions.map(d => ({
      id: d.id, probability: d.probability, probabilitySource: d.probabilitySource, chip: d.chip, missing: d.missing,
      options: d.options.map(o => ({
        id: o.id, band: o.band, bandRange: o.bandRange, rank: o.rank,
        treatThreshold: o.treatThreshold, testThreshold: o.testThreshold,
        benefit: o.benefit, harm: o.harm, net: o.net,
        topFactors: o.topFactors.map(f => f.modifierId), factorSummary: o.factorSummary,
        excluded: o.excludedReason !== null,
      })),
    })),
  };
}

describe('decision support — shared vectors (web = iOS)', () => {
  it('the vectors were generated from this content version', () => {
    expect(VECTORS.contentVersion).toBe(DECISION_CONTENT.version);
    expect(VECTORS.vectors.length).toBeGreaterThanOrEqual(20);
  });
  for (const v of VECTORS.vectors) {
    it(v.id, () => {
      expect(expectedOf(decisionSupport(v.input, DECISION_CONTENT))).toEqual(v.expected);
    });
  }
});

describe('personalisation (the owner\'s examples)', () => {
  const byId = (id: string) => VECTORS.vectors.find(v => v.id === id)!;
  const run = (id: string) => decisionSupport(byId(id).input, DECISION_CONTENT);

  it('frail 88-year-old with cholecystitis: drainage ranks above early laparoscopic cholecystectomy', () => {
    const d = run('chole-frail-88').decisions[0];
    expect(d.options[0].id).toBe('percutaneous-cholecystostomy');
    const lc = d.options.find(o => o.id === 'early-lap-chole')!;
    expect(lc.band).toBe('observe');
    expect(lc.factorSummary).toMatch(/Frailty CFS 7/);
    const fit = run('chole-fit-confirmed').decisions[0];
    expect(fit.options[0].id).toBe('early-lap-chole');
  });

  it('frailty raises the treat threshold of an operation', () => {
    const fit = run('hernia-fit').decisions[0].options[0];
    const frail = run('hernia-frail').decisions[0].options[0];
    expect(frail.treatThreshold[1]).toBeGreaterThan(fit.treatThreshold[1]);
    expect(fit.band).toBe('treat');
    expect(frail.band).toBe('observe');
  });

  it('anticoagulation and eGFR < 30 raise bleeding harm; recent surgery excludes thrombolysis', () => {
    const plain = run('pe-wells-unlikely').decisions[0].options.find(o => o.id === 'anticoagulation')!;
    const anticoag = run('pe-shock-anticoagulated-egfr25').decisions[0].options.find(o => o.id === 'anticoagulation')!;
    expect(anticoag.harm[1]).toBeGreaterThan(plain.harm[1]);
    expect(anticoag.topFactors.map(f => f.factor)).toContain('egfrBelow30');
    const lysis = run('pe-shock-recent-surgery').decisions[0].options.find(o => o.id === 'thrombolysis')!;
    expect(lysis.band).toBe('not-for-patient');
    expect(lysis.rank).toBeNull();
    expect(lysis.excludedReason).toMatch(/3 weeks/);
  });

  it('pregnancy lowers the antibiotics-first benefit and raises operative harm', () => {
    const fit = run('appendicitis-fit').decisions[0].options;
    const preg = run('appendicitis-pregnant').decisions[0].options;
    const f = (o: typeof fit, id: string) => o.find(x => x.id === id)!;
    expect(f(preg, 'antibiotics-first').benefit[1]).toBeLessThan(f(fit, 'antibiotics-first').benefit[1]);
    expect(f(preg, 'appendicectomy').harm[1]).toBeGreaterThan(f(fit, 'appendicectomy').harm[1]);
  });

  it('penicillin allergy is a listed factor of a penicillin-based regimen', () => {
    const o = run('diverticulitis-immunosuppressed-penicillin').decisions[0].options.find(x => x.id === 'antibiotics')!;
    expect(o.factors.map(f => f.factor)).toContain('penicillinAllergy');
  });

  it('bands: observe / test / treat', () => {
    expect(run('ugib-gbs-1').decisions[0].options[0].band).toBe('observe');
    expect(run('chole-unconfirmed-40').decisions[0].options[0].band).toBe('test');
    expect(run('ugib-gbs-13-shock').decisions[0].options[0].band).toBe('treat');
  });

  it('a missing input is named with what it would change', () => {
    const d = run('ugib-no-gbs').decisions[0];
    expect(d.probability).toBeNull();
    expect(d.missing[0]).toMatch(/Glasgow-Blatchford/);
    const chole = run('chole-unconfirmed-40').decisions[0];
    expect(chole.missing.join(' ')).not.toMatch(/eGFR/);
    const lap = run('laparotomy-frail-egfr28').decisions[0];
    expect(lap.missing.join(' ')).not.toMatch(/Clinical Frailty Scale/);
  });
});

describe('thresholds (Pauker & Kassirer 1980)', () => {
  it('treatment threshold without a test is H / (H + B)', () => {
    expect(thresholds(0.3, 0.1)).toEqual({ test: null, treat: 0.25 });
    expect(thresholds(0, 0.1).treat).toBe(1);
    expect(thresholds(-0.1, 0.1).treat).toBe(1);
    expect(thresholds(0.3, 0).treat).toBe(0);
  });
  it('a perfect harmless test makes testing right across (0, 1)', () => {
    const t = thresholds(0.3, 0.1, { sensitivity: 1, specificity: 1, harm: 0 });
    expect(t.test).toBe(0);
    expect(t.treat).toBe(1);
  });
  it('test and test-treatment thresholds bracket the treatment threshold', () => {
    const t = thresholds(0.3, 0.05, { sensitivity: 0.9, specificity: 0.9, harm: 0.001 });
    const treat = 0.05 / 0.35;
    expect(t.test!).toBeLessThan(treat);
    expect(t.treat).toBeGreaterThan(treat);
    expect(bandFor(0.01, t)).toBe('observe');
    expect(bandFor(0.2, t)).toBe('test');
    expect(bandFor(0.9, t)).toBe('treat');
    expect(bandFor(null, t)).toBe('unknown');
  });
  it('a harmful test collapses to the treatment threshold', () => {
    const t = thresholds(0.1, 0.01, { sensitivity: 0.6, specificity: 0.6, harm: 0.2 });
    expect(t.test).toBeNull();
    expect(t.treat).toBeCloseTo(0.01 / 0.11, 10);
  });
});

describe('matching and formatting (identical on iOS)', () => {
  const pe = DECISION_CONTENT.decisions.find(d => d.id === 'pulmonary-embolism')!;
  const div = DECISION_CONTENT.decisions.find(d => d.id === 'diverticulitis')!;
  it('keywords match at a word start only', () => {
    expect(keywordAt('Perforated duodenal ulcer', 'perforat')).toBe(true);
    expect(keywordAt('imperforate anus', 'perforat')).toBe(false);
    expect(keywordAt('uncomplicated diverticulitis', 'complicated')).toBe(false);
  });
  it('diagnoses match by id, ICD prefix or keyword, and exclusions win', () => {
    expect(diagnosisMatches(pe, { name: 'x', id: 'pulmonary_embolism', probability: 0.1, confirmed: false })).toBe(true);
    expect(diagnosisMatches(pe, { name: 'x', icd10: 'I26.99', probability: 0.1, confirmed: false })).toBe(true);
    expect(diagnosisMatches(pe, { name: 'Massive pulmonary embolism', probability: 0.1, confirmed: false })).toBe(true);
    expect(diagnosisMatches(div, { name: 'Perforated diverticulitis', id: 'diverticulitis', probability: 0.5, confirmed: true })).toBe(false);
    expect(diagnosisMatches(div, { name: 'Uncomplicated diverticulitis', probability: 0.5, confirmed: true })).toBe(true);
  });
  it('percentages and values', () => {
    expect(formatPercent(0.953)).toBe('95%');
    expect(formatPercent(0.0374)).toBe('3.7%');
    expect(formatPercent(0.04)).toBe('4%');
    expect(formatPercent(0.004)).toBe('0.4%');
    expect(formatValue(3)).toBe('3');
    expect(formatValue(4.5)).toBe('4.5');
  });
});

describe('content hygiene', () => {
  it('every referenced source exists and is marked from memory until signed off', () => {
    const ids = new Set(Object.keys(DECISION_CONTENT.sources));
    const used: string[] = [];
    for (const s of DECISION_CONTENT.scoreActions) for (const b of s.bands) used.push(...b.sources);
    for (const r of DECISION_CONTENT.resultActions) used.push(...r.sources);
    for (const m of DECISION_CONTENT.modifiers) used.push(...m.sources);
    for (const d of DECISION_CONTENT.decisions) {
      for (const o of d.options) used.push(...o.sources);
      for (const m of d.modifiers) used.push(...m.sources);
      if (d.test) used.push(...d.test.sources);
    }
    for (const u of used) expect(ids.has(u), u).toBe(true);
    for (const s of Object.values(DECISION_CONTENT.sources)) expect(s.fromMemory).toBe(true);
    expect(DECISION_CONTENT.status).toBe('needs-sign-off');
  });
  it('every range is ordered low ≤ point ≤ high', () => {
    const triples: number[][] = [];
    for (const d of DECISION_CONTENT.decisions) {
      for (const o of d.options) triples.push(o.benefit, o.harm);
      for (const m of d.modifiers) triples.push(...[m.harmOR, m.benefitX, m.benefitAdd].filter((t): t is [number, number, number] => !!t));
      if (d.baselineRisk) triples.push(d.baselineRisk);
      for (const rf of d.riskFactors ?? []) triples.push(rf.risk);
    }
    for (const m of DECISION_CONTENT.modifiers) triples.push(...[m.harmOR, m.benefitX, m.benefitAdd].filter((t): t is [number, number, number] => !!t));
    for (const s of DECISION_CONTENT.scoreActions) for (const b of s.bands) if (b.risk) triples.push(b.risk);
    for (const t of triples) expect(t[0] <= t[1] && t[1] <= t[2], JSON.stringify(t)).toBe(true);
  });
  it('no fixed drug dose in any action line (doses per guideline / local policy)', () => {
    const texts: string[] = [];
    for (const s of DECISION_CONTENT.scoreActions) for (const b of s.bands) texts.push(b.action);
    for (const r of DECISION_CONTENT.resultActions) texts.push(r.action);
    for (const d of DECISION_CONTENT.decisions) for (const o of d.options) texts.push(o.planLine, o.observeText);
    for (const t of texts) expect(t, t).not.toMatch(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|micrograms?|units?|iu|g)\b(?!\/)/i);
  });
  it('never names Victoria Hospital', () => {
    expect(JSON.stringify(DECISION_CONTENT)).not.toMatch(/victoria/i);
  });
});
