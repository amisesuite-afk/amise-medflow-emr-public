-- ── Dual-confirmation booking gate ────────────────────────────────────────────
-- Adds doctor_confirmed status and doctor_confirmed_at timestamp so doctors
-- can formally sign off on bookings after front-desk confirms the slot.
-- This implements the two-tick gate: front-desk → staff_confirmed, doctor → doctor_confirmed.
-- Run once against the production Supabase project.

-- Add doctor sign-off timestamp column
ALTER TABLE appointment_requests
  ADD COLUMN IF NOT EXISTS doctor_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS doctor_confirmed_by UUID REFERENCES auth.users(id);

-- Update any existing status CHECK constraint to include new statuses.
-- Drop and recreate if it exists (adjust constraint name if different in your schema).
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

-- Index for the scheduling reminder panel query
CREATE INDEX IF NOT EXISTS idx_appt_needs_doctor_signoff
  ON appointment_requests(status, created_at)
  WHERE status IN ('pending', 'staff_confirmed', 'waitlisted');

-- Grant service_role access (API server connects as service_role)
GRANT ALL ON appointment_requests TO service_role;
GRANT ALL ON appointment_requests TO authenticated;
