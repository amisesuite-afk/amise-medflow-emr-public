/**
 * getLatestClosedEncounter() — the Ambient view's "Prior visit" strip.
 *
 * It used to select encounters.diagnosis / encounters.plan and embed encounter_medications /
 * encounter_allergens / encounter_surgical_history, none of which exist, so every call failed and
 * the strip never appeared. These tests pin the query to the real schema and check the mapping.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, vi } from 'vitest';

type Resp = { data?: unknown; error: { code?: string; message?: string } | null };
interface Call { table: string; cols: string; filters: Array<[string, string, unknown]> }
const calls: Call[] = [];
let tableResponses: Record<string, Resp[]> = {};

function builder(table: string) {
  let result: Resp = { data: null, error: null };
  const call: Call = { table, cols: '', filters: [] };
  const chain = {
    select(cols: string) {
      call.cols = cols; calls.push(call);
      result = tableResponses[table]?.shift() ?? { data: null, error: null };
      return chain;
    },
    eq(col: string, v: unknown) { call.filters.push(['eq', col, v]); return chain; },
    neq(col: string, v: unknown) { call.filters.push(['neq', col, v]); return chain; },
    is() { return chain; }, order() { return chain; }, limit() { return chain; }, maybeSingle() { return chain; },
    then<T>(onOk: (r: { data: unknown; error: Resp['error'] }) => T, onErr?: (e: unknown) => T) {
      return Promise.resolve({ data: result.data ?? null, error: result.error }).then(onOk, onErr);
    },
  };
  return chain;
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: (table: string) => builder(table) } }));

import { getLatestClosedEncounter } from '@/lib/db';

const ENC = { id: 'enc-prev', encounter_date: '2026-09-01T14:00:00Z', encounter_type: 'outpatient', chief_complaint: 'Right iliac fossa pain', created_at: '2026-09-01T14:00:00Z' };

beforeEach(() => {
  calls.length = 0;
  tableResponses = {};
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const selectOf = (table: string) => calls.find(c => c.table === table);

describe('getLatestClosedEncounter', () => {
  it('builds the prior-visit summary from the encounter and its assessment, plan, medicines and vitals', async () => {
    tableResponses = {
      encounters: [{ data: ENC, error: null }],
      assessments: [{ data: { diagnosis: 'Acute appendicitis\nAlvarado 8' }, error: null }],
      plans: [{ data: { description: 'Laparoscopic appendicectomy' }, error: null }],
      medications: [{ data: [
        { drug_name: 'Metformin', dose: null },
        { drug_name: 'Amlodipine 5 mg daily', dose: '(see notes)' },
      ], error: null }],
      allergies: [{ data: [{ allergen: 'Penicillin' }, { allergen: ' Latex ' }], error: null }],
      surgical_history: [{ data: [
        { procedure_name: 'Cholecystectomy', notes: null },
        { procedure_name: '[notes]', notes: 'uneventful' },
      ], error: null }],
      vitals: [{ data: [{
        bp_systolic: 128, bp_diastolic: 82, heart_rate: 76, temperature_c: 36.9, oxygen_saturation: 98,
        respiratory_rate: 16, weight_kg: 81.5, bmi: 26.1, avpu: 'A', on_supplemental_o2: false,
      }], error: null }],
    };
    const { data, error } = await getLatestClosedEncounter('pat-1');
    expect(error).toBeNull();
    expect(data).toEqual({
      encounterId: 'enc-prev',
      encounterDate: '2026-09-01T14:00:00Z',
      encounterType: 'outpatient',
      chiefComplaint: 'Right iliac fossa pain',
      assessment: 'Acute appendicitis\nAlvarado 8',
      plan: 'Laparoscopic appendicectomy',
      medications: ['Metformin', 'Amlodipine 5 mg daily'],
      allergies: 'Penicillin, Latex',
      surgicalHistory: ['Cholecystectomy'],
      vitals: { sbp: 128, dbp: 82, hr: 76, tempC: 36.9, spo2: 98, rr: 16, weightKg: 81.5, bmi: 26.1, avpu: 'A', onSupplementalO2: false },
    });
    // Details are read for that encounter.
    for (const t of ['assessments', 'plans', 'medications', 'vitals']) {
      expect(selectOf(t)?.filters).toContainEqual(['eq', 'encounter_id', 'enc-prev']);
    }
  });

  it('only counts a closed encounter as the prior visit, and leaves out the encounter being documented', async () => {
    tableResponses = { encounters: [{ data: null, error: null }] };
    await getLatestClosedEncounter('pat-1', { excludeEncounterId: 'enc-now' });
    const enc = selectOf('encounters')!;
    expect(enc.filters).toContainEqual(['eq', 'patient_id', 'pat-1']);
    expect(enc.filters).toContainEqual(['eq', 'status', 'closed']);
    expect(enc.filters).toContainEqual(['neq', 'id', 'enc-now']);
  });

  it('returns null (no error) when the patient has no closed encounter, without further reads', async () => {
    tableResponses = { encounters: [{ data: null, error: null }] };
    expect(await getLatestClosedEncounter('pat-1')).toEqual({ data: null, error: null });
    expect(calls.map(c => c.table)).toEqual(['encounters']);
  });

  it('reports a failed encounter read', async () => {
    tableResponses = { encounters: [{ error: { code: '42501', message: 'permission denied for table encounters' } }] };
    expect(await getLatestClosedEncounter('pat-1')).toEqual({ data: null, error: 'permission denied for table encounters' });
  });

  it('still returns the summary when a detail read fails (partial, not blank)', async () => {
    tableResponses = {
      encounters: [{ data: ENC, error: null }],
      assessments: [{ error: { code: '08006', message: 'connection failure' } }],
      plans: [{ data: { description: 'Review in 2 weeks' }, error: null }],
      vitals: [{ error: { code: '08006', message: 'connection failure' } }],
    };
    const { data, error } = await getLatestClosedEncounter('pat-1');
    expect(error).toBeNull();
    expect(data).toMatchObject({ encounterId: 'enc-prev', assessment: null, plan: 'Review in 2 weeks', medications: [], vitals: null });
  });

  it('selects only tables and columns that exist in supabase-schema.sql (NEWS2 columns: Migration 91, with fallback)', async () => {
    tableResponses = { encounters: [{ data: ENC, error: null }] };
    await getLatestClosedEncounter('pat-1');
    const schema = readFileSync(fileURLToPath(new URL('../../../../../supabase-schema.sql', import.meta.url)), 'utf8');
    const OPTIONAL = new Set(['avpu', 'on_supplemental_o2']);
    // surgical_history is read through the existing loadSurgicalHistory() (Migration: clinical
    // persistence), which already tolerates the table being absent.
    for (const c of calls.filter(x => x.table !== 'surgical_history')) {
      const m = new RegExp(`create table if not exists ${c.table} \\(([\\s\\S]*?)\\n\\);`).exec(schema);
      expect(m, `table ${c.table} in supabase-schema.sql`).not.toBeNull();
      const block = m![1];
      const cols = c.cols.split(',').map(s => s.trim()).filter(Boolean);
      for (const col of cols) {
        expect(col, `no embedded resource in ${c.table}`).not.toMatch(/\(/);
        if (OPTIONAL.has(col)) continue;
        expect(new RegExp(`^\\s+${col}\\s`, 'm').test(block), `${c.table}.${col} exists`).toBe(true);
      }
    }
    expect(calls.map(c => c.table)).toEqual(
      expect.arrayContaining(['encounters', 'assessments', 'plans', 'medications', 'allergies', 'vitals']),
    );
  });
});
