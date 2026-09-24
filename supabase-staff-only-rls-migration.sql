-- ============================================================================
-- Staff-only RLS for PHI tables (security finding S-2)
-- docs/compliance/security-controls.md §3
--
-- PROBLEM
--   Patient-portal users are Supabase Auth users in this same project
--   (auth.admin.inviteUserByEmail in api-server/src/routes/portal.ts). Two
--   things let them read every patient's data with their own JWT:
--
--   1. Many staff policies only test "is authenticated":
--        using (auth.uid() is not null) / using (true) / auth.role() = 'authenticated'
--      e.g. staff_select_patients (supabase-schema.sql), staff_select_documents
--      (supabase-clinical-records-migration.sql), staff_all on
--      appointment_requests. Postgres ORs permissive policies together, so the
--      portal's "own row only" policies (supabase-patient-portal-migration.sql)
--      restrict nothing.
--
--   2. handle_new_user() (supabase-schema.sql) inserts a user_profiles row with
--      role 'front_desk' for EVERY new auth.users row, including every invited
--      portal patient. So even the policies that *do* check
--      auth_role() in (...) (clinical_notes, questionnaire_sessions, call_logs,
--      medications inserts, ...) treat portal patients as front-desk staff.
--
-- FIX (this file)
--   1. handle_new_user() no longer grants a role by default. A profile is only
--      auto-created when the admin API set app_metadata.staff_role (which only
--      the service role can write). Otherwise staff profiles are provisioned by
--      an admin (see migrations/README.md, "Staff onboarding").
--   2. Staff profiles that the old trigger auto-created for portal patients are
--      moved to public.user_profiles_revoked (restorable) and removed.
--   3. Every staff policy that only tested "is authenticated" on a PHI table is
--      recreated (same name, same command) as
--        to authenticated using/with check ((select auth_role()) in
--          ('front_desk','nurse','doctor','admin'))
--      auth_role() returns NULL for a user with no profile row, NULL IN (...)
--      is NULL, and RLS treats NULL as false -> no access.
--   4. The same for the staff storage policies on the private buckets.
--
--   5. patients UPDATE is opened to front_desk (staff_update_patients, which
--      replaces doctors_update_patients). A BEFORE UPDATE trigger stops
--      front_desk changing anything but administrative columns (section 3b).
--
-- PRESERVED (not touched)
--   Patient self-access: patients_select_own, patients_update_own_contact,
--   patients_select_own_{appointments,medications,allergies,referrals,
--   documents,sessions,intake,change_requests}, patients_insert_own_*,
--   patients_{upload,select,delete}_own_docs (storage), all anon intake
--   policies, all service_role policies, and every policy that already uses a
--   narrower role list (e.g. clinical_notes, admins_delete_patients).
--
-- STAFF IMPACT
--   None for staff with a user_profiles row: every role in the CHECK
--   constraint passes the new predicate, which is exactly as wide as the old
--   "is authenticated" test for them. This includes the iOS app and the
--   dashboard, which sign in as staff. Staff WITHOUT a profile row lose access
--   (they had it only through the "is authenticated" hole).
--   Front desk gains patients UPDATE for admin columns. A front-desk update
--   that changes a clinical column used to affect 0 rows silently; it now
--   fails with 42501 (see section 3b).
--
-- Idempotent: drop policy if exists / create policy, create or replace
-- function, create table if not exists; every table is guarded by
-- to_regclass() so tables absent from this project are skipped. Safe to re-run.
-- Must run AFTER every migration that creates these policies (it is the last
-- step in .github/workflows/run-migrations.yml).
-- ============================================================================


-- ── 1. New auth users no longer become front-desk staff automatically ────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_role text := new.raw_app_meta_data ->> 'staff_role';
begin
  -- raw_app_meta_data is writable only with the service role (admin API),
  -- unlike raw_user_meta_data, which a user can set at sign-up. Portal
  -- invites never set staff_role, so portal patients get no profile.
  if requested_role in ('front_desk', 'nurse', 'doctor', 'admin') then
    insert into public.user_profiles (id, full_name, role)
    values (new.id, new.raw_user_meta_data ->> 'full_name', requested_role)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;


-- ── 2. Revoke staff profiles auto-created for portal patients ────────────────
create table if not exists public.user_profiles_revoked (
  id                 uuid        primary key,
  full_name          text,
  role               text        not null,
  default_site       text,
  profile_created_at timestamptz,
  profile_updated_at timestamptz,
  revoked_at         timestamptz not null default now(),
  reason             text        not null
);

comment on table public.user_profiles_revoked is
  'Backup of user_profiles rows removed by supabase-staff-only-rls-migration.sql '
  '(front_desk profiles the old handle_new_user() trigger auto-created for '
  'patient-portal users). Restore procedure: migrations/README.md.';

alter table public.user_profiles_revoked enable row level security;

drop policy if exists "admins_select_revoked_profiles" on public.user_profiles_revoked;
create policy "admins_select_revoked_profiles" on public.user_profiles_revoked
  for select to authenticated
  using ((select public.auth_role()) = 'admin');

grant select                         on table public.user_profiles_revoked to authenticated;
grant select, insert, update, delete on table public.user_profiles_revoked to service_role;

do $$
declare
  n_revoked  integer := 0;
  n_retained integer := 0;
  has_default_site boolean;
begin
  if to_regclass('public.user_profiles') is null
     or to_regclass('public.patients') is null
     or to_regclass('auth.users') is null then
    raise notice '[staff-only-rls] user_profiles/patients/auth.users missing - profile revocation skipped';
    return;
  end if;

  has_default_site := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'default_site'
  );

  -- A profile is treated as "auto-created for a portal patient" only when ALL of:
  --   * role is the trigger's default ('front_desk'),
  --   * full_name is null and the row was never edited (the trigger wrote it
  --     and no admin touched it; user_profiles is writable only by admins),
  --   * the auth user is linked to a patient record (patients.auth_user_id) OR
  --     has no password (portal users sign in by magic link / OTP only; every
  --     staff app - dashboard, front-desk staff portal, iOS - uses a password),
  --   * it was not revoked before (a re-created row means an admin restored it
  --     on purpose; never revoke it again on a re-run).
  execute format($q$
    with moved as (
      insert into public.user_profiles_revoked
        (id, full_name, role, default_site, profile_created_at, profile_updated_at, reason)
      select up.id, up.full_name, up.role, %s, up.created_at, up.updated_at,
             case when exists (select 1 from public.patients p where p.auth_user_id = up.id)
                  then 'auto-created front_desk profile for a portal-linked auth user'
                  else 'auto-created front_desk profile for a passwordless auth user'
             end
      from public.user_profiles up
      join auth.users u on u.id = up.id
      where up.role = 'front_desk'
        and up.full_name is null
        and up.updated_at <= up.created_at + interval '1 second'
        and (
          exists (select 1 from public.patients p where p.auth_user_id = up.id)
          or coalesce(u.encrypted_password, '') = ''
        )
        and not exists (select 1 from public.user_profiles_revoked r where r.id = up.id)
      returning id
    )
    delete from public.user_profiles up using moved where up.id = moved.id
  $q$, case when has_default_site then 'up.default_site' else 'null::text' end);
  get diagnostics n_revoked = row_count;

  -- Portal-linked accounts that still hold a staff role (named, edited, or
  -- elevated by an admin) are left alone but reported for manual review.
  select count(*) into n_retained
  from public.user_profiles up
  where exists (select 1 from public.patients p where p.auth_user_id = up.id);

  raise notice '[staff-only-rls] revoked % auto-created portal profile(s); % portal-linked account(s) still hold a staff role - review them (migrations/README.md)',
    n_revoked, n_retained;
end $$;


-- ── 3. Core tables (explicit; names are checked by lint:rls-policies) ────────
do $$
begin
  -- patients: staff read/insert. Update/delete were already role-gated
  -- (doctors_update_patients, admins_delete_patients). Patient self-access
  -- (patients_select_own, patients_update_own_contact) is untouched.
  if to_regclass('public.patients') is not null then
    drop policy if exists "staff_select_patients" on public.patients;
    create policy "staff_select_patients" on public.patients
      for select to authenticated
      using ((select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));

    drop policy if exists "staff_insert_patients" on public.patients;
    create policy "staff_insert_patients" on public.patients
      for insert to authenticated
      with check ((select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));

    -- UPDATE: all staff roles, including front_desk (previously doctor/
    -- nurse/admin only, so front-desk edits silently updated 0 rows).
    -- Front desk is limited to administrative columns by the
    -- patients_front_desk_column_guard trigger in section 3b. Replaces
    -- doctors_update_patients; the name changed because it no longer
    -- describes the policy.
    drop policy if exists "doctors_update_patients" on public.patients;
    drop policy if exists "staff_update_patients" on public.patients;
    create policy "staff_update_patients" on public.patients
      for update to authenticated
      using ((select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'))
      with check ((select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));
  end if;

  -- documents: staff read/insert. staff_update_documents allowed
  -- "created_by = auth.uid()" for anyone, and portal uploads are registered
  -- with created_by = the patient's auth uid - so a patient could rewrite
  -- their document rows (patient_id, is_confidential, review flags). Now
  -- staff-only, same author/doctor/admin rule. patients_select_own_documents
  -- (own, non-confidential) is untouched.
  if to_regclass('public.documents') is not null then
    drop policy if exists "staff_select_documents" on public.documents;
    create policy "staff_select_documents" on public.documents
      for select to authenticated
      using ((select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));

    drop policy if exists "staff_insert_documents" on public.documents;
    create policy "staff_insert_documents" on public.documents
      for insert to authenticated
      with check ((select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));

    drop policy if exists "staff_update_documents" on public.documents;
    create policy "staff_update_documents" on public.documents
      for update to authenticated
      using (
        (select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin')
        and (created_by = auth.uid() or (select public.auth_role()) in ('doctor', 'admin'))
      )
      with check (
        (select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin')
        and (created_by = auth.uid() or (select public.auth_role()) in ('doctor', 'admin'))
      );
  end if;

  -- appointment_requests: staff_all was "for all using (true)" with no TO
  -- clause, i.e. every role. The anon INSERT-only intake policies are
  -- untouched.
  if to_regclass('public.appointment_requests') is not null then
    drop policy if exists "staff_all" on public.appointment_requests;
    create policy "staff_all" on public.appointment_requests
      for all to authenticated
      using ((select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'))
      with check ((select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));
  end if;

  -- appointment_change_requests: "authenticated and not linked to a patient"
  -- let an auth user with no patients link act as staff. Patient self-access
  -- (patients_{select,insert}_own_change_requests) is untouched.
  if to_regclass('public.appointment_change_requests') is not null then
    drop policy if exists "staff_manage_change_requests" on public.appointment_change_requests;
    create policy "staff_manage_change_requests" on public.appointment_change_requests
      for all to authenticated
      using ((select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'))
      with check ((select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));
  end if;

  -- clinical_notes: deliberately unchanged. Its four policies already use
  -- auth_role() with doctor/admin (and nurse for signed notes) only, so a
  -- portal patient - with no profile, or with the old auto 'front_desk'
  -- profile - never passed them.
end $$;


-- ── 3b. Front desk may edit patient ADMIN details, not clinical fields ───────
-- BEFORE UPDATE guard on patients. When the caller's role is front_desk, any
-- column outside the allow-list whose value actually changes
-- (OLD IS DISTINCT FROM NEW) raises SQLSTATE 42501. Unchanged values pass, so
-- a client that sends the whole row (the iOS pushPatientEdits payload does)
-- succeeds when only admin fields differ. New columns are blocked for front
-- desk by default until added here.
--
-- Everyone else passes through: nurse/doctor/admin; portal patients (their
-- own-row policy is separate); and the service role / API server and
-- migrations, where auth.uid() is null so auth_role() is null.
--
-- Allow-list sources: the columns in the migration tree, the api-server
-- PATCH /api/patients/:id demographics fields (patients-staff.ts), and the
-- iOS front-desk screens (FDPatientDemographicsPanel: check-in;
-- AppointmentSchedulerView: setting + operation_date when booking).
create or replace function public.enforce_front_desk_patient_columns()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  admin_columns constant text[] := array[
    -- identity and contact
    'full_name', 'first_name', 'last_name', 'date_of_birth', 'sex',
    'phone', 'email', 'address', 'quarter', 'occupation', 'photo_url',
    'mrn', 'nhi_number',
    -- next of kin / emergency contact
    'nok_name', 'nok_relation', 'nok_phone', 'emergency_contact', 'emergency_phone',
    -- insurance and referral administration
    'insurance_provider', 'policy_number', 'pre_auth_status', 'referred_by',
    -- scheduling / encounter flow set by the front desk
    'check_in_time', 'encounter_status', 'setting', 'location', 'operation_date',
    -- bookkeeping
    'updated_at', 'updated_by'
  ];
  blocked text[];
begin
  if public.auth_role() is distinct from 'front_desk' then
    return new;
  end if;

  select array_agg(n.key order by n.key)
    into blocked
  from jsonb_each(to_jsonb(new)) as n
  join jsonb_each(to_jsonb(old)) as o on o.key = n.key
  where n.value is distinct from o.value
    and not (n.key = any (admin_columns));

  if blocked is not null then
    -- Column names only, never values (no PHI in the error).
    raise exception 'front-desk staff may only change administrative patient fields; blocked: %',
        array_to_string(blocked, ', ')
      using errcode = '42501',
            hint = 'Front desk may edit identity, contact, next-of-kin, insurance and scheduling fields. Ask a nurse or doctor to change clinical fields.';
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.patients') is null then
    raise notice '[staff-only-rls] public.patients missing - front-desk column guard skipped';
    return;
  end if;
  drop trigger if exists patients_front_desk_column_guard on public.patients;
  -- BEFORE triggers fire in name order: this runs before trg_updated_at, so it
  -- sees only what the client sent (updated_at is allow-listed either way).
  create trigger patients_front_desk_column_guard
    before update on public.patients
    for each row execute function public.enforce_front_desk_patient_columns();
end $$;


-- ── 4. Every other PHI table: rewrite "is authenticated" staff policies ──────
-- Table-driven so it also catches policies applied to production outside the
-- runner (e.g. the conflicting duplicate definitions listed in
-- migrations/README.md, whose policy names differ between files). Only
-- PERMISSIVE policies for the public/authenticated roles whose USING and WITH
-- CHECK are exactly one of
--     true | auth.uid() IS NOT NULL | auth.role() = 'authenticated'
-- are rewritten; anything with a real predicate (own-row, role list,
-- service_role, anon) is left alone. Name and command are kept.
-- Reference-only tables (questionnaire_templates, question_bank,
-- branching_rules, clinical_guidelines) hold no patient data and are not listed.
do $$
declare
  staff_pred constant text :=
    '(select public.auth_role()) in (''front_desk'', ''nurse'', ''doctor'', ''admin'')';
  phi_tables constant text[] := array[
    -- supabase-schema.sql
    'patients', 'encounters', 'vitals', 'symptoms', 'medications', 'allergies',
    'procedures', 'referrals', 'appointments', 'appointment_requests', 'audit_logs',
    -- clinical records / intake / scheduling
    'documents', 'billing_charges', 'imaging_orders', 'investigation_results',
    'consultation_requests', 'referring_providers', 'confirmed_appointments',
    'procedure_prep_drafts', 'appointment_change_requests', 'pending_bookings',
    -- clinical persistence
    'surgical_history', 'toxic_habits', 'ros_findings', 'scales_scores',
    'dashboard_prescriptions', 'operative_notes', 'trauma_records',
    'clinical_attachments', 'prescriptions', 'patient_tasks', 'pmh_items',
    'patient_problems', 'wound_assessments', 'mm_cases',
    -- workflow / identity / state
    'escalation_events', 'patient_identifiers', 'duplicate_queue',
    'calendar_event_cache', 'patient_token_blacklist', 'ai_proposals',
    'workflow_tasks', 'clinical_states', 'clinical_state_transitions',
    'theatre_sessions', 'theatre_cases', 'clinical_facts',
    'encounter_state_history', 'active_alerts', 'sync_conflicts',
    -- iOS-synced tables
    'patient_vitals', 'patient_operative_plans', 'patient_billing_items',
    'patient_documents',
    -- audit / ops
    'audit_log', 'clinical_audit_log', 'backup_runs'
  ];
  open_forms constant text[] := array[
    'true', 'auth.uidisnotnull', 'auth.role=''authenticated''::text'
  ];
  r record;
  n integer := 0;
begin
  for r in
    select p.tablename, p.policyname, p.cmd, p.qual, p.with_check
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = any (phi_tables)
      and p.permissive = 'PERMISSIVE'
      and p.roles && array['public', 'authenticated']::name[]
      and (p.qual is not null or p.with_check is not null)
      and (p.qual is null
           or regexp_replace(lower(p.qual), '[[:space:]()]', '', 'g') = any (open_forms))
      and (p.with_check is null
           or regexp_replace(lower(p.with_check), '[[:space:]()]', '', 'g') = any (open_forms))
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    execute format(
      'create policy %I on public.%I for %s to authenticated %s',
      r.policyname, r.tablename, r.cmd,
      case r.cmd
        when 'SELECT' then format('using (%s)', staff_pred)
        when 'DELETE' then format('using (%s)', staff_pred)
        when 'INSERT' then format('with check (%s)', staff_pred)
        else               format('using (%s) with check (%s)', staff_pred, staff_pred)
      end
    );
    n := n + 1;
    raise notice '[staff-only-rls] %.% (%) -> staff roles only', r.tablename, r.policyname, r.cmd;
  end loop;
  raise notice '[staff-only-rls] rewrote % open staff policy(ies)', n;
end $$;


-- ── 5. Private storage buckets: staff policies ───────────────────────────────
-- Previously any authenticated user could read, upload and delete every
-- object in these buckets. Kept: patients_{upload,select,delete}_own_docs
-- (portal patients, own <auth uid>/ folder in patient-documents) and the
-- service_role policies.
do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice '[staff-only-rls] storage.objects missing - storage policies skipped';
    return;
  end if;

  -- clinical-attachments
  drop policy if exists "Authenticated users can upload clinical attachments" on storage.objects;
  drop policy if exists "Authenticated users can read clinical attachments"   on storage.objects;
  drop policy if exists "Authenticated users can delete clinical attachments" on storage.objects;
  drop policy if exists "staff_upload_clinical_attachments" on storage.objects;
  drop policy if exists "staff_read_clinical_attachments"   on storage.objects;
  drop policy if exists "staff_delete_clinical_attachments" on storage.objects;
  create policy "staff_upload_clinical_attachments" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'clinical-attachments'
                and (select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));
  create policy "staff_read_clinical_attachments" on storage.objects
    for select to authenticated
    using (bucket_id = 'clinical-attachments'
           and (select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));
  create policy "staff_delete_clinical_attachments" on storage.objects
    for delete to authenticated
    using (bucket_id = 'clinical-attachments'
           and (select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));

  -- patient-documents (staff side; patients keep their own-folder policies)
  drop policy if exists "Authenticated users can upload patient documents" on storage.objects;
  drop policy if exists "Authenticated users can read patient documents"   on storage.objects;
  drop policy if exists "Authenticated users can delete patient documents" on storage.objects;
  drop policy if exists "staff_upload_patient_documents" on storage.objects;
  drop policy if exists "staff_read_patient_documents"   on storage.objects;
  drop policy if exists "staff_delete_patient_documents" on storage.objects;
  create policy "staff_upload_patient_documents" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'patient-documents'
                and (select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));
  create policy "staff_read_patient_documents" on storage.objects
    for select to authenticated
    using (bucket_id = 'patient-documents'
           and (select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));
  create policy "staff_delete_patient_documents" on storage.objects
    for delete to authenticated
    using (bucket_id = 'patient-documents'
           and (select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));

  -- patient-photos
  drop policy if exists "staff_upload_patient_photos" on storage.objects;
  drop policy if exists "staff_update_patient_photos" on storage.objects;
  drop policy if exists "staff_read_patient_photos"   on storage.objects;
  create policy "staff_upload_patient_photos" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'patient-photos'
                and (select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));
  create policy "staff_update_patient_photos" on storage.objects
    for update to authenticated
    using (bucket_id = 'patient-photos'
           and (select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'))
    with check (bucket_id = 'patient-photos'
                and (select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));
  create policy "staff_read_patient_photos" on storage.objects
    for select to authenticated
    using (bucket_id = 'patient-photos'
           and (select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));

  -- call-recordings (was: any authenticated user)
  drop policy if exists "authenticated staff can read call recordings" on storage.objects;
  create policy "authenticated staff can read call recordings" on storage.objects
    for select to authenticated
    using (bucket_id = 'call-recordings'
           and (select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));
end $$;
