-- ============================================================
-- Amise Medical Services — Appointment Change Requests Migration
-- Lets patients request a reschedule or cancellation of an upcoming
-- appointment from the portal. This NEVER touches the calendar or
-- the appointment record directly — it only logs a request for staff
-- to action by phone (assist mode: staff decides, system notifies).
--
-- Run in: Supabase Dashboard → SQL Editor
-- Prerequisites: supabase-schema.sql and supabase-patient-portal-migration.sql
-- must already be applied (uses appointments, patients, my_patient_id()).
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
