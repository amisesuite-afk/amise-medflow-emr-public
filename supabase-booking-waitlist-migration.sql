-- Migration: booking_waitlist
-- Adds a 'waitlisted' status to appointment_requests for the unified intake
-- queue — staff use it to park requests that can't be slotted immediately
-- (e.g. fully-booked procedure lists) without losing them in "pending".
-- Run in Supabase SQL Editor against your production project.
-- 2026-06-08

ALTER TABLE appointment_requests
  DROP CONSTRAINT IF EXISTS appointment_requests_status_check,
  ADD CONSTRAINT appointment_requests_status_check
    CHECK (status IN ('pending','staff_confirmed','patient_confirmed','waitlisted','lapsed','cancelled'));

COMMENT ON COLUMN appointment_requests.status IS
  'pending | staff_confirmed | patient_confirmed | waitlisted (no slot available yet — staff to revisit) | lapsed | cancelled';

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.check_constraints
          WHERE constraint_name = 'appointment_requests_status_check'
            AND check_clause LIKE '%waitlisted%') = 1,
    'Expected appointment_requests_status_check to allow ''waitlisted''';
  RAISE NOTICE 'Migration booking_waitlist: OK';
END;
$$;
