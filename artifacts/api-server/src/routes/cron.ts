import { Router } from 'express';
import { sb, getSupabaseAdmin, audit, requireCronSecret } from '../lib/supabase.js';
import { sendSms, smsBody48h, smsBodyPostVisit, smsBodyStaffEscalation, getPrepInstructions } from '../lib/sms.js';
import { sendOrDraft } from '../lib/gmail.js';
import { draftReply } from '../lib/claude.js';
import { formatSlotForDisplay, fetchAllEventsForDate } from '../lib/calendar.js';
import { logger, errStr } from '../lib/logger.js';

const router = Router();

router.post('/api/cron/reminders', async (req, res) => {
  if (!requireCronSecret(req, res)) return;

  const now = new Date();
  const window48h = new Date(now.getTime() + 48 * 60 * 60 * 1000 + 30 * 60 * 1000);

  req.log.info({ now }, '[cron/reminders] running');

  // appointment_requests tracks all bookings from the AI intake flow; confirmed_slot
  // holds the agreed appointment time once staff have confirmed.
  const { data: appointments, error } = await sb()
    .from('appointment_requests')
    .select('*')
    .in('status', ['staff_confirmed', 'patient_confirmed'])
    .gte('confirmed_slot', now.toISOString())
    .lte('confirmed_slot', window48h.toISOString());

  if (error) {
    req.log.error({ error }, '[cron/reminders] db error');
    res.status(502).json({ error: 'DB error' });
    return;
  }

  const results: { id: string; action: string }[] = [];

  for (const appt of appointments || []) {
    try {
      const apptTime = new Date(appt.confirmed_slot);
      const hoursUntil = (apptTime.getTime() - now.getTime()) / 3600_000;
      const firstName = (appt.patient_name as string || 'there').split(' ')[0];

      const slot = {
        start: apptTime,
        end: new Date(apptTime.getTime() + 45 * 60 * 1000),
        location: appt.location,
        appointmentType: appt.appointment_type,
      };
      const slotDisplay = formatSlotForDisplay(slot as any);

      // 48h SMS reminder — claim the row atomically before sending to prevent
      // double-send when two cron instances overlap (DB-level CAS).
      if (hoursUntil <= 48 && hoursUntil > 2 && !appt.reminder_sent_at && appt.patient_phone) {
        const { data: claimed } = await sb()
          .from('appointment_requests')
          .update({ reminder_sent_at: now.toISOString() })
          .eq('id', appt.id)
          .is('reminder_sent_at', null)  // only update if still unclaimed
          .select('id');
        if (claimed && claimed.length > 0) {
          const prepInstructions = getPrepInstructions(appt.appointment_type);
          const body = smsBody48h({ ...slotDisplay, prepInstructions });
          const result = await sendSms({ to: appt.patient_phone, body });
          await audit({ action: 'remind', entityType: 'appointment_request', entityId: appt.id, payload: { kind: 'sms_48h', sms_result: result.action } });
          results.push({ id: appt.id, action: 'sms_48h_sent' });
        }
        // claimed.length === 0 means another instance already sent it — skip silently
      }

      // 24h email reminder — claim atomically via prep_sms_sent flag.
      // NOTE: patient_ack_sent_at is set during the booking-ack SMS flow, so it cannot
      // be used here — it would silently suppress the email for every normal booking.
      if (hoursUntil <= 24 && hoursUntil > 1 && !appt.prep_sms_sent && appt.patient_email && !appt.patient_email.endsWith('@noreply.amise.internal')) {
        const { data: claimedPrep } = await sb()
          .from('appointment_requests')
          .update({ prep_sms_sent: true })
          .eq('id', appt.id)
          .eq('prep_sms_sent', false)  // only update if still unclaimed
          .select('id');
        if (claimedPrep && claimedPrep.length > 0) {
          const draft = await draftReply({ template: 'confirmation', patientFirstName: firstName, bookingDetails: slotDisplay });
          const prepInstructions = getPrepInstructions(appt.appointment_type);
          const prepSection = prepInstructions
            ? `\n\n---\nPREPARATION INSTRUCTIONS\n\n${prepInstructions}\n\nIf you have any questions about your preparation, please call us at ${process.env.PRACTICE_PHONE ?? '+1 758 284 0557'}.`
            : '';
          await sendOrDraft({ to: appt.patient_email, subject: `Reminder: ${draft.subject}`, body: `${draft.body}${prepSection}` }, 'auto');
          await audit({ action: 'remind', entityType: 'appointment_request', entityId: appt.id, payload: { kind: 'email_24h', prep_included: !!prepInstructions } });
          results.push({ id: appt.id, action: 'email_24h_sent' });
        }
      }

    } catch (err) {
      req.log.error({ error: err, appointmentId: appt.id }, '[cron/reminders] failed to process appointment, continuing with remaining');
      results.push({ id: appt.id, action: 'error' });
    }
  }

  // Post-visit follow-up — separate query for appointments 23–25 hours ago.
  // A generic, non-clinical "how are you feeling" check-in; never mentions
  // diagnoses, results, or medication.
  const postVisitStart = new Date(now.getTime() - 25 * 3600_000);
  const postVisitEnd   = new Date(now.getTime() - 23 * 3600_000);

  const { data: pastAppts, error: pastErr } = await sb()
    .from('appointment_requests')
    .select('id, patient_name, patient_phone, reminder_sent_at')
    .in('status', ['staff_confirmed', 'patient_confirmed'])
    .gte('confirmed_slot', postVisitStart.toISOString())
    .lte('confirmed_slot', postVisitEnd.toISOString())
    .not('reminder_sent_at', 'is', null);

  if (pastErr) {
    req.log.error({ error: pastErr }, '[cron/reminders] post-visit query error');
  } else {
    for (const appt of pastAppts || []) {
      try {
        if (appt.patient_phone) {
          const firstName = (appt.patient_name as string || 'there').split(' ')[0];
          const body = smsBodyPostVisit({ firstName });
          const result = await sendSms({ to: appt.patient_phone, body });
          if (result.action === 'sent' || result.action === 'skipped') {
            await audit({ action: 'remind', entityType: 'appointment_request', entityId: appt.id, payload: { kind: 'post_visit_24h' } });
            results.push({ id: appt.id, action: 'post_visit_24h_sent' });
          }
        }
      } catch (err) {
        req.log.error({ error: err, appointmentId: appt.id }, '[cron/reminders] post-visit error');
        results.push({ id: appt.id, action: 'error' });
      }
    }
  }

  res.json({ processed: results.length, results });
});

router.post('/api/cron/daily-summary', async (req, res) => {
  if (!requireCronSecret(req, res)) return;

  const ECT_OFFSET_MS = -4 * 60 * 60_000;
  const nowUtc = Date.now();
  const ectMidnight = new Date(nowUtc + ECT_OFFSET_MS);
  ectMidnight.setUTCHours(0, 0, 0, 0);
  const startOfDay = new Date(ectMidnight.getTime() - ECT_OFFSET_MS);
  const endOfDay   = new Date(startOfDay.getTime() + 86400_000 - 1);
  const dateLabel  = startOfDay.toLocaleDateString('en-LC', { timeZone: 'America/St_Lucia', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  // todayEctDateString: ectMidnight has UTC hours zeroed to represent ECT midnight,
  // so its ISO date part equals today's date in ECT (America/St_Lucia, UTC-4).
  const todayEctDateString = ectMidnight.toISOString().slice(0, 10);

  // Run all queries in parallel
  const [
    { data: appointments },
    { data: escalations },
    { data: pending },
  ] = await Promise.all([
    sb()
      .from('appointment_requests')
      .select('id, patient_name, patient_email, appointment_type, location, confirmed_slot')
      .in('status', ['staff_confirmed', 'patient_confirmed'])
      .gte('confirmed_slot', startOfDay.toISOString())
      .lte('confirmed_slot', endOfDay.toISOString()),
    sb()
      .from('audit_logs')
      .select('action, record_id, created_at')
      .eq('action', 'escalate')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString()),
    sb()
      .from('appointment_requests')
      .select('id')
      .eq('status', 'pending'),
  ]);

  // Fetch today's schedule from Google Calendar (all 3 calendars, all event types)
  let calEvents: Awaited<ReturnType<typeof fetchAllEventsForDate>> = [];
  try {
    calEvents = await fetchAllEventsForDate(todayEctDateString);
  } catch (err) {
    req.log.warn({ err }, '[cron/daily-summary] Google Calendar fetch failed — Supabase data only');
  }

  // Mark any open/in_progress tasks whose due_date has passed as overdue.
  await sb()
    .from('patient_tasks')
    .update({ status: 'overdue' })
    .in('status', ['open', 'in_progress'])
    .lt('due_date', todayEctDateString);

  const { data: overdueTasks } = await sb()
    .from('patient_tasks')
    .select('id, task_type, description, due_date, priority, status')
    .in('status', ['open', 'in_progress', 'overdue'])
    .lte('due_date', todayEctDateString)
    .order('due_date', { ascending: true })
    .limit(20);

  const totalAppts = calEvents.length || (appointments?.length ?? 0);

  const summaryLines: string[] = [
    `Daily Summary — Amise Front Desk AI — ${dateLabel}`,
    '',
    `Appointments today: ${totalAppts}`,
    `Escalations today: ${escalations?.length ?? 0}`,
    `Pending replies: ${pending?.length ?? 0}`,
  ];

  // Google Calendar is the source of truth for the day's schedule
  if (calEvents.length) {
    summaryLines.push('', "Today's schedule (Google Calendar):");
    for (const ev of calEvents) {
      const t = ev.start.includes('T') ? new Date(ev.start) : null;
      const timeStr = t
        ? t.toLocaleTimeString('en-GB', { timeZone: 'America/St_Lucia', hour: '2-digit', minute: '2-digit', hour12: false })
        : 'All day';
      const typeTag = ev.type !== 'clinic' ? ` [${ev.type}]` : '';
      summaryLines.push(`  ${timeStr}${typeTag} — ${ev.summary}`);
    }
  } else if (appointments?.length) {
    // Fallback: Supabase confirmed appointments (Google Calendar unavailable)
    summaryLines.push('', "Today's schedule (intake system):");
    for (const appt of appointments) {
      const t = new Date(appt.confirmed_slot);
      const ectTime = t.toLocaleTimeString('en-GB', { timeZone: 'America/St_Lucia', hour: '2-digit', minute: '2-digit', hour12: false });
      summaryLines.push(`  ${ectTime} — ${appt.patient_name || appt.patient_email} (${appt.appointment_type}) @ ${appt.location}`);
    }
  }

  if (escalations?.length) {
    summaryLines.push('', 'Escalations:');
    for (const esc of escalations) {
      // Omit payload — record_id and action are sufficient for triage
      summaryLines.push(`  [${esc.action}] entity: ${esc.record_id} at ${esc.created_at}`);
    }
  }

  if (overdueTasks?.length) {
    summaryLines.push('', `Overdue / Due Tasks (${overdueTasks.length}):`);
    for (const task of overdueTasks) {
      const priority = (task.priority as string ?? '').toLowerCase();
      const priorityPrefix = (priority === 'urgent' || priority === 'high') ? `[${(task.priority as string).toUpperCase()}] ` : '';
      summaryLines.push(`  ${priorityPrefix}${task.task_type} - ${task.description} (due: ${task.due_date})`);
    }
  }

  const summaryBody = summaryLines.join('\n');

  if (process.env.DOCTOR_NOTIFY_EMAIL) {
    try {
      await sendOrDraft({
        to: process.env.DOCTOR_NOTIFY_EMAIL,
        subject: `Amise Front Desk — Daily Summary ${dateLabel}`,
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

  // Auto-cancel bookings unactioned for > 8 hours — sends apology SMS to patient
  const eightHoursAgo = new Date(now.getTime() - 8 * 3600_000).toISOString();
  const { data: stale, error: staleErr } = await supa
    .from('appointment_requests')
    .select('id, patient_name, patient_phone, patient_email, appointment_type')
    .eq('status', 'pending')
    .lt('created_at', eightHoursAgo);

  if (staleErr) {
    logger.error({ error: staleErr }, '[cron/staff-escalation] stale query error');
  } else {
    for (const booking of stale ?? []) {
      try {
        await supa.from('appointment_requests').update({ status: 'cancelled', notes: 'Auto-cancelled after 8h with no staff action' }).eq('id', booking.id);

        if (booking.patient_phone) {
          const firstName = (booking.patient_name as string || 'there').split(' ')[0];
          await sendSms({
            to: booking.patient_phone,
            body: `Hi ${firstName}, we sincerely apologise -- we were unable to confirm your appointment in time. Please call us at ${process.env.PRACTICE_PHONE ?? '+1 758 284 0557'} or reply to rebook. -- Amise Medical`,
          });
        }

        if (doctorEmail) {
          await sendOrDraft({
            to: doctorEmail,
            subject: `Auto-cancelled: ${booking.patient_name} booking expired after 8h`,
            body: `Booking ${booking.id} for ${booking.patient_name} (${booking.appointment_type}) was auto-cancelled after 8 hours with no staff action.\n\nPatient phone: ${booking.patient_phone ?? 'not provided'}\nPatient email: ${booking.patient_email ?? 'not provided'}\n\nPlease follow up if appropriate.`,
          }, 'auto');
        }

        await audit({ action: 'auto_cancel', entityType: 'appointment_request', entityId: booking.id, payload: { reason: 'unactioned_8h' } });
        results.push({ id: booking.id, action: 'auto_cancelled_8h' });
      } catch (err) {
        logger.error({ error: err, bookingId: booking.id }, '[cron/staff-escalation] auto-cancel error');
        results.push({ id: booking.id, action: 'error' });
      }
    }
  }

  logger.info({ count: results.length }, '[cron/staff-escalation] done');
  res.json({ processed: results.length, results });
});

// POST /api/cron/escalate-results
// Checks for critical investigation_results unacknowledged for >2 h.
// Sends an SMS to the doctor and records an escalation_events row.
// Run every 30 minutes via Render/cron scheduler.
router.post('/api/cron/escalate-results', async (req, res) => {
  if (!requireCronSecret(req, res)) return;

  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const doctorPhone = process.env.STAFF_NOTIFY_PHONE ?? process.env.DOCTOR_NOTIFY_EMAIL ?? null;

  try {
    const supa = getSupabaseAdmin();

    // Find critical results reported >2h ago that are still unacknowledged
    const { data: criticals, error: fetchErr } = await supa
      .from('investigation_results')
      .select('id, patient_id, test_name, test_category, result_value, reported_at')
      .eq('is_critical', true)
      .in('status', ['resulted'])
      .is('acknowledged_at', null)
      .lt('reported_at', cutoff)
      .limit(20);

    if (fetchErr) throw fetchErr;

    const results: { id: string; action: string }[] = [];

    for (const result of criticals ?? []) {
      try {
        // Check if we already escalated this result (avoid duplicate SMS)
        const { data: existing } = await supa
          .from('escalation_events')
          .select('id')
          .eq('entity_type', 'investigation_result')
          .eq('entity_id', result.id)
          .is('resolved_at', null)
          .maybeSingle();

        if (existing) {
          results.push({ id: result.id, action: 'already_escalated' });
          continue;
        }

        const hoursSince = ((Date.now() - new Date(result.reported_at).getTime()) / 3_600_000).toFixed(1);
        const body = `CRITICAL RESULT UNACKNOWLEDGED (${hoursSince}h): ${result.test_name} — ${result.result_value ?? 'see inbox'}. Patient ID ${(result.patient_id as string | null)?.slice(0, 8) ?? 'unknown'}. Please review now in the EMR results inbox.`;

        const smsResult = doctorPhone
          ? await sendSms({ to: doctorPhone, body })
          : { action: 'dry_run' as const };

        await supa.from('escalation_events').insert({
          entity_type: 'investigation_result',
          entity_id: result.id,
          patient_id: result.patient_id ?? null,
          reason: `Critical result unacknowledged for ${hoursSince}h`,
          escalated_via: smsResult.action === 'sent' ? 'sms' : 'dry_run',
          escalated_to: doctorPhone,
        });

        await audit({
          action: 'escalate',
          entityType: 'investigation_result',
          entityId: result.id,
          patientId: result.patient_id ?? undefined,
          payload: { hours_unacknowledged: hoursSince, via: smsResult.action },
        });

        results.push({ id: result.id, action: smsResult.action });
      } catch (err) {
        logger.error({ err, resultId: result.id }, '[cron/escalate-results] per-result error');
        results.push({ id: result.id, action: 'error' });
      }
    }

    logger.info({ count: results.length }, '[cron/escalate-results] done');
    res.json({ processed: results.length, results });
  } catch (err) {
    logger.error({ err }, '[cron/escalate-results] error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
