import { sb } from './supabase.js'
import { logger } from './logger.js'
import type { Request } from 'express'

/**
 * Write a structured audit-log entry to the `audit_log` table.
 *
 * Call fire-and-forget (void logAudit(...)) — this function never throws.
 * Any DB or auth error is caught and logged silently so it cannot affect
 * the calling request's response.
 *
 * @param req          - The Express Request (used to extract caller identity + IP).
 * @param action       - Verb: 'view' | 'create' | 'update' | 'delete' | 'approve' | 'export'
 * @param resourceType - Entity kind: 'patient' | 'appointment' | 'document' | 'note' | 'prescription'
 * @param resourceId   - The primary-key value of the affected record (string / UUID).
 * @param patientId    - UUID of the associated patient, when known.
 * @param details      - Arbitrary structured context written to the `details` jsonb column.
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
    // Attempt to resolve the calling user from the Authorization Bearer JWT.
    // Falls back gracefully when the header is absent (e.g. cron / x-staff-token calls).
    let userId: string | null = null
    let userEmail: string | null = null

    const authHeader = req.headers?.authorization
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const jwt = authHeader.slice(7)
      const { data } = await sb().auth.getUser(jwt)
      if (data?.user) {
        userId = data.user.id
        userEmail = data.user.email ?? null
      }
    }

    // Best-effort IP extraction — respects X-Forwarded-For set by proxies.
    const forwarded = req.headers?.['x-forwarded-for']
    const ipAddress: string | null =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : null)
      ?? (req as any).socket?.remoteAddress
      ?? null

    await sb().from('audit_log').insert({
      user_id: userId,
      user_email: userEmail,
      action,
      resource_type: resourceType,
      resource_id: resourceId ?? null,
      patient_id: patientId ?? null,
      details: details ?? null,
      ip_address: ipAddress,
    })
  } catch (err) {
    // Never propagate — audit failures must not break clinical workflows.
    logger.error({ err }, '[audit] logAudit insert failed')
  }
}
