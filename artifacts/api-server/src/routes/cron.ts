import { Router } from 'express';
import { sb, getSupabaseAdmin, audit } from '../lib/supabase.js';
import { sendSms, smsBody48h, smsBody2h, smsBodyStaffEscalation, getPrepInstructions } from '../lib/sms.js';
import { sendOrDraft } from '../lib/gmail.js';
import { draftReply } from '../lib/claude.js';
import { formatSlotForDisplay } from '../lib/calendar.js';
import { logger } from '../lib/logger.js';

const router = Router();

function requireCronSecret(req: any, res: any): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const provided = req.headers['x-cron-secret'] || req.query?.secret;
  if (provided !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

router.post('/api/cron/reminders', async (req, res) => {
  if (!requireCronSecret(req, res)) return;

  const now = new Date();
  const window48h = new Date(now.getTime() + 48 * 60 * 60 * 1000 + 30 * 60 * 1000);
  const window2h   = new Date(now.getTime() + 2  * 60 * 60 * 1000 + 30 * 60 * 1000);

  req.log.info({ now }, '[cron/reminders] running');

  let { data: appointments, error } = await sb()
    .from('confirmed_appointments')
    .select('*')
    .gte('start_time', now.toISOString())
    .lte('start_time', window48h.toISOString())
    .eq('cancelled', false);

  if (error) {
    req.log.error({ error }, '[cron/reminders] db error');
    res.status(502).json({ error: 'DB error' });
    return;
  }

  const results: { id: string; action: string }[] = [];

  for (const appt of appointments || []) {
    const apptTime = new Date(appt.start_time);
    const msUntil  = apptTime.getTime() - now.getTime();
    const hoursUntil = msUntil / 3600_000;

    const slot = {
      start: apptTime,
      end: new Date(appt.end_time || apptTime.getTime() + 30 * 60 * 1000),
      location: appt.location,
      appointmentType: appt.appointment_type,
    };
    const slotDisplay = formatSlotForDisplay(slot as any);

    if (hoursUntil <= 48 && hoursUntil > 2 && !appt.reminder_48h_sent) {
      if (appt.patient_phone) {
        const prepInstructions = getPrepInstructions(appt.appointment_type);
        const body = smsBody48h({ ...slotDisplay, prepInstructions });
        const result = await sendSms({ to: appt.patient_phone, body });
        if (result.action === 'sent') {
          await sb().from('confirmed_appointments').update({ reminder_48h_sent: true }).eq('id', appt.id);
          await audit({ action: 'remind', entityType: 'appointment', entityId: appt.id, payload: { kind: 'sms_48h' } });
          results.push({ id: appt.id, action: 'sms_48h_sent' });
        }
      }

      if (appt.patient_email && !appt.patient_email.endsWith('@noreply.amise.internal') && !appt.email_24h_sent && hoursUntil <= 24) {
        const draft = await draftReply({ template: 'confirmation', patientFirstName: appt.patient_first_name, bookingDetails: slotDisplay });
        const prepInstructions = getPrepInstructions(appt.appointment_type);
        const prepSection = prepInstructions
          ? `\n\n---\nPREPARATION INSTRUCTIONS\n\n${prepInstructions}\n\nIf you have any questions about your preparation, please call us at ${process.env.PRACTICE_PHONE ?? '+1 758 284 0557'}.`
          : '';
        await sendOrDraft({ to: appt.patient_email, subject: `Reminder: ${draft.subject}`, body: `${draft.body}${prepSection}` }, 'auto');
        await sb().from('confirmed_appointments').update({ email_24h_sent: true }).eq('id', appt.id);
        await audit({ action: 'remind', entityType: 'appointment', entityId: appt.id, payload: { kind: 'email_24h', prep_included: !!prepInstructions } });
        results.push({ id: appt.id, action: 'email_24h_sent' });
      }
    }

    if (hoursUntil <= 2.5 && hoursUntil > 0 && !appt.reminder_2h_sent && appt.patient_phone) {
      const body = smsBody2h(slotDisplay);
      const result = await sendSms({ to: appt.patient_phone, body });
      if (result.action === 'sent') {
        await sb().from('confirmed_appointments').update({ reminder_2h_sent: true }).eq('id', appt.id);
        await audit({ action: 'remind', entityType: 'appointment', entityId: appt.id, payload: { kind: 'sms_2h' } });
        results.push({ id: appt.id, action: 'sms_2h_sent' });
      }
    }
  }

  res.json({ processed: results.length, results });
});

router.post('/api/cron/daily-summary', async (req, res) => {
  if (!requireCronSecret(req, res)) return;

  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay   = new Date(today.setHours(23, 59, 59, 999));

  const { data: appointments } = await sb()
    .from('confirmed_appointments')
    .select('*')
    .gte('start_time', startOfDay.toISOString())
    .lte('start_time', endOfDay.toISOString())
    .eq('cancelled', false);

  const { data: escalations } = await sb()
    .from('audit_log')
    .select('*')
    .eq('action', 'escalate')
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString());

  const { data: pending } = await sb()
    .from('pending_bookings')
    .select('*')
    .eq('status', 'awaiting_reply');

  const summaryLines: string[] = [
    `Daily Summary — Amise Front Desk AI — ${startOfDay.toDateString()}`,
    '',
    `Appointments today: ${appointments?.length ?? 0}`,
    `Escalations today: ${escalations?.length ?? 0}`,
    `Pending replies: ${pending?.length ?? 0}`,
  ];

  if (appointments?.length) {
    summaryLines.push('', 'Today\'s schedule:');
    for (const appt of appointments) {
      const t = new Date(appt.start_time);
      summaryLines.push(`  ${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')} — ${appt.patient_first_name || appt.patient_email} (${appt.appointment_type}) @ ${appt.location}`);
    }
  }

  if (escalations?.length) {
    summaryLines.push('', 'Escalations:');
    for (const esc of escalations) {
      summaryLines.push(`  ${esc.entity_id}: ${JSON.stringify(esc.payload)}`);
    }
  }

  const summaryBody = summaryLines.join('\n');

  if (process.env.DOCTOR_NOTIFY_EMAIL) {
    await sendOrDraft({
      to: process.env.DOCTOR_NOTIFY_EMAIL,
      subject: `Amise Front Desk — Daily Summary ${startOfDay.toDateString()}`,
      body: summaryBody,
    }, 'auto');
  }

  req.log.info('[cron/daily-summary] complete');
  res.json({ summary: summaryBody });
});

// POST /api/cron/booking-reminders
// Finds staff_confirmed requests in the 47–50 hr window and sends patient confirmation SMS.
// Non-response is detected by the /api/booking/lapse endpoint (run daily at T-24h).
router.post('/api/cron/booking-reminders', async (req, res) => {
  if (!requireCronSecret(req, res)) return;

  const now = new Date();
  const windowStart = new Date(now.getTime() + 47 * 3600_000);
  const windowEnd   = new Date(now.getTime() + 50 * 3600_000);

  const supa = getSupabaseAdmin();
  const { data: requests, error } = await supa
    .from('appointment_requests')
    .select('*')
    .eq('status', 'staff_confirmed')
    .gte('confirmed_slot', windowStart.toISOString())
    .lte('confirmed_slot', windowEnd.toISOString())
    .is('reminder_sent_at', null);

  if (error) {
    logger.error({ error }, '[cron/booking-reminders] db error');
    res.status(502).json({ error: 'DB error' });
    return;
  }

  const results: { id: string; action: string }[] = [];

  for (const req of requests ?? []) {
    if (req.patient_phone) {
      const slotDate = new Date(req.confirmed_slot);
      const slotStr = slotDate.toLocaleString('en-LC', { timeZone: 'America/St_Lucia', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true });
      const prepInstructions = getPrepInstructions(req.appointment_type);
      const prepLine = prepInstructions ? `\n\n${prepInstructions}` : '';
      const body = `Hi ${req.patient_name.split(' ')[0]}, your appointment with Dr Kabiye is on ${slotStr}. Reply YES to confirm or call us to reschedule.${prepLine} – Amise Medical`;
      const result = await sendSms({ to: req.patient_phone, body });
      if (result.action === 'sent' || result.action === 'skipped') {
        await supa.from('appointment_requests').update({ reminder_sent_at: now.toISOString(), prep_sms_sent: !!prepInstructions }).eq('id', req.id);
        await audit({ action: 'remind', entityType: 'appointment_request', entityId: req.id, payload: { kind: 'sms_48h_confirmation', prep_included: !!prepInstructions } });
        results.push({ id: req.id, action: result.action === 'sent' ? 'sms_sent' : 'sms_dry_run' });
      }
    } else {
      await supa.from('appointment_requests').update({ reminder_sent_at: now.toISOString() }).eq('id', req.id);
      results.push({ id: req.id, action: 'no_phone' });
    }
  }

  logger.info({ count: results.length }, '[cron/booking-reminders] done');
  res.json({ processed: results.length, results });
});

// POST /api/cron/staff-escalation
// Run every 30 min. Re-notifies staff on pending bookings unactioned for > 2h; escalates to doctor after > 4h.
router.post('/api/cron/staff-escalation', async (req, res) => {
  if (!requireCronSecret(req, res)) return;

  const now = new Date();
  const twoHoursAgo  = new Date(now.getTime() - 2  * 3600_000).toISOString();
  const fourHoursAgo = new Date(now.getTime() - 4  * 3600_000).toISOString();

  const staffPhone  = process.env.STAFF_NOTIFY_PHONE ?? null;
  const staffEmail  = process.env.STAFF_NOTIFY_EMAIL ?? null;
  const doctorEmail = process.env.DOCTOR_NOTIFY_EMAIL ?? null;

  const supa = getSupabaseAdmin();
  const { data: pending, error } = await supa
    .from('appointment_requests')
    .select('*')
    .eq('status', 'pending')
    .lt('created_at', twoHoursAgo)
    .is('staff_escalated_at', null);

  if (error) {
    logger.error({ error }, '[cron/staff-escalation] db error');
    res.status(502).json({ error: 'DB error' });
    return;
  }

  const results: { id: string; action: string }[] = [];

  for (const booking of pending ?? []) {
    const createdAt = new Date(booking.created_at);
    const hoursWaiting = Math.floor((now.getTime() - createdAt.getTime()) / 3600_000);
    const isDocEscalation = booking.created_at < fourHoursAgo;

    const smsBody = smsBodyStaffEscalation({
      patientName: booking.patient_name,
      appointmentType: booking.appointment_type,
      hoursWaiting,
      bookingId: booking.id,
      patientPhone: booking.patient_phone ?? null,
    });

    const typeLabel = (booking.appointment_type as string).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const emailBody = `UNACTIONED BOOKING — ${hoursWaiting} hours outstanding\n\nPatient: ${booking.patient_name}\nAppointment: ${typeLabel}\nPhone: ${booking.patient_phone ?? 'not provided'}\nEmail: ${booking.patient_email ?? 'not provided'}\nPreferred slot: ${booking.preferred_slot ?? 'not specified'}\nBooking ID: ${booking.id}\nSubmitted: ${booking.created_at}\n\nThis booking has not been confirmed or actioned. Please review immediately.`;

    if (isDocEscalation && doctorEmail) {
      await sendOrDraft({
        to: doctorEmail,
        subject: `⚠ ESCALATION: Unactioned booking ${hoursWaiting}h — ${booking.patient_name}`,
        body: emailBody,
      }, 'auto');
    } else if (staffEmail) {
      await sendOrDraft({
        to: staffEmail,
        subject: `Action required: Unactioned booking ${hoursWaiting}h — ${booking.patient_name}`,
        body: emailBody,
      }, 'auto');
    }

    if (staffPhone) {
      await sendSms({ to: staffPhone, body: smsBody });
    }

    await supa.from('appointment_requests').update({ staff_escalated_at: now.toISOString() }).eq('id', booking.id);
    await audit({ action: 'escalate', entityType: 'appointment_request', entityId: booking.id, payload: { hours_waiting: hoursWaiting, doc_escalation: isDocEscalation } });
    results.push({ id: booking.id, action: isDocEscalation ? 'doctor_escalated' : 'staff_re_notified' });
  }

  logger.info({ count: results.length }, '[cron/staff-escalation] done');
  res.json({ processed: results.length, results });
});

export default router;
