-- ============================================================
-- Slice D — Audit Completeness
-- 2026-07-30
-- Creates canonical audit_log table and patches audit_logs.
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- ── 1. CANONICAL AUDIT LOG ───────────────────────────────────────────────────
-- audit_log (singular) already exists from supabase-audit-trail-migration.sql.
-- This block creates it if it somehow doesn't, then adds missing columns.

CREATE TABLE IF NOT EXISTS audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email    text,
  action        text        NOT NULL,
  resource_type text,
  resource_id   text,       -- text to support non-UUID ids; validated at app layer
  patient_id    uuid        REFERENCES patients(id) ON DELETE SET NULL,
  details       jsonb,
  ip_address    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Add columns introduced by this slice (idempotent)
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS session_id  text,
  ADD COLUMN IF NOT EXISTS user_agent  text,
  ADD COLUMN IF NOT EXISTS mode        text;

CREATE INDEX IF NOT EXISTS audit_log_user_idx      ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_patient_idx   ON audit_log(patient_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx    ON audit_log(action);
CREATE INDEX IF NOT EXISTS audit_log_resource_idx  ON audit_log(resource_type);
CREATE INDEX IF NOT EXISTS audit_log_created_idx   ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'audit_log_insert'
  ) THEN
    CREATE POLICY "audit_log_insert"
      ON audit_log FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'audit_log_select_admin'
  ) THEN
    CREATE POLICY "audit_log_select_admin"
      ON audit_log FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role IN ('admin', 'doctor')
        )
      );
  END IF;
END;
$$;

GRANT INSERT          ON TABLE public.audit_log TO authenticated;
GRANT SELECT, INSERT  ON TABLE public.audit_log TO service_role;

-- ── 2. PATCH audit_logs (legacy table) ───────────────────────────────────────
-- Add missing columns so audit() in supabase.ts stops silently failing.
-- Existing data is preserved; new columns default to null.

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS resource_type text,
  ADD COLUMN IF NOT EXISTS patient_id    uuid REFERENCES patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_email    text,
  ADD COLUMN IF NOT EXISTS details       jsonb;

-- Back-fill resource_type from table_name where present
UPDATE audit_logs
  SET resource_type = table_name
  WHERE resource_type IS NULL AND table_name IS NOT NULL;
