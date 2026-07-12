-- Migration: add practice_line to call_logs and auto-MRN generation for patients
-- Run in Supabase SQL editor after supabase-call-logs-migration.sql

-- 1. Add practice_line to call_logs
alter table call_logs
  add column if not exists practice_line text,
  add column if not exists caller_email  text;

-- 2. Index for practice_line filtering (front-desk per-site view)
create index if not exists idx_call_logs_practice_line
  on call_logs(practice_line)
  where practice_line is not null;

-- 3. Index for email matching (supplement phone lookup)
create index if not exists idx_patients_phone on patients(phone)
  where phone is not null;

-- 4. Auto-generate MRN on patient insert if not supplied
--    Format: AM-YYYYNNN (e.g. AM-2026001)
create or replace function generate_patient_mrn()
returns trigger language plpgsql as $$
declare
  yr    text := to_char(now(), 'YYYY');
  seq   int;
  candidate text;
begin
  if new.mrn is not null then
    return new;
  end if;
  -- Count existing patients created this year to get sequence number
  select count(*) + 1
    into seq
    from patients
   where mrn like 'AM-' || yr || '%';
  candidate := 'AM-' || yr || lpad(seq::text, 4, '0');
  -- Ensure uniqueness in the (unlikely) case of concurrent inserts
  while exists (select 1 from patients where mrn = candidate) loop
    seq := seq + 1;
    candidate := 'AM-' || yr || lpad(seq::text, 4, '0');
  end loop;
  new.mrn := candidate;
  return new;
end;
$$;

drop trigger if exists trg_generate_patient_mrn on patients;
create trigger trg_generate_patient_mrn
  before insert on patients
  for each row
  execute function generate_patient_mrn();

-- 5. Backfill MRN for existing patients that have none
do $$
declare
  p record;
  yr text;
  seq int := 0;
  candidate text;
begin
  for p in
    select id, created_at
      from patients
     where mrn is null
     order by created_at
  loop
    yr := to_char(p.created_at, 'YYYY');
    loop
      seq := seq + 1;
      candidate := 'AM-' || yr || lpad(seq::text, 4, '0');
      exit when not exists (select 1 from patients where mrn = candidate);
    end loop;
    update patients set mrn = candidate where id = p.id;
  end loop;
end;
$$;
