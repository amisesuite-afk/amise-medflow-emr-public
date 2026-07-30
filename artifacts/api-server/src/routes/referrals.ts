import { Router } from 'express';
import { getSupabaseAdmin, audit, requireStaffAuth, getStaffUserId } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';
import { createWorkflowTask, resolveWorkflowTask } from '../lib/workflow-tasks.js';

const router = Router();

const VALID_STATUSES = ['pending', 'sent', 'accepted', 'completed', 'declined'];
const VALID_URGENCIES = ['routine', 'soon', 'urgent', 'emergency'];

// POST /api/referrals -- create a new outbound referral
router.post('/api/referrals', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const {
    patientId, encounterId, referralTo, specialty, reason,
    urgency, notes, referralType, expectedDays,
  } = (req.body ?? {}) as {
    patientId?: string;
    encounterId?: string;
    referralTo?: string;
    specialty?: string;
    reason?: string;
    urgency?: string;
    notes?: string;
    referralType?: string;
    expectedDays?: number;
  };

  if (!patientId) { res.status(400).json({ error: 'patientId is required' }); return; }
  if (!referralTo?.trim()) { res.status(400).json({ error: 'referralTo is required' }); return; }

  const resolvedUrgency = urgency ?? 'routine';
  if (!VALID_URGENCIES.includes(resolvedUrgency)) {
    res.status(400).json({ error: `urgency must be one of: ${VALID_URGENCIES.join(', ')}` });
    return;
  }

  try {
    const supa = getSupabaseAdmin();
    const createdBy = await getStaffUserId(req);
    const now = new Date().toISOString();

    const { data: referral, error: insertErr } = await supa
      .from('referrals')
      .insert({
        patient_id:    patientId,
        encounter_id:  encounterId ?? null,
        referral_to:   referralTo.trim(),
        specialty:     specialty ?? null,
        reason:        reason ?? null,
        urgency:       resolvedUrgency,
        notes:         notes ?? null,
        referral_type: referralType ?? 'specialist',
        expected_days: expectedDays ?? 14,
        status:        'pending',
        created_by:    createdBy,
        updated_at:    now,
      })
      .select('id, patient_id, encounter_id, referral_to, specialty, reason, urgency, referral_type, expected_days, status, notes, created_at')
      .single();

    if (insertErr) throw insertErr;

    await audit({
      action: 'change_request',
      entityType: 'referral',
      entityId: referral.id,
      patientId,
      payload: { referral_to: referralTo, specialty, urgency: resolvedUrgency, referral_type: referralType },
    });

    // Create await_referral task for non-routine referrals on creation
    if (resolvedUrgency !== 'routine') {
      void createWorkflowTask({
        task_type:   'await_referral',
        patient_id:  patientId,
        encounter_id: encounterId ?? null,
        source_type: 'referral',
        source_id:   referral.id,
        title:       `Awaiting referral response: ${referralTo.trim()}${specialty ? ` (${specialty})` : ''}`,
        priority:    resolvedUrgency === 'urgent' || resolvedUrgency === 'emergency' ? 'high' : 'normal',
      });
    }

    logger.info({ id: referral.id, patientId, referralTo }, '[referrals/create] created');
    res.status(201).json({ referral });
  } catch (err) {
    logger.error({ err }, '[referrals/create] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// GET /api/referrals/patient/:patientId -- list all referrals for a patient
router.get('/api/referrals/patient/:patientId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { patientId } = req.params;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('referrals')
      .select('id, patient_id, encounter_id, referral_to, specialty, reason, urgency, referral_type, expected_days, status, notes, sent_at, response_received_at, created_at')
      .eq('patient_id', patientId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ referrals: data ?? [] });
  } catch (err) {
    logger.error({ err }, '[referrals/list] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// GET /api/referrals/open -- list all pending/sent referrals (staff tracking view)
router.get('/api/referrals/open', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const limit = Math.min(Number(req.query.limit ?? 50), 100);

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('referrals')
      .select('id, patient_id, encounter_id, referral_to, specialty, reason, urgency, referral_type, expected_days, status, notes, sent_at, created_at')
      .not('status', 'in', '(completed,declined)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json({ referrals: data ?? [] });
  } catch (err) {
    logger.error({ err }, '[referrals/open] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// PATCH /api/referrals/:id -- update status / lifecycle timestamps
router.patch('/api/referrals/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;
  const { status, sentAt, responseReceivedAt, notes } = (req.body ?? {}) as {
    status?: string;
    sentAt?: string;
    responseReceivedAt?: string;
    notes?: string;
  };

  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    const { data: existing, error: fetchErr } = await supa
      .from('referrals')
      .select('id, patient_id, encounter_id, status, referral_type, referral_to')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existing) {
      res.status(404).json({ error: 'Referral not found' });
      return;
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) patch.status = status;
    if (notes !== undefined) patch.notes = notes;
    if (sentAt !== undefined) patch.sent_at = sentAt;
    if (responseReceivedAt !== undefined) patch.response_received_at = responseReceivedAt;

    if (status === 'sent' && !sentAt && existing.status !== 'sent') {
      patch.sent_at = new Date().toISOString();
    }
    if ((status === 'accepted' || status === 'declined') && !responseReceivedAt) {
      patch.response_received_at = new Date().toISOString();
    }

    const { error: updateErr } = await supa
      .from('referrals')
      .update(patch)
      .eq('id', id);

    if (updateErr) throw updateErr;

    await audit({
      action: 'change_request',
      entityType: 'referral',
      entityId: id,
      patientId: existing.patient_id ?? undefined,
      payload: { from_status: existing.status, to_status: status ?? existing.status },
    });

    logger.info({ id, status }, '[referrals/patch] updated');

    if (status === 'sent' && existing.status !== 'sent') {
      const recipient = (existing as { referral_to?: string; referral_type?: string }).referral_to
        ?? (existing as { referral_type?: string }).referral_type
        ?? 'specialist';
      void createWorkflowTask({
        task_type:    'await_referral',
        patient_id:   existing.patient_id ?? undefined,
        encounter_id: (existing as { encounter_id?: string }).encounter_id ?? undefined,
        source_type:  'referral',
        source_id:    id,
        title:        `Awaiting referral response: ${recipient}`,
        priority:     'normal',
      });
    } else if (status === 'accepted' || status === 'declined' || status === 'completed') {
      void resolveWorkflowTask({ task_type: 'await_referral', source_type: 'referral', source_id: id, resolution_note: `Referral ${status}` });
    }

    res.json({ id, status: status ?? existing.status });
  } catch (err) {
    logger.error({ err }, '[referrals/patch] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// GET /api/referrals/open-tasks/:patientId -- open patient_tasks across encounters
router.get('/api/referrals/open-tasks/:patientId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { patientId } = req.params;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('patient_tasks')
      .select('id, task_type, description, due_date, due_at, priority, status, encounter_id, source_table, source_id')
      .eq('patient_id', patientId)
      .in('status', ['open', 'in_progress', 'overdue'])
      .order('priority', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json({ tasks: data ?? [] });
  } catch (err) {
    logger.error({ err }, '[referrals/open-tasks] error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
