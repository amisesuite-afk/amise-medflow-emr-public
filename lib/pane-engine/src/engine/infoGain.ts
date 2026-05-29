import type { DiseaseNode, Feature, PaneState, RankedDiagnosis } from '../types.js';
import { updatePosterior } from './bayes.js';
import { CONVERGENCE_THRESHOLD, DEFAULT_SENSITIVITY, MAX_QUESTIONS } from '../constants.js';

function entropy(posteriors: Record<string, number>): number {
  return -Object.values(posteriors)
    .filter(p => p > 0)
    .reduce((sum, p) => sum + p * Math.log(p), 0);
}

function marginalPresent(state: PaneState, diseases: DiseaseNode[], featureId: string): number {
  return diseases.reduce((sum, d) => {
    const sens = d.features[featureId] ?? DEFAULT_SENSITIVITY;
    return sum + sens * (state.posteriors[d.id] ?? 0);
  }, 0);
}

function informationGain(
  state: PaneState,
  diseases: DiseaseNode[],
  featureId: string,
): number {
  const hCurrent = entropy(state.posteriors);
  const pPresent = marginalPresent(state, diseases, featureId);
  const pAbsent = 1 - pPresent;
  const hIfPresent = entropy(updatePosterior(state, diseases, featureId, true).posteriors);
  const hIfAbsent = entropy(updatePosterior(state, diseases, featureId, false).posteriors);
  return hCurrent - (pPresent * hIfPresent + pAbsent * hIfAbsent);
}

/**
 * Select the unanswered feature that maximises expected entropy reduction.
 * Returns null when the engine has converged or hit the question cap.
 */
export function nextBestQuestion(
  state: PaneState,
  diseases: DiseaseNode[],
  features: Feature[],
): Feature | null {
  const maxPosterior = Math.max(...Object.values(state.posteriors));
  if (maxPosterior >= CONVERGENCE_THRESHOLD) return null;
  if (state.iteration >= MAX_QUESTIONS) return null;

  const unanswered = features.filter(f => !(f.id in state.answered));
  if (unanswered.length === 0) return null;

  let best: Feature | null = null;
  let bestIG = -Infinity;

  for (const feature of unanswered) {
    const ig = informationGain(state, diseases, feature.id);
    if (ig > bestIG) {
      bestIG = ig;
      best = feature;
    }
  }
  return best;
}

/** True when the leading posterior has crossed the threshold or questions are exhausted. */
export function isConverged(state: PaneState): boolean {
  const maxPosterior = Math.max(...Object.values(state.posteriors));
  return maxPosterior >= CONVERGENCE_THRESHOLD || state.iteration >= MAX_QUESTIONS;
}

/**
 * Return the top-n diagnoses ranked by posterior probability,
 * excluding the catch-all `_other_` node.
 */
export function topDiagnoses(
  state: PaneState,
  diseases: DiseaseNode[],
  n = 3,
): RankedDiagnosis[] {
  return diseases
    .filter(d => d.id !== '_other_')
    .map(d => ({ disease: d, probability: state.posteriors[d.id] ?? 0 }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, n);
}
