/**
 * Critical lab-feed results → staff-internal alerts. Never to a patient.
 *
 *   1. In-app (always): an urgent workflow task, and the dashboard's critical-result banner for
 *      doctors and admins (it polls GET /api/lab-feed/alerts).
 *   2. Email (when DOCTOR_NOTIFY_EMAIL is set): through sendOrDraft, i.e. the MODE gate in
 *      lib/outbound.ts. dry_run → nothing leaves the server; supervised → promoted to a direct
 *      send because it is staff-internal (resolveEmailMode 'auto' cannot lift dry_run); auto →
 *      sent. The email carries no patient data: no name, MRN, analyte or value — only that a
 *      critical result is waiting, from which laboratory, and where to look.
 *
 * The escalation expectation (who acts, how fast, what if nobody opens it) is a surgeon
 * decision: docs/clinical-validation/changes/lab-feed.md → "Needs sign-off".
 */
import { sendOrDraft } from '../gmail.js';
import { audit } from '../supabase.js';
import { logger } from '../logger.js';

export interface CriticalAlertInput {
  labId: string;
  messageRowId: string;
  attachedCritical: number;
  queuedCritical: number;
  now: Date;
}

function ectTime(d: Date): string {
  const local = new Date(d.getTime() - 4 * 3600_000).toISOString();
  return `${local.slice(0, 10)} ${local.slice(11, 16)} ECT`;
}

export function criticalAlertEmail(input: CriticalAlertInput): { subject: string; body: string } {
  const total = input.attachedCritical + input.queuedCritical;
  const lines = [
    `${total} critical laboratory result${total === 1 ? '' : 's'} arrived from "${input.labId}" at ${ectTime(input.now)}.`,
    '',
    input.attachedCritical > 0
      ? `- ${input.attachedCritical} filed to the patient record: Dashboard → Results Inbox → New results (lab feed).`
      : '',
    input.queuedCritical > 0
      ? `- ${input.queuedCritical} could not be matched to a patient automatically: Dashboard → Results Inbox → To reconcile. Match it first.`
      : '',
    '',
    'This message contains no patient details. Open the dashboard to review.',
    'Staff-internal alert from AMISE MedFlow — do not forward to patients.',
  ].filter((l, i, all) => l !== '' || (i > 0 && all[i - 1] !== ''));
  return { subject: '[CRITICAL RESULT] Laboratory result waiting for review', body: lines.join('\n') };
}

export type CriticalAlertStatus = 'sent' | 'drafted' | 'skipped' | 'no_recipient' | 'failed';

export async function notifyCriticalLabResults(input: CriticalAlertInput): Promise<CriticalAlertStatus> {
  const to = process.env.DOCTOR_NOTIFY_EMAIL?.trim();
  if (!to) {
    logger.warn({ labId: input.labId }, '[lab-feed] critical result: DOCTOR_NOTIFY_EMAIL not set — in-app alert only');
    return 'no_recipient';
  }
  try {
    const { subject, body } = criticalAlertEmail(input);
    // Staff-internal: 'auto' promotes past the supervised draft step; it can never lift dry_run.
    const r = await sendOrDraft({ to, subject, body }, 'auto');
    await audit({
      action: 'lab_alert_sent',
      entityType: 'lab_feed_message',
      entityId: input.messageRowId,
      payload: { labId: input.labId, attachedCritical: input.attachedCritical, queuedCritical: input.queuedCritical, email: r.action },
    });
    return r.action;
  } catch (err) {
    logger.error({ err, labId: input.labId }, '[lab-feed] critical result email failed — in-app alert still shown');
    return 'failed';
  }
}
