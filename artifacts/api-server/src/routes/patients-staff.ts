import { Router } from 'express';
import { getSupabaseAdmin, audit, requireStaffAuth, getStaffUserId } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';

const router = Router();

const VALID_SITES = ['rodney_bay', 'tapion'];
const VALID_SEX   = ['male', 'female', 'other', 'unknown'];

/** Normalise sex value from any client — empty string, wrong case, abbreviation → valid DB value. */
function normalizeSex(raw: unknown): string {
  if (!raw || typeof raw !== 'string') return 'unknown';
  const s = raw.toLowerCase().trim();
  if (s === 'm') return 'male';
  if (s === 'f') return 'female';
  if (VALID_SEX.includes(s)) return s;
  return 'unknown';
}

interface EncSummary {
  patient_id: string;
  status: string;
  encounter_type: string;
  site: string | null;
  encounter_date: string;
}

/** Attach latest-encounter status and type to each patient row (single extra query). */
async function enrichWithEncounters(
  supa: ReturnType<typeof import('../lib/supabase.js').getSupabaseAdmin>,
  patients: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  if (!patients.length) return patients;
  const ids = patients.map(p => p.id as string);
  const { data: encs } = await supa
    .from('encounters')
    .select('patient_id, status, encounter_type, site, encounter_date')
    .in('patient_id', ids)
    .order('encounter_date', { ascending: false });

  // Latest encounter per patient (first row wins because ordered DESC)
  const latest = new Map<string, EncSummary>();
  for (const e of (encs ?? []) as EncSummary[]) {
    if (!latest.has(e.patient_id)) latest.set(e.patient_id, e);
  }

  return patients.map(p => {
    const enc = latest.get(p.id as string);
    return enc
      ? { ...p, latest_encounter_status: enc.status, latest_encounter_type: enc.encounter_type, latest_encounter_site: enc.site, latest_encounter_date: enc.encounter_date }
      : { ...p, latest_encounter_status: null, latest_encounter_type: null, latest_encounter_site: null, latest_encounter_date: null };
  });
}

// GET /api/patients -- list or search
router.get('/api/patients', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const q     = req.query.q as string | undefined;
  const site  = req.query.site as string | undefined;
  const limit = Math.min(Number(req.query.limit ?? 100), 500);

  try {
    const supa = getSupabaseAdmin();

    if (site && VALID_SITES.includes(site)) {
      const { data: encRows, error: encErr } = await supa
        .from('encounters')
        .select('patient_id')
        .or(`site.eq.${site},site.is.null`);
      if (encErr) throw encErr;

      const ids = [...new Set((encRows ?? []).map((r: Record<string, unknown>) => r.patient_id as string))];
      if (!ids.length) { res.json({ patients: [] }); return; }

      let pQuery = supa
        .from('patients')
        .select('id, full_name, sex, phone, date_of_birth, created_at')
        .in('id', ids)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (q?.trim()) pQuery = pQuery.ilike('full_name', `%${q.trim()}%`);

      const { data, error } = await pQuery;
      if (error) throw error;
      res.json({ patients: await enrichWithEncounters(supa, data ?? []) });
      return;
    }

    if (q?.trim()) {
      const isPhone = /^\+?\d[\d\s()-]{3,}$/.test(q.trim());
      let query = supa
        .from('patients')
        .select('id, full_name, sex, phone, date_of_birth, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      query = isPhone
        ? query.ilike('phone', `%${q.replace(/[\s()-]/g, '')}%`)
        : query.ilike('full_name', `%${q.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      res.json({ patients: await enrichWithEncounters(supa, data ?? []) });
      return;
    }

    const { data, error } = await supa
      .from('patients')
      .select('id, full_name, sex, phone, date_of_birth, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ patients: await enrichWithEncounters(supa, data ?? []) });
  } catch (err) {
    logger.error({ err }, '[patients-staff/list] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// GET /api/patients/names?ids=uuid1,uuid2,...
// Bulk-fetch patient display names for up to 100 IDs. Used by the results inbox
// to resolve patient_id → full_name without direct Supabase access.
router.get('/api/patients/names', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const raw = (req.query.ids as string | undefined) ?? '';
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ids = raw.split(',').map(s => s.trim()).filter(s => uuidRe.test(s)).slice(0, 100);

  if (ids.length === 0) { res.json({ names: {} }); return; }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('patients')
      .select('id, full_name')
      .in('id', ids);
    if (error) throw error;

    const names: Record<string, string> = {};
    for (const r of ((data ?? []) as Array<{ id: string; full_name: string | null }>)) {
      if (r.full_name) names[r.id] = r.full_name;
    }
    res.json({ names });
  } catch (err) {
    logger.error({ err }, '[patients-staff/names] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// GET /api/patients/:id
router.get('/api/patients/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('patients')
      .select('id, full_name, sex, phone, date_of_birth, email, address, photo_url, mrn, created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) { res.status(404).json({ error: 'Patient not found' }); return; }
    res.json({ patient: data });
  } catch (err) {
    logger.error({ err }, '[patients-staff/get] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// POST /api/patients
router.post('/api/patients', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const rawName = (body.fullName ?? body.full_name) as string | undefined;
  if (!rawName?.trim()) {
    res.status(400).json({ error: 'fullName is required' }); return;
  }

  try {
    const supa = getSupabaseAdmin();
    const createdBy = await getStaffUserId(req);

    const row: Record<string, unknown> = {
      full_name:  rawName.trim(),
      sex:        normalizeSex(body.sex),
      created_by: createdBy ?? null,
      updated_by: createdBy ?? null,
    };

    if ((body.dateOfBirth ?? body.date_of_birth)) row.date_of_birth = body.dateOfBirth ?? body.date_of_birth;
    if ((body.phone as string)?.trim())           row.phone         = (body.phone as string).trim();
    if ((body.email as string)?.trim())           row.email         = (body.email as string).trim();
    if ((body.address as string)?.trim())         row.address       = (body.address as string).trim();
    if ((body.mrn as string)?.trim())             row.mrn           = (body.mrn as string).trim();

    const extFields: Array<[string, string]> = [
      ['quarter','quarter'], ['referredBy','referred_by'],
      ['insuranceProvider','insurance_provider'], ['policyNumber','policy_number'],
      ['nhiNumber','nhi_number'], ['preAuthStatus','pre_auth_status'],
      ['occupation','occupation'], ['nokName','nok_name'],
      ['nokRelation','nok_relation'], ['nokTel','nok_phone'],
      ['pmhNotes','pmh_notes'], ['familyHistoryNotes','family_history_notes'],
    ];
    for (const [camel, snake] of extFields) {
      if ((body[camel] as string)?.trim?.()) row[snake] = (body[camel] as string).trim();
    }

    const { data, error } = await supa
      .from('patients')
      .insert(row)
      .select('id, full_name')
      .single();
    if (error) throw error;

    await audit({
      action: 'change_request', entityType: 'patient', entityId: data.id,
      payload: { fullName: rawName.trim(), sex: row.sex },
    });

    logger.info({ id: data.id }, '[patients-staff/create] created');
    res.status(201).json({ patient: data });
  } catch (err) {
    logger.error({ err }, '[patients-staff/create] error');
    res.status(502).json({ error: errStr(err) });
  }
});

// PATCH /api/patients/:id
router.patch('/api/patients/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;

  if (body.sex !== undefined) body.sex = normalizeSex(body.sex);

  try {
    const supa = getSupabaseAdmin();
    const { data: existing, error: fetchErr } = await supa
      .from('patients').select('id').eq('id', id).maybeSingle();
    if (fetchErr || !existing) { res.status(404).json({ error: 'Patient not found' }); return; }

    const staffId = await getStaffUserId(req);
    const patch: Record<string, unknown> = {
      updated_by: staffId,
      updated_at: new Date().toISOString(),
    };

    const fields: Array<[string, string]> = [
      ['fullName','full_name'], ['sex','sex'],
      ['phone','phone'], ['email','email'], ['address','address'],
      ['dateOfBirth','date_of_birth'], ['mrn','mrn'], ['photoUrl','photo_url'],
      ['quarter','quarter'], ['referredBy','referred_by'],
      ['insuranceProvider','insurance_provider'], ['policyNumber','policy_number'],
      ['nhiNumber','nhi_number'], ['preAuthStatus','pre_auth_status'],
      ['occupation','occupation'], ['nokName','nok_name'],
      ['nokRelation','nok_relation'], ['nokTel','nok_phone'],
      ['pmhNotes','pmh_notes'], ['familyHistoryNotes','family_history_notes'],
    ];
    for (const [camel, snake] of fields) {
      if (body[camel] !== undefined) patch[snake] = body[camel] || null;
    }

    const { error: updateErr } = await supa.from('patients').update(patch).eq('id', id);
    if (updateErr) throw updateErr;

    await audit({
      action: 'change_request', entityType: 'patient', entityId: id,
      payload: { updatedFields: Object.keys(patch).filter(k => k !== 'updated_by' && k !== 'updated_at') },
    });

    logger.info({ id }, '[patients-staff/patch] updated');
    res.json({ id });
  } catch (err) {
    logger.error({ err }, '[patients-staff/patch] error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
