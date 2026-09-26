/**
 * Visit-lifecycle route tests.
 * requireStaffAuth is bypassed (always returns true).
 * Supabase queries are fully mocked — no network calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Supabase mock ─────────────────────────────────────────────────────────────

type QueryResult = { data: unknown; error: null | { message: string } };

function makeQuery(result: QueryResult) {
  const q: Record<string, unknown> & { _result: QueryResult } = {
    _result: result,
    // Makes `await query` resolve to `result`
    then: (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  for (const m of ['select','update','insert','delete','upsert','eq','neq','in','not','is','order','limit']) {
    q[m] = vi.fn().mockReturnValue(q);
  }
  q['maybeSingle'] = vi.fn().mockResolvedValue(result);
  q['single'] = vi.fn().mockResolvedValue(result);
  return q;
}

const mockFrom = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  sb: () => ({ from: mockFrom, auth: { getUser: vi.fn() } }),
  getSupabaseAdmin: () => ({ from: mockFrom, auth: { getUser: vi.fn() } }),
  requireStaffAuth: vi.fn().mockResolvedValue(true),
  requireCronSecret: vi.fn().mockReturnValue(true),
  getStaffUserId: vi.fn().mockResolvedValue('staff-uuid'),
  audit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/audit.js', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));

// ── App setup ─────────────────────────────────────────────────────────────────

const { default: visitLifecycleRouter } = await import('../routes/visit-lifecycle.js');
const app = express();
app.use(express.json());
app.use(visitLifecycleRouter);

const AUTH = { 'x-staff-token': 'test-cron-secret' };

// ── Helpers ───────────────────────────────────────────────────────────────────

const ok = (data: unknown): QueryResult => ({ data, error: null });
const empty = (): QueryResult => ({ data: null, error: null });
const notFound = (): QueryResult => ({ data: null, error: null });
const dbErr = (msg: string): QueryResult => ({ data: null, error: { message: msg } });

// ── POST /api/visit/sign-notes/:encounterId ───────────────────────────────────

describe('POST /api/visit/sign-notes/:encounterId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs draft notes and returns count', async () => {
    // Call 1: fetch encounter
    mockFrom.mockReturnValueOnce(makeQuery(ok({ id: 'enc-1', patient_id: 'pat-1' })));
    // Call 2: update clinical_notes → 2 rows updated
    mockFrom.mockReturnValueOnce(makeQuery(ok([{ id: 'note-a' }, { id: 'note-b' }])));
    // Call 3: audit_logs insert (from audit())
    mockFrom.mockReturnValue(makeQuery(empty()));

    const res = await request(app)
      .post('/api/visit/sign-notes/enc-1')
      .set(AUTH)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ encounterId: 'enc-1', signed: 2 });
  });

  it('returns signed: 0 when no draft notes exist (idempotent)', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok({ id: 'enc-1', patient_id: 'pat-1' })));
    mockFrom.mockReturnValueOnce(makeQuery(ok([])));  // empty array → 0 signed
    mockFrom.mockReturnValue(makeQuery(empty()));

    const res = await request(app)
      .post('/api/visit/sign-notes/enc-1')
      .set(AUTH)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ encounterId: 'enc-1', signed: 0 });
  });

  it('returns 404 when encounter not found', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(notFound()));

    const res = await request(app)
      .post('/api/visit/sign-notes/missing-enc')
      .set(AUTH)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 502 when the DB update fails', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok({ id: 'enc-1', patient_id: 'pat-1' })));
    mockFrom.mockReturnValueOnce(makeQuery(dbErr('connection timeout')));

    const res = await request(app)
      .post('/api/visit/sign-notes/enc-1')
      .set(AUTH)
      .send({});

    expect(res.status).toBe(502);
  });
});

// ── POST /api/visit/complete/:encounterId ─────────────────────────────────────

describe('POST /api/visit/complete/:encounterId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('closes an open encounter, signs draft notes first', async () => {
    // 1. fetch encounter
    mockFrom.mockReturnValueOnce(makeQuery(ok({ id: 'enc-1', patient_id: 'pat-1', status: 'open' })));
    // 2. upsert plan
    mockFrom.mockReturnValueOnce(makeQuery(empty()));
    // 3. sign clinical_notes (auto-sign before close)
    mockFrom.mockReturnValueOnce(makeQuery(ok([{ id: 'n1' }])));
    // 4. close encounter
    mockFrom.mockReturnValueOnce(makeQuery(empty()));
    // 5+ audit_logs
    mockFrom.mockReturnValue(makeQuery(empty()));

    const res = await request(app)
      .post('/api/visit/complete/enc-1')
      .set(AUTH)
      .send({ planType: 'management', description: 'Follow up in 6 weeks' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ encounterId: 'enc-1', status: 'closed' });
  });

  it('stores the chief complaint on the closed encounter for the next visit (and only when sent)', async () => {
    const closeQuery = makeQuery(empty());
    mockFrom.mockReturnValueOnce(makeQuery(ok({ id: 'enc-1', patient_id: 'pat-1', status: 'open' })));
    mockFrom.mockReturnValueOnce(makeQuery(empty()));       // plan upsert
    mockFrom.mockReturnValueOnce(makeQuery(ok([])));        // sign notes
    mockFrom.mockReturnValueOnce(closeQuery);               // close encounter
    mockFrom.mockReturnValue(makeQuery(empty()));

    const res = await request(app)
      .post('/api/visit/complete/enc-1')
      .set(AUTH)
      .send({ description: 'Review in 2 weeks', chiefComplaint: '  RUQ pain after fatty food  ' });

    expect(res.status).toBe(200);
    expect(closeQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'closed', chief_complaint: 'RUQ pain after fatty food',
    }));

    // Without a complaint the stored one is left alone.
    const closeQuery2 = makeQuery(empty());
    mockFrom.mockReset();
    mockFrom.mockReturnValueOnce(makeQuery(ok({ id: 'enc-2', patient_id: 'pat-1', status: 'open' })));
    mockFrom.mockReturnValueOnce(makeQuery(empty()));
    mockFrom.mockReturnValueOnce(makeQuery(ok([])));
    mockFrom.mockReturnValueOnce(closeQuery2);
    mockFrom.mockReturnValue(makeQuery(empty()));
    await request(app).post('/api/visit/complete/enc-2').set(AUTH).send({ chiefComplaint: '   ' });
    expect(closeQuery2.update).toHaveBeenCalledWith(expect.not.objectContaining({ chief_complaint: expect.anything() }));
  });

  it('returns 404 when encounter already closed or not found', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(notFound()));

    const res = await request(app)
      .post('/api/visit/complete/enc-gone')
      .set(AUTH)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found|already closed/i);
  });

  it('creates a referral record when referralTo is provided', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok({ id: 'enc-1', patient_id: 'pat-1', status: 'open' })));
    mockFrom.mockReturnValueOnce(makeQuery(empty())); // plan upsert
    const referralQuery = makeQuery(empty());
    mockFrom.mockReturnValueOnce(referralQuery);     // referral insert
    mockFrom.mockReturnValueOnce(makeQuery(empty())); // sign notes
    mockFrom.mockReturnValueOnce(makeQuery(empty())); // close encounter
    mockFrom.mockReturnValue(makeQuery(empty()));

    const res = await request(app)
      .post('/api/visit/complete/enc-1')
      .set(AUTH)
      .send({ referralTo: 'Dr Smith', referralSpecialty: 'Gastroenterology', referralUrgency: 'urgent' });

    expect(res.status).toBe(200);
    // Referral insert was called
    const insertCalls = (mockFrom.mock.calls as string[][]).filter(([t]) => t === 'referrals');
    expect(insertCalls.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Outcomes loop: prediction snapshot at completion (Migration 94) ──────────────

describe('POST /api/visit/complete/:encounterId — prediction snapshot', () => {
  const ENC = '11111111-2222-4333-8444-555555555555';
  const SNAPSHOT = {
    platform: 'web', encounterRef: 'web:someone-elses-encounter', completedAt: '2026-09-26T14:00:00.000Z',
    differentialEngine: 'pane', differentialModelVersion: '1.0.1', modelVersions: { pane: '1.0.1' },
    topDifferential: [{ rank: 1, diseaseId: 'acute_appendicitis', icd10: 'K35.80 — Acute appendicitis', probability: 0.72 }],
    triageLevel: 'priority', triageScale: 'web-adaptive', scores: [{ key: 'alvarado', value: 8, source: 'calculator' }],
    decisionBands: [], features: { rlq_pain: true }, workingDiseaseId: 'acute_appendicitis', workingIcd10: 'K35.80',
    recordedIcd10: ['K35.80'], outcomeTriggers: ['operation'], hpi: 'free text that must not be stored',
  };

  function queueUntilClose() {
    mockFrom.mockReturnValueOnce(makeQuery(ok({ id: ENC, patient_id: 'pat-1', status: 'open' })));
    mockFrom.mockReturnValueOnce(makeQuery(empty()));   // plan upsert
    mockFrom.mockReturnValueOnce(makeQuery(ok([])));    // sign notes
    mockFrom.mockReturnValueOnce(makeQuery(empty()));   // close encounter
  }

  beforeEach(() => { vi.clearAllMocks(); mockFrom.mockReset(); });

  it('stores only coded values, keyed to this encounter (first completion wins)', async () => {
    queueUntilClose();
    const snapQuery = makeQuery(ok([{ id: 'snap-1' }]));
    mockFrom.mockReturnValueOnce(snapQuery);
    mockFrom.mockReturnValue(makeQuery(empty()));

    const res = await request(app).post(`/api/visit/complete/${ENC}`).set(AUTH).send({ predictionSnapshot: SNAPSHOT });

    expect(res.status).toBe(200);
    expect(res.body.predictionSnapshot).toBe('saved');
    expect(mockFrom).toHaveBeenCalledWith('prediction_snapshots');
    const [row, opts] = (snapQuery.upsert as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts).toEqual({ onConflict: 'encounter_ref', ignoreDuplicates: true });
    expect(row).toMatchObject({
      patient_id: 'pat-1', encounter_id: ENC, encounter_ref: `web:${ENC}`, platform: 'web',
      top_differential: [{ rank: 1, diseaseId: 'acute_appendicitis', icd10: 'K35.80', probability: 0.72 }],
      expects_outcome: true, outcome_triggers: ['operation'],
    });
    expect(JSON.stringify(row)).not.toContain('free text');
    expect(JSON.stringify(row)).not.toContain('someone-elses');
  });

  it('still closes the encounter when the table is missing (Migration 94 not applied)', async () => {
    queueUntilClose();
    mockFrom.mockReturnValueOnce(makeQuery({ data: null, error: { message: 'relation does not exist', code: '42P01' } as never }));
    mockFrom.mockReturnValue(makeQuery(empty()));

    const res = await request(app).post(`/api/visit/complete/${ENC}`).set(AUTH).send({ predictionSnapshot: SNAPSHOT });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'closed', predictionSnapshot: 'unavailable' });

    // PostgREST's own "not in the schema cache" code is treated the same way.
    queueUntilClose();
    mockFrom.mockReturnValueOnce(makeQuery({ data: null, error: { message: 'Could not find the table', code: 'PGRST205' } as never }));
    mockFrom.mockReturnValue(makeQuery(empty()));
    const res2 = await request(app).post(`/api/visit/complete/${ENC}`).set(AUTH).send({ predictionSnapshot: SNAPSHOT });
    expect(res2.body).toMatchObject({ status: 'closed', predictionSnapshot: 'unavailable' });
  });

  it('an existing snapshot is kept; a malformed one is refused; neither blocks the completion', async () => {
    queueUntilClose();
    mockFrom.mockReturnValueOnce(makeQuery(ok([])));  // ignoreDuplicates: nothing inserted
    mockFrom.mockReturnValue(makeQuery(empty()));
    const res = await request(app).post(`/api/visit/complete/${ENC}`).set(AUTH).send({ predictionSnapshot: SNAPSHOT });
    expect(res.body.predictionSnapshot).toBe('exists');

    mockFrom.mockReset();
    queueUntilClose();
    mockFrom.mockReturnValue(makeQuery(empty()));
    const bad = await request(app).post(`/api/visit/complete/${ENC}`).set(AUTH)
      .send({ predictionSnapshot: { ...SNAPSHOT, differentialModelVersion: '' } });
    expect(bad.status).toBe(200);
    expect(bad.body.predictionSnapshot).toBe('invalid');
    expect(mockFrom).not.toHaveBeenCalledWith('prediction_snapshots');

    queueUntilClose();
    mockFrom.mockReturnValue(makeQuery(empty()));
    const none = await request(app).post(`/api/visit/complete/${ENC}`).set(AUTH).send({});
    expect(none.body.predictionSnapshot).toBe('none');
  });
});

// ── POST /api/visit/reopen/:encounterId ────────────────────────────────────────

describe('POST /api/visit/reopen/:encounterId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reopens a closed encounter within the grace window for a doctor', async () => {
    const closedAt = new Date(Date.now() - 2 * 86_400_000).toISOString(); // 2 days ago
    mockFrom.mockReturnValueOnce(makeQuery(ok({ id: 'enc-1', patient_id: 'pat-1', status: 'closed', closed_at: closedAt })));
    mockFrom.mockReturnValueOnce(makeQuery(ok({ role: 'doctor' })));
    mockFrom.mockReturnValueOnce(makeQuery(empty())); // update
    mockFrom.mockReturnValue(makeQuery(empty()));      // audit_log

    const res = await request(app)
      .post('/api/visit/reopen/enc-1')
      .set(AUTH)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ encounterId: 'enc-1', status: 'in_progress', reopened: true });
  });

  it('is a no-op success when the encounter is not closed', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok({ id: 'enc-1', patient_id: 'pat-1', status: 'in_progress', closed_at: null })));

    const res = await request(app)
      .post('/api/visit/reopen/enc-1')
      .set(AUTH)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ encounterId: 'enc-1', status: 'in_progress', reopened: false });
  });

  it('returns 404 when the encounter does not exist', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(notFound()));

    const res = await request(app)
      .post('/api/visit/reopen/enc-gone')
      .set(AUTH)
      .send({});

    expect(res.status).toBe(404);
  });

  it('rejects reopening past the grace window', async () => {
    const closedAt = new Date(Date.now() - 9 * 86_400_000).toISOString(); // 9 days ago
    mockFrom.mockReturnValueOnce(makeQuery(ok({ id: 'enc-1', patient_id: 'pat-1', status: 'closed', closed_at: closedAt })));

    const res = await request(app)
      .post('/api/visit/reopen/enc-1')
      .set(AUTH)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/permanently locked/i);
  });

  it('rejects a non-doctor role even within the grace window', async () => {
    const closedAt = new Date(Date.now() - 1 * 86_400_000).toISOString(); // 1 day ago
    mockFrom.mockReturnValueOnce(makeQuery(ok({ id: 'enc-1', patient_id: 'pat-1', status: 'closed', closed_at: closedAt })));
    mockFrom.mockReturnValueOnce(makeQuery(ok({ role: 'nurse' })));

    const res = await request(app)
      .post('/api/visit/reopen/enc-1')
      .set(AUTH)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/treating doctor/i);
  });
});
