import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ConversationThread } from '@/types';

// Service client — only used server-side in API routes (lazy to avoid build-time errors)
export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';
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

// ── Clinical document AI-extraction review queue ─────────────────────────────
// Patients upload PDFs/images via the portal; the api-server runs a
// triage-only Claude extraction pass (structured facts + flags — never a
// diagnosis) and writes the result back onto the `documents` row. Staff review
// and acknowledge flagged documents here before anything reaches the chart.

export interface DocumentReviewRow {
  id: string;
  patient_id: string;
  patient_name: string | null;
  document_type: string;
  title: string;
  file_name: string | null;
  mime_type: string | null;
  source: string;
  created_at: string;
  ai_extraction_status: string;
  ai_extracted_data: string | null;
  ai_flags: string | null;
  ai_extraction_at: string | null;
  staff_reviewed_by: string | null;
  staff_reviewed_at: string | null;
  view_url: string | null;
}

export async function getDocumentsForReview(limit = 50): Promise<DocumentReviewRow[]> {
  const { data: docs } = await getServiceClient()
    .from('documents')
    .select('id, patient_id, document_type, title, file_name, mime_type, source, storage_path, created_at, ai_extraction_status, ai_extracted_data, ai_flags, ai_extraction_at, staff_reviewed_by, staff_reviewed_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!docs?.length) return [];

  const patientIds = [...new Set(docs.map(d => d.patient_id).filter(Boolean))];
  const { data: patients } = await getServiceClient()
    .from('patients')
    .select('id, full_name')
    .in('id', patientIds);

  const nameById = Object.fromEntries((patients ?? []).map(p => [p.id, p.full_name as string]));

  const sb = getServiceClient();
  const viewUrls = await Promise.all(docs.map(d =>
    d.storage_path
      ? sb.storage.from('patient-documents').createSignedUrl(d.storage_path, 3600).then(r => r.data?.signedUrl ?? null)
      : Promise.resolve(null)
  ));

  return docs.map((d, i) => {
    const { storage_path: _storage_path, ...rest } = d;
    return { ...rest, patient_name: nameById[d.patient_id] ?? null, view_url: viewUrls[i] };
  }) as DocumentReviewRow[];
}


export async function markDocumentReviewed(id: string, staffUserId: string | null): Promise<void> {
  const { error } = await getServiceClient()
    .from('documents')
    .update({ staff_reviewed_at: new Date().toISOString(), staff_reviewed_by: staffUserId })
    .eq('id', id);
  if (error) throw new Error(`markDocumentReviewed: ${error.message}`);
}

// On-demand "old system" migration — staff attach a patient's historic
// records (paper/PDF scans from the previous system) while handling a
// pending request or an upcoming/in-progress encounter, never as a bulk job.
// Matches an existing patient by email/phone, or creates one (mirrors the
// match-or-create logic used when a consultation request is "registered").
export async function findOrCreatePatientForBooking(
  booking: { patient_name: string; patient_email: string | null; patient_phone: string | null },
): Promise<string> {
  const sb = getServiceClient();
  const normalEmail = booking.patient_email?.trim().toLowerCase() || null;

  if (normalEmail) {
    const { data: existing } = await sb.from('patients').select('id').eq('email', normalEmail).maybeSingle();
    if (existing) return existing.id;
  }
  if (booking.patient_phone) {
    const { data: existing } = await sb.from('patients').select('id').eq('phone', booking.patient_phone).maybeSingle();
    if (existing) return existing.id;
  }

  const { data: created, error } = await sb
    .from('patients')
    .insert({ full_name: booking.patient_name, phone: booking.patient_phone, email: normalEmail })
    .select('id')
    .single();
  if (error) throw new Error(`findOrCreatePatientForBooking: ${error.message}`);
  return created.id;
}

// ── Procedure-prep adjustment drafts ─────────────────────────────────────────
// Claude-drafted, patient-specific flags (anticoagulant/diabetes meds, renal
// impairment, etc.) ahead of a colonoscopy/gastroscopy, queued here for
// clinical staff review. Always internal — never sent directly to a patient.
// See supabase-procedure-prep-drafts-migration.sql.

export interface ProcedurePrepDraftRow {
  id: string;
  thread_id: string | null;
  procedure_type: string;
  patient_name: string | null;
  draft_text: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'sent';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export async function createProcedurePrepDraft(
  row: Pick<ProcedurePrepDraftRow, 'thread_id' | 'procedure_type' | 'patient_name' | 'draft_text'>,
): Promise<ProcedurePrepDraftRow> {
  const { data, error } = await getServiceClient()
    .from('procedure_prep_drafts')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`createProcedurePrepDraft: ${error.message}`);
  return data as ProcedurePrepDraftRow;
}

export async function listProcedurePrepDrafts(
  status: ProcedurePrepDraftRow['status'] = 'pending_approval',
): Promise<ProcedurePrepDraftRow[]> {
  const { data } = await getServiceClient()
    .from('procedure_prep_drafts')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });
  return (data ?? []) as ProcedurePrepDraftRow[];
}

export async function updateProcedurePrepDraft(
  id: string,
  patch: Partial<Pick<ProcedurePrepDraftRow, 'status' | 'reviewed_by' | 'reviewed_at'>>,
): Promise<void> {
  const { error } = await getServiceClient()
    .from('procedure_prep_drafts')
    .update(patch)
    .eq('id', id);
  if (error) throw new Error(`updateProcedurePrepDraft: ${error.message}`);
}

export interface RegisterHistoricDocumentArgs {
  patientId: string;
  documentType: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
}

const DOCUMENTS_BUCKET = 'patient-documents';

export async function registerHistoricDocument(args: RegisterHistoricDocumentArgs): Promise<string> {
  const sb = getServiceClient();
  const ts = Date.now();
  const safeName = args.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  // `staff/` prefix distinguishes staff-attached historic scans from
  // patient-portal uploads (which live under their own auth user id).
  const path = `staff/${args.patientId}/${ts}_${safeName}`;

  const { error: uploadErr } = await sb.storage.from(DOCUMENTS_BUCKET).upload(path, args.fileBuffer, {
    contentType: args.mimeType,
    upsert: false,
  });
  if (uploadErr) throw new Error(`registerHistoricDocument upload: ${uploadErr.message}`);

  const { data, error } = await sb
    .from('documents')
    .insert({
      patient_id:           args.patientId,
      document_type:        args.documentType,
      title:                args.title,
      file_name:            args.fileName,
      storage_path:         path,
      mime_type:            args.mimeType,
      file_size_bytes:      args.fileBuffer.length,
      source:               'scanned',
      ai_extraction_status: 'pending',
    })
    .select('id')
    .single();
  if (error) throw new Error(`registerHistoricDocument insert: ${error.message}`);
  return data.id;
}
