/**
 * Clinical State Engine — state machine routes.
 *
 * GET  /api/clinical-states              list (?patientId &encounterId &status &type)
 * POST /api/clinical-states              create a new clinical state
 * GET  /api/clinical-states/:id          fetch one state + transition history
 * PATCH /api/clinical-states/:id         update mutable fields (not status)
 * POST /api/clinical-states/:id/transition  advance status with audit record
 * DELETE /api/clinical-states/:id        mark entered_in_error
 */
import { Router } from 'express';
import { sb, requireStaffAuth, getStaffUserId } from '../lib/supabase.js';
import { logger as log } from '../lib/logger.js';

const router = Router();

// Valid transitions: from_status → allowed to_statuses
const TRANSITIONS: Record<string, string[]> = {
  proposed:              ['suspected', 'active', 'ruled_out', 'entered_in_error'],
  suspected:             ['confirmed', 'active', 'ruled_out', 'pending_investigation', 'entered_in_error'],
  active:                ['improving', 'worsening', 'stable', 'confirmed', 'pending_investigation',
                          'pending_treatment', 'pending_review', 'resolved', 'entered_in_error'],
  confirmed:             ['improving', 'worsening', 'stable', 'pending_investigation',
                          'pending_treatment', 'pending_review', 'resolved', 'entered_in_error'],
  improving:             ['stable', 'resolved', 'worsening', 'active', 'entered_in_error'],
  worsening:             ['stable', 'pending_investigation', 'pending_treatment',
                          'pending_review', 'resolved', 'entered_in_error'],
  stable:                ['improving', 'worsening', 'pending_review', 'resolved', 'entered_in_error'],
  pending_investigation: ['active', 'confirmed', 'suspected', 'resolved', 'ruled_out', 'entered_in_error'],
  pending_treatment:     ['active', 'confirmed', 'improving', 'resolved', 'entered_in_error'],
  pending_review:        ['active', 'confirmed', 'stable', 'resolved', 'entered_in_error'],
  resolved:              ['active', 'entered_in_error'],   // relapse path
  ruled_out:             ['entered_in_error'],
  entered_in_error:      [],
};

// ── GET /api/clinical-states ─────────────────────────────────────────────────

router.get('/api/clinical-states', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { patientId, encounterId, status, type, limit = '100' } = req.query as {
    patientId?: string; encounterId?: string;
    status?: string; type?: string; limit?: string;
  };

  try {
    let query = sb()
      .from('clinical_states')
      .select([
        'id', 'patient_id', 'encounter_id', 'problem_id',
        'state_type', 'title', 'description', 'icd10_code',
        'status', 'severity', 'urgency', 'confidence', 'evidence_level',
        'source_references', 'onset_date', 'resolution_date', 'review_date',
        'closure_criteria', 'responsible_clinician', 'next_required_action',
        'created_at', 'updated_at', 'created_by',
      ].join(', '))
      .neq('status', 'entered_in_error')
      .order('created_at', { ascending: false })
      .limit(Math.min(parseInt(limit, 10) || 100, 500));

    if (patientId)   query = query.eq('patient_id', patientId);
    if (encounterId) query = query.eq('encounter_id', encounterId);
    if (status)      query = query.eq('status', status);
    if (type)        query = query.eq('state_type', type);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ states: data ?? [] });
  } catch (err) {
    log.error({ err }, '[clinical-states] list error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list clinical states' });
  }
});

// ── POST /api/clinical-states ─────────────────────────────────────────────────

router.post('/api/clinical-states', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const {
    patientId, encounterId, problemId,
    stateType, title, description, icd10Code,
    severity, urgency, confidence, evidenceLevel,
    sourceReferences, onsetDate, reviewDate, closureCriteria,
    responsibleClinician, nextRequiredAction,
  } = req.body as {
    patientId: string;
    encounterId?: string;
    problemId?: string;
    stateType?: string;
    title: string;
    description?: string;
    icd10Code?: string;
    severity?: string;
    urgency?: string;
    confidence?: string;
    evidenceLevel?: string;
    sourceReferences?: unknown[];
    onsetDate?: string;
    reviewDate?: string;
    closureCriteria?: string;
    responsibleClinician?: string;
    nextRequiredAction?: string;
  };

  if (!patientId || !title) {
    res.status(400).json({ error: 'patientId and title are required' });
    return;
  }

  try {
    const createdBy = await getStaffUserId(req);

    const { data, error } = await sb()
      .from('clinical_states')
      .insert({
        patient_id:           patientId,
        encounter_id:         encounterId         ?? null,
        problem_id:           problemId           ?? null,
        state_type:           stateType           ?? 'diagnosis',
        title,
        description:          description         ?? null,
        icd10_code:           icd10Code           ?? null,
        status:               'proposed',
        severity:             severity            ?? null,
        urgency:              urgency             ?? null,
        confidence:           confidence          ?? null,
        evidence_level:       evidenceLevel       ?? null,
        source_references:    sourceReferences    ?? [],
        onset_date:           onsetDate           ?? null,
        review_date:          reviewDate          ?? null,
        closure_criteria:     closureCriteria     ?? null,
        responsible_clinician: responsibleClinician ?? null,
        next_required_action: nextRequiredAction  ?? null,
        created_by:           createdBy,
      })
      .select('id, status, created_at')
      .single();

    if (error) throw error;

    // Record initial transition: null → proposed
    await sb().from('clinical_state_transitions').insert({
      clinical_state_id: data.id,
      from_status:       'new',
      to_status:         'proposed',
      transitioned_by:   createdBy,
      reason:            'State created',
    });

    log.info({ id: data.id, title, patientId }, '[clinical-states] created');
    res.status(201).json(data);
  } catch (err) {
    log.error({ err }, '[clinical-states] create error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create clinical state' });
  }
});

// ── GET /api/clinical-states/:id ─────────────────────────────────────────────

router.get('/api/clinical-states/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;

  try {
    const [stateRes, transRes] = await Promise.all([
      sb()
        .from('clinical_states')
        .select('*')
        .eq('id', id)
        .maybeSingle(),
      sb()
        .from('clinical_state_transitions')
        .select('id, from_status, to_status, transitioned_by, transitioned_at, reason, notes')
        .eq('clinical_state_id', id)
        .order('transitioned_at', { ascending: true }),
    ]);

    if (stateRes.error) throw stateRes.error;
    if (!stateRes.data) {
      res.status(404).json({ error: 'Clinical state not found' });
      return;
    }

    res.json({ state: stateRes.data, transitions: transRes.data ?? [] });
  } catch (err) {
    log.error({ err }, '[clinical-states] get error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch clinical state' });
  }
});

// ── PATCH /api/clinical-states/:id ──────────────────────────────────────────

router.patch('/api/clinical-states/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;

  const {
    title, description, icd10Code, stateType,
    severity, urgency, confidence, evidenceLevel,
    sourceReferences, onsetDate, resolutionDate,
    reviewDate, closureCriteria, responsibleClinician, nextRequiredAction,
  } = req.body as Record<string, unknown>;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title             !== undefined) patch.title               = title;
  if (description       !== undefined) patch.description         = description;
  if (icd10Code         !== undefined) patch.icd10_code          = icd10Code;
  if (stateType         !== undefined) patch.state_type          = stateType;
  if (severity          !== undefined) patch.severity            = severity;
  if (urgency           !== undefined) patch.urgency             = urgency;
  if (confidence        !== undefined) patch.confidence          = confidence;
  if (evidenceLevel     !== undefined) patch.evidence_level      = evidenceLevel;
  if (sourceReferences  !== undefined) patch.source_references   = sourceReferences;
  if (onsetDate         !== undefined) patch.onset_date          = onsetDate;
  if (resolutionDate    !== undefined) patch.resolution_date     = resolutionDate;
  if (reviewDate        !== undefined) patch.review_date         = reviewDate;
  if (closureCriteria   !== undefined) patch.closure_criteria    = closureCriteria;
  if (responsibleClinician !== undefined) patch.responsible_clinician = responsibleClinician;
  if (nextRequiredAction   !== undefined) patch.next_required_action   = nextRequiredAction;

  try {
    const { data, error } = await sb()
      .from('clinical_states')
      .update(patch)
      .eq('id', id)
      .neq('status', 'entered_in_error')
      .select('id, status, updated_at')
      .single();

    if (error) throw error;

    log.info({ id }, '[clinical-states] updated');
    res.json(data);
  } catch (err) {
    log.error({ err }, '[clinical-states] update error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update clinical state' });
  }
});

// ── POST /api/clinical-states/:id/transition ─────────────────────────────────

router.post('/api/clinical-states/:id/transition', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;

  const { toStatus, reason, notes, resolutionDate } = req.body as {
    toStatus: string;
    reason?: string;
    notes?: string;
    resolutionDate?: string;
  };

  if (!toStatus) {
    res.status(400).json({ error: 'toStatus is required' });
    return;
  }

  try {
    const { data: existing, error: fetchErr } = await sb()
      .from('clinical_states')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existing) {
      res.status(404).json({ error: 'Clinical state not found' });
      return;
    }

    const fromStatus = existing.status as string;
    const allowed = TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      res.status(409).json({
        error: `Cannot transition from '${fromStatus}' to '${toStatus}'`,
        allowed,
      });
      return;
    }

    const transitionedBy = await getStaffUserId(req);
    const now = new Date().toISOString();

    const updatePatch: Record<string, unknown> = {
      status:     toStatus,
      updated_at: now,
    };
    if (toStatus === 'resolved' && resolutionDate) {
      updatePatch.resolution_date = resolutionDate;
    }
    if (toStatus === 'resolved' && !resolutionDate) {
      updatePatch.resolution_date = new Date().toISOString().slice(0, 10);
    }

    const [updateRes, transRes] = await Promise.all([
      sb()
        .from('clinical_states')
        .update(updatePatch)
        .eq('id', id)
        .select('id, status, updated_at')
        .single(),
      sb()
        .from('clinical_state_transitions')
        .insert({
          clinical_state_id: id,
          from_status:       fromStatus,
          to_status:         toStatus,
          transitioned_by:   transitionedBy,
          transitioned_at:   now,
          reason:            reason  ?? null,
          notes:             notes   ?? null,
        })
        .select('id')
        .single(),
    ]);

    if (updateRes.error) throw updateRes.error;
    if (transRes.error) log.warn({ err: transRes.error }, '[clinical-states] transition log failed');

    log.info({ id, fromStatus, toStatus, transitionedBy }, '[clinical-states] transition');
    res.json({ state: updateRes.data, transitionId: transRes.data?.id });
  } catch (err) {
    log.error({ err }, '[clinical-states] transition error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to transition state' });
  }
});

// ── DELETE /api/clinical-states/:id ──────────────────────────────────────────

router.delete('/api/clinical-states/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;

  const { reason } = (req.body ?? {}) as { reason?: string };

  try {
    const { data: existing, error: fetchErr } = await sb()
      .from('clinical_states')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existing) {
      res.status(404).json({ error: 'Clinical state not found' });
      return;
    }

    if (existing.status === 'entered_in_error') {
      res.json({ id, status: 'entered_in_error' });
      return;
    }

    const deletedBy = await getStaffUserId(req);
    const now = new Date().toISOString();

    await Promise.all([
      sb().from('clinical_states')
        .update({ status: 'entered_in_error', updated_at: now })
        .eq('id', id),
      sb().from('clinical_state_transitions').insert({
        clinical_state_id: id,
        from_status:       existing.status,
        to_status:         'entered_in_error',
        transitioned_by:   deletedBy,
        transitioned_at:   now,
        reason:            reason ?? 'Entered in error',
      }),
    ]);

    log.info({ id, reason }, '[clinical-states] marked entered_in_error');
    res.json({ id, status: 'entered_in_error' });
  } catch (err) {
    log.error({ err }, '[clinical-states] delete error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete clinical state' });
  }
});

export default router;
