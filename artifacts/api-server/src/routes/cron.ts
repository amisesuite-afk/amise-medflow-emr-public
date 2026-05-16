import { Router } from 'express';
import { sb, audit } from '../lib/supabase.js';
import { sendSms, smsBody48h, smsBody2h } from '../lib/sms.js';
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
        const body = smsBody48h(slotDisplay);
        const result = await sendSms({ to: appt.patient_phone, body });
        if (result.action === 'sent') {
          await sb().from('confirmed_appointments').update({ reminder_48h_sent: true }).eq('id', appt.id);
          await audit({ action: 'remind', entityType: 'appointment', entityId: appt.id, payload: { kind: 'sms_48h' } });
          results.push({ id: appt.id, action: 'sms_48h_sent' });
        }
      }

      if (appt.patient_email && !appt.email_24h_sent && hoursUntil <= 24) {
        const draft = await draftReply({ template: 'confirmation', patientFirstName: appt.patient_first_name, bookingDetails: slotDisplay });
        await sendOrDraft({ to: appt.patient_email, subject: `Reminder: ${draft.subject}`, body: draft.body }, 'auto');
        await sb().from('confirmed_appointments').update({ email_24h_sent: true }).eq('id', appt.id);
        await audit({ action: 'remind', entityType: 'appointment', entityId: appt.id, payload: { kind: 'email_24h' } });
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

export default router;
