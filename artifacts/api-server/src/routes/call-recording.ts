/**
 * /api/calls/recording-upload — Android call recorder webhook.
 *
 * Receives audio recordings from Android call-recording apps (Cube ACR, ACR,
 * or a Tasker automation) and logs them to call_logs with Supabase Storage.
 *
 * Authentication: X-Upload-Key header (RECORDING_UPLOAD_KEY env var).
 * This key is pasted once into the Tasker HTTP task on each Android device.
 *
 * Fields accepted (multipart/form-data):
 *   file           — the audio recording (mp3/wav/ogg/aac/amr)
 *   caller_number  — the remote phone number (E.164 or local)
 *   direction      — "inbound" | "outbound"  (default: inbound)
 *   duration_s     — call duration in seconds
 *   call_at        — ISO timestamp of the call start (default: now)
 *   device_label   — label for the device/staff member (e.g. "Front Desk")
 *   practice_line  — which practice number was used, e.g. "Tapion"
 *
 * Transcription:
 *   If OPENAI_API_KEY is set → Whisper API is called (async, never blocks response).
 *   Otherwise recording is stored audio-only; transcript is null until manually added.
 *
 * The Twilio voicemail TwiML also uses transcribe="true" when TWILIO_TRANSCRIPTION=true
 * so that Twilio posts the transcript to /api/calls/transcription-callback.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import multer, { type StorageEngine } from 'multer';
import { sb } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── Auth middleware ───────────────────────────────────────────────────────────

function requireUploadKey(req: Request, res: Response, next: NextFunction): void {
  const key = process.env.RECORDING_UPLOAD_KEY;
  if (!key) {
    // No key configured — open (dev mode only; set key in production)
    logger.warn('[call-recording] RECORDING_UPLOAD_KEY not set — upload endpoint is open');
    next();
    return;
  }
  const provided = req.headers['x-upload-key'] as string | undefined;
  if (!provided || provided !== key) {
    res.status(401).json({ error: 'Invalid upload key' });
    return;
  }
  next();
}

// ── Multer — memory storage, 50 MB limit ─────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage() as StorageEngine,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /audio\//i.test(file.mimetype) || file.mimetype === 'application/octet-stream';
    cb(null, ok);
  },
});

// ── Phone normalisation (duplicated here to keep route self-contained) ────────

function normPhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(-7);
}

// ── Patient lookup by phone ───────────────────────────────────────────────────

async function findPatient(phone: string): Promise<string | null> {
  const norm = normPhone(phone);
  if (norm.length < 7) return null;

  const { data } = await sb()
    .from('patients')
    .select('id, phone')
    .not('phone', 'is', null)
    .ilike('phone', `%${norm.slice(-4)}%`)
    .limit(100);

  const match = (data ?? []).find(
    (p: { id: string; phone: string | null }) => p.phone && normPhone(p.phone) === norm,
  );
  return match?.id ?? null;
}

// ── Whisper transcription (optional) ─────────────────────────────────────────

async function transcribeWithWhisper(
  audioBuffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const formData = new FormData();
    const ext = originalName.split('.').pop() ?? 'mp3';
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
      logger.warn({ status: r.status }, '[call-recording] Whisper API error');
      return null;
    }

    const data = await r.json() as { text?: string };
    return data.text?.trim() ?? null;
  } catch (err) {
    logger.warn({ err }, '[call-recording] Whisper transcription failed (non-fatal)');
    return null;
  }
}

// ── POST /api/calls/recording-upload ─────────────────────────────────────────

router.post(
  '/api/calls/recording-upload',
  requireUploadKey,
  upload.single('file'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No audio file in field "file"' });
      return;
    }

    const {
      caller_number = '',
      direction     = 'inbound',
      duration_s    = '',
      call_at       = new Date().toISOString(),
      device_label  = '',
      practice_line = '',
    } = req.body as Record<string, string>;

    const durationSecs = duration_s ? parseInt(duration_s, 10) : null;

    // 1. Upload to Supabase Storage
    const timestamp = new Date(call_at).getTime();
    const ext       = req.file.originalname.split('.').pop() ?? 'mp3';
    const storageKey = `${timestamp}_${normPhone(caller_number || 'unknown')}.${ext}`;

    const { data: stored, error: storageErr } = await sb()
      .storage
      .from('call-recordings')
      .upload(storageKey, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (storageErr || !stored) {
      logger.error({ storageErr }, '[call-recording] storage upload failed');
      res.status(502).json({ error: storageErr?.message ?? 'Storage upload failed' });
      return;
    }

    // Public URL (signed, not world-public — bucket is private)
    const { data: { publicUrl } } = sb().storage.from('call-recordings').getPublicUrl(storageKey);

    // 2. Lookup patient by phone number
    const patientId = caller_number ? await findPatient(caller_number) : null;

    // 3. Write call_log immediately (transcription happens async below)
    const { data: log, error: logErr } = await sb()
      .from('call_logs')
      .insert({
        caller_number:  caller_number || null,
        patient_id:     patientId,
        source:         'phone',
        direction:      direction === 'outbound' ? 'outbound' : 'inbound',
        status:         direction === 'outbound' ? 'answered' : 'answered',
        audio_path:     publicUrl,
        duration_s:     durationSecs,
        practice_line:  practice_line || null,
        staff_notes:    device_label ? `Recorded on: ${device_label}` : null,
        created_at:     new Date(call_at).toISOString(),
      })
      .select('id')
      .single();

    if (logErr || !log) {
      logger.error({ logErr }, '[call-recording] call_log insert failed');
      res.status(502).json({ error: logErr?.message ?? 'Log insert failed' });
      return;
    }

    const callLogId = (log as { id: string }).id;
    logger.info({ callLogId, caller_number, direction, patientId, duration_s: durationSecs }, '[call-recording] uploaded');

    // Respond immediately — transcription is fire-and-forget
    res.json({ call_log_id: callLogId, audio_url: publicUrl, patient_id: patientId });

    // 4. Transcribe async — update call_log with transcript when done
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
        logger.info({ callLogId, chars: transcript.length }, '[call-recording] transcript saved');
      }
    })();
  },
);

// ── POST /api/calls/transcription-callback ────────────────────────────────────
// Twilio posts here when its own transcription completes (TwiML transcribe="true").
// Set transcriptionCallback="${apiBase}/api/calls/transcription-callback" in TwiML.

router.post('/api/calls/transcription-callback', async (req, res) => {
  res.sendStatus(204);

  const body = req.body as Record<string, string>;
  const { CallSid, TranscriptionText, TranscriptionStatus } = body;

  if (TranscriptionStatus !== 'completed' || !TranscriptionText || !CallSid) return;

  const { error } = await sb()
    .from('call_logs')
    .update({ transcript: TranscriptionText.trim() })
    .eq('twilio_call_sid', CallSid);

  if (error) logger.warn({ error, CallSid }, '[transcription-callback] update failed');
  else logger.info({ CallSid, chars: TranscriptionText.length }, '[transcription-callback] transcript saved');
});

export default router;
