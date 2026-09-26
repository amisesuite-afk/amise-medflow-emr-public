/**
 * "What's missing" — shared vectors (the iOS twin runs the same file in
 * ios/AmiseMedFlowTests/WhatsMissingTests.swift) and the rule-content hygiene.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DECISION_CONTENT, WHATS_MISSING_RULES, WHATS_MISSING_VERSION, decisionGaps, joinParts, scoreRecordFill, termIn,
  whatsMissing, whatsMissingLines,
} from '../index.js';
import type { DecisionGap, DecisionInput, MissingRecord, ScoreFill, WhatsMissingInput, WhatsMissingResult } from '../index.js';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const VECTORS = JSON.parse(readFileSync(join(REPO_ROOT, 'ios/AmiseMedFlowTests/WhatsMissing/whats-missing-vectors.json'), 'utf8')) as {
  version: string;
  fill: { id: string; score: string; record: MissingRecord; expected: ScoreFill }[];
  probe: { id: string; input: DecisionInput; expected: DecisionGap[] }[];
  rank: { id: string; input: WhatsMissingInput; expected: WhatsMissingResult }[];
  terms: { text: string; term: string; expected: boolean }[];
  parts: { parts: string[]; expected: string }[];
};

describe("what's missing — shared vectors (web = iOS)", () => {
  it('the vectors were generated from this rule version', () => {
    expect(VECTORS.version).toBe(WHATS_MISSING_VERSION);
    expect(VECTORS.fill.length).toBeGreaterThanOrEqual(20);
    expect(VECTORS.rank.length).toBeGreaterThanOrEqual(15);
  });
  for (const v of VECTORS.fill) it(`fill: ${v.id}`, () => expect(scoreRecordFill(v.score, v.record)).toEqual(v.expected));
  for (const v of VECTORS.probe) it(`probe: ${v.id}`, () => expect(decisionGaps(v.input)).toEqual(v.expected));
  for (const v of VECTORS.rank) it(`rank: ${v.id}`, () => expect(whatsMissing(v.input)).toEqual(v.expected));
  it('term matcher and part joiner', () => {
    for (const t of VECTORS.terms) expect(termIn(t.text, t.term), `${t.term} in ${t.text}`).toBe(t.expected);
    for (const p of VECTORS.parts) expect(joinParts(p.parts)).toBe(p.expected);
  });
});

describe("what's missing — the owner's examples", () => {
  const top = (id: string) => whatsMissing(VECTORS.rank.find(v => v.id === id)!.input).items[0];
  it('child without a weight: weight first', () => expect(top('child-no-weight').id).toBe('weight'));
  it('woman aged 30 with a CT planned: pregnancy status first', () => expect(top('woman-30-ct-planned').id).toBe('pregnancy'));
  it('cholecystitis without WBC: the TG18 input (FBC) first', () => {
    const t = top('cholecystitis-no-wbc');
    expect(t.id).toBe('fbc');
    expect(t.why).toMatch(/TG18 cholecystitis/);
  });
  it('NSAID planned without eGFR: renal function, merged with the BISAP urea', () => {
    const t = top('nsaid-no-egfr');
    expect(t.id).toBe('renal');
    expect(t.tier).toBe('safety');
    expect(t.also).toEqual(['Needed for BISAP']);
  });
  it('a decision flip outranks score completeness and names the band change', () => {
    const r = whatsMissing(VECTORS.rank.find(v => v.id === 'decision-flip-and-score')!.input);
    expect(r.items[0].why).toBe('May change Treat → Test further for early laparoscopic cholecystectomy (acute cholecystitis)');
    expect(whatsMissingLines(r)[0]).toMatch(/^1\. \[decision\] Renal function: eGFR not on file — May change/);
  });
  it('an 82-year-old with an inguinal hernia: CFS would flip elective repair to observe', () => {
    const gaps = decisionGaps(VECTORS.probe.find(v => v.id === 'hernia-82')!.input);
    expect(gaps.find(g => g.key === 'cfs')?.flip).toEqual({ option: 'Elective inguinal hernia repair', from: 'treat', to: 'observe' });
  });
});

describe("what's missing — rule content", () => {
  const R = WHATS_MISSING_RULES;
  it('every concept names a group, every group a tier, every decision input a missing input of the decision layer', () => {
    const groups = new Set(R.groups.map(g => g.id));
    for (const c of R.concepts) expect(groups.has(c.group), c.id).toBe(true);
    for (const g of R.groups) expect(R.tiers).toContain(g.tier);
    for (const d of R.decisionInputs) {
      expect(groups.has(d.group), d.key).toBe(true);
      expect(DECISION_CONTENT.missingInputs[d.key], d.key).toBeDefined();
    }
  });
  it('safety groups have a unique order', () => {
    const orders = R.groups.filter(g => g.tier === 'safety').map(g => g.safetyOrder);
    expect(new Set(orders).size).toBe(orders.length);
  });
  it('clinician-facing text never tells anyone to take, hold or stop a medicine and carries no dose', () => {
    const all = JSON.stringify(R.text) + JSON.stringify(R.groups);
    expect(all).not.toMatch(/\b(take|hold|stop|withhold|omit)\b/i);
    expect(all).not.toMatch(/\d+\s*(mg|mcg|µg|units)\b/i);
  });
  it('a missing value never fills a field (no inputs recorded → no filled field except demographics)', () => {
    const empty: MissingRecord = VECTORS.fill.find(v => v.id === 'alvarado-empty')!.record;
    for (const s of ['alvarado', 'air', 'glasgow-blatchford', 'wells-pe', 'wells-dvt', 'rcri']) {
      expect(scoreRecordFill(s, { ...empty, sex: 'unknown' }).fields.filter(f => f.source !== 'demographics'), s).toEqual([]);
    }
  });
});
