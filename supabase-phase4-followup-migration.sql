-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4 migration: Follow-up loop — orders, results & referral tracking
-- Amise MedFlow EMR — 2026-07-25
--
-- A. Referral lifecycle timestamps
--    sent_at / response_received_at / escalation_due_at on referrals
--
-- B. escalation_events
--    Critical lab/imaging results unacknowledged >2 h trigger an escalation.
--    Each event row records what was sent, when, and whether it was resolved.
--
-- C. patient_tasks schema unification
--    Two competing CREATE TABLE definitions exist (emr-enhancement-migration.sql
--    and missing-tables-migration.sql). This idempotent migration adds the
--    missing columns from the fuller definition to whichever was applied first.
--
-- All statements are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A. Referral lifecycle timestamps ─────────────────────────────────────────

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS sent_at              timestamptz,
  ADD COLUMN IF NOT EXISTS response_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_due_at    timestamptz;

-- Index for the "referrals awaiting response" query
CREATE INDEX IF NOT EXISTS idx_referrals_status_sent_at
  ON public.referrals(status, sent_at)
  WHERE status IN ('sent', 'pending');

-- ── B. escalation_events ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.escalation_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    text        NOT NULL,  -- 'investigation_result' | 'imaging_order'
  entity_id      uuid        NOT NULL,
  patient_id     uuid        REFERENCES public.patients(id) ON DELETE SET NULL,
  reason         text,                  -- human-readable trigger reason
  escalated_at   timestamptz NOT NULL DEFAULT now(),
  escalated_via  text,                  -- 'sms' | 'email' | 'in_app'
  escalated_to   text,                  -- phone / email of recipient
  resolved_at    timestamptz,
  resolved_by    uuid        REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.escalation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff access" ON public.escalation_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.escalation_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.escalation_events TO service_role;

CREATE INDEX IF NOT EXISTS idx_escalation_events_entity
  ON public.escalation_events(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_escalation_events_patient
  ON public.escalation_events(patient_id)
  WHERE patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_escalation_events_unresolved
  ON public.escalation_events(escalated_at DESC)
  WHERE resolved_at IS NULL;

-- ── C. patient_tasks schema unification ───────────────────────────────────────
-- Add columns present in the fuller definition but absent from the simplified one.

ALTER TABLE public.patient_tasks
  ADD COLUMN IF NOT EXISTS owner_id        uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS due_at          timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_rule text,
  ADD COLUMN IF NOT EXISTS source_table    text,
  ADD COLUMN IF NOT EXISTS source_id       uuid,
  ADD COLUMN IF NOT EXISTS created_by      uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by      uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();

-- Trigger for updated_at (idempotent)
DROP TRIGGER IF EXISTS trg_updated_at ON public.patient_tasks;
CREATE TRIGGER trg_updated_at
  BEFORE UPDATE ON public.patient_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Partial index: open tasks by patient (used by re-entry banner)
CREATE INDEX IF NOT EXISTS idx_patient_tasks_open
  ON public.patient_tasks(patient_id, status)
  WHERE status IN ('open', 'in_progress', 'overdue');

-- Safety net grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.referrals     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_tasks TO service_role;
