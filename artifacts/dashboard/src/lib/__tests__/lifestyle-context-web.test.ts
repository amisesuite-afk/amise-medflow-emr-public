/**
 * The dashboard's consultation state → lifestyle-practices context. Only a confirmed working
 * diagnosis feeds the rules (CLAUDE.md "Central diagnosis radiation").
 */
import { describe, expect, it } from 'vitest';
import { lifestyleContextFromWeb, webBmi, webProcedureBooked, type LifestyleWebInput } from '@/lib/lifestyle-context-web';
import { emptyLifestyleHistory, lifestylePlanSuggestions, lifestyleSafetyPrompts } from '@workspace/triage-engine/lifestyle-practices';

function input(patch: Partial<LifestyleWebInput> = {}): LifestyleWebInput {
  return {
    lifestyle: emptyLifestyleHistory(), age: '', weightKg: '', heightCm: '', comorbidities: [], pmhNotes: '',
    symptoms: [], freeText: '', workingDiagnosis: null, icdCodes: [], medications: [], medicationsText: '',
    visitType: '', encounterType: 'quick_consult', ...patch,
  };
}

describe('lifestyleContextFromWeb', () => {
  it('uses only a confirmed working diagnosis', () => {
    const unconfirmed = lifestyleContextFromWeb(input({ workingDiagnosis: { locked: false, diseaseLabel: 'Lumbar disc prolapse with back pain', icdCode: null } }));
    expect(lifestylePlanSuggestions(unconfirmed)).toEqual([]);
    const confirmed = lifestyleContextFromWeb(input({ workingDiagnosis: { locked: true, diseaseLabel: 'Mechanical low back pain', icdCode: 'M54.5' } }));
    expect(lifestylePlanSuggestions(confirmed).map(s => s.id)).toEqual(['yoga', 'acupuncture']);
  });

  it('reads age, BMI, the medication list and a booked procedure', () => {
    expect(webBmi('96', '175')).toBeCloseTo(31.35, 1);
    expect(webBmi('', '175')).toBeNull();
    expect(webProcedureBooked({ visitType: 'endoscopy_col', encounterType: 'quick_consult', symptoms: [] })).toBe(true);
    expect(webProcedureBooked({ visitType: 'follow_up', encounterType: 'quick_consult', symptoms: ['Pre-operative visit'] })).toBe(true);
    expect(webProcedureBooked({ visitType: 'follow_up', encounterType: 'quick_consult', symptoms: [] })).toBe(false);
    const ctx = lifestyleContextFromWeb(input({
      lifestyle: { ...emptyLifestyleHistory(), fasting: ['ramadan'], fastingStatus: 'current' },
      age: '67', comorbidities: ['Type 2 diabetes mellitus'], medicationsText: 'Gliclazide 80 mg BD, metformin', visitType: 'pre_op',
    }));
    expect(ctx.ageYears).toBe(67);
    expect(lifestyleSafetyPrompts(ctx).map(p => p.id)).toEqual(['fasting-diabetes-insulin-su', 'fasting-perioperative']);
  });
});
