/**
 * The autosave guard (lib/autosave-guard.ts) only protects the record if every loader and every
 * autosave goes through it. No React rendering in this suite: these are source checks; the
 * browser behaviour is e2e/encounter-switch.mjs (failed read → no write; closed → no writes).
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { readSrc, functionBody } from './helpers/source-scan';

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

function srcFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== '__tests__') srcFiles(p, out); }
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe('autosave guard wiring', () => {
  const ctx = readSrc('context/AppContext.tsx');

  it('trackedSave asks the guard before counting or writing anything', () => {
    const tracked = ctx.slice(ctx.indexOf('const trackedSave = useCallback'), ctx.indexOf('// Flush the IndexedDB outbox'));
    const check = tracked.indexOf('if (descriptor && !autosaveAllowed(descriptor)) return undefined;');
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(tracked.indexOf('pendingSaves.current++'));
    expect(check).toBeLessThan(tracked.indexOf('await fn()'));
  });

  it('every autosave in AppContext goes through trackedSave with a descriptor', () => {
    const code = strip(ctx);
    for (const fn of ['saveAssessment', 'savePlan', 'syncMedicationList', 'syncAllergyList', 'saveExamFindings',
      'syncSurgicalHistory', 'syncToxicHabits', 'syncRosFindings', 'syncProcedureData', 'syncTraumaRecord',
      'saveHpiNote', 'clearHpiNote', 'savePmhNotes', 'syncInvestigationOrders', 'updateEncounterType',
      'saveInpatientDetails', 'saveClinicalScores']) {
      const calls = [...code.matchAll(new RegExp(`\\b${fn}\\(`, 'g'))].length;
      const tracked = [...code.matchAll(new RegExp(`trackedSave\\(\\s*\\(\\) => ${fn}\\(`, 'g'))].length;
      expect(calls, fn).toBeGreaterThanOrEqual(1);
      expect(tracked, `${fn}: every call inside trackedSave`).toBe(calls);
    }
  });

  it('the applier never applies a failed section', () => {
    const apply = ctx.slice(ctx.indexOf('function applyEncounterData('), ctx.indexOf('function beginRecordLoad('));
    expect(apply).toContain('!failed.has(s)');
    expect(apply).toMatch(/const use = \(s: SaveSection\)/);
  });

  it('only AppContext and the history tab read loadEncounterData, and the tab applies through applyStoredEncounter', () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const users = srcFiles(root)
      .filter(f => /\bloadEncounterData\(/.test(strip(readSrc(f.slice(root.length)))))
      .map(f => f.slice(root.length).replace(/\\/g, '/'))
      .sort();
    expect(users).toEqual(['context/AppContext.tsx', 'lib/db.ts', 'pages/tabs/EncounterTimelineTab.tsx']);
    const tab = readSrc('pages/tabs/EncounterTimelineTab.tsx');
    expect(functionBody(tab, 'loadEncounter')).toContain('() => applyStoredEncounter(d)');
  });

  it('patient search pauses autosave before its first await and ends the load on every path', () => {
    const load = strip(functionBody(readSrc('pages/tabs/PatientSearchTab.tsx'), 'loadPatient'));
    const begin = load.indexOf('beginRecordLoad()');
    expect(begin).toBeGreaterThan(load.indexOf('clearPatient()'));
    expect(begin).toBeLessThan(load.indexOf('await'));
    expect(load).toContain('endRecordLoad(loadToken)');
    expect(load).toContain('loadRecordIntoContext(loadToken');
  });

  it('the booking inbox pauses autosave on both of its patient-loading paths', () => {
    const src = strip(readSrc('pages/tabs/BookingInboxTab.tsx'));
    expect([...src.matchAll(/beginRecordLoad\(\)/g)].length).toBeGreaterThanOrEqual(2);
    expect(src).toContain('loadRecordIntoContext(loadToken');
  });

  it('closing an encounter flushes pending autosaves first (it is read-only afterwards)', () => {
    const home = readSrc('pages/Home.tsx');
    const complete = home.slice(home.indexOf('const completeEncounter = useCallback'), home.indexOf('const requestCompleteEncounter'));
    const flush = complete.indexOf('await flushAutosaves()');
    expect(flush).toBeGreaterThan(0);
    expect(flush).toBeLessThan(complete.indexOf('/api/visit/complete/'));
  });
});
