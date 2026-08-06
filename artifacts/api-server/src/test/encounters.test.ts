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

const PAT_ID = 'a0000000-0000-0000-0000-000000000001';
const ENC_ID = 'b0000000-0000-0000-0000-000000000001';

const { default: encountersRouter } = await import('../routes/encounters.js');
const app = express();
app.use(express.json());
app.use(encountersRouter);

function mkChain(termResult: unknown) {
  const obj: Record<string, unknown> = {};
  const self = () => obj;
  obj.select      = vi.fn(self);
  obj.insert      = vi.fn(self);
  obj.update      = vi.fn(self);
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

// ── POST /api/encounters ─────────────────────────────────────────────────────

describe('POST /api/encounters', () => {
  it('returns 400 when patientId is missing', async () => {
    const res = await request(app).post('/api/encounters').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/patientId/i);
  });

  it('returns 400 for invalid encounterType', async () => {
    const res = await request(app).post('/api/encounters').send({ patientId: PAT_ID, encounterType: 'walk-in' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/encounterType/i);
  });

  it('returns 400 for invalid site', async () => {
    const res = await request(app).post('/api/encounters').send({ patientId: PAT_ID, site: 'miami' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/site/i);
  });

  it('creates an encounter with defaults and returns 201', async () => {
    const created = { id: 'enc-new', status: 'open', encounter_type: 'outpatient', site: null, chief_complaint: null, created_at: '2026-07-31T10:00:00Z' };
    mockFrom.mockReturnValueOnce(mkChain({ data: created, error: null }));
    const res = await request(app).post('/api/encounters').send({ patientId: PAT_ID });
    expect(res.status).toBe(201);
    expect(res.body.encounter.id).toBe('enc-new');
    expect(res.body.encounter.status).toBe('open');
  });

  it('creates encounter with site and chiefComplaint', async () => {
    const created = { id: 'enc-2', status: 'open', encounter_type: 'outpatient', site: 'tapion', chief_complaint: 'Chest pain', created_at: '2026-07-31T10:00:00Z' };
    mockFrom.mockReturnValueOnce(mkChain({ data: created, error: null }));
    const res = await request(app).post('/api/encounters').send({ patientId: PAT_ID, site: 'tapion', chiefComplaint: 'Chest pain' });
    expect(res.status).toBe(201);
    expect(res.body.encounter.site).toBe('tapion');
  });

  it('returns 502 on DB insert error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('insert failed')));
    const res = await request(app).post('/api/encounters').send({ patientId: PAT_ID });
    expect(res.status).toBe(502);
  });
});

// ── GET /api/encounters/patient/:patientId ─────────────────────────────────────

describe('GET /api/encounters/patient/:patientId', () => {
  it('returns empty array when no encounters', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));
    const res = await request(app).get('/api/encounters/patient/pat-1');
    expect(res.status).toBe(200);
    expect(res.body.encounters).toEqual([]);
  });

  it('returns encounters joined with assessments', async () => {
    const encRows = [
      { id: 'enc-1', created_at: '2026-07-31T10:00:00Z', status: 'open',
        encounter_type: 'outpatient', chief_complaint: 'Abdominal pain', site: 'tapion' },
    ];
    const asmRows = [{ encounter_id: 'enc-1', diagnosis: 'Appendicitis', icd10_code: 'K37' }];
    mockFrom
      .mockReturnValueOnce(mkChain(ok(encRows)))
      .mockReturnValueOnce(mkChain(ok(asmRows)))
      .mockReturnValueOnce(mkChain(ok([]))); // plans join
    const res = await request(app).get('/api/encounters/patient/pat-1');
    expect(res.status).toBe(200);
    expect(res.body.encounters).toHaveLength(1);
    expect(res.body.encounters[0].diagnosis).toBe('Appendicitis');
    expect(res.body.encounters[0].icd10Code).toBe('K37');
    expect(res.body.encounters[0].chiefComplaint).toBe('Abdominal pain');
  });

  it('returns 502 on DB error fetching encounters', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('DB down')));
    const res = await request(app).get('/api/encounters/patient/pat-1');
    expect(res.status).toBe(502);
  });

  it('respects limit query param (capped at 200)', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));
    const res = await request(app).get('/api/encounters/patient/pat-1?limit=5');
    expect(res.status).toBe(200);
    const chain = mockFrom.mock.results[0].value;
    expect(chain.limit).toHaveBeenCalledWith(5);
  });
});

// ── PATCH /api/encounters/:id ─────────────────────────────────────────────────

describe('PATCH /api/encounters/:id', () => {
  it('returns 400 for invalid status', async () => {
    const res = await request(app).patch('/api/encounters/enc-1').send({ status: 'flying' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
  });

  it('returns 400 for invalid encounterType', async () => {
    const res = await request(app).patch('/api/encounters/enc-1').send({ encounterType: 'unknown' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/encounterType/i);
  });

  it('returns 400 for invalid site', async () => {
    const res = await request(app).patch('/api/encounters/enc-1').send({ site: 'miami' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/site/i);
  });

  it('returns 404 when encounter not found', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).patch('/api/encounters/enc-1').send({ status: 'closed' });
    expect(res.status).toBe(404);
  });

  it('returns 404 on DB fetch error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('not found')));
    const res = await request(app).patch('/api/encounters/enc-1').send({ status: 'closed' });
    expect(res.status).toBe(404);
  });

  it('updates encounter and returns id with patch', async () => {
    mockFrom
      .mockReturnValueOnce(mkChain(ok({ id: 'enc-1', patient_id: PAT_ID, status: 'open' })))
      .mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).patch('/api/encounters/enc-1').send({ status: 'closed' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('enc-1');
    expect(res.body.status).toBe('closed');
  });

  it('updates chiefComplaint to null when empty string', async () => {
    mockFrom
      .mockReturnValueOnce(mkChain(ok({ id: 'enc-1', patient_id: PAT_ID, status: 'open' })))
      .mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).patch('/api/encounters/enc-1').send({ chiefComplaint: '' });
    expect(res.status).toBe(200);
    expect(res.body.chief_complaint).toBeNull();
  });

  it('returns 502 on DB update error', async () => {
    mockFrom
      .mockReturnValueOnce(mkChain(ok({ id: 'enc-1', patient_id: PAT_ID, status: 'open' })))
      .mockReturnValueOnce(mkChain(err('update failed')));
    const res = await request(app).patch('/api/encounters/enc-1').send({ status: 'in_progress' });
    expect(res.status).toBe(502);
  });
});
