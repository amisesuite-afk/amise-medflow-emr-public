-- Migration: procedure_prep_drafts
-- Queue of Claude-drafted, patient-specific procedure-prep flagging notes
-- (e.g. "this patient mentioned warfarin / diabetes / dialysis ahead of
-- their colonoscopy") awaiting review by Dr Kabiye or nursing staff.
--
-- These drafts are ALWAYS for internal clinical-team review — they are
-- never sent directly to a patient. Once approved, staff contact the
-- patient with the specific adjustment (medication stop-timing, dose
-- change, prep product). The standard (non-personalised) prep instructions
-- are sent to the patient immediately and are NOT gated by this queue.
-- Run in Supabase SQL Editor against your production project.

create table if not exists procedure_prep_drafts (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid,  -- FK to conversation_threads added below when that table exists
  procedure_type  text not null,
  patient_name    text,
  draft_text      text not null,
  status          text not null default 'pending_approval'
                    check (status in ('pending_approval', 'approved', 'rejected', 'sent')),
  reviewed_by     text,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- conversation_threads is not created by any runner step: production got it by
-- hand from artifacts/front-desk/supabase-schema.sql. Production already has
-- this FK (the table was first created with an inline REFERENCES), so this
-- block is a no-op there; on a fresh database without conversation_threads
-- the column stays an unconstrained uuid. See migrations/README.md.
do $guard$ begin
  if to_regclass('public.conversation_threads') is null then
    raise notice 'conversation_threads missing: procedure_prep_drafts.thread_id left without its foreign key';
  elsif not exists (
    select 1 from pg_constraint
    where conrelid = 'public.procedure_prep_drafts'::regclass
      and contype = 'f'
      and confrelid = 'public.conversation_threads'::regclass
  ) then
    alter table procedure_prep_drafts
      add constraint procedure_prep_drafts_thread_id_fkey
      foreign key (thread_id) references conversation_threads(id) on delete cascade;
  end if;
end $guard$;

create index if not exists idx_procedure_prep_drafts_status
  on procedure_prep_drafts (status, created_at);

alter table procedure_prep_drafts enable row level security;

do $guard$ begin
  create policy "staff manage procedure prep drafts"
    on procedure_prep_drafts
    for all
    to authenticated
    using (true)
    with check (true);
exception when duplicate_object then null;
end $guard$;

grant select, insert, update on procedure_prep_drafts to authenticated;
grant select, insert, update on procedure_prep_drafts to service_role;
