-- ============================================================================
-- Migration 98 — approved-content channel: public.clinical_content_releases
-- docs/APPROVED-CONTENT-CHANNEL.md, docs/clinical-validation/changes/approved-content-channel.md
--
-- WHY
--   The shared clinical rule files (clinical-content/rules/*.json) ship inside the web build and
--   the iOS app. After the surgeon signs off a new version of one of them, it should reach the
--   dashboard and the iPhone / iPad without waiting for an App Store release. This table holds
--   each published, signed-off version ("release") of a rule file. The clients read it, verify
--   each release themselves (hash, id, version above the bundled one, JSON Schema, pinned fields;
--   lib/triage-engine/src/approved-content, ios/AmiseMedFlow/Services/ApprovedContent.swift) and
--   otherwise keep the bundled file. The bundled file is always the fallback.
--
-- WHAT
--   One row per published version of one rule file:
--     content_id      the registry id and file name (clinical-content/rules/<content_id>.json)
--     version         MAJOR.MINOR.PATCH, unique per content_id; must equal body->>'version'
--     sha256          SHA-256 of the canonical JSON of body (64 lowercase hex; definition in
--                     lib/triage-engine/src/approved-content/canonical-json.ts). The database
--                     cannot canonicalise, so the CLIENTS check it; here only the shape is checked.
--     body            the whole rule file (jsonb object; body->>'id' must equal content_id)
--     schema_version  the schema the publisher validated against (informational)
--     published_by    the publisher's auth user (must be the caller); published_at: server clock
--     signoff_ref     what approved it: clinical_signoffs item ids / catalogue hash / section-I
--                     record (required; `content:publish` refuses to print SQL without it)
--     revoked_at / revoked_by / revoked_reason   set once, together, to withdraw a release
--   Rows are written by `pnpm --filter @workspace/scripts run content:publish` (prints the SQL for
--   an admin to run; inserts only with SUPABASE_* env vars AND --confirm). No app screen writes it.
--
-- APPEND-ONLY EXCEPT REVOCATION
--   DELETE and TRUNCATE are refused for everyone, the service role included (42501). UPDATE may
--   only revoke a live release: revoked_at (stamped with the server clock), revoked_by and
--   revoked_reason, once; nothing else may change and a revocation cannot be undone. A correction
--   is a new, higher version. A BEFORE INSERT trigger stamps published_at with the server clock.
--
-- ACCESS (Migration 89 role model, auth_role(), as Migration 95)
--   front_desk, nurse, doctor, admin: read (clinical content, not patient data; every device
--                                     must be able to pick up a release).
--   doctor, admin:                    insert, only as themselves (published_by = auth.uid());
--                                     revoke, only as themselves (revoked_by = auth.uid()).
--   portal patients and users with no staff profile: nothing (no policy matches them).
--   service_role:                     table grants (checked before RLS); the triggers still make
--                                     its rows append-only.
--   published_by references auth.users without ON DELETE: an account that published a release
--   cannot be deleted (disable it instead), so every release stays attributable.
--
-- CLIENTS TOLERATE ITS ABSENCE
--   Until this runs on production, the dashboard and iOS read "table missing" as "no releases"
--   and use the bundled files; nothing returns a 500 and no error is shown.
--
-- Idempotent: IF NOT EXISTS everywhere, policies and triggers inside do $guard$ blocks,
-- constraints added only when missing. Independent of 87–97.
-- ============================================================================

create table if not exists public.clinical_content_releases (
  id              uuid        primary key default gen_random_uuid(),
  content_id      text        not null,
  version         text        not null,
  sha256          text        not null,
  body            jsonb       not null,
  schema_version  text,
  published_by    uuid        references auth.users (id),
  published_at    timestamptz not null default now(),
  signoff_ref     text        not null,
  revoked_at      timestamptz,
  revoked_by      uuid        references auth.users (id),
  revoked_reason  text,
  constraint clinical_content_releases_content_version_key unique (content_id, version)
);

-- ── CHECK constraints (added only when missing, so a re-run is a no-op) ────────────────────
do $c$
begin
  if not exists (select 1 from pg_constraint where conname = 'clinical_content_releases_shape_check') then
    alter table public.clinical_content_releases add constraint clinical_content_releases_shape_check
      check (content_id ~ '^[a-z0-9-]{1,80}$'
             and version ~ '^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$'
             and sha256 ~ '^[0-9a-f]{64}$'
             and (schema_version is null or schema_version ~ '^[A-Za-z0-9._:/#-]{1,200}$'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinical_content_releases_body_check') then
    alter table public.clinical_content_releases add constraint clinical_content_releases_body_check
      check (jsonb_typeof(body) = 'object'
             and body ->> 'id' = content_id
             and body ->> 'version' = version
             and octet_length(body::text) <= 2097152);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinical_content_releases_signoff_check') then
    alter table public.clinical_content_releases add constraint clinical_content_releases_signoff_check
      check (length(btrim(signoff_ref)) between 3 and 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clinical_content_releases_revoke_check') then
    alter table public.clinical_content_releases add constraint clinical_content_releases_revoke_check
      check ((revoked_at is null) = (revoked_reason is null)
             and (revoked_at is not null or revoked_by is null)
             and (revoked_reason is null or length(btrim(revoked_reason)) between 3 and 1000));
  end if;
end
$c$;

-- ── Indexes ─────────────────────────────────────────────────────────────────────────────────
create index if not exists clinical_content_releases_content_idx
  on public.clinical_content_releases (content_id, published_at desc);

-- ── Append-only except a one-time revocation ────────────────────────────────────────────────
create or replace function public.clinical_content_releases_stamp()
returns trigger
language plpgsql
as $fn$
begin
  if new.revoked_at is not null or new.revoked_by is not null or new.revoked_reason is not null then
    raise exception 'a release is published live; revoke it afterwards'
      using errcode = '42501';
  end if;
  new.published_at := now();
  return new;
end
$fn$;

create or replace function public.clinical_content_releases_revoke_only()
returns trigger
language plpgsql
as $fn$
begin
  if old.revoked_at is not null then
    raise exception 'clinical_content_releases: this release is already revoked; publish a new version instead'
      using errcode = '42501';
  end if;
  if new.id is distinct from old.id
     or new.content_id is distinct from old.content_id
     or new.version is distinct from old.version
     or new.sha256 is distinct from old.sha256
     or new.body is distinct from old.body
     or new.schema_version is distinct from old.schema_version
     or new.published_by is distinct from old.published_by
     or new.published_at is distinct from old.published_at
     or new.signoff_ref is distinct from old.signoff_ref then
    raise exception 'clinical_content_releases is append-only: only a revocation (revoked_at, revoked_by, revoked_reason) may be recorded'
      using errcode = '42501';
  end if;
  if new.revoked_at is null then
    raise exception 'clinical_content_releases: an update must revoke the release (revoked_at and revoked_reason)'
      using errcode = '42501';
  end if;
  new.revoked_at := now();
  return new;
end
$fn$;

create or replace function public.clinical_content_releases_no_delete()
returns trigger
language plpgsql
as $fn$
begin
  raise exception 'clinical_content_releases is append-only: revoke a release instead of deleting it'
    using errcode = '42501';
end
$fn$;

do $guard$ begin
  create trigger clinical_content_releases_stamp
    before insert on public.clinical_content_releases
    for each row execute function public.clinical_content_releases_stamp();
exception when duplicate_object then null;
end $guard$;

do $guard$ begin
  create trigger clinical_content_releases_revoke_only
    before update on public.clinical_content_releases
    for each row execute function public.clinical_content_releases_revoke_only();
exception when duplicate_object then null;
end $guard$;

do $guard$ begin
  create trigger clinical_content_releases_no_delete
    before delete on public.clinical_content_releases
    for each row execute function public.clinical_content_releases_no_delete();
exception when duplicate_object then null;
end $guard$;

do $guard$ begin
  create trigger clinical_content_releases_no_truncate
    before truncate on public.clinical_content_releases
    for each statement execute function public.clinical_content_releases_no_delete();
exception when duplicate_object then null;
end $guard$;

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
alter table public.clinical_content_releases enable row level security;

do $guard$ begin
  create policy "staff_select_clinical_content_releases" on public.clinical_content_releases
    for select to authenticated
    using ((select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));
exception when duplicate_object then null;
end $guard$;

do $guard$ begin
  create policy "publishers_insert_clinical_content_releases" on public.clinical_content_releases
    for insert to authenticated
    with check ((select public.auth_role()) in ('doctor', 'admin')
                and published_by = (select auth.uid()));
exception when duplicate_object then null;
end $guard$;

do $guard$ begin
  create policy "publishers_revoke_clinical_content_releases" on public.clinical_content_releases
    for update to authenticated
    using ((select public.auth_role()) in ('doctor', 'admin'))
    with check ((select public.auth_role()) in ('doctor', 'admin')
                and revoked_by = (select auth.uid()));
exception when duplicate_object then null;
end $guard$;

-- ── Grants ──────────────────────────────────────────────────────────────────────────────────
-- Clients read, insert, and update only the three revocation columns (no DELETE grant). The
-- service role gets the usual four (its GRANT is checked before RLS); the triggers still refuse
-- its DELETE / TRUNCATE and any UPDATE other than a revocation.
grant select, insert on table public.clinical_content_releases to authenticated;
grant update (revoked_at, revoked_by, revoked_reason) on table public.clinical_content_releases to authenticated;
grant select, insert, update, delete on table public.clinical_content_releases to service_role;
