/**
 * Which of the decision layer's missing inputs would change the answer.
 *
 * The decision layer lists, per decision, the inputs that a modifier reads and the record lacks
 * ("Record Clinical Frailty Scale to refine: …"). Each is probed by re-running the same decision
 * with an adverse value from the rules (CFS 7, ASA IV, eGFR 25, pregnant, BMI 42, HAS-BLED 3,
 * NEWS2 7): when an option's band changes (e.g. Treat → Observe for early laparoscopic
 * cholecystectomy) the gap "may change the answer", and its distance from the threshold,
 * |P − treat threshold|, ranks it. Nothing in the decision engine or its content changes.
 *
 * Swift twin: ios/AmiseMedFlow/Services/WhatsMissingCore+Probe.swift (same vectors).
 */

import { DECISION_CONTENT } from '../decision/index.js';
import { decisionSupport } from '../decision/engine.js';
import type { DecisionContent, DecisionInput, DecisionPatient, LineFilter, OptionResult } from '../decision/types.js';
import { WHATS_MISSING_RULES } from './rules.js';
import type { MissingRules } from './rules.js';
import type { DecisionGap } from './types.js';

const IDENTITY: LineFilter = (line: string) => ({ text: line, withheld: false });

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

function probed(patient: DecisionPatient, key: string, value: number | string): DecisionPatient {
  const p: DecisionPatient = { ...patient };
  switch (key) {
    case 'cfs': p.cfs = Number(value); break;
    case 'asa': p.asa = Number(value); break;
    case 'egfr': p.egfr = Number(value); break;
    case 'pregnancy': p.pregnancy = 'pregnant'; break;
    case 'bmi': p.bmi = Number(value); break;
    case 'hasBled': p.hasBled = Number(value); break;
    case 'news2': p.news2 = Number(value); break;
    default: break;
  }
  return p;
}

function comparable(o: OptionResult): boolean {
  return o.band !== 'unknown';
}

/** The missing inputs of each decision, probed (base and probe run through the same line filter). */
export function decisionGaps(
  input: DecisionInput,
  filter: LineFilter = IDENTITY,
  content: DecisionContent = DECISION_CONTENT,
  rules: MissingRules = WHATS_MISSING_RULES,
): DecisionGap[] {
  const base = decisionSupport(input, content, filter);
  const out: DecisionGap[] = [];
  for (const d of base.decisions) {
    const def = content.decisions.find(x => x.id === d.id);
    if (def?.riskScore && d.missing.some(m => m.startsWith('Calculate the '))) {
      out.push({ key: `score:${def.riskScore}`, decisionId: d.id, decisionLabel: d.label, effect: '', flip: null, distance: null });
    }
    for (const di of rules.decisionInputs) {
      const info = content.missingInputs[di.key];
      if (!info || !d.missing.some(m => m.startsWith(`Record ${info.label} to refine`))) continue;
      const probe = decisionSupport({ ...input, patient: probed(input.patient, di.key, di.probe) }, content, filter);
      const after = probe.decisions.find(x => x.id === d.id);
      let flip: DecisionGap['flip'] = null;
      let distance: number | null = null;
      if (after && d.probability !== null) {
        for (const o of d.options) {
          const a = after.options.find(x => x.id === o.id);
          if (!a || !comparable(o) || !comparable(a) || a.band === o.band) continue;
          flip = { option: o.label, from: o.band, to: a.band };
          distance = round4(Math.abs(d.probability - o.treatThreshold[1]));
          break;
        }
      }
      out.push({ key: di.key, decisionId: d.id, decisionLabel: d.label, effect: info.effect, flip, distance });
    }
  }
  return out;
}
