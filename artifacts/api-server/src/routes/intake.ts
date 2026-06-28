import { Router } from 'express';
import { sb, upsertPatient, audit, requireCronSecret } from '../lib/supabase.js';
import { errStr } from '../lib/logger.js';
import { listUnreadMessages, getMessage, markRead, sendOrDraft } from '../lib/gmail.js';
import { classifyMessage, draftReply } from '../lib/claude.js';
import { triage } from '../lib/triage-logic.js';
import { findSlots, createEvent, formatSlotForDisplay } from '../lib/calendar.js';
import { logger } from '../lib/logger.js';

const router = Router();

router.post('/api/intake/run', async (req, res) => {
  if (!requireCronSecret(req, res)) return;

  const mode = (req.body?.mode as string) || process.env.MODE || 'dry_run';
  // In auto mode, downgrade to supervised for patient-facing communications
  // so a human always reviews outbound messages before they reach patients.
  const intakeMode = (mode === 'auto' ? 'supervised' : mode) as 'dry_run' | 'supervised' | 'auto';
  const maxMessages = Number(req.body?.max_messages ?? 10);

  req.log.info({ mode, maxMessages }, '[intake] starting run');

  const results: { id: string; action: string; reason?: string }[] = [];

  let messageIds: string[];
  try {
    messageIds = await listUnreadMessages(maxMessages);
  } catch (err) {
    req.log.error({ err }, '[intake] failed to list messages');
    res.status(502).json({ error: 'Failed to fetch messages from Gmail' });
    return;
  }

  for (const id of messageIds) {
    try {
      const msg = await getMessage(id);
      const classification = await classifyMessage(msg.body, msg.subject);

      await audit({
        action: 'classify',
        entityType: 'gmail_message',
        entityId: id,
        payload: { category: classification.category, confidence: classification.confidence },
      });

      const triageResult = triage(msg.body, msg.subject, classification);

      if (triageResult.recommendedAction === 'escalate_urgent' || triageResult.recommendedAction === 'escalate_priority' || triageResult.recommendedAction === 'escalate_review') {
        const ack = await draftReply({ template: 'urgent_ack', patientFirstName: classification.patient_first_name });
        await sendOrDraft({ to: msg.from, subject: ack.subject, body: ack.body, threadId: msg.threadId }, intakeMode);

        if (process.env.DOCTOR_NOTIFY_EMAIL) {
          await sendOrDraft({
            to: process.env.DOCTOR_NOTIFY_EMAIL,
            subject: `[ESCALATE ${triageResult.severity?.toUpperCase()}] ${msg.from} — ${msg.subject}`,
            body: `Reasons: ${triageResult.reasons.join('; ')}\n\nOriginal message:\n${msg.body}`,
          }, 'auto');
        }

        await audit({ action: 'escalate', entityType: 'gmail_message', entityId: id, payload: { severity: triageResult.severity, reasons: triageResult.reasons } });
        results.push({ id, action: `escalated_${triageResult.severity}`, reason: triageResult.reasons[0] });
        await markRead(id);
        continue;
      }

      if (classification.category === 'admin' && triageResult.recommendedAction !== 'draft_supervised') {
        const baseUrl = process.env.FRONTEND_URL || 'https://front-desk-amisesuite-afks-projects.vercel.app';
        const reply = await draftReply({
          template: 'general_enquiry',
          patientFirstName: classification.patient_first_name,
          triageFormUrl: `${baseUrl}/patient/request`,
        });

        if (!reply.safe) {
          req.log.warn({ violations: reply.violations }, '[intake] unsafe general-enquiry draft — saving to review queue');
          await audit({ action: 'skip', entityType: 'gmail_message', entityId: id, payload: { violations: reply.violations } });
          results.push({ id, action: 'skipped_unsafe', reason: 'Forbidden content in draft' });
          await markRead(id);
          continue;
        }

        await sendOrDraft({ to: msg.from, subject: reply.subject, body: reply.body, threadId: msg.threadId }, intakeMode);
        await audit({ action: 'send', entityType: 'gmail_message', entityId: id, payload: { reason: 'general_enquiry' } });
        results.push({ id, action: 'auto_replied_general_enquiry' });
        await markRead(id);
        continue;
      }

      if (triageResult.recommendedAction === 'draft_supervised' || !triageResult.appointmentType) {
        const reply = await draftReply({ template: 'out_of_scope', patientFirstName: classification.patient_first_name });
        await sendOrDraft({ to: msg.from, subject: reply.subject, body: reply.body, threadId: msg.threadId }, 'supervised');
        await audit({ action: 'draft', entityType: 'gmail_message', entityId: id, payload: { reason: 'out_of_scope' } });
        results.push({ id, action: 'drafted_supervised', reason: 'Low confidence or out of scope' });
        await markRead(id);
        continue;
      }

      const patientId = await upsertPatient({ email: msg.from, firstName: classification.patient_first_name });
      const slots = await findSlots(triageResult.appointmentType!, { max: 3 });

      if (!slots.length) {
        const reply = await draftReply({ template: 'out_of_scope', patientFirstName: classification.patient_first_name });
        await sendOrDraft({ to: msg.from, subject: 'Re: ' + msg.subject, body: reply.body, threadId: msg.threadId }, 'supervised');
        results.push({ id, action: 'no_slots_found' });
        await markRead(id);
        continue;
      }

      const slotDisplay = slots.map(formatSlotForDisplay);
      const reply = await draftReply({ template: 'slot_offer', patientFirstName: classification.patient_first_name, slots: slotDisplay });

      if (!reply.safe) {
        req.log.warn({ violations: reply.violations }, '[intake] unsafe draft — saving to review queue');
        await audit({ action: 'skip', entityType: 'gmail_message', entityId: id, payload: { violations: reply.violations } });
        results.push({ id, action: 'skipped_unsafe', reason: 'Forbidden content in draft' });
        continue;
      }

      const sendResult = await sendOrDraft({ to: msg.from, subject: reply.subject, body: reply.body, threadId: msg.threadId }, intakeMode);

      await sb().from('pending_bookings').insert({
        patient_id: patientId,
        patient_email: msg.from,
        appointment_type: triageResult.appointmentType,
        slots_offered: slotDisplay,
        gmail_thread_id: msg.threadId,
        gmail_message_id: id,
        status: 'awaiting_reply',
      });

      await audit({ action: 'send', entityType: 'gmail_message', entityId: id, payload: { action: sendResult.action, gmailId: sendResult.gmailId } });
      results.push({ id, action: sendResult.action });
      await markRead(id);
    } catch (err) {
      req.log.error({ err, messageId: id }, '[intake] error processing message');
      await audit({ action: 'error', entityType: 'gmail_message', entityId: id, payload: { error: errStr(err) } });
      results.push({ id, action: 'error', reason: errStr(err) });
    }
  }

  res.json({ processed: results.length, results });
});

export default router;
