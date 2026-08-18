-- Conversation threads
create table if not exists conversation_threads (
  id                uuid primary key default gen_random_uuid(),
  channel           text not null check (channel in ('whatsapp','email','sms')),
  patient_identifier text not null,
  patient_name      text,
  patient_dob       text,
  chief_complaint   text,
  triage_level      text not null default 'INFO' check (triage_level in ('EMERGENT','URGENT','ROUTINE','INFO')),
  status            text not null default 'active' check (status in ('active','pending_approval','resolved','escalated')),
  messages          jsonb not null default '[]',
  draft_reply       text,
  intake_complete   boolean not null default false,
  site              text not null default 'rodney_bay' check (site in ('rodney_bay','tapion')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists appointment_requests (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid references conversation_threads(id),
  patient_name    text not null,
  patient_phone   text,
  patient_email   text,
  chief_complaint text,
  triage_level    text not null,
  preferred_site  text,
  preferred_date  text,
  notes           text,
  status          text not null default 'pending' check (status in ('pending','scheduled','cancelled')),
  created_at      timestamptz not null default now()
);

create table if not exists intake_audit_log (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid references conversation_threads(id),
  action     text not null,
  actor      text not null,
  details    jsonb,
  created_at timestamptz not null default now()
);

alter table conversation_threads enable row level security;
alter table appointment_requests enable row level security;
alter table intake_audit_log enable row level security;

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_updated_at on conversation_threads;
create trigger set_updated_at before update on conversation_threads
  for each row execute procedure update_updated_at();
