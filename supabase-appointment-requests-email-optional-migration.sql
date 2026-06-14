-- Migration: appointment_requests_email_optional
-- The online booking form (artifacts/front-desk/app/book/BookingForm.tsx)
-- treats patient email as optional — phone is the required contact method.
-- createBookingRequest() inserts `patient_email: null` when the patient
-- leaves the field blank, but appointment_requests.patient_email is
-- `not null`, so the insert throws a Postgres not-null-violation. Previously
-- this unhandled exception bubbled up as a raw 500 from
-- /api/booking/create, which the patient saw as a generic
-- "Network error. Please check your connection and try again." — even
-- though their device and connection were fine.
-- Run in Supabase SQL Editor against your production project.
-- 2026-06-12

ALTER TABLE appointment_requests
  ALTER COLUMN patient_email DROP NOT NULL;

DO $$
BEGIN
  ASSERT (SELECT is_nullable FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'appointment_requests'
            AND column_name = 'patient_email') = 'YES',
    'Expected appointment_requests.patient_email to be nullable';
  RAISE NOTICE 'Migration appointment_requests_email_optional: OK';
END;
$$;
