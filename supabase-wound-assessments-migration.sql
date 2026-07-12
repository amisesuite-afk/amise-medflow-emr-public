-- Migration: wound assessment tracking
-- Run in Supabase SQL editor

create table if not exists wound_assessments (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patients(id) on delete cascade,
  encounter_id    uuid references encounters(id) on delete set null,
  label           text not null default 'Wound',
  location        text,
  wound_class     text check (wound_class in ('clean','clean_contaminated','contaminated','dirty')),
  closure         text check (closure in ('primary','secondary','delayed_primary','vac','open')),
  status          text not null default 'healing'
                    check (status in ('healing','superficial_ssi','deep_ssi','dehiscence','seroma','haematoma','necrosis','closed')),
  dressing        text,
  drain           text check (drain in ('none','in_situ','removed')),
  drain_output_ml integer,
  asepsis_score   integer default 0,
  asepsis_details jsonb,
  notes           text,
  assessed_date   date not null default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists wound_assessments_patient_idx    on wound_assessments(patient_id);
create index if not exists wound_assessments_encounter_idx  on wound_assessments(encounter_id);

alter table wound_assessments enable row level security;

create policy "authenticated staff can access wound_assessments"
  on wound_assessments for all
  using (auth.role() = 'authenticated');

grant all on wound_assessments to authenticated;
grant all on wound_assessments to service_role;
