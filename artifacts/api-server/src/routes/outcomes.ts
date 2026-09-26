/**
 * Outcomes loop — de-identified research export (Migration 94 tables).
 *
 * GET /api/outcomes/research-export
 *   - Admin only, and only with a signed-in staff session (a Bearer JWT whose user_profiles role
 *     is 'admin'). The machine token (x-staff-token) is NOT accepted: an export must be
 *     attributable to a person.
 *   - Every export is audit-logged BEFORE it is released: action 'export', resource_type
 *     'research_export', counts and format only (no patient data). If that audit row cannot be
 *     written, the export is refused (503) — no unlogged export.
 *   - De-identified by @workspace/triage-engine/outcomes buildResearchExport: no identifiers, no
 *     exact dates, age bands, random case ids new in every export.
 *   - Tables missing (Migration 94 not applied): 200 { available: false } — never a 500.
 *
 * The calibration report itself is computed in the dashboard (admin page) and by
 * `pnpm --filter @workspace/scripts run outcomes:calibration`; neither needs this route.
 */
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  RESEARCH_EXPORT_VERSION, buildResearchExport, rowToOutcome, rowToSnapshot,
} from '@workspace/triage-engine/outcomes';
import type { DiagnosisOutcomeRow, ExportSource, FinalDiagnosis, PredictionSnapshotRow } from '@workspace/triage-engine/outcomes';
import { sb, verifyStaffToken } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { isMissingTableError } from '../lib/prediction-snapshots.js';

const router = Router();

const PAGE = 1000;
const MAX_ROWS = 50_000;

class MissingTable extends Error {}

async function fetchAll<T>(supa: SupabaseClient, table: string, columns: string, filter?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    let q = supa.from(table).select(columns).order('created_at', { ascending: true }).range(from, from + PAGE - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) {
      if (isMissingTableError(error)) throw new MissingTable(table);
      throw error;
    }
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

router.get('/api/outcomes/research-export', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const jwt = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const who = await verifyStaffToken(jwt);
  if (!who.ok) { res.status(who.status).json({ error: who.error }); return; }
  if (who.staff.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden — the research export is for admin accounts only' });
    return;
  }

  try {
    const supa = sb();
    let snapshotRows: PredictionSnapshotRow[];
    let outcomeRows: DiagnosisOutcomeRow[];
    try {
      snapshotRows = await fetchAll<PredictionSnapshotRow>(supa, 'prediction_snapshots', '*');
      outcomeRows = await fetchAll<DiagnosisOutcomeRow>(supa, 'diagnosis_outcomes', '*', q => q.eq('status', 'confirmed'));
    } catch (err) {
      if (err instanceof MissingTable) {
        res.json({ available: false, reason: 'The outcome tables are not in the database yet (Migration 94 not applied).' });
        return;
      }
      throw err;
    }

    const outcomes = new Map<string, FinalDiagnosis>();
    for (const r of outcomeRows) {
      const o = rowToOutcome(r);
      if (o) outcomes.set(o.encounterRef, o);
    }
    const patientIds = [...new Set(snapshotRows.map(r => r.patient_id).filter(Boolean))];
    const demographics = new Map<string, { dob: string | null; sex: string | null }>();
    for (let i = 0; i < patientIds.length; i += 200) {
      const { data, error } = await supa.from('patients').select('id, date_of_birth, sex').in('id', patientIds.slice(i, i + 200));
      if (error) throw error;
      for (const p of (data ?? []) as { id: string; date_of_birth: string | null; sex: string | null }[]) {
        demographics.set(p.id, { dob: p.date_of_birth, sex: p.sex });
      }
    }
    const sources: ExportSource[] = [];
    for (const r of snapshotRows) {
      const s = rowToSnapshot(r);
      if (!s) continue;
      const d = demographics.get(r.patient_id);
      sources.push({ snapshot: s, outcome: outcomes.get(s.encounterRef) ?? null, dateOfBirth: d?.dob ?? null, sex: d?.sex ?? null });
    }
    const exported = buildResearchExport(sources, new Date(), randomUUID);
    const withOutcome = exported.cases.filter(c => c.outcome).length;

    // Audit first; no row, no export.
    const { error: auditErr } = await supa.from('audit_log').insert({
      action: 'export',
      resource_type: 'research_export',
      user_id: who.staff.userId,
      user_email: who.staff.email,
      details: { format: RESEARCH_EXPORT_VERSION, cases: exported.cases.length, with_final_diagnosis: withOutcome },
      user_agent: (req.headers['user-agent'] as string | undefined) ?? null,
      mode: process.env.MODE ?? null,
    });
    if (auditErr) {
      logger.error({ err: auditErr }, '[outcomes] research export refused: audit_log insert failed');
      res.status(503).json({ error: 'The export could not be audit-logged, so it was not released. Please try again later.' });
      return;
    }
    logger.info({ cases: exported.cases.length, withOutcome }, '[outcomes] research export released');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="amise-outcomes-${exported.generatedMonth}-${RESEARCH_EXPORT_VERSION}.json"`);
    res.json({ available: true, ...exported });
  } catch (err) {
    logger.error({ err }, '[outcomes] research export failed');
    res.status(502).json({ error: 'The export could not be built. Please try again later.' });
  }
});

export default router;
