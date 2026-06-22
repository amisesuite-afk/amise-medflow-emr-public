-- ============================================================
-- Amise Medical Services — Pre-Visit Intake Reminder Migration
-- Tracks whether a patient has been nudged to complete their
-- pre-visit questionnaire ahead of an upcoming appointment.
--
-- Run in: Supabase Dashboard → SQL Editor
-- Prerequisites: confirmed_appointments table must already exist
-- ============================================================

alter table confirmed_appointments
  add column if not exists intake_reminder_sent boolean not null default false;

comment on column confirmed_appointments.intake_reminder_sent is
  'Set to true once the 48h pre-visit-questionnaire SMS nudge has been sent for this appointment (cron/reminders).';
