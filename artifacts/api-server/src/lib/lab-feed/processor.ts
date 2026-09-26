/**
 * Inbound laboratory message → message log, patient match, investigation_results row or
 * reconciliation queue item, workflow tasks, critical alert.
 *
 * Idempotent:
 *   - per message: (lab_id, message_id) is unique in lab_feed_messages. A resend of a message
 *     that was processed returns "duplicate" and changes nothing. A message whose earlier run
 *     failed (or never finished) is processed again.
 *   - per report: `lab_report_ref` (investigation_results) and `report_ref` (reconcile queue)
 *     are unique, and both are checked before a report is stored, so a report is never filed
 *     twice, even across different messages.
 * No message body and no patient identifier is logged: message id, lab id, counts and codes only.
 */
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { audit } from '../supabase.js';
import { logger } from '../logger.js';
import { isMissingTableError } from '../prediction-snapshots.js';
import { createWorkflowTask } from '../workflow-tasks.js';
import { notifyCriticalLabResults, type CriticalAlertStatus } from './alerts.js';
import { parseFhir } from './fhir.js';
import { parseHl7 } from './hl7.js';
import { decideMatch, findPatientsByMrn, type QueueReason } from './matching.js';
import { buildResultRow, normaliseObservation } from './normalise.js';
import { loadPracticeRanges } from './ranges.js';
import { FeedParseError, MAX_FEED_BYTES, type FeedFormat, type FeedMessage, type FeedReport } from './types.js';

export type MessageStatus = 'processed' | 'queued' | 'partial' | 'duplicate' | 'rejected' | 'failed' | 'unavailable';
export type ReportOutcome = 'attached' | 'queued' | 'duplicate' | 'skipped' | 'failed';

export interface ProcessResult {
  status: MessageStatus;
  format: FeedFormat | null;
  messageId: string | null;
  messageRowId: string | null;
  errorCode?: string;
  errorText?: string;
  reports: Array<{ reportRef: string; outcome: ReportOutcome; critical: boolean; reason?: QueueReason | string }>;
  criticalAlert?: CriticalAlertStatus;
}

const DONE = new Set(['processed', 'queued', 'partial', 'duplicate']);

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function code(err: unknown): string | undefined {
  return (err as { code?: string } | null)?.code;
}

export function detectFormat(body: string, contentType: string | undefined): FeedFormat | null {
  const ct = (contentType ?? '').toLowerCase();
  const head = body.replace(/^[﻿\x0b\s]+/, '').slice(0, 4);
  if (ct.includes('hl7') || head.startsWith('MSH')) return 'hl7v2';
  if (ct.includes('json') || head.startsWith('{')) return 'fhir-r4';
  return null;
}

export function parseFeedBody(body: string, contentType: string | undefined): FeedMessage {
  if (Buffer.byteLength(body, 'utf8') > MAX_FEED_BYTES) throw new FeedParseError('too_large', 'The message is larger than 2 MB');
  const format = detectFormat(body, contentType);
  if (format === 'hl7v2') return parseHl7(body);
  if (format === 'fhir-r4') {
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new FeedParseError('invalid_json', 'The body is not valid JSON');
    }
    return parseFhir(json);
  }
  throw new FeedParseError('unknown_format', 'Send HL7 v2 (ER7, starting with MSH) or FHIR R4 JSON');
}

export function reportRef(labId: string, messageId: string, report: FeedReport, index: number): string {
  const id = report.reportId ?? `msg-${messageId}-${index + 1}`;
  return `${labId}:${id}:${report.statusCode}:${report.reportedAt ?? ''}`.slice(0, 400);
}

async function alreadyStored(supa: SupabaseClient, ref: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    supa.from('investigation_results').select('id').eq('lab_report_ref', ref).limit(1),
    supa.from('lab_results_to_reconcile').select('id').eq('report_ref', ref).limit(1),
  ]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
  return (a.data ?? []).length > 0 || (b.data ?? []).length > 0;
}

/** Insert the log row, or find the earlier one. */
async function claimMessage(
  supa: SupabaseClient,
  row: Record<string, unknown>,
): Promise<{ kind: 'new' | 'retry'; id: string } | { kind: 'done'; id: string; status: string } | { kind: 'unavailable' }> {
  const ins = await supa.from('lab_feed_messages').insert(row).select('id').single();
  if (!ins.error && ins.data) return { kind: 'new', id: (ins.data as { id: string }).id };
  if (ins.error && isMissingTableError(ins.error)) return { kind: 'unavailable' };
  if (code(ins.error) !== '23505') throw ins.error;
  const found = await supa.from('lab_feed_messages').select('id, status')
    .eq('lab_id', row.lab_id as string).eq('message_id', row.message_id as string).maybeSingle();
  if (found.error) throw found.error;
  const prev = found.data as { id: string; status: string } | null;
  if (!prev) throw ins.error;
  if (DONE.has(prev.status)) return { kind: 'done', id: prev.id, status: prev.status };
  return { kind: 'retry', id: prev.id };
}

export async function receiveLabMessage(args: {
  supa: SupabaseClient;
  labId: string;
  body: string;
  contentType: string | undefined;
  now?: Date;
}): Promise<ProcessResult> {
  const { supa, labId, body } = args;
  const now = args.now ?? new Date();
  const bodySha = sha256(body);
  const bodyBytes = Buffer.byteLength(body, 'utf8');

  // 1. Parse. A malformed message is logged (no body) and rejected.
  let msg: FeedMessage;
  try {
    msg = parseFeedBody(body, args.contentType);
  } catch (err) {
    const pe = err instanceof FeedParseError ? err : new FeedParseError('parse_failed', 'The message could not be read');
    const format = detectFormat(body, args.contentType);
    try {
      const { error } = await supa.from('lab_feed_messages').insert({
        lab_id: labId, message_id: `sha256:${bodySha}`, format: format ?? 'hl7v2', status: 'rejected',
        error_code: pe.code.slice(0, 40), error_detail: pe.message.slice(0, 300), body_sha256: bodySha, body_bytes: bodyBytes,
        processed_at: now.toISOString(),
      });
      if (error && isMissingTableError(error)) return { status: 'unavailable', format, messageId: null, messageRowId: null, reports: [] };
    } catch (logErr) {
      logger.warn({ err: logErr, labId }, '[lab-feed] could not log a rejected message');
    }
    logger.warn({ labId, code: pe.code, bytes: bodyBytes }, '[lab-feed] message rejected');
    return { status: 'rejected', format, messageId: null, messageRowId: null, errorCode: pe.code, errorText: pe.message, reports: [] };
  }

  const messageId = msg.messageId!.slice(0, 200);
  const claim = await claimMessage(supa, {
    lab_id: labId, message_id: messageId, format: msg.format, status: 'received',
    report_count: msg.reports.length, body_sha256: bodySha, body_bytes: bodyBytes, received_at: now.toISOString(),
  });
  if (claim.kind === 'unavailable') {
    logger.warn({ labId }, '[lab-feed] lab_feed_messages missing (Migration 96 not applied) — message refused, the laboratory will retry');
    return { status: 'unavailable', format: msg.format, messageId, messageRowId: null, reports: [] };
  }
  if (claim.kind === 'done') {
    logger.info({ labId, messageId, previous: claim.status }, '[lab-feed] duplicate message — already processed');
    return { status: 'duplicate', format: msg.format, messageId, messageRowId: claim.id, reports: [] };
  }
  const messageRowId = claim.id;

  // 2. Each report: skip, duplicate, attach or queue.
  const practice = await loadPracticeRanges(supa, now.getTime());
  const result: ProcessResult = { status: 'processed', format: msg.format, messageId, messageRowId, reports: [] };
  let attachedCritical = 0;
  let queuedCritical = 0;

  for (const [i, report] of msg.reports.entries()) {
    const ref = reportRef(labId, messageId, report, i);
    try {
      if (report.status === 'cancelled' || report.observations.length === 0) {
        result.reports.push({ reportRef: ref, outcome: 'skipped', critical: false, reason: report.status === 'cancelled' ? 'cancelled' : 'no_results' });
        continue;
      }
      if (await alreadyStored(supa, ref)) {
        result.reports.push({ reportRef: ref, outcome: 'duplicate', critical: false });
        continue;
      }
      const decision = decideMatch(report.patient, await findPatientsByMrn(supa, report.patient.mrn));
      if (decision.kind === 'attach') {
        const row = buildResultRow({
          report, patientId: decision.patient.id,
          patient: { sex: decision.patient.sex, dateOfBirth: decision.patient.date_of_birth },
          practice, labId, messageRowId, reportRef: ref, receivedAt: now.toISOString(),
        });
        const ins = await supa.from('investigation_results').insert(row).select('id').single();
        if (ins.error) {
          if (code(ins.error) === '23505') { result.reports.push({ reportRef: ref, outcome: 'duplicate', critical: false }); continue; }
          throw ins.error;
        }
        const id = (ins.data as { id: string }).id;
        if (row.is_critical) attachedCritical++;
        result.reports.push({ reportRef: ref, outcome: 'attached', critical: row.is_critical });
        await audit({
          action: 'create', entityType: 'investigation_result', entityId: id, patientId: decision.patient.id,
          payload: { source: 'lab-feed', labId, messageId, reportRef: ref, analytes: row.analytes.length, abnormal: row.is_abnormal, critical: row.is_critical, match: 'mrn+dob' },
        });
        void createWorkflowTask({
          task_type: 'review_result', patient_id: decision.patient.id, source_type: 'investigation_result', source_id: id,
          title: `Review lab result${row.is_critical ? ' — CRITICAL' : row.is_abnormal ? ' — abnormal' : ''} (lab feed)`,
          details: row.test_name, priority: row.is_critical ? 'urgent' : row.is_abnormal ? 'high' : 'normal',
        });
      } else {
        const identitySex = report.patient.sex === 'male' || report.patient.sex === 'female' ? report.patient.sex : null;
        const analytes = report.observations.map(o => normaliseObservation(o, report.specimen, report.collectedAt, practice,
          { sex: identitySex, dateOfBirth: report.patient.dob }));
        const isCritical = analytes.some(x => x.critical);
        const ins = await supa.from('lab_results_to_reconcile').insert({
          message_id: messageRowId, lab_id: labId, report_ref: ref, reason: decision.reason,
          received_mrn: report.patient.mrn?.slice(0, 100) ?? null,
          received_family_name: report.patient.familyName?.slice(0, 200) ?? null,
          received_given_name: report.patient.givenName?.slice(0, 200) ?? null,
          received_dob: report.patient.dob, received_sex: report.patient.sex,
          test_name: report.testName.slice(0, 200), collected_at: report.collectedAt, reported_at: report.reportedAt,
          performing_lab: report.performingLab?.slice(0, 200) ?? null,
          observations: report.observations.map(o => ({ ...o, comments: o.comments.map(c => c.slice(0, 1000)) })),
          is_abnormal: analytes.some(x => x.abnormal), is_critical: isCritical,
          status: 'open',
        }).select('id').single();
        if (ins.error) {
          if (code(ins.error) === '23505') { result.reports.push({ reportRef: ref, outcome: 'duplicate', critical: false }); continue; }
          throw ins.error;
        }
        const id = (ins.data as { id: string }).id;
        if (isCritical) queuedCritical++;
        result.reports.push({ reportRef: ref, outcome: 'queued', critical: isCritical, reason: decision.reason });
        await audit({
          action: 'create', entityType: 'lab_result_to_reconcile', entityId: id,
          payload: { source: 'lab-feed', labId, messageId, reportRef: ref, reason: decision.reason, critical: isCritical },
        });
        void createWorkflowTask({
          task_type: 'other', source_type: 'lab_result_to_reconcile', source_id: id,
          title: `Match a lab result to a patient${isCritical ? ' — CRITICAL' : ''} (lab feed)`,
          details: 'Results Inbox → To reconcile', priority: isCritical ? 'urgent' : 'high',
        });
      }
    } catch (err) {
      logger.error({ err, labId, messageId, report: i + 1 }, '[lab-feed] report could not be stored');
      result.reports.push({ reportRef: ref, outcome: 'failed', critical: false });
    }
  }

  // 3. Message status and counts.
  const count = (o: ReportOutcome) => result.reports.filter(r => r.outcome === o).length;
  const attached = count('attached'), queued = count('queued'), duplicate = count('duplicate'), failed = count('failed');
  if (failed > 0) result.status = 'failed';
  else if (attached > 0 && queued > 0) result.status = 'partial';
  else if (queued > 0) result.status = 'queued';
  else if (attached === 0 && duplicate > 0) result.status = 'duplicate';
  else result.status = 'processed';
  const { error: updErr } = await supa.from('lab_feed_messages').update({
    status: result.status, processed_at: new Date().toISOString(),
    attached_count: attached, queued_count: queued, duplicate_count: duplicate,
    critical_count: attachedCritical + queuedCritical,
    error_code: failed > 0 ? 'report_failed' : null,
    error_detail: failed > 0 ? `${failed} report(s) could not be stored; resend the message` : null,
  }).eq('id', messageRowId);
  if (updErr) logger.warn({ err: updErr, labId, messageId }, '[lab-feed] message log update failed');
  if (failed > 0) result.errorCode = 'report_failed';

  // 4. Critical: staff-internal alert (the in-app banner reads the rows directly).
  if (attachedCritical + queuedCritical > 0) {
    result.criticalAlert = await notifyCriticalLabResults({ labId, messageRowId, attachedCritical, queuedCritical, now });
  }
  logger.info({ labId, messageId, status: result.status, attached, queued, duplicate, failed, critical: attachedCritical + queuedCritical },
    '[lab-feed] message processed');
  return result;
}
