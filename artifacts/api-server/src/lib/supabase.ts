import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger.js';

let _client: SupabaseClient | null = null;

export function sb(): SupabaseClient {
  if (_client) return _client;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  _client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  return _client;
}

export function getSupabaseAdmin(): SupabaseClient {
  return sb();
}

/**
 * Gate for staff-only routes. Accepts either:
 *  - x-staff-token: <CRON_SECRET>   (simple shared secret for internal tools)
 *  - Authorization: Bearer <supabase-jwt>  (standard staff session)
 */
export async function requireStaffAuth(req: any, res: any): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const staffToken = req.headers['x-staff-token'];
    if (staffToken === cronSecret) return true;
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const jwt = authHeader.slice(7);
    const { data, error } = await sb().auth.getUser(jwt);
    if (!error && data?.user) return true;
  }

  res.status(401).json({ error: 'Unauthorised — provide x-staff-token or a valid Bearer token' });
  return false;
}

/** Extract the authenticated staff user's UUID from the request JWT. Returns null for cron/service calls. */
export async function getStaffUserId(req: any): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const jwt = authHeader.slice(7);
    const { data, error } = await sb().auth.getUser(jwt);
    if (!error && data?.user?.id) return data.user.id;
  }
  return null;
}

export function requireCronSecret(req: any, res: any): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.warn('[cron] CRON_SECRET not set — rejecting request');
    res.status(503).json({ error: 'CRON_SECRET not configured' });
    return false;
  }
  // Header-only: never accept the secret as a query parameter because URL
  // query strings appear in access logs, proxy logs, and browser history.
  const provided = req.headers['x-cron-secret'];
  if (provided !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export type AuditAction =
  | 'classify' | 'triage' | 'draft' | 'send' | 'book' | 'notify'
  | 'remind' | 'escalate' | 'error' | 'skip'
  | 'portal_invite_sent' | 'extract' | 'change_request' | 'auto_cancel'
  | 'lab_alert_sent' | 'sign' | 'amend';

export async function audit(args: {
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  patientId?: string;
  userEmail?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const recordId  = args.entityId  && uuidRe.test(args.entityId)  ? args.entityId  : null;
    const patientId = args.patientId && uuidRe.test(args.patientId) ? args.patientId : null;
    await sb().from('audit_log').insert({
      action:        args.action,
      resource_type: args.entityType ?? null,
      resource_id:   recordId,
      patient_id:    patientId,
      user_email:    args.userEmail ?? null,
      details:       args.payload ? { payload: args.payload } : null,
      mode:          process.env.MODE ?? null,
    });
  } catch (err) {
    logger.error({ err }, '[audit] failed');
  }
}

export async function upsertPatient(args: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}): Promise<string> {
  const { data, error } = await sb()
    .from('patients')
    .upsert({
      email: args.email,
      first_name: args.firstName,
      last_name: args.lastName,
      phone: args.phone,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}
