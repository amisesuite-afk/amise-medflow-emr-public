/**
 * /api/calls — voice signal ingestion and patient ID resolution.
 *
 * Every incoming voice signal (phone call via Asterisk/WATI, patient PWA
 * voice note, or ambient in-session recording) lands here and is matched
 * to an existing patient by phone number.
 *
 * Match found  → call_log written with patient_id; returns patient context
 * No match     → call_log written with patient_id=NULL; routed to front-desk
 *
 * Front desk resolves unmatched logs via PATCH /api/calls/:id/resolve,
 * either linking an existing patient or creating a new one on the spot.
 */

import { Router } from 'express';
import { z } from 'zod';
import { sb, requireStaffAuth } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── Phone normalisation ───────────────────────────────────────────────────────
// Strip everything except digits, then compare the last 7 digits.
// Handles +1-758-284-0557, 7582840557, 284-0557, etc.

function normPhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(-7);
}

async function lookupPatientByPhone(callerNumber: string): Promise<{ id: string; full_name: string; mrn: string | null } | null> {
  const norm = normPhone(callerNumber);
  if (norm.length < 7) return null;

  // Fetch all patients that have a phone on record and compare normalised
  // (Supabase doesn't support user-defined functions client-side, so we
  // fetch candidates with a LIKE filter and normalise in JS)
  const { data, error } = await sb()
    .from('patients')
    .select('id, full_name, mrn, phone')
    .not('phone', 'is', null)
    .ilike('phone', `%${norm.slice(-4)}%`) // rough pre-filter to limit rows
    .limit(200);

  if (error || !data) return null;

  const match = (data as Array<{ id: string; full_name: string; mrn: string | null; phone: string | null }>)
    .find(p => p.phone && normPhone(p.phone) === norm);
  return match ? { id: match.id, full_name: match.full_name, mrn: match.mrn } : null;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const IngestSchema = z.object({
  caller_number:  z.string().min(1).optional(),
  transcript:     z.string().optional(),
  audio_path:     z.string().optional(),
  duration_s:     z.number().int().nonnegative().optional(),
  source:         z.enum(['phone', 'whatsapp', 'patient_app', 'ambient']).default('phone'),
  direction:      z.enum(['inbound', 'outbound', 'ambient', 'app_message']).default('inbound'),
  soap_segmented: z.record(z.unknown()).optional(),
  patient_id:     z.string().uuid().optional(), // supplied by in-session ambient recordings
});

const ResolveSchema = z.object({
  // One of these must be supplied:
  existing_patient_id: z.string().uuid().optional(),
  new_patient: z.object({
    full_name:     z.string().min(1),
    phone:         z.string().optional(),
    date_of_birth: z.string().optional(), // ISO date
    sex:           z.enum(['male', 'female', 'other', 'unknown']).optional(),
  }).optional(),
  staff_notes: z.string().optional(),
});

// ── POST /api/calls/ingest ────────────────────────────────────────────────────
// Receives a voice signal, resolves patient, writes call_log.

router.post('/api/calls/ingest', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const parsed = IngestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }

  const d = parsed.data;

  // 1. Resolve patient_id
  let patientId: string | null = d.patient_id ?? null;
  let patientContext: { id: string; full_name: string; mrn: string | null } | null = null;
  let isNew = false;

  if (!patientId && d.caller_number) {
    patientContext = await lookupPatientByPhone(d.caller_number);
    if (patientContext) {
      patientId = patientContext.id;
    } else {
      isNew = true;
    }
  } else if (patientId) {
    const { data } = await sb()
      .from('patients')
      .select('id, full_name, mrn')
      .eq('id', patientId)
      .single();
    patientContext = data ?? null;
  }

  // 2. Write call_log
  const { data: log, error: logErr } = await sb()
    .from('call_logs')
    .insert({
      caller_number:  d.caller_number ?? null,
      patient_id:     patientId,
      source:         d.source,
      direction:      d.direction,
      transcript:     d.transcript ?? null,
      soap_segmented: d.soap_segmented ?? null,
      audio_path:     d.audio_path ?? null,
      duration_s:     d.duration_s ?? null,
    })
    .select('id')
    .single();

  if (logErr) {
    logger.error({ logErr }, '[calls/ingest] insert failed');
    res.status(502).json({ error: logErr.message });
    return;
  }

  // 3. If unresolved and has caller_number, also create a booking inquiry
  if (isNew && d.caller_number) {
    const snippetText: string = typeof d.transcript === 'string'
      ? `Voice message: ${(d.transcript as string).slice(0, 200)}`
      : 'Incoming phone call — no transcript';
    await sb().from('appointment_requests').insert({
      patient_name:     d.caller_number, // placeholder; front desk will fill name
      patient_phone:    d.caller_number,
      source:           'phone',
      status:           'pending',
      reason:           snippetText,
      appointment_type: 'new_patient',
    });
  }

  logger.info({ call_log_id: log!.id, patient_id: patientId, is_new: isNew }, '[calls/ingest] ok');

  res.json({
    call_log_id: log!.id,
    patient_id:  patientId,
    patient:     patientContext,
    is_new:      isNew,
  });
});

// ── GET /api/calls/unresolved ─────────────────────────────────────────────────
// Front-desk queue: calls with no matched patient.

router.get('/api/calls/unresolved', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const limit = Math.min(Number(req.query.limit ?? 50), 200);

  const { data, error } = await sb()
    .from('call_logs')
    .select('id, caller_number, source, direction, transcript, duration_s, created_at')
    .is('patient_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) { res.status(502).json({ error: error.message }); return; }
  res.json({ calls: data ?? [] });
});

// ── GET /api/calls/patient/:patientId ─────────────────────────────────────────
// All call logs for a patient — shown in their timeline.

router.get('/api/calls/patient/:patientId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { data, error } = await sb()
    .from('call_logs')
    .select('id, caller_number, source, direction, transcript, soap_segmented, duration_s, staff_notes, created_at')
    .eq('patient_id', req.params.patientId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) { res.status(502).json({ error: error.message }); return; }
  res.json({ calls: data ?? [] });
});

// ── PATCH /api/calls/:id/resolve ─────────────────────────────────────────────
// Front desk links an unresolved call_log to a patient.
// If new_patient is supplied, creates the patient record first.

router.patch('/api/calls/:id/resolve', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const parsed = ResolveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }

  const { existing_patient_id, new_patient, staff_notes } = parsed.data;

  if (!existing_patient_id && !new_patient) {
    res.status(400).json({ error: 'Provide either existing_patient_id or new_patient' });
    return;
  }

  let resolvedPatientId = existing_patient_id ?? null;

  // Create new patient if requested
  if (new_patient) {
    const { data: created, error: createErr } = await sb()
      .from('patients')
      .insert({
        full_name:     new_patient.full_name,
        phone:         new_patient.phone ?? null,
        date_of_birth: new_patient.date_of_birth ?? null,
        sex:           new_patient.sex ?? 'unknown',
      })
      .select('id')
      .single();

    if (createErr || !created) {
      logger.error({ createErr }, '[calls/resolve] patient insert failed');
      res.status(502).json({ error: createErr?.message ?? 'Failed to create patient' });
      return;
    }
    resolvedPatientId = created.id;
  }

  // Link call_log to patient
  const { error: updateErr } = await sb()
    .from('call_logs')
    .update({
      patient_id:  resolvedPatientId,
      staff_notes: staff_notes ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .is('patient_id', null); // only update if still unresolved

  if (updateErr) {
    logger.error({ updateErr }, '[calls/resolve] update failed');
    res.status(502).json({ error: updateErr.message });
    return;
  }

  logger.info({ call_log_id: req.params.id, patient_id: resolvedPatientId }, '[calls/resolve] ok');
  res.json({ patient_id: resolvedPatientId, resolved: true });
});

export default router;
