/**
 * Endoscopy image capture bridge
 *
 * Allows external endoscopy/capture software (MediView, Pentax, Olympus, etc.)
 * to push images to the API server, which the dashboard then fetches into the
 * active session image panel.
 *
 * UPLOAD (from capture software):
 *   POST /api/endoscopy-capture/upload
 *   Content-Type: multipart/form-data
 *   Auth: X-Upload-Key: <CRON_SECRET>  (paste once in capture software config)
 *
 *   Fields:
 *     files[]         — one or more image files (JPEG/PNG recommended)
 *     nhi             — patient NHI number (optional — falls back to "unassigned")
 *     procedure_type  — ogd | colonoscopy | ercp | bronch | surgical (optional)
 *     station_id      — capture station label (optional, e.g. "Endoscopy Suite 1")
 *
 * FETCH (from dashboard):
 *   GET /api/endoscopy-capture/pending?nhi=&type=
 *   Auth: Bearer <supabase-jwt>
 *   Returns: { images: [{ dataUrl, mimeType, timestamp, stationId }] }
 *
 * CLEAR (from dashboard after fetch):
 *   DELETE /api/endoscopy-capture/pending?nhi=&type=
 *   Auth: Bearer <supabase-jwt>
 *
 * Images are held in memory for 60 minutes then discarded automatically.
 * The in-memory store is per-process; for multi-instance deployments switch
 * to Supabase Storage and set a short-lived signed URL.
 */

import { Router, type Request, type Response } from 'express';
import multer, { type StorageEngine } from 'multer';
import { requireStaffAuth } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── In-memory capture store ────────────────────────────────────────────────

interface CapturedImage {
  dataUrl: string;
  mimeType: string;
  timestamp: string;
  stationId: string;
  expiresAt: number; // Date.now() + 60 min
}

// Keyed by `${nhi}:${procedureType}` e.g. "SL123456:colonoscopy" or "unassigned:ogd"
const captureStore = new Map<string, CapturedImage[]>();

function pruneExpired() {
  const now = Date.now();
  for (const [key, images] of captureStore.entries()) {
    const live = images.filter(img => img.expiresAt > now);
    if (live.length === 0) captureStore.delete(key);
    else captureStore.set(key, live);
  }
}

// Run cleanup every 5 minutes
setInterval(pruneExpired, 5 * 60 * 1000);

function storeKey(nhi: string, type: string): string {
  const n = (nhi || 'unassigned').toUpperCase().replace(/\s+/g, '');
  const t = (type || 'unassigned').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${n}:${t}`;
}

// ── Multer (memory storage) ────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage() as StorageEngine,
  limits: { fileSize: 20 * 1024 * 1024, files: 50 }, // 20 MB per image, 50 frames max
  fileFilter(_req, file, cb) {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

// ── Auth helper for capture software ──────────────────────────────────────

function checkUploadKey(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const key = req.headers['x-upload-key'] as string | undefined;
  return Boolean(cronSecret && key === cronSecret);
}

// ── POST /api/endoscopy-capture/upload ────────────────────────────────────

router.post(
  '/api/endoscopy-capture/upload',
  upload.array('files[]', 50),
  (req: Request, res: Response) => {
    if (!checkUploadKey(req)) {
      res.status(401).json({ error: 'Unauthorised — provide X-Upload-Key' });
      return;
    }

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No image files received' });
      return;
    }

    const nhi          = (req.body as Record<string, string>).nhi || '';
    const procedureType = (req.body as Record<string, string>).procedure_type || '';
    const stationId    = (req.body as Record<string, string>).station_id || 'Capture station';
    const key          = storeKey(nhi, procedureType);
    const expiresAt    = Date.now() + 60 * 60 * 1000; // 60 min

    const incoming: CapturedImage[] = files.map(f => ({
      dataUrl: `data:${f.mimetype};base64,${f.buffer.toString('base64')}`,
      mimeType: f.mimetype,
      timestamp: new Date().toISOString(),
      stationId,
      expiresAt,
    }));

    const existing = captureStore.get(key) ?? [];
    captureStore.set(key, [...existing, ...incoming]);

    logger.info({ key, count: incoming.length }, 'endoscopy-capture: images received');
    res.json({ success: true, key, count: incoming.length, total: existing.length + incoming.length });
  },
);

// ── GET /api/endoscopy-capture/pending ────────────────────────────────────

router.get('/api/endoscopy-capture/pending', requireStaffAuth, (req: Request, res: Response) => {
  const nhi  = (req.query as Record<string, string>).nhi || '';
  const type = (req.query as Record<string, string>).type || '';
  pruneExpired();

  // Collect from the specific NHI bucket + the unassigned bucket for this type
  const keys = [storeKey(nhi, type), storeKey('unassigned', type)];
  const all: CapturedImage[] = [];
  for (const k of keys) {
    const imgs = captureStore.get(k);
    if (imgs) all.push(...imgs);
  }

  res.json({ images: all.map(({ dataUrl, mimeType, timestamp, stationId }) => ({ dataUrl, mimeType, timestamp, stationId })), count: all.length });
});

// ── DELETE /api/endoscopy-capture/pending ─────────────────────────────────

router.delete('/api/endoscopy-capture/pending', requireStaffAuth, (req: Request, res: Response) => {
  const nhi  = (req.query as Record<string, string>).nhi || '';
  const type = (req.query as Record<string, string>).type || '';

  const keys = [storeKey(nhi, type), storeKey('unassigned', type)];
  let cleared = 0;
  for (const k of keys) {
    const imgs = captureStore.get(k);
    if (imgs) { cleared += imgs.length; captureStore.delete(k); }
  }

  res.json({ success: true, cleared });
});

// ── GET /api/endoscopy-capture/queue-status ───────────────────────────────
// Simple health check so capture software can confirm connectivity

router.get('/api/endoscopy-capture/queue-status', (req: Request, res: Response) => {
  if (!checkUploadKey(req)) {
    res.status(401).json({ error: 'Unauthorised' });
    return;
  }
  pruneExpired();
  const summary: Record<string, number> = {};
  for (const [k, v] of captureStore.entries()) summary[k] = v.length;
  res.json({ status: 'ok', queues: summary });
});

export default router;
