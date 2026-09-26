-- ============================================================================
-- Migration 94 — real-outcomes loop: prediction snapshots + final diagnoses
-- docs/clinical-validation/changes/outcomes-calibration.md
--
-- WHY
--   The practice owner approved measuring the engines' accuracy on the practice's own patients:
--   what the engines predicted when an encounter was completed, against the final diagnosis
--   confirmed later (histology, operative findings, discharge summary, follow-up). Model changes
--   are then PROPOSED from these data and applied only with the surgeon's sign-off
--   (docs/CLINICAL-CONTENT-UPGRADES.md §4.6). Nothing here changes an engine.
--
-- WHAT
--   public.prediction_snapshots  one row per completed encounter (first completion wins,
--                                unique encounter_ref). Coded data only: disease ids, ICD-10
--                                codes, probabilities, triage level, score values, decision-layer
--                                bands and model versions. No free text.
--   public.diagnosis_outcomes    the clinician-confirmed final diagnosis for an encounter
--                                (ICD-10 + PANE id where mappable), its source type and date.
--                                Immutable once written: a correction retracts the row and a new
--                                row is confirmed (trigger below). At most one confirmed row per
--                                encounter.
--
-- ACCESS (Migration 89 role model)
--   nurse, doctor, admin: read both; insert both; update diagnosis_outcomes (retract only).
--   front_desk and portal patients: no access (no policy matches them).
--   No DELETE for authenticated (retention: surgeon decision, SURGEON-DECISIONS.md I2).
--   service_role (API server): full table grants; it inserts web snapshots at
--   POST /api/visit/complete and builds the admin-only, audit-logged research export.
--
-- CLIENTS TOLERATE ITS ABSENCE
--   Until this runs on production, the API skips the snapshot (the encounter still closes), the
--   dashboard shows "available after the database update", and iOS keeps its records on the
--   device (sync-ready). Nothing returns a 500 because these tables are missing.
--
-- Idempotent: IF NOT EXISTS everywhere, policies and the trigger inside do $guard$ blocks,
-- constraints added only when missing. Independent of 87–93.
-- ============================================================================

create table if not exists public.prediction_snapshots (
  id                          uuid        primary key default gen_random_uuid(),
  patient_id                  uuid        not null references public.patients(id) on delete cascade,
  -- Web encounters are rows in public.encounters; iOS encounters are local (Encounter.syncCode).
  encounter_id                uuid        references public.encounters(id) on delete set null,
  -- 'web:<encounters.id>' or 'ios:<Encounter.syncCode>'. Stable key; first completion wins.
  encounter_ref               text        not null,
  platform                    text        not null,
  completed_at                timestamptz not null,
  snapshot_version            smallint    not null default 1,
  -- 'pane' (web PANE engine) or 'ios-bayes' (iOS DiagnosticDatabase engine).
  differential_engine         text        not null,
  differential_model_version  text        not null,
  -- Every content / rule version stamp in force: {"pane": "1.0.1", "rules": "1.4.0", ...}.
  model_versions              jsonb       not null default '{}'::jsonb,
  -- [{rank, diseaseId, icd10, probability}] (coded only, at most 10).
  top_differential            jsonb       not null default '[]'::jsonb,
  -- Raw level of the platform's triage scale, and which scale it is.
  triage_level                text,
  triage_scale                text,
  -- [{key, value, source}] — score values only.
  scores                      jsonb       not null default '[]'::jsonb,
  -- [{decisionId, optionId, kind, band, probability}] — decision-layer bands.
  decision_bands              jsonb       not null default '[]'::jsonb,
  -- Feature ids the engine used ({"rlq_pain": true, ...}), for likelihood proposals.
  features                    jsonb       not null default '{}'::jsonb,
  working_disease_id          text,
  working_icd10               text,
  recorded_icd10              text[]      not null default '{}'::text[],
  -- Whether a final diagnosis is expected later (an operation or pathology), and why.
  expects_outcome             boolean     not null default false,
  outcome_triggers            text[]      not null default '{}'::text[],
  created_by                  uuid,
  created_at                  timestamptz not null default now()
);

create table if not exists public.diagnosis_outcomes (
  id                  uuid        primary key default gen_random_uuid(),
  patient_id          uuid        not null references public.patients(id) on delete cascade,
  encounter_id        uuid        references public.encounters(id) on delete set null,
  encounter_ref       text        not null,
  -- Idempotency key from the client ('ios:<syncCode>' or a web UUID), so a retried push or a
  -- double tap cannot create two rows.
  client_ref          text,
  final_icd10         text        not null,
  final_disease_id    text,
  source_type         text        not null,
  source_date         date        not null,
  -- What was actually done for each decision-layer option in the snapshot:
  -- [{optionId, done}] — for decision-band agreement.
  actions_taken       jsonb       not null default '[]'::jsonb,
  -- The clinician's retrospective judgement of the urgency the case needed (triage reference).
  retrospective_acuity text,
  status              text        not null default 'confirmed',
  confirmed_by        uuid,
  confirmed_at        timestamptz not null default now(),
  retracted_by        uuid,
  retracted_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── CHECK constraints (added only when missing, so a re-run is a no-op) ────────────────────
do $c$
begin
  if not exists (select 1 from pg_constraint where conname = 'prediction_snapshots_platform_check') then
    alter table public.prediction_snapshots add constraint prediction_snapshots_platform_check
      check (platform in ('web', 'ios'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prediction_snapshots_ref_check') then
    alter table public.prediction_snapshots add constraint prediction_snapshots_ref_check
      check (encounter_ref ~ '^(web|ios):[A-Za-z0-9-]{1,64}$' and split_part(encounter_ref, ':', 1) = platform);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prediction_snapshots_engine_check') then
    alter table public.prediction_snapshots add constraint prediction_snapshots_engine_check
      check (differential_engine in ('pane', 'ios-bayes')
             and length(differential_model_version) between 1 and 32
             and snapshot_version >= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prediction_snapshots_json_check') then
    alter table public.prediction_snapshots add constraint prediction_snapshots_json_check
      check (jsonb_typeof(model_versions) = 'object'
             and jsonb_typeof(top_differential) = 'array' and jsonb_array_length(top_differential) <= 10
             and jsonb_typeof(scores) = 'array' and jsonb_array_length(scores) <= 60
             and jsonb_typeof(decision_bands) = 'array' and jsonb_array_length(decision_bands) <= 60
             and jsonb_typeof(features) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prediction_snapshots_triage_check') then
    alter table public.prediction_snapshots add constraint prediction_snapshots_triage_check
      check ((triage_level is null and triage_scale is null)
             or (triage_scale = 'web-adaptive' and triage_level in ('urgent', 'priority', 'review', 'routine'))
             or (triage_scale = 'ios-acuity' and triage_level in ('emergency', 'urgent', 'priority', 'routine')));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prediction_snapshots_codes_check') then
    alter table public.prediction_snapshots add constraint prediction_snapshots_codes_check
      check ((working_icd10 is null or working_icd10 ~ '^[A-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$')
             and (working_disease_id is null or working_disease_id ~ '^[a-z0-9_]{1,80}$')
             and cardinality(recorded_icd10) <= 20
             and outcome_triggers <@ array['operation', 'pathology']::text[]);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'diagnosis_outcomes_ref_check') then
    alter table public.diagnosis_outcomes add constraint diagnosis_outcomes_ref_check
      check (encounter_ref ~ '^(web|ios):[A-Za-z0-9-]{1,64}$'
             and (client_ref is null or client_ref ~ '^[A-Za-z0-9:-]{1,80}$'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'diagnosis_outcomes_codes_check') then
    alter table public.diagnosis_outcomes add constraint diagnosis_outcomes_codes_check
      check (final_icd10 ~ '^[A-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$'
             and (final_disease_id is null or final_disease_id ~ '^[a-z0-9_]{1,80}$'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'diagnosis_outcomes_source_check') then
    alter table public.diagnosis_outcomes add constraint diagnosis_outcomes_source_check
      check (source_type in ('histology', 'report_import', 'operative_findings', 'operative_note',
                             'discharge_summary', 'follow_up', 'other')
             and source_date >= date '2000-01-01');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'diagnosis_outcomes_status_check') then
    alter table public.diagnosis_outcomes add constraint diagnosis_outcomes_status_check
      check (status in ('confirmed', 'retracted')
             and ((status = 'retracted') = (retracted_at is not null)));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'diagnosis_outcomes_json_check') then
    alter table public.diagnosis_outcomes add constraint diagnosis_outcomes_json_check
      check (jsonb_typeof(actions_taken) = 'array' and jsonb_array_length(actions_taken) <= 60
             and (retrospective_acuity is null
                  or retrospective_acuity in ('emergency', 'urgent', 'soon', 'routine')));
  end if;
end
$c$;

-- ── Indexes ─────────────────────────────────────────────────────────────────────────────────
create unique index if not exists prediction_snapshots_encounter_ref_key
  on public.prediction_snapshots (encounter_ref);
create index if not exists prediction_snapshots_patient_idx
  on public.prediction_snapshots (patient_id, completed_at desc);
create index if not exists prediction_snapshots_due_idx
  on public.prediction_snapshots (completed_at) where expects_outcome;

create unique index if not exists diagnosis_outcomes_client_ref_key
  on public.diagnosis_outcomes (client_ref) where client_ref is not null;
-- At most one confirmed final diagnosis per encounter; retracted rows stay for the audit trail.
create unique index if not exists diagnosis_outcomes_one_confirmed_key
  on public.diagnosis_outcomes (encounter_ref) where status = 'confirmed';
create index if not exists diagnosis_outcomes_patient_idx
  on public.diagnosis_outcomes (patient_id);

-- ── diagnosis_outcomes are immutable except for retraction ──────────────────────────────────
-- A correction is "retract, then confirm a new row", so what was recorded, by whom and when is
-- never overwritten. Applies to every caller, the service role included.
create or replace function public.enforce_diagnosis_outcome_update()
returns trigger
language plpgsql
as $fn$
begin
  if new.patient_id is distinct from old.patient_id
     or new.encounter_id is distinct from old.encounter_id
     or new.encounter_ref is distinct from old.encounter_ref
     or new.client_ref is distinct from old.client_ref
     or new.final_icd10 is distinct from old.final_icd10
     or new.final_disease_id is distinct from old.final_disease_id
     or new.source_type is distinct from old.source_type
     or new.source_date is distinct from old.source_date
     or new.actions_taken is distinct from old.actions_taken
     or new.retrospective_acuity is distinct from old.retrospective_acuity
     or new.confirmed_by is distinct from old.confirmed_by
     or new.confirmed_at is distinct from old.confirmed_at
     or new.created_at is distinct from old.created_at then
    raise exception 'diagnosis_outcomes rows are immutable: retract this row and record a new one'
      using errcode = '42501';
  end if;
  if old.status = 'retracted' and new.status <> 'retracted' then
    raise exception 'a retracted final diagnosis cannot be confirmed again: record a new one'
      using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end
$fn$;

do $guard$ begin
  create trigger diagnosis_outcomes_immutable
    before update on public.diagnosis_outcomes
    for each row execute function public.enforce_diagnosis_outcome_update();
exception when duplicate_object then null;
end $guard$;

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
alter table public.prediction_snapshots enable row level security;
alter table public.diagnosis_outcomes enable row level security;

do $guard$ begin
  create policy "clinicians_select_prediction_snapshots" on public.prediction_snapshots
    for select to authenticated
    using ((select public.auth_role()) in ('nurse', 'doctor', 'admin'));
exception when duplicate_object then null;
end $guard$;

do $guard$ begin
  create policy "clinicians_insert_prediction_snapshots" on public.prediction_snapshots
    for insert to authenticated
    with check ((select public.auth_role()) in ('nurse', 'doctor', 'admin'));
exception when duplicate_object then null;
end $guard$;

do $guard$ begin
  create policy "clinicians_select_diagnosis_outcomes" on public.diagnosis_outcomes
    for select to authenticated
    using ((select public.auth_role()) in ('nurse', 'doctor', 'admin'));
exception when duplicate_object then null;
end $guard$;

do $guard$ begin
  create policy "clinicians_insert_diagnosis_outcomes" on public.diagnosis_outcomes
    for insert to authenticated
    with check ((select public.auth_role()) in ('nurse', 'doctor', 'admin'));
exception when duplicate_object then null;
end $guard$;

do $guard$ begin
  create policy "clinicians_update_diagnosis_outcomes" on public.diagnosis_outcomes
    for update to authenticated
    using ((select public.auth_role()) in ('nurse', 'doctor', 'admin'))
    with check ((select public.auth_role()) in ('nurse', 'doctor', 'admin'));
exception when duplicate_object then null;
end $guard$;

-- ── Grants ──────────────────────────────────────────────────────────────────────────────────
-- Snapshots are write-once for clients (no UPDATE/DELETE); outcomes are retract-only (no
-- DELETE). The service role (API server) needs every privilege: its GRANT is checked before RLS.
grant select, insert on table public.prediction_snapshots to authenticated;
grant select, insert, update, delete on table public.prediction_snapshots to service_role;
grant select, insert, update on table public.diagnosis_outcomes to authenticated;
grant select, insert, update, delete on table public.diagnosis_outcomes to service_role;
