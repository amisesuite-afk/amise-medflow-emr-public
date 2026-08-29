/**
 * Workflow Tasks — unresolved loop tracking.
 *
 * GET  /api/workflow-tasks              list (?patientId &encounterId &status &type)
 * POST /api/workflow-tasks              create task
 * POST /api/workflow-tasks/:id/resolve  resolve / dismiss a task
 * POST /api/workflow-tasks/:id/assign   reassign a task
 */
import { Router } from 'express';
import { sb, requireStaffAuth, getStaffUserId } from '../lib/supabase.js';
import { logger as log } from '../lib/logger.js';
import { logAudit } from '../lib/audit.js';

const router = Router();

// ── GET /api/workflow-tasks ──────────────────────────────────────────────────

router.get('/api/workflow-tasks', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { patientId, encounterId, status, type, assignedTo, limit = '50' } = req.query as {
    patientId?: string;
    encounterId?: string;
    status?: string;
    type?: string;
    assignedTo?: string;
    limit?: string;
  };

  try {
    let query = sb()
      .from('workflow_tasks')
      .select([
        'id', 'task_type', 'title', 'details',
        'patient_id', 'encounter_id',
        'source_type', 'source_id',
        'status', 'priority',
        'due_at', 'assigned_to',
        'resolved_at', 'resolved_by', 'resolution_note',
        'created_at', 'updated_at',
      ].join(', '))
      .order('priority', { ascending: true })  // urgent first in alphabetical: high,low,normal,urgent — sort handled client-side
      .order('created_at', { ascending: false })
      .limit(Math.min(parseInt(limit, 10) || 50, 200));

    if (patientId)   query = query.eq('patient_id', patientId);
    if (encounterId) query = query.eq('encounter_id', encounterId);
    if (status)      query = query.eq('status', status);
    if (type)        query = query.eq('task_type', type);
    if (assignedTo)  query = query.eq('assigned_to', assignedTo);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ tasks: data ?? [] });
  } catch (err) {
    log.error({ err }, '[workflow-tasks] list error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list tasks' });
  }
});

// ── POST /api/workflow-tasks ─────────────────────────────────────────────────

router.post('/api/workflow-tasks', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const {
    taskType, patientId, encounterId,
    sourceType, sourceId,
    title, details, priority, dueAt, assignedTo,
  } = req.body as {
    taskType: string;
    patientId?: string;
    encounterId?: string;
    sourceType?: string;
    sourceId?: string;
    title: string;
    details?: string;
    priority?: string;
    dueAt?: string;
    assignedTo?: string;
  };

  if (!taskType || !title) {
    res.status(400).json({ error: 'taskType and title are required' });
    return;
  }

  try {
    const { data, error } = await sb()
      .from('workflow_tasks')
      .insert({
        task_type:   taskType,
        patient_id:  patientId   ?? null,
        encounter_id: encounterId ?? null,
        source_type: sourceType  ?? null,
        source_id:   sourceId    ?? null,
        title,
        details:     details     ?? null,
        priority:    priority    ?? 'normal',
        due_at:      dueAt       ?? null,
        assigned_to: assignedTo  ?? null,
        status:      'open',
      })
      .select('id, status, created_at')
      .single();

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        res.status(409).json({ error: 'An open task of this type already exists for this source' });
        return;
      }
      throw error;
    }

    log.info({ id: data.id, taskType, patientId }, '[workflow-tasks] created');
    void logAudit(req, 'create', 'workflow_task', data.id as string, patientId, { taskType, title, priority });
    res.status(201).json(data);
  } catch (err) {
    log.error({ err }, '[workflow-tasks] create error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create task' });
  }
});

// ── POST /api/workflow-tasks/:id/resolve ─────────────────────────────────────

router.post('/api/workflow-tasks/:id/resolve', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { id } = req.params;
  const { action = 'resolved', resolutionNote } = req.body as {
    action?: 'resolved' | 'dismissed';
    resolutionNote?: string;
  };

  if (!['resolved', 'dismissed'].includes(action)) {
    res.status(400).json({ error: 'action must be resolved or dismissed' });
    return;
  }

  try {
    const resolvedBy = await getStaffUserId(req);

    const { data: existing, error: fetchErr } = await sb()
      .from('workflow_tasks')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existing) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    if (!['open', 'in_progress'].includes(existing.status as string)) {
      res.status(409).json({ error: `Task is already ${existing.status as string}` });
      return;
    }

    const now = new Date().toISOString();
    const { data, error } = await sb()
      .from('workflow_tasks')
      .update({
        status:          action,
        resolved_at:     now,
        resolved_by:     resolvedBy,
        resolution_note: resolutionNote ?? null,
        updated_at:      now,
      })
      .eq('id', id)
      .select('id, status, resolved_at')
      .single();

    if (error) throw error;

    log.info({ id, action, resolvedBy }, '[workflow-tasks] resolved');
    void logAudit(req, action === 'dismissed' ? 'task_dismiss' : 'task_resolve', 'workflow_task', id, undefined, { action, resolutionNote });
    res.json(data);
  } catch (err) {
    log.error({ err }, '[workflow-tasks] resolve error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to resolve task' });
  }
});

// ── POST /api/workflow-tasks/:id/assign ─────────────────────────────────────

router.post('/api/workflow-tasks/:id/assign', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { id } = req.params;
  const { assignedTo, status } = req.body as {
    assignedTo: string | null;
    status?: 'open' | 'in_progress';
  };

  try {
    const { data, error } = await sb()
      .from('workflow_tasks')
      .update({
        assigned_to: assignedTo ?? null,
        status:      status ?? 'in_progress',
        updated_at:  new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, assigned_to, status')
      .single();

    if (error) throw error;

    log.info({ id, assignedTo }, '[workflow-tasks] assigned');
    res.json(data);
  } catch (err) {
    log.error({ err }, '[workflow-tasks] assign error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to assign task' });
  }
});

export default router;
