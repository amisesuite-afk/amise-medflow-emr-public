/**
 * cancer-screening 1.1.0 (SURGEON-DECISIONS C9 / C1): the NICE NG12 rules the clinical validation
 * found missing, and the rules that read lab values (FIT, Hb + ferritin) instead of text.
 *
 * DRIFT NOTE: the iOS twin's tests (ios/AmiseMedFlowTests/SuspectedCancerScreeningTests.swift,
 * engine ios/AmiseMedFlow/Services/SuspectedCancerScreening.swift) use the same vectors. Change
 * both together.
 */
import { describe, expect, it } from 'vitest';
import {
  CANCER_SCREENING_VERSION, detectReferrals, hasLabIronDeficiencyAnaemia, isAnaemic, isFitPositive,
  readCancerScreenLabs, screenForCancer,
} from '@workspace/triage-engine';
import type { ScreeningInput } from '@workspace/triage-engine';

const base: ScreeningInput = {
  age: 45, sex: 'male', chiefComplaints: [], symptoms: [], familyHistory: [], responses: {},
};
const metIds = (r: ReturnType<typeof screenForCancer>) => r.criteria.filter(c => c.met).map(c => c.id ?? c.rule);

describe('cancer-screening version', () => {
  it('is stamped 1.1.0', () => expect(CANCER_SCREENING_VERSION).toBe('1.1.0'));
});

describe('readCancerScreenLabs', () => {
  it('reads Hb, ferritin, MCV and FIT by whole-word name', () => {
    const labs = readCancerScreenLabs({
      Haemoglobin: '9.4 g/dL', Ferritin: '5 µg/L', MCV: '71 fL', 'FIT (faecal immunochemical test)': '42 µg Hb/g faeces',
      HbA1c: '58 mmol/mol', 'Benefit review': '12',
    });
    expect(labs).toEqual({ haemoglobinGdl: 9.4, ferritinUgL: 5, mcvFl: 71, fitUgHbG: 42 });
  });
  it('converts Hb in g/L to g/dL and does not read HbA1c as haemoglobin', () => {
    expect(readCancerScreenLabs({ Hb: '94 g/L' }).haemoglobinGdl).toBeCloseTo(9.4);
    expect(readCancerScreenLabs({ HbA1c: '8.4 %' }).haemoglobinGdl).toBeUndefined();
  });
  it('reads a FIT written as text, and "< 4" as below threshold', () => {
    expect(readCancerScreenLabs({ FIT: 'Positive' }).fitPositive).toBe(true);
    expect(readCancerScreenLabs({ FIT: 'Negative' }).fitPositive).toBe(false);
    expect(isFitPositive(readCancerScreenLabs({ qFIT: '< 10 µg/g' }))).toBe(false);
    expect(isFitPositive(readCancerScreenLabs({ qFIT: '10 µg/g' }))).toBe(true);
  });
});

describe('IDA thresholds (BSG 2021)', () => {
  it('anaemia is Hb < 13 (men) / < 12 (women)', () => {
    expect(isAnaemic(12.9, 'male')).toBe(true);
    expect(isAnaemic(12.9, 'female')).toBe(false);
  });
  it('IDA needs anaemia and ferritin < 45', () => {
    expect(hasLabIronDeficiencyAnaemia({ haemoglobinGdl: 11, ferritinUgL: 44 }, 'female')).toBe(true);
    expect(hasLabIronDeficiencyAnaemia({ haemoglobinGdl: 11, ferritinUgL: 60 }, 'female')).toBe(false);
    expect(hasLabIronDeficiencyAnaemia({ haemoglobinGdl: 11 }, 'female')).toBe(false);
  });
});

describe('NG12 rules added in 1.1.0', () => {
  it('rectal bleeding at 50 or over → colorectal 2WW', () => {
    const r = screenForCancer({ ...base, age: 52, symptoms: ['rectal bleeding'] });
    expect(metIds(r)).toContain('ng12-rectal-bleeding-50');
    expect(r.referralUrgency).toBe('two_week_wait');
    expect(r.cancerType).toBe('colorectal');
  });
  it('rectal bleeding under 50 alone does not meet the rule', () => {
    const r = screenForCancer({ ...base, age: 42, symptoms: ['rectal bleeding'] });
    expect(metIds(r)).not.toContain('ng12-rectal-bleeding-50');
  });
  it('reads rectal bleeding from free text, negation-aware', () => {
    expect(metIds(screenForCancer({ ...base, age: 60, freeText: 'Two months of blood mixed with the stool.' }))).toContain('ng12-rectal-bleeding-50');
    expect(metIds(screenForCancer({ ...base, age: 60, freeText: 'No rectal bleeding, no weight loss.' }))).not.toContain('ng12-rectal-bleeding-50');
  });
  it('weight loss + abdominal pain at 40 or over → colorectal', () => {
    const r = screenForCancer({ ...base, age: 44, symptoms: ['abdominal pain', 'weight loss'] });
    expect(metIds(r)).toContain('ng12-weight-loss-abdominal-pain-40');
  });
  it('FIT ≥ 10 µg Hb/g → colorectal 2WW at any age, below 10 does not', () => {
    const pos = screenForCancer({ ...base, age: 38, labs: { fitUgHbG: 42 } });
    expect(metIds(pos)).toContain('fit-10');
    expect(pos.recommendedInvestigation).toContain('Colonoscopy');
    expect(metIds(screenForCancer({ ...base, age: 38, labs: { fitUgHbG: 8 } }))).not.toContain('fit-10');
  });
  it('IDA on bloods at 60+ → 2WW with bidirectional endoscopy, coeliac serology and urinalysis', () => {
    const r = screenForCancer({ ...base, age: 72, labs: { haemoglobinGdl: 9.1, ferritinUgL: 6 } });
    expect(metIds(r)).toContain('ng12-ida-60');
    expect(r.referralUrgency).toBe('two_week_wait');
    expect(r.recommendedInvestigation).toEqual(expect.arrayContaining([
      'Colonoscopy', 'OGD (bidirectional endoscopy with colonoscopy)', 'Coeliac serology (tTG-IgA)', 'Urinalysis',
    ]));
  });
  it('IDA in a man under 60 → urgent (not 2WW) bidirectional endoscopy; premenopausal-age woman → nothing', () => {
    const man = screenForCancer({ ...base, age: 45, labs: { haemoglobinGdl: 11, ferritinUgL: 8 } });
    expect(metIds(man)).toContain('bsg-ida');
    expect(man.referralUrgency).toBe('urgent');
    const woman = screenForCancer({ ...base, sex: 'female', age: 35, labs: { haemoglobinGdl: 10, ferritinUgL: 8 } });
    expect(woman.triggered).toBe(false);
  });
  it('nipple discharge at 50 or over → breast 2WW; bloody discharge adds duct excision; bilateral does not count', () => {
    const r = screenForCancer({ ...base, sex: 'female', age: 52, symptoms: ['nipple discharge'], freeText: 'Blood-stained discharge from the left nipple.' });
    const c = r.criteria.find(x => x.id === 'ng12-nipple-50');
    expect(c?.met).toBe(true);
    expect(c?.investigations).toEqual(expect.arrayContaining(['Mammogram', 'Breast ultrasound', 'Microdochectomy / duct excision if imaging is normal']));
    expect(r.cancerType).toBe('breast');
    expect(metIds(screenForCancer({ ...base, sex: 'female', age: 52, freeText: 'Bilateral milky nipple discharge.' }))).not.toContain('ng12-nipple-50');
    expect(metIds(screenForCancer({ ...base, sex: 'female', age: 45, symptoms: ['nipple discharge'] }))).not.toContain('ng12-nipple-50');
  });
  it('visible haematuria at 45 or over → urological 2WW, unless explained by UTI / stones', () => {
    const r = screenForCancer({ ...base, age: 66, symptoms: ['haematuria'] });
    expect(metIds(r)).toContain('ng12-haematuria-45');
    expect(r.cancerType).toBe('urological');
    expect(r.recommendedInvestigation).toEqual(expect.arrayContaining(['Cystoscopy', 'CT urogram']));
    expect(metIds(screenForCancer({ ...base, age: 66, symptoms: ['haematuria', 'loin pain'] }))).not.toContain('ng12-haematuria-45');
    expect(metIds(screenForCancer({ ...base, age: 66, freeText: 'Microscopic haematuria on dipstick.' }))).not.toContain('ng12-haematuria-45');
    expect(metIds(screenForCancer({ ...base, age: 40, symptoms: ['haematuria'] }))).not.toContain('ng12-haematuria-45');
  });
});

describe('negation-aware chip matching (existing rules)', () => {
  it('a negated chip does not count', () => {
    expect(screenForCancer({ ...base, age: 60, symptoms: ['no dysphagia'] }).triggered).toBe(false);
  });
  it('a negation in one chip does not reach the next chip', () => {
    const r = screenForCancer({ ...base, age: 60, symptoms: ['no appetite change', 'dysphagia'] });
    expect(r.cancerType).toBe('oesophago-gastric');
  });
  it('detectReferrals ignores "no chest pain"', () => {
    const r = detectReferrals({ ...base, symptoms: ['no chest pain'] });
    expect(r.some(x => x.specialty === 'Cardiology')).toBe(false);
  });
});
