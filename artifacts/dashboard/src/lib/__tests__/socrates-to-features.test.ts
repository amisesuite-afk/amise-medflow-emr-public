/**
 * PANE feature mapper (pane model 1.0.0): SOCRATES answers plus the consultation context.
 */
import { describe, expect, it } from 'vitest';
import { FEATURES } from '@workspace/pane-engine';
import { extractFeaturesFromSocrates, paneContextFromConsultation, type PaneFeatureContext } from '../socrates-to-features';

const featureIds = new Set(FEATURES.map(f => f.id));
const withCtx = (ctx: PaneFeatureContext, cc = 'Other / general surgical', answers: Record<string, string> = {}) =>
  extractFeaturesFromSocrates(cc, answers, ctx);

describe('every feature the mapper can emit is a registered PANE feature', () => {
  it('a broad record maps only to known features', () => {
    const f = withCtx({
      age: 60, sex: 'male', symptoms: ['chest pain', 'haematemesis', 'black stool', 'dysphagia', 'bilious vomiting', 'headache', 'confusion', 'dysuria', 'hernia', 'abscess', 'rash'],
      symptomDetails: { 'chest pain': ['Crushing / pressure', 'Left arm'], vomiting: ['Projectile', 'Bile'], hernia: ['Irreducible'] },
      vitals: { temperatureC: '39', heartRate: '120', systolicBp: '85', respiratoryRate: '26', spo2: '90', glucoseMmol: '2.8', avpu: 'V' },
      comorbidities: ['Type 2 diabetes', 'Atrial fibrillation', 'CKD stage 3'], medications: ['Gliclazide', 'Apixaban', 'Ramipril'],
      investigationResults: { Potassium: '6.9 mmol/L', Troponin: '412 ng/L', 'CT abdomen': 'Free intraperitoneal gas.' },
      narrative: ['Fell at home yesterday. Pale and clammy.'],
    }, 'Upper GI bleed (haematemesis / melaena)', { site: 'Retrosternal', character: 'Pressure', lmp: '8 weeks ago' });
    expect(Object.keys(f).filter(id => !featureIds.has(id))).toEqual([]);
  });
});

describe('SOCRATES answers', () => {
  it('chest pressure at a chest site is cardiac-type chest pain; burning at an upper site is heartburn', () => {
    const chest = extractFeaturesFromSocrates('Other', { site: 'Retrosternal', character: 'Pressure', radiation: 'Left arm', associated: 'Diaphoresis, Nausea' });
    expect(chest).toMatchObject({ chest_pain: true, chest_pain_pressure: true, radiation_arm_jaw: true, diaphoresis: true, nausea_vomiting: true });
    expect(chest.fever).toBeUndefined(); // "sweat" no longer means fever
    expect(extractFeaturesFromSocrates('Other', { site: 'Epigastric', character: 'Burning' }).heartburn).toBe(true);
    expect(extractFeaturesFromSocrates('Other', { site: 'Perianal', character: 'Burning' }).heartburn).toBeUndefined();
  });

  it('"after meals" is post-prandial pain, not a fatty-food trigger', () => {
    const f = extractFeaturesFromSocrates('Acute abdominal pain', { timing: 'Post-prandial', triggers: 'Eating' });
    expect(f.postprandial_pain).toBe(true);
    expect(f.fatty_food_trigger).toBeUndefined();
    expect(extractFeaturesFromSocrates('Acute abdominal pain', { triggers: 'Fatty food' }).fatty_food_trigger).toBe(true);
  });

  it('site words mean pain for a pain, and a lump for a lump', () => {
    expect(extractFeaturesFromSocrates('Other', { site: 'Neck', character: 'Aching' })).toMatchObject({ neck_pain: true });
    expect(extractFeaturesFromSocrates('Other', { site: 'Neck', character: 'Aching' }).neck_lump).toBeUndefined();
    expect(extractFeaturesFromSocrates('Other', { site: 'Right inguinal', character: 'Firm' }).groin_swelling).toBe(true);
    expect(extractFeaturesFromSocrates('Other', { site: 'Groin', character: 'Sharp' }).groin_pain).toBe(true);
  });

  it('"Antacids did not help" is not antacid relief', () => {
    expect(extractFeaturesFromSocrates('GORD / heartburn', { relief: 'Antacids did not help' }).antacid_relief).toBeUndefined();
    expect(extractFeaturesFromSocrates('GORD / heartburn', { relief: 'Antacids' }).antacid_relief).toBe(true);
  });

  it('bleeding, dysphagia and vomiting type have rules', () => {
    const f = extractFeaturesFromSocrates('Other', { associated: 'Coffee-ground vomiting, black tarry stools, progressive difficulty swallowing, green bilious vomiting' });
    expect(f).toMatchObject({ haematemesis: true, melaena: true, dysphagia: true, dysphagia_progressive: true, bilious_vomiting: true });
    expect(extractFeaturesFromSocrates('Other', { associated: 'Non-bilious projectile vomiting' })).toMatchObject({ projectile_vomiting: true });
    expect(extractFeaturesFromSocrates('Other', { associated: 'Non-bilious projectile vomiting' }).bilious_vomiting).toBeUndefined();
  });

  it('an LMP 7 weeks ago is a missed period', () => {
    expect(extractFeaturesFromSocrates('Acute abdominal pain', { lmp: '7 weeks ago — missed period' }).missed_period).toBe(true);
  });

  it('onset answers set the course features', () => {
    expect(extractFeaturesFromSocrates('Other', { onset: 'Today, Sudden' })).toMatchObject({ acute_onset: true, sudden_onset: true });
    expect(extractFeaturesFromSocrates('Other', { onset: '1–6 months ago', timing: 'Progressive' })).toMatchObject({ chronic_course: true, progressive_course: true });
    // A "progressive" acute pain is not a progressive (months-long) course
    expect(extractFeaturesFromSocrates('Other', { onset: 'Today', timing: 'Progressive' }).progressive_course).toBeUndefined();
  });
});

describe('vital signs (adult and age-adjusted child thresholds)', () => {
  it('adult shock, fever, tachypnoea, hypoxia, hypoglycaemia and reduced AVPU', () => {
    const f = withCtx({ age: 50, vitals: { temperatureC: '38.4', heartRate: '124', systolicBp: '84', respiratoryRate: '24', spo2: '91', glucoseMmol: '3.1', avpu: 'V' } });
    expect(f).toMatchObject({ fever: true, tachycardia: true, hypotension: true, haemodynamic_instability: true, tachypnoea: true, hypoxia: true, low_glucose: true, gcs_drop: true, confusion: true });
  });

  it('normal adult vitals map to nothing', () => {
    const f = withCtx({ age: 50, vitals: { temperatureC: '36.8', heartRate: '80', systolicBp: '124', diastolicBp: '78', respiratoryRate: '14', spo2: '98' } });
    for (const id of ['fever', 'hypothermia', 'tachycardia', 'bradycardia', 'hypotension', 'raised_bp', 'tachypnoea', 'hypoxia']) expect(f[id]).toBeUndefined();
  });

  it('a heart rate of 150 is not tachycardia in an infant; 120 is in an adult', () => {
    expect(withCtx({ age: 0, vitals: { heartRate: '150' } }).tachycardia).toBeUndefined();
    expect(withCtx({ age: 30, vitals: { heartRate: '120' } }).tachycardia).toBe(true);
  });

  it('BP 165/112 is severe hypertension only when pregnancy is possible (NICE NG133)', () => {
    expect(withCtx({ age: 30, vitals: { systolicBp: '165', diastolicBp: '112' } }).severe_hypertension).toBeUndefined();
    expect(withCtx({ age: 30, pregnancyPossible: true, vitals: { systolicBp: '165', diastolicBp: '112' } }).severe_hypertension).toBe(true);
    expect(withCtx({ age: 60, vitals: { systolicBp: '210', diastolicBp: '125' } }).severe_hypertension).toBe(true);
  });
});

describe('history, results and free text', () => {
  it('reads comorbidities and medicines', () => {
    const f = withCtx({ comorbidities: ['Type 2 diabetes', 'COPD', 'AF'], medications: ['Empagliflozin', 'Warfarin', 'Co-amoxiclav'] });
    expect(f).toMatchObject({ known_diabetes: true, sglt2_inhibitor: true, known_copd: true, known_af: true, anticoagulant_use: true, recent_antibiotics: true });
  });

  it('reads numeric results by analyte name and findings in report text', () => {
    const f = withCtx({ investigationResults: { 'Serum potassium': '6.9 mmol/L', 'hs-Troponin T': '412 ng/L', 'Blood ketones': '5.2 mmol/L', ECG: 'ST elevation in II, III, aVF', 'CT abdomen': 'Pneumoperitoneum.' } });
    expect(f).toMatchObject({ hyperkalaemia_lab: true, raised_troponin: true, ketonaemia: true, st_elevation: true, free_gas: true });
    expect(withCtx({ investigationResults: { ECG: 'Sinus rhythm, no ST elevation' } }).st_elevation).toBeUndefined();
  });

  it('free text is negation-aware', () => {
    const f = withCtx({ narrative: ['No chest pain. Denies haematemesis. Vomiting after meals.'] });
    expect(f.chest_pain).toBeUndefined();
    expect(f.haematemesis).toBeUndefined();
    expect(f.nausea_vomiting).toBe(true);
  });
});

describe('gates (documented absence)', () => {
  const narrative = ['Three days of right-sided abdominal pain with fever and vomiting; otherwise well.'];
  it('with a full record and no injury, trauma and a recent operation are recorded as absent', () => {
    const f = withCtx({ narrative });
    expect(f.trauma_mechanism).toBe(false);
    expect(f.recent_surgery).toBe(false);
  });
  it('an injury or a recent operation in the record keeps them present', () => {
    expect(withCtx({ narrative: ['Fell from a ladder this morning, hit his chest.'] }).trauma_mechanism).toBe(true);
    expect(withCtx({ narrative: ['Day 3 after laparoscopic cholecystectomy, now febrile.'] }).recent_surgery).toBe(true);
    expect(withCtx({ narrative, isPostOp: true }).recent_surgery).toBe(true);
  });
  it('without a record nothing is recorded as absent', () => {
    const f = extractFeaturesFromSocrates('Acute abdominal pain', { site: 'RLQ' });
    expect(f.trauma_mechanism).toBeUndefined();
    expect(f.recent_surgery).toBeUndefined();
  });
});

describe('paneContextFromConsultation', () => {
  it('reads the AppContext fields PANE uses', () => {
    const ctx = paneContextFromConsultation({
      age: '7', sex: 'female', pregnancyPossible: false, symptoms: ['vomiting'], symptomDetails: {},
      vitals: { heartRate: '130', temperatureC: '' }, durationDays: '2', isPostOp: false, postOpDays: '',
      comorbidities: [], medications: [], medicationsText: 'salbutamol inhaler', surgicalHistory: [], toxicHabits: [],
      investigationResults: {}, examFindings: {}, freeText: 'Referral: ?appendicitis', hpiNotes: '', examAbdomen: 'Soft',
      examNotes: { other: 'Throat red' },
    });
    expect(ctx.age).toBe(7);
    expect(ctx.durationDays).toBe(2);
    expect(ctx.vitals?.heartRate).toBe('130');
    expect(ctx.medications).toContain('salbutamol inhaler');
    expect(ctx.narrative).toEqual(['Referral: ?appendicitis', 'Soft', 'Throat red']);
  });
});

describe('skin necrosis is skin, not an internal organ (vademecum phase-1 shadow run)', () => {
  const necrosis = (text: string) =>
    extractFeaturesFromSocrates('Acute abdominal pain', {}, { narrative: [text] }).skin_necrosis;
  it('pancreatic, nodal and bowel necrosis do not set it', () => {
    expect(necrosis('CT: acute necrotising pancreatitis with 30% pancreatic necrosis.')).toBeUndefined();
    expect(necrosis('Necrotic lymph nodes at the porta hepatis.')).toBeUndefined();
    expect(necrosis('Gangrenous cholecystitis at operation.')).toBeUndefined();
    expect(necrosis('Walled-off necrosis in the lesser sac.')).toBeUndefined();
  });
  it('skin and soft-tissue necrosis still do', () => {
    expect(necrosis('Dusky skin over the flank with bullae.')).toBe(true);
    expect(necrosis('Necrotic skin edges at the wound.')).toBe(true);
    expect(necrosis('Necrotising fasciitis suspected; skin necrosis over the thigh.')).toBe(true);
    expect(necrosis('Fournier\'s gangrene of the perineum.')).toBe(true);
  });
});
