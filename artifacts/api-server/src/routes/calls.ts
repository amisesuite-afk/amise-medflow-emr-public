/**
 * /api/calls — voice signal ingestion and patient ID resolution.
 *
 * Every incoming voice signal (phone call via Asterisk/WATI, patient PWA
 * voice note, or ambient in-session recording) lands here and is matched
 * to an existing patient by phone number, email, or name.
 *
 * Match found  → call_log written with patient_id; returns patient context
 * No match     → call_log written with patient_id=NULL; routed to front-desk
 *
 * Patient identity anchor: phone + email + name generate a unique health
 * record. On first contact a MRN (AM-YYYYnnnn) is auto-assigned by the DB
 * trigger, serving as the future health card identifier.
 *
 * Front desk resolves unmatched logs via PATCH /api/calls/:id/resolve,
 * either linking an existing patient or creating a new one on the spot.
 */

import { Router } from 'express';
import { z } from 'zod';
import { sb, requireStaffAuth } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── Practice line config ──────────────────────────────────────────────────────
// Loaded once from env — maps normalised last-7-digit to a human label.
// Set PRACTICE_LINE_* env vars to configure; WhatsApp-capable lines are
// listed in WHATSAPP_NUMBERS (comma-separated E.164 list).

interface PracticeLine {
  label:     string;
  e164:      string;
  whatsapp:  boolean;
}

function buildPracticeLines(): PracticeLine[] {
  const lines: PracticeLine[] = [
    { label: 'Tapion',      e164: process.env.PRACTICE_LINE_TAPION      ?? '+17582840557', whatsapp: true  },
    { label: 'Rodney Bay',  e164: process.env.PRACTICE_LINE_RODNEY_BAY  ?? '+17587207111', whatsapp: true  },
    { label: 'Landline',    e164: process.env.PRACTICE_LINE_LANDLINE     ?? '+17584592227', whatsapp: false },
  ];

  // Allow WHATSAPP_NUMBERS to override which lines have WhatsApp
  const waNums = (process.env.WHATSAPP_NUMBERS ?? '')
    .split(',')
    .map(n => n.trim())
    .filter(Boolean)
    .map(n => normPhone(n));

  if (waNums.length > 0) {
    for (const l of lines) l.whatsapp = waNums.includes(normPhone(l.e164));
  }

  return lines;
}

// Detect which practice line a raw number maps to
function detectPracticeLine(raw: string): PracticeLine | null {
  const norm = normPhone(raw);
  return PRACTICE_LINES.find(l => normPhone(l.e164) === norm) ?? null;
}

const PRACTICE_LINES = buildPracticeLines();

// ── Phone / email normalisation ───────────────────────────────────────────────
// Strip everything except digits, then compare the last 7 digits.
// Handles +1-758-284-0557, 7582840557, 284-0557, etc.

function normPhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(-7);
}

// ── Patient lookup ────────────────────────────────────────────────────────────

type PatientSummary = { id: string; full_name: string; mrn: string | null };

async function lookupPatientByPhone(callerNumber: string): Promise<PatientSummary | null> {
  const norm = normPhone(callerNumber);
  if (norm.length < 7) return null;

  const { data, error } = await sb()
    .from('patients')
    .select('id, full_name, mrn, phone')
    .not('phone', 'is', null)
    .ilike('phone', `%${norm.slice(-4)}%`)
    .limit(200);

  if (error || !data) return null;

  const match = (data as Array<PatientSummary & { phone: string | null }>)
    .find(p => p.phone && normPhone(p.phone) === norm);
  return match ? { id: match.id, full_name: match.full_name, mrn: match.mrn } : null;
}

async function lookupPatientByEmail(email: string): Promise<PatientSummary | null> {
  const norm = email.trim().toLowerCase();
  if (!norm.includes('@')) return null;

  const { data, error } = await sb()
    .from('patients')
    .select('id, full_name, mrn')
    .ilike('email', norm)
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as PatientSummary;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const IngestSchema = z.object({
  caller_number:  z.string().min(1).optional(),
  caller_email:   z.string().email().optional(),
  transcript:     z.string().optional(),
  audio_path:     z.string().optional(),
  duration_s:     z.number().int().nonnegative().optional(),
  source:         z.enum(['phone', 'whatsapp', 'patient_app', 'ambient']).default('phone'),
  direction:      z.enum(['inbound', 'outbound', 'ambient', 'app_message']).default('inbound'),
  soap_segmented: z.record(z.unknown()).optional(),
  patient_id:     z.string().uuid().optional(),
  practice_line:  z.string().optional(), // label of the line called, e.g. 'Tapion'
});

const ResolveSchema = z.object({
  existing_patient_id: z.string().uuid().optional(),
  new_patient: z.object({
    full_name:     z.string().min(1),
    phone:         z.string().optional(),
    email:         z.string().email().optional(),
    date_of_birth: z.string().optional(),
    sex:           z.enum(['male', 'female', 'other', 'unknown']).optional(),
  }).optional(),
  staff_notes: z.string().optional(),
});

// ── POST /api/calls/ingest ────────────────────────────────────────────────────

router.post('/api/calls/ingest', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const parsed = IngestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }

  const d = parsed.data;

  // 1. Resolve patient_id — phone first, then email
  let patientId: string | null = d.patient_id ?? null;
  let patientContext: PatientSummary | null = null;
  let isNew = false;

  if (!patientId) {
    // Try phone lookup
    if (d.caller_number) {
      patientContext = await lookupPatientByPhone(d.caller_number);
      if (patientContext) patientId = patientContext.id;
    }
    // Fallback to email lookup
    if (!patientId && d.caller_email) {
      patientContext = await lookupPatientByEmail(d.caller_email);
      if (patientContext) patientId = patientContext.id;
    }
    if (!patientId) isNew = true;
  } else {
    const { data } = await sb()
      .from('patients')
      .select('id, full_name, mrn')
      .eq('id', patientId)
      .single();
    patientContext = data as PatientSummary ?? null;
  }

  // 2. Detect practice line from caller_number if not supplied
  const practiceLine = d.practice_line
    ?? (d.caller_number ? detectPracticeLine(d.caller_number)?.label ?? null : null);

  // 3. Write call_log
  const { data: log, error: logErr } = await sb()
    .from('call_logs')
    .insert({
      caller_number:  d.caller_number ?? null,
      caller_email:   d.caller_email  ?? null,
      patient_id:     patientId,
      source:         d.source,
      direction:      d.direction,
      transcript:     d.transcript ?? null,
      soap_segmented: d.soap_segmented ?? null,
      audio_path:     d.audio_path ?? null,
      duration_s:     d.duration_s ?? null,
      practice_line:  practiceLine,
    })
    .select('id')
    .single();

  if (logErr) {
    logger.error({ logErr }, '[calls/ingest] insert failed');
    res.status(502).json({ error: logErr.message });
    return;
  }

  // 4. If unresolved and has caller number/email, also create a booking inquiry
  if (isNew && (d.caller_number || d.caller_email)) {
    const snippetText: string = typeof d.transcript === 'string'
      ? `Voice message: ${(d.transcript as string).slice(0, 200)}`
      : 'Incoming phone call — no transcript';
    await sb().from('appointment_requests').insert({
      patient_name:     d.caller_number ?? d.caller_email ?? 'Unknown',
      patient_phone:    d.caller_number ?? null,
      source:           'phone',
      status:           'pending',
      reason:           snippetText,
      appointment_type: 'new_patient',
    });
  }

  logger.info({ call_log_id: log!.id, patient_id: patientId, is_new: isNew, practice_line: practiceLine }, '[calls/ingest] ok');

  res.json({
    call_log_id:   log!.id,
    patient_id:    patientId,
    patient:       patientContext,
    is_new:        isNew,
    practice_line: practiceLine,
  });
});

// ── GET /api/calls/unresolved ─────────────────────────────────────────────────

router.get('/api/calls/unresolved', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const limit         = Math.min(Number(req.query.limit ?? 50), 200);
  const practiceFilter = req.query.practice_line as string | undefined;

  let query = sb()
    .from('call_logs')
    .select('id, caller_number, caller_email, source, direction, transcript, duration_s, practice_line, created_at')
    .is('patient_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (practiceFilter) query = query.eq('practice_line', practiceFilter);

  const { data, error } = await query;

  if (error) { res.status(502).json({ error: error.message }); return; }

  res.json({
    calls:          data ?? [],
    practice_lines: PRACTICE_LINES.map(l => ({ label: l.label, whatsapp: l.whatsapp })),
  });
});

// ── GET /api/calls/patient/:patientId ─────────────────────────────────────────

router.get('/api/calls/patient/:patientId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { data, error } = await sb()
    .from('call_logs')
    .select('id, caller_number, caller_email, source, direction, transcript, soap_segmented, duration_s, staff_notes, practice_line, created_at')
    .eq('patient_id', req.params.patientId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) { res.status(502).json({ error: error.message }); return; }
  res.json({ calls: data ?? [] });
});

// ── GET /api/calls/practice-lines ────────────────────────────────────────────
// Returns configured practice lines (for front-desk filter UI).

router.get('/api/calls/practice-lines', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  res.json({ practice_lines: PRACTICE_LINES.map(l => ({ label: l.label, e164: l.e164, whatsapp: l.whatsapp })) });
});

// ── GET /api/patients/search ──────────────────────────────────────────────────
// Quick patient lookup by name, MRN, phone, or email.
// Used by the front-desk Call Queue resolve panel.

router.get('/api/patients/search', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const q     = (req.query.q as string ?? '').trim();
  const limit = Math.min(Number(req.query.limit ?? 10), 50);

  if (q.length < 2) { res.json({ patients: [] }); return; }

  // MRN exact match
  if (/^AM-\d/i.test(q)) {
    const { data } = await sb()
      .from('patients')
      .select('id, full_name, mrn, phone, email')
      .ilike('mrn', q)
      .limit(limit);
    res.json({ patients: data ?? [] });
    return;
  }

  // Phone normalised match
  const norm = normPhone(q);
  if (norm.length >= 4) {
    const { data } = await sb()
      .from('patients')
      .select('id, full_name, mrn, phone, email')
      .not('phone', 'is', null)
      .ilike('phone', `%${norm.slice(-4)}%`)
      .limit(200);

    const matches = (data ?? []) as Array<PatientSummary & { phone: string | null; email: string | null }>;
    const phoneMatches = matches.filter(p => p.phone && normPhone(p.phone).includes(norm));
    if (phoneMatches.length > 0) { res.json({ patients: phoneMatches.slice(0, limit) }); return; }
  }

  // Name / email ILIKE
  const { data } = await sb()
    .from('patients')
    .select('id, full_name, mrn, phone, email')
    .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
    .order('full_name')
    .limit(limit);

  res.json({ patients: data ?? [] });
});

// ── PATCH /api/calls/:id/resolve ─────────────────────────────────────────────

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

  if (new_patient) {
    // MRN is auto-assigned by DB trigger (AM-YYYYnnnn)
    const { data: created, error: createErr } = await sb()
      .from('patients')
      .insert({
        full_name:     new_patient.full_name,
        phone:         new_patient.phone         ?? null,
        email:         new_patient.email         ?? null,
        date_of_birth: new_patient.date_of_birth ?? null,
        sex:           new_patient.sex           ?? 'unknown',
      })
      .select('id, mrn')
      .single();

    if (createErr || !created) {
      logger.error({ createErr }, '[calls/resolve] patient insert failed');
      res.status(502).json({ error: createErr?.message ?? 'Failed to create patient' });
      return;
    }
    resolvedPatientId = (created as { id: string; mrn: string }).id;
    logger.info({ patient_id: resolvedPatientId, mrn: (created as { id: string; mrn: string }).mrn }, '[calls/resolve] new patient created');
  }

  const { error: updateErr } = await sb()
    .from('call_logs')
    .update({
      patient_id:  resolvedPatientId,
      staff_notes: staff_notes ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .is('patient_id', null);

  if (updateErr) {
    logger.error({ updateErr }, '[calls/resolve] update failed');
    res.status(502).json({ error: updateErr.message });
    return;
  }

  logger.info({ call_log_id: req.params.id, patient_id: resolvedPatientId }, '[calls/resolve] ok');
  res.json({ patient_id: resolvedPatientId, resolved: true });
});

export default router;
