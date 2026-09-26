import { describe, expect, it } from 'vitest';
import { initPaneState, updatePosterior } from '../engine/bayes.js';
import { topDiagnoses } from '../engine/infoGain.js';
import { applyModifiers } from '../engine/modifiers.js';
import { featureLikelihood } from '../engine/likelihood.js';
import { DISEASES } from '../vademecum/index.js';
import { getDiseaseSpecialty } from '../vademecum/registry.js';

/**
 * Condition-neutrality checks (pane model 1.0.0).
 *
 * A balanced set of textbook presentations — two per specialty group — goes through the engine
 * with the findings a clinician would record. The expected diagnosis must reach the top 3, and no
 * single specialty may take a disproportionate share of the top-1 answers. Before 1.0.0 surgical
 * nodes took the top slot for nearly every medical presentation (clinval C6).
 */
interface Case { name: string; age: number; sex: 'male' | 'female'; features: string[]; expect: string; group: string; pregnancyPossible?: boolean }

const CASES: Case[] = [
  // Cardiovascular
  { group: 'cardio', name: 'central crushing chest pain', age: 60, sex: 'male', expect: 'acs', features: ['chest_pain', 'chest_pain_pressure', 'radiation_arm_jaw', 'diaphoresis', 'nausea_vomiting', 'acute_onset', 'vascular_risk'] },
  { group: 'cardio', name: 'palpitations, irregular pulse', age: 72, sex: 'female', expect: 'atrial_fibrillation', features: ['palpitations', 'irregular_pulse', 'tachycardia', 'dyspnoea', 'acute_onset'] },
  // Respiratory
  { group: 'resp', name: 'productive cough and fever', age: 45, sex: 'female', expect: 'pneumonia', features: ['cough', 'productive_cough', 'fever', 'dyspnoea', 'crackles', 'acute_onset'] },
  { group: 'resp', name: 'wheeze in a known asthmatic', age: 24, sex: 'male', expect: 'asthma_exacerbation', features: ['wheeze', 'dyspnoea', 'cough', 'known_asthma', 'tachycardia', 'acute_onset'] },
  // Neurology
  { group: 'neuro', name: 'sudden facial droop and arm weakness', age: 70, sex: 'male', expect: 'stroke', features: ['facial_weakness', 'limb_weakness', 'focal_weakness', 'speech_disturbance', 'sudden_onset', 'vascular_risk'] },
  { group: 'neuro', name: 'fever, headache, neck stiffness', age: 19, sex: 'female', expect: 'meningitis', features: ['fever', 'headache', 'neck_stiffness', 'photophobia', 'confusion', 'acute_onset'] },
  // Metabolic / endocrine
  { group: 'metabolic', name: 'thirst, vomiting, ketones', age: 17, sex: 'female', expect: 'dka', features: ['polyuria_polydipsia', 'nausea_vomiting', 'abdominal_pain', 'hyperglycaemia', 'ketonaemia', 'tachypnoea', 'acute_onset'] },
  { group: 'metabolic', name: 'confusion and sweating on gliclazide', age: 78, sex: 'male', expect: 'hypoglycaemia', features: ['confusion', 'diaphoresis', 'low_glucose', 'known_diabetes', 'insulin_or_sulfonylurea', 'acute_onset'] },
  // Renal / urology
  { group: 'urology', name: 'loin pain, fever, dysuria', age: 32, sex: 'female', expect: 'pyelonephritis', features: ['loin_pain', 'fever', 'rigors', 'dysuria', 'renal_angle_tenderness', 'acute_onset'] },
  { group: 'urology', name: 'sudden testicular pain and vomiting', age: 15, sex: 'male', expect: 'testicular_torsion', features: ['testicular_pain', 'sudden_onset', 'nausea_vomiting', 'absent_cremasteric', 'acute_onset'] },
  // Obstetric / gynaecological
  { group: 'obstetric', name: 'pelvic pain with a missed period', age: 27, sex: 'female', pregnancyPossible: true, expect: 'ectopic_pregnancy', features: ['pelvic_pain', 'missed_period', 'abnormal_uterine_bleeding', 'positive_pregnancy_test', 'acute_onset'] },
  { group: 'obstetric', name: 'headache and high BP at 34 weeks', age: 31, sex: 'female', pregnancyPossible: true, expect: 'pre_eclampsia', features: ['pregnant', 'headache', 'raised_bp', 'severe_hypertension', 'proteinuria', 'visual_disturbance', 'acute_onset'] },
  // Paediatric
  { group: 'paeds', name: 'bilious vomiting in a neonate', age: 0, sex: 'male', expect: 'malrotation_volvulus', features: ['bilious_vomiting', 'nausea_vomiting', 'poor_feeding', 'abdominal_distension', 'acute_onset'] },
  { group: 'paeds', name: 'projectile vomiting at 5 weeks', age: 0, sex: 'male', expect: 'pyloric_stenosis', features: ['projectile_vomiting', 'nausea_vomiting', 'hungry_after_vomiting', 'dehydration', 'failure_to_thrive'] },
  // General surgery / HPB
  { group: 'gensurg', name: 'migratory RIF pain', age: 22, sex: 'male', expect: 'appendicitis', features: ['rlq_pain', 'pain_migration', 'anorexia', 'nausea_vomiting', 'fever', 'rebound_tenderness', 'acute_onset'] },
  { group: 'gensurg', name: 'RUQ pain with Murphy sign', age: 45, sex: 'female', expect: 'cholecystitis', features: ['ruq_pain', 'murphy_sign', 'fever', 'nausea_vomiting', 'us_gallstones', 'acute_onset'] },
  // Colorectal / upper GI
  { group: 'gi', name: 'haematemesis and melaena', age: 60, sex: 'male', expect: 'upper_gi_bleed', features: ['haematemesis', 'melaena', 'nsaid_use', 'tachycardia', 'anaemia', 'acute_onset'] },
  { group: 'gi', name: 'progressive dysphagia with weight loss', age: 68, sex: 'male', expect: 'oesophageal_carcinoma', features: ['dysphagia', 'dysphagia_progressive', 'weight_loss', 'chronic_course'] },
  // Vascular
  { group: 'vascular', name: 'cold pulseless leg in AF', age: 75, sex: 'female', expect: 'acute_limb_ischaemia', features: ['limb_pain', 'cold_limb', 'pale_limb', 'absent_pulses', 'sudden_onset', 'irregular_pulse', 'acute_onset'] },
  { group: 'vascular', name: 'back pain, pulsatile mass, shock', age: 74, sex: 'male', expect: 'aortic_aneurysm', features: ['abdominal_pain', 'back_pain', 'pulsatile_mass', 'hypotension', 'tachycardia', 'sudden_onset'] },
  // Breast / endocrine neck
  { group: 'breast', name: 'hard fixed breast lump', age: 58, sex: 'female', expect: 'invasive_ductal_carcinoma', features: ['breast_lump', 'breast_lump_hard', 'skin_dimpling', 'axillary_nodes', 'chronic_course'] },
  { group: 'breast', name: 'thyroid swelling moving on swallowing', age: 40, sex: 'female', expect: 'thyroid_nodule_benign', features: ['neck_lump', 'thyroid_swelling', 'chronic_course'] },
  // Infection / acute medicine
  { group: 'acutemed', name: 'hypotensive, tachycardic, confused, febrile', age: 80, sex: 'female', expect: 'sepsis', features: ['fever', 'tachycardia', 'tachypnoea', 'hypotension', 'confusion', 'raised_lactate', 'acute_onset'] },
  { group: 'acutemed', name: 'urticaria and wheeze after amoxicillin', age: 35, sex: 'female', expect: 'anaphylaxis', features: ['urticaria_angioedema', 'allergen_exposure', 'wheeze', 'dyspnoea', 'hypotension', 'sudden_onset'] },
  // Trauma / soft tissue
  { group: 'soft', name: 'spreading red painful leg', age: 50, sex: 'male', expect: 'cellulitis', features: ['erythema_surrounding', 'spreading_redness', 'localised_pain', 'fever', 'leg_swelling', 'acute_onset'] },
  { group: 'soft', name: 'fall with pleuritic chest-wall pain', age: 67, sex: 'female', expect: 'rib_fractures', features: ['trauma_mechanism', 'mechanism_blunt', 'chest_wall_tenderness', 'pleuritic_chest_pain', 'acute_onset'] },
];

function run(c: Case) {
  const diseases = applyModifiers(DISEASES, c.age, c.sex, undefined, { pregnancyPossible: c.pregnancyPossible });
  let s = initPaneState(diseases);
  for (const f of c.features) s = updatePosterior(s, diseases, f, true);
  return topDiagnoses(s, diseases, 3);
}

describe('PANE condition neutrality', () => {
  for (const c of CASES) {
    it(`${c.group}: ${c.name} → ${c.expect} in the top 3`, () => {
      expect(run(c).map(r => r.disease.id)).toContain(c.expect);
    });
  }

  it('no single specialty dominates the top-1 answers of the balanced set', () => {
    const top1 = CASES.map(c => getDiseaseSpecialty(run(c)[0].disease.id));
    const counts = new Map<string, number>();
    for (const s of top1) counts.set(s, (counts.get(s) ?? 0) + 1);
    const max = Math.max(...counts.values());
    // 26 cases over 13 groups (2 each); a specialty may legitimately own ≤ 4 (e.g. vascular + trauma cases).
    expect(max).toBeLessThanOrEqual(4);
    expect(counts.size).toBeGreaterThanOrEqual(10);
  });

  it('with no findings, the leading priors span several specialties', () => {
    const diseases = applyModifiers(DISEASES, 45, 'male');
    const top10 = topDiagnoses(initPaneState(diseases), diseases, 10);
    const specialties = new Set(top10.map(r => getDiseaseSpecialty(r.disease.id)));
    expect(specialties.size).toBeGreaterThanOrEqual(5);
  });

  it('an unmodelled finding is neutral (its background rate) for every disease that does not list it', () => {
    const cholecystitis = DISEASES.find(d => d.id === 'cholecystitis')!;
    const acs = DISEASES.find(d => d.id === 'acs')!;
    // Before 1.0.0 every unlisted finding scored 0.30 for every disease.
    expect(featureLikelihood(cholecystitis, 'chest_pain_pressure')).toBeLessThan(0.05);
    expect(featureLikelihood(acs, 'murphy_sign')).toBeLessThan(0.05);
  });
});

describe('prior modifiers and applicability', () => {
  it('inguinal hernia: bounded male/female likelihood ratios (×1.8 / ×0.2), not ×5 / ×0.3', () => {
    const base = DISEASES.find(d => d.id === 'inguinal_hernia')!.prior;
    const total = DISEASES.reduce((s, d) => s + d.prior, 0);
    const male = applyModifiers(DISEASES, null, 'male').find(d => d.id === 'inguinal_hernia')!.prior;
    const ratio = male / (base / total);
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(2.2);
  });

  it('pregnancy-only diagnoses are never offered to male patients', () => {
    const d = applyModifiers(DISEASES, 30, 'male');
    for (const id of ['ectopic_pregnancy', 'pre_eclampsia', 'placental_abruption', 'hyperemesis_gravidarum']) {
      expect(d.find(x => x.id === id)!.prior).toBe(0);
    }
  });

  it('pregnancy-only diagnoses stay available when "pregnancy possible" is not ticked, and rise when it is', () => {
    const off = applyModifiers(DISEASES, 28, 'female').find(x => x.id === 'ectopic_pregnancy')!.prior;
    const on = applyModifiers(DISEASES, 28, 'female', undefined, { pregnancyPossible: true }).find(x => x.id === 'ectopic_pregnancy')!.prior;
    expect(off).toBeGreaterThan(0);
    expect(on).toBeGreaterThan(off * 3);
  });

  it('infant-only and child-only nodes follow their age range; unknown age never excludes', () => {
    expect(applyModifiers(DISEASES, 40, 'male').find(x => x.id === 'pyloric_stenosis')!.prior).toBe(0);
    expect(applyModifiers(DISEASES, 0, 'male').find(x => x.id === 'pyloric_stenosis')!.prior).toBeGreaterThan(0);
    expect(applyModifiers(DISEASES, null, 'male').find(x => x.id === 'pyloric_stenosis')!.prior).toBeGreaterThan(0);
    expect(applyModifiers(DISEASES, 30, 'female').find(x => x.id === 'copd_exacerbation')!.prior).toBe(0);
  });

  it('a disease the patient is outside of is never listed', () => {
    const diseases = applyModifiers(DISEASES, 30, 'male');
    let s = initPaneState(diseases);
    for (const f of ['pelvic_pain', 'missed_period', 'positive_pregnancy_test']) s = updatePosterior(s, diseases, f, true);
    expect(topDiagnoses(s, diseases, 10).map(r => r.disease.id)).not.toContain('ectopic_pregnancy');
  });
});
