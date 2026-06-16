import { Router } from 'express';
import { sb, getSupabaseAdmin, audit } from '../lib/supabase.js';
import { sendSms, smsBody48h, smsBody2h, smsBodyIntakeReminder, smsBodyPostVisit, smsBodyStaffEscalation, getPrepInstructions } from '../lib/sms.js';
import { sendOrDraft } from '../lib/gmail.js';
import { draftReply } from '../lib/claude.js';
import { formatSlotForDisplay } from '../lib/calendar.js';
import { logger } from '../lib/logger.js';

const router = Router();

function requireCronSecret(req: any, res: any): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(401).json({ error: 'Cron secret not configured on this server' });
    return false;
  }
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
    try {
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

    // Pre-visit questionnaire nudge — piggybacks on the same 48h window so the
    // doctor has the AI pre-consult summary in hand before the appointment.
    // Only fires for patients who (a) have a portal account and (b) haven't
    // submitted an intake yet — the questionnaire is otherwise an orphaned
    // self-serve card on the portal home page that nobody is prompted to use.
    if (hoursUntil <= 48 && hoursUntil > 2 && !appt.intake_reminder_sent && appt.patient_phone && appt.patient_email) {
      const { data: patient } = await sb()
        .from('patients')
        .select('id')
        .eq('email', appt.patient_email.toLowerCase())
        .eq('portal_enabled', true)
        .maybeSingle();

      if (patient) {
        const { data: intake } = await sb()
          .from('patient_intake')
          .select('id')
          .eq('patient_id', patient.id)
          .limit(1)
          .maybeSingle();

        if (!intake) {
          const portalOrigin = new URL(process.env.PORTAL_URL ?? 'https://front-desk-amisesuite-afks-projects.vercel.app/patient').origin;
          const body = smsBodyIntakeReminder({ firstName: appt.patient_first_name, portalOrigin });
          const result = await sendSms({ to: appt.patient_phone, body });
          if (result.action === 'sent') {
            await sb().from('confirmed_appointments').update({ intake_reminder_sent: true }).eq('id', appt.id);
            await audit({ action: 'remind', entityType: 'appointment', entityId: appt.id, payload: { kind: 'intake_reminder_sms' } });
            results.push({ id: appt.id, action: 'intake_reminder_sent' });
          }
        }
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
    } catch (err) {
      req.log.error({ error: err, appointmentId: appt.id }, '[cron/reminders] failed to process appointment, continuing with remaining');
      results.push({ id: appt.id, action: 'error' });
    }
  }

  // Post-visit follow-up — a generic, non-clinical "how are you feeling
  // since your visit" check-in ~24h after the appointment, completing the
  // post_visit_24h entry in REMINDER_CASCADE. Never mentions diagnoses,
  // results, or medication — just an open door back to the practice and the
  // emergency number.
  const postVisitWindowStart = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const postVisitWindowEnd   = new Date(now.getTime() - 23 * 60 * 60 * 1000);

  const { data: pastAppointments, error: pastErr } = await sb()
    .from('confirmed_appointments')
    .select('*')
    .gte('start_time', postVisitWindowStart.toISOString())
    .lte('start_time', postVisitWindowEnd.toISOString())
    .eq('cancelled', false)
    .eq('post_visit_followup_sent', false);

  if (pastErr) {
    req.log.error({ error: pastErr }, '[cron/reminders] post-visit db error');
  } else {
    for (const appt of pastAppointments || []) {
      try {
        if (appt.patient_phone) {
          const body = smsBodyPostVisit({ firstName: appt.patient_first_name || 'there' });
          const result = await sendSms({ to: appt.patient_phone, body });
          if (result.action === 'sent') {
            await sb().from('confirmed_appointments').update({ post_visit_followup_sent: true }).eq('id', appt.id);
            await audit({ action: 'remind', entityType: 'appointment', entityId: appt.id, payload: { kind: 'post_visit_24h' } });
            results.push({ id: appt.id, action: 'post_visit_24h_sent' });
          }
        } else {
          await sb().from('confirmed_appointments').update({ post_visit_followup_sent: true }).eq('id', appt.id);
        }
      } catch (err) {
        req.log.error({ error: err, appointmentId: appt.id }, '[cron/reminders] failed to process post-visit follow-up, continuing with remaining');
        results.push({ id: appt.id, action: 'error' });
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
      // Omit payload — may contain PHI; entity_id and action are sufficient for triage
      summaryLines.push(`  [${esc.action}] entity: ${esc.entity_id} at ${esc.created_at}`);
    }
  }

  const summaryBody = summaryLines.join('\n');

  if (process.env.DOCTOR_NOTIFY_EMAIL) {
    try {
      await sendOrDraft({
        to: process.env.DOCTOR_NOTIFY_EMAIL,
        subject: `Amise Front Desk — Daily Summary ${startOfDay.toDateString()}`,
        body: summaryBody,
      }, 'auto');
    } catch (err) {
      req.log.error({ error: err }, '[cron/daily-summary] failed to send summary email');
    }
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
    try {
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
    } catch (err) {
      logger.error({ error: err, requestId: req.id }, '[cron/booking-reminders] failed to process request, continuing with remaining');
      results.push({ id: req.id, action: 'error' });
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
    try {
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
    } catch (err) {
      logger.error({ error: err, bookingId: booking.id }, '[cron/staff-escalation] failed to process booking, continuing with remaining');
      results.push({ id: booking.id, action: 'error' });
    }
  }

  logger.info({ count: results.length }, '[cron/staff-escalation] done');
  res.json({ processed: results.length, results });
});

export default router;
