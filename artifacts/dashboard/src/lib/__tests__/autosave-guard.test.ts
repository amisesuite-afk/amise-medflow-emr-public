import { describe, it, expect } from 'vitest';
import {
  createAutosaveGuard, beginLoad, finishLoad, checkAutosave, resetGuard, clearSections,
  isReadOnlyEncounterStatus, fingerprint, ALL_SAVE_SECTIONS, ENCOUNTER_SAVE_SECTIONS,
  PATIENT_SAVE_SECTIONS, ENTITY_TYPE_SECTION, SAVE_SECTION_LABEL,
  sectionValueFromState, sectionValueFromPayload, type SectionState,
} from '@/lib/autosave-guard';
import { readSrc } from './helpers/source-scan';

const fp = fingerprint;

describe('autosave guard', () => {
  it('writes freely when nothing was loaded (a new encounter, a new patient)', () => {
    const g = createAutosaveGuard();
    expect(checkAutosave(g, { section: 'plan', fingerprint: fp('x'), readOnly: false })).toEqual({ allow: true, unblocked: false });
  });

  it('writes nothing while a record is loading', () => {
    const g = createAutosaveGuard();
    beginLoad(g);
    for (const section of ALL_SAVE_SECTIONS) {
      expect(checkAutosave(g, { section, fingerprint: fp(''), readOnly: false })).toEqual({ allow: false, reason: 'hydrating' });
    }
  });

  it('a failed read is never written back as an empty value', () => {
    const g = createAutosaveGuard();
    const t = beginLoad(g);
    // medications failed → state stayed empty; plan loaded.
    finishLoad(g, t, ['medications', 'plan'], ['medications'], { medications: fp([[], '']), plan: fp('Lap appendicectomy') });
    expect(g.notLoaded.has('medications')).toBe(true);
    expect(checkAutosave(g, { section: 'medications', fingerprint: fp([[], '']), readOnly: false }))
      .toEqual({ allow: false, reason: 'not_loaded' });
    // …nor is an unchanged loaded section re-saved.
    expect(checkAutosave(g, { section: 'plan', fingerprint: fp('Lap appendicectomy'), readOnly: false }))
      .toEqual({ allow: false, reason: 'unchanged_since_load' });
  });

  it('the clinician\'s edit to a not-loaded section is saved, and clears the mark', () => {
    const g = createAutosaveGuard();
    const t = beginLoad(g);
    finishLoad(g, t, ['medications'], ['medications'], { medications: fp([[], '']) });
    expect(checkAutosave(g, { section: 'medications', fingerprint: fp([['Metformin'], '']), readOnly: false }))
      .toEqual({ allow: true, unblocked: true });
    expect(g.notLoaded.size).toBe(0);
    // Afterwards the section saves normally, including back to empty (a real clearing).
    expect(checkAutosave(g, { section: 'medications', fingerprint: fp([[], '']), readOnly: false }).allow).toBe(true);
  });

  it('a successful retry replaces the not-loaded mark with the loaded value', () => {
    const g = createAutosaveGuard();
    const t1 = beginLoad(g);
    finishLoad(g, t1, ['allergies', 'plan'], ['allergies'], { allergies: fp(''), plan: fp('p') });
    const t2 = beginLoad(g);
    finishLoad(g, t2, ['allergies'], [], { allergies: fp('Penicillin') });
    expect(g.notLoaded.size).toBe(0);
    expect(checkAutosave(g, { section: 'allergies', fingerprint: fp('Penicillin'), readOnly: false }).allow).toBe(false);
    expect(checkAutosave(g, { section: 'plan', fingerprint: fp('p'), readOnly: false }).allow).toBe(false);
  });

  it('ignores the finish of a load that was superseded (patient changed)', () => {
    const g = createAutosaveGuard();
    const stale = beginLoad(g);
    resetGuard(g);
    const current = beginLoad(g);
    expect(finishLoad(g, stale, ['plan'], ['plan'], { plan: fp('') })).toBe(false);
    expect(g.hydrating).toBe(true);
    expect(finishLoad(g, current, ['plan'], [], { plan: fp('') })).toBe(true);
    expect(g.hydrating).toBe(false);
  });

  it('never writes an encounter section of a closed encounter; patient sections are unaffected', () => {
    const g = createAutosaveGuard();
    for (const section of ENCOUNTER_SAVE_SECTIONS) {
      expect(checkAutosave(g, { section, fingerprint: fp('edited'), readOnly: true })).toEqual({ allow: false, reason: 'read_only' });
    }
    for (const section of PATIENT_SAVE_SECTIONS) {
      expect(checkAutosave(g, { section, fingerprint: fp('edited'), readOnly: true }).allow).toBe(true);
    }
    expect(isReadOnlyEncounterStatus('closed')).toBe(true);
    expect(isReadOnlyEncounterStatus('cancelled')).toBe(true);
    for (const s of ['open', 'in_progress', null, undefined]) expect(isReadOnlyEncounterStatus(s)).toBe(false);
  });

  it('clearSections forgets baselines (a new encounter starts writable)', () => {
    const g = createAutosaveGuard();
    const t = beginLoad(g);
    finishLoad(g, t, ['plan', 'allergies'], ['plan'], { plan: fp(''), allergies: fp('Latex') });
    clearSections(g, ENCOUNTER_SAVE_SECTIONS);
    expect(checkAutosave(g, { section: 'plan', fingerprint: fp(''), readOnly: false }).allow).toBe(true);
    expect(checkAutosave(g, { section: 'allergies', fingerprint: fp('Latex'), readOnly: false }).allow).toBe(false);
  });

  it('covers every section once, with a label, and maps every outbox entity type', () => {
    expect(new Set(ALL_SAVE_SECTIONS).size).toBe(ALL_SAVE_SECTIONS.length);
    for (const s of ALL_SAVE_SECTIONS) expect(SAVE_SECTION_LABEL[s]).toBeTruthy();
    expect(new Set(Object.values(ENTITY_TYPE_SECTION))).toEqual(new Set(ALL_SAVE_SECTIONS));
  });
});

// ── Section values: state (baseline) vs trackedSave payload (the check when a save fires) ──────
const STATE: SectionState = {
  assessment: 'Acute appendicitis', differentials: 'Mesenteric adenitis', icdCodes: ['K35.80'], cptCodes: ['44970'],
  plan: 'Lap appendicectomy',
  medications: ['Metformin'], medicationsText: 'Aspirin 75 mg od',
  examFindings: { abdomen: ['RIF tenderness'] }, examNotes: { abdomen: 'guarding' },
  rosFindings: { gi: { status: 'positive', details: ['nausea'], notes: '' } },
  procedureData: { cc: [{ complaint: 'RIF pain', answers: {} }] },
  traumaData: { mechanism: ['fall'] },
  hpiNotes: 'Two days of pain',
  orderedInvestigations: ['FBC', 'CRP'],
  dbEncounterType: 'outpatient',
  inpatient: { ward: 'Surgical', dateAdmission: '2026-09-25', dateDischarge: '', admittingSurgeon: 'Dr K', referringPhysician: '', nokName: 'A', nokRelation: 'wife', nokTel: '1', bloodGroup: 'O+', mrNumber: 'MR1' },
  clinicalScores: { alvarado: 8 }, extractedLabs: { wbc: 14 },
  allergies: 'Penicillin, Latex',
  surgicalHistory: ['Cholecystectomy'], surgicalNotes: 'uneventful', recentSurgeryDate: '',
  toxicHabits: ['Smoker'],
  pmhNotes: 'T2DM', familyHistoryNotes: 'none',
  lifestyleHistory: { fasting: { observes: 'yes' }, nightShift: 'no' },
};
const E = 'enc-1', P = 'pat-1';
// Payloads as AppContext builds them for trackedSave (kept in step by the source check below).
const PAYLOADS: Record<string, Record<string, unknown>> = {
  assessment: { encounter_id: E, patient_id: P, diagnosis: STATE.assessment, differentials: STATE.differentials, icdCodes: STATE.icdCodes, cptCodes: STATE.cptCodes, acuity: 'urgent', triageScore: 7, expectedUpdatedAt: 't' },
  plan: { encounter_id: E, patient_id: P, description: STATE.plan, expectedUpdatedAt: 't' },
  medications: { patientId: P, encounterId: E, chipMeds: STATE.medications, freeText: STATE.medicationsText },
  exam_findings: { examFindings: STATE.examFindings, examNotes: STATE.examNotes, patientId: P, encounterId: E },
  ros_findings: { patientId: P, encounterId: E, rosFindings: STATE.rosFindings },
  procedure_data: { patientId: P, encounterId: E, procedureData: STATE.procedureData },
  trauma_record: { patientId: P, encounterId: E, traumaData: STATE.traumaData },
  hpi_note: { encounterId: E, patientId: P, hpiNotes: STATE.hpiNotes },
  investigation_orders: { encounterId: E, patientId: P, orderedInvestigations: STATE.orderedInvestigations },
  encounter_type: { encounterId: E, dbType: STATE.dbEncounterType },
  inpatient_details: { encounterId: E, patientId: P, data: { ...STATE.inpatient } },
  clinical_scores: { encounterId: E, clinicalScores: STATE.clinicalScores, extractedLabs: STATE.extractedLabs },
  allergies: { patientId: P, allergens: ['Penicillin', 'Latex'] },
  surgical_history: { patientId: P, procedures: STATE.surgicalHistory, notes: STATE.surgicalNotes, recentSurgeryDate: STATE.recentSurgeryDate },
  toxic_habits: { patientId: P, habits: STATE.toxicHabits },
  pmh_notes: { patientId: P, pmhNotes: STATE.pmhNotes, familyHistoryNotes: STATE.familyHistoryNotes },
  lifestyle_history: { patientId: P, lifestyle: STATE.lifestyleHistory },
};

describe('section values', () => {
  it('the value in state equals the value in the save payload, for every entity type', () => {
    for (const [entityType, payload] of Object.entries(PAYLOADS)) {
      const section = ENTITY_TYPE_SECTION[entityType];
      expect(fingerprint(sectionValueFromPayload(entityType, payload)), entityType)
        .toBe(fingerprint(sectionValueFromState(section, STATE)));
    }
  });

  it('an HPI clear equals an empty HPI', () => {
    expect(fingerprint(sectionValueFromPayload('hpi_note_clear', { encounterId: E })))
      .toBe(fingerprint(sectionValueFromState('hpi', { ...STATE, hpiNotes: '   ' })));
  });

  it('fingerprints ignore object key order', () => {
    expect(fingerprint({ b: 1, a: { d: 2, c: 3 } })).toBe(fingerprint({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it('AppContext builds its payloads with the keys read here', () => {
    const src = readSrc('context/AppContext.tsx');
    for (const [entityType, payload] of Object.entries(PAYLOADS)) {
      const sites = [...src.matchAll(new RegExp(`entityType: '${entityType}'[\\s\\S]{0,420}`, 'g'))].map(m => m[0]);
      expect(sites.length, entityType).toBeGreaterThan(0);
      const keys = Object.keys(payload).filter(k => !['acuity', 'triageScore', 'expectedUpdatedAt'].includes(k));
      for (const site of sites) for (const k of keys) expect(site, `${entityType}.${k}`).toMatch(new RegExp(`\\b${k}\\b`));
    }
  });
});
