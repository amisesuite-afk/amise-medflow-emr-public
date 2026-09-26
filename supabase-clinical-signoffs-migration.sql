-- ============================================================================
-- Migration 95 — clinical sign-off register: public.clinical_signoffs
-- docs/clinical-validation/changes/signoff-tool.md
--
-- WHY
--   Every clinical change log lists its items under "Needs sign-off", and nothing listed there
--   is approved until the surgeon (or another named reviewer) says so. The in-app "Clinical
--   sign-off" page (Insights → Clinical sign-off, doctor / admin) records each decision here,
--   with the reviewer's name, role and the exact wording reviewed (item hash). A developer then
--   exports the approved decisions and runs `pnpm --filter @workspace/scripts run signoff:apply`
--   to set lastReviewed / reviewer / reviewEvidence in clinical-content/registry.json. The app
--   never edits the repository.
--
-- WHAT
--   One row per decision on one catalogue item (artifacts/dashboard/src/data/
--   clinical-signoff-catalogue.json, generated from the change logs by `signoff:catalogue`).
--   item_id is '<changelog-slug>#<n>' (or 'surgeon-decisions#A1'); item_hash is the first 16 hex
--   digits of the SHA-256 of the item's normalised text, so an edited item reads as "changed
--   since approval". decision: approved / approved_with_amendment / rejected / deferred.
--
-- APPEND-ONLY
--   Rows are never updated or deleted, by anyone (service role included): a correction is a new
--   row, and the latest row for an item is its current decision. BEFORE UPDATE / DELETE /
--   TRUNCATE triggers raise 42501. A BEFORE INSERT trigger stamps decided_at / created_at with
--   the server clock (no back-dating).
--
-- ACCESS (Migration 89 role model, auth_role())
--   doctor, admin: read and insert; the row must name the caller (reviewer_user_id = auth.uid())
--                  and the caller's own role (reviewer_role = auth_role()).
--   nurse:         read only.
--   front_desk and portal patients: no access (no policy matches them).
--   service_role:  table grants (its GRANT is checked before RLS); the triggers still make its
--                  rows append-only.
--
-- CLIENTS TOLERATE ITS ABSENCE
--   Until this runs on production the sign-off page shows the catalogue read-only with
--   "Recording decisions becomes available after the database update (Migration 95)". Nothing
--   returns a 500 and nothing is kept in the browser.
--
-- Idempotent: IF NOT EXISTS everywhere, policies and triggers inside do $guard$ blocks,
-- constraints added only when missing. Independent of 87–94.
-- ============================================================================

create table if not exists public.clinical_signoffs (
  id                uuid        primary key default gen_random_uuid(),
  item_id           text        not null,
  item_hash         text        not null,
  -- Hash of the whole catalogue the reviewer was looking at (provenance only).
  catalogue_hash    text,
  decision          text        not null,
  -- Required for approved_with_amendment, and only there.
  amendment         text,
  -- Optional reason (for example why an item was rejected or deferred).
  comment           text,
  -- The reviewer ticked "I have reviewed this item against the cited source".
  attested          boolean     not null default false,
  reviewer_user_id  uuid        not null,
  reviewer_name     text        not null,
  reviewer_role     text        not null,
  rule_set_ids      text[]      not null default '{}'::text[],
  -- Idempotency key from the client, so a double submit cannot record two rows.
  client_ref        text,
  decided_at        timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

-- ── CHECK constraints (added only when missing, so a re-run is a no-op) ────────────────────
do $c$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinical_signoffs_item_check') then
    alter table public.clinical_signoffs add constraint clinical_signoffs_item_check
      check (item_id ~ '^[a-z0-9-]{1,64}#[A-Za-z0-9.-]{1,16}$'
             and item_hash ~ '^[0-9a-f]{16}$'
             and (catalogue_hash is null or catalogue_hash ~ '^[0-9a-f]{16}$'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinical_signoffs_decision_check') then
    alter table public.clinical_signoffs add constraint clinical_signoffs_decision_check
      check (decision in ('approved', 'approved_with_amendment', 'rejected', 'deferred')
             and ((decision = 'approved_with_amendment')
                  = (amendment is not null and length(btrim(amendment)) between 3 and 4000))
             and (comment is null or length(comment) <= 2000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinical_signoffs_attested_check') then
    alter table public.clinical_signoffs add constraint clinical_signoffs_attested_check
      check (attested);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinical_signoffs_reviewer_check') then
    alter table public.clinical_signoffs add constraint clinical_signoffs_reviewer_check
      check (length(btrim(reviewer_name)) between 2 and 200
             and reviewer_role in ('doctor', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinical_signoffs_refs_check') then
    alter table public.clinical_signoffs add constraint clinical_signoffs_refs_check
      check (cardinality(rule_set_ids) <= 40
             and array_to_string(rule_set_ids, ',') ~ '^([a-z0-9-]{1,80}(,[a-z0-9-]{1,80})*)?$'
             and (client_ref is null or client_ref ~ '^[A-Za-z0-9:-]{1,80}$'));
  end if;
end
$c$;

-- ── Indexes ─────────────────────────────────────────────────────────────────────────────────
create unique index if not exists clinical_signoffs_client_ref_key
  on public.clinical_signoffs (client_ref) where client_ref is not null;
create index if not exists clinical_signoffs_item_idx
  on public.clinical_signoffs (item_id, decided_at desc);

-- ── Append-only ─────────────────────────────────────────────────────────────────────────────
create or replace function public.clinical_signoffs_stamp()
returns trigger
language plpgsql
as $fn$
begin
  new.decided_at := now();
  new.created_at := now();
  return new;
end
$fn$;

create or replace function public.clinical_signoffs_append_only()
returns trigger
language plpgsql
as $fn$
begin
  raise exception 'clinical_signoffs is append-only: record a new decision instead of changing or deleting one'
    using errcode = '42501';
end
$fn$;

do $guard$ begin
  create trigger clinical_signoffs_stamp
    before insert on public.clinical_signoffs
    for each row execute function public.clinical_signoffs_stamp();
exception when duplicate_object then null;
end $guard$;

do $guard$ begin
  create trigger clinical_signoffs_no_update
    before update or delete on public.clinical_signoffs
    for each row execute function public.clinical_signoffs_append_only();
exception when duplicate_object then null;
end $guard$;

do $guard$ begin
  create trigger clinical_signoffs_no_truncate
    before truncate on public.clinical_signoffs
    for each statement execute function public.clinical_signoffs_append_only();
exception when duplicate_object then null;
end $guard$;

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
alter table public.clinical_signoffs enable row level security;

do $guard$ begin
  create policy "clinicians_select_clinical_signoffs" on public.clinical_signoffs
    for select to authenticated
    using ((select public.auth_role()) in ('nurse', 'doctor', 'admin'));
exception when duplicate_object then null;
end $guard$;

do $guard$ begin
  create policy "reviewers_insert_clinical_signoffs" on public.clinical_signoffs
    for insert to authenticated
    with check ((select public.auth_role()) in ('doctor', 'admin')
                and reviewer_user_id = (select auth.uid())
                and reviewer_role = (select public.auth_role()));
exception when duplicate_object then null;
end $guard$;

-- ── Grants ──────────────────────────────────────────────────────────────────────────────────
-- Clients read and insert only (no UPDATE / DELETE grant). The service role gets the usual four
-- (its GRANT is checked before RLS); the append-only triggers still refuse its UPDATE / DELETE.
grant select, insert on table public.clinical_signoffs to authenticated;
grant select, insert, update, delete on table public.clinical_signoffs to service_role;
