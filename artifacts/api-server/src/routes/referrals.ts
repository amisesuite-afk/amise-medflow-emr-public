import { Router } from 'express';
import { getSupabaseAdmin, audit, requireStaffAuth } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';
import { createWorkflowTask, resolveWorkflowTask } from '../lib/workflow-tasks.js';

const router = Router();

// GET /api/referrals/patient/:patientId -- list all referrals for a patient
router.get('/api/referrals/patient/:patientId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { patientId } = req.params;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('referrals')
      .select('*')
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

  const VALID_STATUSES = ['pending', 'sent', 'accepted', 'completed', 'declined'];
  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    const { data: existing, error: fetchErr } = await supa
      .from('referrals')
      .select('id, patient_id, encounter_id, status, referral_type, referred_to')
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

    // Auto-stamp sent_at when transitioning to 'sent' and caller didn't provide it
    if (status === 'sent' && !sentAt && !existing.status?.includes('sent')) {
      patch.sent_at = new Date().toISOString();
    }
    // Auto-stamp response_received_at when accepted/declined
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

    // Workflow task lifecycle for referrals
    if (status === 'sent' && existing.status !== 'sent') {
      void createWorkflowTask({
        task_type:   'await_referral',
        patient_id:  existing.patient_id ?? undefined,
        encounter_id: (existing as { encounter_id?: string }).encounter_id ?? undefined,
        source_type: 'referral',
        source_id:   id,
        title:       `Awaiting referral response: ${(existing as { referred_to?: string }).referred_to ?? (existing as { referral_type?: string }).referral_type ?? 'specialist'}`,
        priority:    'normal',
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
