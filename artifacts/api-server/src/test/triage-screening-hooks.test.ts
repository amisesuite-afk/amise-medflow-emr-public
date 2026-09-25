/**
 * adaptiveTriage and the screening hand-offs (web-last-gaps, 2026-09-25):
 *  - a positive FIT or iron-deficiency anaemia in the results raises the level (NICE NG12 / DG56;
 *    BSG 2021), through screenForCancer's `labs` and `freeText` inputs;
 *  - an asymptomatic screening or family-history request does not (the word "cancer" is the topic
 *    of the visit), and a relative's cancer is not this patient's comorbidity.
 */
import { describe, expect, it } from 'vitest';
import { adaptiveTriage, type AdaptiveTriageInput } from '@workspace/triage-engine';

const run = (over: Partial<AdaptiveTriageInput>) => adaptiveTriage({ symptoms: [], ...over });

describe('lab-found suspected cancer raises the triage level', () => {
  it('positive FIT → same-day call (2-week-wait criteria met)', () => {
    const r = run({ age: 58, sex: 'female', freeText: 'Referred with a FIT result.', investigationResults: { FIT: '142 µg Hb/g faeces' } });
    expect(r.cancerScreen?.triggered).toBe(true);
    expect(r.recommendedAction).toBe('same_day_call');
  });
  it('FIT below 10 does not', () => {
    const r = run({ age: 58, sex: 'female', freeText: 'Routine review.', investigationResults: { FIT: '< 4 µg Hb/g' } });
    expect(r.recommendedAction).toBe('routine_booking');
  });
  it('iron-deficiency anaemia at 66 (Hb 10.1 g/dL, ferritin 8) → same-day call', () => {
    const r = run({ age: 66, sex: 'male', freeText: 'Tired for three months.', investigationResults: { Haemoglobin: '10.1 g/dL', Ferritin: '8 µg/L' } });
    expect(r.cancerScreen?.triggered).toBe(true);
    expect(r.recommendedAction).toBe('same_day_call');
  });
});

describe('asymptomatic screening requests are not over-triaged', () => {
  it('bowel cancer screening with a family history stays routine', () => {
    const r = run({
      age: 52, sex: 'male', symptoms: ['annual review'],
      freeText: 'Wants bowel cancer screening. No bowel symptoms. Father diagnosed with colorectal cancer at 58. Read that bowel cancer is rising in younger Caribbean men.',
      comorbidities: ['Hypertension', 'Family history of colorectal cancer (father, age 58)'],
    });
    expect(r.reasons).not.toContain('Possible malignancy');
    expect(r.reasons).not.toContain('Higher-risk comorbidity present');
    expect(r.recommendedAction).toBe('routine_booking');
  });
  it('"worried about breast cancer because of family history" with no breast symptoms stays routine', () => {
    const r = run({
      age: 34, sex: 'female',
      freeText: 'Worried about breast cancer because of family history. No breast symptoms. Wants to know her risk and what screening she should have.',
      comorbidities: ['Family history of breast cancer (mother at 38)'],
    });
    expect(r.recommendedAction).toBe('routine_booking');
  });
  it('a lump keeps the malignancy flag even in a screening request', () => {
    const r = run({ age: 45, sex: 'female', freeText: 'Worried about breast cancer and wants screening; no other symptoms but has found a new breast lump.' });
    expect(r.reasons).toContain('Possible malignancy');
  });
  it('a symptom chip keeps the flag', () => {
    const r = run({ age: 60, symptoms: ['rectal bleeding'], freeText: 'Worried about bowel cancer; no other symptoms. Wants screening.' });
    expect(r.reasons).toContain('Possible malignancy');
  });
  it('worry about cancer without an asymptomatic screening context still flags', () => {
    expect(run({ age: 50, freeText: 'Worried she has cancer.' }).reasons).toContain('Possible malignancy');
  });
  it("the patient's own cancer is still a higher-risk comorbidity", () => {
    expect(run({ age: 50, freeText: 'Review.', comorbidities: ['Breast cancer 2019 on letrozole'] }).reasons).toContain('Higher-risk comorbidity present');
  });
});
