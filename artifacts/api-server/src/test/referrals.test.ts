/**
 * Integration tests for referrals API routes.
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

vi.mock('../lib/workflow-tasks.js', () => ({
  createWorkflowTask:  vi.fn().mockResolvedValue(undefined),
  resolveWorkflowTask: vi.fn().mockResolvedValue(undefined),
}));

// ── App setup ─────────────────────────────────────────────────────────────────

const { default: referralsRouter } = await import('../routes/referrals.js');
import { createWorkflowTask, resolveWorkflowTask } from '../lib/workflow-tasks.js';

const app = express();
app.use(express.json());
app.use(referralsRouter);

// ── Chain helper ──────────────────────────────────────────────────────────────

function mkChain(termResult: unknown) {
  const obj: Record<string, unknown> = {};
  const self = () => obj;
  obj.select      = vi.fn(self);
  obj.insert      = vi.fn(self);
  obj.update      = vi.fn(self);
  obj.eq          = vi.fn(self);
  obj.neq         = vi.fn(self);
  obj.in          = vi.fn(self);
  obj.not         = vi.fn(self);
  obj.is          = vi.fn(self);
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

// ── POST /api/referrals ───────────────────────────────────────────────────────

describe('POST /api/referrals', () => {
  it('returns 400 when patientId is missing', async () => {
    const res = await request(app)
      .post('/api/referrals')
      .send({ referralTo: 'Dr Smith' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/patientId/i);
  });

  it('returns 400 when referralTo is missing', async () => {
    const res = await request(app)
      .post('/api/referrals')
      .send({ patientId: 'pat-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/referralTo/i);
  });

  it('returns 400 for invalid urgency', async () => {
    const res = await request(app)
      .post('/api/referrals')
      .send({ patientId: 'pat-1', referralTo: 'Dr Jones', urgency: 'asap' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/urgency/i);
  });

  it('creates a routine referral and returns 201', async () => {
    const referral = {
      id: 'ref-uuid-1', patient_id: 'pat-1', encounter_id: null,
      referral_to: 'Dr Smith', specialty: 'Gastroenterology',
      reason: 'Colonoscopy', urgency: 'routine',
      referral_type: 'specialist', expected_days: 14,
      status: 'pending', notes: null, created_at: '2026-07-30T10:00:00Z',
    };
    mockFrom.mockReturnValueOnce(mkChain(ok(referral))); // insert referral
    mockFrom.mockReturnValue(mkChain(ok(null)));          // audit

    const res = await request(app)
      .post('/api/referrals')
      .send({
        patientId: 'pat-1', referralTo: 'Dr Smith',
        specialty: 'Gastroenterology', reason: 'Colonoscopy',
      });

    expect(res.status).toBe(201);
    expect(res.body.referral).toMatchObject({ id: 'ref-uuid-1', status: 'pending' });
    expect(createWorkflowTask).not.toHaveBeenCalled();
  });

  it('creates an urgent referral and spawns await_referral task', async () => {
    const referral = {
      id: 'ref-uuid-2', patient_id: 'pat-1', encounter_id: 'enc-1',
      referral_to: 'Oncology', specialty: 'Oncology',
      reason: 'Urgent review', urgency: 'urgent',
      referral_type: 'specialist', expected_days: 14,
      status: 'pending', notes: null, created_at: '2026-07-30T10:00:00Z',
    };
    mockFrom.mockReturnValueOnce(mkChain(ok(referral)));
    mockFrom.mockReturnValue(mkChain(ok(null)));

    const res = await request(app)
      .post('/api/referrals')
      .send({
        patientId: 'pat-1', encounterId: 'enc-1',
        referralTo: 'Oncology', urgency: 'urgent',
      });

    expect(res.status).toBe(201);
    expect(createWorkflowTask).toHaveBeenCalledWith(
      expect.objectContaining({ task_type: 'await_referral', priority: 'high' }),
    );
  });

  it('creates a soon referral with normal task priority', async () => {
    const referral = {
      id: 'ref-uuid-3', patient_id: 'pat-2', encounter_id: null,
      referral_to: 'Cardiology', specialty: null,
      reason: null, urgency: 'soon',
      referral_type: 'specialist', expected_days: 14,
      status: 'pending', notes: null, created_at: '2026-07-30T10:00:00Z',
    };
    mockFrom.mockReturnValueOnce(mkChain(ok(referral)));
    mockFrom.mockReturnValue(mkChain(ok(null)));

    const res = await request(app)
      .post('/api/referrals')
      .send({ patientId: 'pat-2', referralTo: 'Cardiology', urgency: 'soon' });

    expect(res.status).toBe(201);
    expect(createWorkflowTask).toHaveBeenCalledWith(
      expect.objectContaining({ task_type: 'await_referral', priority: 'normal' }),
    );
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('insert failed')));

    const res = await request(app)
      .post('/api/referrals')
      .send({ patientId: 'pat-1', referralTo: 'Dr Jones' });

    expect(res.status).toBe(502);
  });
});

// ── GET /api/referrals/patient/:patientId ─────────────────────────────────────

describe('GET /api/referrals/patient/:patientId', () => {
  it('returns referral list for a patient', async () => {
    const rows = [
      { id: 'r1', referral_to: 'Dr A', status: 'pending', created_at: '2026-07-01T00:00:00Z' },
      { id: 'r2', referral_to: 'Dr B', status: 'sent',    created_at: '2026-07-15T00:00:00Z' },
    ];
    mockFrom.mockReturnValueOnce(mkChain(ok(rows)));

    const res = await request(app).get('/api/referrals/patient/pat-1');

    expect(res.status).toBe(200);
    expect(res.body.referrals).toHaveLength(2);
    expect(res.body.referrals[0].id).toBe('r1');
  });

  it('returns empty array when no referrals exist', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));

    const res = await request(app).get('/api/referrals/patient/pat-no-refs');

    expect(res.status).toBe(200);
    expect(res.body.referrals).toEqual([]);
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('timeout')));

    const res = await request(app).get('/api/referrals/patient/pat-1');

    expect(res.status).toBe(502);
  });
});

// ── GET /api/referrals/open ───────────────────────────────────────────────────

describe('GET /api/referrals/open', () => {
  it('returns open referrals with default limit 50', async () => {
    const rows = [{ id: 'r1', status: 'pending' }, { id: 'r2', status: 'sent' }];
    mockFrom.mockReturnValueOnce(mkChain(ok(rows)));

    const res = await request(app).get('/api/referrals/open');

    expect(res.status).toBe(200);
    expect(res.body.referrals).toHaveLength(2);
  });

  it('respects ?limit query param (capped at 100)', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));

    const res = await request(app).get('/api/referrals/open?limit=200');

    expect(res.status).toBe(200);
    // limit() should be called with 100 (capped)
    const chain = mockFrom.mock.results[0].value;
    expect(chain.limit).toHaveBeenCalledWith(100);
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('db error')));

    const res = await request(app).get('/api/referrals/open');

    expect(res.status).toBe(502);
  });
});

// ── PATCH /api/referrals/:id ──────────────────────────────────────────────────

describe('PATCH /api/referrals/:id', () => {
  it('returns 400 for invalid status', async () => {
    const res = await request(app)
      .patch('/api/referrals/ref-1')
      .send({ status: 'unknown' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
  });

  it('returns 404 when referral not found', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));

    const res = await request(app)
      .patch('/api/referrals/ref-missing')
      .send({ status: 'sent' });

    expect(res.status).toBe(404);
  });

  it('transitions status to sent and creates await_referral task', async () => {
    const existing = {
      id: 'ref-1', patient_id: 'pat-1', encounter_id: 'enc-1',
      status: 'pending', referral_to: 'Dr Smith', referral_type: 'specialist',
    };
    mockFrom.mockReturnValueOnce(mkChain(ok(existing))); // fetch
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));      // update
    mockFrom.mockReturnValue(mkChain(ok(null)));           // audit

    const res = await request(app)
      .patch('/api/referrals/ref-1')
      .send({ status: 'sent' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'ref-1', status: 'sent' });
    expect(createWorkflowTask).toHaveBeenCalledWith(
      expect.objectContaining({ task_type: 'await_referral', source_id: 'ref-1' }),
    );
  });

  it('transitions status to accepted and resolves await_referral task', async () => {
    const existing = {
      id: 'ref-2', patient_id: 'pat-1', encounter_id: null,
      status: 'sent', referral_to: 'Cardiology', referral_type: 'specialist',
    };
    mockFrom.mockReturnValueOnce(mkChain(ok(existing)));
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    mockFrom.mockReturnValue(mkChain(ok(null)));

    const res = await request(app)
      .patch('/api/referrals/ref-2')
      .send({ status: 'accepted' });

    expect(res.status).toBe(200);
    expect(resolveWorkflowTask).toHaveBeenCalledWith(
      expect.objectContaining({ task_type: 'await_referral', source_id: 'ref-2' }),
    );
  });

  it('transitions status to declined and resolves task', async () => {
    const existing = {
      id: 'ref-3', patient_id: 'pat-2', encounter_id: null,
      status: 'sent', referral_to: 'ENT', referral_type: 'specialist',
    };
    mockFrom.mockReturnValueOnce(mkChain(ok(existing)));
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    mockFrom.mockReturnValue(mkChain(ok(null)));

    const res = await request(app)
      .patch('/api/referrals/ref-3')
      .send({ status: 'declined' });

    expect(res.status).toBe(200);
    expect(resolveWorkflowTask).toHaveBeenCalled();
  });

  it('updates notes without changing status', async () => {
    const existing = {
      id: 'ref-4', patient_id: 'pat-1', encounter_id: null,
      status: 'pending', referral_to: 'Urology', referral_type: 'specialist',
    };
    mockFrom.mockReturnValueOnce(mkChain(ok(existing)));
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    mockFrom.mockReturnValue(mkChain(ok(null)));

    const res = await request(app)
      .patch('/api/referrals/ref-4')
      .send({ notes: 'Patient prefers morning appointments' });

    expect(res.status).toBe(200);
    expect(createWorkflowTask).not.toHaveBeenCalled();
    expect(resolveWorkflowTask).not.toHaveBeenCalled();
  });

  it('returns 502 on DB update error', async () => {
    const existing = {
      id: 'ref-5', patient_id: 'pat-1', encounter_id: null,
      status: 'pending', referral_to: 'Rheumatology', referral_type: 'specialist',
    };
    mockFrom.mockReturnValueOnce(mkChain(ok(existing)));
    mockFrom.mockReturnValueOnce(mkChain(err('update failed')));

    const res = await request(app)
      .patch('/api/referrals/ref-5')
      .send({ status: 'sent' });

    expect(res.status).toBe(502);
  });
});

// ── GET /api/referrals/open-tasks/:patientId ──────────────────────────────────

describe('GET /api/referrals/open-tasks/:patientId', () => {
  it('returns open tasks for a patient', async () => {
    const tasks = [
      { id: 't1', task_type: 'await_referral', status: 'open', priority: 'high' },
    ];
    mockFrom.mockReturnValueOnce(mkChain(ok(tasks)));

    const res = await request(app).get('/api/referrals/open-tasks/pat-1');

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].task_type).toBe('await_referral');
  });

  it('returns empty array when no open tasks', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));

    const res = await request(app).get('/api/referrals/open-tasks/pat-none');

    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([]);
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('query failed')));

    const res = await request(app).get('/api/referrals/open-tasks/pat-1');

    expect(res.status).toBe(502);
  });
});
