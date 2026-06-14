import { Router } from 'express';
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

function enquiryReplyTwiml(triageFormUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thanks for reaching out to Amise Medical Services — a general &amp; endoscopic surgery practice led by Dr Dawit Daniel Kabiye, MD, DM, in Saint Lucia (consultations, procedures such as colonoscopy/ERCP, and follow-up care).

To help us prepare for your visit, please complete our short triage form: ${triageFormUrl}

You're also welcome to reply here or email info@amisemedical.com with your details and we'll guide you through it — or call our front desk: Tapion 284-0557, Rodney Bay 720-7111. – Amise Medical</Message>
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
    const baseUrl = process.env.FRONTEND_URL || 'https://front-desk-amisesuite-afks-projects.vercel.app';
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
        appointment_type: appointmentType,
        location:         'rodney_bay',
        preferred_slot:   null,
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

export default router;
