-- call_logs table: stores every uploaded call recording with metadata
create table if not exists public.call_logs (
  id             uuid primary key default gen_random_uuid(),
  caller_number  text,
  patient_id     uuid references public.patients(id) on delete set null,
  source         text not null default 'phone',  -- 'phone' | 'whatsapp'
  direction      text not null default 'inbound', -- 'inbound' | 'outbound'
  status         text not null default 'answered', -- 'answered' | 'missed' | 'voicemail'
  audio_path     text,
  duration_s     integer,
  practice_line  text,  -- 'Tapion' | 'Rodney Bay' etc.
  staff_notes    text,
  transcript     text,
  twilio_call_sid text,
  reviewed_by    uuid references auth.users(id) on delete set null,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- RLS
alter table public.call_logs enable row level security;

create policy "staff can manage call_logs"
  on public.call_logs for all
  using (
    exists (
      select 1 from public.user_profiles
      where user_profiles.id = auth.uid()
    )
  );

-- Service role access (required — sb() connects as service_role)
grant all on public.call_logs to service_role;
grant all on public.call_logs to authenticated;

-- Index for common queries
create index if not exists call_logs_created_at_idx on public.call_logs(created_at desc);
create index if not exists call_logs_patient_id_idx on public.call_logs(patient_id);
create index if not exists call_logs_caller_number_idx on public.call_logs(caller_number);

-- Storage bucket for call recordings (run once — safe to re-run)
insert into storage.buckets (id, name, public)
values ('call-recordings', 'call-recordings', false)
on conflict (id) do nothing;

-- Allow service_role to upload/read recordings
create policy "service_role can manage call recordings"
  on storage.objects for all
  using (bucket_id = 'call-recordings')
  with check (bucket_id = 'call-recordings');
