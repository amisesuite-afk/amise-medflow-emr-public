/**
 * Patient voice-note endpoints.
 *
 * POST /api/patient/voice-note
 *   Accepts a recorded audio message from the patient app (multipart/form-data,
 *   field "file"), stores it in Supabase Storage, creates a call_log entry with
 *   source='patient_app', and queues an async Whisper transcription.
 *
 *   Auth: patient JWT (same token used by other /api/patient/* routes)
 *
 *   Fields:
 *     file   — audio blob (webm/ogg/mp4/wav etc.)
 *     note   — optional text annotation from the patient (textarea in the app)
 *
 * GET /api/patient/voice-notes
 *   Returns the calling patient's own app messages in reverse chronological order.
 */

import { Router, type Request, type Response } from 'express';
import multer, { type StorageEngine } from 'multer';
import { sb } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── Multer — 20 MB cap; audio MIME types only ────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage() as StorageEngine,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /audio\//i.test(file.mimetype) || file.mimetype === 'application/octet-stream';
    cb(null, ok);
  },
});

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

// ── Whisper transcription ─────────────────────────────────────────────────────

async function transcribeWithWhisper(
  audioBuffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const formData = new FormData();
    const ext = originalName.split('.').pop() ?? 'webm';
    const ab = audioBuffer.buffer as ArrayBuffer;
    formData.append('file', new Blob([ab], { type: mimeType }), `recording.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!r.ok) {
      logger.warn({ status: r.status }, '[patient-messages] Whisper API error');
      return null;
    }

    const data = await r.json() as { text?: string };
    return data.text?.trim() ?? null;
  } catch (err) {
    logger.warn({ err }, '[patient-messages] Whisper transcription failed (non-fatal)');
    return null;
  }
}

// ── POST /api/patient/voice-note ──────────────────────────────────────────────

router.post(
  '/api/patient/voice-note',
  upload.single('file'),
  async (req: Request, res: Response) => {
    const patientId = await getPatientId(req.headers.authorization);
    if (!patientId) {
      res.status(401).json({ error: 'Unauthorised' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No audio file in field "file"' });
      return;
    }

    const note = ((req.body as Record<string, string>).note ?? '').trim();
    const timestamp = Date.now();
    const ext = req.file.originalname.split('.').pop() ?? 'webm';
    const storageKey = `patient-messages/${patientId}/${timestamp}.${ext}`;

    // 1. Upload to Supabase Storage (call-recordings bucket, patient-messages/ prefix)
    const { data: stored, error: storageErr } = await sb()
      .storage
      .from('call-recordings')
      .upload(storageKey, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (storageErr || !stored) {
      logger.error({ storageErr }, '[patient-messages] storage upload failed');
      res.status(502).json({ error: storageErr?.message ?? 'Storage upload failed' });
      return;
    }

    const { data: { publicUrl } } = sb().storage.from('call-recordings').getPublicUrl(storageKey);

    // 2. Create call_log entry
    const { data: log, error: logErr } = await sb()
      .from('call_logs')
      .insert({
        patient_id:   patientId,
        source:       'patient_app',
        direction:    'app_message',
        status:       'voicemail',
        audio_path:   publicUrl,
        staff_notes:  note || null,
        created_at:   new Date().toISOString(),
      })
      .select('id')
      .single();

    if (logErr || !log) {
      logger.error({ logErr }, '[patient-messages] call_log insert failed');
      res.status(502).json({ error: logErr?.message ?? 'Log insert failed' });
      return;
    }

    const callLogId = (log as { id: string }).id;
    logger.info({ callLogId, patientId }, '[patient-messages] voice note received');

    // Respond immediately
    res.json({ call_log_id: callLogId, audio_url: publicUrl });

    // 3. Transcribe async
    void (async () => {
      const transcript = await transcribeWithWhisper(
        req.file!.buffer,
        req.file!.mimetype,
        req.file!.originalname,
      );
      if (transcript) {
        await sb()
          .from('call_logs')
          .update({ transcript })
          .eq('id', callLogId);
        logger.info({ callLogId, chars: transcript.length }, '[patient-messages] transcript saved');
      }
    })();
  },
);

// ── GET /api/patient/voice-notes ─────────────────────────────────────────────

router.get('/api/patient/voice-notes', async (req: Request, res: Response) => {
  const patientId = await getPatientId(req.headers.authorization);
  if (!patientId) {
    res.status(401).json({ error: 'Unauthorised' });
    return;
  }

  const { data, error } = await sb()
    .from('call_logs')
    .select('id, created_at, duration_s, transcript, staff_notes, status')
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
