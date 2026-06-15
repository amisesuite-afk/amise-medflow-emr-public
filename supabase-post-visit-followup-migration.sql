-- ============================================================
-- Amise Medical Services — Post-Visit Follow-Up Migration
-- Tracks whether a patient has received the generic, non-clinical
-- "how are you feeling since your visit" check-in SMS (sent ~24h
-- after their appointment ended). Completes the post_visit_24h
-- entry in lib/triage-engine's REMINDER_CASCADE.
--
-- Run in: Supabase Dashboard → SQL Editor
-- Prerequisites: confirmed_appointments table must already exist
-- ============================================================

alter table confirmed_appointments
  add column if not exists post_visit_followup_sent boolean not null default false;

comment on column confirmed_appointments.post_visit_followup_sent is
  'Set to true once the ~24h post-visit check-in SMS has been sent for this appointment (cron/reminders).';
