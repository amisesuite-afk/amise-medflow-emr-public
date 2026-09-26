/**
 * Outcomes loop — the dashboard tolerates Migration 94 not being applied (no throw, no 500,
 * nothing queued or stored locally), reports duplicate / refused saves, treats a 0-row retract
 * as refused, and maps ICD-10 codes to PANE ids only when the mapping is unique.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Resp = { data?: unknown; error: { code?: string; message?: string } | null };
const calls: Array<{ table: string; op: string; payload?: unknown }> = [];
let queue: Record<string, Resp[]> = {};

function builder(table: string) {
  let result: Resp = { data: null, error: null };
  const take = () => queue[table]?.shift() ?? { data: [], error: null };
  const chain = {
    select(cols?: string) { calls.push({ table, op: 'select', payload: cols }); if (!calls.at(-2) || calls.at(-2)?.op !== 'update') result = take(); return chain; },
    insert(row: unknown) { calls.push({ table, op: 'insert', payload: row }); result = take(); return chain; },
    update(row: unknown) { calls.push({ table, op: 'update', payload: row }); result = take(); return chain; },
    eq() { return chain; }, order() { return chain; }, range() { return chain; },
    then<T>(ok: (r: { data: unknown; error: Resp['error'] }) => T, err?: (e: unknown) => T) {
      return Promise.resolve({ data: result.data ?? null, error: result.error }).then(ok, err);
    },
  };
  return chain;
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: (t: string) => builder(t) } }));

import { loadOutcomeData, retractFinalDiagnosis, saveFinalDiagnosis } from '@/lib/outcomes-db';
import { paneIdForIcd, paneShrinkageModel, searchFinalDiagnoses } from '@/lib/outcomes-model';
import { PHI_CACHE_KEYS } from '@/lib/phi-storage';

const DX = {
  encounterRef: 'web:11111111-2222-4333-8444-555555555555', finalIcd10: 'K35.80', finalDiseaseId: 'appendicitis',
  sourceType: 'histology' as const, sourceDate: '2026-09-01', actionsTaken: [], retrospectiveAcuity: null, status: 'confirmed' as const,
};

beforeEach(() => { calls.length = 0; queue = {}; });

describe('graceful absence of the outcome tables (Migration 94 not applied)', () => {
  it('loading reports "unavailable" instead of throwing', async () => {
    queue.prediction_snapshots = [{ error: { code: 'PGRST205', message: "Could not find the table 'public.prediction_snapshots'" } }];
    await expect(loadOutcomeData('pat-1')).resolves.toMatchObject({ available: false, snapshots: [], outcomes: [], error: null });
    queue.prediction_snapshots = [{ data: [], error: null }];
    queue.diagnosis_outcomes = [{ error: { code: '42P01', message: 'relation "diagnosis_outcomes" does not exist' } }];
    await expect(loadOutcomeData(null)).resolves.toMatchObject({ available: false });
  });

  it('saving reports "unavailable"; nothing is queued or kept in the browser', async () => {
    queue.diagnosis_outcomes = [{ error: { code: 'PGRST205', message: 'missing' } }];
    const r = await saveFinalDiagnosis({ diagnosis: DX, patientId: 'pat-1', encounterId: null, clientRef: 'web:abc', userId: null });
    expect(r.status).toBe('unavailable');
    expect(PHI_CACHE_KEYS.some(k => /outcome|diagnosis/i.test(String(k)))).toBe(false);
  });

  it('another database error is shown, not swallowed', async () => {
    queue.prediction_snapshots = [{ error: { code: '500', message: 'upstream timeout' } }];
    await expect(loadOutcomeData('pat-1')).resolves.toMatchObject({ available: true, error: 'upstream timeout' });
  });
});

describe('saving and retracting', () => {
  it('inserts coded values with the idempotency key', async () => {
    queue.diagnosis_outcomes = [{ data: null, error: null }];
    const r = await saveFinalDiagnosis({ diagnosis: DX, patientId: 'pat-1', encounterId: '11111111-2222-4333-8444-555555555555', clientRef: 'web:abc-1', userId: null });
    expect(r.status).toBe('saved');
    expect(calls[0]).toMatchObject({ table: 'diagnosis_outcomes', op: 'insert' });
    expect(calls[0].payload).toMatchObject({ client_ref: 'web:abc-1', final_icd10: 'K35.80', final_disease_id: 'appendicitis', status: 'confirmed' });
  });

  it('a second confirmed diagnosis and a role refusal are reported', async () => {
    queue.diagnosis_outcomes = [{ error: { code: '23505', message: 'duplicate key' } }, { error: { code: '42501', message: 'rls' } }];
    const a = await saveFinalDiagnosis({ diagnosis: DX, patientId: 'p', encounterId: null, clientRef: 'web:x', userId: null });
    const b = await saveFinalDiagnosis({ diagnosis: DX, patientId: 'p', encounterId: null, clientRef: 'web:y', userId: null });
    expect([a.status, b.status]).toEqual(['duplicate', 'refused']);
  });

  it('a retract that changed no row (RLS) is a refusal', async () => {
    queue.diagnosis_outcomes = [{ data: [], error: null }];
    expect((await retractFinalDiagnosis('out-1', null)).status).toBe('refused');
    queue.diagnosis_outcomes = [{ data: [{ id: 'out-1' }], error: null }];
    expect((await retractFinalDiagnosis('out-1', null)).status).toBe('saved');
    expect(calls.find(c => c.op === 'update')?.payload).toMatchObject({ status: 'retracted' });
  });
});

describe('PANE mapping (read-only)', () => {
  it('maps an ICD-10 code to a PANE id only when exactly one node has it', () => {
    expect(paneIdForIcd('K35.80')).toBe('appendicitis');
    expect(paneIdForIcd('K3580')).toBe('appendicitis');
    expect(paneIdForIcd('Z99.99')).toBeNull();
  });

  it('search offers PANE nodes and ICD-10 codes', () => {
    const r = searchFinalDiagnoses('appendicitis');
    expect(r[0]).toMatchObject({ icd10: 'K35.80', diseaseId: 'appendicitis', source: 'pane' });
    expect(searchFinalDiagnoses('K81.0').some(o => o.diseaseId === 'cholecystitis')).toBe(true);
    expect(searchFinalDiagnoses('a')).toEqual([]);
  });

  it('exposes the current model to the proposals without changing it', () => {
    const m = paneShrinkageModel();
    expect(m.priors.appendicitis).toBeGreaterThan(0);
    expect(m.tiers?.frequent).toBe(0.015);
    const before = m.likelihood('appendicitis', 'fever');
    expect(before).toBeGreaterThan(0);
    expect(m.likelihood('appendicitis', 'fever')).toBe(before);
  });
});
