/**
 * Allergy status (UX review C1): an empty allergy field is "not recorded", never NKDA.
 * NKDA only when the clinician recorded it. Mirrors ios/AmiseMedFlow/Models/Patient+Allergies.swift.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  allergyStatus, allergyNoteText, allergyHeaderLabel, isNkdaEntry, parseAllergyEntries, NKDA_MARKER,
} from '@/lib/allergy-status';

const src = (rel: string) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), 'utf8');

describe('allergyStatus', () => {
  it('empty, blank or missing text is "not recorded" — never NKDA', () => {
    for (const t of ['', '   ', ' , ', null, undefined]) {
      expect(allergyStatus(t).kind).toBe('not_recorded');
      expect(allergyNoteText(t)).toBe('Allergies: not recorded');
      expect(allergyNoteText(t)).not.toMatch(/NKDA|no known/i);
      expect(allergyHeaderLabel(t)).toBe('Allergies: not recorded');
    }
  });

  it('explicit NKDA entries (wizard marker, Allergies chip, typed) are NKDA', () => {
    for (const t of [NKDA_MARKER, 'No known allergies', 'No known drug allergies (NKDA)', 'nka', 'None', 'Nil known.']) {
      expect(isNkdaEntry(t)).toBe(true);
      expect(allergyStatus(t).kind).toBe('nkda');
      expect(allergyNoteText(t)).toBe('No known drug allergies (NKDA)');
      expect(allergyHeaderLabel(t)).toBe('NKDA');
    }
  });

  it('real allergies are listed; the NKDA marker is not shown as an allergy', () => {
    const s = allergyStatus('Penicillin / amoxicillin, Latex');
    expect(s).toEqual({ kind: 'recorded', allergies: ['Penicillin / amoxicillin', 'Latex'], conflictsWithNkda: false });
    expect(allergyHeaderLabel('Penicillin / amoxicillin, Latex')).toBe('⚠ Penicillin / amoxicillin +1');
    expect(allergyNoteText('Penicillin (rash)')).toBe('Penicillin (rash)');
  });

  it('NKDA marked together with an allergy is a conflict to reconcile, shown as the allergy', () => {
    const s = allergyStatus('No known allergies, Penicillin / amoxicillin');
    expect(s.kind).toBe('recorded');
    if (s.kind === 'recorded') {
      expect(s.allergies).toEqual(['Penicillin / amoxicillin']);
      expect(s.conflictsWithNkda).toBe(true);
    }
    expect(allergyNoteText('NKDA, Latex')).toMatch(/Latex.*reconcile/);
  });

  it('entries that merely mention "no" are not NKDA', () => {
    expect(isNkdaEntry('Nonsteroidal anti-inflammatories')).toBe(false);
    expect(isNkdaEntry('Known penicillin allergy')).toBe(false);
    expect(parseAllergyEntries('Penicillin; Latex\nContrast')).toEqual(['Penicillin', 'Latex', 'Contrast']);
  });
});

describe('no screen or document falls back to NKDA for an empty field', () => {
  it('header, context banner and clinical note use the three-state helper', () => {
    const header = src('components/AppHeader.tsx');
    const banner = src('components/PatientContextBanner.tsx');
    const summary = src('pages/tabs/SummaryTab.tsx');
    for (const s of [header, banner, summary]) expect(s).toMatch(/allergyStatus\(/);
    // The old fallbacks printed NKDA whenever the list was empty.
    expect(header).not.toMatch(/\) : patientName \? \(\s*<span[^>]*>NKDA<\/span>/);
    expect(banner).not.toMatch(/allergyList\.length === 0 && \(\s*<span[^>]*>NKDA/);
    expect(summary).not.toMatch(/ctx\.allergies \? [^:]+: '[^']*No known drug allergies/);
  });
});
