/**
 * Integration tests for prescriptions API routes.
 * Supabase is fully mocked — no real DB connections.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockFrom = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
  requireStaffAuth: vi.fn().mockResolvedValue(true),
  getStaffUserId:   vi.fn().mockResolvedValue('staff-uuid'),
  audit:            vi.fn().mockResolvedValue(undefined),
}));

// ── App setup ─────────────────────────────────────────────────────────────────

const { default: prescriptionsRouter } = await import('../routes/prescriptions.js');

const app = express();
app.use(express.json());
app.use(prescriptionsRouter);

// ── Chain helper ──────────────────────────────────────────────────────────────

function mkChain(termResult: unknown) {
  const obj: Record<string, unknown> = {};
  const self = () => obj;
  obj.select      = vi.fn(self);
  obj.insert      = vi.fn(self);
  obj.update      = vi.fn(self);
  obj.eq          = vi.fn(self);
  obj.is          = vi.fn(self);
  obj.order       = vi.fn(self);
  obj.maybeSingle = vi.fn().mockResolvedValue(termResult);
  obj.single      = vi.fn().mockResolvedValue(termResult);
  (obj as any).then = (
    res: (v: unknown) => unknown,
    rej: (e: unknown) => unknown,
  ) => Promise.resolve(termResult).then(res as any, rej as any);
  return obj;
}

const ok  = (data: unknown) => ({ data, error: null });
const err = (msg: string)   => ({ data: null, error: { message: msg } });

const SAMPLE_ITEMS = [
  { id: 'item-1', drugName: 'Amoxicillin 500mg', dose: '500mg', frequency: 'TDS (three times daily)', route: 'PO (oral)', duration: '7 days', quantity: '21', refills: '0', instructions: '', indication: '', noSubstitution: false },
];

beforeEach(() => vi.clearAllMocks());

// ── POST /api/prescriptions ───────────────────────────────────────────────────

describe('POST /api/prescriptions', () => {
  it('returns 400 when patientId is missing', async () => {
    const res = await request(app)
      .post('/api/prescriptions')
      .send({ prescriberName: 'Dr Smith', items: SAMPLE_ITEMS });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/patientId/i);
  });

  it('returns 400 when prescriberName is missing', async () => {
    const res = await request(app)
      .post('/api/prescriptions')
      .send({ patientId: 'pat-1', items: SAMPLE_ITEMS });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/prescriberName/i);
  });

  it('returns 400 when items is empty', async () => {
    const res = await request(app)
      .post('/api/prescriptions')
      .send({ patientId: 'pat-1', prescriberName: 'Dr Smith', items: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/items/i);
  });

  it('returns 400 when items is not an array', async () => {
    const res = await request(app)
      .post('/api/prescriptions')
      .send({ patientId: 'pat-1', prescriberName: 'Dr Smith', items: 'not-an-array' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/items/i);
  });

  it('returns 400 for invalid status', async () => {
    const res = await request(app)
      .post('/api/prescriptions')
      .send({ patientId: 'pat-1', prescriberName: 'Dr Smith', items: SAMPLE_ITEMS, status: 'approved' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
  });

  it('creates a signed prescription and returns 201', async () => {
    const record = {
      id: 'rx-uuid-1', patient_id: 'pat-1', encounter_id: 'enc-1',
      prescribed_by: 'staff-uuid', prescriber_name: 'Dr Smith',
      status: 'signed', items: SAMPLE_ITEMS, notes: null,
      created_at: '2026-07-30T10:00:00Z', updated_at: '2026-07-30T10:00:00Z',
    };
    mockFrom.mockReturnValueOnce(mkChain(ok(record))); // insert
    mockFrom.mockReturnValue(mkChain(ok(null)));        // audit

    const res = await request(app)
      .post('/api/prescriptions')
      .send({
        patientId: 'pat-1', encounterId: 'enc-1',
        prescriberName: 'Dr Smith', status: 'signed',
        items: SAMPLE_ITEMS,
      });

    expect(res.status).toBe(201);
    expect(res.body.prescription).toMatchObject({ id: 'rx-uuid-1', status: 'signed' });
  });

  it('defaults status to draft when not provided', async () => {
    const record = {
      id: 'rx-uuid-2', patient_id: 'pat-1', encounter_id: null,
      prescribed_by: 'staff-uuid', prescriber_name: 'Dr Smith',
      status: 'draft', items: SAMPLE_ITEMS, notes: null,
      created_at: '2026-07-30T10:00:00Z', updated_at: '2026-07-30T10:00:00Z',
    };
    mockFrom.mockReturnValueOnce(mkChain(ok(record)));
    mockFrom.mockReturnValue(mkChain(ok(null)));

    const res = await request(app)
      .post('/api/prescriptions')
      .send({ patientId: 'pat-1', prescriberName: 'Dr Smith', items: SAMPLE_ITEMS });

    expect(res.status).toBe(201);
    expect(res.body.prescription.status).toBe('draft');
  });

  it('returns 502 on DB insert error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('insert failed')));

    const res = await request(app)
      .post('/api/prescriptions')
      .send({ patientId: 'pat-1', prescriberName: 'Dr Smith', items: SAMPLE_ITEMS });

    expect(res.status).toBe(502);
  });
});

// ── GET /api/prescriptions/patient/:patientId ─────────────────────────────────

describe('GET /api/prescriptions/patient/:patientId', () => {
  it('returns prescriptions list for a patient', async () => {
    const rows = [
      { id: 'rx-1', status: 'signed',    created_at: '2026-07-20T00:00:00Z' },
      { id: 'rx-2', status: 'dispensed', created_at: '2026-07-10T00:00:00Z' },
    ];
    mockFrom.mockReturnValueOnce(mkChain(ok(rows)));

    const res = await request(app).get('/api/prescriptions/patient/pat-1');

    expect(res.status).toBe(200);
    expect(res.body.prescriptions).toHaveLength(2);
    expect(res.body.prescriptions[0].id).toBe('rx-1');
  });

  it('returns empty array when no prescriptions exist', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));

    const res = await request(app).get('/api/prescriptions/patient/pat-no-rx');

    expect(res.status).toBe(200);
    expect(res.body.prescriptions).toEqual([]);
  });

  it('filters by encounterId when ?encounterId is provided', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));

    const res = await request(app).get('/api/prescriptions/patient/pat-1?encounterId=enc-99');

    expect(res.status).toBe(200);
    // Verify that eq() was called with encounterId
    const chain = mockFrom.mock.results[0].value;
    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls.some((c: unknown[]) => c[0] === 'encounter_id' && c[1] === 'enc-99')).toBe(true);
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('timeout')));

    const res = await request(app).get('/api/prescriptions/patient/pat-1');

    expect(res.status).toBe(502);
  });
});

// ── PATCH /api/prescriptions/:id ──────────────────────────────────────────────

describe('PATCH /api/prescriptions/:id', () => {
  it('returns 400 for invalid status', async () => {
    const res = await request(app)
      .patch('/api/prescriptions/rx-1')
      .send({ status: 'approved' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
  });

  it('returns 404 when prescription not found', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));

    const res = await request(app)
      .patch('/api/prescriptions/rx-missing')
      .send({ status: 'dispensed' });

    expect(res.status).toBe(404);
  });

  it('transitions status from signed to dispensed', async () => {
    const existing = { id: 'rx-1', patient_id: 'pat-1', status: 'signed' };
    mockFrom.mockReturnValueOnce(mkChain(ok(existing))); // fetch
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));      // update
    mockFrom.mockReturnValue(mkChain(ok(null)));           // audit

    const res = await request(app)
      .patch('/api/prescriptions/rx-1')
      .send({ status: 'dispensed' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'rx-1', status: 'dispensed' });
  });

  it('updates notes without changing status', async () => {
    const existing = { id: 'rx-2', patient_id: 'pat-1', status: 'draft' };
    mockFrom.mockReturnValueOnce(mkChain(ok(existing)));
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    mockFrom.mockReturnValue(mkChain(ok(null)));

    const res = await request(app)
      .patch('/api/prescriptions/rx-2')
      .send({ notes: 'Patient allergic to penicillin — use alternative' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
  });

  it('returns 502 on DB update error', async () => {
    const existing = { id: 'rx-3', patient_id: 'pat-1', status: 'draft' };
    mockFrom.mockReturnValueOnce(mkChain(ok(existing)));
    mockFrom.mockReturnValueOnce(mkChain(err('update failed')));

    const res = await request(app)
      .patch('/api/prescriptions/rx-3')
      .send({ status: 'signed' });

    expect(res.status).toBe(502);
  });
});
