-- Migration: results_inbox_fix
-- 1. Add acknowledged_at / action_taken columns to investigation_results and imaging_orders
-- 2. Add real lab / imaging senders to referring_providers so the email-documents cron
--    automatically picks up results from amisesuite@gmail.com
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

-- ── referring_providers: add confirmed lab / imaging / radiology senders ──────
-- Idempotent: only inserts if no active provider with the same email exists.
-- These email addresses are confirmed from actual received lab reports.

INSERT INTO referring_providers (name, email, provider_type, default_document_type, notes, active)
SELECT v.name, v.email, v.ptype, v.dtype, v.notes, true
FROM (VALUES
  -- SLU Lab Services — haematology, biochemistry, histopathology (Dr. Stephen King)
  -- Confirmed email from received lab reports (FBC + renal panel + path reports)
  ('Laboratory Services and Consultations Ltd',
    'emailius@slulabservices.com',
    'lab', 'lab_report',
    'Main reference lab. Tapion Hospital + Rodney Bay Medical Centre. Histopathology signed by Dr. Stephen J. King F.R.C.P.(C).',
    true),

  -- Tapion Hospital Radiology — XR, CT, MRI reports
  -- Confirmed email from Petra Peter XR report (tapion@candw.lc)
  ('Tapion Hospital Radiology',
    'tapion@candw.lc',
    'radiology', 'imaging_report',
    'XR, CT, MRI reports from Tapion Hospital (Medical Associates Ltd). Dr. Rosande Scott and colleagues.',
    true),

  -- Medical Imaging Inc. — CT/MRI reports (Castries + Vieux Fort)
  -- Email not yet confirmed from documents — update via admin UI once known
  ('Medical Imaging Inc.',
    NULL,
    'radiology', 'imaging_report',
    'CT/MRI reports. 4 Manoel St Castries Tel: (758) 452 1696. Email not yet confirmed — update via Settings → Referring Providers.',
    true)

) AS v(name, email, ptype, dtype, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM referring_providers rp
  WHERE (v.email IS NOT NULL AND rp.email = v.email)
     OR (v.email IS NULL    AND rp.name  = v.name AND rp.active = true)
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

  ASSERT EXISTS (
    SELECT 1 FROM referring_providers
    WHERE email = 'emailius@slulabservices.com' AND active = true
  ), 'SLU Lab Services provider missing';

  ASSERT EXISTS (
    SELECT 1 FROM referring_providers
    WHERE email = 'tapion@candw.lc' AND active = true
  ), 'Tapion Hospital Radiology provider missing';

  RAISE NOTICE 'Migration results_inbox_fix: OK';
END;
$$;
