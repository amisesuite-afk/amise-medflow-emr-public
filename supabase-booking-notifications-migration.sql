-- Migration: booking_notifications
-- Adds columns for tracking patient acknowledgement, staff notification, and escalation state.
-- Run in Supabase SQL Editor against your production project.
-- 2026-06-02

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. New columns on appointment_requests
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE appointment_requests
  ADD COLUMN IF NOT EXISTS patient_ack_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS staff_notified_at    timestamptz,
  ADD COLUMN IF NOT EXISTS staff_escalated_at   timestamptz,
  ADD COLUMN IF NOT EXISTS prep_sms_sent        boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN appointment_requests.patient_ack_sent_at  IS 'Timestamp when the immediate patient acknowledgement SMS was sent';
COMMENT ON COLUMN appointment_requests.staff_notified_at    IS 'Timestamp when staff were first alerted of this booking';
COMMENT ON COLUMN appointment_requests.staff_escalated_at   IS 'Timestamp of last escalation SMS/email sent to staff or doctor';
COMMENT ON COLUMN appointment_requests.prep_sms_sent        IS 'True once procedure prep instructions have been sent to the patient';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Index to support the escalation cron query
--    (status='pending' AND created_at < 2h ago AND staff_escalated_at IS NULL)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_appt_requests_pending_created
  ON appointment_requests (status, created_at)
  WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Verify
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_name = 'appointment_requests'
            AND column_name IN ('patient_ack_sent_at','staff_notified_at','staff_escalated_at','prep_sms_sent')) = 4,
    'Expected 4 new columns on appointment_requests';
  RAISE NOTICE 'Migration booking_notifications: OK';
END;
$$;
