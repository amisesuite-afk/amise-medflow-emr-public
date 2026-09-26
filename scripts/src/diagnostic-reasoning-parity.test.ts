/**
 * Diagnostic reasoning: web ↔ iOS parity.
 *
 * The behaviour of the two twins is pinned by the shared vectors
 * (ios/AmiseMedFlowTests/Resources/DiagnosticReasoningVectors.json, run by the dashboard's
 * diagnostic-reasoning-core.test.ts and by DiagnosticReasoningTests.swift). This test pins the data
 * the vectors cannot cover exhaustively: the thresholds, the probe-cost term lists, the time-out
 * checklist, the longitudinal thresholds and the other-specimen terms, read from the Swift source.
 * The zebra rule set is no longer twinned: both platforms read clinical-content/rules/zebra-rules.json
 * (lint:shared-content, shared-content.test.ts); the adapter rules (families, label matching,
 * closure filters, coexisting states) are read from clinical-content/rules/diagnostic-reasoning-rules.json
 * by both, whose `thresholds` iOS compiles in (pinned here). The clause-aware record reading
 * (record-clauses.ts ↔ RecordClauses.swift) is pinned here by its word lists and patterns and by
 * the shared RecordClauseVectors.json.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LONGITUDINAL_THRESHOLDS, OTHER_SPECIMEN_TERMS, PROBE_COST_TERMS, PROBE_COST_WEIGHT, REASONING_RULES, REASONING_THRESHOLDS,
  TIME_OUT_CHECKLIST, DIAGNOSTIC_REASONING_VERSION,
} from '../../lib/triage-engine/src/diagnostic-reasoning/index';
import {
  AND_LIST_CUES, ATTRIBUTED_PATTERN, FAMILY_CONTRAST_PATTERN, FAMILY_HISTORY_PATTERN, LIST_BREAKERS, LIST_CUES, LIST_CUE_FILLERS,
  LIST_PSEUDO_NEXT, MAX_LIST_ITEMS, MAX_LIST_ITEM_WORDS, NO_HELP_RE, QUERY_BEFORE_PATTERN, QUERY_LOOKBACK,
} from '../../lib/triage-engine/src/record-clauses';
import { REPO_ROOT } from './clinval/load';

const read = (p: string) => readFileSync(join(REPO_ROOT, p), 'utf8');
const CORE = read('ios/AmiseMedFlow/Services/DiagnosticReasoningCore.swift');
const ZEBRA = read('ios/AmiseMedFlow/Services/ZebraCheck.swift');
const LONG = read('ios/AmiseMedFlow/Services/LongitudinalPatterns.swift');
const CLAUSES = read('ios/AmiseMedFlow/Services/RecordClauses.swift');
const ADAPTER = read('ios/AmiseMedFlow/Services/DiagnosticReasoningAdapter.swift');

function swiftStringList(src: string, name: string): string[] {
  const m = new RegExp(`static let ${name}(?:: \\[String\\])? = \\[([\\s\\S]*?)\\]\\n`).exec(src);
  if (!m) throw new Error(`static let ${name} not found`);
  return stringsIn(m[1]);
}

function swiftRawString(src: string, name: string): string {
  const m = new RegExp(`static let ${name} = #"(.*)"#\\n`).exec(src);
  if (!m) throw new Error(`static let ${name} = #"…"# not found`);
  return m[1];
}

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

  it('the core thresholds are the shared rules file (clinical-content/rules/diagnostic-reasoning-rules.json)', () => {
    expect(REASONING_THRESHOLDS).toBe(REASONING_RULES.thresholds);
    expect(DIAGNOSTIC_REASONING_VERSION).toBe(REASONING_RULES.version);
    expect(swiftStringList(ADAPTER, 'fallbackCoexistingTerms')).toEqual(REASONING_RULES.coexisting.nameTerms);
  });

  it('clause-aware record reading: word lists and patterns match (record-clauses.ts ↔ RecordClauses.swift)', () => {
    expect(swiftStringList(CLAUSES, 'listCues')).toEqual(LIST_CUES);
    expect(swiftStringList(CLAUSES, 'andListCues')).toEqual(AND_LIST_CUES);
    expect(swiftStringList(CLAUSES, 'listPseudoNext')).toEqual(LIST_PSEUDO_NEXT);
    expect(swiftStringList(CLAUSES, 'listBreakers')).toEqual(LIST_BREAKERS);
    expect(swiftStringList(CLAUSES, 'listCueFillers')).toEqual(LIST_CUE_FILLERS);
    expect(swiftNumber(CLAUSES, 'maxListItemWords')).toBe(MAX_LIST_ITEM_WORDS);
    expect(swiftNumber(CLAUSES, 'maxListItems')).toBe(MAX_LIST_ITEMS);
    expect(swiftNumber(CLAUSES, 'queryLookback')).toBe(QUERY_LOOKBACK);
    expect(swiftRawString(CLAUSES, 'familyHistoryPattern')).toBe(FAMILY_HISTORY_PATTERN);
    expect(swiftRawString(CLAUSES, 'familyContrastPattern')).toBe(FAMILY_CONTRAST_PATTERN);
    expect(swiftRawString(CLAUSES, 'attributedPattern')).toBe(ATTRIBUTED_PATTERN);
    expect(swiftRawString(CLAUSES, 'queryBeforePattern')).toBe(QUERY_BEFORE_PATTERN);
    expect(swiftRawString(CLAUSES, 'noHelpPattern')).toBe(NO_HELP_RE.source);
  });

  it('time-out checklist and other-specimen terms match', () => {
    const checklist = /static let timeOutChecklist: \[String\] = \[([\s\S]*?)\n {4}\]/.exec(CORE)?.[1] ?? '';
    expect(stringsIn(checklist)).toEqual(TIME_OUT_CHECKLIST);
    const specimen = /static let otherSpecimenTerms = \[([^\]]*)\]/.exec(ZEBRA)?.[1] ?? '';
    expect(stringsIn(specimen)).toEqual(OTHER_SPECIMEN_TERMS);
  });
});
