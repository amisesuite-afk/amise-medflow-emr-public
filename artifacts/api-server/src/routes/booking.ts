import { Router } from 'express';
import { getSupabaseAdmin, audit } from '../lib/supabase.js';
import { sendSms } from '../lib/sms.js';
import { google } from 'googleapis';
import { logger } from '../lib/logger.js';

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
  const { patient_name, patient_email, patient_phone, appointment_type, location, preferred_slot, reason, triage_acuity, triage_score } = req.body ?? {};

  if (!patient_name || !patient_email || !appointment_type) {
    res.status(400).json({ error: 'patient_name, patient_email, and appointment_type are required' });
    return;
  }

  try {
    const supa = getSupabaseAdmin();
    const { data, error } = await supa
      .from('appointment_requests')
      .insert({
        patient_name,
        patient_email,
        patient_phone: patient_phone ?? null,
        appointment_type,
        location: location ?? 'rodney_bay',
        preferred_slot: preferred_slot ?? null,
        reason: reason ?? null,
        triage_acuity: triage_acuity ?? null,
        triage_score: triage_score ?? null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) throw error;

    await audit({ action: 'book', entityType: 'appointment_request', entityId: data.id, payload: { status: 'pending', appointment_type } });
    logger.info({ id: data.id }, '[booking/request] created');
    res.json({ id: data.id, status: 'pending' });
  } catch (err) {
    logger.error({ err }, '[booking/request] error');
    res.status(502).json({ error: String(err) });
  }
});

// POST /api/booking/staff-confirm/:id — staff approves and sets the confirmed slot
router.post('/api/booking/staff-confirm/:id', async (req, res) => {
  const { id } = req.params;
  const { confirmed_slot, notes } = req.body ?? {};

  if (!confirmed_slot) {
    res.status(400).json({ error: 'confirmed_slot (ISO string) required' });
    return;
  }

  try {
    const supa = getSupabaseAdmin();
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
    res.status(502).json({ error: String(err) });
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
    res.status(502).json({ error: String(err) });
  }
});

// POST /api/booking/lapse — cron-triggered: mark staff_confirmed requests with slot < 24hrs as lapsed
router.post('/api/booking/lapse', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = req.headers['x-cron-secret'] ?? req.query?.secret;
    if (provided !== secret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

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
    res.status(502).json({ error: String(err) });
  }
});

export default router;
