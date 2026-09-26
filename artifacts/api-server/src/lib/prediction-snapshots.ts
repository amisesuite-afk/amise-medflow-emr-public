/**
 * Outcomes loop, server side (Migration 94: prediction_snapshots / diagnosis_outcomes).
 *
 * - storePredictionSnapshot(): called by POST /api/visit/complete with the snapshot the dashboard
 *   built at completion. The body is untrusted: only coded values survive
 *   (@workspace/triage-engine/outcomes sanitizeSnapshot), the encounter reference is forced to
 *   this encounter, and the first completion wins (unique encounter_ref, ignoreDuplicates).
 *   It never throws and never fails the completion: a missing table (Migration 94 not applied),
 *   a bad body or a database error is logged and reported in the response as a status.
 *
 * - isMissingTableError(): PostgREST / Postgres codes for "this table does not exist yet".
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeSnapshot, snapshotToRow } from '@workspace/triage-engine/outcomes';
import { logger } from './logger.js';

export type SnapshotStatus = 'saved' | 'exists' | 'unavailable' | 'invalid' | 'failed' | 'none';

/** 42P01 undefined_table (Postgres), PGRST205 table not in the schema cache (PostgREST 12+),
 *  PGRST204 / 42703 a column the query names does not exist. */
export function isMissingTableError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST204' || code === '42703';
}

let loggedUnavailable = false;

export async function storePredictionSnapshot(
  supa: SupabaseClient,
  args: { body: unknown; encounterId: string; patientId: string; createdBy: string | null },
): Promise<SnapshotStatus> {
  if (args.body === undefined || args.body === null) return 'none';
  const expectedRef = `web:${args.encounterId}`;
  const parsed = sanitizeSnapshot({ ...(typeof args.body === 'object' ? args.body as object : {}), encounterRef: expectedRef, platform: 'web' });
  if (!parsed.ok) {
    logger.warn({ encounterId: args.encounterId, reason: parsed.error }, '[outcomes] prediction snapshot refused');
    return 'invalid';
  }
  const row = snapshotToRow(parsed.value, args.patientId, args.encounterId, args.createdBy);
  try {
    const { data, error } = await supa
      .from('prediction_snapshots')
      .upsert(row, { onConflict: 'encounter_ref', ignoreDuplicates: true })
      .select('id');
    if (error) {
      if (isMissingTableError(error)) {
        if (!loggedUnavailable) {
          loggedUnavailable = true;
          logger.warn('[outcomes] prediction_snapshots is missing (Migration 94 not applied) — snapshots are skipped');
        }
        return 'unavailable';
      }
      logger.warn({ err: error, encounterId: args.encounterId }, '[outcomes] prediction snapshot insert failed');
      return 'failed';
    }
    return Array.isArray(data) && data.length > 0 ? 'saved' : 'exists';
  } catch (err) {
    logger.warn({ err, encounterId: args.encounterId }, '[outcomes] prediction snapshot insert threw');
    return 'failed';
  }
}

/** Test-only. */
export function _resetOutcomesLogOnce(): void {
  loggedUnavailable = false;
}
