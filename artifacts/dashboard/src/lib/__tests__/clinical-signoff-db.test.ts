/**
 * Clinical sign-off — the dashboard tolerates Migration 95 not being applied (no throw, no 500,
 * nothing queued or kept in the browser), reports refused / duplicate / invalid saves, and
 * audit-logs each saved decision.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Resp = { data?: unknown; error: { code?: string; message?: string } | null };
const calls: Array<{ table: string; op: string; payload?: unknown }> = [];
let queue: Record<string, Resp[]> = {};
let auditOk = true;
const audits: unknown[] = [];

function builder(table: string) {
  let result: Resp = { data: null, error: null };
  const take = () => queue[table]?.shift() ?? { data: [], error: null };
  let inserted = false;
  const chain = {
    select(cols?: string) { calls.push({ table, op: 'select', payload: cols }); if (!inserted) result = take(); return chain; },
    insert(row: unknown) { calls.push({ table, op: 'insert', payload: row }); inserted = true; result = take(); return chain; },
    order() { return chain; }, range() { return chain; },
    then<T>(ok: (r: { data: unknown; error: Resp['error'] }) => T, err?: (e: unknown) => T) {
      return Promise.resolve({ data: result.data ?? null, error: result.error }).then(ok, err);
    },
  };
  return chain;
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: (t: string) => builder(t) } }));
vi.mock('@/lib/db', () => ({ logClinicalSignoff: async (d: unknown) => { audits.push(d); return auditOk; } }));

import { loadSignoffs, rowToRecord, saveSignoff, validateSignoff } from '@/lib/clinical-signoff/db';
import type { SaveSignoffArgs, SignoffRow } from '@/lib/clinical-signoff/db';

const ROW: SignoffRow = {
  id: 'r1', item_id: 'fix-web-triage#3', item_hash: '0123456789abcdef', catalogue_hash: null, decision: 'approved',
  amendment: null, comment: null, attested: true, reviewer_user_id: 'u1', reviewer_name: 'Dr Test', reviewer_role: 'doctor',
  rule_set_ids: ['triage-rules-red-flags'], client_ref: 'web:x', decided_at: '2026-10-01T12:00:00Z',
};

const ARGS: SaveSignoffArgs = {
  item: { id: 'fix-web-triage#3', hash: '0123456789abcdef', ruleSetIds: ['triage-rules-red-flags'] },
  catalogueHash: 'aaaaaaaaaaaaaaaa', decision: 'approved', amendment: '', comment: '', attested: true,
  reviewerName: 'Dr Test', reviewerRole: 'doctor', userId: 'u1', clientRef: 'web:abc',
};

beforeEach(() => { calls.length = 0; queue = {}; auditOk = true; audits.length = 0; });

describe('graceful absence of clinical_signoffs (Migration 95 not applied)', () => {
  it.each(['42P01', 'PGRST205'])('load reports available:false on %s', async code => {
    queue.clinical_signoffs = [{ error: { code, message: 'relation does not exist' } }];
    const d = await loadSignoffs();
    expect(d).toEqual({ available: false, records: [], error: null });
  });

  it('save reports "unavailable" and writes no audit row', async () => {
    queue.clinical_signoffs = [{ error: { code: 'PGRST205', message: 'not in schema cache' } }];
    const r = await saveSignoff(ARGS);
    expect(r.status).toBe('unavailable');
    expect(audits).toHaveLength(0);
  });

  it('keeps nothing in browser storage', async () => {
    const g = globalThis as { localStorage?: unknown };
    const set = vi.fn();
    g.localStorage = { setItem: set, getItem: () => null, removeItem: () => {} };
    queue.clinical_signoffs = [{ error: { code: '42P01' } }];
    await loadSignoffs();
    await saveSignoff(ARGS);
    expect(set).not.toHaveBeenCalled();
    delete g.localStorage;
  });
});

describe('loading and saving', () => {
  it('loads rows into records and drops malformed ones', async () => {
    queue.clinical_signoffs = [{ data: [ROW, { ...ROW, id: 'r2', decision: 'maybe' }], error: null }];
    const d = await loadSignoffs();
    expect(d.available).toBe(true);
    expect(d.records.map(r => r.id)).toEqual(['r1']);
    expect(rowToRecord({ ...ROW, rule_set_ids: null })!.ruleSetIds).toEqual([]);
  });

  it('inserts the attested decision in the reviewer\'s name and audit-logs it', async () => {
    queue.clinical_signoffs = [{ data: [ROW], error: null }];
    const r = await saveSignoff({ ...ARGS, comment: '  ' });
    expect(r).toMatchObject({ status: 'saved', audited: true });
    const ins = calls.find(c => c.op === 'insert')!.payload as Record<string, unknown>;
    expect(ins).toMatchObject({ item_id: 'fix-web-triage#3', item_hash: '0123456789abcdef', attested: true, reviewer_user_id: 'u1', reviewer_role: 'doctor', amendment: null, comment: null, client_ref: 'web:abc' });
    expect(audits).toEqual([expect.objectContaining({ itemId: 'fix-web-triage#3', decision: 'approved', signoffId: 'r1' })]);
  });

  it('reports a failed audit row without undoing the decision', async () => {
    auditOk = false;
    queue.clinical_signoffs = [{ data: [ROW], error: null }];
    expect(await saveSignoff(ARGS)).toMatchObject({ status: 'saved', audited: false });
  });

  it('maps refused (42501), duplicate (23505) and CHECK (23514) errors', async () => {
    for (const [code, status] of [['42501', 'refused'], ['23505', 'duplicate'], ['23514', 'invalid'], ['XX000', 'failed']] as const) {
      queue.clinical_signoffs = [{ error: { code, message: 'x' } }];
      expect((await saveSignoff(ARGS)).status).toBe(status);
    }
  });

  it('refuses before the database without the attestation, a reviewer name, or an amendment for an amended approval', async () => {
    expect(validateSignoff({ ...ARGS, attested: false })).toMatch(/I have reviewed/);
    expect(validateSignoff({ ...ARGS, reviewerName: ' ' })).toMatch(/reviewer/);
    expect(validateSignoff({ ...ARGS, decision: 'approved_with_amendment', amendment: '' })).toMatch(/amendment/);
    expect(validateSignoff({ ...ARGS, decision: 'approved_with_amendment', amendment: 'Use 30 mL' })).toBeNull();
    const r = await saveSignoff({ ...ARGS, attested: false });
    expect(r.status).toBe('invalid');
    expect(calls).toHaveLength(0);
  });
});
