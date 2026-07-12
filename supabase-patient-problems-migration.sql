-- Migration: persistent patient problem list
-- Run in Supabase SQL editor

create table if not exists patient_problems (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references patients(id) on delete cascade,
  title        text not null,
  status       text not null default 'active'
                 check (status in ('active', 'chronic', 'resolved')),
  icd10_code   text,
  onset_date   date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists patient_problems_patient_id_idx on patient_problems(patient_id);

alter table patient_problems enable row level security;

create policy "authenticated staff can access patient_problems"
  on patient_problems for all
  using (auth.role() = 'authenticated');

grant all on patient_problems to authenticated;
grant all on patient_problems to service_role;
