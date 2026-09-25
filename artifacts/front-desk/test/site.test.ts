/**
 * One canonical origin for the website (lib/site.ts, docs/DOMAINS.md).
 *
 * The site is served on amisemedical.com, amisesuite.com (apex and www) and
 * the vercel.app address. Every public page must declare its own
 * `alternates.canonical`, and nothing in app/ may hard-code a site origin.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SITE_URL, absoluteUrl, parseSiteUrl, siteUrl } from '@/lib/site';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

afterEach(() => { vi.unstubAllEnvs(); });

describe('parseSiteUrl', () => {
  it('returns the origin without a trailing slash', () => {
    expect(parseSiteUrl('https://amisesuite.com/')).toBe('https://amisesuite.com');
    expect(parseSiteUrl('https://www.amisemedical.com/some/path')).toBe('https://www.amisemedical.com');
  });
  it('takes the first entry of a comma-separated list', () => {
    expect(parseSiteUrl('https://amisemedical.com, https://amisesuite.com')).toBe('https://amisemedical.com');
  });
  it('rejects empty, relative and non-http values', () => {
    for (const v of [undefined, '', '   ', 'amisemedical.com', 'ftp://amisemedical.com']) {
      expect(parseSiteUrl(v)).toBeNull();
    }
  });
});

describe('siteUrl / absoluteUrl', () => {
  it('defaults to amisemedical.com', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(siteUrl()).toBe(DEFAULT_SITE_URL);
    expect(DEFAULT_SITE_URL).toBe('https://amisemedical.com');
  });
  it('follows NEXT_PUBLIC_SITE_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://amisesuite.com/');
    expect(siteUrl()).toBe('https://amisesuite.com');
    expect(absoluteUrl('/book')).toBe('https://amisesuite.com/book');
    expect(absoluteUrl('/')).toBe('https://amisesuite.com');
  });
});

// Public, indexable pages. Each must set alternates.canonical to its own path.
const PUBLIC_PAGES: Record<string, string> = {
  'app/page.tsx': '/',
  'app/book/page.tsx': '/book',
  'app/guidance/page.tsx': '/guidance',
  'app/pathway/page.tsx': '/pathway',
  'app/privacy/page.tsx': '/privacy',
  'app/refer/page.tsx': '/refer',
  'app/intake/layout.tsx': '/intake',
  'app/patient/request/layout.tsx': '/patient/request',
  'app/services/breast-clinic/page.tsx': '/services/breast-clinic',
  'app/services/diabetic-foot/page.tsx': '/services/diabetic-foot',
  'app/services/endoscopy/page.tsx': '/services/endoscopy',
  'app/services/ercp/page.tsx': '/services/ercp',
  'app/health-information/page.tsx': '/health-information',
};

describe('canonical tags', () => {
  it.each(Object.entries(PUBLIC_PAGES))('%s declares canonical %s', (file, path) => {
    const src = readFileSync(join(ROOT, file), 'utf8');
    expect(src).toContain(`canonical: '${path}'`);
  });

  it('the article page builds its canonical from the slug', () => {
    const src = readFileSync(join(ROOT, 'app/health-information/[slug]/page.tsx'), 'utf8');
    expect(src).toMatch(/canonical: `\/health-information\/\$\{[^}]+\}`/);
  });

  it('the root layout sets no canonical (it would be inherited by every page)', () => {
    const src = readFileSync(join(ROOT, 'app/layout.tsx'), 'utf8');
    expect(src).not.toMatch(/canonical\s*:/);
    expect(src).toContain('metadataBase: new URL(siteUrl())');
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(abs);
  }
  return out;
}

describe('no hard-coded site origin', () => {
  it('app/ builds absolute site URLs only through lib/site.ts', () => {
    const offenders = walk(join(ROOT, 'app'))
      .filter(f => /https?:\/\/(www\.)?(amisemedical|amisesuite)\.com/.test(readFileSync(f, 'utf8')))
      .map(f => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});
