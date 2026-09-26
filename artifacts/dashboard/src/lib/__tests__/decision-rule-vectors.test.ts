/**
 * Decision-rule calculators — shared vectors with iOS. The same file drives the iOS calculators
 * (ios/AmiseMedFlow/Services/ClinicalScoringEngine+DecisionRules*.swift,
 * ios/AmiseMedFlowTests/DecisionRuleCalculatorTests.swift), so a checklist records the same value and
 * falls in the same clinical-content/rules/decision-rules.json band on both platforms.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DECISION_RULES } from '@workspace/pane-engine';
import { RULE_SPECS, ruleOutcome } from '../decision-rule-scores';

const VECTORS_PATH = fileURLToPath(new URL('../../../../../ios/AmiseMedFlowTests/Resources/DecisionRuleCalculatorVectors.json', import.meta.url));

interface Case { name: string; rule: string; ruleId: string; values: Record<string, boolean | string>; total: number; band: string }
const { cases } = JSON.parse(readFileSync(VECTORS_PATH, 'utf8')) as { cases: Case[] };

describe('decision-rule calculators (shared vectors with iOS)', () => {
  it('covers every rule that has a calculator on both platforms', () => {
    const covered = new Set(cases.map(c => c.rule));
    for (const key of ['ottawaAnkle', 'ottawaKnee', 'canadianCtHead', 'nexus', 'canadianCSpine', 'stone', 'sfSyncope', 'canadianSyncope']) {
      expect(covered.has(key), key).toBe(true);
    }
  });

  for (const c of cases) {
    it(c.name, () => {
      const spec = RULE_SPECS[c.rule];
      expect(spec, c.rule).toBeDefined();
      expect(spec.ruleId).toBe(c.ruleId);
      expect(DECISION_RULES.rules.find(r => r.id === c.ruleId)?.web.calculator).toBe(c.rule);
      expect(spec.total(c.values)).toBe(c.total);
      expect(ruleOutcome(spec, c.values)?.band?.id).toBe(c.band);
    });
  }
});
