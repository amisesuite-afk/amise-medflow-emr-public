/**
 * loadEncounterData() reports every failed read, so a failed table never reaches AppContext as an
 * empty value that autosave would write back over the record (lib/autosave-guard.ts).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

type Err = { code?: string; message: string };
/** Key: table, or "clinical_notes:<like pattern>". Value: an error to answer with, or rows. */
let answers: Record<string, { data?: unknown; error?: Err; reject?: boolean }> = {};
const queried: string[] = [];

function builder(table: string) {
  let key = table;
  const chain = {
    select() { return chain; },
    eq() { return chain; }, is() { return chain; }, order() { return chain; }, limit() { return chain; },
    maybeSingle() { return chain; },
    like(_col: string, pattern: string) { key = `${table}:${pattern}`; return chain; },
    then<T>(onOk: (r: { data: unknown; error: Err | null }) => T, onErr?: (e: unknown) => T) {
      queried.push(key);
      const a = answers[key] ?? answers[table];
      if (a?.reject) return Promise.reject(new TypeError('Failed to fetch')).then(onOk, onErr);
      return Promise.resolve({ data: a?.error ? null : (a?.data ?? null), error: a?.error ?? null }).then(onOk, onErr);
    },
  };
  return chain;
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: (t: string) => builder(t) } }));

import { loadEncounterData } from '@/lib/db';
import { ALL_SAVE_SECTIONS, PATIENT_SAVE_SECTIONS } from '@/lib/autosave-guard';

const DOWN: Err = { code: '08006', message: 'connection failure' };

beforeEach(() => {
  answers = {};
  queried.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('loadEncounterData failed sections', () => {
  it('reports nothing failed when every read succeeds, and splits the free-text medicine row', async () => {
    answers = {
      medications: { data: [{ drug_name: 'Metformin', dose: null }, { drug_name: 'Aspirin 75 mg od', dose: '(see notes)' }] },
      plans: { data: { description: 'Review', updated_at: 't' } },
    };
    const r = await loadEncounterData('enc-1', 'pat-1');
    expect(r.error).toBeNull();
    expect(r.data!.failedSections).toEqual([]);
    expect(r.data!.loadedSections).toEqual([...ALL_SAVE_SECTIONS]);
    expect(r.data!.medications).toEqual(['Metformin']);
    expect(r.data!.medicationsFreeText).toBe('Aspirin 75 mg od');
    expect(r.data!.plan).toBe('Review');
  });

  it('maps each failing table to its section', async () => {
    answers = {
      assessments: { error: DOWN }, plans: { error: DOWN }, allergies: { error: DOWN },
      medications: { error: DOWN }, 'clinical_notes:[HPI]%': { error: DOWN },
      patients: { error: DOWN }, investigation_results: { error: DOWN },
      'clinical_notes:[EXAMINATION_JSON]%': { error: DOWN }, encounters: { error: DOWN },
      surgical_history: { error: DOWN }, toxic_habits: { error: DOWN }, ros_findings: { error: DOWN },
      operative_notes: { error: DOWN }, trauma_records: { error: DOWN },
      'clinical_notes:[INPATIENT_JSON]%': { error: DOWN },
    };
    const r = await loadEncounterData('enc-1', 'pat-1');
    expect(new Set(r.data!.failedSections)).toEqual(new Set(ALL_SAVE_SECTIONS.filter(s => s !== 'encounter_type')));
  });

  it('a network-level failure counts as failed too', async () => {
    answers = { medications: { reject: true }, investigation_results: { reject: true } };
    const r = await loadEncounterData('enc-1', 'pat-1');
    expect(r.data!.failedSections.sort()).toEqual(['investigations', 'medications']);
    expect(r.data!.medications).toEqual([]);
  });

  it('an unreadable stored examination is failed, not an empty examination', async () => {
    answers = { 'clinical_notes:[EXAMINATION_JSON]%': { data: { content: '[EXAMINATION_JSON]\n{not json' } } };
    const r = await loadEncounterData('enc-1', 'pat-1');
    expect(r.data!.failedSections).toEqual(['exam']);
  });

  it('a missing table still counts as loaded (empty), as before', async () => {
    answers = { toxic_habits: { error: { code: '42P01', message: 'relation "toxic_habits" does not exist' } } };
    const r = await loadEncounterData('enc-1', 'pat-1');
    expect(r.data!.failedSections).toEqual([]);
  });

  it('with no encounter, reads only the patient sections', async () => {
    const r = await loadEncounterData(null, 'pat-1');
    expect(r.data!.loadedSections).toEqual([...PATIENT_SAVE_SECTIONS]);
    expect(queried.some(k => /assessments|plans|medications|investigation_results|encounters|clinical_notes/.test(k))).toBe(false);
  });
});
