import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin, audit, requireStaffAuth, getStaffUserId } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';
import { AI_DISABLED } from '../lib/ai-guard.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, timeout: 30_000 });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const router = Router();

const VALID_CATEGORIES    = ['intraoperative','early_postop','late_postop','near_miss','adverse_event'];
const VALID_GRADES        = ['I','II','IIIa','IIIb','IVa','IVb','V'];
const VALID_REVIEW_STATUS = ['pending','reviewed','actioned'];

// POST /api/mm-cases -- log a new case
router.post('/api/mm-cases', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const body = (req.body ?? {}) as Record<string, unknown>;

  if (!(body.procedure as string)?.trim()) { res.status(400).json({ error: 'procedure is required' }); return; }
  if (!(body.complication as string)?.trim()) { res.status(400).json({ error: 'complication is required' }); return; }
  if (!body.date) { res.status(400).json({ error: 'date is required' }); return; }

  const category = (body.category as string) ?? 'early_postop';
  if (!VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    return;
  }
  if (body.grade && !VALID_GRADES.includes(body.grade as string)) {
    res.status(400).json({ error: `grade must be one of: ${VALID_GRADES.join(', ')}` });
    return;
  }

  try {
    const supa = getSupabaseAdmin();
    const createdBy = await getStaffUserId(req);
    const now = new Date().toISOString();

    const { data: row, error: insertErr } = await supa
      .from('mm_cases')
      .insert({
        date:            body.date,
        patient_ref:     (body.patientRef as string) ?? null,
        procedure:       (body.procedure as string).trim(),
        complication:    (body.complication as string).trim(),
        category,
        grade:           body.grade && VALID_GRADES.includes(body.grade as string) ? body.grade : null,
        grade_suffix:    Boolean(body.gradeSuffix),
        contributing:    Array.isArray(body.contributing) ? body.contributing : [],
        re_operation:    Boolean(body.reOperation),
        icu_admission:   Boolean(body.icuAdmission),
        death:           Boolean(body.death),
        lessons_learned: (body.lessonsLearned as string) ?? null,
        action_items:    (body.actionItems as string) ?? null,
        review_status:   VALID_REVIEW_STATUS.includes(body.reviewStatus as string) ? (body.reviewStatus as string) : 'pending',
        review_date:     (body.reviewDate as string) || null,
        reviewed_by:     (body.reviewedBy as string) ?? null,
        created_by:      createdBy ?? null,
        updated_at:      now,
      })
      .select('id, date, patient_ref, procedure, complication, category, grade, grade_suffix, contributing, re_operation, icu_admission, death, lessons_learned, action_items, review_status, review_date, reviewed_by, timeline_events, five_whys, structured_actions, rca_summary, created_at')
      .single();

    if (insertErr) throw insertErr;

    await audit({
      action: 'change_request', entityType: 'mm_case', entityId: row.id,
      payload: { procedure: body.procedure, category, grade: body.grade },
    });

    logger.info({ id: row.id, category }, '[mm-cases/create] created');
    res.status(201).json({ case: row });
  } catch (err) {
    logger.error({ err }, '[mm-cases/create] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// GET /api/mm-cases -- list all cases
router.get('/api/mm-cases', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const reviewStatus = req.query.reviewStatus as string | undefined;
  const grade        = req.query.grade as string | undefined;
  const limit        = Math.min(Number(req.query.limit ?? 100), 500);

  try {
    let query = getSupabaseAdmin()
      .from('mm_cases')
      .select('id, date, patient_ref, procedure, complication, category, grade, grade_suffix, contributing, re_operation, icu_admission, death, lessons_learned, action_items, review_status, review_date, reviewed_by, timeline_events, five_whys, structured_actions, rca_summary, created_at')
      .order('date', { ascending: false })
      .limit(limit);

    if (reviewStatus && VALID_REVIEW_STATUS.includes(reviewStatus)) {
      query = query.eq('review_status', reviewStatus);
    }
    if (grade && VALID_GRADES.includes(grade)) {
      query = query.eq('grade', grade);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ cases: data ?? [] });
  } catch (err) {
    logger.error({ err }, '[mm-cases/list] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// PATCH /api/mm-cases/:id -- update
router.patch('/api/mm-cases/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;

  if (body.category && !VALID_CATEGORIES.includes(body.category as string)) {
    res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    return;
  }
  if (body.grade && !VALID_GRADES.includes(body.grade as string)) {
    res.status(400).json({ error: `grade must be one of: ${VALID_GRADES.join(', ')}` });
    return;
  }
  if (body.reviewStatus && !VALID_REVIEW_STATUS.includes(body.reviewStatus as string)) {
    res.status(400).json({ error: `reviewStatus must be one of: ${VALID_REVIEW_STATUS.join(', ')}` });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    const { data: existing, error: fetchErr } = await supa
      .from('mm_cases')
      .select('id, review_status')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existing) { res.status(404).json({ error: 'M&M case not found' }); return; }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const directFields: Array<[string, string]> = [
      ['date','date'], ['patientRef','patient_ref'], ['procedure','procedure'],
      ['complication','complication'], ['category','category'], ['grade','grade'],
      ['gradeSuffix','grade_suffix'], ['contributing','contributing'],
      ['reOperation','re_operation'], ['icuAdmission','icu_admission'],
      ['death','death'], ['lessonsLearned','lessons_learned'],
      ['actionItems','action_items'], ['reviewStatus','review_status'],
      ['reviewDate','review_date'], ['reviewedBy','reviewed_by'],
      // RCA fields
      ['timelineEvents','timeline_events'], ['fiveWhys','five_whys'],
      ['structuredActions','structured_actions'], ['rcaSummary','rca_summary'],
    ];
    for (const [camel, snake] of directFields) {
      if (body[camel] !== undefined) {
        patch[snake] = camel === 'reviewDate' && !body[camel] ? null : body[camel];
      }
    }

    const { error: updateErr } = await supa.from('mm_cases').update(patch).eq('id', id);
    if (updateErr) throw updateErr;

    await audit({
      action: 'change_request', entityType: 'mm_case', entityId: id,
      payload: { review_status: body.reviewStatus },
    });

    logger.info({ id }, '[mm-cases/patch] updated');
    res.json({ id, reviewStatus: body.reviewStatus ?? existing.review_status });
  } catch (err) {
    logger.error({ err }, '[mm-cases/patch] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// DELETE /api/mm-cases/:id -- hard delete (audit trail captures it)
router.delete('/api/mm-cases/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;

  try {
    const supa = getSupabaseAdmin();

    const { data: existing, error: fetchErr } = await supa
      .from('mm_cases').select('id').eq('id', id).maybeSingle();
    if (fetchErr || !existing) { res.status(404).json({ error: 'M&M case not found' }); return; }

    const { error: deleteErr } = await supa.from('mm_cases').delete().eq('id', id);
    if (deleteErr) throw deleteErr;

    await audit({ action: 'change_request', entityType: 'mm_case', entityId: id, payload: { action: 'delete' } });
    logger.info({ id }, '[mm-cases/delete] deleted');
    res.json({ id, deleted: true });
  } catch (err) {
    logger.error({ err }, '[mm-cases/delete] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/mm-cases/:id/analysis — AI-generated postmortem / RCA summary
router.post('/api/mm-cases/:id/analysis', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  if (AI_DISABLED) { res.status(503).json({ error: 'AI features are disabled' }); return; }

  const { id } = req.params;

  try {
    const supa = getSupabaseAdmin();
    const { data: row, error: fetchErr } = await supa
      .from('mm_cases')
      .select('id, date, procedure, complication, category, grade, grade_suffix, contributing, re_operation, icu_admission, death, lessons_learned, action_items, timeline_events, five_whys, structured_actions')
      .eq('id', id)
      .single();

    if (fetchErr || !row) { res.status(404).json({ error: 'M&M case not found' }); return; }

    const grade = row.grade ? `${row.grade}${row.grade_suffix ? '(d)' : ''}` : 'not graded';
    const factors = (row.contributing as string[])?.join(', ') || 'none identified';

    const timelineText = Array.isArray(row.timeline_events) && row.timeline_events.length > 0
      ? (row.timeline_events as Array<{ time: string; event: string }>)
          .map(e => `  ${e.time}: ${e.event}`)
          .join('\n')
      : '  (no timeline events recorded)';

    const whysText = Array.isArray(row.five_whys) && row.five_whys.length > 0
      ? (row.five_whys as Array<{ why: string; answer: string }>)
          .map((w, i) => `  Why ${i + 1}: ${w.why}\n  Answer: ${w.answer || '(not yet answered)'}`)
          .join('\n')
      : '  (5 Whys analysis not yet recorded)';

    const prompt = `You are assisting Dr Dawit Daniel Kabiye, a specialist general and endoscopic surgeon in Saint Lucia, with a structured postmortem / root cause analysis for a surgical M&M case.

CASE DETAILS
Date: ${row.date}
Procedure: ${row.procedure}
Complication: ${row.complication}
Category: ${row.category}
Clavien-Dindo Grade: ${grade}
Re-operation required: ${row.re_operation ? 'Yes' : 'No'}
ICU admission: ${row.icu_admission ? 'Yes' : 'No'}
Death: ${row.death ? 'Yes' : 'No'}
Contributing factors identified: ${factors}
Lessons learned (surgeon notes): ${row.lessons_learned || '(none recorded)'}
Action items (surgeon notes): ${row.action_items || '(none recorded)'}

TIMELINE RECONSTRUCTION
${timelineText}

5 WHYS ANALYSIS
${whysText}

Produce a structured postmortem analysis as a JSON object. Be direct, evidence-based, and surgical in tone. Do not speculate beyond the information provided. Distinguish clearly between confirmed facts and inferences.

Return ONLY valid JSON with this exact schema:
{
  "rootCause": "string — the most proximate root cause, one sentence",
  "systemFactors": ["string"] — systemic / organisational / process factors that contributed (max 5),
  "contributingAnalysis": "string — 2-3 sentences on how the identified contributing factors interacted",
  "preventionStrategies": ["string"] — specific, actionable strategies to prevent recurrence (max 6),
  "learningPoints": ["string"] — key learning points for the surgical team (max 4),
  "riskReduction": "string — summary of highest-yield risk-reduction opportunity, one sentence",
  "summary": "string — 3-4 sentence narrative summary of the case and its key learning, suitable for M&M presentation"
}`;

    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: 'You are a surgical quality improvement specialist assisting with M&M case analysis. Respond with JSON only.',
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '');

    const analysis = JSON.parse(raw) as {
      rootCause: string;
      systemFactors: string[];
      contributingAnalysis: string;
      preventionStrategies: string[];
      learningPoints: string[];
      riskReduction: string;
      summary: string;
    };

    // Persist the generated summary so it can be displayed without re-generating
    const rcaSummary = analysis.summary;
    await supa.from('mm_cases').update({ rca_summary: rcaSummary, updated_at: new Date().toISOString() }).eq('id', id);

    await audit({
      action: 'change_request', entityType: 'mm_case', entityId: id,
      payload: { action: 'ai_analysis_generated' },
    });

    logger.info({ id }, '[mm-cases/analysis] AI postmortem analysis generated');
    res.json({ analysis });
  } catch (err) {
    logger.error({ err }, '[mm-cases/analysis] error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
