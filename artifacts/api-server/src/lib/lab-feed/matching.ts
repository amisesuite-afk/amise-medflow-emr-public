/**
 * Patient matching for inbound laboratory results — safety-critical.
 *
 * A report is attached automatically ONLY when:
 *   - the laboratory sent an MRN, and exactly one patient has that MRN (exact, as stored:
 *     trimmed, no case folding, no fuzzy or partial match), and
 *   - the laboratory sent a date of birth, and it equals that patient's date of birth.
 * Anything else goes to the "Results to reconcile" queue for a nurse, doctor or admin to match
 * by hand. Names are never used to attach (they are shown to the person reconciling).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeedPatientIdentity } from './types.js';

export interface PatientCandidate {
  id: string;
  mrn: string | null;
  date_of_birth: string | null;
  sex: string | null;
  full_name: string | null;
}

export type QueueReason = 'no_identifier' | 'mrn_not_found' | 'dob_missing' | 'dob_mismatch' | 'multiple_matches';

export type MatchDecision =
  | { kind: 'attach'; patient: PatientCandidate }
  | { kind: 'queue'; reason: QueueReason };

export const QUEUE_REASON_TEXT: Record<QueueReason, string> = {
  no_identifier: 'The laboratory sent no MRN',
  mrn_not_found: 'No patient has this MRN',
  dob_missing: 'The laboratory sent no date of birth',
  dob_mismatch: 'The date of birth does not match the patient with this MRN',
  multiple_matches: 'More than one patient has this MRN',
};

/** `withMrn`: every patient whose MRN equals identity.mrn exactly (the caller's query). */
export function decideMatch(identity: FeedPatientIdentity, withMrn: PatientCandidate[]): MatchDecision {
  const mrn = identity.mrn?.trim() ?? '';
  if (mrn === '') return { kind: 'queue', reason: 'no_identifier' };
  const exact = withMrn.filter(p => (p.mrn ?? '').trim() === mrn);
  if (exact.length === 0) return { kind: 'queue', reason: 'mrn_not_found' };
  if (exact.length > 1) return { kind: 'queue', reason: 'multiple_matches' };
  if (!identity.dob) return { kind: 'queue', reason: 'dob_missing' };
  const dob = (exact[0].date_of_birth ?? '').slice(0, 10);
  if (dob === '' || dob !== identity.dob) return { kind: 'queue', reason: 'dob_mismatch' };
  return { kind: 'attach', patient: exact[0] };
}

export async function findPatientsByMrn(supa: SupabaseClient, mrn: string | null): Promise<PatientCandidate[]> {
  const m = mrn?.trim() ?? '';
  if (m === '') return [];
  const { data, error } = await supa
    .from('patients')
    .select('id, mrn, date_of_birth, sex, full_name')
    .eq('mrn', m)
    .limit(5);
  if (error) throw error;
  return (data ?? []) as PatientCandidate[];
}

/** Masked identifier for logs and alerts: "…0123". */
export function maskMrn(mrn: string | null | undefined): string {
  const m = (mrn ?? '').trim();
  return m.length <= 4 ? '…' : `…${m.slice(-4)}`;
}
