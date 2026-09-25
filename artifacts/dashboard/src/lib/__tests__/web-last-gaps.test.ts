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

describe('screening prompts read the surgical history and the HPI (preventive 1.0.1)', () => {
  const ids = (over: Partial<InferenceInput>) => prompts({ encounterType: 'quick_consult', ...over }).map(p => p.id);
  it('a total hysterectomy in the surgical history stops cervical screening', () => {
    expect(ids({ age: '45', sex: 'female' })).toContain('screen_cervical');
    expect(ids({ age: '45', sex: 'female', surgicalHistory: ['Total abdominal hysterectomy 2015 (fibroids)'] })).not.toContain('screen_cervical');
  });
  it("a relative's hysterectomy in the HPI does not", () => {
    expect(ids({ age: '45', sex: 'female', historyText: 'Her mother had a hysterectomy for fibroids.' })).toContain('screen_cervical');
  });
  it('a polypectomy in the HPI gives polyp surveillance instead of average-risk screening', () => {
    const got = ids({ age: '58', sex: 'male', historyText: 'Colonoscopy last year: two tubular adenomas under 10 mm removed.' });
    expect(got).toContain('screen_crc_polyp_surveillance');
    expect(got).not.toContain('screen_crc_average');
  });
  it('a recent normal colonoscopy in the HPI is read as up to date', () => {
    const p = prompts({ encounterType: 'quick_consult', age: '55', sex: 'male', historyText: 'Colonoscopy 3 years ago was normal.' })
      .find(x => x.id === 'screen_crc_average');
    expect(p === undefined || /up to date/i.test(`${p.text} ${p.rationale}`)).toBe(true);
  });
  it("a relative's normal colonoscopy is not the patient's", () => {
    const p = prompts({ encounterType: 'quick_consult', age: '55', sex: 'male', historyText: 'His brother had a normal colonoscopy 2 years ago.' })
      .find(x => x.id === 'screen_crc_average');
    expect(p).toBeDefined();
    expect(`${p!.text} ${p!.rationale}`).not.toMatch(/up to date/i);
  });
});

describe('diabetes prompts use readPersonalRisk().knownDiabetes', () => {
  const ids = (comorbidities: string[]) => prompts({ age: '38', sex: 'female', comorbidities }).map(p => p.id);
  it("previous gestational diabetes or a relative's diabetes is not known diabetes", () => {
    expect(ids(['Previous gestational diabetes'])).not.toContain('diabetes_hba1c');
    expect(ids(['Family history: mother type 2 diabetes'])).not.toContain('diabetes_hba1c');
    expect(ids(['Mother type 2 diabetes'])).not.toContain('diabetes_hba1c');
    expect(ids(['Pre-diabetes'])).not.toContain('diabetes_hba1c');
    expect(ids(['Diabetes insipidus'])).not.toContain('diabetes_hba1c');
  });
  it('type 2 diabetes is', () => {
    expect(ids(['Type 2 diabetes on metformin'])).toContain('diabetes_hba1c');
    expect(ids(['T2DM'])).toContain('diabetes_hba1c');
  });
  it("the type 1 basal-insulin alert is for the patient's own type 1 diabetes only", () => {
    expect(planText({ comorbidities: ['Type 1 diabetes'] })).toMatch(/continue long-acting basal insulin/);
    expect(planText({ comorbidities: ['Family history: brother type 1 diabetes'] })).not.toMatch(/basal insulin/);
  });
});

describe('operative templates (AAGBI/ESA fasting; SIGN 104; WSES 2020; NICE NG148 / NG89; EHS/AHS 2020)', () => {
  const chole = (over: Partial<InferenceInput>) => planText({
    ccEntries: [{ complaint: 'Right upper quadrant pain (biliary colic)', answers: {} }],
    symptoms: ['right upper quadrant pain'],
    ...over,
  });
  it('no fasting from midnight; no routine prophylaxis for low-risk lap chole', () => {
    const t = chole({ assessment: 'Symptomatic cholelithiasis. ASA I.' });
    expect(t).toMatch(/clear fluids up to 2 h/);
    expect(t).not.toMatch(/(nbm|nil by mouth|fast\w*)\s+from\s+midnight/i);
    expect(t).toMatch(/Antibiotic prophylaxis not indicated for low-risk elective laparoscopic cholecystectomy/);
    expect(t).not.toMatch(/Post-operative antibiotics/);
  });
  it('acute cholecystitis: prophylaxis at induction; no post-op antibiotics for Grade I–II', () => {
    const t = chole({ assessment: 'Acute calculous cholecystitis, TG18 Grade I.', examAbdomen: "Positive Murphy's sign" });
    expect(t).toMatch(/single dose at induction/);
    expect(t).toMatch(/not needed after cholecystectomy for TG18 Grade I–II/);
  });
  it('CKD or age ≥ 75: no ibuprofen; dialysis: renally adjusted LMWH, no enoxaparin 40 mg', () => {
    const t = chole({ assessment: 'Symptomatic cholelithiasis.', comorbidities: ['End-stage renal failure on haemodialysis'] });
    expect(t).toMatch(/NSAIDs avoided \(renal impairment/);
    expect(t).not.toMatch(/Ibuprofen 400mg/);
    expect(t).not.toMatch(/enoxaparin\s*40\s*mg/i);
    expect(chole({ age: '81', assessment: 'Symptomatic cholelithiasis.' })).toMatch(/NSAIDs avoided \(age ≥ 75/);
  });
  it('uncomplicated appendicitis: no post-operative antibiotics', () => {
    const t = planText({
      ccEntries: [{ complaint: 'Right iliac fossa pain (appendicitis?)', answers: {} }],
      examAbdomen: 'RIF tenderness with guarding and rebound', assessment: 'Acute appendicitis',
    });
    expect(t).toMatch(/Uncomplicated appendicitis: no post-operative antibiotics/);
    expect(t).not.toMatch(/simple appendicitis[^\n]{0,120}5 days/i);
  });
  it('umbilical hernia gets the ventral template; cirrhosis with ascites is not a day case', () => {
    const base = { ccEntries: [{ complaint: 'Umbilical hernia', answers: {} }], examAbdomen: 'Reducible umbilical hernia, 2 cm defect' };
    const t = planText({ ...base, assessment: 'Reducible umbilical hernia, 2 cm defect.' });
    expect(t).toMatch(/VENTRAL \(UMBILICAL/);
    expect(t).not.toMatch(/INGUINAL HERNIA REPAIR \(TAPP\)/);
    const c = planText({ ...base, assessment: 'Umbilical hernia in decompensated cirrhosis with ascites.', comorbidities: ['Alcohol-related liver cirrhosis', 'Ascites'] });
    expect(c).toMatch(/hepatology optimisation first/);
    expect(c).not.toMatch(/day[- ]case/i);
  });
  it('penicillin allergy: the penicillin line is withheld, not just annotated', () => {
    const t = planText({
      ccEntries: [{ complaint: 'Paraumbilical hernia — irreducible', answers: {} }], examAbdomen: 'Irreducible tender paraumbilical hernia',
      assessment: 'Incarcerated paraumbilical hernia. Emergency repair.', allergies: ['Penicillin'],
      symptoms: ['abdominal pain'], investigationResults: {}, vitals: { temperatureC: '38.6', heartRate: '118' },
    });
    expect(t).toMatch(/PENICILLIN ALLERGY recorded — the penicillin-class antibiotic proposed here is withheld/);
    expect(t).not.toMatch(/co-amoxiclav|piperacillin|amoxicillin|flucloxacillin/i);
  });
});

describe('prompt corrections (BSG 2019; NICE NG45 / NG158 / NG232; UKKA 2023; ACOG CO 723)', () => {
  it('stable rectal bleeding: no large-bore cannulae or cross-match; unstable keeps them', () => {
    const stable = planText({ age: '28', symptoms: ['rectal bleeding'], vitals: { systolicBp: '118', heartRate: '72' }, investigationResults: { Haemoglobin: '13.4 g/dL' } });
    expect(stable).not.toMatch(/large-bore|crossmatch|cross-match/i);
    expect(stable).toMatch(/Oakland score/);
    const unstable = planText({ age: '70', symptoms: ['rectal bleeding'], vitals: { systolicBp: '84', heartRate: '118' } });
    expect(unstable).toMatch(/large-bore/);
  });
  it('HbA1c is not read as haemoglobin', () => {
    const t = planText({ age: '40', symptoms: ['rectal bleeding'], vitals: { systolicBp: '120', heartRate: '70' }, investigationResults: { 'Glycated haemoglobin (HbA1c)': '58 mmol/mol' } });
    expect(t).not.toMatch(/large-bore/);
  });
  it('no routine clotting screen before elective surgery; kept with warfarin or liver disease', () => {
    const inv = (over: Partial<InferenceInput>) => prompts(over).flatMap(p => p.actions.map(a => a.addToInvestigations ?? '')).join('\n');
    expect(inv({})).not.toMatch(/PT\/INR/);
    expect(inv({ medications: ['Warfarin'] })).toMatch(/PT\/INR/);
    expect(inv({ comorbidities: ['Alcohol-related cirrhosis'] })).toMatch(/PT\/INR/);
    expect(inv({ medications: ['Apixaban'] })).not.toMatch(/PT\/INR/);
  });
  it('suspected PE uses the two-level Wells score', () => {
    const t = planText({ age: '35', vitals: { spo2: '91', heartRate: '118' } });
    expect(t).toMatch(/Wells > 4 \(PE likely\) → CTPA directly/);
    expect(t).not.toMatch(/Wells score ≥ 2/);
  });
  it('mild hyperkalaemia (5.5–5.9): no insulin–glucose; ≥ 6.0: insulin–glucose', () => {
    expect(planText({ investigationResults: { Potassium: '5.8 mmol/L' } })).not.toMatch(/insulin[–-]glucose: 10 units/);
    expect(planText({ investigationResults: { Potassium: '6.2 mmol/L' } })).toMatch(/insulin–glucose: 10 units/);
  });
  it('injury on an anticoagulant: CT head and reversal readiness, no bridging advice', () => {
    const t = planText({ age: '82', medications: ['Apixaban'], historyText: 'Tripped at home and hit her forehead on the floor.', assessment: 'Minor head injury on apixaban.' });
    expect(t).toMatch(/CT head within 8 hours/);
    expect(t).not.toMatch(/bridg/i);
  });
  it('pregnancy: no occult-malignancy CT for weight loss', () => {
    const t = planText({ sex: 'female', age: '27', symptoms: ['weight loss', 'vomiting'], historyText: '10 weeks pregnant, vomiting for 3 weeks.' });
    expect(t).not.toMatch(/CT chest\/abdomen\/pelvis — occult malignancy/);
    expect(t).toMatch(/ultrasound first/);
  });
  it('torsion: exploration if torsion cannot be excluded', () => {
    const t = planText({ age: '19', symptoms: ['scrotal pain'], examExtremities: 'Tender swollen left testis' });
    expect(t).toMatch(/exploration if torsion cannot be excluded/);
  });
});
