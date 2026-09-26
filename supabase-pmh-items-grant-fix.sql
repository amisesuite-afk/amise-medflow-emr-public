-- Fix: permission denied for table pmh_items
-- The supabase-missing-tables-migration.sql contains these grants but may not
-- have been applied. Run this standalone fix in the Supabase SQL Editor.

-- pmh_items is created by supabase-missing-tables-migration.sql, which is not
-- wired into the runner yet (see migrations/README.md), so it may not exist on
-- a fresh database. Skip with a notice then; production has the table.
DO $guard$ BEGIN
  IF to_regclass('public.pmh_items') IS NULL THEN
    RAISE NOTICE 'pmh_items missing: grant fix skipped';
    RETURN;
  END IF;

  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pmh_items TO authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pmh_items TO service_role;

  -- Ensure RLS is on and policy exists (idempotent)
  ALTER TABLE public.pmh_items ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pmh_items' AND policyname = 'staff access'
  ) THEN
    CREATE POLICY "staff access" ON public.pmh_items
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $guard$;
