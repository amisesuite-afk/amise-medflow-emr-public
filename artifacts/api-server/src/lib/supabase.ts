import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
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
    { auth: { persistSession: false }, realtime: { transport: ws } }
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

export function requireCronSecret(req: any, res: any): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.warn('[cron] CRON_SECRET not set — rejecting request');
    res.status(503).json({ error: 'CRON_SECRET not configured' });
    return false;
  }
  const provided = req.headers['x-cron-secret'] || req.query?.secret;
  if (provided !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export type AuditAction =
  | 'classify' | 'triage' | 'draft' | 'send' | 'book'
  | 'remind' | 'escalate' | 'error' | 'skip'
  | 'portal_invite_sent' | 'extract' | 'change_request' | 'auto_cancel';

export async function audit(args: {
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    // audit_logs columns: table_name (text), record_id (uuid), new_values (jsonb)
    // record_id is uuid — only set it when entityId looks like a valid UUID
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const recordId = args.entityId && uuidRe.test(args.entityId) ? args.entityId : null;
    await sb().from('audit_logs').insert({
      action: args.action,
      table_name: args.entityType ?? null,
      record_id: recordId,
      new_values: args.payload ?? null,
      mode: process.env.MODE,
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
