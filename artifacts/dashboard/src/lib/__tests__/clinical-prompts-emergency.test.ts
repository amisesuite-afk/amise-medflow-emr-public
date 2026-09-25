/**
 * computeClinicalPrompts: the recognise-and-redirect emergency prompts, diagnosis-gated operative
 * templates, pregnancy / paediatric safety, peri-operative alerts and corrected prompt content
 * (fix-all-gaps programme, 2026-09-25). Also the TG18 and ABCD2 score changes.
 */
import { describe, expect, it } from 'vitest';
import { computeClinicalPrompts, type InferenceInput } from '../clinical-inference';
import { scoreTokyoCholecystitis, scoreTokyoCholangitis } from '../clinical-scores';
import { tg18CholangitisGrade, interpretAbcd2 } from '../clinical-scales';
import { getCdsSuggestions, type CdsContext } from '../clinical-cds';

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
const ids = (over: Partial<InferenceInput>) => prompts(over).map(p => p.id);
const planText = (over: Partial<InferenceInput>) => prompts(over).flatMap(p => p.actions.map(a => `${a.text} ${a.addToPlan ?? ''}`)).join('\n');
const invText = (over: Partial<InferenceInput>) => prompts(over).flatMap(p => p.actions.map(a => a.addToInvestigations ?? '')).join('\n');

describe('emergency prompts from the shared layer', () => {
  it('suspected ACS: alarm, ECG and troponin as investigations, aspirin as a suggestion, 911 redirect', () => {
    const over = { age: '58', historyText: 'Central crushing chest pain radiating to the left arm and jaw, sweating.' };
    const p = prompts(over).find(x => x.id === 'emergency_acs')!;
    expect(p.type).toBe('safety');
    expect(p.text).toContain('911');
    expect(invText(over)).toMatch(/12-lead ECG/);
    expect(invText(over)).toMatch(/troponin/i);
    expect(planText(over)).toMatch(/aspirin loading dose 150–300 mg/i);
  });
  it('aspirin is not suggested when an aspirin allergy is recorded', () => {
    const t = planText({ age: '58', historyText: 'Crushing chest pain radiating to the jaw.', allergies: ['Aspirin'] });
    expect(t).toMatch(/Aspirin loading dose NOT suggested/);
  });
  it('safeguarding prompt says follow the practice procedure and names no invented contact', () => {
    const p = prompts({ age: '0', historyText: 'Not yet crawling. Bruises on the cheek.', examOther: 'Fingertip-pattern bruises on the chest.' })
      .find(x => x.id === 'safeguarding_safeguarding_child')!;
    expect(p.actions[0].addToPlan).toMatch(/practice's safeguarding procedure/);
    expect(p.actions.map(a => a.text).join(' ')).not.toMatch(/\+?\d{3}[- ]?\d{3}[- ]?\d{4}/);
  });
});

describe('operative templates follow the working diagnosis, not signs alone', () => {
  it('guarding in DKA does not attach an appendicectomy plan', () => {
    const t = planText({ examAbdomen: 'Diffuse tenderness with guarding', ccEntries: [{ complaint: 'Abdominal pain', answers: {} }], assessment: 'Diabetic ketoacidosis' });
    expect(t).not.toMatch(/appendicectomy — operative plan/i);
  });
  it('appendicitis working diagnosis keeps it', () => {
    expect(ids({ examAbdomen: 'RIF tenderness with guarding and rebound', ccEntries: [{ complaint: 'Right iliac fossa pain (appendicitis?)', answers: {} }], assessment: 'Acute appendicitis' }))
      .toContain('appendicectomy_pathway');
  });
  it('a Bethesda II result no longer gives a total-thyroidectomy template', () => {
    const rad = [{ modality: 'Other', anatomicalRegion: 'thyroid', resultReceived: true, resultNotes: 'FNA: Bethesda II (benign follicular nodule).', indication: 'FNA' }];
    expect(ids({ radiologyRequests: rad })).not.toContain('thyroidectomy_pathway');
    const rad6 = [{ ...rad[0], resultNotes: 'FNA: Bethesda VI — papillary carcinoma.' }];
    expect(ids({ radiologyRequests: rad6 })).toContain('thyroidectomy_pathway');
  });
  it('an infant hernia gets paediatric surgery, never the adult TAPP / mesh template', () => {
    const over = { age: '0', historyText: '9-month-old with a right inguinal hernia.', examAbdomen: 'Reducible right inguinal hernia', ccEntries: [{ complaint: 'Groin lump (hernia)', answers: {} }], assessment: 'Right inguinal hernia' };
    expect(ids(over)).toContain('hernia_paediatric');
    expect(planText(over)).not.toMatch(/TAPP|mesh herniorrhaphy|Lichtenstein/);
  });
  it('suspected strangulation: no manual reduction (WSES 2017)', () => {
    const t = planText({ examAbdomen: 'Tender irreducible right femoral hernia with overlying erythema', ccEntries: [{ complaint: 'Groin lump (hernia)', answers: {} }], assessment: 'Strangulated femoral hernia' });
    expect(t).toMatch(/Do not attempt manual reduction/);
    expect(t).not.toMatch(/Attempt manual reduction/);
  });
});

describe('pregnancy, children and assumed results', () => {
  it('β-HCG is never "confirmed negative"', () => {
    const t = planText({ sex: 'female', age: '30', examAbdomen: 'RIF tenderness, guarding', ccEntries: [{ complaint: 'Right iliac fossa pain (appendicitis?)', answers: {} }], assessment: 'Acute appendicitis' });
    expect(t).not.toMatch(/β-HCG confirmed negative/i);
    expect(t).toMatch(/β-HCG: result required/);
  });
  it('no NSAIDs in pregnancy; obstetric handover prompt', () => {
    const over = { sex: 'female', age: '31', historyText: 'G3P2 at 32 weeks with right-sided pain.', examAbdomen: 'RIF tenderness with guarding', ccEntries: [{ complaint: 'Right iliac fossa pain (appendicitis?)', answers: {} }], assessment: 'Acute appendicitis in pregnancy' };
    const t = planText(over);
    expect(t).not.toMatch(/ibuprofen/i);
    expect(ids(over)).toContain('pregnancy_obstetric');
  });
  it('under 16: adult fixed doses are replaced by weight-based dosing per BNFc', () => {
    const t = planText({ age: '9', examAbdomen: 'RIF tenderness, guarding, rebound', ccEntries: [{ complaint: 'Right iliac fossa pain (appendicitis?)', answers: {} }], assessment: 'Acute appendicitis' });
    expect(t).not.toMatch(/paracetamol 1 ?g/i);
    expect(t).not.toMatch(/4\.5 ?g/i);
    expect(t).toMatch(/weight-based dose — calculate per BNFc/);
  });
  it('a normal infant heart rate does not produce the adult sepsis / shock bundles', () => {
    expect(ids({ age: '0', historyText: '7-month-old', vitals: { heartRate: '140', systolicBp: '78', temperatureC: '37.0' } }))
      .not.toContain('shock_non_infective');
  });
});

describe('corrected prompt content', () => {
  it('COPD / hypercapnic risk: controlled oxygen 88–92% (BTS 2017)', () => {
    const t = planText({ comorbidities: ['COPD'], vitals: { spo2: '86' } });
    expect(t).toMatch(/88–92%/);
    expect(t).not.toMatch(/titrate to SpO₂ ≥ 94%/);
  });
  it('no fluid bolus with heart-failure signs; anaphylaxis before fluids in shock', () => {
    expect(planText({ comorbidities: ['Heart failure'], vitals: { systolicBp: '84' } })).toMatch(/No IV fluid bolus/);
    const an = planText({ age: '44', historyText: 'Swollen lips, urticaria and wheeze after amoxicillin.', vitals: { systolicBp: '78' } });
    expect(an).toMatch(/IM adrenaline 500 micrograms/);
    expect(an).toMatch(/Anaphylaxis: IM adrenaline first/);
  });
  it('hyperkalaemia: calcium gluconate 10% 30 mL (UKKA 2023)', () => {
    expect(planText({ investigationResults: { Potassium: '6.9 mmol/L' } })).toMatch(/calcium gluconate 10% 30 mL/);
  });
  it('hyponatraemia: volume status first, no blanket fluid restriction', () => {
    const t = planText({ investigationResults: { Sodium: '124 mmol/L' } });
    expect(t).toMatch(/Assess volume status first/);
    expect(t).toMatch(/150 mL 3% hypertonic saline/);
  });
  it('dilated CBD only above the threshold, never for "CBD 4 mm" or a dilated ureter', () => {
    const rad = (notes: string) => [{ modality: 'US', anatomicalRegion: 'abdomen', resultReceived: true, resultNotes: notes, indication: 'RUQ pain' }];
    expect(ids({ radiologyRequests: rad('Gallstones. CBD 4 mm.') })).not.toContain('dilated_cbd');
    expect(ids({ radiologyRequests: rad('Dilated proximal ureter; hydronephrosis.') })).not.toContain('dilated_cbd');
    expect(ids({ radiologyRequests: rad('CBD 9 mm with a distal stone.') })).toContain('dilated_cbd');
    expect(ids({ radiologyRequests: rad('CBD 7 mm.'), surgicalHistory: ['Laparoscopic cholecystectomy 2019'] })).not.toContain('dilated_cbd');
  });
  it('anticoagulation: no bridging for AF; warfarin stopped 5 days before high-risk procedures; bleeding → reversal', () => {
    const elective = planText({ medications: ['Warfarin'], comorbidities: ['Atrial fibrillation'] });
    expect(elective).toMatch(/stop warfarin 5 days before/);
    expect(elective).toMatch(/No routine LMWH bridging for atrial fibrillation/);
    expect(elective).not.toMatch(/bridge with LMWH per haematology protocol/);
    const bleeding = planText({ medications: ['Apixaban'], historyText: 'Melaena since this morning.' });
    expect(bleeding).toMatch(/Withhold the apixaban now/);
    expect(bleeding).toMatch(/andexanet alfa or four-factor PCC/);
  });
  it('coronary stent inside the DAPT window defers elective surgery (ESC/ESAIC 2022)', () => {
    const t = planText({ medications: ['Aspirin', 'Ticagrelor'], historyText: 'NSTEMI 3 months ago treated with a drug-eluting stent.' });
    expect(t).toMatch(/Defer elective surgery/);
    expect(t).toMatch(/Cardiology liaison/);
  });
  it('anaesthetic hazards, SGLT2 inhibitor and steroid cover reach the plan', () => {
    const t = planText({ comorbidities: ['Malignant hyperthermia susceptible'], allergies: ['Latex'], medications: ['Empagliflozin', 'Prednisolone'] });
    expect(t).toMatch(/trigger-free anaesthesia/);
    expect(t).toMatch(/latex-free/i);
    expect(t).toMatch(/withhold the day before and the day of surgery/);
    expect(t).toMatch(/hydrocortisone/);
  });
  it('tetanus-prone wound and asplenia prompts (UKHSA Green Book)', () => {
    const w = planText({ historyText: 'Laceration to the forearm from a rusty farm gate contaminated with soil; tetanus status unknown.' });
    expect(w).toMatch(/tetanus-containing vaccine booster/);
    expect(w).toMatch(/human tetanus immunoglobulin/);
    expect(planText({ surgicalHistory: ['Trauma splenectomy 2 weeks ago'] })).toMatch(/pneumococcal/);
  });
  it('penicillin allergy is flagged against any penicillin in a prompt', () => {
    const t = planText({ allergies: ['Penicillin'], vitals: { temperatureC: '38.6', heartRate: '118' } });
    expect(t).toMatch(/PENICILLIN ALLERGY recorded/);
  });
});

describe('scores', () => {
  const labs = { wbc: 14 } as never;
  it('TG18 cholecystitis Grade II reads > 72 h and gangrenous / marked local inflammation (C8)', () => {
    expect(scoreTokyoCholecystitis({ murphy_sign: true, duration_over_72h: true }, labs, { temperatureC: 38.2 }).score).toBe(2);
    expect(scoreTokyoCholecystitis({ murphy_sign: true, marked_local_inflammation: true }, labs, { temperatureC: 38.2 }).score).toBe(2);
    expect(scoreTokyoCholecystitis({ murphy_sign: true }, labs, { temperatureC: 38.2 }).score).toBe(1);
  });
  it('TG18 cholangitis Grade II needs two criteria in both calculators', () => {
    const base = { fever: false, wbcAbnormal: false, age: null, bilirubinHighGrade2: false, albuminLow: false, organDysfunctionCv: false, organDysfunctionCns: false, organDysfunctionResp: false, organDysfunctionRenal: false, organDysfunctionHepatic: false, organDysfunctionHaem: false };
    expect(tg18CholangitisGrade({ ...base, age: 78 })).toBe('I');
    expect(tg18CholangitisGrade({ ...base, age: 78, fever: true })).toBe('II');
    const full = (wbc: number, t: number, age75: boolean) => scoreTokyoCholangitis({ fever_or_chills: true, biliary_dilatation: true, age_over_75: age75 }, { wbc } as never, { temperatureC: t }).score;
    expect(full(17.8, 39.4, false)).toBe(2);
    expect(full(11.2, 38.4, true)).toBe(1);
  });
  it('ABCD2 is not suggested and its card defers to NICE NG128', () => {
    const ctx = { symptoms: ['facial weakness', 'speech difficulty', 'TIA'], examFindings: {}, vitals: {}, investigationResults: {}, comorbidities: [], assessment: 'TIA', rosFindings: {}, age: '70', sex: 'male', isPostOp: false, procedureData: {} } as unknown as CdsContext;
    expect(getCdsSuggestions(ctx).map(s => s.scaleKey)).not.toContain('abcd2');
    expect(interpretAbcd2(2).action).toMatch(/do not use ABCD2 to decide urgency/);
  });
});
