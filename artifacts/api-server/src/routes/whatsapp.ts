import { Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin, audit } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { sendSms, smsBodyStaffNewBooking } from '../lib/sms.js';

const router = Router();

const APPOINTMENT_KEYWORDS: Array<[RegExp, string]> = [
  [/colonoscop/i,                                   'colonoscopy'],
  [/gastroscop|OGD|oesophagogastro/i,               'ogd'],
  [/EGD/i,                                           'ogd'],
  [/ERCP/i,                                          'ercp_workup'],
  [/pre[\s-]?op|pre[\s-]?operat|surgery/i,          'pre_op'],
  [/flexi|sigmoid/i,                                 'flexi_sig'],
  [/endoscop/i,                                      'ogd'],
];

function detectAppointmentType(text: string): string {
  for (const [pattern, type] of APPOINTMENT_KEYWORDS) {
    if (pattern.test(text)) return type;
  }
  return 'consultation';
}

const BOOKING_INTENT = /\b(book|appointment|schedule|reschedul|cancel|consult(?:ation)?|available|slot|see (?:the )?(?:doctor|dr)\b)/i;
const ENQUIRY_HINTS  = /\b(what|where|when|how|who|why|do you|does|can i|is it|info|information|services?|hours|open|location|address|cost|price|fee)\b|\?/i;

// WhatsApp has no Claude classification step (cost/latency) — a light keyword
// check is enough to separate "tell me about the practice" from "book me in".
function isGeneralEnquiry(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || BOOKING_INTENT.test(trimmed)) return false;
  return ENQUIRY_HINTS.test(trimmed);
}

// Format a phone number for display: +17582840557 → 758-284-0557
function fmtPhone(e164: string): string {
  const d = e164.replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') return `${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return e164;
}

const tapionLabel    = process.env.PRACTICE_LINE_TAPION_LABEL    ?? 'Tapion';
const rodneyBayLabel = process.env.PRACTICE_LINE_RODNEY_BAY_LABEL ?? 'Rodney Bay';
const tapionNum      = fmtPhone(process.env.PRACTICE_LINE_TAPION     ?? '+17582840557');
const rodneyBayNum   = fmtPhone(process.env.PRACTICE_LINE_RODNEY_BAY ?? '+17587207111');

function enquiryReplyTwiml(triageFormUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thanks for reaching out to Amise Medical Services — a general &amp; endoscopic surgery practice led by Dr Dawit Daniel Kabiye, MD, DM, in Saint Lucia (consultations, procedures such as colonoscopy/ERCP, and follow-up care).

To help us prepare for your visit, please complete our short triage form: ${triageFormUrl}

You're also welcome to reply here or email amisesuite@gmail.com with your details and we'll guide you through it — or call our front desk: ${tapionLabel} ${tapionNum}, ${rodneyBayLabel} ${rodneyBayNum}. – Amise Medical</Message>
</Response>`;
}

function extractName(profileName: string, body: string): string {
  if (profileName) return profileName;
  const m = body.match(/(?:my name is|i(?:'?m| am)|this is)\s+([A-Za-z]+(?: [A-Za-z]+){0,2})/i);
  return m ? m[1].trim() : '';
}

const TWIML_SUCCESS = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thank you for contacting Amise Medical Services. We have received your message and a member of our team will be in touch shortly to confirm your appointment. For urgent matters, please call the clinic directly. – Amise Medical</Message>
</Response>`;

const TWIML_ERROR = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thank you for reaching Amise Medical Services. We have noted your message; however, we were unable to register your request automatically. Please call the clinic directly so we can assist you. – Amise Medical</Message>
</Response>`;

// POST /api/whatsapp/inbound — Twilio WhatsApp webhook
router.post('/api/whatsapp/inbound', async (req, res) => {
  // --- WhatsApp / Meta webhook signature validation ---
  const whatsappAppSecret = process.env.WHATSAPP_APP_SECRET;
  if (whatsappAppSecret) {
    const hubSignature = req.headers['x-hub-signature-256'] as string | undefined;
    if (!hubSignature) {
      logger.warn('[whatsapp/inbound] missing x-hub-signature-256 header — rejecting');
      res.status(401).json({ error: 'Missing signature' });
      return;
    }

    try {
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedSig = 'sha256=' + createHmac('sha256', whatsappAppSecret).update(rawBody).digest('hex');
      const sigBuffer = Buffer.from(hubSignature);
      const expectedBuffer = Buffer.from(expectedSig);

      if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
        logger.warn('[whatsapp/inbound] invalid x-hub-signature-256 — rejecting');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    } catch (err) {
      logger.error({ err }, '[whatsapp/inbound] signature validation error — rejecting');
      res.status(401).json({ error: 'Signature validation failed' });
      return;
    }
  } else {
    logger.warn('[whatsapp/inbound] WHATSAPP_APP_SECRET not set — skipping signature validation');
  }

  const from: string         = (req.body?.From  as string) ?? '';
  const body: string         = (req.body?.Body  as string) ?? '';
  const profileName: string  = (req.body?.ProfileName as string) ?? '';

  // Validate Twilio signature if auth token is configured
  const sig  = req.headers['x-twilio-signature'] as string | undefined;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (sig && token) {
    try {
      const { validateRequest } = await import('twilio');
      const proto   = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
      const host    = (req.headers['x-forwarded-host']  as string | undefined)
                   ?? (req.headers.host as string | undefined)
                   ?? '';
      const fullUrl = `${proto}://${host}/api/whatsapp/inbound`;
      const valid   = validateRequest(token, sig, fullUrl, req.body as Record<string, string>);
      if (!valid) {
        logger.warn({ from }, '[whatsapp/inbound] invalid Twilio signature — rejecting');
        res.status(403).send('Forbidden');
        return;
      }
    } catch (err) {
      logger.error({ err }, '[whatsapp/inbound] signature validation threw — rejecting');
      res.status(403).send('Forbidden');
      return;
    }
  }

  // Strip "whatsapp:" prefix Twilio adds to the From number
  const fromNumber = from.replace(/^whatsapp:/i, '');

  // General enquiries ("what services do you offer?") get an informational
  // auto-reply pointing to the triage form, instead of becoming a booking record.
  if (isGeneralEnquiry(body)) {
    const baseUrl = process.env.PORTAL_URL || process.env.FRONTEND_URL || 'https://amise-medflow-front-desk.vercel.app';
    await audit({
      action:     'send',
      entityType: 'whatsapp_message',
      entityId:   fromNumber,
      payload:    { reason: 'general_enquiry', body: body.slice(0, 500) },
    });
    logger.info({ from: fromNumber }, '[whatsapp/inbound] general enquiry — sent auto-reply');
    res.set('Content-Type', 'text/xml');
    res.send(enquiryReplyTwiml(`${baseUrl}/patient/request`));
    return;
  }

  const appointmentType = detectAppointmentType(body);
  const patientName = extractName(profileName, body) || `WA ${fromNumber}`;

  // Build a placeholder email so NOT NULL constraint is satisfied
  const placeholderEmail = `wa.${fromNumber.replace(/\D/g, '') || 'unknown'}@noreply.amise.internal`;

  let bookingCreated = false;

  try {
    const supa = getSupabaseAdmin();
    const { data, error } = await supa
      .from('appointment_requests')
      .insert({
        patient_name:     patientName,
        patient_email:    placeholderEmail,
        patient_phone:    fromNumber,
        // New column names (app code canonical)
        appointment_type: appointmentType,
        location:         'rodney_bay',
        preferred_slot:   null,
        // Mirror to production DB column names for backwards compat
        chief_complaint:  appointmentType,
        preferred_site:   'rodney_bay',
        preferred_date:   null,
        reason:           body.slice(0, 500) || null,
        status:           'pending',
        source:           'whatsapp',
        whatsapp_from:    fromNumber,
      })
      .select('id')
      .single();

    if (error) throw error;
    const bookingId: string = data.id;
    bookingCreated = true;

    const staffPhone = process.env.STAFF_NOTIFY_PHONE ?? null;
    if (staffPhone) {
      await sendSms({
        to:   staffPhone,
        body: smsBodyStaffNewBooking({
          patientName,
          appointmentType,
          preferredSlot: null,
          patientPhone:  fromNumber,
          bookingId,
        }),
      });
    }

    await audit({
      action:     'book',
      entityType: 'appointment_request',
      entityId:   bookingId,
      payload:    { source: 'whatsapp', whatsapp_from: fromNumber, appointment_type: appointmentType },
    });

    logger.info({ bookingId, from: fromNumber, appointmentType }, '[whatsapp/inbound] booking created');
  } catch (err) {
    logger.error({ err }, '[whatsapp/inbound] booking creation failed');
  }

  // Always respond with TwiML so Twilio does not retry; message content reflects actual outcome
  res.set('Content-Type', 'text/xml');
  res.send(bookingCreated ? TWIML_SUCCESS : TWIML_ERROR);
});

// ─── Meta WhatsApp Cloud API ──────────────────────────────────────────────────

interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      field: string;
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        messages?: Array<{
          from: string; id: string; timestamp: string; type: string;
          text?: { body: string };
        }>;
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
      };
    }>;
  }>;
}

const META_SUCCESS_MSG =
  'Thank you for contacting Amise Medical Services. We have received your message and a member of our team will be in touch shortly to confirm your appointment. For urgent matters, please call the clinic directly. – Amise Medical';

const META_ERROR_MSG =
  'Thank you for reaching Amise Medical Services. We have noted your message; however, we were unable to register your request automatically. Please call the clinic directly so we can assist you. – Amise Medical';

async function sendMetaReply(phoneNumberId: string, to: string, text: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    logger.warn('[whatsapp/meta] WHATSAPP_ACCESS_TOKEN not set — cannot send reply');
    return;
  }
  try {
    const resp = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/^\+/, ''),
        type: 'text',
        text: { body: text },
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      logger.warn({ status: resp.status, detail }, '[whatsapp/meta] send reply failed');
    }
  } catch (err) {
    logger.error({ err }, '[whatsapp/meta] sendMetaReply error');
  }
}

// GET /api/whatsapp/meta — Meta webhook verification challenge
router.get('/api/whatsapp/meta', (req, res) => {
  const mode      = req.query['hub.mode']         as string | undefined;
  const token     = req.query['hub.verify_token'] as string | undefined;
  const challenge = req.query['hub.challenge']    as string | undefined;

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) {
    logger.error('[whatsapp/meta] WHATSAPP_VERIFY_TOKEN not set');
    res.sendStatus(500);
    return;
  }
  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('[whatsapp/meta] webhook verified by Meta');
    res.status(200).send(challenge);
  } else {
    logger.warn('[whatsapp/meta] webhook verification failed');
    res.sendStatus(403);
  }
});

// POST /api/whatsapp/meta — incoming messages from Meta Cloud API
router.post('/api/whatsapp/meta', async (req, res) => {
  // Respond 200 immediately — Meta retries if we delay
  res.sendStatus(200);

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const hubSignature = req.headers['x-hub-signature-256'] as string | undefined;
    if (!hubSignature) {
      logger.warn('[whatsapp/meta] missing x-hub-signature-256 — dropping');
      return;
    }
    try {
      const rawBody     = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedSig = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
      if (hubSignature !== expectedSig) {
        logger.warn('[whatsapp/meta] invalid signature — dropping');
        return;
      }
    } catch (err) {
      logger.error({ err }, '[whatsapp/meta] signature validation error — dropping');
      return;
    }
  } else {
    logger.warn('[whatsapp/meta] WHATSAPP_APP_SECRET not set — skipping signature validation');
  }

  const payload = req.body as MetaWebhookPayload;
  if (payload.object !== 'whatsapp_business_account') return;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;
      const { messages, contacts, metadata } = change.value;
      if (!messages?.length) continue;

      for (const msg of messages) {
        if (msg.type !== 'text') continue;

        const fromNumber  = `+${msg.from}`;
        const body        = msg.text?.body ?? '';
        const phoneNumId  = metadata.phone_number_id;
        const profileName = contacts?.find(c => c.wa_id === msg.from)?.profile?.name ?? '';

        if (isGeneralEnquiry(body)) {
          const baseUrl = process.env.PORTAL_URL || 'https://amise-medflow-front-desk.vercel.app';
          const replyText =
            `Thanks for reaching out to Amise Medical Services — a general & endoscopic surgery practice led by Dr Dawit Daniel Kabiye, MD, DM, in Saint Lucia.\n\n` +
            `To help us prepare for your visit, please complete our short triage form: ${baseUrl}/patient/request\n\n` +
            `You’re also welcome to call our front desk: ${tapionLabel} ${tapionNum}, ${rodneyBayLabel} ${rodneyBayNum}. – Amise Medical`;
          await sendMetaReply(phoneNumId, fromNumber, replyText);
          await audit({ action: 'send', entityType: 'whatsapp_message', entityId: fromNumber, payload: { reason: 'general_enquiry', body: body.slice(0, 500) } });
          logger.info({ from: fromNumber }, '[whatsapp/meta] general enquiry — sent auto-reply');
          continue;
        }

        const appointmentType  = detectAppointmentType(body);
        const patientName      = extractName(profileName, body) || `WA ${fromNumber}`;
        const placeholderEmail = `wa.${fromNumber.replace(/\D/g, '') || 'unknown'}@noreply.amise.internal`;

        try {
          const supa = getSupabaseAdmin();
          const { data, error } = await supa
            .from('appointment_requests')
            .insert({
              patient_name:     patientName,
              patient_email:    placeholderEmail,
              patient_phone:    fromNumber,
              appointment_type: appointmentType,
              location:         'rodney_bay',
              preferred_slot:   null,
              chief_complaint:  appointmentType,
              preferred_site:   'rodney_bay',
              preferred_date:   null,
              reason:           body.slice(0, 500) || null,
              status:           'pending',
              source:           'whatsapp',
              whatsapp_from:    fromNumber,
            })
            .select('id')
            .single();

          if (error) throw error;
          const bookingId = data.id;

          const staffPhone = process.env.STAFF_NOTIFY_PHONE ?? null;
          if (staffPhone) {
            await sendSms({
              to:   staffPhone,
              body: smsBodyStaffNewBooking({ patientName, appointmentType, preferredSlot: null, patientPhone: fromNumber, bookingId }),
            });
          }

          await audit({ action: 'book', entityType: 'appointment_request', entityId: bookingId, payload: { source: 'whatsapp_meta', whatsapp_from: fromNumber, appointment_type: appointmentType } });
          await sendMetaReply(phoneNumId, fromNumber, META_SUCCESS_MSG);
          logger.info({ bookingId, from: fromNumber, appointmentType }, '[whatsapp/meta] booking created');
        } catch (err) {
          logger.error({ err }, '[whatsapp/meta] booking creation failed');
          await sendMetaReply(phoneNumId, fromNumber, META_ERROR_MSG);
        }
      }
    }
  }
});

export default router;
