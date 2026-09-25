/**
 * Diagnostic reasoning core — shared test vectors. The same file drives the iOS twin
 * (ios/AmiseMedFlowTests/DiagnosticReasoningTests.swift), so the two platforms reason alike.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  classifyProbeCost, derivedLabTerms, diagnosticTimeOut, discriminatorWhy, expectedInformationGain, explain, fmtPct,
  formatLr, longitudinalPatterns, matchZebras, postTest, prematureClosureAlerts, rankDiscriminators, unexplainedFindings,
} from '@workspace/triage-engine/diagnostic-reasoning';
import type {
  LabValue, LongitudinalInput, PostTestLine, ProbeCandidate, ProbeKind, ReasoningInput, TimeOutInput,
} from '@workspace/triage-engine/diagnostic-reasoning';
import { DISEASES, featureLikelihood, informationGain, initPaneState } from '@workspace/pane-engine';

const VECTORS_PATH = fileURLToPath(new URL('../../../../../ios/AmiseMedFlowTests/Resources/DiagnosticReasoningVectors.json', import.meta.url));

interface Line { id: string; lr: number; documented: boolean; favours: string | null }
interface Vectors {
  explain: { name: string; input: ReasoningInput; hypothesisId: string; expected: { forFindings: Line[]; against: Line[]; missing: Line[]; doesntFit: Line[]; lowEvidence: boolean; unexplained: string[] } }[];
  informationGain: { priors: number[]; pPositive: number[]; expected: number }[];
  postTest: { priors: number[]; pPositive: number[]; residualPPositive: number; expected: { ifPositive: number[]; ifNegative: number[] } }[];
  probeCost: { kind: ProbeKind; text: string; expected: string }[];
  rankDiscriminators: { candidates: ProbeCandidate[]; cantMissInTop: boolean; limit: number; expected: string[] }[];
  discriminatorWhy: { kind: ProbeKind; lines: PostTestLine[]; expected: string }[];
  formatLr: { lr: number; expected: string }[];
  fmtPct: { p: number; expected: string }[];
  closure: { name: string; input: ReasoningInput; workingId: string | null; workingLabel: string; news2Series: number[]; expected: { key: string; kind: string; text: string }[] }[];
  timeOut: { input: TimeOutInput; expected: { suggested: boolean; reasons: string[]; checklist: string[] } }[];
  zebras: { text: string; expected: { id: string; matched: string[] }[] }[];
  derivedLabTerms: { labs: LabValue[]; expected: string[] }[];
  longitudinal: { input: LongitudinalInput; expected: ReturnType<typeof longitudinalPatterns> }[];
}

const V = JSON.parse(readFileSync(VECTORS_PATH, 'utf8')) as Vectors;

function lines(l: { findingId: string; lr: number; documented: boolean; favours: string | null }[]): Line[] {
  return l.map(x => ({ id: x.findingId, lr: x.lr, documented: x.documented, favours: x.favours }));
}

function expectClose(a: number[], b: number[]) {
  expect(a.length).toBe(b.length);
  a.forEach((x, i) => expect(x).toBeCloseTo(b[i], 9));
}

describe('diagnostic reasoning core — shared vectors', () => {
  it.each(V.explain.map(c => [c.name, c] as const))('explain: %s', (_n, c) => {
    const e = explain(c.input, c.hypothesisId);
    expect(lines(e.forFindings)).toEqual(c.expected.forFindings);
    expect(lines(e.against)).toEqual(c.expected.against);
    expect(lines(e.missing)).toEqual(c.expected.missing);
    expect(lines(e.doesntFit)).toEqual(c.expected.doesntFit);
    expect(e.lowEvidence).toBe(c.expected.lowEvidence);
    expect(unexplainedFindings(c.input, c.input.hypotheses.map(h => h.id))).toEqual(c.expected.unexplained);
  });

  it('information gain and post-test probabilities', () => {
    for (const c of V.informationGain) expect(expectedInformationGain(c.priors, c.pPositive)).toBeCloseTo(c.expected, 9);
    for (const c of V.postTest) {
      const r = postTest(c.priors, c.pPositive, c.residualPPositive);
      expectClose(r.ifPositive, c.expected.ifPositive);
      expectClose(r.ifNegative, c.expected.ifNegative);
    }
  });

  it('probe cost, ranking and explanation text', () => {
    for (const c of V.probeCost) expect(`${c.text}: ${classifyProbeCost(c.kind, c.text)}`).toBe(`${c.text}: ${c.expected}`);
    for (const c of V.rankDiscriminators) expect(rankDiscriminators(c.candidates, c.cantMissInTop, c.limit).map(p => p.id)).toEqual(c.expected);
    for (const c of V.discriminatorWhy) expect(discriminatorWhy(c.kind, c.lines)).toBe(c.expected);
    for (const c of V.formatLr) expect(formatLr(c.lr)).toBe(c.expected);
    for (const c of V.fmtPct) expect(fmtPct(c.p)).toBe(c.expected);
  });

  it.each(V.closure.map(c => [c.name, c] as const))('premature closure: %s', (_n, c) => {
    const got = prematureClosureAlerts(c.input, c.workingId, c.workingLabel, c.news2Series).map(a => ({ key: a.key, kind: a.kind, text: a.text }));
    expect(got).toEqual(c.expected);
  });

  it('diagnostic time-out', () => {
    for (const c of V.timeOut) expect(diagnosticTimeOut(c.input)).toEqual(c.expected);
  });

  it('zebra check and laboratory-derived terms', () => {
    for (const c of V.zebras) expect(matchZebras(c.text).map(z => ({ id: z.id, matched: z.matched }))).toEqual(c.expected);
    for (const c of V.derivedLabTerms) expect(derivedLabTerms(c.labs)).toEqual(c.expected);
  });

  it('longitudinal patterns', () => {
    for (const c of V.longitudinal) {
      const got = longitudinalPatterns(c.input);
      expect(got.recurring).toEqual(c.expected.recurring);
      expect(got.unheld).toEqual(c.expected.unheld);
      expect(got.trends.map(t => [t.analyte, t.fromDate, t.toDate, t.text])).toEqual(c.expected.trends.map(t => [t.analyte, t.fromDate, t.toDate, t.text]));
      got.trends.forEach((t, i) => {
        expect(t.from).toBeCloseTo(c.expected.trends[i].from, 6);
        expect(t.to).toBeCloseTo(c.expected.trends[i].to, 6);
      });
    }
  });

  it('the core information gain equals pane-engine informationGain on the same diseases', () => {
    const nodes = DISEASES.filter(d => ['pancreatitis', 'peptic_ulcer', 'gastritis'].includes(d.id));
    const state = initPaneState(nodes);
    for (const f of ['elevated_amylase', 'radiation_to_back', 'antacid_relief', 'fever']) {
      const pPos = nodes.map(d => featureLikelihood(d, f));
      expect(expectedInformationGain(nodes.map(d => state.posteriors[d.id]), pPos))
        .toBeCloseTo(informationGain(state, nodes, f), 9);
    }
  });
});
