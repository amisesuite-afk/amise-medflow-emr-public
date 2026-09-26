/**
 * Laboratory results feed (Migration 96) and practice reference ranges.
 *
 * Laboratory → server (per-laboratory secret, docs/LAB-FEED.md):
 *   POST /api/lab-feed/inbound            HL7 v2 ORU^R01 (ER7) or FHIR R4 JSON. Answers an HL7 ACK
 *                                         (AA / AE / AR) to HL7, JSON to FHIR. Never echoes
 *                                         patient data. Idempotent on message and report id.
 *
 * Clinicians (Bearer session of a nurse, doctor or admin; the machine token is NOT accepted, so
 * every action is attributable to a person):
 *   GET  /api/lab-feed/inbox              unreviewed lab-feed results + open reconciliation items
 *   GET  /api/lab-feed/alerts             counts for the critical-result banner
 *   POST /api/lab-feed/results/:id/review mark a lab-feed result reviewed (audit-logged)
 *   GET  /api/lab-feed/reconcile/:id/candidates   possible patients (MRN or date of birth)
 *   POST /api/lab-feed/reconcile/:id/match        file the report to a chosen patient
 *   POST /api/lab-feed/reconcile/:id/dismiss      not ours / test message (reason required)
 *
 * Admin (Bearer session, role admin):
 *   POST  /api/lab-feed/reference-ranges             add a practice range
 *   PATCH /api/lab-feed/reference-ranges/:id         change one
 *   POST  /api/lab-feed/reference-ranges/:id/retire  retire one (never deleted)
 *
 * Tables absent (Migration 96 not applied): the inbound endpoint answers 503 (the laboratory
 * retries); the clinician endpoints answer { available: false } or 503 — never a 500.
 */
import express, { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  DEFAULT_REFERENCE_RANGES, referenceRangeProblems, referenceRangeToRow, rowToReferenceRange,
  type RangeSex, type ReferenceRange, type ReferenceRangeRow,
} from '@workspace/triage-engine/reference-ranges';
import { audit, sb, verifyStaffToken, type StaffIdentity } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { isMissingTableError } from '../lib/prediction-snapshots.js';
import { createWorkflowTask, resolveWorkflowTask } from '../lib/workflow-tasks.js';
import { authenticateLab } from '../lib/lab-feed/auth.js';
import { hl7Ack } from '../lib/lab-feed/hl7.js';
import { QUEUE_REASON_TEXT, type QueueReason } from '../lib/lab-feed/matching.js';
import { buildResultRow } from '../lib/lab-feed/normalise.js';
import { receiveLabMessage, type ProcessResult } from '../lib/lab-feed/processor.js';
import { _clearRangeCache, loadPracticeRanges } from '../lib/lab-feed/ranges.js';
import { MAX_FEED_BYTES, type FeedObservation } from '../lib/lab-feed/types.js';

const router = Router();

declare global {
  namespace Express {
    interface Request {
      labFeedLabId?: string;
    }
  }
}

const textBody = express.text({ type: () => true, limit: MAX_FEED_BYTES });

/**
 * Authenticates the laboratory BEFORE the body is read (app.ts mounts this ahead of the JSON
 * parser, so an unauthenticated caller cannot make the server buffer a body), then reads the
 * body as text. Safe to run twice.
 */
export function labFeedInboundGate(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'POST') { next(); return; }
  if (!req.labFeedLabId) {
    const auth = authenticateLab(req.headers);
    if (!auth.ok) {
      logger.warn({ status: auth.status }, '[lab-feed] inbound request refused');
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    req.labFeedLabId = auth.labId;
  }
  if (typeof req.body === 'string') { next(); return; }
  textBody(req, res, (err?: unknown) => {
    if (err) {
      const status = (err as { status?: number }).status === 413 ? 413 : 400;
      res.status(status).json({ error: status === 413 ? 'The message is larger than 2 MB' : 'The body could not be read' });
      return;
    }
    next();
  });
}

function wantsHl7(req: Request, body: string): boolean {
  const ct = (req.headers['content-type'] ?? '').toLowerCase();
  return ct.includes('hl7') || body.trimStart().startsWith('MSH') || (!ct.includes('json') && !body.trimStart().startsWith('{'));
}

function httpStatus(r: ProcessResult): number {
  switch (r.status) {
    case 'processed': case 'queued': case 'partial': case 'duplicate': return 200;
    case 'rejected': return 400;
    default: return 503;
  }
}

router.post('/api/lab-feed/inbound', labFeedInboundGate, async (req: Request, res: Response) => {
  const labId = req.labFeedLabId!;
  const body = typeof req.body === 'string' ? req.body
    : Buffer.isBuffer(req.body) ? req.body.toString('utf8')
      : req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : '';
  const hl7 = wantsHl7(req, body);
  let result: ProcessResult;
  try {
    result = await receiveLabMessage({ supa: sb(), labId, body, contentType: req.headers['content-type'] });
  } catch (err) {
    logger.error({ err, labId }, '[lab-feed] inbound failed');
    result = { status: 'failed', format: null, messageId: null, messageRowId: null, reports: [], errorCode: 'server_error' };
  }
  const status = httpStatus(result);
  res.setHeader('Cache-Control', 'no-store');
  if (hl7) {
    const code = status === 200 ? 'AA' : status === 400 ? 'AR' : 'AE';
    const text = status === 200
      ? `${result.status}: ${result.reports.filter(r => r.outcome === 'attached').length} filed, ${result.reports.filter(r => r.outcome === 'queued').length} to reconcile`
      : result.status === 'rejected' ? `rejected: ${result.errorCode ?? 'invalid'}` : `retry later: ${result.errorCode ?? result.status}`;
    res.status(status).type('application/hl7-v2').send(hl7Ack({ code, controlId: result.messageId, text }));
    return;
  }
  res.status(status).json({
    ok: status === 200,
    status: result.status,
    messageId: result.messageId,
    ...(result.errorCode ? { error: result.errorCode } : {}),
    ...(result.errorText ? { detail: result.errorText } : {}),
    reports: result.reports.map(r => ({ reportRef: r.reportRef, outcome: r.outcome, critical: r.critical })),
  });
});

// ── Clinician helpers ──────────────────────────────────────────────────────────────────────

const CLINICIANS = new Set(['nurse', 'doctor', 'admin']);

async function requireRole(req: Request, res: Response, roles: Set<string>): Promise<StaffIdentity | null> {
  const h = req.headers.authorization;
  const jwt = typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7).trim() : null;
  const who = await verifyStaffToken(jwt);
  if (!who.ok) { res.status(who.status).json({ error: who.error }); return null; }
  if (!roles.has(who.staff.role)) {
    res.status(403).json({ error: 'Forbidden — lab results are for nurses, doctors and admins' });
    return null;
  }
  return who.staff;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNAVAILABLE = { available: false, reason: 'The lab feed tables are not in the database yet (Migration 96 not applied).' };

function missing(res: Response, err: unknown): boolean {
  if (!isMissingTableError(err)) return false;
  res.status(503).json(UNAVAILABLE);
  return true;
}

// ── Inbox and alerts ───────────────────────────────────────────────────────────────────────

router.get('/api/lab-feed/inbox', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, CLINICIANS))) return;
  try {
    const supa = sb();
    const [results, queue] = await Promise.all([
      supa.from('investigation_results')
        .select('id, patient_id, test_name, test_category, collected_at, reported_at, created_at, performing_lab, analytes, is_abnormal, is_critical, status, notes')
        .eq('source', 'lab-feed').eq('status', 'resulted')
        .order('is_critical', { ascending: false }).order('created_at', { ascending: false }).limit(200),
      supa.from('lab_results_to_reconcile')
        .select('id, lab_id, reason, received_mrn, received_family_name, received_given_name, received_dob, received_sex, test_name, collected_at, reported_at, performing_lab, observations, is_abnormal, is_critical, created_at')
        .eq('status', 'open')
        .order('is_critical', { ascending: false }).order('created_at', { ascending: false }).limit(200),
    ]);
    if ((results.error && isMissingTableError(results.error)) || (queue.error && isMissingTableError(queue.error))) {
      res.json({ ...UNAVAILABLE, results: [], reconcile: [] });
      return;
    }
    if (results.error) throw results.error;
    if (queue.error) throw queue.error;
    const rows = (results.data ?? []) as Array<{ patient_id: string }>;
    const ids = [...new Set(rows.map(r => r.patient_id))];
    const patients = new Map<string, { full_name: string | null; mrn: string | null; date_of_birth: string | null }>();
    if (ids.length) {
      const { data, error } = await supa.from('patients').select('id, full_name, mrn, date_of_birth').in('id', ids);
      if (error) throw error;
      for (const p of (data ?? []) as Array<{ id: string; full_name: string | null; mrn: string | null; date_of_birth: string | null }>) {
        patients.set(p.id, p);
      }
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      available: true,
      results: rows.map(r => ({ ...r, patient: patients.get(r.patient_id) ?? null })),
      reconcile: ((queue.data ?? []) as Array<{ reason: QueueReason }>).map(q => ({ ...q, reason_text: QUEUE_REASON_TEXT[q.reason] ?? q.reason })),
    });
  } catch (err) {
    logger.error({ err }, '[lab-feed] inbox failed');
    res.status(502).json({ error: 'The lab-feed inbox could not be loaded' });
  }
});

router.get('/api/lab-feed/alerts', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, CLINICIANS))) return;
  try {
    const supa = sb();
    const count = async (table: string, filter: (q: any) => any) => {
      const { count: n, error } = await filter(supa.from(table).select('id', { count: 'exact', head: true }));
      if (error) throw error;
      return n ?? 0;
    };
    const [criticalUnreviewed, unreviewed, criticalToReconcile, toReconcile] = await Promise.all([
      count('investigation_results', q => q.eq('source', 'lab-feed').eq('status', 'resulted').eq('is_critical', true)),
      count('investigation_results', q => q.eq('source', 'lab-feed').eq('status', 'resulted')),
      count('lab_results_to_reconcile', q => q.eq('status', 'open').eq('is_critical', true)),
      count('lab_results_to_reconcile', q => q.eq('status', 'open')),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ available: true, criticalUnreviewed, unreviewed, criticalToReconcile, toReconcile });
  } catch (err) {
    if (isMissingTableError(err)) { res.json({ ...UNAVAILABLE, criticalUnreviewed: 0, unreviewed: 0, criticalToReconcile: 0, toReconcile: 0 }); return; }
    logger.error({ err }, '[lab-feed] alerts failed');
    res.status(502).json({ error: 'Alerts could not be loaded' });
  }
});

// ── Review ─────────────────────────────────────────────────────────────────────────────────

router.post('/api/lab-feed/results/:id/review', async (req: Request, res: Response) => {
  const who = await requireRole(req, res, CLINICIANS);
  if (!who) return;
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  const note = typeof req.body?.actionTaken === 'string' ? req.body.actionTaken.trim().slice(0, 1000) : '';
  try {
    const supa = sb();
    const { data, error } = await supa.from('investigation_results')
      .select('id, patient_id, status, source, is_critical, is_abnormal').eq('id', id).maybeSingle();
    if (error) { if (missing(res, error)) return; throw error; }
    const row = data as { id: string; patient_id: string; status: string; source: string | null; is_critical: boolean; is_abnormal: boolean } | null;
    if (!row || row.source !== 'lab-feed') { res.status(404).json({ error: 'Lab-feed result not found' }); return; }
    if (row.status !== 'resulted') { res.status(409).json({ error: 'Already reviewed', status: row.status }); return; }
    const now = new Date().toISOString();
    const { data: upd, error: updErr } = await supa.from('investigation_results').update({
      status: 'reviewed', reviewed_by: who.userId, reviewed_at: now, acknowledged_at: now,
      ...(note ? { action_taken: note } : {}), updated_at: now,
    }).eq('id', id).eq('status', 'resulted').select('id');
    if (updErr) throw updErr;
    if (!upd || (upd as unknown[]).length === 0) { res.status(409).json({ error: 'Already reviewed' }); return; }
    await audit({
      action: 'review', entityType: 'investigation_result', entityId: id, patientId: row.patient_id,
      userId: who.userId, userEmail: who.email ?? undefined,
      payload: { source: 'lab-feed', critical: row.is_critical, abnormal: row.is_abnormal, noted: note !== '' },
    });
    void resolveWorkflowTask({ task_type: 'review_result', source_type: 'investigation_result', source_id: id, resolved_by: who.userId, resolution_note: 'Reviewed by clinician' });
    if (row.is_critical || row.is_abnormal) {
      void createWorkflowTask({
        task_type: 'inform_patient', patient_id: row.patient_id, source_type: 'investigation_result', source_id: id,
        title: `Tell the patient about a ${row.is_critical ? 'critical' : 'abnormal'} lab result (clinician to decide how)`,
        priority: row.is_critical ? 'urgent' : 'high',
      });
    }
    res.json({ id, status: 'reviewed', reviewed_at: now });
  } catch (err) {
    logger.error({ err }, '[lab-feed] review failed');
    res.status(502).json({ error: 'The result could not be marked reviewed' });
  }
});

// ── Reconciliation ─────────────────────────────────────────────────────────────────────────

interface QueueItem {
  id: string; message_id: string; lab_id: string; report_ref: string; reason: QueueReason;
  received_mrn: string | null; received_family_name: string | null; received_given_name: string | null;
  received_dob: string | null; received_sex: string | null; test_name: string; collected_at: string | null;
  reported_at: string | null; performing_lab: string | null; observations: FeedObservation[];
  is_critical: boolean; status: string;
}

async function loadQueueItem(res: Response, id: string): Promise<QueueItem | null> {
  if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid id' }); return null; }
  const { data, error } = await sb().from('lab_results_to_reconcile').select('*').eq('id', id).maybeSingle();
  if (error) { if (missing(res, error)) return null; throw error; }
  if (!data) { res.status(404).json({ error: 'Not found' }); return null; }
  const item = data as QueueItem;
  if (item.status !== 'open') { res.status(409).json({ error: `Already ${item.status}` }); return null; }
  return item;
}

interface PatientRow { id: string; full_name: string | null; mrn: string | null; date_of_birth: string | null; sex: string | null }

function comparison(item: QueueItem, p: PatientRow) {
  const family = (item.received_family_name ?? '').trim().toLowerCase();
  return {
    mrn: !!item.received_mrn && (p.mrn ?? '').trim() === item.received_mrn.trim(),
    dob: !!item.received_dob && (p.date_of_birth ?? '').slice(0, 10) === item.received_dob.slice(0, 10),
    name: family !== '' && (p.full_name ?? '').toLowerCase().includes(family),
  };
}

router.get('/api/lab-feed/reconcile/:id/candidates', async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, CLINICIANS))) return;
  try {
    const item = await loadQueueItem(res, String(req.params.id));
    if (!item) return;
    const supa = sb();
    const found = new Map<string, PatientRow>();
    const add = (rows: unknown) => { for (const p of (rows ?? []) as PatientRow[]) found.set(p.id, p); };
    if (item.received_mrn) {
      const { data, error } = await supa.from('patients').select('id, full_name, mrn, date_of_birth, sex').eq('mrn', item.received_mrn.trim()).limit(5);
      if (error) throw error;
      add(data);
    }
    if (item.received_dob) {
      const { data, error } = await supa.from('patients').select('id, full_name, mrn, date_of_birth, sex').eq('date_of_birth', item.received_dob).limit(25);
      if (error) throw error;
      add(data);
    }
    const candidates = [...found.values()].map(p => ({ ...p, matches: comparison(item, p) }))
      .sort((a, b) => Number(b.matches.mrn) * 4 + Number(b.matches.dob) * 2 + Number(b.matches.name)
        - (Number(a.matches.mrn) * 4 + Number(a.matches.dob) * 2 + Number(a.matches.name)))
      .slice(0, 20);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ candidates });
  } catch (err) {
    logger.error({ err }, '[lab-feed] candidates failed');
    res.status(502).json({ error: 'Candidates could not be loaded' });
  }
});

router.post('/api/lab-feed/reconcile/:id/match', async (req: Request, res: Response) => {
  const who = await requireRole(req, res, CLINICIANS);
  if (!who) return;
  const patientId = typeof req.body?.patientId === 'string' ? req.body.patientId : '';
  if (!UUID_RE.test(patientId)) { res.status(400).json({ error: 'patientId is required' }); return; }
  try {
    const item = await loadQueueItem(res, String(req.params.id));
    if (!item) return;
    const supa = sb();
    const { data: pData, error: pErr } = await supa.from('patients').select('id, full_name, mrn, date_of_birth, sex').eq('id', patientId).maybeSingle();
    if (pErr) throw pErr;
    const patient = pData as PatientRow | null;
    if (!patient) { res.status(404).json({ error: 'Patient not found' }); return; }
    const cmp = comparison(item, patient);
    const mismatches = [!cmp.mrn ? 'mrn' : '', !cmp.dob ? 'date_of_birth' : ''].filter(Boolean);
    if (mismatches.length > 0 && req.body?.confirmMismatch !== true) {
      res.status(409).json({ needsConfirmation: true, mismatches, error: 'The chosen patient does not match every identifier the laboratory sent. Confirm to file it anyway.' });
      return;
    }
    const practice = await loadPracticeRanges(supa);
    const now = new Date().toISOString();
    const row = buildResultRow({
      report: {
        testName: item.test_name, status: 'final', collectedAt: item.collected_at, reportedAt: item.reported_at,
        performingLab: item.performing_lab, specimen: null, comments: [], reportId: null,
        observations: Array.isArray(item.observations) ? item.observations : [],
      },
      patientId, patient: { sex: patient.sex, dateOfBirth: patient.date_of_birth }, practice,
      labId: item.lab_id, messageRowId: item.message_id, reportRef: item.report_ref, receivedAt: now,
    });
    row.notes = `${row.notes} · Matched by hand`.slice(0, 4000);
    const ins = await supa.from('investigation_results').insert(row).select('id').single();
    if (ins.error) {
      if ((ins.error as { code?: string }).code === '23505') { res.status(409).json({ error: 'This report is already filed' }); return; }
      throw ins.error;
    }
    const resultId = (ins.data as { id: string }).id;
    const { data: upd, error: updErr } = await supa.from('lab_results_to_reconcile').update({
      status: 'matched', matched_patient_id: patientId, matched_result_id: resultId,
      resolved_by: who.userId, resolved_at: now, updated_at: now,
      ...(mismatches.length ? { resolution_note: `Filed despite ${mismatches.join(' and ')} mismatch (confirmed)` } : {}),
    }).eq('id', item.id).eq('status', 'open').select('id');
    if (updErr) throw updErr;
    if (!upd || (upd as unknown[]).length === 0) logger.warn({ id: item.id }, '[lab-feed] queue item changed during match');
    await audit({
      action: 'reconcile', entityType: 'lab_result_to_reconcile', entityId: item.id, patientId,
      userId: who.userId, userEmail: who.email ?? undefined,
      payload: { resultId, reason: item.reason, identifiersMatched: cmp, overrideConfirmed: mismatches.length > 0, critical: row.is_critical },
    });
    void resolveWorkflowTask({ task_type: 'other', source_type: 'lab_result_to_reconcile', source_id: item.id, resolved_by: who.userId, resolution_note: 'Matched to a patient' });
    void createWorkflowTask({
      task_type: 'review_result', patient_id: patientId, source_type: 'investigation_result', source_id: resultId,
      title: `Review lab result${row.is_critical ? ' — CRITICAL' : row.is_abnormal ? ' — abnormal' : ''} (lab feed)`,
      details: row.test_name, priority: row.is_critical ? 'urgent' : row.is_abnormal ? 'high' : 'normal',
    });
    res.json({ id: item.id, status: 'matched', resultId });
  } catch (err) {
    logger.error({ err }, '[lab-feed] match failed');
    res.status(502).json({ error: 'The result could not be filed' });
  }
});

router.post('/api/lab-feed/reconcile/:id/dismiss', async (req: Request, res: Response) => {
  const who = await requireRole(req, res, CLINICIANS);
  if (!who) return;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
  if (reason.length < 3) { res.status(400).json({ error: 'A reason is required' }); return; }
  try {
    const item = await loadQueueItem(res, String(req.params.id));
    if (!item) return;
    const now = new Date().toISOString();
    const { error } = await sb().from('lab_results_to_reconcile').update({
      status: 'dismissed', resolved_by: who.userId, resolved_at: now, resolution_note: reason, updated_at: now,
    }).eq('id', item.id).eq('status', 'open');
    if (error) throw error;
    await audit({
      action: 'dismiss', entityType: 'lab_result_to_reconcile', entityId: item.id,
      userId: who.userId, userEmail: who.email ?? undefined, payload: { reason, critical: item.is_critical },
    });
    void resolveWorkflowTask({ task_type: 'other', source_type: 'lab_result_to_reconcile', source_id: item.id, resolved_by: who.userId, resolution_note: 'Dismissed' });
    res.json({ id: item.id, status: 'dismissed' });
  } catch (err) {
    logger.error({ err }, '[lab-feed] dismiss failed');
    res.status(502).json({ error: 'The item could not be dismissed' });
  }
});

// ── Reference ranges (admin) ───────────────────────────────────────────────────────────────

const ADMIN = new Set(['admin']);

function rangeFromBody(b: Record<string, unknown>): Omit<ReferenceRange, 'isDefault'> {
  const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : typeof v === 'number' ? v : Number(v));
  return {
    analyte: String(b.analyte ?? '').trim(),
    unit: String(b.unit ?? '').trim(),
    sex: (String(b.sex ?? 'any') as RangeSex),
    ageMinYears: num(b.ageMinYears), ageMaxYears: num(b.ageMaxYears),
    lower: num(b.lower), upper: num(b.upper), criticalLow: num(b.criticalLow), criticalHigh: num(b.criticalHigh),
    labSource: String(b.labSource ?? '').trim(),
    effectiveFrom: String(b.effectiveFrom ?? '').trim(),
  };
}

function validate(res: Response, r: Omit<ReferenceRange, 'isDefault'>): boolean {
  const problems = referenceRangeProblems(r);
  if (r.labSource === DEFAULT_REFERENCE_RANGES[0].labSource) problems.push('Enter your laboratory, not the default text');
  if (problems.length) { res.status(400).json({ error: problems[0], problems }); return false; }
  return true;
}

router.post('/api/lab-feed/reference-ranges', async (req: Request, res: Response) => {
  const who = await requireRole(req, res, ADMIN);
  if (!who) return;
  const r = rangeFromBody(req.body ?? {});
  if (!validate(res, r)) return;
  try {
    const now = new Date().toISOString();
    const { data, error } = await sb().from('lab_reference_ranges')
      .insert({ ...referenceRangeToRow(r), is_default: false, created_by: who.userId, updated_by: who.userId, created_at: now, updated_at: now })
      .select('*').single();
    if (error) {
      if (missing(res, error)) return;
      if ((error as { code?: string }).code === '23505') { res.status(409).json({ error: 'A live range with the same analyte, sex, age band and date exists — change that one' }); return; }
      if ((error as { code?: string }).code === '23514') { res.status(400).json({ error: 'The database refused these limits' }); return; }
      throw error;
    }
    _clearRangeCache();
    await audit({ action: 'create', entityType: 'lab_reference_range', entityId: (data as { id: string }).id, userId: who.userId, userEmail: who.email ?? undefined, payload: { after: referenceRangeToRow(r) } });
    res.status(201).json({ range: data });
  } catch (err) {
    logger.error({ err }, '[lab-feed] range create failed');
    res.status(502).json({ error: 'The range could not be saved' });
  }
});

router.patch('/api/lab-feed/reference-ranges/:id', async (req: Request, res: Response) => {
  const who = await requireRole(req, res, ADMIN);
  if (!who) return;
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    const supa = sb();
    const { data: cur, error: curErr } = await supa.from('lab_reference_ranges').select('*').eq('id', id).maybeSingle();
    if (curErr) { if (missing(res, curErr)) return; throw curErr; }
    const current = cur as (ReferenceRangeRow & { id: string; is_default: boolean; retired_at: string | null }) | null;
    if (!current) { res.status(404).json({ error: 'Range not found' }); return; }
    if (current.is_default) { res.status(409).json({ error: 'A default range cannot be edited: add your laboratory’s range instead' }); return; }
    if (current.retired_at) { res.status(409).json({ error: 'This range is retired' }); return; }
    const before = rowToReferenceRange({ ...current, retired_at: null });
    const merged = rangeFromBody({ ...(before ?? {}), ...(req.body ?? {}) });
    if (!validate(res, merged)) return;
    const now = new Date().toISOString();
    const { data, error } = await supa.from('lab_reference_ranges')
      .update({ ...referenceRangeToRow(merged), updated_by: who.userId, updated_at: now })
      .eq('id', id).select('*').single();
    if (error) {
      if ((error as { code?: string }).code === '23505') { res.status(409).json({ error: 'A live range with the same analyte, sex, age band and date exists' }); return; }
      if ((error as { code?: string }).code === '23514') { res.status(400).json({ error: 'The database refused these limits' }); return; }
      throw error;
    }
    _clearRangeCache();
    await audit({
      action: 'update', entityType: 'lab_reference_range', entityId: id, userId: who.userId, userEmail: who.email ?? undefined,
      payload: { before: before ? referenceRangeToRow(before) : null, after: referenceRangeToRow(merged) },
    });
    res.json({ range: data });
  } catch (err) {
    logger.error({ err }, '[lab-feed] range update failed');
    res.status(502).json({ error: 'The range could not be saved' });
  }
});

router.post('/api/lab-feed/reference-ranges/:id/retire', async (req: Request, res: Response) => {
  const who = await requireRole(req, res, ADMIN);
  if (!who) return;
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    const supa = sb();
    const now = new Date().toISOString();
    const { data, error } = await supa.from('lab_reference_ranges')
      .update({ retired_at: now, retired_by: who.userId, updated_by: who.userId, updated_at: now })
      .eq('id', id).eq('is_default', false).is('retired_at', null).select('id, analyte, sex');
    if (error) { if (missing(res, error)) return; throw error; }
    if (!data || (data as unknown[]).length === 0) { res.status(404).json({ error: 'No live practice range with this id' }); return; }
    _clearRangeCache();
    await audit({ action: 'retire', entityType: 'lab_reference_range', entityId: id, userId: who.userId, userEmail: who.email ?? undefined, payload: { range: (data as unknown[])[0] } });
    res.json({ id, retired_at: now });
  } catch (err) {
    logger.error({ err }, '[lab-feed] range retire failed');
    res.status(502).json({ error: 'The range could not be retired' });
  }
});

export default router;
