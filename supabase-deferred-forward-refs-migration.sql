-- Migration 90: deferred parts of earlier steps that referenced objects created later
--
-- A fresh run of run-migrations.yml failed at Migration 2 (patient portal):
-- its "patients_select_own_sessions" policy is on questionnaire_sessions, which
-- Migration 3 (supabase-apcq-migration.sql) creates. Production never hit this
-- because it already had questionnaire_sessions when Migration 2 was applied.
--
-- Migration 2 now skips that policy when the table is missing. This step
-- creates it once the table exists. It runs last so no applied step is
-- renumbered or reordered. On production the policy already exists, so this
-- is a no-op there.
--
-- Idempotent. No new table, grant or staff policy: this is a patient
-- own-row policy (Migration 89 deliberately leaves those alone).
--
-- Checked by: pnpm --filter @workspace/scripts run check:migrations-fresh

do $guard$ begin
  if to_regclass('public.questionnaire_sessions') is null
     or to_regprocedure('public.my_patient_id()') is null then
    raise notice 'questionnaire_sessions or my_patient_id() missing: patients_select_own_sessions not created';
    return;
  end if;
  create policy "patients_select_own_sessions" on public.questionnaire_sessions
    for select using (patient_id = my_patient_id());
exception when duplicate_object then null;
end $guard$;
