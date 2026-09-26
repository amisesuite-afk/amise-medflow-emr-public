/**
 * Diagnostic reasoning: web ↔ iOS parity.
 *
 * The behaviour of the two twins is pinned by the shared vectors
 * (ios/AmiseMedFlowTests/Resources/DiagnosticReasoningVectors.json, run by the dashboard's
 * diagnostic-reasoning-core.test.ts and by DiagnosticReasoningTests.swift). This test pins the data
 * the vectors cannot cover exhaustively: the thresholds, the probe-cost term lists, the time-out
 * checklist, the longitudinal thresholds and the other-specimen terms, read from the Swift source.
 * The zebra rule set is no longer twinned: both platforms read clinical-content/rules/zebra-rules.json
 * (lint:shared-content, shared-content.test.ts).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LONGITUDINAL_THRESHOLDS, OTHER_SPECIMEN_TERMS, PROBE_COST_TERMS, PROBE_COST_WEIGHT, REASONING_THRESHOLDS,
  TIME_OUT_CHECKLIST, DIAGNOSTIC_REASONING_VERSION,
} from '../../lib/triage-engine/src/diagnostic-reasoning/index';
import { REPO_ROOT } from './clinval/load';

const read = (p: string) => readFileSync(join(REPO_ROOT, p), 'utf8');
const CORE = read('ios/AmiseMedFlow/Services/DiagnosticReasoningCore.swift');
const ZEBRA = read('ios/AmiseMedFlow/Services/ZebraCheck.swift');
const LONG = read('ios/AmiseMedFlow/Services/LongitudinalPatterns.swift');

function swiftNumber(src: string, name: string): number {
  const m = new RegExp(`static let ${name}\\s*=\\s*(-?[\\d.]+)`).exec(src);
  if (!m) throw new Error(`static let ${name} not found`);
  return Number(m[1]);
}

function stringsIn(block: string): string[] {
  return [...block.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => m[1].replace(/\\"/g, '"'));
}

describe('diagnostic reasoning parity (web ↔ iOS)', () => {
  it('versions and thresholds match', () => {
    expect(/static let version = "([^"]+)"/.exec(CORE)?.[1]).toBe(DIAGNOSTIC_REASONING_VERSION);
    for (const [name, value] of Object.entries(REASONING_THRESHOLDS)) {
      expect(swiftNumber(CORE, name), name).toBe(value);
    }
    expect(swiftNumber(LONG, 'recurringVisits')).toBe(LONGITUDINAL_THRESHOLDS.recurringVisits);
    expect(swiftNumber(LONG, 'creatinineRiseUmol')).toBe(LONGITUDINAL_THRESHOLDS.creatinineRiseUmol);
    expect(swiftNumber(LONG, 'creatinineRatio')).toBe(LONGITUDINAL_THRESHOLDS.creatinineRatio);
    expect(swiftNumber(LONG, 'haemoglobinDropGL')).toBe(LONGITUDINAL_THRESHOLDS.haemoglobinDropGL);
    expect(swiftNumber(LONG, 'weightLossFraction')).toBe(LONGITUDINAL_THRESHOLDS.weightLossFraction);
    expect(swiftNumber(LONG, 'weightWindowDays')).toBe(LONGITUDINAL_THRESHOLDS.weightWindowDays);
  });

  it('probe-cost terms and weights match', () => {
    const block = /static let probeCostTerms[\s\S]*?\n {4}\]/.exec(CORE)?.[0] ?? '';
    for (const tier of PROBE_COST_TERMS) {
      const m = new RegExp(`\\(\\.${tier.cost}, \\[([\\s\\S]*?)\\]\\)`).exec(block);
      expect(m, tier.cost).not.toBeNull();
      expect(stringsIn(m![1]), tier.cost).toEqual(tier.terms);
    }
    for (const [cost, weight] of Object.entries(PROBE_COST_WEIGHT)) {
      const m = new RegExp(`case \\.${cost}: return ([\\d.]+)`).exec(CORE);
      expect(Number(m?.[1]), cost).toBe(weight);
    }
  });

  it('time-out checklist and other-specimen terms match', () => {
    const checklist = /static let timeOutChecklist: \[String\] = \[([\s\S]*?)\n {4}\]/.exec(CORE)?.[1] ?? '';
    expect(stringsIn(checklist)).toEqual(TIME_OUT_CHECKLIST);
    const specimen = /static let otherSpecimenTerms = \[([^\]]*)\]/.exec(ZEBRA)?.[1] ?? '';
    expect(stringsIn(specimen)).toEqual(OTHER_SPECIMEN_TERMS);
  });
});
