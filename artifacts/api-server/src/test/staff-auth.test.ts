/**
 * S-3 regression tests: staff-only API routes must reject any Supabase user
 * who is not staff (e.g. a patient-portal user in the same Supabase project),
 * not just unauthenticated callers.
 *
 * Unlike the route tests that stub requireStaffAuth, this file mocks only the
 * Supabase client factory, so the real requireStaffAuth / verifyStaffToken /
 * requireAuth code runs end to end against a fake auth + user_profiles store.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// token → auth user; anything else is "invalid JWT"
const USERS: Record<string, { id: string; email: string }> = {
  'tok-front-desk': { id: '00000000-0000-0000-0000-00000000f001', email: 'fd@example.test' },
  'tok-nurse':      { id: '00000000-0000-0000-0000-00000000f002', email: 'rn@example.test' },
  'tok-doctor':     { id: '00000000-0000-0000-0000-00000000f003', email: 'md@example.test' },
  'tok-admin':      { id: '00000000-0000-0000-0000-00000000f004', email: 'admin@example.test' },
  // Portal patient: valid Supabase session, no user_profiles row.
  'tok-patient':    { id: '00000000-0000-0000-0000-00000000a001', email: 'patient@example.test' },
  // A profile row with a role outside the staff set must not pass either.
  'tok-odd-role':   { id: '00000000-0000-0000-0000-00000000a002', email: 'odd@example.test' },
  // Profile lookup errors → fail closed.
  'tok-db-error':   { id: '00000000-0000-0000-0000-00000000e001', email: 'err@example.test' },
};

const PROFILES: Record<string, string> = {
  '00000000-0000-0000-0000-00000000f001': 'front_desk',
  '00000000-0000-0000-0000-00000000f002': 'nurse',
  '00000000-0000-0000-0000-00000000f003': 'doctor',
  '00000000-0000-0000-0000-00000000f004': 'admin',
  '00000000-0000-0000-0000-00000000a002': 'patient',
};

const getUser = vi.fn(async (jwt: string) => {
  const user = USERS[jwt];
  return user
    ? { data: { user }, error: null }
    : { data: { user: null }, error: new Error('invalid JWT') };
});

function profileQuery() {
  let id = '';
  const q = {
    select: () => q,
    eq: (_col: string, value: string) => { id = value; return q; },
    maybeSingle: async () => {
      if (id === USERS['tok-db-error'].id) return { data: null, error: { message: 'boom' } };
      const role = PROFILES[id];
      return { data: role ? { role } : null, error: null };
    },
  };
  return q;
}

const from = vi.fn((table: string) => {
  if (table !== 'user_profiles') throw new Error(`unexpected table ${table}`);
  return profileQuery();
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser }, from }),
}));

let app: express.Express;

beforeAll(async () => {
  const { requireStaffAuth } = await import('../lib/supabase.js');
  const { requireAuth } = await import('../middlewares/auth.js');

  app = express();
  app.get('/staff-only', async (req, res) => {
    if (!(await requireStaffAuth(req, res))) return;
    res.json({ ok: true, staff: (req as any).staffUser ?? null });
  });
  app.get('/staff-mw', requireAuth, (req, res) => {
    res.json({ ok: true, userId: req.userId, role: req.userRole });
  });

  // A real staff router, to prove the gate is what production routes use.
  const { default: visitLifecycleRouter } = await import('../routes/visit-lifecycle.js');
  app.use(express.json());
  app.use(visitLifecycleRouter);
});

beforeEach(() => {
  getUser.mockClear();
  from.mockClear();
});

describe('requireStaffAuth — rejects non-staff', () => {
  it('no credentials → 401', async () => {
    const res = await request(app).get('/staff-only');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/unauthoris/i);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('forged / invalid Bearer token → 401', async () => {
    const res = await request(app).get('/staff-only').set('Authorization', 'Bearer forged.jwt.value');
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it('empty Bearer token → 401', async () => {
    const res = await request(app).get('/staff-only').set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('valid patient-portal token (no user_profiles row) → 403', async () => {
    const res = await request(app).get('/staff-only').set('Authorization', 'Bearer tok-patient');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/staff account/i);
  });

  it('profile with a non-staff role → 403', async () => {
    const res = await request(app).get('/staff-only').set('Authorization', 'Bearer tok-odd-role');
    expect(res.status).toBe(403);
  });

  it('profile lookup failure fails closed → 503', async () => {
    const res = await request(app).get('/staff-only').set('Authorization', 'Bearer tok-db-error');
    expect(res.status).toBe(503);
  });

  it('wrong x-staff-token → 401', async () => {
    const res = await request(app).get('/staff-only').set('x-staff-token', 'not-the-secret');
    expect(res.status).toBe(401);
  });

  it('wrong x-staff-token of the same length → 401', async () => {
    const res = await request(app).get('/staff-only').set('x-staff-token', 'x'.repeat('test-cron-secret'.length));
    expect(res.status).toBe(401);
  });
});

describe('requireStaffAuth — admits staff', () => {
  for (const [token, role] of [
    ['tok-front-desk', 'front_desk'],
    ['tok-nurse', 'nurse'],
    ['tok-doctor', 'doctor'],
    ['tok-admin', 'admin'],
  ] as const) {
    it(`${role} token → 200 with verified identity`, async () => {
      const res = await request(app).get('/staff-only').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.staff).toMatchObject({ userId: USERS[token].id, role });
    });
  }

  it('machine x-staff-token (CRON_SECRET) path is unchanged → 200', async () => {
    const res = await request(app).get('/staff-only').set('x-staff-token', 'test-cron-secret');
    expect(res.status).toBe(200);
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe('real staff routes (visit lifecycle) reject patient tokens', () => {
  const ROUTES = [
    { method: 'get',  path: '/api/visit/open-encounters' },
    { method: 'post', path: '/api/visit/check-in/test-appt' },
    { method: 'post', path: '/api/visit/sign-notes/test-enc' },
  ] as const;

  for (const { method, path } of ROUTES) {
    it(`${method.toUpperCase()} ${path} with a patient token → 403`, async () => {
      const res = await (request(app) as any)[method](path)
        .set('Authorization', 'Bearer tok-patient')
        .send({});
      expect(res.status).toBe(403);
      // Rejected before any clinical table is touched.
      expect(from.mock.calls.every(([t]) => t === 'user_profiles')).toBe(true);
    });

    it(`${method.toUpperCase()} ${path} with a forged token → 401`, async () => {
      const res = await (request(app) as any)[method](path)
        .set('Authorization', 'Bearer forged')
        .send({});
      expect(res.status).toBe(401);
    });
  }
});

describe('requireAuth middleware (scheduling / summary routes)', () => {
  it('no Authorization header → 401', async () => {
    const res = await request(app).get('/staff-mw');
    expect(res.status).toBe(401);
  });

  it('forged token → 401', async () => {
    const res = await request(app).get('/staff-mw').set('Authorization', 'Bearer nope');
    expect(res.status).toBe(401);
  });

  it('patient-portal token → 403', async () => {
    const res = await request(app).get('/staff-mw').set('Authorization', 'Bearer tok-patient');
    expect(res.status).toBe(403);
  });

  it('staff token → passes and sets userId / userRole', async () => {
    const res = await request(app).get('/staff-mw').set('Authorization', 'Bearer tok-nurse');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: USERS['tok-nurse'].id, role: 'nurse' });
  });

  it('CRON_SECRET is not accepted by the middleware form', async () => {
    const res = await request(app).get('/staff-mw').set('x-staff-token', 'test-cron-secret');
    expect(res.status).toBe(401);
  });
});
