/**
 * Zebra check matching and laboratory-derived terms.
 * iOS twin: ios/AmiseMedFlow/Services/ZebraCheck.swift (same rules from ZebraRules.json, same
 * matching, same derived terms). Test vectors: DiagnosticReasoningVectors.json ("zebras",
 * "derivedLabTerms").
 */

import { containsAffirmed } from '../negation';
import { hasTerm } from './core';
import { ZEBRA_RULES, type ZebraRule } from './zebra-rules';

export interface ZebraMatch {
  id: string;
  condition: string;
  icd10: string;
  paneId: string | null;
  explains: string;
  citation: string;
  link: string | null;
  /** The first affirmed term of each satisfied group, in rule order. */
  matched: string[];
}

function firstAffirmed(text: string, terms: string[]): string | null {
  for (const t of terms) if (containsAffirmed(text, t, { wordStart: true })) return t;
  return null;
}

/** Rare conditions whose combination of findings is present in `recordText` (negation-aware). */
export function matchZebras(recordText: string, rules: ZebraRule[] = ZEBRA_RULES): ZebraMatch[] {
  const out: ZebraMatch[] = [];
  if (!recordText.trim()) return out;
  for (const rule of rules) {
    if (rule.none.some(t => containsAffirmed(recordText, t, { wordStart: true }))) continue;
    const matched: string[] = [];
    let ok = true;
    for (const group of rule.all) {
      const hit = firstAffirmed(recordText, group);
      if (hit === null) { ok = false; break; }
      matched.push(hit);
    }
    if (!ok) continue;
    if (rule.atLeast) {
      const hits: string[] = [];
      for (const group of rule.atLeast.groups) {
        const hit = firstAffirmed(recordText, group);
        if (hit !== null) hits.push(hit);
      }
      if (hits.length < rule.atLeast.count) continue;
      matched.push(...hits);
    }
    if (matched.length === 0) continue;
    out.push({
      id: rule.id, condition: rule.condition, icd10: rule.icd10, paneId: rule.paneId,
      explains: rule.explains, citation: rule.citation, link: rule.link, matched,
    });
  }
  return out;
}

export const OTHER_SPECIMEN_TERMS = ['urine', 'urinary', 'csf', 'fluid', 'drain', 'vitamin*', 'ratio', 'faecal', 'stool'];

export interface LabValue {
  name: string;
  value: number;
}

/**
 * Words for abnormal numeric results, so a zebra rule written in words ("anaemia",
 * "hypercalcaemia") also fires on the number. Units are recognised by size where the ranges
 * cannot overlap. Returned in a fixed order, without duplicates.
 */
export function derivedLabTerms(labs: LabValue[]): string[] {
  const found = new Set<string>();
  const is = (name: string, terms: string[]) => terms.some(t => hasTerm(name, t));
  for (const { name, value } of labs) {
    if (!Number.isFinite(value)) continue;
    // Another specimen or another test ("Urine Na", "Vitamin K", "Albumin/creatinine ratio").
    if (is(name, OTHER_SPECIMEN_TERMS)) continue;
    if (is(name, ['haemoglobin', 'hemoglobin', 'hb', 'hgb'])) {
      const gdl = value > 25 ? value / 10 : value;
      if (gdl < 11) found.add('anaemia');
    }
    if (is(name, ['calcium'])) {
      const mmol = value > 5 ? value / 4.008 : value;
      if (mmol > 2.6) found.add('hypercalcaemia');
    }
    if (is(name, ['potassium', 'k'])) {
      if (value < 3.5) found.add('hypokalaemia');
      if (value >= 6.0) found.add('hyperkalaemia');
    }
    if (is(name, ['sodium', 'na']) && value < 130) found.add('hyponatraemia');
    if (is(name, ['eosinophil*', 'eos'])) {
      const e9 = value > 30 ? value / 1000 : value;
      if (e9 > 0.5) found.add('eosinophilia');
    }
    if (is(name, ['alt', 'ast', 'alanine aminotransferase', 'aspartate aminotransferase', 'transaminase*']) && value > 40) {
      found.add('raised transaminases');
    }
    if (is(name, ['bilirubin'])) {
      const umol = value < 5 ? value * 17.1 : value;
      if (umol > 21) found.add('raised bilirubin');
    }
    if (is(name, ['triglyceride*', 'tg'])) {
      const mmol = value > 50 ? value / 88.57 : value;
      if (mmol >= 11.3) found.add('hypertriglyceridaemia');
    }
  }
  const order = ['anaemia', 'hypercalcaemia', 'hypokalaemia', 'hyperkalaemia', 'hyponatraemia', 'eosinophilia',
    'raised transaminases', 'raised bilirubin', 'hypertriglyceridaemia'];
  return order.filter(t => found.has(t));
}
