-- ============================================================
-- Amise Medical Services — Patient Portal Self-Service Migration
-- Adds patient-editable profile fields, intake questionnaire,
-- and document storage bucket policies.
--
-- Run in: Supabase Dashboard → SQL Editor
-- Prerequisites: supabase-patient-portal-migration.sql applied first
-- ============================================================

-- ── Extend patients table ─────────────────────────────────────────────────────
alter table patients
  add column if not exists nok_name     text,       -- Next of Kin name
  add column if not exists nok_relation text,       -- Spouse, Parent, Child, etc.
  add column if not exists nok_phone    text,       -- NOK contact number
  add column if not exists blood_group  text        -- A+, A-, B+, B-, AB+, AB-, O+, O-
    check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown') or blood_group is null),
  add column if not exists height_cm    numeric(5,1),
  add column if not exists weight_kg    numeric(5,1);

-- ── Patient intake questionnaire ─────────────────────────────────────────────
create table if not exists patient_intake (
  id               uuid primary key default uuid_generate_v4(),
  patient_id       uuid not null references patients(id) on delete cascade,
  submitted_at     timestamptz not null default now(),
  chief_complaint  text,
  symptoms         text[],
  duration_days    integer,
  severity         integer check (severity between 1 and 10),
  prior_treatment  text,
  current_meds     text,
  allergies_note   text,
  referral_reason  text,
  additional_notes text
);

alter table patient_intake enable row level security;

create policy if not exists "patients_select_own_intake" on patient_intake
  for select using (patient_id = my_patient_id());

create policy if not exists "patients_insert_own_intake" on patient_intake
  for insert with check (patient_id = my_patient_id());

grant select, insert on public.patient_intake to authenticated;

-- ── Storage bucket for patient documents ─────────────────────────────────────
-- Create bucket (idempotent)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-documents',
  'patient-documents',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/jpg','image/png','image/webp']
)
on conflict (id) do nothing;

-- Documents stored at path: {auth_user_id}/{timestamp}_{filename}
-- Policy: patients can only access files in their own folder (first path segment = auth.uid())

drop policy if exists "patients_upload_own_docs"   on storage.objects;
drop policy if exists "patients_select_own_docs"   on storage.objects;
drop policy if exists "patients_delete_own_docs"   on storage.objects;

create policy "patients_upload_own_docs" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "patients_select_own_docs" on storage.objects
  for select to authenticated using (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "patients_delete_own_docs" on storage.objects
  for delete to authenticated using (
    bucket_id = 'patient-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
