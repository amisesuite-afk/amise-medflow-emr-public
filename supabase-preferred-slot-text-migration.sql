-- Migration: preferred_slot_text
-- Changes appointment_requests.preferred_slot from timestamptz to text.
-- The dashboard manual-entry form and WhatsApp intake both send free-text
-- slot preferences (e.g. "any morning next week", "Tuesday afternoon").
-- Inserting those into a timestamptz column causes a Postgres type error,
-- which surfaces as an HTTP 500/502 on POST /api/booking/request.
-- The column is only used for display and is never compared as a date;
-- the actual scheduling date lives in confirmed_slot (still timestamptz).
-- Run in Supabase SQL Editor against your production project.
-- 2026-06-20

ALTER TABLE appointment_requests
  ALTER COLUMN preferred_slot TYPE text USING preferred_slot::text;

COMMENT ON COLUMN appointment_requests.preferred_slot IS
  'Patient-stated slot preference — free text or ISO date string. Display only; scheduling uses confirmed_slot.';

DO $$
BEGIN
  ASSERT (SELECT data_type FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'appointment_requests'
            AND column_name = 'preferred_slot') = 'text',
    'Expected appointment_requests.preferred_slot to be text';
  RAISE NOTICE 'Migration preferred_slot_text: OK';
END;
$$;
