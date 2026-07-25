-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 6 migration: Entry pipeline hardening & patient identity
-- Amise MedFlow EMR — 2026-07-25
--
-- A. patient_identifiers — MRN, NHI, insurance, FHIR ID
--    Enables structured identity lookup and FHIR R4 export (Phase 8).
--
-- B. duplicate_queue — staff review queue for potential duplicate patients
--    Created by fuzzy-match on full_name + phone at patient creation time.
--
-- C. pg_trgm extension — required for fuzzy name matching (GIN trigram index).
--
-- All statements are idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── C. pg_trgm extension ─────────────────────────────────────────────────────
-- Supabase enables this by default; CREATE EXTENSION IF NOT EXISTS is a no-op.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── A. patient_identifiers ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.patient_identifiers (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  system       text        NOT NULL,   -- 'mrn' | 'nhi' | 'insurance' | 'fhir' | 'other'
  value        text        NOT NULL,
  issuer       text,                   -- hospital / insurer / system name
  valid_from   date,
  valid_to     date,
  is_primary   boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (system, value)              -- one canonical ID per system+value pair
);

ALTER TABLE public.patient_identifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff access" ON public.patient_identifiers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_identifiers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_identifiers TO service_role;

DROP TRIGGER IF EXISTS trg_updated_at ON public.patient_identifiers;
CREATE TRIGGER trg_updated_at
  BEFORE UPDATE ON public.patient_identifiers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_patient_identifiers_patient
  ON public.patient_identifiers(patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_identifiers_system_value
  ON public.patient_identifiers(system, value);

-- ── B. duplicate_queue ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.duplicate_queue (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id_a      uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_id_b      uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  match_score       real        NOT NULL,   -- trigram similarity 0.0–1.0
  match_reason      text,                   -- 'name_phone' | 'name_only' | 'phone_only'
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'merged', 'dismissed')),
  reviewed_by       uuid        REFERENCES auth.users(id),
  reviewed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id_a, patient_id_b)
);

ALTER TABLE public.duplicate_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff access" ON public.duplicate_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.duplicate_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.duplicate_queue TO service_role;

CREATE INDEX IF NOT EXISTS idx_duplicate_queue_pending
  ON public.duplicate_queue(status, created_at DESC)
  WHERE status = 'pending';

-- ── GIN trigram index on patients.full_name for fast fuzzy search ─────────────
CREATE INDEX IF NOT EXISTS idx_patients_full_name_trgm
  ON public.patients USING GIN (full_name gin_trgm_ops);
