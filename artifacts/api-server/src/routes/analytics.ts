/**
 * Clinical audit & research analytics.
 *
 * GET /api/analytics/audit         — aggregate stats (CC, DX, procedure, demographics, outcomes)
 * GET /api/analytics/audit/export  — encounter-level CSV download
 *
 * Both endpoints require staff auth and accept optional ?from= and ?to= ISO date strings.
 */
import { Router } from 'express';
import { sb, requireStaffAuth } from '../lib/supabase.js';
import { logger as log } from '../lib/logger.js';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function ageAt(dob: string | null, refDate: Date = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return Math.floor((refDate.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

function ageGroup(age: number | null): string {
  if (age === null) return 'Unknown';
  if (age < 18) return '<18';
  if (age < 41) return '18–40';
  if (age < 61) return '41–60';
  return '61+';
}

function tally<T extends string>(map: Record<T, number>, key: T | null | undefined) {
  if (!key) return;
  map[key] = ((map[key] as number | undefined) ?? 0) + 1;
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  return lines.join('\n');
}

// ── GET /api/analytics/audit ──────────────────────────────────────────────────

router.get('/api/analytics/audit', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { from, to } = req.query as { from?: string; to?: string };

  try {
    // 1. Encounters (primary source — drives the date range)
    let encQ = sb().from('encounters').select('id, chief_complaint, encounter_type, site, encounter_date, patient_id');
    if (from) encQ = encQ.gte('encounter_date', from);
    if (to) encQ = encQ.lte('encounter_date', to);
    const { data: encounters, error: encErr } = await encQ;
    if (encErr) throw encErr;

    const encounterIds = (encounters ?? []).map(e => e.id as string);
    const patientIds = [...new Set((encounters ?? []).map(e => e.patient_id as string).filter(Boolean))];

    // 2. Parallel lookups keyed by encounter / patient
    const [
      { data: assessments },
      { data: plans },
      { data: patients },
      { data: procedures },
    ] = await Promise.all([
      encounterIds.length
        ? sb().from('assessments').select('encounter_id, diagnosis, icd10_code, acuity').in('encounter_id', encounterIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      encounterIds.length
        ? sb().from('plans').select('encounter_id, plan_type').in('encounter_id', encounterIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      patientIds.length
        ? sb().from('patients').select('id, date_of_birth, sex').in('id', patientIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      (() => {
        let q = sb().from('procedures').select('id, procedure_name, cpt_code, status, performed_date');
        if (from) q = q.gte('performed_date', from);
        if (to) q = q.lte('performed_date', to);
        return q;
      })(),
    ]);

    // 3. Aggregate

    // Chief complaint frequency
    const ccMap: Record<string, number> = {};
    for (const e of encounters ?? []) {
      const cc = (e.chief_complaint as string | null)?.trim();
      if (cc) tally(ccMap, cc);
    }

    // Diagnosis frequency
    const dxMap: Record<string, { count: number; icd10_code: string | null }> = {};
    for (const a of assessments ?? []) {
      const dx = (a.diagnosis as string | null)?.trim();
      if (dx) {
        if (!dxMap[dx]) dxMap[dx] = { count: 0, icd10_code: (a.icd10_code as string | null) ?? null };
        dxMap[dx].count++;
      }
    }

    // Procedure frequency
    const procMap: Record<string, { count: number; completed: number; cpt_code: string | null }> = {};
    for (const p of procedures ?? []) {
      const name = (p.procedure_name as string | null)?.trim();
      if (name) {
        if (!procMap[name]) procMap[name] = { count: 0, completed: 0, cpt_code: (p.cpt_code as string | null) ?? null };
        procMap[name].count++;
        if ((p.status as string) === 'completed') procMap[name].completed++;
      }
    }

    // Demographics (unique patients seen in this period)
    const patientMap = new Map((patients ?? []).map(p => [p.id as string, p]));
    const seenPatients = new Set<string>();
    const ageGroups: Record<string, number> = { '<18': 0, '18–40': 0, '41–60': 0, '61+': 0, 'Unknown': 0 };
    const sexDist: Record<string, number> = {};
    for (const e of encounters ?? []) {
      const pid = e.patient_id as string | null;
      if (!pid || seenPatients.has(pid)) continue;
      seenPatients.add(pid);
      const p = patientMap.get(pid);
      const ag = ageGroup(ageAt(p?.date_of_birth as string | null));
      ageGroups[ag] = (ageGroups[ag] ?? 0) + 1;
      if (p?.sex) tally(sexDist, p.sex as string);
    }

    // Site distribution (by encounter)
    const siteDist: Record<string, number> = {};
    for (const e of encounters ?? []) tally(siteDist, e.site as string | null);

    // Outcome distribution (plan types)
    const outcomeDist: Record<string, number> = {};
    for (const pl of plans ?? []) tally(outcomeDist, pl.plan_type as string | null);

    res.json({
      total_encounters: (encounters ?? []).length,
      total_procedures: (procedures ?? []).length,
      unique_patients: seenPatients.size,
      cc_distribution:
        Object.entries(ccMap)
          .map(([cc, count]) => ({ cc, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 30),
      dx_distribution:
        Object.entries(dxMap)
          .map(([diagnosis, { count, icd10_code }]) => ({ diagnosis, icd10_code, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 30),
      procedure_distribution:
        Object.entries(procMap)
          .map(([name, { count, completed, cpt_code }]) => ({ name, cpt_code, count, completed }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 30),
      age_groups: ageGroups,
      sex_distribution: sexDist,
      site_distribution: siteDist,
      outcome_distribution: outcomeDist,
    });
  } catch (err) {
    log.error({ err }, 'analytics/audit error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load audit data' });
  }
});

// ── GET /api/analytics/audit/export ──────────────────────────────────────────
// Encounter-level CSV with one row per encounter, joined with patient
// demographics, first assessment (DX), first plan (outcome), and first
// procedure performed in the same period.

router.get('/api/analytics/audit/export', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { from, to } = req.query as { from?: string; to?: string };

  try {
    // Encounters
    let encQ = sb().from('encounters').select('id, chief_complaint, encounter_type, site, encounter_date, patient_id');
    if (from) encQ = encQ.gte('encounter_date', from);
    if (to) encQ = encQ.lte('encounter_date', to);
    const { data: encounters, error: encErr } = await encQ;
    if (encErr) throw encErr;

    const encounterIds = (encounters ?? []).map(e => e.id as string);
    const patientIds = [...new Set((encounters ?? []).map(e => e.patient_id as string).filter(Boolean))];

    const [
      { data: assessments },
      { data: plans },
      { data: patients },
      { data: procedures },
    ] = await Promise.all([
      encounterIds.length
        ? sb().from('assessments').select('encounter_id, diagnosis, icd10_code, acuity').in('encounter_id', encounterIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      encounterIds.length
        ? sb().from('plans').select('encounter_id, plan_type').in('encounter_id', encounterIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      patientIds.length
        ? sb().from('patients').select('id, mrn, date_of_birth, sex').in('id', patientIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      (() => {
        let q = sb().from('procedures').select('id, patient_id, procedure_name, cpt_code, status, anaesthesia, performed_date');
        if (from) q = q.gte('performed_date', from);
        if (to) q = q.lte('performed_date', to);
        return q;
      })(),
    ]);

    // Index by encounter/patient
    const patientMap = new Map((patients ?? []).map(p => [p.id as string, p]));
    const assessByEnc = new Map<string, Record<string, unknown>>();
    for (const a of assessments ?? []) {
      if (!assessByEnc.has(a.encounter_id as string)) assessByEnc.set(a.encounter_id as string, a);
    }
    const planByEnc = new Map<string, Record<string, unknown>>();
    for (const pl of plans ?? []) {
      if (!planByEnc.has(pl.encounter_id as string)) planByEnc.set(pl.encounter_id as string, pl);
    }
    const procByPatient = new Map<string, Record<string, unknown>>();
    for (const p of procedures ?? []) {
      if (!procByPatient.has(p.patient_id as string)) procByPatient.set(p.patient_id as string, p);
    }

    const now = new Date();
    const SITE_LABELS: Record<string, string> = { rodney_bay: 'Rodney Bay', tapion: 'Tapion/ERCP', castries: 'Castries' };

    const rows = (encounters ?? []).map(e => {
      const p = patientMap.get(e.patient_id as string);
      const a = assessByEnc.get(e.id as string);
      const pl = planByEnc.get(e.id as string);
      const proc = procByPatient.get(e.patient_id as string);
      const age = ageAt(p?.date_of_birth as string | null, now);
      const encDate = (e.encounter_date as string)?.slice(0, 10) ?? '';
      return [
        encDate,
        p?.mrn ?? '',
        age ?? '',
        p?.sex ?? '',
        SITE_LABELS[e.site as string] ?? (e.site ?? ''),
        e.encounter_type ?? '',
        e.chief_complaint ?? '',
        a?.acuity ?? '',
        a?.diagnosis ?? '',
        a?.icd10_code ?? '',
        proc?.procedure_name ?? '',
        proc?.cpt_code ?? '',
        proc?.status ?? '',
        proc?.anaesthesia ?? '',
        pl?.plan_type ?? '',
      ];
    });

    const csv = buildCsv([
      'encounter_date', 'mrn', 'age', 'sex', 'site', 'encounter_type',
      'chief_complaint', 'acuity', 'diagnosis', 'icd10_code',
      'procedure', 'cpt_code', 'procedure_status', 'anaesthesia',
      'outcome_plan_type',
    ], rows);

    const rangeStr = from ? from.slice(0, 10) : 'all';
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="amise-audit-${rangeStr}-to-${dateStr}.csv"`);
    res.send(csv);
  } catch (err) {
    log.error({ err }, 'analytics/audit/export error');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Export failed' });
  }
});

export default router;
