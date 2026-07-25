-- Migration: Revoke anon access to appointment_requests (PII protection)
-- appointment_requests contains patient names, phones, emails, and medical reasons.
-- The previous GRANT to anon (from supabase-appointment-questionnaire-link-migration.sql)
-- allowed anyone with the public anon key to enumerate all booking data.
-- 2026-07-23

-- 1. Revoke the broad anon grant
REVOKE SELECT, INSERT, UPDATE ON public.appointment_requests FROM anon;

-- 2. Authenticated staff retain full access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_requests TO service_role;

-- 3. Tighten RLS — authenticated staff can read all rows (practice-wide).
--    The existing permissive policy (USING true) is fine for authenticated;
--    we only need to ensure no anon policy exists.
DROP POLICY IF EXISTS "anon can insert appointment_requests" ON public.appointment_requests;
DROP POLICY IF EXISTS "anon can view appointment_requests" ON public.appointment_requests;
DROP POLICY IF EXISTS "anon access" ON public.appointment_requests;

-- 4. Web intake / patient portal: allow anon INSERT only (submit a new booking request).
--    SELECT is NOT granted — patients cannot enumerate existing requests.
--    The patient portal uses a separate patients.auth_user_id FK for reads.
CREATE POLICY "anon can submit booking request"
  ON public.appointment_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);
