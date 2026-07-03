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
}

// ─── savePatientFull ──────────────────────────────────────────────────────────

/** Creates a patient row from the full receptionist form. */
export async function savePatientFull(
  input: FullPatientInput,
): Promise<{ patient: SavedPatient; error: null } | { patient: null; error: string }> {
  if (!supabase) return { patient: null, error: notConfigured('savePatientFull') };

  const row: Record<string, unknown> = {
    full_name: input.full_name.trim(),
    sex:       input.sex || 'unknown',
  };
  if (input.dob)              row.date_of_birth        = input.dob;
  else {
    const d = ageToDob(input.age);
    if (d) row.date_of_birth = d;
  }
  if (input.phone.trim())              row.phone                = input.phone.trim();
  if (input.email.trim())              row.email                = input.email.trim();
  if (input.address.trim())            row.address              = input.address.trim();
  if (input.quarter.trim())            row.quarter              = input.quarter.trim();
  if (input.referredBy.trim())         row.referred_by          = input.referredBy.trim();
  if (input.insuranceProvider.trim())  row.insurance_provider   = input.insuranceProvider.trim();
  if (input.policyNumber.trim())       row.policy_number        = input.policyNumber.trim();
  if (input.nhiNumber.trim())          row.nhi_number           = input.nhiNumber.trim();
  if (input.preAuthStatus)             row.pre_auth_status      = input.preAuthStatus;

  const { data, error } = await supabase
    .from('patients')
    .insert(row)
    .select('id, full_name')
    .single();

  if (error) {
    console.error('[db] savePatientFull:', error);
    return { patient: null, error: error.message };
  }
  return { patient: data as SavedPatient, error: null };
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

export async function saveAssessment(
  input: AssessmentInput,
): Promise<{ error: string | null }> {
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

  const { error } = await supabase
    .from('assessments')
    .upsert(row, { onConflict: 'encounter_id' })
    .select();

  if (error) { console.error('[db] saveAssessment:', error); return { error: error.message }; }
  return { error: null };
}

// ─── savePlan ─────────────────────────────────────────────────────────────────

export async function savePlan(
  input: PlanInput,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('savePlan') };

  const { error } = await supabase
    .from('plans')
    .upsert({
      encounter_id: input.encounter_id,
      patient_id:   input.patient_id,
      plan_type:    'management',
      description:  input.description || null,
    }, { onConflict: 'encounter_id' });

  if (error) { console.error('[db] savePlan:', error); return { error: error.message }; }
  return { error: null };
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
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('saveClinicalNote') };

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

  const { error } = await supabase.from('clinical_notes').insert({
    encounter_id: encounterId,
    patient_id:   patientId,
    note_type:    'soap',
    status:       'draft',
    content,
    ai_assisted:  false,
  });

  if (error) { console.error('[db] saveClinicalNote:', error); return { error: error.message }; }
  return { error: null };
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

  const { error: delErr } = await supabase
    .from('medications')
    .delete()
    .eq('patient_id', patientId)
    .eq('encounter_id', encounterId)
    .eq('indication', 'consultation-list');
  if (delErr) { console.error('[db] syncMedicationList delete:', delErr); return { error: delErr.message }; }

  const rows: Array<Record<string, unknown>> = chipMeds.map(d => ({
    patient_id:   patientId,
    encounter_id: encounterId,
    drug_name:    d,
    status:       'active',
    indication:   'consultation-list',
  }));

  if (freeText.trim()) {
    rows.push({
      patient_id:   patientId,
      encounter_id: encounterId,
      drug_name:    freeText.trim().slice(0, 255),
      status:       'active',
      indication:   'consultation-list',
      dose:         '(see notes)',
    });
  }

  if (!rows.length) return { error: null };

  const { error: insErr } = await supabase.from('medications').insert(rows);
  if (insErr) { console.error('[db] syncMedicationList insert:', insErr); return { error: insErr.message }; }
  return { error: null };
}

// ─── saveExamFindings ─────────────────────────────────────────────────────────

const EXAM_SYSTEM_LABELS: Record<string, string> = {
  general: 'General', cardiovascular: 'Cardiovascular', respiratory: 'Respiratory',
  abdomen: 'Abdomen', breast: 'Breast/Local', wound: 'Wound/Diabetic foot',
  neurological: 'Neurological', extremities: 'Extremities',
};
const EXAM_SYSTEM_ORDER = Object.keys(EXAM_SYSTEM_LABELS);

/** Replaces the 'consultation' examination snapshot for this encounter.
 *  Deletes any existing consultation note tagged with the sentinel prefix,
 *  then inserts a fresh serialisation of the chip + free-text findings. */
export async function saveExamFindings(
  examFindings: Record<string, string[]>,
  examNotes: Record<string, string>,
  patientId: string,
  encounterId: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('saveExamFindings') };

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
  const content = '[EXAMINATION]\n' + (parts.join('\n') || '(No findings entered)');

  // Delete the previous examination snapshot for this encounter, then re-insert
  await supabase.from('clinical_notes')
    .delete()
    .eq('encounter_id', encounterId)
    .like('content', '[EXAMINATION]%');

  const { error } = await supabase.from('clinical_notes').insert({
    encounter_id: encounterId,
    patient_id:   patientId,
    note_type:    'consultation',
    status:       'draft',
    content,
    ai_assisted:  false,
  });

  if (error) { console.error('[db] saveExamFindings:', error); return { error: error.message }; }
  return { error: null };
}

// ─── closeEncounter ───────────────────────────────────────────────────────────

export async function closeEncounter(
  encounterId: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: notConfigured('closeEncounter') };

  const { error } = await supabase
    .from('encounters')
    .update({ status: 'closed' })
    .eq('id', encounterId);

  if (error) { console.error('[db] closeEncounter:', error); return { error: error.message }; }
  return { error: null };
}

// ─── loadEncounterData ────────────────────────────────────────────────────────

export interface EncounterData {
  assessment: string;
  differentials: string;
  icdCodes: string[];
  plan: string;
  allergens: string[];
  medications: string[];
  surgicalHistory: string[];
  surgicalNotes: string;
  toxicHabits: string[];
  rosFindings: Record<string, { status: string; details: string[]; notes: string }>;
  procedureData: Record<string, unknown>;
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
}

/** Fetches the clinical snapshot for an encounter: assessment, plan, allergies,
 *  and consultation-list medications. Used to repopulate AppContext when a
 *  returning patient is loaded from the patient registry. */
export async function loadEncounterData(
  encounterId: string,
  patientId: string,
): Promise<{ data: EncounterData; error: null } | { data: null; error: string }> {
  if (!supabase) return { data: null, error: notConfigured('loadEncounterData') };

  const [assessRes, planRes, allergyRes, medRes] = await Promise.all([
    supabase.from('assessments')
      .select('diagnosis, differentials, icd10_code')
      .eq('encounter_id', encounterId)
      .maybeSingle(),
    supabase.from('plans')
      .select('description')
      .eq('encounter_id', encounterId)
      .eq('plan_type', 'management')
      .maybeSingle(),
    supabase.from('allergies')
      .select('allergen')
      .eq('patient_id', patientId)
      .eq('status', 'active'),
    supabase.from('medications')
      .select('drug_name')
      .eq('patient_id', patientId)
      .eq('encounter_id', encounterId)
      .eq('indication', 'consultation-list')
      .eq('status', 'active'),
  ]);

  const firstError = assessRes.error ?? planRes.error ?? allergyRes.error ?? medRes.error;
  if (firstError) {
    console.error('[db] loadEncounterData:', firstError);
    return { data: null, error: firstError.message };
  }

  const assessRow = assessRes.data as { diagnosis: string | null; differentials: string | null; icd10_code: string | null } | null;
  const planRow   = planRes.data   as { description: string | null } | null;
  const allergyRows = (allergyRes.data ?? []) as { allergen: string }[];
  const medRows     = (medRes.data   ?? []) as { drug_name: string }[];

  const [surgRes, toxicRes, rosRes, procRes, traumaRes] = await Promise.all([
    loadSurgicalHistory(patientId),
    loadToxicHabits(patientId),
    loadRosFindings(encounterId),
    loadProcedureData(encounterId),
    loadTraumaRecord(encounterId),
  ]);

  return {
    data: {
      assessment:    assessRow?.diagnosis    ?? '',
      differentials: assessRow?.differentials ?? '',
      icdCodes:      assessRow?.icd10_code
        ? assessRow.icd10_code.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      plan:          planRow?.description ?? '',
      allergens:     allergyRows.map(r => r.allergen),
      medications:   medRows.map(r => r.drug_name),
      surgicalHistory: surgRes.procedures,
      surgicalNotes:   surgRes.notes,
      toxicHabits:     toxicRes,
      rosFindings:     rosRes,
      procedureData:   procRes,
      traumaData:      traumaRes,
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

/**
 * Fire-and-forget: write a PANE session snapshot to audit_logs.
 * Safe to call without awaiting — errors are logged to console only.
 */
export function logPaneSession(input: PaneSessionLog): void {
  if (!supabase) return;
  void supabase.from('audit_logs').insert({
    action:     'pane_session',
    table_name: 'encounters',
    record_id:  input.encounter_id ?? undefined,
    new_values: {
      patient_id:    input.patient_id,
      answered:      input.answered,
      top_diagnoses: input.top_diagnoses,
      iteration:     input.iteration,
      converged:     input.converged,
    },
    mode: 'cds',
  }).then(({ error }) => {
    if (error) console.warn('[db] logPaneSession:', error.message);
  });
}

// ─── syncSurgicalHistory ─────────────────────────────────────────────────────

export async function syncSurgicalHistory(
  patientId: string,
  procedures: string[],
  notes: string,
): Promise<void> {
  if (!supabase) return;
  if (!procedures.length && !notes.trim()) return;

  await supabase.from('surgical_history').delete().eq('patient_id', patientId);

  const rows: Array<Record<string, unknown>> = procedures.map(p => ({
    patient_id: patientId,
    procedure_name: p,
  }));

  if (notes.trim()) {
    rows.push({ patient_id: patientId, procedure_name: '[notes]', notes: notes.trim() });
  }

  if (rows.length) {
    const { error } = await supabase.from('surgical_history').insert(rows);
    if (error) console.error('[db] syncSurgicalHistory:', error);
  }
}

export async function loadSurgicalHistory(
  patientId: string,
): Promise<{ procedures: string[]; notes: string }> {
  if (!supabase) return { procedures: [], notes: '' };

  const { data, error } = await supabase
    .from('surgical_history')
    .select('procedure_name, notes')
    .eq('patient_id', patientId);

  if (error) {
    if ((error as { code?: string }).code === '42P01') return { procedures: [], notes: '' };
    console.error('[db] loadSurgicalHistory:', error);
    return { procedures: [], notes: '' };
  }

  const rows = (data ?? []) as Array<{ procedure_name: string; notes: string | null }>;
  const noteRow = rows.find(r => r.procedure_name === '[notes]');
  return {
    procedures: rows.filter(r => r.procedure_name !== '[notes]').map(r => r.procedure_name),
    notes: noteRow?.notes ?? '',
  };
}

// ─── syncToxicHabits ─────────────────────────────────────────────────────────

export async function syncToxicHabits(
  patientId: string,
  habits: string[],
): Promise<void> {
  if (!supabase) return;

  await supabase.from('toxic_habits').delete().eq('patient_id', patientId);

  if (!habits.length) return;

  const rows = habits.map(h => ({
    patient_id: patientId,
    habit_type: 'other' as const,
    status: 'current' as const,
    details: h,
  }));

  const { error } = await supabase.from('toxic_habits').insert(rows);
  if (error) console.error('[db] syncToxicHabits:', error);
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

  if (error) console.error('[db] syncRosFindings:', error);
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

  await supabase.from('operative_notes').delete().eq('encounter_id', encounterId);

  const entries = Object.entries(procedureData).filter(([, v]) =>
    v && typeof v === 'object' && Object.keys(v as object).length > 0
  );

  if (!entries.length) return;

  const rows = entries.map(([key, value]) => ({
    patient_id: patientId,
    encounter_id: encounterId,
    procedure_name: PROC_LABELS[key] ?? key,
    findings: JSON.stringify(value),
    status: 'draft',
  }));

  const { error } = await supabase.from('operative_notes').insert(rows);
  if (error) console.error('[db] syncProcedureData:', error);
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

  if (error) console.error('[db] syncTraumaRecord:', error);
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
