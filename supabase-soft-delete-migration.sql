-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 87: soft delete for iOS-synced clinical records
-- Amise MedFlow EMR — 2026-09-24
--
-- Problem
--   Deleting a clinical note, prescription, vitals entry, billing item or
--   document on the iOS app only removed it on that device. The iOS app kept a
--   local "tombstone" (ios/AmiseMedFlow/Services/SyncTombstones.swift) so the
--   deleting device skipped the row on pull, but every other device (iPhone,
--   iPad) and the web dashboard kept showing it. A hard DELETE from iOS is not
--   an option: DELETE on clinical_notes and prescriptions is admin-only under
--   RLS, and a hard delete of clinical records destroys the medico-legal trail.
--
-- What this migration does
--   1. Adds nullable `deleted_at timestamptz` and `deleted_by uuid` to the five
--      tables the iOS SyncService reads and writes:
--        clinical_notes          (ClinicalNote)
--        prescriptions           (Prescription)
--        patient_vitals          (VitalsEntry — NOT the web `vitals` table)
--        patient_billing_items   (BillingLineItem)
--        patient_documents       (PatientDocument — NOT the web `documents` table)
--      NULL = live record; set = logically deleted, row kept for audit and so
--      other devices can see the deletion on their next pull.
--      clinical_notes.deleted_at already exists (supabase-phase2-schema-migration.sql)
--      and prescriptions.deleted_at very likely does (slice-i, already read by
--      artifacts/api-server/src/routes/prescriptions.ts); ADD COLUMN IF NOT
--      EXISTS makes both no-ops.
--   2. Partial indexes on (patient_id) WHERE deleted_at IS NULL — the shape of
--      every per-patient read in the web app and API server.
--   3. A SECURITY DEFINER function `public.soft_delete(p_table, p_id)` that is
--      the only supported way for a signed-in staff member to soft-delete.
--
-- Permission design (why a function and not a new UPDATE policy)
--   The existing UPDATE policies differ per table and none of them fit:
--     clinical_notes  — UPDATE only when created_by = auth.uid() or admin.
--                       Notes created by iOS before 2026-09 have created_by
--                       NULL, so nobody but an admin could soft-delete them.
--     prescriptions   — UPDATE doctor/admin (plus a possible permissive
--                       "staff access" FOR ALL policy from an older file).
--     patient_vitals, patient_billing_items, patient_documents
--                     — "staff access" FOR ALL to every authenticated user.
--   Widening an UPDATE policy to let people set deleted_at would also let them
--   change every other column. A narrow column-level policy is not possible in
--   Postgres RLS (policies are row-level). So instead:
--     * RLS policies are left exactly as they are (no policy is added, dropped
--       or renamed — lint:rls-policies is unaffected).
--     * soft_delete() runs as the table owner, sets only deleted_at/deleted_by,
--       and enforces its own per-table role rule via auth_role():
--         clinical_notes         admin; or doctor who wrote the note
--                                (created_by = auth.uid()) or when created_by
--                                is NULL (legacy iOS notes). Nurses cannot
--                                write notes, so they cannot delete them.
--         prescriptions          doctor, admin (prescribing is doctor-only).
--         patient_vitals         doctor, nurse, admin.
--         patient_billing_items  doctor, nurse, admin.
--         patient_documents      doctor, nurse, admin.
--       front_desk is refused everywhere. It could hard-delete billing items
--       and documents under the existing "staff access" policies; allowing it
--       here would be a one-word change per table if the practice wants that.
--       A refusal raises SQLSTATE 42501 (insufficient_privilege). The iOS app
--       then keeps its local tombstone (the delete stays local, as before)
--       and stops retrying that id until the next sign-in or app launch.
--     * service_role (the API server) may call it too; the API server already
--       bypasses RLS, and this keeps one audited code path.
--     * Every successful soft delete writes one audit_log row
--       (action 'soft_delete') in the same transaction — no delete without an
--       audit row. If audit_log does not exist (see migrations/README.md: its
--       creating migration is still unwired), the delete proceeds without it.
--     * Idempotent: an already-deleted row returns 'already_deleted', a row
--       that no longer exists returns 'not_found'; neither is an error, so a
--       retried flush from an offline device is harmless.
--   There is deliberately no undelete function: restoring a record is an admin
--   action done in the SQL editor (set deleted_at and deleted_by to NULL).
--
-- Reads: SELECT policies are unchanged, so soft-deleted rows stay readable.
-- iOS needs to see them (to delete its local copy); the web dashboard and API
-- server filter them out with .is('deleted_at', null).
--
-- Nothing destructive. Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1 + 2. Columns and partial indexes ──────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'clinical_notes', 'prescriptions', 'patient_vitals',
    'patient_billing_items', 'patient_documents'
  ]
  loop
    if to_regclass(format('public.%I', t)) is null then
      raise notice 'soft delete: skipping %, table does not exist', t;
      continue;
    end if;

    execute format(
      'alter table public.%I add column if not exists deleted_at timestamptz', t);
    execute format(
      'alter table public.%I add column if not exists deleted_by uuid
         references auth.users(id) on delete set null', t);
    execute format(
      'create index if not exists %I on public.%I (patient_id) where deleted_at is null',
      'idx_' || t || '_live_patient', t);
  end loop;
end;
$$;

-- ── 3. soft_delete(table, id) ───────────────────────────────────────────────

create or replace function public.soft_delete(p_table text, p_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid  := auth.uid();
  v_claims     jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_is_service boolean;
  v_role       text;
  v_allowed    boolean;
  v_patient_id uuid;
  v_deleted_at timestamptz;
  v_created_by uuid;
  v_rows       integer;
begin
  v_is_service := coalesce(v_claims ->> 'role', '') = 'service_role';

  if p_table is null or p_table not in (
    'clinical_notes', 'prescriptions', 'patient_vitals',
    'patient_billing_items', 'patient_documents'
  ) then
    raise exception 'soft_delete: % is not a soft-deletable table', coalesce(p_table, 'NULL')
      using errcode = '22023';
  end if;
  if p_id is null then
    raise exception 'soft_delete: id is required' using errcode = '22023';
  end if;
  if to_regclass(format('public.%I', p_table)) is null then
    raise exception 'soft_delete: table % does not exist', p_table using errcode = '42P01';
  end if;

  -- Role gate (before touching the row).
  if not v_is_service then
    if v_uid is null then
      raise exception 'soft_delete: not signed in' using errcode = '42501';
    end if;
    v_role := public.auth_role();
    v_allowed := case p_table
      when 'clinical_notes'        then v_role in ('doctor', 'admin')
      when 'prescriptions'         then v_role in ('doctor', 'admin')
      when 'patient_vitals'        then v_role in ('doctor', 'nurse', 'admin')
      when 'patient_billing_items' then v_role in ('doctor', 'nurse', 'admin')
      when 'patient_documents'     then v_role in ('doctor', 'nurse', 'admin')
      else false
    end;
    if not coalesce(v_allowed, false) then
      raise exception 'soft_delete: role % may not delete from %', coalesce(v_role, 'none'), p_table
        using errcode = '42501';
    end if;
  end if;

  -- Lock the row and read what the checks and the audit row need.
  execute format(
    'select patient_id, deleted_at, %s from public.%I where id = $1 for update',
    case when p_table = 'clinical_notes' then 'created_by' else 'null::uuid' end,
    p_table)
    into v_patient_id, v_deleted_at, v_created_by
    using p_id;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return 'not_found';
  end if;

  -- Notes: a doctor may delete only their own note (or a legacy note with no author).
  if p_table = 'clinical_notes' and not v_is_service and v_role <> 'admin'
     and v_created_by is not null and v_created_by <> v_uid then
    raise exception 'soft_delete: only the author or an admin may delete this note'
      using errcode = '42501';
  end if;

  if v_deleted_at is not null then
    return 'already_deleted';
  end if;

  execute format(
    'update public.%I set deleted_at = now(), deleted_by = $2 where id = $1', p_table)
    using p_id, v_uid;

  if to_regclass('public.audit_log') is not null then
    insert into public.audit_log
      (user_id, user_email, action, resource_type, resource_id, patient_id, details)
    values (
      v_uid,
      v_claims ->> 'email',
      'soft_delete',
      p_table,
      p_id::text,
      v_patient_id,
      jsonb_build_object(
        'source', 'soft_delete_rpc',
        'role',   case when v_is_service then 'service_role' else v_role end
      )
    );
  end if;

  return 'deleted';
end;
$$;

comment on function public.soft_delete(text, uuid) is
  'Soft-deletes one row of clinical_notes, prescriptions, patient_vitals, patient_billing_items '
  'or patient_documents (sets deleted_at/deleted_by) with a per-table role check and an audit_log '
  'row. Returns deleted | already_deleted | not_found. See supabase-soft-delete-migration.sql.';

revoke all on function public.soft_delete(text, uuid) from public;
revoke all on function public.soft_delete(text, uuid) from anon;
grant execute on function public.soft_delete(text, uuid) to authenticated;
grant execute on function public.soft_delete(text, uuid) to service_role;
