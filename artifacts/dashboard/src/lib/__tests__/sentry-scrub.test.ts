/**
 * Compliance G-6 / S-6: the dashboard must never send PHI to Sentry.
 * Feeds the beforeSend / beforeBreadcrumb scrubbers a PHI-laden fake browser
 * event and checks nothing identifying survives; checks the init options
 * match the iOS reference (CrashReporting.swift).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scrubEvent, scrubBreadcrumb } from '@/lib/sentry-scrub';
import { buildSentryOptions } from '@/lib/sentry';

const P = {
  name: 'Kervin St Rose',
  email: 'kervin.strose@example.com',
  phone: '+1 (758) 555-0199',
  dob: '17/04/1961',
  id: '8d6c2f0a-1b3e-4c5d-9e7f-0a1b2c3d4e5f',
  token: 'q9XvT2mLk8Rw4Zp1Yb7Nc3Hd6Fg0Js5Ea',
  jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhYmMifQ.c2lnbmF0dXJlLXZhbHVlLWhlcmU',
};

function phiEvent(): Record<string, any> {
  return {
    event_id: 'e1',
    level: 'error',
    platform: 'javascript',
    message: undefined,
    request: {
      url: `https://emr.example.com/patients/${P.id}?name=${encodeURIComponent(P.name)}#vitals`,
      headers: { Referer: `https://emr.example.com/patients/${P.id}`, 'User-Agent': 'Mozilla/5.0' },
      cookies: { 'sb-auth-token': P.jwt },
      query_string: `name=${P.name}`,
    },
    user: { id: 'staff-1', email: 'nurse@example.com', ip_address: '198.51.100.23', username: 'nurse1' },
    extra: {
      componentStack: '\n    at VitalsTab\n    at PatientChart',
      patient: { full_name: P.name, dob: P.dob },
      draft: `HPI: ${P.name} reports rectal bleeding`,
    },
    tags: { note: `for ${P.email}` },
    contexts: {
      browser: { name: 'Chrome', version: '140' },
      os: { name: 'macOS' },
      react: { version: '19.0.0' },
      state: { encounter: { patient_name: P.name, dob: P.dob } },
      trace: { trace_id: 't', span_id: 's', data: { url: `/patients/${P.id}` } },
    },
    exception: {
      values: [{
        type: 'TypeError',
        value: `Cannot read properties of undefined (reading 'vitals') for patient ${P.id} ${P.email} ${P.phone}`,
        mechanism: { type: 'onerror', handled: false },
        stacktrace: { frames: [{ filename: `https://emr.example.com/assets/index-abc.js?token=${P.token}`, function: 'renderVitals', lineno: 10, colno: 5 }] },
      }],
    },
    breadcrumbs: [
      { category: 'console', level: 'log', message: `loaded ${P.name}`, data: { arguments: [{ name: P.name }] } },
      { category: 'ui.click', message: `div.row[title="${P.name}"]` },
      { category: 'fetch', type: 'http', data: { method: 'GET', status_code: 200, url: `https://x.supabase.co/rest/v1/patients?full_name=ilike.*Kervin*&id=eq.${P.id}` } },
      { category: 'xhr', type: 'http', data: { method: 'POST', status_code: 500, url: `/api/questionnaire/session/${P.token}/answer`, request_body_size: 12 } },
      { category: 'navigation', data: { from: `/patients/${P.id}?tab=plan`, to: `/reset?access_token=${P.jwt}` } },
    ],
  };
}

const PHI = [
  P.name, 'Kervin', P.email, '555-0199', P.dob, P.id, P.token, P.jwt, 'rectal bleeding',
  'nurse@example.com', '198.51.100.23', 'nurse1', 'Mozilla', 'access_token', 'tab=plan',
];

describe('dashboard Sentry beforeSend scrubber', () => {
  it('strips request, user, extra PHI and non-runtime contexts', () => {
    const out = scrubEvent(phiEvent())!;
    const json = JSON.stringify(out);
    for (const s of PHI) expect(json, `leaked: ${s}`).not.toContain(s);

    expect(out.request).toBeUndefined();
    expect(out.user).toBeUndefined();
    expect(out.extra).toEqual({ componentStack: '\n    at VitalsTab\n    at PatientChart' });
    expect(Object.keys(out.contexts).sort()).toEqual(['browser', 'os', 'react', 'trace']);
  });

  it('keeps error capture useful', () => {
    const out = scrubEvent(phiEvent())!;
    const ex = out.exception.values[0];
    expect(ex.type).toBe('TypeError');
    expect(ex.value).toContain("Cannot read properties of undefined (reading 'vitals')");
    expect(ex.stacktrace.frames[0]).toMatchObject({
      filename: 'https://emr.example.com/assets/index-abc.js', function: 'renderVitals', lineno: 10,
    });
  });

  it('breadcrumbs: console and DOM dropped, URLs reduced to the route shape', () => {
    const out = scrubEvent(phiEvent())!;
    expect(out.breadcrumbs).toEqual([
      { category: 'fetch', type: 'http', data: { method: 'GET', status_code: 200, url: 'https://x.supabase.co/rest/v1/patients' } },
      { category: 'xhr', type: 'http', data: { method: 'POST', status_code: 500, url: '/api/questionnaire/session/:id/answer' } },
      { category: 'navigation', data: { from: '/patients/:id', to: '/reset' } },
    ]);
    expect(scrubBreadcrumb({ category: 'console', message: 'x' })).toBeNull();
  });

  it('the dashboard scrubber is the same code as the api-server copy', () => {
    const strip = (s: string) => s.replace(/^\/\*\*[\s\S]*?\*\/\n/, '');
    const here = readFileSync(fileURLToPath(new URL('../sentry-scrub.ts', import.meta.url)), 'utf8');
    const api = readFileSync(fileURLToPath(new URL('../../../../api-server/src/lib/sentry-scrub.ts', import.meta.url)), 'utf8');
    expect(strip(here)).toBe(strip(api));
  });
});

describe('dashboard Sentry init options', () => {
  const opts = buildSentryOptions('https://public@o0.ingest.sentry.io/0');

  it('no default PII, tracing off, no trace headers, transactions dropped', () => {
    expect(opts.sendDefaultPii).toBe(false);
    expect(opts.tracesSampleRate).toBe(0);
    expect(opts.tracePropagationTargets).toEqual([]);
    expect(opts.beforeSendTransaction?.({} as never, {})).toBeNull();
  });

  it('removes HttpContext, replaces Breadcrumbs, adds no Replay', () => {
    const fake = ['InboundFilters', 'Breadcrumbs', 'GlobalHandlers', 'LinkedErrors', 'HttpContext', 'BrowserSession']
      .map(name => ({ name, setupOnce() {} }));
    const names = (opts.integrations as (d: typeof fake) => { name: string }[])(fake).map(i => i.name);
    expect(names).not.toContain('HttpContext');
    expect(names).not.toContain('Replay');
    expect(names).toContain('GlobalHandlers');
    expect(names.filter(n => n === 'Breadcrumbs')).toHaveLength(1);
  });

  it('wires the scrubbers', () => {
    const sent = opts.beforeSend?.(phiEvent() as never, {}) as unknown;
    expect(JSON.stringify(sent)).not.toContain(P.email);
    expect(opts.beforeBreadcrumb?.({ category: 'console', message: P.name })).toBeNull();
  });
});
