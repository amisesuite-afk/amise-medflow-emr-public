/**
 * Patient text message endpoints.
 *
 * POST /api/patient/message
 *   Accepts a text message from the patient app (JSON { text }),
 *   creates a call_log entry (source='patient_app', direction='app_message'),
 *   and returns the call_log_id. No audio, no storage, no transcription costs.
 *
 * GET /api/patient/messages
 *   Returns the calling patient's own app messages in reverse chronological order.
 *
 * Both routes require patient JWT auth.
 */

import { Router, type Request, type Response } from 'express';
import { sb } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── Patient JWT auth ──────────────────────────────────────────────────────────

async function getPatientId(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const jwt = authHeader.slice(7);
  const { data } = await sb().auth.getUser(jwt);
  if (!data?.user) return null;
  const { data: patient } = await sb()
    .from('patients')
    .select('id')
    .eq('auth_user_id', data.user.id)
    .single();
  return patient?.id ?? null;
}

// ── POST /api/patient/message ─────────────────────────────────────────────────

router.post('/api/patient/message', async (req: Request, res: Response) => {
  const patientId = await getPatientId(req.headers.authorization);
  if (!patientId) {
    res.status(401).json({ error: 'Unauthorised' });
    return;
  }

  const { text } = req.body as { text?: string };
  if (!text?.trim()) {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  const { data: log, error: logErr } = await sb()
    .from('call_logs')
    .insert({
      patient_id:  patientId,
      source:      'patient_app',
      direction:   'app_message',
      status:      'voicemail',
      transcript:  text.trim(),
      created_at:  new Date().toISOString(),
    })
    .select('id')
    .single();

  if (logErr || !log) {
    logger.error({ logErr }, '[patient-messages] insert failed');
    res.status(502).json({ error: logErr?.message ?? 'Insert failed' });
    return;
  }

  const callLogId = (log as { id: string }).id;
  logger.info({ callLogId, patientId, chars: text.trim().length }, '[patient-messages] message received');

  res.json({ call_log_id: callLogId });
});

// ── GET /api/patient/messages ─────────────────────────────────────────────────

router.get('/api/patient/messages', async (req: Request, res: Response) => {
  const patientId = await getPatientId(req.headers.authorization);
  if (!patientId) {
    res.status(401).json({ error: 'Unauthorised' });
    return;
  }

  const { data, error } = await sb()
    .from('call_logs')
    .select('id, created_at, transcript, staff_notes, status')
    .eq('patient_id', patientId)
    .eq('source', 'patient_app')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    logger.warn({ error }, '[patient-messages] list failed');
    res.status(502).json({ error: error.message });
    return;
  }

  res.json(data ?? []);
});

export default router;
