/**
 * /api/calls — voice signal ingestion, voicemail, callback queue, and audit.
 *
 * Every incoming voice signal lands here and is matched to a patient by
 * phone, email, or name. Unanswered calls are routed through Twilio TwiML
 * to leave a voicemail which auto-transcribes and appears in the Call Queue.
 *
 * Identity anchors: phone + email + name → MRN (AM-YYYYnnnn) auto-assigned.
 *
 * Twilio hooks (no auth — verified by signature or shared secret):
 *   POST /api/calls/twiml          — Voice URL for each practice number
 *   POST /api/calls/voicemail      — Recording complete callback
 *   POST /api/calls/status         — Call status events (answered/missed/etc.)
 *
 * Staff endpoints (requireStaffAuth):
 *   POST   /api/calls/ingest       — manual / ambient ingestion
 *   GET    /api/calls/unresolved   — front-desk queue
 *   GET    /api/calls/patient/:id  — patient call history
 *   GET    /api/calls/practice-lines
 *   GET    /api/calls/audit        — answered/voicemail/missed counts
 *   PATCH  /api/calls/:id/resolve  — link to patient
 *   PATCH  /api/calls/:id/status   — update callback status
 *   GET    /api/patients/search    — quick lookup for resolve panel
 */

import { Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
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
    { label: 'Tapion',          e164: process.env.PRACTICE_LINE_TAPION      ?? '+17582840557', whatsapp: true  },
    { label: 'Rodney Bay',      e164: process.env.PRACTICE_LINE_RODNEY_BAY  ?? '+17587207111', whatsapp: true  },
    { label: 'Tapion Landline', e164: process.env.PRACTICE_LINE_LANDLINE     ?? '+17584592227', whatsapp: false },
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

// ── PATCH /api/calls/:id/status ───────────────────────────────────────────────
// Staff updates callback status on any call_log.

const CallStatusSchema = z.object({
  status:      z.enum(['callback_scheduled', 'called_back', 'dismissed', 'pending']),
  callback_at: z.string().optional(), // ISO datetime for scheduled callbacks
  staff_notes: z.string().optional(),
});

router.patch('/api/calls/:id/status', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const parsed = CallStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }

  const update: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.callback_at) update.callback_at = parsed.data.callback_at;
  if (parsed.data.staff_notes !== undefined) update.staff_notes = parsed.data.staff_notes;
  if (parsed.data.status === 'called_back') update.called_back_at = new Date().toISOString();

  const { error } = await sb()
    .from('call_logs')
    .update(update)
    .eq('id', req.params.id);

  if (error) { res.status(502).json({ error: error.message }); return; }
  res.json({ ok: true, status: parsed.data.status });
});

// ── GET /api/calls/audit ──────────────────────────────────────────────────────
// Returns call volume and outcome counts for the given date range.
// ?from=ISO&to=ISO&practice_line=label

router.get('/api/calls/audit', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const from  = (req.query.from  as string | undefined) ?? new Date(Date.now() - 86_400_000 * 30).toISOString();
  const to    = (req.query.to    as string | undefined) ?? new Date().toISOString();
  const line  = req.query.practice_line as string | undefined;

  let query = sb()
    .from('call_logs')
    .select('status, practice_line, direction, source, created_at')
    .gte('created_at', from)
    .lte('created_at', to);

  if (line) query = query.eq('practice_line', line);

  const { data, error } = await query;
  if (error) { res.status(502).json({ error: error.message }); return; }

  const rows = (data ?? []) as Array<{ status: string; practice_line: string | null; direction: string; source: string }>;

  const counts = (s: typeof rows) => ({
    total:               s.length,
    answered:            s.filter(r => r.status === 'answered').length,
    voicemail:           s.filter(r => r.status === 'voicemail').length,
    missed:              s.filter(r => r.status === 'missed').length,
    callback_scheduled:  s.filter(r => r.status === 'callback_scheduled').length,
    called_back:         s.filter(r => r.status === 'called_back').length,
    dismissed:           s.filter(r => r.status === 'dismissed').length,
    pending:             s.filter(r => r.status === 'pending').length,
  });

  const byLine = PRACTICE_LINES.map(l => ({
    label: l.label,
    ...counts(rows.filter(r => r.practice_line === l.label)),
  }));

  res.json({
    from, to,
    ...counts(rows),
    by_line: byLine,
  });
});

// ── Twilio webhook helpers ────────────────────────────────────────────────────

function twilioLineFromTo(to: string): string {
  const matched = PRACTICE_LINES.find(l => normPhone(l.e164) === normPhone(to ?? ''));
  return matched?.label ?? 'Unknown';
}

// Validate Twilio signature — returns true if TWILIO_AUTH_TOKEN is unset (dev mode)
function validateTwilioSignature(req: import('express').Request): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return true; // dev: skip validation

  const sig = req.headers['x-twilio-signature'] as string | undefined;
  if (!sig) return false;

  const proto = req.headers['x-forwarded-proto'] ?? 'https';
  const host  = req.headers['host'] ?? '';
  const url   = `${proto}://${host}${req.originalUrl}`;

  const params = req.body as Record<string, string>;
  const keys   = Object.keys(params).sort();
  const toSign = url + keys.map(k => k + params[k]).join('');

  const expected = createHmac('sha256', token).update(toSign).digest('base64');
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── Forwarding numbers ────────────────────────────────────────────────────────
// FORWARD_TO_NUMBERS: comma-separated E.164 list of staff cell phones.
// Twilio rings all of them simultaneously (Find Me / Follow Me).
// If none answer within FORWARD_RING_TIMEOUT seconds → voicemail.
//
// Example:  FORWARD_TO_NUMBERS=+17582840557,+17587207111
//           FORWARD_RING_TIMEOUT=20

function getForwardNumbers(): string[] {
  return (process.env.FORWARD_TO_NUMBERS ?? '')
    .split(',')
    .map(n => n.trim())
    .filter(Boolean);
}

const RING_TIMEOUT = parseInt(process.env.FORWARD_RING_TIMEOUT ?? '20', 10);

// ── POST /api/calls/twiml ─────────────────────────────────────────────────────
// Voice URL for each Twilio number (set this in the Twilio console / on port / on forward target).
//
// Flow:
//   1. If FORWARD_TO_NUMBERS set → ring cell phones simultaneously for RING_TIMEOUT s
//      a. One answers  → live call, status logged as 'answered' via /api/calls/dial-status
//      b. None answer  → falls through to step 2
//   2. Greet caller → record voicemail → webhook to /api/calls/voicemail

router.post('/api/calls/twiml', (req, res) => {
  if (process.env.TWILIO_AUTH_TOKEN && !validateTwilioSignature(req)) {
    logger.warn('[calls/twiml] invalid Twilio signature');
    res.status(403).send('Forbidden');
    return;
  }

  const body     = req.body as Record<string, string>;
  const to       = body.To  ?? '';
  const callSid  = body.CallSid ?? '';
  const line     = twilioLineFromTo(to);
  const apiBase  = process.env.API_BASE_URL ?? `https://${req.headers.host ?? 'localhost'}`;
  const forwards = getForwardNumbers();

  const voicemailTwiml = `
  <Say voice="Polly.Joanna" language="en-US">We are sorry we missed your call. Please leave your name, phone number, and the reason for calling after the tone and we will call you back as soon as possible.</Say>
  <Record
    maxLength="120"
    transcribe="false"
    recordingStatusCallback="${apiBase}/api/calls/voicemail"
    recordingStatusCallbackMethod="POST"
    action="${apiBase}/api/calls/voicemail-ack"
    method="POST"
  />`.trim();

  if (forwards.length === 0) {
    // No forwarding configured — go straight to voicemail
    const greeting = `Thank you for calling Amise Medical Services${line && line !== 'Unknown' ? ', ' + line : ''}.`;
    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">${greeting}</Say>
  ${voicemailTwiml}
</Response>`);
    return;
  }

  // Build <Number> tags for each forwarding target
  const numberTags = forwards
    .map(n => `<Number statusCallback="${apiBase}/api/calls/dial-status?sid=${encodeURIComponent(callSid)}">${n}</Number>`)
    .join('\n    ');

  // Dial action: if nobody picks up → action URL returns voicemail TwiML
  res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${RING_TIMEOUT}" action="${apiBase}/api/calls/no-answer?sid=${encodeURIComponent(callSid)}&amp;line=${encodeURIComponent(line)}" method="POST">
    ${numberTags}
  </Dial>
</Response>`);
});

// ── POST /api/calls/no-answer ─────────────────────────────────────────────────
// Twilio Dial action URL — fires when nobody answered the forwarded call.
// Returns voicemail TwiML and logs the missed attempt.

router.post('/api/calls/no-answer', async (req, res) => {
  const body       = req.body as Record<string, string>;
  const callSid    = (req.query.sid as string) ?? body.CallSid ?? '';
  const line       = (req.query.line as string) ?? '';
  const dialStatus = (body.DialCallStatus ?? '').toLowerCase();
  const from       = body.From ?? '';
  const apiBase    = process.env.API_BASE_URL ?? `https://${req.headers.host ?? 'localhost'}`;

  // Log missed call if nobody answered (no-answer / busy / failed / canceled)
  if (dialStatus !== 'completed' && callSid) {
    void (async () => {
      let patientId: string | null = null;
      if (from) {
        const p = await lookupPatientByPhone(from);
        if (p) patientId = p.id;
      }
      await sb().from('call_logs').upsert({
        twilio_call_sid: callSid,
        caller_number:   from || null,
        patient_id:      patientId,
        source:          'phone',
        direction:       'inbound',
        status:          'missed',
        practice_line:   line || null,
      }, { onConflict: 'twilio_call_sid', ignoreDuplicates: false });
    })();
  }

  res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">We are sorry we missed your call. Please leave your name, phone number, and the reason for calling after the tone and we will call you back as soon as possible.</Say>
  <Record
    maxLength="120"
    transcribe="false"
    recordingStatusCallback="${apiBase}/api/calls/voicemail"
    recordingStatusCallbackMethod="POST"
    action="${apiBase}/api/calls/voicemail-ack"
    method="POST"
  />
</Response>`);
});

// ── POST /api/calls/dial-status ───────────────────────────────────────────────
// Fires when a forwarded leg connects or ends. Used to mark a call 'answered'.

router.post('/api/calls/dial-status', async (req, res) => {
  res.sendStatus(204);
  const body       = req.body as Record<string, string>;
  const callSid    = (req.query.sid as string) ?? body.CallSid ?? '';
  const callStatus = (body.CallStatus ?? body.DialCallStatus ?? '').toLowerCase();
  const from       = body.From ?? '';

  if (callStatus === 'in-progress' || callStatus === 'completed') {
    void (async () => {
      let patientId: string | null = null;
      if (from) {
        const p = await lookupPatientByPhone(from);
        if (p) patientId = p.id;
      }
      await sb().from('call_logs').upsert({
        twilio_call_sid: callSid,
        caller_number:   from || null,
        patient_id:      patientId,
        source:          'phone',
        direction:       'inbound',
        status:          'answered',
      }, { onConflict: 'twilio_call_sid', ignoreDuplicates: false });
    })();
  }
});

// ── POST /api/calls/voicemail-ack ─────────────────────────────────────────────
// TwiML action response after recording completes.

router.post('/api/calls/voicemail-ack', (_req, res) => {
  res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">Thank you. Goodbye.</Say>
  <Hangup />
</Response>`);
});

// ── POST /api/calls/voicemail ─────────────────────────────────────────────────
// Twilio Recording Status Callback — fires when a recording is ready.
// Creates or updates a call_log with status=voicemail.

router.post('/api/calls/voicemail', async (req, res) => {
  // Always acknowledge immediately so Twilio doesn't retry
  res.sendStatus(204);

  const body = req.body as Record<string, string>;
  const {
    CallSid, RecordingUrl, RecordingDuration, RecordingStatus,
    From, To,
  } = body;

  if (RecordingStatus !== 'completed' || !RecordingUrl) return;

  const callerNumber  = From ?? null;
  const practiceLine  = twilioLineFromTo(To ?? '');
  const durationS     = RecordingDuration ? parseInt(RecordingDuration, 10) : null;
  const audioPath     = RecordingUrl + '.mp3'; // Twilio serves MP3 with this extension

  // Resolve patient by caller number
  let patientId: string | null = null;
  if (callerNumber) {
    const p = await lookupPatientByPhone(callerNumber);
    if (p) patientId = p.id;
  }

  try {
    // Upsert by twilio_call_sid to avoid duplicates on retries
    const { error } = await sb()
      .from('call_logs')
      .upsert({
        twilio_call_sid: CallSid,
        caller_number:   callerNumber,
        patient_id:      patientId,
        source:          'phone',
        direction:       'inbound',
        status:          'voicemail',
        audio_path:      audioPath,
        duration_s:      durationS,
        practice_line:   practiceLine,
      }, { onConflict: 'twilio_call_sid', ignoreDuplicates: false });

    if (error) logger.error({ error, CallSid }, '[calls/voicemail] upsert failed');
    else logger.info({ CallSid, from: callerNumber, practiceLine, durationS }, '[calls/voicemail] recorded');
  } catch (err) {
    logger.error({ err }, '[calls/voicemail] unexpected error');
  }
});

// ── POST /api/calls/status ────────────────────────────────────────────────────
// Twilio Call Status Callback — fires for every call status change.
// We use it to log answered calls and classify missed/no-answer calls.

router.post('/api/calls/status', async (req, res) => {
  res.sendStatus(204);

  const body = req.body as Record<string, string>;
  const {
    CallSid, CallStatus, From, To, CallDuration,
  } = body;

  if (!CallSid || !CallStatus) return;

  const callStatus  = CallStatus.toLowerCase();
  const callerNumber = From ?? null;
  const practiceLine = twilioLineFromTo(To ?? '');
  const durationS    = CallDuration ? parseInt(CallDuration, 10) : null;

  // Map Twilio status → our status
  const statusMap: Record<string, string> = {
    'completed':  'answered',
    'no-answer':  'missed',
    'busy':       'missed',
    'failed':     'missed',
    'canceled':   'missed',
  };
  const mappedStatus = statusMap[callStatus];
  if (!mappedStatus) return; // ignore ringing / in-progress events

  let patientId: string | null = null;
  if (callerNumber) {
    const p = await lookupPatientByPhone(callerNumber);
    if (p) patientId = p.id;
  }

  try {
    await sb()
      .from('call_logs')
      .upsert({
        twilio_call_sid: CallSid,
        caller_number:   callerNumber,
        patient_id:      patientId,
        source:          'phone',
        direction:       'inbound',
        status:          mappedStatus,
        duration_s:      durationS,
        practice_line:   practiceLine,
      }, { onConflict: 'twilio_call_sid', ignoreDuplicates: false });

    logger.info({ CallSid, callStatus, mappedStatus, practiceLine }, '[calls/status] logged');
  } catch (err) {
    logger.error({ err }, '[calls/status] unexpected error');
  }
});

export default router;
