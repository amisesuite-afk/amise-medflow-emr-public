-- Migration 77: prescriptions — add iOS flat-column schema alongside existing web jsonb schema
-- The prescriptions table was created by migration 31 with a jsonb 'items' approach for the
-- web dashboard. Migration 68 attempted CREATE TABLE IF NOT EXISTS with individual drug/dose/…
-- columns but silently no-oped because the table already existed. This migration adds the
-- missing flat columns that iOS SyncService pushes and pulls.
-- All statements are idempotent (ADD COLUMN IF NOT EXISTS).

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS drug           TEXT,
  ADD COLUMN IF NOT EXISTS dose           TEXT,
  ADD COLUMN IF NOT EXISTS route          TEXT,
  ADD COLUMN IF NOT EXISTS frequency      TEXT,
  ADD COLUMN IF NOT EXISTS duration       TEXT,
  ADD COLUMN IF NOT EXISTS indication     TEXT,
  ADD COLUMN IF NOT EXISTS instructions   TEXT,
  ADD COLUMN IF NOT EXISTS prescribed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Back-fill drug from the first item in the jsonb 'items' array for rows that
-- pre-date this migration (web-created prescriptions). Leaves drug NULL for any
-- row whose items array is empty or missing — acceptable since NOT NULL is not
-- being enforced retroactively here.
UPDATE public.prescriptions
   SET drug = items->0->>'name'
 WHERE drug IS NULL
   AND jsonb_array_length(items) > 0;
