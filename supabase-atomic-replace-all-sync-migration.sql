-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: atomic replace-all RPCs for db.ts's "delete then insert" sync
-- functions
--
-- syncMedicationList, syncSurgicalHistory, syncToxicHabits, and
-- syncProcedureData (operative_notes) each did a plain DELETE followed by a
-- separate INSERT, as two independent postgrest calls / two independent
-- transactions. Two concurrent saves for the same patient/encounter (two
-- staff, or two tabs) could interleave: A deletes, B deletes (no-op), B
-- inserts its rows, A inserts its rows — leaving duplicates — or the reverse
-- ordering leaves one side's rows silently wiped by the other's DELETE after
-- it already inserted. This is worse than plain last-write-wins: it can
-- corrupt data rather than just overwrite it.
--
-- This wraps each pair in a single plpgsql function, so the DELETE+INSERT for
-- one call happens atomically as one transaction — a concurrent second call
-- can only run entirely before or entirely after, never interleaved. The
-- result is still whole-list last-write-wins (not field-level merged, and
-- not part of the optimistic-locking pilot on assessment/plan — that's a
-- separate, larger piece of work these functions were deliberately not
-- included in), but corruption is no longer possible.
--
-- Investigation_results was not included here — unlike the four above, its
-- write path (syncInvestigationOrders) already fetches existing rows and
-- inserts/deletes only the diff, not a wholesale replace, so it doesn't have
-- this race to begin with.
--
-- Run this once in the Supabase SQL editor (idempotent — safe to re-run).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function sync_medications_list(
  p_patient_id uuid,
  p_encounter_id uuid,
  p_rows jsonb
) returns void language plpgsql as $$
begin
  delete from medications
   where patient_id = p_patient_id
     and encounter_id = p_encounter_id
     and indication = 'consultation-list';

  insert into medications (patient_id, encounter_id, drug_name, status, indication, dose)
  select p_patient_id, p_encounter_id, r->>'drug_name', 'active', 'consultation-list', r->>'dose'
  from jsonb_array_elements(p_rows) as r;
end;
$$;

create or replace function sync_surgical_history(
  p_patient_id uuid,
  p_rows jsonb
) returns void language plpgsql as $$
begin
  delete from surgical_history where patient_id = p_patient_id;

  insert into surgical_history (patient_id, procedure_name, notes)
  select p_patient_id, r->>'procedure_name', r->>'notes'
  from jsonb_array_elements(p_rows) as r;
end;
$$;

create or replace function sync_toxic_habits(
  p_patient_id uuid,
  p_rows jsonb
) returns void language plpgsql as $$
begin
  delete from toxic_habits where patient_id = p_patient_id;

  insert into toxic_habits (patient_id, habit_type, status, details)
  select p_patient_id, 'other', 'current', r->>'details'
  from jsonb_array_elements(p_rows) as r;
end;
$$;

create or replace function sync_operative_notes(
  p_patient_id uuid,
  p_encounter_id uuid,
  p_rows jsonb
) returns void language plpgsql as $$
begin
  delete from operative_notes where encounter_id = p_encounter_id;

  insert into operative_notes (patient_id, encounter_id, procedure_name, findings, status)
  select p_patient_id, p_encounter_id, r->>'procedure_name', r->>'findings', 'draft'
  from jsonb_array_elements(p_rows) as r;
end;
$$;

grant execute on function sync_medications_list(uuid, uuid, jsonb)  to authenticated;
grant execute on function sync_surgical_history(uuid, jsonb)        to authenticated;
grant execute on function sync_toxic_habits(uuid, jsonb)            to authenticated;
grant execute on function sync_operative_notes(uuid, uuid, jsonb)   to authenticated;
grant execute on function sync_medications_list(uuid, uuid, jsonb)  to service_role;
grant execute on function sync_surgical_history(uuid, jsonb)        to service_role;
grant execute on function sync_toxic_habits(uuid, jsonb)            to service_role;
grant execute on function sync_operative_notes(uuid, uuid, jsonb)   to service_role;
