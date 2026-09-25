/**
 * web-last-gaps (2026-09-25): the last web critical failures of `clinval:web` and the queued
 * screening hooks. See docs/clinical-validation/changes/web-last-gaps.md.
 */
import { describe, expect, it } from 'vitest';
import { computeClinicalPrompts, type InferenceInput } from '../clinical-inference';
import { scoreTokyoCholangitis, scoreTokyoCholecystitis, type ExtractedLabs } from '../clinical-scores';
import {
  durationOver72h, tg18OrganDysfunction, tokyoCholangitisAutoFill, tokyoCholecystitisAutoFill, type Tg18Record,
} from '../tg18-autofill';

function input(over: Partial<InferenceInput>): InferenceInput {
  return {
    age: '45', sex: 'male', symptoms: [], comorbidities: [], familyHistory: [], toxicHabits: [],
    medications: [], medicationsText: '', pregnancyPossible: false,
    ccEntries: [{ complaint: 'Other / general surgical', answers: {} }],
    encounterType: 'surgical_consult',
    examGeneral: '', examAbdomen: '', examBreast: '', examCardio: '', examResp: '', examNeuro: '',
    examExtremities: '', investigationResults: {}, radiologyRequests: [], vitals: {}, assessment: '',
    ...over,
  };
}
const prompts = (over: Partial<InferenceInput>) => computeClinicalPrompts(input(over));
const planText = (over: Partial<InferenceInput>) => prompts(over).flatMap(p => p.actions.map(a => `${a.text} ${a.addToPlan ?? ''}`)).join('\n');

function record(over: Partial<Tg18Record>): Tg18Record {
  return {
    age: 60, systolicBp: 130, avpu: 'A', labs: {} as ExtractedLabs, examText: '', historyText: '', assessment: '',
    imagingReports: [], ...over,
  };
}

describe('TG18 auto-fill from the record (mirrors iOS 1f50221)', () => {
  it('organ dysfunction: SBP < 90 / vasopressor, AVPU, creatinine > 177 µmol/L, INR > 1.5, platelets < 100', () => {
    expect(tg18OrganDysfunction(record({ systolicBp: 78 }))).toContain('cardiovascular');
    expect(tg18OrganDysfunction(record({ examText: 'Now on noradrenaline 0.1 microgram/kg/min.' }))).toContain('cardiovascular');
    expect(tg18OrganDysfunction(record({ examText: 'No vasopressor needed.' }))).not.toContain('cardiovascular');
    expect(tg18OrganDysfunction(record({ avpu: 'V' }))).toContain('neurological');
    expect(tg18OrganDysfunction(record({ avpu: '' }))).not.toContain('neurological');
    expect(tg18OrganDysfunction(record({ labs: { creatinine: 212 } }))).toContain('renal');
    expect(tg18OrganDysfunction(record({ labs: { creatinine: 150 } }))).not.toContain('renal');
    expect(tg18OrganDysfunction(record({ labs: { creatinine: 2.4 } }))).toContain('renal');
    expect(tg18OrganDysfunction(record({ labs: { inr: 1.8 } }))).toContain('hepatic');
    expect(tg18OrganDysfunction(record({ labs: { inr: 1.4 } }))).not.toContain('hepatic');
    expect(tg18OrganDysfunction(record({ labs: { platelets: 74 } }))).toContain('haematological');
    expect(tg18OrganDysfunction(record({ labs: { platelets: 190 } }))).toEqual([]);
  });
  it('respiratory dysfunction is never inferred', () => {
    expect(tg18OrganDysfunction(record({ examText: 'SpO2 86% on air, respiratory failure' }))).not.toContain('respiratory');
  });
  it('cholangitis in septic shock with a dilated, stone-filled duct auto-fills Grade III', () => {
    const labs: ExtractedLabs = { wbc: 24.8, crp: 280, bilirubin_total: 142, alp: 520, albumin: 24, creatinine: 212, platelets: 74, inr: 1.8 };
    const r = record({
      age: 82, systolicBp: 78, avpu: 'V', labs,
      examText: 'Jaundiced, drowsy. Temperature 39.6 °C with rigors. Noradrenaline started.',
      imagingReports: ['Common bile duct dilated to 14 mm with multiple distal duct stones.'],
    });
    const auto = tokyoCholangitisAutoFill(r);
    expect(auto.biliary_dilatation).toBe(true);
    expect(auto.biliary_cause_on_imaging).toBe(true);
    expect(scoreTokyoCholangitis(auto, labs, { temperatureC: 39.6 }).score).toBe(3);
  });
  it('cholangitis Grade I: age ≥ 75 is one Grade II criterion only', () => {
    const labs: ExtractedLabs = { wbc: 11.2, crp: 64, bilirubin_total: 58, alp: 320, albumin: 36, creatinine: 98, platelets: 210 };
    const auto = tokyoCholangitisAutoFill(record({ age: 78, labs, imagingReports: ['Gallstones. CBD dilated to 9 mm; distal duct obscured by bowel gas.'] }));
    expect(scoreTokyoCholangitis(auto, labs, { temperatureC: 38.4 }).score).toBe(1);
  });
  it('a CBD of 5 mm is not dilated; after cholecystectomy 8 mm is not either', () => {
    expect(tokyoCholangitisAutoFill(record({ imagingReports: ['CBD 5 mm, not dilated.'] })).biliary_dilatation).toBe(false);
    expect(tokyoCholangitisAutoFill(record({ imagingReports: ['CBD 8 mm.'], surgicalHistory: ['Laparoscopic cholecystectomy 2019'] })).biliary_dilatation).toBe(false);
  });
  it('cholecystitis with septic shock auto-fills Grade III', () => {
    const labs: ExtractedLabs = { wbc: 22.4, crp: 310, creatinine: 238, platelets: 88, inr: 1.4 };
    const auto = tokyoCholecystitisAutoFill(record({
      age: 71, systolicBp: 82, avpu: 'C', labs,
      examText: 'Drowsy. On noradrenaline.\nTender right upper quadrant with guarding and a positive Murphy\'s sign.',
      historyText: 'Four days of right upper quadrant pain and fever.',
      imagingReports: ['Distended gallbladder with gallstones, wall thickened to 8 mm with pericholecystic fluid. No intramural gas.'],
    }));
    expect(auto.murphy_sign).toBe(true);
    expect(auto.us_wall_thickening).toBe(true);
    expect(auto.marked_local_inflammation).toBe(false);
    expect(auto.duration_over_72h).toBe(true);
    expect(scoreTokyoCholecystitis(auto, labs, { temperatureC: 39.1 }).score).toBe(3);
  });
  it('cholecystitis Grade I: Murphy positive, < 72 h, no mass, WBC 13', () => {
    const labs: ExtractedLabs = { wbc: 13.1, crp: 86 };
    const auto = tokyoCholecystitisAutoFill(record({
      labs,
      examText: 'Tender in the right upper quadrant with a positive Murphy\'s sign and localised guarding; no palpable mass.',
      historyText: '30 hours of constant right upper quadrant pain.',
      imagingReports: ['Wall thickened to 5 mm with a thin rim of pericholecystic fluid.'],
    }));
    expect(auto.palpable_tender_mass).toBe(false);
    expect(scoreTokyoCholecystitis(auto, labs, { temperatureC: 38.2 }).score).toBe(1);
  });
  it('an equivocal Murphy\'s sign is not auto-ticked', () => {
    expect(tokyoCholecystitisAutoFill(record({ examText: 'Murphy\'s sign equivocal.' })).murphy_sign).toBe(false);
  });
  it('duration > 72 h reads days and hours', () => {
    expect(durationOver72h('Four days of pain')).toBe(true);
    expect(durationOver72h('Three days of pain')).toBe(false);
    expect(durationOver72h('80 hours of pain')).toBe(true);
    expect(durationOver72h('Two and a half days of pain')).toBe(false);
  });
});

describe('forbidden wording in prompts (NCCN; RCOG GTG 37a)', () => {
  it('inflammatory breast cancer: BCS and SLNB are "not recommended", never offered', () => {
    const t = planText({
      sex: 'female', age: '52', examBreast: 'Hard fixed mass with peau d\'orange over two-thirds of the breast',
      assessment: 'Inflammatory breast cancer (T4d)',
    });
    expect(t).toMatch(/not recommended in inflammatory breast cancer/);
    expect(t).not.toMatch(/no wide local excision/i);
  });
  it('pregnancy: warfarin and DOACs are stated as contraindicated', () => {
    const t = planText({ sex: 'female', age: '30', pregnancyPossible: true, historyText: '22 weeks pregnant. Swollen left calf.' });
    expect(t).toMatch(/DOACs and warfarin are contraindicated in pregnancy/);
  });
});

describe('malignant large-bowel obstruction: colonic stent by side and contraindications (WSES 2018; ESGE 2020)', () => {
  const base: Partial<InferenceInput> = {
    age: '79', sex: 'female', encounterType: 'major_emergency',
    symptoms: ['abdominal distension', 'vomiting', 'abdominal pain'],
    ccEntries: [{ complaint: 'Acute abdominal pain', answers: {} }],
  };
  it('impending caecal perforation: stent contraindicated, emergency surgery', () => {
    const t = planText({
      ...base,
      examAbdomen: 'Massively distended; tender with guarding and rebound in the right iliac fossa. Bowel sounds absent.',
      radiologyRequests: [{ modality: 'CT', anatomicalRegion: 'Abdomen', resultReceived: true, indication: 'LBO', resultNotes: 'Large bowel obstruction from a stenosing sigmoid tumour (closed loop). Caecum 13.5 cm with pneumatosis of the caecal wall — impending perforation.' }],
      assessment: 'Large bowel obstruction from sigmoid carcinoma with closed-loop caecal distension and caecal pneumatosis. Emergency laparotomy.',
    });
    expect(t).toMatch(/Colonic stenting is contraindicated/);
    expect(t).not.toMatch(/colonic stent as (a )?bridge/i);
  });
  it('right-sided tumour: right hemicolectomy, no stent / Hartmann\'s', () => {
    const t = planText({
      ...base,
      examAbdomen: 'Distended, mildly tender on the right, no peritonism.',
      radiologyRequests: [{ modality: 'CT', anatomicalRegion: 'Abdomen', resultReceived: true, indication: 'LBO', resultNotes: 'Obstructing tumour at the hepatic flexure with dilated small bowel and ascending colon; no perforation.' }],
      assessment: 'Large bowel obstruction from an obstructing hepatic flexure carcinoma, no perforation.',
    });
    expect(t).toMatch(/right \(extended\) hemicolectomy/);
    expect(t).not.toMatch(/Hartmann'?s? (procedure|operation)|colonic stent as/);
  });
  it('left-sided without contraindication: stent as a bridge or emergency resection', () => {
    const t = planText({
      ...base,
      examAbdomen: 'Distended, soft, mildly tender. No peritonism.',
      radiologyRequests: [{ modality: 'CT', anatomicalRegion: 'Abdomen', resultReceived: true, indication: 'LBO', resultNotes: 'Large bowel obstruction from a sigmoid tumour; caecum 8 cm; no perforation.' }],
      assessment: 'Large bowel obstruction from sigmoid carcinoma.',
    });
    expect(t).toMatch(/colonic stent as a bridge to elective resection/);
  });
  it('adhesional small-bowel obstruction gets no colonic stent line', () => {
    const t = planText({
      ...base,
      examAbdomen: 'Distended, tympanic, soft.',
      radiologyRequests: [{ modality: 'CT', anatomicalRegion: 'Abdomen', resultReceived: true, indication: 'SBO', resultNotes: 'Small bowel obstruction with a transition point in the right iliac fossa; adhesions.' }],
      assessment: 'Adhesional small bowel obstruction.',
    });
    expect(t).not.toMatch(/stent/i);
  });
});
