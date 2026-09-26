/**
 * Review-governance checks for the health-information library
 * (content/health-info.ts). Pure functions, shared by:
 *   - scripts/src/lint-guideline-registry.ts (CI: lint:guideline-registry)
 *   - artifacts/front-desk/test/health-info.test.ts (CI: front-desk vitest)
 *
 * FAILS: duplicate id/slug; malformed slug, version or date; missing title,
 *   summary, sections or urgent-care signs; urgent-care text without 911 and
 *   the three emergency departments; an APPROVED article without lastReviewed,
 *   reviewedBy, reviewDue (after lastReviewed) or at least one source, or with
 *   a version below 1.0.0; a draft carrying review fields (a draft is by
 *   definition not reviewed).
 * WARNS: an approved article past its reviewDue (today in America/St_Lucia),
 *   or due within 30 days.
 */

import { EMERGENCY_DEPARTMENTS, type HealthArticle } from './health-info';

export interface GovernanceReport {
  failures: string[];
  warnings: string[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Today's date (YYYY-MM-DD) in Saint Lucia. */
export function todayInStLucia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/St_Lucia', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

export function auditHealthLibrary(articles: readonly HealthArticle[], today: string): GovernanceReport {
  const failures: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();
  const slugs = new Set<string>();

  for (const a of articles) {
    const at = `health-info "${a.id}"`;
    const fail = (m: string) => failures.push(`${at}: ${m}`);

    if (!SLUG.test(a.id)) fail('id must be kebab-case');
    if (ids.has(a.id)) fail('duplicate id');
    ids.add(a.id);
    if (!SLUG.test(a.slug)) fail(`slug "${a.slug}" must be lower-case kebab-case`);
    if (slugs.has(a.slug)) fail(`duplicate slug "${a.slug}"`);
    slugs.add(a.slug);

    if (!nonEmpty(a.title)) fail('title is empty');
    if (!nonEmpty(a.summary)) fail('summary is empty');
    if (!a.sections.length) fail('has no sections');
    for (const s of a.sections) {
      if (!nonEmpty(s.heading)) fail('a section has no heading');
      if (!(s.paragraphs?.length || s.bullets?.length)) fail(`section "${s.heading}" has no text`);
    }

    const urgent = a.whenToSeekUrgentCare;
    if (!urgent.intro.includes('911') || !urgent.intro.includes(EMERGENCY_DEPARTMENTS)) {
      fail(`whenToSeekUrgentCare must name 911 and "${EMERGENCY_DEPARTMENTS}" (use SEEK_URGENT_CARE)`);
    }
    if (/victoria hospital/i.test([urgent.intro, ...urgent.signs].join(' '))) {
      fail('names Victoria Hospital, which no longer exists');
    }
    if (!urgent.signs.length) fail('whenToSeekUrgentCare has no signs');

    for (const src of a.sources) {
      if (!nonEmpty(src.name)) fail('a source has no name');
      if (!/^\d{4}$/.test(src.year)) fail(`source "${src.name}" needs a four-digit year`);
      if (src.url !== undefined && !/^https:\/\//.test(src.url)) fail(`source "${src.name}" url must be https`);
    }

    const semver = SEMVER.exec(a.version);
    if (!semver) fail(`version "${a.version}" must be x.y.z`);
    for (const k of ['lastReviewed', 'reviewDue'] as const) {
      if (a[k] !== null && !isValidDate(a[k])) fail(`${k} must be YYYY-MM-DD or null`);
    }

    if (a.status === 'approved') {
      if (!isValidDate(a.lastReviewed)) fail('approved but lastReviewed is missing');
      if (!nonEmpty(a.reviewedBy)) fail('approved but reviewedBy is missing');
      if (!isValidDate(a.reviewDue)) fail('approved but reviewDue is missing');
      if (!a.sources.length) fail('approved but has no sources');
      if (semver && Number(semver[1]) < 1) fail(`approved but version ${a.version} is below 1.0.0`);
      if (isValidDate(a.lastReviewed)) {
        if (a.lastReviewed > today) fail(`lastReviewed ${a.lastReviewed} is in the future`);
        if (isValidDate(a.reviewDue) && a.reviewDue <= a.lastReviewed) fail('reviewDue must be after lastReviewed');
      }
      if (isValidDate(a.reviewDue)) {
        if (a.reviewDue < today) {
          warnings.push(`${at}: review overdue since ${a.reviewDue} (last reviewed ${a.lastReviewed} by ${a.reviewedBy}) — re-review, or set it back to draft`);
        } else if (a.reviewDue <= addDays(today, 30)) {
          warnings.push(`${at}: review due on ${a.reviewDue}`);
        }
      }
    } else if (a.status === 'draft') {
      if (a.lastReviewed !== null || a.reviewedBy !== null) {
        fail('a draft must have lastReviewed and reviewedBy null (set them only when the article is approved)');
      }
    } else {
      fail(`status must be 'draft' or 'approved'`);
    }
  }

  return { failures, warnings };
}
