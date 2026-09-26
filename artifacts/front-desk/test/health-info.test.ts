/**
 * Health-information library governance (content/health-info.ts).
 *
 * Drafts must never reach the public site; an approved article must carry a
 * documented review (who, when, next due) and its sources. The same checks
 * run in CI through lint:guideline-registry; the text-safety rules (H-10,
 * no fees, no doses, no fasting from midnight) run in lint:patient-instructions.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EMERGENCY_DEPARTMENTS,
  GENERAL_INFORMATION_NOTICE,
  HEALTH_ARTICLES,
  SEEK_URGENT_CARE,
  formatReviewDate,
  getApprovedArticle,
  getApprovedArticles,
  hasApprovedArticles,
  type HealthArticle,
} from '@/content/health-info';
import { auditHealthLibrary, todayInStLucia } from '@/content/health-info-governance';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TODAY = '2026-09-25';

const draft = HEALTH_ARTICLES[0];
const approved = (over: Partial<HealthArticle> = {}): HealthArticle => ({
  ...draft,
  id: 'approved-example',
  slug: 'approved-example',
  status: 'approved',
  lastReviewed: '2026-09-01',
  reviewedBy: 'Dr Dawit Daniel Kabiye, MD, DM',
  reviewDue: '2027-09-01',
  version: '1.0.0',
  ...over,
});

describe('the library as shipped', () => {
  it('passes the governance checks', () => {
    expect(auditHealthLibrary(HEALTH_ARTICLES, todayInStLucia()).failures).toEqual([]);
  });

  it('has the thirteen drafted topics, each with urgent-care signs and at least one source', () => {
    expect(HEALTH_ARTICLES).toHaveLength(13);
    for (const a of HEALTH_ARTICLES) {
      expect(a.whenToSeekUrgentCare.intro, a.id).toBe(SEEK_URGENT_CARE);
      expect(a.whenToSeekUrgentCare.signs.length, a.id).toBeGreaterThan(0);
      expect(a.sources.length, a.id).toBeGreaterThan(0);
    }
  });

  it('names 911 and exactly the three current emergency departments', () => {
    expect(EMERGENCY_DEPARTMENTS).toBe("OKEU Hospital, St Jude's Hospital or Tapion Hospital");
    expect(SEEK_URGENT_CARE).toContain('911');
    expect(JSON.stringify(HEALTH_ARTICLES)).not.toMatch(/victoria/i);
  });

  it('carries the general-information notice', () => {
    expect(GENERAL_INFORMATION_NOTICE).toMatch(/general information, not medical advice/i);
    expect(GENERAL_INFORMATION_NOTICE).toMatch(/speak to your doctor/i);
  });
});

describe('drafts are never public', () => {
  it('getApprovedArticle never returns a draft', () => {
    for (const a of HEALTH_ARTICLES.filter(x => x.status === 'draft')) {
      expect(getApprovedArticle(a.slug)).toBeUndefined();
    }
    expect(getApprovedArticles().every(a => a.status === 'approved')).toBe(true);
    expect(hasApprovedArticles()).toBe(getApprovedArticles().length > 0);
  });

  it('returns an approved article by slug', () => {
    const list = [draft, approved()];
    expect(getApprovedArticle('approved-example', list)?.id).toBe('approved-example');
    expect(getApprovedArticles(list).map(a => a.id)).toEqual(['approved-example']);
  });

  it('the article route builds approved slugs only and 404s everything else', () => {
    const src = readFileSync(join(ROOT, 'app/health-information/[slug]/page.tsx'), 'utf8');
    expect(src).toContain('export const dynamicParams = false');
    expect(src).toMatch(/generateStaticParams[\s\S]*getApprovedArticles\(\)/);
    expect(src).toMatch(/getApprovedArticle\(params\.slug\)[\s\S]*notFound\(\)/);
  });

  it('no client component imports the content module (drafts would ship in client JS)', () => {
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const n of readdirSync(dir)) {
        const abs = join(dir, n);
        if (statSync(abs).isDirectory()) { if (n !== 'node_modules' && n !== '.next') walk(abs, out); }
        else if (/\.tsx?$/.test(n)) out.push(abs);
      }
      return out;
    };
    const offenders = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'components'))]
      .filter(f => {
        const s = readFileSync(f, 'utf8');
        return /^\s*['"]use client['"]/.test(s) && /content\/health-info/.test(s);
      })
      .map(f => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it('the staff preview verifies the staff session server-side', () => {
    const src = readFileSync(join(ROOT, 'app/staff/health-information/page.tsx'), 'utf8');
    expect(src).toContain('verifyStaffToken(');
    expect(src).toContain("redirect('/staff/login");
  });
});

describe('auditHealthLibrary', () => {
  const run = (a: HealthArticle, today = TODAY) => auditHealthLibrary([a], today);

  it('accepts a fully reviewed approved article', () => {
    expect(run(approved())).toEqual({ failures: [], warnings: [] });
  });

  it.each([
    ['lastReviewed', { lastReviewed: null }],
    ['reviewedBy', { reviewedBy: null }],
    ['reviewedBy', { reviewedBy: '  ' }],
    ['reviewDue', { reviewDue: null }],
    ['sources', { sources: [] }],
    ['version', { version: '0.2.0' }],
  ] as const)('fails an approved article without %s', (field, over) => {
    const { failures } = run(approved(over as Partial<HealthArticle>));
    expect(failures.join('\n')).toMatch(new RegExp(field === 'version' ? 'below 1.0.0' : field));
  });

  it('fails a reviewDue that is not after lastReviewed, and a future review date', () => {
    expect(run(approved({ reviewDue: '2026-09-01' })).failures.join()).toMatch(/after lastReviewed/);
    expect(run(approved({ lastReviewed: '2026-12-01', reviewDue: '2027-12-01' })).failures.join()).toMatch(/future/);
  });

  it('warns (does not fail) when an approved article is past reviewDue', () => {
    const r = run(approved({ lastReviewed: '2025-01-10', reviewDue: '2026-01-10' }));
    expect(r.failures).toEqual([]);
    expect(r.warnings.join()).toMatch(/overdue since 2026-01-10/);
  });

  it('warns when a review is due within 30 days', () => {
    expect(run(approved({ reviewDue: '2026-10-10' })).warnings.join()).toMatch(/due on 2026-10-10/);
  });

  it('fails a draft that carries review fields', () => {
    expect(run({ ...draft, lastReviewed: '2026-09-01', reviewedBy: 'Someone' }).failures.join()).toMatch(/draft must have/);
  });

  it('fails urgent-care text without 911 and the emergency departments, or naming Victoria Hospital', () => {
    const bad = approved({ whenToSeekUrgentCare: { intro: 'Go to Victoria Hospital.', signs: ['x'] } });
    const msg = run(bad).failures.join('\n');
    expect(msg).toMatch(/911/);
    expect(msg).toMatch(/Victoria Hospital/);
  });

  it('fails duplicate slugs', () => {
    expect(auditHealthLibrary([approved(), approved({ id: 'other' })], TODAY).failures.join()).toMatch(/duplicate slug/);
  });
});

describe('formatReviewDate', () => {
  it('formats without a time-zone shift', () => {
    expect(formatReviewDate('2026-01-01')).toBe('1 January 2026');
    expect(formatReviewDate(null)).toBe('—');
  });
});
