-- Migration: add front-desk staff review columns to questionnaire_sessions
-- Front desk staff are the first and last line in the practice workflow.
-- Nurses review occasionally. Either a staff or nurse review is required
-- before the doctor can approve a session.
-- 2026-06-24

-- Add staff review columns
ALTER TABLE questionnaire_sessions
  ADD COLUMN IF NOT EXISTS staff_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS staff_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS staff_notes text;

-- Update status constraint to include 'staff_reviewed'
ALTER TABLE questionnaire_sessions
  DROP CONSTRAINT IF EXISTS questionnaire_sessions_status_check;

ALTER TABLE questionnaire_sessions
  ADD CONSTRAINT questionnaire_sessions_status_check
  CHECK (status IN (
    'in_progress',
    'completed',
    'abandoned',
    'staff_reviewed',
    'nurse_reviewed',
    'doctor_approved'
  ));
