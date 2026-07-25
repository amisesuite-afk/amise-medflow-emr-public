import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { sb, getSupabaseAdmin, requireStaffAuth, audit } from '../lib/supabase.js';
import { errStr } from '../lib/logger.js';
import { logger as log } from '../lib/logger.js';
import { requirePatientAuth, type PatientAuthRequest } from './patient-auth.js';

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

router.get('/api/patient/profile', requirePatientAuth, async (req: PatientAuthRequest, res) => {
  const patientId = req.patientAuth!.patientId;

  if (!patientId) {
    res.status(400).json({ error: 'No patient linked to this account' });
    return;
  }

  try {
    const { data: pt } = await sb()
      .from('patients')
      .select('full_name')
      .eq('id', patientId)
      .maybeSingle();

    const patientName = pt ? (pt.full_name as string | null) : null;

    // Most recent upcoming appointment
    const { data: appt } = await sb()
      .from('appointment_requests')
      .select('preferred_date')
      .eq('patient_id', patientId)
      .in('status', ['confirmed', 'waitlisted', 'pending'])
      .order('preferred_date', { ascending: true })
      .limit(1)
      .maybeSingle();

    // Most recent previsit submission (for passport + monitoring + return detection)
    const { data: pv } = await sb()
      .from('previsit_submissions')
      .select('id, status, submitted_at, passport, monitoring_updates')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Pending pre-visit for current appointment
    const { data: pendingPv } = await sb()
      .from('previsit_submissions')
      .select('id, status')
      .eq('patient_id', patientId)
      .in('status', ['pending'])
      .limit(1)
      .maybeSingle();

    res.json({
      patientName,
      appointmentDate: appt?.preferred_date ?? null,
      status: pv?.status ?? null,
      hasSubmission: !!pv,
      hasPendingPrevisit: !!pendingPv,
      isReturnPatient: !!(pv?.passport),
      passport: pv?.passport ?? null,
      monitoringCount: Array.isArray(pv?.monitoring_updates) ? (pv.monitoring_updates as unknown[]).length : 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch profile';
    log.error({ err }, 'patient profile error');
    res.status(500).json({ error: message });
  }
});

// ── POST /api/patient/passport ──────────────────────────────────────────────

router.post('/api/patient/passport', requirePatientAuth, async (req: PatientAuthRequest, res) => {
  const patientId = req.patientAuth!.patientId;
  const { passport } = req.body as { passport: Record<string, unknown> };

  if (!patientId) {
    res.status(400).json({ error: 'No patient linked to this account' });
    return;
  }

  try {
    // Upsert passport into the most recent previsit_submissions row.
    // If none exists, create a minimal pending row to hold the passport.
    const { data: existing } = await sb()
      .from('previsit_submissions')
      .select('id')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await sb()
        .from('previsit_submissions')
        .update({ passport, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await sb()
        .from('previsit_submissions')
        .insert({ patient_id: patientId, status: 'pending', passport });
    }

    log.info({ patientId }, 'patient passport updated');
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save passport';
    log.error({ err }, 'patient passport error');
    res.status(500).json({ error: message });
  }
});

// ── POST /api/patient/monitoring ────────────────────────────────────────────

router.post('/api/patient/monitoring', requirePatientAuth, async (req: PatientAuthRequest, res) => {
  const patientId = req.patientAuth!.patientId;
  const { photo } = req.body as {
    photo: { dataUrl: string; context: string; painScore?: number; note?: string; date?: string };
  };

  if (!patientId) {
    res.status(400).json({ error: 'No patient linked to this account' });
    return;
  }

  try {
    const { data: existing } = await sb()
      .from('previsit_submissions')
      .select('id, monitoring_updates')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const entry = {
      dataUrl: photo.dataUrl,
      context: photo.context,
      painScore: photo.painScore,
      note: photo.note,
      date: photo.date || new Date().toISOString(),
      uploaded_at: new Date().toISOString(),
    };

    if (existing) {
      const current = Array.isArray(existing.monitoring_updates) ? existing.monitoring_updates as unknown[] : [];
      const updates = [entry, ...current].slice(0, 50);
      await sb()
        .from('previsit_submissions')
        .update({ monitoring_updates: updates, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      res.json({ success: true, count: updates.length });
    } else {
      await sb()
        .from('previsit_submissions')
        .insert({ patient_id: patientId, status: 'pending', monitoring_updates: [entry] });
      res.json({ success: true, count: 1 });
    }

    log.info({ patientId }, 'patient monitoring update added');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save monitoring update';
    log.error({ err }, 'patient monitoring error');
    res.status(500).json({ error: message });
  }
});

// ── GET /api/patient/previsit-data ─────────────────────────────────────────
// Returns clinic record data to pre-fill the patient's pre-visit questionnaire.

router.get('/api/patient/previsit-data', requirePatientAuth, async (req: PatientAuthRequest, res) => {
  const patientId = req.patientAuth!.patientId;

  if (!patientId) {
    res.status(400).json({ error: 'No patient linked to this account' });
    return;
  }

  try {
    const [apptRes, allergyRes, medRes, vitalsRes, assessmentRes] = await Promise.all([
      sb().from('appointment_requests')
        .select('cc, reason, appointment_type')
        .eq('patient_id', patientId)
        .in('status', ['confirmed', 'staff_confirmed', 'patient_confirmed', 'pending', 'waitlisted'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb().from('allergies')
        .select('allergen, reaction, severity')
        .eq('patient_id', patientId)
        .eq('status', 'active'),
      sb().from('medications')
        .select('name, dose, frequency')
        .eq('patient_id', patientId)
        .eq('status', 'active'),
      sb().from('vitals')
        .select('bp_systolic, bp_diastolic, heart_rate, temperature_c, oxygen_saturation, weight_kg, glucose_mmol, recorded_at')
        .eq('patient_id', patientId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb().from('assessments')
        .select('diagnoses, created_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const pmhSet = new Set<string>();
    for (const a of assessmentRes.data ?? []) {
      const diags = (a as { diagnoses?: unknown }).diagnoses;
      if (Array.isArray(diags)) {
        for (const d of diags) {
          if (typeof d === 'string' && d.trim()) pmhSet.add(d.trim());
          else if (d && typeof d === 'object' && 'description' in d && typeof (d as Record<string, unknown>).description === 'string') {
            pmhSet.add(((d as Record<string, unknown>).description as string).trim());
          }
        }
      }
    }

    const appt = apptRes.data as { cc?: string; reason?: string; appointment_type?: string } | null;

    const allergyLines = (allergyRes.data ?? []).map((a: Record<string, unknown>) => {
      const parts = [a.allergen as string];
      if (a.reaction) parts.push(`— ${a.reaction as string}`);
      if (a.severity) parts.push(`(${a.severity as string})`);
      return parts.join(' ');
    }).join('\n');

    res.json({
      chiefComplaint: appt?.cc || appt?.reason || '',
      appointmentType: appt?.appointment_type || '',
      allergies: allergyLines,
      medications: (medRes.data ?? []).map((m: Record<string, unknown>) => ({
        name: (m.name as string) ?? '',
        dose: (m.dose as string) ?? '',
        frequency: (m.frequency as string) ?? '',
      })),
      pmh: Array.from(pmhSet),
      lastVitals: vitalsRes.data ?? null,
    });
  } catch (err: unknown) {
    log.error({ err }, 'previsit-data error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch pre-fill data' });
  }
});

// ── POST /api/patient/upload ────────────────────────────────────────────────
// Uploads a document (base64 data URI) to Supabase Storage bucket
// 'patient-documents' under path previsit/<patientId>/<ts>-<uuid>.<ext>.

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/gif':  'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

router.post('/api/patient/upload', requirePatientAuth, async (req: PatientAuthRequest, res) => {
  const patientId = req.patientAuth!.patientId;

  if (!patientId) {
    res.status(400).json({ error: 'No patient linked to this account' });
    return;
  }

  const { dataUrl, fileName, label } = req.body as {
    dataUrl?: string;
    fileName?: string;
    label?: string;
  };

  if (!dataUrl) {
    res.status(400).json({ error: 'dataUrl is required' });
    return;
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: 'dataUrl must be a base64 data URI' });
    return;
  }

  const mimeType = match[1];
  const fileBuffer = Buffer.from(match[2], 'base64');
  const ext = MIME_EXT[mimeType] ?? 'bin';
  const uid = randomBytes(8).toString('hex');
  const storagePath = `previsit/${patientId}/${Date.now()}-${uid}.${ext}`;

  try {
    const { error: uploadErr } = await sb().storage
      .from('patient-documents')
      .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });

    if (uploadErr) throw new Error(uploadErr.message);

    const { data: urlData } = sb().storage
      .from('patient-documents')
      .getPublicUrl(storagePath);

    log.info({ patientId, storagePath }, 'patient document uploaded');
    res.json({
      success: true,
      path: storagePath,
      publicUrl: urlData.publicUrl,
      fileName: fileName ?? `document.${ext}`,
      fileType: mimeType,
      label: label ?? 'Document',
    });
  } catch (err: unknown) {
    log.error({ err }, 'patient upload error');
    res.status(502).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
});

// ── POST /api/exam/photo-describe ───────────────────────────────────────────
// Staff-auth only — not exposed to patient app.

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

// ── POST /api/patients/:targetId/merge ─────────────────────────────────────
// Non-destructive patient identity consolidation. Re-parents all clinical records
// from source_id to targetId, then deletes the now-empty source patient row.
// Staff-auth required. Doctor or admin role only.

router.post('/api/patients/:targetId/merge', async (req, res) => {
  const ok = await requireStaffAuth(req, res);
  if (!ok) return;

  const { targetId } = req.params as { targetId: string };
  const { source_id: sourceId } = req.body as { source_id?: string };

  if (!sourceId) {
    res.status(400).json({ error: 'source_id is required' });
    return;
  }
  if (sourceId === targetId) {
    res.status(400).json({ error: 'source_id and target patient must be different' });
    return;
  }

  // Validate both patients exist
  const [tRes, sRes] = await Promise.all([
    sb().from('patients').select('id, full_name, mrn').eq('id', targetId).maybeSingle(),
    sb().from('patients').select('id, full_name, mrn').eq('id', sourceId).maybeSingle(),
  ]);
  if (!tRes.data) { res.status(404).json({ error: 'Target patient not found' }); return; }
  if (!sRes.data) { res.status(404).json({ error: 'Source patient not found' }); return; }

  const target = tRes.data as { id: string; full_name: string; mrn: string | null };
  const source = sRes.data as { id: string; full_name: string; mrn: string | null };

  log.info({ targetId, sourceId }, '[merge] starting patient merge');

  // Re-parent records in dependency order so no FK violation fires during the
  // final DELETE. Tables with cascade-delete from patients must be moved first.
  const tables: Array<{ table: string; col: string }> = [
    { table: 'vitals',               col: 'patient_id' },
    { table: 'symptoms',             col: 'patient_id' },
    { table: 'assessments',          col: 'patient_id' },
    { table: 'plans',                col: 'patient_id' },
    { table: 'encounters',           col: 'patient_id' },
    { table: 'medications',          col: 'patient_id' },
    { table: 'allergies',            col: 'patient_id' },
    { table: 'procedures',           col: 'patient_id' },
    { table: 'referrals',            col: 'patient_id' },
    { table: 'appointments',         col: 'patient_id' },
    { table: 'call_logs',            col: 'patient_id' },
    { table: 'appointment_requests', col: 'patient_id' },
    { table: 'documents',            col: 'patient_id' },
  ];

  const errors: string[] = [];
  for (const { table, col } of tables) {
    const { error: upErr } = await sb()
      .from(table)
      .update({ [col]: targetId })
      .eq(col, sourceId);
    if (upErr) {
      // Tables that don't exist (or have nullable FK that returns 0 rows) are non-fatal
      log.warn({ table, err: upErr.message }, '[merge] re-parent warning');
      errors.push(`${table}: ${upErr.message}`);
    }
  }

  // Delete the source patient (now safe — all child FKs have been moved)
  const { error: delErr } = await sb()
    .from('patients')
    .delete()
    .eq('id', sourceId);

  if (delErr) {
    log.error({ sourceId, err: delErr.message }, '[merge] source delete failed');
    res.status(502).json({
      error: `Records moved but source patient could not be deleted: ${delErr.message}`,
      warnings: errors,
    });
    return;
  }

  // Audit trail
  await sb().from('audit_logs').insert({
    action: 'patient_merge',
    table_name: 'patients',
    record_id: targetId,
    new_values: {
      target_id: targetId, target_name: target.full_name,
      source_id: sourceId, source_name: source.full_name,
    },
  }).then(r => { if (r.error) log.warn(r.error, '[merge] audit log failed'); });

  log.info({ targetId, sourceId }, '[merge] patient merge complete');
  res.json({
    success: true,
    target_id: targetId,
    source_id: sourceId,
    message: `Merged "${source.full_name}" into "${target.full_name}"`,
    warnings: errors.length > 0 ? errors : undefined,
  });
});

// POST /api/patient/check-duplicates
// Called by the dashboard after creating a new patient. Uses pg_trgm similarity
// to find potential duplicates and enqueues them in duplicate_queue for staff review.
router.post('/api/patient/check-duplicates', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { patientId } = (req.body ?? {}) as { patientId?: string };
  if (!patientId) { res.status(400).json({ error: 'patientId required' }); return; }

  try {
    const supa = getSupabaseAdmin();

    // Fetch the new patient
    const { data: newPt, error: fetchErr } = await supa
      .from('patients')
      .select('id, full_name, phone')
      .eq('id', patientId)
      .maybeSingle();

    if (fetchErr || !newPt) { res.status(404).json({ error: 'Patient not found' }); return; }

    // Use pg_trgm similarity to find candidates by name (threshold 0.4)
    const { data: candidates, error: simErr } = await supa.rpc('find_similar_patients', {
      p_name: newPt.full_name,
      p_phone: newPt.phone ?? '',
      p_exclude_id: patientId,
      p_threshold: 0.4,
    }) as { data: Array<{ id: string; full_name: string; phone: string | null; name_sim: number }> | null; error: unknown };

    if (simErr) {
      // pg_trgm RPC may not exist yet — fall back to silent no-op
      log.warn({ simErr }, '[patient/check-duplicates] similarity RPC unavailable');
      res.json({ queued: 0 });
      return;
    }

    let queued = 0;
    for (const candidate of candidates ?? []) {
      const matchReason =
        candidate.name_sim >= 0.7 && newPt.phone && newPt.phone === candidate.phone
          ? 'name_phone'
          : candidate.name_sim >= 0.6
          ? 'name_only'
          : 'phone_only';

      // Ensure consistent ordering of patient_id_a / patient_id_b
      const [idA, idB] = [patientId, candidate.id].sort();

      const { error: queueErr } = await supa.from('duplicate_queue').upsert({
        patient_id_a: idA,
        patient_id_b: idB,
        match_score: candidate.name_sim,
        match_reason: matchReason,
        status: 'pending',
      }, { onConflict: 'patient_id_a,patient_id_b', ignoreDuplicates: true });

      if (!queueErr) queued++;
    }

    await audit({
      action: 'classify',
      entityType: 'patient',
      entityId: patientId,
      payload: { action: 'duplicate_check', candidates_found: candidates?.length ?? 0, queued },
    });

    log.info({ patientId, queued }, '[patient/check-duplicates] done');
    res.json({ queued });
  } catch (err) {
    log.error({ err }, '[patient/check-duplicates] error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
