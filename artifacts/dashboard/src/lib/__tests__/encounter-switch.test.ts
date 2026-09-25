/**
 * Starting or loading another encounter of the same patient (Encounter history tab).
 *
 * Bug: "+ New encounter" set only the encounter id, so AppContext's autosave effects wrote the
 * previous encounter's assessment, plan, HPI, medicine list and investigation orders into the new
 * encounter (and a closed previous encounter made the new one look closed); "Load this encounter"
 * copied a stored encounter's content into the current encounter id. The browser reproduction is
 * e2e/encounter-switch.mjs; these tests pin the switch order, the per-encounter / patient field
 * split, and that AppContext and the tab follow them (no React rendering in this suite).
 */
import { describe, it, expect } from 'vitest';
import {
  switchEncounter, ENCOUNTER_SCOPED_FIELDS, PATIENT_SCOPED_FIELDS, ENCOUNTER_IDENTITY_FIELDS,
  type EncounterSwitchOps, type EncounterSwitchTarget,
} from '@/lib/encounter-switch';
import { readSrc, functionBody } from './helpers/source-scan';

const TARGET: EncounterSwitchTarget = { patientId: 'pat-1', encounterId: 'enc-new', status: 'open', closedAt: null };

function recorder(currentPatient: string | null) {
  const log: string[] = [];
  const ops: EncounterSwitchOps = {
    currentPatientId: () => currentPatient,
    flushPendingSaves: () => log.push('flush'),
    invalidateInFlightSaves: () => log.push('invalidate'),
    resetEncounterState: () => log.push('reset'),
    setEncounter: t => log.push(`set:${t.encounterId}:${t.status}`),
  };
  return { log, ops };
}

describe('switchEncounter', () => {
  it('flushes the current encounter, invalidates in-flight results, resets, then points at the new encounter', () => {
    const { log, ops } = recorder('pat-1');
    expect(switchEncounter(ops, TARGET)).toEqual({ switched: true });
    expect(log).toEqual(['flush', 'invalidate', 'reset', 'set:enc-new:open']);
  });

  it('applies a loaded encounter\'s data only after the reset', () => {
    const { log, ops } = recorder('pat-1');
    switchEncounter(ops, { ...TARGET, encounterId: 'enc-old', status: 'closed' }, () => log.push('apply'));
    expect(log).toEqual(['flush', 'invalidate', 'reset', 'set:enc-old:closed', 'apply']);
  });

  it('refuses an encounter of another patient (patient changed while it was created or loaded)', () => {
    for (const current of ['pat-2', null]) {
      const { log, ops } = recorder(current);
      expect(switchEncounter(ops, TARGET, () => log.push('apply'))).toEqual({ switched: false, reason: 'patient_changed' });
      expect(log).toEqual([]);
    }
  });
});

describe('per-encounter / patient field split', () => {
  const all = [...ENCOUNTER_SCOPED_FIELDS, ...PATIENT_SCOPED_FIELDS, ...ENCOUNTER_IDENTITY_FIELDS] as string[];

  it('classifies every field once', () => {
    expect(new Set(all).size).toBe(all.length);
  });

  it('keeps the standing history and resets the visit (surgeon-facing rules)', () => {
    const enc = new Set<string>(ENCOUNTER_SCOPED_FIELDS);
    const pat = new Set<string>(PATIENT_SCOPED_FIELDS);
    for (const f of ['comorbidities', 'pmhNotes', 'surgicalHistory', 'surgicalNotes', 'allergies', 'toxicHabits', 'familyHistory']) {
      expect(pat.has(f), f).toBe(true);
    }
    for (const f of ['assessment', 'plan', 'differentials', 'icdCodes', 'workingDiagnosis', 'hpiNotes',
      'examFindings', 'orderedInvestigations', 'vitals', 'visitType', 'encounterType', 'saveConflict',
      'assessmentUpdatedAt', 'planUpdatedAt', 'pendingPrescriptions']) {
      expect(enc.has(f), f).toBe(true);
    }
    // Medicines are today's list: last visit's list is offered by VisitContinuityPanel, not copied.
    expect(enc.has('medications')).toBe(true);
    expect(enc.has('medicationsText')).toBe(true);
  });
});

describe('AppContext follows the split', () => {
  const src = readSrc('context/AppContext.tsx');
  const reset = functionBody(src, 'resetEncounterState');
  const clear = functionBody(src, 'clearPatient');
  const setter = (f: string) => `set${f[0].toUpperCase()}${f.slice(1)}(`;

  it('classifies every field of the saved in-progress encounter (amise-enc-v1)', () => {
    const start = src.indexOf('scheduleSave({');
    expect(start).toBeGreaterThan(0);
    const body = src.slice(start + 'scheduleSave({'.length, src.indexOf('});', start));
    const keys = body.split(/[,\s]+/).map(k => k.trim()).filter(k => /^[A-Za-z]\w*$/.test(k));
    expect(keys.length).toBeGreaterThan(50);
    const classified = new Set<string>([...ENCOUNTER_SCOPED_FIELDS, ...PATIENT_SCOPED_FIELDS, ...ENCOUNTER_IDENTITY_FIELDS]);
    expect(keys.filter(k => !classified.has(k))).toEqual([]);
  });

  it('resetEncounterState() resets every per-encounter field and no patient field', () => {
    expect(reset.length).toBeGreaterThan(100);
    expect(ENCOUNTER_SCOPED_FIELDS.filter(f => !reset.includes(setter(f)))).toEqual([]);
    expect(PATIENT_SCOPED_FIELDS.filter(f => reset.includes(setter(f)))).toEqual([]);
    expect(ENCOUNTER_IDENTITY_FIELDS.filter(f => reset.includes(setter(f)))).toEqual([]);
  });

  it('clearPatient() resets the encounter state and the patient state', () => {
    expect(clear).toContain('resetEncounterState()');
    // Loaded per patient by effects keyed on patientId, not reset here.
    const byEffect = new Set(['recentEncounters', 'recentEncountersPatientId']);
    expect(PATIENT_SCOPED_FIELDS.filter(f => !byEffect.has(f) && !clear.includes(setter(f)))).toEqual([]);
  });

  it('beginEncounter() goes through switchEncounter and is on the context', () => {
    const begin = functionBody(src, 'beginEncounter');
    expect(begin).toContain('switchEncounter(');
    expect(begin).toContain('flushRef.current()');
    expect(begin).toContain('saveEpoch.current++');
    expect(begin).toContain('resetEncounterState');
    expect(src).toMatch(/\n\s+beginEncounter,\n/);
  });

  it('a save that finishes after a switch still leaves the pending count (sign-out waits on it)', () => {
    const tracked = src.slice(src.indexOf('const trackedSave = useCallback'), src.indexOf('// Flush the IndexedDB outbox'));
    const dec = tracked.indexOf('pendingSaves.current--');
    const stale = tracked.indexOf('if (saveEpoch.current !== epoch) return undefined;');
    expect(dec).toBeGreaterThan(0);
    expect(stale).toBeGreaterThan(dec);
  });
});

describe('Encounter history tab', () => {
  const tab = readSrc('pages/tabs/EncounterTimelineTab.tsx');

  it('never swaps the encounter id alone', () => {
    const code = tab.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\bsetEncounterId\s*\(/);
  });

  it('starts and loads encounters through beginEncounter()', () => {
    expect(functionBody(tab, 'startEncounter')).toContain('beginEncounter(');
    expect(functionBody(tab, 'loadEncounter')).toContain('beginEncounter(');
  });

  it('loading an encounter does not overwrite the patient\'s standing history', () => {
    const load = functionBody(tab, 'loadEncounter');
    for (const f of ['allergies', 'surgicalHistory', 'surgicalNotes', 'toxicHabits', 'pmhNotes', 'familyHistoryNotes', 'comorbidities']) {
      expect(load, f).not.toContain(`set${f[0].toUpperCase()}${f.slice(1)}(`);
    }
  });
});
