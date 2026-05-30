import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ConversationThread } from '@/types';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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

// ── Booking requests ──────────────────────────────────────────────────────────

export interface BookingRow {
  id: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  appointment_type: string;
  location: string;
  preferred_slot: string | null;
  reason: string | null;
  triage_acuity: string | null;
  status: string;
  notes: string | null;
  confirmed_slot: string | null;
  google_event_id: string | null;
  created_at: string;
}

export async function createBookingRequest(
  row: Omit<BookingRow, 'id' | 'created_at'>,
): Promise<BookingRow> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from('appointment_requests')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`createBookingRequest: ${error.message}`);
  return data as BookingRow;
}

export async function updateBookingRequest(
  id: string,
  patch: Partial<BookingRow>,
): Promise<void> {
  const { error } = await getServiceClient()
    .from('appointment_requests')
    .update(patch)
    .eq('id', id);
  if (error) throw new Error(`updateBookingRequest: ${error.message}`);
}

export async function getRecentBookings(days = 7): Promise<BookingRow[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data } = await getServiceClient()
    .from('appointment_requests')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  return (data ?? []) as BookingRow[];
}

export async function getBookingById(id: string): Promise<BookingRow | null> {
  const { data } = await getServiceClient()
    .from('appointment_requests')
    .select('*')
    .eq('id', id)
    .single();
  return data as BookingRow | null;
}
