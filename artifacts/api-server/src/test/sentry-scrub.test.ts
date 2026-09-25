// Compliance G-6 / S-6: Sentry must never receive PHI from the api-server.
// Feeds the beforeSend / beforeBreadcrumb scrubbers a PHI-laden fake event and
// checks that nothing identifying survives, and that the init options match
// the iOS reference (CrashReporting.swift).
import { describe, it, expect } from 'vitest';
import { scrubEvent, scrubBreadcrumb, scrubUrl, scrubText } from '../lib/sentry-scrub.js';
import { buildSentryOptions } from '../lib/sentry.js';

const PATIENT = {
  name: 'Marcia Jean-Baptiste',
  email: 'marcia.jb@example.com',
  phone: '+1 758 555 0142',
  dob: '1961-04-17',
  id: '3f2b8c1e-9a4d-4e57-b1c2-7d8e9f0a1b2c',
  jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
};

function phiEvent(): Record<string, any> {
  return {
    event_id: 'abc',
    level: 'error',
    platform: 'node',
    server_name: 'srv-render-abc123',
    transaction: `GET /api/patients/${PATIENT.id}/notes`,
    message: `Failed to notify ${PATIENT.email} at ${PATIENT.phone}`,
    logentry: { message: 'Lookup %s', params: [PATIENT.name] },
    request: {
      method: 'POST',
      url: `https://api.example.com/api/patients/${PATIENT.id}?name=${encodeURIComponent(PATIENT.name)}`,
      query_string: `name=${PATIENT.name}&dob=${PATIENT.dob}`,
      headers: { authorization: `Bearer ${PATIENT.jwt}`, cookie: 'sb-access-token=secret' },
      cookies: { 'sb-access-token': 'secret' },
      data: { full_name: PATIENT.name, dob: PATIENT.dob, diagnosis: 'rectal carcinoma' },
      env: { REMOTE_ADDR: '10.0.0.5' },
    },
    user: { id: 'u-1', email: 'dr@example.com', ip_address: '203.0.113.9', username: 'drk' },
    extra: { patient: { name: PATIENT.name, dob: PATIENT.dob }, body: 'free text HPI: bleeding PR' },
    tags: { patient_email: PATIENT.email, route: 'notes' },
    contexts: {
      os: { name: 'Linux' },
      runtime: { name: 'node', version: 'v24.0.0' },
      trace: { trace_id: 't1', span_id: 's1', data: { 'http.url': `https://x/api/patients/${PATIENT.id}?q=${PATIENT.name}` } },
      patient: { name: PATIENT.name },
      response: { status_code: 500, headers: { 'set-cookie': 'x' } },
    },
    exception: {
      values: [{
        type: 'PostgrestError',
        value: `duplicate key value violates unique constraint "patients_email_key". Key (email)=(${PATIENT.email}) for ${PATIENT.id}; token ${PATIENT.jwt}; see https://abc.supabase.co/rest/v1/patients?full_name=ilike.*Marcia*`,
        mechanism: { type: 'express', handled: false, data: { url: `/api/patients/${PATIENT.id}` } },
        stacktrace: { frames: [{ filename: 'routes/patients.ts', function: 'handler', vars: { patient: { name: PATIENT.name } } }] },
      }],
    },
    breadcrumbs: [
      { category: 'console', level: 'log', message: `patient ${PATIENT.name} saved`, data: { arguments: [PATIENT] } },
      { category: 'http', type: 'http', data: { method: 'GET', status_code: 200, url: `https://abc.supabase.co/rest/v1/patients?id=eq.${PATIENT.id}&select=*`, 'http.query': `id=eq.${PATIENT.id}` } },
      { category: 'custom', message: `sms to ${PATIENT.phone}`, data: { to: PATIENT.phone } },
    ],
  };
}

const PHI_STRINGS = [
  PATIENT.name, 'Marcia', PATIENT.email, 'marcia.jb', '555 0142', '5550142', PATIENT.dob, PATIENT.id, PATIENT.jwt,
  'rectal carcinoma', 'bleeding PR', 'dr@example.com', '203.0.113.9', 'sb-access-token', 'secret',
  'srv-render-abc123', '10.0.0.5',
];

describe('api-server Sentry beforeSend scrubber', () => {
  it('removes every PHI-bearing field from a PHI-laden event', () => {
    const out = scrubEvent(phiEvent());
    expect(out).not.toBeNull();
    const json = JSON.stringify(out);
    for (const s of PHI_STRINGS) expect(json, `leaked: ${s}`).not.toContain(s);

    expect(out!.request).toBeUndefined();
    expect(out!.user).toBeUndefined();
    expect(out!.extra).toBeUndefined();
    expect(out!.server_name).toBeUndefined();
    expect(Object.keys(out!.contexts).sort()).toEqual(['os', 'runtime', 'trace']);
    expect(out!.contexts.trace).toEqual({ trace_id: 't1', span_id: 's1' });
    expect(out!.exception.values[0].stacktrace.frames[0].vars).toBeUndefined();
  });

  it('keeps what is needed to debug the error', () => {
    const out = scrubEvent(phiEvent())!;
    expect(out.exception.values[0].type).toBe('PostgrestError');
    expect(out.exception.values[0].value).toContain('duplicate key value violates unique constraint');
    expect(out.exception.values[0].value).toContain('Key (email)=([redacted])');
    expect(out.exception.values[0].value).toContain('https://abc.supabase.co/rest/v1/patients');
    expect(out.exception.values[0].stacktrace.frames[0].function).toBe('handler');
    expect(out.transaction).toBe('GET /api/patients/:id/notes');
    expect(out.tags.route).toBe('notes');
    expect(out.level).toBe('error');
  });

  it('drops console breadcrumbs and strips URLs / data from the rest', () => {
    const out = scrubEvent(phiEvent())!;
    expect(out.breadcrumbs).toHaveLength(2);
    expect(out.breadcrumbs[0]).toEqual({
      category: 'http', type: 'http',
      data: { method: 'GET', status_code: 200, url: 'https://abc.supabase.co/rest/v1/patients' },
    });
    expect(out.breadcrumbs[1]).toEqual({ category: 'custom', message: 'sms to [number]' });
  });

  it('beforeBreadcrumb drops console and DOM breadcrumbs', () => {
    expect(scrubBreadcrumb({ category: 'console', message: PATIENT.name })).toBeNull();
    expect(scrubBreadcrumb({ category: 'ui.click', message: `div[title="${PATIENT.name}"]` })).toBeNull();
  });

  it('scrubUrl keeps the route shape only', () => {
    expect(scrubUrl(`https://h/api/questionnaire/session/${'a'.repeat(40)}/answer?x=1#y`)).toBe('https://h/api/questionnaire/session/:id/answer');
    expect(scrubUrl('/api/invoices/INV-2026-0042')).toBe('/api/invoices/:id');
    expect(scrubUrl('/api/patients/search/%2B17585550142')).toBe('/api/patients/search/:id');
    expect(scrubUrl('/rest/v1/patients')).toBe('/rest/v1/patients');
  });

  it('scrubText redacts identifiers in free text', () => {
    expect(scrubText(`call ${PATIENT.phone} or email ${PATIENT.email}`)).toBe('call [number] or email [email]');
    expect(scrubText(`Authorization: Bearer ${PATIENT.jwt}`)).toBe('Authorization: Bearer [token]');
  });

  it('fails safe: an unscrubbable event is dropped, not sent', () => {
    const evil = { get exception() { throw new Error('boom'); } };
    expect(scrubEvent(evil as never)).toBeNull();
  });
});

describe('api-server Sentry init options', () => {
  const opts = buildSentryOptions('https://public@o0.ingest.sentry.io/0', 'dry_run');

  it('matches the iOS PHI-safe reference', () => {
    expect(opts.sendDefaultPii).toBe(false);
    expect(opts.includeLocalVariables).toBe(false);
    expect(opts.tracesSampleRate).toBe(0);
    expect(opts.tracePropagationTargets).toEqual([]);
    expect(opts.beforeSendTransaction?.({} as never, {})).toBeNull();
  });

  it('removes RequestData and Console, and records no HTTP breadcrumbs', () => {
    const fake = ['RequestData', 'Console', 'Http', 'NodeFetch', 'LinkedErrors', 'OnUncaughtException']
      .map(name => ({ name, setupOnce() {} }));
    const list = (opts.integrations as (d: typeof fake) => { name: string }[])(fake).map(i => i.name);
    expect(list).not.toContain('RequestData');
    expect(list).not.toContain('Console');
    expect(list).toContain('LinkedErrors');
    expect(list).toContain('OnUncaughtException');
    expect(list.filter(n => n === 'Http')).toHaveLength(1);
  });

  it('wires the scrubbers into beforeSend and beforeBreadcrumb', () => {
    const sent = opts.beforeSend?.(phiEvent() as never, {}) as unknown;
    expect(JSON.stringify(sent)).not.toContain(PATIENT.email);
    expect(opts.beforeBreadcrumb?.({ category: 'console', message: 'x' })).toBeNull();
  });
});
