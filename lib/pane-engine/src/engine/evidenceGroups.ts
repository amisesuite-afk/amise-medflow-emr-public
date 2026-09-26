import type { DiseaseNode } from '../types.js';
import { baseRate, featureLikelihood } from './likelihood.js';

/**
 * Counting a decision rule and its components once (decision-rules.json evidencePolicy).
 *
 * A rule (all its band features) has target diagnoses, component examination signs and component
 * history / observation / result features. While one of its bands is answered, for each target:
 *   - "rule supersedes its signs": a component sign is neutral (the background likelihood);
 *   - "components grouped": the band's likelihood ratio LR_b and the component features' own
 *     combined ratio P (each P(finding | target) / background) count as max(P, LR_b) when LR_b > 1;
 *     a band below 1 is applied in full (the engines record findings as present, so a low score is
 *     evidence of their absence).
 * updatePosterior asks for these likelihoods; the result does not depend on the order in which the
 * band and its components are applied (each step multiplies by the change in the group's factor).
 */
export interface RuleGroup {
  ruleId: string;
  targets: ReadonlySet<string>;
  bandLr: ReadonlyMap<string, number>;
  signComponents: readonly string[];
  paneComponents: readonly string[];
}

const byBand = new Map<string, RuleGroup>();
const byComponent = new Map<string, RuleGroup[]>();

export function registerRuleGroup(group: RuleGroup): void {
  for (const bandFeature of group.bandLr.keys()) byBand.set(bandFeature, group);
  for (const c of [...group.signComponents, ...group.paneComponents]) {
    const list = byComponent.get(c) ?? [];
    list.push(group);
    byComponent.set(c, list);
  }
}

export function ruleGroupOfBand(featureId: string): RuleGroup | undefined {
  return byBand.get(featureId);
}

function observedLikelihood(d: DiseaseNode, featureId: string, observed: boolean): number {
  const p = featureLikelihood(d, featureId);
  return observed ? p : 1 - p;
}

function neutral(featureId: string, observed: boolean): number {
  const b = Math.min(0.995, Math.max(0.005, baseRate(featureId)));
  return observed ? b : 1 - b;
}

function answeredBand(group: RuleGroup, answered: Record<string, boolean>): string | undefined {
  for (const band of group.bandLr.keys()) if (answered[band] === true) return band;
  return undefined;
}

/** The component features' combined likelihood ratio for `d` (answered ones, `skip` left out). */
function componentRatio(group: RuleGroup, answered: Record<string, boolean>, d: DiseaseNode, skip?: string): number {
  let ratio = 1;
  for (const c of group.paneComponents) {
    if (c === skip || !(c in answered)) continue;
    ratio *= observedLikelihood(d, c, answered[c]) / neutral(c, answered[c]);
  }
  return ratio;
}

function bandFactor(lr: number, componentRatioValue: number): number {
  return lr > 1 ? Math.max(1, lr / componentRatioValue) : lr;
}

/**
 * The likelihood of observing `featureId` for `d` under the grouping policy, or undefined when no
 * group applies (then the ordinary likelihood is used).
 */
export function groupedLikelihood(
  answered: Record<string, boolean>, d: DiseaseNode, featureId: string, observed: boolean,
): number | undefined {
  const own = byBand.get(featureId);
  if (own) {
    if (!observed || !own.targets.has(d.id)) return undefined;
    const lr = own.bandLr.get(featureId) ?? 1;
    // Undo the component signs already applied for this target (the rule supersedes them).
    let undo = 1;
    for (const s of own.signComponents) {
      if (s in answered) undo *= neutral(s, answered[s]) / observedLikelihood(d, s, answered[s]);
    }
    return neutral(featureId, true) * bandFactor(lr, componentRatio(own, answered, d)) * undo;
  }
  const groups = byComponent.get(featureId);
  if (!groups) return undefined;
  for (const g of groups) {
    if (!g.targets.has(d.id)) continue;
    const band = answeredBand(g, answered);
    if (!band) continue;
    if (g.signComponents.includes(featureId)) return neutral(featureId, observed);
    const lr = g.bandLr.get(band) ?? 1;
    const obs = observedLikelihood(d, featureId, observed);
    if (lr <= 1) return obs;
    const before = componentRatio(g, answered, d, featureId);
    const after = before * (obs / neutral(featureId, observed));
    return obs * bandFactor(lr, after) / bandFactor(lr, before);
  }
  return undefined;
}
