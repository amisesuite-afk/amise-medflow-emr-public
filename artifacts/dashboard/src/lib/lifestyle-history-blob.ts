/**
 * Pure helpers for the `patients.pathway_data_json` blob (iOS PathwayData), kept apart from
 * lifestyle-history-db.ts so they can be tested without a Supabase client.
 */
import type { LifestyleHistory } from '@workspace/triage-engine/lifestyle-practices';

/** The stored blob as an object, `{}` when empty, or null when it is not a JSON object. */
export function parsePathwayBlob(text: string | null | undefined): Record<string, unknown> | null {
  if (text === null || text === undefined || text.trim() === '') return {};
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** The blob with `lifestyle` replaced (every other key kept as it was). */
export function mergeLifestyleIntoBlob(blob: Record<string, unknown>, lifestyle: LifestyleHistory): Record<string, unknown> {
  return { ...blob, lifestyle };
}
