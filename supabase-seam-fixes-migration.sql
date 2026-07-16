-- ============================================================
-- Seam Fixes Migration — 2026-07-15
-- Apply in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Run this ONCE; all statements are idempotent.
-- ============================================================

-- ── 1. questionnaire_session_id FK on appointment_requests ───────────────────
-- Links every web intake booking to its questionnaire session so
-- front-desk staff can see intake answers from the booking inbox.
ALTER TABLE public.appointment_requests
  ADD COLUMN IF NOT EXISTS questionnaire_session_id UUID
    REFERENCES public.questionnaire_sessions(id) ON DELETE SET NULL;

-- Index for lookups from the booking inbox query
CREATE INDEX IF NOT EXISTS idx_appt_req_questionnaire_session
  ON public.appointment_requests(questionnaire_session_id)
  WHERE questionnaire_session_id IS NOT NULL;

-- ── 2. transcription_status on call_logs ─────────────────────────────────────
-- Tracks Whisper transcription lifecycle so staff know which voicemails
-- need manual review (status = 'failed').
ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS transcription_status TEXT
    CHECK (transcription_status IN ('pending', 'completed', 'failed', 'skipped'));

-- ── 3. delivery_method constraint includes 'web_intake' ──────────────────────
-- Fixes silent rejection of web intake sessions.
-- Note: drop and re-add is required to change a CHECK constraint in PG.
ALTER TABLE public.questionnaire_sessions
  DROP CONSTRAINT IF EXISTS questionnaire_sessions_delivery_method_check;

ALTER TABLE public.questionnaire_sessions
  ADD CONSTRAINT questionnaire_sessions_delivery_method_check
    CHECK (delivery_method IN (
      'whatsapp', 'sms', 'web_intake', 'phone', 'manual', 'whatsapp_link'
    ));

-- ── 4. service_role grants audit ─────────────────────────────────────────────
-- Run the query below first to identify which tables are missing grants.
-- Then uncomment and run the GRANT block for any tables it lists.

/*
-- Discovery query — shows tables missing service_role grants:
SELECT t.table_name
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name NOT IN (
    SELECT DISTINCT grantee_table
    FROM (
      SELECT obj_name AS grantee_table
      FROM information_schema.role_table_grants
      WHERE grantee = 'service_role'
        AND table_schema = 'public'
    ) g
  )
ORDER BY t.table_name;
*/

-- Standard grant template — add table names from the discovery query above:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<table_name> TO service_role, authenticated;
