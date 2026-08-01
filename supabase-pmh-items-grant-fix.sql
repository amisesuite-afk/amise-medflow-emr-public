-- Fix: permission denied for table pmh_items
-- The supabase-missing-tables-migration.sql contains these grants but may not
-- have been applied. Run this standalone fix in the Supabase SQL Editor.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pmh_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pmh_items TO service_role;

-- Ensure RLS is on and policy exists (idempotent)
ALTER TABLE public.pmh_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pmh_items' AND policyname = 'staff access'
  ) THEN
    CREATE POLICY "staff access" ON public.pmh_items
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
