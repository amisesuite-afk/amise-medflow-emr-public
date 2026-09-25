/**
 * PlanTab suggested plan (lib/plan-builder.ts): confirmed diagnosis → resolveProtocol → adapted to
 * the patient on record (allergy, pregnancy, under-16, peri-operative safety lines).
 */
import { describe, expect, it } from 'vitest';
import { buildPlanSections, buildPlanText, planPatientContext, planProtocolFor, splitList } from '../plan-builder';
import { detectDxVariants } from '../dx-variants';

const protocol = (id: string, icd?: string) => {
  const p = planProtocolFor(id, icd ?? null);
  if (!p) throw new Error(`no protocol for ${id}`);
  return p;
};

describe('planPatientContext', () => {
  it('maps the dashboard fields', () => {
    const ctx = planPatientContext({
      age: '67', sex: 'female', pregnancyPossible: false, allergies: 'Penicillin (anaphylaxis); latex',
      medications: ['Apixaban'], medicationsText: 'bisoprolol 2.5 mg, empagliflozin', comorbidities: ['AF'],
      hpiNotes: 'RIF pain', pmhNotes: 'Type 2 diabetes', surgicalHistory: ['Appendicectomy'],
      assessment: 'Acute appendicitis', extractedLabs: { egfr: 28 },
    });
    expect(ctx.ageYears).toBe(67);
    expect(ctx.allergies).toEqual(['Penicillin (anaphylaxis)', 'latex']);
    expect(ctx.medications).toEqual(['Apixaban', 'bisoprolol 2.5 mg', 'empagliflozin']);
    expect(ctx.freeText).toMatch(/RIF pain/);
    expect(ctx.freeText).toMatch(/Type 2 diabetes/);
    expect(ctx.egfr).toBe(28);
  });
  it('splitList ignores blanks', () => {
    expect(splitList(' a, ,b;\nc ')).toEqual(['a', 'b', 'c']);
    expect(splitList(null)).toEqual([]);
  });
});

describe('planProtocolFor (resolveProtocol)', () => {
  it('a more specific ICD code wins over the working diagnosis', () => {
    expect(planProtocolFor('upper_gi_bleed', 'I85.11')?.diseaseId).toBe('variceal_bleed');
    expect(planProtocolFor(null, 'K35.80')?.diseaseId).toBe('appendicitis');
    expect(planProtocolFor(null, null)).toBeNull();
  });
});

describe('buildPlanText', () => {
  it('puts the patient-specific safety checks first and includes the VTE line for an operation', () => {
    const ctx = planPatientContext({ age: 52, sex: 'male', allergies: '', medications: [], assessment: 'Acute appendicitis' });
    const text = buildPlanText(protocol('appendicitis'), ctx, { isInpatient: true, surgeon: 'Dr K' });
    expect(text.indexOf('Patient-specific safety checks')).toBeLessThan(text.indexOf('Admission orders'));
    expect(text).toMatch(/NICE NG89/);
    expect(text).toMatch(/Admit under Dr K/);
  });
  it('penicillin allergy: co-amoxiclav withheld with an alternative, in steps and in the variant prefix', () => {
    const ctx = planPatientContext({ age: 40, sex: 'male', allergies: 'Penicillin - anaphylaxis', medications: [] });
    const text = buildPlanText(protocol('appendicitis'), ctx, { planPrefix: 'Oral co-amoxiclav 625 mg TDS for 5 days.' });
    expect(text).not.toMatch(/^Oral co-amoxiclav/m);
    expect(text).toMatch(/ALLERGY — penicillin allergy recorded/);
    expect(text).toMatch(/Alternative:/);
  });
  it('under 16: adult doses replaced by weight-based dosing', () => {
    const ctx = planPatientContext({ age: 9, sex: 'female', allergies: '', medications: [] });
    const text = buildPlanText(protocol('appendicitis'), ctx);
    expect(text).toMatch(/weight-based — calculate per BNFc/);
    expect(text).not.toMatch(/co-amoxiclav 1\.2 g/);
  });
  it('the variant phase filter drops operative steps and the operative-only lines', () => {
    const ctx = planPatientContext({ age: 50, sex: 'male', allergies: '', medications: ['apixaban'] });
    const sec = buildPlanSections(protocol('appendicitis'), ctx, { allowedPhases: ['immediate', 'conservative'] });
    expect(sec.phases.every(p => p.phase !== 'surgical')).toBe(true);
    expect(sec.safety.some(n => n.kind === 'vte')).toBe(false);
  });
  it('pregnancy possible: "β-HCG: result required", never "confirmed negative"', () => {
    const ctx = planPatientContext({ age: 29, sex: 'female', pregnancyPossible: true, allergies: '', medications: [] });
    const text = buildPlanText(protocol('cholecystitis'), ctx);
    expect(text).toMatch(/β-HCG: result required/);
    expect(text).not.toMatch(/confirmed negative/i);
  });
});

describe('dx-variants wording (E4) used by the plan', () => {
  const variant = (text: string, icd?: string, id?: string) => detectDxVariants(text, icd, id)?.detectedVariant?.id ?? null;
  it('cholangitis grades, and "one Grade II criterion" is not Grade II', () => {
    expect(variant('Tokyo (TG18) Grade II (moderate) acute cholangitis', 'K83.09')).toBe('cholangitis_grade2');
    expect(variant('Mild acute cholangitis — TG18 Grade I (one Grade II criterion only: age ≥75).', 'K83.09')).toBe('cholangitis_grade1');
    expect(variant('Severe acute cholangitis — TG18 Grade III with septic shock', 'K83.09')).toBe('cholangitis_grade3');
  });
  it('pancreatitis, diverticulitis, hernia and SBO wording', () => {
    expect(variant('Mild acute biliary pancreatitis (revised Atlanta 2012)', 'K85.10')).toBe('pancreatitis_mild');
    expect(variant('Moderately severe acute pancreatitis with an acute necrotic collection', 'K85.11')).toBe('pancreatitis_moderate');
    expect(variant('Uncomplicated acute sigmoid diverticulitis (CT-confirmed)', 'K57.32')).toBe('diverticulitis_uncomplicated');
    expect(variant('Hinchey Ib pericolic abscess', 'K57.20')).toBe('diverticulitis_abscess');
    expect(variant('Small bowel obstruction due to left obturator hernia', 'K45.0', 'obturator_hernia')).toBe('hernia_incarcerated');
    expect(variant('Adhesive SBO: water-soluble contrast has not reached the colon at 24 h. Non-operative management has failed.', 'K56.50')).toBe('sbo_failed_nonoperative');
  });
  it('Bethesda I / II, inflammatory breast cancer', () => {
    expect(variant('Right thyroid nodule, FNA Bethesda I (non-diagnostic).', 'E04.1')).toBe('thyroid_bethesda_nondiagnostic');
    expect(variant('FNA Bethesda II (benign follicular nodule).', 'E04.1')).toBe('thyroid_bethesda_benign');
    expect(variant('Bethesda III (AUS): repeat FNA or diagnostic hemithyroidectomy', 'E04.1')).toBe('thyroid_hemithyroidectomy');
    expect(variant("Suspected inflammatory breast cancer, peau d'orange", 'C50.911')).toBe('breast_inflammatory');
  });
  it('a post-thyroidectomy haematoma is not the Thyroid group', () => {
    expect(detectDxVariants('Expanding neck haematoma 5 h after total thyroidectomy', 'T81.0XXA', 'postop_haematoma')).toBeNull();
  });
});
