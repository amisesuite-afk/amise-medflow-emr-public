-- ═══════════════════════════════════════════════════════════════════════════
-- Amise MedFlow EMR — Consolidated pending migrations
-- Run once against the production Supabase project (SQL editor or psql).
-- Both statements are idempotent (IF NOT EXISTS / DO $$ guards).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Dual-confirmation booking gate ────────────────────────────────────
-- Adds doctor sign-off columns and expands the status CHECK constraint.

ALTER TABLE appointment_requests
  ADD COLUMN IF NOT EXISTS doctor_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS doctor_confirmed_by UUID REFERENCES auth.users(id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointment_requests_status_check'
  ) THEN
    ALTER TABLE appointment_requests DROP CONSTRAINT appointment_requests_status_check;
  END IF;
END $$;

ALTER TABLE appointment_requests
  ADD CONSTRAINT appointment_requests_status_check
  CHECK (status IN (
    'pending', 'waitlisted', 'staff_confirmed', 'staff_pending',
    'doctor_confirmed', 'patient_confirmed', 'lapsed', 'cancelled'
  ));

CREATE INDEX IF NOT EXISTS idx_appt_needs_doctor_signoff
  ON appointment_requests(status, created_at)
  WHERE status IN ('pending', 'staff_confirmed', 'waitlisted');

-- ── 2. Staff scheduling additions ────────────────────────────────────────
-- Adds source, patient_dob, result alert columns.

ALTER TABLE appointment_requests
  ADD COLUMN IF NOT EXISTS source               VARCHAR(20)   DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS patient_dob          DATE,
  ADD COLUMN IF NOT EXISTS result_alert_email   TEXT,
  ADD COLUMN IF NOT EXISTS result_alert_pending BOOLEAN       DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS result_alert_sent_at TIMESTAMPTZ;

UPDATE appointment_requests SET source = 'web' WHERE source IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_appt_source'
  ) THEN
    ALTER TABLE appointment_requests
      ADD CONSTRAINT chk_appt_source
      CHECK (source IN ('web', 'staff', 'whatsapp', 'phone', 'kiosk', 'referral'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appt_source
  ON appointment_requests(source);

CREATE INDEX IF NOT EXISTS idx_appt_lab_alert
  ON appointment_requests(result_alert_pending, result_alert_sent_at)
  WHERE result_alert_pending = TRUE;

-- ── 3. Encounter history schema (new table) ────────────────────────────
-- Ensures encounters table has outbound_referrals JSONB column for tracker.

ALTER TABLE encounters
  ADD COLUMN IF NOT EXISTS outbound_referrals JSONB DEFAULT '[]'::jsonb;

-- ── Grants (both migrations) ──────────────────────────────────────────────
GRANT ALL ON appointment_requests TO service_role;
GRANT ALL ON appointment_requests TO authenticated;
GRANT ALL ON encounters           TO service_role;
GRANT ALL ON encounters           TO authenticated;
