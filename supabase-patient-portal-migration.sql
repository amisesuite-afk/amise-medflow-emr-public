-- ============================================================
-- Amise Medical Services — Patient Portal Migration
-- Enables authenticated patient self-service access.
--
-- Run in: Supabase Dashboard → SQL Editor
-- Prerequisites: supabase-schema.sql must have been applied first
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Link patients to Supabase Auth
-- Patients who create a portal account are linked here.
-- Existing rows remain with auth_user_id = NULL (staff-managed).
-- ─────────────────────────────────────────────────────────────
alter table patients
  add column if not exists auth_user_id uuid
    references auth.users(id) on delete set null,
  add column if not exists portal_enabled boolean not null default false,
  add column if not exists portal_registered_at timestamptz;

create unique index if not exists idx_patients_auth_user
  on patients(auth_user_id)
  where auth_user_id is not null;

comment on column patients.auth_user_id is
  'UUID of the Supabase Auth user who owns this patient record (portal access). NULL for staff-managed-only patients.';
comment on column patients.portal_enabled is
  'Set to true by staff when patient is invited to activate their portal account.';

-- ─────────────────────────────────────────────────────────────
-- Helper: returns the patient.id for the currently logged-in
-- portal user (or NULL if the session is staff or anonymous).
-- ─────────────────────────────────────────────────────────────
create or replace function my_patient_id() returns uuid
  language sql security definer stable as $$
  select id from public.patients where auth_user_id = auth.uid() limit 1;
$$;

-- ─────────────────────────────────────────────────────────────
-- RLS: patients — own row only
-- ─────────────────────────────────────────────────────────────
create policy "patients_select_own" on patients
  for select using (auth_user_id = auth.uid());

create policy "patients_update_own_contact" on patients
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- RLS: appointments — own appointments
-- ─────────────────────────────────────────────────────────────
create policy "patients_select_own_appointments" on appointments
  for select using (patient_id = my_patient_id());

-- ─────────────────────────────────────────────────────────────
-- RLS: medications — own active medications
-- ─────────────────────────────────────────────────────────────
create policy "patients_select_own_medications" on medications
  for select using (patient_id = my_patient_id());

-- ─────────────────────────────────────────────────────────────
-- RLS: allergies — own allergies
-- ─────────────────────────────────────────────────────────────
create policy "patients_select_own_allergies" on allergies
  for select using (patient_id = my_patient_id());

-- ─────────────────────────────────────────────────────────────
-- RLS: referrals — own referrals
-- ─────────────────────────────────────────────────────────────
create policy "patients_select_own_referrals" on referrals
  for select using (patient_id = my_patient_id());

-- ─────────────────────────────────────────────────────────────
-- RLS: documents — own non-confidential documents
-- Confidential documents (is_confidential = true) require
-- staff to explicitly share them with the patient in a future
-- update (not in this initial migration).
-- ─────────────────────────────────────────────────────────────
create policy "patients_select_own_documents" on documents
  for select using (
    patient_id = my_patient_id()
    and is_confidential = false
  );

-- ─────────────────────────────────────────────────────────────
-- RLS: questionnaire_sessions — own sessions
-- ─────────────────────────────────────────────────────────────
create policy "patients_select_own_sessions" on questionnaire_sessions
  for select using (patient_id = my_patient_id());

-- ─────────────────────────────────────────────────────────────
-- GRANTS: anon needs nothing extra; authenticated patients
-- already have row-level access via the policies above.
-- The my_patient_id() function must be executable by authenticated role.
-- ─────────────────────────────────────────────────────────────
grant execute on function my_patient_id() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- PORTAL INVITE FUNCTION
-- Staff call this to issue a magic-link invite to a patient.
-- Usage: select invite_patient_to_portal('<patient_uuid>', '<email>');
-- Returns the auth user UUID created.
-- ─────────────────────────────────────────────────────────────
-- NOTE: This function requires the Supabase service role — it is
-- invoked from server-side API routes only, never the browser.
-- It is included here as documentation; the actual invocation
-- uses supabase.auth.admin.inviteUserByEmail() in the API.

-- ─────────────────────────────────────────────────────────────
-- EMAIL CONFIRMATION SETTING
-- Ensure "Email confirmations" is enabled in Supabase Auth settings
-- for magic-link login. Go to: Authentication → Settings →
-- "Enable Email Confirmations" = on.
-- Also set "Site URL" to your patient portal domain.
-- ─────────────────────────────────────────────────────────────
