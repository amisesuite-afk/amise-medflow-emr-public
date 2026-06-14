-- Migration: vitals_photo_capture
-- Adds staged storage for vitals readings extracted by Claude Vision from a
-- photo of a BP monitor / scale / thermometer / pulse oximeter / glucometer
-- display, taken by a patient (on their own device, via the questionnaire
-- link) or at the in-clinic kiosk. Extracted values are never written
-- directly to the clinical record — a nurse must confirm or reject them via
-- /api/questionnaire/session/:token/vitals-photo/review before they flow
-- into the vitals table (see populateEMR).
-- Run in Supabase SQL Editor against your production project.
-- 2026-06-14

ALTER TABLE questionnaire_sessions
  ADD COLUMN IF NOT EXISTS extracted_vitals jsonb,
  ADD COLUMN IF NOT EXISTS extracted_vitals_status text
    CHECK (extracted_vitals_status IN ('pending_review', 'confirmed', 'rejected', 'written')),
  ADD COLUMN IF NOT EXISTS extracted_vitals_at timestamptz,
  ADD COLUMN IF NOT EXISTS vitals_confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vitals_confirmed_at timestamptz;

COMMENT ON COLUMN questionnaire_sessions.extracted_vitals IS
  'Vitals readings extracted by Claude Vision from a device-display photo (BP, HR, temp, SpO2, RR, weight, height, glucose), keyed by camelCase field name. Staged for nurse review — never auto-written to the vitals table.';
COMMENT ON COLUMN questionnaire_sessions.extracted_vitals_status IS
  'pending_review: awaiting nurse confirmation. confirmed: nurse approved values, awaiting EMR write. rejected: nurse discarded the photo reading. written: confirmed values have been inserted into the vitals table.';

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_name = 'questionnaire_sessions'
            AND column_name = 'extracted_vitals') = 1,
    'Expected questionnaire_sessions.extracted_vitals to exist';
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_name = 'questionnaire_sessions'
            AND column_name = 'extracted_vitals_status') = 1,
    'Expected questionnaire_sessions.extracted_vitals_status to exist';
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_name = 'questionnaire_sessions'
            AND column_name = 'vitals_confirmed_by') = 1,
    'Expected questionnaire_sessions.vitals_confirmed_by to exist';
  RAISE NOTICE 'Migration vitals_photo_capture: OK';
END;
$$;
