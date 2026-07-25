/**
 * Auth guard tests — verify that protected routes return 401 when credentials
 * are absent or wrong, without mocking requireStaffAuth itself.
 *
 * The unauthenticated code path never calls sb(), so no Supabase mock is needed.
 * The authenticated path (x-staff-token matches CRON_SECRET) passes auth and
 * may hit a Supabase 502 — that is fine; we only assert it is NOT a 401.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Minimal Supabase mock — only used for the "auth passes, business logic runs" test.
// Unauthenticated tests never reach sb() so the mock is irrelevant there.
const makeQuery = (result: unknown = { data: null, error: null }) => {
  const q: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const m of ['select','update','insert','delete','upsert','eq','neq','in','not','order','limit']) {
    q[m] = () => q;
  }
  q['maybeSingle'] = () => Promise.resolve({ data: null, error: null });
  q['single'] = () => Promise.resolve({ data: null, error: null });
  return q;
};

vi.mock('../lib/supabase.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/supabase.js')>();
  const mockClient = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: null, error: new Error('invalid') }) },
    from: vi.fn(() => makeQuery()),
  };
  return {
    ...mod,
    sb: () => mockClient,
    getSupabaseAdmin: () => mockClient,
    audit: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../lib/audit.js', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));

let app: express.Express;

beforeAll(async () => {
  const { default: visitLifecycleRouter } = await import('../routes/visit-lifecycle.js');
  app = express();
  app.use(express.json());
  app.use(visitLifecycleRouter);
});

const PROTECTED_ROUTES = [
  { method: 'post', path: '/api/visit/sign-notes/test-enc' },
  { method: 'post', path: '/api/visit/complete/test-enc' },
  { method: 'post', path: '/api/visit/check-in/test-appt' },
  { method: 'get',  path: '/api/visit/open-encounters' },
];

describe('Auth guard — no credentials', () => {
  for (const { method, path } of PROTECTED_ROUTES) {
    it(`${method.toUpperCase()} ${path} → 401`, async () => {
      const res = await (request(app) as any)[method](path).send({});
      expect(res.status).toBe(401);
      expect((res.body as { error: string }).error).toMatch(/unauthoris/i);
    });
  }
});

describe('Auth guard — wrong x-staff-token', () => {
  for (const { method, path } of PROTECTED_ROUTES) {
    it(`${method.toUpperCase()} ${path} with wrong token → 401`, async () => {
      const res = await (request(app) as any)[method](path)
        .set('x-staff-token', 'wrong-secret')
        .send({});
      expect(res.status).toBe(401);
    });
  }
});

describe('Auth guard — valid x-staff-token', () => {
  it('POST /api/visit/sign-notes/:id passes auth (not 401)', async () => {
    const res = await request(app)
      .post('/api/visit/sign-notes/test-enc')
      .set('x-staff-token', 'test-cron-secret')
      .send({});
    expect(res.status).not.toBe(401);
  });
});
