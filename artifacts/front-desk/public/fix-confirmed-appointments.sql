-- ============================================================
-- Amise Medical Services — Confirmed Appointments Table
-- Creates the confirmed_appointments table and applies
-- migrations #17 (intake_reminder_sent) and #21 (post_visit_followup_sent)
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

create table if not exists confirmed_appointments (
  id                uuid primary key default uuid_generate_v4(),
  appointment_request_id uuid references appointment_requests(id),
  patient_id        uuid references patients(id),
  start_time        timestamptz not null,
  end_time          timestamptz,
  location          text,
  appointment_type  text,
  provider          text,
  status            text not null default 'confirmed'
                    check (status in ('confirmed', 'cancelled', 'completed', 'no_show')),
  calendar_event_id text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Migration #17: intake_reminder_sent
alter table confirmed_appointments
  add column if not exists intake_reminder_sent boolean not null default false;

comment on column confirmed_appointments.intake_reminder_sent is
  'Set to true once the 48h pre-visit questionnaire SMS nudge has been sent for this appointment (cron/reminders).';

-- Migration #21: post_visit_followup_sent
alter table confirmed_appointments
  add column if not exists post_visit_followup_sent boolean not null default false;

comment on column confirmed_appointments.post_visit_followup_sent is
  'Set to true once the 24h post-visit check-in SMS has been sent for this appointment (cron/reminders).';

-- RLS
alter table confirmed_appointments enable row level security;

create policy "staff_manage_confirmed_appointments"
  on confirmed_appointments for all
  to authenticated
  using (true)
  with check (true);

-- Grants
grant select, insert, update, delete on confirmed_appointments to authenticated;
grant select, insert, update, delete on confirmed_appointments to service_role;

-- Verify
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'confirmed_appointments'
      AND column_name = 'intake_reminder_sent') = 1,
    'Expected intake_reminder_sent column';
  ASSERT (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'confirmed_appointments'
      AND column_name = 'post_visit_followup_sent') = 1,
    'Expected post_visit_followup_sent column';
  RAISE NOTICE 'confirmed_appointments table with both columns: OK';
END $$;
