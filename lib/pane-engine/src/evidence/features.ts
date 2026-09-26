import {
  ruleBandFor, decisionRule, decisionRuleByRecordKey, examSign, formatLrValue, postTest, ruleFeatureId, signFeatureId,
  signHasWebEffect, targetGroup, DECISION_RULES, engineBands,
} from './catalogue.js';
import type { DecisionRule, ExamSign, RuleBand, SignState } from './types.js';

/**
 * Recorded examination signs and decision rules → PANE features, and the evidence list the
 * reasoning panel and the Exam step show. Pure; the dashboard mapper
 * (artifacts/dashboard/src/lib/exam-evidence-features.ts) and the clinval runner call it.
 */
export interface RecordedEvidence {
  /** Exam-step chips: sign id → present / absent (examined). Unrecorded signs are not examined. */
  signs: Record<string, SignState>;
  /** Clinician-recorded decision-rule values by record key (decisionScores). */
  ruleValues: Record<string, number>;
  ageYears?: number | null;
}

export type FeatureMap = Record<string, boolean>;

export function signApplies(sign: ExamSign, ageYears: number | null | undefined): boolean {
  const a = sign.applicability;
  if (!a || ageYears === null || ageYears === undefined || !Number.isFinite(ageYears)) return true;
  if (a.ageMin !== undefined && ageYears < a.ageMin) return false;
  if (a.ageMax !== undefined && ageYears > a.ageMax) return false;
  return true;
}

/** Why a recorded rule does not count (null when it does). */
export function ruleNotAppliedReason(rule: DecisionRule, values: Record<string, number>): string | null {
  for (const id of rule.supersededBy) {
    const other = decisionRule(id);
    if (other && typeof values[other.recordKey] === 'number') return `${other.name} is also recorded and is used instead`;
  }
  if (rule.appliesWhen) {
    const other = decisionRule(rule.appliesWhen.rule);
    const v = other ? values[other.recordKey] : undefined;
    if (other && typeof v === 'number' && v > rule.appliesWhen.max) return `valid only when ${other.name} is ${rule.appliesWhen.max} or less (recorded ${v})`;
  }
  return null;
}

/**
 * The feature map with the recorded evidence applied: a chip supersedes its free-text twins, twin
 * signs record their engine features, and recorded rule bands come last.
 */
export function applyRecordedEvidence(features: FeatureMap, rec: RecordedEvidence): FeatureMap {
  const out: FeatureMap = { ...features };
  const twins: FeatureMap = {};
  const signs: FeatureMap = {};
  for (const [id, state] of Object.entries(rec.signs)) {
    const sign = examSign(id);
    if (!sign || !signApplies(sign, rec.ageYears)) continue;
    for (const f of sign.twins?.[state] ?? []) twins[f] = true;
    if (sign.engine !== 'lr') continue;
    for (const t of sign.supersedes) delete out[t];
    if (!signHasWebEffect(sign)) continue;
    // A finding documented in its own right (e.g. "ascites") makes the sign that detects it redundant.
    if (sign.target.paneFeature && sign.target.paneFeature in features) continue;
    if (state === 'present') signs[signFeatureId(id)] = true;
    else if (sign.negativeMeaningful) signs[signFeatureId(id)] = false;
  }
  Object.assign(out, twins, signs);
  for (const [key, value] of Object.entries(rec.ruleValues)) {
    const rule = decisionRuleByRecordKey(key);
    if (!rule || ruleNotAppliedReason(rule, rec.ruleValues)) continue;
    const band = ruleBandFor(rule, value);
    if (band && engineBands(rule).includes(band)) out[ruleFeatureId(rule.id, band.id)] = true;
  }
  return out;
}

export type EvidenceEffect = 'engine' | 'twin' | 'display' | 'not-applied';

export interface EvidenceItem {
  kind: 'sign' | 'rule';
  id: string;
  /** "Murphy's sign present", "Wells PE: 4 or less: PE unlikely". */
  label: string;
  state: SignState | 'recorded';
  /** The likelihood ratio that applies to this result (LR+ when present, LR- when absent, band LR). */
  lr: number | null;
  lrText: string;
  /** What it is evidence for. */
  target: string;
  /** PANE disease ids the engine updates (empty for a finding-level or display-only item). */
  targetIds: string[];
  effect: EvidenceEffect;
  reason: string;
  /** Engine feature, when the item changes the differential. */
  featureId: string | null;
  pretest: number | null;
  posttest: number | null;
  risk: string | null;
  source: string;
  fromMemory: boolean;
  quality: string;
}

export function signResultLabel(sign: ExamSign, state: SignState): string {
  return state === 'present' ? `${sign.name} present` : `${sign.name} absent (examined)`;
}

function signItem(sign: ExamSign, state: SignState, rec: RecordedEvidence, features: FeatureMap): EvidenceItem {
  const lrValue = state === 'present' ? sign.lrPositive : sign.lrNegative;
  const group = targetGroup(sign.target.group);
  const base: EvidenceItem = {
    kind: 'sign', id: sign.id, label: signResultLabel(sign, state), state,
    lr: lrValue?.point ?? null, lrText: formatLrValue(lrValue), target: group?.label ?? sign.target.group,
    targetIds: sign.target.paneFeature ? [] : [...(group?.pane ?? [])],
    effect: 'display', reason: '', featureId: null,
    pretest: sign.target.pretest ?? null, posttest: null, risk: null,
    source: sign.source, fromMemory: sign.fromMemory, quality: sign.quality,
  };
  if (base.pretest !== null && base.lr !== null) base.posttest = postTest(base.pretest, base.lr);
  if (!signApplies(sign, rec.ageYears)) return { ...base, effect: 'not-applied', reason: 'outside the age range the sign was studied in' };
  if (sign.engine === 'none') return { ...base, reason: sign.note ?? 'Documentation only: it does not change the differential.' };
  if (sign.engine === 'twin') {
    const tw = sign.twins?.[state] ?? [];
    return tw.length
      ? { ...base, effect: 'twin', reason: `Recorded for the engine as ${tw.map(t => t.replace(/_/g, ' ')).join(', ')} (its safety weighting); the likelihood ratio is shown, not applied` }
      : { ...base, effect: 'not-applied', reason: 'A red-flag sign: its absence is never used to lower a diagnosis' };
  }
  if (!signHasWebEffect(sign)) return { ...base, reason: 'No matching diagnosis in the web model: shown for information' };
  if (state === 'absent' && !sign.negativeMeaningful) {
    return { ...base, effect: 'not-applied', reason: 'Absence barely changes the probability (likelihood ratio near 1), so it is not applied' };
  }
  if (sign.target.paneFeature && sign.target.paneFeature in features) {
    return { ...base, effect: 'not-applied', reason: `${sign.target.paneFeature.replace(/_/g, ' ')} is documented, so the sign adds nothing further` };
  }
  let reason = sign.target.paneFeature
    ? `Changes the probability of ${sign.target.paneFeature.replace(/_/g, ' ')}, which weighs its causes`
    : 'Applied with this likelihood ratio';
  for (const [key] of Object.entries(rec.ruleValues)) {
    const rule = decisionRuleByRecordKey(key);
    if (rule && rule.components.signs.includes(sign.id) && !ruleNotAppliedReason(rule, rec.ruleValues)) {
      reason += `; neutral for ${rule.target.finding} while ${rule.name} is recorded (the rule contains it)`;
    }
  }
  return { ...base, effect: 'engine', featureId: signFeatureId(sign.id), reason };
}

function ruleItem(rule: DecisionRule, band: RuleBand, value: number, rec: RecordedEvidence): EvidenceItem {
  const base: EvidenceItem = {
    kind: 'rule', id: rule.id, label: `${rule.name} ${value}: ${band.label}`, state: 'recorded',
    lr: band.lr?.point ?? null, lrText: formatLrValue(band.lr), target: rule.target.finding, targetIds: [...rule.target.pane],
    effect: 'display', reason: '', featureId: null,
    pretest: rule.target.pretest ?? null, posttest: null, risk: band.risk ?? null,
    source: rule.source, fromMemory: rule.fromMemory, quality: rule.quality,
  };
  if (base.pretest !== null && base.lr !== null) base.posttest = postTest(base.pretest, base.lr);
  const notApplied = ruleNotAppliedReason(rule, rec.ruleValues);
  if (notApplied) return { ...base, effect: 'not-applied', reason: notApplied };
  if (rule.kind === 'prognostic') return { ...base, reason: 'A prognostic rule: it estimates risk and does not change the differential' };
  if (rule.target.pane.length === 0) return { ...base, reason: 'No matching diagnosis in the web model: shown as a finding-level estimate' };
  if (!engineBands(rule).includes(band)) {
    return band.lr === null
      ? base
      : { ...base, effect: 'not-applied', reason: `${rule.name} has limited sensitivity: a low result is not used to lower the probability` };
  }
  const grouped = rule.components.signs.length || rule.components.paneFeatures.length
    ? '; its component signs and findings count once with it'
    : '';
  return { ...base, effect: 'engine', featureId: ruleFeatureId(rule.id, band.id), reason: `Applied with this likelihood ratio${grouped}` };
}

/** Every recorded sign and rule, with what it does to the engines and why. */
export function evidenceItems(rec: RecordedEvidence, features: FeatureMap = {}): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  for (const [id, state] of Object.entries(rec.signs)) {
    const sign = examSign(id);
    if (sign) out.push(signItem(sign, state, rec, features));
  }
  for (const rule of DECISION_RULES.rules) {
    const value = rec.ruleValues[rule.recordKey];
    if (typeof value !== 'number') continue;
    const band = ruleBandFor(rule, value);
    if (band) out.push(ruleItem(rule, band, value, rec));
  }
  return out;
}
