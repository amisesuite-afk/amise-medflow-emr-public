/**
 * NEWS2 consciousness (ACVPU) and air/oxygen on the web `vitals` table (Migration 91):
 * mapping between entry-form strings and columns, the missing-column fallback used until the
 * migration is applied, and NEWS2 completeness once the fields are recorded.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Fake Supabase client ─────────────────────────────────────────────────────
// Records every insert / select and answers from a queue of canned responses.
type Resp = { data?: unknown; error: { code?: string; message?: string; details?: string } | null };
const calls: Array<{ table: string; op: 'insert' | 'select'; payload: unknown }> = [];
let responses: Resp[] = [];
// Per-table queues (checked first) for reads that query several tables in parallel.
let tableResponses: Record<string, Resp[]> = {};
const next = (table: string): Resp => tableResponses[table]?.shift() ?? responses.shift() ?? { data: null, error: null };

function builder(table: string) {
  let result: Resp | null = null;
  const chain = {
    insert(row: unknown) { calls.push({ table, op: 'insert', payload: row }); result = next(table); return chain; },
    select(cols: string) { calls.push({ table, op: 'select', payload: cols }); result = next(table); return chain; },
    eq() { return chain; }, neq() { return chain; }, is() { return chain; },
    order() { return chain; }, limit() { return chain; }, maybeSingle() { return chain; },
    then<T>(onOk: (r: { data: unknown; error: Resp['error'] }) => T, onErr?: (e: unknown) => T) {
      const r = result ?? { data: null, error: null };
      return Promise.resolve({ data: r.data ?? null, error: r.error }).then(onOk, onErr);
    },
  };
  return chain;
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => builder(table) },
}));

import {
  parseAvpu, parseOnSupplementalO2, oxygenEntry, news2FieldsToRow, news2FieldsFromRow,
  isMissingColumnError, withoutNews2Fields, news2OptionsFromVitals, resolveNews2Scale2,
  VITALS_NEWS2_COLUMNS,
} from '@/lib/vitals-news2-fields';
import { EMPTY_VITALS, restoreVitalsState } from '@/lib/vitals-state';
import { saveVitals, saveVitalsRecord, getLatestClosedEncounter, loadPatientNews2Scale2 } from '@/lib/db';
import { scoreNews2 } from '@/lib/clinical-scores';

// PostgREST errors as the server returns them before Migration 91.
const PGRST204 = { code: 'PGRST204', message: "Could not find the 'avpu' column of 'vitals' in the schema cache" };
const PG42703 = { code: '42703', message: 'column vitals_1.avpu does not exist' };

beforeEach(() => {
  calls.length = 0;
  responses = [];
  tableResponses = {};
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const baseVitals = {
  encounter_id: 'enc-1', patient_id: 'pat-1',
  systolicBp: '118', diastolicBp: '76', heartRate: '88', temperatureC: '37.2',
  respiratoryRate: '18', spo2: '97', glucoseMmol: '', weightKg: '', heightCm: '',
};

// ═════════════════════════════════════════════════════════════════════════════
describe('mapping', () => {
  it('parses ACVPU letters and rejects anything else', () => {
    expect(parseAvpu('A')).toBe('A');
    expect(parseAvpu(' c ')).toBe('C');
    expect(parseAvpu('U')).toBe('U');
    expect(parseAvpu('')).toBeNull();
    expect(parseAvpu('X')).toBeNull();
    expect(parseAvpu('Alert')).toBeNull();
    expect(parseAvpu(null)).toBeNull();
    expect(parseAvpu(3)).toBeNull();
  });

  it('parses air / oxygen and never turns "not recorded" into room air', () => {
    expect(parseOnSupplementalO2(true)).toBe(true);
    expect(parseOnSupplementalO2(false)).toBe(false);
    expect(parseOnSupplementalO2('o2')).toBe(true);
    expect(parseOnSupplementalO2('air')).toBe(false);
    expect(parseOnSupplementalO2('true')).toBe(true);
    expect(parseOnSupplementalO2('false')).toBe(false);
    expect(parseOnSupplementalO2('')).toBeNull();
    expect(parseOnSupplementalO2(null)).toBeNull();
    expect(parseOnSupplementalO2(undefined)).toBeNull();
    expect(oxygenEntry(true)).toBe('o2');
    expect(oxygenEntry(false)).toBe('air');
    expect(oxygenEntry(null)).toBe('');
  });

  it('maps entry-form values to the iOS-named columns and omits unrecorded fields', () => {
    expect(news2FieldsToRow('V', 'o2')).toEqual({ avpu: 'V', on_supplemental_o2: true });
    expect(news2FieldsToRow('A', 'air')).toEqual({ avpu: 'A', on_supplemental_o2: false });
    expect(news2FieldsToRow('', '')).toEqual({});
    expect(news2FieldsToRow(undefined, 'air')).toEqual({ on_supplemental_o2: false });
    expect([...VITALS_NEWS2_COLUMNS]).toEqual(['avpu', 'on_supplemental_o2']);
  });

  it('maps a vitals / patient_vitals row back to NEWS2 values', () => {
    expect(news2FieldsFromRow({ avpu: 'P', on_supplemental_o2: true })).toEqual({ avpu: 'P', onSupplementalO2: true });
    expect(news2FieldsFromRow({ avpu: null, on_supplemental_o2: null })).toEqual({ avpu: null, onSupplementalO2: null });
    // A row selected before Migration 91 has neither key.
    expect(news2FieldsFromRow({ heart_rate: 80 })).toEqual({ avpu: null, onSupplementalO2: null });
    expect(news2FieldsFromRow(null)).toEqual({ avpu: null, onSupplementalO2: null });
  });

  it('restores an older saved encounter without the new fields as "not recorded"', () => {
    const old = { systolicBp: '120', diastolicBp: '80', heartRate: '70', temperatureC: '', respiratoryRate: '', spo2: '98', glucoseMmol: '' };
    const restored = restoreVitalsState(old);
    expect(restored.avpu).toBe('');
    expect(restored.onSupplementalO2).toBe('');
    expect(restored.systolicBp).toBe('120');
    expect(restoreVitalsState({ ...old, avpu: 'C', onSupplementalO2: 'o2' })).toMatchObject({ avpu: 'C', onSupplementalO2: 'o2' });
    expect(restoreVitalsState(null)).toEqual(EMPTY_VITALS);
    // Every value is a string, so `Object.values(vitals).some(v => v.trim())` stays safe.
    expect(Object.values(restoreVitalsState({ systolicBp: 120 })).every(v => typeof v === 'string')).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('missing-column detection', () => {
  it('recognises 42703 and PGRST204', () => {
    expect(isMissingColumnError(PGRST204, VITALS_NEWS2_COLUMNS)).toBe(true);
    expect(isMissingColumnError(PG42703, VITALS_NEWS2_COLUMNS)).toBe(true);
    expect(isMissingColumnError({ message: 'column "on_supplemental_o2" of relation "vitals" does not exist' }, VITALS_NEWS2_COLUMNS)).toBe(true);
  });

  it('does not treat other failures as a missing column', () => {
    expect(isMissingColumnError({ code: '42501', message: 'permission denied for table vitals' }, VITALS_NEWS2_COLUMNS)).toBe(false);
    expect(isMissingColumnError({ code: '23514', message: 'new row for relation "vitals" violates check constraint "vitals_avpu_check"' }, VITALS_NEWS2_COLUMNS)).toBe(false);
    expect(isMissingColumnError(new TypeError('Failed to fetch'), VITALS_NEWS2_COLUMNS)).toBe(false);
    expect(isMissingColumnError(null, VITALS_NEWS2_COLUMNS)).toBe(false);
  });

  it('strips only the NEWS2 columns', () => {
    expect(withoutNews2Fields({ heart_rate: 80, avpu: 'A', on_supplemental_o2: false })).toEqual({ heart_rate: 80 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('saveVitals / saveVitalsRecord', () => {
  it('writes avpu and on_supplemental_o2 with the rest of the vitals', async () => {
    const res = await saveVitals({ ...baseVitals, avpu: 'A', onSupplementalO2: 'air' });
    expect(res).toEqual({ error: null, droppedNews2Fields: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ table: 'vitals', op: 'insert' });
    expect(calls[0].payload).toMatchObject({ heart_rate: 88, oxygen_saturation: 97, avpu: 'A', on_supplemental_o2: false });
  });

  it('leaves the columns out when not recorded', async () => {
    await saveVitals({ ...baseVitals, avpu: '', onSupplementalO2: '' });
    expect(calls[0].payload).not.toHaveProperty('avpu');
    expect(calls[0].payload).not.toHaveProperty('on_supplemental_o2');
  });

  it('retries without the NEWS2 fields when the columns are missing (PGRST204) and still saves', async () => {
    responses = [{ error: PGRST204 }, { error: null }];
    const res = await saveVitals({ ...baseVitals, avpu: 'V', onSupplementalO2: 'o2' });
    expect(res).toEqual({ error: null, droppedNews2Fields: true });
    expect(calls).toHaveLength(2);
    expect(calls[1].payload).not.toHaveProperty('avpu');
    expect(calls[1].payload).not.toHaveProperty('on_supplemental_o2');
    expect(calls[1].payload).toMatchObject({ heart_rate: 88, respiratory_rate: 18, bp_systolic: 118 });
  });

  it('retries on 42703 too', async () => {
    responses = [{ error: PG42703 }, { error: null }];
    const res = await saveVitalsRecord({ timestamp: '2026-09-25T10:00', hr: '90', avpu: 'A', o2: 'air' }, 'pat-1', 'enc-1');
    expect(res.error).toBeNull();
    expect(res.droppedNews2Fields).toBe(true);
    expect(calls[0].payload).toMatchObject({ avpu: 'A', on_supplemental_o2: false, heart_rate: 90 });
    expect(calls[1].payload).not.toHaveProperty('avpu');
    expect(calls[1].payload).toMatchObject({ heart_rate: 90 });
  });

  it('does not retry (and reports) a real failure', async () => {
    responses = [{ error: { code: '42501', message: 'permission denied for table vitals' } }];
    const res = await saveVitals({ ...baseVitals, avpu: 'A', onSupplementalO2: 'air' });
    expect(res.error).toBe('permission denied for table vitals');
    expect(calls).toHaveLength(1);
  });

  it('does not retry a missing-column error when no NEWS2 fields were sent', async () => {
    responses = [{ error: PG42703 }];
    const res = await saveVitals({ ...baseVitals });
    expect(res.error).toBe(PG42703.message);
    expect(calls).toHaveLength(1);
  });

  it('reports the retry error if the save still fails', async () => {
    responses = [{ error: PGRST204 }, { error: { code: '08006', message: 'connection failure' } }];
    const res = await saveVitals({ ...baseVitals, avpu: 'A' });
    expect(res.error).toBe('connection failure');
    expect(calls).toHaveLength(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('reads', () => {
  // getLatestClosedEncounter reads the encounters row, then its vitals (and other tables) in
  // parallel — responses are queued per table.
  const encounterRow = { id: 'enc-0', encounter_date: '2026-09-01', encounter_type: 'outpatient', chief_complaint: null, created_at: '2026-09-01' };
  const vitalRow = (vital: Record<string, unknown>) => ([{
    bp_systolic: 120, bp_diastolic: 80, heart_rate: 72, temperature_c: 36.8, oxygen_saturation: 98,
    respiratory_rate: 14, weight_kg: 70, bmi: 24, ...vital,
  }]);
  const vitalsSelects = () => calls.filter(c => c.table === 'vitals' && c.op === 'select');

  it('maps avpu / on_supplemental_o2 from the prior encounter vitals', async () => {
    tableResponses = {
      encounters: [{ data: encounterRow, error: null }],
      vitals: [{ data: vitalRow({ avpu: 'A', on_supplemental_o2: true }), error: null }],
    };
    const { data } = await getLatestClosedEncounter('pat-1');
    expect(String(vitalsSelects()[0].payload)).toContain('avpu, on_supplemental_o2');
    expect(data?.vitals).toMatchObject({ hr: 72, avpu: 'A', onSupplementalO2: true });
  });

  it('falls back to the old select when the columns are missing', async () => {
    tableResponses = {
      encounters: [{ data: encounterRow, error: null }],
      vitals: [{ error: PG42703 }, { data: vitalRow({}), error: null }],
    };
    const { data, error } = await getLatestClosedEncounter('pat-1');
    expect(error).toBeNull();
    expect(vitalsSelects()).toHaveLength(2);
    expect(String(vitalsSelects()[1].payload)).not.toContain('avpu');
    expect(data?.vitals).toMatchObject({ hr: 72, avpu: null, onSupplementalO2: null });
  });

  it('reads the patient Scale 2 opt-in, and reports it unavailable before Migration 88', async () => {
    responses = [{ data: { news2_spo2_scale2: true }, error: null }];
    expect(await loadPatientNews2Scale2('pat-1')).toEqual({ available: true, useScale2: true });
    responses = [{ error: { code: '42703', message: 'column patients.news2_spo2_scale2 does not exist' } }];
    expect(await loadPatientNews2Scale2('pat-1')).toEqual({ available: false, useScale2: false });
    responses = [{ data: null, error: null }];
    expect(await loadPatientNews2Scale2('pat-1')).toEqual({ available: false, useScale2: false });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('NEWS2 completeness from the stored vitals', () => {
  const numeric = { respiratoryRate: 18, spo2: 97, systolicBp: 118, heartRate: 88, temperatureC: 37.2 };

  it('is complete when ACVPU and air/O₂ are recorded', () => {
    const r = scoreNews2(numeric, { ...news2OptionsFromVitals({ avpu: 'A', onSupplementalO2: 'air' }) });
    expect(r.complete).toBe(true);
    expect(r.missing_inputs).toEqual([]);
    expect(r.incomplete_note).toBeNull();
    expect(r.breakdown).toMatchObject({ ACVPU: 0, 'Air/O₂': 0 });
  });

  it('scores the stored values (oxygen +2, new confusion +3)', () => {
    const r = scoreNews2(numeric, { ...news2OptionsFromVitals({ avpu: 'C', onSupplementalO2: 'o2' }) });
    expect(r.complete).toBe(true);
    expect(r.breakdown).toMatchObject({ ACVPU: 3, 'Air/O₂': 2 });
    expect(r.has_single_parameter_3).toBe(true);
  });

  it('stays incomplete when they are not recorded (e.g. before Migration 91 with nothing entered)', () => {
    const r = scoreNews2(numeric, { ...news2OptionsFromVitals({ avpu: '', onSupplementalO2: '' }) });
    expect(r.complete).toBe(false);
    expect(r.missing_inputs).toEqual(['Air/O₂', 'ACVPU']);
  });

  it('takes SpO₂ Scale 2 from the patient record when available, else the manual opt-in', () => {
    expect(resolveNews2Scale2({ available: true, useScale2: true }, false)).toBe(true);
    expect(resolveNews2Scale2({ available: true, useScale2: false }, true)).toBe(false);
    expect(resolveNews2Scale2({ available: false, useScale2: false }, true)).toBe(true);
    expect(resolveNews2Scale2({ available: false, useScale2: false }, false)).toBe(false);
  });
});
