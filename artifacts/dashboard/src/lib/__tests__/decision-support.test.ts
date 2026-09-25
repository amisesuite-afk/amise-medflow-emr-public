/**
 * Plan-step decision support — the dashboard adapter (lib/decision-support.ts): record → engine
 * input, the plan-safety filter as the final hard filter, and the result → posterior shift.
 * The engine itself is tested with the shared vectors in lib/pane-engine (and on iOS).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DISEASES, applyModifiers, initPaneState, updatePosterior, FEATURES,
} from '@workspace/pane-engine';
import {
  buildDecisionSupport, decisionInput, decisionLabs, decisionPatient, decisionScores, labFromResults,
  recordedDecisionScores, resultPosteriorShifts, shiftText, withRecordedScore,
} from '../decision-support';
import type { DecisionConsultation } from '../decision-support';
import { extractFeaturesFromSocrates, paneContextFromConsultation } from '../socrates-to-features';
import { bestNextTest, setBestNextTestProvider } from '../decision-support-links';

const BASE: DecisionConsultation = {
  age: '45', sex: 'female', pregnancyPossible: false, allergies: '', medications: [], medicationsText: '',
  comorbidities: [], pmhNotes: '', hpiNotes: '', freeText: '', surgicalHistory: [], assessment: '',
  extractedLabs: {}, investigationResults: {}, vitals: {}, weightKg: '', heightCm: '', isPostOp: false, postOpDays: '',
  clinicalScores: {}, workingDiagnosis: null, icdCodes: [], paneTop: [], today: '2026-09-25',
};

describe('record → decision input', () => {
  it('reads anticoagulant, antiplatelet, pregnancy, allergy classes, eGFR, BMI and recent surgery', () => {
    const c: DecisionConsultation = {
      ...BASE, medications: ['Warfarin 5 mg', 'Aspirin 75 mg'], allergies: 'Penicillin (anaphylaxis)',
      hpiNotes: '28 weeks pregnant', extractedLabs: { egfr: 28 }, weightKg: '120', heightCm: '170',
      isPostOp: true, postOpDays: '5', assessment: 'Plan laparoscopic cholecystectomy',
      comorbidities: ['Type 2 diabetes', 'Mechanical mitral valve'],
    };
    const p = decisionPatient(c, []);
    expect(p.anticoagulant).toBe('vka');
    expect(p.antiplatelet).toBe(true);
    expect(p.pregnancy).toBe('pregnant');
    expect(p.allergyClasses).toContain('penicillin');
    expect(p.egfr).toBe(28);
    expect(p.bmi).toBeCloseTo(41.5, 1);
    expect(p.recentSurgeryDays).toBe(5);
    expect(p.procedurePlanned).toBe(true);
    expect(p.diabetes).toBe(true);
    expect(p.mechanicalValve).toBe(true);
    expect(decisionPatient({ ...BASE, medications: ['Apixaban'] }, []).anticoagulant).toBe('doac');
    expect(decisionPatient({ ...BASE, assessment: 'Surgical review; no operation planned' }, []).procedurePlanned).toBe(false);
  });

  it('recent surgery from the recorded date (America/St_Lucia today)', () => {
    expect(decisionPatient({ ...BASE, recentSurgeryDate: '2026-09-15' }, []).recentSurgeryDays).toBe(10);
  });

  it('appendicolith is read negation-aware from the reports', () => {
    expect(decisionPatient({ ...BASE, investigationResults: { 'CT abdomen': 'Acute appendicitis with an appendicolith.' } }, []).appendicolith).toBe(true);
    expect(decisionPatient({ ...BASE, investigationResults: { 'CT abdomen': 'Acute appendicitis. No appendicolith.' } }, []).appendicolith).toBe(false);
  });

  it('scores: the recorded calculator values plus NEWS2 and qSOFA from the vitals', () => {
    const clinicalScores = withRecordedScore(withRecordedScore({}, 'caprini', 6, '2026-09-25T10:00:00Z'), 'cfs', 7, '2026-09-25T10:01:00Z');
    expect(recordedDecisionScores(clinicalScores)).toEqual({
      caprini: { value: 6, at: '2026-09-25T10:00:00Z', redParameter: false },
      cfs: { value: 7, at: '2026-09-25T10:01:00Z', redParameter: false },
    });
    const scores = decisionScores({
      ...BASE, clinicalScores,
      vitals: { respiratoryRate: '26', spo2: '93', systolicBp: '88', heartRate: '124', temperatureC: '38.9', avpu: 'A', onSupplementalO2: 'air' },
    });
    const byKey = Object.fromEntries(scores.map(s => [s.key, s]));
    expect(byKey.caprini.value).toBe(6);
    expect(byKey.news2.source).toBe('record');
    expect(byKey.news2.value).toBeGreaterThanOrEqual(7);
    expect(byKey.qsofa.value).toBe(2);
    expect(decisionPatient({ ...BASE, clinicalScores }, scores).cfs).toBe(7);
  });

  it('labs: extracted values first, else the result by catalogue alias; haemoglobin in g/L', () => {
    const labs = decisionLabs({ ...BASE, extractedLabs: { lipase: 1450 }, investigationResults: { Lactate: '4.6 mmol/L', Haemoglobin: '6.4 g/dL', 'Lactate dehydrogenase': '900' } });
    expect(labs).toEqual({ lipase: 1450, lactate: 4.6, haemoglobin: 64 });
    expect(labFromResults({ 'Lactate dehydrogenase': '900' }, 'lactate')).toBeNull();
  });
});

describe('plan-safety filter is the final hard filter', () => {
  it('penicillin allergy: the CURB-65 antibiotic line is withheld with the alternative', () => {
    const c: DecisionConsultation = { ...BASE, allergies: 'Penicillin (anaphylaxis)', clinicalScores: withRecordedScore({}, 'curb65', 3, 'x') };
    const card = buildDecisionSupport(c).scoreActions.find(s => s.score === 'curb65')!;
    expect(card.withheld).toBe(true);
    expect(card.action).toMatch(/⚠ ALLERGY — penicillin allergy recorded/);
    expect(card.action).toMatch(/Alternative/);
    const plain = buildDecisionSupport({ ...c, allergies: '' }).scoreActions.find(s => s.score === 'curb65')!;
    expect(plain.withheld).toBe(false);
  });

  it('heparin allergy: the LMWH prophylaxis option is not for this patient', () => {
    const r = buildDecisionSupport({ ...BASE, allergies: 'Heparin (HIT)', clinicalScores: withRecordedScore({}, 'caprini', 6, 'x') });
    const lmwh = r.decisions.find(d => d.id === 'vte-prophylaxis')!.options.find(o => o.id === 'lmwh')!;
    expect(lmwh.band).toBe('not-for-patient');
    expect(lmwh.withheldText).toMatch(/⚠ ALLERGY — heparin/);
    expect(lmwh.rank).toBeNull();
  });

  it('a child gets the paediatric hernia line instead of a mesh repair', () => {
    const r = buildDecisionSupport({
      ...BASE, age: '6', sex: 'male',
      workingDiagnosis: { diseaseId: 'inguinal_hernia', icdCode: 'K40.90', locked: true, diseaseLabel: 'Inguinal hernia' },
    });
    const repair = r.decisions.find(d => d.id === 'inguinal-hernia')!.options[0];
    expect(repair.band).toBe('not-for-patient');
    expect(repair.withheldText).toMatch(/herniotomy/);
  });
});

describe('confirmed diagnosis, leading differential and ranking', () => {
  it('a locked working diagnosis is confirmed (P floor 95%) and ranks the options', () => {
    const input = decisionInput({
      ...BASE, age: '88', clinicalScores: withRecordedScore(withRecordedScore({}, 'cfs', 7, 'x'), 'asa', 4, 'x'), extractedLabs: { egfr: 28 },
      workingDiagnosis: { diseaseId: 'cholecystitis', icdCode: 'K81.0', locked: true, diseaseLabel: 'Acute cholecystitis' },
    });
    expect(input.diagnoses[0]).toMatchObject({ id: 'cholecystitis', confirmed: true });
    const r = buildDecisionSupport({
      ...BASE, age: '88', clinicalScores: withRecordedScore(withRecordedScore({}, 'cfs', 7, 'x'), 'asa', 4, 'x'), extractedLabs: { egfr: 28 },
      workingDiagnosis: { diseaseId: 'cholecystitis', icdCode: 'K81.0', locked: true, diseaseLabel: 'Acute cholecystitis' },
    });
    const d = r.decisions[0];
    expect(d.probability).toBe(0.95);
    expect(d.options[0].id).toBe('percutaneous-cholecystostomy');
  });

  it('an unconfirmed PANE leader is used at its own probability', () => {
    const r = buildDecisionSupport({ ...BASE, paneTop: [{ disease: { id: 'cholecystitis', label: 'Acute cholecystitis', icd10: 'K81.0' }, probability: 0.4 }] });
    expect(r.decisions[0].probabilitySource).toBe('engine');
    expect(r.decisions[0].options[0].band).toBe('test');
  });
});

describe('result → posterior (PANE evidence path)', () => {
  it('a raised lipase moves pancreatitis up and is named as the result that moved it', () => {
    const c = {
      ...BASE, age: '50', sex: 'male', freeText: 'Severe epigastric pain radiating to the back with vomiting',
      investigationResults: { Lipase: '1450 U/L' },
    };
    const entries = [{ complaint: 'Acute abdominal pain', answers: { site: 'Epigastric', radiation: 'Back', associated: 'Vomiting' } }];
    const diseases = applyModifiers(DISEASES, 50, 'male', undefined, { pregnancyPossible: false });
    const ids = new Set(FEATURES.map(f => f.id));
    let state = initPaneState(diseases);
    const f = extractFeaturesFromSocrates(entries[0].complaint, entries[0].answers, paneContextFromConsultation(c));
    for (const [k, v] of Object.entries(f)) if (ids.has(k)) state = updatePosterior(state, diseases, k, v);
    const shifts = resultPosteriorShifts(c, entries, state);
    const panc = shifts.find(s => s.diseaseId === 'pancreatitis');
    expect(panc).toBeTruthy();
    expect(panc!.after).toBeGreaterThan(panc!.before);
    expect(panc!.movedBy[0].result).toMatch(/Lipase/);
    expect(shiftText(panc!)).toMatch(/→/);
  });

  it('no results, no shift', () => {
    expect(resultPosteriorShifts(BASE, [], null)).toEqual([]);
  });
});

describe('loose link to the diagnostic-reasoning best next test', () => {
  it('no provider → null; a throwing provider → null; a provider → its test', () => {
    setBestNextTestProvider(null);
    expect(bestNextTest({ diseaseId: 'x', name: 'x' })).toBeNull();
    setBestNextTestProvider(() => { throw new Error('boom'); });
    expect(bestNextTest({ diseaseId: 'x', name: 'x' })).toBeNull();
    setBestNextTestProvider(() => ({ label: 'Ultrasound abdomen' }));
    expect(bestNextTest({ diseaseId: 'x', name: 'x' })?.label).toBe('Ultrasound abdomen');
    setBestNextTestProvider(null);
  });
});

describe('suggestions only', () => {
  it('the panel writes to the record only from click handlers (no effect writes)', () => {
    const src = readFileSync(join(__dirname, '../../components/DecisionSupportPanel.tsx'), 'utf8');
    expect(src).not.toMatch(/useEffect/);
    const rec = readFileSync(join(__dirname, '../../components/RecordScoreButton.tsx'), 'utf8');
    expect(rec).not.toMatch(/useEffect/);
    expect(rec).toMatch(/onClick=\{\(\) => setClinicalScores/);
  });
});
