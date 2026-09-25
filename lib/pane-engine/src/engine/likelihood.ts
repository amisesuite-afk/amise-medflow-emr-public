import type { DiseaseCourse, DiseaseNode } from '../types.js';
import { DEFAULT_BASE_RATE, MAX_LIKELIHOOD, MIN_LIKELIHOOD } from '../constants.js';
import { getFeatureBaseRate } from '../vademecum/registry.js';

/**
 * P(feature present | disease) as the engine uses it.
 *
 *   1. The disease's own value when it lists the feature.
 *   2. A derived value for umbrella features (below) — e.g. "abdominal pain" for a disease that
 *      lists right-iliac-fossa pain is at least as likely as that site-specific pain.
 *   3. Otherwise the feature's background rate (`Feature.baseRate`, else DEFAULT_BASE_RATE): the
 *      finding is neutral for a disease that does not model it.
 */

/**
 * Umbrella features: present whenever any of the listed specific features is present, so
 * P(umbrella | D) = 1 − Π(1 − P(specific_i | D)) over the specific features D lists.
 */
export const UMBRELLA_FEATURES: Record<string, string[]> = {
  abdominal_pain: [
    'rlq_pain', 'ruq_pain', 'epigastric_pain', 'lif_pain', 'luq_pain', 'pelvic_pain', 'suprapubic_pain',
    'loin_pain', 'periumbilical_pain', 'diffuse_abdominal_pain', 'colicky_pain',
  ],
  chest_pain: ['chest_pain_pressure', 'pleuritic_chest_pain', 'chest_pain_oesophageal'],
  dyspnoea: ['dyspnoea_pe', 'orthopnoea'],
  dysphagia: ['dysphagia_progressive', 'dysphagia_solids', 'dysphagia_liquids'],
  fever: ['postop_fever'],
  nausea_vomiting: ['vomiting_effortless', 'bilious_vomiting', 'haematemesis'],
  leg_swelling: ['bilateral_leg_oedema'],
  syncope: ['loss_of_consciousness'],
  anal_pain: ['pain_on_defaecation'],
  constipation: ['absolute_constipation'],
  diarrhoea: ['bloody_diarrhoea'],
  haematuria: ['visible_haematuria', 'painless_haematuria'],
  focal_weakness: ['facial_weakness', 'limb_weakness'],
  non_blanching_rash: ['palpable_purpura'],
  groin_swelling: ['inguinal_nodes'],
  hyperglycaemia: ['very_high_glucose'],
  headache: ['thunderclap_headache'],
  upper_gi_bleeding: ['haematemesis', 'melaena'],
  rash: ['non_blanching_rash', 'urticaria_angioedema', 'palpable_purpura'],
};

/**
 * Conjunction features: present only when all parts are, so for a disease that does not list the
 * feature P = Π P(part | D) (e.g. post-operative fever = fever AND recent surgery; a pneumonia
 * after surgery is then scored on its fever, not on a near-zero background rate).
 */
export const CONJUNCTION_FEATURES: Record<string, string[]> = {
  postop_fever: ['fever', 'recent_surgery'],
  vomiting_post_trauma: ['nausea_vomiting', 'trauma_mechanism'],
};

/** Onset features scored from the disease's usual course when it does not list them. */
const COURSE_LIKELIHOOD: Record<'acute_onset' | 'chronic_course', Record<DiseaseCourse, number>> = {
  // acute_onset: symptoms began within the last 7 days
  acute_onset: { acute: 0.9, subacute: 0.45, chronic: 0.1, any: 0.4 },
  // chronic_course: symptoms for a month or more
  chronic_course: { acute: 0.05, subacute: 0.35, chronic: 0.85, any: 0.3 },
};

export function baseRate(featureId: string): number {
  return getFeatureBaseRate(featureId) ?? DEFAULT_BASE_RATE;
}

function clamp(p: number): number {
  return Math.min(MAX_LIKELIHOOD, Math.max(MIN_LIKELIHOOD, p));
}

function derived(disease: DiseaseNode, featureId: string): number | undefined {
  const parts = UMBRELLA_FEATURES[featureId];
  if (parts) {
    let pNone = 1;
    let any = false;
    for (const part of parts) {
      const p = disease.features[part];
      if (typeof p === 'number') { pNone *= 1 - p; any = true; }
    }
    if (any) return Math.max(1 - pNone, baseRate(featureId));
  }
  const conj = CONJUNCTION_FEATURES[featureId];
  if (conj) {
    return conj.reduce((p, part) => p * featureLikelihood(disease, part), 1);
  }
  if (featureId === 'acute_onset' || featureId === 'chronic_course') {
    return COURSE_LIKELIHOOD[featureId][disease.course ?? 'any'];
  }
  return undefined;
}

export function featureLikelihood(disease: DiseaseNode, featureId: string): number {
  const own = disease.features[featureId];
  if (typeof own === 'number') return clamp(own);
  return clamp(derived(disease, featureId) ?? baseRate(featureId));
}
