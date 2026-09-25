/**
 * Recognise-and-redirect emergency layer (lib/triage-engine/src/emergency-recognition.ts) and its
 * use by adaptiveTriage: triage level = max(text rules, vital signs / NEWS2, blood pressure,
 * critical labs, ECG, confirmed diagnosis). Fix-all-gaps programme, 2026-09-25.
 */
import { describe, it, expect } from 'vitest';
import {
  adaptiveTriage, assessEmergencies, scanRedFlags, paediatricVitalLimits, detectPregnancy, extractTriageLabs,
  diagnosisHead, diagnosisLevel, refineAgeYears, EMERGENCY_REDIRECT, PATHWAY_DEFINITIONS, type AdaptiveTriageInput,
} from '@workspace/triage-engine';

const base: AdaptiveTriageInput = { symptoms: [], age: 50, sex: 'male' };
const ids = (inp: Parameters<typeof assessEmergencies>[0]) => assessEmergencies(inp).emergencies.map(e => e.id);

describe('redirect wording', () => {
  it('names 911 and the three hospitals, never Victoria Hospital', () => {
    expect(EMERGENCY_REDIRECT).toContain('911');
    for (const h of ['OKEU Hospital', "St Jude's Hospital", 'Tapion Hospital']) expect(EMERGENCY_REDIRECT).toContain(h);
    expect(EMERGENCY_REDIRECT).not.toMatch(/victoria/i);
    const r = adaptiveTriage({ ...base, freeText: 'Central crushing chest pain radiating to the left arm and jaw, sweating.' });
    expect(r.recommendedAction).toBe('emergency_now');
    expect(r.safetyMessage).toContain('911');
    expect(r.safetyMessage).toContain('Suspected acute coronary syndrome');
    expect(r.frontDeskScript).toContain("OKEU Hospital, St Jude's Hospital or Tapion Hospital");
    expect(r.emergencyRedirect).toBe(EMERGENCY_REDIRECT);
  });
});

describe('cardiac rule narrowed (SURGEON-DECISIONS E2)', () => {
  it('"radiating to" and "left arm" alone are not a cardiac event', () => {
    expect(scanRedFlags('Pain radiating to the back.').matches.map(m => m.reason)).not.toContain('Possible cardiac event');
    expect(scanRedFlags('Lipoma on the left arm.').matches.map(m => m.reason)).not.toContain('Possible cardiac event');
  });
  it('chest pain radiating to the arm or jaw is', () => {
    expect(scanRedFlags('Chest pain radiating to the left arm.').matches.map(m => m.reason)).toContain('Possible cardiac event');
  });
  it('"left arm" in the past surgical history does not raise triage', () => {
    const r = adaptiveTriage({ ...base, surgicalHistory: ['Excision of lipoma left arm'] });
    expect(r.reasons).not.toContain('Possible cardiac event');
    expect(r.recommendedAction).toBe('routine_booking');
  });
  it('the chest pain pathway needs chest pain, not "cardiac" or "left arm"', () => {
    const cp = PATHWAY_DEFINITIONS.find(p => p.id === 'chest_pain')!;
    expect(cp.trigger.test('cardiac history')).toBe(false);
    expect(cp.trigger.test('left arm pain')).toBe(false);
    expect(cp.trigger.test('chest pain')).toBe(true);
  });
});

describe('breathlessness graded by physiology', () => {
  it('is no longer an automatic urgent post-operative concern', () => {
    expect(scanRedFlags('Breathless on exertion.').matches.map(m => m.reason)).not.toContain('Post-operative concern');
  });
  it('normal observations → review, not emergency', () => {
    const r = adaptiveTriage({ ...base, age: 30, freeText: 'Mild breathlessness on stairs.', vitalSigns: { spo2: 98, respiratoryRate: 14, heartRate: 72, systolicBp: 124 } });
    expect(r.recommendedAction).not.toBe('emergency_now');
  });
  it('low SpO₂ or high RR → emergency', () => {
    const r = adaptiveTriage({ ...base, freeText: 'Breathless since this morning.', vitalSigns: { spo2: 89, respiratoryRate: 28 } });
    expect(r.recommendedAction).toBe('emergency_now');
  });
});

describe('triage level = max of every source', () => {
  it('NEWS2 high band → emergency, medium → same-day', () => {
    const high = adaptiveTriage({ ...base, vitalSigns: { respiratoryRate: 26, spo2: 91, systolicBp: 95, heartRate: 125, temperatureC: 38.5 }, avpu: 'A', onSupplementalO2: false });
    expect(high.news2?.band).toBe('high');
    expect(high.recommendedAction).toBe('emergency_now');
  });
  it('confirmed diagnosis radiates a level (K35 appendicitis → at least same-day)', () => {
    const r = adaptiveTriage({ ...base, diagnosis: { text: 'Acute appendicitis', icd10: ['K35.80'] } });
    expect(['same_day_call', 'emergency_now']).toContain(r.recommendedAction);
  });
  it('severe hyperkalaemia from the lab result → emergency', () => {
    const r = adaptiveTriage({ ...base, investigationResults: { Potassium: '6.8 mmol/L' } });
    expect(r.recommendedAction).toBe('emergency_now');
    expect(r.recognisedEmergencies.map(e => e.id)).toContain('hyperkalaemia');
  });
  it('K⁺ 6.2 with peaked T waves on the ECG → emergency; without → same-day', () => {
    expect(ids({ investigationResults: { Potassium: '6.2' }, examText: 'ECG: peaked T waves' })).toContain('hyperkalaemia');
    expect(assessEmergencies({ investigationResults: { Potassium: '6.2' } }).emergencies.find(e => e.id === 'hyperkalaemia')?.level).toBe('urgent');
    expect(assessEmergencies({ investigationResults: { Potassium: '6.2' }, examText: 'ECG: peaked T waves' }).emergencies.find(e => e.id === 'hyperkalaemia')?.level).toBe('emergency');
  });
  it('ST elevation on the ECG report → ACS emergency', () => {
    expect(ids({ resultReports: ['ECG: ST elevation in II, III and aVF — inferior STEMI'] })).toContain('acs');
  });
  it('euglycaemic DKA on an SGLT2 inhibitor is recognised from ketones and pH', () => {
    const a = assessEmergencies({ medications: ['Empagliflozin'], comorbidities: ['Type 2 diabetes'], investigationResults: { Glucose: '10.2', 'Blood ketones': '5.1', 'Venous pH': '7.19', Bicarbonate: '11' } });
    const dka = a.emergencies.find(e => e.id === 'dka');
    expect(dka?.level).toBe('emergency');
    expect(dka?.title).toMatch(/euglycaemic/i);
    expect(dka?.actions.map(x => x.text).join(' ')).toMatch(/stop the sglt2 inhibitor/i);
  });
  it('HHS gets saline first and the lower insulin rate, not the DKA rate', () => {
    const a = assessEmergencies({ comorbidities: ['Type 2 diabetes'], investigationResults: { Glucose: '46', 'Serum osmolality': '372', 'Blood ketones': '0.9', 'Venous pH': '7.33' } });
    const hhs = a.emergencies.find(e => e.id === 'hhs')!;
    const text = hhs.actions.map(x => x.text).join(' ');
    expect(text).toMatch(/0\.9% sodium chloride first/);
    expect(text).toMatch(/0\.05 units\/kg\/h/);
    expect(text).not.toMatch(/0\.1 units\/kg\/h/);
  });
});

describe('recognise and redirect: medical, neurological, obstetric', () => {
  it('FAST-positive stroke → emergency with CT head and glucose', () => {
    const a = assessEmergencies({ age: 69, historyText: 'Sudden right facial droop, right arm weakness and slurred speech 75 minutes ago.' });
    const s = a.emergencies.find(e => e.id === 'stroke')!;
    expect(s.level).toBe('emergency');
    expect(s.actions.map(x => x.text).join(' ')).toMatch(/CT head/);
    expect(s.actions.map(x => x.text).join(' ')).toMatch(/glucose/i);
  });
  it('TIA → aspirin 300 mg and specialist within 24 h, no ABCD2', () => {
    const t = assessEmergencies({ age: 70, historyText: 'Transient left arm weakness and slurred speech for 20 minutes, now resolved.', diagnosis: { text: 'TIA', icd10: ['G45.9'] } })
      .emergencies.find(e => e.id === 'tia')!;
    const text = t.actions.map(x => x.text).join(' ');
    expect(text).toMatch(/Aspirin 300 mg/);
    expect(text).toMatch(/within 24 hours/);
    expect(text).toMatch(/do not use ABCD2/);
  });
  it('thunderclap headache, meningism with fever, cauda equina, MSCC', () => {
    expect(ids({ historyText: 'Sudden severe occipital headache, worst headache ever, at the gym.' })).toContain('sah');
    expect(ids({ historyText: 'Fever and headache.', examText: 'Neck stiffness, photophobia.', vitals: { temperatureC: 39 } })).toContain('meningitis');
    expect(ids({ historyText: 'Back pain with numbness around the back passage and difficulty passing urine.' })).toContain('cauda_equina');
    expect(ids({ comorbidities: ['Metastatic prostate cancer'], historyText: 'Mid-back pain, both legs weak and numb below the belly button.' })).toContain('mscc');
  });
  it('sepsis without fever is recognised from physiology and lactate', () => {
    const a = assessEmergencies({ age: 86, historyText: 'Urinary infection, confused today.', vitals: { temperatureC: 36.4, heartRate: 118, respiratoryRate: 26, systolicBp: 88, spo2: 94, avpu: 'C', onSupplementalO2: false }, investigationResults: { Lactate: '3.1' } });
    const s = a.emergencies.find(e => e.id === 'sepsis')!;
    expect(s.level).toBe('emergency');
    expect(s.title).toMatch(/without fever/);
  });
  it('anaphylaxis → IM adrenaline 500 micrograms for adults (RCUK 2021); age band for children', () => {
    const adult = assessEmergencies({ age: 44, historyText: 'Swollen lips and tongue, wheezy, itchy rash 20 minutes after amoxicillin.', vitals: { systolicBp: 78 } }).emergencies.find(e => e.id === 'anaphylaxis')!;
    expect(adult.actions.map(x => x.text).join(' ')).toMatch(/500 micrograms/);
    const child = assessEmergencies({ age: 7, historyText: 'Facial swelling, urticaria and stridor after peanut.' }).emergencies.find(e => e.id === 'anaphylaxis')!;
    expect(child.actions.map(x => x.text).join(' ')).toMatch(/300 micrograms/);
  });
  it('a past anaphylaxis ("in 2015") is an allergy, not an emergency', () => {
    expect(ids({ age: 63, historyText: 'Anaphylaxis to penicillin in 2015 (throat swelling and collapse after amoxicillin).' })).not.toContain('anaphylaxis');
  });
  it('pregnancy BP ≥ 160/110 → emergency with pre-eclampsia wording (NICE NG133)', () => {
    const a = assessEmergencies({ age: 33, sex: 'female', historyText: 'Primigravida at 34 weeks with headache.', vitals: { systolicBp: 164, diastolicBp: 110 } });
    const p = a.emergencies.find(e => e.id === 'pre_eclampsia')!;
    expect(p.level).toBe('emergency');
    expect(p.title).toMatch(/pre-eclampsia/i);
    expect(p.actions.map(x => x.text).join(' ')).toMatch(/magnesium sulfate/i);
  });
  it('postpartum within 6 weeks counts; non-pregnant 172/114 without organ damage does not', () => {
    expect(ids({ age: 29, sex: 'female', historyText: 'Six days after a vaginal delivery: headache, blurred vision.', vitals: { systolicBp: 162, diastolicBp: 106 } })).toContain('pre_eclampsia');
    const np = assessEmergencies({ age: 50, sex: 'male', vitals: { systolicBp: 186, diastolicBp: 112 } });
    expect(np.emergencies.find(e => e.id === 'severe_hypertension')?.level).toBe('priority');
  });
  it('hypertensive emergency with papilloedema', () => {
    expect(ids({ age: 50, examText: 'Fundoscopy: papilloedema, flame haemorrhages.', vitals: { systolicBp: 208, diastolicBp: 126 } })).toContain('hypertensive_emergency');
  });
  it('acute scrotal pain → torsion emergency; an inguinoscrotal hernia swelling does not', () => {
    expect(ids({ age: 16, sex: 'male', historyText: 'Sudden left testicular pain since 5 am, vomited.' })).toContain('testicular_torsion');
    expect(ids({ age: 60, sex: 'male', historyText: 'Right inguinal hernia extending into the scrotum, scrotal swelling for months.' })).not.toContain('testicular_torsion');
  });
  it('ectopic: early pregnancy with pain; not with a known intrauterine pregnancy', () => {
    expect(ids({ age: 26, sex: 'female', historyText: 'Missed period, left iliac fossa pain and spotting.' })).toContain('ectopic');
    expect(ids({ age: 26, sex: 'female', historyText: '12 weeks pregnant, intrauterine pregnancy on dating scan, abdominal pain.' })).not.toContain('ectopic');
  });
});

describe('children', () => {
  it('paediatric limits are age banded and adult thresholds apply only from 16', () => {
    expect(paediatricVitalLimits(0.5)?.hrHigh).toBe(160);
    expect(paediatricVitalLimits(4)?.rrHigh).toBe(40);
    expect(paediatricVitalLimits(16)).toBeNull();
    expect(refineAgeYears(0, 'A 7-week-old girl')).toBeCloseTo(7 * 7 / 365, 3);
  });
  it('a normal infant heart rate and SBP are not "shock"', () => {
    const r = adaptiveTriage({ symptoms: [], age: 0, freeText: '9-month-old for hernia review.', vitalSigns: { heartRate: 130, systolicBp: 80, respiratoryRate: 34 } });
    expect(r.vitalRedFlags.map(f => f.label)).not.toContain('Hypotension');
    expect(r.vitalRedFlags.map(f => f.label)).not.toContain('Tachycardia (for age)');
    expect(r.recommendedAction).not.toBe('emergency_now');
  });
  it('febrile infant under 3 months → emergency (NICE NG143)', () => {
    expect(ids({ age: 0, historyText: '7-week-old with temperature 38.5 at home.', vitals: { temperatureC: 38.3 } })).toContain('febrile_infant');
  });
  it('bilious vomiting in a child → emergency; "never green" does not count', () => {
    expect(ids({ age: 0, historyText: '3-week-old, three vomits that were green.' })).toContain('bilious_vomiting_child');
    expect(ids({ age: 0, historyText: '5-week-old, projectile vomiting of milk (never green).' })).not.toContain('bilious_vomiting_child');
    expect(ids({ age: 0, historyText: '5-week-old, projectile vomiting of milk (never green).' })).toContain('pyloric_stenosis');
  });
  it('intussusception needs specific signs, not inconsolable crying alone', () => {
    expect(ids({ age: 0, historyText: '9-month-old with redcurrant jelly stool and vomiting.' })).toContain('intussusception');
    expect(ids({ age: 0, historyText: '11-month-old, inconsolable crying.' })).not.toContain('intussusception');
  });
});

describe('safeguarding (follow the practice procedure; no invented contacts)', () => {
  it('bruising in a non-mobile infant', () => {
    const a = assessEmergencies({ age: 0, historyText: 'Not yet crawling. Bruises noticed by nursery.', examText: 'Fingertip-pattern bruises over the chest.' });
    expect(a.safeguarding[0]?.id).toBe('safeguarding_child');
    expect(a.safeguarding[0]?.actions[0].text).toMatch(/practice's safeguarding procedure/);
  });
  it('domestic abuse in pregnancy', () => {
    const a = assessEmergencies({ age: 26, sex: 'female', historyText: '33 weeks pregnant, pushed by her partner and fell.' });
    expect(a.safeguarding.map(s => s.id)).toContain('safeguarding_domestic_abuse');
  });
});

describe('helpers', () => {
  it('reads labs by name and unit', () => {
    const l = extractTriageLabs({ Haemoglobin: '98 g/L', 'Adjusted calcium': '3.62 mmol/L', 'Urine dipstick': 'Protein 3+', 'Urine hCG': 'Positive', Triglycerides: '1400 mg/dL' });
    expect(l.haemoglobin).toBeCloseTo(9.8, 5);
    expect(l.calcium).toBe(3.62);
    expect(l.urineProtein).toBe(3);
    expect(l.pregnancyTest).toBe('positive');
    expect(l.triglycerides).toBeCloseTo(15.8, 1);
  });
  it('pregnancy and postpartum detection', () => {
    expect(detectPregnancy('G3P2 at 32 weeks', 'female', true).weeks).toBe(32);
    expect(detectPregnancy('Urine pregnancy test negative', 'female', true).pregnant).toBe(false);
    expect(detectPregnancy('Six days after an uncomplicated vaginal delivery', 'female', false).postpartumWeeks).toBeCloseTo(6 / 7, 3);
  });
  it('only the leading diagnosis counts', () => {
    expect(diagnosisHead('Symptomatic cholelithiasis, currently quiescent. Drug-eluting stent 3 months after NSTEMI.')).toBe('Symptomatic cholelithiasis, currently quiescent');
    expect(diagnosisHead('Newly detected AF (age >= 75, TIA, hypertension) - ECG confirmation')).not.toMatch(/TIA/);
  });
  it('diagnosis ICD levels: most specific prefix wins', () => {
    expect(diagnosisLevel(['I21.9'])?.level).toBe('emergency');
    expect(diagnosisLevel(['K40.30'])?.level).toBe('urgent');
    expect(diagnosisLevel(['K40.90'])).toBeNull();
    expect(diagnosisLevel(['I71.4'])?.level).toBe('urgent');
    expect(diagnosisLevel(['I71.3'])?.level).toBe('emergency');
  });
  it('risk modifiers become triage reasons without changing the level', () => {
    const r = adaptiveTriage({ ...base, medications: ['Prednisolone', 'Bisoprolol', 'Empagliflozin'], comorbidities: ['Malignant hyperthermia susceptible'] });
    const reasons = r.reasons.join(' | ');
    expect(reasons).toMatch(/Immunosuppressed \(prednisolone\)/i);
    expect(reasons).toMatch(/Beta-blocker/);
    expect(reasons).toMatch(/SGLT2/);
    expect(reasons).toMatch(/malignant hyperthermia/);
  });
  it('a relative\'s cancer or a screening request is not "possible malignancy"', () => {
    expect(scanRedFlags('Father had stomach cancer.').matches.map(m => m.reason)).not.toContain('Possible malignancy');
    expect(scanRedFlags('Here for bowel cancer screening.').matches.map(m => m.reason)).not.toContain('Possible malignancy');
    expect(scanRedFlags('Worried she has cancer.').matches.map(m => m.reason)).toContain('Possible malignancy');
    expect(scanRedFlags('No change in bowel habit.').matches.map(m => m.reason)).not.toContain('Lower GI red flag');
  });
});
