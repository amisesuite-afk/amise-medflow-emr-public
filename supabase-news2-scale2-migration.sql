-- Migration 88: patients.news2_spo2_scale2 (iOS NEWS2 SpO2 Scale 2 opt-in)
--
-- RCP NEWS2 (2017): SpO2 Scale 2 is used ONLY for a patient with confirmed hypercapnic
-- respiratory failure, on a clinician's decision. The iOS app stores that decision per patient
-- (Patient.news2UseSpO2Scale2). It already travels over peer sync and NAS backup; this column
-- lets it sync through Supabase too, so an iPhone and iPad that only meet through the cloud
-- score NEWS2 on the same scale.
--
-- NOT NULL DEFAULT false: every existing and new patient is on Scale 1 unless a clinician opts
-- in. On PostgreSQL 11+ adding a column with a constant default does not rewrite the table.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, and skipped with a notice if public.patients does not
-- exist. No new table, so the existing patients grants (authenticated + service_role) and RLS
-- policies already cover the column. The web dashboard does not read or write it.
--
-- iOS builds from before this column select without it, and newer builds fall back to the old
-- select until this migration is applied (SyncService+NEWS2Scale2.swift), so running it is safe
-- in any order relative to app releases.

do $$
begin
  if to_regclass('public.patients') is null then
    raise notice 'news2 scale 2: skipping, public.patients does not exist';
    return;
  end if;

  alter table public.patients
    add column if not exists news2_spo2_scale2 boolean not null default false;

  comment on column public.patients.news2_spo2_scale2 is
    'NEWS2 SpO2 Scale 2 opt-in (RCP 2017): true only for confirmed hypercapnic respiratory failure, set by a clinician in the iOS app. Default false = Scale 1.';
end
$$;
