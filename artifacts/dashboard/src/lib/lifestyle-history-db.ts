/**
 * Lifestyle history (ritual fasting, complementary therapies, night-shift work, usual sleep) —
 * load and save on the web.
 *
 * Stored as the `lifestyle` key of `patients.pathway_data_json` (Migration 86,
 * supabase-pathway-data-migration.sql), the same JSON blob the iOS app syncs as
 * `PathwayData.lifestyle` (SyncService+PathwayData.swift). No new column is needed.
 *
 * - The blob also holds the iOS pathway forms (burns, wellness, ward review, bowel prep): a save
 *   reads it, replaces only `lifestyle`, and writes it back. A blob that is not valid JSON is
 *   never overwritten (the save reports an error instead).
 * - Production may not have the column yet. A missing column (42703 / PGRST204) is not an
 *   error: `available: false` comes back, the edit stays in this browser's encounter cache, and
 *   the Social History card says so. It is not queued in the outbox (it would never drain).
 * - `pathway_data_json` is clinician-only under Migration 89 (front desk gets 42501); that is a
 *   real error, reported with `refused: true`: permanent for this role, so the outbox never
 *   retries it (sync-outbox.ts), and the card is read-only for front desk anyway.
 *
 * Record shape and rules: @workspace/triage-engine/lifestyle-practices.
 */
import { withPathwayDataLock } from './pathway-data-lock';
import { supabase } from './supabase';
import { logClinicalSave } from './db';
import { isMissingColumnError } from './vitals-news2-fields';
import { isPermissionRefusal } from './sync-outbox';
import { mergeLifestyleIntoBlob, parsePathwayBlob } from './lifestyle-history-blob';
import {
  isLifestyleRecorded, parseLifestyleHistory, type LifestyleHistory,
} from '@workspace/triage-engine/lifestyle-practices';

export const PATHWAY_DATA_COLUMN = 'pathway_data_json';

export interface LifestyleLoadResult {
  /** null when nothing is stored for this patient. */
  lifestyle: LifestyleHistory | null;
  /** false when the column does not exist on this database yet. */
  available: boolean;
  error: string | null;
}

export interface LifestyleSaveResult {
  available: boolean;
  error: string | null;
  /** The server refused the write for this user's role (42501) — retrying cannot succeed. */
  refused?: boolean;
}

export async function loadLifestyleHistory(patientId: string): Promise<LifestyleLoadResult> {
  if (!supabase) return { lifestyle: null, available: false, error: 'Supabase not configured' };
  const { data, error } = await supabase
    .from('patients')
    .select(PATHWAY_DATA_COLUMN)
    .eq('id', patientId)
    .maybeSingle();
  if (error) {
    if (isMissingColumnError(error, [PATHWAY_DATA_COLUMN])) return { lifestyle: null, available: false, error: null };
    console.error('[lifestyle] load:', error.message);
    return { lifestyle: null, available: true, error: error.message };
  }
  const text = (data as Record<string, unknown> | null)?.[PATHWAY_DATA_COLUMN];
  const blob = parsePathwayBlob(typeof text === 'string' ? text : null);
  if (!blob || blob.lifestyle === undefined) return { lifestyle: null, available: true, error: null };
  return { lifestyle: parseLifestyleHistory(blob.lifestyle), available: true, error: null };
}

export function saveLifestyleHistory(patientId: string, lifestyle: LifestyleHistory): Promise<LifestyleSaveResult> {
  return withPathwayDataLock(patientId, async () => {
    if (!supabase) return { available: false, error: 'Supabase not configured' };
    const { data, error } = await supabase
      .from('patients')
      .select(PATHWAY_DATA_COLUMN)
      .eq('id', patientId)
      .maybeSingle();
    if (error) {
      if (isMissingColumnError(error, [PATHWAY_DATA_COLUMN])) return { available: false, error: null };
      return { available: true, error: error.message, refused: isPermissionRefusal(error) };
    }
    const text = (data as Record<string, unknown> | null)?.[PATHWAY_DATA_COLUMN];
    const blob = parsePathwayBlob(typeof text === 'string' ? text : null);
    if (!blob) return { available: true, error: 'Stored pathway data is not valid JSON — lifestyle history not saved' };
    const { error: updateError } = await supabase
      .from('patients')
      .update({ [PATHWAY_DATA_COLUMN]: JSON.stringify(mergeLifestyleIntoBlob(blob, lifestyle)) })
      .eq('id', patientId);
    if (updateError) {
      if (isMissingColumnError(updateError, [PATHWAY_DATA_COLUMN])) return { available: false, error: null };
      console.error('[lifestyle] save:', updateError.message);
      return { available: true, error: updateError.message, refused: isPermissionRefusal(updateError) };
    }
    // Fixed labels only (no free text): which parts are recorded.
    logClinicalSave('autosave_lifestyle_history', 'patients', patientId, { recorded: isLifestyleRecorded(lifestyle) });
    return { available: true, error: null };
  });
}
