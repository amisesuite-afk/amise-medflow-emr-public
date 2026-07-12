-- ============================================================
-- Migration: clinical tables — patient_problems + wound_assessments
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times (all IF NOT EXISTS)
-- 2026-07-06
-- ============================================================

-- ── 1. PATIENT PROBLEMS (persistent problem list) ────────────────────────

CREATE TABLE IF NOT EXISTS patient_problems (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  title        text NOT NULL,
  status       text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'chronic', 'resolved')),
  icd10_code   text,
  onset_date   date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_problems_patient_id_idx ON patient_problems(patient_id);

ALTER TABLE patient_problems ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'patient_problems'
    AND policyname  = 'authenticated staff can access patient_problems'
  ) THEN
    CREATE POLICY "authenticated staff can access patient_problems"
      ON patient_problems FOR ALL
      USING (auth.role() = 'authenticated');
  END IF;
END;
$$;

GRANT ALL ON patient_problems TO authenticated;
GRANT ALL ON patient_problems TO service_role;

-- ── 2. WOUND ASSESSMENTS (serial wound tracking) ─────────────────────────

CREATE TABLE IF NOT EXISTS wound_assessments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id    uuid REFERENCES encounters(id) ON DELETE SET NULL,
  label           text NOT NULL DEFAULT 'Wound',
  location        text,
  wound_class     text CHECK (wound_class IN ('clean','clean_contaminated','contaminated','dirty')),
  closure         text CHECK (closure IN ('primary','secondary','delayed_primary','vac','open')),
  status          text NOT NULL DEFAULT 'healing'
                    CHECK (status IN ('healing','superficial_ssi','deep_ssi','dehiscence','seroma','haematoma','necrosis','closed')),
  dressing        text,
  drain           text CHECK (drain IN ('none','in_situ','removed')),
  drain_output_ml integer,
  asepsis_score   integer DEFAULT 0,
  asepsis_details jsonb,
  notes           text,
  assessed_date   date NOT NULL DEFAULT current_date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wound_assessments_patient_idx   ON wound_assessments(patient_id);
CREATE INDEX IF NOT EXISTS wound_assessments_encounter_idx ON wound_assessments(encounter_id);

ALTER TABLE wound_assessments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wound_assessments'
    AND policyname  = 'authenticated staff can access wound_assessments'
  ) THEN
    CREATE POLICY "authenticated staff can access wound_assessments"
      ON wound_assessments FOR ALL
      USING (auth.role() = 'authenticated');
  END IF;
END;
$$;

GRANT ALL ON wound_assessments TO authenticated;
GRANT ALL ON wound_assessments TO service_role;

-- ── 3. VERIFY ────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patient_problems') THEN
    RAISE NOTICE '✓ patient_problems table: OK';
  ELSE
    RAISE EXCEPTION 'patient_problems table was NOT created';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wound_assessments') THEN
    RAISE NOTICE '✓ wound_assessments table: OK';
  ELSE
    RAISE EXCEPTION 'wound_assessments table was NOT created';
  END IF;
END;
$$;
