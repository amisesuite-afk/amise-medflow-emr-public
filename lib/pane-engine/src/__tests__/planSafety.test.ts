/**
 * Management protocols: ICD resolution and the patient-specific plan safety filters
 * (management/planSafety.ts). Clinical-validation 2026-09 (SURGEON-DECISIONS A, B, C, G2).
 */
import { describe, expect, it } from 'vitest';
import {
  adaptInvestigationForPatient, adaptPlanText, adaptProtocolForPatient, allergyProfile, gestationFromText, getAllProtocols, getProtocol,
  getProtocolByIcd, hasOperativeSteps, pregnancyFor, procedureFor, resolveProtocol, PAEDIATRIC_FLUID,
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
  it('fixed adult fluid volumes become "fluids by weight"; titration wording and mL/kg stay', () => {
    const base = proto('appendicitis');
    const p = {
      ...base,
      management: [
        { phase: 'immediate' as const, step: "IV Hartmann's 1 L stat then titrate to urine output" },
        { phase: 'immediate' as const, step: 'IV 0.9% sodium chloride 200–300 mL/hr; target urine output 1 mL/kg/h' },
        { phase: 'immediate' as const, step: 'Parkland 4 mL × kg × %TBSA of Hartmann\'s in 24 h; titrate to urine output' },
        { phase: 'immediate' as const, step: 'Calcium gluconate 10% 10 mL IV bolus' },
      ],
      medications: [
        { drugName: "Hartmann's solution", dose: '500 ml', frequency: 'IV bolus — repeat as required', route: 'IV', indication: 'Fluid resuscitation', phase: 'immediate' as const },
        { drugName: 'Calcium gluconate 10%', dose: '10 mL', frequency: 'Single bolus', route: 'IV', indication: 'Tetany', phase: 'immediate' as const },
      ],
    };
    const a = adaptProtocolForPatient(p, child);
    const steps = a.management.map(m => m.step);
    expect(PAEDIATRIC_FLUID).toBe('fluids by weight — calculate per APLS/BNFc (mL/kg)');
    expect(steps[0]).toBe(`IV Hartmann's [${PAEDIATRIC_FLUID}] stat then titrate to urine output`);
    expect(steps[1]).toBe(`IV 0.9% sodium chloride [${PAEDIATRIC_FLUID}]; target urine output 1 mL/kg/h`);
    expect(steps[2]).toMatch(/Parkland 4 mL × kg × %TBSA/);
    expect(steps[3]).toMatch(/\[dose: weight-based — calculate per BNFc\]/);
    expect(steps.join('\n')).not.toMatch(/\b1 L\b|500 mL|200–300 mL/);
    const [fluid, calcium] = a.medications ?? [];
    expect(fluid).toMatchObject({ dose: PAEDIATRIC_FLUID, frequency: 'IV bolus — repeat as required' });
    expect(calcium?.dose).toBe('Weight-based — calculate per BNFc');
    // Adults keep the protocol volume.
    expect(adaptProtocolForPatient(p, adult).management[0]?.step).toBe("IV Hartmann's 1 L stat then titrate to urine output");
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

describe('investigation filters (web-plan-filter-everywhere, 2026-09-25)', () => {
  it('an ultrasound named first is not ionising imaging ("USS KUB" in pregnancy)', () => {
    const preg = { ...adult, sex: 'female', ageYears: 28, freeText: '26 weeks pregnant' };
    const uss = adaptInvestigationForPatient({ label: 'USS KUB (pregnancy, children — avoids radiation)', urgency: 'urgent' }, preg);
    expect(uss.label).toBe('USS KUB (pregnancy, children — avoids radiation)');
    const ct = adaptInvestigationForPatient({ label: 'CT KUB (non-contrast)', urgency: 'urgent' }, preg);
    expect(ct.label).toMatch(/pregnancy: only if ultrasound\/MRI cannot answer/);
  });
  it('no pregnancy test for a man, an older woman or a recorded pregnancy; kept where pregnancy is the condition', () => {
    const hcg = (a: ReturnType<typeof adaptProtocolForPatient>) => a.investigations.some(i => /hcg|pregnancy test/i.test(i.label));
    expect(hcg(adaptProtocolForPatient(proto('appendicitis'), { ...adult, sex: 'female', ageYears: 30 }))).toBe(true);
    expect(hcg(adaptProtocolForPatient(proto('appendicitis'), adult))).toBe(false);
    expect(hcg(adaptProtocolForPatient(proto('appendicitis'), { ...adult, sex: 'female', ageYears: 78 }))).toBe(false);
    expect(hcg(adaptProtocolForPatient(proto('appendicitis'), { ...adult, sex: 'female', ageYears: 29, freeText: '22 weeks pregnant' }))).toBe(false);
    expect(hcg(adaptProtocolForPatient(proto('ectopic_pregnancy'), { ...adult, sex: 'female', ageYears: 29, freeText: 'pregnant' }))).toBe(true);
  });
  it('age ≥ 65 with an acute abdomen: lactate and the CT-angiography caveat; not for an elective plan', () => {
    const lactate = (a: ReturnType<typeof adaptProtocolForPatient>) => a.investigations.find(i => /Venous blood gas with lactate — age ≥ 65/.test(i.label));
    expect(lactate(adaptProtocolForPatient(proto('appendicitis'), { ...adult, ageYears: 78, sex: 'female' }))?.label).toMatch(/CT angiography/);
    expect(lactate(adaptProtocolForPatient(proto('appendicitis'), adult))).toBeUndefined();
    expect(lactate(adaptProtocolForPatient(proto('femoral_hernia'), { ...adult, ageYears: 80, assessment: 'Elective femoral hernia repair' }))).toBeUndefined();
  });
});

describe('protocols added 2026-09-25 (web-plan-filter-everywhere)', () => {
  it('aorto-enteric fistula: emergency redirect, CT angiography, blood cultures, vascular surgery, no tranexamic acid', () => {
    const p = proto('aortoenteric_fistula');
    expect(p.kind).toBe('emergency');
    expect(p.icd10Prefixes).toEqual([]);
    expect(p.investigations.map(i => i.label).join('\n')).toMatch(/CT angiography[\s\S]*Blood cultures/);
    expect(p.referral).toMatch(/vascular surg/i);
    expect(JSON.stringify(p)).not.toMatch(/tranexamic/i);
  });
  it('IgA vasculitis: D69.0, ultrasound for intussusception, urinalysis and BP; child branch, no fixed doses, no operation', () => {
    expect(getProtocolByIcd('D69.0')?.diseaseId).toBe('hsp_iga_vasculitis');
    const a = adaptProtocolForPatient(proto('hsp_iga_vasculitis'), { ...adult, ageYears: 6 });
    const text = allText(a);
    expect(text).toMatch(/Ultrasound abdomen \(intussusception\)/);
    expect(text).toMatch(/Urinalysis/);
    expect(text).toMatch(/same-day paediatric assessment/);
    expect(text).not.toMatch(/\d+\s*(mg|g)\b/);
    expect(text).not.toMatch(/appendicectomy|laparotomy/i);
    expect(adaptProtocolForPatient(proto('hsp_iga_vasculitis'), adult).management.some(m => /Adult IgA vasculitis/.test(m.step))).toBe(true);
  });
  it('anaplastic_thyroid resolves to thyroid carcinoma; sah stays unaliased', () => {
    expect(getProtocol('anaplastic_thyroid')?.diseaseId).toBe('thyroid_carcinoma');
    expect(getProtocol('sah')).toBeNull();
    expect(getProtocolByIcd('I60.9')?.diseaseId).toBe('subarachnoid_haemorrhage');
  });
  it('filled gaps: perianal Crohn\'s MRI pelvis, femoral hernia CT, amoebic abscess blood cultures', () => {
    expect(proto('crohns_disease').investigations.some(i => /MRI pelvis/.test(i.label))).toBe(true);
    expect(proto('femoral_hernia').investigations.some(i => /^CT abdomen\/pelvis if obstruction or strangulation/.test(i.label))).toBe(true);
    expect(proto('amoebic_liver_abscess').investigations.some(i => /Blood cultures/.test(i.label))).toBe(true);
  });
});
