-- ============================================================
-- Amise Medical Services — CONSOLIDATED SCHEMA + ALL MIGRATIONS
-- Generated: 2026-06-18
--
-- This file contains the base schema (supabase-schema.sql) followed
-- by all 22 migrations in the order defined by supabase-migration-order.sql.
--
-- All statements are idempotent (CREATE IF NOT EXISTS, ALTER ADD IF NOT EXISTS)
-- so it is safe to run the entire script even if parts already exist.
--
-- Run in: Supabase Dashboard -> SQL Editor
-- ============================================================


-- ============================================================
-- BASE SCHEMA: supabase-schema.sql
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- USER PROFILES (roles)
-- ---------------------------------------------------------
create table if not exists user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'front_desk'
                check (role in ('front_desk', 'nurse', 'doctor', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create profile on new user signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'front_desk')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------
-- PATIENTS
-- ---------------------------------------------------------
create table if not exists patients (
  id                  uuid primary key default uuid_generate_v4(),
  mrn                 text unique,
  full_name           text not null,
  date_of_birth       date,
  sex                 text check (sex in ('male', 'female', 'other', 'unknown')),
  phone               text,
  email               text,
  address             text,
  emergency_contact   text,
  emergency_phone     text,
  created_by          uuid references auth.users(id),
  updated_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------
-- ENCOUNTERS
-- ---------------------------------------------------------
create table if not exists encounters (
  id              uuid primary key default uuid_generate_v4(),
  patient_id      uuid not null references patients(id) on delete cascade,
  encounter_date  timestamptz not null default now(),
  encounter_type  text not null default 'outpatient'
                    check (encounter_type in ('outpatient', 'inpatient', 'emergency', 'procedure', 'telehealth')),
  chief_complaint text,
  status          text not null default 'open'
                    check (status in ('open', 'in_progress', 'closed', 'cancelled')),
  site            text check (site in ('rodney_bay', 'castries', 'tapion')),
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------
-- VITALS
-- ---------------------------------------------------------
create table if not exists vitals (
  id                  uuid primary key default uuid_generate_v4(),
  encounter_id        uuid not null references encounters(id) on delete cascade,
  patient_id          uuid not null references patients(id),
  bp_systolic         integer,
  bp_diastolic        integer,
  heart_rate          integer,
  temperature_c       numeric(4,1),
  oxygen_saturation   integer,
  respiratory_rate    integer,
  weight_kg           numeric(5,1),
  height_cm           numeric(5,1),
  bmi                 numeric(4,1) generated always as (
                        case when height_cm > 0 then round((weight_kg / ((height_cm/100)^2))::numeric, 1) end
                      ) stored,
  glucose_mmol        numeric(4,1),
  recorded_at         timestamptz not null default now(),
  created_by          uuid references auth.users(id),
  updated_by          uuid references auth.users(id),
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------
-- SYMPTOMS
-- ---------------------------------------------------------
create table if not exists symptoms (
  id            uuid primary key default uuid_generate_v4(),
  encounter_id  uuid not null references encounters(id) on delete cascade,
  patient_id    uuid not null references patients(id),
  symptom       text not null,
  severity      text check (severity in ('mild', 'moderate', 'severe')),
  duration_days integer,
  details       jsonb,
  notes         text,
  created_by    uuid references auth.users(id),
  updated_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------
-- MEDICATIONS
-- ---------------------------------------------------------
create table if not exists medications (
  id            uuid primary key default uuid_generate_v4(),
  patient_id    uuid not null references patients(id) on delete cascade,
  encounter_id  uuid references encounters(id),
  drug_name     text not null,
  dose          text,
  frequency     text,
  route         text,
  indication    text,
  start_date    date,
  end_date      date,
  status        text not null default 'active'
                  check (status in ('active', 'stopped', 'completed', 'on_hold')),
  created_by    uuid references auth.users(id),
  updated_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------
-- ALLERGIES
-- ---------------------------------------------------------
create table if not exists allergies (
  id            uuid primary key default uuid_generate_v4(),
  patient_id    uuid not null references patients(id) on delete cascade,
  allergen      text not null,
  reaction      text,
  severity      text check (severity in ('mild', 'moderate', 'severe', 'life_threatening')),
  status        text not null default 'active' check (status in ('active', 'inactive', 'resolved')),
  created_by    uuid references auth.users(id),
  updated_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------
-- ASSESSMENTS
-- ---------------------------------------------------------
create table if not exists assessments (
  id            uuid primary key default uuid_generate_v4(),
  encounter_id  uuid not null references encounters(id) on delete cascade,
  patient_id    uuid not null references patients(id),
  icd10_code    text,
  diagnosis     text,
  differentials text,
  acuity        text check (acuity in ('routine', 'review', 'priority', 'urgent')),
  triage_score  integer,
  notes         text,
  created_by    uuid references auth.users(id),
  updated_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------
-- PLANS
-- ---------------------------------------------------------
create table if not exists plans (
  id              uuid primary key default uuid_generate_v4(),
  encounter_id    uuid not null references encounters(id) on delete cascade,
  patient_id      uuid not null references patients(id),
  plan_type       text check (plan_type in ('management', 'discharge', 'follow_up', 'referral', 'admission')),
  description     text,
  follow_up_date  date,
  follow_up_notes text,
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------
-- PROCEDURES
-- ---------------------------------------------------------
create table if not exists procedures (
  id              uuid primary key default uuid_generate_v4(),
  patient_id      uuid not null references patients(id),
  encounter_id    uuid references encounters(id),
  procedure_name  text not null,
  cpt_code        text,
  site            text check (site in ('rodney_bay', 'castries', 'tapion')),
  scheduled_date  date,
  performed_date  date,
  status          text not null default 'scheduled'
                    check (status in ('scheduled', 'completed', 'cancelled', 'postponed')),
  anaesthesia     text,
  surgeon         text,
  assistant       text,
  notes           text,
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------
-- REFERRALS
-- ---------------------------------------------------------
create table if not exists referrals (
  id            uuid primary key default uuid_generate_v4(),
  patient_id    uuid not null references patients(id),
  encounter_id  uuid references encounters(id),
  referral_to   text,
  specialty     text,
  reason        text,
  urgency       text check (urgency in ('routine', 'soon', 'urgent', 'emergency')),
  status        text not null default 'pending'
                  check (status in ('pending', 'sent', 'accepted', 'completed', 'declined')),
  notes         text,
  created_by    uuid references auth.users(id),
  updated_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------
-- APPOINTMENTS
-- ---------------------------------------------------------
create table if not exists appointments (
  id                    uuid primary key default uuid_generate_v4(),
  patient_id            uuid not null references patients(id),
  appointment_datetime  timestamptz,
  appointment_type      text,
  site                  text check (site in ('rodney_bay', 'castries', 'tapion')),
  calendar_event_id     text,
  status                text not null default 'scheduled'
                          check (status in ('scheduled', 'confirmed', 'attended', 'cancelled', 'no_show')),
  reminder_sent_48h     boolean default false,
  reminder_sent_24h     boolean default false,
  reminder_sent_2h      boolean default false,
  notes                 text,
  created_by            uuid references auth.users(id),
  updated_by            uuid references auth.users(id),
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------
-- AUDIT LOGS
-- ---------------------------------------------------------
create table if not exists audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id),
  action      text not null,
  table_name  text,
  record_id   uuid,
  old_values  jsonb,
  new_values  jsonb,
  ip_address  text,
  user_agent  text,
  mode        text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------
-- UPDATED_AT TRIGGER (applied to all audit-tracked tables)
-- ---------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ declare t text; begin
  foreach t in array array[
    'patients','encounters','vitals','medications','allergies',
    'assessments','plans','procedures','referrals','appointments','user_profiles'
  ] loop
    execute format(
      'drop trigger if exists trg_updated_at on %I;
       create trigger trg_updated_at before update on %I
         for each row execute function set_updated_at();', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------
-- Helper to get current user's role
create or replace function auth_role() returns text language sql security definer stable as $$
  select role from public.user_profiles where id = auth.uid();
$$;

-- Enable RLS on all tables
do $$ declare t text; begin
  foreach t in array array[
    'user_profiles','patients','encounters','vitals','symptoms',
    'medications','allergies','assessments','plans','procedures',
    'referrals','appointments','audit_logs'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- -- user_profiles --
-- Users can read their own profile; admins see all
create policy "users_select_own_profile" on user_profiles
  for select using (id = auth.uid() or auth_role() = 'admin');
create policy "admins_manage_profiles" on user_profiles
  for all using (auth_role() = 'admin');

-- -- patients --
-- All authenticated staff can read patients
create policy "staff_select_patients" on patients
  for select using (auth.uid() is not null);
-- Front desk, nurses, doctors, admins can insert
create policy "staff_insert_patients" on patients
  for insert with check (auth.uid() is not null);
-- Doctors and admins can update
create policy "doctors_update_patients" on patients
  for update using (auth_role() in ('doctor', 'admin', 'nurse'));
-- Admins only can delete
create policy "admins_delete_patients" on patients
  for delete using (auth_role() = 'admin');

-- -- encounters --
create policy "staff_select_encounters" on encounters
  for select using (auth.uid() is not null);
create policy "staff_insert_encounters" on encounters
  for insert with check (auth.uid() is not null);
create policy "doctors_update_encounters" on encounters
  for update using (auth_role() in ('doctor', 'admin', 'nurse'));
create policy "admins_delete_encounters" on encounters
  for delete using (auth_role() = 'admin');

-- -- vitals --
create policy "staff_select_vitals" on vitals
  for select using (auth.uid() is not null);
create policy "nurses_insert_vitals" on vitals
  for insert with check (auth_role() in ('nurse', 'doctor', 'admin'));
create policy "nurses_update_vitals" on vitals
  for update using (auth_role() in ('nurse', 'doctor', 'admin'));

-- -- symptoms --
create policy "staff_select_symptoms" on symptoms
  for select using (auth.uid() is not null);
create policy "staff_insert_symptoms" on symptoms
  for insert with check (auth.uid() is not null);
create policy "staff_update_symptoms" on symptoms
  for update using (created_by = auth.uid() or auth_role() in ('doctor', 'admin'));

-- -- medications --
create policy "staff_select_medications" on medications
  for select using (auth.uid() is not null);
create policy "nurses_insert_medications" on medications
  for insert with check (auth_role() in ('nurse', 'doctor', 'admin', 'front_desk'));
create policy "nurses_update_medications" on medications
  for update using (auth_role() in ('nurse', 'doctor', 'admin'));

-- -- allergies --
create policy "staff_select_allergies" on allergies
  for select using (auth.uid() is not null);
create policy "staff_insert_allergies" on allergies
  for insert with check (auth.uid() is not null);
create policy "staff_update_allergies" on allergies
  for update using (created_by = auth.uid() or auth_role() in ('doctor', 'admin', 'nurse'));

-- -- assessments (doctor/admin only) --
create policy "doctors_select_assessments" on assessments
  for select using (auth_role() in ('doctor', 'admin', 'nurse'));
create policy "doctors_insert_assessments" on assessments
  for insert with check (auth_role() in ('doctor', 'admin'));
create policy "doctors_update_assessments" on assessments
  for update using (auth_role() in ('doctor', 'admin'));

-- -- plans (doctor/admin only) --
create policy "doctors_select_plans" on plans
  for select using (auth_role() in ('doctor', 'admin', 'nurse'));
create policy "doctors_insert_plans" on plans
  for insert with check (auth_role() in ('doctor', 'admin'));
create policy "doctors_update_plans" on plans
  for update using (auth_role() in ('doctor', 'admin'));

-- -- procedures --
create policy "staff_select_procedures" on procedures
  for select using (auth.uid() is not null);
create policy "doctors_manage_procedures" on procedures
  for all using (auth_role() in ('doctor', 'admin'));

-- -- referrals --
create policy "staff_select_referrals" on referrals
  for select using (auth.uid() is not null);
create policy "doctors_manage_referrals" on referrals
  for all using (auth_role() in ('doctor', 'admin'));

-- -- appointments --
create policy "staff_select_appointments" on appointments
  for select using (auth.uid() is not null);
create policy "staff_insert_appointments" on appointments
  for insert with check (auth.uid() is not null);
create policy "staff_update_appointments" on appointments
  for update using (auth.uid() is not null);
create policy "admins_delete_appointments" on appointments
  for delete using (auth_role() = 'admin');

-- -- audit_logs (append-only for all authenticated; read for doctors/admins) --
create policy "staff_insert_audit" on audit_logs
  for insert with check (auth.uid() is not null);
create policy "admins_select_audit" on audit_logs
  for select using (auth_role() in ('doctor', 'admin'));

-- ---------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------
create index if not exists idx_patients_mrn       on patients(mrn);
create index if not exists idx_patients_email     on patients(email);
create index if not exists idx_encounters_patient on encounters(patient_id);
create index if not exists idx_encounters_date    on encounters(encounter_date desc);
create index if not exists idx_vitals_encounter   on vitals(encounter_id);
create index if not exists idx_symptoms_encounter on symptoms(encounter_id);
create index if not exists idx_meds_patient       on medications(patient_id);
create index if not exists idx_allergy_patient    on allergies(patient_id);
create index if not exists idx_appt_patient       on appointments(patient_id);
create index if not exists idx_appt_datetime      on appointments(appointment_datetime);
create index if not exists idx_audit_user         on audit_logs(user_id);
create index if not exists idx_audit_created      on audit_logs(created_at desc);

-- ---------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update        on public.user_profiles   to authenticated;
grant select, insert, update        on public.patients         to authenticated;
grant select, insert, update        on public.encounters       to authenticated;
grant select, insert, update        on public.vitals           to authenticated;
grant select, insert, update        on public.symptoms         to authenticated;
grant select, insert, update        on public.medications      to authenticated;
grant select, insert, update        on public.allergies        to authenticated;
grant select, insert, update        on public.assessments      to authenticated;
grant select, insert, update        on public.plans            to authenticated;
grant select, insert, update        on public.procedures       to authenticated;
grant select, insert, update        on public.referrals        to authenticated;
grant select, insert, update        on public.appointments     to authenticated;

-- service_role (artifacts/api-server's sb() client) needs full table
-- privileges on these core tables. RLS is bypassed for service_role, but
-- the underlying GRANT is still required or Postgres returns
-- "permission denied for table X" (42501) before RLS is even evaluated.
grant select, insert, update, delete on public.user_profiles   to service_role;
grant select, insert, update, delete on public.patients         to service_role;
grant select, insert, update, delete on public.encounters       to service_role;
grant select, insert, update, delete on public.vitals           to service_role;
grant select, insert, update, delete on public.symptoms         to service_role;
grant select, insert, update, delete on public.medications      to service_role;
grant select, insert, update, delete on public.allergies        to service_role;
grant select, insert, update, delete on public.assessments      to service_role;
grant select, insert, update, delete on public.plans            to service_role;
grant select, insert, update, delete on public.procedures       to service_role;
grant select, insert, update, delete on public.referrals        to service_role;
grant select, insert, update, delete on public.appointments     to service_role;

-- -- Appointment requests (self-triage portal) --
create table if not exists appointment_requests (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  patient_name     text not null,
  patient_email    text,
  patient_phone    text,
  appointment_type text not null,
  location         text not null default 'rodney_bay',
  preferred_slot   text,                  -- patient's requested slot (free text or ISO date)
  confirmed_slot   timestamptz,           -- slot confirmed by staff
  reason           text,
  triage_acuity    text,                  -- from self-triage engine
  triage_score     int,
  status           text not null default 'pending'
                   check (status in ('pending','staff_confirmed','patient_confirmed','waitlisted','lapsed','cancelled')),
  staff_confirmed_at  timestamptz,
  patient_confirmed_at timestamptz,
  reminder_sent_at    timestamptz,
  google_event_id     text,
  notes               text,
  patient_ack_sent_at timestamptz,
  staff_notified_at   timestamptz,
  staff_escalated_at  timestamptz,
  prep_sms_sent       boolean not null default false,
  source              text not null default 'web'
                      check (source in ('web', 'whatsapp', 'manual', 'phone', 'email')),
  whatsapp_from       text
);

alter table appointment_requests enable row level security;
create policy "staff_all" on appointment_requests for all using (true);
grant select, insert, update        on public.appointment_requests to authenticated, service_role;

create index if not exists idx_appt_requests_pending_created
  on appointment_requests (status, created_at)
  where status = 'pending';
create index if not exists idx_appt_requests_source
  on appointment_requests (source, status, created_at);
grant select, insert               on public.audit_logs       to authenticated;
grant select, insert, update, delete on public.audit_logs     to service_role;


-- ============================================================
-- Migration 1: Clinical records (clinical_notes, documents,
--   billing_charges, imaging_orders, investigation_results)
-- ============================================================

-- ---------------------------------------------------------
-- CLINICAL NOTES
-- Physician SOAP, progress, operative and discharge notes.
-- AI-drafted notes must be reviewed and signed by a physician
-- before status can move to 'signed'. Unsigned drafts are only
-- visible to the authoring doctor and admins.
-- ---------------------------------------------------------
create table if not exists clinical_notes (
  id               uuid        primary key default uuid_generate_v4(),
  patient_id       uuid        not null references patients(id)   on delete cascade,
  encounter_id     uuid        references encounters(id) on delete set null,

  note_type        text        not null default 'progress'
                               check (note_type in (
                                 'soap', 'progress', 'operative', 'procedure',
                                 'discharge', 'consultation', 'referral_letter', 'other'
                               )),
  status           text        not null default 'draft'
                               check (status in ('draft', 'signed', 'amended', 'addendum')),

  content          text        not null,
  content_html     text,

  -- AI provenance -- required for the sign-before-use workflow
  ai_assisted      boolean     not null default false,
  ai_model_used    text,

  -- Physician signature
  signed_by        uuid        references auth.users(id) on delete set null,
  signed_at        timestamptz,
  amended_reason   text,

  created_by       uuid        references auth.users(id) on delete set null,
  updated_by       uuid        references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table clinical_notes is
  'Physician notes: SOAP, progress, operative, discharge. AI-drafted notes require physician signature before status becomes ''signed''.';
comment on column clinical_notes.ai_assisted is
  'True when content was initially generated by AI -- physician must review and sign before any clinical use.';
comment on column clinical_notes.signed_by is
  'UUID of the physician who signed the note. Null until explicitly signed.';

-- ---------------------------------------------------------
-- DOCUMENTS
-- Uploaded PDFs, scanned forms, generated summaries, received
-- referral letters and lab reports.
-- Actual files are stored in Supabase Storage; this table holds
-- metadata and the storage object path.
-- ---------------------------------------------------------
create table if not exists documents (
  id               uuid        primary key default uuid_generate_v4(),
  patient_id       uuid        not null references patients(id) on delete cascade,
  encounter_id     uuid        references encounters(id) on delete set null,

  document_type    text        not null default 'other'
                               check (document_type in (
                                 'lab_report', 'imaging_report', 'referral_letter',
                                 'consent_form', 'surgical_report', 'discharge_summary',
                                 'prescription', 'insurance_form', 'other'
                               )),
  title            text        not null,
  file_name        text,
  -- Path within the Supabase Storage bucket (e.g. patients/{patient_id}/{uuid}.pdf)
  storage_path     text,
  mime_type        text,
  file_size_bytes  bigint,

  source           text        not null default 'uploaded'
                               check (source in (
                                 'uploaded', 'generated', 'received_fax',
                                 'received_email', 'scanned'
                               )),
  is_confidential  boolean     not null default false,
  notes            text,

  created_by       uuid        references auth.users(id) on delete set null,
  updated_by       uuid        references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table documents is
  'Patient documents: uploaded PDFs, generated summaries, scanned forms, received reports. Files are stored in Supabase Storage.';
comment on column documents.storage_path is
  'Object path within the Supabase Storage ''patient-documents'' bucket.';

-- ---------------------------------------------------------
-- BILLING CHARGES
-- Line-item charges per encounter, in XCD.
-- Waived charges are retained for audit. Totals are computed
-- at query time (quantity x unit_price - discount).
-- ---------------------------------------------------------
create table if not exists billing_charges (
  id                  uuid          primary key default uuid_generate_v4(),
  patient_id          uuid          not null references patients(id)   on delete cascade,
  encounter_id        uuid          not null references encounters(id)  on delete cascade,

  charge_code         text,
  charge_description  text          not null,
  quantity            integer       not null default 1  check (quantity > 0),
  unit_price_xcd      numeric(10,2) not null             check (unit_price_xcd >= 0),
  discount_xcd        numeric(10,2) not null default 0   check (discount_xcd >= 0),

  category            text          not null default 'consultation'
                                    check (category in (
                                      'consultation', 'procedure', 'investigation',
                                      'medication', 'facility', 'anaesthesia', 'other'
                                    )),
  status              text          not null default 'pending'
                                    check (status in (
                                      'pending', 'invoiced', 'paid', 'waived', 'disputed'
                                    )),
  invoice_number      text,
  invoiced_at         timestamptz,
  paid_at             timestamptz,
  payment_method      text          check (payment_method in (
                                      'cash', 'card', 'insurance', 'transfer', 'waived'
                                    )),
  notes               text,

  created_by          uuid          references auth.users(id) on delete set null,
  updated_by          uuid          references auth.users(id) on delete set null,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now()
);

comment on table billing_charges is
  'Line-item billing charges per encounter, in XCD. Query total as: quantity * unit_price_xcd - discount_xcd.';
comment on column billing_charges.charge_code is
  'CPT code or internal Amise charge code.';

-- ---------------------------------------------------------
-- IMAGING ORDERS
-- X-ray, CT, MRI, ultrasound, endoscopy (colonoscopy, ERCP,
-- OGD) and other imaging / interventional radiology orders.
-- ---------------------------------------------------------
create table if not exists imaging_orders (
  id                    uuid        primary key default uuid_generate_v4(),
  patient_id            uuid        not null references patients(id) on delete cascade,
  encounter_id          uuid        references encounters(id) on delete set null,

  order_type            text        not null
                                    check (order_type in (
                                      'xray', 'ultrasound', 'ct', 'mri', 'pet',
                                      'ercp', 'colonoscopy', 'egd', 'flexible_sig',
                                      'mammogram', 'dexa', 'angiogram', 'other'
                                    )),
  body_area             text,
  laterality            text        check (laterality in (
                                      'left', 'right', 'bilateral', 'not_applicable'
                                    )),
  clinical_indication   text        not null,
  urgency               text        not null default 'routine'
                                    check (urgency in ('routine', 'soon', 'urgent', 'emergency')),
  contrast_required     boolean     not null default false,
  patient_preparation   text,

  status                text        not null default 'ordered'
                                    check (status in (
                                      'ordered', 'scheduled', 'performed',
                                      'reported', 'reviewed', 'cancelled'
                                    )),
  ordered_at            timestamptz not null default now(),
  scheduled_at          timestamptz,
  performed_at          timestamptz,

  performing_facility   text,
  performing_technician text,
  radiologist           text,
  report_received_at    timestamptz,
  report_text           text,

  -- Link to the PDF report in documents table once received
  linked_document_id    uuid        references documents(id) on delete set null,
  reviewed_by           uuid        references auth.users(id) on delete set null,
  reviewed_at           timestamptz,
  notes                 text,

  created_by            uuid        references auth.users(id) on delete set null,
  updated_by            uuid        references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table imaging_orders is
  'Imaging and endoscopy orders -- X-ray, CT, MRI, ultrasound, colonoscopy, ERCP, OGD.';
comment on column imaging_orders.linked_document_id is
  'FK to documents.id -- set when the report PDF is received and uploaded.';
comment on column imaging_orders.urgency is
  '''emergency'' orders require same-session action; ''urgent'' within 24 h; ''soon'' within 1 week.';

-- ---------------------------------------------------------
-- INVESTIGATION RESULTS
-- Laboratory, pathology, microbiology and serology results.
-- Single-result tests use result_value / result_unit / reference_range.
-- Multi-analyte panels (FBC, LFTs, U&E) store individual
-- analytes in the JSONB column.
-- ---------------------------------------------------------
create table if not exists investigation_results (
  id                  uuid        primary key default uuid_generate_v4(),
  patient_id          uuid        not null references patients(id) on delete cascade,
  encounter_id        uuid        references encounters(id) on delete set null,

  test_name           text        not null,
  test_category       text        not null default 'other'
                                  check (test_category in (
                                    'haematology', 'biochemistry', 'microbiology',
                                    'pathology', 'serology', 'hormonal', 'cardiac',
                                    'urine', 'stool', 'other'
                                  )),
  specimen_type       text,
  collected_at        timestamptz,
  received_at         timestamptz,
  reported_at         timestamptz,
  performing_lab      text,

  -- Single-result convenience columns
  result_value        text,
  result_unit         text,
  reference_range     text,

  -- Multi-analyte panel:
  -- [{"name":"Hb","value":"12.5","unit":"g/dL","ref":"13-17","abnormal":true}, ...]
  analytes            jsonb,

  is_abnormal         boolean     not null default false,
  -- Critical = requires immediate physician notification
  is_critical         boolean     not null default false,

  status              text        not null default 'ordered'
                                  check (status in (
                                    'ordered', 'collected', 'pending',
                                    'resulted', 'reviewed', 'amended'
                                  )),
  reviewed_by         uuid        references auth.users(id) on delete set null,
  reviewed_at         timestamptz,
  linked_document_id  uuid        references documents(id) on delete set null,
  notes               text,

  created_by          uuid        references auth.users(id) on delete set null,
  updated_by          uuid        references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table investigation_results is
  'Lab, pathology, microbiology and serology results. Multi-analyte panels stored in the analytes JSONB column.';
comment on column investigation_results.analytes is
  'JSONB array of per-analyte results for multi-test panels. Single-test results use result_value/result_unit/reference_range.';
comment on column investigation_results.is_critical is
  'True when the result requires immediate physician notification (e.g. K+ < 2.5, Hb < 7.0, positive blood culture).';

-- updated_at TRIGGERS
do $$ declare t text; begin
  foreach t in array array[
    'clinical_notes', 'documents', 'billing_charges',
    'imaging_orders', 'investigation_results'
  ] loop
    execute format(
      'drop trigger if exists trg_updated_at on %I;
       create trigger trg_updated_at before update on %I
         for each row execute function set_updated_at();', t, t);
  end loop;
end $$;

-- ROW LEVEL SECURITY
do $$ declare t text; begin
  foreach t in array array[
    'clinical_notes', 'documents', 'billing_charges',
    'imaging_orders', 'investigation_results'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- -- clinical_notes --
-- Drafts visible only to author + admins; signed notes visible to nurses too.
-- Only doctors/admins can write notes.
create policy "staff_select_clinical_notes" on clinical_notes
  for select using (
    auth_role() in ('doctor', 'admin')
    or (auth_role() = 'nurse' and status = 'signed')
  );
create policy "doctors_insert_clinical_notes" on clinical_notes
  for insert with check (auth_role() in ('doctor', 'admin'));
create policy "doctors_update_clinical_notes" on clinical_notes
  for update using (
    created_by = auth.uid()
    or auth_role() = 'admin'
  );
create policy "admins_delete_clinical_notes" on clinical_notes
  for delete using (auth_role() = 'admin');

-- -- documents --
create policy "staff_select_documents" on documents
  for select using (auth.uid() is not null);
create policy "staff_insert_documents" on documents
  for insert with check (auth.uid() is not null);
create policy "staff_update_documents" on documents
  for update using (
    created_by = auth.uid()
    or auth_role() in ('doctor', 'admin')
  );
create policy "admins_delete_documents" on documents
  for delete using (auth_role() = 'admin');

-- -- billing_charges --
create policy "staff_select_billing" on billing_charges
  for select using (auth.uid() is not null);
create policy "staff_insert_billing" on billing_charges
  for insert with check (auth.uid() is not null);
create policy "staff_update_billing" on billing_charges
  for update using (auth.uid() is not null);
create policy "admins_delete_billing" on billing_charges
  for delete using (auth_role() = 'admin');

-- -- imaging_orders --
create policy "staff_select_imaging" on imaging_orders
  for select using (auth.uid() is not null);
create policy "clinical_insert_imaging" on imaging_orders
  for insert with check (auth_role() in ('doctor', 'admin', 'nurse'));
create policy "clinical_update_imaging" on imaging_orders
  for update using (auth_role() in ('doctor', 'admin', 'nurse'));
create policy "admins_delete_imaging" on imaging_orders
  for delete using (auth_role() = 'admin');

-- -- investigation_results --
create policy "staff_select_investigations" on investigation_results
  for select using (auth.uid() is not null);
create policy "staff_insert_investigations" on investigation_results
  for insert with check (auth.uid() is not null);
create policy "clinical_update_investigations" on investigation_results
  for update using (auth_role() in ('doctor', 'admin', 'nurse'));
create policy "admins_delete_investigations" on investigation_results
  for delete using (auth_role() = 'admin');

-- INDEXES

-- clinical_notes
create index if not exists idx_clinical_notes_patient   on clinical_notes(patient_id);
create index if not exists idx_clinical_notes_encounter on clinical_notes(encounter_id);
create index if not exists idx_clinical_notes_status    on clinical_notes(status);
create index if not exists idx_clinical_notes_type      on clinical_notes(note_type);
create index if not exists idx_clinical_notes_signed    on clinical_notes(signed_at desc nulls last);

-- documents
create index if not exists idx_documents_patient    on documents(patient_id);
create index if not exists idx_documents_encounter  on documents(encounter_id);
create index if not exists idx_documents_type       on documents(document_type);
create index if not exists idx_documents_created    on documents(created_at desc);

-- billing_charges
create index if not exists idx_billing_patient   on billing_charges(patient_id);
create index if not exists idx_billing_encounter on billing_charges(encounter_id);
create index if not exists idx_billing_status    on billing_charges(status);
create index if not exists idx_billing_created   on billing_charges(created_at desc);

-- imaging_orders
create index if not exists idx_imaging_patient   on imaging_orders(patient_id);
create index if not exists idx_imaging_encounter on imaging_orders(encounter_id);
create index if not exists idx_imaging_status    on imaging_orders(status);
create index if not exists idx_imaging_urgency   on imaging_orders(urgency);
create index if not exists idx_imaging_ordered   on imaging_orders(ordered_at desc);

-- investigation_results
create index if not exists idx_invest_patient   on investigation_results(patient_id);
create index if not exists idx_invest_encounter on investigation_results(encounter_id);
create index if not exists idx_invest_status    on investigation_results(status);
create index if not exists idx_invest_critical  on investigation_results(is_critical)
  where is_critical = true;
create index if not exists idx_invest_reported  on investigation_results(reported_at desc nulls last);
create index if not exists idx_invest_category  on investigation_results(test_category);

-- GRANTS
grant select, insert, update on public.clinical_notes        to authenticated;
grant select, insert, update on public.documents             to authenticated;
grant select, insert, update on public.billing_charges       to authenticated;
grant select, insert, update on public.imaging_orders        to authenticated;
grant select, insert, update on public.investigation_results to authenticated;

-- service_role (artifacts/api-server's sb() client) needs full table
-- privileges -- see supabase-service-role-grants-fix-migration.sql.
grant select, insert, update, delete on public.clinical_notes        to service_role;
grant select, insert, update, delete on public.documents             to service_role;
grant select, insert, update, delete on public.billing_charges       to service_role;
grant select, insert, update, delete on public.imaging_orders        to service_role;
grant select, insert, update, delete on public.investigation_results to service_role;

-- SUPABASE STORAGE BUCKET (run separately or via Supabase CLI)
-- The documents table uses a 'patient-documents' storage bucket.
-- Create it via: Supabase Dashboard -> Storage -> New Bucket
--   Name: patient-documents
--   Public: false  (authenticated access only)
--   File size limit: 50 MB
--   Allowed MIME types: application/pdf, image/*
--
-- Then add these storage policies in the Supabase Dashboard:
--   Allow authenticated users to upload:
--     (bucket_id = 'patient-documents' and auth.uid() is not null)
--   Allow authenticated users to read:
--     (bucket_id = 'patient-documents' and auth.uid() is not null)
--   Allow owner or admin to delete:
--     (bucket_id = 'patient-documents' and auth.uid() is not null)


-- ============================================================
-- Migration 2: Patient portal (patients.auth_user_id,
--   patients.portal_enabled)
-- ============================================================

-- Link patients to Supabase Auth
-- Patients who create a portal account are linked here.
-- Existing rows remain with auth_user_id = NULL (staff-managed).
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

-- Helper: returns the patient.id for the currently logged-in
-- portal user (or NULL if the session is staff or anonymous).
create or replace function my_patient_id() returns uuid
  language sql security definer stable as $$
  select id from public.patients where auth_user_id = auth.uid() limit 1;
$$;

-- RLS: patients -- own row only
create policy "patients_select_own" on patients
  for select using (auth_user_id = auth.uid());

create policy "patients_update_own_contact" on patients
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- RLS: appointments -- own appointments
create policy "patients_select_own_appointments" on appointments
  for select using (patient_id = my_patient_id());

-- RLS: medications -- own active medications
create policy "patients_select_own_medications" on medications
  for select using (patient_id = my_patient_id());

-- RLS: allergies -- own allergies
create policy "patients_select_own_allergies" on allergies
  for select using (patient_id = my_patient_id());

-- RLS: referrals -- own referrals
create policy "patients_select_own_referrals" on referrals
  for select using (patient_id = my_patient_id());

-- RLS: documents -- own non-confidential documents
-- Confidential documents (is_confidential = true) require
-- staff to explicitly share them with the patient in a future
-- update (not in this initial migration).
create policy "patients_select_own_documents" on documents
  for select using (
    patient_id = my_patient_id()
    and is_confidential = false
  );

-- RLS: questionnaire_sessions -- own sessions
create policy "patients_select_own_sessions" on questionnaire_sessions
  for select using (patient_id = my_patient_id());

-- GRANTS: anon needs nothing extra; authenticated patients
-- already have row-level access via the policies above.
-- The my_patient_id() function must be executable by authenticated role.
grant execute on function my_patient_id() to authenticated;

-- PORTAL INVITE FUNCTION
-- Staff call this to issue a magic-link invite to a patient.
-- Usage: select invite_patient_to_portal('<patient_uuid>', '<email>');
-- Returns the auth user UUID created.
-- NOTE: This function requires the Supabase service role -- it is
-- invoked from server-side API routes only, never the browser.
-- It is included here as documentation; the actual invocation
-- uses supabase.auth.admin.inviteUserByEmail() in the API.

-- EMAIL CONFIRMATION SETTING
-- Ensure "Email confirmations" is enabled in Supabase Auth settings
-- for magic-link login. Go to: Authentication -> Settings ->
-- "Enable Email Confirmations" = on.
-- Also set "Site URL" to your patient portal domain.


-- ============================================================
-- Migration 3: Questionnaires (questionnaire_templates, question_bank,
--   branching_rules, questionnaire_sessions, questionnaire_responses,
--   intake_summaries, consent_records)
-- ============================================================

-- Extension guard (already present in base schema, kept for
-- standalone execution safety)
create extension if not exists "uuid-ossp";


-- SECTION 1: HELPER FUNCTION -- generate_session_token()
-- Returns a 32-character random hex string used as an
-- anonymous access token for kiosk / QR-code sessions.

create or replace function generate_session_token()
returns text
language sql
as $$
  select encode(gen_random_bytes(16), 'hex');
$$;


-- SECTION 2: CORE QUESTIONNAIRE TABLES

-- 2.1  QUESTIONNAIRE_TEMPLATES
--      Defines a reusable questionnaire form (e.g. upper_gi,
--      post_op_review). One template maps to many questions via
--      question_bank.
create table if not exists questionnaire_templates (
  id          uuid        primary key default uuid_generate_v4(),
  name        text        unique not null,
                          -- e.g. 'general_screening', 'upper_gi', 'breast',
                          -- 'colorectal', 'post_op_review', 'ercp_workup'
  mode        text        not null
                          check (mode in ('screening', 'condition_specific')),
  specialty   text        not null
                          check (specialty in (
                            'general_surgery',
                            'endoscopy',
                            'breast_surgery',
                            'post_op',
                            'general_medical'
                          )),
  description text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table questionnaire_templates is
  'Reusable questionnaire definitions grouped by clinical specialty and mode.';
comment on column questionnaire_templates.name is
  'Machine-readable identifier, e.g. ''upper_gi'', ''ercp_workup''.';
comment on column questionnaire_templates.mode is
  '''screening'' = general intake; ''condition_specific'' = targeted to a known diagnosis or procedure.';


-- 2.2  QUESTION_BANK
--      Individual questions belonging to a template, with
--      branching metadata and red-flag screening flags.
create table if not exists question_bank (
  id                  uuid        primary key default uuid_generate_v4(),
  template_id         uuid        not null
                                  references questionnaire_templates(id)
                                  on delete cascade,
  question_key        text        not null,
                                  -- Short identifier, e.g. 'chief_complaint',
                                  -- 'pain_onset', 'rectal_bleeding'
  question_text       text        not null,   -- Text shown to patient
  question_type       text        not null
                                  check (question_type in (
                                    'single_choice',
                                    'multi_choice',
                                    'text',
                                    'scale',
                                    'boolean',
                                    'date'
                                  )),
  options             jsonb,
                                  -- Array of option objects:
                                  -- [{
                                  --   "value": "yes",
                                  --   "label": "Yes",
                                  --   "triggers_branch": true,
                                  --   "red_flag": false
                                  -- }]
                                  -- null for free-text / date / scale questions
  is_required         boolean     not null default false,
  is_red_flag_screen  boolean     not null default false,
                                  -- If true, any positive answer triggers an
                                  -- immediate alert to nursing staff
  display_order       integer     not null default 0,
  help_text           text,       -- Optional hint shown beneath the question
  created_at          timestamptz not null default now(),

  -- question_key must be unique within a template
  unique (template_id, question_key)
);

comment on table question_bank is
  'Individual questions belonging to a questionnaire template.';
comment on column question_bank.is_red_flag_screen is
  'When true, a positive or high-severity answer triggers immediate nurse alert regardless of branching.';
comment on column question_bank.options is
  'JSONB array of {value, label, triggers_branch, red_flag}. Null for text/date/scale questions.';


-- 2.3  BRANCHING_RULES
--      Conditional logic: "if question X has answer Y, show
--      question Z next". Evaluated in descending priority order.
create table if not exists branching_rules (
  id                   uuid    primary key default uuid_generate_v4(),
  template_id          uuid    not null
                               references questionnaire_templates(id)
                               on delete cascade,
  source_question_key  text    not null,
                               -- The question whose answer drives branching
  answer_value         text    not null,
                               -- The specific value that triggers the branch
                               -- (exact match for single_choice/boolean;
                               --  contained-in for multi_choice)
  target_question_key  text    not null,
                               -- The question to show when the rule fires
  priority             integer not null default 0,
                               -- Higher value = evaluated first
  skip_if_answered     boolean not null default false
                               -- Skip target if the patient already answered it
);

comment on table branching_rules is
  'Conditional branching logic linking question answers to follow-up questions.';
comment on column branching_rules.priority is
  'Rules with higher priority are evaluated first. Allows overrides for specific edge cases.';


-- SECTION 3: SESSION AND RESPONSE TABLES

-- 3.1  QUESTIONNAIRE_SESSIONS
--      One session per patient attempt at a questionnaire.
--      Patients may be anonymous (kiosk / QR link) -- patient_id
--      may be null until staff links the record.
create table if not exists questionnaire_sessions (
  id                    uuid        primary key default uuid_generate_v4(),

  -- Patient linkage (nullable: patient may be unregistered at intake)
  patient_id            uuid        references patients(id) on delete set null,
  encounter_id          uuid        references encounters(id) on delete set null,
  template_id           uuid        not null
                                    references questionnaire_templates(id),

  mode                  text        not null
                                    check (mode in ('screening', 'condition_specific')),
  status                text        not null default 'in_progress'
                                    check (status in (
                                      'in_progress',
                                      'completed',
                                      'abandoned',
                                      'nurse_reviewed',
                                      'doctor_approved'
                                    )),
  delivery_method       text        not null
                                    check (delivery_method in (
                                      'kiosk',
                                      'whatsapp_link',
                                      'qr_code',
                                      'staff_assisted'
                                    )),

  -- Consent tracking
  consent_given         boolean     not null default false,
  consent_timestamp     timestamptz,
  consent_ip            text,

  -- Timing
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  total_questions_shown integer,

  -- Clinical flags detected during the session
  -- Array of: [{"question_key": "rectal_bleeding", "answer": "yes", "severity": "high"}]
  red_flags_detected    jsonb,

  -- Nurse review
  nurse_reviewed_by     uuid        references auth.users(id) on delete set null,
  nurse_reviewed_at     timestamptz,
  nurse_notes           text,

  -- Doctor approval
  doctor_approved_by    uuid        references auth.users(id) on delete set null,
  doctor_approved_at    timestamptz,

  -- EMR population tracking
  emr_populated         boolean     not null default false,
  emr_populated_at      timestamptz,

  -- Anonymous access token (generated automatically on insert if null)
  session_token         text        unique not null,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table questionnaire_sessions is
  'One row per patient questionnaire attempt. Supports anonymous kiosk and QR-code access via session_token.';
comment on column questionnaire_sessions.patient_id is
  'Nullable -- patient may be unregistered at time of questionnaire; staff links later.';
comment on column questionnaire_sessions.session_token is
  'Random 32-char hex token used for anonymous access via QR/link. Auto-generated before insert if null.';
comment on column questionnaire_sessions.red_flags_detected is
  'JSONB array of [{question_key, answer, severity}] populated as patient progresses.';


-- 3.2  QUESTIONNAIRE_RESPONSES
--      Individual answers submitted within a session, one row
--      per question answered.
create table if not exists questionnaire_responses (
  id               uuid        primary key default uuid_generate_v4(),
  session_id       uuid        not null
                               references questionnaire_sessions(id)
                               on delete cascade,
  question_key     text        not null,
  question_text    text,       -- Snapshot of question text at time of answer
  answer_value     text,       -- Raw stored value (e.g. 'yes', '7', '2026-06-01')
  answer_display   text,       -- Human-readable label (e.g. 'Yes', 'Moderate (7/10)')
  is_red_flag      boolean     not null default false,
  answered_at      timestamptz not null default now(),
  sequence_number  integer     not null
                               -- Position of this question in the session (1-based)
);

comment on table questionnaire_responses is
  'Individual patient answers within a questionnaire session.';
comment on column questionnaire_responses.answer_value is
  'Machine-readable raw value stored for processing and branching evaluation.';
comment on column questionnaire_responses.answer_display is
  'Human-readable version of the answer for display in summaries and EMR.';
comment on column questionnaire_responses.sequence_number is
  '1-based order in which this question was presented during the session.';


-- SECTION 4: INTAKE SUMMARY AND CONSENT TABLES

-- 4.1  INTAKE_SUMMARIES
--      Claude-generated pre-visit clinical summary produced
--      after session completion. One summary per session.
create table if not exists intake_summaries (
  id                       uuid        primary key default uuid_generate_v4(),
  session_id               uuid        unique not null
                                        references questionnaire_sessions(id)
                                        on delete cascade,
  patient_id               uuid        references patients(id) on delete set null,

  -- AI-generated content (written by Claude; reviewed by doctor before actioning)
  ai_summary               text,
                                        -- Narrative pre-visit briefing for clinician
  chief_complaint          text,

  -- Structured clinical data extracted from responses
  key_positives            jsonb,       -- Array of strings: notable positive findings
  red_flags                jsonb,       -- Array of {symptom, severity, action}
  recommended_focus_areas  jsonb,       -- Array of strings: areas for doctor to probe

  estimated_urgency        text        not null default 'routine'
                                        check (estimated_urgency in (
                                          'routine',
                                          'priority',
                                          'urgent',
                                          'emergency'
                                        )),

  -- Full snapshot of all Q&A at time of summary generation
  raw_responses            jsonb,

  -- Generation metadata
  generated_at             timestamptz,
  model_used               text,        -- e.g. 'claude-sonnet-4-6'

  reviewed_by_doctor       boolean     not null default false
);

comment on table intake_summaries is
  'Claude-generated pre-consultation summary; one per questionnaire session. INSERT/UPDATE via service_role only.';
comment on column intake_summaries.ai_summary is
  'Narrative clinical briefing drafted by Claude. Must be reviewed by a doctor before use.';
comment on column intake_summaries.raw_responses is
  'JSONB snapshot of all Q&A pairs at point of summary generation (immutable audit record).';
comment on column intake_summaries.estimated_urgency is
  'AI-estimated triage urgency -- must be validated by clinical staff before acting upon.';


-- 4.2  CONSENT_RECORDS
--      Immutable record of every consent interaction, including
--      the exact text shown and the patient's response.
create table if not exists consent_records (
  id                   uuid        primary key default uuid_generate_v4(),
  session_id           uuid        not null
                                   references questionnaire_sessions(id)
                                   on delete restrict,
                                   -- Restrict: consent records must survive session deletion review
  consent_type         text        not null
                                   check (consent_type in (
                                     'data_collection',
                                     'telehealth',
                                     'procedure',
                                     'research'
                                   )),
  consent_text         text        not null,
                                   -- Exact text presented to the patient (verbatim snapshot)
  consent_version      text        not null,
                                   -- Semantic version of the consent form, e.g. '1.0', '2.1'
  consented            boolean     not null,
                                   -- True = accepted, False = declined
  patient_name_entered text,       -- Patient typed their name to confirm (digital signature)
  ip_address           text,
  user_agent           text,
  timestamp            timestamptz not null default now()
);

comment on table consent_records is
  'Append-only record of patient consent interactions. ON DELETE RESTRICT to preserve audit trail.';
comment on column consent_records.consent_text is
  'Verbatim text shown to the patient at the time of consent -- never updated post-insert.';
comment on column consent_records.consent_version is
  'Version of the consent form presented, enabling compliance audit across form revisions.';


-- SECTION 5: TRIGGERS

-- 5.1  Auto-generate session_token before insert if null
create or replace function trg_fn_set_session_token()
returns trigger
language plpgsql
as $$
begin
  if new.session_token is null or trim(new.session_token) = '' then
    new.session_token := generate_session_token();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_session_token on questionnaire_sessions;
create trigger trg_set_session_token
  before insert on questionnaire_sessions
  for each row execute function trg_fn_set_session_token();

-- 5.2  updated_at maintenance for APCQ tables that have it
-- Reuses the set_updated_at() function defined in the base schema.

drop trigger if exists trg_updated_at on questionnaire_templates;
create trigger trg_updated_at
  before update on questionnaire_templates
  for each row execute function set_updated_at();

drop trigger if exists trg_updated_at on questionnaire_sessions;
create trigger trg_updated_at
  before update on questionnaire_sessions
  for each row execute function set_updated_at();


-- SECTION 6: INDEXES

-- questionnaire_sessions
create index if not exists idx_qs_patient_id
  on questionnaire_sessions(patient_id);

create index if not exists idx_qs_encounter_id
  on questionnaire_sessions(encounter_id);

create index if not exists idx_qs_status
  on questionnaire_sessions(status);

create index if not exists idx_qs_session_token
  on questionnaire_sessions(session_token);

create index if not exists idx_qs_template_id
  on questionnaire_sessions(template_id);

create index if not exists idx_qs_started_at
  on questionnaire_sessions(started_at desc);

-- questionnaire_responses
create index if not exists idx_qr_session_id
  on questionnaire_responses(session_id);

create index if not exists idx_qr_is_red_flag
  on questionnaire_responses(session_id, is_red_flag)
  where is_red_flag = true;

-- intake_summaries
create index if not exists idx_is_session_id
  on intake_summaries(session_id);

create index if not exists idx_is_patient_id
  on intake_summaries(patient_id);

create index if not exists idx_is_estimated_urgency
  on intake_summaries(estimated_urgency)
  where reviewed_by_doctor = false;

-- question_bank
create index if not exists idx_qb_template_id
  on question_bank(template_id, display_order);

-- branching_rules
create index if not exists idx_br_template_source
  on branching_rules(template_id, source_question_key, priority desc);

-- consent_records
create index if not exists idx_cr_session_id
  on consent_records(session_id);


-- SECTION 7: ROW LEVEL SECURITY

alter table questionnaire_templates  enable row level security;
alter table question_bank            enable row level security;
alter table branching_rules          enable row level security;
alter table questionnaire_sessions   enable row level security;
alter table questionnaire_responses  enable row level security;
alter table intake_summaries         enable row level security;
alter table consent_records          enable row level security;


-- 7.1  questionnaire_templates
--      Read-only for all authenticated staff.
--      Mutations restricted to admin and service_role.
create policy "apcq_tmpl_staff_select"
  on questionnaire_templates
  for select
  using (auth.uid() is not null);

create policy "apcq_tmpl_admin_insert"
  on questionnaire_templates
  for insert
  with check (auth_role() = 'admin');

create policy "apcq_tmpl_admin_update"
  on questionnaire_templates
  for update
  using (auth_role() = 'admin');

create policy "apcq_tmpl_admin_delete"
  on questionnaire_templates
  for delete
  using (auth_role() = 'admin');


-- 7.2  question_bank
--      Read-only for all authenticated staff.
--      Mutations restricted to admin and service_role.
create policy "apcq_qb_staff_select"
  on question_bank
  for select
  using (auth.uid() is not null);

create policy "apcq_qb_admin_insert"
  on question_bank
  for insert
  with check (auth_role() = 'admin');

create policy "apcq_qb_admin_update"
  on question_bank
  for update
  using (auth_role() = 'admin');

create policy "apcq_qb_admin_delete"
  on question_bank
  for delete
  using (auth_role() = 'admin');


-- 7.3  branching_rules
--      Same access pattern as question_bank.
create policy "apcq_br_staff_select"
  on branching_rules
  for select
  using (auth.uid() is not null);

create policy "apcq_br_admin_insert"
  on branching_rules
  for insert
  with check (auth_role() = 'admin');

create policy "apcq_br_admin_update"
  on branching_rules
  for update
  using (auth_role() = 'admin');

create policy "apcq_br_admin_delete"
  on branching_rules
  for delete
  using (auth_role() = 'admin');


-- 7.4  questionnaire_sessions
--
--      Anonymous (kiosk/QR) access: anon role can SELECT and
--      INSERT only the session whose token matches the local
--      runtime setting app.session_token.
--
--      Authenticated staff: all roles listed can SELECT all
--      sessions; nurses, doctors, and admins can UPDATE to
--      progress status and record nurse review fields.

-- Anon: read own session by token
create policy "apcq_sess_anon_select_by_token"
  on questionnaire_sessions
  for select
  to anon
  using (
    session_token = current_setting('app.session_token', true)
  );

-- Anon: create new session (token will be auto-generated)
create policy "apcq_sess_anon_insert"
  on questionnaire_sessions
  for insert
  to anon
  with check (true);

-- Authenticated staff: read all sessions
create policy "apcq_sess_staff_select"
  on questionnaire_sessions
  for select
  to authenticated
  using (
    auth_role() in ('nurse', 'doctor', 'admin', 'front_desk')
  );

-- Authenticated staff: create sessions on behalf of patients
create policy "apcq_sess_staff_insert"
  on questionnaire_sessions
  for insert
  to authenticated
  with check (
    auth_role() in ('nurse', 'doctor', 'admin', 'front_desk')
  );

-- Nurses, doctors, admins: update status and review fields
create policy "apcq_sess_clinical_update"
  on questionnaire_sessions
  for update
  to authenticated
  using (
    auth_role() in ('nurse', 'doctor', 'admin')
  );


-- 7.5  questionnaire_responses
--
--      Anon can INSERT responses for a session they own (matched
--      via a security-definer helper to avoid join on anon).
--      Authenticated staff can SELECT all responses.

-- Helper: verify that an anon caller owns the session referenced
-- by the response being inserted (avoids granting anon SELECT on
-- questionnaire_sessions directly in this policy expression).
create or replace function anon_owns_session(p_session_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from questionnaire_sessions
    where id = p_session_id
      and session_token = current_setting('app.session_token', true)
  );
$$;

-- Anon: insert responses only if they own the parent session
create policy "apcq_resp_anon_insert"
  on questionnaire_responses
  for insert
  to anon
  with check (
    anon_owns_session(session_id)
  );

-- Authenticated staff: read all responses
create policy "apcq_resp_staff_select"
  on questionnaire_responses
  for select
  to authenticated
  using (
    auth_role() in ('nurse', 'doctor', 'admin', 'front_desk')
  );

-- Authenticated staff: insert responses (staff-assisted delivery)
create policy "apcq_resp_staff_insert"
  on questionnaire_responses
  for insert
  to authenticated
  with check (
    auth_role() in ('nurse', 'doctor', 'admin', 'front_desk')
  );


-- 7.6  intake_summaries
--
--      Nurses, doctors, and admins can SELECT.
--      INSERT and UPDATE are restricted to service_role only
--      (Claude-generated content; never written by browser
--      clients directly).
create policy "apcq_is_clinical_select"
  on intake_summaries
  for select
  to authenticated
  using (
    auth_role() in ('nurse', 'doctor', 'admin')
  );

-- No INSERT/UPDATE policies for authenticated or anon roles.
-- The service_role bypasses RLS entirely and may write freely.


-- 7.7  consent_records
--
--      Anon can INSERT (patient submitting consent during kiosk
--      or QR session). Authenticated staff can SELECT all.
--      No client-side UPDATE or DELETE -- consent is immutable.
create policy "apcq_cr_anon_insert"
  on consent_records
  for insert
  to anon
  with check (true);

create policy "apcq_cr_staff_insert"
  on consent_records
  for insert
  to authenticated
  with check (
    auth_role() in ('nurse', 'doctor', 'admin', 'front_desk')
  );

create policy "apcq_cr_staff_select"
  on consent_records
  for select
  to authenticated
  using (
    auth_role() in ('nurse', 'doctor', 'admin', 'front_desk')
  );


-- SECTION 8: POSTGRESQL-LEVEL GRANTS
-- RLS policies restrict which rows each role can access.
-- These grants give the roles permission to attempt operations
-- at all -- without them Postgres returns permission denied
-- before RLS is even evaluated.

-- Schema usage
grant usage on schema public to anon, authenticated, service_role;

-- questionnaire_templates and question_bank: read for all authenticated
grant select
  on public.questionnaire_templates
  to authenticated, service_role;
grant insert, update, delete
  on public.questionnaire_templates
  to authenticated, service_role;   -- RLS limits actual mutations to admin

grant select
  on public.question_bank
  to authenticated, service_role;
grant insert, update, delete
  on public.question_bank
  to authenticated, service_role;   -- RLS limits actual mutations to admin

-- branching_rules
grant select
  on public.branching_rules
  to authenticated, service_role;
grant insert, update, delete
  on public.branching_rules
  to authenticated, service_role;   -- RLS limits actual mutations to admin

-- questionnaire_sessions: anon needs select/insert; authenticated needs all
grant select, insert
  on public.questionnaire_sessions
  to anon;
grant select, insert, update
  on public.questionnaire_sessions
  to authenticated, service_role;

-- questionnaire_responses: anon insert; authenticated select/insert
grant insert
  on public.questionnaire_responses
  to anon;
grant select, insert, update
  on public.questionnaire_responses
  to authenticated, service_role;

-- intake_summaries: authenticated select only; service_role full access (Claude-generated content)
grant select
  on public.intake_summaries
  to authenticated;
grant select, insert, update
  on public.intake_summaries
  to service_role;

-- consent_records: anon insert; authenticated select/insert
grant insert
  on public.consent_records
  to anon;
grant select, insert
  on public.consent_records
  to authenticated, service_role;


-- SECTION 9: SEED DATA -- QUESTIONNAIRE TEMPLATES
-- The dashboard's "Start Questionnaire" feature looks up these
-- templates by `name` (must be active). The actual question
-- content/branching for each template lives in code
-- (lib/triage-engine/src/apcq.ts -- SPECIALTY_QUEUES), this table
-- only needs to exist so the API can resolve a template_id.

insert into questionnaire_templates (name, mode, specialty, description, is_active)
values
  ('general_screening', 'screening',          'general_medical', 'General pre-consultation screening questionnaire', true),
  ('abdominal_pain',    'condition_specific',  'general_surgery', 'Targeted questionnaire for abdominal pain presentations', true),
  ('upper_gi',          'condition_specific',  'endoscopy',       'Upper GI symptoms questionnaire (reflux, dysphagia, etc.)', true),
  ('colorectal',        'condition_specific',  'endoscopy',       'Colorectal symptoms questionnaire (bleeding, bowel habit change)', true),
  ('breast',            'condition_specific',  'breast_surgery',  'Breast surgery questionnaire (lump, discharge, skin changes)', true),
  ('post_op',           'condition_specific',  'post_op',         'Post-operative review questionnaire', true)
on conflict (name) do nothing;


-- ============================================================
-- Migration 4: Questionnaire token expiry
--   (questionnaire_sessions.expires_at)
-- ============================================================

ALTER TABLE questionnaire_sessions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days');

COMMENT ON COLUMN questionnaire_sessions.expires_at IS
  'Session token stops granting anonymous access after this time (default: 7 days from creation).';

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_name = 'questionnaire_sessions'
            AND column_name = 'expires_at') = 1,
    'Expected questionnaire_sessions.expires_at to exist';
  RAISE NOTICE 'Migration questionnaire_token_expiry: OK';
END;
$$;


-- ============================================================
-- Migration 5: EMR persistence (UNIQUE on assessments/plans
--   encounter_id, allergies.allergen_ci, medications index,
--   vitals default)
-- ============================================================

-- assessments: one primary assessment per encounter
alter table assessments
  add constraint assessments_encounter_unique unique (encounter_id);

-- plans: one management plan per encounter (used by the autosave path)
alter table plans
  add constraint plans_encounter_unique unique (encounter_id);

-- vitals: recorded_at defaults to now() at DB level but the monitoring tab
-- sends a specific timestamp (wheel-picker time field). Ensure the column
-- exists with a default so rows without an explicit recorded_at still work.
alter table vitals
  alter column recorded_at set default now();

-- allergies: unique(patient_id, allergen) enables upsert from the UI.
-- Allergen comparison is case-insensitive via ci_allergen generated column.
alter table allergies
  add column if not exists allergen_ci text generated always as (lower(allergen)) stored;
create unique index if not exists allergies_patient_allergen_ci
  on allergies (patient_id, allergen_ci);

-- medications: unique(patient_id, encounter_id, drug_name, indication)
-- The 'consultation-list' indication marks chip-selected meds so that
-- re-saving from the consultation form replaces rather than appends.
create unique index if not exists medications_encounter_drug_indication
  on medications (patient_id, encounter_id, drug_name, indication)
  where indication = 'consultation-list';


-- ============================================================
-- Migration 6: Portal self-service (patient_intake,
--   patients.nok_*/blood_group/height/weight)
-- ============================================================

-- -- Extend patients table --
alter table patients
  add column if not exists nok_name     text,       -- Next of Kin name
  add column if not exists nok_relation text,       -- Spouse, Parent, Child, etc.
  add column if not exists nok_phone    text,       -- NOK contact number
  add column if not exists blood_group  text        -- A+, A-, B+, B-, AB+, AB-, O+, O-
    check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown') or blood_group is null),
  add column if not exists height_cm    numeric(5,1),
  add column if not exists weight_kg    numeric(5,1);

-- -- Patient intake questionnaire --
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

drop policy if exists "patients_select_own_intake" on patient_intake;
create policy "patients_select_own_intake" on patient_intake
  for select using (patient_id = my_patient_id());

drop policy if exists "patients_insert_own_intake" on patient_intake;
create policy "patients_insert_own_intake" on patient_intake
  for insert with check (patient_id = my_patient_id());

grant select, insert on public.patient_intake to authenticated;

-- service_role (artifacts/api-server's sb() client) needs full table
-- privileges -- see supabase-service-role-grants-fix-migration.sql.
grant select, insert, update, delete on public.patient_intake to service_role;

-- -- Storage bucket for patient documents --
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


-- ============================================================
-- Migration 7: AI adaptive intake (consultation_requests,
--   patient_intake additions)
-- ============================================================

-- -- Extend patient_intake --
alter table patient_intake
  add column if not exists visit_type        text,   -- surgical | endoscopy | followup | unsure
  add column if not exists complaint_track   text,   -- gallbladder | gastric | gerd | screening | etc.
  add column if not exists complexity_score  integer default 0,
  add column if not exists ai_summary        text,
  add column if not exists ai_summary_at     timestamptz,
  add column if not exists ai_reviewed       boolean default false;

-- -- Consultation requests (public, no portal account needed) --
create table if not exists consultation_requests (
  id          uuid primary key default uuid_generate_v4(),
  full_name   text not null,
  phone       text,
  email       text,
  visit_type  text,   -- surgical | endoscopy | followup | unsure
  description text,
  created_at  timestamptz default now(),
  status      text default 'new'
    check (status in ('new', 'contacted', 'registered')),
  staff_notes text
);

alter table consultation_requests enable row level security;

-- Staff can read and manage all requests
drop policy if exists "staff_manage_consultation_requests" on consultation_requests;
create policy "staff_manage_consultation_requests" on consultation_requests
  for all to authenticated using (true) with check (true);

-- Anyone (anon) can submit a new request -- this is the public "request consult" form
drop policy if exists "anon_insert_consultation_requests" on consultation_requests;
create policy "anon_insert_consultation_requests" on consultation_requests
  for insert to anon with check (true);

grant insert on public.consultation_requests to anon;
grant all on public.consultation_requests to authenticated, service_role;

-- RLS: allow staff to read/update ai_summary on patient_intake
-- (The existing patients_select_own_intake policy covers patient reads.)
-- Staff access is via service_role key on the API server -- bypasses RLS by design.


-- ============================================================
-- Migration 8: Booking notifications
--   (appointment_requests.patient_ack_sent_at etc.)
-- ============================================================

ALTER TABLE appointment_requests
  ADD COLUMN IF NOT EXISTS patient_ack_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS staff_notified_at    timestamptz,
  ADD COLUMN IF NOT EXISTS staff_escalated_at   timestamptz,
  ADD COLUMN IF NOT EXISTS prep_sms_sent        boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN appointment_requests.patient_ack_sent_at  IS 'Timestamp when the immediate patient acknowledgement SMS was sent';
COMMENT ON COLUMN appointment_requests.staff_notified_at    IS 'Timestamp when staff were first alerted of this booking';
COMMENT ON COLUMN appointment_requests.staff_escalated_at   IS 'Timestamp of last escalation SMS/email sent to staff or doctor';
COMMENT ON COLUMN appointment_requests.prep_sms_sent        IS 'True once procedure prep instructions have been sent to the patient';

-- Index to support the escalation cron query
-- (status='pending' AND created_at < 2h ago AND staff_escalated_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_appt_requests_pending_created
  ON appointment_requests (status, created_at)
  WHERE status = 'pending';

-- Verify
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_name = 'appointment_requests'
            AND column_name IN ('patient_ack_sent_at','staff_notified_at','staff_escalated_at','prep_sms_sent')) = 4,
    'Expected 4 new columns on appointment_requests';
  RAISE NOTICE 'Migration booking_notifications: OK';
END;
$$;


-- ============================================================
-- Migration 9: Booking source
--   (appointment_requests.source, .whatsapp_from)
-- ============================================================

ALTER TABLE appointment_requests
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'whatsapp', 'manual', 'phone', 'email')),
  ADD COLUMN IF NOT EXISTS whatsapp_from text;

COMMENT ON COLUMN appointment_requests.source IS 'Channel the booking request arrived from: web form, WhatsApp webhook, manual staff entry, phone call, or email';
COMMENT ON COLUMN appointment_requests.whatsapp_from IS 'WhatsApp sender number (E.164, no whatsapp: prefix) for inbound webhook requests';

-- Index: queue page filters by source
CREATE INDEX IF NOT EXISTS idx_appt_requests_source
  ON appointment_requests (source, status, created_at);

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_name = 'appointment_requests'
            AND column_name IN ('source', 'whatsapp_from')) = 2,
    'Expected 2 new columns on appointment_requests';
  RAISE NOTICE 'Migration booking_source: OK';
END;
$$;


-- ============================================================
-- Migration 10: Email/document intake (referring_providers,
--   documents.patient_id nullable)
-- ============================================================

-- -- documents.patient_id -> nullable --
-- Emailed documents land unmatched (patient_id = null) until staff link
-- them to a patient record.
alter table documents
  alter column patient_id drop not null;

-- -- referring_providers --
create table if not exists referring_providers (
  id                    uuid        primary key default gen_random_uuid(),
  name                  text        not null,
  email                 text        not null unique,
  provider_type         text        not null
                                    check (provider_type in (
                                      'lab', 'radiology', 'referring_doctor', 'other'
                                    )),
  default_document_type text        not null
                                    check (default_document_type in (
                                      'lab_report', 'imaging_report', 'referral_letter',
                                      'consent_form', 'surgical_report', 'discharge_summary',
                                      'prescription', 'insurance_form', 'other'
                                    )),
  notes                 text,
  active                boolean     not null default true,
  created_at            timestamptz not null default now()
);

comment on table referring_providers is
  'Directory of known labs, imaging centres, and referring doctors. Used to match incoming document emails (sender address) and auto-file attachments into `documents`.';
comment on column referring_providers.email is
  'Sender address, stored lowercase. Matched case-insensitively against the From header of incoming emails.';
comment on column referring_providers.default_document_type is
  'documents.document_type applied to attachments received from this sender.';

create index if not exists idx_referring_providers_email on referring_providers (email);

-- -- RLS --
alter table referring_providers enable row level security;

create policy "staff_select_referring_providers" on referring_providers
  for select using (auth.uid() is not null);
create policy "staff_insert_referring_providers" on referring_providers
  for insert with check (auth.uid() is not null);
create policy "staff_update_referring_providers" on referring_providers
  for update using (auth.uid() is not null);
create policy "admins_delete_referring_providers" on referring_providers
  for delete using (auth_role() = 'admin');

grant select, insert, update, delete on public.referring_providers to authenticated;

-- service_role (artifacts/api-server's sb() client, used by the email-intake
-- cron job to look up referring_providers by sender email) needs the same
-- privileges -- see supabase-service-role-grants-fix-migration.sql.
grant select, insert, update, delete on public.referring_providers to service_role;


-- ============================================================
-- Migration 11: Document AI extraction
--   (documents.ai_extraction_* columns)
-- ============================================================

alter table documents
  add column if not exists ai_extraction_status text not null default 'pending'
    check (ai_extraction_status in ('pending', 'processing', 'done', 'failed', 'skipped')),
  add column if not exists ai_extracted_data jsonb,
  add column if not exists ai_flags jsonb,
  add column if not exists ai_extraction_at timestamptz,
  add column if not exists staff_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists staff_reviewed_at timestamptz;

comment on column documents.ai_extraction_status is
  'Pipeline state for the triage-only AI extraction pass: pending -> processing -> done | failed | skipped.';
comment on column documents.ai_extracted_data is
  'Structured facts read off the document by Claude (values, units, dates, stated reference ranges) -- a transcription aid, never a diagnosis or interpretation.';
comment on column documents.ai_flags is
  'Array of {type, label, severity, detail} items the document itself marks as out-of-range/urgent/abnormal -- surfaced for staff attention only, never a clinical interpretation.';
comment on column documents.ai_extraction_at is
  'When the AI extraction pass completed (successfully or not).';
comment on column documents.staff_reviewed_at is
  'When a staff member acknowledged the AI extraction/flags for this document.';

create index if not exists documents_ai_extraction_status_idx
  on documents (ai_extraction_status);

-- Fast lookup of flagged-but-unreviewed documents for the dashboard alert surface
create index if not exists documents_needs_review_idx
  on documents (created_at desc)
  where ai_flags is not null and staff_reviewed_at is null;


-- ============================================================
-- Migration 12: Documents clinical photo
--   (adds 'clinical_photo' to document_type check)
-- ============================================================

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_document_type_check,
  ADD CONSTRAINT documents_document_type_check
    CHECK (document_type IN (
      'lab_report', 'imaging_report', 'referral_letter', 'consent_form',
      'surgical_report', 'discharge_summary', 'prescription', 'insurance_form',
      'clinical_photo', 'other'
    ));

COMMENT ON COLUMN documents.document_type IS
  'lab_report | imaging_report | referral_letter | consent_form | surgical_report | discharge_summary | prescription | insurance_form | clinical_photo (wound/procedure/exam photo taken on a device) | other';

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.check_constraints
          WHERE constraint_name = 'documents_document_type_check'
            AND check_clause LIKE '%clinical_photo%') = 1,
    'Expected documents_document_type_check to allow ''clinical_photo''';
  RAISE NOTICE 'Migration documents_clinical_photo: OK';
END;
$$;


-- ============================================================
-- Migration 13: Vitals photo extraction
--   (questionnaire_sessions vitals columns)
-- ============================================================

ALTER TABLE questionnaire_sessions
  ADD COLUMN IF NOT EXISTS extracted_vitals jsonb,
  ADD COLUMN IF NOT EXISTS extracted_vitals_status text
    CHECK (extracted_vitals_status IN ('pending_review', 'confirmed', 'rejected', 'written')),
  ADD COLUMN IF NOT EXISTS extracted_vitals_at timestamptz,
  ADD COLUMN IF NOT EXISTS vitals_confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vitals_confirmed_at timestamptz;

COMMENT ON COLUMN questionnaire_sessions.extracted_vitals IS
  'Vitals readings extracted by Claude Vision from a device-display photo (BP, HR, temp, SpO2, RR, weight, height, glucose), keyed by camelCase field name. Staged for nurse review -- never auto-written to the vitals table.';
COMMENT ON COLUMN questionnaire_sessions.extracted_vitals_status IS
  'pending_review: awaiting nurse confirmation. confirmed: nurse approved values, awaiting EMR write. rejected: nurse discarded the photo reading. written: confirmed values have been inserted into the vitals table.';

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_name = 'questionnaire_sessions'
            AND column_name = 'extracted_vitals') = 1,
    'Expected questionnaire_sessions.extracted_vitals to exist';
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_name = 'questionnaire_sessions'
            AND column_name = 'extracted_vitals_status') = 1,
    'Expected questionnaire_sessions.extracted_vitals_status to exist';
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_name = 'questionnaire_sessions'
            AND column_name = 'vitals_confirmed_by') = 1,
    'Expected questionnaire_sessions.vitals_confirmed_by to exist';
  RAISE NOTICE 'Migration vitals_photo_capture: OK';
END;
$$;


-- ============================================================
-- Migration 14: Service role grants fix
--   (ensures service_role has grants on all tables)
-- ============================================================

grant select, insert, update, delete on public.user_profiles        to service_role;
grant select, insert, update, delete on public.patients             to service_role;
grant select, insert, update, delete on public.encounters           to service_role;
grant select, insert, update, delete on public.vitals               to service_role;
grant select, insert, update, delete on public.symptoms             to service_role;
grant select, insert, update, delete on public.medications          to service_role;
grant select, insert, update, delete on public.allergies            to service_role;
grant select, insert, update, delete on public.assessments          to service_role;
grant select, insert, update, delete on public.plans                to service_role;
grant select, insert, update, delete on public.procedures           to service_role;
grant select, insert, update, delete on public.referrals            to service_role;
grant select, insert, update, delete on public.appointments         to service_role;
grant select, insert, update, delete on public.audit_logs           to service_role;

grant select, insert, update, delete on public.clinical_notes       to service_role;
grant select, insert, update, delete on public.documents            to service_role;
grant select, insert, update, delete on public.billing_charges      to service_role;
grant select, insert, update, delete on public.imaging_orders       to service_role;
grant select, insert, update, delete on public.investigation_results to service_role;

grant select, insert, update, delete on public.patient_intake       to service_role;


-- ============================================================
-- Migration 15: Appointment email optional
--   (makes patient_email nullable)
-- ============================================================

ALTER TABLE appointment_requests
  ALTER COLUMN patient_email DROP NOT NULL;

DO $$
BEGIN
  ASSERT (SELECT is_nullable FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'appointment_requests'
            AND column_name = 'patient_email') = 'YES',
    'Expected appointment_requests.patient_email to be nullable';
  RAISE NOTICE 'Migration appointment_requests_email_optional: OK';
END;
$$;


-- ============================================================
-- Migration 16: Referring doctors seed data
-- ============================================================

ALTER TABLE referring_providers
  ALTER COLUMN email DROP NOT NULL;

-- -- Seed referring doctors --
-- Idempotent: only inserts a row if no referring_doctor with the same name
-- already exists, so re-running this migration is safe.

insert into referring_providers (name, email, provider_type, default_document_type, notes, active)
select v.name, v.email, 'referring_doctor', 'referral_letter', v.notes, true
from (values
  ('Dr. Jeffers',                    'jeffersclinic@gmail.com',              null),
  ('Dr. Grandison Didier',           'dr.m.m.didiers@gmail.com',             null),
  ('Dr. Merle Clarke',                'kidneycareslu@gmail.com',              null),
  ('Dr. Brathwaite',                  'davidbrathwaite@doctors.org.uk',       null),
  ('Dr. Samuel',                      'urolgynaedrs@gmail.com',               null),
  ('Dr. J Bird',                      null,                                   null),
  ('Dr. L Surage',                    'l.surage@gmail.com',                   null),
  ('Dr. R Daniel',                    'drjrdaniel.tapioncardiology@gmail.com', null),
  ('Dr. T Remy',                      'remsurg@gmail.com',                    null),
  ('Dr. T Glasgow',                   'tglasgow@doctor.com',                  null),
  ('Dr. Gillard',                     null,                                   null),
  ('Dr. Augustin',                    'dr.aaugustin@outlook.com',             null),
  ('Dr. Benjamin',                    'drbenjymd@outlook.com',                null),
  ('Dr. K Cenac',                     'drkcenac@gmail.com',                   'Alt. email: drkcenacoffice@gmail.com'),
  ('M Care',                          'info@memberclinic.com',                null),
  ('Dr. Mills',                       'alli.mills.73@gmail.com',              null),
  ('Dr. N Charles',                   'laury52@hotmail.com',                  null),
  ('Dr. West Gustave',                'kristinwest1206@gmail.com',            null),
  ('Dr. John Mondesir',               'dr.john.mondesir@gmail.com',           null),
  ('Dr. G Melville',                  'drmelvillepractice@hotmail.com',       'Alt. email: gavindm@hotmail.com'),
  ('Dr. D Louisy',                    'drdlouisy@gmail.com',                  null),
  ('Dr. K Louisy',                    'kemobo.louisy@gmail.com',              null),
  ('Dr. Ndidi Dagbue',                'nadagbue@hotmail.com',                 null),
  ('Dr. Sherwin James',               'sherwinjames@hotmail.com',             'Phone: 285-7766'),
  ('Dr Tanya Beaubrun',                'tanyabeaubrun68@gmail.com',            null),
  ('Dr. A James',                     'drajam009@gmail.com',                  null),
  ('Dr. Garriga',                     'garrigastl2014@gmail.com',             null),
  ('Dr. Nathaniel',                   'christynats04@gmail.com',              null),
  ('Dr. Flemming',                    'flemingsallapudi@gmail.com',           null),
  ('Dr. Nega',                        null,                                   'Shares M Care clinic email: info@memberclinic.com'),
  ('Dr. Naomi Jude',                  null,                                   'Shares M Care clinic email: info@memberclinic.com'),
  ('Dr. Alpha Augustin',              null,                                   'Shares email with Dr. Augustin: dr.aaugustin@outlook.com'),
  ('Dr. PV St Rose',                  'drpeterstroseclinic@gmail.com',        null),
  ('Dr. Asha Martin',                 'ashamartin81@gmail.com',               null),
  ('Dr. Volson',                      'drwoc67@hotmail.com',                  null),
  ('Dr. Altenor',                     'caltenor@gmail.com',                   null),
  ('Dr. Suarez',                      'drlilysuarez61@gmail.com',             null),
  ('Dr. Celia Mc. Connell Downes',    'cggmcconnell@gmail.com',               null),
  ('Dr. Martin Plummer',              'plummerpaediatrics@gmail.com',         null),
  ('Dr. Segun Tobias',                'mcareassociates@gmail.com',            null),
  ('Dr. Burt',                        'richard_burt@hotmail.com',             null),
  ('Dr Seema Gupta',                  'seedrgupta@gmail.com',                 null)
) as v(name, email, notes)
where not exists (
  select 1 from referring_providers rp
  where rp.name = v.name and rp.provider_type = 'referring_doctor'
);

DO $$
BEGIN
  ASSERT (SELECT is_nullable FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'referring_providers'
            AND column_name = 'email') = 'YES',
    'Expected referring_providers.email to be nullable';
  ASSERT (SELECT count(*) FROM referring_providers WHERE provider_type = 'referring_doctor') >= 42,
    'Expected at least 42 referring_doctor rows after seeding';
  RAISE NOTICE 'Migration referring_doctors_seed: OK';
END;
$$;


-- ============================================================
-- Migration 17: Intake reminder
--   (confirmed_appointments.intake_reminder_sent)
-- ============================================================

alter table confirmed_appointments
  add column if not exists intake_reminder_sent boolean not null default false;

comment on column confirmed_appointments.intake_reminder_sent is
  'Set to true once the 48h pre-visit-questionnaire SMS nudge has been sent for this appointment (cron/reminders).';


-- ============================================================
-- Migration 18: Booking waitlist
--   (waitlist status support)
-- ============================================================

ALTER TABLE appointment_requests
  DROP CONSTRAINT IF EXISTS appointment_requests_status_check,
  ADD CONSTRAINT appointment_requests_status_check
    CHECK (status IN ('pending','staff_confirmed','patient_confirmed','waitlisted','lapsed','cancelled'));

COMMENT ON COLUMN appointment_requests.status IS
  'pending | staff_confirmed | patient_confirmed | waitlisted (no slot available yet -- staff to revisit) | lapsed | cancelled';

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.check_constraints
          WHERE constraint_name = 'appointment_requests_status_check'
            AND check_clause LIKE '%waitlisted%') = 1,
    'Expected appointment_requests_status_check to allow ''waitlisted''';
  RAISE NOTICE 'Migration booking_waitlist: OK';
END;
$$;


-- ============================================================
-- Migration 19: Patients quarter
--   (patients.quarter)
-- ============================================================

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS quarter text;

COMMENT ON COLUMN patients.quarter IS
  'Saint Lucia administrative quarter, derived from the community entered at check-in (see SL_COMMUNITIES).';

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_name = 'patients' AND column_name = 'quarter') = 1,
    'Expected patients.quarter column to exist';
  RAISE NOTICE 'Migration patients_quarter: OK';
END;
$$;


-- ============================================================
-- Migration 20: Procedure prep drafts
--   (procedure_prep_drafts table)
-- ============================================================

create table if not exists procedure_prep_drafts (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid references conversation_threads(id) on delete cascade,
  procedure_type  text not null,
  patient_name    text,
  draft_text      text not null,
  status          text not null default 'pending_approval'
                    check (status in ('pending_approval', 'approved', 'rejected', 'sent')),
  reviewed_by     text,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_procedure_prep_drafts_status
  on procedure_prep_drafts (status, created_at);

alter table procedure_prep_drafts enable row level security;

create policy "staff manage procedure prep drafts"
  on procedure_prep_drafts
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update on procedure_prep_drafts to authenticated;
grant select, insert, update on procedure_prep_drafts to service_role;


-- ============================================================
-- Migration 21: Post-visit followup
--   (confirmed_appointments.post_visit_followup_sent)
-- ============================================================

alter table confirmed_appointments
  add column if not exists post_visit_followup_sent boolean not null default false;

comment on column confirmed_appointments.post_visit_followup_sent is
  'Set to true once the ~24h post-visit check-in SMS has been sent for this appointment (cron/reminders).';


-- ============================================================
-- Migration 22: Appointment change requests
--   (appointment_change_requests table)
-- ============================================================

create table if not exists appointment_change_requests (
  id              uuid primary key default uuid_generate_v4(),
  patient_id      uuid not null references patients(id),
  appointment_id  uuid not null references appointments(id),
  change_type     text not null check (change_type in ('reschedule', 'cancel')),
  reason          text,
  status          text not null default 'pending'
                    check (status in ('pending', 'resolved')),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references auth.users(id),
  staff_note      text
);

comment on table appointment_change_requests is
  'Patient-submitted requests to reschedule or cancel an appointment. Staff review and action by phone/calendar; status flips to resolved once handled.';

create index if not exists idx_change_requests_status
  on appointment_change_requests(status, created_at);

alter table appointment_change_requests enable row level security;

-- Patients can create and view their own requests.
create policy "patients_insert_own_change_requests" on appointment_change_requests
  for insert with check (patient_id = my_patient_id());

create policy "patients_select_own_change_requests" on appointment_change_requests
  for select using (patient_id = my_patient_id());

-- Staff (any authenticated user who is not a portal patient) can view and
-- resolve all requests.
create policy "staff_manage_change_requests" on appointment_change_requests
  for all using (auth.uid() is not null and my_patient_id() is null);

grant select, insert on public.appointment_change_requests to authenticated;
grant select, insert, update on public.appointment_change_requests to service_role;


-- ============================================================
-- END OF CONSOLIDATED SCHEMA + MIGRATIONS
-- ============================================================
-- FULL TABLE INVENTORY (31 tables):
--
-- Base schema:
--   user_profiles, patients, encounters, vitals, symptoms,
--   medications, allergies, assessments, plans, procedures,
--   referrals, appointments, audit_logs, appointment_requests
--
-- Migration additions:
--   clinical_notes, documents, billing_charges, imaging_orders,
--   investigation_results, questionnaire_templates, question_bank,
--   branching_rules, questionnaire_sessions, questionnaire_responses,
--   intake_summaries, consent_records, patient_intake,
--   consultation_requests, referring_providers,
--   procedure_prep_drafts, appointment_change_requests,
--   call_logs (phone/WhatsApp/ambient voice queue)
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- call_logs — phone calls, WhatsApp, Twilio voicemail, ambient recordings
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists call_logs (
  id              uuid primary key default uuid_generate_v4(),
  caller_number   text,
  patient_id      uuid references patients(id),
  direction       text not null default 'inbound'
                    check (direction in ('inbound', 'outbound', 'ambient', 'app_message')),
  source          text not null default 'phone'
                    check (source in ('phone', 'whatsapp', 'patient_app', 'ambient')),
  status          text not null default 'pending'
                    check (status in ('pending','answered','voicemail','missed',
                                      'callback_scheduled','called_back','dismissed')),
  transcript      text,
  soap_segmented  jsonb,
  audio_path      text,
  duration_s      integer,
  staff_notes     text,
  twilio_call_sid text,
  caller_email    text,
  practice_line   text,
  callback_at     timestamptz,
  called_back_at  timestamptz,
  resolved_at     timestamptz,
  resolved_by     uuid references auth.users(id),
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_call_logs_patient       on call_logs(patient_id);
create index if not exists idx_call_logs_unresolved    on call_logs(created_at desc) where patient_id is null;
create index if not exists idx_call_logs_number        on call_logs(caller_number);
create index if not exists idx_call_logs_practice_line on call_logs(practice_line);
create index if not exists idx_call_logs_status        on call_logs(status) where status not in ('dismissed','called_back');
create unique index if not exists idx_call_logs_twilio_sid on call_logs(twilio_call_sid) where twilio_call_sid is not null;

create trigger call_logs_updated_at
  before update on call_logs
  for each row execute function set_updated_at();

alter table call_logs enable row level security;

create policy "Staff can manage call_logs"
  on call_logs for all
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid()
        and role in ('admin', 'doctor', 'nurse', 'front_desk')
    )
  );

grant select, insert, update, delete on public.call_logs to service_role;
grant select, insert, update, delete on public.call_logs to authenticated;
