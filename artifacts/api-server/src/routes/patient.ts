import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { sb, requireStaffAuth } from '../lib/supabase.js';
import { logger as log } from '../lib/logger.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const PHOTO_DESCRIBE_PROMPT = `You are a surgical clinical photographer's assistant documenting a clinical photograph for inclusion in a surgical case record.

Describe the clinical photograph using standard medical terminology. Be concise and factual. Cover:
- Anatomical site and laterality
- Size/dimensions (estimate if possible — e.g. "approximately 3 × 2 cm")
- Morphology (shape, borders, surface characteristics)
- Colour (erythema, ecchymosis, jaundice, cyanosis, necrosis, pigmentation)
- Surrounding tissue condition (oedema, induration, warmth, cellulitis, skin changes)
- Any wound characteristics if applicable (granulation tissue, slough, exudate, depth, margins)
- Relevant clinical features (visible structures, sinuses, fistulae, foreign material)

Do NOT diagnose or suggest a diagnosis. Do NOT use first person. Write as a single clinical paragraph. Use British medical English.

Example: "A 4 × 3 cm erythematous, indurated swelling over the right groin. The overlying skin is intact with no ulceration. There is surrounding oedema extending to the right hemiscrotum. A 1 cm central area of fluctuance is present. No visible discharge or sinus formation."`;

// ── GET /api/patient/profile ────────────────────────────────────────────────
// Token-based: patient retrieves their own profile + upcoming appointment info.
router.get('/api/patient/profile', async (req, res) => {
  const token = req.query.token as string | undefined;
  if (!token) {
    res.status(400).json({ error: 'token is required' });
    return;
  }

  try {
    const { data, error } = await sb()
      .from('previsit_submissions')
      .select('patient_id, status, submitted_at, passport, monitoring_updates')
      .eq('patient_token', token)
      .maybeSingle();

    if (error) {
      log.error({ err: error }, 'patient profile fetch error');
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: 'Invalid or expired token' });
      return;
    }

    // Pull patient name from patients table if linked
    let patientName: string | null = null;
    let appointmentDate: string | null = null;

    if (data.patient_id) {
      const { data: pt } = await sb()
        .from('patients')
        .select('first_name, last_name')
        .eq('id', data.patient_id)
        .maybeSingle();
      if (pt) patientName = [pt.first_name, pt.last_name].filter(Boolean).join(' ') || null;

      // Most recent upcoming appointment
      const { data: appt } = await sb()
        .from('appointment_requests')
        .select('preferred_date, slot_time')
        .eq('patient_id', data.patient_id)
        .in('status', ['confirmed', 'waitlisted', 'pending'])
        .order('preferred_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (appt?.preferred_date) appointmentDate = appt.preferred_date;
    }

    res.json({
      patientName,
      appointmentDate,
      status: data.status,
      hasSubmission: data.status !== null,
      passport: data.passport ?? null,
      monitoringCount: Array.isArray(data.monitoring_updates) ? data.monitoring_updates.length : 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch profile';
    log.error({ err }, 'patient profile error');
    res.status(500).json({ error: message });
  }
});

// ── POST /api/patient/passport ──────────────────────────────────────────────
// Patient updates their medical passport (persisted in previsit_submissions.passport).
router.post('/api/patient/passport', async (req, res) => {
  const { patient_token, passport } = req.body as {
    patient_token: string;
    passport: Record<string, unknown>;
  };

  if (!patient_token) {
    res.status(400).json({ error: 'patient_token is required' });
    return;
  }

  try {
    const { data: existing, error: findErr } = await sb()
      .from('previsit_submissions')
      .select('id')
      .eq('patient_token', patient_token)
      .maybeSingle();

    if (findErr) {
      res.status(500).json({ error: findErr.message });
      return;
    }
    if (!existing) {
      res.status(404).json({ error: 'Invalid or expired token' });
      return;
    }

    const { error: updateErr } = await sb()
      .from('previsit_submissions')
      .update({ passport, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (updateErr) {
      res.status(500).json({ error: updateErr.message });
      return;
    }

    log.info({ id: existing.id }, 'patient passport updated');
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save passport';
    log.error({ err }, 'patient passport error');
    res.status(500).json({ error: message });
  }
});

// ── POST /api/patient/monitoring ────────────────────────────────────────────
// Patient adds a monitoring update (wound photo, vitals diary entry, symptom note).
router.post('/api/patient/monitoring', async (req, res) => {
  const { patient_token, photo } = req.body as {
    patient_token: string;
    photo: { dataUrl: string; context: string; painScore?: number; note?: string; date?: string };
  };

  if (!patient_token) {
    res.status(400).json({ error: 'patient_token is required' });
    return;
  }

  try {
    const { data: existing, error: findErr } = await sb()
      .from('previsit_submissions')
      .select('id, monitoring_updates')
      .eq('patient_token', patient_token)
      .maybeSingle();

    if (findErr) {
      res.status(500).json({ error: findErr.message });
      return;
    }
    if (!existing) {
      res.status(404).json({ error: 'Invalid or expired token' });
      return;
    }

    const entry = {
      dataUrl: photo.dataUrl,
      context: photo.context,
      painScore: photo.painScore,
      note: photo.note,
      date: photo.date || new Date().toISOString(),
      uploaded_at: new Date().toISOString(),
    };

    const current = Array.isArray(existing.monitoring_updates) ? existing.monitoring_updates : [];
    const updates = [entry, ...current].slice(0, 50); // cap at 50 entries

    const { error: updateErr } = await sb()
      .from('previsit_submissions')
      .update({ monitoring_updates: updates, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (updateErr) {
      res.status(500).json({ error: updateErr.message });
      return;
    }

    log.info({ id: existing.id }, 'patient monitoring update added');
    res.json({ success: true, count: updates.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save monitoring update';
    log.error({ err }, 'patient monitoring error');
    res.status(500).json({ error: message });
  }
});

// ── POST /api/exam/photo-describe ───────────────────────────────────────────
// Staff auth. Sends a clinical photograph to Claude vision and returns a
// medical-terminology description suitable for documentation.
router.post('/api/exam/photo-describe', async (req, res) => {
  const ok = await requireStaffAuth(req, res);
  if (!ok) return;

  const { imageDataUrl, context } = req.body as {
    imageDataUrl: string;
    context?: string;
  };

  if (!imageDataUrl) {
    res.status(400).json({ error: 'imageDataUrl is required' });
    return;
  }

  // Strip data: URI prefix to get raw base64
  const match = imageDataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: 'imageDataUrl must be a base64 data URI' });
    return;
  }
  const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  const base64 = match[2];

  const contextNote = context ? `\n\nClinical context provided by the clinician: ${context}` : '';

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `${PHOTO_DESCRIBE_PROMPT}${contextNote}\n\nWrite the description now:`,
            },
          ],
        },
      ],
    });

    const description = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim();

    log.info('exam photo described by AI');
    res.json({ description });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI photo description failed';
    log.error({ err }, 'exam photo describe error');
    res.status(500).json({ error: message });
  }
});

export default router;
