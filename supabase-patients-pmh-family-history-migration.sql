-- ============================================================
-- Migration 70: patients — pmh_notes + family_history_notes columns
-- The iOS EMR already reads/writes these fields via SyncService.
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- 2026-08-24
-- ============================================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS pmh_notes            text,
  ADD COLUMN IF NOT EXISTS family_history_notes text;

COMMENT ON COLUMN public.patients.pmh_notes            IS 'Past medical history — free text, entered via iOS EMR or web dashboard';
COMMENT ON COLUMN public.patients.family_history_notes IS 'Family history — free text, entered via iOS EMR or web dashboard';

-- Grants (service_role required — api-server connects as service_role)
GRANT ALL ON TABLE public.patients TO authenticated;
GRANT ALL ON TABLE public.patients TO service_role;

-- Verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'pmh_notes'
  ) THEN
    RAISE EXCEPTION 'Column pmh_notes not found on patients';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'family_history_notes'
  ) THEN
    RAISE EXCEPTION 'Column family_history_notes not found on patients';
  END IF;

  RAISE NOTICE '✓ patients.pmh_notes and patients.family_history_notes present';
END;
$$;
