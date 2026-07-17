/**
 * /api/whatsapp/inbound — WhatsApp inbound message handler.
 *
 * Supports two providers (auto-detected from request shape):
 *   • Twilio  — body fields From/Body/MessageSid; responds with TwiML <Message>
 *   • Telnyx  — JSON body data.payload; responds 200 OK; sends reply via REST
 *
 * On each inbound message:
 *   1. Validates provider signature (when env vars set)
 *   2. Classifies booking intent vs general enquiry
 *   3. Creates appointment_request (booking) or sends portal link (enquiry)
 *   4. Looks up existing patient by phone number
 *   5. Inserts into call_logs (source: whatsapp) → visible in dashboard queue
 *   6. Generates Claude AI draft reply async → stored in call_logs.staff_notes
 *   7. Alerts staff via SMS
 *
 * Staff reply:
 *   PATCH /api/whatsapp/:id/reply  { reply_text: string }
 *   Sends WhatsApp reply to patient, marks call_log resolved.
 */

import { Router, type Request, type Response } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin, audit } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { sendSms, smsBodyStaffNewBooking, toE164 } from '../lib/sms.js';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

// ── Provider detection ────────────────────────────────────────────────────────

type Provider = 'twilio' | 'telnyx';

function detectProvider(req: Request): Provider | null {
  if (typeof (req.body as Record<string, unknown>)?.MessageSid === 'string') return 'twilio';
  if ((req.body as Record<string, unknown>)?.data) return 'telnyx';
  return null;
}

interface InboundWA {
  from:        string; // E.164
  body:        string;
  profileName: string;
  messageId:   string;
}

function extractMessage(req: Request, provider: Provider): InboundWA | null {
  const b = req.body as Record<string, unknown>;
  if (provider === 'twilio') {
    const from = ((b.From as string) ?? '').replace(/^whatsapp:/i, '').trim();
    const body = (b.Body as string) ?? '';
    if (!from || !body) return null;
    return { from, body, profileName: (b.ProfileName as string) ?? '', messageId: (b.MessageSid as string) ?? '' };
  }
  // Telnyx
  const payload = (b.data as Record<string, unknown>)?.payload as Record<string, unknown> | undefined;
  if (!payload) return null;
  const from = ((payload.from as Record<string, string>)?.phone_number ?? '').trim();
  const body = (payload.text as string) ?? '';
  if (!from || !body) return null;
  return { from, body, profileName: '', messageId: (payload.id as string) ?? '' };
}

// ── Signature verification ────────────────────────────────────────────────────

async function verifyTwilio(req: Request): Promise<boolean> {
  const sig   = req.headers['x-twilio-signature'] as string | undefined;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sig || !token) return true; // skip when not configured
  try {
    const { validateRequest } = await import('twilio');
    const proto   = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
    const host    = ((req.headers['x-forwarded-host'] ?? req.headers.host) as string | undefined) ?? '';
    return validateRequest(token, sig, `${proto}://${host}/api/whatsapp/inbound`, req.body as Record<string, string>);
  } catch { return false; }
}

function verifyHmac(req: Request): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
  const hubSig = req.headers['x-hub-signature-256'] as string | undefined;
  if (!hubSig) return false;
  try {
    const raw      = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expected = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(hubSig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

// ── Intent classification ─────────────────────────────────────────────────────

const APPOINTMENT_KEYWORDS: Array<[RegExp, string]> = [
  [/colonoscop/i,                              'colonoscopy'],
  [/gastroscop|OGD|oesophagogastro/i,          'ogd'],
  [/\bEGD\b/i,                                 'ogd'],
  [/\bERCP\b/i,                                'ercp_workup'],
  [/pre[\s-]?op|pre[\s-]?operat|\bsurger/i,   'pre_op'],
  [/flexi|sigmoid/i,                           'flexi_sig'],
  [/endoscop/i,                                'ogd'],
  [/diabetic\s+foot/i,                         'diabetic_foot'],
];

const BOOKING_INTENT  = /\b(book|appointment|schedule|reschedul|cancel|consult(?:ation)?|available|slot|see (?:the )?(?:doctor|dr)\b)/i;
const ENQUIRY_HINTS   = /\b(what|where|when|how|who|why|do you|does|can i|is it|info|information|services?|hours|open|location|address|cost|price|fee)\b|\?/i;

function detectAppointmentType(text: string): string {
  for (const [pat, type] of APPOINTMENT_KEYWORDS) if (pat.test(text)) return type;
  return 'consultation';
}

function isGeneralEnquiry(text: string): boolean {
  const t = text.trim();
  if (!t || BOOKING_INTENT.test(t)) return false;
  return ENQUIRY_HINTS.test(t);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPhone(e164: string): string {
  const d = e164.replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') return `${d.slice(1,4)}-${d.slice(4,7)}-${d.slice(7)}`;
  if (d.length === 7) return `${d.slice(0,3)}-${d.slice(3)}`;
  return e164;
}

function extractName(profileName: string, body: string): string {
  if (profileName) return profileName;
  const m = body.match(/(?:my name is|i(?:'?m| am)|this is)\s+([A-Za-z]+(?: [A-Za-z]+){0,2})/i);
  return m ? m[1].trim() : '';
}

const tapionLabel    = process.env.PRACTICE_LINE_TAPION_LABEL    ?? 'Tapion';
const rodneyBayLabel = process.env.PRACTICE_LINE_RODNEY_BAY_LABEL ?? 'Rodney Bay';
const tapionNum      = fmtPhone(process.env.PRACTICE_LINE_TAPION    ?? '+17582840557');
const rodneyBayNum   = fmtPhone(process.env.PRACTICE_LINE_RODNEY_BAY ?? '+17587207111');

// ── Patient lookup ────────────────────────────────────────────────────────────

async function findPatientByPhone(phone: string): Promise<string | null> {
  const norm = phone.replace(/\D/g, '').slice(-7);
  if (norm.length < 7) return null;
  const { data } = await getSupabaseAdmin()
    .from('patients')
    .select('id, phone')
    .not('phone', 'is', null)
    .ilike('phone', `%${norm.slice(-4)}%`)
    .limit(50);
  const match = (data ?? []).find((p: { id: string; phone: string | null }) =>
    p.phone && p.phone.replace(/\D/g, '').slice(-7) === norm,
  );
  return match?.id ?? null;
}

// ── Claude AI draft ───────────────────────────────────────────────────────────

async function generateDraft(
  patientName:     string,
  messageBody:     string,
  appointmentType: string,
  portalUrl:       string,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model:      process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 220,
      system: `You draft WhatsApp replies for Amise Medical Services, a specialist surgical practice in Saint Lucia led by Dr Dawit Daniel Kabiye MD DM.
Rules: British-Caribbean professional tone · warm, concise · under 110 words · NEVER mention fees, diagnoses, drug doses, or test results · sign off "— Amise Medical"`,
      messages: [{
        role:    'user',
        content: `Patient WhatsApp: "${messageBody}"
Name: ${patientName}
Intent: ${appointmentType}
Intake form URL: ${portalUrl}/patient/request

Draft a reply: acknowledge receipt, guide them to the intake form if it's a booking, or answer briefly if it's an enquiry. Do not include the URL as bare text — write it naturally into a sentence like "please complete our short intake form at [url]".`,
      }],
    });
    const text = resp.content[0];
    return text?.type === 'text' ? text.text.trim() : null;
  } catch (err) {
    logger.warn({ err }, '[whatsapp] Claude draft failed (non-fatal)');
    return null;
  }
}

// ── Telnyx outbound reply ─────────────────────────────────────────────────────

async function sendTelnyxWhatsApp(to: string, text: string): Promise<void> {
  const apiKey = process.env.TELNYX_API_KEY;
  const from   = process.env.TWILIO_FROM_NUMBER; // same env var, same number
  if (!apiKey || !from) return;
  const r = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `whatsapp:${from}`, to: `whatsapp:${to}`, text }),
  });
  if (!r.ok) logger.warn({ status: r.status }, '[whatsapp] Telnyx send failed');
}

// ── TwiML helpers (Twilio) ────────────────────────────────────────────────────

function twimlMsg(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Message>${escaped}</Message></Response>`;
}

const STATIC_ACK = 'Thank you for contacting Amise Medical Services. We have received your message and a member of our team will be in touch shortly. For urgent matters, please call the clinic directly. — Amise Medical';
const STATIC_ERR = 'Thank you for reaching Amise Medical Services. We were unable to register your request automatically — please call the clinic directly so we can assist you. — Amise Medical';

// ── POST /api/whatsapp/inbound ────────────────────────────────────────────────

router.post('/api/whatsapp/inbound', async (req: Request, res: Response) => {
  const provider = detectProvider(req);
  if (!provider) {
    logger.warn('[whatsapp/inbound] unrecognised webhook format');
    res.status(400).json({ error: 'Unrecognised provider format' });
    return;
  }

  // Signature verification
  if (provider === 'twilio' && !await verifyTwilio(req)) {
    res.status(403).send('Forbidden');
    return;
  }
  if (provider === 'telnyx' && !verifyHmac(req)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const msg = extractMessage(req, provider);
  if (!msg) {
    logger.warn({ provider }, '[whatsapp/inbound] could not extract message');
    if (provider === 'twilio') res.set('Content-Type', 'text/xml').send(twimlMsg(STATIC_ERR));
    else res.sendStatus(200);
    return;
  }

  const { from, body, profileName, messageId } = msg;
  const fromE164 = toE164(from);
  const portalUrl = process.env.PORTAL_URL ?? process.env.FRONTEND_URL ?? 'https://amise-medflow-front-desk.vercel.app';
  const supa = getSupabaseAdmin();

  // General enquiry → portal link, no booking record
  if (isGeneralEnquiry(body)) {
    const reply = `Thanks for reaching out to Amise Medical Services — a specialist general and endoscopic surgery practice led by Dr Dawit Daniel Kabiye MD DM in Saint Lucia.\n\nTo request an appointment or get started, please complete our short intake form: ${portalUrl}/patient/request\n\nYou're also welcome to call: ${tapionLabel} ${tapionNum} · ${rodneyBayLabel} ${rodneyBayNum} — Amise Medical`;
    await audit({ action: 'send', entityType: 'whatsapp_message', entityId: fromE164, payload: { reason: 'general_enquiry', body: body.slice(0, 500) } });
    logger.info({ from: fromE164 }, '[whatsapp/inbound] general enquiry');
    if (provider === 'twilio')  { res.set('Content-Type', 'text/xml').send(twimlMsg(reply)); return; }
    if (provider === 'telnyx')  { void sendTelnyxWhatsApp(fromE164, reply); res.sendStatus(200); return; }
    return;
  }

  const appointmentType = detectAppointmentType(body);
  const patientName     = extractName(profileName, body) || `WA ${fromE164}`;

  // Patient lookup
  const patientId = await findPatientByPhone(fromE164);

  // 1. Create appointment_request
  let bookingId: string | null = null;
  try {
    const { data, error } = await supa
      .from('appointment_requests')
      .insert({
        patient_name:     patientName,
        patient_email:    `wa.${fromE164.replace(/\D/g, '') || 'unknown'}@noreply.amise.internal`,
        patient_phone:    fromE164,
        appointment_type: appointmentType,
        chief_complaint:  appointmentType,
        location:         'rodney_bay',
        preferred_site:   'rodney_bay',
        preferred_slot:   null,
        preferred_date:   null,
        reason:           body.slice(0, 500) || null,
        status:           'pending',
        source:           'whatsapp',
        whatsapp_from:    fromE164,
      })
      .select('id')
      .single();
    if (error) throw error;
    bookingId = data.id as string;
  } catch (err) {
    logger.error({ err }, '[whatsapp/inbound] booking insert failed');
  }

  // 2. Insert into call_logs queue so dashboard shows the message
  let callLogId: string | null = null;
  try {
    const { data, error } = await supa
      .from('call_logs')
      .insert({
        caller_number: fromE164,
        patient_id:    patientId,
        direction:     'inbound',
        source:        'whatsapp',
        status:        'pending',
        transcript:    body,
        staff_notes:   bookingId ? `Booking request #${bookingId.slice(0, 8)}` : null,
        created_at:    new Date().toISOString(),
      })
      .select('id')
      .single();
    if (!error) callLogId = data?.id as string ?? null;
  } catch (err) {
    logger.warn({ err }, '[whatsapp/inbound] call_log insert failed (non-fatal)');
  }

  // 3. Staff SMS alert
  const staffPhone = process.env.STAFF_NOTIFY_PHONE ?? null;
  if (staffPhone && bookingId) {
    void sendSms({ to: staffPhone, body: smsBodyStaffNewBooking({ patientName, appointmentType, preferredSlot: null, patientPhone: fromE164, bookingId }) });
  }

  if (bookingId) {
    await audit({ action: 'book', entityType: 'appointment_request', entityId: bookingId, payload: { source: 'whatsapp', whatsapp_from: fromE164, appointment_type: appointmentType } });
    logger.info({ bookingId, from: fromE164, appointmentType, patientId }, '[whatsapp/inbound] booking created');
  }

  // Acknowledge immediately — Claude draft runs async after response is sent
  if (provider === 'twilio') res.set('Content-Type', 'text/xml').send(twimlMsg(bookingId ? STATIC_ACK : STATIC_ERR));
  else res.sendStatus(200);

  // 4. Generate Claude draft reply + update call_log (after response)
  if (callLogId) {
    void (async () => {
      const draft = await generateDraft(patientName, body, appointmentType, portalUrl);
      if (!draft) return;
      await supa
        .from('call_logs')
        .update({ staff_notes: `AI Draft Reply:\n\n${draft}` })
        .eq('id', callLogId);
      logger.info({ callLogId, chars: draft.length }, '[whatsapp/inbound] Claude draft saved');
    })();
  }
});

// ── PATCH /api/whatsapp/:id/reply ─────────────────────────────────────────────
// Staff approves/edits the AI draft and sends it to the patient.
// Auth: CRON_SECRET header (same pattern as cron endpoints) — replace with
//       session auth once the dashboard integrates the reply button.

router.patch('/api/whatsapp/:id/reply', async (req: Request, res: Response) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided = req.headers['x-cron-secret'] as string | undefined;
    if (!provided || provided !== cronSecret) {
      res.status(401).json({ error: 'Unauthorised' });
      return;
    }
  }

  const { id } = req.params;
  const { reply_text } = req.body as { reply_text?: string };
  if (!reply_text?.trim()) {
    res.status(400).json({ error: 'reply_text required' });
    return;
  }

  const supa = getSupabaseAdmin();
  const { data: log, error } = await supa
    .from('call_logs')
    .select('caller_number, source')
    .eq('id', id)
    .single();

  if (error || !log) {
    res.status(404).json({ error: 'Call log not found' });
    return;
  }

  const to = (log as { caller_number: string }).caller_number;

  // Send via Telnyx (WhatsApp) if configured, else fall back to Twilio SMS
  if (process.env.TELNYX_API_KEY) {
    await sendTelnyxWhatsApp(to, reply_text.trim());
  } else {
    try {
      await sendSms({ to, body: reply_text.trim(), forceChannel: 'whatsapp' });
    } catch (err) {
      logger.warn({ err }, '[whatsapp/reply] send failed');
      res.status(502).json({ error: 'Failed to send reply' });
      return;
    }
  }

  await supa
    .from('call_logs')
    .update({
      status:      'called_back',
      resolved_at: new Date().toISOString(),
      staff_notes: `[Replied]\n${reply_text.trim()}`,
    })
    .eq('id', id);

  logger.info({ id, to }, '[whatsapp/reply] reply sent and log resolved');
  res.json({ ok: true });
});

export default router;
