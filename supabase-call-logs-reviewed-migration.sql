-- Add reviewed_by / reviewed_at to call_logs
-- Run once in Supabase SQL Editor after supabase-call-logs-migration.sql

alter table public.call_logs
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create index if not exists call_logs_reviewed_at_idx on public.call_logs(reviewed_at);

notify pgrst, 'reload schema';
