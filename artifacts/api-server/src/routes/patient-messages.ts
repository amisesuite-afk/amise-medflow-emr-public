/**
 * Patient text message endpoints.
 *
 * POST /api/patient/message  — send a text message to the clinic
 * GET  /api/patient/messages — list the patient's own messages
 *
 * Auth: custom patient JWT via requirePatientAuth (same system as /api/patient/profile)
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { sb } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { requirePatientAuth } from './patient-auth.js';

const router = Router();

// ── POST /api/patient/message ─────────────────────────────────────────────────

router.post(
  '/api/patient/message',
  (req: Request, res: Response, next: NextFunction) => { void requirePatientAuth(req, res, next); },
  async (req: Request, res: Response) => {
    const patientId = req.patientAuth?.patientId ?? null;
    if (!patientId) {
      res.status(401).json({ error: 'No patient linked to this account' });
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
        patient_id: patientId,
        source:     'patient_app',
        direction:  'app_message',
        status:     'voicemail',
        transcript: text.trim(),
        created_at: new Date().toISOString(),
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
  },
);

// ── GET /api/patient/messages ─────────────────────────────────────────────────

router.get(
  '/api/patient/messages',
  (req: Request, res: Response, next: NextFunction) => { void requirePatientAuth(req, res, next); },
  async (req: Request, res: Response) => {
    const patientId = req.patientAuth?.patientId ?? null;
    if (!patientId) {
      res.status(401).json({ error: 'No patient linked to this account' });
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
  },
);

export default router;
