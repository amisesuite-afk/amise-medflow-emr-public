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
 * the local draft and the error is returned for the caller (outbox) to retry; nothing throws.
 * Dates are written with second precision (iOS `.iso8601` decoding rejects milliseconds).
 */
import { supabase } from './supabase';
import { normaliseSupplementHistory, type SupplementHistory } from './supplement-catalogue';

export const PATHWAY_DATA_COLUMN = 'pathway_data_json';

export interface SupplementLoadResult { history: SupplementHistory | null; error: string | null }

/** Parse a stored pathway_data_json string; unknown / broken JSON → {}. */
export function parsePathwayJson(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

/** The JSON to write: `existing` with only its `supplements` key replaced. */
export function mergeSupplementsIntoPathwayJson(existing: unknown, history: SupplementHistory): string {
  const obj = parsePathwayJson(existing);
  obj.supplements = {
    status: history.entries.length > 0 ? 'taking' : history.status,
    entries: history.entries.map(e => ({ id: e.id, catalogueId: e.catalogueId, name: e.name, details: e.details })),
    askedAt: history.askedAt,
  };
  return JSON.stringify(obj);
}

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
export async function saveSupplementHistory(patientId: string, history: SupplementHistory): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' };
  const { data, error: readErr } = await supabase
    .from('patients').select(PATHWAY_DATA_COLUMN).eq('id', patientId).maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!data) return { error: 'patient not found' };
  const json = mergeSupplementsIntoPathwayJson((data as Record<string, unknown>)[PATHWAY_DATA_COLUMN], history);
  const { error } = await supabase.from('patients').update({ [PATHWAY_DATA_COLUMN]: json }).eq('id', patientId);
  if (error) return { error: error.message };
  return { error: null };
}
