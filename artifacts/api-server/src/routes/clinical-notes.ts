import { Router } from 'express';
import { getSupabaseAdmin, audit, requireStaffAuth, getStaffUserId } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';

const router = Router();

const VALID_NOTE_TYPES = ['soap', 'progress', 'operative', 'procedure', 'discharge', 'consultation', 'referral_letter', 'other'];
const VALID_STATUSES   = ['draft', 'signed', 'amended', 'addendum'];

// POST /api/clinical-notes
router.post('/api/clinical-notes', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const body = (req.body ?? {}) as Record<string, unknown>;

  if (!(body.patientId as string)?.trim()) {
    res.status(400).json({ error: 'patientId is required' }); return;
  }
  if (!(body.content as string)?.trim()) {
    res.status(400).json({ error: 'content is required' }); return;
  }

  const noteType = (body.noteType as string) ?? 'other';
  if (!VALID_NOTE_TYPES.includes(noteType)) {
    res.status(400).json({ error: `noteType must be one of: ${VALID_NOTE_TYPES.join(', ')}` });
    return;
  }

  try {
    const supa = getSupabaseAdmin();
    const createdBy = await getStaffUserId(req);

    const { data: row, error: insertErr } = await supa
      .from('clinical_notes')
      .insert({
        patient_id:    body.patientId,
        encounter_id:  (body.encounterId as string) ?? null,
        note_type:     noteType,
        status:        'draft',
        content:       body.content,
        content_html:  (body.contentHtml as string) ?? null,
        ai_assisted:   Boolean(body.aiAssisted),
        ai_model_used: (body.aiModelUsed as string) ?? null,
        created_by:    createdBy ?? null,
        updated_by:    createdBy ?? null,
      })
      .select('id, note_type, status, content, signed_by, signed_at, ai_assisted, created_at')
      .single();

    if (insertErr) throw insertErr;

    await audit({
      action: 'change_request', entityType: 'clinical_note', entityId: row.id,
      payload: { noteType, aiAssisted: body.aiAssisted },
    });

    logger.info({ id: row.id, noteType }, '[clinical-notes/create] created');
    res.status(201).json({ note: row });
  } catch (err) {
    logger.error({ err }, '[clinical-notes/create] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// GET /api/clinical-notes/patient/:patientId
router.get('/api/clinical-notes/patient/:patientId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { patientId } = req.params;
  const encounterId = req.query.encounterId as string | undefined;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);

  try {
    let query = getSupabaseAdmin()
      .from('clinical_notes')
      .select('id, encounter_id, note_type, status, content, signed_by, signed_at, ai_assisted, created_at')
      .eq('patient_id', patientId)
      .not('content', 'like', '[HPI]%')
      .not('content', 'like', '[EXAMINATION%')
      .not('content', 'like', '[AI_CONSULT%')
      .not('content', 'like', '[DISCHARGE%')
      .not('content', 'like', '[INPATIENT%')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (encounterId) query = query.eq('encounter_id', encounterId);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ notes: data ?? [] });
  } catch (err) {
    logger.error({ err }, '[clinical-notes/list] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// PATCH /api/clinical-notes/:id
router.patch('/api/clinical-notes/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;

  if (body.status && !VALID_STATUSES.includes(body.status as string)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  try {
    const supa = getSupabaseAdmin();
    const { data: existing, error: fetchErr } = await supa
      .from('clinical_notes').select('id, patient_id, status').eq('id', id).maybeSingle();
    if (fetchErr || !existing) { res.status(404).json({ error: 'Clinical note not found' }); return; }

    const staffId = await getStaffUserId(req);
    const patch: Record<string, unknown> = { updated_by: staffId };

    if (body.content !== undefined)     patch.content      = body.content;
    if (body.contentHtml !== undefined) patch.content_html = body.contentHtml;
    if (body.status) {
      patch.status = body.status;
      if (body.status === 'signed') {
        patch.signed_by = staffId ?? null;
        patch.signed_at = new Date().toISOString();
      }
    }

    const { error: updateErr } = await supa.from('clinical_notes').update(patch).eq('id', id);
    if (updateErr) throw updateErr;

    await audit({
      action: 'change_request', entityType: 'clinical_note', entityId: id,
      payload: { status: body.status, staffId },
    });

    logger.info({ id, status: body.status }, '[clinical-notes/patch] updated');
    res.json({ id, ...patch });
  } catch (err) {
    logger.error({ err }, '[clinical-notes/patch] error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
