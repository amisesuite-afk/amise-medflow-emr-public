-- Migration: questionnaire_token_expiry
-- Adds an expiry to questionnaire_sessions.session_token. The anonymous
-- bearer token is sent over plain SMS/WhatsApp links — until now it carried
-- no time-to-live (only a status-based reuse guard). This adds a hard
-- expiry so a leaked or forwarded link stops working after a fixed window.
-- Run in Supabase SQL Editor against your production project.
-- 2026-06-08

ALTER TABLE questionnaire_sessions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days');

COMMENT ON COLUMN questionnaire_sessions.expires_at IS
  'Session token stops granting anonymous access after this time (default: 7 days from creation).';

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_name = 'questionnaire_sessions'
            AND column_name = 'expires_at') = 1,
    'Expected questionnaire_sessions.expires_at to exist';
  RAISE NOTICE 'Migration questionnaire_token_expiry: OK';
END;
$$;
