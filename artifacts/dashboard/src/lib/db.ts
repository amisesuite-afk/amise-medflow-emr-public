/**
 * Database operations layer — all Supabase DML in one place.
 * Never imported by triage/scoring logic — only by UI components.
 */

import { supabase, type SiteCode } from './supabase';

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
  site?: SiteCode;
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
  if (input.site) row.site = input.site;

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

// ─── updateDefaultSite ───────────────────────────────────────────────────────

/**
 * Writes the user's chosen site back to user_profiles.default_site.
 * Called by AppContext on an explicit site switch (debounced).
 */
export async function updateDefaultSite(userId: string, site: SiteCode): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('user_profiles')
    .update({ default_site: site })
    .eq('id', userId);
  if (error) console.error('[db] updateDefaultSite:', error.message);
}

// ─── listPatientsBySite ───────────────────────────────────────────────────────

/**
 * Returns patients who have at least one encounter at the given site,
 * PLUS patients whose encounters have a null site (legacy / pre-site-tracking data).
 * Patients with no encounters at all only appear under "All locations".
 */
export async function listPatientsBySite(
  site: SiteCode,
): Promise<{ patients: PatientListRow[]; error: null } | { patients: null; error: string }> {
  if (!supabase) return { patients: null, error: notConfigured('listPatientsBySite') };

  // Include: encounters tagged to this site, OR encounters with no site set (legacy rows).
  const { data: encRows, error: encErr } = await supabase
    .from('encounters')
    .select('patient_id')
    .or(`site.eq.${site},site.is.null`);

  if (encErr) {
    console.error('[db] listPatientsBySite encounters:', encErr);
    return { patients: null, error: encErr.message };
  }

  const ids = [...new Set((encRows ?? []).map((r: { patient_id: string }) => r.patient_id))];
  if (ids.length === 0) return { patients: [], error: null };

  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, sex, phone, date_of_birth, created_at')
    .in('id', ids)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[db] listPatientsBySite patients:', error);
    return { patients: null, error: error.message };
  }

  return { patients: (data ?? []) as PatientListRow[], error: null };
}

// ─── loadPMH ─────────────────────────────────────────────────────────────────

export async function loadPMH(
  patientId: string,
): Promise<{ conditions: string[]; error: string | null }> {
  if (!supabase) return { conditions: [], error: notConfigured('loadPMH') };

  const { data, error } = await supabase
    .from('pmh_items')
    .select('condition')
    .eq('patient_id', patientId)
    .eq('status', 'active');

  if (error) {
    // Table does not exist yet (PG code 42P01) — warn silently, return empty
    if ((error as { code?: string }).code === '42P01') {
      console.warn('[db] loadPMH: pmh_items table does not exist yet — skipping');
      return { conditions: [], error: null };
    }
    console.error('[db] loadPMH:', error);
    return { conditions: [], error: error.message };
  }

  return {
    conditions: (data ?? []).map((r: { condition: string }) => r.condition),
    error: null,
  };
}

// ─── savePMHItem ──────────────────────────────────────────────────────────────

/**
 * Upserts on (patient_id, condition). If a 'resolved' row already exists it
 * becomes 'active' again; if 'active' already it's a no-op.
 * Requires a UNIQUE constraint on (patient_id, condition) in pmh_items.
 */
export async function savePMHItem(
  patientId: string,
  encounterId: string | null,
  condition: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('savePMHItem') };

  const row: Record<string, unknown> = {
    patient_id: patientId,
    condition,
    status: 'active',
  };
  if (encounterId) row.encounter_id = encounterId;

  const { error } = await supabase
    .from('pmh_items')
    .upsert(row, { onConflict: 'patient_id,condition' });

  if (error) {
    console.error('[db] savePMHItem:', error);
    return { error: error.message };
  }

  return { error: null };
}

// ─── removePMHItem ────────────────────────────────────────────────────────────

/** Soft-delete: sets status = 'resolved'. Does not delete the row. */
export async function removePMHItem(
  patientId: string,
  condition: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('removePMHItem') };

  const { error } = await supabase
    .from('pmh_items')
    .update({ status: 'resolved' })
    .eq('patient_id', patientId)
    .eq('condition', condition);

  if (error) {
    console.error('[db] removePMHItem:', error);
    return { error: error.message };
  }

  return { error: null };
}

// ─── savePmhNotes ─────────────────────────────────────────────────────────────

/** Writes pmh_notes and family_history_notes to the patients row. */
export async function savePmhNotes(
  patientId: string,
  pmhNotes: string,
  familyHistoryNotes: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('savePmhNotes') };

  const { error } = await supabase
    .from('patients')
    .update({
      pmh_notes: pmhNotes || null,
      family_history_notes: familyHistoryNotes || null,
    })
    .eq('id', patientId);

  if (error) {
    console.error('[db] savePmhNotes:', error);
    return { error: error.message };
  }

  return { error: null };
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
