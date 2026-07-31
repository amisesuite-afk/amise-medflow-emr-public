-- ── Slice L — Encounter lifecycle API ──────────────────────────────────────
-- ── Slice M — Clinical Notes API ───────────────────────────────────────────
-- ── Slice N — Patient Search / Demographics API ────────────────────────────
-- ── Slice O — Billing charge edit + void ───────────────────────────────────
-- All operations are idempotent.

-- ── 1. billing_charges: expand status to include 'void' ────────────────────
-- The existing CHECK only allows: pending, invoiced, paid, waived, disputed.
-- Slice O adds a void endpoint; we expand the constraint to include 'void'.

DO $$ BEGIN
  ALTER TABLE public.billing_charges
    DROP CONSTRAINT IF EXISTS billing_charges_status_check;

  ALTER TABLE public.billing_charges
    ADD CONSTRAINT billing_charges_status_check
    CHECK (status IN ('pending', 'invoiced', 'paid', 'waived', 'disputed', 'void'));
EXCEPTION WHEN duplicate_object THEN
  -- constraint already includes 'void' from a previous run
  NULL;
END $$;

-- Slices L, M, N use the existing tables:
--   encounters      (supabase-schema.sql)
--   clinical_notes  (supabase-clinical-records-migration.sql)
--   patients        (supabase-schema.sql)
-- No schema changes required for those slices.
