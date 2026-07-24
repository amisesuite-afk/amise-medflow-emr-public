import { Router } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getSupabaseAdmin, audit, requireStaffAuth, requireCronSecret } from '../lib/supabase.js';
import { sendSms, smsBodyBookingAck, smsBodyStaffNewBooking, getPrepInstructions, toE164 } from '../lib/sms.js';
import { sendOrDraft } from '../lib/gmail.js';
import { google } from 'googleapis';
import { logger, errStr } from '../lib/logger.js';

const router = Router();

const bookingRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.patient_phone || req.ip || '',
  validate: { ip: false },
  message: { error: 'Too many booking requests. Please try again later or call us.' },
});

const BookingRequestSchema = z.object({
  patient_name: z.string().min(1),
  patient_phone: z.string().optional(),
  patient_email: z.string().email().optional(),
  appointment_type: z.string(),
  preferred_slot: z.string().optional(),
  notes: z.string().optional(),
  // Pass-through fields the existing handler also reads
  location: z.string().optional(),
  reason: z.string().optional(),
  triage_acuity: z.string().optional(),
  triage_score: z.union([z.string(), z.number()]).optional(),
  source: z.string().optional(),
  questionnaire_session_id: z.string().uuid().optional(),
});

const ConfirmBookingSchema = z.object({
  confirmed_slot: z.string().datetime(),
  notes: z.string().optional(),
});

function getCalendarClient() {
  if (
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  ) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob'
    );
    client.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
    return google.calendar({ version: 'v3', auth: client });
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    return google.calendar({ version: 'v3', auth });
  }
  return null;
}

// POST /api/booking/request — patient or staff submits a booking request
router.post('/api/booking/request', bookingRateLimit, async (req, res) => {
  const parsed = BookingRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { patient_name, patient_email, patient_phone, appointment_type, location, preferred_slot, reason, triage_acuity, triage_score, source, questionnaire_session_id } = parsed.data;

  const VALID_SOURCES = ['web', 'whatsapp', 'manual', 'phone', 'email'];
  const resolvedSource: string = VALID_SOURCES.includes(source as string) ? (source as string) : 'web';
  const normalizedPhone = patient_phone ? toE164(patient_phone as string) : null;
  if (resolvedSource === 'web' && !questionnaire_session_id) {
    logger.warn('[booking/request] web intake missing questionnaire_session_id — staff cannot see intake answers');
  }

  try {
    const supa = getSupabaseAdmin();
    const resolvedLocation = location ?? 'rodney_bay';
    const { data, error } = await supa
      .from('appointment_requests')
      .insert({
        patient_name,
        patient_email: patient_email || null,
        patient_phone: normalizedPhone,
        // New column names (used by app code)
        appointment_type,
        location: resolvedLocation,
        preferred_slot: preferred_slot ?? null,
        reason: reason ?? null,
        triage_acuity: triage_acuity ?? null,
        triage_score: triage_score ?? null,
        // Mirror to production DB column names for backwards compat
        chief_complaint: appointment_type,
        preferred_site: resolvedLocation,
        preferred_date: preferred_slot ?? null,
        triage_level: triage_acuity ?? null,
        status: 'pending',
        source: resolvedSource,
        questionnaire_session_id: questionnaire_session_id ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;

    const bookingId = data.id;
    const now = new Date().toISOString();
    const staffPhone = process.env.STAFF_NOTIFY_PHONE ?? null;
    const staffEmail = process.env.STAFF_NOTIFY_EMAIL ?? process.env.DOCTOR_NOTIFY_EMAIL ?? null;
    const practicePhone = process.env.PRACTICE_PHONE ?? '+17582840557';
    const firstName = (patient_name as string).split(' ')[0];

    // Immediate patient acknowledgement SMS
    let patientAckSent = false;
    if (normalizedPhone) {
      const body = smsBodyBookingAck({ firstName, appointmentType: appointment_type, phone: practicePhone });
      const result = await sendSms({ to: normalizedPhone, body });
      patientAckSent = result.action === 'sent';
    }

    // Immediate staff SMS alert
    if (staffPhone) {
      const body = smsBodyStaffNewBooking({
        patientName: patient_name,
        appointmentType: appointment_type,
        preferredSlot: preferred_slot ?? null,
        patientPhone: normalizedPhone,
        bookingId,
      });
      await sendSms({ to: staffPhone, body });
    }

    // Immediate staff email alert
    if (staffEmail) {
      const typeLabel = (appointment_type as string).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const slotLine = preferred_slot ? `\nPreferred slot: ${preferred_slot}` : '';
      const phoneLine = patient_phone ? `\nPhone: ${patient_phone}` : '';
      const emailLine = patient_email ? `\nEmail: ${patient_email}` : '';
      const prepNote = getPrepInstructions(appointment_type) ? `\n\n⚠ PREP REQUIRED for ${typeLabel} — ensure patient receives prep instructions with confirmation.` : '';
      const reasonLine = reason ? `\nReason: ${reason}` : '';
      await sendOrDraft({
        to: staffEmail,
        subject: `New Booking Request — ${patient_name} — ${typeLabel}`,
        body: `A new booking request has been received.\n\nPatient: ${patient_name}${emailLine}${phoneLine}\nAppointment type: ${typeLabel}\nLocation: ${location ?? 'Rodney Bay'}${slotLine}${reasonLine}${prepNote}\n\nBooking ID: ${bookingId}\nSubmitted: ${now}\n\nPlease confirm or contact the patient within 2 hours.`,
      }, 'auto');
    }

    // Record that patient was notified and staff was alerted
    const updatePayload: Record<string, string | boolean> = { staff_notified_at: now };
    if (patientAckSent) updatePayload.patient_ack_sent_at = now;
    await supa.from('appointment_requests').update(updatePayload).eq('id', bookingId);

    await audit({ action: 'book', entityType: 'appointment_request', entityId: bookingId, payload: { status: 'pending', appointment_type, source: resolvedSource, patient_ack_sent: patientAckSent, staff_notified: !!(staffPhone || staffEmail) } });
    logger.info({ id: bookingId, patientAckSent, staffPhone: !!staffPhone, staffEmail: !!staffEmail }, '[booking/request] created + notified');
    res.json({ id: bookingId, status: 'pending' });
  } catch (err) {
    logger.error({ err }, '[booking/request] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/booking/staff-confirm/:id — staff approves and sets the confirmed slot
router.post('/api/booking/staff-confirm/:id', async (req, res) => {
  try {
    if (!(await requireStaffAuth(req, res))) return;
    const { id } = req.params;

    const parsed = ConfirmBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { confirmed_slot, notes } = parsed.data;

    const supa = getSupabaseAdmin();

    // Optimistic conflict check — prevent two requests landing in the same slot.
    // Not a hard DB-level lock, but eliminates the common case of concurrent staff actions.
    const { data: conflict } = await supa
      .from('appointment_requests')
      .select('id')
      .eq('confirmed_slot', confirmed_slot)
      .in('status', ['staff_confirmed', 'patient_confirmed'])
      .neq('id', id)
      .maybeSingle();

    if (conflict) {
      res.status(409).json({ error: 'That slot is already taken by another confirmed appointment. Please choose a different time.' });
      return;
    }

    const confirmationToken = randomBytes(16).toString('hex');

    const { error } = await supa
      .from('appointment_requests')
      .update({
        status: 'staff_confirmed',
        confirmed_slot,
        staff_confirmed_at: new Date().toISOString(),
        notes: notes ?? null,
        confirmation_token: confirmationToken,
      })
      .eq('id', id)
      .eq('status', 'pending');

    if (error) throw error;

    await audit({ action: 'book', entityType: 'appointment_request', entityId: id, payload: { status: 'staff_confirmed', confirmed_slot } });
    logger.info({ id, confirmed_slot }, '[booking/staff-confirm] confirmed');
    res.json({ id, status: 'staff_confirmed', confirmed_slot, confirmation_token: confirmationToken });
  } catch (err) {
    logger.error({ err }, '[booking/staff-confirm] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/booking/waitlist/:id — staff parks a request that can't be slotted
// immediately (e.g. fully-booked procedure list) without losing it in "pending"
router.post('/api/booking/waitlist/:id', async (req, res) => {
  try {
    if (!(await requireStaffAuth(req, res))) return;
    const { id } = req.params;
    const { notes } = req.body ?? {};

    const supa = getSupabaseAdmin();
    const { error } = await supa
      .from('appointment_requests')
      .update({ status: 'waitlisted', notes: notes ?? null })
      .eq('id', id)
      .eq('status', 'pending');

    if (error) throw error;

    await audit({ action: 'book', entityType: 'appointment_request', entityId: id, payload: { status: 'waitlisted' } });
    logger.info({ id }, '[booking/waitlist] waitlisted');
    res.json({ id, status: 'waitlisted' });
  } catch (err) {
    logger.error({ err }, '[booking/waitlist] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/booking/patient-confirm/:id — patient confirms 48 hrs prior; creates Google Calendar event
router.post('/api/booking/patient-confirm/:id', async (req, res) => {
  const { id } = req.params;
  const { confirmation_token } = (req.body ?? {}) as { confirmation_token?: string };

  if (!confirmation_token) {
    res.status(400).json({ error: 'confirmation_token is required' });
    return;
  }

  try {
    const supa = getSupabaseAdmin();
    const { data: row, error: fetchErr } = await supa
      .from('appointment_requests')
      .select('*')
      .eq('id', id)
      .eq('status', 'staff_confirmed')
      .single();

    if (fetchErr || !row) {
      res.status(404).json({ error: 'Request not found or not in staff_confirmed state' });
      return;
    }

    // Validate confirmation token using constant-time comparison
    const storedToken = (row as Record<string, unknown>).confirmation_token as string | null;
    if (!storedToken) {
      res.status(403).json({ error: 'No confirmation token set for this booking' });
      return;
    }

    const providedBuf = Buffer.from(confirmation_token);
    const storedBuf = Buffer.from(storedToken);
    if (providedBuf.length !== storedBuf.length || !timingSafeEqual(providedBuf, storedBuf)) {
      res.status(401).json({ error: 'Invalid confirmation token' });
      return;
    }

    let googleEventId: string | null = null;
    const cal = getCalendarClient();
    if (cal && row.confirmed_slot) {
      const slotStart = new Date(row.confirmed_slot);
      const slotEnd   = new Date(slotStart.getTime() + 30 * 60_000);
      try {
        const { data: ev } = await cal.events.insert({
          calendarId: process.env.CALENDAR_ID_RODNEY_BAY ?? 'amisesuite@gmail.com',
          requestBody: {
            summary: `${row.patient_name} — ${row.appointment_type}`,
            description: row.reason ?? '',
            start: { dateTime: slotStart.toISOString(), timeZone: 'America/St_Lucia' },
            end:   { dateTime: slotEnd.toISOString(),   timeZone: 'America/St_Lucia' },
          },
        });
        googleEventId = ev.id ?? null;
      } catch (calErr) {
        logger.warn({ calErr }, '[booking/patient-confirm] calendar insert failed — continuing');
      }
    }

    const { error: updateErr } = await supa
      .from('appointment_requests')
      .update({
        status: 'patient_confirmed',
        patient_confirmed_at: new Date().toISOString(),
        google_event_id: googleEventId,
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    await audit({ action: 'book', entityType: 'appointment_request', entityId: id, payload: { status: 'patient_confirmed', google_event_id: googleEventId } });
    logger.info({ id, googleEventId }, '[booking/patient-confirm] confirmed');
    res.json({ id, status: 'patient_confirmed', google_event_id: googleEventId });
  } catch (err) {
    logger.error({ err }, '[booking/patient-confirm] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/booking/cancel/:id — staff cancels a request that hasn't been
// patient-confirmed yet (pending, waitlisted, or staff_confirmed)
router.post('/api/booking/cancel/:id', async (req, res) => {
  try {
    if (!(await requireStaffAuth(req, res))) return;
    const { id } = req.params;
    const { reason } = req.body ?? {};

    const supa = getSupabaseAdmin();
    const { data, error } = await supa
      .from('appointment_requests')
      .update({ status: 'cancelled', notes: reason ?? null })
      .eq('id', id)
      .in('status', ['pending', 'waitlisted', 'staff_confirmed'])
      .select('id')
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Request not found or already finalised' });
      return;
    }

    await audit({ action: 'skip', entityType: 'appointment_request', entityId: id, payload: { status: 'cancelled', reason: reason ?? null } });
    logger.info({ id, reason }, '[booking/cancel] cancelled');
    res.json({ id, status: 'cancelled' });
  } catch (err) {
    logger.error({ err }, '[booking/cancel] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/booking/lapse — cron-triggered: mark staff_confirmed requests with slot < 24hrs as lapsed
router.post('/api/booking/lapse', async (req, res) => {
  if (!requireCronSecret(req, res)) return;

  const cutoff = new Date(Date.now() + 24 * 60 * 60_000).toISOString();

  try {
    const supa = getSupabaseAdmin();
    const { data, error } = await supa
      .from('appointment_requests')
      .update({ status: 'lapsed' })
      .eq('status', 'staff_confirmed')
      .lt('confirmed_slot', cutoff)
      .select('id');

    if (error) throw error;

    const lapsed = (data ?? []).map((r: { id: string }) => r.id);
    for (const id of lapsed) {
      await audit({ action: 'skip', entityType: 'appointment_request', entityId: id, payload: { status: 'lapsed', reason: 'no_patient_confirmation' } });
    }

    logger.info({ count: lapsed.length }, '[booking/lapse] lapsed');
    res.json({ lapsed: lapsed.length, ids: lapsed });
  } catch (err) {
    logger.error({ err }, '[booking/lapse] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// GET /api/booking/requests — list booking requests (staff/admin)
router.get('/api/booking/requests', async (req, res) => {
  try {
    if (!(await requireStaffAuth(req, res))) return;
    const status  = (req.query.status  as string | undefined) ?? null;
    const limit   = Math.min(parseInt((req.query.limit as string) ?? '100', 10) || 100, 200);

    const supa = getSupabaseAdmin();
    let query = supa
      .from('appointment_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ requests: data ?? [] });
  } catch (err) {
    logger.error({ err }, '[booking/requests] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/booking/notify-red-flags — called by front-desk after web intake with red flags
router.post('/api/booking/notify-red-flags', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  try {
    const { bookingId, patientName, chiefComplaint, redFlags, urgency } = (req.body ?? {}) as {
      bookingId?: string;
      patientName?: string;
      chiefComplaint?: string;
      redFlags?: Array<{ description?: string; severity?: string }>;
      urgency?: string;
    };

    if (!bookingId || !patientName) {
      res.status(400).json({ error: 'bookingId and patientName are required' });
      return;
    }

    const staffPhone = process.env.STAFF_NOTIFY_PHONE ?? null;
    const staffEmail = process.env.STAFF_NOTIFY_EMAIL ?? process.env.DOCTOR_NOTIFY_EMAIL ?? null;

    const flagSummary = (redFlags ?? []).map(f => `• ${f.description ?? 'Unknown'} (${f.severity ?? 'flagged'})`).join('\n');
    const urgLabel = (urgency ?? 'unknown').toUpperCase();

    if (staffPhone) {
      const body = `RED FLAG [${urgLabel}] — ${patientName}: ${chiefComplaint ?? 'Web intake'}. ${(redFlags ?? []).length} flag(s). Review in dashboard. Booking ${(bookingId ?? '').slice(0, 8)}`;
      await sendSms({ to: staffPhone, body });
    }

    if (staffEmail) {
      await sendOrDraft({
        to: staffEmail,
        subject: `[RED FLAG ${urgLabel}] Web Intake — ${patientName}`,
        body: `A web intake submission has been flagged.\n\nPatient: ${patientName}\nChief complaint: ${chiefComplaint ?? 'Not specified'}\nUrgency: ${urgLabel}\n\nRed flags:\n${flagSummary || '(none specified)'}\n\nBooking ID: ${bookingId}\n\nPlease review this case promptly in the Amise dashboard.`,
      }, 'auto');
    }

    // Update the booking record to note staff were notified
    const sb = getSupabaseAdmin();
    await sb.from('appointment_requests')
      .update({ staff_notified_at: new Date().toISOString() })
      .eq('id', bookingId);

    await audit({
      action: 'notify',
      entityType: 'appointment_request',
      entityId: bookingId ?? 'unknown',
      payload: { event: 'red_flag_notification', urgency, redFlagCount: (redFlags ?? []).length, staffPhone: !!staffPhone, staffEmail: !!staffEmail },
    });

    logger.info({ bookingId, urgency, flags: (redFlags ?? []).length }, '[booking/notify-red-flags] staff notified');
    res.json({ notified: true, sms: !!staffPhone, email: !!staffEmail });
  } catch (err) {
    logger.error({ err }, '[booking/notify-red-flags] error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
