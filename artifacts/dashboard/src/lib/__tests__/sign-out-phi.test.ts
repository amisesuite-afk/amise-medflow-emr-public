/**
 * Compliance G-5 / hazards H-13, H-16: patient data must not stay in the
 * browser after sign-out, but unsynced clinical edits must never be destroyed
 * silently. Covers phi-storage.ts and secure-sign-out.ts with an in-memory
 * Storage and a fake outbox.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearPhiWebStorage, listPhiKeys, countLocalOnlyItems, bindPhiStorageToUser, PHI_OWNER_KEY,
} from '@/lib/phi-storage';
import {
  prepareSignOut, clearPhiAfterSignOut, describeUnsynced, unsyncedQuestion, registerBeforeSignOut,
  runSecureSignOut, type SignOutDeps,
} from '@/lib/secure-sign-out';

class MemoryStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  keys() { return [...this.m.keys()].sort(); }
}

const PHI_ENCOUNTER = JSON.stringify({ patientName: 'Kervin St Rose', dob: '1961-04-17', assessment: 'Rectal bleeding' });

function seeded(): MemoryStorage {
  const s = new MemoryStorage();
  // PHI caches
  s.setItem('amise-enc-v1', PHI_ENCOUNTER);
  s.setItem('amise-attachments-v1', '[{"name":"ct.pdf","data":"base64"}]');
  s.setItem('amise-patient-photo-v1', 'data:image/jpeg;base64,AAAA');
  s.setItem('amise-exam-photos-v1', '[]');
  s.setItem('amise-patients-v1', '[{"id":"p1","full_name":"Kervin St Rose","phone":"+17585550199"}]');
  s.setItem('amise-hidden-patients-v1', '["p9"]');
  // LOCAL-ONLY PHI
  s.setItem('amise_followup_v1', JSON.stringify([
    { id: 'f1', label: 'Repeat CEA', done: false, patientName: 'Kervin St Rose' },
    { id: 'f2', label: 'Colonoscopy', done: true, patientName: 'Other' },
  ]));
  s.setItem('outbound_referrals_local_none', JSON.stringify([{ id: 'local-1', to: 'Oncology' }]));
  // Non-PHI preferences and the Supabase-managed session key
  s.setItem('amise_current_site', 'tapion');
  s.setItem('amise-top-section', 'consultation');
  s.setItem('amise-notification-prefs', '{"sound":true}');
  s.setItem('amise-ai-provider', '{"type":"cloud"}');
  s.setItem('amise-idle-last-activity', '1700000000000');
  s.setItem(PHI_OWNER_KEY, 'user-a');
  return s;
}

const PREFS = ['amise-ai-provider', 'amise-idle-last-activity', 'amise-notification-prefs', 'amise-top-section', 'amise_current_site'];

function fakeOutbox(initial: number, { drainsOnFlush = false, failCount = false } = {}) {
  let pending = initial;
  const calls = { flush: 0, clear: 0 };
  const deps: SignOutDeps & { calls: typeof calls } = {
    calls,
    flushOutbox: async () => { calls.flush++; if (drainsOnFlush) pending = 0; },
    pendingOutbox: async () => { if (failCount) throw new Error('idb broken'); return pending; },
    pendingOutboxTypes: async () => Array(pending).fill('assessment'),
    whenEnqueuesSettled: async () => {},
    clearOutbox: async () => { calls.clear++; pending = 0; },
  };
  return deps;
}

describe('phi-storage inventory and clearing', () => {
  it('clears every PHI key and keeps non-PHI preferences', () => {
    const s = seeded();
    const removed = clearPhiWebStorage(s);
    expect(removed.sort()).toEqual([
      'amise-attachments-v1', 'amise-enc-v1', 'amise-exam-photos-v1', 'amise-hidden-patients-v1',
      'amise-patient-photo-v1', 'amise-patients-v1', 'amise_followup_v1', 'outbound_referrals_local_none',
    ]);
    expect(s.keys()).toEqual(PREFS);
    expect(listPhiKeys(s)).toEqual([]);
  });

  it('counts LOCAL-ONLY items (open follow-ups, referral drafts)', () => {
    expect(countLocalOnlyItems(seeded())).toEqual({ followUps: 1, referralDrafts: 1 });
    expect(countLocalOnlyItems(new MemoryStorage())).toEqual({ followUps: 0, referralDrafts: 0 });
    expect(countLocalOnlyItems(null)).toEqual({ followUps: 0, referralDrafts: 0 });
  });

  it('a different user signing in never sees the previous user\'s encounter', () => {
    const s = seeded();
    const cleared = bindPhiStorageToUser('user-b', s);
    expect(cleared).toContain('amise-enc-v1');
    expect(s.getItem('amise-enc-v1')).toBeNull();
    expect(s.getItem('amise-patient-photo-v1')).toBeNull();
    // LOCAL-ONLY items are not destroyed silently.
    expect(s.getItem('amise_followup_v1')).not.toBeNull();
    expect(s.getItem('outbound_referrals_local_none')).not.toBeNull();
    expect(s.getItem(PHI_OWNER_KEY)).toBe('user-b');
  });

  it('the same user keeps the restore cache; an unowned (pre-upgrade) cache is adopted', () => {
    const s = seeded();
    expect(bindPhiStorageToUser('user-a', s)).toEqual([]);
    expect(s.getItem('amise-enc-v1')).toBe(PHI_ENCOUNTER);
    s.removeItem(PHI_OWNER_KEY);
    expect(bindPhiStorageToUser('user-c', s)).toEqual([]);
    expect(s.getItem(PHI_OWNER_KEY)).toBe('user-c');
  });
});

describe('secure sign-out', () => {
  let s: MemoryStorage;
  beforeEach(() => { s = seeded(); s.removeItem('amise_followup_v1'); s.removeItem('outbound_referrals_local_none'); });

  it('nothing unsynced → summary total 0, then PHI and outbox are cleared', async () => {
    const deps = { ...fakeOutbox(0), storage: s };
    const summary = await prepareSignOut(deps);
    expect(summary.total).toBe(0);
    expect(deps.calls.flush).toBe(1);
    const res = await clearPhiAfterSignOut(deps);
    expect(res.outboxCleared).toBe(true);
    expect(deps.calls.clear).toBe(1);
    expect(s.getItem('amise-enc-v1')).toBeNull();
    expect(s.keys()).toEqual(PREFS);
  });

  it('flushes the outbox first: entries that sync are not counted', async () => {
    const deps = { ...fakeOutbox(3, { drainsOnFlush: true }), storage: s };
    expect((await prepareSignOut(deps)).total).toBe(0);
  });

  it('pending entries that cannot sync are reported, never cleared by prepare', async () => {
    const deps = { ...fakeOutbox(3), storage: s };
    const summary = await prepareSignOut(deps);
    expect(summary).toMatchObject({ outbox: 3, followUps: 0, referralDrafts: 0, total: 3, outboxTypes: ['assessment'] });
    expect(deps.calls.clear).toBe(0);
    expect(s.getItem('amise-enc-v1')).toBe(PHI_ENCOUNTER);
    expect(unsyncedQuestion(summary)).toBe('3 unsaved changes will be lost — stay signed in to sync?');
  });

  it('local-only follow-ups and referral drafts count as unsynced', async () => {
    const deps = { ...fakeOutbox(1), storage: seeded() };
    const summary = await prepareSignOut(deps);
    expect(summary.total).toBe(3);
    expect(describeUnsynced(summary)).toBe(
      '1 unsaved change, 1 follow-up reminder stored only in this browser and 1 referral draft stored only in this browser',
    );
  });

  it('fails safe when the outbox cannot be counted', async () => {
    const deps = { ...fakeOutbox(0, { failCount: true }), storage: s };
    const summary = await prepareSignOut(deps);
    // A throwing count is treated as "something may be unsynced", never as 0.
    expect(summary.outbox).toBe(1);
    expect(summary.total).toBe(1);
  });

  it('runs before-sign-out hooks (debounced autosave flush) before counting', async () => {
    const deps = { ...fakeOutbox(0), storage: s };
    const order: string[] = [];
    const unregister = registerBeforeSignOut(async () => { order.push('hook'); });
    const origFlush = deps.flushOutbox;
    deps.flushOutbox = async () => { order.push('flush'); await origFlush(); };
    await prepareSignOut(deps);
    unregister();
    expect(order).toEqual(['hook', 'flush']);
  });

  it('a hanging backend cannot hang sign-out', async () => {
    const deps = { ...fakeOutbox(2), storage: s, flushOutbox: () => new Promise<void>(() => {}) };
    const summary = await prepareSignOut(deps, { flushTimeoutMs: 20, hookTimeoutMs: 20 });
    expect(summary.outbox).toBe(2);
  });
});

describe('runSecureSignOut decision', () => {
  function harness(pending: number) {
    const s = seeded();
    s.removeItem('amise_followup_v1');
    s.removeItem('outbound_referrals_local_none');
    const deps = { ...fakeOutbox(pending), storage: s };
    const events: string[] = [];
    return {
      s, deps, events,
      endSession: async () => { events.push(`end:${s.getItem('amise-enc-v1') ? 'phi-present' : 'phi-gone'}`); },
    };
  }

  it('clean: ends the session, then clears PHI and the outbox (no prompt)', async () => {
    const h = harness(0);
    let asked = false;
    const out = await runSecureSignOut({
      reason: 'manual', deps: h.deps, endSession: h.endSession,
      confirmDiscard: async () => { asked = true; return true; },
    });
    expect(out).toEqual({ status: 'signed_out' });
    expect(asked).toBe(false);
    expect(h.events).toEqual(['end:phi-present']); // session ended before clearing
    expect(h.s.getItem('amise-enc-v1')).toBeNull();
    expect(h.deps.calls.clear).toBe(1);
  });

  it('manual with pending changes + "Stay signed in": nothing is signed out or cleared', async () => {
    const h = harness(2);
    let question = '';
    const out = await runSecureSignOut({
      reason: 'manual', deps: h.deps, endSession: h.endSession,
      confirmDiscard: async summary => { question = unsyncedQuestion(summary); return false; },
    });
    expect(out).toEqual({ status: 'cancelled' });
    expect(question).toBe('2 unsaved changes will be lost — stay signed in to sync?');
    expect(h.events).toEqual([]);
    expect(h.deps.calls.clear).toBe(0);
    expect(h.s.getItem('amise-enc-v1')).toBe(PHI_ENCOUNTER);
  });

  it('manual with pending changes + explicit discard: signs out and clears', async () => {
    const h = harness(2);
    const out = await runSecureSignOut({
      reason: 'manual', deps: h.deps, endSession: h.endSession, confirmDiscard: async () => true,
    });
    expect(out).toEqual({ status: 'signed_out' });
    expect(h.deps.calls.clear).toBe(1);
    expect(h.s.getItem('amise-enc-v1')).toBeNull();
  });

  it('idle with pending changes: blocked, with no prompt, no sign-out and nothing cleared', async () => {
    const h = harness(1);
    let asked = false;
    const out = await runSecureSignOut({
      reason: 'idle', deps: h.deps, endSession: h.endSession,
      confirmDiscard: async () => { asked = true; return true; },
    });
    expect(out.status).toBe('blocked');
    expect(asked).toBe(false);
    expect(h.events).toEqual([]);
    expect(h.deps.calls.clear).toBe(0);
  });

  it('idle with nothing pending: signs out and clears', async () => {
    const h = harness(0);
    const out = await runSecureSignOut({
      reason: 'idle', deps: h.deps, endSession: h.endSession, confirmDiscard: async () => false,
    });
    expect(out).toEqual({ status: 'signed_out' });
    expect(h.s.keys()).toEqual(PREFS);
  });
});
