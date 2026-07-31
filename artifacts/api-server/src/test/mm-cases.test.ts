/**
 * Integration tests for mm-cases API routes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockFrom = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
  requireStaffAuth: vi.fn().mockResolvedValue(true),
  getStaffUserId:   vi.fn().mockResolvedValue('staff-uuid'),
  audit:            vi.fn().mockResolvedValue(undefined),
}));

const { default: mmRouter } = await import('../routes/mm-cases.js');
const app = express();
app.use(express.json());
app.use(mmRouter);

function mkChain(termResult: unknown) {
  const obj: Record<string, unknown> = {};
  const self = () => obj;
  obj.select      = vi.fn(self);
  obj.insert      = vi.fn(self);
  obj.update      = vi.fn(self);
  obj.delete      = vi.fn(self);
  obj.eq          = vi.fn(self);
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

// ── POST /api/mm-cases ────────────────────────────────────────────────────────

describe('POST /api/mm-cases', () => {
  it('returns 400 when procedure is missing', async () => {
    const res = await request(app).post('/api/mm-cases')
      .send({ complication: 'Wound dehiscence', date: '2026-07-31' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/procedure/i);
  });

  it('returns 400 when complication is missing', async () => {
    const res = await request(app).post('/api/mm-cases')
      .send({ procedure: 'Laparotomy', date: '2026-07-31' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/complication/i);
  });

  it('returns 400 when date is missing', async () => {
    const res = await request(app).post('/api/mm-cases')
      .send({ procedure: 'Laparotomy', complication: 'Wound dehiscence' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/date/i);
  });

  it('returns 400 for invalid category', async () => {
    const res = await request(app).post('/api/mm-cases')
      .send({ procedure: 'Lap chol', complication: 'Bile leak', date: '2026-07-31', category: 'unknown' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/category/i);
  });

  it('returns 400 for invalid grade', async () => {
    const res = await request(app).post('/api/mm-cases')
      .send({ procedure: 'Lap chol', complication: 'Bile leak', date: '2026-07-31', grade: 'VI' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/grade/i);
  });

  it('creates a case and returns 201', async () => {
    const row = {
      id: 'mm-uuid-1', date: '2026-07-31', patient_ref: null,
      procedure: 'Laparotomy', complication: 'SSI', category: 'early_postop',
      grade: 'II', grade_suffix: false, contributing: [], re_operation: false,
      icu_admission: false, death: false, lessons_learned: null,
      action_items: null, review_status: 'pending', review_date: null,
      reviewed_by: null, created_at: '2026-07-31T10:00:00Z',
    };
    mockFrom.mockReturnValueOnce(mkChain(ok(row)));
    mockFrom.mockReturnValue(mkChain(ok(null)));

    const res = await request(app).post('/api/mm-cases').send({
      procedure: 'Laparotomy', complication: 'SSI',
      date: '2026-07-31', category: 'early_postop', grade: 'II',
    });

    expect(res.status).toBe(201);
    expect(res.body.case.id).toBe('mm-uuid-1');
    expect(res.body.case.category).toBe('early_postop');
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('insert failed')));
    const res = await request(app).post('/api/mm-cases')
      .send({ procedure: 'Lap chol', complication: 'Bile leak', date: '2026-07-31' });
    expect(res.status).toBe(502);
  });
});

// ── GET /api/mm-cases ─────────────────────────────────────────────────────────

describe('GET /api/mm-cases', () => {
  it('returns list of cases', async () => {
    const rows = [
      { id: 'mm-1', procedure: 'Lap chol', category: 'early_postop', review_status: 'pending' },
      { id: 'mm-2', procedure: 'Appendectomy', category: 'intraoperative', review_status: 'reviewed' },
    ];
    mockFrom.mockReturnValueOnce(mkChain(ok(rows)));
    const res = await request(app).get('/api/mm-cases');
    expect(res.status).toBe(200);
    expect(res.body.cases).toHaveLength(2);
  });

  it('returns empty array when none found', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).get('/api/mm-cases');
    expect(res.status).toBe(200);
    expect(res.body.cases).toEqual([]);
  });

  it('filters by reviewStatus when provided', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));
    const res = await request(app).get('/api/mm-cases?reviewStatus=pending');
    expect(res.status).toBe(200);
    const chain = mockFrom.mock.results[0].value;
    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls.some((c: unknown[]) => c[0] === 'review_status')).toBe(true);
  });

  it('filters by grade when provided', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));
    const res = await request(app).get('/api/mm-cases?grade=IIIa');
    expect(res.status).toBe(200);
    const chain = mockFrom.mock.results[0].value;
    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls.some((c: unknown[]) => c[0] === 'grade')).toBe(true);
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('timeout')));
    const res = await request(app).get('/api/mm-cases');
    expect(res.status).toBe(502);
  });
});

// ── PATCH /api/mm-cases/:id ───────────────────────────────────────────────────

describe('PATCH /api/mm-cases/:id', () => {
  it('returns 400 for invalid category', async () => {
    const res = await request(app).patch('/api/mm-cases/mm-1').send({ category: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/category/i);
  });

  it('returns 400 for invalid grade', async () => {
    const res = await request(app).patch('/api/mm-cases/mm-1').send({ grade: 'VI' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/grade/i);
  });

  it('returns 400 for invalid reviewStatus', async () => {
    const res = await request(app).patch('/api/mm-cases/mm-1').send({ reviewStatus: 'closed' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reviewStatus/i);
  });

  it('returns 404 when not found', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).patch('/api/mm-cases/mm-missing').send({ reviewStatus: 'reviewed' });
    expect(res.status).toBe(404);
  });

  it('updates case and returns 200', async () => {
    const existing = { id: 'mm-1', review_status: 'pending' };
    mockFrom.mockReturnValueOnce(mkChain(ok(existing)));
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    mockFrom.mockReturnValue(mkChain(ok(null)));
    const res = await request(app).patch('/api/mm-cases/mm-1').send({ reviewStatus: 'reviewed', grade: 'IIIa' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('mm-1');
    expect(res.body.reviewStatus).toBe('reviewed');
  });

  it('returns 502 on DB error', async () => {
    const existing = { id: 'mm-2', review_status: 'pending' };
    mockFrom.mockReturnValueOnce(mkChain(ok(existing)));
    mockFrom.mockReturnValueOnce(mkChain(err('update failed')));
    const res = await request(app).patch('/api/mm-cases/mm-2').send({ lessonsLearned: 'check prep' });
    expect(res.status).toBe(502);
  });
});

// ── DELETE /api/mm-cases/:id ──────────────────────────────────────────────────

describe('DELETE /api/mm-cases/:id', () => {
  it('returns 404 when not found', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).delete('/api/mm-cases/mm-gone');
    expect(res.status).toBe(404);
  });

  it('hard-deletes and returns 200', async () => {
    const existing = { id: 'mm-1' };
    mockFrom.mockReturnValueOnce(mkChain(ok(existing)));
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    mockFrom.mockReturnValue(mkChain(ok(null)));
    const res = await request(app).delete('/api/mm-cases/mm-1');
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });
});
