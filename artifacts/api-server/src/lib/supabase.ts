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
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  return createClient(url, key, { auth: { persistSession: false } });
}

export type AuditAction =
  | 'classify' | 'triage' | 'draft' | 'send' | 'book'
  | 'remind' | 'escalate' | 'error' | 'skip';

export async function audit(args: {
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await sb().from('audit_log').insert({
      action: args.action,
      entity_type: args.entityType,
      entity_id: args.entityId,
      payload: args.payload,
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
