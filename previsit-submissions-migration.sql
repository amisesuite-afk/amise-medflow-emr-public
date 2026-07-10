-- Pre-visit clinical submissions from patient (web/app/reception tablet)
create table if not exists previsit_submissions (
  id                uuid primary key default uuid_generate_v4(),
  patient_id        uuid references patients(id),
  appointment_id    uuid references appointments(id),
  patient_token     text unique not null default encode(gen_random_bytes(32), 'hex'),

  -- Section completion flags (front desk at-a-glance)
  cc_complete       boolean default false,
  hpi_complete      boolean default false,
  pmh_complete      boolean default false,
  meds_complete     boolean default false,
  surgical_complete boolean default false,
  allergies_complete boolean default false,
  ros_complete      boolean default false,
  photos_complete   boolean default false,

  -- Raw patient-submitted data
  cc                text,
  hpi_raw           jsonb,   -- {onset, duration, severity_0_10, character, location, radiation, associated_symptoms[], alleviating, aggravating}
  pmh               text[],
  medications       jsonb[], -- [{name, dose, frequency, indication}]
  surgical_history  text[],
  allergies         text,
  ros               jsonb,   -- {system: 'positive'|'negative'|'not_asked'}
  photos            jsonb[], -- [{url, context:'wound'|'swelling'|'skin'|'other', uploaded_at}]

  -- AI-formatted clinical output
  ai_formatted      jsonb,   -- {cc, hpi, pmh[], medications[], surgical_history[], allergies, ros_positive[], ros_negative[], red_flags[], suggestions[], urgency}
  ai_processed_at   timestamptz,

  -- Monitoring updates from AMISE patient app (append-only array)
  monitoring_updates jsonb[] default array[]::jsonb[],  -- [{type:'wound_photo'|'pain_score'|'symptom_report', data:{}, submitted_at}]

  -- Lifecycle
  status            text not null default 'pending'
                      check (status in ('pending', 'submitted', 'ai_processed', 'loaded_to_emr')),
  submitted_at      timestamptz,
  loaded_to_emr_at  timestamptz,
  loaded_by         uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table previsit_submissions enable row level security;
create policy "staff_all_previsit" on previsit_submissions
  for all using (auth_role() in ('front_desk','nurse','doctor','admin'));

grant all on previsit_submissions to authenticated;
grant all on previsit_submissions to service_role;
