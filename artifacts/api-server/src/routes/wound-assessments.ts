import { Router } from 'express';
import { getSupabaseAdmin, audit, requireStaffAuth, getStaffUserId } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';

const router = Router();

const VALID_STATUSES  = ['healing','closed','superficial_ssi','deep_ssi','dehiscence','seroma','haematoma','necrosis'];
const VALID_CLASSES   = ['clean','clean_contaminated','contaminated','dirty'];
const VALID_CLOSURES  = ['primary','secondary','delayed_primary','vac','open'];
const VALID_DRAINS    = ['none','in_situ','removed'];

// POST /api/wound-assessments -- create
router.post('/api/wound-assessments', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const {
    patientId, encounterId, label, location, woundClass, closure,
    status, dressing, drain, drainOutputMl, asepsisScore, asepsisDetails,
    notes, assessedDate,
  } = (req.body ?? {}) as Record<string, unknown>;

  if (!patientId) { res.status(400).json({ error: 'patientId is required' }); return; }
  if (!(label as string)?.trim()) { res.status(400).json({ error: 'label is required' }); return; }
  if (!assessedDate) { res.status(400).json({ error: 'assessedDate is required' }); return; }

  const resolvedStatus = (status as string) ?? 'healing';
  if (!VALID_STATUSES.includes(resolvedStatus)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  try {
    const supa = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: row, error: insertErr } = await supa
      .from('wound_assessments')
      .insert({
        patient_id:      patientId,
        encounter_id:    (encounterId as string) ?? null,
        label:           (label as string).trim(),
        location:        (location as string) ?? null,
        wound_class:     woundClass && VALID_CLASSES.includes(woundClass as string) ? woundClass : null,
        closure:         closure && VALID_CLOSURES.includes(closure as string) ? closure : null,
        status:          resolvedStatus,
        dressing:        (dressing as string) ?? null,
        drain:           VALID_DRAINS.includes(drain as string) ? (drain as string) : 'none',
        drain_output_ml: drainOutputMl != null ? Number(drainOutputMl) : null,
        asepsis_score:   Number(asepsisScore) || 0,
        asepsis_details: (asepsisDetails as Record<string, unknown>) ?? {},
        notes:           (notes as string) ?? null,
        assessed_date:   assessedDate,
        updated_at:      now,
      })
      .select('id, patient_id, encounter_id, label, location, wound_class, closure, status, dressing, drain, drain_output_ml, asepsis_score, asepsis_details, notes, assessed_date, created_at')
      .single();

    if (insertErr) throw insertErr;

    await audit({
      action: 'change_request', entityType: 'wound_assessment', entityId: row.id,
      patientId: patientId as string,
      payload: { label, status: resolvedStatus, asepsis_score: asepsisScore },
    });

    logger.info({ id: row.id, patientId, status: resolvedStatus }, '[wound-assessments/create] created');
    res.status(201).json({ wound: row });
  } catch (err) {
    logger.error({ err }, '[wound-assessments/create] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// GET /api/wound-assessments/patient/:patientId -- list
router.get('/api/wound-assessments/patient/:patientId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { patientId } = req.params;
  const encounterId = req.query.encounterId as string | undefined;

  try {
    let query = getSupabaseAdmin()
      .from('wound_assessments')
      .select('id, patient_id, encounter_id, label, location, wound_class, closure, status, dressing, drain, drain_output_ml, asepsis_score, asepsis_details, notes, assessed_date, created_at')
      .eq('patient_id', patientId)
      .is('deleted_at', null)
      .order('assessed_date', { ascending: false });

    if (encounterId) query = query.eq('encounter_id', encounterId);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ wounds: data ?? [] });
  } catch (err) {
    logger.error({ err }, '[wound-assessments/list] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// PATCH /api/wound-assessments/:id -- update
router.patch('/api/wound-assessments/:id', async (req, res) => {
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
      .from('wound_assessments')
      .select('id, patient_id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchErr || !existing) { res.status(404).json({ error: 'Wound assessment not found' }); return; }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const fields: (keyof typeof body)[] = ['label','location','woundClass','closure','status','dressing','drain','drainOutputMl','asepsisScore','asepsisDetails','notes','assessedDate'];
    const dbMap: Record<string, string> = {
      woundClass: 'wound_class', drainOutputMl: 'drain_output_ml',
      asepsisScore: 'asepsis_score', asepsisDetails: 'asepsis_details',
      assessedDate: 'assessed_date',
    };
    for (const k of fields) {
      if (body[k] !== undefined) patch[dbMap[k as string] ?? k] = body[k];
    }

    const { error: updateErr } = await supa.from('wound_assessments').update(patch).eq('id', id);
    if (updateErr) throw updateErr;

    await audit({
      action: 'change_request', entityType: 'wound_assessment', entityId: id,
      patientId: existing.patient_id ?? undefined,
      payload: { status: body.status ?? 'unchanged' },
    });

    logger.info({ id }, '[wound-assessments/patch] updated');
    res.json({ id });
  } catch (err) {
    logger.error({ err }, '[wound-assessments/patch] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// DELETE /api/wound-assessments/:id -- soft-delete
router.delete('/api/wound-assessments/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;

  try {
    const supa = getSupabaseAdmin();

    const { data: existing, error: fetchErr } = await supa
      .from('wound_assessments')
      .select('id, patient_id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchErr || !existing) { res.status(404).json({ error: 'Wound assessment not found' }); return; }

    const { error: deleteErr } = await supa
      .from('wound_assessments')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteErr) throw deleteErr;

    await audit({
      action: 'change_request', entityType: 'wound_assessment', entityId: id,
      patientId: existing.patient_id ?? undefined,
      payload: { action: 'delete' },
    });

    logger.info({ id }, '[wound-assessments/delete] soft-deleted');
    res.json({ id, deleted: true });
  } catch (err) {
    logger.error({ err }, '[wound-assessments/delete] error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
