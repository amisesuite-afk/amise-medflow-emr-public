-- Migration 78: prescriptions — re-apply flat-column additions without the backfill UPDATE
-- Migration 77 likely rolled back because the UPDATE referenced an 'items' column that
-- does not exist on this database's prescriptions table. This migration adds only the
-- flat columns (all idempotent: ADD COLUMN IF NOT EXISTS) with no backfill, which is
-- safe since iOS-created rows will always write drug/dose/etc. directly.

ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS drug          TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS dose          TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS route         TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS frequency     TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS duration      TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS indication    TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS instructions  TEXT;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS prescribed_at TIMESTAMPTZ DEFAULT NOW();
