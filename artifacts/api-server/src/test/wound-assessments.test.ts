/**
 * Integration tests for wound-assessments API routes.
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

const { default: woundRouter } = await import('../routes/wound-assessments.js');
const app = express();
app.use(express.json());
app.use(woundRouter);

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

beforeEach(() => vi.clearAllMocks());

// ── POST /api/wound-assessments ───────────────────────────────────────────────

describe('POST /api/wound-assessments', () => {
  it('returns 400 when patientId is missing', async () => {
    const res = await request(app).post('/api/wound-assessments')
      .send({ label: 'Laparotomy', assessedDate: '2026-07-31' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/patientId/i);
  });

  it('returns 400 when label is missing', async () => {
    const res = await request(app).post('/api/wound-assessments')
      .send({ patientId: 'pat-1', assessedDate: '2026-07-31' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/label/i);
  });

  it('returns 400 when assessedDate is missing', async () => {
    const res = await request(app).post('/api/wound-assessments')
      .send({ patientId: 'pat-1', label: 'Wound A' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assessedDate/i);
  });

  it('returns 400 for invalid status', async () => {
    const res = await request(app).post('/api/wound-assessments')
      .send({ patientId: 'pat-1', label: 'Wound A', assessedDate: '2026-07-31', status: 'infected' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
  });

  it('creates a wound assessment and returns 201', async () => {
    const row = { id: 'w-uuid-1', patient_id: 'pat-1', label: 'Laparotomy wound',
      status: 'healing', asepsis_score: 0, assessed_date: '2026-07-31',
      drain: 'none', created_at: '2026-07-31T10:00:00Z' };
    mockFrom.mockReturnValueOnce(mkChain(ok(row)));
    mockFrom.mockReturnValue(mkChain(ok(null)));

    const res = await request(app).post('/api/wound-assessments')
      .send({ patientId: 'pat-1', label: 'Laparotomy wound', assessedDate: '2026-07-31',
        status: 'healing', drain: 'none', asepsisScore: 0,
        asepsisDetails: { serous: 0, erythema: 0, purulent: 0, separation: 0, isolatedBacteria: false, prolongedStay: false, additionalTx: 0 } });

    expect(res.status).toBe(201);
    expect(res.body.wound.id).toBe('w-uuid-1');
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('insert failed')));
    const res = await request(app).post('/api/wound-assessments')
      .send({ patientId: 'pat-1', label: 'Wound', assessedDate: '2026-07-31' });
    expect(res.status).toBe(502);
  });
});

// ── GET /api/wound-assessments/patient/:patientId ─────────────────────────────

describe('GET /api/wound-assessments/patient/:patientId', () => {
  it('returns list of wounds for a patient', async () => {
    const rows = [
      { id: 'w-1', label: 'Wound A', status: 'healing',    assessed_date: '2026-07-30' },
      { id: 'w-2', label: 'Wound B', status: 'closed',     assessed_date: '2026-07-25' },
    ];
    mockFrom.mockReturnValueOnce(mkChain(ok(rows)));
    const res = await request(app).get('/api/wound-assessments/patient/pat-1');
    expect(res.status).toBe(200);
    expect(res.body.wounds).toHaveLength(2);
  });

  it('returns empty array when none found', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).get('/api/wound-assessments/patient/pat-none');
    expect(res.status).toBe(200);
    expect(res.body.wounds).toEqual([]);
  });

  it('filters by encounterId when provided', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));
    const res = await request(app).get('/api/wound-assessments/patient/pat-1?encounterId=enc-42');
    expect(res.status).toBe(200);
    const chain = mockFrom.mock.results[0].value;
    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls.some((c: unknown[]) => c[0] === 'encounter_id')).toBe(true);
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('timeout')));
    const res = await request(app).get('/api/wound-assessments/patient/pat-1');
    expect(res.status).toBe(502);
  });
});

// ── PATCH /api/wound-assessments/:id ─────────────────────────────────────────

describe('PATCH /api/wound-assessments/:id', () => {
  it('returns 400 for invalid status', async () => {
    const res = await request(app).patch('/api/wound-assessments/w-1').send({ status: 'bad' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).patch('/api/wound-assessments/w-missing').send({ status: 'healing' });
    expect(res.status).toBe(404);
  });

  it('updates wound and returns 200', async () => {
    const existing = { id: 'w-1', patient_id: 'pat-1' };
    mockFrom.mockReturnValueOnce(mkChain(ok(existing)));
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    mockFrom.mockReturnValue(mkChain(ok(null)));
    const res = await request(app).patch('/api/wound-assessments/w-1').send({ status: 'superficial_ssi', asepsisScore: 15 });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('w-1');
  });

  it('returns 502 on DB error', async () => {
    const existing = { id: 'w-2', patient_id: 'pat-1' };
    mockFrom.mockReturnValueOnce(mkChain(ok(existing)));
    mockFrom.mockReturnValueOnce(mkChain(err('update failed')));
    const res = await request(app).patch('/api/wound-assessments/w-2').send({ notes: 'updated' });
    expect(res.status).toBe(502);
  });
});

// ── DELETE /api/wound-assessments/:id ────────────────────────────────────────

describe('DELETE /api/wound-assessments/:id', () => {
  it('returns 404 when not found', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).delete('/api/wound-assessments/w-gone');
    expect(res.status).toBe(404);
  });

  it('soft-deletes and returns 200', async () => {
    const existing = { id: 'w-1', patient_id: 'pat-1' };
    mockFrom.mockReturnValueOnce(mkChain(ok(existing)));
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    mockFrom.mockReturnValue(mkChain(ok(null)));
    const res = await request(app).delete('/api/wound-assessments/w-1');
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });
});
