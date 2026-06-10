-- ============================================================
-- Amise Medical Services — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- USER PROFILES (roles)
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- PATIENTS
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- ENCOUNTERS
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- VITALS
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- SYMPTOMS
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- MEDICATIONS
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- ALLERGIES
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- ASSESSMENTS
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- PLANS
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- PROCEDURES
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- REFERRALS
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- APPOINTMENTS
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- AUDIT LOGS
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGER (applied to all audit-tracked tables)
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
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

-- ── user_profiles ──
-- Users can read their own profile; admins see all
create policy "users_select_own_profile" on user_profiles
  for select using (id = auth.uid() or auth_role() = 'admin');
create policy "admins_manage_profiles" on user_profiles
  for all using (auth_role() = 'admin');

-- ── patients ──
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

-- ── encounters ──
create policy "staff_select_encounters" on encounters
  for select using (auth.uid() is not null);
create policy "staff_insert_encounters" on encounters
  for insert with check (auth.uid() is not null);
create policy "doctors_update_encounters" on encounters
  for update using (auth_role() in ('doctor', 'admin', 'nurse'));
create policy "admins_delete_encounters" on encounters
  for delete using (auth_role() = 'admin');

-- ── vitals ──
create policy "staff_select_vitals" on vitals
  for select using (auth.uid() is not null);
create policy "nurses_insert_vitals" on vitals
  for insert with check (auth_role() in ('nurse', 'doctor', 'admin'));
create policy "nurses_update_vitals" on vitals
  for update using (auth_role() in ('nurse', 'doctor', 'admin'));

-- ── symptoms ──
create policy "staff_select_symptoms" on symptoms
  for select using (auth.uid() is not null);
create policy "staff_insert_symptoms" on symptoms
  for insert with check (auth.uid() is not null);
create policy "staff_update_symptoms" on symptoms
  for update using (created_by = auth.uid() or auth_role() in ('doctor', 'admin'));

-- ── medications ──
create policy "staff_select_medications" on medications
  for select using (auth.uid() is not null);
create policy "nurses_insert_medications" on medications
  for insert with check (auth_role() in ('nurse', 'doctor', 'admin', 'front_desk'));
create policy "nurses_update_medications" on medications
  for update using (auth_role() in ('nurse', 'doctor', 'admin'));

-- ── allergies ──
create policy "staff_select_allergies" on allergies
  for select using (auth.uid() is not null);
create policy "staff_insert_allergies" on allergies
  for insert with check (auth.uid() is not null);
create policy "staff_update_allergies" on allergies
  for update using (created_by = auth.uid() or auth_role() in ('doctor', 'admin', 'nurse'));

-- ── assessments (doctor/admin only) ──
create policy "doctors_select_assessments" on assessments
  for select using (auth_role() in ('doctor', 'admin', 'nurse'));
create policy "doctors_insert_assessments" on assessments
  for insert with check (auth_role() in ('doctor', 'admin'));
create policy "doctors_update_assessments" on assessments
  for update using (auth_role() in ('doctor', 'admin'));

-- ── plans (doctor/admin only) ──
create policy "doctors_select_plans" on plans
  for select using (auth_role() in ('doctor', 'admin', 'nurse'));
create policy "doctors_insert_plans" on plans
  for insert with check (auth_role() in ('doctor', 'admin'));
create policy "doctors_update_plans" on plans
  for update using (auth_role() in ('doctor', 'admin'));

-- ── procedures ──
create policy "staff_select_procedures" on procedures
  for select using (auth.uid() is not null);
create policy "doctors_manage_procedures" on procedures
  for all using (auth_role() in ('doctor', 'admin'));

-- ── referrals ──
create policy "staff_select_referrals" on referrals
  for select using (auth.uid() is not null);
create policy "doctors_manage_referrals" on referrals
  for all using (auth_role() in ('doctor', 'admin'));

-- ── appointments ──
create policy "staff_select_appointments" on appointments
  for select using (auth.uid() is not null);
create policy "staff_insert_appointments" on appointments
  for insert with check (auth.uid() is not null);
create policy "staff_update_appointments" on appointments
  for update using (auth.uid() is not null);
create policy "admins_delete_appointments" on appointments
  for delete using (auth_role() = 'admin');

-- ── audit_logs (append-only for all authenticated; read for doctors/admins) ──
create policy "staff_insert_audit" on audit_logs
  for insert with check (auth.uid() is not null);
create policy "admins_select_audit" on audit_logs
  for select using (auth_role() in ('doctor', 'admin'));

-- ─────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- GRANTS
-- PostgreSQL-level grants are required in addition to RLS policies.
-- Without these, the authenticated role receives permission denied
-- even if an RLS policy would otherwise allow the operation.
-- ─────────────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated;

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

-- ── Appointment requests (self-triage portal) ────────────────────────────────
create table if not exists appointment_requests (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  patient_name     text not null,
  patient_email    text not null,
  patient_phone    text,
  appointment_type text not null,
  location         text not null default 'rodney_bay',
  preferred_slot   timestamptz,           -- patient's requested slot
  confirmed_slot   timestamptz,           -- slot confirmed by staff
  reason           text,
  triage_acuity    text,                  -- from self-triage engine
  triage_score     int,
  status           text not null default 'pending'
                   check (status in ('pending','staff_confirmed','patient_confirmed','lapsed','cancelled')),
  staff_confirmed_at  timestamptz,
  patient_confirmed_at timestamptz,
  reminder_sent_at    timestamptz,
  google_event_id     text,
  notes               text
);

alter table appointment_requests enable row level security;
create policy "staff_all" on appointment_requests for all using (true);
grant select, insert, update        on public.appointment_requests to authenticated, service_role;
grant select, insert               on public.audit_logs       to authenticated;
