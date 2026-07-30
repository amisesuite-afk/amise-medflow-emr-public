import { sb } from './supabase.js';
import { logger } from './logger.js';
import type { Request } from 'express';

/**
 * Write a structured audit-log entry to the canonical `audit_log` table.
 * Call fire-and-forget (`void logAudit(...)`). Never throws.
 *
 * action taxonomy:
 *   view, create, update, delete, approve, reject, export
 *   sign, amend, ai_call, ai_approve, ai_reject
 *   login, logout, access_denied
 *   task_resolve, task_dismiss, state_transition
 *
 * resource_type taxonomy:
 *   patient, encounter, clinical_note, investigation_result, imaging_order
 *   document, ai_proposal, clinical_state, workflow_task, referral
 *   invoice, appointment, user, system, voice_transcript
 */
export async function logAudit(
  req: Request,
  action: string,
  resourceType: string,
  resourceId?: string,
  patientId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    let userId: string | null = null;
    let userEmail: string | null = null;

    const authHeader = req.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const { data } = await sb().auth.getUser(authHeader.slice(7));
      if (data?.user) {
        userId    = data.user.id;
        userEmail = data.user.email ?? null;
      }
    }

    const forwarded = req.headers?.['x-forwarded-for'];
    const ipAddress: string | null =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : null)
      ?? (req as unknown as { socket?: { remoteAddress?: string } }).socket?.remoteAddress
      ?? null;

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    await sb().from('audit_log').insert({
      user_id:       userId,
      user_email:    userEmail,
      action,
      resource_type: resourceType,
      resource_id:   resourceId && uuidRe.test(resourceId) ? resourceId : null,
      patient_id:    patientId  && uuidRe.test(patientId)  ? patientId  : null,
      details:       details ?? null,
      ip_address:    ipAddress,
      user_agent:    (req.headers?.['user-agent'] as string | undefined) ?? null,
      mode:          process.env.MODE ?? null,
    });
  } catch (err) {
    logger.error({ err }, '[audit] logAudit insert failed');
  }
}
