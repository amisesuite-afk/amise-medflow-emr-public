/**
 * "What's missing" — the dashboard adapter (lib/whats-missing-web.ts): what it reads from the
 * consultation. The ranking itself is covered by the shared vectors (pane-engine).
 */
import { describe, expect, it } from 'vitest';
import {
  buildWhatsMissing, missingFactsFromConsultation, missingRecordFromConsultation, webLab,
} from '../whats-missing-web';
import type { MissingConsultation } from '../whats-missing-web';

const FULL_VITALS = {
  systolicBp: '128', diastolicBp: '76', heartRate: '84', temperatureC: '36.8', respiratoryRate: '16', spo2: '98',
  glucoseMmol: '', avpu: 'A', onSupplementalO2: 'air',
};

function consult(extra: Partial<MissingConsultation> = {}): MissingConsultation {
  return {
    age: '40', sex: 'male', allergies: 'NKDA', medications: [], medicationsText: '', comorbidities: [], pmhNotes: '',
    hpiNotes: '', freeText: '', surgicalHistory: [], assessment: '', plan: '', vitals: FULL_VITALS,
    investigationResults: {}, extractedLabs: {}, supplementHistory: { status: 'none' }, today: '2026-09-26',
    ...extra,
  };
}

describe('whats-missing-web — record', () => {
  it('reads labs from extractedLabs, then results by whole-word name (not HbA1c for Hb, not the U&E panel for urea)', () => {
    const c = consult({ extractedLabs: { wbc: 14 }, investigationResults: { HbA1c: '58', 'Urea & Electrolytes': 'Na 138 K 4.1', Haemoglobin: '9.8 g/dL', Urea: '11.2' } });
    expect(webLab(c, 'wbc')).toBe(14);
    expect(webLab(c, 'hb')).toBe(9.8);
    expect(webLab(c, 'urea')).toBe(11.2);
  });
  it('history and findings are negation-aware; short abbreviations are whole words', () => {
    const r = missingRecordFromConsultation(consult({
      comorbidities: ['No history of DVT', 'Type 2 diabetes', 'Initial assessment done'],
      hpiNotes: 'Vomiting twice. No rebound. Migrated to the right iliac fossa.',
    }));
    expect(r.history.priorDvt).toBe(false);
    expect(r.history.cva).toBe(false);
    expect(r.findings.vomiting).toBe(true);
    expect(r.findings.rebound).toBe(false);
    expect(r.findings.migration).toBe(true);
  });
  it('insulin comes from the medication list, not from "non-insulin-dependent"', () => {
    expect(missingRecordFromConsultation(consult({ medications: ['Insulin glargine 20 units nocte'] })).history.insulin).toBe(true);
    expect(missingRecordFromConsultation(consult({ comorbidities: ['Non-insulin-dependent diabetes'] })).history.insulin).toBe(false);
  });
});

describe('whats-missing-web — safety facts', () => {
  it('allergy status: NKDA and a listed allergy count as recorded, blank does not', () => {
    expect(missingFactsFromConsultation(consult({ allergies: '' }), false).allergyStatusRecorded).toBe(false);
    expect(missingFactsFromConsultation(consult({ allergies: 'NKDA' }), false).allergyStatusRecorded).toBe(true);
    expect(missingFactsFromConsultation(consult({ allergies: 'Penicillin (rash)' }), false).allergyStatusRecorded).toBe(true);
  });
  it('pregnancy status: a negative test, a pregnancy test result or a hysterectomy is recorded', () => {
    const f = (x: Partial<MissingConsultation>) => missingFactsFromConsultation(consult({ sex: 'female', age: '30', ...x }), false).pregnancyStatusRecorded;
    expect(f({})).toBe(false);
    expect(f({ assessment: 'Pregnancy test negative.' })).toBe(true);
    expect(f({ investigationResults: { 'Urine Pregnancy Test (F)': 'Negative' } })).toBe(true);
    expect(f({ surgicalHistory: ['Total abdominal hysterectomy 2019'] })).toBe(true);
  });
  it('a renally cleared drug written in the plan counts as planned; resulted investigations are not planned', () => {
    const f = missingFactsFromConsultation(consult({
      plan: 'Analgesia: paracetamol and ibuprofen 400 mg TDS.', orderedInvestigations: ['CT abdomen', 'FBC'],
      investigationResults: { FBC: 'Hb 13' },
    }), false);
    expect(f.plannedMedications).toContain('ibuprofen');
    expect(f.plannedInvestigations).toEqual(['CT abdomen']);
  });
});

describe('whats-missing-web — the owner\'s examples end to end', () => {
  it('child without weight: weight first', () => {
    const r = buildWhatsMissing(consult({ age: '7', allergies: '', pendingPrescriptions: [{ drugName: 'Paracetamol' }] }));
    expect(r.items[0].id).toBe('weight');
    expect(r.items[1].id).toBe('allergy');
  });
  it('woman aged 30 with a CT planned: pregnancy status first, with the test as the action', () => {
    const r = buildWhatsMissing(consult({ sex: 'female', age: '30', orderedInvestigations: ['CT abdomen and pelvis'] }));
    expect(r.items[0].id).toBe('pregnancy');
    expect(r.items[0].action).toEqual({ kind: 'test', test: 'Urine pregnancy test (β-hCG)' });
  });
  it('NSAID planned without eGFR: renal function first', () => {
    const r = buildWhatsMissing(consult({ pendingPrescriptions: [{ drugName: 'Ibuprofen 400 mg' }] }));
    expect(r.items[0].id).toBe('renal');
    expect(r.items[0].why).toMatch(/ibuprofen/);
  });
  it('eGFR on file: no renal item for the NSAID', () => {
    const r = buildWhatsMissing(consult({ pendingPrescriptions: [{ drugName: 'Ibuprofen 400 mg' }], extractedLabs: { egfr: 88 } }));
    expect(r.items.some(i => i.id === 'renal')).toBe(false);
  });
  it('a value already in the record is not listed as missing (WBC on file, TG18 active)', () => {
    const r = buildWhatsMissing(consult({ extractedLabs: { wbc: 14, crp: 90 } }), { activeScores: ['tg18-cholecystitis'] });
    expect(r.items.some(i => i.id === 'fbc')).toBe(false);
    expect(r.items.some(i => i.id === 'imaging-us')).toBe(true);
  });
});
