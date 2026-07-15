-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: call_logs — add missing columns used by the API server
--
-- The original supabase-call-logs-migration.sql was missing:
--   status, twilio_call_sid, caller_email, practice_line,
--   callback_at, called_back_at
--
-- Run this once in the Supabase SQL editor.
-- All additions are idempotent (IF NOT EXISTS / DO NOTHING).
-- ─────────────────────────────────────────────────────────────────────────────

-- status — call outcome / queue state
alter table call_logs
  add column if not exists status text not null default 'pending'
    check (status in ('pending','answered','voicemail','missed',
                      'callback_scheduled','called_back','dismissed'));

-- twilio_call_sid — unique Twilio identifier, used for upsert de-dup
alter table call_logs
  add column if not exists twilio_call_sid text;

create unique index if not exists idx_call_logs_twilio_sid
  on call_logs(twilio_call_sid)
  where twilio_call_sid is not null;

-- caller_email — for WhatsApp / patient-app callers identified by email
alter table call_logs
  add column if not exists caller_email text;

-- practice_line — human label of the Twilio number that received the call
--                 (e.g. 'Tapion', 'Rodney Bay', 'Tapion Landline')
alter table call_logs
  add column if not exists practice_line text;

-- callback_at — when staff scheduled a return call
alter table call_logs
  add column if not exists callback_at timestamptz;

-- called_back_at — when the callback was actually completed
alter table call_logs
  add column if not exists called_back_at timestamptz;

-- Backfill existing rows that have audio_path to status='voicemail'
-- (recordings that arrived before this migration, which defaulted to 'pending')
update call_logs
  set status = 'voicemail'
  where audio_path is not null
    and status = 'pending';

-- Index on status for the unresolved-queue filter
create index if not exists idx_call_logs_status
  on call_logs(status)
  where status not in ('dismissed','called_back');

-- Index on practice_line for per-line filtering
create index if not exists idx_call_logs_practice_line
  on call_logs(practice_line);
