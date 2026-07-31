import { Router } from 'express';
import { getSupabaseAdmin, audit, requireStaffAuth, getStaffUserId } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';

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
      .select('id, date, patient_ref, procedure, complication, category, grade, grade_suffix, contributing, re_operation, icu_admission, death, lessons_learned, action_items, review_status, review_date, reviewed_by, created_at')
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
      .select('id, date, patient_ref, procedure, complication, category, grade, grade_suffix, contributing, re_operation, icu_admission, death, lessons_learned, action_items, review_status, review_date, reviewed_by, created_at')
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

export default router;
