import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockFrom = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
  requireStaffAuth: vi.fn().mockResolvedValue(true),
  getStaffUserId:   vi.fn().mockResolvedValue('aaaaaaaa-0000-0000-0000-000000000001'),
  audit:            vi.fn().mockResolvedValue(undefined),
}));

const PAT_ID  = 'a0000000-0000-0000-0000-000000000001';
const PROB_ID = 'c0000000-0000-0000-0000-000000000001';

const { default: problemsRouter } = await import('../routes/problems.js');
const app = express();
app.use(express.json());
app.use(problemsRouter);

function mkChain(termResult: unknown) {
  const obj: Record<string, unknown> = {};
  const self = () => obj;
  obj.select      = vi.fn(self);
  obj.insert      = vi.fn(self);
  obj.update      = vi.fn(self);
  obj.upsert      = vi.fn(self);
  obj.eq          = vi.fn(self);
  obj.neq         = vi.fn(self);
  obj.is          = vi.fn(self);
  obj.not         = vi.fn(self);
  obj.in          = vi.fn(self);
  obj.ilike       = vi.fn(self);
  obj.or          = vi.fn(self);
  obj.order       = vi.fn(self);
  obj.limit       = vi.fn(self);
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

beforeEach(() => vi.clearAllMocks());

// ── GET /api/problems/:patientId ───────────────────────────────────────────────

describe('GET /api/problems/:patientId', () => {
  it('returns empty array when no problems', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));
    const res = await request(app).get('/api/problems/a0000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(200);
    expect(res.body.problems).toEqual([]);
  });

  it('returns active problems', async () => {
    const rows = [
      { id: PROB_ID, patient_id: PAT_ID, encounter_id: null, condition: 'Hypertension', status: 'active', created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
      { id: 'd0000000-0000-0000-0000-000000000001', patient_id: PAT_ID, encounter_id: null, condition: 'T2DM', status: 'active', created_at: '2026-07-02T00:00:00Z', updated_at: '2026-07-02T00:00:00Z' },
    ];
    mockFrom.mockReturnValueOnce(mkChain(ok(rows)));
    const res = await request(app).get('/api/problems/a0000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(200);
    expect(res.body.problems).toHaveLength(2);
    expect(res.body.problems[0].condition).toBe('Hypertension');
  });

  it('filters by ?status=resolved', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));
    const res = await request(app).get('/api/problems/a0000000-0000-0000-0000-000000000001?status=resolved');
    expect(res.status).toBe(200);
    const chain = mockFrom.mock.results[0].value;
    // eq called for both patient_id and status
    expect(chain.eq).toHaveBeenCalledWith('status', 'resolved');
  });

  it('ignores invalid status filter', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));
    const res = await request(app).get('/api/problems/a0000000-0000-0000-0000-000000000001?status=invalid');
    expect(res.status).toBe(200);
    const chain = mockFrom.mock.results[0].value;
    // eq should only be called for patient_id, not for invalid status
    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls.some((c: unknown[]) => c[0] === 'status')).toBe(false);
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('DB down')));
    const res = await request(app).get('/api/problems/a0000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(502);
  });
});

// ── POST /api/problems ────────────────────────────────────────────────────────

describe('POST /api/problems', () => {
  it('returns 400 when patientId is missing', async () => {
    const res = await request(app).post('/api/problems').send({ condition: 'Hypertension' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/patientId/i);
  });

  it('returns 400 when condition is missing', async () => {
    const res = await request(app).post('/api/problems').send({ patientId: PAT_ID });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/condition/i);
  });

  it('returns 400 when condition is blank', async () => {
    const res = await request(app).post('/api/problems').send({ patientId: PAT_ID, condition: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/condition/i);
  });

  it('creates a problem and returns 201', async () => {
    const created = { id: PROB_ID, condition: 'Hypertension', status: 'active', created_at: '2026-07-31T00:00:00Z' };
    mockFrom.mockReturnValueOnce(mkChain(ok(created)));
    const res = await request(app).post('/api/problems').send({ patientId: PAT_ID, condition: 'Hypertension' });
    expect(res.status).toBe(201);
    expect(res.body.problem.id).toBe(PROB_ID);
    expect(res.body.problem.status).toBe('active');
  });

  it('upserts on conflict (patient_id,condition)', async () => {
    const created = { id: PROB_ID, condition: 'T2DM', status: 'active', created_at: '2026-07-31T00:00:00Z' };
    mockFrom.mockReturnValueOnce(mkChain(ok(created)));
    const res = await request(app).post('/api/problems').send({ patientId: PAT_ID, condition: 'T2DM', encounterId: 'enc-1' });
    expect(res.status).toBe(201);
    const chain = mockFrom.mock.results[0].value;
    expect(chain.upsert).toHaveBeenCalled();
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('insert failed')));
    const res = await request(app).post('/api/problems').send({ patientId: PAT_ID, condition: 'Hypertension' });
    expect(res.status).toBe(502);
  });
});

// ── PATCH /api/problems/resolve-condition ────────────────────────────────────

describe('PATCH /api/problems/resolve-condition', () => {
  it('returns 400 when patientId missing', async () => {
    const res = await request(app).patch('/api/problems/resolve-condition').send({ condition: 'HTN' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/patientId/i);
  });

  it('returns 400 when condition missing', async () => {
    const res = await request(app).patch('/api/problems/resolve-condition').send({ patientId: PAT_ID });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/condition/i);
  });

  it('returns 404 when problem not found', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).patch('/api/problems/resolve-condition').send({ patientId: PAT_ID, condition: 'HTN' });
    expect(res.status).toBe(404);
  });

  it('resolves condition and returns id + status', async () => {
    mockFrom
      .mockReturnValueOnce(mkChain(ok({ id: PROB_ID })))
      .mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).patch('/api/problems/resolve-condition').send({ patientId: PAT_ID, condition: 'HTN' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(PROB_ID);
    expect(res.body.status).toBe('resolved');
  });
});

// ── PATCH /api/problems/:id ───────────────────────────────────────────────────

describe('PATCH /api/problems/:id', () => {
  it('returns 400 for invalid status', async () => {
    const res = await request(app).patch('/api/problems/c0000000-0000-0000-0000-000000000001').send({ status: 'deleted' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
  });

  it('returns 400 for empty body', async () => {
    const res = await request(app).patch('/api/problems/c0000000-0000-0000-0000-000000000001').send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when problem not found', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).patch('/api/problems/c0000000-0000-0000-0000-000000000001').send({ status: 'resolved' });
    expect(res.status).toBe(404);
  });

  it('returns 404 on DB fetch error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('not found')));
    const res = await request(app).patch('/api/problems/c0000000-0000-0000-0000-000000000001').send({ status: 'resolved' });
    expect(res.status).toBe(404);
  });

  it('updates status to resolved', async () => {
    mockFrom
      .mockReturnValueOnce(mkChain(ok({ id: PROB_ID })))
      .mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).patch('/api/problems/c0000000-0000-0000-0000-000000000001').send({ status: 'resolved' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(PROB_ID);
    expect(res.body.status).toBe('resolved');
  });

  it('updates condition text', async () => {
    mockFrom
      .mockReturnValueOnce(mkChain(ok({ id: PROB_ID })))
      .mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).patch('/api/problems/c0000000-0000-0000-0000-000000000001').send({ condition: 'Essential hypertension' });
    expect(res.status).toBe(200);
    expect(res.body.condition).toBe('Essential hypertension');
  });

  it('returns 502 on DB update error', async () => {
    mockFrom
      .mockReturnValueOnce(mkChain(ok({ id: PROB_ID })))
      .mockReturnValueOnce(mkChain(err('update failed')));
    const res = await request(app).patch('/api/problems/c0000000-0000-0000-0000-000000000001').send({ status: 'active' });
    expect(res.status).toBe(502);
  });
});
