/**
 * AI Proposal lifecycle routes.
 *
 * POST /api/ai-proposals             — store a new AI_PROPOSED item
 * POST /api/ai-proposals/:id/review  — clinician approves / rejects / edits
 * GET  /api/ai-proposals             — list proposals (?patientId= &encounterId= &status=)
 */
import { Router } from 'express';
import { sb, requireStaffAuth, getStaffUserId } from '../lib/supabase.js';
import { logger as log } from '../lib/logger.js';

const router = Router();

// ── POST /api/ai-proposals ───────────────────────────────────────────────────

router.post('/api/ai-proposals', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const {
    patientId, encounterId, proposalType, sourceType, sourceContent,
    model, modelVersion, promptVersion, content,
  } = req.body as {
    patientId?: string;
    encounterId?: string;
    proposalType: string;
    sourceType?: string;
    sourceContent?: string;
    model: string;
    modelVersion?: string;
    promptVersion?: string;
    content: Record<string, unknown>;
  };

  if (!proposalType || !model || !content) {
    res.status(400).json({ error: 'proposalType, model, and content are required' });
    return;
  }

  try {
    const { data, error } = await sb()
      .from('ai_proposals')
      .insert({
        patient_id:     patientId   ?? null,
        encounter_id:   encounterId ?? null,
        proposal_type:  proposalType,
        source_type:    sourceType  ?? null,
        source_content: sourceContent ?? null,
        model,
        model_version:  modelVersion  ?? null,
        prompt_version: promptVersion ?? null,
        content,
        status: 'proposed',
      })
      .select('id, status, generated_at')
      .single();

    if (error) throw error;

    log.info({ id: data.id, proposalType, model }, '[ai-proposals] stored');
    res.status(201).json(data);
  } catch (err) {
    log.error({ err }, '[ai-proposals] store error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to store proposal' });
  }
});

// ── POST /api/ai-proposals/:id/review ───────────────────────────────────────

router.post('/api/ai-proposals/:id/review', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { id } = req.params;
  const { decision, approvedContent, rejectionReason } = req.body as {
    decision: 'approved' | 'rejected' | 'edited';
    approvedContent?: Record<string, unknown>;  // clinician-edited version
    rejectionReason?: string;
  };

  if (!['approved', 'rejected', 'edited'].includes(decision)) {
    res.status(400).json({ error: 'decision must be approved, rejected, or edited' });
    return;
  }
  if (decision === 'edited' && !approvedContent) {
    res.status(400).json({ error: 'approvedContent is required when decision is edited' });
    return;
  }
  if (decision === 'rejected' && !rejectionReason) {
    res.status(400).json({ error: 'rejectionReason is required when rejecting a proposal' });
    return;
  }

  try {
    const reviewedBy = await getStaffUserId(req);

    const { data: existing, error: fetchErr } = await sb()
      .from('ai_proposals')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existing) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }
    if (existing.status !== 'proposed') {
      res.status(409).json({ error: `Proposal already ${existing.status as string} — cannot review again` });
      return;
    }

    const { data, error } = await sb()
      .from('ai_proposals')
      .update({
        status:           decision,
        reviewed_by:      reviewedBy,
        reviewed_at:      new Date().toISOString(),
        approved_content: decision !== 'rejected' ? (approvedContent ?? null) : null,
        rejection_reason: decision === 'rejected' ? (rejectionReason ?? null) : null,
      })
      .eq('id', id)
      .select('id, status, reviewed_at')
      .single();

    if (error) throw error;

    log.info({ id, decision, reviewedBy }, '[ai-proposals] reviewed');
    res.json(data);
  } catch (err) {
    log.error({ err }, '[ai-proposals] review error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to review proposal' });
  }
});

// ── GET /api/ai-proposals ────────────────────────────────────────────────────

router.get('/api/ai-proposals', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { patientId, encounterId, status } = req.query as {
    patientId?: string;
    encounterId?: string;
    status?: string;
  };

  try {
    let query = sb()
      .from('ai_proposals')
      .select('id, patient_id, encounter_id, proposal_type, model, status, content, approved_content, generated_at, reviewed_at')
      .order('generated_at', { ascending: false })
      .limit(50);

    if (patientId)   query = query.eq('patient_id', patientId);
    if (encounterId) query = query.eq('encounter_id', encounterId);
    if (status)      query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ proposals: data ?? [] });
  } catch (err) {
    log.error({ err }, '[ai-proposals] list error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list proposals' });
  }
});

export default router;
