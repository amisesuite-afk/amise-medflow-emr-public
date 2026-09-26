/**
 * Outcomes loop — dashboard reads and writes of prediction_snapshots / diagnosis_outcomes
 * (Migration 94). RLS lets nurse, doctor and admin read and write; front desk sees nothing.
 *
 * Tolerates the tables being absent (Migration 94 not yet applied on production): every call
 * returns `available: false` / status 'unavailable' instead of throwing, and the UI says the
 * feature is available after the database update. Nothing is queued: a final diagnosis that
 * could not be saved is reported to the clinician on the spot, never dropped silently. Nothing
 * is kept in localStorage (no new PHI key; lib/phi-storage.ts unchanged).
 */
import { supabase } from '@/lib/supabase';
import {
  outcomeToRow, rowToOutcome, rowToSnapshot,
} from '@workspace/triage-engine/outcomes';
import type {
  DiagnosisOutcomeRow, FinalDiagnosis, PredictionSnapshot, PredictionSnapshotRow,
} from '@workspace/triage-engine/outcomes';

/** 42P01 undefined_table, PGRST205 not in the schema cache, PGRST204/42703 unknown column. */
export function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST204' || code === '42703';
}

export interface StoredSnapshot extends PredictionSnapshot {
  id: string | null;
  patientId: string;
  encounterId: string | null;
}

export interface StoredOutcome extends FinalDiagnosis {
  id: string | null;
  patientId: string;
}

export interface OutcomeData {
  available: boolean;
  snapshots: StoredSnapshot[];
  outcomes: StoredOutcome[];
  error: string | null;
}

const EMPTY = (available: boolean, error: string | null = null): OutcomeData => ({ available, snapshots: [], outcomes: [], error });

function toStoredSnapshot(r: PredictionSnapshotRow): StoredSnapshot | null {
  const s = rowToSnapshot(r);
  return s ? { ...s, id: r.id ?? null, patientId: r.patient_id, encounterId: r.encounter_id ?? null } : null;
}

function toStoredOutcome(r: DiagnosisOutcomeRow): StoredOutcome | null {
  const o = rowToOutcome(r);
  return o ? { ...o, id: r.id ?? null, patientId: r.patient_id } : null;
}

const PAGE = 1000;

async function fetchRows<T>(table: string, patientId: string | null): Promise<{ rows: T[]; error: unknown }> {
  if (!supabase) return { rows: [], error: { message: 'Supabase not configured' } };
  const rows: T[] = [];
  for (let from = 0; from < 20_000; from += PAGE) {
    let q = supabase.from(table).select('*').order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    if (patientId) q = q.eq('patient_id', patientId);
    const { data, error } = await q;
    if (error) return { rows, error };
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: null };
}

/** Snapshots and final diagnoses for one patient (patientId) or for everyone (null, admin page). */
export async function loadOutcomeData(patientId: string | null): Promise<OutcomeData> {
  try {
    const snaps = await fetchRows<PredictionSnapshotRow>('prediction_snapshots', patientId);
    if (snaps.error) return isMissingTable(snaps.error) ? EMPTY(false) : EMPTY(true, errorText(snaps.error));
    const outs = await fetchRows<DiagnosisOutcomeRow>('diagnosis_outcomes', patientId);
    if (outs.error) return isMissingTable(outs.error) ? EMPTY(false) : EMPTY(true, errorText(outs.error));
    return {
      available: true,
      snapshots: snaps.rows.map(toStoredSnapshot).filter((x): x is StoredSnapshot => !!x),
      outcomes: outs.rows.map(toStoredOutcome).filter((x): x is StoredOutcome => !!x),
      error: null,
    };
  } catch (e) {
    return EMPTY(true, errorText(e));
  }
}

export type SaveOutcomeStatus = 'saved' | 'duplicate' | 'refused' | 'unavailable' | 'failed';

function errorText(e: unknown): string {
  return (e as { message?: string } | null)?.message ?? 'Unknown error';
}

function saveStatus(error: unknown): SaveOutcomeStatus {
  const code = (error as { code?: unknown } | null)?.code;
  if (isMissingTable(error)) return 'unavailable';
  if (code === '23505') return 'duplicate';
  if (code === '42501') return 'refused';
  return 'failed';
}

/**
 * Confirms a final diagnosis. `clientRef` (made once per form) makes a double tap or a retry
 * idempotent (unique index); a second confirmed diagnosis for the same encounter is refused by
 * the database (retract the first one).
 */
export async function saveFinalDiagnosis(args: {
  diagnosis: FinalDiagnosis; patientId: string; encounterId: string | null; clientRef: string; userId: string | null;
}): Promise<{ status: SaveOutcomeStatus; error: string | null }> {
  if (!supabase) return { status: 'failed', error: 'Supabase not configured' };
  const row = outcomeToRow(args.diagnosis, args.patientId, args.encounterId, args.clientRef, args.userId);
  try {
    const { error } = await supabase.from('diagnosis_outcomes').insert(row);
    if (!error) return { status: 'saved', error: null };
    return { status: saveStatus(error), error: errorText(error) };
  } catch (e) {
    return { status: 'failed', error: errorText(e) };
  }
}

/** Retracts a confirmed final diagnosis (the row is kept; only its status changes). */
export async function retractFinalDiagnosis(id: string, userId: string | null): Promise<{ status: SaveOutcomeStatus; error: string | null }> {
  if (!supabase) return { status: 'failed', error: 'Supabase not configured' };
  try {
    const { data, error } = await supabase
      .from('diagnosis_outcomes')
      .update({ status: 'retracted', retracted_at: new Date().toISOString(), retracted_by: userId })
      .eq('id', id)
      .eq('status', 'confirmed')
      .select('id');
    if (error) return { status: saveStatus(error), error: errorText(error) };
    // RLS filters an UPDATE silently: no row back means it was not applied.
    return Array.isArray(data) && data.length > 0 ? { status: 'saved', error: null } : { status: 'refused', error: 'Not permitted, or already retracted' };
  } catch (e) {
    return { status: 'failed', error: errorText(e) };
  }
}

export const SAVE_STATUS_TEXT: Record<SaveOutcomeStatus, string> = {
  saved: 'Saved.',
  duplicate: 'A final diagnosis is already confirmed for this encounter. Retract it first to record a different one.',
  refused: 'Not saved: recording a final diagnosis needs a nurse, doctor or admin account.',
  unavailable: 'Not saved: final-diagnosis recording becomes available after the database update (Migration 94).',
  failed: 'Not saved: the database could not be reached. Please try again.',
};
