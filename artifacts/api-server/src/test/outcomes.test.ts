/**
 * GET /api/outcomes/research-export — admin only, audit-logged before release (refused when the
 * audit row cannot be written), de-identified, and graceful when Migration 94 is not applied.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

type Result = { data: unknown; error: null | { message: string; code?: string } };

const results: Record<string, Result> = {};
const inserts: Record<string, unknown[]> = {};

function query(table: string) {
  const q: Record<string, unknown> = {};
  const self = () => q;
  for (const m of ['select', 'order', 'range', 'eq', 'in']) q[m] = vi.fn(self);
  q.then = (resolve: (v: Result) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(results[table] ?? { data: [], error: null }).then(resolve, reject);
  q.insert = vi.fn(async (row: unknown) => {
    (inserts[table] ??= []).push(row);
    return results[`${table}:insert`] ?? { data: null, error: null };
  });
  return q;
}

const verifyStaffToken = vi.fn();
vi.mock('../lib/supabase.js', () => ({
  sb: () => ({ from: (t: string) => query(t) }),
  getSupabaseAdmin: () => ({ from: (t: string) => query(t) }),
  verifyStaffToken: (jwt: string | null) => verifyStaffToken(jwt),
  requireStaffAuth: vi.fn().mockResolvedValue(true),
}));

const { default: outcomesRouter } = await import('../routes/outcomes.js');
const app = express();
app.use(express.json());
app.use(outcomesRouter);

const ADMIN = { ok: true, staff: { userId: '00000000-0000-4000-8000-00000000a0a0', email: 'admin@example.test', role: 'admin' } };
const DOCTOR = { ok: true, staff: { userId: '00000000-0000-4000-8000-00000000d0d0', email: 'md@example.test', role: 'doctor' } };
const PATIENT_ID = '10000000-0000-4000-8000-000000000001';
const ENC = '11111111-2222-4333-8444-555555555555';

const SNAPSHOT_ROW = {
  id: 'snap-1', patient_id: PATIENT_ID, encounter_id: ENC, encounter_ref: `web:${ENC}`, platform: 'web',
  completed_at: '2026-08-01T15:00:00.000Z', snapshot_version: 1, differential_engine: 'pane',
  differential_model_version: '1.0.1', model_versions: { pane: '1.0.1' },
  top_differential: [{ rank: 1, diseaseId: 'appendicitis', icd10: 'K35.80', probability: 0.7 }],
  triage_level: 'priority', triage_scale: 'web-adaptive', scores: [], decision_bands: [], features: {},
  working_disease_id: 'appendicitis', working_icd10: 'K35.80', recorded_icd10: ['K35.80'],
  expects_outcome: true, outcome_triggers: ['operation'], created_at: '2026-08-01T15:00:00.000Z',
};
const OUTCOME_ROW = {
  id: 'out-1', patient_id: PATIENT_ID, encounter_id: ENC, encounter_ref: `web:${ENC}`, client_ref: null,
  final_icd10: 'K35.80', final_disease_id: 'appendicitis', source_type: 'histology', source_date: '2026-08-12',
  actions_taken: [], retrospective_acuity: 'urgent', status: 'confirmed', confirmed_at: '2026-08-12T10:00:00.000Z',
};

beforeEach(() => {
  for (const k of Object.keys(results)) delete results[k];
  for (const k of Object.keys(inserts)) delete inserts[k];
  verifyStaffToken.mockReset();
  results.prediction_snapshots = { data: [SNAPSHOT_ROW], error: null };
  results.diagnosis_outcomes = { data: [OUTCOME_ROW], error: null };
  results.patients = { data: [{ id: PATIENT_ID, date_of_birth: '1970-05-20', sex: 'female' }], error: null };
});

describe('GET /api/outcomes/research-export', () => {
  it('refuses callers who are not admin (doctor 403, no session 401)', async () => {
    verifyStaffToken.mockResolvedValueOnce(DOCTOR);
    const r1 = await request(app).get('/api/outcomes/research-export').set('Authorization', 'Bearer tok');
    expect(r1.status).toBe(403);
    verifyStaffToken.mockResolvedValueOnce({ ok: false, status: 401, error: 'Unauthorised' });
    const r2 = await request(app).get('/api/outcomes/research-export').set('x-staff-token', 'machine-secret');
    expect(r2.status).toBe(401);
    expect(verifyStaffToken).toHaveBeenLastCalledWith(null); // the machine token is not accepted
    expect(inserts.audit_log).toBeUndefined();
  });

  it('writes the audit row, then returns de-identified cases', async () => {
    verifyStaffToken.mockResolvedValueOnce(ADMIN);
    const res = await request(app).get('/api/outcomes/research-export').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="amise-outcomes-\d{4}-\d{2}-deidentified-v1\.json"/);
    expect(res.body).toMatchObject({ available: true, format: 'deidentified-v1' });
    expect(res.body.cases).toHaveLength(1);
    expect(res.body.cases[0]).toMatchObject({
      ageBand: '45-59', sex: 'female', completedMonth: '2026-08',
      outcome: { finalIcd10: 'K35.80', sourceMonth: '2026-08', retrospectiveAcuity: 'urgent' },
    });
    const body = JSON.stringify(res.body);
    for (const secret of [PATIENT_ID, ENC, '1970-05-20', '2026-08-12', '2026-08-01T']) expect(body).not.toContain(secret);

    expect(inserts.audit_log).toHaveLength(1);
    expect(inserts.audit_log[0]).toMatchObject({
      action: 'export', resource_type: 'research_export', user_id: ADMIN.staff.userId,
      details: { format: 'deidentified-v1', cases: 1, with_final_diagnosis: 1 },
    });
    expect(JSON.stringify(inserts.audit_log[0])).not.toContain(PATIENT_ID);
  });

  it('refuses to release the export when the audit row cannot be written', async () => {
    verifyStaffToken.mockResolvedValueOnce(ADMIN);
    results['audit_log:insert'] = { data: null, error: { message: 'permission denied', code: '42501' } };
    const res = await request(app).get('/api/outcomes/research-export').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(503);
    expect(res.body.cases).toBeUndefined();
    expect(res.body.error).toMatch(/audit-logged/);
  });

  it('reports the tables as unavailable (not a 500) before Migration 94 is applied', async () => {
    verifyStaffToken.mockResolvedValueOnce(ADMIN);
    results.prediction_snapshots = { data: null, error: { message: 'Could not find the table', code: 'PGRST205' } };
    const res = await request(app).get('/api/outcomes/research-export').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: false });
    expect(inserts.audit_log).toBeUndefined();
  });
});
