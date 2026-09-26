import type { DiseaseNode } from '../types.js';

/**
 * Likelihoods of the evidence features (examination signs and decision-rule bands, evidence/
 * register.ts). They are not listed in the disease nodes: each feature carries a function of the
 * disease, built from the catalogue's likelihood ratios.
 */
export type EvidenceLikelihood = (disease: DiseaseNode) => number;

const likelihoods = new Map<string, EvidenceLikelihood>();

export function registerEvidenceLikelihood(featureId: string, fn: EvidenceLikelihood): void {
  likelihoods.set(featureId, fn);
}

/** P(evidence feature present | disease), or undefined for an ordinary feature. */
export function evidenceLikelihood(disease: DiseaseNode, featureId: string): number | undefined {
  const fn = likelihoods.get(featureId);
  return fn ? fn(disease) : undefined;
}
