import { Router } from 'express';
import { getSupabaseAdmin, audit, requireStaffAuth, getStaffUserId } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';

const router = Router();

const VALID_STATUS = ['open', 'in_progress', 'closed', 'cancelled'];
const VALID_TYPES  = ['outpatient', 'inpatient', 'emergency', 'procedure', 'telehealth'];
const VALID_SITES  = ['rodney_bay', 'castries', 'tapion'];
const UUID_RE      = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/encounters
router.post('/api/encounters', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const patientId = (body.patientId as string)?.trim();
  if (!patientId) { res.status(400).json({ error: 'patientId is required' }); return; }
  if (!UUID_RE.test(patientId)) { res.status(400).json({ error: 'Invalid patientId' }); return; }

  const encounterType = (body.encounterType as string) ?? 'outpatient';
  if (!VALID_TYPES.includes(encounterType)) {
    res.status(400).json({ error: `encounterType must be one of: ${VALID_TYPES.join(', ')}` }); return;
  }
  const site = body.site as string | undefined;
  if (site && !VALID_SITES.includes(site)) {
    res.status(400).json({ error: `site must be one of: ${VALID_SITES.join(', ')}` }); return;
  }

  try {
    const supa = getSupabaseAdmin();
    const staffId = await getStaffUserId(req);

    const row: Record<string, unknown> = {
      patient_id:     patientId,
      status:         'open',
      encounter_type: encounterType,
      created_by:     staffId ?? null,
    };
    if ((body.chiefComplaint as string)?.trim()) row.chief_complaint = (body.chiefComplaint as string).trim();
    if (site) row.site = site;

    const { data, error } = await supa
      .from('encounters')
      .insert(row)
      .select('id, status, encounter_type, site, chief_complaint, created_at')
      .single();

    if (error) throw error;

    await audit({
      action: 'create', entityType: 'encounter', entityId: data.id,
      patientId, userId: staffId ?? undefined,
      payload: { encounterType, site: site ?? null },
    });

    logger.info({ id: data.id, patientId, encounterType }, '[encounters/create] created');
    res.status(201).json({ encounter: data });
  } catch (err) {
    logger.error({ err }, '[encounters/create] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// GET /api/encounters/patient/:patientId
router.get('/api/encounters/patient/:patientId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { patientId } = req.params;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);

  try {
    const supa = getSupabaseAdmin();

    const { data: rows, error } = await supa
      .from('encounters')
      .select('id, created_at, status, encounter_type, chief_complaint, site')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    if (!rows?.length) { res.json({ encounters: [] }); return; }

    const ids = (rows as Array<Record<string, unknown>>).map(r => r.id as string);
    const { data: aData } = await supa
      .from('assessments')
      .select('encounter_id, diagnosis, icd10_code')
      .in('encounter_id', ids);

    const aMap = new Map<string, { diagnosis: string; icd10_code: string }>();
    for (const a of ((aData ?? []) as Array<Record<string, unknown>>)) {
      const eid = a.encounter_id as string;
      if (!aMap.has(eid)) {
        aMap.set(eid, {
          diagnosis:  (a.diagnosis as string) ?? '',
          icd10_code: (a.icd10_code as string) ?? '',
        });
      }
    }

    const encounters = (rows as Array<Record<string, unknown>>).map(r => {
      const a = aMap.get(r.id as string);
      return {
        id:             r.id,
        createdAt:      r.created_at,
        status:         r.status ?? 'open',
        encounterType:  r.encounter_type ?? 'outpatient',
        chiefComplaint: r.chief_complaint ?? null,
        site:           r.site ?? null,
        diagnosis:      a?.diagnosis ?? null,
        icd10Code:      a?.icd10_code ?? null,
      };
    });

    res.json({ encounters });
  } catch (err) {
    logger.error({ err }, '[encounters/list] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// PATCH /api/encounters/:id
router.patch('/api/encounters/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;

  if (body.status && !VALID_STATUS.includes(body.status as string)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUS.join(', ')}` });
    return;
  }
  if (body.encounterType && !VALID_TYPES.includes(body.encounterType as string)) {
    res.status(400).json({ error: `encounterType must be one of: ${VALID_TYPES.join(', ')}` });
    return;
  }
  if (body.site && !VALID_SITES.includes(body.site as string)) {
    res.status(400).json({ error: `site must be one of: ${VALID_SITES.join(', ')}` });
    return;
  }

  try {
    const supa = getSupabaseAdmin();
    const { data: existing, error: fetchErr } = await supa
      .from('encounters').select('id, patient_id, status').eq('id', id).maybeSingle();
    if (fetchErr || !existing) { res.status(404).json({ error: 'Encounter not found' }); return; }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status !== undefined)         patch.status          = body.status;
    if (body.encounterType !== undefined)  patch.encounter_type  = body.encounterType;
    if (body.site !== undefined)           patch.site            = body.site;
    if (body.chiefComplaint !== undefined) patch.chief_complaint = body.chiefComplaint || null;

    const { error: updateErr } = await supa.from('encounters').update(patch).eq('id', id);
    if (updateErr) throw updateErr;

    const staffId = await getStaffUserId(req);
    await audit({
      action: 'change_request', entityType: 'encounter', entityId: id,
      userId: staffId ?? undefined,
      payload: { status: body.status },
    });

    logger.info({ id, status: body.status }, '[encounters/patch] updated');
    res.json({ id, ...patch });
  } catch (err) {
    logger.error({ err }, '[encounters/patch] error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
