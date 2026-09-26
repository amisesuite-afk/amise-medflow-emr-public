/**
 * content:publish (content-publish.ts): refuses without a sign-off reference, for a file the channel
 * is not enabled for, and while the registry records no clinical review; with a reviewed registry
 * entry it prints an INSERT whose hash the clients accept. It never writes the registry.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { canonicalJson, sha256Hex } from '../../lib/triage-engine/src/approved-content';
import { REPO_ROOT } from './clinval/load';
import { checkPublishable, positionalArg, releaseInsertSql } from './content-publish';

const tmp = mkdtempSync(join(tmpdir(), 'content-publish-'));
cpSync(join(REPO_ROOT, 'clinical-content'), join(tmp, 'clinical-content'), { recursive: true });
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function markReviewed(id: string): void {
  const file = join(tmp, 'clinical-content/registry.json');
  const reg = JSON.parse(readFileSync(file, 'utf8'));
  const entry = reg.ruleSets.find((e: { id: string }) => e.id === id);
  entry.lastReviewed = '2026-09-26';
  entry.reviewer = 'Dr Test Reviewer (doctor)';
  writeFileSync(file, JSON.stringify(reg, null, 2));
}

describe('content:publish checks', () => {
  it('refuses without --signoff-ref', () => {
    const c = checkPublishable('diagnostic-reasoning-zebras', undefined);
    expect(c.release).toBeNull();
    expect(c.problems.join('\n')).toMatch(/--signoff-ref is required/);
  });

  it('refuses a file the channel is not enabled for', () => {
    const c = checkPublishable('exam-signs', 'evidence-exam#1 approved');
    expect(c.problems.join('\n')).toMatch(/not enabled/);
  });

  it('refuses while the registry records no clinical review (today: every rule set)', () => {
    const c = checkPublishable('diagnostic-reasoning-zebras', 'diagnostic-reasoning#9 approved 2026-09-26');
    expect(c.release).toBeNull();
    expect(c.problems.join('\n')).toMatch(/records no clinical review/);
  });

  it('refuses an unknown or malformed content id', () => {
    expect(checkPublishable('../etc', 'ref-123').problems.join('\n')).toMatch(/not a content id/);
    expect(checkPublishable('no-such-file', 'ref-123').problems.join('\n')).toMatch(/not enabled|cannot read/);
  });

  it('with a reviewed registry entry: prints an INSERT with the canonical hash', () => {
    markReviewed('diagnostic-reasoning-zebras');
    const c = checkPublishable('diagnostic-reasoning-zebras', "diagnostic-reasoning#9–#12 approved (Dr O'Test)", tmp, new Date('2026-09-26'));
    expect(c.problems).toEqual([]);
    const body = JSON.parse(readFileSync(join(tmp, 'clinical-content/rules/zebra-rules.json'), 'utf8'));
    expect(c.release?.sha256).toBe(sha256Hex(canonicalJson(body)));
    const sql = releaseInsertSql(c.release!, { publisherEmail: 'surgeon@example.test' });
    expect(sql).toContain("insert into public.clinical_content_releases");
    expect(sql).toContain("'diagnostic-reasoning#9–#12 approved (Dr O''Test)'");
    expect(sql).toContain("up.role in ('doctor', 'admin')");
    expect(sql).toMatch(/\$body\$\{.*\}\$body\$::jsonb/s);
    expect(() => releaseInsertSql(c.release!, {})).toThrow(/publisher/);
    expect(() => releaseInsertSql(c.release!, { publishedBy: 'not-a-uuid' })).toThrow(/uuid/);
  });

  it('refuses when the registry contentVersion differs from the file', () => {
    const file = join(tmp, 'clinical-content/registry.json');
    const reg = JSON.parse(readFileSync(file, 'utf8'));
    reg.ruleSets.find((e: { id: string }) => e.id === 'diagnostic-reasoning-zebras').contentVersion = '0.0.1';
    writeFileSync(file, JSON.stringify(reg, null, 2));
    expect(checkPublishable('diagnostic-reasoning-zebras', 'ref-123', tmp).problems.join('\n')).toMatch(/contentVersion/);
  });

  it('reads the content id after pnpm\'s "--" and option values', () => {
    expect(positionalArg(['--', 'zebra-rules', '--signoff-ref', 'x'])).toBe('zebra-rules');
    expect(positionalArg(['--signoff-ref', 'x y', 'supplement-catalogue', '--confirm'])).toBe('supplement-catalogue');
    expect(positionalArg(['--confirm'])).toBeUndefined();
  });

  it('never writes the repository registry', () => {
    const reg = JSON.parse(readFileSync(join(REPO_ROOT, 'clinical-content/registry.json'), 'utf8'));
    expect(reg.ruleSets.every((e: { lastReviewed?: string }) => e.lastReviewed === 'unknown' || /^\d{4}-/.test(e.lastReviewed ?? ''))).toBe(true);
  });
});
