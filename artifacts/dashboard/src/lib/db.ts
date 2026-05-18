/**
 * Database operations layer — all Supabase DML in one place.
 * Never imported by triage/scoring logic — only by UI components.
 */

import { supabase } from './supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converts age in years → ISO date string "YYYY-01-01" (Jan 1 approximation). */
function ageToDob(age: string): string | null {
  const n = parseInt(age, 10);
  if (!Number.isFinite(n) || n < 0 || n > 150) return null;
  return `${new Date().getFullYear() - n}-01-01`;
}

function notConfigured(fn: string) {
  const msg = `Supabase not configured — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. (${fn})`;
  console.error('[db]', msg);
  return msg;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NewPatientInput {
  full_name: string;
  age: string;
  sex: string;
  phone: string;
}

export interface SavedPatient {
  id: string;
  full_name: string;
}

export interface NewEncounterInput {
  patient_id: string;
  chief_complaint?: string;
}

export interface SavedEncounter {
  id: string;
}

export interface PatientListRow {
  id: string;
  full_name: string | null;
  sex: string | null;
  phone: string | null;
  date_of_birth: string | null;
  created_at: string | null;
}

// ─── saveNewPatient ───────────────────────────────────────────────────────────

export async function saveNewPatient(
  input: NewPatientInput,
): Promise<{ patient: SavedPatient; error: null } | { patient: null; error: string }> {
  if (!supabase) return { patient: null, error: notConfigured('saveNewPatient') };

  const row: Record<string, unknown> = {
    full_name: input.full_name.trim(),
    sex: input.sex || 'unknown',
  };

  const dob = ageToDob(input.age);
  if (dob) row.date_of_birth = dob;
  if (input.phone.trim()) row.phone = input.phone.trim();

  const { data, error } = await supabase
    .from('patients')
    .insert(row)
    .select('id, full_name')
    .single();

  if (error) {
    console.error('[db] saveNewPatient:', error);
    return { patient: null, error: error.message };
  }

  return { patient: data as SavedPatient, error: null };
}

// ─── createEncounter ──────────────────────────────────────────────────────────

export async function createEncounter(
  input: NewEncounterInput,
): Promise<{ encounter: SavedEncounter; error: null } | { encounter: null; error: string }> {
  if (!supabase) return { encounter: null, error: notConfigured('createEncounter') };

  const row: Record<string, unknown> = {
    patient_id: input.patient_id,
    status: 'open',
    encounter_type: 'outpatient',
  };

  if (input.chief_complaint?.trim()) row.chief_complaint = input.chief_complaint.trim();

  const { data, error } = await supabase
    .from('encounters')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error('[db] createEncounter:', error);
    return { encounter: null, error: error.message };
  }

  return { encounter: data as SavedEncounter, error: null };
}

// ─── listPatients ─────────────────────────────────────────────────────────────

export async function listPatients(): Promise<
  { patients: PatientListRow[]; error: null } | { patients: null; error: string }
> {
  if (!supabase) return { patients: null, error: notConfigured('listPatients') };

  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, sex, phone, date_of_birth, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[db] listPatients:', error);
    return { patients: null, error: error.message };
  }

  return { patients: (data ?? []) as PatientListRow[], error: null };
}

// ─── getLatestOpenEncounter ───────────────────────────────────────────────────

export async function getLatestOpenEncounter(
  patient_id: string,
): Promise<{ encounterId: string | null; error: string | null }> {
  if (!supabase) return { encounterId: null, error: notConfigured('getLatestOpenEncounter') };

  const { data, error } = await supabase
    .from('encounters')
    .select('id')
    .eq('patient_id', patient_id)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[db] getLatestOpenEncounter:', error);
    return { encounterId: null, error: error.message };
  }

  return { encounterId: (data as { id: string } | null)?.id ?? null, error: null };
}
