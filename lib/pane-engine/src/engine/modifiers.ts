import type { Applicability, DiseaseNode, PatientContext } from '../types.js';

export interface PriorModifier {
  diseaseId: string;
  /** Multiplicative adjustment — e.g. 2.0 doubles the prior. */
  multiplier: number;
  condition: {
    /** Only apply when sex matches exactly. 'unknown' never matches. */
    sex?: 'male' | 'female';
    /** Only apply when age >= ageMin (skipped if age is null). */
    ageMin?: number;
    /** Only apply when age <= ageMax (skipped if age is null). */
    ageMax?: number;
  };
}

/**
 * How a prior modifier is derived (pane model 1.0.0).
 *
 * A node's prior is its base rate in the whole (mixed-sex, all-age) population it applies to.
 * Learning the patient's sex or age band multiplies it by the likelihood ratio
 * P(sex or age band | disease) / P(sex or age band). For sex that ratio can never exceed 2 (a
 * disease seen only in one sex): a disease with a male:female ratio r gets 2r/(1+r) for men and
 * 2/(1+r) for women. Before 1.0.0 the table used unbounded multipliers (inguinal hernia ×5 in
 * men, gynaecological ×2.5 in women, cholecystitis ×2 in women), which let a surgical node lead
 * every differential in men with few findings (clinval C6).
 *
 * Sex-only and pregnancy-only diseases are handled by `applicability` on the node (prior 0 when
 * not applicable), not by a multiplier here.
 */
function sexRatio(diseaseId: string, maleToFemale: number): PriorModifier[] {
  return [
    { diseaseId, multiplier: (2 * maleToFemale) / (1 + maleToFemale), condition: { sex: 'male' } },
    { diseaseId, multiplier: 2 / (1 + maleToFemale), condition: { sex: 'female' } },
  ];
}

/** Adult-predominant diseases: very rarely the answer before 16 (children's epidemiology). */
const ADULT_PREDOMINANT = [
  'cholecystitis', 'biliary_colic', 'choledocholithiasis', 'cholangitis', 'pancreatitis', 'gord', 'peptic_ulcer',
  'perforated_peptic_ulcer', 'gastritis', 'diverticulitis', 'colorectal_cancer', 'rectal_carcinoma', 'anal_cancer',
  'haemorrhoids', 'anal_fissure', 'oesophageal_carcinoma', 'gastric_carcinoma', 'pancreatic_carcinoma',
  'cholangiocarcinoma', 'hepatocellular_carcinoma', 'gallbladder_carcinoma', 'barretts_oesophagus', 'hiatus_hernia',
  'achalasia', 'mallory_weiss', 'upper_gi_bleed', 'variceal_bleed', 'gastric_outlet_obstruction', 'oesophageal_stricture',
  'bowel_obstruction', 'sigmoid_volvulus', 'ischaemic_colitis', 'mesenteric_ischaemia', 'aortic_aneurysm',
  'aortic_dissection', 'acute_limb_ischaemia', 'peripheral_arterial_disease', 'acs', 'atrial_fibrillation',
  'acute_heart_failure', 'hypertensive_emergency', 'copd_exacerbation', 'stroke', 'tia', 'cauda_equina', 'mscc',
  'hhs', 'bph', 'urinary_retention', 'bladder_carcinoma', 'renal_colic', 'fournier_gangrene', 'varicose_veins',
  'chronic_venous_insufficiency', 'venous_ulcer', 'arterial_ulcer', 'invasive_ductal_carcinoma', 'dcis',
  'thyroid_carcinoma', 'anaplastic_thyroid', 'primary_hyperparathyroidism', 'parathyroid_adenoma',
  'diabetic_foot_infection', 'charcot_foot', 'incisional_hernia', 'femoral_hernia', 'obturator_hernia',
  'melanoma', 'bcc', 'scc_skin', 'hypercalcaemia', 'hyperkalaemia', 'hyponatraemia', 'aki', 'cdiff_colitis',
  'uterine_fibroids', 'endometriosis', 'cervical_carcinoma', 'ovarian_carcinoma', 'uterine_carcinoma',
];

/**
 * Evidence-informed prior modifiers (pane model 1.0.0). Sources per line; where a ratio is an
 * approximation of a published range it says so. Multiple matching modifiers compound.
 */
export const PRIOR_MODIFIERS: PriorModifier[] = [
  // Children: adult-predominant diseases ×0.05 under 16 (APLS 2016 / paediatric surgical
  // epidemiology: gallstones, diverticular disease, carcinoma, vascular disease are rare in children).
  ...ADULT_PREDOMINANT.map(diseaseId => ({ diseaseId, multiplier: 0.05, condition: { ageMax: 15 } })),

  // Appendicitis — peak 10–35 y; M:F ≈ 1.4:1 (Addiss et al., Am J Epidemiol 1990); uncommon < 4 y
  { diseaseId: 'appendicitis', multiplier: 2.2, condition: { ageMin: 10, ageMax: 35 } },
  { diseaseId: 'appendicitis', multiplier: 0.2, condition: { ageMax: 3 } },
  { diseaseId: 'appendicitis', multiplier: 0.5, condition: { ageMin: 60 } },
  ...sexRatio('appendicitis', 1.4),

  // Gallstone disease — F:M ≈ 2:1 (NICE CG188 2014 background); peak 30–70 y
  ...sexRatio('cholecystitis', 0.5),
  ...sexRatio('biliary_colic', 0.5),
  { diseaseId: 'cholecystitis', multiplier: 1.6, condition: { ageMin: 30, ageMax: 70 } },
  { diseaseId: 'biliary_colic', multiplier: 1.6, condition: { ageMin: 30, ageMax: 70 } },

  // Colorectal cancer — extremely rare < 40; exponential rise after 50 (NICE NG12 2015 age bands)
  { diseaseId: 'colorectal_cancer', multiplier: 0.08, condition: { ageMin: 0, ageMax: 40 } },
  { diseaseId: 'colorectal_cancer', multiplier: 2.5, condition: { ageMin: 50, ageMax: 64 } },
  { diseaseId: 'colorectal_cancer', multiplier: 4.0, condition: { ageMin: 65 } },
  { diseaseId: 'rectal_carcinoma', multiplier: 0.1, condition: { ageMin: 0, ageMax: 40 } },
  { diseaseId: 'rectal_carcinoma', multiplier: 3.0, condition: { ageMin: 55 } },
  { diseaseId: 'anal_cancer', multiplier: 0.2, condition: { ageMin: 0, ageMax: 40 } },
  { diseaseId: 'anal_cancer', multiplier: 2.0, condition: { ageMin: 50 } },

  // Upper GI and pancreatic cancer — NICE NG12 uses age ≥ 55 as the risk threshold
  ...(['oesophageal_carcinoma', 'gastric_carcinoma', 'pancreatic_carcinoma', 'cholangiocarcinoma'] as const).flatMap(id => ([
    { diseaseId: id, multiplier: 0.1, condition: { ageMin: 0, ageMax: 40 } },
    { diseaseId: id, multiplier: 3.0, condition: { ageMin: 55 } },
  ])),

  // Groin hernias — inguinal lifetime risk ≈ 27 % men vs 3 % women (Primatesta & Goldacre, Int J
  // Epidemiol 1996) → M:F ≈ 9:1 → ×1.8 men / ×0.2 women (was ×5 / ×0.3). Femoral F:M ≈ 4:1
  // (EHS / HerniaSurge 2018). Inguinal hernia is also common in infants (prematurity).
  ...sexRatio('inguinal_hernia', 9),
  { diseaseId: 'inguinal_hernia', multiplier: 1.8, condition: { ageMin: 50 } },
  ...sexRatio('femoral_hernia', 0.25),
  { diseaseId: 'femoral_hernia', multiplier: 2.0, condition: { ageMin: 60 } },
  ...sexRatio('obturator_hernia', 0.15),
  // Incarcerated hernia: bimodal — infants (inguinal) and older adults
  { diseaseId: 'incarcerated_hernia', multiplier: 2.0, condition: { ageMax: 1 } },
  { diseaseId: 'incarcerated_hernia', multiplier: 1.8, condition: { ageMin: 60 } },
  { diseaseId: 'obturator_hernia', multiplier: 3.0, condition: { ageMin: 70 } },

  // Diverticulitis — uncommon < 40; sharply higher after 60
  { diseaseId: 'diverticulitis', multiplier: 0.15, condition: { ageMin: 0, ageMax: 40 } },
  { diseaseId: 'diverticulitis', multiplier: 2.0, condition: { ageMin: 60, ageMax: 79 } },
  { diseaseId: 'diverticulitis', multiplier: 3.5, condition: { ageMin: 80 } },
  { diseaseId: 'sigmoid_volvulus', multiplier: 3.0, condition: { ageMin: 65 } },

  // GORD — prevalence rises with age (sex ratio ≈ 1: the old ×1.3 male modifier removed)
  { diseaseId: 'gord', multiplier: 1.4, condition: { ageMin: 45 } },

  // Cholangitis — rises sharply after 60
  { diseaseId: 'cholangitis', multiplier: 1.8, condition: { ageMin: 60 } },

  // Breast — ≈ 1 % of breast cancers occur in men (ACS 2023 facts & figures): P(sex | D) / 0.5
  ...(['fibroadenoma', 'fibrocystic_change', 'invasive_ductal_carcinoma', 'dcis',
       'phyllodes_tumour', 'mastitis', 'breast_abscess', 'fat_necrosis_breast',
       'duct_ectasia'] as const).flatMap(id => sexRatio(id, 0.01)),
  { diseaseId: 'invasive_ductal_carcinoma', multiplier: 0.1, condition: { ageMin: 0, ageMax: 30 } },
  { diseaseId: 'invasive_ductal_carcinoma', multiplier: 2.0, condition: { ageMin: 50 } },

  // Cardiovascular — ESC 2023 ACS / ESC 2024 AF / ESC 2021 HF epidemiology: M:F ≈ 2:1 for ACS,
  // incidence rises steeply with age for all three
  ...sexRatio('acs', 2),
  { diseaseId: 'acs', multiplier: 0.1, condition: { ageMax: 30 } },
  { diseaseId: 'acs', multiplier: 2.0, condition: { ageMin: 55 } },
  { diseaseId: 'atrial_fibrillation', multiplier: 0.2, condition: { ageMax: 40 } },
  { diseaseId: 'atrial_fibrillation', multiplier: 3.0, condition: { ageMin: 65 } },
  { diseaseId: 'acute_heart_failure', multiplier: 0.1, condition: { ageMax: 40 } },
  { diseaseId: 'acute_heart_failure', multiplier: 3.0, condition: { ageMin: 65 } },
  { diseaseId: 'cardiac_syncope', multiplier: 2.0, condition: { ageMin: 60 } },
  ...sexRatio('aortic_dissection', 2),
  { diseaseId: 'aortic_dissection', multiplier: 0.2, condition: { ageMax: 40 } },
  { diseaseId: 'aortic_dissection', multiplier: 2.0, condition: { ageMin: 60 } },

  // AAA — M:F ≈ 4:1; a disease of the over-65s (NICE NG156 2020)
  ...sexRatio('aortic_aneurysm', 4),
  { diseaseId: 'aortic_aneurysm', multiplier: 0.1, condition: { ageMax: 54 } },
  { diseaseId: 'aortic_aneurysm', multiplier: 3.0, condition: { ageMin: 65 } },
  { diseaseId: 'mesenteric_ischaemia', multiplier: 0.1, condition: { ageMax: 40 } },
  { diseaseId: 'mesenteric_ischaemia', multiplier: 2.5, condition: { ageMin: 60 } },
  { diseaseId: 'acute_limb_ischaemia', multiplier: 2.0, condition: { ageMin: 60 } },
  { diseaseId: 'peripheral_arterial_disease', multiplier: 2.0, condition: { ageMin: 60 } },

  // Neurology — stroke incidence doubles each decade after 55 (NICE NG128 2019 background;
  // Barbados Register of Strokes, Corbin et al. Stroke 2004, for the Caribbean burden)
  { diseaseId: 'stroke', multiplier: 0.2, condition: { ageMax: 44 } },
  { diseaseId: 'stroke', multiplier: 2.5, condition: { ageMin: 65 } },
  { diseaseId: 'tia', multiplier: 0.2, condition: { ageMax: 44 } },
  { diseaseId: 'tia', multiplier: 2.5, condition: { ageMin: 65 } },
  { diseaseId: 'meningitis', multiplier: 2.0, condition: { ageMax: 4 } },
  { diseaseId: 'meningitis', multiplier: 1.5, condition: { ageMin: 15, ageMax: 24 } },

  // Respiratory — pneumonia incidence highest at the extremes of age (BTS CAP 2009/2011)
  { diseaseId: 'pneumonia', multiplier: 1.5, condition: { ageMax: 4 } },
  { diseaseId: 'pneumonia', multiplier: 2.0, condition: { ageMin: 65 } },
  { diseaseId: 'sepsis', multiplier: 2.0, condition: { ageMax: 0.25 } },
  { diseaseId: 'sepsis', multiplier: 1.8, condition: { ageMin: 65 } },

  // Metabolic — HHS mainly older people with type 2 diabetes (JBDS-IP HHS 2022)
  { diseaseId: 'hhs', multiplier: 0.2, condition: { ageMax: 30 } },
  { diseaseId: 'hhs', multiplier: 2.0, condition: { ageMin: 60 } },

  // Urology — adult UTI/pyelonephritis F:M ≈ 4:1; stones M:F ≈ 2:1; retention M:F ≈ 13:1
  // (EAU Urological Infections 2024, EAU Urolithiasis 2024 background)
  ...sexRatio('uti', 0.25),
  ...sexRatio('pyelonephritis', 0.25),
  ...sexRatio('renal_colic', 2),
  ...sexRatio('urinary_retention', 13),
  ...sexRatio('bladder_carcinoma', 3),
  { diseaseId: 'urinary_retention', multiplier: 2.5, condition: { ageMin: 60 } },
  { diseaseId: 'bph', multiplier: 0.05, condition: { ageMax: 40 } },
  { diseaseId: 'bph', multiplier: 2.5, condition: { ageMin: 60 } },
  // Torsion — peak 12–18 y and neonates; uncommon after 35 (EAU Paediatric Urology 2024)
  { diseaseId: 'testicular_torsion', multiplier: 2.5, condition: { ageMin: 12, ageMax: 18 } },
  { diseaseId: 'testicular_torsion', multiplier: 0.3, condition: { ageMin: 35 } },

  // Thyroid — F:M ≈ 4:1 for nodules, ≈ 5:1 for Graves' (BTA 2014 / ATA 2015 background)
  ...sexRatio('thyroid_nodule_benign', 0.25),
  ...sexRatio('hyperthyroidism', 0.2),
  ...sexRatio('hashimoto_thyroiditis', 0.1),

  // Paediatric — intussusception peaks 5–9 months; HSP 90 % under 10 (NICE CKS / BSPGHAN)
  // Ages are whole years in the record (0 = under 1): the 3-month floor cannot be applied.
  { diseaseId: 'intussusception', multiplier: 3.0, condition: { ageMax: 2 } },
  { diseaseId: 'malrotation_volvulus', multiplier: 5.0, condition: { ageMax: 1 } },
  ...sexRatio('pyloric_stenosis', 4),
  { diseaseId: 'hsp_iga_vasculitis', multiplier: 3.0, condition: { ageMax: 10 } },
  { diseaseId: 'hsp_iga_vasculitis', multiplier: 0.1, condition: { ageMin: 20 } },
];

/** @deprecated Name kept for existing imports; the table is no longer surgical-OPD specific. */
export const SURGICAL_OPD_MODIFIERS = PRIOR_MODIFIERS;

/**
 * Pregnancy-only diseases when the clinician marks pregnancy as possible: roughly the inverse of
 * the share of women of reproductive age who are pregnant at a given time (≈ 1 in 5 once the
 * clinician has thought to tick "pregnancy possible"). Conservative — needs sign-off.
 */
export const PREGNANCY_POSSIBLE_MULTIPLIER = 5;

/**
 * False when the patient is outside the disease's applicability. Unknown age (null) or sex
 * ('unknown' / 'other') never excludes. Pregnancy-only diseases are excluded for male patients
 * and outside ages 10–55; an unticked "pregnancy possible" does NOT exclude them (it means "not
 * recorded", not "not pregnant").
 */
export function isApplicable(app: Applicability | undefined, age: number | null, sex: string): boolean {
  if (!app) return true;
  if (app.sex && (sex === 'male' || sex === 'female') && sex !== app.sex) return false;
  if (age !== null) {
    if (app.ageMin !== undefined && age < app.ageMin) return false;
    if (app.ageMax !== undefined && age > app.ageMax) return false;
  }
  if (app.pregnancy === 'required') {
    if (sex === 'male') return false;
    if (age !== null && (age < 10 || age > 55)) return false;
  }
  return true;
}

/**
 * Return a new diseases array with priors adjusted for the patient's age, sex and pregnancy
 * context, then renormalised so all priors sum to 1. Diseases the patient is outside of
 * (`applicability`) get a prior of 0.
 *
 * Age-conditional modifiers are skipped when age is null (unknown).
 * Sex-conditional modifiers are skipped when sex is 'unknown' or 'other'.
 */
export function applyModifiers(
  diseases: DiseaseNode[],
  age: number | null,
  sex: string,
  modifiers: PriorModifier[] = PRIOR_MODIFIERS,
  context: PatientContext = {},
): DiseaseNode[] {
  const adjusted = diseases.map(disease => {
    if (!isApplicable(disease.applicability, age, sex)) return { ...disease, prior: 0 };
    let mult = 1.0;
    for (const mod of modifiers) {
      if (mod.diseaseId !== disease.id) continue;
      const { sex: mSex, ageMin, ageMax } = mod.condition;
      // Skip age-dependent modifiers when age is unknown
      const isAgeCond = ageMin !== undefined || ageMax !== undefined;
      if (isAgeCond && age === null) continue;
      if (ageMin !== undefined && age! < ageMin) continue;
      if (ageMax !== undefined && age! > ageMax) continue;
      // Skip sex-dependent modifiers when sex is not binary-known
      if (mSex !== undefined && sex !== mSex) continue;
      mult *= mod.multiplier;
    }
    if (disease.applicability?.pregnancy === 'required' && context.pregnancyPossible) {
      mult *= PREGNANCY_POSSIBLE_MULTIPLIER;
    }
    return { ...disease, prior: Math.max(1e-9, disease.prior * mult) };
  });

  const total = adjusted.reduce((s, d) => s + d.prior, 0);
  return total > 0 ? adjusted.map(d => ({ ...d, prior: d.prior / total })) : adjusted;
}
