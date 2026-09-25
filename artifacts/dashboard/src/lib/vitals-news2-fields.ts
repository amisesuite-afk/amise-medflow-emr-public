/**
 * NEWS2 fields on the web `vitals` table: consciousness (ACVPU) and air / supplemental oxygen.
 *
 * Columns (Migration 91, `supabase-web-vitals-news2-fields-migration.sql`), named as on the iOS
 * `patient_vitals` table:
 *   vitals.avpu                text     'A' | 'C' | 'V' | 'P' | 'U', NULL = not recorded
 *   vitals.on_supplemental_o2  boolean  true = O₂, false = room air, NULL = not recorded
 *
 * In the dashboard's in-memory vitals (AppContext `VitalsState`, all strings) they are
 * `avpu` ('' | 'A'…'U') and `onSupplementalO2` ('' | 'air' | 'o2').
 *
 * Migration 91 is wired but may not be applied yet. Until it is, PostgREST rejects a write or
 * select that names these columns (42703 "column does not exist", or PGRST204 "could not find
 * the column in the schema cache"). Every read and write goes through the fallbacks below,
 * which retry once without the NEWS2 fields — the same approach as the iOS missing-column
 * fallbacks (SyncService+NEWS2Scale2.swift, SyncService+SoftDelete.swift) — so a save never
 * fails because of them, and the NEWS2 panel keeps its manual pickers.
 *
 * Display and entry only: nothing here scores, escalates or changes a threshold.
 */
import type { News2Avpu } from '@workspace/triage-engine';

export const VITALS_NEWS2_COLUMNS = ['avpu', 'on_supplemental_o2'] as const;
export type VitalsNews2Column = (typeof VITALS_NEWS2_COLUMNS)[number];

/** `patients.news2_spo2_scale2` (Migration 88) — the clinician's SpO₂ Scale 2 opt-in. */
export const PATIENT_NEWS2_SCALE2_COLUMN = 'news2_spo2_scale2';

/** The string the entry forms hold for air / oxygen. '' = not recorded. */
export type OxygenEntry = '' | 'air' | 'o2';

const AVPU_VALUES: readonly News2Avpu[] = ['A', 'C', 'V', 'P', 'U'];

/** 'A'…'U' (any case, surrounding space ignored) → the ACVPU letter; anything else → null. */
export function parseAvpu(v: unknown): News2Avpu | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toUpperCase();
  return (AVPU_VALUES as readonly string[]).includes(s) ? (s as News2Avpu) : null;
}

/**
 * Supplemental oxygen from a column value or an entry-form string.
 * true / 'o2' / 'true' → true; false / 'air' / 'false' → false; anything else → null
 * (not recorded — never silently "room air").
 */
export function parseOnSupplementalO2(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if (s === 'o2' || s === 'true') return true;
  if (s === 'air' || s === 'false') return false;
  return null;
}

/** boolean | null → the entry-form string. */
export function oxygenEntry(v: boolean | null | undefined): OxygenEntry {
  return v === true ? 'o2' : v === false ? 'air' : '';
}

export interface VitalsNews2Row {
  avpu?: News2Avpu;
  on_supplemental_o2?: boolean;
}

/**
 * Entry-form values → the columns to write. A field that was not recorded is left out
 * entirely (the column stays NULL), matching how the numeric vitals are written.
 */
export function news2FieldsToRow(avpu: unknown, onSupplementalO2: unknown): VitalsNews2Row {
  const row: VitalsNews2Row = {};
  const a = parseAvpu(avpu);
  if (a) row.avpu = a;
  const o2 = parseOnSupplementalO2(onSupplementalO2);
  if (o2 !== null) row.on_supplemental_o2 = o2;
  return row;
}

export interface VitalsNews2Values {
  avpu: News2Avpu | null;
  onSupplementalO2: boolean | null;
}

/** A `vitals` (or iOS `patient_vitals`) row → the NEWS2 values. Missing/invalid → null. */
export function news2FieldsFromRow(row: Record<string, unknown> | null | undefined): VitalsNews2Values {
  return {
    avpu: parseAvpu(row?.avpu),
    onSupplementalO2: parseOnSupplementalO2(row?.on_supplemental_o2),
  };
}

/**
 * Entry-form vitals (VitalsState strings) → the NEWS2 consciousness / oxygen options for
 * `scoreNews2` / `evaluateNews2`. '' stays null (not recorded → listed as missing).
 */
export function news2OptionsFromVitals(v: { avpu?: string; onSupplementalO2?: string }): {
  avpu: News2Avpu | null;
  onOxygen: boolean | null;
} {
  return { avpu: parseAvpu(v.avpu), onOxygen: parseOnSupplementalO2(v.onSupplementalO2) };
}

/**
 * SpO₂ Scale 2: the patient record's clinician opt-in when the dashboard can read it
 * (Migration 88), otherwise the manual opt-in on the panel. Never inferred from oxygen.
 */
export function resolveNews2Scale2(patient: { available: boolean; useScale2: boolean }, manual: boolean): boolean {
  return patient.available ? patient.useScale2 : manual;
}

export interface PgErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

/**
 * True when a PostgREST error says one of `columns` does not exist: 42703 (Postgres
 * undefined_column), PGRST204 (column not in the schema cache, on insert/update), or a
 * message naming the column. Anything else (RLS 42501, a CHECK failure, network) is false,
 * so it is reported as a real failure rather than retried.
 */
export function isMissingColumnError(err: unknown, columns: readonly string[]): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as PgErrorLike;
  const code = e.code ?? '';
  const text = `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`;
  const namesColumn = columns.some(c => new RegExp(`\\b${c}\\b`).test(text));
  if (code === '42703' || code === 'PGRST204') return true;
  return namesColumn && /column/i.test(text) && /(does not exist|could not find|schema cache)/i.test(text);
}

/** Returns a copy of `row` without the NEWS2 columns. */
export function withoutNews2Fields<T extends Record<string, unknown>>(row: T): T {
  const copy: Record<string, unknown> = { ...row };
  for (const c of VITALS_NEWS2_COLUMNS) delete copy[c];
  return copy as T;
}

function hasNews2Fields(row: Record<string, unknown>): boolean {
  return VITALS_NEWS2_COLUMNS.some(c => c in row);
}

/**
 * Writes `row` with `write` (e.g. `r => supabase.from('vitals').insert(r)`). If the server
 * does not have the NEWS2 columns yet, retries once without them so the rest of the vitals
 * still save. `droppedNews2Fields` tells the caller ACVPU / O₂ were not stored.
 */
export async function writeVitalsWithNews2Fallback<R extends Record<string, unknown>>(
  row: R,
  write: (row: R) => PromiseLike<{ error: PgErrorLike | null }>,
): Promise<{ error: PgErrorLike | null; droppedNews2Fields: boolean }> {
  const first = await write(row);
  if (!first.error) return { error: null, droppedNews2Fields: false };
  if (!hasNews2Fields(row) || !isMissingColumnError(first.error, VITALS_NEWS2_COLUMNS)) {
    return { error: first.error, droppedNews2Fields: false };
  }
  console.warn('[db] vitals: ACVPU / O₂ columns not on the server yet (Migration 91) — saving without them');
  const retry = await write(withoutNews2Fields(row));
  return { error: retry.error, droppedNews2Fields: !retry.error };
}

/**
 * Runs a read that selects the NEWS2 columns (`withNews2 = true`). If the server does not
 * have them yet, runs it again without them (`withNews2 = false`).
 */
export async function selectVitalsWithNews2Fallback<T>(
  run: (withNews2: boolean) => PromiseLike<{ data: T | null; error: PgErrorLike | null }>,
): Promise<{ data: T | null; error: PgErrorLike | null; news2Available: boolean }> {
  const first = await run(true);
  if (!first.error) return { data: first.data, error: null, news2Available: true };
  if (!isMissingColumnError(first.error, VITALS_NEWS2_COLUMNS)) {
    return { data: first.data, error: first.error, news2Available: true };
  }
  const retry = await run(false);
  return { data: retry.data, error: retry.error, news2Available: false };
}
