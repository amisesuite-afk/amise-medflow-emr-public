import { describe, it, expect } from 'vitest';
import {
  createAutosaveGuard, beginLoad, finishLoad, checkAutosave, resetGuard, clearSections,
  isReadOnlyEncounterStatus, fingerprint, ALL_SAVE_SECTIONS, ENCOUNTER_SAVE_SECTIONS,
  PATIENT_SAVE_SECTIONS, ENTITY_TYPE_SECTION, SAVE_SECTION_LABEL,
} from '@/lib/autosave-guard';

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
