-- Migration: patients_quarter
-- Adds a `quarter` column to `patients` so the administrative quarter
-- (auto-derived from the "Community / Address" lookup in the front-desk
-- check-in form, via SL_COMMUNITIES) is persisted alongside the address,
-- not just shown transiently in the UI.
-- Run in Supabase SQL Editor against your production project.
-- 2026-06-14

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS quarter text;

COMMENT ON COLUMN patients.quarter IS
  'Saint Lucia administrative quarter, derived from the community entered at check-in (see SL_COMMUNITIES).';

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_name = 'patients' AND column_name = 'quarter') = 1,
    'Expected patients.quarter column to exist';
  RAISE NOTICE 'Migration patients_quarter: OK';
END;
$$;
