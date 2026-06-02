import { Router } from 'express';
import { getSupabaseAdmin, audit } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { sendSms, smsBodyStaffNewBooking } from '../lib/sms.js';

const router = Router();

const APPOINTMENT_KEYWORDS: Array<[RegExp, string]> = [
  [/colonoscop/i,                                                    'colonoscopy'],
  [/gastroscop|OGD|oesophagogastro/i,                               'ogd'],
  [/EGD/i,                                                           'ogd'],
  [/ERCP/i,                                                          'ercp_workup'],
  [/pre[\s-]?op|pre[\s-]?operat|surgery|operat/i,                  'pre_op'],
  [/flexi|sigmoid/i,                                                 'flexi_sig'],
  [/endoscop/i,                                                      'ogd'],
];

function detectAppointmentType(text: string): string {
  for (const [pattern, type] of APPOINTMENT_KEYWORDS) {
    if (pattern.test(text)) return type;
  }
  return 'consultation';
}

function extractName(profileName: string, body: string): string {
  if (profileName) return profileName;
  const m = body.match(/(?:my name is|i(?:'?m| am)|this is)\s+([A-Za-z]+(?: [A-Za-z]+){0,2})/i);
  return m ? m[1].trim() : '';
}

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
      logger.warn({ err }, '[whatsapp/inbound] signature validation threw — proceeding');
    }
  }

  // Strip "whatsapp:" prefix Twilio adds to the From number
  const fromNumber = from.replace(/^whatsapp:/i, '');
  const appointmentType = detectAppointmentType(body);
  const patientName = extractName(profileName, body) || `WA ${fromNumber}`;

  // Build a placeholder email so NOT NULL constraint is satisfied
  const placeholderEmail = `wa.${fromNumber.replace(/\D/g, '')}@noreply.amise.internal`;

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

  // Always respond with TwiML so Twilio does not retry
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thank you for contacting Amise Medical Services. We have received your message and a member of our team will be in touch shortly to confirm your appointment. For urgent matters, please call the clinic directly. – Amise Medical</Message>
</Response>`;

  res.set('Content-Type', 'text/xml');
  res.send(twiml);
});

export default router;
