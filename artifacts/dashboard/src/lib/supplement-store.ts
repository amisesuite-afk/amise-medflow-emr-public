/**
 * Persistence of the "Herbs, teas, bush remedies & supplements" history on the web.
 *
 * Stored in the `supplements` key of `patients.pathway_data_json` (TEXT, Migration 86) — the same
 * JSON the iOS app keeps as `PathwayData` — so both platforms read and write ONE patient-level
 * record and no new column is needed. The write is a read-modify-write that keeps every other key
 * (burns, wellness, ward, bowelPrep …) exactly as iOS wrote it.
 *
 * Tolerates a server that lags: if the column is missing (Migration 86 not applied: 42703 /
 * PGRST204) or the role may not write it (Migration 89: front desk → 42501), the history stays in
 * the local draft and the error is returned; nothing throws. A permission refusal comes back with
 * `refused: true` — permanent for this role, so it is never queued for retry (sync-outbox.ts);
 * any other error is retried by the outbox.
 * Dates are written with second precision (iOS `.iso8601` decoding rejects milliseconds).
 */
import { withPathwayDataLock } from './pathway-data-lock';
import { supabase } from './supabase';
import { isPermissionRefusal } from './sync-outbox';
import {
  mergeSupplementsIntoPathwayJson, normaliseSupplementHistory, parsePathwayJson, type SupplementHistory,
} from './supplement-catalogue';

export { mergeSupplementsIntoPathwayJson, parsePathwayJson };

export const PATHWAY_DATA_COLUMN = 'pathway_data_json';

export interface SupplementLoadResult { history: SupplementHistory | null; error: string | null }

/** The patient's stored history, or null when none is stored (or it cannot be read). */
export async function loadSupplementHistory(patientId: string): Promise<SupplementLoadResult> {
  if (!supabase) return { history: null, error: 'Supabase not configured' };
  const { data, error } = await supabase
    .from('patients').select(PATHWAY_DATA_COLUMN).eq('id', patientId).maybeSingle();
  if (error) return { history: null, error: error.message };
  const obj = parsePathwayJson((data as Record<string, unknown> | null)?.[PATHWAY_DATA_COLUMN]);
  return { history: obj.supplements === undefined ? null : normaliseSupplementHistory(obj.supplements), error: null };
}

/** Save the history into pathway_data_json, keeping the other keys. */
export interface SupplementSaveResult {
  error: string | null;
  /** The server refused the write for this user's role (42501) — retrying cannot succeed. */
  refused?: boolean;
}

export function saveSupplementHistory(patientId: string, history: SupplementHistory): Promise<SupplementSaveResult> {
  return withPathwayDataLock(patientId, async () => {
    if (!supabase) return { error: 'Supabase not configured' };
    const { data, error: readErr } = await supabase
      .from('patients').select(PATHWAY_DATA_COLUMN).eq('id', patientId).maybeSingle();
    if (readErr) return { error: readErr.message, refused: isPermissionRefusal(readErr) };
    if (!data) return { error: 'patient not found' };
    const json = mergeSupplementsIntoPathwayJson((data as Record<string, unknown>)[PATHWAY_DATA_COLUMN], history);
    const { error } = await supabase.from('patients').update({ [PATHWAY_DATA_COLUMN]: json }).eq('id', patientId);
    if (error) return { error: error.message, refused: isPermissionRefusal(error) };
    return { error: null };
  });
}
