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
import { sb, requireStaffAuth } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';

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
  logger.info({ providedLen: provided?.length, providedPrefix: provided?.slice(0, 8), keyPrefix: key.slice(0, 8) }, '[call-recording] key check');
  if (!provided || provided.trim() !== key.trim()) {
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
// Accepts two upload formats:
//   1. multipart/form-data  — fields: file, caller_number, direction, duration_s, device_label, practice_line
//   2. Raw binary body      — Tasker "File To Send"; metadata supplied via X-* headers:
//        X-Caller-Number, X-Direction, X-Duration-S, X-Device-Label, X-Practice-Line, X-Filename

router.post(
  '/api/calls/recording-upload',
  requireUploadKey,
  (req: Request, res: Response, next: NextFunction) => {
    const ct = req.headers['content-type'] ?? '';
    if (ct.includes('multipart/form-data')) {
      upload.single('file')(req, res, next);
    } else {
      next();
    }
  },
  async (req: Request, res: Response) => {
    let fileBuffer: Buffer;
    let mimeType: string;
    let originalName: string;
    let callerNumber: string;
    let direction: string;
    let durationS: string;
    let callAt: string;
    let deviceLabel: string;
    let practiceLine: string;

    if (req.file) {
      // Multipart upload
      fileBuffer   = req.file.buffer;
      mimeType     = req.file.mimetype;
      originalName = req.file.originalname;
      const b      = req.body as Record<string, string>;
      callerNumber = b.caller_number  ?? '';
      direction    = b.direction      ?? 'inbound';
      durationS    = b.duration_s     ?? '';
      callAt       = b.call_at        ?? new Date().toISOString();
      deviceLabel  = b.device_label   ?? '';
      practiceLine = b.practice_line  ?? '';
    } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      // Raw binary upload — Tasker HTTP Request "File To Send"
      fileBuffer   = req.body;
      mimeType     = (req.headers['content-type'] ?? 'application/octet-stream').split(';')[0].trim();
      originalName = (req.headers['x-filename']      as string | undefined) ?? `recording_${Date.now()}.amr`;
      callerNumber = (req.headers['x-caller-number'] as string | undefined) ?? '';
      direction    = (req.headers['x-direction']     as string | undefined) ?? 'inbound';
      durationS    = (req.headers['x-duration-s']    as string | undefined) ?? '';
      callAt       = (req.headers['x-call-at']       as string | undefined) ?? new Date().toISOString();
      deviceLabel  = (req.headers['x-device-label']  as string | undefined) ?? '';
      practiceLine = (req.headers['x-practice-line'] as string | undefined) ?? '';
    } else {
      res.status(400).json({ error: 'No audio file provided.' });
      return;
    }

    const durationSecs = durationS ? parseInt(durationS, 10) : null;

    // 1. Upload to Supabase Storage
    const timestamp  = new Date(callAt).getTime();
    const ext        = originalName.split('.').pop() ?? 'amr';
    const storageKey = `${timestamp}_${normPhone(callerNumber || 'unknown')}.${ext}`;

    const { data: stored, error: storageErr } = await sb()
      .storage
      .from('call-recordings')
      .upload(storageKey, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (storageErr || !stored) {
      logger.error({ storageErr }, '[call-recording] storage upload failed');
      res.status(502).json({ error: storageErr?.message ?? 'Storage upload failed' });
      return;
    }

    const { data: { publicUrl } } = sb().storage.from('call-recordings').getPublicUrl(storageKey);

    // 2. Lookup patient by phone number
    const patientId = callerNumber ? await findPatient(callerNumber) : null;

    // 3. Write call_log immediately (transcription happens async below)
    const { data: log, error: logErr } = await sb()
      .from('call_logs')
      .insert({
        caller_number: callerNumber || null,
        patient_id:    patientId,
        source:        'phone',
        direction:     direction === 'outbound' ? 'outbound' : 'inbound',
        status:        'answered',
        audio_path:    publicUrl,
        duration_s:    durationSecs,
        practice_line: practiceLine || null,
        staff_notes:   deviceLabel ? `Recorded on: ${deviceLabel}` : null,
        created_at:    new Date(callAt).toISOString(),
      })
      .select('id')
      .single();

    if (logErr || !log) {
      logger.error({ logErr }, '[call-recording] call_log insert failed');
      res.status(502).json({ error: logErr?.message ?? 'Log insert failed' });
      return;
    }

    const callLogId = (log as { id: string }).id;
    logger.info({ callLogId, callerNumber, direction, patientId, durationSecs }, '[call-recording] uploaded');

    res.json({ call_log_id: callLogId, audio_url: publicUrl, patient_id: patientId });

    // 4. Transcribe async — update call_log with transcript when done
    void (async () => {
      const transcript = await transcribeWithWhisper(fileBuffer, mimeType, originalName);
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

// ── GET /api/calls/unresolved — staff queue (reviewed_at IS NULL) ─────────────

router.get('/api/calls/unresolved', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  try {
    const limit = Math.min(parseInt((req.query.limit as string) ?? '50', 10) || 50, 200);
    const { data, error } = await sb()
      .from('call_logs')
      .select('id, caller_number, patient_id, direction, source, status, audio_path, duration_s, practice_line, staff_notes, transcript, created_at, reviewed_by, reviewed_at, patients(first_name, last_name)')
      .is('reviewed_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ calls: data ?? [] });
  } catch (err) {
    logger.error({ err }, '[calls/unresolved] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ── GET /api/calls/audit — full log with optional filters ─────────────────────

router.get('/api/calls/audit', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  try {
    const limit       = Math.min(parseInt((req.query.limit as string) ?? '100', 10) || 100, 500);
    const practice    = req.query.practice_line as string | undefined;
    const direction   = req.query.direction     as string | undefined;
    const status      = req.query.status        as string | undefined;
    const from        = req.query.from          as string | undefined;
    const to          = req.query.to            as string | undefined;

    let q = sb()
      .from('call_logs')
      .select('id, caller_number, patient_id, direction, source, status, audio_path, duration_s, practice_line, staff_notes, transcript, created_at, reviewed_by, reviewed_at, patients(first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (practice)  q = q.eq('practice_line', practice);
    if (direction) q = q.eq('direction', direction);
    if (status)    q = q.eq('status', status);
    if (from)      q = q.gte('created_at', from);
    if (to)        q = q.lte('created_at', to);

    const { data, error } = await q;
    if (error) throw error;
    res.json({ calls: data ?? [] });
  } catch (err) {
    logger.error({ err }, '[calls/audit] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ── GET /api/calls/:id/signed-audio-url — signed playback URL ─────────────────

router.get('/api/calls/:id/signed-audio-url', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;
  try {
    const { data: call, error: fetchErr } = await sb()
      .from('call_logs')
      .select('audio_path')
      .eq('id', id)
      .single();
    if (fetchErr || !call?.audio_path) {
      res.status(404).json({ error: 'No audio for this call' });
      return;
    }
    const storageKey = (call.audio_path as string).split('/call-recordings/')[1];
    if (!storageKey) {
      res.status(502).json({ error: 'Invalid audio path format' });
      return;
    }
    const { data, error: signErr } = await sb()
      .storage
      .from('call-recordings')
      .createSignedUrl(storageKey, 3600);
    if (signErr || !data?.signedUrl) {
      res.status(502).json({ error: signErr?.message ?? 'Could not create signed URL' });
      return;
    }
    res.json({ signedUrl: data.signedUrl });
  } catch (err) {
    logger.error({ err }, '[calls/signed-audio-url] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ── POST /api/calls/:id/review — mark a call as reviewed ─────────────────────

router.post('/api/calls/:id/review', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;
  const { notes } = req.body as { notes?: string };

  try {
    let reviewerId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const { data } = await sb().auth.getUser(authHeader.slice(7));
      reviewerId = data?.user?.id ?? null;
    }

    const update: Record<string, unknown> = { reviewed_at: new Date().toISOString() };
    if (reviewerId) update.reviewed_by = reviewerId;
    if (notes !== undefined) update.staff_notes = notes;

    const { error, count } = await sb().from('call_logs').update(update, { count: 'exact' }).eq('id', id);
    if (error) throw error;
    if (!count) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }
    logger.info({ id, reviewerId }, '[calls/review] marked reviewed');
    res.json({ id, reviewed: true });
  } catch (err) {
    logger.error({ err }, '[calls/review] error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
