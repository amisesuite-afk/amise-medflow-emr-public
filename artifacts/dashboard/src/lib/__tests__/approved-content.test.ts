/**
 * Approved-content channel on the dashboard (lib/approved-content.ts + approved-content-store.ts;
 * docs/APPROVED-CONTENT-CHANNEL.md): the table being absent, a read error or a release that fails
 * a check leaves the bundled content in force with no throw; a verified release replaces the zebra
 * rules and the supplement items at call time; the patient wording can never change this way;
 * nothing is written to browser storage.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canonicalJson, sha256Hex, type ContentRelease } from '@workspace/triage-engine/approved-content';
import { ZEBRA_RULES, ZEBRA_RULES_VERSION } from '@workspace/triage-engine/diagnostic-reasoning';

type Resp = { data?: unknown; error: { code?: string; message?: string } | null };
let next: Resp = { data: [], error: null };
const calls: { table: string; filter?: unknown }[] = [];

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain = {
        select() { return chain; },
        in(_c: string, v: unknown) { calls.push({ table, filter: v }); return chain; },
        order() { return chain; },
        limit() { return chain; },
        then<T>(ok: (r: Resp) => T, err?: (e: unknown) => T) { return Promise.resolve(next).then(ok, err); },
      };
      return chain;
    },
  },
}));

import { _resetApprovedContentLoader, loadApprovedContent, SHARED_RULE_FILES } from '@/lib/approved-content';
import { _resetApprovedContent, approvedContentRevision } from '@/lib/approved-content-store';
import { activeZebraRules, activeZebraRulesVersion } from '@/lib/diagnostic-reasoning';
import {
  HERBAL_PREOP_PATIENT_TEXT, SUPPLEMENT_ITEMS, activeSupplementItems, normaliseSupplementHistory, searchSupplements, supplementById,
} from '@/lib/supplement-catalogue';
import zebraFile from '../../../../../clinical-content/rules/zebra-rules.json';
import supplementFile from '../../../../../clinical-content/rules/supplement-catalogue.json';

function release(contentId: string, body: Record<string, unknown>, extra: Partial<ContentRelease> = {}): ContentRelease {
  return {
    id: `r-${contentId}-${String(body.version)}`, content_id: contentId, version: String(body.version),
    sha256: sha256Hex(canonicalJson(body)), body, published_at: '2026-09-26T12:00:00Z',
    signoff_ref: 'diagnostic-reasoning#9 approved 2026-09-26', revoked_at: null, ...extra,
  };
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// Browser storage stand-in (the test environment is Node): records every write.
const stored = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => stored.get(k) ?? null,
  setItem: (k: string, v: string) => { stored.set(k, v); },
  removeItem: (k: string) => { stored.delete(k); },
  clear: () => stored.clear(),
  key: (i: number) => [...stored.keys()][i] ?? null,
  get length() { return stored.size; },
});

beforeEach(() => {
  _resetApprovedContentLoader();
  _resetApprovedContent();
  calls.length = 0;
  next = { data: [], error: null };
  localStorage.clear();
});

describe('bundled content stays in force', () => {
  it.each(['42P01', 'PGRST205'])('table missing (%s): available:false, no error, bundled', async code => {
    next = { error: { code, message: 'relation "clinical_content_releases" does not exist' } };
    const r = await loadApprovedContent();
    expect(r.available).toBe(false);
    expect(r.error).toBeNull();
    expect(r.files.every(f => f.source === 'bundled')).toBe(true);
    expect(activeZebraRules()).toBe(ZEBRA_RULES);
    expect(activeSupplementItems()).toBe(SUPPLEMENT_ITEMS);
  });

  it('another read error: reported, bundled in force, no throw', async () => {
    next = { error: { code: '500', message: 'timeout' } };
    const r = await loadApprovedContent();
    expect(r).toMatchObject({ available: true, error: 'timeout' });
    expect(activeZebraRulesVersion()).toBe(ZEBRA_RULES_VERSION);
  });

  it('asks only for the channel-enabled content ids', async () => {
    await loadApprovedContent();
    expect(calls[0]).toEqual({ table: 'clinical_content_releases', filter: ['diagnostic-reasoning-zebras', 'supplement-catalogue'] });
  });

  it('loads once per session unless forced', async () => {
    await loadApprovedContent();
    await loadApprovedContent();
    expect(calls).toHaveLength(1);
    await loadApprovedContent(true);
    expect(calls).toHaveLength(2);
  });
});

describe('a verified release is used at call time', () => {
  it('zebra rules: the release rules and version replace the bundled ones', async () => {
    const body = clone(zebraFile) as Record<string, unknown> & { rules: unknown[] };
    body.version = '1.0.1';
    body.rules = body.rules.slice(0, 3);
    next = { data: [release('diagnostic-reasoning-zebras', body)], error: null };
    const before = approvedContentRevision();
    const r = await loadApprovedContent();
    expect(approvedContentRevision()).toBeGreaterThan(before);
    const z = r.files.find(f => f.contentId === 'diagnostic-reasoning-zebras')!;
    expect(z).toMatchObject({ source: 'release', version: '1.0.1', bundledVersion: ZEBRA_RULES_VERSION, file: 'zebra-rules' });
    expect(activeZebraRules()).toHaveLength(3);
    expect(activeZebraRulesVersion()).toBe('1.0.1');
  });

  it('supplement items: a removed item disappears from search, stored ids are still kept', async () => {
    const body = clone(supplementFile) as Record<string, unknown> & { items: { id: string }[] };
    body.version = '1.0.1';
    body.items = body.items.filter(i => i.id !== 'garlic');
    next = { data: [release('supplement-catalogue', body)], error: null };
    await loadApprovedContent();
    expect(activeSupplementItems()).toHaveLength(SUPPLEMENT_ITEMS.length - 1);
    expect(searchSupplements('garlic').map(i => i.id)).not.toContain('garlic');
    // A recorded entry's catalogue id is never dropped by a release.
    const h = normaliseSupplementHistory({ status: 'taking', entries: [{ id: 'e1', catalogueId: 'garlic', name: 'Garlic', details: '' }] });
    expect(h.entries[0].catalogueId).toBe('garlic');
    expect(supplementById('garlic')?.id).toBe('garlic');
  });

  it('the patient paragraph cannot change through the channel', async () => {
    const body = clone(supplementFile) as Record<string, unknown> & { text: Record<string, string> };
    body.version = '1.0.1';
    body.text.herbalPreOpPatientText = 'Different wording.';
    next = { data: [release('supplement-catalogue', body)], error: null };
    const r = await loadApprovedContent();
    const s = r.files.find(f => f.contentId === 'supplement-catalogue')!;
    expect(s.source).toBe('bundled');
    expect(s.rejected[0]).toMatchObject({ reason: 'pinned-field-changed', detail: '/text' });
    expect(HERBAL_PREOP_PATIENT_TEXT).toBe(supplementFile.text.herbalPreOpPatientText);
  });

  it('revoked, tampered or older releases are refused', async () => {
    const newer = clone(zebraFile) as Record<string, unknown>;
    newer.version = '1.0.2';
    const tampered = release('diagnostic-reasoning-zebras', { ...clone(zebraFile), version: '1.0.3' } as Record<string, unknown>);
    (tampered.body as Record<string, unknown>).rules = [];
    const older = clone(zebraFile) as Record<string, unknown>;
    older.version = '0.9.0';
    next = {
      data: [tampered, release('diagnostic-reasoning-zebras', newer, { revoked_at: '2026-09-27T00:00:00Z' }), release('diagnostic-reasoning-zebras', older)],
      error: null,
    };
    const r = await loadApprovedContent();
    const z = r.files.find(f => f.contentId === 'diagnostic-reasoning-zebras')!;
    expect(z.source).toBe('bundled');
    expect(z.rejected.map(x => x.reason)).toEqual(['hash-mismatch', 'revoked', 'not-newer']);
    expect(activeZebraRules()).toBe(ZEBRA_RULES);
  });
});

describe('storage and settings', () => {
  it('writes nothing to browser storage', async () => {
    const body = clone(zebraFile) as Record<string, unknown>;
    body.version = '1.0.1';
    next = { data: [release('diagnostic-reasoning-zebras', body)], error: null };
    await loadApprovedContent();
    expect(localStorage.length).toBe(0);
  });

  it('lists every shared rule file with its content id and bundled version', () => {
    expect(SHARED_RULE_FILES.map(f => f.file).sort()).toEqual(
      ['decision-rules', 'diagnostic-reasoning-rules', 'exam-signs', 'lifestyle-practices', 'supplement-catalogue', 'zebra-rules'],
    );
    expect(SHARED_RULE_FILES.find(f => f.file === 'zebra-rules')).toEqual({
      file: 'zebra-rules', contentId: 'diagnostic-reasoning-zebras', version: ZEBRA_RULES_VERSION,
    });
  });
});
