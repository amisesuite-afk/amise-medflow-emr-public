-- Migration: voicemail and callback queue columns on call_logs
-- Run after supabase-call-logs-add-practice-line.sql

alter table call_logs
  add column if not exists status text not null default 'pending'
    check (status in (
      'pending',            -- just received, not yet reviewed
      'answered',           -- staff picked up live
      'voicemail',          -- caller left a voice message
      'missed',             -- rang out / no answer / no voicemail
      'callback_scheduled', -- staff flagged for callback
      'called_back',        -- callback completed
      'dismissed'           -- no action required
    )),
  add column if not exists twilio_call_sid  text,
  add column if not exists recording_url    text,
  add column if not exists recording_sid    text,
  add column if not exists callback_at      timestamptz,
  add column if not exists called_back_at   timestamptz,
  add column if not exists called_back_by   uuid references auth.users(id);

-- Unique index so a Twilio SID can only create one log entry
create unique index if not exists idx_call_logs_twilio_sid
  on call_logs(twilio_call_sid)
  where twilio_call_sid is not null;

create index if not exists idx_call_logs_status
  on call_logs(status);

create index if not exists idx_call_logs_status_created
  on call_logs(status, created_at desc);

-- RLS: no changes needed — existing policies cover new columns
