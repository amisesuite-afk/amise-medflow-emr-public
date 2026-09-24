/**
 * S-3 regression tests: staff-only API routes must reject any Supabase user
 * who is not staff (e.g. a patient-portal user in the same Supabase project),
 * not just unauthenticated callers.
 *
 * Unlike the route tests that stub requireStaffAuth, this file mocks only the
 * Supabase client factory, so the real requireStaffAuth / verifyStaffToken /
 * requireAuth code runs end to end against a fake auth + user_profiles store.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
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

// Wrap timingSafeEqual so the tests can check the machine token is compared in
// constant time (behaviour is the real implementation).
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

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

  it('machine x-staff-token (CRON_SECRET fallback, STAFF_MACHINE_TOKEN unset) → 200', async () => {
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

describe('x-staff-token uses STAFF_MACHINE_TOKEN, separate from CRON_SECRET', () => {
  const saved = { machine: process.env.STAFF_MACHINE_TOKEN, cron: process.env.CRON_SECRET };
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const { logger } = await import('../lib/logger.js');
    const { _resetStaffMachineTokenWarning } = await import('../lib/supabase.js');
    _resetStaffMachineTokenWarning();
    warn = vi.spyOn(logger, 'warn');
  });

  afterEach(() => {
    warn.mockRestore();
    if (saved.machine === undefined) delete process.env.STAFF_MACHINE_TOKEN;
    else process.env.STAFF_MACHINE_TOKEN = saved.machine;
    process.env.CRON_SECRET = saved.cron;
  });

  describe('STAFF_MACHINE_TOKEN set', () => {
    beforeEach(() => {
      process.env.STAFF_MACHINE_TOKEN = 'test-machine-token';
    });

    it('accepts STAFF_MACHINE_TOKEN → 200 without a Supabase lookup', async () => {
      const res = await request(app).get('/staff-only').set('x-staff-token', 'test-machine-token');
      expect(res.status).toBe(200);
      expect(getUser).not.toHaveBeenCalled();
    });

    it('no longer accepts CRON_SECRET → 401', async () => {
      const res = await request(app).get('/staff-only').set('x-staff-token', 'test-cron-secret');
      expect(res.status).toBe(401);
    });

    it('rejects a wrong token of the same length → 401', async () => {
      const res = await request(app).get('/staff-only').set('x-staff-token', 'x'.repeat('test-machine-token'.length));
      expect(res.status).toBe(401);
    });

    it('compares in constant time', async () => {
      const { timingSafeEqual } = await import('node:crypto');
      vi.mocked(timingSafeEqual).mockClear();
      await request(app).get('/staff-only').set('x-staff-token', 'test-machine-tokeX');
      expect(timingSafeEqual).toHaveBeenCalledTimes(1);
    });

    it('does not log the fallback warning', async () => {
      await request(app).get('/staff-only').set('x-staff-token', 'test-machine-token');
      expect(warn).not.toHaveBeenCalled();
    });

    it('is still not accepted by the requireAuth middleware form → 401', async () => {
      const res = await request(app).get('/staff-mw').set('x-staff-token', 'test-machine-token');
      expect(res.status).toBe(401);
    });
  });

  describe('STAFF_MACHINE_TOKEN unset: falls back to CRON_SECRET', () => {
    beforeEach(() => {
      delete process.env.STAFF_MACHINE_TOKEN;
    });

    it('accepts CRON_SECRET and warns once per process', async () => {
      const first = await request(app).get('/staff-only').set('x-staff-token', 'test-cron-secret');
      const second = await request(app).get('/staff-only').set('x-staff-token', 'test-cron-secret');
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      const fallbackWarnings = warn.mock.calls.filter((call: unknown[]) => String(call[0]).includes('STAFF_MACHINE_TOKEN'));
      expect(fallbackWarnings).toHaveLength(1);
      // The warning never contains the secret itself.
      expect(JSON.stringify(warn.mock.calls)).not.toContain('test-cron-secret');
    });

    it('treats a blank STAFF_MACHINE_TOKEN as unset', async () => {
      process.env.STAFF_MACHINE_TOKEN = '   ';
      const res = await request(app).get('/staff-only').set('x-staff-token', 'test-cron-secret');
      expect(res.status).toBe(200);
    });

    it('rejects every x-staff-token when CRON_SECRET is unset too → 401', async () => {
      delete process.env.CRON_SECRET;
      const res = await request(app).get('/staff-only').set('x-staff-token', 'test-cron-secret');
      expect(res.status).toBe(401);
    });

    it('rejects an empty x-staff-token → 401', async () => {
      const res = await request(app).get('/staff-only').set('x-staff-token', '');
      expect(res.status).toBe(401);
    });
  });
});
