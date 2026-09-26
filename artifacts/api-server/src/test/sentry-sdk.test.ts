// Compliance G-6: end-to-end through the real @sentry/node SDK. Initialise it
// with the production options (lib/sentry.ts) and an in-memory transport,
// capture an error from a PHI-laden scope, and check the envelope that would
// be sent to Sentry. Complements the unit tests of the scrubber itself.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as Sentry from '@sentry/node';
import { buildSentryOptions } from '../lib/sentry.js';

const sent: string[] = [];

beforeAll(() => {
  Sentry.init({
    ...buildSentryOptions('https://public@o0.ingest.sentry.io/0', 'test'),
    transport: () => ({
      send: async envelope => { sent.push(JSON.stringify(envelope)); return {}; },
      flush: async () => true,
    }),
  });
});

afterAll(async () => { await Sentry.close(); });

describe('api-server Sentry SDK end-to-end', () => {
  it('captures the error but sends no PHI', async () => {
    const patientId = '3f2b8c1e-9a4d-4e57-b1c2-7d8e9f0a1b2c';
    Sentry.getIsolationScope().setSDKProcessingMetadata({
      normalizedRequest: {
        method: 'POST',
        url: `https://api.example.com/api/patients/${patientId}?name=Marcia%20Jean-Baptiste`,
        query_string: 'name=Marcia Jean-Baptiste',
        headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2ln', cookie: 'sb=secret-cookie' },
        cookies: { sb: 'secret-cookie' },
        data: '{"full_name":"Marcia Jean-Baptiste","diagnosis":"rectal carcinoma"}',
      },
    });
    Sentry.addBreadcrumb({ category: 'console', message: 'saving Marcia Jean-Baptiste' });
    Sentry.withScope(scope => {
      scope.setUser({ id: 'staff-1', email: 'dr@example.com', ip_address: '203.0.113.9' });
      scope.setExtra('patient', { name: 'Marcia Jean-Baptiste', dob: '1961-04-17' });
      scope.setContext('patient', { phone: '+1 758 555 0142' });
      Sentry.captureException(new Error(`notify failed for marcia.jb@example.com (${patientId})`));
    });
    await Sentry.flush(2000);

    // ContextLines attaches lines of *source code* around each frame; this
    // test's own source contains the fake PHI literals, so drop those fields
    // before looking for runtime data. (Application code holds no patient data.)
    const all = sent.join('\n').replace(/"(pre_context|post_context)":\[(?:"(?:[^"\\]|\\.)*",?)*\]|"context_line":"(?:[^"\\]|\\.)*"/g, '');
    expect(all).toContain('notify failed for [email] ([id])'); // the error itself is reported
    for (const phi of ['Marcia', 'Jean-Baptiste', 'marcia.jb@example.com', patientId, 'rectal carcinoma',
      'secret-cookie', 'eyJhbGciOiJIUzI1NiJ9', 'dr@example.com', '203.0.113.9', '555 0142', '1961-04-17']) {
      expect(all, `leaked: ${phi}`).not.toContain(phi);
    }
    expect(all).not.toMatch(/"request":/);
    expect(all).not.toMatch(/"user":/);
    expect(all).not.toMatch(/"extra":/);
    expect(all).not.toMatch(/"category":"console"/);
  });
});
