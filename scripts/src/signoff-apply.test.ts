import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyBundle, groupStates, insertIntoSectionI, setRuleSetFields } from './signoff/apply';
import {
  DECISIONS_DOC, REGISTRY_PATH, buildCatalogue, parseSurgeonDecisions, readCatalogueInputs,
} from './signoff/catalogue';
import { buildBundle, bundleMarkdown } from '../../artifacts/dashboard/src/lib/clinical-signoff/status';
import type { SignoffDecision, SignoffRecord } from '../../artifacts/dashboard/src/lib/clinical-signoff/types';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const inputs = readCatalogueInputs(REPO_ROOT);
const catalogue = buildCatalogue(inputs);
const registryText = readFileSync(join(REPO_ROOT, REGISTRY_PATH), 'utf8');
const decisionsText = readFileSync(join(REPO_ROOT, DECISIONS_DOC), 'utf8');

const RS = 'treatment-decision-support';
const rsItems = catalogue.ruleSets.find(r => r.id === RS)!.itemIds;
const item = (id: string) => catalogue.items.find(i => i.id === id)!;

let n = 0;
function rec(itemId: string, decision: SignoffDecision = 'approved', extra: Partial<SignoffRecord> = {}): SignoffRecord {
  n++;
  return {
    id: `row-${n}`,
    itemId,
    itemHash: item(itemId).hash,
    catalogueHash: catalogue.catalogueHash,
    decision,
    amendment: decision === 'approved_with_amendment' ? 'Use the practice laboratory ranges' : null,
    comment: null,
    reviewerUserId: '00000000-0000-4000-8000-000000000003',
    reviewerName: 'Dr Dawit Daniel Kabiye',
    reviewerRole: 'doctor',
    ruleSetIds: item(itemId).ruleSetIds,
    decidedAt: new Date(Date.UTC(2026, 9, 1, 14, 0, n)).toISOString(),
    ...extra,
  };
}

function run(records: SignoffRecord[], only?: string[]) {
  const bundle = buildBundle(catalogue, records, { userId: 'u', name: 'Dr Dawit Daniel Kabiye', role: 'doctor' }, new Date('2026-10-02T12:00:00Z'));
  const bundleText = JSON.stringify(bundle);
  return applyBundle({ bundle, bundleText, catalogue, registryText, decisionsText, only, now: new Date('2026-10-02T12:00:00Z') });
}

describe('signoff:apply refuses partial approvals', () => {
  it('refuses a named rule set with a pending item', () => {
    const r = run(rsItems.slice(1).map(id => rec(id)), [RS]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusals.join('\n')).toMatch(new RegExp(`${RS}: not fully approved — 1 of ${rsItems.length} items open: ${rsItems[0].replace('#', '#')} pending`));
  });

  it('refuses rejected, deferred and changed-since-approval items', () => {
    const base = rsItems.map(id => rec(id));
    for (const bad of [
      rec(rsItems[2], 'rejected'),
      rec(rsItems[2], 'deferred'),
      rec(rsItems[2], 'approved', { itemHash: '0000000000000000' }),
    ]) {
      const r = run([...base, bad], [RS]);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.refusals[0]).toMatch(/rejected|deferred|changed since decision/);
    }
  });

  it('uses the latest decision: a later approval supersedes an earlier rejection', () => {
    const records = [rec(rsItems[0], 'rejected'), ...rsItems.map(id => rec(id))];
    expect(run(records, [RS]).ok).toBe(true);
  });

  it('without --rule-set, applies only complete rule sets and reports the others; nothing complete → refused', () => {
    const r = run([...rsItems.map(id => rec(id)), rec('fix-web-triage#1')]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.applied.map(a => a.id)).toEqual([RS]);
      expect(r.notApplied.map(x => x.id)).toContain('triage-rules-red-flags');
    }
    const none = run([rec('fix-web-triage#1')]);
    expect(none.ok).toBe(false);
  });

  it('refuses a malformed bundle and one that was already applied', () => {
    const bad = applyBundle({
      bundle: { format: 'x' } as never, bundleText: '{}', catalogue, registryText, decisionsText,
    });
    expect(bad.ok).toBe(false);
    const records = rsItems.map(id => rec(id));
    const bundle = buildBundle(catalogue, records, null, new Date('2026-10-02T12:00:00Z'));
    const bundleText = JSON.stringify(bundle);
    const first = applyBundle({ bundle, bundleText, catalogue, registryText, decisionsText, only: [RS] });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const again = applyBundle({ bundle, bundleText, catalogue, registryText, decisionsText: first.decisionsText, only: [RS] });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.refusals[0]).toMatch(/already recorded/);
  });
});

describe('signoff:apply writes the registry fields', () => {
  // The next free section-I number in the live decisions file (I1, I2, … already taken).
  const nextI = Math.max(0, ...[...decisionsText.matchAll(/^### I(\d+)\./gm)].map(m => Number(m[1]))) + 1;
  const records = [...rsItems.map(id => rec(id)), rec(rsItems[6], 'approved_with_amendment', {
    reviewerName: 'Dr A Colleague', reviewerRole: 'admin', decidedAt: '2026-10-03T02:30:00Z',
  })];
  const r = run(records, [RS]);

  it('sets lastReviewed (St Lucia date of the last decision), reviewer, reviewEvidence and nextReviewDue only', () => {
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const before = JSON.parse(registryText);
    const after = JSON.parse(r.registryText);
    const e = after.ruleSets.find((x: { id: string }) => x.id === RS);
    // 02:30 UTC on 3 Oct is 22:30 on 2 Oct in St Lucia.
    expect(e.lastReviewed).toBe('2026-10-02');
    expect(e.nextReviewDue).toBe('2027-10-02');
    expect(e.reviewer).toBe('Dr Dawit Daniel Kabiye (doctor); Dr A Colleague (admin)');
    expect(e.reviewEvidence).toMatch(new RegExp(`all ${rsItems.length} linked sign-off items approved \\(1 with an amendment\\), from bayes-treatment`));
    expect(e.reviewEvidence).toMatch(new RegExp(`bundle sha256:[0-9a-f]{16}; recorded in docs/clinical-validation/SURGEON-DECISIONS\\.md I${nextI}\\.`));
    // Nothing else changed: same object once the four fields and "updated" are put back.
    const b = before.ruleSets.find((x: { id: string }) => x.id === RS);
    for (const k of ['lastReviewed', 'reviewer', 'reviewEvidence', 'nextReviewDue']) e[k] = b[k];
    after.updated = before.updated;
    expect(after).toEqual(before);
    // Layout kept: only the edited lines differ.
    const changed = r.registryText.split('\n').filter((l, i) => l !== registryText.split('\n')[i]);
    expect(changed.length).toBeLessThanOrEqual(5);
  });

  it('appends a dated, marked section-I record that the catalogue parser skips', () => {
    if (!r.ok) throw new Error('refused');
    expect(r.decisionsText.startsWith(decisionsText.trimEnd())).toBe(true);
    expect(r.section).toMatch(new RegExp(`^### I${nextI}\\. Clinical sign-off: treatment-decision-support — APPROVED 2026-10-02$`, 'm'));
    expect(r.section).toContain('<!-- signoff:applied -->');
    expect(r.section).toContain(`\`${rsItems[6]}\``);
    expect(r.section).toContain('Amendment: Use the practice laboratory ranges');
    const beforeItems = parseSurgeonDecisions(decisionsText).map(i => `${i.number}:${i.text}`);
    const afterItems = parseSurgeonDecisions(r.decisionsText).map(i => `${i.number}:${i.text}`);
    expect(afterItems).toEqual(beforeItems);
  });
});

describe('helpers', () => {
  it('setRuleSetFields refuses an unknown rule set or field', () => {
    expect(() => setRuleSetFields(registryText, 'no-such-set', { lastReviewed: 'x' })).toThrow(/not found/);
    expect(() => setRuleSetFields(registryText, RS, { noSuchField: 'x' })).toThrow(/no "noSuchField"/);
  });

  it('insertIntoSectionI puts the block before a following section', () => {
    const t = '# D\n\n## I. Made\n\n### I1. x\n\n## Z. Later\n';
    expect(insertIntoSectionI(t, '\n### I2. y')).toBe('# D\n\n## I. Made\n\n### I1. x\n\n### I2. y\n\n## Z. Later\n');
  });

  it('groups items not linked to a rule set by change log', () => {
    const states = groupStates(catalogue, []);
    expect(states.find(s => s.id === 'source:outcomes-calibration')?.itemIds.length).toBeGreaterThan(0);
    expect(states.every(s => !s.complete)).toBe(true);
  });

  it('bundleMarkdown lists progress and decisions', () => {
    const md = bundleMarkdown(buildBundle(catalogue, [rec(rsItems[0])], null), catalogue);
    expect(md).toContain(`| ${RS} | 1/${rsItems.length} |`);
    expect(md).toContain(`**${rsItems[0]}** — Approved`);
  });
});
