-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2 schema migration
-- Amise MedFlow EMR — 2026-07-24
--
-- Fixes three categories of schema debt:
--
--   A. updated_at on 9 core tables
--      vitals, symptoms, medications, allergies, assessments, plans,
--      procedures, referrals, appointments all appear in the trg_updated_at
--      trigger loop (or need to) but were created without the column.
--      Any UPDATE on these tables currently throws:
--        ERROR: record "new" has no field "updated_at"
--      This is a silent production bug — it surfaces as a 502 whenever the
--      dashboard saves a symptom, medication, allergy, plan, or assessment.
--
--   B. Soft-delete tombstones (deleted_at)
--      Add deleted_at timestamptz (nullable) to the 11 core clinical tables.
--      NULL  → active record
--      SET   → logically deleted; physically retained for sync and audit
--      Required as prerequisite for Phase 5 (offline sync engine).
--
--   C. audit_logs enrichment
--      Add resource_type, patient_id, user_email (all nullable) to audit_logs
--      so the canonical audit() function can carry the same context that the
--      later audit_log table has, without requiring callers to choose a table.
--
-- All statements are idempotent (IF NOT EXISTS / DO $$ blocks).
-- Safe to run against a live database.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A. updated_at columns ────────────────────────────────────────────────────

-- vitals: in base trigger loop, column missing
ALTER TABLE public.vitals
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- symptoms: NOT in base trigger loop, column missing — add column + trigger
ALTER TABLE public.symptoms
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_updated_at ON public.symptoms;
CREATE TRIGGER trg_updated_at
  BEFORE UPDATE ON public.symptoms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- medications: in base trigger loop, column missing
ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- allergies: in base trigger loop, column missing
ALTER TABLE public.allergies
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- assessments: in base trigger loop, column missing
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- plans: in base trigger loop, column missing
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- procedures: in base trigger loop, column missing
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- referrals: in base trigger loop, column missing
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- appointments: in base trigger loop, column missing
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ── B. Soft-delete tombstones ─────────────────────────────────────────────────

-- Core clinical tables — NULL = active, NOT NULL = logically deleted
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.vitals
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.symptoms
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.allergies
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.clinical_notes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ── C. audit_logs enrichment ──────────────────────────────────────────────────
-- Bring audit_logs in line with the later audit_log table's extra columns so
-- a single audit() call can carry resource_type, patient context, and the
-- caller's email without writing to two separate tables.

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS resource_type text,
  ADD COLUMN IF NOT EXISTS patient_id    uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_email    text;

CREATE INDEX IF NOT EXISTS idx_audit_logs_patient_id
  ON public.audit_logs(patient_id)
  WHERE patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type
  ON public.audit_logs(resource_type)
  WHERE resource_type IS NOT NULL;

-- ── D. Sync performance indexes ───────────────────────────────────────────────
-- Partial indexes on (updated_at DESC) WHERE deleted_at IS NULL support the
-- sync watermark query pattern:
--   SELECT * FROM <table> WHERE updated_at > $1 AND deleted_at IS NULL
-- Used by Phase 5 offline sync engine; harmless to add now.

CREATE INDEX IF NOT EXISTS idx_patients_updated_at
  ON public.patients(updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_encounters_updated_at
  ON public.encounters(updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vitals_updated_at
  ON public.vitals(updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_symptoms_updated_at
  ON public.symptoms(updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_medications_updated_at
  ON public.medications(updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_allergies_updated_at
  ON public.allergies(updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assessments_updated_at
  ON public.assessments(updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_plans_updated_at
  ON public.plans(updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_procedures_updated_at
  ON public.procedures(updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_referrals_updated_at
  ON public.referrals(updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_updated_at
  ON public.appointments(updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_notes_updated_at
  ON public.clinical_notes(updated_at DESC)
  WHERE deleted_at IS NULL;

-- ── E. Grants for new columns ─────────────────────────────────────────────────
-- Column additions on tables that already have table-level grants inherit those
-- grants automatically in PostgreSQL — no explicit GRANT needed.
-- Re-stating service_role grants here as a safety net in case any table was
-- missed by supabase-service-role-grants-fix-migration.sql.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vitals       TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.symptoms     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.medications  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.allergies    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assessments  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.plans        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.procedures   TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.referrals    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.appointments TO service_role;
