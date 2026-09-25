/**
 * PORTAL_URL / DASHBOARD_URL parsing (lib/site-urls.ts).
 * The website is served from amisemedical.com and amisesuite.com, so the
 * CORS allow-list accepts a comma-separated list while patient links use
 * the first entry only.
 */
import { describe, it, expect } from 'vitest';
import {
  parseOriginList,
  corsAllowedOrigins,
  patientSiteBaseUrl,
  DEFAULT_PORTAL_ORIGIN,
} from '../lib/site-urls.js';

const MULTI =
  'https://amisemedical.com, https://www.amisemedical.com,https://amisesuite.com,' +
  'https://www.amisesuite.com,https://front-desk-amisesuite-afks-projects.vercel.app';

describe('parseOriginList', () => {
  it('returns [] for unset or empty values', () => {
    expect(parseOriginList(undefined)).toEqual([]);
    expect(parseOriginList('')).toEqual([]);
    expect(parseOriginList(' , ')).toEqual([]);
  });

  it('keeps a single value unchanged (existing behaviour)', () => {
    expect(parseOriginList('https://front-desk-amisesuite-afks-projects.vercel.app'))
      .toEqual(['https://front-desk-amisesuite-afks-projects.vercel.app']);
  });

  it('splits a comma-separated list, trims and de-duplicates', () => {
    expect(parseOriginList(`${MULTI},https://amisemedical.com`)).toEqual([
      'https://amisemedical.com',
      'https://www.amisemedical.com',
      'https://amisesuite.com',
      'https://www.amisesuite.com',
      'https://front-desk-amisesuite-afks-projects.vercel.app',
    ]);
  });

  it('drops trailing slashes and paths (CORS origins carry no path)', () => {
    expect(parseOriginList('https://amisemedical.com/, https://amisesuite.com/patient'))
      .toEqual(['https://amisemedical.com', 'https://amisesuite.com']);
  });

  it('ignores entries that are not http(s) URLs', () => {
    expect(parseOriginList('amisemedical.com,ftp://x.com,https://amisesuite.com'))
      .toEqual(['https://amisesuite.com']);
  });
});

describe('corsAllowedOrigins', () => {
  it('allows every PORTAL_URL and DASHBOARD_URL entry in production', () => {
    const origins = corsAllowedOrigins(
      { PORTAL_URL: MULTI, DASHBOARD_URL: 'https://dashboard-lemon-gamma-44.vercel.app' },
      false,
    );
    expect(origins).toContain('https://amisemedical.com');
    expect(origins).toContain('https://www.amisesuite.com');
    expect(origins).toContain('https://dashboard-lemon-gamma-44.vercel.app');
    expect(origins).not.toContain('http://localhost:3001');
  });

  it('adds localhost only in development', () => {
    expect(corsAllowedOrigins({}, true)).toContain('http://localhost:3001');
    expect(corsAllowedOrigins({}, false)).toEqual([]);
  });

  it('never allows a comma-joined string as one origin', () => {
    const origins = corsAllowedOrigins({ PORTAL_URL: MULTI }, false);
    expect(origins).not.toContain(MULTI);
    expect(origins.every(o => !o.includes(','))).toBe(true);
  });
});

describe('patientSiteBaseUrl', () => {
  it('uses the FIRST PORTAL_URL entry for links sent to patients', () => {
    expect(patientSiteBaseUrl({ PORTAL_URL: MULTI })).toBe('https://amisemedical.com');
  });

  it('keeps a single PORTAL_URL value (trailing slash / path stripped)', () => {
    expect(patientSiteBaseUrl({ PORTAL_URL: 'https://front-desk-amisesuite-afks-projects.vercel.app/patient' }))
      .toBe('https://front-desk-amisesuite-afks-projects.vercel.app');
  });

  it('falls back to FRONTEND_URL, then the default', () => {
    expect(patientSiteBaseUrl({ FRONTEND_URL: 'https://amisesuite.com/' })).toBe('https://amisesuite.com');
    expect(patientSiteBaseUrl({})).toBe(DEFAULT_PORTAL_ORIGIN);
  });
});
