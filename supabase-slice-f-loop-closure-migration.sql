-- ============================================================
-- Slice F — Loop Closure
-- 2026-07-30
-- Adds patient notification tracking to results tables.
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- ── 1. PATIENT NOTIFICATION — investigation_results ───────────────────────────
ALTER TABLE investigation_results
  ADD COLUMN IF NOT EXISTS patient_notified_at   timestamptz,
  ADD COLUMN IF NOT EXISTS patient_notified_by   text,
  ADD COLUMN IF NOT EXISTS notification_method   text;

-- ── 2. PATIENT NOTIFICATION — imaging_orders ────────────────────────────────
ALTER TABLE imaging_orders
  ADD COLUMN IF NOT EXISTS patient_notified_at   timestamptz,
  ADD COLUMN IF NOT EXISTS patient_notified_by   text,
  ADD COLUMN IF NOT EXISTS notification_method   text;

-- ── 3. INDEXES ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS inv_results_notified_idx
  ON investigation_results(patient_notified_at)
  WHERE patient_notified_at IS NULL;

CREATE INDEX IF NOT EXISTS imaging_orders_notified_idx
  ON imaging_orders(patient_notified_at)
  WHERE patient_notified_at IS NULL;
