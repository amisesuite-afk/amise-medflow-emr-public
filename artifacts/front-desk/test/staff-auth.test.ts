/**
 * S-1 regression tests: /api/staff/* handlers use the service-role client, so
 * they must verify the caller's Supabase session and staff role themselves.
 * Previously middleware.ts only checked that a cookie with the right *name*
 * existed, so any value (or a patient-portal session cookie) got through.
 *
 * The Supabase service client is mocked; everything else (middleware,
 * requireStaff, route handlers) is the real code.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Three-segment, JWT-shaped placeholders (not real tokens).
const STAFF_TOKEN   = 'eyJhbGciOiJIUzI1NiJ9.c3RhZmY.c2ln';
const NURSE_TOKEN   = 'eyJhbGciOiJIUzI1NiJ9.bnVyc2U.c2ln';
const PATIENT_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.cGF0aWVudA.c2ln';
const FORGED_JWT    = 'eyJhbGciOiJIUzI1NiJ9.Zm9yZ2Vk.c2ln';

const USERS: Record<string, { id: string; email: string }> = {
  [STAFF_TOKEN]:   { id: 'staff-front-desk', email: 'fd@example.test' },
  [NURSE_TOKEN]:   { id: 'staff-nurse',      email: 'rn@example.test' },
  [PATIENT_TOKEN]: { id: 'portal-patient',   email: 'pt@example.test' },
};
const PROFILES: Record<string, string> = {
  'staff-front-desk': 'front_desk',
  'staff-nurse': 'nurse',
  // portal-patient: no user_profiles row
};

const getUser = vi.fn(async (jwt: string) => {
  const user = USERS[jwt];
  return user ? { data: { user }, error: null } : { data: { user: null }, error: new Error('invalid JWT') };
});

// Records every table the handlers touch, so tests can assert that a rejected
// caller never reached patient data.
const tablesTouched: string[] = [];
let lastOrFilter: string | null = null;

function query(table: string) {
  let eqValue = '';
  const result = () => {
    if (table === 'user_profiles') {
      const role = PROFILES[eqValue];
      return { data: role ? { role } : null, error: null };
    }
    if (table === 'appointment_requests') {
      return { data: { id: 'appt-1', result_alert_email: 'lab@example.test', result_alert_sent_at: null }, error: null };
    }
    return { data: [], error: null };
  };
  const q: any = {
    select: () => q,
    insert: () => q,
    update: () => q,
    eq: (_c: string, v: string) => { eqValue = v; return q; },
    gte: () => q,
    order: () => q,
    limit: () => q,
    or: (f: string) => { lastOrFilter = f; return q; },
    maybeSingle: async () => result(),
    single: async () => result(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve),
  };
  return q;
}

const client = {
  auth: { getUser },
  from: vi.fn((table: string) => { tablesTouched.push(table); return query(table); }),
};

vi.mock('@/lib/supabase', () => ({ getServiceClient: () => client }));

const { GET: patientsGET } = await import('@/app/api/staff/patients/route');
const { GET: bookingsGET } = await import('@/app/api/staff/bookings/route');
const { POST: bookPOST } = await import('@/app/api/staff/book/route');
const { POST: labAlertPOST } = await import('@/app/api/staff/lab-alert/[id]/route');
const { middleware } = await import('@/middleware');
const { verifyStaffToken } = await import('@/lib/staff-auth');

function req(path: string, opts: { cookie?: string; bearer?: string; method?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  return new NextRequest(`http://localhost${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

const ROUTES = [
  { name: 'GET /api/staff/patients',        call: (o: Parameters<typeof req>[1]) => patientsGET(req('/api/staff/patients?q=smith', o)) },
  { name: 'GET /api/staff/bookings',        call: (o: Parameters<typeof req>[1]) => bookingsGET(req('/api/staff/bookings', o)) },
  { name: 'POST /api/staff/book',           call: (o: Parameters<typeof req>[1]) => bookPOST(req('/api/staff/book', { ...o, method: 'POST', body: { category: 'consult', patient_name: 'Test Patient' } })) },
  { name: 'POST /api/staff/lab-alert/[id]', call: (o: Parameters<typeof req>[1]) => labAlertPOST(req('/api/staff/lab-alert/appt-1', { ...o, method: 'POST' }), { params: { id: 'appt-1' } }) },
];

beforeEach(() => {
  getUser.mockClear();
  client.from.mockClear();
  tablesTouched.length = 0;
  lastOrFilter = null;
});

describe('/api/staff/* handlers verify the session, not just the cookie name', () => {
  for (const route of ROUTES) {
    describe(route.name, () => {
      it('missing cookie / no credentials → 401', async () => {
        const res = await route.call({});
        expect(res.status).toBe(401);
        expect(tablesTouched).toEqual([]);
      });

      it('forged cookie value (not a JWT) → 401, no Supabase call', async () => {
        const res = await route.call({ cookie: 'amise-staff-session=anything' });
        expect(res.status).toBe(401);
        expect(getUser).not.toHaveBeenCalled();
        expect(tablesTouched).toEqual([]);
      });

      it('forged JWT-shaped cookie rejected by Supabase → 401', async () => {
        const res = await route.call({ cookie: `amise-staff-session=${FORGED_JWT}` });
        expect(res.status).toBe(401);
        expect(getUser).toHaveBeenCalledWith(FORGED_JWT);
        expect(tablesTouched).toEqual([]);
      });

      it('patient-portal session (valid JWT, no staff profile) → 403, no patient data read', async () => {
        const res = await route.call({ cookie: `amise-staff-session=${PATIENT_TOKEN}` });
        expect(res.status).toBe(403);
        expect(tablesTouched).toEqual(['user_profiles']);
      });

      it('patient-portal token as Bearer → 403', async () => {
        const res = await route.call({ bearer: PATIENT_TOKEN });
        expect(res.status).toBe(403);
      });

      it('staff session cookie → allowed', async () => {
        const res = await route.call({ cookie: `amise-staff-session=${STAFF_TOKEN}` });
        expect(res.status).toBe(200);
        expect(tablesTouched[0]).toBe('user_profiles');
        expect(tablesTouched.length).toBeGreaterThan(1);
      });

      it('staff Bearer token → allowed', async () => {
        const res = await route.call({ bearer: NURSE_TOKEN });
        expect(res.status).toBe(200);
      });
    });
  }
});

describe('GET /api/staff/patients search term', () => {
  it('strips PostgREST filter syntax from q', async () => {
    const res = await patientsGET(req('/api/staff/patients?q=' + encodeURIComponent('smith,id.not.is.null)'), { bearer: STAFF_TOKEN }));
    expect(res.status).toBe(200);
    expect(lastOrFilter).not.toBeNull();
    // Exactly the three intended conditions — nothing injected.
    expect(lastOrFilter!.split(',')).toHaveLength(3);
    expect(lastOrFilter).not.toMatch(/[()]/);
  });
});

describe('verifyStaffToken', () => {
  it('rejects null and non-JWT strings without calling Supabase', async () => {
    expect(await verifyStaffToken(null, client as any)).toMatchObject({ ok: false, status: 401 });
    expect(await verifyStaffToken('abc', client as any)).toMatchObject({ ok: false, status: 401 });
    expect(getUser).not.toHaveBeenCalled();
  });

  it('fails closed (503) when the profile lookup errors', async () => {
    const failing = {
      auth: { getUser },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'down' } }) }) }) }),
    };
    expect(await verifyStaffToken(STAFF_TOKEN, failing as any)).toMatchObject({ ok: false, status: 503 });
  });

  it('returns the verified identity for staff', async () => {
    expect(await verifyStaffToken(STAFF_TOKEN, client as any)).toEqual({
      ok: true,
      staff: { userId: 'staff-front-desk', email: 'fd@example.test', role: 'front_desk' },
    });
  });
});

describe('middleware (coarse gate)', () => {
  it('/api/staff/* with no credentials → 401', async () => {
    const res = middleware(req('/api/staff/bookings'));
    expect(res.status).toBe(401);
  });

  it('/api/staff/* with only a generic sb-*-auth-token cookie (e.g. a portal session) → 401', async () => {
    const res = middleware(req('/api/staff/bookings', { cookie: 'sb-abc-auth-token=whatever' }));
    expect(res.status).toBe(401);
  });

  it('/staff/schedule with only a generic sb-*-auth-token cookie → redirect to login', async () => {
    const res = middleware(req('/staff/schedule', { cookie: 'sb-abc-auth-token=whatever' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/staff/login');
  });

  it('passes through when a staff cookie or Bearer is present (handler then verifies it)', async () => {
    expect(middleware(req('/api/staff/bookings', { cookie: 'amise-staff-session=x' })).headers.get('x-middleware-next')).toBe('1');
    expect(middleware(req('/api/staff/bookings', { bearer: 'x' })).headers.get('x-middleware-next')).toBe('1');
  });
});
