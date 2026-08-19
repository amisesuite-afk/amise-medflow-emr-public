-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: DB-trigger audit logging for dashboard-originated clinical writes
--
-- The dashboard (artifacts/dashboard/src/lib/db.ts) writes clinical data
-- directly to Supabase from the browser — it does not go through the
-- api-server, so it never goes through the api-server's audit helpers
-- (logAudit() / audit() in artifacts/api-server/src/lib/), which are the only
-- things currently writing to the canonical audit_log table. This was
-- confirmed by docs/AUDIT-TRAIL-COVERAGE.md itself: every clinical autosave
-- from the dashboard — assessment, plan, medications, vitals, allergies,
-- exam findings, and more — has zero audit trail today.
--
-- This adds a generic, reusable trigger (following the same pattern already
-- used by set_updated_at() elsewhere in this schema — a single trigger
-- function attached to many tables via a DO-loop) that captures every
-- INSERT/UPDATE/DELETE on the clinical tables db.ts writes to, regardless of
-- which code path performed the write. This is deliberately a comprehensive
-- backstop, not a replacement for the more semantically-rich client-side
-- logClinicalSave()/logPaneSession() calls (fixed separately in this same
-- change to point at the correct table — they were writing to the dead
-- `audit_logs`, plural, table) — those carry action labels and summaries a
-- raw row-level trigger can't infer; this trigger exists specifically to
-- cover the majority of db.ts's ~20 write functions that have no client-side
-- audit call at all.
--
-- Scope: the 16 tables db.ts actually writes clinical data to. Deliberately
-- excludes scheduling/intake tables (appointment_requests,
-- questionnaire_sessions, questionnaire_responses, intake_summaries) and
-- user_profiles — those are a separate, already-tracked gap (the 19
-- administrative/scheduling route files noted in AUDIT-TRAIL-COVERAGE.md),
-- not the clinical-documentation concern this migration addresses.
--
-- Known tradeoff, accepted deliberately: this logs full old/new row state
-- via to_jsonb(), including on every autosave-debounced UPDATE (not just a
-- final save) — an audit trail that only stores summaries is not much of an
-- audit trail. The UPDATE trigger's WHEN (OLD IS DISTINCT FROM NEW) guard
-- at least skips true no-op writes. If audit_log's growth becomes a real
-- storage concern at higher patient volume, that's a follow-up tuning pass
-- (e.g. excluding large narrative-text columns from the captured diff), not
-- a reason to leave clinical writes unaudited today.
--
-- migrations/README.md documents that both audit_log's and patient_problems'
-- creating migrations are excluded from run-migrations.yml on purpose —
-- each has an unresolved conflicting-duplicate-schema pair pending a human
-- decision (see that file's table). Live evidence (existing audit() calls
-- succeeding in production) makes it near-certain audit_log already exists,
-- but this migration doesn't assume any of its 16 target tables are actually
-- present — the loop below checks to_regclass() first and skips (with a
-- notice, not a failure) whichever ones aren't, so this can't be the thing
-- that blocks the migration run over a table wiring gap unrelated to this
-- change.
--
-- Run this once in the Supabase SQL editor (idempotent — safe to re-run).
-- ─────────────────────────────────────────────────────────────────────────────

-- Hard-fail loudly if audit_log itself is missing — this is only a
-- best-effort early signal (see below for the mechanism that actually
-- prevents damage): the runner submitting this file may or may not execute
-- it as a single atomic transaction, so a RAISE EXCEPTION in this first
-- block is not trusted on its own to stop the later CREATE TRIGGER loop.
do $$
begin
  if to_regclass('public.audit_log') is null then
    raise exception 'audit_log table does not exist — see migrations/README.md''s audit_log row (its creating migration is excluded from run-migrations.yml pending a schema-conflict resolution). Resolve that first; this migration must not attach triggers that assume audit_log is present.';
  end if;
end;
$$;

create or replace function log_audit_row()
returns trigger language plpgsql as $$
declare
  v_resource_id text;
  v_details     jsonb;
begin
  if TG_OP = 'DELETE' then
    v_resource_id := OLD.id::text;
    v_details     := jsonb_build_object('old', to_jsonb(OLD));
  elsif TG_OP = 'INSERT' then
    v_resource_id := NEW.id::text;
    v_details     := jsonb_build_object('new', to_jsonb(NEW));
  else
    v_resource_id := NEW.id::text;
    v_details     := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  end if;

  insert into audit_log (user_id, action, resource_type, resource_id, details, mode)
  values (auth.uid(), lower(TG_OP), TG_TABLE_NAME, v_resource_id, v_details, 'db_trigger');

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

-- The actual safety mechanism: re-checked here, immediately before each
-- CREATE TRIGGER, independent of whatever happened above. This is what
-- guarantees no trigger gets attached while audit_log is absent, regardless
-- of the runner's statement-batching/transaction behavior.
do $$
declare
  t text;
begin
  if to_regclass('public.audit_log') is null then
    raise notice 'audit_log missing — skipping all trigger attachment';
    return;
  end if;

  foreach t in array array[
    'patients', 'encounters', 'vitals', 'symptoms', 'medications', 'allergies',
    'assessments', 'plans', 'clinical_notes', 'investigation_results',
    'ros_findings', 'trauma_records', 'surgical_history', 'toxic_habits',
    'operative_notes', 'patient_problems'
  ]
  loop
    if to_regclass(format('public.%I', t)) is null then
      raise notice 'skipping %: table does not exist yet', t;
      continue;
    end if;

    execute format('drop trigger if exists audit_log_insert_delete on %I', t);
    execute format('drop trigger if exists audit_log_update on %I', t);

    execute format(
      'create trigger audit_log_insert_delete
         after insert or delete on %I
         for each row execute function log_audit_row()',
      t
    );
    execute format(
      'create trigger audit_log_update
         after update on %I
         for each row when (old is distinct from new)
         execute function log_audit_row()',
      t
    );
  end loop;
end;
$$;
