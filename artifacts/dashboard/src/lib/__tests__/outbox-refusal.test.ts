/**
 * Migration 89: patients.pathway_data_json is clinician-only, so a front-desk save of the herbs /
 * supplements or lifestyle history is refused with 42501. Retrying can never succeed for that role:
 * the outbox drops the entry, logs it and shows a one-line notice instead of retrying forever, and
 * trackedSave() never queues it. Both cards are read-only for front desk (roles.ts).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase stand-in: the SELECT of pathway_data_json succeeds, the UPDATE returns `updateError`.
let updateError: { code: string; message: string } | null = null;
const updates: unknown[] = [];
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { pathway_data_json: '{}' }, error: null }) }) }),
      update: (row: unknown) => ({ eq: async () => { updates.push(row); return { error: updateError }; } }),
      insert: async () => ({ error: null }),   // audit log
    }),
  },
}));

import {
  OutboxRefusalError, __setOutboxStoreForTests, describeRefusal, enqueue, flush, isPermanentRefusal,
  isPermissionRefusal, onOutboxRefusal, pendingCount, registerExecutor, type OutboxEntry, type OutboxRefusal,
} from '@/lib/sync-outbox';
import '@/lib/sync-executors';
import { saveSupplementHistory } from '@/lib/supplement-store';
import { saveLifestyleHistory } from '@/lib/lifestyle-history-db';
import { emptyLifestyleHistory } from '@workspace/triage-engine/lifestyle-practices';
import { EMPTY_SUPPLEMENT_HISTORY } from '@/lib/supplement-catalogue';
import { PATHWAY_DATA_READ_ONLY_NOTE, canRecordPathwayData } from '@/lib/roles';

// Migration 89's front-desk column guard (supabase-staff-only-rls-migration.sql §3b).
const FRONT_DESK_42501 = {
  code: '42501',
  message: 'front-desk staff may only change administrative and intake patient fields; blocked: pathway_data_json',
};

function memoryStore() {
  const rows = new Map<number, OutboxEntry>();
  let next = 1;
  return {
    rows,
    all: async () => [...rows.values()].map(r => ({ ...r })),
    put: async (e: OutboxEntry) => { const id = e.id ?? next++; rows.set(id, { ...e, id }); },
    delete: async (id: number) => { rows.delete(id); },
  };
}

let store: ReturnType<typeof memoryStore>;
let refusals: OutboxRefusal[];
let unsubscribe: () => void;

beforeEach(() => {
  store = memoryStore();
  __setOutboxStoreForTests(store);
  refusals = [];
  unsubscribe = onOutboxRefusal(r => refusals.push(r));
  updateError = null;
  updates.length = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  unsubscribe();
  __setOutboxStoreForTests(null);
  vi.restoreAllMocks();
});

describe('permission refusals', () => {
  it('recognises 42501 / permission denied, not other errors', () => {
    expect(isPermissionRefusal(FRONT_DESK_42501)).toBe(true);
    expect(isPermissionRefusal({ code: '', message: 'permission denied for table patients' })).toBe(true);
    expect(isPermissionRefusal({ code: '', message: 'new row violates row-level security policy' })).toBe(true);
    expect(isPermissionRefusal({ code: 'PGRST204', message: "Could not find the 'pathway_data_json' column" })).toBe(false);
    expect(isPermissionRefusal('Failed to fetch')).toBe(false);
    expect(isPermissionRefusal(null)).toBe(false);
  });

  it('is permanent only for the supplements and lifestyle entity types', () => {
    const refused = new OutboxRefusalError('x');
    expect(isPermanentRefusal('supplements', refused)).toBe(true);
    expect(isPermanentRefusal('lifestyle_history', refused)).toBe(true);
    expect(isPermanentRefusal('assessment', refused)).toBe(false);
    expect(isPermanentRefusal('supplements', new Error('Failed to fetch'))).toBe(false);
    expect(isPermanentRefusal(undefined, refused)).toBe(false);
  });

  it('the save helpers flag a 42501 as refused and a network error as not refused', async () => {
    updateError = FRONT_DESK_42501;
    expect(await saveSupplementHistory('p1', EMPTY_SUPPLEMENT_HISTORY)).toMatchObject({ refused: true });
    expect(await saveLifestyleHistory('p1', emptyLifestyleHistory())).toMatchObject({ refused: true, available: true });
    updateError = { code: '', message: 'Failed to fetch' };
    expect((await saveSupplementHistory('p1', EMPTY_SUPPLEMENT_HISTORY)).refused).toBe(false);
    expect((await saveLifestyleHistory('p1', emptyLifestyleHistory())).refused).toBe(false);
  });
});

describe('outbox flush', () => {
  it('drops a refused supplements entry, logs it and notifies once — no retry', async () => {
    updateError = FRONT_DESK_42501;
    await enqueue('supplements', 'p1', { patientId: 'p1', history: EMPTY_SUPPLEMENT_HISTORY });
    await flush();
    expect(await pendingCount()).toBe(0);
    expect(refusals).toEqual([{ entityType: 'supplements', message: FRONT_DESK_42501.message }]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('refused by the server (permission) — dropped, not retried'));
    await flush(undefined, { ignoreBackoff: true });
    expect(refusals).toHaveLength(1);
  });

  it('drops a refused lifestyle entry the same way', async () => {
    updateError = FRONT_DESK_42501;
    await enqueue('lifestyle_history', 'p1', { patientId: 'p1', lifestyle: emptyLifestyleHistory() });
    await flush();
    expect(await pendingCount()).toBe(0);
    expect(refusals.map(r => r.entityType)).toEqual(['lifestyle_history']);
  });

  it('keeps retrying an ordinary failure (network) with back-off', async () => {
    updateError = { code: '', message: 'Failed to fetch' };
    await enqueue('supplements', 'p1', { patientId: 'p1', history: EMPTY_SUPPLEMENT_HISTORY });
    await flush();
    const [entry] = await store.all();
    expect(entry.retry_count).toBe(1);
    expect(entry.next_retry_at).toBeGreaterThan(Date.now());
    expect(refusals).toHaveLength(0);
  });

  it('drains a successful save', async () => {
    await enqueue('lifestyle_history', 'p1', { patientId: 'p1', lifestyle: emptyLifestyleHistory() });
    await flush();
    expect(await pendingCount()).toBe(0);
    expect(updates).toHaveLength(1);
    expect(refusals).toHaveLength(0);
  });

  it('honours an OutboxRefusalError from any executor', async () => {
    registerExecutor('__test_refused', async () => { throw new OutboxRefusalError('permission denied'); });
    await enqueue('__test_refused', 'x', {});
    await flush();
    expect(await pendingCount()).toBe(0);
    expect(refusals).toHaveLength(1);
  });
});

describe('notice and read-only cards', () => {
  it('the notice is one line and names no patient data', () => {
    expect(describeRefusal({ entityType: 'supplements' })).toBe(
      'Not saved: herbs, teas & supplements history — recorded by nurse or doctor (your role cannot change it).');
    expect(describeRefusal({ entityType: 'lifestyle_history' })).toContain('fasting, therapies & sleep history');
  });

  it('front desk cannot record pathway data; nurse, doctor and admin can', () => {
    expect(canRecordPathwayData('front_desk')).toBe(false);
    expect(canRecordPathwayData(null)).toBe(false);
    expect(canRecordPathwayData(undefined)).toBe(false);
    for (const r of ['nurse', 'doctor', 'admin'] as const) expect(canRecordPathwayData(r)).toBe(true);
    expect(PATHWAY_DATA_READ_ONLY_NOTE).toBe('Recorded by nurse or doctor');
  });

  it('both cards take the role from AuthContext and go read-only with the note', () => {
    for (const file of ['SupplementHistoryCard.tsx', 'LifestyleHistoryCard.tsx']) {
      const src = readFileSync(fileURLToPath(new URL(`../../components/${file}`, import.meta.url)), 'utf8');
      expect(src).toContain('useAuth()');
      expect(src).toContain('canRecordPathwayData(profile?.role)');
      expect(src).toContain('{PATHWAY_DATA_READ_ONLY_NOTE}');
    }
  });

  it('trackedSave never queues a permanent refusal and reports it', () => {
    const src = readFileSync(fileURLToPath(new URL('../../context/AppContext.tsx', import.meta.url)), 'utf8');
    expect(src).toMatch(/isPermanentRefusal\(descriptor\.entityType, err\)[\s\S]{0,300}reportRefusal\(descriptor\.entityType/);
  });
});
