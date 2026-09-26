import signsJson from '../../../../clinical-content/rules/exam-signs.json';
import rulesJson from '../../../../clinical-content/rules/decision-rules.json';
import type {
  DecisionRule, DecisionRulesContent, ExamSign, ExamSignsContent, LrValue, RuleBand, TargetGroup,
} from './types.js';

/**
 * The examination-sign and decision-rule catalogues: the shared clinical rule files
 * clinical-content/rules/exam-signs.json and decision-rules.json, read by iOS too
 * (ExamEvidenceCatalogue.swift through SharedClinicalContent). lint:shared-content checks them
 * against their schemas and against these types. Registered as `exam-signs` and `decision-rules`.
 */
export const EXAM_SIGNS = signsJson as unknown as ExamSignsContent;
export const DECISION_RULES = rulesJson as unknown as DecisionRulesContent;
export const EXAM_SIGNS_VERSION = EXAM_SIGNS.version;
export const DECISION_RULES_VERSION = DECISION_RULES.version;

const SIGN_BY_ID = new Map(EXAM_SIGNS.signs.map(s => [s.id, s]));
const RULE_BY_ID = new Map(DECISION_RULES.rules.map(r => [r.id, r]));
const RULE_BY_KEY = new Map(DECISION_RULES.rules.map(r => [r.recordKey, r]));

export function examSign(id: string): ExamSign | undefined { return SIGN_BY_ID.get(id); }
export function decisionRule(id: string): DecisionRule | undefined { return RULE_BY_ID.get(id); }
export function decisionRuleByRecordKey(key: string): DecisionRule | undefined { return RULE_BY_KEY.get(key); }
export function targetGroup(id: string): TargetGroup | undefined { return EXAM_SIGNS.targetGroups[id]; }

/** Engine feature id of a sign with its own likelihood ratios (engine 'lr'). */
export function signFeatureId(signId: string): string { return `sign_${signId}`; }
/** Engine feature id of one band of a decision rule. */
export function ruleFeatureId(ruleId: string, bandId: string): string {
  return `rule_${ruleId.replace(/-/g, '_')}_${bandId.replace(/-/g, '_')}`;
}

export function isEvidenceFeature(featureId: string): boolean {
  return featureId.startsWith('sign_') || featureId.startsWith('rule_');
}

/**
 * Sensitivity and specificity from a pair of likelihood ratios (LR+ > 1 > LR-):
 * specificity = (LR+ - 1) / (LR+ - LR-), sensitivity = LR+ × (1 - specificity).
 */
export function sensSpec(lrPositive: number, lrNegative: number): { sensitivity: number; specificity: number } {
  if (!(lrPositive > 1) || !(lrNegative < 1) || !(lrNegative > 0)) {
    throw new Error(`sensSpec: need LR+ > 1 > LR- > 0 (got ${lrPositive}, ${lrNegative})`);
  }
  const specificity = (lrPositive - 1) / (lrPositive - lrNegative);
  return { sensitivity: lrPositive * (1 - specificity), specificity };
}

/** The band a recorded value falls in (bounds inclusive), or null. */
export function ruleBandFor(rule: DecisionRule, value: number): RuleBand | null {
  if (!Number.isFinite(value)) return null;
  for (const b of rule.bands) {
    if (b.min !== undefined && value < b.min) continue;
    if (b.max !== undefined && value > b.max) continue;
    return b;
  }
  return null;
}

/** Signs whose chip changes the engines (own likelihood ratios with a web target or finding). */
export function signHasWebEffect(sign: ExamSign): boolean {
  if (sign.engine === 'twin') return (sign.twins?.present?.length ?? 0) + (sign.twins?.absent?.length ?? 0) > 0;
  if (sign.engine !== 'lr' || !sign.lrPositive || !sign.lrNegative) return false;
  const group = targetGroup(sign.target.group);
  return !!sign.target.paneFeature || (group?.pane.length ?? 0) > 0;
}

/** Human-readable likelihood ratio with its range. */
export function formatLrValue(lr: LrValue | null): string {
  if (!lr) return 'not established';
  const f = (x: number) => (x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toFixed(2));
  const range = lr.low !== undefined && lr.high !== undefined ? ` (${f(lr.low)}–${f(lr.high)})` : '';
  return `${f(lr.point)}${range}`;
}

/** Post-test probability from a pre-test probability and a likelihood ratio (odds form). */
export function postTest(pretest: number, lr: number): number {
  const odds = (pretest / (1 - pretest)) * lr;
  return odds / (1 + odds);
}

/** Background rate of a rule band feature (see the header). */
export function ruleBandBaseRate(lr: number): number {
  return Math.min(0.3, 0.9 / lr);
}

/** Bands of a diagnostic rule that the engine can apply (likelihood ratio and a web target). */
export function engineBands(rule: DecisionRule): RuleBand[] {
  if (rule.kind !== 'diagnostic' || rule.target.pane.length === 0) return [];
  return rule.bands.filter(b => b.lr !== null && (b.lr.point >= 1 || rule.negativeMeaningful));
}
