import { Router } from 'express';
import { getSupabaseAdmin, requireStaffAuth, audit } from '../lib/supabase.js';
import { sendSms, toE164 } from '../lib/sms.js';
import { logger, errStr } from '../lib/logger.js';

const router = Router();

const VALID_TEMPLATES = ['appointment_reminder', 'result_ready', 'postop_checkin', 'general'] as const;
type Template = typeof VALID_TEMPLATES[number];

const PRACTICE_PHONE = process.env.PRACTICE_LINE_TAPION ?? process.env.PRACTICE_PHONE ?? '+17582840557';

function buildMessage(template: Template, patientName: string, data: Record<string, unknown>): string {
  const first = (patientName.split(' ')[0] ?? patientName).trim();
  const phone  = PRACTICE_PHONE.replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');

  switch (template) {
    case 'appointment_reminder': {
      const day      = (data.day      as string | undefined) ?? '';
      const date     = (data.date     as string | undefined) ?? '';
      const time     = (data.time     as string | undefined) ?? '';
      const location = (data.location as string | undefined) ?? 'the clinic';
      const prep     = (data.prepInstructions as string | undefined) ?? null;
      const base = `Reminder: Hi ${first}, your appointment with Dr Kabiye is ${day} ${date} at ${time}, ${location}. Reply C to confirm or R to reschedule. Amise Medical.`.trim();
      return prep ? `${base}\n\n${prep}` : base;
    }
    case 'result_ready':
      return `Hi ${first}, your results are ready. Please call Amise Medical Services on ${phone} to discuss them with Dr Kabiye.`;
    case 'postop_checkin':
      return `Hi ${first}, we hope your recovery is going well. If you have any concerns after your procedure, please call us on ${phone}. For a medical emergency, call 911 or go to the nearest A&E. -- Amise Medical`;
    case 'general': {
      const msg = ((data.message as string | undefined) ?? '').trim();
      if (!msg) throw new Error('message is required for the general template');
      return msg;
    }
  }
}

// POST /api/notify/:patientId
router.post('/api/notify/:patientId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { patientId } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const template = body.template as string | undefined;
  if (!template || !VALID_TEMPLATES.includes(template as Template)) {
    res.status(400).json({ error: `template must be one of: ${VALID_TEMPLATES.join(', ')}` });
    return;
  }

  // Prefer an explicit `data` sub-object; fall back to only known template keys in body
  // (avoids accidentally reading `template` or `patientId` keys as template data)
  const data = (body.data as Record<string, unknown> | undefined) ?? {};

  try {
    const supa = getSupabaseAdmin();

    const { data: patient, error: patErr } = await supa
      .from('patients')
      .select('full_name, phone')
      .eq('id', patientId)
      .maybeSingle();

    if (patErr || !patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    const p = patient as { full_name: string | null; phone: string | null };
    const phone = p.phone?.trim();
    if (!phone) {
      res.status(422).json({ error: 'Patient has no phone number on record' });
      return;
    }

    const name = p.full_name ?? 'Patient';
    let message: string;
    try {
      message = buildMessage(template as Template, name, data);
    } catch (buildErr) {
      res.status(400).json({ error: errStr(buildErr) });
      return;
    }

    const result = await sendSms({ to: toE164(phone), body: message });

    await audit({
      action: 'notify', entityType: 'patient', entityId: patientId,
      payload: { template, channel: result.channel ?? null, action: result.action },
    });

    logger.info({ patientId, template, action: result.action, channel: result.channel }, '[notify/send] sms sent');
    res.json({ action: result.action, channel: result.channel ?? null, template });
  } catch (err) {
    logger.error({ err }, '[notify/send] error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
