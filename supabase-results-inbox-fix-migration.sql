-- Migration: results_inbox_fix
-- 1. Add acknowledged_at / action_taken columns to investigation_results and imaging_orders
--    (the Results Inbox UI writes these fields but they were missing from the schema).
-- 2. Add Tapion Pathology (Dr. Stephen King) and other common lab senders to
--    referring_providers so their emails are picked up by the email-documents cron.
-- Run in Supabase SQL Editor.
-- 2026-07-27

-- ── investigation_results: add missing ack columns ────────────────────────────

ALTER TABLE public.investigation_results
  ADD COLUMN IF NOT EXISTS acknowledged_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_by  TEXT,
  ADD COLUMN IF NOT EXISTS action_taken     TEXT;

-- ── imaging_orders: add missing ack columns ───────────────────────────────────

ALTER TABLE public.imaging_orders
  ADD COLUMN IF NOT EXISTS acknowledged_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_by  TEXT,
  ADD COLUMN IF NOT EXISTS action_taken     TEXT;

-- ── Add common lab / pathology / imaging senders to referring_providers ───────
-- Email addresses marked PLACEHOLDER must be updated in the admin UI
-- (Settings → Referring Providers) once the correct address is confirmed.
-- Idempotent: skips if a provider with the same email already exists.

INSERT INTO referring_providers (name, email, provider_type, default_document_type, notes, active)
SELECT v.name, v.email, v.ptype, v.dtype, v.notes, true
FROM (VALUES
  -- Tapion Hospital Pathology — Dr. Stephen King
  -- UPDATE email to confirmed address once known (check email headers from amisesuite@gmail.com)
  ('Tapion Pathology (Dr. Stephen King)',  NULL,                                 'lab',       'lab_report',     'Histopathology reports from Tapion Hospital. Email address not yet confirmed — set via admin UI.', true),

  -- Saint Lucia Radiology / imaging centres
  ('SL Radiology',                        NULL,                                 'radiology', 'imaging_report', 'Set email via admin UI once confirmed.',   true),

  -- Add more providers here following the same pattern
  -- ('Lab Name',  'lab@example.com',  'lab', 'lab_report', NULL, true),
  NULL, NULL, NULL, NULL, NULL, NULL   -- dummy row to satisfy VALUES syntax; filtered below
) AS v(name, email, ptype, dtype, notes, _dummy)
WHERE v.name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM referring_providers rp
    WHERE (v.email IS NOT NULL AND rp.email = v.email)
       OR (v.email IS NULL    AND rp.name  = v.name)
  );

-- ── Verification ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'investigation_results'
      AND column_name = 'acknowledged_at'
  ), 'investigation_results.acknowledged_at column missing';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'imaging_orders'
      AND column_name = 'acknowledged_at'
  ), 'imaging_orders.acknowledged_at column missing';

  RAISE NOTICE 'Migration results_inbox_fix: OK';
END;
$$;
