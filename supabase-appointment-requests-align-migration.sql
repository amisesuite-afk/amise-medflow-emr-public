-- ============================================================================
-- Migration: Align appointment_requests table with application code
-- ============================================================================
-- The production DB has columns (chief_complaint, preferred_site,
-- preferred_date, triage_level) that the application code does not use.
-- The application code expects columns (appointment_type, location,
-- preferred_slot, triage_acuity, triage_score, confirmed_slot, etc.)
-- that do not exist in production.
--
-- Strategy: ADD the missing columns without dropping or renaming existing
-- ones.  The app will write to BOTH old and new column names where there
-- is overlap, so existing data stays intact.
-- ============================================================================

-- Columns the code writes/reads but that do NOT exist in the production DB:
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS appointment_type text;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT 'rodney_bay';
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS preferred_slot text;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS triage_acuity text;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS triage_score int;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS confirmed_slot timestamptz;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS staff_confirmed_at timestamptz;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS patient_confirmed_at timestamptz;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS prep_sms_sent boolean NOT NULL DEFAULT false;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS whatsapp_from text;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS google_event_id text;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS reason text;

-- ── Back-fill new columns from existing production columns ──────────────────
-- appointment_type  <-  chief_complaint
-- location          <-  preferred_site
-- preferred_slot    <-  preferred_date
-- triage_acuity     <-  triage_level
--
-- Only update rows where the new column is still NULL so this is re-runnable.

UPDATE appointment_requests
  SET appointment_type = chief_complaint
  WHERE appointment_type IS NULL
    AND chief_complaint IS NOT NULL;

UPDATE appointment_requests
  SET location = preferred_site
  WHERE (location IS NULL OR location = 'rodney_bay')
    AND preferred_site IS NOT NULL;

UPDATE appointment_requests
  SET preferred_slot = preferred_date
  WHERE preferred_slot IS NULL
    AND preferred_date IS NOT NULL;

UPDATE appointment_requests
  SET triage_acuity = triage_level
  WHERE triage_acuity IS NULL
    AND triage_level IS NOT NULL;

-- ── Ensure service_role and authenticated have access to the new columns ────
-- (Table-level GRANTs cover all columns, but re-state for safety.)
GRANT SELECT, INSERT, UPDATE ON public.appointment_requests TO authenticated, service_role;

-- ── Index on confirmed_slot for the lapse/reminder cron queries ─────────────
CREATE INDEX IF NOT EXISTS idx_appt_requests_confirmed_slot
  ON appointment_requests (status, confirmed_slot)
  WHERE confirmed_slot IS NOT NULL;
