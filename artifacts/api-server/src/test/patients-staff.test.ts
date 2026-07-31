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

const { default: patientsStaffRouter } = await import('../routes/patients-staff.js');
const app = express();
app.use(express.json());
app.use(patientsStaffRouter);

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

// ── GET /api/patients ────────────────────────────────────────────────────────

describe('GET /api/patients', () => {
  it('returns empty patients array', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));
    const res = await request(app).get('/api/patients');
    expect(res.status).toBe(200);
    expect(res.body.patients).toEqual([]);
  });

  it('returns patient list ordered by created_at', async () => {
    const patients = [
      { id: 'pat-1', full_name: 'Jane Doe', sex: 'female', phone: '+17584001234',
        date_of_birth: '1980-05-10', created_at: '2026-07-31T10:00:00Z' },
    ];
    mockFrom.mockReturnValueOnce(mkChain(ok(patients)));
    const res = await request(app).get('/api/patients');
    expect(res.status).toBe(200);
    expect(res.body.patients).toHaveLength(1);
    expect(res.body.patients[0].full_name).toBe('Jane Doe');
  });

  it('searches by name when q param provided', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));
    const res = await request(app).get('/api/patients?q=john');
    expect(res.status).toBe(200);
    const chain = mockFrom.mock.results[0].value;
    expect(chain.ilike).toHaveBeenCalledWith('full_name', '%john%');
  });

  it('searches by phone when q looks like a phone number', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));
    const res = await request(app).get('/api/patients?q=%2B17584001234');
    expect(res.status).toBe(200);
    const chain = mockFrom.mock.results[0].value;
    expect(chain.ilike).toHaveBeenCalledWith('phone', expect.stringContaining('17584001234'));
  });

  it('filters by site when site param is valid', async () => {
    mockFrom
      .mockReturnValueOnce(mkChain(ok([{ patient_id: 'pat-1' }]))) // encounters query
      .mockReturnValueOnce(mkChain(ok([{ id: 'pat-1', full_name: 'John' }]))); // patients query
    const res = await request(app).get('/api/patients?site=tapion');
    expect(res.status).toBe(200);
    expect(res.body.patients).toHaveLength(1);
  });

  it('returns empty array when site filter yields no encounter patients', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));
    const res = await request(app).get('/api/patients?site=castries');
    expect(res.status).toBe(200);
    expect(res.body.patients).toEqual([]);
  });

  it('ignores invalid site param and lists all patients', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));
    const res = await request(app).get('/api/patients?site=miami');
    expect(res.status).toBe(200);
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('DB down')));
    const res = await request(app).get('/api/patients');
    expect(res.status).toBe(502);
  });
});

// ── GET /api/patients/:id ─────────────────────────────────────────────────────

describe('GET /api/patients/:id', () => {
  it('returns patient data', async () => {
    const patient = { id: 'pat-1', full_name: 'Jane Doe', sex: 'female', phone: null,
      date_of_birth: '1980-05-10', email: null, address: null, photo_url: null,
      mrn: null, created_at: '2026-07-31T10:00:00Z' };
    mockFrom.mockReturnValueOnce(mkChain(ok(patient)));
    const res = await request(app).get('/api/patients/pat-1');
    expect(res.status).toBe(200);
    expect(res.body.patient.full_name).toBe('Jane Doe');
  });

  it('returns 404 when patient not found', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).get('/api/patients/no-such-id');
    expect(res.status).toBe(404);
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('DB error')));
    const res = await request(app).get('/api/patients/pat-1');
    expect(res.status).toBe(502);
  });
});

// ── POST /api/patients ────────────────────────────────────────────────────────

describe('POST /api/patients', () => {
  it('returns 400 when fullName is missing', async () => {
    const res = await request(app).post('/api/patients').send({ sex: 'male' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fullName/i);
  });

  it('returns 400 when fullName is blank', async () => {
    const res = await request(app).post('/api/patients').send({ fullName: '   ' });
    expect(res.status).toBe(400);
  });

  it('creates patient and returns 201', async () => {
    const row = { id: 'pat-new', full_name: 'Mary Jane' };
    mockFrom.mockReturnValueOnce(mkChain(ok(row)));
    const res = await request(app).post('/api/patients')
      .send({ fullName: 'Mary Jane', sex: 'female', phone: '+17584001234' });
    expect(res.status).toBe(201);
    expect(res.body.patient.id).toBe('pat-new');
    expect(res.body.patient.full_name).toBe('Mary Jane');
  });

  it('accepts snake_case full_name alias', async () => {
    const row = { id: 'pat-new2', full_name: 'John Smith' };
    mockFrom.mockReturnValueOnce(mkChain(ok(row)));
    const res = await request(app).post('/api/patients')
      .send({ full_name: 'John Smith' });
    expect(res.status).toBe(201);
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('insert failed')));
    const res = await request(app).post('/api/patients')
      .send({ fullName: 'Test Patient' });
    expect(res.status).toBe(502);
  });
});

// ── PATCH /api/patients/:id ───────────────────────────────────────────────────

describe('PATCH /api/patients/:id', () => {
  it('returns 400 for invalid sex', async () => {
    const res = await request(app).patch('/api/patients/pat-1').send({ sex: 'alien' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sex/i);
  });

  it('returns 404 when patient not found', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).patch('/api/patients/pat-1').send({ sex: 'male' });
    expect(res.status).toBe(404);
  });

  it('returns 404 on DB fetch error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('fetch error')));
    const res = await request(app).patch('/api/patients/pat-1').send({ sex: 'female' });
    expect(res.status).toBe(404);
  });

  it('updates patient fields and returns id', async () => {
    mockFrom
      .mockReturnValueOnce(mkChain(ok({ id: 'pat-1' })))
      .mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).patch('/api/patients/pat-1')
      .send({ fullName: 'Jane Updated', sex: 'female', phone: '+17581234567' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('pat-1');
  });

  it('returns 502 on DB update error', async () => {
    mockFrom
      .mockReturnValueOnce(mkChain(ok({ id: 'pat-1' })))
      .mockReturnValueOnce(mkChain(err('update failed')));
    const res = await request(app).patch('/api/patients/pat-1').send({ sex: 'male' });
    expect(res.status).toBe(502);
  });
});
