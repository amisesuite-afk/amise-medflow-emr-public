/**
 * /api/lab-feed — laboratory authentication (per-lab secret, constant-time, checked before the
 * body is read), idempotency (message and report), patient matching (exact MRN + date of birth
 * attaches; everything else is queued), critical alerts (MODE-gated, staff-only, no PHI),
 * graceful 503 when Migration 96 is not applied, the clinician review / reconcile endpoints and
 * the admin reference-range endpoints (roles, validation, audit).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { FakeDb } from './helpers/fake-supabase.js';
import {
  HL7_CORRECTED, HL7_DOB_MISMATCH, HL7_FBC_UE, HL7_NO_MRN, HL7_OBX_BEFORE_OBR, fhirBundle,
} from './fixtures/lab-feed-samples.js';

const db = new FakeDb();
const audit = vi.fn(async (_a: Record<string, unknown>) => undefined);
const verifyStaffToken = vi.fn();
const sendOrDraft = vi.fn(async (_args: { to: string; subject: string; body: string }, _force?: string) => ({ action: 'skipped' as const }));
const createWorkflowTask = vi.fn(async (_t: Record<string, unknown>) => 'task');
const resolveWorkflowTask = vi.fn(async (_t: Record<string, unknown>) => undefined);

vi.mock('../lib/supabase.js', () => ({
  sb: () => db.client(),
  getSupabaseAdmin: () => db.client(),
  verifyStaffToken: (jwt: string | null) => verifyStaffToken(jwt),
  audit: (a: Record<string, unknown>) => audit(a),
}));
vi.mock('../lib/gmail.js', () => ({ sendOrDraft: (a: { to: string; subject: string; body: string }, f?: string) => sendOrDraft(a, f) }));
vi.mock('../lib/workflow-tasks.js', () => ({
  createWorkflowTask: (t: Record<string, unknown>) => createWorkflowTask(t),
  resolveWorkflowTask: (t: Record<string, unknown>) => resolveWorkflowTask(t),
}));

const { default: labFeedRouter, labFeedInboundGate } = await import('../routes/lab-feed.js');
const { _clearRangeCache } = await import('../lib/lab-feed/ranges.js');

// Same order as app.ts: the gate runs before the JSON parser.
const app = express();
app.use('/api/lab-feed/inbound', labFeedInboundGate);
app.use(express.json());
app.use(labFeedRouter);

const SECRET = 's'.repeat(40);
const LAB = { 'x-lab-id': 'slulab', 'x-lab-feed-key': SECRET };
const HL7 = { ...LAB, 'Content-Type': 'application/hl7-v2' };
const FHIR = { ...LAB, 'Content-Type': 'application/fhir+json' };

const PATIENT = '10000000-0000-4000-8000-000000000001';
const OTHER = '10000000-0000-4000-8000-000000000002';
const staff = (role: string, id = '00000000-0000-4000-8000-0000000000d0') => ({ ok: true, staff: { userId: id, email: `${role}@example.test`, role } });

function reset() {
  for (const k of Object.keys(db.tables)) delete db.tables[k];
  db.missing.clear();
  db.rows('patients').push(
    { id: PATIENT, full_name: 'Marie Joseph', mrn: 'AM-000123', date_of_birth: '1970-05-20', sex: 'female' },
    { id: OTHER, full_name: 'Marie Joseph-Paul', mrn: 'AM-000777', date_of_birth: '1971-05-20', sex: 'female' },
  );
  _clearRangeCache();
  audit.mockClear(); verifyStaffToken.mockReset(); sendOrDraft.mockClear(); createWorkflowTask.mockClear(); resolveWorkflowTask.mockClear();
  process.env.LAB_FEED_SECRETS = `slulab:${SECRET},otherlab=${'o'.repeat(40)}`;
  process.env.DOCTOR_NOTIFY_EMAIL = 'surgeon@example.test';
}

beforeEach(reset);

describe('POST /api/lab-feed/inbound — authentication', () => {
  it('is off (503) when no laboratory secret is configured', async () => {
    delete process.env.LAB_FEED_SECRETS;
    const res = await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_FBC_UE);
    expect(res.status).toBe(503);
    expect(db.rows('lab_feed_messages')).toHaveLength(0);
  });

  it('rejects a wrong key, an unknown lab, a missing key and another lab\'s key (401), before reading the body', async () => {
    for (const headers of [
      { 'x-lab-id': 'slulab', 'x-lab-feed-key': 'x'.repeat(40) },
      { 'x-lab-id': 'nolab', 'x-lab-feed-key': SECRET },
      { 'x-lab-id': 'slulab' },
      { 'x-lab-id': 'otherlab', 'x-lab-feed-key': SECRET },
      {},
    ]) {
      const res = await request(app).post('/api/lab-feed/inbound').set({ ...headers, 'Content-Type': 'application/json' }).send(fhirBundle());
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorised' });
    }
    expect(db.rows('lab_feed_messages')).toHaveLength(0);
    expect(db.rows('investigation_results')).toHaveLength(0);
  });

  it('ignores a secret shorter than 32 characters', async () => {
    process.env.LAB_FEED_SECRETS = 'slulab:short';
    const res = await request(app).post('/api/lab-feed/inbound').set({ 'x-lab-id': 'slulab', 'x-lab-feed-key': 'short', 'Content-Type': 'application/hl7-v2' }).send(HL7_FBC_UE);
    expect(res.status).toBe(503);
  });
});

describe('POST /api/lab-feed/inbound — HL7 v2', () => {
  it('attaches on exact MRN + date of birth, acknowledges AA, and never echoes patient data', async () => {
    const res = await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_FBC_UE);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/hl7/);
    expect(res.text).toMatch(/^MSH\|\^~\\&\|AMISE-MEDFLOW\|/);
    expect(res.text).toContain('MSA|AA|MSG20260926-0001|processed: 2 filed, 0 to reconcile');
    for (const phi of ['AM-000123', 'Joseph', '1970', '19700520', '6.8']) expect(res.text).not.toContain(phi);

    const rows = db.rows('investigation_results');
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.patient_id === PATIENT && r.source === 'lab-feed' && r.status === 'resulted')).toBe(true);
    const ue = rows.find(r => r.lab_report_ref === 'slulab:LAB-26-0457:F:2026-09-26T12:25:00.000Z')!;
    expect(ue).toMatchObject({ is_critical: true, is_abnormal: true, test_category: 'other' });
    const log = db.rows('lab_feed_messages')[0];
    expect(log).toMatchObject({ lab_id: 'slulab', message_id: 'MSG20260926-0001', format: 'hl7v2', status: 'processed', attached_count: 2, critical_count: 2 });
    expect(Object.keys(log)).not.toContain('body');
    expect(log.body_sha256).toMatch(/^[0-9a-f]{64}$/);
    // Urgent review task, audit per report, one staff alert.
    expect(createWorkflowTask).toHaveBeenCalledWith(expect.objectContaining({ task_type: 'review_result', priority: 'urgent', patient_id: PATIENT }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'create', entityType: 'investigation_result', patientId: PATIENT }));
  });

  it('is idempotent: the same message again is a duplicate (AA) and files nothing new', async () => {
    await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_FBC_UE);
    sendOrDraft.mockClear();
    const again = await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_FBC_UE);
    expect(again.status).toBe(200);
    expect(again.text).toContain('MSA|AA|MSG20260926-0001|duplicate');
    expect(db.rows('investigation_results')).toHaveLength(2);
    expect(db.rows('lab_feed_messages')).toHaveLength(1);
    expect(sendOrDraft).not.toHaveBeenCalled();
  });

  it('is idempotent per report: the same report in a new message is not filed twice', async () => {
    await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_FBC_UE);
    const resent = HL7_FBC_UE.replace('MSG20260926-0001', 'MSG20260926-0099');
    const res = await request(app).post('/api/lab-feed/inbound').set(HL7).send(resent);
    expect(res.text).toContain('MSA|AA|MSG20260926-0099|duplicate');
    expect(db.rows('investigation_results')).toHaveLength(2);
    expect(db.rows('lab_feed_messages').find(m => m.message_id === 'MSG20260926-0099')).toMatchObject({ status: 'duplicate', duplicate_count: 2 });
  });

  it('files a corrected report as a new result (the earlier one stays)', async () => {
    await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_FBC_UE);
    const res = await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_CORRECTED);
    expect(res.status).toBe(200);
    const rows = db.rows('investigation_results');
    expect(rows).toHaveLength(3);
    expect(rows[2].notes).toContain('Corrected report');
  });

  it('queues a date-of-birth mismatch and a missing MRN — never attaches them', async () => {
    const a = await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_DOB_MISMATCH);
    expect(a.text).toContain('MSA|AA|MSG20260926-0002|queued: 0 filed, 2 to reconcile');
    const b = await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_NO_MRN);
    expect(b.status).toBe(200);
    expect(db.rows('investigation_results')).toHaveLength(0);
    const q = db.rows('lab_results_to_reconcile');
    expect(q.map(r => r.reason).sort()).toEqual(['dob_mismatch', 'dob_mismatch', 'no_identifier']);
    expect(q[0]).toMatchObject({ received_mrn: 'AM-000123', received_dob: '1971-05-20', received_family_name: 'Joseph', status: 'open' });
    expect(Array.isArray(q[0].observations)).toBe(true);
    expect(createWorkflowTask).toHaveBeenCalledWith(expect.objectContaining({ task_type: 'other', priority: 'urgent', source_type: 'lab_result_to_reconcile' }));
  });

  it('queues when two patients share the MRN', async () => {
    db.rows('patients').push({ id: 'dup', full_name: 'M J', mrn: 'AM-000123', date_of_birth: '1970-05-20', sex: 'female' });
    await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_FBC_UE);
    expect(db.rows('investigation_results')).toHaveLength(0);
    expect(db.rows('lab_results_to_reconcile').map(r => r.reason)).toEqual(['multiple_matches', 'multiple_matches']);
  });

  it('rejects a malformed message (AR, 400) and logs it without the body', async () => {
    const res = await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_OBX_BEFORE_OBR);
    expect(res.status).toBe(400);
    expect(res.text).toContain('MSA|AR||rejected: obx_without_obr');
    const log = db.rows('lab_feed_messages')[0];
    expect(log).toMatchObject({ status: 'rejected', error_code: 'obx_without_obr' });
    expect(String(log.message_id)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(JSON.stringify(log)).not.toContain('AM-000123');
  });

  it('answers AE / 503 (the laboratory retries) when Migration 96 is not applied', async () => {
    db.missing.add('lab_feed_messages');
    const res = await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_FBC_UE);
    expect(res.status).toBe(503);
    expect(res.text).toContain('MSA|AE|MSG20260926-0001|retry later: unavailable');
    expect(db.rows('investigation_results')).toHaveLength(0);
  });

  it('answers AE when a report cannot be stored, and a resend then files it once', async () => {
    db.failNextInsert.investigation_results = { code: 'XX000', message: 'boom' };
    const first = await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_FBC_UE);
    expect(first.status).toBe(503);
    expect(first.text).toContain('MSA|AE|');
    expect(db.rows('lab_feed_messages')[0]).toMatchObject({ status: 'failed', error_code: 'report_failed' });
    const second = await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_FBC_UE);
    expect(second.status).toBe(200);
    expect(db.rows('investigation_results')).toHaveLength(2);
  });
});

describe('POST /api/lab-feed/inbound — FHIR R4 and critical alerts', () => {
  it('attaches a FHIR Bundle and answers JSON without patient data', async () => {
    const res = await request(app).post('/api/lab-feed/inbound').set(FHIR).send(JSON.stringify(fhirBundle()));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, status: 'processed', messageId: 'BND-2026-0001' });
    expect(res.body.reports).toEqual([{ reportRef: 'slulab:LAB-26-0789:final:2026-09-26T12:25:00.000Z', outcome: 'attached', critical: true }]);
    expect(JSON.stringify(res.body)).not.toMatch(/AM-000123|Joseph|1970-05-20/);
  });

  it('sends one staff-internal critical alert through the MODE gate, with no patient data', async () => {
    await request(app).post('/api/lab-feed/inbound').set(FHIR).send(JSON.stringify(fhirBundle()));
    expect(sendOrDraft).toHaveBeenCalledTimes(1);
    const [args, force] = sendOrDraft.mock.calls[0];
    expect(args.to).toBe('surgeon@example.test');
    expect(force).toBe('auto'); // staff-internal promotion; can never lift MODE=dry_run
    expect(args.subject).toContain('[CRITICAL RESULT]');
    for (const phi of ['AM-000123', 'Joseph', 'Marie', '1970', 'Troponin', '60']) expect(`${args.subject}\n${args.body}`).not.toContain(phi);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'lab_alert_sent', entityType: 'lab_feed_message' }));
  });

  it('never emails when DOCTOR_NOTIFY_EMAIL is not set (in-app alert only)', async () => {
    delete process.env.DOCTOR_NOTIFY_EMAIL;
    await request(app).post('/api/lab-feed/inbound').set(FHIR).send(JSON.stringify(fhirBundle()));
    expect(sendOrDraft).not.toHaveBeenCalled();
  });

  it('accepts application/json that the global JSON parser would otherwise have parsed', async () => {
    const res = await request(app).post('/api/lab-feed/inbound').set({ ...LAB, 'Content-Type': 'application/json' }).send(fhirBundle({ bundleId: 'BND-2' }));
    expect(res.status).toBe(200);
    expect(res.body.messageId).toBe('BND-2');
  });
});

describe('clinician endpoints', () => {
  async function fileCritical() {
    await request(app).post('/api/lab-feed/inbound').set(FHIR).send(JSON.stringify(fhirBundle()));
    return db.rows('investigation_results')[0].id as string;
  }

  it('front desk, a portal user and the machine token are refused', async () => {
    verifyStaffToken.mockResolvedValueOnce(staff('front_desk'));
    expect((await request(app).get('/api/lab-feed/inbox').set('Authorization', 'Bearer t')).status).toBe(403);
    verifyStaffToken.mockResolvedValueOnce({ ok: false, status: 403, error: 'Forbidden' });
    expect((await request(app).get('/api/lab-feed/alerts').set('Authorization', 'Bearer t')).status).toBe(403);
    verifyStaffToken.mockResolvedValueOnce({ ok: false, status: 401, error: 'Unauthorised' });
    expect((await request(app).get('/api/lab-feed/inbox').set('x-staff-token', 'machine')).status).toBe(401);
    expect(verifyStaffToken).toHaveBeenLastCalledWith(null);
  });

  it('the inbox lists unreviewed lab-feed results with the patient, and the alert counts', async () => {
    await fileCritical();
    await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_NO_MRN);
    verifyStaffToken.mockResolvedValue(staff('doctor'));
    const inbox = await request(app).get('/api/lab-feed/inbox').set('Authorization', 'Bearer t');
    expect(inbox.status).toBe(200);
    expect(inbox.body.results).toHaveLength(1);
    expect(inbox.body.results[0].patient).toMatchObject({ mrn: 'AM-000123', full_name: 'Marie Joseph' });
    expect(inbox.body.reconcile[0]).toMatchObject({ reason: 'no_identifier', reason_text: 'The laboratory sent no MRN' });
    const alerts = await request(app).get('/api/lab-feed/alerts').set('Authorization', 'Bearer t');
    expect(alerts.body).toMatchObject({ available: true, criticalUnreviewed: 1, unreviewed: 1, toReconcile: 1 });
  });

  it('reviewing marks the result reviewed by the clinician, audit-logged, once', async () => {
    const id = await fileCritical();
    verifyStaffToken.mockResolvedValue(staff('nurse'));
    const res = await request(app).post(`/api/lab-feed/results/${id}/review`).set('Authorization', 'Bearer t').send({ actionTaken: 'Phoned patient to attend ED' });
    expect(res.status).toBe(200);
    expect(db.rows('investigation_results')[0]).toMatchObject({ status: 'reviewed', reviewed_by: '00000000-0000-4000-8000-0000000000d0', action_taken: 'Phoned patient to attend ED' });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'review', entityType: 'investigation_result', entityId: id, userId: '00000000-0000-4000-8000-0000000000d0' }));
    expect(resolveWorkflowTask).toHaveBeenCalledWith(expect.objectContaining({ task_type: 'review_result', source_id: id }));
    const again = await request(app).post(`/api/lab-feed/results/${id}/review`).set('Authorization', 'Bearer t').send({});
    expect(again.status).toBe(409);
  });

  it('matching by hand: candidates, a mismatch needs confirmation, then filed once and audit-logged', async () => {
    await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_DOB_MISMATCH);
    const item = db.rows('lab_results_to_reconcile')[0];
    verifyStaffToken.mockResolvedValue(staff('doctor'));
    const cands = await request(app).get(`/api/lab-feed/reconcile/${item.id}/candidates`).set('Authorization', 'Bearer t');
    expect(cands.status).toBe(200);
    expect(cands.body.candidates[0]).toMatchObject({ id: PATIENT, matches: { mrn: true, dob: false, name: true } });
    expect(cands.body.candidates.map((c: { id: string }) => c.id)).toContain(OTHER); // same date of birth

    const unconfirmed = await request(app).post(`/api/lab-feed/reconcile/${item.id}/match`).set('Authorization', 'Bearer t').send({ patientId: PATIENT });
    expect(unconfirmed.status).toBe(409);
    expect(unconfirmed.body).toMatchObject({ needsConfirmation: true, mismatches: ['date_of_birth'] });
    expect(db.rows('investigation_results')).toHaveLength(0);

    const ok = await request(app).post(`/api/lab-feed/reconcile/${item.id}/match`).set('Authorization', 'Bearer t').send({ patientId: PATIENT, confirmMismatch: true });
    expect(ok.status).toBe(200);
    const filed = db.rows('investigation_results')[0];
    expect(filed).toMatchObject({ patient_id: PATIENT, source: 'lab-feed', lab_report_ref: item.report_ref, status: 'resulted' });
    expect(String(filed.notes)).toContain('Matched by hand');
    expect(db.rows('lab_results_to_reconcile')[0]).toMatchObject({ status: 'matched', matched_patient_id: PATIENT, matched_result_id: filed.id });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'reconcile', patientId: PATIENT, payload: expect.objectContaining({ overrideConfirmed: true }) }));
    const twice = await request(app).post(`/api/lab-feed/reconcile/${item.id}/match`).set('Authorization', 'Bearer t').send({ patientId: PATIENT, confirmMismatch: true });
    expect(twice.status).toBe(409);
  });

  it('dismissing needs a reason and is audit-logged', async () => {
    await request(app).post('/api/lab-feed/inbound').set(HL7).send(HL7_NO_MRN);
    const item = db.rows('lab_results_to_reconcile')[0];
    verifyStaffToken.mockResolvedValue(staff('admin'));
    expect((await request(app).post(`/api/lab-feed/reconcile/${item.id}/dismiss`).set('Authorization', 'Bearer t').send({})).status).toBe(400);
    const ok = await request(app).post(`/api/lab-feed/reconcile/${item.id}/dismiss`).set('Authorization', 'Bearer t').send({ reason: 'Not a patient of this practice' });
    expect(ok.status).toBe(200);
    expect(db.rows('lab_results_to_reconcile')[0]).toMatchObject({ status: 'dismissed', resolution_note: 'Not a patient of this practice' });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'dismiss' }));
  });

  it('reports the feed as unavailable (not a 500) before Migration 96', async () => {
    db.missing.add('lab_results_to_reconcile');
    verifyStaffToken.mockResolvedValue(staff('doctor'));
    const inbox = await request(app).get('/api/lab-feed/inbox').set('Authorization', 'Bearer t');
    expect(inbox.status).toBe(200);
    expect(inbox.body).toMatchObject({ available: false, results: [], reconcile: [] });
    const alerts = await request(app).get('/api/lab-feed/alerts').set('Authorization', 'Bearer t');
    expect(alerts.status).toBe(200);
    expect(alerts.body.available).toBe(false);
  });
});

describe('admin reference ranges', () => {
  const body = { analyte: 'Lipase', unit: 'U/L', sex: 'any', ageMinYears: 18, upper: 73, labSource: 'Laboratory Services Ltd 2026', effectiveFrom: '2026-10-01' };

  it('only admin may add, change or retire a range', async () => {
    verifyStaffToken.mockResolvedValue(staff('doctor'));
    expect((await request(app).post('/api/lab-feed/reference-ranges').set('Authorization', 'Bearer t').send(body)).status).toBe(403);
    expect(db.rows('lab_reference_ranges')).toHaveLength(0);
  });

  it('validates against the catalogue (analyte, unit, limits) and refuses the default label', async () => {
    verifyStaffToken.mockResolvedValue(staff('admin'));
    const bad = async (patch: Record<string, unknown>) =>
      (await request(app).post('/api/lab-feed/reference-ranges').set('Authorization', 'Bearer t').send({ ...body, ...patch })).body.error as string;
    expect(await bad({ analyte: 'Lipaze' })).toMatch(/not an analyte in the catalogue/);
    expect(await bad({ analyte: 'Creatinine', unit: 'mg/dL', upper: 1.1 })).toMatch(/stored in µmol\/L/);
    expect(await bad({ lower: 80, upper: 73 })).toMatch(/Lower is above upper/);
    expect(await bad({ labSource: "default — replace with your laboratory's ranges" })).toMatch(/not the default text/);
  });

  it('adds, changes and retires a range, audit-logging each change with before / after', async () => {
    verifyStaffToken.mockResolvedValue(staff('admin', '00000000-0000-4000-8000-00000000a0a0'));
    const created = await request(app).post('/api/lab-feed/reference-ranges').set('Authorization', 'Bearer t').send(body);
    expect(created.status).toBe(201);
    const id = created.body.range.id as string;
    expect(db.rows('lab_reference_ranges')[0]).toMatchObject({ analyte: 'Lipase', upper_limit: 73, is_default: false, created_by: '00000000-0000-4000-8000-00000000a0a0' });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'create', entityType: 'lab_reference_range', entityId: id }));

    const changed = await request(app).patch(`/api/lab-feed/reference-ranges/${id}`).set('Authorization', 'Bearer t').send({ upper: 67 });
    expect(changed.status).toBe(200);
    expect(db.rows('lab_reference_ranges')[0].upper_limit).toBe(67);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update', payload: expect.objectContaining({ before: expect.objectContaining({ upper_limit: 73 }), after: expect.objectContaining({ upper_limit: 67 }) }),
    }));

    const retired = await request(app).post(`/api/lab-feed/reference-ranges/${id}/retire`).set('Authorization', 'Bearer t');
    expect(retired.status).toBe(200);
    expect(db.rows('lab_reference_ranges')[0].retired_at).toBeTruthy();
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'retire', entityId: id }));
  });

  it('a practice range changes the flags of the next results', async () => {
    db.rows('lab_reference_ranges').push({
      id: 'r1', analyte: 'Troponin T', unit: 'ng/L', sex: 'any', age_min_years: 18, age_max_years: null,
      lower_limit: null, upper_limit: 14, critical_low: null, critical_high: 100, lab_source: 'SLU Lab', effective_from: '2026-01-01',
      is_default: false, retired_at: null,
    });
    await request(app).post('/api/lab-feed/inbound').set(FHIR).send(JSON.stringify(fhirBundle()));
    const trop = (db.rows('investigation_results')[0].analytes as Array<{ name: string; critical: boolean; practice_range?: string }>)
      .find(a => a.name === 'Troponin T')!;
    // The lab's HH still makes it critical; the practice range is the one shown.
    expect(trop).toMatchObject({ critical: true, practice_range: '≤ 14 ng/L · SLU Lab' });
  });
});
