-- Migration 91: vitals.avpu + vitals.on_supplemental_o2 (web dashboard NEWS2 fields)
--
-- RCP NEWS2 (2017) needs consciousness (ACVPU) and air/supplemental oxygen alongside the five
-- numeric observations. The web dashboard's `vitals` table (base schema, encounter-linked) had
-- no column for either, so every NEWS2 the dashboard showed was flagged incomplete
-- ("ACVPU, Air/O₂ not recorded"). The iOS app's `patient_vitals` table already has both
-- (supabase-patient-vitals-migration.sql), and this migration uses the same names and the same
-- ACVPU CHECK so the two tables read alike:
--
--   avpu                text     CHECK (avpu IN ('A','C','V','P','U'))   -- nullable
--   on_supplemental_o2  boolean                                          -- nullable
--
-- Both are NULLABLE here, unlike patient_vitals.on_supplemental_o2 (NOT NULL DEFAULT false):
-- NULL means "not recorded", which the NEWS2 engine scores 0 and lists as missing. Defaulting
-- existing rows to "room air" would silently mark historical scores complete and could
-- under-score a patient who was on oxygen (hazard log H-04).
--
-- Existing table: no new grants or RLS policies. The existing `vitals` grants (authenticated
-- in the base schema, service_role in supabase-service-role-grants-fix-migration.sql) and its
-- policies (narrowed by Migration 89) already cover new columns.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, the CHECK is added only when a constraint of that name
-- is missing, and the whole step is skipped with a notice if public.vitals does not exist.
--
-- The dashboard writes these columns and falls back to a write without them (42703 /
-- PGRST204) until this migration is applied, so running it is safe in any order relative to
-- the dashboard deploy.

do $$
begin
  if to_regclass('public.vitals') is null then
    raise notice 'web vitals news2 fields: skipping, public.vitals does not exist';
    return;
  end if;

  alter table public.vitals
    add column if not exists avpu text;

  alter table public.vitals
    add column if not exists on_supplemental_o2 boolean;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vitals'::regclass
      and conname = 'vitals_avpu_check'
  ) then
    alter table public.vitals
      add constraint vitals_avpu_check check (avpu in ('A', 'C', 'V', 'P', 'U'));
  end if;

  comment on column public.vitals.avpu is
    'NEWS2 consciousness, ACVPU (RCP 2017): A, C (new confusion), V, P or U. NULL = not recorded. Same name and values as patient_vitals.avpu.';
  comment on column public.vitals.on_supplemental_o2 is
    'NEWS2 air or oxygen (RCP 2017): true = supplemental oxygen, false = room air, NULL = not recorded. Same name as patient_vitals.on_supplemental_o2.';
end
$$;
