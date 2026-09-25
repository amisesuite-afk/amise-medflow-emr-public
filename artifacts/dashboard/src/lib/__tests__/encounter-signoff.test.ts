/**
 * Encounter sign-off (UX review M8): closing shows an in-app summary of what is missing and
 * needs an explicit confirmation; no bare browser confirm().
 */
import { describe, it, expect } from 'vitest';
import type { WorkingDiagnosis } from '@/context/AppContext';
import { buildSignOffSummary, DEFAULT_SIGNOFF_STEPS } from '@/lib/encounter-signoff';
import { functionBody, readSrc } from './helpers/source-scan';

const confirmed: WorkingDiagnosis = { diseaseId: 'cholecystitis', icdCode: 'K81.0', confidence: 0.88, source: 'pathognomonic', locked: true };

describe('buildSignOffSummary', () => {
  it('a blank encounter lists undocumented steps, allergies not recorded and no diagnosis', () => {
    const { gaps, undocumented } = buildSignOffSummary({
      steps: DEFAULT_SIGNOFF_STEPS, done: { hpi: false, pmh: false, medications: false, allergies: false, examination: false, assessment: false, plan: false },
      allergies: '', workingDiagnosis: null, icdCodes: [],
    });
    expect(undocumented).toEqual(['HPI', 'PMH', 'Meds', 'Exam', 'Assessment', 'Plan']);
    expect(gaps.map(g => g.id)).toEqual(['undocumented', 'allergies', 'diagnosis']);
    expect(gaps.find(g => g.id === 'allergies')?.text).toBe('Allergies: not recorded');
    expect(gaps.find(g => g.id === 'diagnosis')?.text).toBe('No diagnosis confirmed');
  });

  it('a complete encounter has no gaps', () => {
    const done = Object.fromEntries(DEFAULT_SIGNOFF_STEPS.map(s => [s, true]));
    expect(buildSignOffSummary({ steps: DEFAULT_SIGNOFF_STEPS, done, allergies: 'NKDA', workingDiagnosis: confirmed, icdCodes: [] }).gaps).toEqual([]);
    // A recorded ICD-10 code counts as a clinician-chosen diagnosis.
    expect(buildSignOffSummary({ steps: [], done: {}, allergies: 'Latex', workingDiagnosis: null, icdCodes: ['K80.2 — Gallstones'] }).gaps).toEqual([]);
  });

  it('an unconfirmed diagnosis and an NKDA/allergy conflict are flagged; steps without a signal are not', () => {
    const unlocked = { ...confirmed, locked: false };
    const { gaps } = buildSignOffSummary({
      steps: ['tasks', 'monitoring', 'plan'], done: { plan: true }, allergies: 'NKDA, Penicillin', workingDiagnosis: unlocked, icdCodes: [],
    });
    expect(gaps.map(g => g.id)).toEqual(['allergy_conflict', 'diagnosis']);
  });
});

describe('closing uses the in-app sign-off dialog', () => {
  it('no browser confirm() on the header close button', () => {
    expect(readSrc('components/AppHeader.tsx')).not.toMatch(/window\.confirm\(/);
  });

  it('every close control opens the dialog; the encounter closes only from its confirmation', () => {
    const home = readSrc('pages/Home.tsx');
    expect(home).not.toMatch(/completeEncounter=\{completeEncounter\}|onFinalise=\{completeEncounter\}/);
    expect(home).toMatch(/<EncounterSignOffDialog/);
    const dialog = readSrc('components/EncounterSignOffDialog.tsx');
    expect(dialog).toMatch(/disabled=\{!reviewed \|\| completing\}/);
    expect(functionBody(home, 'Home') || home).toMatch(/await completeEncounter\(\)/);
  });
});
