import { Router } from 'express';
import { getSupabaseAdmin, audit, requireStaffAuth, getStaffUserId } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';

const router = Router();

const VALID_STATUSES = ['draft', 'signed', 'dispensed'];

// POST /api/prescriptions -- create a new prescription
router.post('/api/prescriptions', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const {
    patientId, encounterId, prescriberName, items, notes, status,
  } = (req.body ?? {}) as {
    patientId?: string;
    encounterId?: string;
    prescriberName?: string;
    items?: unknown[];
    notes?: string;
    status?: string;
  };

  if (!patientId) { res.status(400).json({ error: 'patientId is required' }); return; }
  if (!prescriberName?.trim()) { res.status(400).json({ error: 'prescriberName is required' }); return; }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'items must be a non-empty array' });
    return;
  }

  const resolvedStatus = status ?? 'draft';
  if (!VALID_STATUSES.includes(resolvedStatus)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  try {
    const supa = getSupabaseAdmin();
    const prescribedBy = await getStaffUserId(req);
    const now = new Date().toISOString();

    const { data: prescription, error: insertErr } = await supa
      .from('prescriptions')
      .insert({
        patient_id:      patientId,
        encounter_id:    encounterId ?? null,
        prescribed_by:   prescribedBy,
        prescriber_name: prescriberName.trim(),
        status:          resolvedStatus,
        items:           items,
        notes:           notes ?? null,
        updated_at:      now,
      })
      .select('id, patient_id, encounter_id, prescribed_by, prescriber_name, status, items, notes, created_at, updated_at')
      .single();

    if (insertErr) throw insertErr;

    await audit({
      action: 'change_request',
      entityType: 'prescription',
      entityId: prescription.id,
      patientId,
      payload: { status: resolvedStatus, item_count: items.length, prescriber: prescriberName },
    });

    logger.info({ id: prescription.id, patientId, status: resolvedStatus }, '[prescriptions/create] created');
    res.status(201).json({ prescription });
  } catch (err) {
    logger.error({ err }, '[prescriptions/create] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// GET /api/prescriptions/patient/:patientId -- list all prescriptions for a patient
router.get('/api/prescriptions/patient/:patientId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { patientId } = req.params;
  const encounterId = req.query.encounterId as string | undefined;

  try {
    let query = getSupabaseAdmin()
      .from('prescriptions')
      .select('id, patient_id, encounter_id, prescribed_by, prescriber_name, status, items, notes, created_at, updated_at')
      .eq('patient_id', patientId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (encounterId) {
      query = query.eq('encounter_id', encounterId);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ prescriptions: data ?? [] });
  } catch (err) {
    logger.error({ err }, '[prescriptions/list] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// PATCH /api/prescriptions/:id -- update status or notes
router.patch('/api/prescriptions/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;
  const { status, notes } = (req.body ?? {}) as { status?: string; notes?: string };

  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    const { data: existing, error: fetchErr } = await supa
      .from('prescriptions')
      .select('id, patient_id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchErr || !existing) {
      res.status(404).json({ error: 'Prescription not found' });
      return;
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) patch.status = status;
    if (notes !== undefined) patch.notes = notes;

    const { error: updateErr } = await supa
      .from('prescriptions')
      .update(patch)
      .eq('id', id);

    if (updateErr) throw updateErr;

    await audit({
      action: 'change_request',
      entityType: 'prescription',
      entityId: id,
      patientId: existing.patient_id ?? undefined,
      payload: { from_status: existing.status, to_status: status ?? existing.status },
    });

    logger.info({ id, status }, '[prescriptions/patch] updated');
    res.json({ id, status: status ?? existing.status });
  } catch (err) {
    logger.error({ err }, '[prescriptions/patch] error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
