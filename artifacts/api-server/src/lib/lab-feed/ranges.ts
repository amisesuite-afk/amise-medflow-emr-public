/**
 * Practice reference ranges for the API server (lab_reference_ranges, Migration 96). Missing
 * table → no practice rows: every lookup falls back to the built-in defaults.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { rowToReferenceRange, type ReferenceRange, type ReferenceRangeRow } from '@workspace/triage-engine/reference-ranges';
import { isMissingTableError } from '../prediction-snapshots.js';
import { logger } from '../logger.js';

let cache: { at: number; ranges: ReferenceRange[] } | null = null;
const TTL_MS = 60_000;

export function _clearRangeCache(): void {
  cache = null;
}

export async function loadPracticeRanges(supa: SupabaseClient, nowMs = Date.now()): Promise<ReferenceRange[]> {
  if (cache && nowMs - cache.at < TTL_MS) return cache.ranges;
  try {
    const { data, error } = await supa.from('lab_reference_ranges').select('*').is('retired_at', null);
    if (error) {
      if (!isMissingTableError(error)) logger.warn({ code: (error as { code?: string }).code }, '[lab-feed] reference ranges unreadable — using defaults');
      return [];
    }
    const ranges = ((data ?? []) as ReferenceRangeRow[])
      .map(rowToReferenceRange)
      .filter((r): r is ReferenceRange => r !== null && !r.isDefault);
    cache = { at: nowMs, ranges };
    return ranges;
  } catch (err) {
    logger.warn({ err }, '[lab-feed] reference ranges threw — using defaults');
    return [];
  }
}
