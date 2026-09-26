import type { DiseaseCourse, DiseaseNode } from '../types.js';
import { DEFAULT_BASE_RATE, MAX_LIKELIHOOD, MIN_LIKELIHOOD } from '../constants.js';
import { getFeatureBaseRate } from '../vademecum/registry.js';
import { evidenceLikelihood } from './evidenceLikelihood.js';

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
  change_bowel_habit: ['diarrhoea', 'constipation', 'bloody_diarrhoea'],
  pallor: ['pale_clammy'],
  hernia_swelling: ['groin_swelling', 'umbilical_swelling', 'incisional_swelling', 'epigastric_swelling', 'parastomal_bulge'],
  hernia_compressible: ['groin_lump_reducible'],
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
  return correlated(disease, featureId);
}

/**
 * Findings that travel together. A disease that models fever or a raised white count but not the
 * CRP, or abdominal pain but not abdominal tenderness, would otherwise be scored at the
 * background rate for a finding it almost always has — penalising the diseases whose node lists
 * fewer items (clinval: acalculous cholecystitis lost to sepsis on CRP and heart rate alone).
 * Each value is capped by the finding it is derived from and floored at the background rate.
 */
function correlated(disease: DiseaseNode, featureId: string): number | undefined {
  const f = disease.features;
  const own = (id: string): number | undefined => (typeof f[id] === 'number' ? f[id] : undefined);
  const floor = (p: number | undefined) => (p === undefined ? undefined : Math.max(p, baseRate(featureId)));
  switch (featureId) {
    case 'raised_crp': {
      const src = own('elevated_wbc') ?? own('fever');
      return floor(src === undefined ? undefined : Math.min(0.95, src + 0.1));
    }
    case 'elevated_wbc': {
      const src = own('raised_crp') ?? own('fever');
      return floor(src === undefined ? undefined : Math.max(0, src - 0.1));
    }
    case 'tachycardia': {
      // Acute febrile illness: tachycardia in roughly half (NEWS2 / Sepsis-3 cohorts)
      const fever = own('fever');
      return floor(fever === undefined ? undefined : 0.15 + 0.5 * fever);
    }
    case 'abdominal_tenderness': {
      const parts = UMBRELLA_FEATURES.abdominal_pain.filter(id => id !== 'colicky_pain' && own(id) !== undefined);
      if (!parts.length && own('abdominal_pain') === undefined) return undefined;
      return floor(0.8 * featureLikelihood(disease, 'abdominal_pain'));
    }
    case 'anorexia': {
      const parts = UMBRELLA_FEATURES.abdominal_pain.filter(id => own(id) !== undefined);
      return parts.length && disease.course === 'acute' ? floor(0.35) : undefined;
    }
    default:
      return undefined;
  }
}

export function featureLikelihood(disease: DiseaseNode, featureId: string): number {
  const own = disease.features[featureId];
  if (typeof own === 'number') return clamp(own);
  // Examination signs and decision-rule bands (evidence/register.ts): likelihoods from the
  // catalogue's likelihood ratios.
  const evidence = evidenceLikelihood(disease, featureId);
  if (evidence !== undefined) return clamp(evidence);
  return clamp(derived(disease, featureId) ?? baseRate(featureId));
}
