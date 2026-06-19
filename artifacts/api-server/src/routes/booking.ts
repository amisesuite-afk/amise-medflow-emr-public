import { Router } from 'express';
import { getSupabaseAdmin, audit, requireStaffAuth, requireCronSecret } from '../lib/supabase.js';
import { sendSms, smsBodyBookingAck, smsBodyStaffNewBooking, getPrepInstructions } from '../lib/sms.js';
import { sendOrDraft } from '../lib/gmail.js';
import { google } from 'googleapis';
import { logger, errStr } from '../lib/logger.js';

const router = Router();

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
router.post('/api/booking/request', async (req, res) => {
  const { patient_name, patient_email, patient_phone, appointment_type, location, preferred_slot, reason, triage_acuity, triage_score, source } = req.body ?? {};

  if (!patient_name || !appointment_type) {
    res.status(400).json({ error: 'patient_name and appointment_type are required' });
    return;
  }

  const VALID_SOURCES = ['web', 'whatsapp', 'manual', 'phone', 'email'];
  const resolvedSource: string = VALID_SOURCES.includes(source as string) ? (source as string) : 'web';

  try {
    const supa = getSupabaseAdmin();
    const { data, error } = await supa
      .from('appointment_requests')
      .insert({
        patient_name,
        patient_email: patient_email || null,
        patient_phone: patient_phone ?? null,
        appointment_type,
        location: location ?? 'rodney_bay',
        preferred_slot: preferred_slot ?? null,
        reason: reason ?? null,
        triage_acuity: triage_acuity ?? null,
        triage_score: triage_score ?? null,
        status: 'pending',
        source: resolvedSource,
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
    if (patient_phone) {
      const body = smsBodyBookingAck({ firstName, appointmentType: appointment_type, phone: practicePhone });
      const result = await sendSms({ to: patient_phone, body });
      patientAckSent = result.action === 'sent';
    }

    // Immediate staff SMS alert
    if (staffPhone) {
      const body = smsBodyStaffNewBooking({
        patientName: patient_name,
        appointmentType: appointment_type,
        preferredSlot: preferred_slot ?? null,
        patientPhone: patient_phone ?? null,
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
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;
  const { confirmed_slot, notes } = req.body ?? {};

  if (!confirmed_slot) {
    res.status(400).json({ error: 'confirmed_slot (ISO string) required' });
    return;
  }

  try {
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

    const { error } = await supa
      .from('appointment_requests')
      .update({
        status: 'staff_confirmed',
        confirmed_slot,
        staff_confirmed_at: new Date().toISOString(),
        notes: notes ?? null,
      })
      .eq('id', id)
      .eq('status', 'pending');

    if (error) throw error;

    await audit({ action: 'book', entityType: 'appointment_request', entityId: id, payload: { status: 'staff_confirmed', confirmed_slot } });
    logger.info({ id, confirmed_slot }, '[booking/staff-confirm] confirmed');
    res.json({ id, status: 'staff_confirmed', confirmed_slot });
  } catch (err) {
    logger.error({ err }, '[booking/staff-confirm] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/booking/waitlist/:id — staff parks a request that can't be slotted
// immediately (e.g. fully-booked procedure list) without losing it in "pending"
router.post('/api/booking/waitlist/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;
  const { notes } = req.body ?? {};

  try {
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
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;
  const { reason } = req.body ?? {};

  try {
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
  if (!(await requireStaffAuth(req, res))) return;
  const status  = (req.query.status  as string | undefined) ?? null;
  const limit   = Math.min(parseInt((req.query.limit as string) ?? '100', 10) || 100, 200);

  try {
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

export default router;
