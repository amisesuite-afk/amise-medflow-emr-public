import type { DiseaseNode, PaneState } from '../types.js';
import { featureLikelihood } from './likelihood.js';

function normalize(raw: Record<string, number>): Record<string, number> {
  const total = Object.values(raw).reduce((sum, p) => sum + p, 0);
  if (total === 0) return raw;
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v / total]));
}


/**
 * Return initial PaneState with posteriors set to normalised priors.
 */
export function initPaneState(diseases: DiseaseNode[]): PaneState {
  const raw: Record<string, number> = {};
  for (const d of diseases) raw[d.id] = d.prior;
  return { posteriors: normalize(raw), answered: {}, iteration: 0 };
}

/**
 * Apply a single Bayesian observation and return a new PaneState.
 *
 * P(D_i | F) ∝ P(F | D_i) × P(D_i)
 *
 * Where P(F=1 | D_i) = featureLikelihood(D_i, F) (likelihood.ts: the disease's own value, a
 * derived umbrella/onset value, or the feature's neutral background rate),
 * and   P(F=0 | D_i) = 1 - P(F=1 | D_i).
 */
export function updatePosterior(
  state: PaneState,
  diseases: DiseaseNode[],
  featureId: string,
  observed: boolean,
): PaneState {
  const raw: Record<string, number> = {};
  for (const d of diseases) {
    const prior = state.posteriors[d.id] ?? 0;
    const sens = featureLikelihood(d, featureId);
    const likelihood = observed ? sens : 1 - sens;
    raw[d.id] = prior * likelihood;
  }
  return {
    posteriors: normalize(raw),
    answered: { ...state.answered, [featureId]: observed },
    iteration: state.iteration + 1,
  };
}
