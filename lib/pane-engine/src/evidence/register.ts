import type { DiseaseNode, Feature } from '../types.js';
import { registerModule, getFeatureBaseRate } from '../vademecum/registry.js';
import { DEFAULT_BASE_RATE } from '../constants.js';
import { registerEvidenceLikelihood } from '../engine/evidenceLikelihood.js';
import { featureLikelihood } from '../engine/likelihood.js';
import { registerRuleGroup } from '../engine/evidenceGroups.js';
import {
  DECISION_RULES, EXAM_SIGNS, engineBands, ruleBandBaseRate, ruleFeatureId, sensSpec, signFeatureId, targetGroup,
} from './catalogue.js';
import type { ExamSign } from './types.js';

/**
 * Registers the examination signs (engine 'lr') and the diagnostic decision-rule bands as PANE
 * features. Imported after every disease module (vademecum/index.ts).
 *
 * Sign with target diagnoses: P(sign | target) = sensitivity, P(sign | any other disease) =
 * 1 - specificity (the feature's background rate), so the likelihood ratios against the rest of
 * the differential are the catalogue's LR+ and LR-. A second target (alsoTargets) has
 * sensitivity = its LR+ × (1 - specificity), capped at 0.95.
 *
 * Finding-level sign (target.paneFeature, e.g. shifting dullness for ascites): the sign detects a
 * finding, so P(sign | disease) = sens × P(finding | disease) + (1 - spec) × (1 - P(finding | disease)).
 *
 * Decision-rule band: P(band | not target) = b = min(0.3, 0.9 / LR) and P(band | target) = LR × b;
 * only a recorded band is ever observed (present), so only the ratio matters.
 */

export const MAX_SECOND_TARGET_SENSITIVITY = 0.95;

function signLikelihood(sign: ExamSign): { baseRate: number; fn: (d: DiseaseNode) => number } | null {
  if (sign.engine !== 'lr' || !sign.lrPositive || !sign.lrNegative) return null;
  const { sensitivity, specificity } = sensSpec(sign.lrPositive.point, sign.lrNegative.point);
  const falsePositive = 1 - specificity;
  const finding = sign.target.paneFeature;
  if (finding) {
    const b = getFeatureBaseRate(finding) ?? DEFAULT_BASE_RATE;
    return {
      baseRate: sensitivity * b + falsePositive * (1 - b),
      fn: d => {
        const p = featureLikelihood(d, finding);
        return sensitivity * p + falsePositive * (1 - p);
      },
    };
  }
  const sens = new Map<string, number>();
  for (const extra of sign.alsoTargets ?? []) {
    const s = Math.min(MAX_SECOND_TARGET_SENSITIVITY, extra.lrPositive.point * falsePositive);
    for (const id of targetGroup(extra.group)?.pane ?? []) sens.set(id, s);
  }
  for (const id of targetGroup(sign.target.group)?.pane ?? []) sens.set(id, sensitivity);
  if (sens.size === 0) return null;
  return { baseRate: falsePositive, fn: d => sens.get(d.id) ?? falsePositive };
}

const features: Feature[] = [];

for (const sign of EXAM_SIGNS.signs) {
  const lik = signLikelihood(sign);
  if (!lik) continue;
  const id = signFeatureId(sign.id);
  features.push({
    id, label: `${sign.name} (examined)`, question: `${sign.name}: present on examination?`,
    category: 'sign', baseRate: lik.baseRate, askable: false,
  });
  registerEvidenceLikelihood(id, lik.fn);
}

for (const rule of DECISION_RULES.rules) {
  const bands = engineBands(rule);
  if (!bands.length) continue;
  const targets = new Set(rule.target.pane);
  const bandLr = new Map<string, number>();
  for (const band of bands) {
    const lr = band.lr!.point;
    const id = ruleFeatureId(rule.id, band.id);
    const b = ruleBandBaseRate(lr);
    features.push({
      id, label: `${rule.name}: ${band.label}`, question: `${rule.name} recorded as ${band.label}?`,
      category: 'investigation', baseRate: b, askable: false,
    });
    registerEvidenceLikelihood(id, d => (targets.has(d.id) ? Math.min(0.99, lr * b) : b));
    bandLr.set(id, lr);
  }
  registerRuleGroup({
    ruleId: rule.id, targets, bandLr,
    signComponents: rule.components.signs.map(signFeatureId),
    paneComponents: rule.components.paneFeatures,
  });
}

registerModule({ specialty: 'evidence', system: 'examination', diseases: [], features });

export const EVIDENCE_FEATURES: readonly Feature[] = features;
