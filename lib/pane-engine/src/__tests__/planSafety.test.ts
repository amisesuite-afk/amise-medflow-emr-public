/**
 * Management protocols: ICD resolution and the patient-specific plan safety filters
 * (management/planSafety.ts). Clinical-validation 2026-09 (SURGEON-DECISIONS A, B, C, G2).
 */
import { describe, expect, it } from 'vitest';
import {
  adaptPlanText, adaptProtocolForPatient, allergyProfile, gestationFromText, getAllProtocols, getProtocol,
  getProtocolByIcd, hasOperativeSteps, pregnancyFor, procedureFor, resolveProtocol,
} from '../management/index.js';
import type { PlanPatientContext } from '../management/index.js';

const proto = (id: string) => {
  const p = getProtocol(id);
  if (!p) throw new Error(`no protocol ${id}`);
  return p;
};
const allText = (a: ReturnType<typeof adaptProtocolForPatient>) => [
  ...a.safetyNotes.map(n => n.text), ...a.management.map(m => m.step), ...a.keyPoints,
  ...a.investigations.map(i => i.label), ...(a.medications ?? []).map(m => `${m.drugName} ${m.dose}`),
].join('\n');
const adult: PlanPatientContext = { ageYears: 45, sex: 'male', allergies: [], medications: [], comorbidities: [], assessment: '' };

describe('ICD-10 lookup', () => {
  it('uses the longest matching prefix', () => {
    expect(getProtocolByIcd('I85.11')?.diseaseId).toBe('variceal_bleed');
    expect(getProtocolByIcd('K57.31')?.diseaseId).toBe('lower_gi_bleed');
    expect(getProtocolByIcd('K60.3')?.diseaseId).toBe('fistula_in_ano');
    expect(getProtocolByIcd('L03.115')?.diseaseId).toBe('cellulitis');
    expect(getProtocolByIcd('E04.1')?.diseaseId).toBe('thyroid_nodule_benign');
  });
  it('accepts "code — label" strings and codes without dots', () => {
    expect(getProtocolByIcd('K35.89 — Acute appendicitis')?.diseaseId).toBe('appendicitis');
    expect(getProtocolByIcd('K3589')?.diseaseId).toBe('appendicitis');
  });
});

describe('resolveProtocol: disease id vs recorded ICD code', () => {
  it('a more specific recorded code picks its protocol', () => {
    expect(resolveProtocol('upper_gi_bleed', 'I85.11')?.diseaseId).toBe('variceal_bleed');
    expect(resolveProtocol('liver_abscess', 'A06.4')?.diseaseId).toBe('amoebic_liver_abscess');
    expect(resolveProtocol('diverticulitis', 'K57.31')?.diseaseId).toBe('lower_gi_bleed');
  });
  it('a generic code in the same category does not override the disease', () => {
    expect(resolveProtocol('ileus_postop', 'K56.7')?.diseaseId).toBe('ileus_postop');
  });
  it('the disease protocol wins when it covers the code', () => {
    expect(resolveProtocol('appendicitis', 'K35.80')?.diseaseId).toBe('appendicitis');
  });
  it('new PANE disease ids resolve through aliases', () => {
    expect(getProtocol('dka')?.diseaseId).toBe('diabetic_ketoacidosis');
    expect(getProtocol('food_bolus')?.diseaseId).toBe('food_bolus_obstruction');
    expect(getProtocol('perforated_peptic_ulcer')?.diseaseId).toBe('perforated_peptic_ulcer');
  });
});

describe('protocol content invariants', () => {
  it('never names Victoria Hospital', () => {
    for (const p of getAllProtocols()) expect(JSON.stringify(p)).not.toMatch(/victoria/i);
  });
  it('every emergency-kind protocol redirects (911 / emergency department)', () => {
    for (const p of getAllProtocols().filter(x => x.kind === 'emergency')) {
      expect(p.management.some(m => /911/.test(m.step)), p.diseaseId).toBe(true);
    }
  });
  it('upper GI bleeding no longer offers tranexamic acid', () => {
    expect(JSON.stringify(proto('upper_gi_bleed'))).not.toMatch(/tranexamic/i);
  });
});

describe('allergy cross-check (class-aware)', () => {
  it('penicillin anaphylaxis withholds co-amoxiclav and gives the protocol alternative', () => {
    const a = adaptProtocolForPatient(proto('appendicitis'), { ...adult, allergies: ['Penicillin (anaphylaxis)'] });
    const immediate = a.management.find(m => /ALLERGY/.test(m.step));
    expect(immediate?.step).toMatch(/penicillin allergy recorded/i);
    expect(immediate?.step).toMatch(/Alternative:/);
    expect((a.medications ?? []).some(m => /co-amoxiclav/i.test(m.drugName))).toBe(false);
    expect(a.withheld.some(w => w.from === 'medication')).toBe(true);
    expect(a.safetyNotes.some(n => n.kind === 'allergy' && n.severity === 'critical')).toBe(true);
  });
  it('H. pylori: the penicillin-allergy branch appears only when allergic', () => {
    const plain = adaptProtocolForPatient(proto('gastritis'), adult);
    const allergic = adaptProtocolForPatient(proto('gastritis'), { ...adult, allergies: ['amoxicillin - rash'] });
    expect(plain.management.some(m => m.onlyIf === 'penicillin-allergy')).toBe(false);
    expect(allergic.management.some(m => /bismuth quadruple/i.test(m.step))).toBe(true);
    expect(allergic.medications?.some(m => /^amoxicillin/i.test(m.drugName))).toBe(false);
  });
  it('a negated mention is not withheld ("avoid NSAIDs")', () => {
    const out = adaptPlanText('Paracetamol; avoid NSAIDs.', proto('diverticulitis'), { ...adult, allergies: ['ibuprofen'] });
    expect(out).toBe('Paracetamol; avoid NSAIDs.');
  });
  it('recognises allergy classes and "no known drug allergies"', () => {
    expect(allergyProfile(['NKDA']).classes).toHaveLength(0);
    expect(allergyProfile(['Augmentin']).classes.map(c => c.id)).toContain('penicillin');
    expect(allergyProfile(['latex']).latex).toBe(true);
  });
});

describe('pregnancy', () => {
  it('reads gestation from text', () => {
    expect(gestationFromText('G2P1 at 28 weeks')).toBe(28);
    expect(gestationFromText('32/40 pregnant')).toBe(32);
    expect(gestationFromText('twenty-two weeks pregnant')).toBe(22);
    expect(gestationFromText('surgery 6 weeks ago')).toBeNull();
  });
  it('a recorded status wins; the tick alone is "possible", never pregnant', () => {
    expect(pregnancyFor({ sex: 'female', pregnancyPossible: true }).status).toBe('possible');
    expect(pregnancyFor({ sex: 'female', freeText: 'She is 24 weeks pregnant' })).toEqual({ status: 'pregnant', gestationWeeks: 24 });
    expect(pregnancyFor({ sex: 'male', freeText: 'pregnant' }).status).toBe('not-pregnant');
  });
  it('DVT in pregnancy: no DOAC or warfarin — LMWH', () => {
    const a = adaptProtocolForPatient(proto('deep_vein_thrombosis'), { ...adult, sex: 'female', ageYears: 30, freeText: '22 weeks pregnant' });
    const steps = a.management.map(m => m.step).join('\n');
    expect(steps).toMatch(/LMWH/);
    expect((a.medications ?? []).some(m => /rivaroxaban|apixaban|warfarin/i.test(m.drugName))).toBe(false);
    expect(a.safetyNotes.some(n => n.kind === 'pregnancy' && /obstetric/.test(n.text))).toBe(true);
  });
  it('no NSAIDs from 20 weeks; annotated before 20 weeks', () => {
    const late = adaptPlanText('Ibuprofen 400 mg TDS', proto('cholecystitis'), { ...adult, sex: 'female', freeText: '26 weeks pregnant' });
    expect(late).toMatch(/withheld/);
    const early = adaptPlanText('Ibuprofen 400 mg TDS', proto('cholecystitis'), { ...adult, sex: 'female', freeText: '12 weeks pregnant' });
    expect(early).toMatch(/only if the benefit outweighs the risk/);
  });
  it('appendicitis in pregnancy: MRI branch, no unconditional CT branch', () => {
    const a = adaptProtocolForPatient(proto('appendicitis'), { ...adult, sex: 'female', freeText: '22 weeks pregnant' });
    expect(a.investigations.some(i => /MRI/.test(i.label))).toBe(true);
    expect(a.investigations.some(i => i.onlyIf === 'not-pregnant')).toBe(false);
  });
  it('pregnancy possible: "β-HCG: result required", never "confirmed negative"', () => {
    const a = adaptProtocolForPatient(proto('cholecystitis'), { ...adult, sex: 'female', ageYears: 30, pregnancyPossible: true });
    const text = allText(a);
    expect(text).toMatch(/β-HCG: result required/);
    expect(text).not.toMatch(/confirmed negative/i);
    expect(a.investigations.some(i => /Pregnancy test/.test(i.label))).toBe(true);
  });
  it('tamoxifen is withheld in pregnancy', () => {
    const a = adaptProtocolForPatient(proto('invasive_ductal_carcinoma'), { ...adult, sex: 'female', ageYears: 34, freeText: '18 weeks pregnant' });
    expect((a.medications ?? []).some(m => /tamoxifen/i.test(m.drugName))).toBe(false);
  });
});

describe('under 16', () => {
  const child: PlanPatientContext = { ...adult, ageYears: 7 };
  it('replaces adult doses with weight-based dosing per BNFc', () => {
    const a = adaptProtocolForPatient(proto('appendicitis'), child);
    expect(a.management.map(m => m.step).join('\n')).toMatch(/weight-based — calculate per BNFc/);
    for (const m of a.medications ?? []) expect(m.dose).toMatch(/BNFc/);
    expect(a.safetyNotes.some(n => n.kind === 'paediatric')).toBe(true);
  });
  it('infant hernia: no mesh, no TEP/TAPP, no truss', () => {
    const a = adaptProtocolForPatient(proto('inguinal_hernia'), { ...adult, ageYears: 0.3 });
    const text = allText(a);
    expect(text).not.toMatch(/\b(mesh repair|lichtenstein|tep|tapp|truss)\b/i);
    expect(text).toMatch(/herniotomy/);
    expect(a.safetyNotes.some(n => /Infant/.test(n.text))).toBe(true);
    expect(a.safetyNotes.find(n => n.kind === 'paediatric')?.text).toMatch(/4 months/);
  });
  it('no adult VTE line for children', () => {
    const a = adaptProtocolForPatient(proto('appendicitis'), child);
    expect(a.safetyNotes.some(n => n.kind === 'vte')).toBe(false);
  });
});

describe('peri-operative lines', () => {
  it('every operative plan gets a VTE line (NICE NG89), renal-adjusted', () => {
    const a = adaptProtocolForPatient(proto('colorectal_cancer'), { ...adult, ageYears: 70, egfr: 22 });
    const vte = a.safetyNotes.find(n => n.kind === 'vte');
    expect(vte?.text).toMatch(/NICE NG89/);
    expect(vte?.text).toMatch(/enoxaparin 20 mg/);
    expect(vte?.text).toMatch(/28 days/);
  });
  it('bleeding: mechanical prophylaxis first; warfarin reversal, no heparin substitution', () => {
    const a = adaptProtocolForPatient(proto('upper_gi_bleed'), { ...adult, medications: ['Warfarin'] });
    const text = a.safetyNotes.map(n => n.text).join('\n');
    expect(text).toMatch(/prothrombin complex concentrate/);
    expect(text).toMatch(/No heparin substitution/);
    expect(text).not.toMatch(/bridg/i);
  });
  it('warfarin + diagnostic OGD (low risk): continue warfarin', () => {
    const a = adaptProtocolForPatient(proto('dyspepsia'), { ...adult, medications: ['warfarin'], assessment: 'Diagnostic OGD ± biopsy (low bleeding-risk).' });
    expect(a.safetyNotes.map(n => n.text).join('\n')).toMatch(/continue warfarin/);
  });
  it('apixaban + elective surgery: PAUSE intervals, no bridging', () => {
    const a = adaptProtocolForPatient(proto('inguinal_hernia'), { ...adult, medications: ['apixaban 5 mg BD'], assessment: 'Elective inguinal hernia repair' });
    expect(a.safetyNotes.map(n => n.text).join('\n')).toMatch(/PAUSE 2019[\s\S]*No bridging/);
  });
  it('emergency laparotomy on apixaban: last dose, anti-Xa, reversal discussion; NELA risk', () => {
    const a = adaptProtocolForPatient(proto('diverticulitis'), { ...adult, ageYears: 84, medications: ['apixaban'], assessment: 'Perforated diverticulitis, faecal peritonitis. Emergency laparotomy (Hartmann\'s).' });
    const text = a.safetyNotes.map(n => n.text).join('\n');
    expect(text).toMatch(/Emergency surgery on apixaban/);
    expect(text).toMatch(/NELA/);
  });
  it('recent coronary stent: defer elective surgery inside the window', () => {
    const a = adaptProtocolForPatient(proto('inguinal_hernia'), {
      ...adult, medications: ['aspirin', 'clopidogrel'], comorbidities: ['Drug-eluting coronary stent 3 months ago (NSTEMI)'],
      assessment: 'Elective inguinal hernia repair',
    });
    expect(a.safetyNotes.map(n => n.text).join('\n')).toMatch(/defer elective surgery until 12 months/);
  });
  it('SGLT2 inhibitor: withhold the day before and the day of the procedure (CPOC 2021)', () => {
    const a = adaptProtocolForPatient(proto('cholecystitis'), { ...adult, medications: ['empagliflozin'], assessment: 'Laparoscopic cholecystectomy' });
    expect(a.safetyNotes.map(n => n.text).join('\n')).toMatch(/withhold the day before and the day of the procedure \(CPOC 2021/);
  });
  it('long-term prednisolone: steroid cover', () => {
    const a = adaptProtocolForPatient(proto('appendicitis'), { ...adult, medications: ['prednisolone 10 mg'] });
    expect(a.safetyNotes.some(n => n.kind === 'steroid' && /hydrocortisone 100 mg/.test(n.text))).toBe(true);
  });
  it('type 1 diabetes: continue basal insulin; ketones investigation', () => {
    const a = adaptProtocolForPatient(proto('appendicitis'), { ...adult, comorbidities: ['Type 1 diabetes'], medications: ['insulin glargine'] });
    expect(a.safetyNotes.map(n => n.text).join('\n')).toMatch(/continue basal \(long-acting\) insulin/);
    expect(a.investigations.some(i => /ketones/.test(i.label))).toBe(true);
  });
  it('anaesthetic hazards reach the plan and the red flags', () => {
    const a = adaptProtocolForPatient(proto('appendicitis'), { ...adult, comorbidities: ['Suxamethonium apnoea (mother)'] });
    expect(a.redFlags.some(f => /Suxamethonium apnoea/.test(f))).toBe(true);
  });
});

describe('procedure detection', () => {
  it('"low bleeding-risk" is not active bleeding; post-operative wording is not a planned operation', () => {
    expect(procedureFor(proto('dyspepsia'), { assessment: 'Diagnostic OGD (low bleeding-risk)' }, false)).toBe('endoscopy-low');
    expect(procedureFor(proto('ileus_postop'), { assessment: 'Ileus day 4 after right hemicolectomy' }, false)).toBe('none');
    expect(procedureFor(proto('choledocholithiasis'), { assessment: 'ERCP with sphincterotomy' }, true)).toBe('endoscopy-high');
  });
  it('"senior surgical review" is not an operative step', () => {
    expect(hasOperativeSteps(proto('cellulitis'))).toBe(false);
    expect(hasOperativeSteps(proto('appendicitis'))).toBe(true);
    expect(hasOperativeSteps(proto('appendicitis'), ['immediate', 'conservative'])).toBe(false);
  });
});
