/**
 * Preventive screening engine (lib/triage-engine/src/screening/preventive.ts) and its dashboard
 * adapter (preventive-screening-prompts.ts, reached through computeClinicalPrompts).
 * SURGEON-DECISIONS G2.19 (USPSTF primary; ACG/US MSTF colonoscopy; ADA 2024; NICE NG136) and C9.
 */
import { describe, expect, it } from 'vitest';
import {
  PREVENTIVE_SCREENING_VERSION, parsePolypFindings, polypSurveillanceInterval, preventiveScreeningItems,
  readFamilyRisk, readPersonalRisk, readSmoking,
} from '@workspace/triage-engine';
import type { PreventiveScreeningInput } from '@workspace/triage-engine';
import { computeClinicalPrompts, type InferenceInput } from '../clinical-inference';

function items(over: Partial<PreventiveScreeningInput>) {
  return preventiveScreeningItems({ age: 50, sex: 'male', pastHistory: [], familyHistory: [], ...over });
}
const ids = (over: Partial<PreventiveScreeningInput>) => items(over).map(i => i.id);
const item = (over: Partial<PreventiveScreeningInput>, id: string) => items(over).find(i => i.id === id);
const planText = (over: Partial<PreventiveScreeningInput>, id: string) =>
  (item(over, id)?.actions ?? []).map(a => `${a.text} ${a.plan ?? ''} ${a.investigation ?? ''}`).join(' | ');

describe('version stamp', () => {
  it('is 1.0.1', () => expect(PREVENTIVE_SCREENING_VERSION).toBe('1.0.1'));
});

describe('suppression', () => {
  it('returns nothing without an age or in an emergency encounter', () => {
    expect(items({ age: null })).toEqual([]);
    expect(items({ setting: 'emergency' })).toEqual([]);
  });
});

describe('colorectal (USPSTF 2021; ACG 2021; US MSTF)', () => {
  it('average risk starts at 45 with FIT yearly or colonoscopy 10-yearly', () => {
    expect(ids({ age: 44 })).not.toContain('screen_crc_average');
    const t = item({ age: 46, sex: 'female' }, 'screen_crc_average')!;
    expect(t.title).toMatch(/FIT every year or colonoscopy every 10 years/);
    expect(t.guideline).toMatch(/USPSTF 2021/);
  });
  it('76–85 is an individualised decision without a 10-yearly colonoscopy line; nothing over 85', () => {
    expect(ids({ age: 81 })).toContain('screen_crc_individualised');
    expect(planText({ age: 81 }, 'screen_crc_individualised')).not.toMatch(/colonoscopy every 10/i);
    expect(ids({ age: 81 })).not.toContain('screen_crc_average');
    expect(ids({ age: 86 }).some(i => i.startsWith('screen_crc'))).toBe(false);
  });
  it('a normal colonoscopy within 10 years reads as up to date', () => {
    const t = item({ age: 68, pastHistory: ['Colonoscopy 4 years ago — normal'] }, 'screen_crc_average')!;
    expect(t.title).toMatch(/up to date/);
  });
  it('FDR < 60 → colonoscopy from 40 (or 10 years before the youngest), every 5 years', () => {
    const t = item({ age: 47, pastHistory: ['Family history of colorectal cancer (father, age 58)'] }, 'screen_crc_family_history')!;
    expect(t.actions[0].investigation).toBe('Colonoscopy');
    expect(t.rationale).toMatch(/every 5 years/);
    const young = item({ age: 41, sex: 'female', pastHistory: ['Family history: sister colorectal cancer at 48'] }, 'screen_crc_family_history')!;
    expect(young.rationale).toMatch(/from age 38/);
  });
  it('one FDR ≥ 60 → from 40 with average-risk intervals (no 5-yearly colonoscopy)', () => {
    const t = item({ age: 42, familyHistory: ['Mother bowel cancer at 72'] }, 'screen_crc_family_history')!;
    expect(t.actions[0].investigation).toBeUndefined();
    expect(t.rationale).toMatch(/average-risk/);
  });
  it('second-degree relatives only → average risk', () => {
    expect(ids({ age: 46, familyHistory: ['Maternal aunt colon cancer at 70'] })).toContain('screen_crc_average');
  });
  it('negated family history does not count', () => {
    expect(ids({ age: 46, familyHistory: ['No family history of bowel cancer'] })).toContain('screen_crc_average');
  });
  it('Lynch features in the family → genetics referral with tumour MMR/MSI request', () => {
    const t = item({
      age: 41, sex: 'female',
      pastHistory: ['Family history: sister colorectal cancer at 48', 'Family history: mother endometrial cancer at 55'],
    }, 'screen_crc_lynch_genetics')!;
    expect(t.actions.map(a => a.plan).join(' ')).toMatch(/mismatch repair|genetics/i);
  });
  it('known Lynch carrier → 2-yearly colonoscopy, aspirin discussion, no average-risk item', () => {
    const over = { age: 38, pastHistory: ['Lynch syndrome (MLH1)', 'Family history of colorectal cancer (mother, age 44)'] };
    const t = item(over, 'screen_crc_lynch')!;
    expect(t.title).toMatch(/MLH1/);
    expect(planText(over, 'screen_crc_lynch')).toMatch(/every 2 years/);
    expect(planText(over, 'screen_crc_lynch')).toMatch(/aspirin/i);
    expect(ids(over)).not.toContain('screen_crc_family_history');
  });
});

describe('post-polypectomy surveillance (US MSTF 2020)', () => {
  const interval = (text: string) => polypSurveillanceInterval(parsePolypFindings([text])!).interval;
  it('1–2 tubular adenomas < 10 mm → 7–10 years', () => {
    expect(interval('Two tubular adenomas < 10 mm, low-grade dysplasia, completely removed at colonoscopy.')).toMatch(/7–10 years/);
  });
  it('adenoma ≥ 10 mm → 3 years', () => {
    expect(parsePolypFindings(['Three adenomas, one ≥ 10 mm (advanced).', 'Surveillance colonoscopy at 3 years.'])).not.toBeNull();
    expect(polypSurveillanceInterval(parsePolypFindings(['Three adenomas, one ≥ 10 mm (advanced).', 'Colonoscopy report.'])!).interval).toBe('Next colonoscopy in 3 years');
  });
  it('tubulovillous or high-grade dysplasia → 3 years', () => {
    expect(interval('One 8 mm tubulovillous adenoma in the sigmoid.')).toBe('Next colonoscopy in 3 years');
    expect(interval('Single 6 mm tubular adenoma with high-grade dysplasia, rectum.')).toBe('Next colonoscopy in 3 years');
  });
  it('piecemeal EMR ≥ 20 mm → site check at 6 months', () => {
    expect(interval('30 mm tubulovillous adenoma (LGD) removed piecemeal by EMR, ascending colon.')).toMatch(/6 months/);
  });
  it('hyperplastic < 10 mm → return to screening at 10 years', () => {
    expect(interval('Two 4 mm hyperplastic polyps in the rectum.')).toMatch(/10 years/);
  });
  it('ignores non-colonic polyps and adenomas', () => {
    expect(parsePolypFindings(['12 mm gallbladder polyp on ultrasound.'])).toBeNull();
    expect(parsePolypFindings(['Parathyroid adenoma on sestamibi.'])).toBeNull();
    expect(parsePolypFindings(['Coeliac disease with villous atrophy.'])).toBeNull();
  });
  it('replaces average-risk screening, and ignores relatives\' polyps', () => {
    const over = { age: 58, notes: ['Two tubular adenomas < 10 mm, completely removed at a complete colonoscopy.'] };
    expect(ids(over)).toContain('screen_crc_polyp_surveillance');
    expect(ids(over)).not.toContain('screen_crc_average');
    expect(ids({ age: 58, notes: ['Father had colon polyps removed.'] })).not.toContain('screen_crc_polyp_surveillance');
  });
});

describe('breast (USPSTF 2024; NCCN 2024 / ACR 2023)', () => {
  it('biennial mammogram 40–74', () => {
    expect(item({ age: 42, sex: 'female' }, 'screen_breast')!.title).toMatch(/every 2 years/);
    expect(ids({ age: 39, sex: 'female' })).not.toContain('screen_breast');
    expect(ids({ age: 75, sex: 'female' })).not.toContain('screen_breast');
    expect(ids({ age: 50, sex: 'male' })).not.toContain('screen_breast');
  });
  it('BRCA carrier → annual MRI, risk-reducing surgery discussion, high-risk service', () => {
    const over = { age: 33, sex: 'female' as const, pastHistory: ['BRCA1 pathogenic variant carrier', 'Family history: mother breast cancer at 41'] };
    const t = planText(over, 'screen_breast_high_risk');
    expect(t).toMatch(/MRI breast/);
    expect(t).toMatch(/risk-reducing mastectomy/);
    expect(t).toMatch(/high-risk breast/);
    expect(ids(over)).not.toContain('screen_breast_family_history');
  });
  it('a relative\'s BRCA result is family history, not carrier status', () => {
    const r = readPersonalRisk(['Family history: mother BRCA2 carrier'], ['Mother is a BRCA2 carrier.']);
    expect(r.brcaCarrier).toBe(false);
    expect(ids({ age: 35, sex: 'female', familyHistory: ['BRCA mutation'] })).toContain('screen_breast_family_history');
  });
});

describe('cervical (USPSTF 2018; WHO 2021)', () => {
  it('HPV test from 30, cytology 21–29, none after 65', () => {
    expect(item({ age: 34, sex: 'female' }, 'screen_cervical')!.actions.some(a => a.investigation?.includes('HPV'))).toBe(true);
    expect(item({ age: 25, sex: 'female' }, 'screen_cervical')!.actions.some(a => a.investigation === 'Cervical cytology')).toBe(true);
    expect(ids({ age: 66, sex: 'female' })).not.toContain('screen_cervical');
  });
  it('not after total hysterectomy for benign disease; continues after subtotal or with CIN2+', () => {
    expect(ids({ age: 52, sex: 'female', notes: ['Cervical screening not required (total hysterectomy for benign disease, no CIN history).'] })).not.toContain('screen_cervical');
    expect(ids({ age: 52, sex: 'female', pastHistory: ['Subtotal hysterectomy (cervix retained)'] })).toContain('screen_cervical');
    expect(ids({ age: 52, sex: 'female', pastHistory: ['Total hysterectomy', 'CIN3 treated'] })).toContain('screen_cervical');
  });
});

describe('prostate (USPSTF 2018)', () => {
  it('shared decision 55–69, never an automatic PSA order, nothing from 70', () => {
    const t = item({ age: 58 }, 'screen_prostate')!;
    expect(t.actions.some(a => a.investigation)).toBe(false);
    expect(ids({ age: 54 })).not.toContain('screen_prostate');
    expect(ids({ age: 70 })).not.toContain('screen_prostate');
    expect(ids({ age: 81 })).not.toContain('screen_prostate');
  });
  it('family history of prostate cancer → discussion from 45 (ACS 2023, needs sign-off)', () => {
    expect(ids({ age: 47, familyHistory: ['Father prostate cancer at 62'] })).toContain('screen_prostate');
  });
});

describe('AAA, lung, tobacco (USPSTF 2019 / 2021)', () => {
  it('one-time AAA ultrasound for men 65–75 who ever smoked', () => {
    expect(ids({ age: 68, toxicHabits: ['Ex-smoker (30 pack-years)'] })).toContain('screen_aaa');
    expect(ids({ age: 68, toxicHabits: ['Never smoked'] })).not.toContain('screen_aaa');
    expect(ids({ age: 68, sex: 'female', toxicHabits: ['Ex-smoker'] })).not.toContain('screen_aaa');
    expect(ids({ age: 76, toxicHabits: ['Ex-smoker'] })).not.toContain('screen_aaa');
  });
  it('LDCT at 50–80 with ≥ 20 pack-years, current or quit ≤ 15 years', () => {
    expect(ids({ age: 52, toxicHabits: ['Smoker (15/day, 25 pack-years)'] })).toContain('screen_lung_ldct');
    expect(ids({ age: 52, toxicHabits: ['Smoker (10 pack-years)'] })).not.toContain('screen_lung_ldct');
    expect(ids({ age: 60, toxicHabits: ['Ex-smoker, 30 pack-years, quit 20 years ago'] })).not.toContain('screen_lung_ldct');
    expect(ids({ age: 81, toxicHabits: ['Smoker 40 pack-years'] })).not.toContain('screen_lung_ldct');
  });
  it('smoking status reading', () => {
    expect(readSmoking(['Non-smoker']).status).toBe('never');
    expect(readSmoking(['Ex-smoker (30 pack-years)'])).toEqual({ status: 'former', packYears: 30, yearsSinceQuit: null });
    expect(readSmoking(['Smoker (5/day)']).status).toBe('current');
    expect(ids({ age: 30, toxicHabits: ['Smoking'] })).toContain('screen_tobacco_cessation');
  });
});

describe('blood-borne viruses (USPSTF 2020 / CDC 2023 / USPSTF 2019)', () => {
  it('HCV, HBV triple panel and HIV once in adulthood', () => {
    const inv = item({ age: 36 }, 'screen_bbv')!.actions.map(a => a.investigation).filter(Boolean);
    expect(inv).toEqual(expect.arrayContaining(['Hepatitis C Antibody', 'HBsAg (Hepatitis B)', 'HIV Combo (4th gen)']));
  });
  it('a known infection is not screened for again, and is not named in the title', () => {
    const t = item({ age: 41, pastHistory: ['HIV infection (CD4 140, not on ART)'] }, 'screen_bbv')!;
    expect(t.title).not.toMatch(/HIV/);
    expect(t.actions.some(a => a.investigation?.includes('HIV'))).toBe(false);
  });
});

describe('diabetes (ADA 2024)', () => {
  it('from 35, or earlier with overweight + a risk factor or previous GDM', () => {
    expect(ids({ age: 34 })).not.toContain('screen_diabetes');
    expect(ids({ age: 35 })).toContain('screen_diabetes');
    expect(ids({ age: 30, sex: 'female', pastHistory: ['Previous gestational diabetes'] })).toContain('screen_diabetes');
    expect(ids({ age: 30, pastHistory: ['Obesity (BMI 31)', 'Family history: mother type 2 diabetes'] })).toContain('screen_diabetes');
  });
  it('previous GDM or a family history is not a diabetes diagnosis', () => {
    const r = readPersonalRisk(['Previous gestational diabetes', 'Family history: mother type 2 diabetes']);
    expect(r.knownDiabetes).toBe(false);
    expect(readPersonalRisk(['Type 2 diabetes mellitus']).knownDiabetes).toBe(true);
    expect(ids({ age: 50, pastHistory: ['Type 2 diabetes mellitus'] })).not.toContain('screen_diabetes');
  });
  it('not repeated when an HbA1c is already on file', () => {
    expect(ids({ age: 50, resultNames: ['HbA1c'] })).not.toContain('screen_diabetes');
  });
});

describe('blood pressure (USPSTF 2021; NICE NG136) and cardiovascular risk (USPSTF 2022)', () => {
  it('clinic BP 140–179 / 90–119 without hypertension → ABPM/HBPM, urine ACR', () => {
    const t = planText({ age: 49, systolicBp: 152, diastolicBp: 94 }, 'screen_bp_confirm');
    expect(t).toMatch(/ambulatory/i);
    expect(t).toMatch(/Albumin:Creatinine/);
    expect(ids({ age: 49, systolicBp: 128, diastolicBp: 80 })).not.toContain('screen_bp_confirm');
    expect(ids({ age: 49, systolicBp: 208, diastolicBp: 126 })).not.toContain('screen_bp_confirm');
    expect(ids({ age: 49, systolicBp: 152, diastolicBp: 94, pastHistory: ['Hypertension'] })).not.toContain('screen_bp_confirm');
  });
  it('10-year risk and lipids at 40–75 without CVD', () => {
    expect(planText({ age: 52 }, 'screen_cv_risk')).toMatch(/10-year/);
    expect(ids({ age: 52, pastHistory: ['Myocardial infarction 2019'] })).not.toContain('screen_cv_risk');
    expect(ids({ age: 39 })).not.toContain('screen_cv_risk');
  });
});

describe('H. pylori and osteoporosis', () => {
  it('FDR with gastric cancer → H. pylori test-and-treat', () => {
    expect(ids({ age: 44, pastHistory: ['Family history: father gastric cancer at 62'] })).toContain('screen_hpylori_gastric_fdr');
    expect(ids({ age: 44, familyHistory: ['Uncle stomach cancer'] })).not.toContain('screen_hpylori_gastric_fdr');
  });
  it('DXA for women ≥ 65, without a supplement dose line', () => {
    const t = planText({ age: 66, sex: 'female' }, 'screen_osteoporosis');
    expect(t).toMatch(/DXA/);
    expect(t).not.toMatch(/\d+\s*(IU|mg)/);
  });
});

describe('family-history parsing', () => {
  it('reads cancer site, relative degree and age', () => {
    const f = readFamilyRisk(['Colorectal cancer'], ['Family history: maternal aunt ovarian cancer at 52', 'Family history of colorectal cancer (father, age 58)']);
    expect(f.cancers).toEqual(expect.arrayContaining([
      { cancer: 'colorectal', firstDegree: true, ageAtDiagnosis: null },
      { cancer: 'ovarian', firstDegree: false, ageAtDiagnosis: 52 },
      { cancer: 'colorectal', firstDegree: true, ageAtDiagnosis: 58 },
    ]));
  });
});

// ── Dashboard adapter (computeClinicalPrompts) ─────────────────────────────────

function prompts(over: Partial<InferenceInput>) {
  return computeClinicalPrompts({
    age: '50', sex: 'male', symptoms: [], comorbidities: [], familyHistory: [], toxicHabits: [],
    medications: [], medicationsText: '', pregnancyPossible: false,
    ccEntries: [{ complaint: 'Other / general surgical', answers: {} }],
    encounterType: 'surgical_consult',
    examGeneral: '', examAbdomen: '', examBreast: '', examCardio: '', examResp: '', examNeuro: '',
    examExtremities: '', investigationResults: {}, radiologyRequests: [], vitals: {}, assessment: '',
    ...over,
  });
}

describe('computeClinicalPrompts — preventive section', () => {
  it('the old fixed rules are gone: no PSA at 81, no colonoscopy 10-yearly at 81, no smear after hysterectomy', () => {
    const old = prompts({ age: '81' });
    expect(old.some(p => p.id.includes('psa') || p.id.includes('prostate'))).toBe(false);
    expect(old.flatMap(p => p.actions).some(a => /colonoscopy every 10/i.test(a.addToPlan ?? ''))).toBe(false);
    const hyst = prompts({ age: '52', sex: 'female', assessment: 'Asymptomatic. Cervical screening not required (total hysterectomy for benign disease, no CIN history).' });
    expect(hyst.some(p => p.id === 'screen_cervical')).toBe(false);
  });
  it('USPSTF items appear as preventative prompts with the guideline in the rationale', () => {
    const p = prompts({ age: '46', sex: 'female' }).find(x => x.id === 'screen_crc_average')!;
    expect(p.type).toBe('preventative');
    expect(p.rationale).toMatch(/USPSTF 2021/);
  });
  it('no routine screening in an emergency encounter', () => {
    expect(prompts({ age: '46', encounterType: 'major_emergency' }).some(p => p.id.startsWith('screen_'))).toBe(false);
  });
  it('FIT ≥ 10 raises a suspected-cancer safety prompt with colonoscopy', () => {
    const p = prompts({ age: '56', sex: 'female', investigationResults: { 'FIT (faecal immunochemical test)': '42 µg Hb/g faeces' } })
      .find(x => x.id === 'ng12_suspected_cancer')!;
    expect(p.type).toBe('safety');
    expect(p.finding).toMatch(/FIT 42/);
    expect(p.actions.map(a => a.addToInvestigations)).toContain('Colonoscopy');
    expect(p.actions.map(a => a.addToPlan).join(' ')).toMatch(/2-week wait/);
  });
  it('IDA on bloods → bidirectional endoscopy, coeliac serology, urinalysis and iron replacement', () => {
    const p = prompts({ age: '72', investigationResults: { Haemoglobin: '9.1 g/dL', Ferritin: '6 µg/L', MCV: '72 fL' } })
      .find(x => x.id === 'ng12_suspected_cancer')!;
    const inv = p.actions.map(a => a.addToInvestigations).filter(Boolean);
    expect(inv).toEqual(expect.arrayContaining(['Colonoscopy', 'OGD (bidirectional endoscopy with colonoscopy)', 'Coeliac serology (tTG-IgA)', 'Urinalysis']));
    expect(p.actions.map(a => a.addToPlan).join(' ')).toMatch(/oral iron/);
  });
  it('microcytic anaemia without a ferritin asks for one', () => {
    expect(prompts({ age: '60', investigationResults: { Hb: '10.5 g/dL', MCV: '74 fL' } }).some(p => p.id === 'anaemia_ferritin_check')).toBe(true);
  });
  it('a cancer already diagnosed at that site does not raise the referral prompt', () => {
    const r = prompts({ age: '70', symptoms: ['rectal bleeding'], assessment: 'Obstructing sigmoid cancer.' });
    expect(r.some(p => p.id === 'ng12_suspected_cancer')).toBe(false);
    const s = prompts({ age: '70', symptoms: ['rectal bleeding'], assessment: 'Suspected colorectal cancer.' });
    expect(s.some(p => p.id === 'ng12_suspected_cancer')).toBe(true);
  });
  it('in an emergency the referral prompt carries no investigation orders', () => {
    const p = prompts({ age: '70', symptoms: ['rectal bleeding'], encounterType: 'major_emergency' }).find(x => x.id === 'ng12_suspected_cancer')!;
    expect(p.actions.some(a => a.addToInvestigations)).toBe(false);
    expect(p.actions.map(a => a.addToPlan).join(' ')).toMatch(/once the acute episode is managed/);
  });
});
