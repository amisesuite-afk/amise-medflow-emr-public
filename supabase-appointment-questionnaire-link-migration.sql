-- Migration: link appointment_requests to questionnaire_sessions
-- Adds questionnaire_session_id FK so staff can trace a booking back to its
-- questionnaire answers from the dashboard inbox.
-- 2026-06-24

ALTER TABLE appointment_requests
  ADD COLUMN IF NOT EXISTS questionnaire_session_id uuid
  REFERENCES questionnaire_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appt_requests_questionnaire
  ON appointment_requests (questionnaire_session_id)
  WHERE questionnaire_session_id IS NOT NULL;

-- Ensure anon role can write this column (web intake inserts use anon key)
GRANT SELECT, INSERT, UPDATE ON public.appointment_requests TO anon;
