-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: call_logs
-- Stores every incoming voice signal (phone call, patient app voice note,
-- ambient in-session recording) keyed by patient_id.
-- patient_id IS NULL means the caller is unresolved → front-desk queue.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists call_logs (
  id              uuid primary key default uuid_generate_v4(),

  -- Caller identity
  caller_number   text,                         -- E.164 or local, nullable for in-app
  patient_id      uuid references patients(id), -- NULL = unresolved / new patient

  -- Signal metadata
  direction       text not null default 'inbound'
                    check (direction in ('inbound', 'outbound', 'ambient', 'app_message')),
  source          text not null default 'phone'
                    check (source in ('phone', 'whatsapp', 'patient_app', 'ambient')),

  -- Content
  transcript      text,           -- raw Whisper / Web Speech STT output
  soap_segmented  jsonb,          -- structured SOAP result after AI segmentation
  audio_path      text,           -- Supabase Storage object path (optional)
  duration_s      integer,        -- call/recording duration in seconds
  staff_notes     text,           -- front-desk annotation on resolution

  -- Resolution
  resolved_at     timestamptz,    -- set when patient_id is linked by staff
  resolved_by     uuid references auth.users(id),

  -- Audit
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes for the three most common queries
create index if not exists idx_call_logs_patient   on call_logs(patient_id);
create index if not exists idx_call_logs_unresolved on call_logs(created_at desc) where patient_id is null;
create index if not exists idx_call_logs_number    on call_logs(caller_number);

-- Updated-at trigger (reuse the function already defined for other tables)
create trigger call_logs_updated_at
  before update on call_logs
  for each row execute function set_updated_at();

-- RLS
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

-- service_role full access (API server bypasses RLS but still needs GRANT)
grant select, insert, update, delete on public.call_logs to service_role;
grant select, insert, update, delete on public.call_logs to authenticated;
