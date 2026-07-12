-- Performance indexes migration
-- Created: 2026-06-28
-- Purpose: Add missing indexes for booking slot uniqueness, cron queries,
--          escalation lookups, audit log summaries, and patient email search.

-- Booking confirmation slot uniqueness (prevents double-booking)
CREATE UNIQUE INDEX IF NOT EXISTS idx_appt_slot_unique
  ON appointment_requests(confirmed_slot)
  WHERE status IN ('staff_confirmed', 'patient_confirmed');

-- Cron reminder query optimization
CREATE INDEX IF NOT EXISTS idx_appt_reminder_pending
  ON appointment_requests(confirmed_slot, status, reminder_sent_at)
  WHERE status = 'patient_confirmed' AND reminder_sent_at IS NULL;

-- Escalation query optimization
CREATE INDEX IF NOT EXISTS idx_appt_pending_created
  ON appointment_requests(created_at, status)
  WHERE status = 'pending';

-- Audit log daily summary
CREATE INDEX IF NOT EXISTS idx_audit_action_date
  ON audit_logs(action, created_at);

-- Patient email lookup
CREATE INDEX IF NOT EXISTS idx_patients_email_lower
  ON patients(lower(email))
  WHERE email IS NOT NULL;
