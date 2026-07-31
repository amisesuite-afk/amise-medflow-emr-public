import { Router } from 'express';
import { getSupabaseAdmin, audit, requireStaffAuth, getStaffUserId } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';

const router = Router();

const VALID_STATUSES = ['active', 'resolved'];

// GET /api/problems/:patientId
router.get('/api/problems/:patientId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { patientId } = req.params;
  const statusFilter = req.query.status as string | undefined;
  const limit = Math.min(Number(req.query.limit ?? 500), 1000);

  try {
    let query = getSupabaseAdmin()
      .from('pmh_items')
      .select('id, patient_id, encounter_id, condition, status, created_at, updated_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ problems: data ?? [] });
  } catch (err) {
    logger.error({ err }, '[problems/list] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/problems
// Upserts on (patient_id, condition) — deliberately reactivates resolved conditions.
router.post('/api/problems', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const patientId = (body.patientId as string)?.trim();
  const condition = (body.condition as string)?.trim();

  if (!patientId) { res.status(400).json({ error: 'patientId is required' }); return; }
  if (!condition) { res.status(400).json({ error: 'condition is required' }); return; }

  try {
    const supa = getSupabaseAdmin();

    const { data, error } = await supa
      .from('pmh_items')
      .upsert({
        patient_id:   patientId,
        encounter_id: (body.encounterId as string) ?? null,
        condition,
        status:       'active',
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'patient_id,condition' })
      .select('id, condition, status, created_at')
      .single();

    if (error) throw error;

    await audit({
      action: 'create', entityType: 'pmh_item', entityId: data.id,
      payload: { condition, patientId, statusForced: 'active' },
    });

    logger.info({ id: data.id, condition }, '[problems/create] upserted');
    res.status(201).json({ problem: data });
  } catch (err) {
    logger.error({ err }, '[problems/create] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// PATCH /api/problems/resolve-condition  (must come before /:id to avoid param capture)
// Body: { patientId, condition } — resolve by natural key without needing the UUID.
router.patch('/api/problems/resolve-condition', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const patientId = (body.patientId as string)?.trim();
  const condition = (body.condition as string)?.trim();

  if (!patientId) { res.status(400).json({ error: 'patientId is required' }); return; }
  if (!condition) { res.status(400).json({ error: 'condition is required' }); return; }

  try {
    const supa = getSupabaseAdmin();

    const { data: existing, error: fetchErr } = await supa
      .from('pmh_items')
      .select('id')
      .eq('patient_id', patientId)
      .eq('condition', condition)
      .maybeSingle();

    if (fetchErr || !existing) { res.status(404).json({ error: 'Problem not found' }); return; }

    const { error: updateErr } = await supa
      .from('pmh_items')
      .update({ status: 'resolved', updated_at: new Date().toISOString() })
      .eq('patient_id', patientId)
      .eq('condition', condition);

    if (updateErr) throw updateErr;

    const staffId = await getStaffUserId(req);
    await audit({
      action: 'change_request', entityType: 'pmh_item', entityId: (existing as { id: string }).id,
      payload: { status: 'resolved', staffId },
    });

    logger.info({ patientId, condition }, '[problems/resolve-condition] resolved');
    res.json({ id: (existing as { id: string }).id, status: 'resolved' });
  } catch (err) {
    logger.error({ err }, '[problems/resolve-condition] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// PATCH /api/problems/:id
router.patch('/api/problems/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as string)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }); return;
  }

  if (body.status === undefined && body.condition === undefined) {
    res.status(400).json({ error: 'provide status and/or condition to update' }); return;
  }

  try {
    const supa = getSupabaseAdmin();
    const { data: existing, error: fetchErr } = await supa
      .from('pmh_items').select('id').eq('id', id).maybeSingle();
    if (fetchErr || !existing) { res.status(404).json({ error: 'Problem not found' }); return; }

    const staffId = await getStaffUserId(req);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status !== undefined)    patch.status    = body.status;
    if (body.condition !== undefined) patch.condition = (body.condition as string).trim();

    const { error: updateErr } = await supa.from('pmh_items').update(patch).eq('id', id);
    if (updateErr) throw updateErr;

    await audit({
      action: 'change_request', entityType: 'pmh_item', entityId: id,
      payload: { status: body.status, staffId },
    });

    logger.info({ id, status: body.status }, '[problems/patch] updated');
    res.json({ id, ...patch });
  } catch (err) {
    logger.error({ err }, '[problems/patch] error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
