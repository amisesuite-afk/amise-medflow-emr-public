import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ConversationThread } from '@/types';

const url  = process.env.SUPABASE_URL!;
const anon = process.env.SUPABASE_ANON_KEY!;
const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Anon client — used in dashboard for Realtime subscriptions
export const supabaseAnon: SupabaseClient = createClient(url, anon);

// Service client — only used server-side in API routes
export function getServiceClient(): SupabaseClient {
  return createClient(url, svc, { auth: { persistSession: false } });
}

export async function getThread(id: string): Promise<ConversationThread | null> {
  const { data } = await getServiceClient()
    .from('conversation_threads')
    .select('*')
    .eq('id', id)
    .single();
  return data as ConversationThread | null;
}

export async function getOrCreateThread(
  patientIdentifier: string,
  channel: string,
): Promise<ConversationThread> {
  const sb = getServiceClient();
  // Look for an active thread in the last 24 h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await sb
    .from('conversation_threads')
    .select('*')
    .eq('patient_identifier', patientIdentifier)
    .in('status', ['active', 'pending_approval'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing as ConversationThread;

  const { data: created, error } = await sb
    .from('conversation_threads')
    .insert({
      channel,
      patient_identifier: patientIdentifier,
      triage_level: 'INFO',
      status: 'active',
      messages: [],
      intake_complete: false,
      site: 'rodney_bay',
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create thread: ${error.message}`);
  return created as ConversationThread;
}

export async function updateThread(
  id: string,
  patch: Partial<ConversationThread>,
): Promise<void> {
  const { error } = await getServiceClient()
    .from('conversation_threads')
    .update(patch)
    .eq('id', id);
  if (error) throw new Error(`Failed to update thread: ${error.message}`);
}

export async function logAudit(
  threadId: string,
  action: string,
  actor: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await getServiceClient().from('intake_audit_log').insert({
    thread_id: threadId,
    action,
    actor,
    details: details ?? {},
  });
}

export async function getRecentThreads(): Promise<ConversationThread[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await getServiceClient()
    .from('conversation_threads')
    .select('*')
    .gte('created_at', since)
    .order('updated_at', { ascending: false });
  return (data ?? []) as ConversationThread[];
}
