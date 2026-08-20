/**
 * Database operations layer — all Supabase DML in one place.
 * Never imported by triage/scoring logic — only by UI components.
 */

import { supabase, type SiteCode } from './supabase';
import { getApiOrigin } from './api-origin';
import { staffAuthHeaders } from './staff-auth';

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

export interface FullPatientInput {
  full_name: string;
  age: string;
  dob: string;
  sex: string;
  phone: string;
  email: string;
  address: string;
  quarter: string;
  referredBy: string;
  insuranceProvider: string;
  policyNumber: string;
  nhiNumber: string;
  preAuthStatus: string;
  occupation?: string;
  nokName?: string;
  nokRelation?: string;
  nokTel?: string;
}

export interface VitalsInput {
  encounter_id: string;
  patient_id: string;
  systolicBp: string;
  diastolicBp: string;
  heartRate: string;
  temperatureC: string;
  respiratoryRate: string;
  spo2: string;
  glucoseMmol: string;
  weightKg: string;
  heightCm: string;
}

export interface AssessmentInput {
  encounter_id: string;
  patient_id: string;
  diagnosis: string;
  differentials: string;
  icdCodes: string[];
  cptCodes: string[];
  acuity: string;
  triageScore: number;
}

export interface PlanInput {
  encounter_id: string;
  patient_id: string;
  description: string;
}

export interface PatientListRow {
  id: string;
  full_name: string | null;
  sex: string | null;
  phone: string | null;
  date_of_birth: string | null;
  created_at: string | null;
  latest_encounter_status?: string | null;
  latest_encounter_type?: string | null;
  latest_encounter_site?: string | null;
  latest_encounter_date?: string | null;
}

// ─── savePatientFull ──────────────────────────────────────────────────────────

/** Creates a patient row from the full receptionist form. */
export async function savePatientFull(
  input: FullPatientInput,
): Promise<{ patient: SavedPatient; error: null } | { patient: null; error: string }> {
  try {
    const base = getApiOrigin();
    const authHeaders = await staffAuthHeaders();
    const body: Record<string, unknown> = {
      fullName: input.full_name.trim(),
      sex: input.sex || 'unknown',
    };
    if (input.dob) body.dateOfBirth = input.dob;
    else { const d = ageToDob(input.age); if (d) body.dateOfBirth = d; }
    if (input.phone.trim())              body.phone              = input.phone.trim();
    if (input.email.trim())              body.email              = input.email.trim();
    if (input.address.trim())            body.address            = input.address.trim();
    if (input.quarter.trim())            body.quarter            = input.quarter.trim();
    if (input.referredBy.trim())         body.referredBy         = input.referredBy.trim();
    if (input.insuranceProvider.trim())  body.insuranceProvider  = input.insuranceProvider.trim();
    if (input.policyNumber.trim())       body.policyNumber       = input.policyNumber.trim();
    if (input.nhiNumber.trim())          body.nhiNumber          = input.nhiNumber.trim();
    if (input.preAuthStatus)             body.preAuthStatus      = input.preAuthStatus;
    if (input.occupation?.trim())        body.occupation         = input.occupation.trim();
    if (input.nokName?.trim())           body.nokName            = input.nokName.trim();
    if (input.nokRelation && input.nokRelation !== 'Other') body.nokRelation = input.nokRelation;
    if (input.nokTel?.trim())            body.nokTel             = input.nokTel.trim();

    const res = await fetch(`${base}/api/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => `HTTP ${res.status}`);
      return { patient: null, error: txt };
    }
    const json = await res.json() as { patient: SavedPatient };
    return { patient: json.patient, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'savePatientFull failed';
    console.error('[db] savePatientFull:', msg);
    return { patient: null, error: msg };
  }
}

// ─── uploadPatientPhoto ───────────────────────────────────────────────────────

/** Uploads a base64 data-URL photo to the patient-photos bucket and writes
 *  the resulting public URL back to patients.photo_url. Returns the URL on
 *  success, null if the bucket doesn't exist or upload fails (non-fatal). */
export async function uploadPatientPhoto(
  patientId: string,
  dataUrl: string,
): Promise<string | null> {
  if (!supabase || !dataUrl.startsWith('data:')) return null;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const path = `${patientId}/id-photo.jpg`;
    const { error: upErr } = await supabase.storage
      .from('patient-photos')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (upErr) {
      console.warn('[db] uploadPatientPhoto:', upErr.message);
      return null;
    }
    const { data: { publicUrl } } = supabase.storage.from('patient-photos').getPublicUrl(path);
    await supabase.from('patients').update({ photo_url: publicUrl }).eq('id', patientId);
    return publicUrl;
  } catch {
    return null;
  }
}

// ─── saveVitals ───────────────────────────────────────────────────────────────

export async function saveVitals(
  input: VitalsInput,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('saveVitals') };

  function n(v: string): number | null {
    const parsed = parseFloat(v);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function i(v: string): number | null {
    const parsed = parseInt(v, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const row: Record<string, unknown> = {
    encounter_id:       input.encounter_id,
    patient_id:         input.patient_id,
    bp_systolic:        i(input.systolicBp),
    bp_diastolic:       i(input.diastolicBp),
    heart_rate:         i(input.heartRate),
    temperature_c:      n(input.temperatureC),
    oxygen_saturation:  i(input.spo2),
    respiratory_rate:   i(input.respiratoryRate),
    glucose_mmol:       n(input.glucoseMmol),
    weight_kg:          n(input.weightKg),
    height_cm:          n(input.heightCm),
  };

  // Strip null fields
  Object.keys(row).forEach(k => { if (row[k] === null) delete row[k]; });

  const { error } = await supabase.from('vitals').insert(row);
  if (error) { console.error('[db] saveVitals:', error); return { error: error.message }; }
  return { error: null };
}

// ─── saveSymptoms ─────────────────────────────────────────────────────────────

export async function saveSymptoms(
  encounterId: string,
  patientId: string,
  symptoms: string[],
  notes: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('saveSymptoms') };

  const rows = symptoms.map(s => ({
    encounter_id: encounterId,
    patient_id:   patientId,
    symptom:      s,
  }));

  if (notes.trim()) {
    rows.push({ encounter_id: encounterId, patient_id: patientId, symptom: '[notes] ' + notes.trim() });
  }

  if (rows.length === 0) return { error: null };

  const { error } = await supabase.from('symptoms').insert(rows);
  if (error) { console.error('[db] saveSymptoms:', error); return { error: error.message }; }
  return { error: null };
}

// ─── saveAllergyFreeText ──────────────────────────────────────────────────────

/** Stores the nurse's free-text allergy field as a single row for the trial. */
export async function saveAllergyFreeText(
  patientId: string,
  text: string,
): Promise<{ error: string | null }> {
  if (!supabase || !text.trim()) return { error: null };

  const { error } = await supabase.from('allergies').insert({
    patient_id: patientId,
    allergen:   text.trim(),
    status:     'active',
  });
  if (error) { console.error('[db] saveAllergyFreeText:', error); return { error: error.message }; }
  return { error: null };
}

// ─── saveAssessment ───────────────────────────────────────────────────────────

// Optimistic-locking result shape shared by saveAssessment/savePlan (the
// pilot tables for real conflict detection — see db.ts's module comment
// near syncMedicationList etc. for the other write functions still on plain
// last-write-wins). `conflict` is populated when the row was changed by
// someone else since the caller's `expectedUpdatedAt` was captured — the
// caller's write was NOT applied in that case. `updatedAt` on success is the
// new version the caller should remember for its next save.
export interface AssessmentSaveResult {
  error: string | null;
  updatedAt?: string;
  conflict?: { latestUpdatedAt: string; latestDiagnosis: string | null; latestDifferentials: string | null };
}

export interface PlanSaveResult {
  error: string | null;
  updatedAt?: string;
  conflict?: { latestUpdatedAt: string; latestDescription: string | null };
}

export async function saveAssessment(
  input: AssessmentInput,
  expectedUpdatedAt: string | null,
): Promise<AssessmentSaveResult> {
  if (!supabase) return { error: notConfigured('saveAssessment') };

  const row: Record<string, unknown> = {
    encounter_id:  input.encounter_id,
    patient_id:    input.patient_id,
    diagnosis:     input.diagnosis || null,
    differentials: input.differentials || null,
    icd10_code:    input.icdCodes.join(', ') || null,
    acuity:        input.acuity || 'routine',
    triage_score:  input.triageScore || 0,
    notes:         input.cptCodes.length ? 'CPT: ' + input.cptCodes.join(', ') : null,
  };

  const { data: existing, error: findErr } = await supabase
    .from('assessments')
    .select('id, updated_at, diagnosis, differentials')
    .eq('encounter_id', input.encounter_id)
    .maybeSingle();

  if (findErr) { console.error('[db] saveAssessment (find):', findErr); return { error: findErr.message }; }

  if (!existing) {
    const { data: inserted, error } = await supabase.from('assessments').insert(row).select('updated_at').single();
    if (error) { console.error('[db] saveAssessment (insert):', error); return { error: error.message }; }
    logClinicalSave('autosave_assessment', 'assessments', input.encounter_id, { icd10: input.icdCodes.join(', ') || null });
    return { error: null, updatedAt: (inserted as { updated_at: string }).updated_at };
  }

  if (expectedUpdatedAt === null || expectedUpdatedAt !== existing.updated_at) {
    return {
      error: null,
      conflict: {
        latestUpdatedAt: existing.updated_at as string,
        latestDiagnosis: existing.diagnosis as string | null,
        latestDifferentials: existing.differentials as string | null,
      },
    };
  }

  const { data: updatedRows, error: updateErr } = await supabase
    .from('assessments')
    .update(row)
    .eq('id', existing.id)
    .eq('updated_at', existing.updated_at)
    .select('updated_at');

  if (updateErr) { console.error('[db] saveAssessment (update):', updateErr); return { error: updateErr.message }; }

  if (!updatedRows || updatedRows.length === 0) {
    // Someone else's update landed between our SELECT and this UPDATE.
    const { data: latest } = await supabase
      .from('assessments').select('updated_at, diagnosis, differentials').eq('id', existing.id).maybeSingle();
    return {
      error: null,
      conflict: {
        latestUpdatedAt: (latest?.updated_at as string | undefined) ?? (existing.updated_at as string),
        latestDiagnosis: (latest?.diagnosis as string | null | undefined) ?? (existing.diagnosis as string | null),
        latestDifferentials: (latest?.differentials as string | null | undefined) ?? (existing.differentials as string | null),
      },
    };
  }

  logClinicalSave('autosave_assessment', 'assessments', input.encounter_id, { icd10: input.icdCodes.join(', ') || null });
  return { error: null, updatedAt: (updatedRows[0] as { updated_at: string }).updated_at };
}

// ─── savePlan ─────────────────────────────────────────────────────────────────

export async function savePlan(
  input: PlanInput,
  expectedUpdatedAt: string | null,
): Promise<PlanSaveResult> {
  if (!supabase) return { error: notConfigured('savePlan') };

  const { data: existing, error: findErr } = await supabase
    .from('plans')
    .select('id, updated_at, description')
    .eq('encounter_id', input.encounter_id)
    .eq('plan_type', 'management')
    .maybeSingle();

  if (findErr) { console.error('[db] savePlan (find):', findErr); return { error: findErr.message }; }

  const row = {
    encounter_id: input.encounter_id,
    patient_id:   input.patient_id,
    plan_type:    'management',
    description:  input.description || null,
  };

  if (!existing) {
    const { data: inserted, error } = await supabase.from('plans').insert(row).select('updated_at').single();
    if (error) { console.error('[db] savePlan (insert):', error); return { error: error.message }; }
    logClinicalSave('autosave_plan', 'plans', input.encounter_id, { chars: input.description?.length ?? 0 });
    return { error: null, updatedAt: (inserted as { updated_at: string }).updated_at };
  }

  if (expectedUpdatedAt === null || expectedUpdatedAt !== existing.updated_at) {
    return {
      error: null,
      conflict: {
        latestUpdatedAt: existing.updated_at as string,
        latestDescription: existing.description as string | null,
      },
    };
  }

  const { data: updatedRows, error: updateErr } = await supabase
    .from('plans')
    .update(row)
    .eq('id', existing.id)
    .eq('updated_at', existing.updated_at)
    .select('updated_at');

  if (updateErr) { console.error('[db] savePlan (update):', updateErr); return { error: updateErr.message }; }

  if (!updatedRows || updatedRows.length === 0) {
    const { data: latest } = await supabase.from('plans').select('updated_at, description').eq('id', existing.id).maybeSingle();
    return {
      error: null,
      conflict: {
        latestUpdatedAt: (latest?.updated_at as string | undefined) ?? (existing.updated_at as string),
        latestDescription: (latest?.description as string | null | undefined) ?? (existing.description as string | null),
      },
    };
  }

  logClinicalSave('autosave_plan', 'plans', input.encounter_id, { chars: input.description?.length ?? 0 });
  return { error: null, updatedAt: (updatedRows[0] as { updated_at: string }).updated_at };
}

// ─── saveNewPatient ───────────────────────────────────────────────────────────

export async function saveNewPatient(
  input: NewPatientInput,
): Promise<{ patient: SavedPatient; error: null } | { patient: null; error: string }> {
  try {
    const base = getApiOrigin();
    const authHeaders = await staffAuthHeaders();
    const body: Record<string, unknown> = {
      fullName: input.full_name.trim(),
      sex: input.sex || 'unknown',
    };
    const dob = ageToDob(input.age);
    if (dob) body.dateOfBirth = dob;
    if (input.phone.trim()) body.phone = input.phone.trim();

    const res = await fetch(`${base}/api/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => `HTTP ${res.status}`);
      return { patient: null, error: txt };
    }
    const json = await res.json() as { patient: SavedPatient };
    const saved = json.patient;

    // Fire-and-forget duplicate check (best-effort, non-blocking)
    fetch(`${base}/api/patient/check-duplicates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ patientId: saved.id }),
    }).catch(e => console.warn('[db] duplicate check failed:', e));

    return { patient: saved, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'saveNewPatient failed';
    console.error('[db] saveNewPatient:', msg);
    return { patient: null, error: msg };
  }
}

// ─── createEncounter ──────────────────────────────────────────────────────────

export async function createEncounter(
  input: NewEncounterInput,
): Promise<{ encounter: SavedEncounter; error: null } | { encounter: null; error: string }> {
  try {
    const base = getApiOrigin();
    const headers = await staffAuthHeaders();
    const body: Record<string, unknown> = { patientId: input.patient_id };
    if (input.chief_complaint?.trim()) body.chiefComplaint = input.chief_complaint.trim();
    if (input.site) body.site = input.site;

    const res = await fetch(`${base}/api/encounters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => `HTTP ${res.status}`);
      return { encounter: null, error: txt };
    }
    const json = await res.json() as { encounter: SavedEncounter };
    return { encounter: json.encounter, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'createEncounter failed';
    console.error('[db] createEncounter:', msg);
    return { encounter: null, error: msg };
  }
}

// ─── listPatients ─────────────────────────────────────────────────────────────

export async function listPatients(): Promise<
  { patients: PatientListRow[]; error: null } | { patients: null; error: string }
> {
  try {
    const base = getApiOrigin();
    const headers = await staffAuthHeaders();
    const res = await fetch(`${base}/api/patients?limit=100`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { patients: PatientListRow[] };
    return { patients: json.patients ?? [], error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'listPatients failed';
    console.error('[db] listPatients:', msg);
    return { patients: null, error: msg };
  }
}

// ─── searchPatients ───────────────────────────────────────────────────────────

/** Full-text search on full_name (ilike) and phone (ilike).
 *  Returns up to 20 matches ordered by most recently registered. */
export async function searchPatients(query: string): Promise<PatientListRow[]> {
  if (!query.trim()) return [];
  try {
    const base = getApiOrigin();
    const headers = await staffAuthHeaders();
    const res = await fetch(`${base}/api/patients?q=${encodeURIComponent(query.trim())}&limit=20`, { headers });
    if (!res.ok) return [];
    const json = await res.json() as { patients: PatientListRow[] };
    return json.patients ?? [];
  } catch {
    return [];
  }
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
  try {
    const base = getApiOrigin();
    const headers = await staffAuthHeaders();
    const res = await fetch(`${base}/api/patients?site=${encodeURIComponent(site)}&limit=100`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { patients: PatientListRow[] };
    return { patients: json.patients ?? [], error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'listPatientsBySite failed';
    console.error('[db] listPatientsBySite:', msg);
    return { patients: null, error: msg };
  }
}

// ─── loadPMH ─────────────────────────────────────────────────────────────────

export async function loadPMH(
  patientId: string,
): Promise<{ conditions: string[]; error: string | null }> {
  try {
    const base = getApiOrigin();
    const headers = await staffAuthHeaders();
    const res = await fetch(`${base}/api/problems/${encodeURIComponent(patientId)}?status=active`, { headers });
    if (!res.ok) {
      const txt = await res.text().catch(() => `HTTP ${res.status}`);
      console.error('[db] loadPMH:', txt);
      return { conditions: [], error: txt };
    }
    const json = await res.json() as { problems: Array<{ condition: string }> };
    return { conditions: (json.problems ?? []).map(p => p.condition), error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'loadPMH failed';
    console.error('[db] loadPMH:', msg);
    return { conditions: [], error: msg };
  }
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
  try {
    const base = getApiOrigin();
    const headers = await staffAuthHeaders();
    const body: Record<string, unknown> = { patientId, condition };
    if (encounterId) body.encounterId = encounterId;
    const res = await fetch(`${base}/api/problems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => `HTTP ${res.status}`);
      console.error('[db] savePMHItem:', txt);
      return { error: txt };
    }
    return { error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'savePMHItem failed';
    console.error('[db] savePMHItem:', msg);
    return { error: msg };
  }
}

// ─── removePMHItem ────────────────────────────────────────────────────────────

/** Soft-delete: sets status = 'resolved' via API. Does not delete the row. */
export async function removePMHItem(
  patientId: string,
  condition: string,
): Promise<{ error: string | null }> {
  try {
    const base = getApiOrigin();
    const headers = await staffAuthHeaders();
    const res = await fetch(`${base}/api/problems/resolve-condition`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ patientId, condition }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => `HTTP ${res.status}`);
      console.error('[db] removePMHItem:', txt);
      return { error: txt };
    }
    return { error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'removePMHItem failed';
    console.error('[db] removePMHItem:', msg);
    return { error: msg };
  }
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
  logClinicalSave('autosave_pmh', 'patients', patientId);
  return { error: null };
}

// ─── upsertDraftNote ────────────────────────────────────────────────────────

/**
 * Updates the current DRAFT clinical_notes row for this encounter+prefix in
 * place, or inserts a new one if none exists. Never touches a SIGNED row —
 * once an encounter closes, its notes are signed by /api/visit/complete and
 * become permanent history; reopening and editing again (see the reopen-
 * for-edit grace-period flow) starts a fresh draft that supersedes the
 * signed version on the next close, rather than the previous delete-then-
 * insert pattern silently erasing it.
 */
async function upsertDraftNote(
  encounterId: string, patientId: string, noteType: string,
  prefixLike: string, content: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('upsertDraftNote') };

  const { data: existing, error: findErr } = await supabase
    .from('clinical_notes')
    .select('id')
    .eq('encounter_id', encounterId)
    .eq('status', 'draft')
    .like('content', prefixLike)
    .maybeSingle();
  if (findErr) { console.error('[db] upsertDraftNote find:', findErr); return { error: findErr.message }; }

  if (existing) {
    const { error } = await supabase.from('clinical_notes')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', (existing as { id: string }).id);
    if (error) { console.error('[db] upsertDraftNote update:', error); return { error: error.message }; }
    return { error: null };
  }

  const { error } = await supabase.from('clinical_notes').insert({
    encounter_id: encounterId, patient_id: patientId,
    note_type: noteType, status: 'draft', content, ai_assisted: false,
  });
  if (error) { console.error('[db] upsertDraftNote insert:', error); return { error: error.message }; }
  return { error: null };
}

// ─── saveHpiNote ──────────────────────────────────────────────────────────────

/** Clears the current DRAFT HPI text (called when the clinician empties the HPI
 *  field). Only ever removes a draft row — a signed HPI from a prior, closed
 *  version of this encounter is permanent history and is never deleted. */
export async function clearHpiNote(encounterId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('clearHpiNote') };
  const { error } = await supabase.from('clinical_notes')
    .delete()
    .eq('encounter_id', encounterId)
    .eq('status', 'draft')
    .like('content', '[HPI]%');
  if (error) { console.error('[db] clearHpiNote:', error); return { error: error.message }; }
  return { error: null };
}

/** Saves the HPI narrative for an encounter. Updates the current draft in
 *  place; a signed HPI from before the encounter was closed is left alone. */
export async function saveHpiNote(
  encounterId: string,
  patientId: string,
  hpiNotes: string,
): Promise<{ error: string | null }> {
  if (!hpiNotes.trim()) return { error: null };

  const { error } = await upsertDraftNote(encounterId, patientId, 'consultation', '[HPI]%', '[HPI]\n' + hpiNotes);
  if (error) return { error };
  logClinicalSave('autosave_hpi', 'clinical_notes', encounterId, { chars: hpiNotes.length });
  return { error: null };
}

// ─── syncInvestigationOrders ──────────────────────────────────────────────────

/** Syncs the ordered-investigations list for an encounter: inserts new tests, deletes removed ones. */
export async function syncInvestigationOrders(
  encounterId: string,
  patientId: string,
  orderedInvestigations: string[],
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('syncInvestigationOrders') };

  const { data: existing, error: fetchErr } = await supabase
    .from('investigation_results')
    .select('test_name, status')
    .eq('encounter_id', encounterId);

  if (fetchErr) { console.error('[db] syncInvestigationOrders fetch:', fetchErr); return { error: fetchErr.message }; }

  const rows = (existing ?? []) as { test_name: string; status: string }[];
  const orderedSet = new Set(orderedInvestigations);
  const existingNames = new Set(rows.map(r => r.test_name));

  // Insert new tests
  const toInsert = orderedInvestigations
    .filter(name => !existingNames.has(name))
    .map(name => ({
      encounter_id:  encounterId,
      patient_id:    patientId,
      test_name:     name,
      test_category: 'other' as const,
      status:        'ordered' as const,
    }));

  if (toInsert.length) {
    const { error } = await supabase.from('investigation_results').insert(toInsert);
    if (error) { console.error('[db] syncInvestigationOrders insert:', error); return { error: error.message }; }
  }

  // Delete tests that were removed from the UI (only 'ordered' rows — don't touch collected/resulted)
  const toDelete = rows
    .filter(r => r.status === 'ordered' && !orderedSet.has(r.test_name))
    .map(r => r.test_name);

  if (toDelete.length) {
    const { error } = await supabase.from('investigation_results')
      .delete()
      .eq('encounter_id', encounterId)
      .in('test_name', toDelete)
      .eq('status', 'ordered');
    if (error) { console.error('[db] syncInvestigationOrders delete:', error); return { error: error.message }; }
  }

  return { error: null };
}

// ─── updateEncounterType ──────────────────────────────────────────────────────

type DbEncounterType = 'outpatient' | 'inpatient' | 'emergency' | 'procedure' | 'telehealth';

/** Maps the AppContext encounter type + mode to the DB CHECK-constraint values. */
export function toDbEncounterType(encounterType: string, encounterMode: string): DbEncounterType {
  if (encounterMode === 'inpatient') return 'inpatient';
  if (encounterType === 'endoscopy' || encounterType === 'office_procedure') return 'procedure';
  if (encounterType === 'major_emergency') return 'emergency';
  return 'outpatient';
}

export async function updateEncounterType(
  encounterId: string,
  dbType: DbEncounterType,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('updateEncounterType') };

  const { error } = await supabase
    .from('encounters')
    .update({ encounter_type: dbType })
    .eq('id', encounterId);

  if (error) { console.error('[db] updateEncounterType:', error); return { error: error.message }; }
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

// ─── getLatestEncounter ────────────────────────────────────────────────────────

/** Most recent encounter for a patient regardless of status (open, in_progress,
 *  or closed) — unlike getLatestOpenEncounter, this is what patient re-selection
 *  should use so a closed-but-recent encounter is resumed/viewed instead of
 *  silently orphaned (encounterId left null → every autosave effect becomes a
 *  no-op and further documentation looks like it "didn't save"). */
export async function getLatestEncounter(
  patient_id: string,
): Promise<{ encounterId: string | null; status: string | null; closedAt: string | null; error: string | null }> {
  if (!supabase) return { encounterId: null, status: null, closedAt: null, error: notConfigured('getLatestEncounter') };

  const { data, error } = await supabase
    .from('encounters')
    .select('id, status, closed_at')
    .eq('patient_id', patient_id)
    .in('status', ['open', 'in_progress', 'closed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[db] getLatestEncounter:', error);
    return { encounterId: null, status: null, closedAt: null, error: error.message };
  }

  const row = data as { id: string; status: string; closed_at: string | null } | null;
  return { encounterId: row?.id ?? null, status: row?.status ?? null, closedAt: row?.closed_at ?? null, error: null };
}

// ─── getLatestClosedEncounter ─────────────────────────────────────────────────

export interface VitalSnapshot {
  sbp: number | null;
  dbp: number | null;
  hr: number | null;
  tempC: number | null;
  spo2: number | null;
  rr: number | null;
  weightKg: number | null;
  bmi: number | null;
}

export interface ClosedEncounterSnapshot {
  encounterId: string;
  encounterDate: string;
  encounterType: string;
  chiefComplaint: string | null;
  assessment: string | null;
  plan: string | null;
  medications: string[];
  allergies: string;
  surgicalHistory: string[];
  vitals: VitalSnapshot | null;
}

export async function getLatestClosedEncounter(
  patient_id: string,
): Promise<{ data: ClosedEncounterSnapshot | null; error: string | null }> {
  if (!supabase) return { data: null, error: notConfigured('getLatestClosedEncounter') };

  const { data, error } = await supabase
    .from('encounters')
    .select(`
      id, encounter_date, encounter_type, chief_complaint,
      diagnosis, plan,
      encounter_medications(name),
      encounter_allergens(name),
      encounter_surgical_history(procedure),
      vitals(bp_systolic, bp_diastolic, heart_rate, temperature_c, oxygen_saturation, respiratory_rate, weight_kg, bmi)
    `)
    .eq('patient_id', patient_id)
    .neq('status', 'open')
    .order('encounter_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[db] getLatestClosedEncounter:', error);
    return { data: null, error: error.message };
  }

  if (!data) return { data: null, error: null };

  type VitalRow = {
    bp_systolic: number | null; bp_diastolic: number | null;
    heart_rate: number | null; temperature_c: number | null;
    oxygen_saturation: number | null; respiratory_rate: number | null;
    weight_kg: number | null; bmi: number | null;
  };
  const row = data as {
    id: string;
    encounter_date: string;
    encounter_type: string;
    chief_complaint: string | null;
    diagnosis: string | null;
    plan: string | null;
    encounter_medications: Array<{ name: string }> | null;
    encounter_allergens: Array<{ name: string }> | null;
    encounter_surgical_history: Array<{ procedure: string }> | null;
    vitals: VitalRow[] | null;
  };

  return {
    data: {
      encounterId: row.id,
      encounterDate: row.encounter_date,
      encounterType: row.encounter_type,
      chiefComplaint: row.chief_complaint,
      assessment: row.diagnosis,
      plan: row.plan,
      medications: (row.encounter_medications ?? []).map(m => m.name),
      allergies: (row.encounter_allergens ?? []).map(a => a.name).join(', '),
      surgicalHistory: (row.encounter_surgical_history ?? []).map(s => s.procedure),
      vitals: (() => {
        const v = (row.vitals ?? []).at(-1);
        if (!v) return null;
        return {
          sbp: v.bp_systolic,
          dbp: v.bp_diastolic,
          hr: v.heart_rate,
          tempC: v.temperature_c,
          spo2: v.oxygen_saturation,
          rr: v.respiratory_rate,
          weightKg: v.weight_kg,
          bmi: v.bmi,
        } satisfies VitalSnapshot;
      })(),
    },
    error: null,
  };
}

export async function getLatestAppointmentType(
  patient_id: string,
): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('appointment_requests')
      .select('appointment_type')
      .eq('patient_id', patient_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as { appointment_type: string } | null)?.appointment_type ?? null;
  } catch {
    return null;
  }
}

// ─── Questionnaire data for EMR population ───────────────────────────────────

export interface QuestionnaireIntakeData {
  sessionId: string;
  status: string;
  chiefComplaint: string | null;
  symptoms: string[];
  medications: string[];
  allergies: string[];
  pmh: string[];
  surgicalHistory: string[];
  familyHistory: string[];
  socialHabits: string[];
  aiSummary: string | null;
  staffReviewedAt: string | null;
  nurseReviewedAt: string | null;
  doctorApprovedAt: string | null;
  responses: Array<{ questionKey: string; questionText: string; answerValue: string; answerDisplay: string }>;
}

export async function getQuestionnaireIntake(
  patientId: string,
): Promise<QuestionnaireIntakeData | null> {
  if (!supabase) return null;
  try {
    const { data: session } = await supabase
      .from('questionnaire_sessions')
      .select('id, status, staff_reviewed_at, nurse_reviewed_at, doctor_approved_at')
      .eq('patient_id', patientId)
      .in('status', ['completed', 'nurse_reviewed', 'doctor_approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) return null;
    const sid = (session as { id: string }).id;

    const { data: responses } = await supabase
      .from('questionnaire_responses')
      .select('question_key, question_text, answer_value, answer_display')
      .eq('session_id', sid)
      .order('sequence_number', { ascending: true });

    const rows = (responses ?? []) as Array<{
      question_key: string; question_text: string;
      answer_value: string; answer_display: string;
    }>;

    const { data: summaryRow } = await supabase
      .from('intake_summaries')
      .select('ai_summary, chief_complaint, key_positives')
      .eq('session_id', sid)
      .maybeSingle();

    const summary = summaryRow as { ai_summary: string; chief_complaint: string; key_positives: string[] } | null;

    const symptoms: string[] = [];
    const medications: string[] = [];
    const allergies: string[] = [];
    const pmh: string[] = [];
    const surgicalHistory: string[] = [];
    const familyHistory: string[] = [];
    const socialHabits: string[] = [];

    for (const r of rows) {
      const val = r.answer_display || r.answer_value;
      if (!val || val.toLowerCase() === 'no' || val.toLowerCase() === 'none') continue;
      switch (r.question_key) {
        case 'chief_complaint': break;
        case 'current_medications': medications.push(val); break;
        case 'allergies': allergies.push(val); break;
        case 'smoking_status': case 'alcohol_use': socialHabits.push(`${r.question_text}: ${val}`); break;
        case 'prior_surgery': case 'surgery_type': case 'surgery_date': surgicalHistory.push(`${r.question_text}: ${val}`); break;
        case 'family_history_cancer': case 'family_history_breast': familyHistory.push(`${r.question_text}: ${val}`); break;
        case 'colonoscopy_history': case 'mammogram_history': pmh.push(`${r.question_text}: ${val}`); break;
        default: if (r.answer_value.toLowerCase() !== 'no') symptoms.push(r.question_text); break;
      }
    }

    const s = session as { id: string; status: string; staff_reviewed_at: string | null; nurse_reviewed_at: string | null; doctor_approved_at: string | null };
    return {
      sessionId: sid,
      status: s.status,
      chiefComplaint: summary?.chief_complaint ?? null,
      symptoms,
      medications,
      allergies,
      pmh,
      surgicalHistory,
      familyHistory,
      socialHabits,
      aiSummary: summary?.ai_summary ?? null,
      staffReviewedAt: s.staff_reviewed_at,
      nurseReviewedAt: s.nurse_reviewed_at,
      doctorApprovedAt: s.doctor_approved_at,
      responses: rows.map(r => ({ questionKey: r.question_key, questionText: r.question_text, answerValue: r.answer_value, answerDisplay: r.answer_display })),
    };
  } catch {
    return null;
  }
}

// ─── saveVitalsRecord ─────────────────────────────────────────────────────────

/** Maps a VitalRecord (from the monitoring tab's wheel-entry) to the `vitals`
 *  table. GCS/pain/urine don't have dedicated vitals columns — they're omitted
 *  from this insert (the ward monitoring display retains them locally). */
export async function saveVitalsRecord(
  rec: {
    timestamp: string;
    sbp?: string; dbp?: string; hr?: string; temp?: string;
    spo2?: string; rr?: string; weight?: string;
  },
  patientId: string,
  encounterId: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('saveVitalsRecord') };

  const n = (v?: string): number | null => {
    const p = parseFloat(v ?? '');
    return Number.isFinite(p) ? p : null;
  };

  const row: Record<string, unknown> = {
    encounter_id: encounterId,
    patient_id:   patientId,
    recorded_at:  new Date(rec.timestamp).toISOString(),
  };
  const map: Array<[string, number | null]> = [
    ['bp_systolic',      n(rec.sbp)],
    ['bp_diastolic',     n(rec.dbp)],
    ['heart_rate',       n(rec.hr)],
    ['temperature_c',    n(rec.temp)],
    ['oxygen_saturation',n(rec.spo2)],
    ['respiratory_rate', n(rec.rr)],
    ['weight_kg',        n(rec.weight)],
  ];
  for (const [col, val] of map) {
    if (val !== null) row[col] = val;
  }

  const { error } = await supabase.from('vitals').insert(row);
  if (error) { console.error('[db] saveVitalsRecord:', error); return { error: error.message }; }
  return { error: null };
}

// ─── saveLabPanel ─────────────────────────────────────────────────────────────

const LAB_CATEGORY: Record<string, string> = {
  'FBC': 'haematology',
  'Metabolic / UEC': 'biochemistry',
  'LFT': 'biochemistry',
  'Coagulation': 'haematology',
  'Inflammatory': 'biochemistry',
  'Cardiac': 'cardiac',
  'Pancreatic / GI': 'biochemistry',
  'Urine': 'urine',
  'Stool': 'stool',
};

/** Maps a LabRecord (from the monitoring tab's lab panel entry) to a row in
 *  `investigation_results`, using the analytes JSONB column for multi-test
 *  panels and flagging critical values for physician notification. */
export async function saveLabPanel(
  rec: {
    timestamp: string;
    panel: string;
    tests: Array<{ name: string; value: string; unit: string; refRange: string; flag: '' | 'H' | 'L' | 'C' }>;
  },
  patientId: string,
  encounterId: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('saveLabPanel') };

  const analytes = rec.tests.map(t => ({
    name: t.name, value: t.value, unit: t.unit, ref: t.refRange,
    abnormal: t.flag === 'H' || t.flag === 'L' || t.flag === 'C',
    critical: t.flag === 'C',
  }));

  const row = {
    encounter_id:  encounterId,
    patient_id:    patientId,
    test_name:     rec.panel,
    test_category: LAB_CATEGORY[rec.panel] ?? 'other',
    analytes,
    is_abnormal:   rec.tests.some(t => t.flag !== ''),
    is_critical:   rec.tests.some(t => t.flag === 'C'),
    status:        'resulted',
    collected_at:  new Date(rec.timestamp).toISOString(),
  };

  const { error } = await supabase.from('investigation_results').insert(row);
  if (error) { console.error('[db] saveLabPanel:', error); return { error: error.message }; }
  return { error: null };
}

// ─── saveClinicalNote ─────────────────────────────────────────────────────────

export interface ClinicalNoteRow {
  id: string;
  note_type: string;
  status: string;
  content: string;
  signed_by: string | null;
  signed_at: string | null;
  version: number;
  previous_version_id: string | null;
  created_at: string;
  ai_assisted: boolean;
}

/** Fetches clinical notes for an encounter, excluding internal JSON blobs (HPI, exam, AI consult, discharge, inpatient). */
export async function loadEncounterClinicalNotes(
  encounterId: string,
): Promise<ClinicalNoteRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('clinical_notes')
    .select('id, note_type, status, content, signed_by, signed_at, version, previous_version_id, created_at, ai_assisted')
    .eq('encounter_id', encounterId)
    .not('content', 'like', '[HPI]%')
    .not('content', 'like', '[EXAMINATION%')
    .not('content', 'like', '[AI_CONSULT%')
    .not('content', 'like', '[DISCHARGE%')
    .not('content', 'like', '[INPATIENT%')
    .order('created_at', { ascending: false });
  if (error) { console.error('[db] loadEncounterClinicalNotes:', error); return []; }
  return (data ?? []) as ClinicalNoteRow[];
}

/** Signs a single draft clinical note by its DB id. */
export async function signNote(
  noteId: string,
): Promise<{ error: string | null }> {
  const base = getApiOrigin();
  try {
    const res = await fetch(`${base}/api/visit/sign-note/${noteId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      return { error: err.error ?? `HTTP ${res.status}` };
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Sign request failed' };
  }
}

/** Amends a signed note. Creates a new version with previous_version_id pointing to the original. */
export async function amendNote(
  noteId: string,
  content: string,
  reason: string,
): Promise<{ newNoteId: string | null; error: string | null }> {
  const base = getApiOrigin();
  try {
    const res = await fetch(`${base}/api/visit/amend-note/${noteId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
      body: JSON.stringify({ content, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      return { newNoteId: null, error: err.error ?? `HTTP ${res.status}` };
    }
    const data = await res.json() as { newNoteId: string };
    return { newNoteId: data.newNoteId, error: null };
  } catch (e) {
    return { newNoteId: null, error: e instanceof Error ? e.message : 'Amend request failed' };
  }
}

/** Persists a ProgressNote to `clinical_notes` as a SOAP-formatted text note
 *  in `draft` status. The physician can later sign it (status → 'signed').
 *  The note is marked ai_assisted: false because it's staff-authored. */
export async function saveClinicalNote(
  note: {
    date: string;
    type: string;
    interval: string;
    chiefComplaint: string;
    symptoms: string[];
    intervalHistory: string;
    vitals: Partial<Record<string, string>>;
    examGeneral: string; examCvs: string; examRs: string;
    examAbdomen: string; examWound: string; examLimbs: string; examOther: string;
    assessment: string;
    plan: string;
  },
  patientId: string,
  encounterId: string,
): Promise<{ noteId: string | null; error: string | null }> {
  if (!supabase) return { noteId: null, error: notConfigured('saveClinicalNote') };

  const parts: string[] = [];

  // S
  const sLines: string[] = [];
  if (note.chiefComplaint) sLines.push(`CC: ${note.chiefComplaint}`);
  if (note.symptoms.length) sLines.push(`Symptoms: ${note.symptoms.join(', ')}`);
  if (note.intervalHistory) sLines.push(`Interval history: ${note.intervalHistory}`);
  if (note.interval) sLines.push(`Interval: ${note.interval}`);
  if (sLines.length) parts.push(`S (Subjective)\n${sLines.join('\n')}`);

  // O
  const oLines: string[] = [];
  const vEntries = Object.entries(note.vitals).filter(([, v]) => v?.trim());
  if (vEntries.length) oLines.push(`Vitals: ${vEntries.map(([k, v]) => `${k} ${v}`).join(', ')}`);
  const examSections: [string, string][] = [
    ['General', note.examGeneral], ['CVS', note.examCvs], ['RS', note.examRs],
    ['Abdomen', note.examAbdomen], ['Wound', note.examWound], ['Limbs', note.examLimbs],
    ['Other', note.examOther],
  ];
  for (const [label, text] of examSections) {
    if (text?.trim()) oLines.push(`${label}: ${text.trim()}`);
  }
  if (oLines.length) parts.push(`O (Objective)\n${oLines.join('\n')}`);

  // A
  if (note.assessment?.trim()) parts.push(`A (Assessment)\n${note.assessment.trim()}`);

  // P
  if (note.plan?.trim()) parts.push(`P (Plan)\n${note.plan.trim()}`);

  const content = parts.join('\n\n') || '(No content entered)';

  const { data, error } = await supabase.from('clinical_notes').insert({
    encounter_id: encounterId,
    patient_id:   patientId,
    note_type:    'soap',
    status:       'draft',
    content,
    ai_assisted:  false,
  }).select('id').single();

  if (error) { console.error('[db] saveClinicalNote:', error); return { noteId: null, error: error.message }; }
  return { noteId: (data as { id: string }).id, error: null };
}

// ─── syncAllergyList ──────────────────────────────────────────────────────────

/** Upserts each allergen in the list as an active row for the patient.
 *  Uses the allergen_ci generated column (lower-case) as the conflict target,
 *  so re-saving the same list is idempotent. Does NOT deactivate allergens
 *  that were removed from the chip list — those require an explicit clinical
 *  "mark resolved" action, not a UI toggle. */
export async function syncAllergyList(
  patientId: string,
  allergens: string[],
): Promise<{ error: string | null }> {
  if (!supabase || !allergens.length) return { error: null };

  const rows = allergens.map(a => ({
    patient_id: patientId,
    allergen:   a.trim(),
    status:     'active' as const,
  }));

  const { error } = await supabase
    .from('allergies')
    .upsert(rows, { onConflict: 'patient_id,allergen_ci' })
    .select();

  if (error) { console.error('[db] syncAllergyList:', error); return { error: error.message }; }
  logClinicalSave('autosave_allergies', 'allergies', patientId, { count: allergens.length });
  return { error: null };
}

// ─── syncMedicationList ───────────────────────────────────────────────────────

/** Replaces the 'consultation-list' medication snapshot for this encounter.
 *  Deletes all rows tagged indication='consultation-list' for this
 *  patient+encounter, then re-inserts the current chip selection and the
 *  free-text block. Clean and idempotent across repeated saves. */
export async function syncMedicationList(
  patientId: string,
  encounterId: string,
  chipMeds: string[],
  freeText: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('syncMedicationList') };

  const rows: Array<{ drug_name: string; dose?: string }> = chipMeds.map(d => ({ drug_name: d }));

  if (freeText.trim()) {
    rows.push({ drug_name: freeText.trim().slice(0, 255), dose: '(see notes)' });
  }

  // Atomic RPC (supabase-atomic-replace-all-sync-migration.sql) — a plain
  // delete-then-insert here would race two concurrent saves into duplicate
  // or dropped rows, since it was two separate transactions before.
  const { error } = await supabase.rpc('sync_medications_list', {
    p_patient_id: patientId,
    p_encounter_id: encounterId,
    p_rows: rows,
  });
  if (error) { console.error('[db] syncMedicationList:', error); return { error: error.message }; }
  logClinicalSave('autosave_medications', 'medications', encounterId, { count: rows.length });
  return { error: null };
}

// ─── saveExamFindings ─────────────────────────────────────────────────────────

const EXAM_SYSTEM_LABELS: Record<string, string> = {
  general: 'General', cardiovascular: 'Cardiovascular', respiratory: 'Respiratory',
  abdomen: 'Abdomen', breast: 'Breast/Local', wound: 'Wound/Diabetic foot',
  neurological: 'Neurological', extremities: 'Extremities',
};
const EXAM_SYSTEM_ORDER = Object.keys(EXAM_SYSTEM_LABELS);

/** Saves the examination findings for an encounter. Updates the current draft
 *  in place; a signed examination from before the encounter was closed is
 *  left alone. */
export async function saveExamFindings(
  examFindings: Record<string, string[]>,
  examNotes: Record<string, string>,
  patientId: string,
  encounterId: string,
): Promise<{ error: string | null }> {
  const hasContent =
    Object.values(examFindings).some(arr => arr.length > 0) ||
    Object.values(examNotes).some(s => s.trim());
  if (!hasContent) return { error: null };

  const parts: string[] = [];
  for (const sys of EXAM_SYSTEM_ORDER) {
    const chips = examFindings[sys] ?? [];
    const note  = examNotes[sys]?.trim() ?? '';
    if (!chips.length && !note) continue;
    const findings: string[] = [];
    if (chips.length) findings.push(chips.join(', '));
    if (note) findings.push(note);
    parts.push(`${EXAM_SYSTEM_LABELS[sys]}: ${findings.join('. ')}`);
  }
  const content = '[EXAMINATION_JSON]\n' + JSON.stringify({ examFindings, examNotes });

  const { error } = await upsertDraftNote(encounterId, patientId, 'consultation', '[EXAMINATION%', content);
  if (error) return { error };
  logClinicalSave('autosave_exam', 'clinical_notes', encounterId, { systems: Object.keys(examFindings).filter(k => examFindings[k].length > 0) });
  return { error: null };
}

// ─── saveDischargeNotes / loadDischargeNotes ──────────────────────────────────

const DISCHARGE_PREFIX = '[DISCHARGE_NOTES]';

/** Persists the discharge note state as a JSON blob in clinical_notes. Updates
 *  the current draft in place; a signed discharge note from before the
 *  encounter was closed is left alone. */
export async function saveDischargeNotes(
  encounterId: string,
  patientId: string,
  data: Record<string, unknown>,
): Promise<{ error: string | null }> {
  return upsertDraftNote(encounterId, patientId, 'discharge', `${DISCHARGE_PREFIX}%`, `${DISCHARGE_PREFIX}\n${JSON.stringify(data)}`);
}

/** Loads the most recent discharge note JSON blob for an encounter — the
 *  current draft if one is being edited, otherwise the latest signed version. */
export async function loadDischargeNotes(
  encounterId: string,
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  if (!supabase) return { data: null, error: null };

  const { data, error } = await supabase
    .from('clinical_notes')
    .select('content')
    .eq('encounter_id', encounterId)
    .like('content', `${DISCHARGE_PREFIX}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) { console.error('[db] loadDischargeNotes:', error); return { data: null, error: error.message }; }
  if (!data) return { data: null, error: null };

  const content = (data as { content: string }).content;
  const jsonStr = content.startsWith(`${DISCHARGE_PREFIX}\n`) ? content.slice(DISCHARGE_PREFIX.length + 1) : null;
  if (!jsonStr) return { data: null, error: null };
  try { return { data: JSON.parse(jsonStr) as Record<string, unknown>, error: null }; }
  catch { return { data: null, error: null }; }
}

// ─── saveInpatientDetails / loadInpatientDetails ─────────────────────────────

const INPATIENT_PREFIX = '[INPATIENT_JSON]';

/** Persists inpatient admission fields to clinical_notes so they survive page reload. */
export async function saveInpatientDetails(
  encounterId: string,
  patientId: string,
  data: Record<string, unknown>,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('saveInpatientDetails') };

  const { error: delErr } = await supabase.from('clinical_notes')
    .delete()
    .eq('encounter_id', encounterId)
    .like('content', `${INPATIENT_PREFIX}%`);
  if (delErr) { console.error('[db] saveInpatientDetails delete:', delErr); return { error: delErr.message }; }

  const { error } = await supabase.from('clinical_notes').insert({
    encounter_id: encounterId,
    patient_id:   patientId,
    note_type:    'consultation',
    status:       'draft',
    content:      `${INPATIENT_PREFIX}\n${JSON.stringify(data)}`,
    ai_assisted:  false,
  });

  if (error) { console.error('[db] saveInpatientDetails:', error); return { error: error.message }; }
  logClinicalSave('autosave_inpatient', 'clinical_notes', encounterId);
  return { error: null };
}

/** Loads inpatient admission fields from clinical_notes. */
export async function loadInpatientDetails(
  encounterId: string,
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  if (!supabase) return { data: null, error: null };

  const { data, error } = await supabase
    .from('clinical_notes')
    .select('content')
    .eq('encounter_id', encounterId)
    .like('content', `${INPATIENT_PREFIX}%`)
    .maybeSingle();

  if (error) { console.error('[db] loadInpatientDetails:', error); return { data: null, error: error.message }; }
  if (!data) return { data: null, error: null };

  const content = (data as { content: string }).content;
  const jsonStr = content.startsWith(`${INPATIENT_PREFIX}\n`) ? content.slice(INPATIENT_PREFIX.length + 1) : null;
  if (!jsonStr) return { data: null, error: null };
  try { return { data: JSON.parse(jsonStr) as Record<string, unknown>, error: null }; }
  catch { return { data: null, error: null }; }
}

// ─── saveAiConsult ────────────────────────────────────────────────────────────

const AI_CONSULT_PREFIX = '[AI_CONSULT_JSON]';

/** Appends one AI consultation response to clinical_notes (INSERT, not upsert). */
export async function saveAiConsult(
  encounterId: string,
  patientId: string,
  consultationType: string,
  response: Record<string, unknown>,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('saveAiConsult') };

  const { error } = await supabase.from('clinical_notes').insert({
    encounter_id: encounterId,
    patient_id:   patientId,
    note_type:    'consultation',
    status:       'draft',
    content:      `${AI_CONSULT_PREFIX}\n${JSON.stringify({ consultationType, savedAt: new Date().toISOString(), ...response })}`,
    ai_assisted:  true,
  });

  if (error) { console.error('[db] saveAiConsult:', error); return { error: error.message }; }
  logClinicalSave('ai_consult', 'clinical_notes', encounterId, { consultationType });
  return { error: null };
}

// ─── signEncounterNotes ───────────────────────────────────────────────────────

/** Signs all draft clinical notes for an encounter via the API server.
 *  Returns the count of notes signed, or an error string. */
export async function signEncounterNotes(
  encounterId: string,
): Promise<{ signed: number; error: string | null }> {
  const base = getApiOrigin();
  try {
    const res = await fetch(`${base}/api/visit/sign-notes/${encounterId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      return { signed: 0, error: err.error ?? `HTTP ${res.status}` };
    }
    const data = await res.json() as { signed: number };
    return { signed: data.signed, error: null };
  } catch (e) {
    return { signed: 0, error: e instanceof Error ? e.message : 'Sign request failed' };
  }
}

// ─── reopenEncounter ────────────────────────────────────────────────────────────

/** Reopens a closed encounter for correction via the API server. Safe to call
 *  unconditionally — it's a no-op success if the encounter isn't closed. The
 *  server enforces the doctor-only + grace-period rules; a rejection (wrong
 *  role, grace period expired) comes back as an error string. */
export async function reopenEncounter(
  encounterId: string,
): Promise<{ status: string | null; reopened: boolean; error: string | null }> {
  const base = getApiOrigin();
  try {
    const res = await fetch(`${base}/api/visit/reopen/${encounterId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
    });
    const data = await res.json().catch(() => ({})) as { status?: string; reopened?: boolean; error?: string };
    if (!res.ok) return { status: null, reopened: false, error: data.error ?? `HTTP ${res.status}` };
    return { status: data.status ?? null, reopened: !!data.reopened, error: null };
  } catch (e) {
    return { status: null, reopened: false, error: e instanceof Error ? e.message : 'Reopen request failed' };
  }
}

// ─── closeEncounter ───────────────────────────────────────────────────────────

/** Signs all draft notes and marks the encounter closed.
 *  Note signing is best-effort — a signing failure is logged but does not
 *  block closure, because the clinician's intent to close must be honoured. */
export async function closeEncounter(
  encounterId: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('closeEncounter') };

  // Sign notes first (best-effort — don't block closure on a sign failure)
  const { error: signErr } = await signEncounterNotes(encounterId);
  if (signErr) console.warn('[db] closeEncounter: note signing failed —', signErr);

  const { data, error } = await supabase
    .from('encounters')
    .update({ status: 'closed' })
    .eq('id', encounterId)
    .in('status', ['open', 'in_progress'])
    .select('id');

  if (error) { console.error('[db] closeEncounter:', error); return { error: error.message }; }
  if (!data?.length) return { error: 'This encounter is no longer open — it may have been closed by another session. Please refresh.' };
  return { error: null };
}

// ─── loadEncounterData ────────────────────────────────────────────────────────

export interface EncounterData {
  assessment: string;
  differentials: string;
  icdCodes: string[];
  // Present whenever an assessments/plans row already exists for this
  // encounter — the pilot for optimistic-locked saves (saveAssessment/
  // savePlan) uses these as the "expected" version to guard against
  // overwriting a change made by someone else since this load.
  assessmentUpdatedAt: string | null;
  plan: string;
  planUpdatedAt: string | null;
  allergens: string[];
  medications: string[];
  surgicalHistory: string[];
  surgicalNotes: string;
  recentSurgeryDate: string;
  toxicHabits: string[];
  rosFindings: Record<string, { status: string; details: string[]; notes: string }>;
  procedureData: Record<string, unknown>;
  hpiNotes: string;
  examFindings: Record<string, string[]>;
  examNotes: Record<string, string>;
  pmhNotes: string;
  familyHistoryNotes: string;
  orderedInvestigations: string[];
  clinicalScores: Record<string, unknown>;
  extractedLabs: Record<string, number | null>;
  traumaData: {
    mechanism: string[];
    timeOfInjury: string;
    preHospital: string[];
    gcScene: string;
    mistInjuries: string;
    mistSigns: string;
    admissionVitals: Record<string, string>;
    abcde: Record<string, Record<string, string>>;
    ais: Record<string, number>;
    secondary: Record<string, string>;
    secondaryDropdowns: Record<string, string[]>;
    burnRegions: Record<string, { affected: boolean; degree: string }>;
    burnTimeOfInjury: string;
    burnInhalation: boolean;
  } | null;
  inpatientDetails: Record<string, unknown> | null;
}

/** Fetches the clinical snapshot for an encounter: assessment, plan, allergies,
 *  and consultation-list medications. Used to repopulate AppContext when a
 *  returning patient is loaded from the patient registry. */
export async function loadEncounterData(
  encounterId: string,
  patientId: string,
): Promise<{ data: EncounterData; error: null } | { data: null; error: string }> {
  if (!supabase) return { data: null, error: notConfigured('loadEncounterData') };

  // Converts a Supabase query (PromiseLike<{data,error}>) to a plain Promise that
  // never rejects — network-level throws become { data: null, error } so one flaky
  // table can't blank the entire encounter load.
  const sq = <T>(q: PromiseLike<{ data: T | null; error: unknown }>, label: string): Promise<{ data: T | null; error: unknown }> =>
    Promise.resolve(q).catch((err): { data: T | null; error: unknown } => {
      console.error(`[db] loadEncounterData ${label} (network reject):`, err);
      return { data: null, error: err };
    });

  const [assessRes, planRes, allergyRes, medRes, hpiRes, patRes, investRes, examRes, encScoresRes] = await Promise.all([
    sq(supabase.from('assessments')
      .select('diagnosis, differentials, icd10_code, updated_at')
      .eq('encounter_id', encounterId)
      .maybeSingle(), 'assessments'),
    sq(supabase.from('plans')
      .select('description, updated_at')
      .eq('encounter_id', encounterId)
      .eq('plan_type', 'management')
      .maybeSingle(), 'plans'),
    sq(supabase.from('allergies')
      .select('allergen')
      .eq('patient_id', patientId)
      .eq('status', 'active'), 'allergies'),
    sq(supabase.from('medications')
      .select('drug_name')
      .eq('patient_id', patientId)
      .eq('encounter_id', encounterId)
      .eq('indication', 'consultation-list')
      .eq('status', 'active'), 'medications'),
    sq(supabase.from('clinical_notes')
      .select('content')
      .eq('encounter_id', encounterId)
      .like('content', '[HPI]%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(), 'clinical_notes/hpi'),
    sq(supabase.from('patients')
      .select('pmh_notes, family_history_notes')
      .eq('id', patientId)
      .maybeSingle(), 'patients'),
    sq(supabase.from('investigation_results')
      .select('test_name')
      .eq('encounter_id', encounterId)
      .eq('status', 'ordered'), 'investigation_results'),
    sq(supabase.from('clinical_notes')
      .select('content')
      .eq('encounter_id', encounterId)
      .like('content', '[EXAMINATION_JSON]%')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(), 'clinical_notes/exam'),
    sq(supabase.from('encounters')
      .select('clinical_scores, extracted_labs')
      .eq('id', encounterId)
      .maybeSingle(), 'encounters/scores'),
  ]);

  // Log individual query failures but continue with whatever data is available.
  // A single table error must not blank the entire encounter (resilient partial load).
  [
    [assessRes.error, 'assessments'],
    [planRes.error, 'plans'],
    [allergyRes.error, 'allergies'],
    [medRes.error, 'medications'],
    [hpiRes.error, 'clinical_notes/hpi'],
    [patRes.error, 'patients'],
    [investRes.error, 'investigation_results'],
    [examRes.error, 'clinical_notes/exam'],
    [encScoresRes.error, 'encounters/scores'],
  ].forEach(([err, table]) => {
    if (err) console.error(`[db] loadEncounterData ${String(table)}:`, err);
  });

  const assessRow = assessRes.data as { diagnosis: string | null; differentials: string | null; icd10_code: string | null; updated_at: string | null } | null;
  const planRow   = planRes.data   as { description: string | null; updated_at: string | null } | null;
  const allergyRows = (allergyRes.data ?? []) as { allergen: string }[];
  const medRows     = (medRes.data   ?? []) as { drug_name: string }[];
  const hpiContent  = (hpiRes.data   as { content: string } | null)?.content ?? '';
  const patRow      = patRes.data    as { pmh_notes: string | null; family_history_notes: string | null } | null;
  const investRows  = (investRes.data ?? []) as { test_name: string }[];

  const examContent = (examRes.data as { content: string } | null)?.content ?? '';
  let restoredExamFindings: Record<string, string[]> = {};
  let restoredExamNotes: Record<string, string> = {};
  if (examContent.startsWith('[EXAMINATION_JSON]\n')) {
    try {
      const parsed = JSON.parse(examContent.slice('[EXAMINATION_JSON]\n'.length)) as {
        examFindings?: Record<string, string[]>;
        examNotes?: Record<string, string>;
      };
      restoredExamFindings = parsed.examFindings ?? {};
      restoredExamNotes = parsed.examNotes ?? {};
    } catch { /* malformed — return empty */ }
  }

  const [surgRes, toxicRes, rosRes, procRes, traumaRes, inpatientRes] = await Promise.all([
    loadSurgicalHistory(patientId).catch(err => {
      console.error('[db] loadEncounterData surgical_history (rejected):', err);
      return { procedures: [] as string[], notes: '', recentSurgeryDate: '' };
    }),
    loadToxicHabits(patientId).catch(err => {
      console.error('[db] loadEncounterData toxic_habits (rejected):', err);
      return [] as string[];
    }),
    loadRosFindings(encounterId).catch(err => {
      console.error('[db] loadEncounterData ros_findings (rejected):', err);
      return {} as Record<string, { status: string; details: string[]; notes: string }>;
    }),
    loadProcedureData(encounterId).catch(err => {
      console.error('[db] loadEncounterData procedure_data (rejected):', err);
      return {} as Record<string, unknown>;
    }),
    loadTraumaRecord(encounterId).catch(err => {
      console.error('[db] loadEncounterData trauma_record (rejected):', err);
      return null;
    }),
    loadInpatientDetails(encounterId).catch(err => {
      console.error('[db] loadEncounterData inpatient_details (rejected):', err);
      return { data: null, error: null };
    }),
  ]);

  return {
    data: {
      assessment:    assessRow?.diagnosis    ?? '',
      differentials: assessRow?.differentials ?? '',
      icdCodes:      assessRow?.icd10_code
        ? assessRow.icd10_code.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      assessmentUpdatedAt: assessRow?.updated_at ?? null,
      plan:          planRow?.description ?? '',
      planUpdatedAt: planRow?.updated_at ?? null,
      allergens:     allergyRows.map(r => r.allergen),
      medications:   medRows.map(r => r.drug_name),
      surgicalHistory:    surgRes.procedures,
      surgicalNotes:      surgRes.notes,
      recentSurgeryDate:  surgRes.recentSurgeryDate,
      toxicHabits:     toxicRes,
      rosFindings:     rosRes,
      procedureData:   procRes,
      hpiNotes:        hpiContent.startsWith('[HPI]\n') ? hpiContent.slice(6) : hpiContent,
      examFindings:    restoredExamFindings,
      examNotes:       restoredExamNotes,
      pmhNotes:        patRow?.pmh_notes ?? '',
      familyHistoryNotes: patRow?.family_history_notes ?? '',
      orderedInvestigations: investRows.map(r => r.test_name),
      traumaData:      traumaRes,
      inpatientDetails: inpatientRes.data,
      clinicalScores:  ((encScoresRes.data as { clinical_scores: Record<string, unknown> | null } | null)?.clinical_scores) ?? {},
      extractedLabs:   ((encScoresRes.data as { extracted_labs: Record<string, number | null> | null } | null)?.extracted_labs) ?? {},
    },
    error: null,
  };
}

export interface PaneSessionLog {
  encounter_id: string | null;
  patient_id: string | null;
  answered: Record<string, boolean>;
  top_diagnoses: Array<{ id: string; label: string; icd10: string; probability: number }>;
  iteration: number;
  converged: boolean;
}

// Writes to the canonical `audit_log` (singular) table — the same one the
// api-server's logAudit()/audit() helpers write to. These two functions used
// to write to `audit_logs` (plural), a dead table nothing else reads from
// (confirmed by docs/AUDIT-TRAIL-COVERAGE.md's patient-merge finding) — every
// call site below was silently a no-op audit trail. A DB trigger
// (supabase-clinical-audit-trigger-migration.sql) now also captures every
// raw row-level change to these tables regardless of call site; these two
// functions stay because they carry semantic context — the action label, and
// for logPaneSession, an AI-reasoning snapshot — that a generic trigger
// can't infer from a column diff alone.
async function writeAuditLog(entry: {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  patientId?: string | null;
  details?: Record<string, unknown> | null;
  mode: string;
}): Promise<void> {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase.from('audit_log').insert({
    user_id:       session?.user?.id ?? null,
    user_email:    session?.user?.email ?? null,
    action:        entry.action,
    resource_type: entry.resourceType,
    resource_id:   entry.resourceId ?? null,
    patient_id:    entry.patientId ?? null,
    details:       entry.details ?? null,
    mode:          entry.mode,
  });
  if (error) console.warn('[db] audit:', error.message);
}

/**
 * Fire-and-forget: write a PANE session snapshot to audit_log.
 * Safe to call without awaiting — errors are logged to console only.
 */
export function logPaneSession(input: PaneSessionLog): void {
  void writeAuditLog({
    action:       'pane_session',
    resourceType: 'encounters',
    resourceId:   input.encounter_id,
    patientId:    input.patient_id,
    details: {
      answered:      input.answered,
      top_diagnoses: input.top_diagnoses,
      iteration:     input.iteration,
      converged:     input.converged,
    },
    mode: 'cds',
  });
}

function logClinicalSave(action: string, tableName: string, recordId: string, summary?: Record<string, unknown>): void {
  void writeAuditLog({
    action,
    resourceType: tableName,
    resourceId:   recordId,
    details:      summary ?? null,
    mode:         'autosave',
  });
}

// ─── saveClinicalScores ───────────────────────────────────────────────────────

export async function saveClinicalScores(
  encounterId: string,
  clinicalScores: Record<string, unknown>,
  extractedLabs: Record<string, number | null>,
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('encounters')
    .update({ clinical_scores: clinicalScores, extracted_labs: extractedLabs })
    .eq('id', encounterId);
  if (error) { console.error('[db] saveClinicalScores:', error); return; }
  logClinicalSave('autosave_clinical_scores', 'encounters', encounterId, {
    scoreKeys: Object.keys(clinicalScores),
    labCount: Object.keys(extractedLabs).filter(k => !k.endsWith('_unit') && extractedLabs[k] !== null).length,
  });
}

// ─── syncSurgicalHistory ─────────────────────────────────────────────────────

export async function syncSurgicalHistory(
  patientId: string,
  procedures: string[],
  notes: string,
  recentSurgeryDate: string = '',
): Promise<void> {
  if (!supabase) return;
  if (!procedures.length && !notes.trim() && !recentSurgeryDate.trim()) return;

  const rows: Array<{ procedure_name: string; notes?: string }> = procedures.map(p => ({ procedure_name: p }));

  if (notes.trim()) rows.push({ procedure_name: '[notes]', notes: notes.trim() });
  if (recentSurgeryDate.trim()) rows.push({ procedure_name: '[recentSurgeryDate]', notes: recentSurgeryDate.trim() });

  // Atomic RPC — see syncMedicationList's comment for why (same race class).
  const { error } = await supabase.rpc('sync_surgical_history', { p_patient_id: patientId, p_rows: rows });
  if (error) { console.error('[db] syncSurgicalHistory:', error); throw new Error(error.message); }
}

export async function loadSurgicalHistory(
  patientId: string,
): Promise<{ procedures: string[]; notes: string; recentSurgeryDate: string }> {
  if (!supabase) return { procedures: [], notes: '', recentSurgeryDate: '' };

  const { data, error } = await supabase
    .from('surgical_history')
    .select('procedure_name, notes')
    .eq('patient_id', patientId);

  if (error) {
    if ((error as { code?: string }).code === '42P01') return { procedures: [], notes: '', recentSurgeryDate: '' };
    console.error('[db] loadSurgicalHistory:', error);
    return { procedures: [], notes: '', recentSurgeryDate: '' };
  }

  const SENTINEL_KEYS = new Set(['[notes]', '[recentSurgeryDate]']);
  const rows = (data ?? []) as Array<{ procedure_name: string; notes: string | null }>;
  const noteRow = rows.find(r => r.procedure_name === '[notes]');
  const dateRow = rows.find(r => r.procedure_name === '[recentSurgeryDate]');
  return {
    procedures: rows.filter(r => !SENTINEL_KEYS.has(r.procedure_name)).map(r => r.procedure_name),
    notes: noteRow?.notes ?? '',
    recentSurgeryDate: dateRow?.notes ?? '',
  };
}

// ─── syncToxicHabits ─────────────────────────────────────────────────────────

export async function syncToxicHabits(
  patientId: string,
  habits: string[],
): Promise<void> {
  if (!supabase) return;

  // Atomic RPC — see syncMedicationList's comment for why (same race class).
  // Unlike the pre-RPC version, an empty habits[] still runs this (correctly
  // clearing existing rows) rather than short-circuiting, since delete and
  // insert-nothing now happen in the one atomic call rather than as two
  // separately-guarded steps.
  const { error } = await supabase.rpc('sync_toxic_habits', {
    p_patient_id: patientId,
    p_rows: habits.map(h => ({ details: h })),
  });
  if (error) { console.error('[db] syncToxicHabits:', error); throw new Error(error.message); }
}

export async function loadToxicHabits(
  patientId: string,
): Promise<string[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('toxic_habits')
    .select('details')
    .eq('patient_id', patientId);

  if (error) {
    if ((error as { code?: string }).code === '42P01') return [];
    console.error('[db] loadToxicHabits:', error);
    return [];
  }

  return (data ?? []).map((r: { details: string | null }) => r.details).filter(Boolean) as string[];
}

// ─── syncRosFindings ─────────────────────────────────────────────────────────

export async function syncRosFindings(
  patientId: string,
  encounterId: string,
  rosFindings: Record<string, { status: string; details: string[]; notes: string }>,
): Promise<void> {
  if (!supabase) return;

  const systems = Object.entries(rosFindings).filter(([, f]) =>
    f.status !== 'not-asked' || f.details.length > 0 || f.notes.trim()
  );

  if (!systems.length) return;

  const rows = systems.map(([system, f]) => ({
    patient_id: patientId,
    encounter_id: encounterId,
    system_name: system,
    findings: { status: f.status, details: f.details },
    notes: f.notes || null,
  }));

  const { error } = await supabase
    .from('ros_findings')
    .upsert(rows, { onConflict: 'encounter_id,system_name' });

  if (error) { console.error('[db] syncRosFindings:', error); throw new Error(error.message); }
}

export async function loadRosFindings(
  encounterId: string,
): Promise<Record<string, { status: string; details: string[]; notes: string }>> {
  if (!supabase) return {};

  const { data, error } = await supabase
    .from('ros_findings')
    .select('system_name, findings, notes')
    .eq('encounter_id', encounterId);

  if (error) {
    if ((error as { code?: string }).code === '42P01') return {};
    console.error('[db] loadRosFindings:', error);
    return {};
  }

  const result: Record<string, { status: string; details: string[]; notes: string }> = {};
  for (const row of (data ?? []) as Array<{ system_name: string; findings: { status?: string; details?: string[] } | null; notes: string | null }>) {
    result[row.system_name] = {
      status: row.findings?.status ?? 'not-asked',
      details: row.findings?.details ?? [],
      notes: row.notes ?? '',
    };
  }
  return result;
}

// ─── syncProcedureData ───────────────────────────────────────────────────────

const PROC_LABELS: Record<string, string> = {
  ogd: 'OGD (Oesophagogastroduodenoscopy)',
  colonoscopy: 'Colonoscopy',
  ercp: 'ERCP',
  preop: 'Pre-Operative Assessment',
  postop: 'Post-Operative Note',
};

const PROC_KEYS: Record<string, string> = Object.fromEntries(
  Object.entries(PROC_LABELS).map(([k, v]) => [v, k]),
);

export async function syncProcedureData(
  patientId: string,
  encounterId: string,
  procedureData: Record<string, unknown>,
): Promise<void> {
  if (!supabase) return;

  const entries = Object.entries(procedureData).filter(([, v]) =>
    v && typeof v === 'object' && Object.keys(v as object).length > 0
  );

  const rows = entries.map(([key, value]) => ({
    procedure_name: PROC_LABELS[key] ?? key,
    findings: JSON.stringify(value),
  }));

  // Atomic RPC — see syncMedicationList's comment for why (same race class).
  const { error } = await supabase.rpc('sync_operative_notes', {
    p_patient_id: patientId,
    p_encounter_id: encounterId,
    p_rows: rows,
  });
  if (error) { console.error('[db] syncProcedureData:', error); throw new Error(error.message); }
}

export async function loadProcedureData(
  encounterId: string,
): Promise<Record<string, unknown>> {
  if (!supabase) return {};

  const { data, error } = await supabase
    .from('operative_notes')
    .select('procedure_name, findings')
    .eq('encounter_id', encounterId);

  if (error) {
    if ((error as { code?: string }).code === '42P01') return {};
    console.error('[db] loadProcedureData:', error);
    return {};
  }

  const result: Record<string, unknown> = {};
  for (const row of (data ?? []) as Array<{ procedure_name: string; findings: string | null }>) {
    const key = PROC_KEYS[row.procedure_name] ?? row.procedure_name;
    try {
      result[key] = row.findings ? JSON.parse(row.findings) : {};
    } catch {
      result[key] = {};
    }
  }
  return result;
}

// ─── syncTraumaRecord ────────────────────────────────────────────────────────

export async function syncTraumaRecord(
  patientId: string,
  encounterId: string,
  traumaData: {
    mechanism: string[];
    timeOfInjury: string;
    preHospital: string[];
    gcScene: string;
    mistInjuries: string;
    mistSigns: string;
    admissionVitals: Record<string, string>;
    abcde: Record<string, Record<string, string>>;
    ais: Record<string, number>;
    secondary: Record<string, string>;
    secondaryDropdowns: Record<string, string[]>;
    burnRegions: Record<string, { affected: boolean; degree: string }>;
    burnTimeOfInjury: string;
    burnInhalation: boolean;
  },
): Promise<void> {
  if (!supabase) return;

  const hasData = traumaData.mechanism.length > 0 ||
    traumaData.preHospital.length > 0 ||
    Object.keys(traumaData.admissionVitals).length > 0 ||
    Object.keys(traumaData.abcde).length > 0 ||
    Object.values(traumaData.ais).some(v => v > 0);

  if (!hasData) return;

  const aisValues = Object.values(traumaData.ais).filter(v => v > 0).sort((a, b) => b - a);
  const issScore = aisValues.slice(0, 3).reduce((sum, v) => sum + v * v, 0);

  const row: Record<string, unknown> = {
    patient_id: patientId,
    encounter_id: encounterId,
    mechanism: traumaData.mechanism,
    pre_hospital: traumaData.preHospital,
    gc_scene: traumaData.gcScene || null,
    mist_injuries: traumaData.mistInjuries || null,
    mist_signs: traumaData.mistSigns || null,
    admission_vitals: { ...traumaData.admissionVitals, timeOfInjury: traumaData.timeOfInjury },
    abcde: traumaData.abcde,
    ais: traumaData.ais,
    secondary: traumaData.secondary,
    secondary_dropdowns: traumaData.secondaryDropdowns,
    burn_regions: { ...traumaData.burnRegions, burnTimeOfInjury: traumaData.burnTimeOfInjury },
    burn_inhalation: traumaData.burnInhalation,
    iss_score: issScore > 0 ? issScore : null,
  };

  const { error } = await supabase
    .from('trauma_records')
    .upsert(row, { onConflict: 'encounter_id' });

  if (error) { console.error('[db] syncTraumaRecord:', error); throw new Error(error.message); }
}

export async function loadTraumaRecord(
  encounterId: string,
): Promise<{
  mechanism: string[];
  timeOfInjury: string;
  preHospital: string[];
  gcScene: string;
  mistInjuries: string;
  mistSigns: string;
  admissionVitals: Record<string, string>;
  abcde: Record<string, Record<string, string>>;
  ais: Record<string, number>;
  secondary: Record<string, string>;
  secondaryDropdowns: Record<string, string[]>;
  burnRegions: Record<string, { affected: boolean; degree: string }>;
  burnTimeOfInjury: string;
  burnInhalation: boolean;
} | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('trauma_records')
    .select('*')
    .eq('encounter_id', encounterId)
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === '42P01') return null;
    console.error('[db] loadTraumaRecord:', error);
    return null;
  }

  if (!data) return null;

  const r = data as Record<string, unknown>;
  const vitals = (r.admission_vitals ?? {}) as Record<string, string>;
  const burns = (r.burn_regions ?? {}) as Record<string, unknown>;

  return {
    mechanism: (r.mechanism as string[]) ?? [],
    timeOfInjury: (vitals.timeOfInjury as string) ?? '',
    preHospital: (r.pre_hospital as string[]) ?? [],
    gcScene: (r.gc_scene as string) ?? '',
    mistInjuries: (r.mist_injuries as string) ?? '',
    mistSigns: (r.mist_signs as string) ?? '',
    admissionVitals: vitals,
    abcde: (r.abcde as Record<string, Record<string, string>>) ?? {},
    ais: (r.ais as Record<string, number>) ?? {},
    secondary: (r.secondary as Record<string, string>) ?? {},
    secondaryDropdowns: (r.secondary_dropdowns as Record<string, string[]>) ?? {},
    burnRegions: burns as Record<string, { affected: boolean; degree: string }>,
    burnTimeOfInjury: ((burns as Record<string, unknown>).burnTimeOfInjury as string) ?? '',
    burnInhalation: (r.burn_inhalation as boolean) ?? false,
  };
}

// ── Patient problem list ────────────────────────────────────────────────────

export interface PatientProblem {
  id: string;
  title: string;
  status: 'active' | 'chronic' | 'resolved';
  icd10Code?: string;
  onsetDate?: string;
}

export async function loadPatientProblems(patientId: string): Promise<PatientProblem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('patient_problems')
    .select('id, title, status, icd10_code, onset_date')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map(r => ({
    id:        r.id as string,
    title:     r.title as string,
    status:    r.status as PatientProblem['status'],
    icd10Code: (r.icd10_code as string | null) ?? undefined,
    onsetDate: (r.onset_date as string | null) ?? undefined,
  }));
}

export async function savePatientProblem(
  patientId: string,
  problem: Omit<PatientProblem, 'id'>,
): Promise<{ id: string | null; error: string | null }> {
  if (!supabase) return { id: null, error: notConfigured('savePatientProblem') };
  const { data, error } = await supabase
    .from('patient_problems')
    .insert({
      patient_id: patientId,
      title:      problem.title,
      status:     problem.status,
      icd10_code: problem.icd10Code ?? null,
      onset_date: problem.onsetDate ?? null,
    })
    .select('id')
    .single();
  if (error) return { id: null, error: error.message };
  return { id: (data as Record<string, string>).id, error: null };
}

export async function updatePatientProblemStatus(
  problemId: string,
  status: PatientProblem['status'],
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('updatePatientProblemStatus') };
  const { error } = await supabase
    .from('patient_problems')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', problemId);
  return { error: error?.message ?? null };
}

export async function removePatientProblem(problemId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('removePatientProblem') };
  const { error } = await supabase
    .from('patient_problems')
    .delete()
    .eq('id', problemId);
  return { error: error?.message ?? null };
}

// ── Wound assessments ───────────────────────────────────────────────────────

export type WoundClass = 'clean' | 'clean_contaminated' | 'contaminated' | 'dirty';
export type WoundClosure = 'primary' | 'secondary' | 'delayed_primary' | 'vac' | 'open';
export type WoundStatus = 'healing' | 'superficial_ssi' | 'deep_ssi' | 'dehiscence' | 'seroma' | 'haematoma' | 'necrosis' | 'closed';
export type DrainStatus = 'none' | 'in_situ' | 'removed';

export interface AsepsisDetails {
  serous: number;       // % wound with serous discharge (0,<20,20-39,40-59,60-79,>=80 → 0,1,2,3,4,5)
  erythema: number;     // same bands → 0,1,2,3,4,5
  purulent: number;     // bands → 0,2,4,6,8,10
  separation: number;   // bands → 0,2,4,6,8,10
  isolatedBacteria: boolean;
  prolongedStay: boolean;
  additionalTx: 0 | 5 | 10 | 15;  // 0=none, 5=antibiotics, 10=drainage LA, 15=debridement GA
}

export interface WoundAssessment {
  id: string;
  label: string;
  location: string;
  woundClass: WoundClass | '';
  closure: WoundClosure | '';
  status: WoundStatus;
  dressing: string;
  drain: DrainStatus;
  drainOutputMl: string;
  asepsisScore: number;
  asepsisDetails: AsepsisDetails;
  notes: string;
  assessedDate: string;
}

export function calcAsepsisScore(d: AsepsisDetails): number {
  return d.serous + d.erythema + d.purulent + d.separation +
    (d.isolatedBacteria ? 10 : 0) +
    (d.prolongedStay ? 5 : 0) +
    d.additionalTx;
}

export function emptyWound(label = 'Wound'): WoundAssessment {
  return {
    id: `tmp-${Date.now()}`,
    label,
    location: '',
    woundClass: '',
    closure: '',
    status: 'healing',
    dressing: '',
    drain: 'none',
    drainOutputMl: '',
    asepsisScore: 0,
    asepsisDetails: { serous: 0, erythema: 0, purulent: 0, separation: 0, isolatedBacteria: false, prolongedStay: false, additionalTx: 0 },
    notes: '',
    assessedDate: new Date().toISOString().slice(0, 10),
  };
}

function dbRowToWound(r: Record<string, unknown>): WoundAssessment {
  return {
    id:            r.id as string,
    label:         (r.label as string) ?? 'Wound',
    location:      (r.location as string) ?? '',
    woundClass:    (r.wound_class as WoundClass) ?? '',
    closure:       (r.closure as WoundClosure) ?? '',
    status:        (r.status as WoundStatus) ?? 'healing',
    dressing:      (r.dressing as string) ?? '',
    drain:         (r.drain as DrainStatus) ?? 'none',
    drainOutputMl: r.drain_output_ml != null ? String(r.drain_output_ml) : '',
    asepsisScore:  (r.asepsis_score as number) ?? 0,
    asepsisDetails:(r.asepsis_details as AsepsisDetails) ?? { serous: 0, erythema: 0, purulent: 0, separation: 0, isolatedBacteria: false, prolongedStay: false, additionalTx: 0 },
    notes:         (r.notes as string) ?? '',
    assessedDate:  (r.assessed_date as string) ?? new Date().toISOString().slice(0, 10),
  };
}

export async function saveWoundAssessment(
  patientId: string,
  encounterId: string | null,
  wound: WoundAssessment,
): Promise<{ id: string | null; error: string | null }> {
  const payload = {
    patientId, encounterId,
    label:          wound.label,
    location:       wound.location || undefined,
    woundClass:     wound.woundClass || undefined,
    closure:        wound.closure || undefined,
    status:         wound.status,
    dressing:       wound.dressing || undefined,
    drain:          wound.drain,
    drainOutputMl:  wound.drainOutputMl ? parseInt(wound.drainOutputMl) : undefined,
    asepsisScore:   wound.asepsisScore,
    asepsisDetails: wound.asepsisDetails,
    notes:          wound.notes || undefined,
    assessedDate:   wound.assessedDate,
  };
  try {
    if (wound.id.startsWith('tmp-')) {
      const resp = await fetch('/api/wound-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) return { id: null, error: `HTTP ${resp.status}` };
      const body = await resp.json() as { wound: { id: string } };
      return { id: body.wound.id, error: null };
    }
    const resp = await fetch(`/api/wound-assessments/${wound.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) return { id: null, error: `HTTP ${resp.status}` };
    return { id: wound.id, error: null };
  } catch (e) {
    return { id: null, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export async function loadWoundAssessments(patientId: string, encounterId?: string): Promise<WoundAssessment[]> {
  try {
    const qs = encounterId ? `?encounterId=${encounterId}` : '';
    const resp = await fetch(`/api/wound-assessments/patient/${patientId}${qs}`);
    if (!resp.ok) return [];
    const body = await resp.json() as { wounds: Record<string, unknown>[] };
    return (body.wounds ?? []).map(dbRowToWound);
  } catch {
    return [];
  }
}

export async function deleteWoundAssessment(woundId: string): Promise<{ error: string | null }> {
  try {
    const resp = await fetch(`/api/wound-assessments/${woundId}`, { method: 'DELETE' });
    if (!resp.ok) return { error: `HTTP ${resp.status}` };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Network error' };
  }
}

/* ── Encounter timeline ───────────────────────────────────────────────────── */

export interface EncounterSummary {
  id: string;
  createdAt: string;
  status: string;
  encounterType: string;
  chiefComplaint: string | null;
  site: string | null;
  diagnosis: string | null;
  icd10Code: string | null;
  planDescription: string | null;
  followUpDate: string | null;
  followUpNotes: string | null;
}

export async function listPatientEncounters(patientId: string): Promise<EncounterSummary[]> {
  try {
    const base = getApiOrigin();
    const headers = await staffAuthHeaders();
    const res = await fetch(`${base}/api/encounters/patient/${patientId}`, { headers });
    if (!res.ok) return [];
    const json = await res.json() as { encounters: EncounterSummary[] };
    return json.encounters ?? [];
  } catch {
    return [];
  }
}
